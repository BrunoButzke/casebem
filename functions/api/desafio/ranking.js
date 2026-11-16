/**
 * Público — placar ao vivo dos desafios
 */

import { getCorsHeaders, validateOrigin } from '../../_lib/http-helpers.mjs';
import { listRanking, upsertRanking } from '../../_lib/ranking-service.mjs';

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
  try {
    const rows = await listRanking(env.DB || null);
    return json(headers, { ok: true, rows });
  } catch (err) {
    return json(headers, { ok: false, error: 'RANKING_FAILED', message: err.message }, 500);
  }
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
  try {
    const rows = await upsertRanking(env.DB || null, body);
    return json(headers, { ok: true, rows });
  } catch (err) {
    if (err.message === 'VALIDATION') {
      return json(headers, { ok: false, error: 'VALIDATION', details: err.details }, 400);
    }
    return json(headers, { ok: false, error: 'RANKING_FAILED', message: err.message }, 500);
  }
}
