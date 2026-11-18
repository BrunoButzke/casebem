/**
 * Lista de espera CaseBem (landing · Garanta a vaga)
 */

const PLAN_SET = new Set(['basic', 'pro', 'vip']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** @type {Map<string, object>} */
let memoryWaitlist = new Map();

export function resetWaitlistForTests() {
  memoryWaitlist = new Map();
}

function normalizePlan(plan) {
  const p = String(plan || 'pro').trim().toLowerCase();
  return PLAN_SET.has(p) ? p : 'pro';
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function rowToEntry(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    plan: row.plan,
    createdAt: row.created_at || row.createdAt || '',
  };
}

export function validateWaitlistPayload(body) {
  const name = String(body?.name || '').trim().slice(0, 120);
  const email = normalizeEmail(body?.email).slice(0, 160);
  const plan = normalizePlan(body?.plan);
  const consent = Boolean(body?.consent);

  if (!name) return { ok: false, error: 'NAME_REQUIRED', message: 'Informe um nome.' };
  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: 'EMAIL_INVALID', message: 'Digite um e-mail válido.' };
  }
  if (!consent) {
    return { ok: false, error: 'CONSENT_REQUIRED', message: 'Marque o consentimento para receber o aviso.' };
  }
  return { ok: true, name, email, plan };
}

export async function addWaitlistSignup(db, { name, email, plan }) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const entry = { id, name, email, plan, created_at: now };

  if (!db) {
    const existing = memoryWaitlist.get(email);
    if (existing) {
      const updated = { ...existing, name, plan, created_at: now };
      memoryWaitlist.set(email, updated);
      return { ok: true, entry: rowToEntry(updated), updated: true };
    }
    memoryWaitlist.set(email, entry);
    return { ok: true, entry: rowToEntry(entry), updated: false };
  }

  const existing = await db
    .prepare(`SELECT id, name, email, plan, created_at FROM waitlist_signups WHERE email = ?`)
    .bind(email)
    .first();

  if (existing) {
    await db
      .prepare(
        `UPDATE waitlist_signups
         SET name = ?, plan = ?, created_at = ?
         WHERE email = ?`
      )
      .bind(name, plan, now, email)
      .run();
    return {
      ok: true,
      entry: rowToEntry({ ...existing, name, plan, created_at: now }),
      updated: true,
    };
  }

  await db
    .prepare(
      `INSERT INTO waitlist_signups (id, name, email, plan, created_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(id, name, email, plan, now)
    .run();

  return { ok: true, entry: rowToEntry(entry), updated: false };
}

export async function listWaitlistAdmin(db, { limit = 500 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 500, 1), 1000);

  if (!db) {
    return [...memoryWaitlist.values()]
      .map(rowToEntry)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .slice(0, safeLimit);
  }

  const result = await db
    .prepare(
      `SELECT id, name, email, plan, created_at
       FROM waitlist_signups
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .bind(safeLimit)
    .all();

  return (result?.results || []).map(rowToEntry);
}
