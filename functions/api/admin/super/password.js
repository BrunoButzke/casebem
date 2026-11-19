/**
 * POST /api/admin/super/password — trocar senha do super admin
 * Body: { email, currentPassword, newPassword, newPasswordConfirm }
 * Auth: Bearer super admin
 */

import { requireSuperAdmin, changeSuperAdminPassword } from '../../../_lib/super-admin.mjs';
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

  try {
    const result = await changeSuperAdminPassword(env.DB || null, {
      email: body?.email,
      currentPassword: body?.currentPassword ?? body?.currentPass,
      newPassword: body?.newPassword ?? body?.newPass,
      newPasswordConfirm: body?.newPasswordConfirm ?? body?.newPassConfirm,
    });
    if (!result.ok) {
      return json(headers, { ok: false, error: result.error, message: result.message }, result.status);
    }
    return json(headers, { ok: true, email: result.email });
  } catch (err) {
    console.error('changeSuperAdminPassword failed', err?.message || err);
    return json(
      headers,
      { ok: false, error: 'PASSWORD_CHANGE_FAILED', message: err?.message || 'error' },
      500
    );
  }
}
