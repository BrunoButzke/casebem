/**
 * Admin auth for noivos panel — Free-tier safe.
 * Uses env ADMIN_PANEL_SECRET (Bearer token). No Cloudflare Access / Workers Paid.
 */

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);
  if (bufA.byteLength !== bufB.byteLength) {
    // Still compare to reduce trivial timing leaks on length
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

/**
 * @param {Request} request
 * @param {object} env
 * @returns {{ok: true} | {ok: false, status: number, error: string}}
 */
export function requireAdmin(request, env) {
  const secret = env?.ADMIN_PANEL_SECRET;
  if (!secret || typeof secret !== 'string' || secret.length < 16) {
    return {
      ok: false,
      status: 503,
      error: 'ADMIN_NOT_CONFIGURED',
      message: 'Painel admin não configurado (defina ADMIN_PANEL_SECRET com ≥16 chars).',
    };
  }

  const header = request.headers.get('Authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim() || '';

  if (!token || !timingSafeEqual(token, secret)) {
    return {
      ok: false,
      status: 401,
      error: 'UNAUTHORIZED',
      message: 'Token admin inválido.',
    };
  }

  return { ok: true };
}

export const GAMES_ADMIN_USER = 'Carine';
export const GAMES_ADMIN_PASS = 'Dani';

/**
 * Troca login/senha do jogo pelo ADMIN_PANEL_SECRET de produção.
 * Assim o front não precisa hardcodar o Bearer.
 */
export function loginGamesAdmin(env, user, pass) {
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
  if (!timingSafeEqual(u, GAMES_ADMIN_USER) || !timingSafeEqual(p, GAMES_ADMIN_PASS)) {
    return {
      ok: false,
      status: 401,
      error: 'UNAUTHORIZED',
      message: 'Login ou senha não conferem.',
    };
  }

  return { ok: true, token: secret };
}
