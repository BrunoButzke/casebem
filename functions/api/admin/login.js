/**
 * POST /api/admin/login — Carine / Dani → Bearer de ADMIN_PANEL_SECRET
 */

import { loginGamesAdmin } from '../../_lib/admin-auth.mjs';
import { getCorsHeaders, validateOrigin } from '../../_lib/http-helpers.mjs';

function json(headers, body, status = 200) {
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return Response.json(body, { status, headers });
}

export async function onRequestOptions(context) {
  return new Response(null, { status: 204, headers: getCorsHeaders(context.request) });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const headers = getCorsHeaders(request);

  const originCheck = validateOrigin(request);
  if (!originCheck.valid) {
    return json(headers, { ok: false, error: 'ORIGIN_DENIED', message: originCheck.error }, 403);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json(headers, { ok: false, error: 'INVALID_JSON' }, 400);
  }

  const result = loginGamesAdmin(env, body?.user, body?.pass);
  if (!result.ok) {
    return json(headers, { ok: false, error: result.error, message: result.message }, result.status);
  }
  return json(headers, { ok: true, token: result.token });
}
