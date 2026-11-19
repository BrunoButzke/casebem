/**
 * GET /api/wedding?w=slug — meta pública do casamento (nome + em breve)
 */

import { getCorsHeaders } from '../_lib/http-helpers.mjs';
import { getTenantById } from '../_lib/tenant-service.mjs';
import {
  listSiteSectionsAdmin,
  siteHasFilledContent,
} from '../_lib/site-page-service.mjs';
import {
  PUBLISHED_WEDDING_KEY,
  coupleNamesFallbackFromSlug,
  isPublishedWeddingSite,
  weddingKeyFromPathname,
} from '../_lib/wedding-path.mjs';

function json(headers, body, status = 200) {
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'public, max-age=30');
  return Response.json(body, { status, headers });
}

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
  const weddingKey = resolveWeddingKey(request);

  try {
    const [tenant, sections] = await Promise.all([
      getTenantById(env.DB || null, weddingKey),
      listSiteSectionsAdmin(env.DB || null, weddingKey),
    ]);
    const coupleNames =
      tenant?.coupleNames ||
      (weddingKey === PUBLISHED_WEDDING_KEY
        ? 'Dani & Carine'
        : coupleNamesFallbackFromSlug(weddingKey));
    const hasContent = siteHasFilledContent(sections);
    const comingSoon = !isPublishedWeddingSite(weddingKey) && !hasContent;

    const plan =
      tenant?.plan ||
      (isPublishedWeddingSite(weddingKey) ? 'vip' : 'basic');

    const rodape = sections.find((s) => s.sectionKey === 'rodape')?.content || {};
    const fromNames = String(coupleNames || '')
      .split('&')
      .map((s) => s.trim())
      .filter(Boolean);
    const initialLeft = String(rodape.initialLeft || fromNames[0]?.[0] || '').toUpperCase().slice(0, 1);
    const initialRight = String(rodape.initialRight || fromNames[1]?.[0] || '').toUpperCase().slice(0, 1);

    return json(headers, {
      ok: true,
      weddingKey,
      coupleNames,
      plan,
      comingSoon,
      hasSiteContent: hasContent,
      initialLeft,
      initialRight,
      sitePath: tenant?.sitePath || `/${weddingKey}/`,
      adminPath: tenant?.adminPath || `/${weddingKey}/admin`,
    });
  } catch (err) {
    return json(
      headers,
      { ok: false, error: 'WEDDING_LOOKUP_FAILED', message: err?.message || 'error' },
      500
    );
  }
}
