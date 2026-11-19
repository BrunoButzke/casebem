/**
 * POST /api/admin/super/enter — super admin abre o painel de um tenant
 * Body: { tenantId }
 * Auth: Bearer super admin
 */

import { requireSuperAdmin, enterTenantAsSuper } from '../../../_lib/super-admin.mjs';
import { getCorsHeaders, validateOrigin } from '../../../_lib/http-helpers.mjs';

function json(headers, body, status = 200) {
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return Response.json(body, { status, headers });
}

export async function onRequestOptions(context) {
  return new Response(null, { status: 204, headers: getCorsHeaders(context.request) });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const headers = getCorsHeaders(request);

  const originCheck = validateOrigin(request);
  if (!originCheck.valid) {
    return json(headers, { ok: false, error: 'ORIGIN_DENIED', message: originCheck.error }, 403);
  }

  const auth = requireSuperAdmin(request, env);
  if (!auth.ok) {
    return json(headers, { ok: false, error: auth.error, message: auth.message }, auth.status);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json(headers, { ok: false, error: 'INVALID_JSON' }, 400);
  }

  const result = await enterTenantAsSuper(env, body?.tenantId);
  if (!result.ok) {
    return json(headers, { ok: false, error: result.error, message: result.message }, result.status);
  }

  return json(headers, {
    ok: true,
    token: result.token,
    role: result.role,
    weddingKey: result.weddingKey,
    adminPath: result.adminPath,
    coupleNames: result.coupleNames,
  });
}
