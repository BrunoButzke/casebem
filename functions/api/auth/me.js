import { getCorsHeaders } from '../../_lib/http-helpers.mjs';
import { getSessionAccount, parseSessionCookie } from '../../_lib/auth-service.mjs';

export async function onRequestOptions(context) {
  return new Response(null, { status: 204, headers: getCorsHeaders(context.request) });
}

export async function onRequestGet(context) {
  const headers = getCorsHeaders(context.request);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  const sessionId = parseSessionCookie(context.request.headers.get('Cookie'));
  const account = await getSessionAccount(
    context.env.DB || null,
    sessionId,
    new Date().toISOString()
  );
  if (!account) {
    return Response.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401, headers });
  }
  const { email, plan, planStatus, slug, isPartner } = account;
  return Response.json({ email, plan, planStatus, slug, isPartner }, { status: 200, headers });
}
