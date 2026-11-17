/**
 * Rifas / vendas e sorteios — D1 + memory fallback (Vite local).
 */

import { WEDDING_KEY } from './challenges-validators.mjs';

const MAX_IMAGE_DATA = 180_000;
const NAME_MIN = 2;
const NAME_MAX = 120;
const TOTAL_MIN = 1;
const TOTAL_MAX = 200;
const PRICE_MIN = 100;
const PRICE_MAX = 100_000_000;

/** @type {Map<string, object>} */
let memoryRaffles = new Map();
/** @type {Map<string, Array<{ number: number, guestName: string|null, createdAt: string }>>} */
let memorySales = new Map();

export function resetMemoryRafflesForTests() {
  memoryRaffles = new Map();
  memorySales = new Map();
}

export function availableNumbers(totalNumbers, soldNumbers = []) {
  const sold = new Set((soldNumbers || []).map(Number));
  const out = [];
  const total = Math.max(0, Number(totalNumbers) || 0);
  for (let n = 1; n <= total; n += 1) {
    if (!sold.has(n)) out.push(n);
  }
  return out;
}

function throwValidation(errors) {
  const err = new Error('VALIDATION');
  err.details = errors;
  throw err;
}

function validateImageData(raw) {
  if (raw == null || raw === '') return { ok: true, imageData: null };
  const imageData = String(raw).trim();
  if (!imageData.startsWith('data:image/')) {
    return { ok: false, error: 'imageData deve ser data:image/...' };
  }
  if (imageData.length > MAX_IMAGE_DATA) {
    return { ok: false, error: 'Imagem grande demais (máx ~120KB comprimida)' };
  }
  return { ok: true, imageData };
}

function slugifyId(text) {
  const base = String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  return base || `rifa-${Date.now().toString(36)}`;
}

function rowToRaffle(row) {
  const imageData = row.image_data ?? row.imageData ?? null;
  return {
    id: row.id,
    name: row.name,
    imageData,
    imageUrl: imageData || null,
    totalNumbers: Number(row.total_numbers ?? row.totalNumbers) || 0,
    priceCents: Number(row.price_cents ?? row.priceCents) || 0,
    active: row.active === undefined ? false : Boolean(Number(row.active)),
    createdAt: row.created_at ?? row.createdAt ?? null,
    updatedAt: row.updated_at ?? row.updatedAt ?? null,
  };
}

function validateCreate(body) {
  const name = String(body?.name || '').trim();
  const totalNumbers = Number(body?.totalNumbers);
  const priceCents = Number(body?.priceCents);
  const idRaw = body?.id != null ? String(body.id).trim() : '';
  const id = idRaw || slugifyId(name);
  const errors = [];

  const img = validateImageData(body?.imageData);
  if (!img.ok) errors.push(img.error);

  if (id.length < 2 || id.length > 40 || !/^[a-z0-9][a-z0-9-]*$/.test(id)) {
    errors.push('id inválido (a-z, 0-9, hífen)');
  }
  if (name.length < NAME_MIN || name.length > NAME_MAX) errors.push('name inválido');
  if (!Number.isInteger(totalNumbers) || totalNumbers < TOTAL_MIN || totalNumbers > TOTAL_MAX) {
    errors.push(`totalNumbers inválido (${TOTAL_MIN}–${TOTAL_MAX})`);
  }
  if (!Number.isInteger(priceCents) || priceCents < PRICE_MIN || priceCents > PRICE_MAX) {
    errors.push(`priceCents inválido (mín ${PRICE_MIN})`);
  }

  return {
    valid: errors.length === 0,
    errors,
    data: {
      id,
      name,
      imageData: img.imageData ?? null,
      totalNumbers,
      priceCents,
      active: body?.active === true,
    },
  };
}

