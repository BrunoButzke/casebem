/**
 * Cadastro de tenants (casamentos) + slug noiva-noivo.
 */

import { createAdminMemberRaw, hashPassword } from './admin-members-service.mjs';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ROLES = new Set(['noiva', 'noivo']);

/** @type {Map<string, object>} */
let memoryTenants = new Map();

export function resetTenantsForTests() {
  memoryTenants = new Map();
}

export function isStrongPassword(password) {
  const p = String(password || '');
  return (
    p.length >= 8 &&
    /[A-Z]/.test(p) &&
    /[0-9]/.test(p) &&
    /[^A-Za-z0-9]/.test(p)
  );
}

export function slugifyPart(name) {
  return (
    String(name || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32) || 'casal'
  );
}

export function buildTenantSlugCandidates(noivaName, noivoName) {
  const a = slugifyPart(noivaName);
  const b = slugifyPart(noivoName);
  const primary = `${a}-${b}`;
  const secondary = `${b}-${a}`;
  const out = [primary];
  if (secondary !== primary) out.push(secondary);
  for (let i = 2; i <= 20; i++) out.push(`${primary}-${i}`);
  return out;
}

/** Paths públicos do casamento (site + painel). */
export function pathsForTenantId(id) {
  const slug = String(id || '')
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, '');
  if (!slug) {
    return { adminPath: '/dani-carine/admin', sitePath: '/dani-carine/' };
  }
  return {
    adminPath: `/${slug}/admin`,
    sitePath: `/${slug}/`,
  };
}

function pendingPartnerEmail(slug, role) {
  return `pending.${slug}.${role}@casebem.invalid`;
}

export function isPendingPartnerEmail(email) {
  return /@casebem\.invalid$/i.test(String(email || ''));
}

export function validateRegisterPayload(body) {
  const yourName = String(body?.yourName || body?.name || '').trim().slice(0, 80);
  const partnerName = String(body?.partnerName || '').trim().slice(0, 80);
  const role = String(body?.role || '').trim().toLowerCase();
  const email = String(body?.email || '').trim().toLowerCase();
  const password = String(body?.password || '');
  const passwordConfirm = String(body?.passwordConfirm ?? body?.confirmPassword ?? '');

  if (yourName.length < 2) {
    return { ok: false, error: 'NAME_REQUIRED', message: 'Informe seu nome.' };
  }
  if (partnerName.length < 2) {
    return { ok: false, error: 'PARTNER_REQUIRED', message: 'Informe o nome de quem vai casar com você.' };
  }
  if (!ROLES.has(role)) {
    return { ok: false, error: 'ROLE_INVALID', message: 'Escolha se você é Noiva ou Noivo.' };
  }
  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: 'EMAIL_INVALID', message: 'Digite um e-mail válido.' };
  }
  if (!isStrongPassword(password)) {
    return {
      ok: false,
      error: 'PASSWORD_WEAK',
      message: 'Senha com pelo menos 8 caracteres, uma maiúscula, um número e um caractere especial.',
    };
  }
  if (password !== passwordConfirm) {
    return { ok: false, error: 'PASSWORD_MISMATCH', message: 'A confirmação da senha não confere.' };
  }

  const partnerRole = role === 'noiva' ? 'noivo' : 'noiva';
  const noivaName = role === 'noiva' ? yourName : partnerName;
  const noivoName = role === 'noivo' ? yourName : partnerName;

  return {
    ok: true,
    yourName,
    partnerName,
    role,
    partnerRole,
    noivaName,
    noivoName,
    email,
    password,
  };
}

async function tenantExists(db, id) {
  if (!db) return memoryTenants.has(id);
  const row = await db.prepare(`SELECT id FROM tenants WHERE id = ?`).bind(id).first();
  return Boolean(row?.id);
}

async function emailTaken(db, email) {
  if (!db) {
    for (const t of memoryTenants.values()) {
      if (t.owner_email === email) return true;
    }
    return false;
  }
  const owner = await db.prepare(`SELECT id FROM tenants WHERE owner_email = ?`).bind(email).first();
  if (owner) return true;
  const member = await db
    .prepare(`SELECT id FROM admin_members WHERE email = ?`)
    .bind(email)
    .first();
  return Boolean(member?.id);
}

