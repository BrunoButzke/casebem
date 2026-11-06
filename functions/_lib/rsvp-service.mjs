/**
 * RSVP Service - Secure implementation with idempotency
 */

import { WEDDING_KEY } from './rsvp-validators.mjs';
import { 
  deriveRsvpKeys, 
  hmacHash, 
  createPayloadFingerprint 
} from './crypto-utils.mjs';

export async function generateToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export async function hashToken(token) {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function generateUuid() {
  return crypto.randomUUID();
}

export function now() {
  return new Date().toISOString();
}

/**
 * Create RSVP with secure idempotency
 * NEVER returns decrypted token without Authorization + fingerprint match
 */
export async function createRsvp(db, data, idempotencyKey, secret, bearerToken = null) {
  const keys = await deriveRsvpKeys(secret);
  
  // Normalize: attending=false forces counts to 0
  const normalizedData = {
    ...data,
    adultsCount: data.attending ? data.adultsCount : 0,
    childrenCount: data.attending ? data.childrenCount : 0,
  };

  const fingerprint = await createPayloadFingerprint(normalizedData);

  // Check idempotency: MUST have Bearer token AND matching fingerprint
  if (idempotencyKey) {
    const existing = await db
      .prepare(
        `SELECT id, guest_name, attending, adults_count, children_count,
                observations, manage_token_hash,
                idempotency_fingerprint, created_at, updated_at
         FROM rsvps
         WHERE wedding_key = ? AND idempotency_key = ?`
      )
      .bind(WEDDING_KEY, idempotencyKey)
      .first();

    if (existing) {
      // Idempotent replay: MUST verify Authorization + fingerprint
      if (!bearerToken) {
        // Idempotency key exists but no auth - generic 409
        throw new Error('IDEMPOTENCY_CONFLICT');
      }

      const bearerHash = await hashToken(bearerToken);
      
      // Verify Bearer matches this record
      if (bearerHash !== existing.manage_token_hash) {
        // Wrong bearer for this idempotency key
        throw new Error('UNAUTHORIZED');
      }

      // Verify fingerprint matches (same request data)
      if (fingerprint !== existing.idempotency_fingerprint) {
        // Same key, different data, but bearer valid = conflict
        throw new Error('IDEMPOTENCY_CONFLICT');
      }

      // Valid replay: Bearer + fingerprint match, return same token (echo)
      // NO DECRYPTION - just return the bearer they already have
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
        manageToken: bearerToken, // Echo their valid token
      };
    }
  }

  // New RSVP creation
  const id = generateUuid();
  const manageToken = await generateToken();
  const tokenHash = await hashToken(manageToken);
  const timestamp = now();

  let result;
  try {
    result = await db.batch([
      db.prepare(
        `INSERT INTO rsvps (
          id, wedding_key, guest_name, attending,
          adults_count, children_count, observations,
          consent_given, manage_token_hash, created_at, updated_at,
          idempotency_key, idempotency_fingerprint
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id, WEDDING_KEY, normalizedData.guestName,
        normalizedData.attending ? 1 : 0,
        normalizedData.adultsCount, normalizedData.childrenCount,
        normalizedData.observations, 1,
        tokenHash, timestamp, timestamp,
        idempotencyKey || null, fingerprint
      ),
    ]);
  } catch (batchError) {
    // D1 batch can throw on UNIQUE constraint violation
    // Treat as result[0].success = false with error message
    result = [{ success: false, error: batchError.message || 'UNIQUE constraint' }];
  }

  if (!result[0].success) {
    // UNIQUE constraint violation - concurrent insert
    // Re-read and verify as above
    if (idempotencyKey && result[0].error?.includes('UNIQUE')) {
      // Retry logic: read existing, verify bearer+fingerprint
      const existing = await db
        .prepare(
          `SELECT id, guest_name, attending, adults_count, children_count,
                  observations, manage_token_hash, idempotency_fingerprint,
                  created_at, updated_at
           FROM rsvps
           WHERE wedding_key = ? AND idempotency_key = ?`
        )
        .bind(WEDDING_KEY, idempotencyKey)
        .first();

      if (existing) {
        if (!bearerToken) {
          throw new Error('IDEMPOTENCY_CONFLICT');
        }
        const bearerHash = await hashToken(bearerToken);
        if (bearerHash !== existing.manage_token_hash || 
            fingerprint !== existing.idempotency_fingerprint) {
          throw new Error('IDEMPOTENCY_CONFLICT');
        }
        // Valid replay
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
          manageToken: bearerToken,
        };
      }
    }
    throw new Error('Failed to create RSVP');
  }

  return {
    id, weddingKey: WEDDING_KEY,
    guestName: normalizedData.guestName,
    attending: normalizedData.attending,
    adultsCount: normalizedData.adultsCount,
    childrenCount: normalizedData.childrenCount,
    observations: normalizedData.observations,
    createdAt: timestamp, updatedAt: timestamp,
    manageToken, // Only new creation returns token
  };
}

export async function getRsvpByToken(db, token) {
  const tokenHash = await hashToken(token);
  const result = await db
    .prepare(
      `SELECT id, wedding_key, guest_name, attending,
              adults_count, children_count, observations,
              created_at, updated_at
       FROM rsvps
       WHERE manage_token_hash = ? AND wedding_key = ?`
    )
    .bind(tokenHash, WEDDING_KEY)
    .first();

  if (!result) return null;

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

export async function updateRsvpByToken(db, token, data) {
  const tokenHash = await hashToken(token);
  const existing = await getRsvpByToken(db, token);
  if (!existing) return null;

  // Normalize: attending=false forces counts to 0
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
  values.push(tokenHash, WEDDING_KEY);

  const result = await db
    .prepare(
      `UPDATE rsvps SET ${fields.join(', ')}
       WHERE manage_token_hash = ? AND wedding_key = ?`
    )
    .bind(...values)
    .run();

  if (!result.success) throw new Error('Failed to update RSVP');
  return await getRsvpByToken(db, token);
}

export async function checkRateLimit(db, ipAddress, secret, limit = 10) {
  const keys = await deriveRsvpKeys(secret);
  const ipHash = await hmacHash(ipAddress, keys.hmacKey);
  const windowStart = getHourWindow();
  // Use 'rsvp:' namespace to separate from messages rate limits
  const rateLimitId = `rsvp:${WEDDING_KEY}:${ipHash}:${windowStart}`;
  const timestamp = now();

  // Atomic UPSERT with RETURNING
  const upsert = await db
    .prepare(
      `INSERT INTO rate_limits (id, wedding_key, ip_hash, window_start, request_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, ?)
       ON CONFLICT(id) DO UPDATE
       SET request_count = request_count + 1, updated_at = ?
       WHERE request_count < ?
       RETURNING request_count`
    )
    .bind(rateLimitId, WEDDING_KEY, ipHash, windowStart, timestamp, timestamp, timestamp, limit)
    .first();

  // Cleanup old windows
  await db.prepare(`DELETE FROM rate_limits WHERE window_start < datetime('now', '-26 hours')`).run();

  if (!upsert) {
    // No row returned = hit limit
    return { allowed: false, remaining: 0 };
  }

  const count = Number(upsert.request_count);
  return { allowed: true, remaining: Math.max(0, limit - count) };
}

export function getHourWindow() {
  const date = new Date();
  date.setMinutes(0, 0, 0);
  return date.toISOString();
}
