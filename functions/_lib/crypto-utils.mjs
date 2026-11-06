/**
 * Cryptography utilities for RSVP system
 * Uses single RSVP_SECRET with HKDF derivation for HMAC key
 * Token encryption removed: replay requires bearer token, no recovery path needed
 */

/**
 * Derive HMAC key from RSVP_SECRET using HKDF
 * @param {string} base64Secret - Base64-encoded secret from env.RSVP_SECRET (32+ bytes)
 * @returns {Promise<{hmacKey: CryptoKey}>}
 */
export async function deriveRsvpKeys(base64Secret) {
  if (!base64Secret || typeof base64Secret !== 'string') {
    throw new Error('RSVP_SECRET environment variable not configured');
  }

  // Validate base64 format and decode
  let secretBytes;
  try {
    secretBytes = Uint8Array.from(atob(base64Secret), c => c.charCodeAt(0));
  } catch (error) {
    throw new Error('RSVP_SECRET is not valid base64');
  }

  // Validate 32 bytes minimum
  if (secretBytes.length < 32) {
    throw new Error('RSVP_SECRET must be at least 32 bytes');
  }
  
  // Import base secret
  const baseKey = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    'HKDF',
    false,
    ['deriveKey']
  );

  const salt = new TextEncoder().encode('casebem-rsvp-v1');

  // Derive HMAC-SHA256 key for IP hashing (rate limiting)
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

  return { hmacKey };
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
