/**
 * RSVP Service
 * Business logic for RSVP operations with D1 database
 */

import { WEDDING_KEY } from './rsvp-validators.mjs';
import { encryptToken, decryptToken, hmacHash } from './crypto-utils.mjs';

/**
 * Generate cryptographically secure random token
 * @returns {Promise<string>} Base64url encoded token (32 bytes)
 */
export async function generateToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Hash token using SHA-256 (for database lookup only)
 * Note: 256-bit random token provides sufficient entropy
 */
export async function hashToken(token) {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate UUID v4
 */
export function generateUuid() {
  return crypto.randomUUID();
}

/**
 * Get current ISO timestamp
 */
export function now() {
  return new Date().toISOString();
}

/**
 * Create new RSVP with idempotency support
 * @param {object} db - D1 database binding
 * @param {object} data - Validated RSVP data
 * @param {string} idempotencyKey - Client-provided idempotency key
 * @param {string} encryptionKey - env.RSVP_TOKEN_KEY for token encryption
 * @returns {Promise<object>} Created RSVP with manage token
 */
export async function createRsvp(db, data, idempotencyKey, encryptionKey) {
  // Server-side normalization: attending=false forces counts to 0
  const normalizedData = {
    ...data,
    adultsCount: data.attending ? data.adultsCount : 0,
    childrenCount: data.attending ? data.childrenCount : 0,
  };

  // Check for existing idempotent request
  if (idempotencyKey) {
    const existing = await db
      .prepare(
        `SELECT 
          id, guest_name, attending, adults_count, children_count, 
          observations, manage_token_encrypted, created_at, updated_at
        FROM rsvps 
        WHERE wedding_key = ? AND idempotency_key = ?`
      )
      .bind(WEDDING_KEY, idempotencyKey)
      .first();

    if (existing) {
      // Idempotent replay - decrypt and return existing token
      const manageToken = await decryptToken(existing.manage_token_encrypted, encryptionKey);
      
      return {
        id: existing.id,
        weddingKey: WEDDING_KEY,
        guestName: existing.guest_name,
        attending: existing.attending === 1,
        adultsCount: existing.adults_count,
        childrenCount: existing.children_count,
        observations: existing.observations,
        createdAt: existing.created_at,
        updatedAt: existing.updated_at,
        manageToken,
      };
    }
  }

  const id = generateUuid();
  const manageToken = await generateToken();
  const tokenHash = await hashToken(manageToken);
  const tokenEncrypted = await encryptToken(manageToken, encryptionKey);
  const timestamp = now();

  // Use D1 batch for atomic transaction
  const result = await db.batch([
    db.prepare(
      `INSERT INTO rsvps (
        id, wedding_key, guest_name, attending, 
        adults_count, children_count, observations, 
        consent_given, manage_token_hash, manage_token_encrypted,
        idempotency_key, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      WEDDING_KEY,
      normalizedData.guestName,
      normalizedData.attending ? 1 : 0,
      normalizedData.adultsCount,
      normalizedData.childrenCount,
      normalizedData.observations,
      1,
      tokenHash,
      tokenEncrypted,
      idempotencyKey || null,
      timestamp,
      timestamp
    ),
  ]);

  if (!result[0].success) {
    // Check if it's a duplicate idempotency key (UNIQUE constraint violation)
    if (result[0].error && result[0].error.includes('UNIQUE')) {
      throw new Error('IDEMPOTENCY_CONFLICT');
    }
    throw new Error('Failed to create RSVP');
  }

  return {
    id,
    weddingKey: WEDDING_KEY,
    guestName: normalizedData.guestName,
    attending: normalizedData.attending,
    adultsCount: normalizedData.adultsCount,
    childrenCount: normalizedData.childrenCount,
    observations: normalizedData.observations,
    createdAt: timestamp,
    updatedAt: timestamp,
    manageToken,
  };
}

/**
 * Get RSVP by token
 * @param {object} db - D1 database binding
 * @param {string} token - Manage token
 * @returns {Promise<object|null>} RSVP data or null if not found
 */
export async function getRsvpByToken(db, token) {
  const tokenHash = await hashToken(token);

  const result = await db
    .prepare(
      `SELECT 
        id, wedding_key, guest_name, attending, 
        adults_count, children_count, observations,
        created_at, updated_at
      FROM rsvps 
      WHERE manage_token_hash = ? AND wedding_key = ?`
    )
    .bind(tokenHash, WEDDING_KEY)
    .first();

  if (!result) {
    return null;
  }

  return {
    id: result.id,
    weddingKey: result.wedding_key,
    guestName: result.guest_name,
    attending: result.attending === 1,
    adultsCount: result.adults_count,
    childrenCount: result.children_count,
    observations: result.observations,
    createdAt: result.created_at,
    updatedAt: result.updated_at,
  };
}

/**
 * Update RSVP by token
 * @param {object} db - D1 database binding
 * @param {string} token - Manage token
 * @param {object} data - Validated update data (partial)
 * @returns {Promise<object|null>} Updated RSVP or null if not found
 */
export async function updateRsvpByToken(db, token, data) {
  const tokenHash = await hashToken(token);

  const existing = await getRsvpByToken(db, token);
  if (!existing) {
    return null;
  }

  // Server-side normalization: if attending changed to false, force counts to 0
  const normalizedData = { ...data };
  if ('attending' in data && data.attending === false) {
    normalizedData.adultsCount = 0;
    normalizedData.childrenCount = 0;
  }

  const fields = [];
  const values = [];

  if ('attending' in normalizedData) {
    fields.push('attending = ?');
    values.push(normalizedData.attending ? 1 : 0);
  }
  if ('adultsCount' in normalizedData) {
    fields.push('adults_count = ?');
    values.push(normalizedData.adultsCount);
  }
  if ('childrenCount' in normalizedData) {
    fields.push('children_count = ?');
    values.push(normalizedData.childrenCount);
  }
  if ('observations' in normalizedData) {
    fields.push('observations = ?');
    values.push(normalizedData.observations);
  }

  const timestamp = now();
  fields.push('updated_at = ?');
  values.push(timestamp);

  values.push(tokenHash);
  values.push(WEDDING_KEY);

  const result = await db
    .prepare(
      `UPDATE rsvps 
       SET ${fields.join(', ')}
       WHERE manage_token_hash = ? AND wedding_key = ?`
    )
    .bind(...values)
    .run();

  if (!result.success) {
    throw new Error('Failed to update RSVP');
  }

  return await getRsvpByToken(db, token);
}

/**
 * Check rate limit with UPSERT and cleanup
 * @param {object} db - D1 database binding
 * @param {string} ipAddress - Client IP address (CF-Connecting-IP)
 * @param {string} hmacSecret - env.RSVP_HASH_KEY for HMAC
 * @param {number} limit - Max requests per hour (default 10)
 * @returns {Promise<object>} { allowed: boolean, remaining: number }
 */
export async function checkRateLimit(db, ipAddress, hmacSecret, limit = 10) {
  const ipHash = await hmacHash(ipAddress, hmacSecret);
  const windowStart = getHourWindow();
  const rateLimitId = `${WEDDING_KEY}:${ipHash}:${windowStart}`;
  const timestamp = now();

  // Atomic UPSERT with conditional increment
  const result = await db.batch([
    // Try to INSERT, or UPDATE if exists and under limit
    db.prepare(
      `INSERT INTO rate_limits (id, wedding_key, ip_hash, window_start, request_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, ?)
       ON CONFLICT(id) DO UPDATE 
       SET request_count = request_count + 1,
           updated_at = ?
       WHERE request_count < ?`
    ).bind(rateLimitId, WEDDING_KEY, ipHash, windowStart, timestamp, timestamp, timestamp, limit),
    
    // Cleanup old rate limit windows (>26 hours)
    db.prepare(
      `DELETE FROM rate_limits 
       WHERE window_start < datetime('now', '-26 hours')`
    ),
  ]);

  // Check if the row was actually updated/inserted
  const changes = result[0].meta?.changes || 0;
  
  if (changes === 0) {
    // Hit the limit - no row was changed
    return { allowed: false, remaining: 0 };
  }

  // Fetch current count
  const current = await db
    .prepare(`SELECT request_count FROM rate_limits WHERE id = ?`)
    .bind(rateLimitId)
    .first();

  const count = current ? Number(current.request_count) : 1;
  
  return { 
    allowed: true, 
    remaining: Math.max(0, limit - count) 
  };
}

/**
 * Get current hour window for rate limiting
 * Returns ISO string truncated to hour
 */
export function getHourWindow() {
  const date = new Date();
  date.setMinutes(0, 0, 0);
  return date.toISOString();
}
