/**
 * GET /api/site-page?w=slug — seções ativas + conteúdo (público)
 */

import { getCorsHeaders } from '../_lib/http-helpers.mjs';
import { listSiteSectionsPublic } from '../_lib/site-page-service.mjs';
import {
  PUBLISHED_WEDDING_KEY,
  weddingKeyFromPathname,
} from '../_lib/wedding-path.mjs';

function resolveWeddingKey(request) {
  const url = new URL(request.url);
  const fromQuery = String(url.searchParams.get('w') || url.searchParams.get('wedding') || '')
    .trim()
    .toLowerCase();
  if (fromQuery) return fromQuery;

  const referer = request.headers.get('Referer') || '';
  if (referer) {
    try {
      return weddingKeyFromPathname(new URL(referer).pathname);
    } catch {
      /* ignore */
    }
  }
  return PUBLISHED_WEDDING_KEY;
}

export async function onRequestOptions(context) {
  return new Response(null, { status: 204, headers: getCorsHeaders(context.request) });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const headers = getCorsHeaders(request);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'public, max-age=30');

  try {
    const weddingKey = resolveWeddingKey(request);
    const sections = await listSiteSectionsPublic(env.DB || null, weddingKey);
    return Response.json(
      { ok: true, weddingKey, sections },
      { status: 200, headers }
    );
  } catch (err) {
    return Response.json(
      { ok: false, error: 'SITE_PAGE_FAILED', message: err?.message || 'error' },
      { status: 500, headers }
    );
  }
}
