/**
 * Progresso do convidado no /games (quiz + missões).
 * Tenant padrão: dani-carine. Bytes de foto ficam na galeria/R2.
 */

import { WEDDING_KEY as DEFAULT_WEDDING_KEY } from './challenges-validators.mjs';
import { guestKeyFor } from './ranking-service.mjs';

/** Futuro: /games em URL com tenant do casal. Hoje fixo. */
export const GAMES_WEDDING_KEY = DEFAULT_WEDDING_KEY;

const NAME_MIN = 2;
const NAME_MAX = 80;

/** @type {Map<string, object>} */
let memoryProgress = new Map();

export function resetGuestProgressForTests() {
  memoryProgress = new Map();
}

function resolveWeddingKey(weddingKey) {
  const k = String(weddingKey || GAMES_WEDDING_KEY).trim();
  return k || GAMES_WEDDING_KEY;
}

function memoryKey(weddingKey, guestKey) {
  return `${weddingKey}::${guestKey}`;
}

function throwValidation(errors) {
  const err = new Error('VALIDATION');
  err.details = errors;
  throw err;
}

function parseJsonObject(raw, fallback = {}) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw;
  if (typeof raw !== 'string' || !raw.trim()) return { ...fallback };
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : { ...fallback };
  } catch {
    return { ...fallback };
  }
}

/** Remove preview/data URLs — não gravar blobs no D1. */
export function sanitizePhotosForStorage(photos) {
  const src = photos && typeof photos === 'object' && !Array.isArray(photos) ? photos : {};
  const out = {};
  for (const [missionId, entry] of Object.entries(src)) {
    if (!entry || typeof entry !== 'object') continue;
    const cleaned = {
      done: Boolean(entry.done),
    };
    if (entry.title != null) cleaned.title = String(entry.title).slice(0, 120);
    if (entry.awardsStamp != null) cleaned.awardsStamp = Boolean(entry.awardsStamp);
    if (entry.galleryId) cleaned.galleryId = String(entry.galleryId).slice(0, 64);
    out[String(missionId)] = cleaned;
  }
  return out;
}

export function sanitizeAnswersForStorage(answers) {
  const src = answers && typeof answers === 'object' && !Array.isArray(answers) ? answers : {};
  const out = {};
  for (const [questionId, entry] of Object.entries(src)) {
    if (!entry || typeof entry !== 'object') continue;
    const selectedIndex = Number(entry.selectedIndex);
    if (!Number.isInteger(selectedIndex) || selectedIndex < 0) continue;
    out[String(questionId)] = {
      selectedIndex,
      correct: Boolean(entry.correct),
      points: Math.max(0, Math.floor(Number(entry.points) || 0)),
    };
  }
  return out;
}

function validateGuestName(name) {
  const guestName = String(name || '').trim();
  if (guestName.length < NAME_MIN || guestName.length > NAME_MAX) {
    throwValidation(['guestName inválido']);
  }
  return guestName;
}

function rowToPublic(row) {
  return {
    guestName: row.guest_name || row.guestName,
    answers: sanitizeAnswersForStorage(parseJsonObject(row.answers_json ?? row.answers)),
    photos: sanitizePhotosForStorage(parseJsonObject(row.photos_json ?? row.photos)),
    updatedAt: row.updated_at || row.updatedAt || null,
    empty: false,
  };
}

function isProgressEmpty(answers, photos) {
  return Object.keys(answers || {}).length === 0 && Object.keys(photos || {}).length === 0;
}

/**
 * @returns {{ guestName: string, answers: object, photos: object, updatedAt: string|null, empty: boolean }}
 */
export async function getGuestProgress(db, guestName, weddingKey = GAMES_WEDDING_KEY) {
  const weddingKeyResolved = resolveWeddingKey(weddingKey);
  const name = validateGuestName(guestName);
  const guestKey = guestKeyFor(name);

  if (!db) {
    const row = memoryProgress.get(memoryKey(weddingKeyResolved, guestKey));
    if (!row) {
      return { guestName: name, answers: {}, photos: {}, updatedAt: null, empty: true };
    }
    const pub = rowToPublic(row);
    pub.empty = isProgressEmpty(pub.answers, pub.photos);
    return pub;
  }

  try {
    const row = await db
      .prepare(
        `SELECT wedding_key, guest_key, guest_name, answers_json, photos_json, updated_at
         FROM desafio_guest_progress
         WHERE wedding_key = ? AND guest_key = ?`
      )
      .bind(weddingKeyResolved, guestKey)
      .first();

    if (!row) {
      return { guestName: name, answers: {}, photos: {}, updatedAt: null, empty: true };
    }
    const pub = rowToPublic(row);
    pub.empty = isProgressEmpty(pub.answers, pub.photos);
    return pub;
  } catch (err) {
    if (/no such table:\s*desafio_guest_progress/i.test(String(err?.message || ''))) {
      return { guestName: name, answers: {}, photos: {}, updatedAt: null, empty: true };
    }
    throw err;
  }
}

/**
 * @returns {Promise<object>} progresso público após upsert
 */
export async function upsertGuestProgress(db, body, weddingKey = GAMES_WEDDING_KEY) {
  const weddingKeyResolved = resolveWeddingKey(weddingKey);
  const guestName = validateGuestName(body?.guestName);
  const guestKey = guestKeyFor(guestName);
  const answers = sanitizeAnswersForStorage(body?.answers);
  const photos = sanitizePhotosForStorage(body?.photos);
  const updatedAt = new Date().toISOString();
  const answersJson = JSON.stringify(answers);
  const photosJson = JSON.stringify(photos);

  if (!db) {
    const row = {
      wedding_key: weddingKeyResolved,
      guest_key: guestKey,
      guest_name: guestName,
      answers_json: answersJson,
      photos_json: photosJson,
      updated_at: updatedAt,
    };
    memoryProgress.set(memoryKey(weddingKeyResolved, guestKey), row);
    const pub = rowToPublic(row);
    pub.empty = isProgressEmpty(pub.answers, pub.photos);
    return pub;
  }

  try {
    await db
      .prepare(
        `INSERT INTO desafio_guest_progress
           (wedding_key, guest_key, guest_name, answers_json, photos_json, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(wedding_key, guest_key) DO UPDATE SET
           guest_name = excluded.guest_name,
           answers_json = excluded.answers_json,
           photos_json = excluded.photos_json,
           updated_at = excluded.updated_at`
      )
      .bind(weddingKeyResolved, guestKey, guestName, answersJson, photosJson, updatedAt)
      .run();
  } catch (err) {
    if (/no such table:\s*desafio_guest_progress/i.test(String(err?.message || ''))) {
      const e = new Error('PROGRESS_UNAVAILABLE');
      e.details = ['Tabela desafio_guest_progress ausente. Aplique a migration 0033.'];
      throw e;
    }
    throw err;
  }

  return {
    guestName,
    answers,
    photos,
    updatedAt,
    empty: isProgressEmpty(answers, photos),
  };
}
