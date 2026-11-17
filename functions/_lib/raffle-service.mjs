/**
 * Rifas / vendas e sorteios — D1 + memory fallback (Vite local).
 */

import { WEDDING_KEY } from './challenges-validators.mjs';

const MAX_IMAGE_DATA = 180_000;
const NAME_MIN = 2;
const NAME_MAX = 120;
const TOTAL_MIN = 1;
const TOTAL_MAX = 2000;
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

const HOLD_MS = 5 * 60 * 1000;

/**
 * Preferidos livres primeiro; depois preenche com os menores livres.
 * Se faltar cupo, expande além de totalNumbers.
 */
export function allocateRaffleNumbers({ preferred = [], taken = [], count, totalNumbers }) {
  const need = Math.max(0, Number(count) || 0);
  const takenSet = new Set((taken || []).map(Number));
  const preferredList = [...new Set((preferred || []).map(Number))]
    .filter((n) => Number.isInteger(n) && n >= 1)
    .sort((a, b) => a - b);
  const assigned = [];

  for (const n of preferredList) {
    if (assigned.length >= need) break;
    if (!takenSet.has(n)) {
      assigned.push(n);
      takenSet.add(n);
    }
  }

  let candidate = 1;
  while (assigned.length < need) {
    if (!takenSet.has(candidate)) {
      assigned.push(candidate);
      takenSet.add(candidate);
    }
    candidate += 1;
    if (candidate > 2000) break;
  }

  const maxAssigned = assigned.length ? Math.max(...assigned) : 0;
  const newTotal = Math.max(Number(totalNumbers) || 0, maxAssigned);
  return { assigned: assigned.sort((a, b) => a - b), newTotal };
}

function isSoldStatus(status) {
  return !status || status === 'sold';
}

async function purgeExpiredHolds(db, raffleId = null) {
  const cutoff = new Date(Date.now() - HOLD_MS).toISOString();
  if (!db) {
    for (const [id, rows] of memorySales) {
      if (raffleId && id !== raffleId) continue;
      memorySales.set(
        id,
        (rows || []).filter((s) => !(s.status === 'pending' && String(s.createdAt || '') < cutoff))
      );
    }
    return;
  }
  if (raffleId) {
    await db
      .prepare(
        `DELETE FROM desafio_raffle_sales
         WHERE raffle_id = ? AND status = 'pending' AND created_at < ?`
      )
      .bind(raffleId, cutoff)
      .run();
    return;
  }
  await db
    .prepare(
      `DELETE FROM desafio_raffle_sales
       WHERE status = 'pending' AND created_at < ?`
    )
    .bind(cutoff)
    .run();
}

async function listSoldNumbers(db, raffleId) {
  if (!db) {
    return (memorySales.get(raffleId) || [])
      .filter((s) => isSoldStatus(s.status))
      .map((s) => s.number)
      .sort((a, b) => a - b);
  }
  const result = await db
    .prepare(
      `SELECT number FROM desafio_raffle_sales
       WHERE raffle_id = ? AND (status IS NULL OR status = 'sold')
       ORDER BY number`
    )
    .bind(raffleId)
    .all();
  return (result?.results || []).map((r) => Number(r.number));
}

