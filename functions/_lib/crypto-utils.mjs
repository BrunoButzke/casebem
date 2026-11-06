/**
 * Cryptography utilities for RSVP system
 * Uses single RSVP_SECRET with HKDF derivation for domain separation
 */

/**
 * Derive separate keys for encryption and HMAC using HKDF
 * @param {string} base64Secret - Base64-encoded secret from env.RSVP_SECRET
 * @returns {Promise<{encryptionKey: CryptoKey, hmacKey: CryptoKey}>}
 */
export async function deriveRsvpKeys(base64Secret) {
  if (!base64Secret || typeof base64Secret !== 'string') {
    throw new Error('RSVP_SECRET environment variable not configured');
  }

  const secretBytes = Uint8Array.from(atob(base64Secret), c => c.charCodeAt(0));
  
  // Import base secret
  const baseKey = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    'HKDF',
    false,
    ['deriveKey']
  );

  const salt = new TextEncoder().encode('casebem-rsvp-v1');

  // Derive AES-256-GCM key for token encryption
  const encryptionKey = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt,
      info: new TextEncoder().encode('token-encryption-v1'),
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  // Derive HMAC-SHA256 key for IP hashing
  const hmacKey = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt,
      info: new TextEncoder().encode('rate-limit-ip-hmac-v1'),
    },
    baseKey,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  return { encryptionKey, hmacKey };
}

/**
 * Encrypt token using AES-GCM
 * @param {string} plaintext - Token to encrypt
 * @param {CryptoKey} key - Derived AES-GCM key
 * @returns {Promise<string>} Base64url-encoded encrypted data with IV
 */
export async function encryptToken(plaintext, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  return btoa(String.fromCharCode(...combined))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Decrypt token using AES-GCM
 * @param {string} ciphertext - Base64url-encoded encrypted token
 * @param {CryptoKey} key - Derived AES-GCM key
 * @returns {Promise<string>} Decrypted plaintext token
 */
export async function decryptToken(ciphertext, key) {
  const normalized = ciphertext
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  
  const combined = Uint8Array.from(atob(normalized), c => c.charCodeAt(0));
  
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

/**
 * HMAC-SHA256 hash for values (IP addresses, etc.)
 * @param {string} value - Value to hash
 * @param {CryptoKey} key - Derived HMAC key
 * @returns {Promise<string>} Hex-encoded HMAC
 */
export async function hmacHash(value, key) {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const signature = await crypto.subtle.sign('HMAC', key, data);
  
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * SHA-256 hash for request fingerprinting
 * @param {string} data - Data to hash
 * @returns {Promise<string>} Hex-encoded hash
 */
export async function sha256Hash(data) {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Create canonical fingerprint of RSVP payload for idempotency
 * @param {object} data - Normalized RSVP data
 * @returns {Promise<string>} SHA-256 hash of canonical representation
 */
export async function createPayloadFingerprint(data) {
  // Canonical representation: sorted keys, normalized values
  const canonical = JSON.stringify({
    adultsCount: data.adultsCount,
    attending: data.attending,
    childrenCount: data.childrenCount,
    consentGiven: data.consentGiven,
    guestName: data.guestName,
    observations: data.observations || null,
    weddingKey: 'dani-carine',
  });
  
  return sha256Hash(canonical);
}
