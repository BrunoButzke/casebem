/**
 * Público — catálogo do jogo (quiz, fotos, cartões) sem gabarito
 */

import { getCorsHeaders } from '../../_lib/http-helpers.mjs';
import { listChallengesPublic } from '../../_lib/challenges-service.mjs';

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
    const catalog = await listChallengesPublic(env.DB || null);
    return json(headers, { ok: true, ...catalog });
  } catch (err) {
    return json(headers, { ok: false, error: 'CATALOG_FAILED', message: err.message }, 500);
  }
}
