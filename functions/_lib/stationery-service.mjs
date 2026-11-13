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

let memoryStationery = null;

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

function ensureMemoryStationery() {
  if (!memoryStationery) {
    memoryStationery = STATIONERY_TEMPLATES.map((t, i) => ({
      id: t.id,
      title: t.title,
      body: t.body,
      kind: t.kind || 'whatsapp',
      active: true,
      sortOrder: i,
      updatedAt: null,
    }));
  }
  return memoryStationery;
}

export function resetMemoryStationeryForTests() {
  memoryStationery = null;
}

export async function seedStationeryIfEmpty(db) {
  if (!db) return { seeded: false, count: ensureMemoryStationery().length };
  const countRow = await db.prepare(`SELECT COUNT(*) AS c FROM stationery_templates`).first();
  const count = Number(countRow?.c || 0);
  if (count > 0) return { seeded: false, count };

  const now = new Date().toISOString();
  let i = 0;
  for (const t of STATIONERY_TEMPLATES) {
    await db
      .prepare(
        `INSERT INTO stationery_templates (
          id, title, body, kind, active, sort_order, updated_at
        ) VALUES (?, ?, ?, ?, 1, ?, ?)`
      )
      .bind(t.id, t.title, t.body, t.kind || 'whatsapp', i++, now)
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

export async function getActiveStationery(db) {
  if (!db) {
    return ensureMemoryStationery()
      .filter((t) => t.active)
      .map((t) => ({ ...t }));
  }
  try {
    await seedStationeryIfEmpty(db);
    const rows = await db
      .prepare(
        `SELECT id, title, body, kind, active, sort_order, updated_at
         FROM stationery_templates
         WHERE active = 1
         ORDER BY sort_order ASC, id ASC`
      )
      .all();
    const list = (rows?.results || []).map(rowToTemplate);
    return list.length === 0 ? staticActiveList() : list;
  } catch {
    return staticActiveList();
  }
}

export async function listStationeryAdmin(db) {
  if (!db) {
    return [...ensureMemoryStationery()].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)
    );
  }
  await seedStationeryIfEmpty(db);
  const rows = await db
    .prepare(
      `SELECT id, title, body, kind, active, sort_order, updated_at
       FROM stationery_templates
       ORDER BY sort_order ASC, id ASC`
    )
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

export async function createStationeryTemplate(db, body) {
  const validation = validateStationeryCreate(body);
  if (!validation.valid) {
    const err = new Error('VALIDATION');
    err.details = validation.errors;
    throw err;
  }
  const d = validation.data;
  const now = new Date().toISOString();

  if (!db) {
    const mem = ensureMemoryStationery();
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
          id, title, body, kind, active, sort_order, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(d.id, d.title, d.body, d.kind, d.active ? 1 : 0, d.sortOrder, now)
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

export async function updateStationeryTemplate(db, templateId, patch) {
  if (!templateId || typeof templateId !== 'string') throw new Error('INVALID_ID');

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
    const mem = ensureMemoryStationery();
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
    .prepare(`SELECT id FROM stationery_templates WHERE id = ?`)
    .bind(templateId)
    .first();
  if (!existing) throw new Error('TEMPLATE_NOT_FOUND');

  const row = await db
    .prepare(
      `SELECT id, title, body, kind, active, sort_order
       FROM stationery_templates WHERE id = ?`
    )
    .bind(templateId)
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
       WHERE id = ?`
    )
    .bind(next.title, next.body, next.kind, next.active, next.sort_order, now, templateId)
    .run();

  return rowToTemplate({ ...next, id: templateId, updated_at: now });
}

export async function deleteStationeryTemplate(db, templateId) {
  if (!templateId || typeof templateId !== 'string') throw new Error('INVALID_ID');

  if (!db) {
    const mem = ensureMemoryStationery();
    const idx = mem.findIndex((t) => t.id === templateId);
    if (idx < 0) throw new Error('TEMPLATE_NOT_FOUND');
    mem.splice(idx, 1);
    return { id: templateId, removed: true };
  }

  const result = await db
    .prepare(`DELETE FROM stationery_templates WHERE id = ?`)
    .bind(templateId)
    .run();
  const changes = Number(result?.meta?.changes ?? result?.changes ?? 0);
  if (changes === 0) throw new Error('TEMPLATE_NOT_FOUND');
  return { id: templateId, removed: true };
}
