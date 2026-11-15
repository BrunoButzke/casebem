import { getSessionAccount, parseSessionCookie } from './auth-service.mjs';

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
