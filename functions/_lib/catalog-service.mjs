/**
 * Gifts catalog backed by D1, seeded from static module.
 * Cloudflare Free — no paid storage. Memory fallback for Vite local.
 */

import { GIFTS_CATALOG } from '../../data/gifts-catalog.mjs';
import { WEDDING_KEY as DEFAULT_WEDDING_KEY } from './messages-validators.mjs';

function resolveWeddingKey(weddingKey) {
  const k = String(weddingKey || DEFAULT_WEDDING_KEY).trim();
  return k || DEFAULT_WEDDING_KEY;
}

/** @type {Map<string, object[]>} */
let memoryCatalogByWedding = new Map();

const MAX_IMAGE_DATA = 180_000;

function resolveImageUrl(row) {
  const data = row.image_data ?? row.imageData ?? null;
  if (data) return data;
  return row.image_url ?? row.imageUrl ?? '/images/gifts/mensagem.jpg';
}

function rowToGift(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    priceInCents: row.price_in_cents ?? row.priceInCents,
    imageUrl: resolveImageUrl(row),
    mode: row.mode,
    active: row.active === undefined ? true : Boolean(Number(row.active)),
    sortOrder: row.sort_order ?? row.sortOrder ?? 0,
    updatedAt: row.updated_at ?? row.updatedAt ?? null,
  };
}

function validateImageData(raw) {
  const imageData = String(raw || '').trim();
  if (!imageData.startsWith('data:image/')) {
    return { ok: false, error: 'imageData deve ser data:image/...' };
  }
  if (imageData.length > MAX_IMAGE_DATA) {
    return { ok: false, error: 'Imagem grande demais (máx ~120KB comprimida)' };
  }
  return { ok: true, imageData };
}

function validateImageUrl(raw) {
  const imageUrl = String(raw || '').trim();
  if (!imageUrl.startsWith('/') && !imageUrl.startsWith('https://')) {
    return { ok: false, error: 'imageUrl deve ser path /... ou https://' };
  }
  if (imageUrl.length > 300) return { ok: false, error: 'imageUrl longa demais' };
  return { ok: true, imageUrl };
}

export function slugifyId(text) {
  const base = String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return base || `item-${Date.now().toString(36)}`;
}

function ensureMemoryCatalog(weddingKey = DEFAULT_WEDDING_KEY) {
  const key = resolveWeddingKey(weddingKey);
  if (!memoryCatalogByWedding.has(key)) {
    const list =
      key === DEFAULT_WEDDING_KEY
        ? GIFTS_CATALOG.map((g, i) => ({
            id: g.id,
            name: g.name,
            description: g.description,
            priceInCents: g.priceInCents,
            imageUrl: g.imageUrl,
            mode: g.mode,
            active: true,
            sortOrder: i,
            updatedAt: null,
          }))
        : [];
    memoryCatalogByWedding.set(key, list);
  }
  return memoryCatalogByWedding.get(key);
}

export function resetMemoryCatalogForTests() {
  memoryCatalogByWedding = new Map();
}

function staticActiveCatalogFallback() {
  return GIFTS_CATALOG.map((g) => ({ ...g, active: true }));
}

