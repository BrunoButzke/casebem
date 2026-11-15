/**
 * GET /api/guests/search?q=bruno — busca parcial na lista oculta (público)
 */

import { getCorsHeaders } from '../../_lib/http-helpers.mjs';
import { searchGuests } from '../../_lib/rsvp-guest-list.mjs';
import { slugFromRequest, resolvePublicSlugOrPartner } from '../../_lib/public-slug.mjs';

export async function onRequestOptions(context) {
  return new Response(null, { status: 204, headers: getCorsHeaders(context.request) });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const headers = getCorsHeaders(request);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');

  const q = new URL(request.url).searchParams.get('q') || '';
  if (String(q).trim().length < 2) {
    return Response.json(
      { ok: false, error: 'QUERY_TOO_SHORT', message: 'Digite pelo menos 2 letras para buscar.' },
      { status: 400, headers }
    );
  }

  try {
    const slug = slugFromRequest(request);
    const resolved = await resolvePublicSlugOrPartner(env.DB || null, slug);
    if (!resolved.ok) {
      return Response.json({ error: resolved.error }, { status: resolved.status, headers });
    }
    const matches = await searchGuests(env.DB || null, q, resolved.account.id);
    return Response.json(
      {
        ok: true,
        query: q,
        count: matches.length,
        matches: matches.map((g) => ({
          id: g.id,
          displayName: g.displayName,
        })),
      },
      { status: 200, headers }
    );
  } catch (err) {
    return Response.json(
      { ok: false, error: 'SEARCH_FAILED', message: err?.message || 'error' },
      { status: 500, headers }
    );
  }
}
