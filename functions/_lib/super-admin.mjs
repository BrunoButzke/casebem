/**
 * Super admin CaseBem — visão multi-tenant + lista de espera.
 * Credenciais temporárias (trocar depois por secret no env).
 */

import { timingSafeEqualString, mintTenantToken } from './admin-auth.mjs';
import { listWaitlistAdmin } from './waitlist-service.mjs';
import { listTenantsAdmin, getTenantById } from './tenant-service.mjs';

export const SUPER_ADMIN_EMAIL = 'brunobutzkesouza@gmail.com';
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

export function resolveSuperAdminToken(env) {
  const explicit = env?.SUPER_ADMIN_TOKEN;
  if (typeof explicit === 'string' && explicit.length >= 16) return explicit;
  const secret = env?.ADMIN_PANEL_SECRET;
  if (typeof secret === 'string' && secret.length >= 16) return `super.${secret}`;
  return null;
}

export function isSuperAdminCredentials(user, pass) {
  const email = String(user || '').trim().toLowerCase();
  const password = String(pass || '');
  return (
    timingSafeEqualString(email, SUPER_ADMIN_EMAIL) &&
    timingSafeEqualString(password, SUPER_ADMIN_PASS)
  );
}

export function loginSuperAdmin(env, user, pass) {
  if (!isSuperAdminCredentials(user, pass)) {
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
  return { ok: true, token, role: 'super' };
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
