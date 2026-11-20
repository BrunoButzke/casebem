/**
 * Estado do sorteio ao vivo (admin → telões) — D1 + memory (Vite).
 */

import { WEDDING_KEY as DEFAULT_WEDDING_KEY } from './challenges-validators.mjs';

export const DRAW_PHASES = Object.freeze(['gallery', 'soon', 'spinning', 'winner']);
export const DEFAULT_DURATION_MS = 8000;

/** @type {Map<string, object>} */
let memoryBroadcast = new Map();

export function resetDrawBroadcastForTests() {
  memoryBroadcast = new Map();
}

function resolveWeddingKey(weddingKey) {
  const k = String(weddingKey || DEFAULT_WEDDING_KEY).trim();
  return k || DEFAULT_WEDDING_KEY;
}

function defaultBroadcast() {
  return {
    phase: 'gallery',
    startedAt: null,
    durationMs: DEFAULT_DURATION_MS,
    winnerNumber: null,
    winnerName: null,
    raffleId: null,
    pool: [],
    updatedAt: null,
  };
}

function parsePool(raw) {
  if (Array.isArray(raw)) {
    return raw
      .map((e) => ({
        number: Number(e?.number),
        guestName: e?.guestName != null ? String(e.guestName) : null,
      }))
      .filter((e) => Number.isInteger(e.number) && e.number >= 1);
  }
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    return parsePool(JSON.parse(raw));
  } catch {
    return [];
  }
}

function rowToBroadcast(row) {
  if (!row) return defaultBroadcast();
  return {
    phase: DRAW_PHASES.includes(row.phase) ? row.phase : 'gallery',
    startedAt: row.started_at ?? row.startedAt ?? null,
    durationMs: Math.max(1000, Number(row.duration_ms ?? row.durationMs) || DEFAULT_DURATION_MS),
    winnerNumber:
      row.winner_number != null || row.winnerNumber != null
        ? Number(row.winner_number ?? row.winnerNumber)
        : null,
    winnerName: row.winner_name ?? row.winnerName ?? null,
    raffleId: row.raffle_id ?? row.raffleId ?? null,
    pool: parsePool(row.pool_json ?? row.pool),
    updatedAt: row.updated_at ?? row.updatedAt ?? null,
  };
}

function throwValidation(message, details) {
  const err = new Error(message || 'VALIDATION');
  if (details) err.details = details;
  throw err;
}

/**
 * @param {D1Database|null} db
 * @param {string} [weddingKey]
 */
export async function getDrawBroadcast(db, weddingKey = DEFAULT_WEDDING_KEY) {
  const wk = resolveWeddingKey(weddingKey);
  if (!db) {
    return rowToBroadcast(memoryBroadcast.get(wk) || null);
  }
  const row = await db
    .prepare(
      `SELECT wedding_key, phase, started_at, duration_ms, winner_number, winner_name,
              raffle_id, pool_json, updated_at
       FROM desafio_raffle_draw_broadcast WHERE wedding_key = ?`
    )
    .bind(wk)
    .first();
  return rowToBroadcast(row);
}

/**
 * @param {D1Database|null} db
 * @param {object} body
 * @param {string} [weddingKey]
 */
export async function upsertDrawBroadcast(db, body, weddingKey = DEFAULT_WEDDING_KEY) {
  const wk = resolveWeddingKey(weddingKey);
  const phase = String(body?.phase || '').trim();
  if (!DRAW_PHASES.includes(phase)) {
    throwValidation('INVALID_PHASE', { phase });
  }

  const now = new Date().toISOString();
  const current = await getDrawBroadcast(db, wk);

  let startedAt = body?.startedAt != null ? String(body.startedAt) : current.startedAt;
  let durationMs =
    body?.durationMs != null ? Math.floor(Number(body.durationMs)) : current.durationMs || DEFAULT_DURATION_MS;
  if (!Number.isFinite(durationMs) || durationMs < 1000 || durationMs > 60000) {
    durationMs = DEFAULT_DURATION_MS;
  }

  let winnerNumber =
    body?.winnerNumber != null ? Math.floor(Number(body.winnerNumber)) : current.winnerNumber;
  let winnerName =
    body?.winnerName !== undefined
      ? body.winnerName == null || body.winnerName === ''
        ? null
        : String(body.winnerName).trim().slice(0, 80)
      : current.winnerName;
  let raffleId =
    body?.raffleId != null ? String(body.raffleId).trim().slice(0, 40) : current.raffleId;
  let pool = body?.pool != null ? parsePool(body.pool) : current.pool;

  if (phase === 'gallery') {
    startedAt = null;
    winnerNumber = null;
    winnerName = null;
    raffleId = null;
    pool = [];
  }

  if (phase === 'soon') {
    startedAt = null;
    winnerNumber = null;
    winnerName = null;
    pool = [];
  }

  if (phase === 'spinning') {
    if (!Number.isInteger(winnerNumber) || winnerNumber < 1) {
      throwValidation('MISSING_WINNER');
    }
    if (!raffleId) throwValidation('MISSING_RAFFLE_ID');
    if (!pool.length) throwValidation('MISSING_POOL');
    if (!startedAt) startedAt = now;
    if (!pool.some((e) => e.number === winnerNumber)) {
      pool = [...pool, { number: winnerNumber, guestName: winnerName }];
    }
  }

  if (phase === 'winner') {
    if (!Number.isInteger(winnerNumber) || winnerNumber < 1) {
      throwValidation('MISSING_WINNER');
    }
    if (!startedAt) startedAt = current.startedAt || now;
  }

  const record = {
    wedding_key: wk,
    phase,
    started_at: startedAt,
    duration_ms: durationMs,
    winner_number: winnerNumber,
    winner_name: winnerName,
    raffle_id: raffleId,
    pool_json: JSON.stringify(pool),
    updated_at: now,
  };

  if (!db) {
    memoryBroadcast.set(wk, record);
    return rowToBroadcast(record);
  }

  await db
    .prepare(
      `INSERT INTO desafio_raffle_draw_broadcast (
         wedding_key, phase, started_at, duration_ms, winner_number, winner_name,
         raffle_id, pool_json, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(wedding_key) DO UPDATE SET
         phase = excluded.phase,
         started_at = excluded.started_at,
         duration_ms = excluded.duration_ms,
         winner_number = excluded.winner_number,
         winner_name = excluded.winner_name,
         raffle_id = excluded.raffle_id,
         pool_json = excluded.pool_json,
         updated_at = excluded.updated_at`
    )
    .bind(
      wk,
      phase,
      startedAt,
      durationMs,
      winnerNumber,
      winnerName,
      raffleId,
      JSON.stringify(pool),
      now
    )
    .run();

  return rowToBroadcast(record);
}
