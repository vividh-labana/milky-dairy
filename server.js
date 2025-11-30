const express = require('express');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config();

// Catch unhandled errors to prevent silent crashes
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const SALT_ROUNDS = 10;

const app = express();

app.use(cors());

const hostname = '0.0.0.0'; // Allow external connections
const port = process.env.PORT || 3001;

const JWT_SECRET = process.env.JWT_SECRET || 'vividh_secret';

// PostgreSQL connection setup - Supabase
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Test the database connection
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Error connecting to the database:', err);
    } else {
        console.log('Database connected successfully:', res.rows);
    }
});

// Create a new table named seller_buyer_mapping
const createTableQuery = `
CREATE TABLE IF NOT EXISTS seller_buyer_mapping (
    id SERIAL PRIMARY KEY,
    seller_id INT NOT NULL,
    buyer_id INT NOT NULL,
    seller_name VARCHAR(255) NOT NULL,
    buyer_name VARCHAR(255) NOT NULL
);`;

pool.query(createTableQuery, (err, res) => {
    if (err) {
        console.error('Error creating table:', err);
    } else {
        console.log('Table seller_buyer_mapping ready');
    }
});

// Create a new table named role
const createRoleTableQuery = `
CREATE TABLE IF NOT EXISTS role (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('buyer', 'seller')),
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL
);`;

pool.query(createRoleTableQuery, (err, res) => {
    if (err) {
        console.error('Error creating role table:', err);
    } else {
        console.log('Table role ready');
    }
});

// Create a new table named milk_info
const createMilkInfoTableQuery = `
CREATE TABLE IF NOT EXISTS milk_info (
    id SERIAL PRIMARY KEY,
    seller_id INT NOT NULL,
    buyer_id INT NOT NULL,
    date DATE NOT NULL,
    milk_in_litres FLOAT NOT NULL,
    fat FLOAT NOT NULL,
    shift VARCHAR(50) NOT NULL CHECK (shift IN ('morning', 'evening'))
);`;

pool.query(createMilkInfoTableQuery, (err, res) => {
    if (err) {
        console.error('Error creating milk_info table:', err);
    } else {
        console.log('Table milk_info ready');
    }
});

// Create a new table named transaction
const createTransactionTableQuery = `
CREATE TABLE IF NOT EXISTS transaction (
    id SERIAL PRIMARY KEY,
    seller_id INT NOT NULL,
    buyer_id INT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    rate FLOAT NOT NULL,
    total_amount FLOAT NOT NULL
);`;

pool.query(createTransactionTableQuery, (err, res) => {
    if (err) {
        console.error('Error creating transaction table:', err);
    } else {
        console.log('Table transaction ready');
    }
});

// Create a new table named blacklistToken
const createBlacklistTokenTableQuery = `
CREATE TABLE IF NOT EXISTS blacklistToken (
    id SERIAL PRIMARY KEY,
    token TEXT NOT NULL
);`;

pool.query(createBlacklistTokenTableQuery, (err, res) => {
    if (err) {
        console.error('Error creating blacklistToken table:', err);
    } else {
        console.log('Table blacklistToken ready');
    }
});

// Ensure the request body is parsed correctly
app.use(express.json());


function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const checkBlacklistQuery = `
    SELECT * FROM blacklistToken WHERE token = $1;
    `;

    pool.query(checkBlacklistQuery, [token], (err, result) => {
        if (err) {
            console.error('Error checking token blacklist:', err);
            return res.status(500).send('Error checking token blacklist');
        }

        if (result.rows.length > 0) {
            return res.status(403).json({ message: 'Token is blacklisted.' });
        }

        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (err) {
                return res.status(403).json({ message: 'Invalid token.' });
            }
            req.user = user; // Attach user info to the request object
            next();
        });
    });
}

// RBAC Middleware - Require Buyer role
function requireBuyer(req, res, next) {
    if (req.user.role !== 'buyer') {
        return res.status(403).json({ message: 'Access denied. Buyer role required.' });
    }
    next();
}

// RBAC Middleware - Require Seller role
function requireSeller(req, res, next) {
    if (req.user.role !== 'seller') {
        return res.status(403).json({ message: 'Access denied. Seller role required.' });
    }
    next();
}

// Define a route for the root URL
app.get('/', (req, res) => {
    res.status(200).send('<h1>Hello, World!</h1>\n');
});

// Define a route for the root URL
app.get('/vividh', authenticateToken, (req, res) => {
    res.status(200).send('<h1>Hello, World! My name is vividh</h1>\n');
});

