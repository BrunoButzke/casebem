/**
 * Gifts catalog backed by D1, seeded from static module.
 * Cloudflare Free — no paid storage.
 */

import { GIFTS_CATALOG } from '../../data/gifts-catalog.mjs';

function rowToGift(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    priceInCents: row.price_in_cents,
    imageUrl: row.image_url,
    mode: row.mode,
    active: row.active === undefined ? true : Boolean(row.active),
    sortOrder: row.sort_order ?? 0,
    updatedAt: row.updated_at || null,
  };
}

export async function seedCatalogIfEmpty(db) {
  const countRow = await db
    .prepare(`SELECT COUNT(*) AS c FROM gifts_catalog`)
    .first();
  const count = Number(countRow?.c || 0);
  if (count > 0) return { seeded: false, count };

  const now = new Date().toISOString();
  let i = 0;
  for (const gift of GIFTS_CATALOG) {
    await db
      .prepare(
        `INSERT INTO gifts_catalog (
          id, name, description, price_in_cents, image_url, mode, active, sort_order, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`
      )
      .bind(
        gift.id,
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
export async function getActiveCatalog(db) {
  if (!db) return GIFTS_CATALOG.map((g) => ({ ...g, active: true }));

  try {
    await seedCatalogIfEmpty(db);
    const rows = await db
      .prepare(
        `SELECT id, name, description, price_in_cents, image_url, mode, active, sort_order, updated_at
         FROM gifts_catalog
         WHERE active = 1
         ORDER BY sort_order ASC, id ASC`
      )
      .all();
    const list = (rows?.results || []).map(rowToGift);
    if (list.length === 0) return GIFTS_CATALOG.map((g) => ({ ...g, active: true }));
    return list;
  } catch {
    return GIFTS_CATALOG.map((g) => ({ ...g, active: true }));
  }
}

export async function listCatalogAdmin(db) {
  await seedCatalogIfEmpty(db);
  const rows = await db
    .prepare(
      `SELECT id, name, description, price_in_cents, image_url, mode, active, sort_order, updated_at
       FROM gifts_catalog
       ORDER BY sort_order ASC, id ASC`
    )
    .all();
  return (rows?.results || []).map(rowToGift);
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
    const imageUrl = String(body.imageUrl || '').trim();
    if (!imageUrl.startsWith('/') && !imageUrl.startsWith('https://')) {
      errors.push('imageUrl deve ser path /... ou https://');
    } else if (imageUrl.length > 300) errors.push('imageUrl longa demais');
    else out.imageUrl = imageUrl;
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

export async function updateGift(db, giftId, patch) {
  if (!giftId || typeof giftId !== 'string') throw new Error('INVALID_GIFT_ID');
  const existing = await db
    .prepare(`SELECT id FROM gifts_catalog WHERE id = ?`)
    .bind(giftId)
    .first();
  if (!existing) throw new Error('GIFT_NOT_FOUND');

  const validation = validateGiftPatch(patch);
  if (!validation.valid) {
    const err = new Error('VALIDATION');
    err.details = validation.errors;
    throw err;
  }
  const d = validation.data;
  if (Object.keys(d).length === 0) throw new Error('EMPTY_PATCH');

  const now = new Date().toISOString();
  // Read-modify-write for simplicity (small catalog)
  const row = await db
    .prepare(
      `SELECT id, name, description, price_in_cents, image_url, mode, active, sort_order
       FROM gifts_catalog WHERE id = ?`
    )
    .bind(giftId)
    .first();

  const next = {
    name: d.name ?? row.name,
    description: d.description ?? row.description,
    price_in_cents: d.priceInCents ?? row.price_in_cents,
    image_url: d.imageUrl ?? row.image_url,
    mode: d.mode ?? row.mode,
    active: d.active !== undefined ? (d.active ? 1 : 0) : row.active,
    sort_order: d.sortOrder ?? row.sort_order,
  };

  await db
    .prepare(
      `UPDATE gifts_catalog
       SET name = ?, description = ?, price_in_cents = ?, image_url = ?,
           mode = ?, active = ?, sort_order = ?, updated_at = ?
       WHERE id = ?`
    )
    .bind(
      next.name,
      next.description,
      next.price_in_cents,
      next.image_url,
      next.mode,
      next.active,
      next.sort_order,
      now,
      giftId
    )
    .run();

  return rowToGift({ ...next, id: giftId, updated_at: now });
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
