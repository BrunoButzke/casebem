/**
 * Lodging tips (hospedagem/dicas) — D1 + static seed/fallback.
 * Cloudflare Free — no paid storage.
 */

import { LODGING_TIPS } from '../../data/lodging-tips.mjs';
import { WEDDING_KEY as DEFAULT_WEDDING_KEY } from './messages-validators.mjs';

function resolveWeddingKey(weddingKey) {
  const k = String(weddingKey || DEFAULT_WEDDING_KEY).trim();
  return k || DEFAULT_WEDDING_KEY;
}

/** @type {Map<string, object[]>} */
let memoryLodgingByWedding = new Map();

function rowToTip(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    area: row.area || '',
    mapsUrl: row.maps_url || '',
    websiteUrl: row.website_url || '',
    active: row.active === undefined ? true : Boolean(row.active),
    sortOrder: row.sort_order ?? 0,
    updatedAt: row.updated_at || null,
  };
}

function staticActiveLodgingFallback() {
  return LODGING_TIPS.map((t, i) => ({
    ...t,
    active: true,
    sortOrder: i,
    updatedAt: null,
  }));
}

function ensureMemoryLodging(weddingKey = DEFAULT_WEDDING_KEY) {
  const key = resolveWeddingKey(weddingKey);
  if (!memoryLodgingByWedding.has(key)) {
    const list =
      key === DEFAULT_WEDDING_KEY
        ? LODGING_TIPS.map((t, i) => ({
            ...t,
            active: true,
            sortOrder: i,
            updatedAt: null,
          }))
        : [];
    memoryLodgingByWedding.set(key, list);
  }
  return memoryLodgingByWedding.get(key);
}

export function resetMemoryLodgingForTests() {
  memoryLodgingByWedding = new Map();
}