// Add an endpoint to insert data into the seller_buyer_mapping table
// Add an endpoint to insert or update data in the seller_buyer_mapping table
// RBAC: Seller only - sellers register themselves with a buyer
app.post('/addSellerBuyerMapping', authenticateToken, requireSeller, (req, res) => {
    const { seller_id, buyer_id, seller_name, buyer_name } = req.body;

    // Validate required fields
    if (!seller_id || !buyer_id || !seller_name || !buyer_name) {
        return res.status(400).json({ message: 'All fields are required: seller_id, buyer_id, seller_name, buyer_name' });
    }

    // Ownership check: Seller can only register themselves
    if (parseInt(seller_id) !== req.user.id) {
        return res.status(403).json({ message: 'You can only register yourself as a seller' });
    }

    const checkExistingQuery = `
    SELECT * FROM seller_buyer_mapping
    WHERE seller_id = $1;
    `;

    const updateQuery = `
    UPDATE seller_buyer_mapping
    SET buyer_id = $2, buyer_name = $3
    WHERE seller_id = $1
    RETURNING *;
    `;

    const insertQuery = `
    INSERT INTO seller_buyer_mapping (seller_id, buyer_id, seller_name, buyer_name)
    VALUES ($1, $2, $3, $4)
    RETURNING *;
    `;

    pool.query(checkExistingQuery, [seller_id], (err, result) => {
        if (err) {
            console.error('Error checking existing seller:', err);
            res.status(500).send('Error checking existing seller');
        } else if (result.rows.length > 0) {
            // Update existing seller
            pool.query(updateQuery, [seller_id, buyer_id, buyer_name], (updateErr, updateResult) => {
                if (updateErr) {
                    console.error('Error updating seller:', updateErr);
                    res.status(500).send('Error updating seller');
                } else {
                    res.status(200).json({ message: 'Seller updated successfully', data: updateResult.rows[0] });
                }
            });
        } else {
            // Insert new seller
            pool.query(insertQuery, [seller_id, buyer_id, seller_name, buyer_name], (insertErr, insertResult) => {
                if (insertErr) {
                    console.error('Error inserting seller:', insertErr);
                    res.status(500).send('Error inserting seller');
                } else {
                    res.status(201).json({ message: 'Seller added successfully', data: insertResult.rows[0] });
                }
            });
        }
    });
});

// Replace the addRole endpoint with a register endpoint
app.post('/register', async (req, res) => {
    const { name, role, username, password } = req.body;

    // Validate required fields
    if (!name || !role || !username || !password) {
        return res.status(400).json({ message: 'All fields are required: name, role, username, password' });
    }

    if (!['buyer', 'seller'].includes(role)) {
        return res.status(400).json({ message: 'Role must be either "buyer" or "seller"' });
    }

    try {
        // Hash the password
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        const registerQuery = `
        INSERT INTO role (name, role, username, password)
        VALUES ($1, $2, $3, $4)
        RETURNING id, name, role, username;
        `;

        const result = await pool.query(registerQuery, [name, role, username, hashedPassword]);
        res.status(201).json({ message: 'User registered successfully', data: result.rows[0] });
    } catch (err) {
        console.error('Error registering user:', err);
        if (err.code === '23505') { // Unique violation
            res.status(409).json({ message: 'Username already exists' });
        } else {
            res.status(500).json({ message: 'Error registering user' });
        }
    }
});

// Change the login endpoint to use POST instead of GET
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    // Validate required fields
    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }

    try {
        const loginQuery = `SELECT * FROM role WHERE username = $1;`;
        const result = await pool.query(loginQuery, [username]);

        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const user = result.rows[0];
        
        // Compare hashed password
        const passwordMatch = await bcrypt.compare(password, user.password);
        
        if (!passwordMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Generate a JWT token
        const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, {
            expiresIn: '1h', // Token expires in 1 hour
        });
        res.status(200).json({ message: 'Login successful', token });
    } catch (err) {
        console.error('Error logging in:', err);
        res.status(500).json({ message: 'Error logging in' });
    }
});

