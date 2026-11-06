/**
 * Papelaria digital — templates WhatsApp (D1 + seed Free-tier).
 */

import {
  STATIONERY_TEMPLATES,
  STATIONERY_DEFAULTS,
  fillStationeryPlaceholders,
  whatsappShareUrl,
} from '../../data/stationery-templates.mjs';

function rowToTemplate(row) {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    kind: row.kind || 'whatsapp',
    active: row.active === undefined ? true : Boolean(row.active),
    sortOrder: row.sort_order ?? 0,
    updatedAt: row.updated_at || null,
  };
}

export async function seedStationeryIfEmpty(db) {
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
  if (!db) return staticActiveList();
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
 * @param {object[]} templates
 * @param {string} siteOrigin e.g. https://casebem.com
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

export async function updateStationeryTemplate(db, templateId, patch) {
  if (!templateId || typeof templateId !== 'string') throw new Error('INVALID_ID');
  const existing = await db
    .prepare(`SELECT id FROM stationery_templates WHERE id = ?`)
    .bind(templateId)
    .first();
  if (!existing) throw new Error('TEMPLATE_NOT_FOUND');

  const validation = validateStationeryPatch(patch);
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
