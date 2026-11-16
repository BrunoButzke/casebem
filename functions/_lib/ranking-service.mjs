import { WEDDING_KEY } from './challenges-validators.mjs';

const NAME_MIN = 2;
const NAME_MAX = 80;
const POINTS_MAX = 50000;
const STAMPS_MAX = 100;

/** @type {Map<string, object>} */
let memoryRanking = new Map();

export function resetMemoryRankingForTests() {
  memoryRanking = new Map();
}

function throwValidation(errors) {
  const err = new Error('VALIDATION');
  err.details = errors;
  throw err;
}

export function guestKeyFor(name) {
  return String(name || '').trim().toLowerCase();
}

function toPublic(row) {
  return {
    guestName: row.guestName,
    points: Number(row.points) || 0,
    stamps: Number(row.stamps) || 0,
  };
}

function validatePayload(body) {
  const guestName = String(body?.guestName || '').trim();
  const points = Number(body?.points);
  const stamps = Number(body?.stamps ?? 0);
  const errors = [];
  if (guestName.length < NAME_MIN || guestName.length > NAME_MAX) errors.push('guestName inválido');
  if (!Number.isFinite(points) || points < 0 || points > POINTS_MAX) errors.push('points inválido');
  if (!Number.isInteger(stamps) || stamps < 0 || stamps > STAMPS_MAX) errors.push('stamps inválido');
  return { valid: errors.length === 0, errors, data: { guestName, points: Math.floor(points), stamps } };
}

function sortRows(rows) {
  return [...rows].sort((a, b) => {
    const points = b.points - a.points;
    if (points) return points;
    const stamps = b.stamps - a.stamps;
    if (stamps) return stamps;
    return a.guestName.localeCompare(b.guestName, 'pt');
  });
}

export async function listRanking(db) {
  if (!db) {
    return sortRows([...memoryRanking.values()].map(toPublic));
  }
  const result = await db
    .prepare(
      `SELECT guest_name AS guestName, points, stamps
       FROM desafio_ranking
       WHERE wedding_key = ?
       ORDER BY points DESC, stamps DESC, guest_name COLLATE NOCASE`
    )
    .bind(WEDDING_KEY)
    .all();
  return (result?.results || []).map(toPublic);
}

export async function upsertRanking(db, body) {
  const parsed = validatePayload(body);
  if (!parsed.valid) throwValidation(parsed.errors);
  const { guestName, points, stamps } = parsed.data;
  const guestKey = guestKeyFor(guestName);
  const now = new Date().toISOString();
  const row = { guestKey, guestName, points, stamps, updatedAt: now };

  if (!db) {
    memoryRanking.set(guestKey, row);
    return listRanking(null);
  }

  await db
    .prepare(
      `INSERT INTO desafio_ranking (wedding_key, guest_key, guest_name, points, stamps, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(wedding_key, guest_key) DO UPDATE SET
         guest_name = excluded.guest_name,
         points = excluded.points,
         stamps = excluded.stamps,
         updated_at = excluded.updated_at`
    )
    .bind(WEDDING_KEY, guestKey, guestName, points, stamps, now)
    .run();
  return listRanking(db);
}
