const db = require('../firebase/firebase');
const admin = require('firebase-admin');

function extractKey(req) {
  return (
    req.headers['x-api-key'] ||
    req.headers['authorization']?.replace(/^Bearer\s+/i, '') ||
    req.query.api_key ||
    ""
  ).trim();
}

module.exports = async function checkApiKey(req, res, next) {
  const apiKey = extractKey(req);
  if (!apiKey)
    return res.status(401).json({ error: "API key missing" });

  const userRef = db.collection('users').doc(apiKey);

  try {
    const result = await db.runTransaction(async tx => {
      const snap = await tx.get(userRef);

      if (!snap.exists) {
        return { ok: false, status: 401, message: "Invalid API key" };
      }

      const user = snap.data();
      const remain = user.quotaRemaining || 0;

      if (remain <= 0)
        return { ok: false, status: 403, message: "Quota exhausted" };

      tx.update(userRef, {
        quotaRemaining: remain - 1,
        totalFetches: (user.totalFetches || 0) + 1,
        lastFetch: admin.firestore.FieldValue.serverTimestamp()
      });

      return { ok: true, user: { ...user, quotaRemaining: remain - 1 } };
    });

    if (!result.ok)
      return res.status(result.status).json({ error: result.message });

    req.apiUser = result.user;
    req.apiKey = apiKey;

    next();

  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
};
