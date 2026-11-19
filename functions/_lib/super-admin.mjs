/**
 * Super admin CaseBem — visão multi-tenant + lista de espera.
 * Credenciais em D1 (tabela super_admins); token de sessão via env.
 */

import { timingSafeEqualString, mintTenantToken } from './admin-auth.mjs';
import { verifyPassword, hashPassword } from './admin-members-service.mjs';
import { listWaitlistAdmin } from './waitlist-service.mjs';
import { listTenantsAdmin, getTenantById } from './tenant-service.mjs';

/**
 * Seed em memória (testes / vite sem D1). Produção usa apenas a tabela D1 `super_admins`.
 * Hash = PBKDF2 de "admin" (mesmo da migration 0032).
 */
export const SUPER_ADMIN_SEED_EMAIL = 'brunobutzkesouza@gmail.com';
const SUPER_ADMIN_SEED_HASH =
  'pbkdf2$100000$a1b2c3d4e5f60718293a4b5c6d7e8f90$17a434ff87fda4ef6910bd5a37944be0b59239482395aa860f37a566eac6ddcc';

/** @deprecated prefer SUPER_ADMIN_SEED_EMAIL — export para testes */
export const SUPER_ADMIN_EMAIL = SUPER_ADMIN_SEED_EMAIL;
/** Senha do seed de testes (não usada em produção). */
export const SUPER_ADMIN_PASS = 'admin';

/** Fallback se a tabela tenants ainda não existir / estiver vazia. */
export const KNOWN_TENANTS = [
  {
    id: 'dani-carine',
    coupleNames: 'Dani & Carine',
    email: '—',
    plan: 'vip',
    adminPath: '/dani-carine/admin',
    sitePath: '/dani-carine/',
  },
];

/** @type {Map<string, object>} email → row */
let memorySuperAdmins = new Map();

export function resetSuperAdminsForTests() {
  memorySuperAdmins = new Map();
}

function ensureMemorySeeded() {
  if (memorySuperAdmins.size > 0) return;
  const now = new Date().toISOString();
  memorySuperAdmins.set(SUPER_ADMIN_SEED_EMAIL, {
    id: 'super-bruno',
    email: SUPER_ADMIN_SEED_EMAIL,
    password_hash: SUPER_ADMIN_SEED_HASH,
    created_at: now,
    updated_at: now,
  });
}

export function resolveSuperAdminToken(env) {
  const explicit = env?.SUPER_ADMIN_TOKEN;
  if (typeof explicit === 'string' && explicit.length >= 16) return explicit;
  const secret = env?.ADMIN_PANEL_SECRET;
  if (typeof secret === 'string' && secret.length >= 16) return `super.${secret}`;
  return null;
}

async function findSuperAdminRow(db, email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return null;

  if (!db) {
    ensureMemorySeeded();
    return memorySuperAdmins.get(normalized) || null;
  }

  try {
    return (
      (await db
        .prepare(
          `SELECT id, email, password_hash, created_at, updated_at
           FROM super_admins
           WHERE email = ?`
        )
        .bind(normalized)
        .first()) || null
    );
  } catch (err) {
    // Tabela ainda não migrada
    if (/no such table:\s*super_admins/i.test(String(err?.message || ''))) return null;
    throw err;
  }
}

/**
 * Autentica super admin contra D1 (ou memória em dev/testes).
 */
export async function loginSuperAdmin(env, user, pass, db = env?.DB || null) {
  const email = String(user || '').trim().toLowerCase();
  const password = String(pass || '');
  if (!email || !password) {
    return {
      ok: false,
      status: 401,
      error: 'UNAUTHORIZED',
      message: 'Login ou senha não conferem.',
    };
  }

  const row = await findSuperAdminRow(db, email);
  if (!row) {
    return {
      ok: false,
      status: 401,
      error: 'UNAUTHORIZED',
      message: 'Login ou senha não conferem.',
    };
  }

  const valid = await verifyPassword(password, row.password_hash);
  if (!valid) {
    return {
      ok: false,
      status: 401,
      error: 'UNAUTHORIZED',
      message: 'Login ou senha não conferem.',
    };
  }

  const token = resolveSuperAdminToken(env);
  if (!token) {
    return {
      ok: false,
      status: 503,
      error: 'ADMIN_NOT_CONFIGURED',
      message: 'Super admin não configurado (defina ADMIN_PANEL_SECRET ou SUPER_ADMIN_TOKEN).',
    };
  }
  return { ok: true, token, role: 'super', email: row.email };
}

function validateSuperPasswordStrength(password) {
  const strong =
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password);
  if (!strong) {
    return {
      ok: false,
      status: 400,
      error: 'PASSWORD_WEAK',
      message:
        'Senha com pelo menos 8 caracteres, uma maiúscula, um número e um caractere especial.',
    };
  }
  return { ok: true };
}

