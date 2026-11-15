import { getCorsHeaders } from '../../_lib/http-helpers.mjs';
import { login, sessionCookieHeader } from '../../_lib/auth-service.mjs';
import { ensurePartnerAccount } from '../../_lib/partner-seed.mjs';
import { checkAuthRateLimit, clientIp } from '../../_lib/auth-rate-limit.mjs';

export async function onRequestOptions(context) {
  return new Response(null, { status: 204, headers: getCorsHeaders(context.request) });
}

export async function onRequestPost(context) {
  const headers = getCorsHeaders(context.request);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  const body = await context.request.json().catch(() => ({}));
  const secure = new URL(context.request.url).protocol === 'https:';
  const env = context.env || {};
  const nowIso = new Date().toISOString();
  try {
    await ensurePartnerAccount(
      env.DB || null,
      {
        email: env.PARTNER_EMAIL,
        password: env.PARTNER_BOOTSTRAP_PASSWORD,
      },
      nowIso
    );
    const rate = await checkAuthRateLimit(env.DB || null, clientIp(context.request));
    if (!rate.allowed) {
      return Response.json({ ok: false, error: 'RATE_LIMITED' }, { status: 429, headers });
    }
    const result = await login(env.DB || null, body, nowIso);
    headers.set('Set-Cookie', sessionCookieHeader(result.sessionId, { secure }));
    return Response.json({ ok: true, account: result.account }, { status: 200, headers });
  } catch (err) {
    const map = {
      INVALID_CREDENTIALS: 401,
    };
    return Response.json({ ok: false, error: err.message }, { status: map[err.message] || 500, headers });
  }
}
