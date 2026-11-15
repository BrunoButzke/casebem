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
  DEFAULT_STAMP_CARD_PALETTE,
  DEFAULT_FILL_MODE,
  DEFAULT_POINTS_PER_SLOT,
} from './challenges-validators.mjs';
import {
  applyQuizGabarito,
  DESAFIO_PHOTO_MISSIONS,
  DESAFIO_QUESTIONS,
  DESAFIO_STAMP_CARDS,
} from '../../data/desafio-challenges-seed.mjs';
import { PARTNER_ACCOUNT_ID } from './auth-service.mjs';
import { insertRetryOnForeignOwner } from './unique-row.mjs';

/** @type {Map<string, { questions: Array, photoMissions: Array, stampCards: Array }>} */
let memoryStores = new Map();
/** @type {Map<string, { questions: boolean, photoMissions: boolean, stampCards: boolean }>} */
let memorySeedAttempts = new Map();

function requireAccountId(accountId) {
  if (!accountId || typeof accountId !== 'string') {
    throw new Error('ACCOUNT_ID_REQUIRED');
  }
  return accountId;
}

function weddingKeyFor(accountId) {
  return accountId === PARTNER_ACCOUNT_ID ? WEDDING_KEY : accountId;
}

function emptySeedFlags() {
  return { questions: false, photoMissions: false, stampCards: false };
}

function ensureMemory(accountId) {
  const id = requireAccountId(accountId);
  if (!memoryStores.has(id)) {
    memoryStores.set(id, { questions: [], photoMissions: [], stampCards: [] });
    memorySeedAttempts.set(id, emptySeedFlags());
  }
  return memoryStores.get(id);
}

function seedFlagsFor(accountId) {
  ensureMemory(accountId);
  return memorySeedAttempts.get(accountId);
}

export function resetMemoryChallengesForTests() {
  memoryStores = new Map();
  memorySeedAttempts = new Map();
}

/**
 * Seeds Missão Impossível content (fotos, cartões e quiz com gabarito provisório A).
 * Partner account only — new accounts start empty.
 * @param {unknown} db
 * @param {string} accountId
 * @param {Record<string, string>} [gabarito] map question id → 'a'|'b'|'c'|'d'
 */
