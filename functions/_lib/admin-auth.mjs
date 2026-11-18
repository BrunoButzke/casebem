/**
 * Admin auth for noivos panel — Free-tier safe.
 * Tenant tokens are HMAC-bound to weddingKey (não compartilham dados entre casais).
 */

import { WEDDING_KEY as DEFAULT_WEDDING_KEY } from './messages-validators.mjs';

export function timingSafeEqualString(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);
  if (bufA.byteLength !== bufB.byteLength) {
    let diff = bufA.byteLength ^ bufB.byteLength;
    const len = Math.max(bufA.byteLength, bufB.byteLength);
    for (let i = 0; i < len; i++) {
      const x = i < bufA.byteLength ? bufA[i] : 0;
      const y = i < bufB.byteLength ? bufB[i] : 0;
      diff |= x ^ y;
    }
    return false;
  }
  let out = 0;
  for (let i = 0; i < bufA.byteLength; i++) out |= bufA[i] ^ bufB[i];
  return out === 0;
}

function bytesToBase64Url(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const b64 = String(str).replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function utf8ToBase64Url(text) {
  return bytesToBase64Url(new TextEncoder().encode(String(text || '')));
}

function base64UrlToUtf8(str) {
  return new TextDecoder().decode(base64UrlToBytes(str));
}

async function importHmacKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(String(secret)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

async function hmacHex(secret, message) {
  const key = await importHmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Emite Bearer scoped ao casamento.
 * Formato: t.<base64url(weddingKey)>.<hmac-hex>
 */
export async function mintTenantToken(secret, weddingKey) {
  const key = String(weddingKey || DEFAULT_WEDDING_KEY).trim() || DEFAULT_WEDDING_KEY;
  const payload = `v1:${key}`;
  const sig = await hmacHex(secret, payload);
  return `t.${utf8ToBase64Url(key)}.${sig}`;
}

/**
 * @returns {Promise<{ok:true, weddingKey:string, legacy?:boolean}|{ok:false}>}
 */
export async function verifyTenantToken(secret, token) {
  const raw = String(token || '').trim();
  if (!raw) return { ok: false };

  // Compat: Bearer = ADMIN_PANEL_SECRET puro → dani-carine
  if (timingSafeEqualString(raw, secret)) {
    return { ok: true, weddingKey: DEFAULT_WEDDING_KEY, legacy: true };
  }

  const parts = raw.split('.');
  if (parts.length !== 3 || parts[0] !== 't') return { ok: false };

  let weddingKey;
  try {
    weddingKey = base64UrlToUtf8(parts[1]).trim();
  } catch {
    return { ok: false };
  }
  if (!weddingKey || weddingKey.length > 80) return { ok: false };

  const expected = await mintTenantToken(secret, weddingKey);
  if (!timingSafeEqualString(raw, expected)) return { ok: false };
  return { ok: true, weddingKey };
}

function bearerFromRequest(request) {
  const header = request.headers.get('Authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
}

/**
 * @param {Request} request
 * @param {object} env
 * @returns {Promise<{ok:true, weddingKey:string, role:'tenant'}|{ok:false, status:number, error:string, message?:string}>}
 */
export async function requireAdmin(request, env) {
  const secret = env?.ADMIN_PANEL_SECRET;
  if (!secret || typeof secret !== 'string' || secret.length < 16) {
    return {
      ok: false,
      status: 503,
      error: 'ADMIN_NOT_CONFIGURED',
      message: 'Painel admin não configurado (defina ADMIN_PANEL_SECRET com ≥16 chars).',
    };
  }

  const token = bearerFromRequest(request);
  if (!token) {
    return {
      ok: false,
      status: 401,
      error: 'UNAUTHORIZED',
      message: 'Token admin inválido.',
    };
  }

  const verified = await verifyTenantToken(secret, token);
  if (!verified.ok) {
    return {
      ok: false,
      status: 401,
      error: 'UNAUTHORIZED',
      message: 'Token admin inválido.',
    };
  }

  return { ok: true, weddingKey: verified.weddingKey, role: 'tenant' };
}

export const GAMES_ADMIN_USER = 'Carine';
export const GAMES_ADMIN_PASS = 'Dani';
export const SITE_ADMIN_USER = 'Dani';
export const SITE_ADMIN_PASS = 'Carine';

function matchesAdminPair(user, pass, expectedUser, expectedPass) {
  return (
    timingSafeEqualString(user, expectedUser) && timingSafeEqualString(pass, expectedPass)
  );
}

/**
 * Troca login/senha legado pelo token scoped de dani-carine.
 */
export async function loginGamesAdmin(env, user, pass) {
  const secret = env?.ADMIN_PANEL_SECRET;
  if (!secret || typeof secret !== 'string' || secret.length < 16) {
    return {
      ok: false,
      status: 503,
      error: 'ADMIN_NOT_CONFIGURED',
      message: 'Painel admin não configurado (defina ADMIN_PANEL_SECRET com ≥16 chars).',
    };
  }

  const u = String(user || '').trim();
  const p = String(pass || '');
  const ok =
    matchesAdminPair(u, p, GAMES_ADMIN_USER, GAMES_ADMIN_PASS) ||
    matchesAdminPair(u, p, SITE_ADMIN_USER, SITE_ADMIN_PASS);
  if (!ok) {
    return {
      ok: false,
      status: 401,
      error: 'UNAUTHORIZED',
      message: 'Login ou senha não conferem.',
    };
  }

  const token = await mintTenantToken(secret, DEFAULT_WEDDING_KEY);
  return { ok: true, token, role: 'tenant', weddingKey: DEFAULT_WEDDING_KEY };
}
