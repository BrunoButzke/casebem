/**
 * Cryptography utilities for RSVP system
 * Uses Web Crypto API (available in Cloudflare Workers)
 */

/**
 * Encrypt token using AES-GCM with env key
 * @param {string} plaintext - Token to encrypt
 * @param {string} base64Key - Base64-encoded 32-byte key from env.RSVP_TOKEN_KEY
 * @returns {Promise<string>} Base64-encoded encrypted data with IV prepended
 */
export async function encryptToken(plaintext, base64Key) {
  if (!base64Key) {
    throw new Error('RSVP_TOKEN_KEY environment variable not configured');
  }

  const keyData = Uint8Array.from(atob(base64Key), c => c.charCodeAt(0));
  
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

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
 * Decrypt token using AES-GCM with env key
 * @param {string} ciphertext - Base64url-encoded encrypted token
 * @param {string} base64Key - Base64-encoded 32-byte key from env.RSVP_TOKEN_KEY
 * @returns {Promise<string>} Decrypted plaintext token
 */
export async function decryptToken(ciphertext, base64Key) {
  if (!base64Key) {
    throw new Error('RSVP_TOKEN_KEY environment variable not configured');
  }

  const keyData = Uint8Array.from(atob(base64Key), c => c.charCodeAt(0));
  
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

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
 * HMAC-SHA256 hash for IP addresses (privacy-preserving with pepper)
 * @param {string} value - Value to hash
 * @param {string} secret - Secret key from env.RSVP_HASH_KEY
 * @returns {Promise<string>} Hex-encoded HMAC
 */
export async function hmacHash(value, secret) {
  if (!secret) {
    throw new Error('RSVP_HASH_KEY environment variable not configured');
  }

  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const data = encoder.encode(value);
  const signature = await crypto.subtle.sign('HMAC', key, data);
  
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
