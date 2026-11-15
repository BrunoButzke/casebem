import { getSessionAccount, parseSessionCookie, PARTNER_ACCOUNT_ID } from './auth-service.mjs';

export async function requireAccount(request, env) {
  const sessionId = parseSessionCookie(request.headers.get('cookie'));
  if (!sessionId) {
    return { ok: false, status: 401, error: 'UNAUTHORIZED', message: 'Sessão inválida.' };
  }
  const account = await getSessionAccount(env?.DB || null, sessionId, new Date().toISOString());
  if (!account) {
    return { ok: false, status: 401, error: 'UNAUTHORIZED', message: 'Sessão inválida.' };
  }
  return { ok: true, account };
}

export function requirePartner(auth) {
  if (!auth.ok) return auth;
  if (auth.account.id !== PARTNER_ACCOUNT_ID) {
    return { ok: false, status: 403, error: 'FORBIDDEN' };
  }
  return auth;
}

export function requirePaidPlan(auth) {
  if (!auth.ok) return auth;
  if (auth.account.plan === 'basic') {
    return { ok: false, status: 403, error: 'PLAN_REQUIRED' };
  }
  return auth;
}
