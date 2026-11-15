/**
 * Admin — tema visual do desafio (paleta + cartão fidelidade)
 * GET / PATCH
 */

import { requireAccount } from '../../../_lib/session-auth.mjs';
import { getCorsHeaders, validateOrigin } from '../../../_lib/http-helpers.mjs';
import { getDesafioTheme, updateDesafioTheme } from '../../../_lib/desafio-theme-service.mjs';

function json(headers, body, status = 200) {
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return Response.json(body, { status, headers });
}

export async function onRequestOptions(context) {
  return new Response(null, { status: 204, headers: getCorsHeaders(context.request) });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const headers = getCorsHeaders(request);
  const auth = await requireAccount(request, env);
  if (!auth.ok) return json(headers, { ok: false, error: auth.error, message: auth.message }, auth.status);
  if (!env.DB) return json(headers, { ok: false, error: 'DB_NOT_CONFIGURED' }, 503);

  try {
    const theme = await getDesafioTheme(env.DB, auth.account.id);
    return json(headers, { ok: true, theme });
  } catch (err) {
    return json(headers, { ok: false, error: 'LIST_FAILED', message: err.message }, 500);
  }
}

export async function onRequestPatch(context) {
  const { request, env } = context;
  const headers = getCorsHeaders(request);

  const originCheck = validateOrigin(request);
  if (!originCheck.valid) {
    return json(headers, { ok: false, error: 'ORIGIN_DENIED', message: originCheck.error }, 403);
  }

  const auth = await requireAccount(request, env);
  if (!auth.ok) return json(headers, { ok: false, error: auth.error, message: auth.message }, auth.status);
  if (!env.DB) return json(headers, { ok: false, error: 'DB_NOT_CONFIGURED' }, 503);

  let body;
  try {
    body = await request.json();
  } catch {
    return json(headers, { ok: false, error: 'INVALID_JSON' }, 400);
  }

  try {
    const theme = await updateDesafioTheme(env.DB, auth.account.id, body || {});
    return json(headers, { ok: true, theme });
  } catch (err) {
    if (err.message === 'VALIDATION') {
      return json(headers, { ok: false, error: 'VALIDATION', details: err.details }, 400);
    }
    if (err.message === 'EMPTY_PATCH') {
      return json(headers, { ok: false, error: 'EMPTY_PATCH' }, 400);
    }
    return json(headers, { ok: false, error: 'WRITE_FAILED', message: err.message }, 500);
  }
}
