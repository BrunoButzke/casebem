import { getCorsHeaders } from '../../_lib/http-helpers.mjs';
import { login, sessionCookieHeader } from '../../_lib/auth-service.mjs';

export async function onRequestOptions(context) {
  return new Response(null, { status: 204, headers: getCorsHeaders(context.request) });
}

export async function onRequestPost(context) {
  const headers = getCorsHeaders(context.request);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  const body = await context.request.json().catch(() => ({}));
  const secure = new URL(context.request.url).protocol === 'https:';
  try {
    const result = await login(context.env.DB || null, body, new Date().toISOString());
    headers.set('Set-Cookie', sessionCookieHeader(result.sessionId, { secure }));
    return Response.json({ ok: true, account: result.account }, { status: 200, headers });
  } catch (err) {
    const map = {
      INVALID_CREDENTIALS: 401,
    };
    return Response.json({ ok: false, error: err.message }, { status: map[err.message] || 500, headers });
  }
}
