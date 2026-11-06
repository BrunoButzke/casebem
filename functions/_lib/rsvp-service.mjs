/**
 * RSVP Service
 * Business logic for RSVP operations with D1 database
 */

import { WEDDING_KEY } from './rsvp-validators.mjs';

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
 * Hash token using Web Crypto API (SHA-256)
 * Note: In production, bcrypt would be better but not available in CF Workers
 * Using SHA-256 with salt for this MVP
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
 * Create new RSVP
 * @param {object} db - D1 database binding
 * @param {object} data - Validated RSVP data
 * @returns {Promise<object>} Created RSVP with manage token
 */
export async function createRsvp(db, data) {
  const id = generateUuid();
  const manageToken = await generateToken();
  const tokenHash = await hashToken(manageToken);
  const timestamp = now();

  const result = await db
    .prepare(
      `INSERT INTO rsvps (
        id, wedding_key, guest_name, attending, 
        adults_count, children_count, observations, 
        consent_given, manage_token_hash, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      WEDDING_KEY,
      data.guestName,
      data.attending ? 1 : 0,
      data.adultsCount,
      data.childrenCount,
      data.observations,
      1,
      tokenHash,
      timestamp,
      timestamp
    )
    .run();

  if (!result.success) {
    throw new Error('Failed to create RSVP');
  }

  return {
    id,
    weddingKey: WEDDING_KEY,
    guestName: data.guestName,
    attending: data.attending,
    adultsCount: data.adultsCount,
    childrenCount: data.childrenCount,
    observations: data.observations,
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

  const fields = [];
  const values = [];

  if ('attending' in data) {
    fields.push('attending = ?');
    values.push(data.attending ? 1 : 0);
  }
  if ('adultsCount' in data) {
    fields.push('adults_count = ?');
    values.push(data.adultsCount);
  }
  if ('childrenCount' in data) {
    fields.push('children_count = ?');
    values.push(data.childrenCount);
  }
  if ('observations' in data) {
    fields.push('observations = ?');
    values.push(data.observations);
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
 * Check rate limit
 * @param {object} db - D1 database binding
 * @param {string} ipAddress - Client IP address
 * @param {number} limit - Max requests per hour (default 10)
 * @returns {Promise<object>} { allowed: boolean, remaining: number }
 */
export async function checkRateLimit(db, ipAddress, limit = 10) {
  const ipHash = await hashIp(ipAddress);
  const windowStart = getHourWindow();
  const rateLimitId = `${WEDDING_KEY}:${ipHash}:${windowStart}`;

  const existing = await db
    .prepare(
      `SELECT request_count FROM rate_limits WHERE id = ?`
    )
    .bind(rateLimitId)
    .first();

  if (!existing) {
    const timestamp = now();
    await db
      .prepare(
        `INSERT INTO rate_limits (id, wedding_key, ip_hash, window_start, request_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, 1, ?, ?)`
      )
      .bind(rateLimitId, WEDDING_KEY, ipHash, windowStart, timestamp, timestamp)
      .run();

    return { allowed: true, remaining: limit - 1 };
  }

  const count = Number(existing.request_count);

  if (count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  const timestamp = now();
  await db
    .prepare(
      `UPDATE rate_limits 
       SET request_count = request_count + 1, updated_at = ?
       WHERE id = ?`
    )
    .bind(timestamp, rateLimitId)
    .run();

  return { allowed: true, remaining: limit - count - 1 };
}

/**
 * Hash IP address for privacy
 */
async function hashIp(ip) {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Get current hour window for rate limiting
 * Returns ISO string truncated to hour
 */
function getHourWindow() {
  const date = new Date();
  date.setMinutes(0, 0, 0);
  return date.toISOString();
}
