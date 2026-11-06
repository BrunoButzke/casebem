/**
 * GET /api/media — playlist/vídeos ativos (público)
 */

import { getActiveMedia } from '../_lib/media-service.mjs';
import { getCorsHeaders } from '../_lib/http-helpers.mjs';

export async function onRequestOptions(context) {
  return new Response(null, { status: 204, headers: getCorsHeaders(context.request) });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const headers = getCorsHeaders(request);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'public, max-age=30');

  try {
    const items = await getActiveMedia(env.DB || null);
    return Response.json(
      {
        ok: true,
        items: items.map((i) => ({
          id: i.id,
          title: i.title,
          youtubeUrl: i.youtubeUrl,
          videoId: i.videoId,
          embedUrl: i.embedUrl,
        })),
      },
      { status: 200, headers }
    );
  } catch (err) {
    return Response.json(
      { ok: false, error: 'MEDIA_FAILED', message: err?.message || 'error' },
      { status: 500, headers }
    );
  }
}
