// routes/googleAuth.js
const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const router = express.Router();

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/google/callback';
const JWT_SECRET = process.env.JWT_SECRET || 'mysecretkey123';

// Email transporter configuration
const transporter = nodemailer.createTransporter({
    service: 'gmail', // or your email service
    auth: {
        user: process.env.EMAIL_USER, // your email
        pass: process.env.EMAIL_PASS  // your app password
    }
});

// In-memory storage for verification codes (use Redis/database in production)
const verificationCodes = new Map();
const pendingUsers = new Map();

// Step 1: Redirect to Google login with action parameter
router.get('/login', (req, res) => {
    const action = req.query.action || 'signin'; // 'signin' or 'signup'
    const state = Buffer.from(JSON.stringify({ action })).toString('base64');
    
    const authURL = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=openid%20email%20profile&state=${state}`;
    res.redirect(authURL);
});

// Step 2: Callback from Google
router.get('/callback', async (req, res) => {
    const code = req.query.code;
    const state = req.query.state;
    
    try {
        // Decode state to get action
        const { action } = JSON.parse(Buffer.from(state, 'base64').toString());
        
        // Exchange code for tokens
        const tokenRes = await axios.post('https://oauth2.googleapis.com/token', null, {
            params: {
                code,
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                redirect_uri: REDIRECT_URI,
                grant_type: 'authorization_code',
            },
        });

        const { access_token } = tokenRes.data;

        // Get user info from Google
        const userInfo = await axios.get(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${access_token}`);
        const googleUser = userInfo.data;

        // Check if user exists in database
        const pool = req.app.locals.pool; // Assuming you pass pool to app.locals
        const existingUser = await pool.request()
            .input('email', googleUser.email)
            .query('SELECT * FROM users WHERE email = @email');

        if (action === 'signup') {
            if (existingUser.recordset.length > 0) {
                return res.redirect(`http://localhost:3000?error=user_exists&message=This Google account is already registered. Please sign in instead.`);
            }
            
            // Generate verification code
            const verificationCode = crypto.randomInt(100000, 999999).toString();
            const codeId = crypto.randomUUID();
            
            // Store verification code and user data temporarily
            verificationCodes.set(codeId, {
                code: verificationCode,
                email: googleUser.email,
                expires: Date.now() + 10 * 60 * 1000 // 10 minutes
            });
            
            pendingUsers.set(codeId, {
                email: googleUser.email,
                name: googleUser.name,
                picture: googleUser.picture,
                google_id: googleUser.sub
            });

            // Send verification email
            await sendVerificationEmail(googleUser.email, verificationCode);
            
            return res.redirect(`http://localhost:3000?action=verify_signup&codeId=${codeId}&email=${encodeURIComponent(googleUser.email)}`);
            
        } else if (action === 'signin') {
            if (existingUser.recordset.length === 0) {
                return res.redirect(`http://localhost:3000?error=user_not_found&message=This Google account is not registered. Please sign up first.`);
            }
            
            // Generate verification code for signin
            const verificationCode = crypto.randomInt(100000, 999999).toString();
            const codeId = crypto.randomUUID();
            
            verificationCodes.set(codeId, {
                code: verificationCode,
                email: googleUser.email,
                expires: Date.now() + 10 * 60 * 1000 // 10 minutes
            });

            // Send verification email
            await sendVerificationEmail(googleUser.email, verificationCode);
            
            return res.redirect(`http://localhost:3000?action=verify_signin&codeId=${codeId}&email=${encodeURIComponent(googleUser.email)}`);
        }

    } catch (err) {
        console.error('Google Auth error:', err.response?.data || err.message);
        return res.redirect(`http://localhost:3000?error=auth_failed&message=Authentication failed. Please try again.`);
    }
});