export function slugifyLodgingId(name) {
  const base = String(name || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  return base || 'dica';
}

export async function seedLodgingIfEmpty(db, weddingKey = DEFAULT_WEDDING_KEY) {
  const key = resolveWeddingKey(weddingKey);
  if (!db) {
    return { seeded: false, count: ensureMemoryLodging(key).length };
  }
  if (key !== DEFAULT_WEDDING_KEY) {
    const countRow = await db
      .prepare(`SELECT COUNT(*) AS c FROM lodging_tips WHERE wedding_key = ?`)
      .bind(key)
      .first();
    return { seeded: false, count: Number(countRow?.c || 0) };
  }
  const countRow = await db
    .prepare(`SELECT COUNT(*) AS c FROM lodging_tips WHERE wedding_key = ?`)
    .bind(key)
    .first();
  const count = Number(countRow?.c || 0);
  if (count > 0) return { seeded: false, count };

  const now = new Date().toISOString();
  let i = 0;
  for (const tip of LODGING_TIPS) {
    await db
      .prepare(
        `INSERT INTO lodging_tips (
          id, wedding_key, name, description, area, maps_url, website_url, active, sort_order, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
      )
      .bind(
        tip.id,
        key,
        tip.name,
        tip.description,
        tip.area || '',
        tip.mapsUrl || '',
        tip.websiteUrl || '',
        i++,
        now
      )
      .run();
  }
  return { seeded: true, count: LODGING_TIPS.length };
}

/**
 * Active tips for public site. Falls back to static if D1 empty/unavailable (default tenant only).
 */
export async function getActiveLodging(db, weddingKey = DEFAULT_WEDDING_KEY) {
  const key = resolveWeddingKey(weddingKey);
  if (!db) {
    return ensureMemoryLodging(key)
      .filter((t) => t.active)
      .map((t) => ({ ...t }));
  }

  try {
    await seedLodgingIfEmpty(db, key);
    const rows = await db
      .prepare(
        `SELECT id, name, description, area, maps_url, website_url, active, sort_order, updated_at
         FROM lodging_tips
         WHERE wedding_key = ? AND active = 1
         ORDER BY sort_order ASC, id ASC`
      )
      .bind(key)
      .all();
    const list = (rows?.results || []).map(rowToTip);
    if (list.length === 0 && key === DEFAULT_WEDDING_KEY) return staticActiveLodgingFallback();
    return list;
  } catch {
    if (key === DEFAULT_WEDDING_KEY) return staticActiveLodgingFallback();
    return [];
  }
}

export async function listLodgingAdmin(db, weddingKey = DEFAULT_WEDDING_KEY) {
  const key = resolveWeddingKey(weddingKey);
  if (!db) {
    return [...ensureMemoryLodging(key)].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)
    );
  }
  try {
    await seedLodgingIfEmpty(db, key);
    const rows = await db
      .prepare(
        `SELECT id, name, description, area, maps_url, website_url, active, sort_order, updated_at
         FROM lodging_tips
         WHERE wedding_key = ?
         ORDER BY sort_order ASC, id ASC`
      )
      .bind(key)
      .all();
    return (rows?.results || []).map(rowToTip);
  } catch (err) {
    const { isMissingWeddingKeyColumn } = await import('./d1-compat.mjs');
    if (!isMissingWeddingKeyColumn(err) || key !== DEFAULT_WEDDING_KEY) throw err;
    const rows = await db
      .prepare(
        `SELECT id, name, description, area, maps_url, website_url, active, sort_order, updated_at
         FROM lodging_tips
         ORDER BY sort_order ASC, id ASC`
      )
      .all();
    return (rows?.results || []).map(rowToTip);
  }
}

function validateUrlField(value, field, errors, out, { allowEmpty = true } = {}) {
  if (value === undefined) return;
  const url = String(value || '').trim();
  if (!url) {
    if (allowEmpty) out[field] = '';
    else errors.push(`${field} obrigatório`);
    return;
  }
  if (!url.startsWith('https://') && !url.startsWith('http://')) {
    errors.push(`${field} deve ser http(s)://`);
  } else if (url.length > 500) {
    errors.push(`${field} longa demais`);
  } else {
    out[field] = url;
  }
}

export function validateLodgingCreate(body) {
  const errors = [];
  const out = {};

  const name = String(body?.name || '').trim();
  if (name.length < 2 || name.length > 120) errors.push('name inválido');
  else out.name = name;

  const description = String(body?.description || '').trim();
  if (description.length < 2 || description.length > 500) errors.push('description inválida');
  else out.description = description;

  const area = String(body?.area ?? '').trim();
  if (area.length > 80) errors.push('area longa demais');
  else out.area = area;

  validateUrlField(body?.mapsUrl, 'mapsUrl', errors, out);
  validateUrlField(body?.websiteUrl, 'websiteUrl', errors, out);

  if (body?.sortOrder !== undefined) {
    const sortOrder = Number(body.sortOrder);
    if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 10000) {
      errors.push('sortOrder inválido');
    } else out.sortOrder = sortOrder;
  } else {
    out.sortOrder = 0;
  }

  if (body?.id !== undefined) {
    const id = String(body.id || '')
      .trim()
      .toLowerCase();
    if (!/^[a-z0-9-]{2,40}$/.test(id)) errors.push('id inválido (a-z0-9-, 2–40)');
    else out.id = id;
  }

  return { valid: errors.length === 0, errors, data: out };
}

export function validateLodgingPatch(body) {
  const errors = [];
  const out = {};

  if (body.name !== undefined) {
    const name = String(body.name || '').trim();
    if (name.length < 2 || name.length > 120) errors.push('name inválido');
    else out.name = name;
  }
  if (body.description !== undefined) {
    const description = String(body.description || '').trim();
    if (description.length < 2 || description.length > 500) errors.push('description inválida');
    else out.description = description;
  }
  if (body.area !== undefined) {
    const area = String(body.area || '').trim();
    if (area.length > 80) errors.push('area longa demais');
    else out.area = area;
  }
  if (body.mapsUrl !== undefined) validateUrlField(body.mapsUrl, 'mapsUrl', errors, out);
  if (body.websiteUrl !== undefined) validateUrlField(body.websiteUrl, 'websiteUrl', errors, out);
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

export async function createLodgingTip(db, body, weddingKey = DEFAULT_WEDDING_KEY) {
  const key = resolveWeddingKey(weddingKey);
  const validation = validateLodgingCreate(body);
  if (!validation.valid) {
    const err = new Error('VALIDATION');
    err.details = validation.errors;
    throw err;
  }
  const d = validation.data;
  let id = d.id || slugifyLodgingId(d.name);
  const now = new Date().toISOString();

  if (!db) {
    const mem = ensureMemoryLodging(key);
    if (mem.some((t) => t.id === id)) {
      id = `${id.slice(0, 28)}-${Math.random().toString(36).slice(2, 6)}`;
    }
    const tip = {
      id,
      name: d.name,
      description: d.description,
      area: d.area || '',
      mapsUrl: d.mapsUrl || '',
      websiteUrl: d.websiteUrl || '',
      active: true,
      sortOrder: d.sortOrder ?? 0,
      updatedAt: now,
    };
    mem.push(tip);
    return tip;
  }

  const existing = await db
    .prepare(`SELECT id FROM lodging_tips WHERE id = ? AND wedding_key = ?`)
    .bind(id, key)
    .first();
  if (existing) {
    id = `${id.slice(0, 28)}-${Math.random().toString(36).slice(2, 6)}`;
  }

  await db
    .prepare(
      `INSERT INTO lodging_tips (
        id, wedding_key, name, description, area, maps_url, website_url, active, sort_order, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
    )
    .bind(
      id,
      key,
      d.name,
      d.description,
      d.area || '',
      d.mapsUrl || '',
      d.websiteUrl || '',
      d.sortOrder ?? 0,
      now
    )
    .run();

  return rowToTip({
    id,
    name: d.name,
    description: d.description,
    area: d.area || '',
    maps_url: d.mapsUrl || '',
    website_url: d.websiteUrl || '',
    active: 1,
    sort_order: d.sortOrder ?? 0,
    updated_at: now,
  });
}

export async function updateLodgingTip(db, tipId, patch, weddingKey = DEFAULT_WEDDING_KEY) {
  if (!tipId || typeof tipId !== 'string') throw new Error('INVALID_TIP_ID');
  const key = resolveWeddingKey(weddingKey);

  if (!db) {
    const mem = ensureMemoryLodging(key);
    const t = mem.find((x) => x.id === tipId);
    if (!t) throw new Error('TIP_NOT_FOUND');
    const validation = validateLodgingPatch(patch);
    if (!validation.valid) {
      const err = new Error('VALIDATION');
      err.details = validation.errors;
      throw err;
    }
    const d = validation.data;
    if (Object.keys(d).length === 0) throw new Error('EMPTY_PATCH');
    const now = new Date().toISOString();
    if (d.name !== undefined) t.name = d.name;
    if (d.description !== undefined) t.description = d.description;
    if (d.area !== undefined) t.area = d.area;
    if (d.mapsUrl !== undefined) t.mapsUrl = d.mapsUrl;
    if (d.websiteUrl !== undefined) t.websiteUrl = d.websiteUrl;
    if (d.active !== undefined) t.active = d.active;
    if (d.sortOrder !== undefined) t.sortOrder = d.sortOrder;
    t.updatedAt = now;
    return { ...t };
  }

  const existing = await db
    .prepare(`SELECT id FROM lodging_tips WHERE id = ? AND wedding_key = ?`)
    .bind(tipId, key)
    .first();
  if (!existing) throw new Error('TIP_NOT_FOUND');

  const validation = validateLodgingPatch(patch);
  if (!validation.valid) {
    const err = new Error('VALIDATION');
    err.details = validation.errors;
    throw err;
  }
  const d = validation.data;
  if (Object.keys(d).length === 0) throw new Error('EMPTY_PATCH');

  const now = new Date().toISOString();
  const row = await db
    .prepare(
      `SELECT id, name, description, area, maps_url, website_url, active, sort_order
       FROM lodging_tips WHERE id = ? AND wedding_key = ?`
    )
    .bind(tipId, key)
    .first();

  const next = {
    name: d.name ?? row.name,
    description: d.description ?? row.description,
    area: d.area !== undefined ? d.area : row.area,
    maps_url: d.mapsUrl !== undefined ? d.mapsUrl : row.maps_url,
    website_url: d.websiteUrl !== undefined ? d.websiteUrl : row.website_url,
    active: d.active !== undefined ? (d.active ? 1 : 0) : row.active,
    sort_order: d.sortOrder ?? row.sort_order,
  };

  await db
    .prepare(
      `UPDATE lodging_tips
       SET name = ?, description = ?, area = ?, maps_url = ?, website_url = ?,
           active = ?, sort_order = ?, updated_at = ?
       WHERE id = ? AND wedding_key = ?`
    )
    .bind(
      next.name,
      next.description,
      next.area,
      next.maps_url,
      next.website_url,
      next.active,
      next.sort_order,
      now,
      tipId,
      key
    )
    .run();

  return rowToTip({ ...next, id: tipId, updated_at: now });
}