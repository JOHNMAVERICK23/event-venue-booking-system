require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const sql = require('mssql');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const app = express();
const path = require('path');
const PORT = process.env.PORT || 3000;
const { OAuth2Client } = require('google-auth-library');
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);


app.use(express.static(path.join(__dirname, 'public')));
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(bodyParser.json());

const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

const JWT_SECRET = process.env.JWT_SECRET || 'mysecretkey123';
let pool;

sql.connect(dbConfig).then(p => {
    pool = p;
    console.log('Connected to SQL Server');
}).catch(err => {
    console.error('Database connection failed:', err);
});

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

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    
    try {
        const result = await pool.request()
            .input('username', sql.NVarChar, username)
            .query('SELECT * FROM users WHERE username = @username');
        
        if (result.recordset.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const user = result.recordset[0];
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
        const result = await pool.request()
            .query('SELECT * FROM venues WHERE status = \'Available\'');
        
        res.json(result.recordset);
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
            WHERE venue_id = @venueId 
            AND event_date = @date
            AND status = 'Confirmed'
            AND (
                (@startTime < end_time AND @endTime > start_time)
            )`;

        const request = pool.request()
            .input('venueId', sql.Int, venueId)
            .input('date', sql.Date, date)
            .input('startTime', sql.NVarChar, startTime)
            .input('endTime', sql.NVarChar, endTime)            

        if (excludeBookingId) {
            query += ' AND booking_id != @excludeBookingId';
            request.input('excludeBookingId', sql.Int, excludeBookingId);
        }

        const result = await request.query(query);

        if (result.recordset.length > 0) {
            res.json({ available: false, 
                conflicts: result.recordset,
                message: 'Venue is already booked for the selected time slot' });
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
        specialRequests ,
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

        
        const availabilityCheck = await pool.request()
            .input('venueId', sql.Int, venueId)
            .input('date', sql.Date, eventDate)
            .input('startTime', sql.NVarChar, startTime)
            .input('endTime', sql.NVarChar, endTime)

            .query(`
                SELECT * FROM event_bookings 
                WHERE venue_id = @venueId 
                AND event_date = @date
                AND status = 'Confirmed'
                AND (@startTime < end_time AND @endTime > start_time)
            `);
        
        if (availabilityCheck.recordset.length > 0) {
            return res.status(400).json({ 
                error: 'Venue is not available for the selected time slot',
                conflicts: availabilityCheck.recordset 
            });
        }
        
        const result = await pool.request()
            .input('clientName', sql.NVarChar, clientName)
            .input('contactEmail', sql.NVarChar, contactEmail)
            .input('contactPhone', sql.NVarChar, contactPhone)
            .input('eventType', sql.NVarChar, eventType)
            .input('venueId', sql.Int, venueId)
            .input('eventDate', sql.Date, new Date(eventDate))
            .input('startTime', sql.NVarChar, startTime)
            .input('endTime', sql.NVarChar, endTime)
            .input('expectedGuests', sql.Int, expectedGuests)
            .input('specialRequests', sql.NVarChar, specialRequests)
            .input('googleId', sql.NVarChar, googleUser.sub) 
            .query(`
                INSERT INTO event_bookings (
                    client_name, contact_email, contact_phone, event_type, 
                    venue_id, event_date, start_time, end_time, 
                    expected_guests, special_requests, status
                ) 
                OUTPUT INSERTED.booking_id
                VALUES (
                    @clientName, @contactEmail, @contactPhone, @eventType, 
                    @venueId, @eventDate, @startTime, @endTime, 
                    @expectedGuests, @specialRequests, 'Pending'
                )
            `);        
        
        const bookingId = result.recordset[0].booking_id;
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
            WHERE 1=1
        `;
        
        const request = pool.request();
        
        if (startDate) {
            query += ' AND b.event_date >= @startDate';
            request.input('startDate', sql.Date, startDate);
        }
        
        if (endDate) {
            query += ' AND b.event_date <= @endDate';
            request.input('endDate', sql.Date, endDate);
        }
        
        if (venueId) {
            query += ' AND b.venue_id = @venueId';
            request.input('venueId', sql.Int, venueId);
        }
        
        if (status) {
            query += ' AND b.status = @status';
            request.input('status', sql.NVarChar, status);
        }
        
        query += ' ORDER BY b.event_date DESC, b.start_time';
        
        const result = await request.query(query);
        res.json(result.recordset);
    } catch (err) {
        console.error('Error fetching bookings:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/bookings/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    
    try {
        const result = await pool.request()
            .input('bookingId', sql.Int, id)
            .query(`
                SELECT b.*, v.venue_name, v.capacity, v.hourly_rate
                FROM event_bookings b
                JOIN venues v ON b.venue_id = v.venue_id
                WHERE b.booking_id = @bookingId
            `);
        
        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Booking not found' });
        }
        
        res.json(result.recordset[0]);
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
        await pool.request()
            .input('bookingId', sql.Int, id)
            .input('status', sql.NVarChar, status)
            .query(`
                UPDATE event_bookings 
                SET status = @status, last_updated = GETDATE()
                WHERE booking_id = @bookingId
            `);
        
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
        
        const availabilityCheck = await pool.request()
            .input('venueId', sql.Int, bookingData.venueId)
            .input('date', sql.Date, bookingData.eventDate)
            .input('startTime', sql.NVarChar,bookingData.startTime)
            .input('endTime', sql.NVarChar, bookingData.endTime)
            .input('excludeBookingId', sql.Int, id)
            .query(`
                SELECT * FROM event_bookings 
                WHERE venue_id = @venueId 
                AND event_date = @date
                AND status = 'Confirmed'
                AND (@startTime < end_time AND @endTime > start_time)
                AND booking_id != @excludeBookingId
            `);

        if (availabilityCheck.recordset.length > 0) {
            return res.status(400).json({
                error: 'Venue is not available for the selected time slot',
                conflicts: availabilityCheck.recordset
            });
        }

      
        await pool.request()
            .input('bookingId', sql.Int, id)
            .input('clientName', sql.NVarChar, bookingData.clientName)
            .input('contactEmail', sql.NVarChar, bookingData.contactEmail)
            .input('contactPhone', sql.NVarChar, bookingData.contactPhone)
            .input('eventType', sql.NVarChar, bookingData.eventType)
            .input('venueId', sql.Int, bookingData.venueId)
            .input('eventDate', sql.Date, bookingData.eventDate)
            .input('startTime', sql.NVarChar, bookingData.startTime)
            .input('endTime', sql.NVarChar, bookingData.endTime)
            .input('expectedGuests', sql.Int, bookingData.expectedGuests)
            .input('specialRequests', sql.NVarChar, bookingData.specialRequests || null)
            .query(`
                UPDATE event_bookings 
                SET 
                    client_name = @clientName,
                    contact_email = @contactEmail,
                    contact_phone = @contactPhone,
                    event_type = @eventType,
                    venue_id = @venueId,
                    event_date = @eventDate,
                    start_time = @startTime,
                    end_time = @endTime,
                    expected_guests = @expectedGuests,
                    special_requests = @specialRequests,
                    last_updated = GETDATE()
                WHERE booking_id = @bookingId
            `);

        res.json({ success: true });
    } catch (err) {
        console.error('Error updating booking:', err);
        res.status(500).json({ error: 'Server error while updating booking' });
    }
});

