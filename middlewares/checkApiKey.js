const db = require('../firebase/firebase');
const admin = require('firebase-admin');
const apiKeys = require("../apiKeys");
const jwt = require('jsonwebtoken');
require('dotenv').config();

const SECRET_KEY = process.env.TOKEN_SECRET;


function extractApiKeyFromCookie(req) {
  try {
    const token = req.cookies?.prisonBreak1;
    if (!token) return null;

    const decoded = jwt.verify(token, SECRET_KEY);
    return decoded?.apiKey || null;
  } catch (err) {
    return null;
  }
}

function extractKey(req) {
  return (
    req.headers['x-api-key'] ||
    req.headers['authorization']?.replace(/^Bearer\s+/i, '') ||
    req.query.api_key ||
    req.apiKey ||
    extractApiKeyFromCookie(req) ||
    ""
  ).trim();
}

/**
 * Fetch user from Firebase AND replicate into NeDB (first-time use only)
 */
async function fetchFromFireBase(apiKey) {
  const userRef = db.collection('users').doc(apiKey);

  try {
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);

      if (!snap.exists) {
        return { ok: false, message: "Invalid API key" };
      }

      const user = snap.data();

      const quotaRemaining =
        (user.quotaRemaining !== undefined)
          ? user.quotaRemaining
          : user.quotaTotal;

      return {
        ok: true,
        user: {
          ...user,
          quotaRemaining
        }
      };
    });

    if (!result.ok) return { error: result.message };

    return result;

  } catch (err) {
    return { ok: false, message: err.message };
  }
}

async function updateFirebaseQuota(apiKey, quotaRemaining, totalFetches) {
  const ref = db.collection("users").doc(apiKey);

  try {
    await ref.update({
      quotaRemaining,
      totalFetches,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (e) {
    console.error("Firebase quota update failed:", e.message);
  }
}

module.exports = async function checkApiKey(req, res, next) {
  try {
    const apiKey = extractKey(req);

    if (!apiKey)
      return res.status(401).json({ error: "API key missing" });

    // Try finding user in NeDB first
    let userKey = await apiKeys.findOne({ apiKey });

    // ❗ If not found, fetch from Firestore ONCE
    if (!userKey) {
      const result = await fetchFromFireBase(apiKey);

      if (!result || !result.user) {
        return res.status(403).json({ error: "Invalid API key" });
      }

      const fbUser = result.user;

      // Insert into local NeDB
      await apiKeys.insert({
        apiKey,
        quotaRemaining: fbUser.quotaRemaining,
        quotaTotal: fbUser.quotaTotal,
        totalFetches: fbUser.totalFetches,
        disabled: fbUser.disabled || false,
        createdAt: fbUser.createdAt || new Date()
      });

      // Set for request
      userKey = {
        apiKey,
        quotaRemaining: fbUser.quotaRemaining,
        quotaTotal: fbUser.quotaTotal,
        totalFetches: fbUser.totalFetches,
        disabled: fbUser.disabled || false,
        createdAt: fbUser.createdAt || new Date()
      };
    }

    // ❗ CHECK DISABLED FIRST
    if (userKey.disabled === true) {
      return res.status(403).json({ error: "API Key disabled" });
    }

    // ❗ Check remaining quota
    if (userKey.quotaRemaining <= 0) {
      return res.status(403).json({ error: "Quota exhausted" });
    }

    // 4️⃣ Deduct quota
    const newRemaining = userKey.quotaRemaining - 1;
    const newFetchCount = userKey.totalFetches + 1;


    // Update existing record
    await apiKeys.update(
      { apiKey },
      {
        $set: {
          quotaRemaining: newRemaining,
          totalFetches: newFetchCount
        }
      },
      { multi: false }
    );

    apiKeys.persistence.compactDatafile();

    // 5️⃣ Sync with Firebase (non-blocking)
    updateFirebaseQuota(apiKey, newRemaining, newFetchCount);


    // Attach updated info to req
    req.apiUser = {
      ...userKey,
      quotaRemaining: userKey.quotaRemaining - 1,
      totalFetches: userKey.totalFetches + 1
    };

    req.apiKey = apiKey;

    next();

  } catch (err) {
    console.error("API KEY ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};
