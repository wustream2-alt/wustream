// routes/imageRouter.js
const express = require("express");
const axios = require("axios");
const router = express.Router();
const { encrypt, decrypt } = require("../helpers/crypto-helper"); // corrected path

router.get("/:type/:token", async (req, res) => {
  try {
    const { type, token } = req.params;

    if (!token) {
      return res.status(400).json({ success: false, message: "Missing token" });
    }

    // --- Decrypt safely ---
    let decrypted;

    try {
      decrypted = decrypt(token);
    } catch (e) {
      return res.status(400).json({ success: false, message: "Invalid token" });
    }

    // Ensure decrypted filename is safe
    if (!/^[a-zA-Z0-9_\-\.]+\.jpg$/.test(decrypted)) {
      return res.status(400).json({ success: false, message: "Invalid filename" });
    }

    // Choose TMDB size
    const size = type === "b" ? "w1280" : "w500";

    const finalUrl = `https://image.tmdb.org/t/p/${size}/${decrypted}`;

    // Extra security: allow only TMDB domain
    if (!finalUrl.startsWith("https://image.tmdb.org/t/p/")) {
      return res.status(403).json({ success: false, message: "URL not allowed" });
    }

    // Fetch from TMDB
    const response = await axios.get(finalUrl, { responseType: "arraybuffer" });

    // Forward content-type
    const contentType = response.headers["content-type"] || "image/jpeg";
    res.set("Content-Type", contentType);

    // Send image binary
    res.send(response.data);

  } catch (err) {
    console.error("IMAGE ROUTER ERROR:", err.message);
    return res.status(500).json({ success: false, message: "Failed to fetch image" });
  }
});

module.exports = router;
