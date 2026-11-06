/**
 * GET /api/stationery — templates ativos + texto preenchido + link WhatsApp
 * Free-tier: D1 + seed estático
 */

import { getActiveStationery, presentStationery } from '../_lib/stationery-service.mjs';
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
    const origin = request.headers.get('Origin') || new URL(request.url).origin;
    const templates = await getActiveStationery(env.DB || null);
    const items = presentStationery(templates, origin);
    return Response.json(
      {
        ok: true,
        templates: items.map((t) => ({
          id: t.id,
          title: t.title,
          kind: t.kind,
          text: t.text,
          shareUrl: t.shareUrl,
        })),
      },
      { status: 200, headers }
    );
  } catch (err) {
    return Response.json(
      { ok: false, error: 'STATIONERY_FAILED', message: err?.message || 'error' },
      { status: 500, headers }
    );
  }
}
