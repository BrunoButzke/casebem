/**
 * Checkout Idempotency Service
 * Prevents duplicate charges via intent_key + fingerprint
 */

import { sha256Hash, hmacHash } from './crypto-utils.mjs';

/**
 * Cria fingerprint canônico do payload de checkout
 * @param {object} data - {gifterName, items, paymentMethod, amountCents}
 * @returns {Promise<string>} SHA-256 hex (64 chars)
 */
export async function createCheckoutFingerprint(data) {
  // Normalizar items: ordenar por giftId, normalizar espaços em nome
  const normalizedItems = [...data.items]
    .sort((a, b) => a.giftId.localeCompare(b.giftId))
    .map(item => ({
      giftId: item.giftId.trim(),
      quantity: item.quantity,
    }));

  // Normalizar nome: trim, colapsar espaços, NFC
  const normalizedName = data.gifterName
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFC');

  // Representação canônica
  const canonical = JSON.stringify({
    amountCents: data.amountCents,
    gifterName: normalizedName,
    items: normalizedItems,
    paymentMethod: data.paymentMethod,
  });

  return sha256Hash(canonical);
}

/**
 * Gera chave de idempotência do Mercado Pago (baseada em intent_key)
 * @param {string} intentKey - UUID do cliente
 * @param {string} secret - RSVP_SECRET para HMAC
 * @returns {Promise<string>} HMAC hex (64 chars)
 */
export async function generateMPIdempotencyKey(intentKey, secret) {
  const { deriveRsvpKeys } = await import('./crypto-utils.mjs');
  const keys = await deriveRsvpKeys(secret);
  const hmac = await hmacHash(intentKey, keys.hmacKey);
  // MP aceita até 128 chars, usamos 64 hex
  return hmac.substring(0, 64);
}

/**
 * Valida formato de intent_key (UUID v4)
 * @param {string} key - Intent key
 * @returns {boolean}
 */
export function isValidIntentKey(key) {
  if (typeof key !== 'string') return false;
  // UUID v4: 8-4-4-4-12
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidPattern.test(key);
}

/**
 * Cria ou recupera intent de checkout (idempotente)
 * @param {D1Database} db - D1 database
 * @param {object} params - {intentKey, fingerprint, gifterName, items, paymentMethod, amountCents}
 * @param {string} secret - RSVP_SECRET
 * @returns {Promise<{status: string, intent?: object, conflict?: boolean}>}
 */
export async function getOrCreateIntent(db, params, secret) {
  const { intentKey, fingerprint, gifterName, items, paymentMethod, amountCents } = params;

  // Validar intent_key
  if (!isValidIntentKey(intentKey)) {
    throw new Error('INVALID_INTENT_KEY');
  }

  const now = new Date().toISOString();
  const canonicalItems = JSON.stringify(items);

  // Tentar inserir (atomic)
  try {
    await db.prepare(
      `INSERT INTO checkout_intents (
        intent_key, fingerprint, provider, provider_reference,
        amount_cents, gifter_name, canonical_items, payment_method,
        status, created_at, updated_at
      ) VALUES (?, ?, 'mercadopago', NULL, ?, ?, ?, ?, 'creating', ?, ?)`
    ).bind(
      intentKey,
      fingerprint,
      amountCents,
      gifterName,
      canonicalItems,
      paymentMethod,
      now,
      now
    ).run();

    // Inserção bem-sucedida = novo intent
    return {
      status: 'created',
      intent: {
        intentKey,
        fingerprint,
        amountCents,
        gifterName,
        items,
        paymentMethod,
        status: 'creating',
      },
    };
  } catch (error) {
    // UNIQUE constraint violation = intent já existe
    if (error.message && error.message.includes('UNIQUE')) {
      // Buscar intent existente
      const existing = await db.prepare(
        `SELECT 
          intent_key, fingerprint, provider_reference, amount_cents,
          gifter_name, canonical_items, payment_method, status,
          qr_code, qr_code_base64, created_at, updated_at
         FROM checkout_intents
         WHERE intent_key = ?`
      ).bind(intentKey).first();

      if (!existing) {
        // Não deveria acontecer, mas trata
        throw new Error('INTENT_NOT_FOUND');
      }

      // Verificar fingerprint
      if (existing.fingerprint !== fingerprint) {
        // Mesmo intent_key, payload diferente = CONFLICT
        return {
          status: 'conflict',
          conflict: true,
          message: 'Intent key já usado com dados diferentes',
        };
      }

      // Mesmo intent_key + mesmo fingerprint = idempotente
      let parsedItems;
      try {
        parsedItems = typeof existing.canonical_items === 'string' 
          ? JSON.parse(existing.canonical_items)
          : existing.canonical_items;
      } catch {
        parsedItems = [];
      }

      return {
        status: 'existing',
        intent: {
          intentKey: existing.intent_key,
          fingerprint: existing.fingerprint,
          providerReference: existing.provider_reference,
          amountCents: existing.amount_cents,
          gifterName: existing.gifter_name,
          items: parsedItems,
          paymentMethod: existing.payment_method,
          status: existing.status,
          qrCode: existing.qr_code,
          qrCodeBase64: existing.qr_code_base64,
          createdAt: existing.created_at,
          updatedAt: existing.updated_at,
        },
      };
    }

    // Outro erro
    throw error;
  }
}

