import { hashPassword, verifyPassword, randomSaltB64 } from './password.mjs';

export const PARTNER_ACCOUNT_ID = 'partner-dani-carine';
export const SESSION_COOKIE = 'cb_session';
export const SESSION_MAX_AGE_SEC = 1209600;

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
  await db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
}

export async function getSessionAccount(db, sessionId, nowIso) {
  if (!sessionId) return null;
  const session = await db.prepare('SELECT * FROM sessions WHERE id = ?').bind(sessionId).first();
  if (!session) return null;
  if (session.expires_at < nowIso) return null;
  const row = await selectAccountById(db, session.account_id);
  if (!row) return null;
  return { ...publicAccount(row), id: row.id };
}

export async function upgradePlan(db, accountId, plan) {
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
  const row = await db.prepare('SELECT * FROM accounts WHERE slug = ?').bind(slug).first();
  return row ?? null;
}
