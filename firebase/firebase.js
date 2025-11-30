const admin = require('firebase-admin');
const path = require('path');

require('dotenv').config();
const serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_JSON);

// Convert escaped newlines in private key
serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

module.exports = db;
