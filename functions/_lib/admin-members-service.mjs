/**
 * Contas Noiva/Noivo com acesso ao painel do casamento.
 * Máx. 2 por wedding_key. Super admin NÃO entra aqui.
 */

import { WEDDING_KEY } from './messages-validators.mjs';
import { timingSafeEqualString } from './admin-auth.mjs';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ROLES = new Set(['noiva', 'noivo']);
const MAX_MEMBERS = 2;
const PBKDF2_ITERS = 100_000;

/** @type {Map<string, object[]>} wedding_key → rows */
let memoryMembers = new Map();

export function resetAdminMembersForTests() {
  memoryMembers = new Map();
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizeRole(role) {
  return String(role || '').trim().toLowerCase();
}

function isPendingEmail(email) {
  return /@casebem\.invalid$/i.test(String(email || ''));
}

function toPublic(row) {
  const email = row.email;
  const pending = isPendingEmail(email);
  return {
    id: row.id,
    email: pending ? null : email,
    memberKey: email,
    displayName: row.display_name || row.displayName || null,
    role: row.role,
    pending,
    createdAt: row.created_at || row.createdAt || '',
    updatedAt: row.updated_at || row.updatedAt || '',
  };
}

/**
 * Insert direto (cadastro de casamento). Não aplica limite de 2 aqui —
 * o caller garante a quantidade.
 */
export async function createAdminMemberRaw(db, {
  weddingKey,
  email,
  role,
  password,
  passwordHash,
  displayName,
}) {
  const now = new Date().toISOString();
  const hash = passwordHash || (await hashPassword(password));
  const id = crypto.randomUUID();
  const row = {
    id,
    wedding_key: weddingKey,
    email: String(email).trim().toLowerCase(),
    role,
    password_hash: hash,
    display_name: displayName || null,
    created_at: now,
    updated_at: now,
  };

  if (!db) {
    const list = memoryMembers.get(weddingKey) || [];
    list.push(row);
    memoryMembers.set(weddingKey, list);
    return toPublic(row);
  }

  await db
    .prepare(
      `INSERT INTO admin_members
        (id, wedding_key, email, role, password_hash, created_at, updated_at, display_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      weddingKey,
      row.email,
      role,
      hash,
      now,
      now,
      displayName || null
    )
    .run();

  return toPublic(row);
}

function bytesToHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(String(password)),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERS, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return `pbkdf2$${PBKDF2_ITERS}$${bytesToHex(salt)}$${bytesToHex(bits)}`;
}

export async function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = Number(parts[1]);
  const salt = hexToBytes(parts[2]);
  const expectedHex = parts[3];
  if (!iterations || !salt.length || !expectedHex) return false;

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(String(password)),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return timingSafeEqualString(bytesToHex(bits), expectedHex);
}

export function validateMemberPayload(body, { requirePassword = true } = {}) {
  const email = normalizeEmail(body?.email);
  const role = normalizeRole(body?.role);
  const password = String(body?.password ?? body?.pass ?? '');

  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: 'EMAIL_INVALID', message: 'Digite um e-mail válido.' };
  }
  if (!ROLES.has(role)) {
    return { ok: false, error: 'ROLE_INVALID', message: 'Papel deve ser Noiva ou Noivo.' };
  }
  if (requirePassword) {
    const strong =
      password.length >= 8 &&
      /[A-Z]/.test(password) &&
      /[0-9]/.test(password) &&
      /[^A-Za-z0-9]/.test(password);
    if (!strong) {
      return {
        ok: false,
        error: 'PASSWORD_WEAK',
        message:
          'Senha com pelo menos 8 caracteres, uma maiúscula, um número e um caractere especial.',
      };
    }
  }
  return { ok: true, email, role, password };
}

async function listRows(db, weddingKey) {
  if (!db) {
    return [...(memoryMembers.get(weddingKey) || [])];
  }
  const result = await db
    .prepare(
      `SELECT id, wedding_key, email, role, password_hash, display_name, created_at, updated_at
       FROM admin_members
       WHERE wedding_key = ?
       ORDER BY role ASC`
    )
    .bind(weddingKey)
    .all();
  return result?.results || [];
}

export async function listAdminMembers(db, weddingKey = WEDDING_KEY) {
  const rows = await listRows(db, weddingKey);
  return rows.map(toPublic);
}

export async function upsertAdminMember(db, body, weddingKey = WEDDING_KEY) {
  const validated = validateMemberPayload(body, { requirePassword: true });
  if (!validated.ok) {
    const err = new Error(validated.error);
    err.details = validated.message;
    throw err;
  }

  const { email, role, password } = validated;
  const rows = await listRows(db, weddingKey);
  const byEmail = rows.find((r) => r.email === email);
  const byRole = rows.find((r) => r.role === role);

  if (!byEmail && rows.length >= MAX_MEMBERS) {
    const err = new Error('MEMBER_LIMIT');
    err.details = 'Máximo de 2 contas (Noiva e Noivo).';
    throw err;
  }
  if (byRole && (!byEmail || byRole.email !== email)) {
    const err = new Error('ROLE_TAKEN');
    err.details = `Já existe uma conta com o papel ${role}.`;
    throw err;
  }

  const now = new Date().toISOString();
  const passwordHash = await hashPassword(password);

  if (byEmail) {
    if (!db) {
      const next = rows.map((r) =>
        r.email === email
          ? { ...r, role, password_hash: passwordHash, updated_at: now }
          : r
      );
      memoryMembers.set(weddingKey, next);
      return toPublic(next.find((r) => r.email === email));
    }
    await db
      .prepare(
        `UPDATE admin_members
         SET role = ?, password_hash = ?, updated_at = ?
         WHERE wedding_key = ? AND email = ?`
      )
      .bind(role, passwordHash, now, weddingKey, email)
      .run();
    return toPublic({
      id: byEmail.id,
      email,
      role,
      created_at: byEmail.created_at,
      updated_at: now,
    });
  }

  const id = crypto.randomUUID();
  const row = {
    id,
    wedding_key: weddingKey,
    email,
    role,
    password_hash: passwordHash,
    created_at: now,
    updated_at: now,
  };

  if (!db) {
    memoryMembers.set(weddingKey, [...rows, row]);
    return toPublic(row);
  }

  await db
    .prepare(
      `INSERT INTO admin_members (id, wedding_key, email, role, password_hash, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(id, weddingKey, email, role, passwordHash, now, now)
    .run();

  return toPublic(row);
}

export async function removeAdminMember(db, email, weddingKey = WEDDING_KEY) {
  const normalized = normalizeEmail(email);
  if (!EMAIL_RE.test(normalized) && !isPendingEmail(normalized)) {
    const err = new Error('EMAIL_INVALID');
    err.details = 'E-mail inválido.';
    throw err;
  }

  if (!db) {
    const rows = memoryMembers.get(weddingKey) || [];
    const next = rows.filter((r) => r.email !== normalized);
    if (next.length === rows.length) {
      const err = new Error('NOT_FOUND');
      err.details = 'Conta não encontrada.';
      throw err;
    }
    memoryMembers.set(weddingKey, next);
    return { removed: normalized };
  }

  const result = await db
    .prepare(`DELETE FROM admin_members WHERE wedding_key = ? AND email = ?`)
    .bind(weddingKey, normalized)
    .run();
  const changes = Number(result?.meta?.changes ?? result?.changes ?? 0);
  if (changes === 0) {
    const err = new Error('NOT_FOUND');
    err.details = 'Conta não encontrada.';
    throw err;
  }
  return { removed: normalized };
}

/**
 * Autentica membro por e-mail+senha em qualquer tenant.
 * @returns {{ok:true, member, weddingKey}|{ok:false}}
 */
export async function authenticateAdminMember(db, user, pass) {
  const email = normalizeEmail(user);
  const password = String(pass || '');
  if (!EMAIL_RE.test(email) || !password) return { ok: false };
  if (isPendingEmail(email)) return { ok: false };

  let row = null;
  if (!db) {
    for (const rows of memoryMembers.values()) {
      const found = (rows || []).find((r) => r.email === email);
      if (found) {
        row = found;
        break;
      }
    }
  } else {
    row = await db
      .prepare(
        `SELECT id, wedding_key, email, role, password_hash, display_name, created_at, updated_at
         FROM admin_members
         WHERE email = ?`
      )
      .bind(email)
      .first();
  }

  if (!row) return { ok: false };
  const valid = await verifyPassword(password, row.password_hash);
  if (!valid) return { ok: false };

  return {
    ok: true,
    weddingKey: row.wedding_key || WEDDING_KEY,
    member: toPublic(row),
  };
}
