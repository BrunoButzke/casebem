/**
 * GET /api/lodging — dicas de hospedagem ativas (público)
 * Free-tier: D1 read + seed from static fallback
 */

import { getActiveLodging } from '../_lib/lodging-service.mjs';
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
    const tips = await getActiveLodging(env.DB || null);
    return Response.json(
      {
        ok: true,
        tips: tips.map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          area: t.area,
          mapsUrl: t.mapsUrl,
          websiteUrl: t.websiteUrl,
        })),
      },
      { status: 200, headers }
    );
  } catch (err) {
    return Response.json(
      { ok: false, error: 'LODGING_FAILED', message: err?.message || 'error' },
      { status: 500, headers }
    );
  }
}