async function listTakenNumbers(db, raffleId) {
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

async function listMySoldNumbers(db, raffleId, guestName) {
  const name = String(guestName || '').trim().toLowerCase();
  if (!name) return [];
  if (!db) {
    return (memorySales.get(raffleId) || [])
      .filter((s) => isSoldStatus(s.status) && String(s.guestName || '').trim().toLowerCase() === name)
      .map((s) => s.number)
      .sort((a, b) => a - b);
  }
  const result = await db
    .prepare(
      `SELECT number FROM desafio_raffle_sales
       WHERE raffle_id = ?
         AND (status IS NULL OR status = 'sold')
         AND lower(trim(guest_name)) = ?
       ORDER BY number`
    )
    .bind(raffleId, name)
    .all();
  return (result?.results || []).map((r) => Number(r.number));
}

export async function getActiveRafflePublic(db, { guestName = '' } = {}) {
  await purgeExpiredHolds(db);
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

  const takenNumbers = await listTakenNumbers(db, raffle.id);
  const myNumbers = await listMySoldNumbers(db, raffle.id, guestName);
  return {
    id: raffle.id,
    name: raffle.name,
    imageUrl: raffle.imageUrl,
    totalNumbers: raffle.totalNumbers,
    priceCents: raffle.priceCents,
    myNumbers,
    availableNumbers: availableNumbers(raffle.totalNumbers, takenNumbers),
  };
}

function parseRaffleItems(canonicalItems) {
  let items = [];
  try {
    items = JSON.parse(canonicalItems || '[]');
  } catch {
    items = [];
  }
  const numbers = [];
  let raffleId = null;
  for (const item of items) {
    const id = String(item?.giftId || '');
    const match = id.match(/^raffle-([a-z0-9-]+)-(\d+)$/i);
    if (match) {
      raffleId = raffleId || match[1];
      numbers.push(Number(match[2]));
    }
  }
  return { raffleId, numbers: [...new Set(numbers)].sort((a, b) => a - b) };
}

async function bumpRaffleTotal(db, raffleId, newTotal) {
  const now = new Date().toISOString();
  if (!db) {
    const row = memoryRaffles.get(raffleId);
    if (row && Number(row.totalNumbers) < newTotal) {
      memoryRaffles.set(raffleId, { ...row, totalNumbers: newTotal, updatedAt: now });
    }
    return;
  }
  await db
    .prepare(
      `UPDATE desafio_raffles
       SET total_numbers = CASE WHEN total_numbers < ? THEN ? ELSE total_numbers END,
           updated_at = ?
       WHERE id = ? AND wedding_key = ?`
    )
    .bind(newTotal, newTotal, now, raffleId, WEDDING_KEY)
    .run();
}

/**
 * Finaliza holds pendentes → vendidos.
 * Se o hold expirou, realoca números livres / sequenciais e expande o total se preciso.
 */
export async function finalizeRaffleSalesByIntent(db, intentKey) {
  const key = String(intentKey || '').trim();
  if (!key) return { updated: 0, numbers: [] };
  const now = new Date().toISOString();

  if (!db) {
    let updated = 0;
    const numbers = [];
    for (const [raffleId, rows] of memorySales) {
      const next = (rows || []).map((s) => {
        if (s.intentKey === key && s.status === 'pending') {
          updated += 1;
          numbers.push(s.number);
          return { ...s, status: 'sold', createdAt: now };
        }
        return s;
      });
      memorySales.set(raffleId, next);
    }
    if (updated > 0) return { updated, numbers: numbers.sort((a, b) => a - b) };
    return { updated: 0, numbers: [] };
  }

  const pendingRows = await db
    .prepare(
      `SELECT raffle_id AS raffleId, number, guest_name AS guestName
       FROM desafio_raffle_sales
       WHERE intent_key = ? AND status = 'pending'
       ORDER BY number`
    )
    .bind(key)
    .all();
  const pending = pendingRows?.results || [];

  if (pending.length) {
    await db
      .prepare(
        `UPDATE desafio_raffle_sales
         SET status = 'sold', created_at = ?
         WHERE intent_key = ? AND status = 'pending'`
      )
      .bind(now, key)
      .run();
    return {
      updated: pending.length,
      numbers: pending.map((r) => Number(r.number)),
      guestName: pending[0]?.guestName || null,
      raffleId: pending[0]?.raffleId || null,
    };
  }

  // Hold expirou: realoca a partir do intent
  const intent = await db
    .prepare(
      `SELECT gifter_name AS guestName, canonical_items AS canonicalItems, provider_reference AS paymentId
       FROM checkout_intents WHERE intent_key = ?`
    )
    .bind(key)
    .first();
  if (!intent) return { updated: 0, numbers: [], reassigned: false };

  const { raffleId, numbers: preferred } = parseRaffleItems(intent.canonicalItems);
  if (!raffleId || !preferred.length) return { updated: 0, numbers: [], reassigned: false };

  const already = await db
    .prepare(
      `SELECT number FROM desafio_raffle_sales
       WHERE intent_key = ? AND (status IS NULL OR status = 'sold')`
    )
    .bind(key)
    .all();
  if ((already?.results || []).length) {
    return {
      updated: 0,
      numbers: (already.results || []).map((r) => Number(r.number)),
      reassigned: false,
      alreadySold: true,
    };
  }

  const raffleRow = await db
    .prepare(
      `SELECT id, total_numbers AS totalNumbers FROM desafio_raffles
       WHERE id = ? AND wedding_key = ?`
    )
    .bind(raffleId, WEDDING_KEY)
    .first();
  if (!raffleRow) return { updated: 0, numbers: [], reassigned: false };

  const taken = await listTakenNumbers(db, raffleId);
  const { assigned, newTotal } = allocateRaffleNumbers({
    preferred,
    taken,
    count: preferred.length,
    totalNumbers: Number(raffleRow.totalNumbers) || preferred.length,
  });

  if (newTotal > Number(raffleRow.totalNumbers)) {
    await bumpRaffleTotal(db, raffleId, newTotal);
  }

  const guestName = String(intent.guestName || 'Convidado').trim();
  const paymentId = intent.paymentId ? String(intent.paymentId) : null;
  for (const n of assigned) {
    await db
      .prepare(
        `INSERT INTO desafio_raffle_sales (raffle_id, number, guest_name, created_at, status, intent_key, payment_id)
         VALUES (?, ?, ?, ?, 'sold', ?, ?)`
      )
      .bind(raffleId, n, guestName, now, key, paymentId)
      .run();
  }

  return {
    updated: assigned.length,
    numbers: assigned,
    guestName,
    raffleId,
    reassigned: true,
    expandedTo: newTotal,
  };
}

/**
 * Cria Pix + hold dos números selecionados.
 */
export async function createRaffleCheckout(db, env, body, { origin = null } = {}) {
  if (!db) {
    return {
      ok: false,
      status: 503,
      error: 'DB_NOT_CONFIGURED',
      message: 'Banco não configurado',
    };
  }
  if (!env?.MP_ACCESS_TOKEN) {
    return {
      ok: false,
      status: 503,
      error: 'PAYMENT_SERVICE_NOT_CONFIGURED',
      message: 'Serviço de pagamento não configurado',
    };
  }

  const { isValidIntentKey, createCheckoutFingerprint, getOrCreateIntent, updateIntentWithPayment, generateMPIdempotencyKey } =
    await import('./checkout-idempotency.mjs');

  const raffleId = String(body?.raffleId || '').trim();
  const guestName = String(body?.guestName || '').trim();
  const payerEmail = String(body?.payerEmail || body?.email || '').trim().toLowerCase();
  const intentKey = String(body?.intentKey || '').trim();
  const numbers = [...new Set((Array.isArray(body?.numbers) ? body.numbers : []).map(Number))]
    .filter((n) => Number.isInteger(n) && n >= 1)
    .sort((a, b) => a - b);

  if (!isValidIntentKey(intentKey)) {
    return { ok: false, status: 400, error: 'INVALID_INTENT_KEY', message: 'intentKey inválido' };
  }
  if (guestName.length < 2 || guestName.length > 80) {
    return { ok: false, status: 400, error: 'VALIDATION', message: 'Informe seu nome' };
  }
  if (!numbers.length) {
    return { ok: false, status: 400, error: 'VALIDATION', message: 'Selecione ao menos um número' };
  }
  if (!payerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(payerEmail)) {
    return { ok: false, status: 400, error: 'VALIDATION', message: 'Informe um e-mail válido para o Pix' };
  }

  await purgeExpiredHolds(db, raffleId);

  const raffleRow = await db
    .prepare(
      `SELECT id, name, total_numbers, price_cents, active
       FROM desafio_raffles WHERE id = ? AND wedding_key = ? AND active = 1`
    )
    .bind(raffleId, WEDDING_KEY)
    .first();
  if (!raffleRow) {
    return { ok: false, status: 404, error: 'NO_ACTIVE_RAFFLE', message: 'Sorteio não encontrado ou inativo' };
  }

  const totalNumbers = Number(raffleRow.total_numbers);
  const priceCents = Number(raffleRow.price_cents);
  if (numbers.some((n) => n > totalNumbers)) {
    return { ok: false, status: 400, error: 'VALIDATION', message: 'Número inválido para este sorteio' };
  }

  const taken = new Set(await listTakenNumbers(db, raffleId));
  const blocked = numbers.filter((n) => taken.has(n));
  if (blocked.length) {
    const label = blocked.length === 1 ? 'esse número' : 'esses números';
    return {
      ok: false,
      status: 409,
      error: 'NUMBERS_UNAVAILABLE',
      message: `Opa, alguém pegou ${label}. Escolha outro(s).`,
      numbers: blocked,
    };
  }

  const amountCents = numbers.length * priceCents;
  if (amountCents < 100) {
    return { ok: false, status: 400, error: 'VALIDATION', message: 'Valor mínimo é R$ 1,00' };
  }

  const items = numbers.map((n) => ({
    giftId: `raffle-${raffleId}-${n}`,
    name: `${raffleRow.name} · nº ${n}`,
    quantity: 1,
    priceInCents: priceCents,
  }));

  const fingerprint = await createCheckoutFingerprint({
    gifterName: guestName,
    items,
    paymentMethod: 'pix',
    amountCents,
  });

  if (!env.RSVP_SECRET) {
    return {
      ok: false,
      status: 503,
      error: 'RSVP_SECRET_MISSING',
      message: 'Configuração de checkout incompleta (RSVP_SECRET)',
    };
  }

  let intentResult;
  try {
    intentResult = await getOrCreateIntent(
      db,
      {
        intentKey,
        fingerprint,
        gifterName: guestName,
        items,
        paymentMethod: 'pix',
        amountCents,
      },
      env.RSVP_SECRET
    );
  } catch (err) {
    if (err.message === 'INVALID_INTENT_KEY') {
      return { ok: false, status: 400, error: 'INVALID_INTENT_KEY', message: 'intentKey inválido' };
    }
    throw err;
  }

  if (intentResult.conflict) {
    return { ok: false, status: 409, error: 'INTENT_CONFLICT', message: 'Pedido já usado com outro conteúdo' };
  }

  if (intentResult.status === 'pending' && intentResult.intent?.qrCode) {
    return {
      ok: true,
      method: 'pix',
      status: 'pending',
      payment: {
        id: intentResult.intent.providerReference,
        qrCode: intentResult.intent.qrCode,
        qrCodeBase64: intentResult.intent.qrCodeBase64 || '',
      },
      amountCents,
      numbers,
    };
  }

  const now = new Date().toISOString();
  try {
    for (const n of numbers) {
      await db
        .prepare(
          `INSERT INTO desafio_raffle_sales (raffle_id, number, guest_name, created_at, status, intent_key, payment_id)
           VALUES (?, ?, ?, ?, 'pending', ?, NULL)`
        )
        .bind(raffleId, n, guestName, now, intentKey)
        .run();
    }
  } catch (err) {
    await db.prepare(`DELETE FROM desafio_raffle_sales WHERE intent_key = ? AND status = 'pending'`).bind(intentKey).run();
    if (String(err?.message || '').includes('UNIQUE') || String(err?.message || '').includes('PRIMARY')) {
      return {
        ok: false,
        status: 409,
        error: 'NUMBERS_UNAVAILABLE',
        message: 'Opa, alguém pegou esse número. Escolha outro(s).',
      };
    }
    throw err;
  }

  const notificationUrl = (() => {
    if (env.MP_NOTIFICATION_URL) return String(env.MP_NOTIFICATION_URL);
    const base = origin || '';
    if (base.startsWith('https://') && !base.includes('localhost')) {
      return `${base.replace(/\/$/, '')}/api/webhooks/mercadopago`;
    }
    return null;
  })();

  const { createPixPayment } = await import('./mercadopago.mjs');
  const mpIdempotencyKey = await generateMPIdempotencyKey(intentKey, env.RSVP_SECRET);

  const result = await createPixPayment({
    accessToken: env.MP_ACCESS_TOKEN,
    gifterName: guestName,
    items,
    totalInCents: amountCents,
    intentKey,
    idempotencyKey: mpIdempotencyKey,
    payerEmail,
    notificationUrl,
    testPayerEmail: env.MP_TEST_PAYER_EMAIL || '',
    kind: 'raffle',
    description: `Sorteio ${raffleRow.name} — ${guestName}`.slice(0, 200),
  });

  if (!result.ok) {
    await db.prepare(`DELETE FROM desafio_raffle_sales WHERE intent_key = ? AND status = 'pending'`).bind(intentKey).run();
    await updateIntentWithPayment(db, intentKey, {}, 'failed');
    return {
      ok: false,
      status: result.status >= 400 && result.status < 600 ? result.status : 503,
      error: 'PAYMENT_SERVICE_ERROR',
      message: result.error || 'Erro ao gerar Pix',
      details: result.details,
    };
  }

  const payment = result.payment;
  if (!payment?.id || !payment?.qrCode) {
    await db.prepare(`DELETE FROM desafio_raffle_sales WHERE intent_key = ? AND status = 'pending'`).bind(intentKey).run();
    await updateIntentWithPayment(db, intentKey, payment || {}, 'failed');
    return {
      ok: false,
      status: 502,
      error: 'MISSING_PIX_DATA',
      message: 'Dados Pix incompletos',
    };
  }

  await db
    .prepare(`UPDATE desafio_raffle_sales SET payment_id = ? WHERE intent_key = ? AND status = 'pending'`)
    .bind(String(payment.id), intentKey)
    .run();
  await updateIntentWithPayment(db, intentKey, payment, 'pending');

  return {
    ok: true,
    method: 'pix',
    status: 'pending',
    payment: {
      id: payment.id,
      qrCode: payment.qrCode,
      qrCodeBase64: payment.qrCodeBase64 || '',
      ticketUrl: payment.ticketUrl || '',
    },
    amountCents,
    numbers,
    intentKey,
  };
}
