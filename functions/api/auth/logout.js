import { getCorsHeaders } from '../../_lib/http-helpers.mjs';
import { logout, parseSessionCookie, SESSION_COOKIE } from '../../_lib/auth-service.mjs';

export async function onRequestOptions(context) {
  return new Response(null, { status: 204, headers: getCorsHeaders(context.request) });
}

export async function onRequestPost(context) {
  const headers = getCorsHeaders(context.request);
  const secure = new URL(context.request.url).protocol === 'https:';
  const sessionId = parseSessionCookie(context.request.headers.get('Cookie'));
  if (sessionId) {
    await logout(context.env.DB || null, sessionId);
  }
  let expired = `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;
  if (secure) expired += '; Secure';
  headers.set('Set-Cookie', expired);
  return new Response(null, { status: 204, headers });
}
