/**
 * PATCH /api/admin/messages — hide/unhide mural message
 * Body: { id, hidden: boolean }
 * Auth: Bearer ADMIN_PANEL_SECRET
 */

import { requireAdmin } from '../../_lib/admin-auth.mjs';
import { setMessageHidden } from '../../_lib/admin-service.mjs';
import { getCorsHeaders, validateOrigin } from '../../_lib/http-helpers.mjs';

export async function onRequestOptions(context) {
  return new Response(null, { status: 204, headers: getCorsHeaders(context.request) });
}

export async function onRequestPatch(context) {
  const { request, env } = context;
  const headers = getCorsHeaders(request);
  headers.set('Content-Type', 'application/json; charset=utf-8');

  const originCheck = validateOrigin(request);
  if (!originCheck.valid) {
    return Response.json(
      { ok: false, error: 'ORIGIN_DENIED', message: originCheck.error },
      { status: 403, headers }
    );
  }

  const auth = requireAdmin(request, env);
  if (!auth.ok) {
    return Response.json(
      { ok: false, error: auth.error, message: auth.message },
      { status: auth.status, headers }
    );
  }

  if (!env.DB) {
    return Response.json({ ok: false, error: 'DB_NOT_CONFIGURED' }, { status: 503, headers });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'INVALID_JSON' }, { status: 400, headers });
  }

  if (!body?.id || typeof body.hidden !== 'boolean') {
    return Response.json(
      { ok: false, error: 'INVALID_BODY', message: 'Informe id e hidden (boolean).' },
      { status: 400, headers }
    );
  }

  try {
    const updated = await setMessageHidden(env.DB, String(body.id), body.hidden);
    return Response.json({ ok: true, message: updated }, { status: 200, headers });
  } catch (err) {
    if (err.message === 'MESSAGE_NOT_FOUND') {
      return Response.json({ ok: false, error: 'MESSAGE_NOT_FOUND' }, { status: 404, headers });
    }
    return Response.json(
      { ok: false, error: 'UPDATE_FAILED', message: err.message },
      { status: 500, headers }
    );
  }
}
