// services/blockedIpsService.js
const admin = require("firebase-admin");
const db = require("../firebase/firebase");

// In-memory blocklist map
// structure: BLOCKED_IPS.set(ip, { blockedUntil, reason })
const BLOCKED_IPS = new Map();


/**
 * Save blocked IP to Firestore
 */
async function saveBlockedIpToFirestore(ip, reason, hours = 24) {
  const blockedUntil = Date.now() + hours * 60 * 60 * 1000;

  await db.collection("blockedIPs").doc(ip).set({
    ip,
    reason,
    blockedUntil,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });


  // Also update in-memory
  BLOCKED_IPS.set(ip, { reason, blockedUntil });
}

/**
 * Load all active blocked IPs into memory on server start
 */
async function loadBlockedIpsToMemory() {
  console.log("Loading blocked IPs from Firestore...");

  const snapshot = await db.collection("blockedIPs").get();

  snapshot.forEach(doc => {
    const data = doc.data();
    if (!data.blockedUntil) return;

    // remove expired ones from Firestore
    if (data.blockedUntil <= Date.now()) {
      db.collection("blockedIPs").doc(doc.id).delete();
      return;
    }

    BLOCKED_IPS.set(doc.id, {
      reason: data.reason,
      blockedUntil: data.blockedUntil
    });
  });

  console.log("Active blocked IPs loaded:", BLOCKED_IPS.size);
}



/**
 * Check if IP is blocked
 */
async function isBlocked(ip) {
  const entry = BLOCKED_IPS.get(ip);

  // Not in memory → treat as unblocked
  if (!entry) return false;


  const doc = await db.collection("blockedIPs").doc(ip).get();


  // If not in Firestore → remove from memory & return false
  if (!doc.exists) {
    BLOCKED_IPS.delete(ip);
    return false;
  }

  // If not in Firestore → remove from memory & return false
  if (!doc.exists) {
    BLOCKED_IPS.delete(ip);
    return false;
  }

  // If not in Firestore → remove from memory & return false
  if (!doc.exists) {
    BLOCKED_IPS.delete(ip);
    return false;
  }

  // If expired → remove from memory & Firestore
  if (entry.blockedUntil <= Date.now()) {
    BLOCKED_IPS.delete(ip);
    await db.collection("blockedIPs").doc(ip).delete();
    return false;
  }

  return entry;
}



module.exports = {
  BLOCKED_IPS,
  saveBlockedIpToFirestore,
  loadBlockedIpsToMemory,
  isBlocked
};
