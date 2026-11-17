/**
 * Público — sorteio ativo
 */

import { getCorsHeaders } from '../../_lib/http-helpers.mjs';
import { getActiveRafflePublic } from '../../_lib/raffle-service.mjs';

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
    const raffle = await getActiveRafflePublic(env.DB || null);
    if (!raffle) {
      return json(headers, { ok: false, error: 'NO_ACTIVE_RAFFLE', message: 'Nenhum sorteio ativo' }, 404);
    }
    return json(headers, { ok: true, raffle });
  } catch (err) {
    return json(headers, { ok: false, error: 'RAFFLE_FAILED', message: err.message }, 500);
  }
}