export async function seedCatalogIfEmpty(db, weddingKey = DEFAULT_WEDDING_KEY) {
  const key = resolveWeddingKey(weddingKey);
  if (!db) {
    return { seeded: false, count: ensureMemoryCatalog(key).length };
  }
  if (key !== DEFAULT_WEDDING_KEY) {
    const countRow = await db
      .prepare(`SELECT COUNT(*) AS c FROM gifts_catalog WHERE wedding_key = ?`)
      .bind(key)
      .first();
    const count = Number(countRow?.c || 0);
    return { seeded: false, count };
  }
  const countRow = await db
    .prepare(`SELECT COUNT(*) AS c FROM gifts_catalog WHERE wedding_key = ?`)
    .bind(key)
    .first();
  const count = Number(countRow?.c || 0);
  if (count > 0) return { seeded: false, count };

  const now = new Date().toISOString();
  let i = 0;
  for (const gift of GIFTS_CATALOG) {
    await db
      .prepare(
        `INSERT INTO gifts_catalog (
          id, wedding_key, name, description, price_in_cents, image_url, mode, active, sort_order, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
      )
      .bind(
        gift.id,
        key,
        gift.name,
        gift.description,
        gift.priceInCents,
        gift.imageUrl,
        gift.mode,
        i++,
        now
      )
      .run();
  }
  return { seeded: true, count: GIFTS_CATALOG.length };
}

/**
 * Active gifts for checkout / public site. Falls back to static if D1 empty/unavailable.
 */
export async function getActiveCatalog(db, weddingKey = DEFAULT_WEDDING_KEY) {
  const key = resolveWeddingKey(weddingKey);
  if (!db) {
    return ensureMemoryCatalog(key)
      .filter((g) => g.active)
      .map((g) => ({ ...g }));
  }

  try {
    await seedCatalogIfEmpty(db, key);
    const rows = await db
      .prepare(
        `SELECT id, name, description, price_in_cents, image_url, image_data, mode, active, sort_order, updated_at
         FROM gifts_catalog
         WHERE wedding_key = ? AND active = 1
         ORDER BY sort_order ASC, id ASC`
      )
      .bind(key)
      .all();
    const list = (rows?.results || []).map(rowToGift);
    if (list.length === 0 && key === DEFAULT_WEDDING_KEY) return staticActiveCatalogFallback();
    return list;
  } catch {
    if (key === DEFAULT_WEDDING_KEY) return staticActiveCatalogFallback();
    return [];
  }
}

export async function listCatalogAdmin(db, weddingKey = DEFAULT_WEDDING_KEY) {
  const key = resolveWeddingKey(weddingKey);
  if (!db) {
    return [...ensureMemoryCatalog(key)].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)
    );
  }
  try {
    await seedCatalogIfEmpty(db, key);
    const rows = await db
      .prepare(
        `SELECT id, name, description, price_in_cents, image_url, image_data, mode, active, sort_order, updated_at
         FROM gifts_catalog
         WHERE wedding_key = ?
         ORDER BY sort_order ASC, id ASC`
      )
      .bind(key)
      .all();
    return (rows?.results || []).map(rowToGift);
  } catch (err) {
    const { isMissingWeddingKeyColumn } = await import('./d1-compat.mjs');
    if (!isMissingWeddingKeyColumn(err) || key !== DEFAULT_WEDDING_KEY) throw err;
    const rows = await db
      .prepare(
        `SELECT id, name, description, price_in_cents, image_url, image_data, mode, active, sort_order, updated_at
         FROM gifts_catalog
         ORDER BY sort_order ASC, id ASC`
      )
      .all();
    return (rows?.results || []).map(rowToGift);
  }
}

export function validateGiftPatch(body) {
  const errors = [];
  const out = {};

  if (body.name !== undefined) {
    const name = String(body.name || '').trim();
    if (name.length < 2 || name.length > 100) errors.push('name inválido');
    else out.name = name;
  }
  if (body.description !== undefined) {
    const description = String(body.description || '').trim();
    if (description.length < 2 || description.length > 300) errors.push('description inválida');
    else out.description = description;
  }
  if (body.priceInCents !== undefined) {
    const price = Number(body.priceInCents);
    if (!Number.isInteger(price) || price < 99 || price > 100000000) {
      errors.push('priceInCents inválido (mín 99)');
    } else out.priceInCents = price;
  }
  if (body.imageUrl !== undefined) {
    const checked = validateImageUrl(body.imageUrl);
    if (!checked.ok) errors.push(checked.error);
    else out.imageUrl = checked.imageUrl;
  }
  if (body.imageData !== undefined) {
    if (body.imageData === null || body.imageData === '') {
      out.imageData = null;
    } else {
      const checked = validateImageData(body.imageData);
      if (!checked.ok) errors.push(checked.error);
      else out.imageData = checked.imageData;
    }
  }
  if (body.mode !== undefined) {
    if (body.mode !== 'fixed' && body.mode !== 'custom') errors.push('mode inválido');
    else out.mode = body.mode;
  }
  if (body.active !== undefined) {
    if (typeof body.active !== 'boolean') errors.push('active deve ser boolean');
    else out.active = body.active;
  }
  if (body.sortOrder !== undefined) {
    const sortOrder = Number(body.sortOrder);
    if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 10000) {
      errors.push('sortOrder inválido');
    } else out.sortOrder = sortOrder;
  }

  return { valid: errors.length === 0, errors, data: out };
}

export function validateGiftCreate(body) {
  const name = String(body?.name || '').trim();
  const description = String(body?.description || '').trim();
  const price = Number(body?.priceInCents);
  const mode = body?.mode === 'custom' ? 'custom' : 'fixed';
  const idRaw = body?.id != null ? String(body.id).trim() : '';
  const id = idRaw || slugifyId(name);
  const errors = [];

  let imageUrl = '/images/gifts/mensagem.jpg';
  let imageData = null;
  if (body?.imageData) {
    const checked = validateImageData(body.imageData);
    if (!checked.ok) errors.push(checked.error);
    else imageData = checked.imageData;
  } else if (body?.imageUrl) {
    const checked = validateImageUrl(body.imageUrl);
    if (!checked.ok) errors.push(checked.error);
    else imageUrl = checked.imageUrl;
  }

  if (id.length < 2 || id.length > 40 || !/^[a-z0-9][a-z0-9-]*$/.test(id)) {
    errors.push('id inválido (a-z, 0-9, hífen)');
  }
  if (name.length < 2 || name.length > 100) errors.push('name inválido');
  if (description.length < 2 || description.length > 300) errors.push('description inválida');
  if (!Number.isInteger(price) || price < 99 || price > 100000000) {
    errors.push('priceInCents inválido (mín 99)');
  }

  return {
    valid: errors.length === 0,
    errors,
    data: {
      id,
      name,
      description,
      priceInCents: price,
      imageUrl,
      imageData,
      mode,
      active: body?.active !== false,
      sortOrder: Number.isInteger(Number(body?.sortOrder)) ? Number(body.sortOrder) : 0,
    },
  };
}

export async function createGift(db, body, weddingKey = DEFAULT_WEDDING_KEY) {
  const key = resolveWeddingKey(weddingKey);
  const validation = validateGiftCreate(body);
  if (!validation.valid) {
    const err = new Error('VALIDATION');
    err.details = validation.errors;
    throw err;
  }
  const d = validation.data;
  const now = new Date().toISOString();

  if (!db) {
    const mem = ensureMemoryCatalog(key);
    if (mem.some((g) => g.id === d.id)) throw new Error('GIFT_EXISTS');
    const gift = {
      id: d.id,
      name: d.name,
      description: d.description,
      priceInCents: d.priceInCents,
      imageUrl: d.imageData || d.imageUrl,
      imageData: d.imageData,
      mode: d.mode,
      active: d.active,
      sortOrder: d.sortOrder,
      updatedAt: now,
    };
    mem.push(gift);
    return gift;
  }

  try {
    await db
      .prepare(
        `INSERT INTO gifts_catalog (
          id, wedding_key, name, description, price_in_cents, image_url, image_data, mode, active, sort_order, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        d.id,
        key,
        d.name,
        d.description,
        d.priceInCents,
        d.imageUrl,
        d.imageData,
        d.mode,
        d.active ? 1 : 0,
        d.sortOrder,
        now
      )
      .run();
  } catch (err) {
    if (err?.message?.includes('UNIQUE') || err?.message?.includes('PRIMARY')) {
      throw new Error('GIFT_EXISTS');
    }
    throw err;
  }

  return rowToGift({
    id: d.id,
    name: d.name,
    description: d.description,
    price_in_cents: d.priceInCents,
    image_url: d.imageUrl,
    image_data: d.imageData,
    mode: d.mode,
    active: d.active ? 1 : 0,
    sort_order: d.sortOrder,
    updated_at: now,
  });
}

export async function updateGift(db, giftId, patch, weddingKey = DEFAULT_WEDDING_KEY) {
  if (!giftId || typeof giftId !== 'string') throw new Error('INVALID_GIFT_ID');
  const key = resolveWeddingKey(weddingKey);

  const validation = validateGiftPatch(patch);
  if (!validation.valid) {
    const err = new Error('VALIDATION');
    err.details = validation.errors;
    throw err;
  }
  const d = validation.data;
  if (Object.keys(d).length === 0) throw new Error('EMPTY_PATCH');
  const now = new Date().toISOString();

  if (!db) {
    const mem = ensureMemoryCatalog(key);
    const g = mem.find((x) => x.id === giftId);
    if (!g) throw new Error('GIFT_NOT_FOUND');
    if (d.name !== undefined) g.name = d.name;
    if (d.description !== undefined) g.description = d.description;
    if (d.priceInCents !== undefined) g.priceInCents = d.priceInCents;
    if (d.imageUrl !== undefined) {
      g.imageUrl = d.imageUrl;
      g.imageData = null;
    }
    if (d.imageData !== undefined) {
      g.imageData = d.imageData;
      if (d.imageData) g.imageUrl = d.imageData;
    }
    if (d.mode !== undefined) g.mode = d.mode;
    if (d.active !== undefined) g.active = d.active;
    if (d.sortOrder !== undefined) g.sortOrder = d.sortOrder;
    g.updatedAt = now;
    return { ...g, imageUrl: g.imageData || g.imageUrl };
  }

  const existing = await db
    .prepare(`SELECT id FROM gifts_catalog WHERE id = ? AND wedding_key = ?`)
    .bind(giftId, key)
    .first();
  if (!existing) throw new Error('GIFT_NOT_FOUND');

  const row = await db
    .prepare(
      `SELECT id, name, description, price_in_cents, image_url, image_data, mode, active, sort_order
       FROM gifts_catalog WHERE id = ? AND wedding_key = ?`
    )
    .bind(giftId, key)
    .first();

  const next = {
    name: d.name ?? row.name,
    description: d.description ?? row.description,
    price_in_cents: d.priceInCents ?? row.price_in_cents,
    image_url: d.imageUrl ?? row.image_url,
    image_data:
      d.imageData !== undefined
        ? d.imageData
        : d.imageUrl !== undefined
          ? null
          : row.image_data,
    mode: d.mode ?? row.mode,
    active: d.active !== undefined ? (d.active ? 1 : 0) : row.active,
    sort_order: d.sortOrder ?? row.sort_order,
  };

  await db
    .prepare(
      `UPDATE gifts_catalog
       SET name = ?, description = ?, price_in_cents = ?, image_url = ?, image_data = ?,
           mode = ?, active = ?, sort_order = ?, updated_at = ?
       WHERE id = ? AND wedding_key = ?`
    )
    .bind(
      next.name,
      next.description,
      next.price_in_cents,
      next.image_url,
      next.image_data,
      next.mode,
      next.active,
      next.sort_order,
      now,
      giftId,
      key
    )
    .run();

  return rowToGift({ ...next, id: giftId, updated_at: now });
}

export async function deleteGift(db, giftId, weddingKey = DEFAULT_WEDDING_KEY) {
  if (!giftId || typeof giftId !== 'string') throw new Error('INVALID_GIFT_ID');
  const key = resolveWeddingKey(weddingKey);

  if (!db) {
    const mem = ensureMemoryCatalog(key);
    const idx = mem.findIndex((g) => g.id === giftId);
    if (idx < 0) throw new Error('GIFT_NOT_FOUND');
    mem.splice(idx, 1);
    return { id: giftId, removed: true };
  }

  const result = await db
    .prepare(`DELETE FROM gifts_catalog WHERE id = ? AND wedding_key = ?`)
    .bind(giftId, key)
    .run();
  const changes = Number(result?.meta?.changes ?? result?.changes ?? 0);
  if (changes === 0) throw new Error('GIFT_NOT_FOUND');
  return { id: giftId, removed: true };
}

export function getGiftFromCatalog(catalog, giftId) {
  return catalog.find((g) => g.id === giftId) || null;
}

export function calculateTotalFromCatalog(items, catalog) {
  let total = 0;
  for (const item of items || []) {
    if (!item || typeof item !== 'object') continue;
    const { giftId, quantity } = item;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) continue;
    const gift = getGiftFromCatalog(catalog, giftId);
    if (!gift) continue;
    total += gift.priceInCents * quantity;
  }
  return total;
}
