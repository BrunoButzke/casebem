/**
 * Público — estado do sorteio ao vivo para telões
 * GET /api/desafio/raffle/draw-broadcast
 */

import { getCorsHeaders } from '../../../_lib/http-helpers.mjs';
import { getDrawBroadcast } from '../../../_lib/draw-broadcast-service.mjs';

function json(headers, body, status = 200) {
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return Response.json(body, { status, headers });
}

export async function onRequestOptions(context) {
  return new Response(null, { status: 204, headers: getCorsHeaders(context.request) });
}

export async function onRequestGet(context) {
  const { env } = context;
  const headers = getCorsHeaders(context.request);
  try {
    const broadcast = await getDrawBroadcast(env.DB || null);
    return json(headers, { ok: true, broadcast });
  } catch (err) {
    return json(headers, { ok: false, error: 'BROADCAST_FAILED', message: err.message }, 500);
  }
}
