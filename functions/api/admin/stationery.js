/**
 * Admin papelaria
 * GET — lista completa + preview
 * PATCH — { id, title?, body?, kind?, active?, sortOrder? }
 */

import { requireAdmin } from '../../_lib/admin-auth.mjs';
import { getCorsHeaders, validateOrigin } from '../../_lib/http-helpers.mjs';
import {
  listStationeryAdmin,
  presentStationery,
  updateStationeryTemplate,
} from '../../_lib/stationery-service.mjs';

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
    const origin = request.headers.get('Origin') || new URL(request.url).origin;
    const raw = await listStationeryAdmin(env.DB);
    const templates = presentStationery(raw, origin);
    return json(headers, { ok: true, templates });
  } catch (err) {
    return json(headers, { ok: false, error: 'LIST_FAILED', message: err.message }, 500);
  }
}

export async function onRequestPatch(context) {
  const { request, env } = context;
  const headers = getCorsHeaders(request);

  const originCheck = validateOrigin(request);
  if (!originCheck.valid) {
    return json(headers, { ok: false, error: 'ORIGIN_DENIED', message: originCheck.error }, 403);
  }

  const auth = requireAdmin(request, env);
  if (!auth.ok) return json(headers, { ok: false, error: auth.error, message: auth.message }, auth.status);
  if (!env.DB) return json(headers, { ok: false, error: 'DB_NOT_CONFIGURED' }, 503);

  let body;
  try {
    body = await request.json();
  } catch {
    return json(headers, { ok: false, error: 'INVALID_JSON' }, 400);
  }

  if (!body?.id) {
    return json(headers, { ok: false, error: 'MISSING_ID' }, 400);
  }

  try {
    const template = await updateStationeryTemplate(env.DB, String(body.id), body);
    const origin = request.headers.get('Origin') || new URL(request.url).origin;
    const [presented] = presentStationery([template], origin);
    return json(headers, { ok: true, template: presented });
  } catch (err) {
    if (err.message === 'TEMPLATE_NOT_FOUND') {
      return json(headers, { ok: false, error: 'TEMPLATE_NOT_FOUND' }, 404);
    }
    if (err.message === 'VALIDATION') {
      return json(headers, { ok: false, error: 'VALIDATION', details: err.details }, 400);
    }
    if (err.message === 'EMPTY_PATCH') {
      return json(headers, { ok: false, error: 'EMPTY_PATCH' }, 400);
    }
    return json(headers, { ok: false, error: 'UPDATE_FAILED', message: err.message }, 500);
  }
}
