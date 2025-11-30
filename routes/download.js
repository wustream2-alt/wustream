const express = require('express');
const router = express.Router();
const axios = require('axios');
const { verifyOneTimeToken } = require("../helpers/verifyHelper");
const checkApiKey = require('../middlewares/checkApiKey');


// Download route
router.get('/:token',verifyOneTimeToken, checkApiKey, async (req, res) => {

  try {

    const check = req.tokenData;

    if (!check.valid) {
      return res.status(403).json({ error: check.reason });
    }

    const { originalUrl, title} = check.data;


    // Stream the file
    try {
      const response = await axios({
        method: 'GET',
        url: originalUrl,
        responseType: 'stream',
        timeout: 60000
      });

      if (response.headers['content-type']) {
        res.setHeader('Content-Type', response.headers['content-type']);
      }

      const safeTitle = title.replace(/[^\w\s()-]/g, '').trim();
      res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.mp4"`);

      response.data.pipe(res);

      response.data.on('error', (err) => {
        console.error('Stream error:', err.message);
        res.end();
      });
    } catch (err) {
      console.error('❌ Download failed:', err.message);
      if (err.response) {
        res.status(err.response.status).send(`Error fetching file: ${err.response.statusText}`);
      } else {
        res.status(500).send('Failed to download file');
      }
    }

  } catch (err) {
    return res.status(403).send('Invalid or expired download link');
  }
});

module.exports = router;