export async function seedChallengesIfEmpty(db, accountId, gabarito = {}) {
  const id = requireAccountId(accountId);
  const weddingKey = weddingKeyFor(id);
  const now = new Date().toISOString();
  const quiz = applyQuizGabarito(DESAFIO_QUESTIONS, gabarito).filter((q) => q.correctIndex != null);

  if (!db) {
    const mem = ensureMemory(id);
    const flags = seedFlagsFor(id);
    if (id !== PARTNER_ACCOUNT_ID) {
      flags.photoMissions = true;
      flags.stampCards = true;
      flags.questions = true;
      return {
        seeded: false,
        questions: mem.questions.length,
        photos: mem.photoMissions.length,
        stampCards: mem.stampCards.length,
      };
    }
    let seeded = false;

    if (!flags.photoMissions) {
      if (mem.photoMissions.length === 0) {
        mem.photoMissions.push(
          ...DESAFIO_PHOTO_MISSIONS.map((m, i) => ({
            id: m.id,
            weddingKey,
            title: m.title,
            points: m.points,
            awardsStamp: Boolean(m.awardsStamp),
            active: true,
            sortOrder: i,
            updatedAt: now,
          }))
        );
        seeded = true;
      }
      flags.photoMissions = true;
    }

    if (!flags.stampCards) {
      if (mem.stampCards.length === 0) {
        mem.stampCards.push(
          ...DESAFIO_STAMP_CARDS.map((c, i) => ({
            id: c.id,
            weddingKey,
            name: c.name,
            stampsRequired: c.stampsRequired,
            rewardText: c.rewardText,
            cardBg: c.cardBg ?? DEFAULT_STAMP_CARD_PALETTE.cardBg,
            cardAccent: c.cardAccent ?? DEFAULT_STAMP_CARD_PALETTE.cardAccent,
            cardAccentSoft: c.cardAccentSoft ?? DEFAULT_STAMP_CARD_PALETTE.cardAccentSoft,
            cardText: c.cardText ?? DEFAULT_STAMP_CARD_PALETTE.cardText,
            cardBorder: c.cardBorder ?? DEFAULT_STAMP_CARD_PALETTE.cardBorder,
            barHint: c.barHint ?? DEFAULT_STAMP_CARD_PALETTE.barHint,
            footerTemplate: c.footerTemplate ?? DEFAULT_STAMP_CARD_PALETTE.footerTemplate,
            fillMode: c.fillMode === 'points' ? 'points' : DEFAULT_FILL_MODE,
            pointsPerSlot: Number(c.pointsPerSlot) || DEFAULT_POINTS_PER_SLOT,
            active: true,
            sortOrder: i,
            updatedAt: now,
          }))
        );
        seeded = true;
      }
      flags.stampCards = true;
    }

    if (!flags.questions) {
      if (mem.questions.length === 0 && quiz.length) {
        mem.questions.push(
          ...quiz.map((q, i) => ({
            id: q.id,
            weddingKey,
            prompt: q.prompt,
            options: q.options,
            correctIndex: q.correctIndex,
            points: q.points,
            active: true,
            sortOrder: i,
            updatedAt: now,
          }))
        );
        seeded = true;
      }
      flags.questions = true;
    }

    return {
      seeded,
      questions: mem.questions.length,
      photos: mem.photoMissions.length,
      stampCards: mem.stampCards.length,
    };
  }

  const photoCount = Number(
    (await db.prepare(`SELECT COUNT(*) AS c FROM challenge_photo_missions WHERE account_id = ?`).bind(id).first())?.c || 0
  );
  if (photoCount === 0 && id === PARTNER_ACCOUNT_ID) {
    let i = 0;
    for (const m of DESAFIO_PHOTO_MISSIONS) {
      await db
        .prepare(
          `INSERT INTO challenge_photo_missions (
            id, wedding_key, title, points, awards_stamp, active, sort_order, updated_at, account_id
          ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`
        )
        .bind(m.id, weddingKey, m.title, m.points, m.awardsStamp ? 1 : 0, i++, now, id)
        .run();
    }
  }

  const cardCount = Number(
    (await db.prepare(`SELECT COUNT(*) AS c FROM challenge_stamp_cards WHERE account_id = ?`).bind(id).first())?.c || 0
  );
  if (cardCount === 0 && id === PARTNER_ACCOUNT_ID) {
    let i = 0;
    for (const c of DESAFIO_STAMP_CARDS) {
      await db
        .prepare(
          `INSERT INTO challenge_stamp_cards (
            id, wedding_key, name, stamps_required, reward_text, active, sort_order, updated_at,
            card_bg, card_accent, card_accent_soft, card_text, card_border, bar_hint, footer_template,
            fill_mode, points_per_slot, account_id
          ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          c.id,
          weddingKey,
          c.name,
          c.stampsRequired,
          c.rewardText,
          i++,
          now,
          c.cardBg ?? DEFAULT_STAMP_CARD_PALETTE.cardBg,
          c.cardAccent ?? DEFAULT_STAMP_CARD_PALETTE.cardAccent,
          c.cardAccentSoft ?? DEFAULT_STAMP_CARD_PALETTE.cardAccentSoft,
          c.cardText ?? DEFAULT_STAMP_CARD_PALETTE.cardText,
          c.cardBorder ?? DEFAULT_STAMP_CARD_PALETTE.cardBorder,
          c.barHint ?? DEFAULT_STAMP_CARD_PALETTE.barHint,
          c.footerTemplate ?? DEFAULT_STAMP_CARD_PALETTE.footerTemplate,
          c.fillMode === 'points' ? 'points' : DEFAULT_FILL_MODE,
          Number(c.pointsPerSlot) || DEFAULT_POINTS_PER_SLOT,
          id
        )
        .run();
    }
  }

  const qCount = Number(
    (await db.prepare(`SELECT COUNT(*) AS c FROM challenge_questions WHERE account_id = ?`).bind(id).first())?.c || 0
  );
  if (qCount === 0 && quiz.length && id === PARTNER_ACCOUNT_ID) {
    let i = 0;
    for (const q of quiz) {
      await db
        .prepare(
          `INSERT INTO challenge_questions (
            id, wedding_key, prompt, options_json, correct_index, points, active, sort_order, updated_at, account_id
          ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`
        )
        .bind(q.id, weddingKey, q.prompt, JSON.stringify(q.options), q.correctIndex, q.points, i++, now, id)
        .run();
    }
  }

  return { seeded: id === PARTNER_ACCOUNT_ID };
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
    cardBg: row.card_bg ?? row.cardBg ?? DEFAULT_STAMP_CARD_PALETTE.cardBg,
    cardAccent: row.card_accent ?? row.cardAccent ?? DEFAULT_STAMP_CARD_PALETTE.cardAccent,
    cardAccentSoft: row.card_accent_soft ?? row.cardAccentSoft ?? DEFAULT_STAMP_CARD_PALETTE.cardAccentSoft,
    cardText: row.card_text ?? row.cardText ?? DEFAULT_STAMP_CARD_PALETTE.cardText,
    cardBorder: row.card_border ?? row.cardBorder ?? DEFAULT_STAMP_CARD_PALETTE.cardBorder,
    barHint: row.bar_hint ?? row.barHint ?? DEFAULT_STAMP_CARD_PALETTE.barHint,
    footerTemplate: row.footer_template ?? row.footerTemplate ?? DEFAULT_STAMP_CARD_PALETTE.footerTemplate,
    fillMode: (row.fill_mode ?? row.fillMode) === 'points' ? 'points' : DEFAULT_FILL_MODE,
    pointsPerSlot: Number(row.points_per_slot ?? row.pointsPerSlot ?? DEFAULT_POINTS_PER_SLOT) || DEFAULT_POINTS_PER_SLOT,
    active: row.active === undefined ? true : Boolean(Number(row.active)),
    sortOrder: row.sort_order ?? row.sortOrder ?? 0,
    updatedAt: row.updated_at ?? row.updatedAt ?? null,
  };
}

function sortByOrder(a, b) {
  return a.sortOrder - b.sortOrder || a.id.localeCompare(b.id);
}

// ——— Questions ———

export async function listQuestionsAdmin(db, accountId) {
  const accId = requireAccountId(accountId);
  await seedChallengesIfEmpty(db, accId);
  if (!db) return [...ensureMemory(accId).questions].sort(sortByOrder);

  const rows = await db
    .prepare(
      `SELECT id, wedding_key, prompt, options_json, correct_index, points, active, sort_order, updated_at
       FROM challenge_questions
       WHERE account_id = ?
       ORDER BY sort_order ASC, id ASC`
    )
    .bind(accId)
    .all();
  return (rows?.results || []).map(rowToQuestion);
}

export async function createQuestion(db, accountId, body) {
  const accId = requireAccountId(accountId);
  const weddingKey = weddingKeyFor(accId);
  const validation = validateQuestionCreate(body);
  if (!validation.valid) throwValidation(validation.errors);
  const d = validation.data;
  const now = new Date().toISOString();

  if (!db) {
    const memStore = ensureMemory(accId);
    seedFlagsFor(accId).questions = true;
    const mem = memStore.questions;
    if (mem.some((q) => q.id === d.id)) throw new Error('EXISTS');
    const row = {
      id: d.id,
      weddingKey,
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

  const usedId = await insertRetryOnForeignOwner({
    id: d.id,
    accountId: accId,
    existsError: 'EXISTS',
    insert: (questionId) =>
      db
        .prepare(
          `INSERT INTO challenge_questions (
          id, wedding_key, prompt, options_json, correct_index, points, active, sort_order, updated_at, account_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          questionId,
          weddingKey,
          d.prompt,
          JSON.stringify(d.options),
          d.correctIndex,
          d.points,
          d.active ? 1 : 0,
          d.sortOrder,
          now,
          accId
        )
        .run(),
    selectOwnerAccountId: async (questionId) => {
      const row = await db
        .prepare('SELECT account_id FROM challenge_questions WHERE id = ?')
        .bind(questionId)
        .first();
      return row?.account_id || null;
    },
  });

  return rowToQuestion({
    id: usedId,
    wedding_key: weddingKey,
    prompt: d.prompt,
    options_json: JSON.stringify(d.options),
    correct_index: d.correctIndex,
    points: d.points,
    active: d.active ? 1 : 0,
    sort_order: d.sortOrder,
    updated_at: now,
  });
}

export async function updateQuestion(db, accountId, questionId, patch) {
  const accId = requireAccountId(accountId);
  if (!questionId || typeof questionId !== 'string') throw new Error('INVALID_ID');

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
    const mem = ensureMemory(accId).questions;
    const idx = mem.findIndex((q) => q.id === questionId);
    if (idx < 0) throw new Error('NOT_FOUND');
    mem[idx] = applyQuestionPatch(mem[idx]);
    return { ...mem[idx] };
  }

  const row = await db
    .prepare(
      `SELECT id, wedding_key, prompt, options_json, correct_index, points, active, sort_order, updated_at
       FROM challenge_questions WHERE id = ? AND account_id = ?`
    )
    .bind(questionId, accId)
    .first();
  if (!row) throw new Error('NOT_FOUND');

  const next = applyQuestionPatch(rowToQuestion(row));
  await db
    .prepare(
      `UPDATE challenge_questions
       SET prompt = ?, options_json = ?, correct_index = ?, points = ?, active = ?, sort_order = ?, updated_at = ?
       WHERE id = ? AND account_id = ?`
    )
    .bind(
      next.prompt,
      JSON.stringify(next.options),
      next.correctIndex,
      next.points,
      next.active ? 1 : 0,
      next.sortOrder,
      now,
      questionId,
      accId
    )
    .run();
  return next;
}

export async function deleteQuestion(db, accountId, questionId) {
  const accId = requireAccountId(accountId);
  if (!questionId || typeof questionId !== 'string') throw new Error('INVALID_ID');

  if (!db) {
    const mem = ensureMemory(accId).questions;
    const idx = mem.findIndex((q) => q.id === questionId);
    if (idx < 0) throw new Error('NOT_FOUND');
    mem.splice(idx, 1);
    return { id: questionId, removed: true };
  }

  const result = await db
    .prepare(`DELETE FROM challenge_questions WHERE id = ? AND account_id = ?`)
    .bind(questionId, accId)
    .run();
  const changes = Number(result?.meta?.changes ?? result?.changes ?? 0);
  if (changes === 0) throw new Error('NOT_FOUND');
  return { id: questionId, removed: true };
}

// ——— Photo missions ———

export async function listPhotoMissionsAdmin(db, accountId) {
  const accId = requireAccountId(accountId);
  await seedChallengesIfEmpty(db, accId);
  if (!db) return [...ensureMemory(accId).photoMissions].sort(sortByOrder);

  const rows = await db
    .prepare(
      `SELECT id, wedding_key, title, points, awards_stamp, active, sort_order, updated_at
       FROM challenge_photo_missions
       WHERE account_id = ?
       ORDER BY sort_order ASC, id ASC`
    )
    .bind(accId)
    .all();
  return (rows?.results || []).map(rowToPhotoMission);
}

export async function createPhotoMission(db, accountId, body) {
  const accId = requireAccountId(accountId);
  const weddingKey = weddingKeyFor(accId);
  const validation = validatePhotoMissionCreate(body);
  if (!validation.valid) throwValidation(validation.errors);
  const d = validation.data;
  const now = new Date().toISOString();

  if (!db) {
    const memStore = ensureMemory(accId);
    seedFlagsFor(accId).photoMissions = true;
    const mem = memStore.photoMissions;
    if (mem.some((m) => m.id === d.id)) throw new Error('EXISTS');
    const row = {
      id: d.id,
      weddingKey,
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

  const usedId = await insertRetryOnForeignOwner({
    id: d.id,
    accountId: accId,
    existsError: 'EXISTS',
    insert: (missionId) =>
      db
        .prepare(
          `INSERT INTO challenge_photo_missions (
          id, wedding_key, title, points, awards_stamp, active, sort_order, updated_at, account_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          missionId,
          weddingKey,
          d.title,
          d.points,
          d.awardsStamp ? 1 : 0,
          d.active ? 1 : 0,
          d.sortOrder,
          now,
          accId
        )
        .run(),
    selectOwnerAccountId: async (missionId) => {
      const row = await db
        .prepare('SELECT account_id FROM challenge_photo_missions WHERE id = ?')
        .bind(missionId)
        .first();
      return row?.account_id || null;
    },
  });

  return rowToPhotoMission({
    id: usedId,
    wedding_key: weddingKey,
    title: d.title,
    points: d.points,
    awards_stamp: d.awardsStamp ? 1 : 0,
    active: d.active ? 1 : 0,
    sort_order: d.sortOrder,
    updated_at: now,
  });
}

export async function updatePhotoMission(db, accountId, missionId, patch) {
  const accId = requireAccountId(accountId);
  if (!missionId || typeof missionId !== 'string') throw new Error('INVALID_ID');

  const validation = validatePhotoMissionPatch(patch);
  if (!validation.valid) throwValidation(validation.errors);
  const d = validation.data;
  if (Object.keys(d).length === 0) throw new Error('EMPTY_PATCH');
  const now = new Date().toISOString();

  if (!db) {
    const mem = ensureMemory(accId).photoMissions;
    const idx = mem.findIndex((m) => m.id === missionId);
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
       FROM challenge_photo_missions WHERE id = ? AND account_id = ?`
    )
    .bind(missionId, accId)
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
       WHERE id = ? AND account_id = ?`
    )
    .bind(
      next.title,
      next.points,
      next.awardsStamp ? 1 : 0,
      next.active ? 1 : 0,
      next.sortOrder,
      now,
      missionId,
      accId
    )
    .run();

  return { ...existing, ...next, updatedAt: now };
}

export async function deletePhotoMission(db, accountId, missionId) {
  const accId = requireAccountId(accountId);
  if (!missionId || typeof missionId !== 'string') throw new Error('INVALID_ID');

  if (!db) {
    const mem = ensureMemory(accId).photoMissions;
    const idx = mem.findIndex((m) => m.id === missionId);
    if (idx < 0) throw new Error('NOT_FOUND');
    mem.splice(idx, 1);
    return { id: missionId, removed: true };
  }

  const result = await db
    .prepare(`DELETE FROM challenge_photo_missions WHERE id = ? AND account_id = ?`)
    .bind(missionId, accId)
    .run();
  const changes = Number(result?.meta?.changes ?? result?.changes ?? 0);
  if (changes === 0) throw new Error('NOT_FOUND');
  return { id: missionId, removed: true };
}

// ——— Stamp cards ———

export async function listStampCardsAdmin(db, accountId) {
  const accId = requireAccountId(accountId);
  await seedChallengesIfEmpty(db, accId);
  if (!db) return [...ensureMemory(accId).stampCards].sort(sortByOrder);

  const rows = await db
    .prepare(
      `SELECT id, wedding_key, name, stamps_required, reward_text, active, sort_order, updated_at,
              card_bg, card_accent, card_accent_soft, card_text, card_border, bar_hint, footer_template,
              fill_mode, points_per_slot
       FROM challenge_stamp_cards
       WHERE account_id = ?
       ORDER BY sort_order ASC, id ASC`
    )
    .bind(accId)
    .all();
  return (rows?.results || []).map(rowToStampCard);
}

export async function createStampCard(db, accountId, body) {
  const accId = requireAccountId(accountId);
  const weddingKey = weddingKeyFor(accId);
  const validation = validateStampCardCreate(body);
  if (!validation.valid) throwValidation(validation.errors);
  const d = validation.data;
  const now = new Date().toISOString();

  if (!db) {
    const memStore = ensureMemory(accId);
    seedFlagsFor(accId).stampCards = true;
    const mem = memStore.stampCards;
    if (mem.some((c) => c.id === d.id)) throw new Error('EXISTS');
    const row = {
      id: d.id,
      weddingKey,
      name: d.name,
      stampsRequired: d.stampsRequired,
      rewardText: d.rewardText,
      fillMode: d.fillMode,
      pointsPerSlot: d.pointsPerSlot,
      cardBg: d.cardBg,
      cardAccent: d.cardAccent,
      cardAccentSoft: d.cardAccentSoft,
      cardText: d.cardText,
      cardBorder: d.cardBorder,
      barHint: d.barHint,
      footerTemplate: d.footerTemplate,
      active: d.active,
      sortOrder: d.sortOrder,
      updatedAt: now,
    };
    mem.push(row);
    return { ...row };
  }

  const usedId = await insertRetryOnForeignOwner({
    id: d.id,
    accountId: accId,
    existsError: 'EXISTS',
    insert: (cardId) =>
      db
        .prepare(
          `INSERT INTO challenge_stamp_cards (
          id, wedding_key, name, stamps_required, reward_text, active, sort_order, updated_at,
          card_bg, card_accent, card_accent_soft, card_text, card_border, bar_hint, footer_template,
          fill_mode, points_per_slot, account_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          cardId,
          weddingKey,
          d.name,
          d.stampsRequired,
          d.rewardText,
          d.active ? 1 : 0,
          d.sortOrder,
          now,
          d.cardBg,
          d.cardAccent,
          d.cardAccentSoft,
          d.cardText,
          d.cardBorder,
          d.barHint,
          d.footerTemplate,
          d.fillMode,
          d.pointsPerSlot,
          accId
        )
        .run(),
    selectOwnerAccountId: async (cardId) => {
      const row = await db
        .prepare('SELECT account_id FROM challenge_stamp_cards WHERE id = ?')
        .bind(cardId)
        .first();
      return row?.account_id || null;
    },
  });

  return rowToStampCard({
    id: usedId,
    wedding_key: weddingKey,
    name: d.name,
    stamps_required: d.stampsRequired,
    reward_text: d.rewardText,
    active: d.active ? 1 : 0,
    sort_order: d.sortOrder,
    updated_at: now,
    card_bg: d.cardBg,
    card_accent: d.cardAccent,
    card_accent_soft: d.cardAccentSoft,
    card_text: d.cardText,
    card_border: d.cardBorder,
    bar_hint: d.barHint,
    footer_template: d.footerTemplate,
    fill_mode: d.fillMode,
    points_per_slot: d.pointsPerSlot,
  });
}

export async function updateStampCard(db, accountId, cardId, patch) {
  const accId = requireAccountId(accountId);
  if (!cardId || typeof cardId !== 'string') throw new Error('INVALID_ID');

  const validation = validateStampCardPatch(patch);
  if (!validation.valid) throwValidation(validation.errors);
  const d = validation.data;
  if (Object.keys(d).length === 0) throw new Error('EMPTY_PATCH');
  const now = new Date().toISOString();

  if (!db) {
    const mem = ensureMemory(accId).stampCards;
    const idx = mem.findIndex((c) => c.id === cardId);
    if (idx < 0) throw new Error('NOT_FOUND');
    const c = mem[idx];
    if (d.name !== undefined) c.name = d.name;
    if (d.stampsRequired !== undefined) c.stampsRequired = d.stampsRequired;
    if (d.rewardText !== undefined) c.rewardText = d.rewardText;
    if (d.cardBg !== undefined) c.cardBg = d.cardBg;
    if (d.cardAccent !== undefined) c.cardAccent = d.cardAccent;
    if (d.cardAccentSoft !== undefined) c.cardAccentSoft = d.cardAccentSoft;
    if (d.cardText !== undefined) c.cardText = d.cardText;
    if (d.cardBorder !== undefined) c.cardBorder = d.cardBorder;
    if (d.barHint !== undefined) c.barHint = d.barHint;
    if (d.footerTemplate !== undefined) c.footerTemplate = d.footerTemplate;
    if (d.fillMode !== undefined) c.fillMode = d.fillMode;
    if (d.pointsPerSlot !== undefined) c.pointsPerSlot = d.pointsPerSlot;
    if (d.active !== undefined) c.active = d.active;
    if (d.sortOrder !== undefined) c.sortOrder = d.sortOrder;
    c.updatedAt = now;
    return { ...c };
  }

  const row = await db
    .prepare(
      `SELECT id, wedding_key, name, stamps_required, reward_text, active, sort_order, updated_at,
              card_bg, card_accent, card_accent_soft, card_text, card_border, bar_hint, footer_template,
              fill_mode, points_per_slot
       FROM challenge_stamp_cards WHERE id = ? AND account_id = ?`
    )
    .bind(cardId, accId)
    .first();
  if (!row) throw new Error('NOT_FOUND');

  const existing = rowToStampCard(row);
  const next = {
    name: d.name ?? existing.name,
    stampsRequired: d.stampsRequired ?? existing.stampsRequired,
    rewardText: d.rewardText ?? existing.rewardText,
    cardBg: d.cardBg ?? existing.cardBg,
    cardAccent: d.cardAccent ?? existing.cardAccent,
    cardAccentSoft: d.cardAccentSoft ?? existing.cardAccentSoft,
    cardText: d.cardText ?? existing.cardText,
    cardBorder: d.cardBorder ?? existing.cardBorder,
    barHint: d.barHint ?? existing.barHint,
    footerTemplate: d.footerTemplate ?? existing.footerTemplate,
    fillMode: d.fillMode ?? existing.fillMode,
    pointsPerSlot: d.pointsPerSlot ?? existing.pointsPerSlot,
    active: d.active !== undefined ? d.active : existing.active,
    sortOrder: d.sortOrder ?? existing.sortOrder,
  };

  await db
    .prepare(
      `UPDATE challenge_stamp_cards
       SET name = ?, stamps_required = ?, reward_text = ?, active = ?, sort_order = ?, updated_at = ?,
           card_bg = ?, card_accent = ?, card_accent_soft = ?, card_text = ?, card_border = ?,
           bar_hint = ?, footer_template = ?, fill_mode = ?, points_per_slot = ?
       WHERE id = ? AND account_id = ?`
    )
    .bind(
      next.name,
      next.stampsRequired,
      next.rewardText,
      next.active ? 1 : 0,
      next.sortOrder,
      now,
      next.cardBg,
      next.cardAccent,
      next.cardAccentSoft,
      next.cardText,
      next.cardBorder,
      next.barHint,
      next.footerTemplate,
      next.fillMode,
      next.pointsPerSlot,
      cardId,
      accId
    )
    .run();

  return { ...existing, ...next, updatedAt: now };
}

export async function deleteStampCard(db, accountId, cardId) {
  const accId = requireAccountId(accountId);
  if (!cardId || typeof cardId !== 'string') throw new Error('INVALID_ID');

  if (!db) {
    const mem = ensureMemory(accId).stampCards;
    const idx = mem.findIndex((c) => c.id === cardId);
    if (idx < 0) throw new Error('NOT_FOUND');
    mem.splice(idx, 1);
    return { id: cardId, removed: true };
  }

  const result = await db
    .prepare(`DELETE FROM challenge_stamp_cards WHERE id = ? AND account_id = ?`)
    .bind(cardId, accId)
    .run();
  const changes = Number(result?.meta?.changes ?? result?.changes ?? 0);
  if (changes === 0) throw new Error('NOT_FOUND');
  return { id: cardId, removed: true };
}

function toPublicQuestion(q) {
  return {
    id: q.id,
    prompt: q.prompt,
    options: q.options,
    points: q.points,
    sortOrder: q.sortOrder,
  };
}

function toPublicPhotoMission(m) {
  return {
    id: m.id,
    title: m.title,
    points: m.points,
    awardsStamp: m.awardsStamp,
    sortOrder: m.sortOrder,
  };
}

function toPublicStampCard(c) {
  return {
    id: c.id,
    name: c.name,
    stampsRequired: c.stampsRequired,
    rewardText: c.rewardText,
    cardBg: c.cardBg,
    cardAccent: c.cardAccent,
    cardAccentSoft: c.cardAccentSoft,
    cardText: c.cardText,
    cardBorder: c.cardBorder,
    barHint: c.barHint,
    footerTemplate: c.footerTemplate,
    fillMode: c.fillMode === 'points' ? 'points' : 'stamp',
    pointsPerSlot: Number(c.pointsPerSlot) || DEFAULT_POINTS_PER_SLOT,
  };
}

export async function listChallengesPublic(db, accountId) {
  const accId = requireAccountId(accountId);
  const [questions, photoMissions, stampCards] = await Promise.all([
    listQuestionsAdmin(db, accId),
    listPhotoMissionsAdmin(db, accId),
    listStampCardsAdmin(db, accId),
  ]);
  return {
    questions: questions.filter((q) => q.active).map(toPublicQuestion),
    photoMissions: photoMissions.filter((m) => m.active).map(toPublicPhotoMission),
    stampCards: stampCards.filter((c) => c.active).map(toPublicStampCard),
  };
}

export async function gradeQuestion(db, accountId, questionId, selectedIndex) {
  if (!questionId || typeof questionId !== 'string') throw new Error('INVALID_ID');
  const questions = await listQuestionsAdmin(db, accountId);
  const q = questions.find((item) => item.id === questionId && item.active);
  if (!q) throw new Error('NOT_FOUND');
  const idx = Number(selectedIndex);
  if (!Number.isInteger(idx) || idx < 0 || idx >= q.options.length) {
    const err = new Error('VALIDATION');
    err.details = ['selectedIndex inválido'];
    throw err;
  }
  const correct = idx === q.correctIndex;
  return {
    questionId: q.id,
    correct,
    points: correct ? q.points : 0,
  };
}
