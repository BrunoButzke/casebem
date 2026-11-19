/**
 * Papelaria digital — templates WhatsApp (D1 + seed Free-tier + memory Vite).
 */

import {
  STATIONERY_TEMPLATES,
  STATIONERY_DEFAULTS,
  fillStationeryPlaceholders,
  whatsappShareUrl,
} from '../../data/stationery-templates.mjs';
import { slugifyId } from './catalog-service.mjs';
import { WEDDING_KEY as DEFAULT_WEDDING_KEY } from './messages-validators.mjs';

function resolveWeddingKey(weddingKey) {
  const k = String(weddingKey || DEFAULT_WEDDING_KEY).trim();
  return k || DEFAULT_WEDDING_KEY;
}

/** @type {Map<string, object[]>} */
let memoryStationeryByWedding = new Map();

function rowToTemplate(row) {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    kind: row.kind || 'whatsapp',
    active: row.active === undefined ? true : Boolean(Number(row.active)),
    sortOrder: row.sort_order ?? row.sortOrder ?? 0,
    updatedAt: row.updated_at ?? row.updatedAt ?? null,
  };
}

function ensureMemoryStationery(weddingKey = DEFAULT_WEDDING_KEY) {
  const key = resolveWeddingKey(weddingKey);
  if (!memoryStationeryByWedding.has(key)) {
    const list =
      key === DEFAULT_WEDDING_KEY
        ? STATIONERY_TEMPLATES.map((t, i) => ({
            id: t.id,
            title: t.title,
            body: t.body,
            kind: t.kind || 'whatsapp',
            active: true,
            sortOrder: i,
            updatedAt: null,
          }))
        : [];
    memoryStationeryByWedding.set(key, list);
  }
  return memoryStationeryByWedding.get(key);
}

export function resetMemoryStationeryForTests() {
  memoryStationeryByWedding = new Map();
}

export async function seedStationeryIfEmpty(db, weddingKey = DEFAULT_WEDDING_KEY) {
  const key = resolveWeddingKey(weddingKey);
  if (!db) {
    return { seeded: false, count: ensureMemoryStationery(key).length };
  }
  if (key !== DEFAULT_WEDDING_KEY) {
    const countRow = await db
      .prepare(`SELECT COUNT(*) AS c FROM stationery_templates WHERE wedding_key = ?`)
      .bind(key)
      .first();
    return { seeded: false, count: Number(countRow?.c || 0) };
  }
  const countRow = await db
    .prepare(`SELECT COUNT(*) AS c FROM stationery_templates WHERE wedding_key = ?`)
    .bind(key)
    .first();
  const count = Number(countRow?.c || 0);
  if (count > 0) return { seeded: false, count };

  const now = new Date().toISOString();
  let i = 0;
  for (const t of STATIONERY_TEMPLATES) {
    await db
      .prepare(
        `INSERT INTO stationery_templates (
          id, wedding_key, title, body, kind, active, sort_order, updated_at
        ) VALUES (?, ?, ?, ?, ?, 1, ?, ?)`
      )
      .bind(t.id, key, t.title, t.body, t.kind || 'whatsapp', i++, now)
      .run();
  }
  return { seeded: true, count: STATIONERY_TEMPLATES.length };
}

function staticActiveList() {
  return STATIONERY_TEMPLATES.map((t, i) => ({
    ...t,
    active: true,
    sortOrder: i,
    updatedAt: null,
  }));
}

export async function getActiveStationery(db, weddingKey = DEFAULT_WEDDING_KEY) {
  const key = resolveWeddingKey(weddingKey);
  if (!db) {
    return ensureMemoryStationery(key)
      .filter((t) => t.active)
      .map((t) => ({ ...t }));
  }
  try {
    await seedStationeryIfEmpty(db, key);
    const rows = await db
      .prepare(
        `SELECT id, title, body, kind, active, sort_order, updated_at
         FROM stationery_templates
         WHERE wedding_key = ? AND active = 1
         ORDER BY sort_order ASC, id ASC`
      )
      .bind(key)
      .all();
    const list = (rows?.results || []).map(rowToTemplate);
    if (list.length === 0 && key === DEFAULT_WEDDING_KEY) return staticActiveList();
    return list;
  } catch {
    if (key === DEFAULT_WEDDING_KEY) return staticActiveList();
    return [];
  }
}