/**
 * Troca a senha do super admin autenticado (exige senha atual).
 */
export async function changeSuperAdminPassword(db, { email, currentPassword, newPassword, newPasswordConfirm }) {
  const normalized = String(email || '').trim().toLowerCase();
  const current = String(currentPassword || '');
  const next = String(newPassword || '');
  const confirm = String(newPasswordConfirm ?? '');

  if (!normalized || !current || !next) {
    return {
      ok: false,
      status: 400,
      error: 'MISSING_FIELDS',
      message: 'Informe e-mail, senha atual e nova senha.',
    };
  }

  if (next !== confirm) {
    return {
      ok: false,
      status: 400,
      error: 'PASSWORD_MISMATCH',
      message: 'A confirmação da senha não confere.',
    };
  }

  if (next === current) {
    return {
      ok: false,
      status: 400,
      error: 'PASSWORD_UNCHANGED',
      message: 'A nova senha deve ser diferente da atual.',
    };
  }

  const strength = validateSuperPasswordStrength(next);
  if (!strength.ok) return strength;

  const row = await findSuperAdminRow(db, normalized);
  if (!row) {
    return {
      ok: false,
      status: 404,
      error: 'NOT_FOUND',
      message: 'Super admin não encontrado.',
    };
  }

  const valid = await verifyPassword(current, row.password_hash);
  if (!valid) {
    return {
      ok: false,
      status: 401,
      error: 'UNAUTHORIZED',
      message: 'Senha atual não confere.',
    };
  }

  const password_hash = await hashPassword(next);
  const updated_at = new Date().toISOString();

  if (!db) {
    ensureMemorySeeded();
    memorySuperAdmins.set(normalized, { ...row, password_hash, updated_at });
    return { ok: true, email: normalized };
  }

  try {
    await db
      .prepare(`UPDATE super_admins SET password_hash = ?, updated_at = ? WHERE email = ?`)
      .bind(password_hash, updated_at, normalized)
      .run();
  } catch (err) {
    if (/no such table:\s*super_admins/i.test(String(err?.message || ''))) {
      return {
        ok: false,
        status: 503,
        error: 'SUPER_ADMINS_MISSING',
        message: 'Tabela super_admins ainda não existe. Aplique a migration 0032.',
      };
    }
    throw err;
  }

  return { ok: true, email: normalized };
}

export function requireSuperAdmin(request, env) {
  const expected = resolveSuperAdminToken(env);
  if (!expected) {
    return {
      ok: false,
      status: 503,
      error: 'ADMIN_NOT_CONFIGURED',
      message: 'Super admin não configurado.',
    };
  }

  const header = request.headers.get('Authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim() || '';

  if (!token || !timingSafeEqualString(token, expected)) {
    return {
      ok: false,
      status: 401,
      error: 'UNAUTHORIZED',
      message: 'Token super admin inválido.',
    };
  }

  return { ok: true };
}

export async function getSuperAdminOverview(db) {
  const [waitlist, fromDb] = await Promise.all([
    listWaitlistAdmin(db),
    listTenantsAdmin(db).catch(() => []),
  ]);
  const byId = new Map();
  for (const t of KNOWN_TENANTS) byId.set(t.id, { ...t });
  for (const t of fromDb) byId.set(t.id, t);
  const tenants = [...byId.values()].sort((a, b) =>
    String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
  );
  return { tenants, waitlist };
}

export async function findKnownTenant(db, tenantId) {
  const id = String(tenantId || '').trim();
  const fromDb = await getTenantById(db, id).catch(() => null);
  if (fromDb) return fromDb;
  return KNOWN_TENANTS.find((t) => t.id === id) || null;
}

/**
 * Super admin entra no painel do casal com o token do tenant
 * (sem precisar das credenciais Noiva/Noivo).
 */
export async function enterTenantAsSuper(env, tenantId) {
  const tenant = await findKnownTenant(env?.DB || null, tenantId);
  if (!tenant) {
    return {
      ok: false,
      status: 404,
      error: 'TENANT_NOT_FOUND',
      message: 'Casamento não encontrado.',
    };
  }
  const secret = env?.ADMIN_PANEL_SECRET;
  if (!secret || typeof secret !== 'string' || secret.length < 16) {
    return {
      ok: false,
      status: 503,
      error: 'ADMIN_NOT_CONFIGURED',
      message: 'Painel do casal não configurado (ADMIN_PANEL_SECRET).',
    };
  }
  const token = await mintTenantToken(secret, tenant.id);
  return {
    ok: true,
    token,
    role: 'tenant',
    weddingKey: tenant.id,
    adminPath: tenant.adminPath,
    sitePath: tenant.sitePath,
    coupleNames: tenant.coupleNames,
  };
}
