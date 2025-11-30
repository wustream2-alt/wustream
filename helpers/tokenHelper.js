const jwt = require("jsonwebtoken");
require('dotenv').config();


const BASE_URL = process.env.BASE_URL;

const SECRET_KEY = process.env.TOKEN_SECRET; // store in .env

async function generateMovieUrl(fId, title, type, action = "watch", apiKey, runtime = 60) {
  let token;

  let url = '';
  // ONE-TIME DOWNLOAD TOKEN
  // ------------------------------------
  if (action === "download") {

    token = jwt.sign(
      { fId, title, type, apiKey },
      SECRET_KEY,
      { expiresIn: "5m" }
    );

    url = `https://download.wustream.com/${token}`

  } else {
    // Token valid for `runtime` minutes
    token = jwt.sign(
      { fId, title, type, apiKey },
      SECRET_KEY,
      { expiresIn: `${runtime}m` }
    );
    url = `https://api.wustream.com/g/watch/${token}`
  }

  return url;
}

module.exports = { generateMovieUrl };