export async function listStationeryAdmin(db, weddingKey = DEFAULT_WEDDING_KEY) {
  const key = resolveWeddingKey(weddingKey);
  if (!db) {
    return [...ensureMemoryStationery(key)].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)
    );
  }
  await seedStationeryIfEmpty(db, key);
  const rows = await db
    .prepare(
      `SELECT id, title, body, kind, active, sort_order, updated_at
       FROM stationery_templates
       WHERE wedding_key = ?
       ORDER BY sort_order ASC, id ASC`
    )
    .bind(key)
    .all();
  return (rows?.results || []).map(rowToTemplate);
}

/**
 * Resolve placeholders + WhatsApp URL for public/admin preview.
 */
export function presentStationery(templates, siteOrigin) {
  const base = String(siteOrigin || 'https://casebem.com').replace(/\/$/, '');
  const url = `${base}${STATIONERY_DEFAULTS.urlPath}`;
  const vars = {
    names: STATIONERY_DEFAULTS.names,
    date: STATIONERY_DEFAULTS.date,
    place: STATIONERY_DEFAULTS.place,
    url,
  };

  return templates.map((t) => {
    const text = fillStationeryPlaceholders(t.body, vars);
    return {
      id: t.id,
      title: t.title,
      kind: t.kind,
      body: t.body,
      text,
      shareUrl: t.kind === 'whatsapp' ? whatsappShareUrl(text) : null,
      active: t.active,
      sortOrder: t.sortOrder,
      updatedAt: t.updatedAt ?? null,
    };
  });
}