async function pickSlug(db, noivaName, noivoName) {
  const candidates = buildTenantSlugCandidates(noivaName, noivoName);
  for (const id of candidates) {
    if (!(await tenantExists(db, id))) return id;
  }
  const err = new Error('SLUG_EXHAUSTED');
  err.details = 'Não foi possível gerar um link livre. Tente nomes um pouco diferentes.';
  throw err;
}

function rowToTenant(row) {
  return {
    id: row.id,
    coupleNames: row.couple_names || row.coupleNames,
    noivaName: row.noiva_name || row.noivaName,
    noivoName: row.noivo_name || row.noivoName,
    email: row.owner_email || row.ownerEmail || row.email || '—',
    plan: row.plan || 'basic',
    adminPath: row.admin_path || row.adminPath || '/dani-carine/admin.html',
    sitePath: row.site_path || row.sitePath || '/dani-carine/',
    createdAt: row.created_at || row.createdAt || '',
  };
}

export async function listTenantsAdmin(db) {
  if (!db) {
    return [...memoryTenants.values()]
      .map(rowToTenant)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }
  const result = await db
    .prepare(
      `SELECT id, noiva_name, noivo_name, couple_names, owner_email, plan,
              admin_path, site_path, created_at
       FROM tenants
       ORDER BY created_at DESC`
    )
    .all();
  return (result?.results || []).map(rowToTenant);
}

export async function getTenantById(db, id) {
  if (!db) {
    const row = memoryTenants.get(id);
    return row ? rowToTenant(row) : null;
  }
  const row = await db
    .prepare(
      `SELECT id, noiva_name, noivo_name, couple_names, owner_email, plan,
              admin_path, site_path, created_at
       FROM tenants WHERE id = ?`
    )
    .bind(id)
    .first();
  return row ? rowToTenant(row) : null;
}

/**
 * Cadastro público: cria tenant + membro dono + reserva do parceiro.
 */
export async function registerWedding(db, body) {
  const validated = validateRegisterPayload(body);
  if (!validated.ok) {
    const err = new Error(validated.error);
    err.details = validated.message;
    throw err;
  }

  if (await emailTaken(db, validated.email)) {
    const err = new Error('EMAIL_TAKEN');
    err.details = 'Este e-mail já está cadastrado.';
    throw err;
  }

  const slug = await pickSlug(db, validated.noivaName, validated.noivoName);
  const now = new Date().toISOString();
  const coupleNames = `${validated.noivoName} & ${validated.noivaName}`;
  const { adminPath, sitePath } = pathsForTenantId(slug);

  const tenantRow = {
    id: slug,
    noiva_name: validated.noivaName,
    noivo_name: validated.noivoName,
    couple_names: coupleNames,
    owner_email: validated.email,
    plan: 'basic',
    admin_path: adminPath,
    site_path: sitePath,
    created_at: now,
    updated_at: now,
  };

  if (!db) {
    memoryTenants.set(slug, tenantRow);
  } else {
    await db
      .prepare(
        `INSERT INTO tenants (
          id, noiva_name, noivo_name, couple_names, owner_email, plan,
          admin_path, site_path, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'basic', ?, ?, ?, ?)`
      )
      .bind(
        slug,
        validated.noivaName,
        validated.noivoName,
        coupleNames,
        validated.email,
        adminPath,
        sitePath,
        now,
        now
      )
      .run();
  }

  await createAdminMemberRaw(db, {
    weddingKey: slug,
    email: validated.email,
    role: validated.role,
    password: validated.password,
    displayName: validated.yourName,
  });

  const partnerHash = await hashPassword(`${crypto.randomUUID()}Aa1!`);
  await createAdminMemberRaw(db, {
    weddingKey: slug,
    email: pendingPartnerEmail(slug, validated.partnerRole),
    role: validated.partnerRole,
    passwordHash: partnerHash,
    displayName: validated.partnerName,
  });

  return {
    tenant: rowToTenant(tenantRow),
    role: validated.role,
    partnerRole: validated.partnerRole,
  };
}