/**
 * Atualiza intent com resultado do pagamento
 * @param {D1Database} db - D1 database
 * @param {string} intentKey - Intent key
 * @param {object} payment - {id, qrCode, qrCodeBase64}
 * @param {string} status - 'pending' ou 'failed'
 */
export async function updateIntentWithPayment(db, intentKey, payment, status) {
  const now = new Date().toISOString();

  // Limpar lease_until quando status final (pending/failed)
  await db.prepare(
    `UPDATE checkout_intents
     SET provider_reference = ?, status = ?, qr_code = ?, qr_code_base64 = ?, 
         lease_until = NULL, updated_at = ?
     WHERE intent_key = ?`
  ).bind(
    payment.id || null,
    status,
    payment.qrCode || null,
    payment.qrCodeBase64 || null,
    now,
    intentKey
  ).run();
}

/**
 * Rate limit para checkout (namespace 'checkout:')
 * @param {D1Database} db - D1 database
 * @param {string} ipAddress - Client IP
 * @param {string} secret - RSVP_SECRET
 * @param {number} limit - Max requests per hour (default 5)
 * @returns {Promise<{allowed: boolean, remaining: number}>}
 */
export async function checkCheckoutRateLimit(db, ipAddress, secret, limit = 5) {
  const { deriveRsvpKeys, hmacHash } = await import('./crypto-utils.mjs');
  const keys = await deriveRsvpKeys(secret);
  const ipHash = await hmacHash(ipAddress, keys.hmacKey);
  
  const windowStart = getHourWindow();
  const rateLimitId = `checkout:${ipHash}:${windowStart}`;
  const timestamp = new Date().toISOString();

  // Atomic UPSERT
  const upsert = await db.prepare(
    `INSERT INTO rate_limits (id, wedding_key, ip_hash, window_start, request_count, created_at, updated_at)
     VALUES (?, 'dani-carine', ?, ?, 1, ?, ?)
     ON CONFLICT(id) DO UPDATE
     SET request_count = request_count + 1, updated_at = ?
     WHERE request_count < ?
     RETURNING request_count`
  ).bind(rateLimitId, ipHash, windowStart, timestamp, timestamp, timestamp, limit).first();

  // Cleanup old windows
  await db.prepare(
    `DELETE FROM rate_limits WHERE window_start < datetime('now', '-26 hours')`
  ).run();

  if (!upsert) {
    return { allowed: false, remaining: 0 };
  }

  const count = Number(upsert.request_count);
  return { allowed: true, remaining: Math.max(0, limit - count) };
}

function getHourWindow() {
  const date = new Date();
  date.setMinutes(0, 0, 0);
  return date.toISOString();
}

/**
 * Adquire lease para processar intent (compare-and-swap atomic)
 * @param {D1Database} db - D1 database
 * @param {string} intentKey - Intent UUID
 * @param {number} ttlSeconds - Lease time-to-live (default 120s)
 * @param {object} clock - Optional injected clock {now: () => ISO string}
 * @returns {Promise<boolean>} true se adquiriu lease, false se já ocupado
 */
export async function acquireLease(db, intentKey, ttlSeconds = 120, clock = { now: () => new Date().toISOString() }) {
  const nowISO = clock.now();
  const leaseUntilISO = new Date(Date.parse(nowISO) + ttlSeconds * 1000).toISOString();
  
  // Compare-and-swap: só atualiza se (lease_until IS NULL OR lease_until < now) AND status = 'creating'
  const result = await db.prepare(
    `UPDATE checkout_intents
     SET lease_until = ?, updated_at = ?
     WHERE intent_key = ?
       AND status = 'creating'
       AND (lease_until IS NULL OR lease_until < ?)`
  ).bind(leaseUntilISO, nowISO, intentKey, nowISO).run();
  
  // D1 oficial retorna result.meta.changes, mocks podem usar result.changes
  const changes = Number(result?.meta?.changes ?? result?.changes ?? 0);
  return changes > 0;
}

/**
 * Libera lease de um intent (permite re-tentativa)
 * @param {D1Database} db - D1 database
 * @param {string} intentKey - Intent UUID
 * @returns {Promise<void>}
 */
export async function releaseLease(db, intentKey) {
  const nowISO = new Date().toISOString();
  
  await db.prepare(
    `UPDATE checkout_intents
     SET lease_until = NULL, updated_at = ?
     WHERE intent_key = ?`
  ).bind(nowISO, intentKey).run();
}
