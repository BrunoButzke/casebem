/**
 * Admin desafios — quiz, missões de foto, cartões de selos (D1 + memory Vite).
 */

import {
  WEDDING_KEY,
  validateQuestionCreate,
  validateQuestionPatch,
  validatePhotoMissionCreate,
  validatePhotoMissionPatch,
  validateStampCardCreate,
  validateStampCardPatch,
} from './challenges-validators.mjs';

let memoryStore = null;

function ensureMemory() {
  if (!memoryStore) {
    memoryStore = { questions: [], photoMissions: [], stampCards: [] };
  }
  return memoryStore;
}

export function resetMemoryChallengesForTests() {
  memoryStore = null;
}

function throwValidation(errors) {
  const err = new Error('VALIDATION');
  err.details = errors;
  throw err;
}

function parseOptionsJson(raw) {
  try {
    const list = JSON.parse(raw || '[]');
    return Array.isArray(list) ? list.map((s) => String(s)) : [];
  } catch {
    return [];
  }
}

function rowToQuestion(row) {
  return {
    id: row.id,
    weddingKey: row.wedding_key ?? row.weddingKey ?? WEDDING_KEY,
    prompt: row.prompt,
    options: Array.isArray(row.options) ? row.options : parseOptionsJson(row.options_json),
    correctIndex: Number(row.correct_index ?? row.correctIndex),
    points: Number(row.points),
    active: row.active === undefined ? true : Boolean(Number(row.active)),
    sortOrder: row.sort_order ?? row.sortOrder ?? 0,
    updatedAt: row.updated_at ?? row.updatedAt ?? null,
  };
}

function rowToPhotoMission(row) {
  return {
    id: row.id,
    weddingKey: row.wedding_key ?? row.weddingKey ?? WEDDING_KEY,
    title: row.title,
    points: Number(row.points),
    awardsStamp: Boolean(Number(row.awards_stamp ?? row.awardsStamp ?? 0)),
    active: row.active === undefined ? true : Boolean(Number(row.active)),
    sortOrder: row.sort_order ?? row.sortOrder ?? 0,
    updatedAt: row.updated_at ?? row.updatedAt ?? null,
  };
}

function rowToStampCard(row) {
  return {
    id: row.id,
    weddingKey: row.wedding_key ?? row.weddingKey ?? WEDDING_KEY,
    name: row.name,
    stampsRequired: Number(row.stamps_required ?? row.stampsRequired),
    rewardText: row.reward_text ?? row.rewardText,
    active: row.active === undefined ? true : Boolean(Number(row.active)),
    sortOrder: row.sort_order ?? row.sortOrder ?? 0,
    updatedAt: row.updated_at ?? row.updatedAt ?? null,
  };
}

function sortByOrder(a, b) {
  return a.sortOrder - b.sortOrder || a.id.localeCompare(b.id);
}

function isUniqueViolation(err) {
  const msg = String(err?.message || '');
  return msg.includes('UNIQUE') || msg.includes('PRIMARY');
}

// ——— Questions ———

export async function listQuestionsAdmin(db) {
  if (!db) return [...ensureMemory().questions].sort(sortByOrder);

  const rows = await db
    .prepare(
      `SELECT id, wedding_key, prompt, options_json, correct_index, points, active, sort_order, updated_at
       FROM challenge_questions
       WHERE wedding_key = ?
       ORDER BY sort_order ASC, id ASC`
    )
    .bind(WEDDING_KEY)
    .all();
  return (rows?.results || []).map(rowToQuestion);
}

