/**
 * GET /api/admin/gifts.csv — export presentes (pagos por padrão)
 * Query: ?all=1 inclui pendentes
 * Auth: Authorization: Bearer $ADMIN_PANEL_SECRET
 */

import { requireAdmin } from '../../_lib/admin-auth.mjs';
import { listGiftsAdmin, giftsToCsv } from '../../_lib/admin-service.mjs';
import { getCorsHeaders } from '../../_lib/http-helpers.mjs';

export async function onRequestOptions(context) {
  return new Response(null, { status: 204, headers: getCorsHeaders(context.request) });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const cors = getCorsHeaders(request);

  const auth = requireAdmin(request, env);
  if (!auth.ok) {
    cors.set('Content-Type', 'application/json; charset=utf-8');
    return Response.json(
      { ok: false, error: auth.error, message: auth.message },
      { status: auth.status, headers: cors }
    );
  }

  if (!env.DB) {
    cors.set('Content-Type', 'application/json; charset=utf-8');
    return Response.json({ ok: false, error: 'DB_NOT_CONFIGURED' }, { status: 503, headers: cors });
  }

  const url = new URL(request.url);
  const paidOnly = url.searchParams.get('all') !== '1';
  const gifts = await listGiftsAdmin(env.DB, { limit: 500, paidOnly });
  const csv = giftsToCsv(gifts);

  cors.set('Content-Type', 'text/csv; charset=utf-8');
  cors.set(
    'Content-Disposition',
    `attachment; filename="${paidOnly ? 'presentes-pagos' : 'presentes-todos'}-dani-carine.csv"`
  );
  return new Response(csv, { status: 200, headers: cors });
}
