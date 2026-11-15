import { getCorsHeaders } from '../../_lib/http-helpers.mjs';
import { getSessionAccount, parseSessionCookie, upgradePlan } from '../../_lib/auth-service.mjs';

export async function onRequestOptions(context) {
  return new Response(null, { status: 204, headers: getCorsHeaders(context.request) });
}

export async function onRequestPost(context) {
  const headers = getCorsHeaders(context.request);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  const db = context.env.DB || null;
  const sessionId = parseSessionCookie(context.request.headers.get('Cookie'));
  const account = await getSessionAccount(db, sessionId, new Date().toISOString());
  if (!account) {
    return Response.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401, headers });
  }
  const body = await context.request.json().catch(() => ({}));
  try {
    const updated = await upgradePlan(db, account.id, body.plan);
    return Response.json({ ok: true, account: updated }, { status: 200, headers });
  } catch (err) {
    const map = {
      INVALID_PLAN: 400,
      ACCOUNT_NOT_BASIC: 400,
    };
    return Response.json({ ok: false, error: err.message }, { status: map[err.message] || 500, headers });
  }
}
