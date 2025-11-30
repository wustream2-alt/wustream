// crypto-helper.js

const { randomBytes, createCipheriv, createDecipheriv } = require("crypto");

const ALGO = "aes-256-cbc";

// 32-byte key (64 hex chars)
const KEY = Buffer.from(
  "b4d23ae0be590af39740e7325c9afdf3b4d23ae0be590af39740e7325c9afdf3",
  "hex"
);

/**
 * Encrypt plain text → URL-safe base64
 */
function encrypt(plain) {
  const iv = randomBytes(16);

  const cipher = createCipheriv(ALGO, KEY, iv);

  let encrypted = cipher.update(plain, "utf8", "base64");
  encrypted += cipher.final("base64"); // ← REQUIRED

  // Combine IV + encrypted data
  const out = Buffer.concat([iv, Buffer.from(encrypted, "base64")]);

  return out.toString("base64url");
}

/**
 * Decrypt token → original string
 */
function decrypt(token) {
  const buf = Buffer.from(token, "base64url");

  const iv = buf.subarray(0, 16);
  const enc = buf.subarray(16);

  const decipher = createDecipheriv(ALGO, KEY, iv);

  let decrypted = decipher.update(enc, undefined, "utf8");
  decrypted += decipher.final("utf8"); // ← REQUIRED

  return decrypted;
}

module.exports = { encrypt, decrypt };
