/**
 * Admin — broadcast do sorteio ao vivo
 * PUT /api/admin/raffles/draw/broadcast
 * GET /api/admin/raffles/draw/broadcast
 */

import { requireAdmin } from '../../../../_lib/admin-auth.mjs';
import { getCorsHeaders } from '../../../../_lib/http-helpers.mjs';
import {
  getDrawBroadcast,
  upsertDrawBroadcast,
} from '../../../../_lib/draw-broadcast-service.mjs';

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
  const auth = await requireAdmin(request, env);
  if (!auth.ok) return json(headers, { ok: false, error: auth.error, message: auth.message }, auth.status);

  try {
    const broadcast = await getDrawBroadcast(env.DB || null, auth.weddingKey);
    return json(headers, { ok: true, broadcast });
  } catch (err) {
    return json(headers, { ok: false, error: 'GET_FAILED', message: err.message }, 500);
  }
}

export async function onRequestPut(context) {
  const { request, env } = context;
  const headers = getCorsHeaders(request);
  const auth = await requireAdmin(request, env);
  if (!auth.ok) return json(headers, { ok: false, error: auth.error, message: auth.message }, auth.status);

  let body;
  try {
    body = await request.json();
  } catch {
    return json(headers, { ok: false, error: 'INVALID_JSON' }, 400);
  }

  try {
    const broadcast = await upsertDrawBroadcast(env.DB || null, body || {}, auth.weddingKey);
    return json(headers, { ok: true, broadcast });
  } catch (err) {
    if (
      err.message === 'INVALID_PHASE' ||
      err.message === 'MISSING_WINNER' ||
      err.message === 'MISSING_RAFFLE_ID' ||
      err.message === 'MISSING_POOL' ||
      err.message === 'VALIDATION'
    ) {
      return json(headers, { ok: false, error: err.message, details: err.details }, 400);
    }
    return json(headers, { ok: false, error: 'UPSERT_FAILED', message: err.message }, 500);
  }
}
