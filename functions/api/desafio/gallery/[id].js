/**
 * Público — metadados de uma foto da galeria
 */

import { getCorsHeaders } from '../../../_lib/http-helpers.mjs';
import { getGalleryPhoto } from '../../../_lib/gallery-service.mjs';

function json(headers, body, status = 200) {
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return Response.json(body, { status, headers });
}

export async function onRequestOptions(context) {
  return new Response(null, { status: 204, headers: getCorsHeaders(context.request) });
}

export async function onRequestGet(context) {
  const { request, env, params } = context;
  const headers = getCorsHeaders(request);
  try {
    const photo = await getGalleryPhoto(env.DB || null, String(params?.id || ''));
    return json(headers, { ok: true, photo });
  } catch (err) {
    if (err.message === 'NOT_FOUND') return json(headers, { ok: false, error: 'NOT_FOUND' }, 404);
    if (err.message === 'INVALID_ID') return json(headers, { ok: false, error: 'INVALID_ID' }, 400);
    return json(headers, { ok: false, error: 'GALLERY_FAILED', message: err.message }, 500);
  }
}
