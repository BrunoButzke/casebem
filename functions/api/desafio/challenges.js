/**
 * Público — catálogo do jogo (quiz, fotos, cartões) sem gabarito
 */

import { getCorsHeaders } from '../../_lib/http-helpers.mjs';
import { listChallengesPublic } from '../../_lib/challenges-service.mjs';
import { slugFromRequest, resolvePublicSlugOrPartner } from '../../_lib/public-slug.mjs';

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
    const slug = slugFromRequest(request);
    const resolved = await resolvePublicSlugOrPartner(env.DB || null, slug);
    if (!resolved.ok) {
      return json(headers, { error: resolved.error }, resolved.status);
    }
    const catalog = await listChallengesPublic(env.DB || null, resolved.account.id);
    return json(headers, { ok: true, ...catalog });
  } catch (err) {
    return json(headers, { ok: false, error: 'CATALOG_FAILED', message: err.message }, 500);
  }
}