// Step 3: Verify code for signup
router.post('/verify-signup', async (req, res) => {
    const { codeId, code } = req.body;
    
    try {
        const storedData = verificationCodes.get(codeId);
        const userData = pendingUsers.get(codeId);
        
        if (!storedData || !userData) {
            return res.status(400).json({ error: 'Invalid or expired verification code' });
        }
        
        if (Date.now() > storedData.expires) {
            verificationCodes.delete(codeId);
            pendingUsers.delete(codeId);
            return res.status(400).json({ error: 'Verification code expired' });
        }
        
        if (storedData.code !== code) {
            return res.status(400).json({ error: 'Invalid verification code' });
        }
        
        // Create user in database
        const pool = req.app.locals.pool;
        const result = await pool.request()
            .input('email', userData.email)
            .input('fullName', userData.name)
            .input('googleId', userData.google_id)
            .input('picture', userData.picture)
            .query(`
                INSERT INTO users (email, full_name, google_id, profile_picture, role, created_date)
                OUTPUT INSERTED.user_id, INSERTED.email, INSERTED.full_name, INSERTED.role
                VALUES (@email, @fullName, @googleId, @picture, 'user', GETDATE())
            `);
        
        const newUser = result.recordset[0];
        
        // Generate JWT token
        const token = jwt.sign(
            { 
                userId: newUser.user_id, 
                email: newUser.email, 
                fullName: newUser.full_name,
                role: newUser.role 
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        // Clean up temporary storage
        verificationCodes.delete(codeId);
        pendingUsers.delete(codeId);
        
        res.json({
            success: true,
            message: 'Account created successfully!',
            user: newUser,
            token
        });
        
    } catch (err) {
        console.error('Signup verification error:', err);
        res.status(500).json({ error: 'Failed to create account' });
    }
});

// Step 3: Verify code for signin
router.post('/verify-signin', async (req, res) => {
    const { codeId, code } = req.body;
    
    try {
        const storedData = verificationCodes.get(codeId);
        
        if (!storedData) {
            return res.status(400).json({ error: 'Invalid or expired verification code' });
        }
        
        if (Date.now() > storedData.expires) {
            verificationCodes.delete(codeId);
            return res.status(400).json({ error: 'Verification code expired' });
        }
        
        if (storedData.code !== code) {
            return res.status(400).json({ error: 'Invalid verification code' });
        }
        
        // Get user from database
        const pool = req.app.locals.pool;
        const result = await pool.request()
            .input('email', storedData.email)
            .query('SELECT user_id, email, full_name, role, profile_picture FROM users WHERE email = @email');
        
        const user = result.recordset[0];
        
        // Generate JWT token
        const token = jwt.sign(
            { 
                userId: user.user_id, 
                email: user.email, 
                fullName: user.full_name,
                role: user.role 
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        // Clean up temporary storage
        verificationCodes.delete(codeId);
        
        res.json({
            success: true,
            message: 'Sign in successful!',
            user,
            token
        });
        
    } catch (err) {
        console.error('Signin verification error:', err);
        res.status(500).json({ error: 'Failed to sign in' });
    }
});

// Resend verification code
router.post('/resend-code', async (req, res) => {
    const { codeId } = req.body;
    
    try {
        const storedData = verificationCodes.get(codeId);
        
        if (!storedData) {
            return res.status(400).json({ error: 'Invalid request' });
        }
        
        // Generate new code
        const newCode = crypto.randomInt(100000, 999999).toString();
        
        // Update stored data
        verificationCodes.set(codeId, {
            ...storedData,
            code: newCode,
            expires: Date.now() + 10 * 60 * 1000 // Reset expiry
        });
        
        // Send new verification email
        await sendVerificationEmail(storedData.email, newCode);
        
        res.json({ success: true, message: 'New verification code sent' });
        
    } catch (err) {
        console.error('Resend code error:', err);
        res.status(500).json({ error: 'Failed to resend code' });
    }
});

async function sendVerificationEmail(email, code) {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'City of Dreams Manila - Verification Code',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">City of Dreams Manila</h2>
                <p>Your verification code is:</p>
                <div style="background-color: #f0f0f0; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; color: #333; letter-spacing: 5px; margin: 20px 0;">
                    ${code}
                </div>
                <p>This code will expire in 10 minutes.</p>
                <p>If you didn't request this code, please ignore this email.</p>
            </div>
        `
    };
    
    await transporter.sendMail(mailOptions);
}

module.exports = router;