// Add an endpoint to insert data into the milk_info table
// RBAC: Buyer only - buyers add milk entries for their sellers
app.post('/addMilkInfo', authenticateToken, requireBuyer, async (req, res) => {
    const { seller_id, buyer_id, date, milk_in_litres, fat, shift } = req.body;

    // Validate required fields
    if (!seller_id || !buyer_id || !date || milk_in_litres === undefined || fat === undefined || !shift) {
        return res.status(400).json({ message: 'All fields are required: seller_id, buyer_id, date, milk_in_litres, fat, shift' });
    }

    // Ownership check: Buyer can only add milk info for themselves
    if (parseInt(buyer_id) !== req.user.id) {
        return res.status(403).json({ message: 'You can only add milk info as the logged-in buyer' });
    }

    if (!['morning', 'evening'].includes(shift)) {
        return res.status(400).json({ message: 'Shift must be either "morning" or "evening"' });
    }

    if (fat < 0 || fat > 10) {
        return res.status(400).json({ message: 'Fat must be between 0 and 10' });
    }

    if (milk_in_litres <= 0) {
        return res.status(400).json({ message: 'Milk quantity must be greater than 0' });
    }

    try {
        // Check if entry already exists for this date, shift, seller, and buyer
        const checkQuery = `
            SELECT id FROM milk_info 
            WHERE seller_id = $1 AND buyer_id = $2 AND date = $3 AND shift = $4;
        `;
        const existing = await pool.query(checkQuery, [seller_id, buyer_id, date, shift]);
        
        if (existing.rows.length > 0) {
            return res.status(409).json({ 
                message: `Entry already exists for ${date} (${shift} shift). Please edit the existing entry instead.`,
                existingId: existing.rows[0].id
            });
        }

        const insertMilkInfoQuery = `
            INSERT INTO milk_info (seller_id, buyer_id, date, milk_in_litres, fat, shift)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *;
        `;

        const result = await pool.query(insertMilkInfoQuery, [seller_id, buyer_id, date, milk_in_litres, fat, shift]);
        res.status(201).json({ message: 'Milk info data inserted successfully', data: result.rows[0] });
    } catch (err) {
        console.error('Error inserting milk info data:', err);
        res.status(500).json({ message: 'Error inserting milk info data' });
    }
});

// Update milk info entry
app.put('/updateMilkInfo/:id', authenticateToken, requireBuyer, async (req, res) => {
    const { id } = req.params;
    const { seller_id, buyer_id, date, milk_in_litres, fat, shift } = req.body;

    // Validate required fields
    if (!seller_id || !buyer_id || !date || milk_in_litres === undefined || fat === undefined || !shift) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    // Ownership check
    if (parseInt(buyer_id) !== req.user.id) {
        return res.status(403).json({ message: 'You can only update your own entries' });
    }

    if (!['morning', 'evening'].includes(shift)) {
        return res.status(400).json({ message: 'Shift must be either "morning" or "evening"' });
    }

    if (fat < 0 || fat > 10) {
        return res.status(400).json({ message: 'Fat must be between 0 and 10' });
    }

    if (milk_in_litres <= 0) {
        return res.status(400).json({ message: 'Milk quantity must be greater than 0' });
    }

    try {
        // Verify ownership of the entry
        const checkOwnership = await pool.query(
            'SELECT buyer_id FROM milk_info WHERE id = $1',
            [id]
        );

        if (checkOwnership.rows.length === 0) {
            return res.status(404).json({ message: 'Entry not found' });
        }

        if (checkOwnership.rows[0].buyer_id !== req.user.id) {
            return res.status(403).json({ message: 'You can only update your own entries' });
        }

        const updateQuery = `
            UPDATE milk_info 
            SET date = $1, milk_in_litres = $2, fat = $3, shift = $4
            WHERE id = $5
            RETURNING *;
        `;

        const result = await pool.query(updateQuery, [date, milk_in_litres, fat, shift, id]);
        res.status(200).json({ message: 'Entry updated successfully', data: result.rows[0] });
    } catch (err) {
        console.error('Error updating milk info:', err);
        res.status(500).json({ message: 'Error updating entry' });
    }
});

// Update the calculateAmount endpoint to remove SUM since each seller sells milk only once per shift per day
// RBAC: Buyer only - buyers calculate payment for sellers
app.post('/calculateAmount', authenticateToken, requireBuyer, (req, res) => {
    const { buyer_id, seller_id, start_date, end_date, rate } = req.body;

    // Validate required fields
    if (!buyer_id || !seller_id || !start_date || !end_date || rate === undefined) {
        return res.status(400).json({ message: 'All fields are required: buyer_id, seller_id, start_date, end_date, rate' });
    }

    // Ownership check: Buyer can only calculate for themselves
    if (parseInt(buyer_id) !== req.user.id) {
        return res.status(403).json({ message: 'You can only calculate amounts for your own transactions' });
    }

    if (rate <= 0) {
        return res.status(400).json({ message: 'Rate must be greater than 0' });
    }

    const calculateAmountQuery = `
    SELECT date, shift, (milk_in_litres * fat) AS milk_fat
    FROM milk_info
    WHERE buyer_id = $1 AND seller_id = $2 AND date BETWEEN $3 AND $4
    GROUP BY date, shift, milk_in_litres, fat;
    `;

    pool.query(calculateAmountQuery, [buyer_id, seller_id, start_date, end_date], (err, result) => {
        if (err) {
            console.error('Error calculating amount:', err);
            res.status(500).send('Error calculating amount');
        } else {
            let totalAmount = 0;
            result.rows.forEach(row => {
                totalAmount += row.milk_fat * rate;
            });
            res.status(200).json({ message: 'Amount calculated successfully', totalAmount });
        }
    });
});

