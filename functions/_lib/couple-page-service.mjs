import { PARTNER_ACCOUNT_ID } from './auth-service.mjs';
import { PARTNER_PAGE_DEFAULT } from './partner-page-defaults.mjs';

/** @type {Map<string, object>} */
let memoryPages = new Map();

const STRING_LIMITS = {
  dateLine: 80,
  city: 80,
  welcomeTitle: 120,
  welcomeBody: 4000,
  story: 4000,
  venueName: 80,
  venuePlace: 120,
  dressTitle: 80,
  dressRule: 120,
};

const PUBLIC_STRING_KEYS = Object.keys(STRING_LIMITS).concat(['mapsHref']);

const SELECT_PAGE = `SELECT account_id, names_json, date_line, city, welcome_title, welcome_body, story,
  venue_name, venue_place, maps_href, dress_title, dress_rule, etapas_json, updated_at
FROM couple_pages WHERE account_id = ?`;

const UPSERT_PAGE = `INSERT INTO couple_pages (
  account_id, names_json, date_line, city, welcome_title, welcome_body, story,
  venue_name, venue_place, maps_href, dress_title, dress_rule, etapas_json, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(account_id) DO UPDATE SET
  names_json = excluded.names_json,
  date_line = excluded.date_line,
  city = excluded.city,
  welcome_title = excluded.welcome_title,
  welcome_body = excluded.welcome_body,
  story = excluded.story,
  venue_name = excluded.venue_name,
  venue_place = excluded.venue_place,
  maps_href = excluded.maps_href,
  dress_title = excluded.dress_title,
  dress_rule = excluded.dress_rule,
  etapas_json = excluded.etapas_json,
  updated_at = excluded.updated_at`;

function throwValidation(errors) {
  const err = new Error('VALIDATION');
  err.details = errors;
  throw err;
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function emptyCouplePage() {
  return {
    names: [],
    dateLine: '',
    city: '',
    welcomeTitle: '',
    welcomeBody: '',
    story: '',
    venueName: '',
    venuePlace: '',
    mapsHref: '',
    dressTitle: '',
    dressRule: '',
    etapas: [],
  };
}

export function toPublicPage(row) {
  if (!row) return emptyCouplePage();
  return {
    names: parseJsonArray(row.names ?? row.names_json),
    dateLine: String(row.dateLine ?? row.date_line ?? ''),
    city: String(row.city ?? ''),
    welcomeTitle: String(row.welcomeTitle ?? row.welcome_title ?? ''),
    welcomeBody: String(row.welcomeBody ?? row.welcome_body ?? ''),
    story: String(row.story ?? ''),
    venueName: String(row.venueName ?? row.venue_name ?? ''),
    venuePlace: String(row.venuePlace ?? row.venue_place ?? ''),
    mapsHref: String(row.mapsHref ?? row.maps_href ?? ''),
    dressTitle: String(row.dressTitle ?? row.dress_title ?? ''),
    dressRule: String(row.dressRule ?? row.dress_rule ?? ''),
    etapas: parseJsonArray(row.etapas ?? row.etapas_json).map((item) => ({
      title: String(item?.title ?? ''),
      detail: String(item?.detail ?? ''),
    })),
  };
}

export function fillPartnerDefaults(page, accountId) {
  const publicPage = toPublicPage(page);
  if (accountId !== PARTNER_ACCOUNT_ID) return publicPage;
  const filled = { ...publicPage };
  for (const key of PUBLIC_STRING_KEYS) {
    if (!filled[key]) filled[key] = PARTNER_PAGE_DEFAULT[key];
  }
  if (!filled.names.length) filled.names = [...PARTNER_PAGE_DEFAULT.names];
  if (!filled.etapas.length) {
    filled.etapas = PARTNER_PAGE_DEFAULT.etapas.map((item) => ({ ...item }));
  }
  return filled;
}

export function resetMemoryCouplePagesForTests() {
  memoryPages = new Map();
}

function validatePatch(patch) {
  const errors = [];
  const data = {};
  const body = patch && typeof patch === 'object' ? patch : {};

  if (body.names !== undefined) {
    if (!Array.isArray(body.names) || body.names.length > 2) {
      errors.push('names inválido');
    } else {
      const names = [];
      for (const item of body.names) {
        const name = String(item ?? '').trim();
        if (name.length < 1 || name.length > 40) errors.push('names inválido');
        else names.push(name);
      }
      data.names = names;
    }
  }

  for (const [key, max] of Object.entries(STRING_LIMITS)) {
    if (body[key] === undefined) continue;
    const value = String(body[key] ?? '').trim();
    if (value.length > max) errors.push(`${key} inválido`);
    else data[key] = value;
  }

  if (body.mapsHref !== undefined) {
    const mapsHref = String(body.mapsHref ?? '').trim();
    if (mapsHref && (!/^https?:\/\//i.test(mapsHref) || mapsHref.length > 500)) {
      errors.push('mapsHref inválido');
    } else {
      data.mapsHref = mapsHref;
    }
  }

  if (body.etapas !== undefined) {
    if (!Array.isArray(body.etapas) || body.etapas.length > 8) {
      errors.push('etapas inválidas');
    } else {
      const etapas = [];
      for (const item of body.etapas) {
        const title = String(item?.title ?? '').trim();
        const detail = String(item?.detail ?? '').trim();
        if (title.length < 1 || title.length > 80) errors.push('etapas inválidas');
        else if (detail.length > 200) errors.push('etapas inválidas');
        else etapas.push({ title, detail });
      }
      data.etapas = etapas;
    }
  }

  if (errors.length) throwValidation(errors);
  return data;
}

async function readStoredPage(db, accountId) {
  if (!db) return toPublicPage(memoryPages.get(accountId));
  const row = await db.prepare(SELECT_PAGE).bind(accountId).first();
  return toPublicPage(row);
}

async function persistPage(db, accountId, page) {
  if (!db) {
    memoryPages.set(accountId, { ...page, names: [...page.names], etapas: page.etapas.map((item) => ({ ...item })) });
    return;
  }
  const now = new Date().toISOString();
  await db
    .prepare(UPSERT_PAGE)
    .bind(
      accountId,
      JSON.stringify(page.names),
      page.dateLine,
      page.city,
      page.welcomeTitle,
      page.welcomeBody,
      page.story,
      page.venueName,
      page.venuePlace,
      page.mapsHref,
      page.dressTitle,
      page.dressRule,
      JSON.stringify(page.etapas),
      now
    )
    .run();
}

export async function getCouplePage(db, accountId) {
  const stored = await readStoredPage(db, accountId);
  return fillPartnerDefaults(stored, accountId);
}

export async function saveCouplePage(db, accountId, patch) {
  const data = validatePatch(patch);
  const current = await readStoredPage(db, accountId);
  const next = { ...current, ...data };
  await persistPage(db, accountId, next);
  return fillPartnerDefaults(next, accountId);
}
