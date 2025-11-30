require('dotenv').config();

let config = {
  username: process.env.DBASE_USER,
  password: process.env.DBASE_PASSWORD,
  database: process.env.DBASE_NAME,
  host: process.env.DBASE_HOST,
  dialect: process.env.DBASE_DIALECT,
  port: process.env.DBASE_PORT,
};

module.exports = {
  accessTokenSecret: process.env.ACCESS_TOKEN_SECRET,
  accessTokenExpiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN,

  refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET,
  refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN,

  cacheTemporaryTokenPrefix: 'temp_token:',
  cacheTemporaryTokenExpiresInSeconds: 1800,
  development: config,
  test: config,
  production: config
};
