const jwt = require("jsonwebtoken");
require("dotenv").config();

const SECRET_KEY = process.env.TOKEN_SECRET;

async function verifyOneTimeToken(req, res, next) {
  try {
    const token = req.params.token; // /route/:token

    if (!token) {
      return res.status(400).json({ 
        valid: false, 
        reason: "Token required" 
      });
    }

    // Decode
    const data = jwt.verify(token, SECRET_KEY);

    const { fId, title, type, apiKey } = data;

    // Validate payload
    if (!fId || !title || !type || !apiKey) {
      return res.status(400).json({
        valid: false,
        reason: "Token payload incomplete"
      });
    }

    // Build redirect URL
    const originalUrl = `https://xstreamx.films365.org/${type}/${fId}/${title}`;

    // Attach to request (safe)
    req.apiKey = apiKey;
    req.tokenData = {
      valid: true,
      data: {
        originalUrl,
        title
      },
    };

    return next();

  } catch (err) {
    return res.json({
      valid: false,
      reason: "Invalid or expired token",
    });
  }
}

module.exports = { verifyOneTimeToken };
