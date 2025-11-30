const express = require("express");
const router = express.Router();
const axios = require("axios");
const { verifyOneTimeToken } = require("../helpers/verifyHelper");
const checkApiKey = require('../middlewares/checkApiKey');

// Download route
router.get('/:token', verifyOneTimeToken, checkApiKey, async (req, res) => {

  try {

    const check = req.tokenData;
    if (!check.valid) {
      return res.status(403).json({ error: check.reason });
    }

    const { originalUrl } = check.data;
    const range = req.headers.range;

    // ========== 1) First request (no Range) ==========
    if (!range) {
      const head = await axios.head(originalUrl).catch(() => null);
      if (!head)
        return res.status(500).send("Failed to fetch video metadata");

      res.writeHead(200, {
        "Content-Length": head.headers["content-length"],
        "Content-Type": head.headers["content-type"],
        "Accept-Ranges": "bytes"
      });

      return res.end();
    }

    // ========== 2) Partial Content Request (with Range) ==========
    const response = await axios({
      method: "GET",
      url: originalUrl,
      responseType: "stream",
      headers: { Range: range }
    });

    const contentType = response.headers["content-type"];
    const contentRange = response.headers["content-range"];
    const contentLength = response.headers["content-length"];

    // Handle servers that don't return content-range correctly
    if (!contentRange) {
      // fallback: send 200 full
      res.writeHead(200, {
        "Content-Type": contentType,
        "Content-Length": contentLength,
        "Accept-Ranges": "bytes"
      });
      response.data.pipe(res);
      return;
    }

    // Proper seek/resume response
    res.writeHead(206, {
      "Content-Range": contentRange,
      "Accept-Ranges": "bytes",
      "Content-Length": contentLength,
      "Content-Type": contentType
    });

    response.data.pipe(res);

    response.data.on("error", (err) => {
      console.error("Stream error:", err.message);
      res.end();
    });

  } catch (err) {
    console.error(err);
    return res.status(403).send("Invalid or expired streaming token");
  }
});

module.exports = router;
