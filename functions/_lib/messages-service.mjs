/**
 * Messages Service - Public guestbook implementation
 */

import { WEDDING_KEY } from './messages-validators.mjs';
import { 
  deriveRsvpKeys, 
  hmacHash, 
  sha256Hash
} from './crypto-utils.mjs';

export function generateUuid() {
  return crypto.randomUUID();
}

export function now() {
  return new Date().toISOString();
}

/**
 * Create canonical fingerprint of message payload for idempotency
 * @param {object} data - Normalized message data
 * @returns {Promise<string>} SHA-256 hash of canonical representation
 */
async function createPayloadFingerprint(data) {
  // Canonical representation: sorted keys, normalized values
  const canonical = JSON.stringify({
    consentGiven: data.consentGiven,
    guestName: data.guestName,
    message: data.message,
    weddingKey: WEDDING_KEY,
  });
  
  return sha256Hash(canonical);
}

/**
 * Create message with idempotency support
 * @param {D1Database} db - Cloudflare D1 database
 * @param {object} data - Normalized message data
 * @param {string|null} idempotencyKey - Optional idempotency key
 * @param {string} secret - Base64 secret for HMAC
 * @returns {Promise<object>} Created message
 */
export async function createMessage(db, data, idempotencyKey, secret) {
  if (!secret) {
    throw new Error('Secret not configured');
  }
  
  const fingerprint = await createPayloadFingerprint(data);

  // Check idempotency: same key + same fingerprint
  if (idempotencyKey) {
    const existing = await db
      .prepare(
        `SELECT id, guest_name, message, created_at
         FROM wedding_messages
         WHERE wedding_key = ? AND idempotency_key = ?`
      )
      .bind(WEDDING_KEY, idempotencyKey)
      .first();

    if (existing) {
      // Verify fingerprint matches (same request data)
      const existingFingerprint = await createPayloadFingerprint({
        guestName: existing.guest_name,
        message: existing.message,
        consentGiven: true, // Always true in DB
      });
      
      if (fingerprint !== existingFingerprint) {
        // Same key, different data = conflict
        throw new Error('IDEMPOTENCY_CONFLICT');
      }

      // Valid replay: return same message
      return {
        id: existing.id,
        weddingKey: WEDDING_KEY,
        guestName: existing.guest_name,
        message: existing.message,
        createdAt: existing.created_at,
      };
    }
  }

  // New message creation
  const id = generateUuid();
  const timestamp = now();

  let result;
  try {
    result = await db.batch([
      db.prepare(
        `INSERT INTO wedding_messages (
          id, wedding_key, guest_name, message,
          consent_given, created_at,
          idempotency_key, idempotency_fingerprint
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id, WEDDING_KEY, data.guestName, data.message,
        1, timestamp,
        idempotencyKey || null, fingerprint
      ),
    ]);
  } catch (batchError) {
    // D1 batch can throw on UNIQUE constraint violation
    result = [{ success: false, error: batchError.message || 'UNIQUE constraint' }];
  }

  if (!result[0].success) {
    // UNIQUE constraint violation - concurrent insert
    // Re-read and verify
    if (idempotencyKey && result[0].error?.includes('UNIQUE')) {
      const existing = await db
        .prepare(
          `SELECT id, guest_name, message, created_at
           FROM wedding_messages
           WHERE wedding_key = ? AND idempotency_key = ?`
        )
        .bind(WEDDING_KEY, idempotencyKey)
        .first();
      
      if (existing) {
        const existingFingerprint = await createPayloadFingerprint({
          guestName: existing.guest_name,
          message: existing.message,
          consentGiven: true,
        });
        
        if (fingerprint !== existingFingerprint) {
          throw new Error('IDEMPOTENCY_CONFLICT');
        }
        
        // Valid replay
        return {
          id: existing.id,
          weddingKey: WEDDING_KEY,
          guestName: existing.guest_name,
          message: existing.message,
          createdAt: existing.created_at,
        };
      }
    }
    throw new Error('Failed to create message');
  }

  return {
    id, weddingKey: WEDDING_KEY,
    guestName: data.guestName,
    message: data.message,
    createdAt: timestamp,
  };
}

/**
 * Get messages with pagination
 * @param {D1Database} db - Cloudflare D1 database
 * @param {number} limit - Number of messages to return (3-50)
 * @param {string|null} cursor - Pagination cursor (base64 encoded)
 * @returns {Promise<{messages: Array, nextCursor: string|null}>}
 */
export async function getMessages(db, limit, cursor) {
  // For MVP, simple limit-based pagination without cursor implementation
  // Full cursor pagination would decode cursor to createdAt+id for WHERE clause
  
  const result = await db
    .prepare(
      `SELECT id, guest_name, message, created_at
       FROM wedding_messages
       WHERE wedding_key = ?
       ORDER BY created_at DESC, id DESC
       LIMIT ?`
    )
    .bind(WEDDING_KEY, limit)
    .all();

  const messages = result.results.map(row => ({
    id: row.id,
    guestName: row.guest_name,
    message: row.message,
    createdAt: row.created_at,
  }));

  // Determine if there are more messages (simplified for MVP)
  // Full implementation would check if there are more rows after the last cursor
  const nextCursor = messages.length === limit ? 'has-more' : null;

  return { messages, nextCursor };
}

/**
 * Check rate limit for IP address
 * Reuses RSVP rate_limits table
 * @param {D1Database} db - Cloudflare D1 database
 * @param {string} ipAddress - Client IP address
 * @param {string} secret - Base64 secret for HMAC
 * @param {number} limit - Maximum requests per window (default 5 for messages)
 * @returns {Promise<{allowed: boolean, remaining: number}>}
 */
export async function checkRateLimit(db, ipAddress, secret, limit = 5) {
  const keys = await deriveRsvpKeys(secret);
  const ipHash = await hmacHash(ipAddress, keys.hmacKey);
  const windowStart = getHourWindow();
  const rateLimitId = `${WEDDING_KEY}:${ipHash}:${windowStart}`;
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
