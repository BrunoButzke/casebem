/**
 * GET /api/guests/search?q=bruno — busca parcial na lista oculta (público)
 */

import { getCorsHeaders } from '../../_lib/http-helpers.mjs';
import { searchGuests } from '../../_lib/rsvp-guest-list.mjs';

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
    const matches = await searchGuests(env.DB || null, q);
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
