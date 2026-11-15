import { hashPassword, verifyPassword, randomSaltB64 } from './password.mjs';
import { normalizeSlug, RESERVED_SLUGS, assertSlugFormat } from './slug.mjs';

export const PARTNER_ACCOUNT_ID = 'partner-dani-carine';
export const SESSION_COOKIE = 'cb_session';
export const SESSION_MAX_AGE_SEC = 1209600;

let processMemoryDb = null;

export function resolveDb(db) {
  if (db) return db;
  if (!processMemoryDb) processMemoryDb = new ProcessMemoryAuthDb();
  return processMemoryDb;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PLANS = new Set(['basic', 'pro', 'vip']);

export function publicAccount(row) {
  return {
    email: row.email,
    plan: row.plan,
    planStatus: row.plan_status,
    slug: row.slug ?? null,
    isPartner: Boolean(Number(row.is_partner)),
  };
}

export function sessionCookieHeader(sessionId, { secure } = {}) {
  let header = `${SESSION_COOKIE}=${sessionId}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE_SEC}`;
  if (secure) header += '; Secure';
  return header;
}

export function parseSessionCookie(cookieHeader) {
  if (!cookieHeader) return null;
  for (const part of String(cookieHeader).split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const name = part.slice(0, idx).trim();
    if (name === SESSION_COOKIE) return part.slice(idx + 1).trim();
  }
  return null;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function resolvePlan(plan) {
  if (plan == null || plan === '') return 'basic';
  if (!PLANS.has(plan)) throw new Error('INVALID_PLAN');
  return plan;
}

function planStatusFor(plan) {
  return plan === 'basic' ? 'active' : 'pending_payment';
}

function expiresAt(nowIso) {
  return new Date(Date.parse(nowIso) + SESSION_MAX_AGE_SEC * 1000).toISOString();
}

async function insertSession(db, accountId, nowIso) {
  const sessionId = crypto.randomUUID();
  await db
    .prepare('INSERT INTO sessions (id, account_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .bind(sessionId, accountId, expiresAt(nowIso), nowIso)
    .run();
  return sessionId;
}

async function selectAccountByEmail(db, email) {
  return db.prepare('SELECT * FROM accounts WHERE email = ?').bind(email).first();
}

async function selectAccountById(db, id) {
  return db.prepare('SELECT * FROM accounts WHERE id = ?').bind(id).first();
}

export async function signup(db, { email, password, plan }, nowIso) {
  db = resolveDb(db);
  const normalized = normalizeEmail(email);
  if (!EMAIL_RE.test(normalized)) throw new Error('INVALID_EMAIL');
  if (String(password || '').length < 8) throw new Error('PASSWORD_TOO_SHORT');
  const resolvedPlan = resolvePlan(plan);

  const existing = await selectAccountByEmail(db, normalized);
  if (existing) throw new Error('EMAIL_TAKEN');

  const id = crypto.randomUUID();
  const salt = randomSaltB64();
  const hash = await hashPassword(password, salt);
  const planStatus = planStatusFor(resolvedPlan);

  await db
    .prepare(
      `INSERT INTO accounts (id, email, password_hash, password_salt, plan, plan_status, slug, is_partner, created_at)
VALUES (?, ?, ?, ?, ?, ?, NULL, 0, ?)`
    )
    .bind(id, normalized, hash, salt, resolvedPlan, planStatus, nowIso)
    .run();

  const sessionId = await insertSession(db, id, nowIso);
  const row = {
    id,
    email: normalized,
    plan: resolvedPlan,
    plan_status: planStatus,
    slug: null,
    is_partner: 0,
  };
  return { account: publicAccount(row), sessionId, accountId: id };
}

export async function login(db, { email, password }, nowIso) {
  db = resolveDb(db);
  const normalized = normalizeEmail(email);
  const row = await selectAccountByEmail(db, normalized);
  if (!row || !(await verifyPassword(password, row.password_salt, row.password_hash))) {
    throw new Error('INVALID_CREDENTIALS');
  }
  const sessionId = await insertSession(db, row.id, nowIso);
  return { account: publicAccount(row), sessionId, accountId: row.id };
}

export async function logout(db, sessionId) {
  if (!sessionId) return;
  db = resolveDb(db);
  await db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
}

export async function getSessionAccount(db, sessionId, nowIso) {
  if (!sessionId) return null;
  db = resolveDb(db);
  const session = await db.prepare('SELECT * FROM sessions WHERE id = ?').bind(sessionId).first();
  if (!session) return null;
  if (session.expires_at < nowIso) return null;
  const row = await selectAccountById(db, session.account_id);
  if (!row) return null;
  return { ...publicAccount(row), id: row.id };
}

export async function upgradePlan(db, accountId, plan) {
  db = resolveDb(db);
  const resolvedPlan = resolvePlan(plan);
  const row = await selectAccountById(db, accountId);
  if (!row || row.plan !== 'basic') throw new Error('ACCOUNT_NOT_BASIC');
  const planStatus = planStatusFor(resolvedPlan);
  await db
    .prepare('UPDATE accounts SET plan = ?, plan_status = ? WHERE id = ?')
    .bind(resolvedPlan, planStatus, accountId)
    .run();
  return publicAccount({ ...row, plan: resolvedPlan, plan_status: planStatus });
}

export async function resolveAccountBySlug(db, slug) {
  if (!slug) return null;
  db = resolveDb(db);
  const row = await db.prepare('SELECT * FROM accounts WHERE slug = ?').bind(slug).first();
  if (!row) return null;
  return { ...row, isPartner: Boolean(Number(row.is_partner)) };
}

export async function setAccountSlug(db, accountId, slug) {
  db = resolveDb(db);
  await db.prepare('UPDATE accounts SET slug = ? WHERE id = ?').bind(slug, accountId).run();
  return resolveAccountBySlug(db, slug);
}

export async function claimAccountSlug(db, accountId, raw) {
  db = resolveDb(db);
  const row = await selectAccountById(db, accountId);
  if (!row) throw new Error('ACCOUNT_NOT_FOUND');
  const slug = normalizeSlug(raw);
  const isPartner = Boolean(Number(row.is_partner));
  if (isPartner) {
    if (slug !== 'dani-carine') throw new Error('SLUG_LOCKED');
    return { slug: 'dani-carine' };
  }
  assertSlugFormat(slug);
  if (RESERVED_SLUGS.has(slug)) throw new Error('SLUG_RESERVED');
  const taken = await resolveAccountBySlug(db, slug);
  if (taken && taken.id !== accountId) throw new Error('SLUG_TAKEN');
  await db.prepare('UPDATE accounts SET slug = ? WHERE id = ?').bind(slug, accountId).run();
  return { slug };
}

function compactSql(sql) {
  return String(sql).replace(/\s+/g, ' ').trim();
}

class ProcessMemoryAuthDb {
  constructor() {
    this.accounts = new Map();
    this.sessions = new Map();
  }

  prepare(sql) {
    return new ProcessMemoryAuthStatement(this, compactSql(sql));
  }

  findAccountById(id) {
    for (const row of this.accounts.values()) {
      if (row.id === id) return row;
    }
    return null;
  }

  findAccountBySlug(slug) {
    for (const row of this.accounts.values()) {
      if (row.slug === slug) return row;
    }
    return null;
  }
}

class ProcessMemoryAuthStatement {
  constructor(db, sql) {
    this.db = db;
    this.sql = sql;
    this.params = [];
  }

  bind(...params) {
    this.params = params;
    return this;
  }

  async first() {
    const { sql, params, db } = this;
    if (sql.includes('SELECT * FROM accounts WHERE email')) {
      return db.accounts.get(params[0]) ?? null;
    }
    if (sql.includes('SELECT * FROM accounts WHERE slug')) {
      return db.findAccountBySlug(params[0]);
    }
    if (sql.includes('SELECT * FROM accounts WHERE id')) {
      return db.findAccountById(params[0]);
    }
    if (sql.includes('SELECT * FROM sessions WHERE id')) {
      return db.sessions.get(params[0]) ?? null;
    }
    throw new Error(`ProcessMemoryAuthDb: unsupported first() SQL: ${sql}`);
  }

  async run() {
    const { sql, params, db } = this;
    if (sql.includes('INSERT INTO accounts')) {
      const [
        id,
        email,
        password_hash,
        password_salt,
        plan,
        plan_status,
        slugOrCreatedAt,
        maybePartner,
        maybeCreatedAt,
      ] = params;
      const partnerInsert = params.length >= 9;
      const occupant = db.accounts.get(email);
      if (occupant && occupant.id !== id) {
        throw new Error('UNIQUE constraint failed: accounts.email');
      }
      const row = {
        id,
        email,
        password_hash,
        password_salt,
        plan,
        plan_status,
        slug: partnerInsert ? slugOrCreatedAt : null,
        is_partner: partnerInsert ? maybePartner : 0,
        created_at: partnerInsert ? maybeCreatedAt : slugOrCreatedAt,
      };
      db.accounts.set(email, row);
      return { success: true };
    }
    if (sql.includes('INSERT INTO sessions')) {
      const [id, account_id, expires_at, created_at] = params;
      db.sessions.set(id, { id, account_id, expires_at, created_at });
      return { success: true };
    }
    if (sql.includes('DELETE FROM sessions WHERE id')) {
      db.sessions.delete(params[0]);
      return { success: true };
    }
    if (sql.includes('UPDATE accounts SET email')) {
      const [email, password_hash, password_salt, slug, is_partner, plan, plan_status, id] = params;
      const occupant = db.accounts.get(email);
      if (occupant && occupant.id !== id) {
        throw new Error('UNIQUE constraint failed: accounts.email');
      }
      const row = db.findAccountById(id);
      if (row) {
        const previousEmail = row.email;
        row.email = email;
        row.password_hash = password_hash;
        row.password_salt = password_salt;
        row.slug = slug;
        row.is_partner = is_partner;
        row.plan = plan;
        row.plan_status = plan_status;
        if (previousEmail !== email) {
          db.accounts.delete(previousEmail);
          db.accounts.set(email, row);
        }
      }
      return { success: true };
    }
    if (sql.includes('UPDATE accounts SET plan')) {
      const [plan, plan_status, id] = params;
      const row = db.findAccountById(id);
      if (row) {
        row.plan = plan;
        row.plan_status = plan_status;
      }
      return { success: true };
    }
    if (sql.includes('UPDATE accounts SET slug')) {
      const [slug, id] = params;
      const row = db.findAccountById(id);
      if (row) row.slug = slug;
      return { success: true };
    }
    throw new Error(`ProcessMemoryAuthDb: unsupported run() SQL: ${sql}`);
  }
}