// Add an endpoint to insert data into the transaction table
// RBAC: Buyer only - buyers create transactions
app.post('/addTransaction', authenticateToken, requireBuyer, (req, res) => {
    const { seller_id, buyer_id, start_date, end_date, rate, total_amount } = req.body;

    // Validate required fields
    if (!seller_id || !buyer_id || !start_date || !end_date || rate === undefined || total_amount === undefined) {
        return res.status(400).json({ message: 'All fields are required: seller_id, buyer_id, start_date, end_date, rate, total_amount' });
    }

    // Ownership check: Buyer can only add transactions for themselves
    if (parseInt(buyer_id) !== req.user.id) {
        return res.status(403).json({ message: 'You can only add transactions as the logged-in buyer' });
    }

    const insertTransactionQuery = `
    INSERT INTO transaction (seller_id, buyer_id, start_date, end_date, rate, total_amount)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *;
    `;

    pool.query(insertTransactionQuery, [seller_id, buyer_id, start_date, end_date, rate, total_amount], (err, result) => {
        if (err) {
            console.error('Error inserting transaction data:', err);
            res.status(500).send('Error inserting transaction data');
        } else {
            res.status(201).json({ message: 'Transaction data inserted successfully', data: result.rows[0] });
        }
    });
});

// Add an endpoint to fetch user info by username
app.get('/getUserInfo',authenticateToken, (req, res) => {
    const { username } = req.query;

    const getUserInfoQuery = `
    SELECT id AS userid, name, role
    FROM role
    WHERE username = $1;
    `;

    pool.query(getUserInfoQuery, [username], (err, result) => {
        if (err) {
            console.error('Error fetching user info:', err);
            res.status(500).send('Error fetching user info');
        } else if (result.rows.length === 0) {
            res.status(404).json({ message: 'User not found' });
        } else {
            res.status(200).json(result.rows[0]);
        }
    });
});

// Update the getSellersByBuyer endpoint to return id and name of sellers
// RBAC: Buyer only - buyers view their associated sellers
app.get('/getSellersByBuyer', authenticateToken, requireBuyer, (req, res) => {
    const { buyer_id } = req.query;

    // Ownership check: Buyer can only view their own sellers
    if (parseInt(buyer_id) !== req.user.id) {
        return res.status(403).json({ message: 'You can only view your own associated sellers' });
    }

    const getSellersQuery = `
    SELECT seller_id AS id, seller_name AS name
    FROM seller_buyer_mapping
    WHERE buyer_id = $1;
    `;

    pool.query(getSellersQuery, [buyer_id], (err, result) => {
        if (err) {
            console.error('Error fetching sellers:', err);
            res.status(500).send('Error fetching sellers');
        } else if (result.rows.length === 0) {
            res.status(404).json({ message: 'No sellers found for the given buyer' });
        } else {
            res.status(200).json(result.rows);
        }
    });
});

// Update the getBuyers endpoint to return id and name of the buyers
// RBAC: Seller only - sellers view list of buyers to register with
app.get('/getBuyers', authenticateToken, requireSeller, (req, res) => {
    const getBuyersQuery = `
    SELECT id, name
    FROM role
    WHERE role = 'buyer';
    `;

    pool.query(getBuyersQuery, (err, result) => {
        if (err) {
            console.error('Error fetching buyers:', err);
            res.status(500).send('Error fetching buyers');
        } else {
            res.status(200).json(result.rows);
        }
    });
});

// Update the getMilkInfoBySeller endpoint to return data as an array
// RBAC: Both roles - sellers view own data, buyers view their associated sellers
app.get('/getMilkInfoBySeller', authenticateToken, (req, res) => {
    const { seller_id } = req.query;

    // Ownership check based on role
    if (req.user.role === 'seller') {
        // Sellers can only view their own milk info
        if (parseInt(seller_id) !== req.user.id) {
            return res.status(403).json({ message: 'You can only view your own milk information' });
        }
    }
    // Buyers can view any seller's data (they should only access their associated sellers via frontend)

    const getMilkInfoQuery = `
    SELECT id, date, shift, milk_in_litres, fat
    FROM milk_info
    WHERE seller_id = $1;
    `;

    pool.query(getMilkInfoQuery, [seller_id], (err, result) => {
        if (err) {
            console.error('Error fetching milk info:', err);
            res.status(500).send('Error fetching milk info');
        } else {
            res.status(200).json(result.rows); // Return data as an array
        }
    });
});

