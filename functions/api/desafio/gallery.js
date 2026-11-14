/**
 * Público — lista e envio das fotos da galeria (bytes no R2)
 */

import { getCorsHeaders, validateOrigin } from '../../_lib/http-helpers.mjs';
import { deleteGalleryPhoto, listGalleryPhotos, parseGalleryUpload, upsertGalleryPhoto } from '../../_lib/gallery-service.mjs';

function json(headers, body, status = 200) {
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return Response.json(body, { status, headers });
}

function galleryEnv(env) {
  return { db: env.DB || null, bucket: env.GALLERY || env.R2 || null };
}

export async function onRequestOptions(context) {
  return new Response(null, { status: 204, headers: getCorsHeaders(context.request) });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const headers = getCorsHeaders(request);
  try {
    const photos = await listGalleryPhotos(galleryEnv(env).db);
    return json(headers, { ok: true, photos });
  } catch (err) {
    return json(headers, { ok: false, error: 'GALLERY_FAILED', message: err.message }, 500);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const headers = getCorsHeaders(request);
  const originCheck = validateOrigin(request);
  if (!originCheck.valid) {
    return json(headers, { ok: false, error: 'ORIGIN_DENIED', message: originCheck.error }, 403);
  }
  let payload;
  try {
    payload = await parseGalleryUpload(request);
  } catch {
    return json(headers, { ok: false, error: 'INVALID_JSON' }, 400);
  }
  try {
    const { db, bucket } = galleryEnv(env);
    const photo = await upsertGalleryPhoto(db, payload, bucket);
    return json(headers, { ok: true, photo }, 201);
  } catch (err) {
    if (err.message === 'VALIDATION') {
      return json(headers, { ok: false, error: 'VALIDATION', details: err.details }, 400);
    }
    if (err.message === 'GALLERY_UNAVAILABLE') {
      return json(headers, { ok: false, error: 'GALLERY_UNAVAILABLE', message: 'R2 GALLERY binding ausente' }, 503);
    }
    return json(headers, { ok: false, error: 'GALLERY_FAILED', message: err.message }, 500);
  }
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  const headers = getCorsHeaders(request);
  const originCheck = validateOrigin(request);
  if (!originCheck.valid) {
    return json(headers, { ok: false, error: 'ORIGIN_DENIED', message: originCheck.error }, 403);
  }
  const url = new URL(request.url);
  try {
    const { db, bucket } = galleryEnv(env);
    await deleteGalleryPhoto(
      db,
      {
        id: url.searchParams.get('id'),
        guestName: url.searchParams.get('guestName'),
        missionId: url.searchParams.get('missionId'),
      },
      bucket
    );
    return json(headers, { ok: true, removed: true });
  } catch (err) {
    if (err.message === 'NOT_FOUND') return json(headers, { ok: false, error: 'NOT_FOUND' }, 404);
    if (err.message === 'INVALID_ID') return json(headers, { ok: false, error: 'INVALID_ID' }, 400);
    return json(headers, { ok: false, error: 'GALLERY_FAILED', message: err.message }, 500);
  }
}