function validatePatch(body) {
  const out = {};
  const errors = [];
  if (body?.name !== undefined) {
    const name = String(body.name || '').trim();
    if (name.length < NAME_MIN || name.length > NAME_MAX) errors.push('name inválido');
    else out.name = name;
  }
  if (body?.imageData !== undefined) {
    const img = validateImageData(body.imageData);
    if (!img.ok) errors.push(img.error);
    else out.imageData = img.imageData;
  }
  if (body?.totalNumbers !== undefined) {
    const totalNumbers = Number(body.totalNumbers);
    if (!Number.isInteger(totalNumbers) || totalNumbers < TOTAL_MIN || totalNumbers > TOTAL_MAX) {
      errors.push(`totalNumbers inválido (${TOTAL_MIN}–${TOTAL_MAX})`);
    } else out.totalNumbers = totalNumbers;
  }
  if (body?.priceCents !== undefined) {
    const priceCents = Number(body.priceCents);
    if (!Number.isInteger(priceCents) || priceCents < PRICE_MIN || priceCents > PRICE_MAX) {
      errors.push(`priceCents inválido (mín ${PRICE_MIN})`);
    } else out.priceCents = priceCents;
  }
  if (body?.active !== undefined) {
    out.active = body.active === true || body.active === 1 || body.active === '1';
  }
  if (!Object.keys(out).length) errors.push('nada para atualizar');
  return { valid: errors.length === 0, errors, data: out };
}

async function deactivateOthers(db, keepId) {
  if (!db) {
    for (const [id, row] of memoryRaffles) {
      if (id !== keepId) memoryRaffles.set(id, { ...row, active: false });
    }
    return;
  }
  await db
    .prepare(
      `UPDATE desafio_raffles SET active = 0, updated_at = ?
       WHERE wedding_key = ? AND id != ? AND active = 1`
    )
    .bind(new Date().toISOString(), WEDDING_KEY, keepId)
    .run();
}

async function listSoldNumbers(db, raffleId) {
  if (!db) {
    return (memorySales.get(raffleId) || []).map((s) => s.number).sort((a, b) => a - b);
  }
  const result = await db
    .prepare(`SELECT number FROM desafio_raffle_sales WHERE raffle_id = ? ORDER BY number`)
    .bind(raffleId)
    .all();
  return (result?.results || []).map((r) => Number(r.number));
}

export async function listRafflesAdmin(db) {
  if (!db) {
    return [...memoryRaffles.values()]
      .map(rowToRaffle)
      .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  }
  const result = await db
    .prepare(
      `SELECT id, name, image_data, total_numbers, price_cents, active, created_at, updated_at
       FROM desafio_raffles
       WHERE wedding_key = ?
       ORDER BY updated_at DESC, id`
    )
    .bind(WEDDING_KEY)
    .all();
  return (result?.results || []).map(rowToRaffle);
}

