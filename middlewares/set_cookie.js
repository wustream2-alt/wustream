// middlewares/setCookie.js
const jwt = require('jsonwebtoken');
require('dotenv').config();

const SECRET_KEY = process.env.TOKEN_SECRET;

function setCookie(req, res, next) {
    try {
        // Remove previous cookie (optional)
        res.clearCookie('prisonBreak1');

        // Create token
        const token = jwt.sign(
            {
                apiKey: '35cfabe1-98f2-448c-b790-0a0284151acc'
            },
            SECRET_KEY,
            {
                subject: 'accessApi',
                expiresIn: "7d" // No need for 5 minutes
            }
        );

        // Set cookie
        res.cookie('prisonBreak1', token, {
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',  
            sameSite: 'Lax', // Lax works better for navigation
            path: '/',       // important for accessibility
        });

        return next();

    } catch (err) {
        console.error("COOKIE ERROR:", err);
        return res.status(500).json({ message: "Cookie setup failed" });
    }
}

module.exports = setCookie;
