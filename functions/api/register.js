/**
 * POST /api/register — cadastro de casamento (tenant + acessos)
 */

import { getCorsHeaders, validateOrigin } from '../_lib/http-helpers.mjs';
import { registerWedding } from '../_lib/tenant-service.mjs';

function json(headers, body, status = 200) {
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return Response.json(body, { status, headers });
}

function mapError(err) {
  const map = {
    NAME_REQUIRED: 400,
    PARTNER_REQUIRED: 400,
    ROLE_INVALID: 400,
    EMAIL_INVALID: 400,
    PASSWORD_WEAK: 400,
    PASSWORD_MISMATCH: 400,
    EMAIL_TAKEN: 409,
    SLUG_EXHAUSTED: 409,
  };
  return {
    status: map[err.message] || 500,
    error: err.message || 'REGISTER_FAILED',
    message: err.details || err.message || 'Não foi possível concluir o cadastro.',
  };
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

  let body;
  try {
    body = await request.json();
  } catch {
    return json(headers, { ok: false, error: 'INVALID_JSON', message: 'JSON inválido.' }, 400);
  }

  try {
    const result = await registerWedding(env.DB || null, body);
    return json(headers, {
      ok: true,
      tenantId: result.tenant.id,
      coupleNames: result.tenant.coupleNames,
      role: result.role,
      adminPath: result.tenant.adminPath,
    });
  } catch (err) {
    const mapped = mapError(err);
    return json(headers, { ok: false, error: mapped.error, message: mapped.message }, mapped.status);
  }
}