export async function createRaffle(db, body) {
  const validation = validateCreate(body);
  if (!validation.valid) throwValidation(validation.errors);
  const d = validation.data;
  const now = new Date().toISOString();

  if (!db) {
    if (memoryRaffles.has(d.id)) throw new Error('EXISTS');
    if (d.active) await deactivateOthers(null, d.id);
    const row = {
      id: d.id,
      name: d.name,
      imageData: d.imageData,
      totalNumbers: d.totalNumbers,
      priceCents: d.priceCents,
      active: d.active,
      createdAt: now,
      updatedAt: now,
    };
    memoryRaffles.set(d.id, row);
    memorySales.set(d.id, []);
    return rowToRaffle(row);
  }

  if (d.active) await deactivateOthers(db, d.id);

  try {
    await db
      .prepare(
        `INSERT INTO desafio_raffles (
          id, wedding_key, name, image_data, total_numbers, price_cents, active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        d.id,
        WEDDING_KEY,
        d.name,
        d.imageData,
        d.totalNumbers,
        d.priceCents,
        d.active ? 1 : 0,
        now,
        now
      )
      .run();
  } catch (err) {
    if (err?.message?.includes('UNIQUE') || err?.message?.includes('PRIMARY')) {
      throw new Error('EXISTS');
    }
    throw err;
  }

  return rowToRaffle({
    id: d.id,
    name: d.name,
    image_data: d.imageData,
    total_numbers: d.totalNumbers,
    price_cents: d.priceCents,
    active: d.active ? 1 : 0,
    created_at: now,
    updated_at: now,
  });
}

export async function updateRaffle(db, id, body) {
  const raffleId = String(id || '').trim();
  if (!raffleId) throw new Error('INVALID_ID');
  const validation = validatePatch(body || {});
  if (!validation.valid) {
    if (validation.errors.includes('nada para atualizar')) throw new Error('EMPTY_PATCH');
    throwValidation(validation.errors);
  }
  const d = validation.data;
  const now = new Date().toISOString();

  if (!db) {
    const existing = memoryRaffles.get(raffleId);
    if (!existing) throw new Error('NOT_FOUND');
    if (d.active === true) await deactivateOthers(null, raffleId);
    const next = {
      ...existing,
      name: d.name ?? existing.name,
      imageData: d.imageData !== undefined ? d.imageData : existing.imageData,
      totalNumbers: d.totalNumbers ?? existing.totalNumbers,
      priceCents: d.priceCents ?? existing.priceCents,
      active: d.active !== undefined ? d.active : existing.active,
      updatedAt: now,
    };
    memoryRaffles.set(raffleId, next);
    return rowToRaffle(next);
  }

  const existing = await db
    .prepare(
      `SELECT id, name, image_data, total_numbers, price_cents, active, created_at, updated_at
       FROM desafio_raffles WHERE id = ? AND wedding_key = ?`
    )
    .bind(raffleId, WEDDING_KEY)
    .first();
  if (!existing) throw new Error('NOT_FOUND');

  if (d.active === true) await deactivateOthers(db, raffleId);

  const next = {
    name: d.name ?? existing.name,
    imageData: d.imageData !== undefined ? d.imageData : existing.image_data,
    totalNumbers: d.totalNumbers ?? existing.total_numbers,
    priceCents: d.priceCents ?? existing.price_cents,
    active: d.active !== undefined ? d.active : Boolean(Number(existing.active)),
  };

  await db
    .prepare(
      `UPDATE desafio_raffles
       SET name = ?, image_data = ?, total_numbers = ?, price_cents = ?, active = ?, updated_at = ?
       WHERE id = ? AND wedding_key = ?`
    )
    .bind(
      next.name,
      next.imageData,
      next.totalNumbers,
      next.priceCents,
      next.active ? 1 : 0,
      now,
      raffleId,
      WEDDING_KEY
    )
    .run();

  return rowToRaffle({
    id: raffleId,
    name: next.name,
    image_data: next.imageData,
    total_numbers: next.totalNumbers,
    price_cents: next.priceCents,
    active: next.active ? 1 : 0,
    created_at: existing.created_at,
    updated_at: now,
  });
}

export async function deleteRaffle(db, id) {
  const raffleId = String(id || '').trim();
  if (!raffleId) throw new Error('INVALID_ID');

  if (!db) {
    if (!memoryRaffles.has(raffleId)) throw new Error('NOT_FOUND');
    memoryRaffles.delete(raffleId);
    memorySales.delete(raffleId);
    return;
  }

  const existing = await db
    .prepare(`SELECT id FROM desafio_raffles WHERE id = ? AND wedding_key = ?`)
    .bind(raffleId, WEDDING_KEY)
    .first();
  if (!existing) throw new Error('NOT_FOUND');

  await db.prepare(`DELETE FROM desafio_raffle_sales WHERE raffle_id = ?`).bind(raffleId).run();
  await db
    .prepare(`DELETE FROM desafio_raffles WHERE id = ? AND wedding_key = ?`)
    .bind(raffleId, WEDDING_KEY)
    .run();
}

export async function getActiveRafflePublic(db) {
  let raffle = null;
  if (!db) {
    raffle = [...memoryRaffles.values()].find((r) => r.active) || null;
    if (!raffle) return null;
    raffle = rowToRaffle(raffle);
  } else {
    const row = await db
      .prepare(
        `SELECT id, name, image_data, total_numbers, price_cents, active, created_at, updated_at
         FROM desafio_raffles
         WHERE wedding_key = ? AND active = 1
         ORDER BY updated_at DESC
         LIMIT 1`
      )
      .bind(WEDDING_KEY)
      .first();
    if (!row) return null;
    raffle = rowToRaffle(row);
  }

  const soldNumbers = await listSoldNumbers(db, raffle.id);
  return {
    id: raffle.id,
    name: raffle.name,
    imageUrl: raffle.imageUrl,
    totalNumbers: raffle.totalNumbers,
    priceCents: raffle.priceCents,
    soldNumbers,
    availableNumbers: availableNumbers(raffle.totalNumbers, soldNumbers),
  };
}