// Add an endpoint to delete milk info from the milk_info table
// RBAC: Buyer only - buyers can delete milk entries
app.delete('/deleteMilkInfo/:id', authenticateToken, requireBuyer, (req, res) => {
    const { id } = req.params;

    // Validate id
    if (!id || isNaN(id)) {
        return res.status(400).json({ message: 'Valid milk info ID is required' });
    }

    const deleteMilkInfoQuery = `
    DELETE FROM milk_info
    WHERE id = $1
    RETURNING *;
    `;

    pool.query(deleteMilkInfoQuery, [id], (err, result) => {
        if (err) {
            console.error('Error deleting milk info:', err);
            res.status(500).send('Error deleting milk info');
        } else if (result.rows.length === 0) {
            res.status(404).json({ message: 'Milk info not found' });
        } else {
            res.status(200).json({ message: 'Milk info deleted successfully', data: result.rows[0] });
        }
    });
});

// Update the getTransactionDetails endpoint to return data as an array
// RBAC: Both roles - sellers view own data, buyers view their associated sellers
app.get('/getTransactionDetails', authenticateToken, (req, res) => {
    const { seller_id } = req.query;

    // Ownership check based on role
    if (req.user.role === 'seller') {
        // Sellers can only view their own transactions
        if (parseInt(seller_id) !== req.user.id) {
            return res.status(403).json({ message: 'You can only view your own transaction details' });
        }
    }
    // Buyers can view any seller's data (they should only access their associated sellers via frontend)

    const getTransactionDetailsQuery = `
    SELECT start_date, end_date, rate, total_amount
    FROM transaction
    WHERE seller_id = $1;
    `;

    pool.query(getTransactionDetailsQuery, [seller_id], (err, result) => {
        if (err) {
            console.error('Error fetching transaction details:', err);
            res.status(500).send('Error fetching transaction details');
        } else {
            res.status(200).json(result.rows); // Return data as an array
        }
    });
});

// Add an endpoint to expire the token
app.post('/logout', authenticateToken, (req, res) => {
    const token = req.headers['authorization'].split(' ')[1];

    const addToBlacklistQuery = `
    INSERT INTO blacklistToken (token)
    VALUES ($1)
    RETURNING *;
    `;

    pool.query(addToBlacklistQuery, [token], (err, result) => {
        if (err) {
            console.error('Error adding token to blacklist:', err);
            res.status(500).send('Error adding token to blacklist');
        } else {
            res.status(200).json({ message: 'Logout successful. Token added to blacklist.', data: result.rows[0] });
        }
    });
});

// Add an endpoint to add a token to the blacklistToken table
app.post('/addToBlacklist', authenticateToken, (req, res) => {
    const token = req.headers['authorization'].split(' ')[1];

    const addToBlacklistQuery = `
    INSERT INTO blacklistToken (token)
    VALUES ($1)
    RETURNING *;
    `;

    pool.query(addToBlacklistQuery, [token], (err, result) => {
        if (err) {
            console.error('Error adding token to blacklist:', err);
            res.status(500).send('Error adding token to blacklist');
        } else {
            res.status(201).json({ message: 'Token added to blacklist successfully', data: result.rows[0] });
        }
    });
});

// Add an endpoint to fetch buyer details by passing seller_id
// RBAC: Seller only - sellers view their associated buyer
app.get('/getBuyerBySeller', authenticateToken, requireSeller, (req, res) => {
    const { seller_id } = req.query;

    // Ownership check: Seller can only view their own buyer
    if (parseInt(seller_id) !== req.user.id) {
        return res.status(403).json({ message: 'You can only view your own associated buyer' });
    }

    const getBuyerQuery = `
    SELECT buyer_id AS id, buyer_name AS name
    FROM seller_buyer_mapping
    WHERE seller_id = $1;
    `;

    pool.query(getBuyerQuery, [seller_id], (err, result) => {
        if (err) {
            console.error('Error fetching buyer details:', err);
            res.status(500).send('Error fetching buyer details');
        } else {
            res.status(200).json(result.rows); // Return data as an array
        }
    });
});

// Start the server
app.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
});