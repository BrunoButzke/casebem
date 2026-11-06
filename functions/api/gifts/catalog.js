/**
 * GET /api/gifts/catalog — catálogo ativo (público)
 * Free-tier: D1 read + seed from static fallback
 */

import { getActiveCatalog } from '../../_lib/catalog-service.mjs';
import { getCorsHeaders } from '../../_lib/http-helpers.mjs';

export async function onRequestOptions(context) {
  return new Response(null, { status: 204, headers: getCorsHeaders(context.request) });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const headers = getCorsHeaders(request);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'public, max-age=30');

  try {
    const catalog = await getActiveCatalog(env.DB || null);
    return Response.json(
      {
        ok: true,
        gifts: catalog.map((g) => ({
          id: g.id,
          name: g.name,
          description: g.description,
          priceInCents: g.priceInCents,
          imageUrl: g.imageUrl,
          mode: g.mode,
        })),
      },
      { status: 200, headers }
    );
  } catch (err) {
    return Response.json(
      { ok: false, error: 'CATALOG_FAILED', message: err?.message || 'error' },
      { status: 500, headers }
    );
  }
}
