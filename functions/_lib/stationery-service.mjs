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
import { PARTNER_ACCOUNT_ID } from './auth-service.mjs';
import { insertRetryOnForeignOwner } from './unique-row.mjs';

/** @type {Map<string, Array>} */
let memoryStationery = new Map();

function requireAccountId(accountId) {
  if (!accountId || typeof accountId !== 'string') {
    throw new Error('ACCOUNT_ID_REQUIRED');
  }
  return accountId;
}

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

function seedMemoryFromStatic() {
  return STATIONERY_TEMPLATES.map((t, i) => ({
    id: t.id,
    title: t.title,
    body: t.body,
    kind: t.kind || 'whatsapp',
    active: true,
    sortOrder: i,
    updatedAt: null,
  }));
}

function ensureMemoryStationery(accountId) {
  const id = requireAccountId(accountId);
  if (!memoryStationery.has(id)) {
    memoryStationery.set(id, id === PARTNER_ACCOUNT_ID ? seedMemoryFromStatic() : []);
  }
  return memoryStationery.get(id);
}

export function resetMemoryStationeryForTests() {
  memoryStationery = new Map();
}

export async function seedStationeryIfEmpty(db, accountId) {
  const id = requireAccountId(accountId);
  if (!db) return { seeded: false, count: ensureMemoryStationery(id).length };
  const countRow = await db
    .prepare(`SELECT COUNT(*) AS c FROM stationery_templates WHERE account_id = ?`)
    .bind(id)
    .first();
  const count = Number(countRow?.c || 0);
  if (count > 0) return { seeded: false, count };
  if (id !== PARTNER_ACCOUNT_ID) return { seeded: false, count: 0 };

  const now = new Date().toISOString();
  let i = 0;
  for (const t of STATIONERY_TEMPLATES) {
    await db
      .prepare(
        `INSERT INTO stationery_templates (
          id, title, body, kind, active, sort_order, updated_at, account_id
        ) VALUES (?, ?, ?, ?, 1, ?, ?, ?)`
      )
      .bind(t.id, t.title, t.body, t.kind || 'whatsapp', i++, now, id)
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

export async function getActiveStationery(db, accountId) {
  const id = requireAccountId(accountId);
  if (!db) {
    return ensureMemoryStationery(id)
      .filter((t) => t.active)
      .map((t) => ({ ...t }));
  }
  try {
    await seedStationeryIfEmpty(db, id);
    const rows = await db
      .prepare(
        `SELECT id, title, body, kind, active, sort_order, updated_at
         FROM stationery_templates
         WHERE active = 1 AND account_id = ?
         ORDER BY sort_order ASC, id ASC`
      )
      .bind(id)
      .all();
    const list = (rows?.results || []).map(rowToTemplate);
    if (list.length === 0 && id === PARTNER_ACCOUNT_ID) return staticActiveList();
    return list;
  } catch {
    return id === PARTNER_ACCOUNT_ID ? staticActiveList() : [];
  }
}

export async function listStationeryAdmin(db, accountId) {
  const id = requireAccountId(accountId);
  if (!db) {
    return [...ensureMemoryStationery(id)].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)
    );
  }
  await seedStationeryIfEmpty(db, id);
  const rows = await db
    .prepare(
      `SELECT id, title, body, kind, active, sort_order, updated_at
       FROM stationery_templates
       WHERE account_id = ?
       ORDER BY sort_order ASC, id ASC`
    )
    .bind(id)
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

export async function createStationeryTemplate(db, accountId, body) {
  const id = requireAccountId(accountId);
  const validation = validateStationeryCreate(body);
  if (!validation.valid) {
    const err = new Error('VALIDATION');
    err.details = validation.errors;
    throw err;
  }
  const d = validation.data;
  const now = new Date().toISOString();

  if (!db) {
    const mem = ensureMemoryStationery(id);
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

  const usedId = await insertRetryOnForeignOwner({
    id: d.id,
    accountId: id,
    existsError: 'TEMPLATE_EXISTS',
    insert: (templateId) =>
      db
        .prepare(
          `INSERT INTO stationery_templates (
          id, title, body, kind, active, sort_order, updated_at, account_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(templateId, d.title, d.body, d.kind, d.active ? 1 : 0, d.sortOrder, now, id)
        .run(),
    selectOwnerAccountId: async (templateId) => {
      const row = await db
        .prepare('SELECT account_id FROM stationery_templates WHERE id = ?')
        .bind(templateId)
        .first();
      return row?.account_id || null;
    },
  });

  return rowToTemplate({
    id: usedId,
    title: d.title,
    body: d.body,
    kind: d.kind,
    active: d.active ? 1 : 0,
    sort_order: d.sortOrder,
    updated_at: now,
  });
}

export async function updateStationeryTemplate(db, accountId, templateId, patch) {
  const id = requireAccountId(accountId);
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
    const mem = ensureMemoryStationery(id);
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
    .prepare(`SELECT id FROM stationery_templates WHERE id = ? AND account_id = ?`)
    .bind(templateId, id)
    .first();
  if (!existing) throw new Error('TEMPLATE_NOT_FOUND');

  const row = await db
    .prepare(
      `SELECT id, title, body, kind, active, sort_order
       FROM stationery_templates WHERE id = ? AND account_id = ?`
    )
    .bind(templateId, id)
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
       WHERE id = ? AND account_id = ?`
    )
    .bind(next.title, next.body, next.kind, next.active, next.sort_order, now, templateId, id)
    .run();

  return rowToTemplate({ ...next, id: templateId, updated_at: now });
}

export async function deleteStationeryTemplate(db, accountId, templateId) {
  const id = requireAccountId(accountId);
  if (!templateId || typeof templateId !== 'string') throw new Error('INVALID_ID');

  if (!db) {
    const mem = ensureMemoryStationery(id);
    const idx = mem.findIndex((t) => t.id === templateId);
    if (idx < 0) throw new Error('TEMPLATE_NOT_FOUND');
    mem.splice(idx, 1);
    return { id: templateId, removed: true };
  }

  const result = await db
    .prepare(`DELETE FROM stationery_templates WHERE id = ? AND account_id = ?`)
    .bind(templateId, id)
    .run();
  const changes = Number(result?.meta?.changes ?? result?.changes ?? 0);
  if (changes === 0) throw new Error('TEMPLATE_NOT_FOUND');
  return { id: templateId, removed: true };
}