export function validateStationeryPatch(body) {
  const errors = [];
  const out = {};

  if (body.title !== undefined) {
    const title = String(body.title || '').trim();
    if (title.length < 2 || title.length > 120) errors.push('title inválido');
    else out.title = title;
  }
  if (body.body !== undefined) {
    const text = String(body.body || '').trim();
    if (text.length < 2 || text.length > 1000) errors.push('body inválido');
    else out.body = text;
  }
  if (body.kind !== undefined) {
    if (body.kind !== 'whatsapp' && body.kind !== 'copy') errors.push('kind inválido');
    else out.kind = body.kind;
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

export function validateStationeryCreate(body) {
  const title = String(body?.title || '').trim();
  const text = String(body?.body || '').trim();
  const kind = body?.kind === 'copy' ? 'copy' : 'whatsapp';
  const idRaw = body?.id != null ? String(body.id).trim() : '';
  const id = idRaw || slugifyId(title);
  const errors = [];

  if (id.length < 2 || id.length > 40 || !/^[a-z0-9][a-z0-9-]*$/.test(id)) {
    errors.push('id inválido (a-z, 0-9, hífen)');
  }
  if (title.length < 2 || title.length > 120) errors.push('title inválido');
  if (text.length < 2 || text.length > 1000) errors.push('body inválido');

  return {
    valid: errors.length === 0,
    errors,
    data: {
      id,
      title,
      body: text,
      kind,
      active: body?.active !== false,
      sortOrder: Number.isInteger(Number(body?.sortOrder)) ? Number(body.sortOrder) : 0,
    },
  };
}

export async function createStationeryTemplate(db, body, weddingKey = DEFAULT_WEDDING_KEY) {
  const key = resolveWeddingKey(weddingKey);
  const validation = validateStationeryCreate(body);
  if (!validation.valid) {
    const err = new Error('VALIDATION');
    err.details = validation.errors;
    throw err;
  }
  const d = validation.data;
  const now = new Date().toISOString();

  if (!db) {
    const mem = ensureMemoryStationery(key);
    if (mem.some((t) => t.id === d.id)) throw new Error('TEMPLATE_EXISTS');
    const template = {
      id: d.id,
      title: d.title,
      body: d.body,
      kind: d.kind,
      active: d.active,
      sortOrder: d.sortOrder,
      updatedAt: now,
    };
    mem.push(template);
    return template;
  }

  try {
    await db
      .prepare(
        `INSERT INTO stationery_templates (
          id, wedding_key, title, body, kind, active, sort_order, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(d.id, key, d.title, d.body, d.kind, d.active ? 1 : 0, d.sortOrder, now)
      .run();
  } catch (err) {
    if (err?.message?.includes('UNIQUE') || err?.message?.includes('PRIMARY')) {
      throw new Error('TEMPLATE_EXISTS');
    }
    throw err;
  }

  return rowToTemplate({
    id: d.id,
    title: d.title,
    body: d.body,
    kind: d.kind,
    active: d.active ? 1 : 0,
    sort_order: d.sortOrder,
    updated_at: now,
  });
}

export async function updateStationeryTemplate(db, templateId, patch, weddingKey = DEFAULT_WEDDING_KEY) {
  if (!templateId || typeof templateId !== 'string') throw new Error('INVALID_ID');
  const key = resolveWeddingKey(weddingKey);

  const validation = validateStationeryPatch(patch);
  if (!validation.valid) {
    const err = new Error('VALIDATION');
    err.details = validation.errors;
    throw err;
  }
  const d = validation.data;
  if (Object.keys(d).length === 0) throw new Error('EMPTY_PATCH');
  const now = new Date().toISOString();

  if (!db) {
    const mem = ensureMemoryStationery(key);
    const t = mem.find((x) => x.id === templateId);
    if (!t) throw new Error('TEMPLATE_NOT_FOUND');
    if (d.title !== undefined) t.title = d.title;
    if (d.body !== undefined) t.body = d.body;
    if (d.kind !== undefined) t.kind = d.kind;
    if (d.active !== undefined) t.active = d.active;
    if (d.sortOrder !== undefined) t.sortOrder = d.sortOrder;
    t.updatedAt = now;
    return { ...t };
  }

  const existing = await db
    .prepare(`SELECT id FROM stationery_templates WHERE id = ? AND wedding_key = ?`)
    .bind(templateId, key)
    .first();
  if (!existing) throw new Error('TEMPLATE_NOT_FOUND');

  const row = await db
    .prepare(
      `SELECT id, title, body, kind, active, sort_order
       FROM stationery_templates WHERE id = ? AND wedding_key = ?`
    )
    .bind(templateId, key)
    .first();

  const next = {
    title: d.title ?? row.title,
    body: d.body ?? row.body,
    kind: d.kind ?? row.kind,
    active: d.active !== undefined ? (d.active ? 1 : 0) : row.active,
    sort_order: d.sortOrder ?? row.sort_order,
  };

  await db
    .prepare(
      `UPDATE stationery_templates
       SET title = ?, body = ?, kind = ?, active = ?, sort_order = ?, updated_at = ?
       WHERE id = ? AND wedding_key = ?`
    )
    .bind(next.title, next.body, next.kind, next.active, next.sort_order, now, templateId, key)
    .run();

  return rowToTemplate({ ...next, id: templateId, updated_at: now });
}

export async function deleteStationeryTemplate(db, templateId, weddingKey = DEFAULT_WEDDING_KEY) {
  if (!templateId || typeof templateId !== 'string') throw new Error('INVALID_ID');
  const key = resolveWeddingKey(weddingKey);

  if (!db) {
    const mem = ensureMemoryStationery(key);
    const idx = mem.findIndex((t) => t.id === templateId);
    if (idx < 0) throw new Error('TEMPLATE_NOT_FOUND');
    mem.splice(idx, 1);
    return { id: templateId, removed: true };
  }

  const result = await db
    .prepare(`DELETE FROM stationery_templates WHERE id = ? AND wedding_key = ?`)
    .bind(templateId, key)
    .run();
  const changes = Number(result?.meta?.changes ?? result?.changes ?? 0);
  if (changes === 0) throw new Error('TEMPLATE_NOT_FOUND');
  return { id: templateId, removed: true };
}
