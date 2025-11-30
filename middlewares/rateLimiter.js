// middlewares/multiRateLimiter.js
const rateLimit = require("express-rate-limit");
const {
  BLOCKED_IPS,
  saveBlockedIpToFirestore,
  isBlocked,
} = require("../helpers/blockedIpsService");

const jwt = require("jsonwebtoken");
require("dotenv").config();

const SECRET_KEY = process.env.TOKEN_SECRET;

// ===== Warning tracker =====
// Structure → { ip: { "Per-second": { count, firstWarningTime }, ... } }
const WARNINGS = new Map();
const WARNING_THRESHOLD = 15;
const BLOCK_HOURS = 24;

// ----- Extract API Key from various sources -----
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
    req.headers["x-api-key"] ||
    req.headers["authorization"]?.replace(/^Bearer\s+/i, "") ||
    req.query.api_key ||
    req.apiKey ||
    extractApiKeyFromCookie(req) ||
    ""
  ).trim();
}

// ----- Normalize IP (IPv4 / IPv6) -----
function normalizeIP(req) {
  let ip = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress;
  if (!ip) ip = "unknown";
  if (ip.includes("::ffff:")) ip = ip.split("::ffff:")[1]; // IPv4-mapped IPv6
  return ip.trim();
}

// ----- Blocklist middleware -----
async function blocklistCheck(req, res, next) {
  const ip = normalizeIP(req);
  const blockInfo = await isBlocked(ip);

  if (blockInfo) {
    return res.status(403).json({
      success: false,
      blocked: true,
      reason: blockInfo.reason,
      unblock_at: new Date(blockInfo.blockedUntil).toISOString(),
    });
  }

  next();
}

// ----- Reset duration per limiter -----
function getResetDuration(limitName) {
  switch (limitName) {
    case "Per-second":
      return 2 * 60 * 1000; // 2 minutes
    case "Per-minute":
      return 10 * 60 * 1000; // 10 minutes
    case "Per-hour":
      return 60 * 60 * 1000; // 1 hour
    case "Per-day":
      return 24 * 60 * 60 * 1000; // 24 hours
    default:
      return 10 * 60 * 1000; // default 10 minutes
  }
}


// ----- Handle warnings and auto-block -----
async function handleViolation(ip, limitName) {
  try {
    const now = Date.now();
    const resetDurationMs = getResetDuration(limitName);

    if (!WARNINGS.has(ip)) WARNINGS.set(ip, {});

    const ipWarnings = WARNINGS.get(ip);

    if (!ipWarnings[limitName]) {
      // first warning for this limiter
      ipWarnings[limitName] = { count: 1, firstWarningTime: now };
    } else {
      const warning = ipWarnings[limitName];
      if (now - warning.firstWarningTime > resetDurationMs) {
        // reset expired warning
        warning.count = 1;
        warning.firstWarningTime = now;
      } else {
        warning.count += 1;
      }
      ipWarnings[limitName] = warning;
    }

    WARNINGS.set(ip, ipWarnings);

    // block if threshold exceeded
    if (ipWarnings[limitName].count >= WARNING_THRESHOLD) {
      const reason = `Exceeded ${limitName} too many times.`;
      await saveBlockedIpToFirestore(ip, reason, BLOCK_HOURS); // block in Firestore
      // remove only this limiter's warning
      delete ipWarnings[limitName];
      if (Object.keys(ipWarnings).length === 0) WARNINGS.delete(ip);
    }
  } catch (err) {
    console.error("handleViolation error:", err);
  }
}

// ----- Custom handler for all limiters -----
async function customHandler(req, res, limitName) {
  const ip = normalizeIP(req);
  await handleViolation(ip, limitName);

  const ipWarnings = WARNINGS.get(ip) || {};
  const warningsLeft = WARNING_THRESHOLD - ((ipWarnings[limitName]?.count) || 0);

  res.status(429).json({
    success: false,
    message: `${limitName} limit reached.`,
    warnings_left: warningsLeft,
    blocked_next_if_zero: warningsLeft === 0,
  });
}

// ==================== Rate Limits =====================

// --- Per-second limiter ---
const perSecondLimiter = rateLimit({
  windowMs: 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => extractKey(req) || normalizeIP(req),
  handler: (req, res) => customHandler(req, res, "Per-second"),
});

// --- Per-minute limiter ---
const perMinuteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => extractKey(req) || normalizeIP(req),
  handler: (req, res) => customHandler(req, res, "Per-minute"),
});

// --- Per-hour limiter ---
const perHourLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => extractKey(req) || normalizeIP(req),
  handler: (req, res) => customHandler(req, res, "Per-hour"),
});

// --- Per-day limiter ---
const perDayLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => extractKey(req) || normalizeIP(req),
  handler: (req, res) => customHandler(req, res, "Per-day"),
});

// Export limiters with blocklist protection
module.exports = [
  blocklistCheck,
  perSecondLimiter,
  perMinuteLimiter,
  perHourLimiter,
  perDayLimiter,
];
