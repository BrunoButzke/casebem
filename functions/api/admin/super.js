/**
 * GET /api/admin/super — overview CaseBem (tenants + lista de espera)
 * Auth: Bearer super admin
 */

import { requireSuperAdmin, getSuperAdminOverview } from '../../_lib/super-admin.mjs';
import { getCorsHeaders } from '../../_lib/http-helpers.mjs';

export async function onRequestOptions(context) {
  return new Response(null, { status: 204, headers: getCorsHeaders(context.request) });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const headers = getCorsHeaders(request);
  headers.set('Content-Type', 'application/json; charset=utf-8');

  const auth = requireSuperAdmin(request, env);
  if (!auth.ok) {
    return Response.json(
      { ok: false, error: auth.error, message: auth.message },
      { status: auth.status, headers }
    );
  }

  try {
    const overview = await getSuperAdminOverview(env.DB || null);
    return Response.json({ ok: true, ...overview }, { status: 200, headers });
  } catch (err) {
    return Response.json(
      { ok: false, error: 'SUPER_QUERY_FAILED', message: err?.message || 'error' },
      { status: 500, headers }
    );
  }
}
