/**
 * Admin — números vendidos da rifa ativa (sorteio)
 * GET /api/admin/raffles/draw
 */

import { requireAdmin } from '../../../_lib/admin-auth.mjs';
import { getCorsHeaders } from '../../../_lib/http-helpers.mjs';
import { listActiveRaffleSoldEntries } from '../../../_lib/raffle-service.mjs';

function json(headers, body, status = 200) {
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return Response.json(body, { status, headers });
}

export async function onRequestOptions(context) {
  return new Response(null, { status: 204, headers: getCorsHeaders(context.request) });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const headers = getCorsHeaders(request);
  const auth = requireAdmin(request, env);
  if (!auth.ok) return json(headers, { ok: false, error: auth.error, message: auth.message }, auth.status);
  if (!env.DB) return json(headers, { ok: false, error: 'DB_NOT_CONFIGURED' }, 503);

  try {
    const { raffle, entries } = await listActiveRaffleSoldEntries(env.DB);
    if (!raffle) {
      return json(headers, { ok: false, error: 'NO_ACTIVE_RAFFLE', message: 'Nenhuma rifa ativa' }, 404);
    }
    return json(headers, {
      ok: true,
      raffle: { id: raffle.id, name: raffle.name, totalNumbers: raffle.totalNumbers },
      entries,
    });
  } catch (err) {
    return json(headers, { ok: false, error: 'LIST_FAILED', message: err.message }, 500);
  }
}
