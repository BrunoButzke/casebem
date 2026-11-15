/**
 * Público — bytes da foto no R2 (ou fallback D1 legado)
 */

import { getCorsHeaders } from '../../../../_lib/http-helpers.mjs';
import { getGalleryImage } from '../../../../_lib/gallery-service.mjs';
import { slugFromRequest, resolvePublicSlugOrPartner } from '../../../../_lib/public-slug.mjs';

export async function onRequestOptions(context) {
  return new Response(null, { status: 204, headers: getCorsHeaders(context.request) });
}

export async function onRequestGet(context) {
  const { request, env, params } = context;
  const headers = getCorsHeaders(request);
  try {
    const resolved = await resolvePublicSlugOrPartner(env.DB || null, slugFromRequest(request));
    if (!resolved.ok) {
      headers.set('Content-Type', 'application/json; charset=utf-8');
      return Response.json({ error: resolved.error }, { status: resolved.status, headers });
    }
    const image = await getGalleryImage(
      env.DB || null,
      String(params?.id || ''),
      env.GALLERY || env.R2 || null,
      resolved.account.id
    );
    headers.set('Content-Type', image.contentType || 'image/jpeg');
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    return new Response(image.bytes, { status: 200, headers });
  } catch (err) {
    headers.set('Content-Type', 'application/json; charset=utf-8');
    if (err.message === 'NOT_FOUND') return Response.json({ ok: false, error: 'NOT_FOUND' }, { status: 404, headers });
    if (err.message === 'INVALID_ID') return Response.json({ ok: false, error: 'INVALID_ID' }, { status: 400, headers });
    return Response.json({ ok: false, error: 'GALLERY_FAILED', message: err.message }, { status: 500, headers });
  }
}