export async function createQuestion(db, body) {
  const validation = validateQuestionCreate(body);
  if (!validation.valid) throwValidation(validation.errors);
  const d = validation.data;
  const now = new Date().toISOString();

  if (!db) {
    const mem = ensureMemory().questions;
    if (mem.some((q) => q.id === d.id)) throw new Error('EXISTS');
    const row = {
      id: d.id,
      weddingKey: WEDDING_KEY,
      prompt: d.prompt,
      options: d.options,
      correctIndex: d.correctIndex,
      points: d.points,
      active: d.active,
      sortOrder: d.sortOrder,
      updatedAt: now,
    };
    mem.push(row);
    return { ...row };
  }

  try {
    await db
      .prepare(
        `INSERT INTO challenge_questions (
          id, wedding_key, prompt, options_json, correct_index, points, active, sort_order, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        d.id,
        WEDDING_KEY,
        d.prompt,
        JSON.stringify(d.options),
        d.correctIndex,
        d.points,
        d.active ? 1 : 0,
        d.sortOrder,
        now
      )
      .run();
  } catch (err) {
    if (isUniqueViolation(err)) throw new Error('EXISTS');
    throw err;
  }

  return rowToQuestion({
    id: d.id,
    wedding_key: WEDDING_KEY,
    prompt: d.prompt,
    options_json: JSON.stringify(d.options),
    correct_index: d.correctIndex,
    points: d.points,
    active: d.active ? 1 : 0,
    sort_order: d.sortOrder,
    updated_at: now,
  });
}

export async function updateQuestion(db, id, patch) {
  if (!id || typeof id !== 'string') throw new Error('INVALID_ID');

  const validation = validateQuestionPatch(patch);
  if (!validation.valid) throwValidation(validation.errors);
  const d = validation.data;
  if (Object.keys(d).length === 0) throw new Error('EMPTY_PATCH');
  const now = new Date().toISOString();

  const applyQuestionPatch = (existing) => {
    const nextOptions = d.options ?? existing.options;
    const nextCorrect = d.correctIndex !== undefined ? d.correctIndex : existing.correctIndex;
    if (nextCorrect < 0 || nextCorrect >= nextOptions.length) {
      throwValidation(['resposta correta inválida']);
    }
    return {
      ...existing,
      prompt: d.prompt ?? existing.prompt,
      options: nextOptions,
      correctIndex: nextCorrect,
      points: d.points ?? existing.points,
      active: d.active !== undefined ? d.active : existing.active,
      sortOrder: d.sortOrder ?? existing.sortOrder,
      updatedAt: now,
    };
  };

  if (!db) {
    const mem = ensureMemory().questions;
    const idx = mem.findIndex((q) => q.id === id);
    if (idx < 0) throw new Error('NOT_FOUND');
    mem[idx] = applyQuestionPatch(mem[idx]);
    return { ...mem[idx] };
  }

  const row = await db
    .prepare(
      `SELECT id, wedding_key, prompt, options_json, correct_index, points, active, sort_order, updated_at
       FROM challenge_questions WHERE id = ? AND wedding_key = ?`
    )
    .bind(id, WEDDING_KEY)
    .first();
  if (!row) throw new Error('NOT_FOUND');

  const next = applyQuestionPatch(rowToQuestion(row));
  await db
    .prepare(
      `UPDATE challenge_questions
       SET prompt = ?, options_json = ?, correct_index = ?, points = ?, active = ?, sort_order = ?, updated_at = ?
       WHERE id = ? AND wedding_key = ?`
    )
    .bind(
      next.prompt,
      JSON.stringify(next.options),
      next.correctIndex,
      next.points,
      next.active ? 1 : 0,
      next.sortOrder,
      now,
      id,
      WEDDING_KEY
    )
    .run();
  return next;
}

export async function deleteQuestion(db, id) {
  if (!id || typeof id !== 'string') throw new Error('INVALID_ID');

  if (!db) {
    const mem = ensureMemory().questions;
    const idx = mem.findIndex((q) => q.id === id);
    if (idx < 0) throw new Error('NOT_FOUND');
    mem.splice(idx, 1);
    return { id, removed: true };
  }

  const result = await db
    .prepare(`DELETE FROM challenge_questions WHERE id = ? AND wedding_key = ?`)
    .bind(id, WEDDING_KEY)
    .run();
  const changes = Number(result?.meta?.changes ?? result?.changes ?? 0);
  if (changes === 0) throw new Error('NOT_FOUND');
  return { id, removed: true };
}

// ——— Photo missions ———

export async function listPhotoMissionsAdmin(db) {
  if (!db) return [...ensureMemory().photoMissions].sort(sortByOrder);

  const rows = await db
    .prepare(
      `SELECT id, wedding_key, title, points, awards_stamp, active, sort_order, updated_at
       FROM challenge_photo_missions
       WHERE wedding_key = ?
       ORDER BY sort_order ASC, id ASC`
    )
    .bind(WEDDING_KEY)
    .all();
  return (rows?.results || []).map(rowToPhotoMission);
}

export async function createPhotoMission(db, body) {
  const validation = validatePhotoMissionCreate(body);
  if (!validation.valid) throwValidation(validation.errors);
  const d = validation.data;
  const now = new Date().toISOString();

  if (!db) {
    const mem = ensureMemory().photoMissions;
    if (mem.some((m) => m.id === d.id)) throw new Error('EXISTS');
    const row = {
      id: d.id,
      weddingKey: WEDDING_KEY,
      title: d.title,
      points: d.points,
      awardsStamp: d.awardsStamp,
      active: d.active,
      sortOrder: d.sortOrder,
      updatedAt: now,
    };
    mem.push(row);
    return { ...row };
  }

  try {
    await db
      .prepare(
        `INSERT INTO challenge_photo_missions (
          id, wedding_key, title, points, awards_stamp, active, sort_order, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        d.id,
        WEDDING_KEY,
        d.title,
        d.points,
        d.awardsStamp ? 1 : 0,
        d.active ? 1 : 0,
        d.sortOrder,
        now
      )
      .run();
  } catch (err) {
    if (isUniqueViolation(err)) throw new Error('EXISTS');
    throw err;
  }

  return rowToPhotoMission({
    id: d.id,
    wedding_key: WEDDING_KEY,
    title: d.title,
    points: d.points,
    awards_stamp: d.awardsStamp ? 1 : 0,
    active: d.active ? 1 : 0,
    sort_order: d.sortOrder,
    updated_at: now,
  });
}

export async function updatePhotoMission(db, id, patch) {
  if (!id || typeof id !== 'string') throw new Error('INVALID_ID');

  const validation = validatePhotoMissionPatch(patch);
  if (!validation.valid) throwValidation(validation.errors);
  const d = validation.data;
  if (Object.keys(d).length === 0) throw new Error('EMPTY_PATCH');
  const now = new Date().toISOString();

  if (!db) {
    const mem = ensureMemory().photoMissions;
    const idx = mem.findIndex((m) => m.id === id);
    if (idx < 0) throw new Error('NOT_FOUND');
    const m = mem[idx];
    if (d.title !== undefined) m.title = d.title;
    if (d.points !== undefined) m.points = d.points;
    if (d.awardsStamp !== undefined) m.awardsStamp = d.awardsStamp;
    if (d.active !== undefined) m.active = d.active;
    if (d.sortOrder !== undefined) m.sortOrder = d.sortOrder;
    m.updatedAt = now;
    return { ...m };
  }

  const row = await db
    .prepare(
      `SELECT id, wedding_key, title, points, awards_stamp, active, sort_order, updated_at
       FROM challenge_photo_missions WHERE id = ? AND wedding_key = ?`
    )
    .bind(id, WEDDING_KEY)
    .first();
  if (!row) throw new Error('NOT_FOUND');

  const existing = rowToPhotoMission(row);
  const next = {
    title: d.title ?? existing.title,
    points: d.points ?? existing.points,
    awardsStamp: d.awardsStamp !== undefined ? d.awardsStamp : existing.awardsStamp,
    active: d.active !== undefined ? d.active : existing.active,
    sortOrder: d.sortOrder ?? existing.sortOrder,
  };

  await db
    .prepare(
      `UPDATE challenge_photo_missions
       SET title = ?, points = ?, awards_stamp = ?, active = ?, sort_order = ?, updated_at = ?
       WHERE id = ? AND wedding_key = ?`
    )
    .bind(
      next.title,
      next.points,
      next.awardsStamp ? 1 : 0,
      next.active ? 1 : 0,
      next.sortOrder,
      now,
      id,
      WEDDING_KEY
    )
    .run();

  return { ...existing, ...next, updatedAt: now };
}

export async function deletePhotoMission(db, id) {
  if (!id || typeof id !== 'string') throw new Error('INVALID_ID');

  if (!db) {
    const mem = ensureMemory().photoMissions;
    const idx = mem.findIndex((m) => m.id === id);
    if (idx < 0) throw new Error('NOT_FOUND');
    mem.splice(idx, 1);
    return { id, removed: true };
  }

  const result = await db
    .prepare(`DELETE FROM challenge_photo_missions WHERE id = ? AND wedding_key = ?`)
    .bind(id, WEDDING_KEY)
    .run();
  const changes = Number(result?.meta?.changes ?? result?.changes ?? 0);
  if (changes === 0) throw new Error('NOT_FOUND');
  return { id, removed: true };
}

// ——— Stamp cards ———

export async function listStampCardsAdmin(db) {
  if (!db) return [...ensureMemory().stampCards].sort(sortByOrder);

  const rows = await db
    .prepare(
      `SELECT id, wedding_key, name, stamps_required, reward_text, active, sort_order, updated_at
       FROM challenge_stamp_cards
       WHERE wedding_key = ?
       ORDER BY sort_order ASC, id ASC`
    )
    .bind(WEDDING_KEY)
    .all();
  return (rows?.results || []).map(rowToStampCard);
}

export async function createStampCard(db, body) {
  const validation = validateStampCardCreate(body);
  if (!validation.valid) throwValidation(validation.errors);
  const d = validation.data;
  const now = new Date().toISOString();

  if (!db) {
    const mem = ensureMemory().stampCards;
    if (mem.some((c) => c.id === d.id)) throw new Error('EXISTS');
    const row = {
      id: d.id,
      weddingKey: WEDDING_KEY,
      name: d.name,
      stampsRequired: d.stampsRequired,
      rewardText: d.rewardText,
      active: d.active,
      sortOrder: d.sortOrder,
      updatedAt: now,
    };
    mem.push(row);
    return { ...row };
  }

  try {
    await db
      .prepare(
        `INSERT INTO challenge_stamp_cards (
          id, wedding_key, name, stamps_required, reward_text, active, sort_order, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        d.id,
        WEDDING_KEY,
        d.name,
        d.stampsRequired,
        d.rewardText,
        d.active ? 1 : 0,
        d.sortOrder,
        now
      )
      .run();
  } catch (err) {
    if (isUniqueViolation(err)) throw new Error('EXISTS');
    throw err;
  }

  return rowToStampCard({
    id: d.id,
    wedding_key: WEDDING_KEY,
    name: d.name,
    stamps_required: d.stampsRequired,
    reward_text: d.rewardText,
    active: d.active ? 1 : 0,
    sort_order: d.sortOrder,
    updated_at: now,
  });
}

export async function updateStampCard(db, id, patch) {
  if (!id || typeof id !== 'string') throw new Error('INVALID_ID');

  const validation = validateStampCardPatch(patch);
  if (!validation.valid) throwValidation(validation.errors);
  const d = validation.data;
  if (Object.keys(d).length === 0) throw new Error('EMPTY_PATCH');
  const now = new Date().toISOString();

  if (!db) {
    const mem = ensureMemory().stampCards;
    const idx = mem.findIndex((c) => c.id === id);
    if (idx < 0) throw new Error('NOT_FOUND');
    const c = mem[idx];
    if (d.name !== undefined) c.name = d.name;
    if (d.stampsRequired !== undefined) c.stampsRequired = d.stampsRequired;
    if (d.rewardText !== undefined) c.rewardText = d.rewardText;
    if (d.active !== undefined) c.active = d.active;
    if (d.sortOrder !== undefined) c.sortOrder = d.sortOrder;
    c.updatedAt = now;
    return { ...c };
  }

  const row = await db
    .prepare(
      `SELECT id, wedding_key, name, stamps_required, reward_text, active, sort_order, updated_at
       FROM challenge_stamp_cards WHERE id = ? AND wedding_key = ?`
    )
    .bind(id, WEDDING_KEY)
    .first();
  if (!row) throw new Error('NOT_FOUND');

  const existing = rowToStampCard(row);
  const next = {
    name: d.name ?? existing.name,
    stampsRequired: d.stampsRequired ?? existing.stampsRequired,
    rewardText: d.rewardText ?? existing.rewardText,
    active: d.active !== undefined ? d.active : existing.active,
    sortOrder: d.sortOrder ?? existing.sortOrder,
  };

  await db
    .prepare(
      `UPDATE challenge_stamp_cards
       SET name = ?, stamps_required = ?, reward_text = ?, active = ?, sort_order = ?, updated_at = ?
       WHERE id = ? AND wedding_key = ?`
    )
    .bind(
      next.name,
      next.stampsRequired,
      next.rewardText,
      next.active ? 1 : 0,
      next.sortOrder,
      now,
      id,
      WEDDING_KEY
    )
    .run();

  return { ...existing, ...next, updatedAt: now };
}

export async function deleteStampCard(db, id) {
  if (!id || typeof id !== 'string') throw new Error('INVALID_ID');

  if (!db) {
    const mem = ensureMemory().stampCards;
    const idx = mem.findIndex((c) => c.id === id);
    if (idx < 0) throw new Error('NOT_FOUND');
    mem.splice(idx, 1);
    return { id, removed: true };
  }

  const result = await db
    .prepare(`DELETE FROM challenge_stamp_cards WHERE id = ? AND wedding_key = ?`)
    .bind(id, WEDDING_KEY)
    .run();
  const changes = Number(result?.meta?.changes ?? result?.changes ?? 0);
  if (changes === 0) throw new Error('NOT_FOUND');
  return { id, removed: true };
}
