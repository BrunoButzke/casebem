/**
 * GET /api/admin/rsvps.csv — export RSVP list as CSV
 * Auth: Authorization: Bearer $ADMIN_PANEL_SECRET
 */

import { requireAdmin } from '../../_lib/admin-auth.mjs';
import { listRsvps, rsvpsToCsv } from '../../_lib/admin-service.mjs';
import { getCorsHeaders } from '../../_lib/http-helpers.mjs';

export async function onRequestOptions(context) {
  return new Response(null, { status: 204, headers: getCorsHeaders(context.request) });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const cors = getCorsHeaders(request);

  const auth = await requireAdmin(request, env);
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

  const rsvps = await listRsvps(env.DB, { limit: 500, weddingKey: auth.weddingKey });
  const csv = rsvpsToCsv(rsvps);

  cors.set('Content-Type', 'text/csv; charset=utf-8');
  cors.set(
    'Content-Disposition',
    `attachment; filename="rsvps-${String(auth.weddingKey || 'wedding').replace(/[^a-z0-9-]/gi, '')}.csv"`
  );
  return new Response(csv, { status: 200, headers: cors });
}