app.get('/api/calendar', authenticateToken, async (req, res) => {
    const { start, end } = req.query;
    
    try {
        const result = await pool.request()
            .input('startDate', sql.Date, start)
            .input('endDate', sql.Date, end)
            .query(`
                SELECT 
                    b.booking_id, b.client_name, b.event_type, b.event_date, 
                    b.start_time, b.end_time, b.status,
                    v.venue_id, v.venue_name
                FROM event_bookings b
                JOIN venues v ON b.venue_id = v.venue_id
                WHERE b.event_date BETWEEN @startDate AND @endDate
                ORDER BY b.event_date, b.start_time
            `);

        const events = result.recordset.map(booking => ({
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
            const result = await pool.request()
                .input('startDate', sql.Date, startDate)
                .input('endDate', sql.Date, endDate)
                .query(`
                    SELECT 
                        v.venue_id, 
                        v.venue_name,
                        COUNT(b.booking_id) AS booking_count,
                        ISNULL(SUM(DATEDIFF(
                            MINUTE,
                            CAST(b.start_time AS TIME),
                            CAST(b.end_time AS TIME)
                        )), 0) AS total_minutes,
                        ISNULL(SUM(
                            DATEDIFF(
                                MINUTE,
                                CAST(b.start_time AS TIME),
                                CAST(b.end_time AS TIME)
                            ) / 60.0 * v.hourly_rate
                        ), 0) AS estimated_revenue
                    FROM venues v
                    LEFT JOIN event_bookings b 
                        ON v.venue_id = b.venue_id 
                        AND b.event_date BETWEEN @startDate AND @endDate
                        AND b.status = 'Confirmed'
                    GROUP BY v.venue_id, v.venue_name, v.hourly_rate
                    ORDER BY booking_count DESC
                `);
            
            res.json(result.recordset);
        } else if (reportType === 'event-types') {
            const result = await pool.request()
                .input('startDate', sql.Date, startDate)
                .input('endDate', sql.Date, endDate)
                .query(`
                    SELECT 
                        event_type,
                        COUNT(booking_id) AS count,
                        AVG(CAST(expected_guests AS FLOAT)) AS avg_guests
                    FROM event_bookings
                    WHERE event_date BETWEEN @startDate AND @endDate
                    AND status = 'Confirmed'
                    GROUP BY event_type
                    ORDER BY count DESC
                `);
            
            res.json(result.recordset);
        } else {
            res.status(400).json({ error: 'Invalid report type' });
        }
    } catch (err) {
        console.error('Error generating report:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
