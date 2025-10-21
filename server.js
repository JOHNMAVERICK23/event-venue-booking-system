require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const app = express();
const path = require('path');
const PORT = process.env.PORT || 3000;
const { OAuth2Client } = require('google-auth-library');
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Middleware
app.use(express.static(path.join(__dirname, 'Public')));
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(bodyParser.json());

// PostgreSQL Connection Pool
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'postgres',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
});

pool.connect()
    .then(() => console.log('Connected to PostgreSQL'))
    .catch(err => console.error('Database connection failed:', err));

const JWT_SECRET = process.env.JWT_SECRET || 'mysecretkey123';

async function verifyGoogleToken(token) {
    try {
        const ticket = await googleClient.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID
        });
        const payload = ticket.getPayload();
        return payload;
    } catch (error) {
        console.error('Error verifying Google token:', error);
        return null;
    }
}

async function hashPassword() {
    const password = "admin123";
    const saltRounds = 10;

    try {
        const hashed = await bcrypt.hash(password, saltRounds);
        console.log("Hashed password:", hashed);
    } catch (err) {
        console.error("Error hashing password:", err);
    }
}
hashPassword();

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

// API Routes
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = result.rows[0];
        const validPassword = await bcrypt.compare(password, user.password_hash);

        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { userId: user.user_id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.json({
            token,
            user: {
                userId: user.user_id,
                username: user.username,
                fullName: user.full_name,
                role: user.role,
                email: user.email
            }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/venues', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM venues WHERE status = $1', ['Available']);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching venues:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/venues/availability', async (req, res) => {
    const { venueId, date, startTime, endTime, excludeBookingId } = req.body;

    console.log('Availability check request:', { venueId, date, startTime, endTime });

    try {
        let query = `
            SELECT * FROM event_bookings 
            WHERE venue_id = $1 
            AND event_date = $2
            AND status = $3
            AND ($4 < end_time AND $5 > start_time)`;

        let params = [venueId, date, 'Confirmed', startTime, endTime];

        if (excludeBookingId) {
            query += ' AND booking_id != $6';
            params.push(excludeBookingId);
        }

        const result = await pool.query(query, params);

        if (result.rows.length > 0) {
            res.json({
                available: false,
                conflicts: result.rows,
                message: 'Venue is already booked for the selected time slot'
            });
        } else {
            res.json({ available: true });
        }
    } catch (err) {
        console.error('Error checking availability:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/bookings', async (req, res) => {
    const {
        clientName,
        contactEmail,
        contactPhone,
        eventType,
        venueId,
        eventDate,
        startTime,
        endTime,
        expectedGuests,
        specialRequests,
        googleToken
    } = req.body;

    try {
        if (!googleToken) {
            return res.status(400).json({ error: 'Google authentication required' });
        }

        const googleUser = await verifyGoogleToken(googleToken);
        if (!googleUser) {
            return res.status(400).json({ error: 'Invalid Google authentication' });
        }

        if (googleUser.email !== contactEmail) {
            return res.status(400).json({ error: 'Google account email does not match provided email' });
        }

        const availabilityCheck = await pool.query(`
            SELECT * FROM event_bookings 
            WHERE venue_id = $1 
            AND event_date = $2
            AND status = $3
            AND ($4 < end_time AND $5 > start_time)
        `, [venueId, eventDate, 'Confirmed', startTime, endTime]);

        if (availabilityCheck.rows.length > 0) {
            return res.status(400).json({
                error: 'Venue is not available for the selected time slot',
                conflicts: availabilityCheck.rows
            });
        }

        const result = await pool.query(`
            INSERT INTO event_bookings (
                client_name, contact_email, contact_phone, event_type, 
                venue_id, event_date, start_time, end_time, 
                expected_guests, special_requests, status
            ) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING booking_id
        `, [
            clientName, contactEmail, contactPhone, eventType,
            venueId, eventDate, startTime, endTime,
            expectedGuests, specialRequests || null, 'Pending'
        ]);

        const bookingId = result.rows[0].booking_id;
        res.status(201).json({ booking_id: bookingId });
    } catch (err) {
        console.error('Error creating booking:', err);
        res.status(500).json({ error: 'Server error: ' + err.message });
    }
});

app.get('/api/bookings', authenticateToken, async (req, res) => {
    const { startDate, endDate, venueId, status } = req.query;

    try {
        let query = `
            SELECT 
                b.booking_id, b.client_name, b.contact_email, b.contact_phone,
                b.event_type, b.event_date, b.start_time, b.end_time, 
                b.expected_guests, b.special_requests, b.status,
                v.venue_id, v.venue_name, v.capacity, v.hourly_rate
            FROM event_bookings b
            JOIN venues v ON b.venue_id = v.venue_id
            WHERE 1=1`;

        let params = [];
        let paramIndex = 1;

        if (startDate) {
            query += ` AND b.event_date >= $${paramIndex}`;
            params.push(startDate);
            paramIndex++;
        }

        if (endDate) {
            query += ` AND b.event_date <= $${paramIndex}`;
            params.push(endDate);
            paramIndex++;
        }

        if (venueId) {
            query += ` AND b.venue_id = $${paramIndex}`;
            params.push(venueId);
            paramIndex++;
        }

        if (status) {
            query += ` AND b.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        query += ' ORDER BY b.event_date DESC, b.start_time';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching bookings:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/bookings/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query(`
            SELECT b.*, v.venue_name, v.capacity, v.hourly_rate
            FROM event_bookings b
            JOIN venues v ON b.venue_id = v.venue_id
            WHERE b.booking_id = $1
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error fetching booking details:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.put('/api/bookings/:id/status', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!['Pending', 'Confirmed', 'Cancelled'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    try {
        await pool.query(`
            UPDATE event_bookings 
            SET status = $1, last_updated = CURRENT_TIMESTAMP
            WHERE booking_id = $2
        `, [status, id]);

        res.json({ success: true });
    } catch (err) {
        console.error('Error updating booking status:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.put('/api/bookings/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const bookingData = req.body;

    try {
        const availabilityCheck = await pool.query(`
            SELECT * FROM event_bookings 
            WHERE venue_id = $1 
            AND event_date = $2
            AND status = $3
            AND ($4 < end_time AND $5 > start_time)
            AND booking_id != $6
        `, [
            bookingData.venueId,
            bookingData.eventDate,
            'Confirmed',
            bookingData.startTime,
            bookingData.endTime,
            id
        ]);

        if (availabilityCheck.rows.length > 0) {
            return res.status(400).json({
                error: 'Venue is not available for the selected time slot',
                conflicts: availabilityCheck.rows
            });
        }

        await pool.query(`
            UPDATE event_bookings 
            SET 
                client_name = $1,
                contact_email = $2,
                contact_phone = $3,
                event_type = $4,
                venue_id = $5,
                event_date = $6,
                start_time = $7,
                end_time = $8,
                expected_guests = $9,
                special_requests = $10,
                last_updated = CURRENT_TIMESTAMP
            WHERE booking_id = $11
        `, [
            bookingData.clientName,
            bookingData.contactEmail,
            bookingData.contactPhone,
            bookingData.eventType,
            bookingData.venueId,
            bookingData.eventDate,
            bookingData.startTime,
            bookingData.endTime,
            bookingData.expectedGuests,
            bookingData.specialRequests || null,
            id
        ]);

        res.json({ success: true });
    } catch (err) {
        console.error('Error updating booking:', err);
        res.status(500).json({ error: 'Server error while updating booking' });
    }
});

app.get('/api/calendar', authenticateToken, async (req, res) => {
    const { start, end } = req.query;

    try {
        const result = await pool.query(`
            SELECT 
                b.booking_id, b.client_name, b.event_type, b.event_date, 
                b.start_time, b.end_time, b.status,
                v.venue_id, v.venue_name
            FROM event_bookings b
            JOIN venues v ON b.venue_id = v.venue_id
            WHERE b.event_date BETWEEN $1 AND $2
            ORDER BY b.event_date, b.start_time
        `, [start, end]);

        const events = result.rows.map(booking => ({
            id: booking.booking_id,
            title: `${booking.venue_name} - ${booking.client_name} (${booking.event_type})`,
            start: `${booking.event_date.toISOString().split('T')[0]}T${booking.start_time}`,
            end: `${booking.event_date.toISOString().split('T')[0]}T${booking.end_time}`,
            backgroundColor: booking.status === 'Confirmed' ? '#27ae60' : '#f39c12',
            borderColor: booking.status === 'Confirmed' ? '#27ae60' : '#f39c12',
            extendedProps: {
                venue: booking.venue_name,
                client: booking.client_name,
                type: booking.event_type,
                status: booking.status
            }
        }));

        res.json(events);
    } catch (err) {
        console.error('Error fetching calendar events:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/reports', authenticateToken, async (req, res) => {
    const { startDate, endDate, reportType } = req.query;

    try {
        if (reportType === 'venue-utilization') {
            const result = await pool.query(`
                SELECT 
                    v.venue_id, 
                    v.venue_name,
                    COUNT(b.booking_id) AS booking_count,
                    COALESCE(SUM(
                        EXTRACT(EPOCH FROM (
                            CAST(b.end_time AS TIME) - CAST(b.start_time AS TIME)
                        )) / 60
                    ), 0) AS total_minutes,
                    COALESCE(SUM(
                        (EXTRACT(EPOCH FROM (
                            CAST(b.end_time AS TIME) - CAST(b.start_time AS TIME)
                        )) / 3600) * v.hourly_rate
                    ), 0) AS estimated_revenue
                FROM venues v
                LEFT JOIN event_bookings b 
                    ON v.venue_id = b.venue_id 
                    AND b.event_date BETWEEN $1 AND $2
                    AND b.status = $3
                GROUP BY v.venue_id, v.venue_name, v.hourly_rate
                ORDER BY booking_count DESC
            `, [startDate, endDate, 'Confirmed']);

            res.json(result.rows);
        } else if (reportType === 'event-types') {
            const result = await pool.query(`
                SELECT 
                    event_type,
                    COUNT(booking_id) AS count,
                    AVG(CAST(expected_guests AS FLOAT)) AS avg_guests
                FROM event_bookings
                WHERE event_date BETWEEN $1 AND $2
                AND status = $3
                GROUP BY event_type
                ORDER BY count DESC
            `, [startDate, endDate, 'Confirmed']);

            res.json(result.rows);
        } else {
            res.status(400).json({ error: 'Invalid report type' });
        }
    } catch (err) {
        console.error('Error generating report:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Serve index.html for root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'Public', 'index.html'));
});

// Catch-all for SPA routing - serve index.html for any unmatched routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'Public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});