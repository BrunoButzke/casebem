/**
 * Admin lodging tips
 * GET — lista completa
 * POST — cria dica { name, description, area?, mapsUrl?, websiteUrl?, sortOrder? }
 * PATCH — { id, ...fields } atualiza / desativa
 */

import { requireAdmin } from '../../_lib/admin-auth.mjs';
import { getCorsHeaders, validateOrigin } from '../../_lib/http-helpers.mjs';
import {
  listLodgingAdmin,
  createLodgingTip,
  updateLodgingTip,
} from '../../_lib/lodging-service.mjs';

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
    const tips = await listLodgingAdmin(env.DB);
    return json(headers, { ok: true, tips });
  } catch (err) {
    return json(headers, { ok: false, error: 'LIST_FAILED', message: err.message }, 500);
  }
}

export async function onRequestPost(context) {
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

  try {
    const tip = await createLodgingTip(env.DB, body || {});
    return json(headers, { ok: true, tip }, 201);
  } catch (err) {
    if (err.message === 'VALIDATION') {
      return json(headers, { ok: false, error: 'VALIDATION', details: err.details }, 400);
    }
    return json(headers, { ok: false, error: 'CREATE_FAILED', message: err.message }, 500);
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
    const tip = await updateLodgingTip(env.DB, String(body.id), body);
    return json(headers, { ok: true, tip });
  } catch (err) {
    if (err.message === 'TIP_NOT_FOUND') {
      return json(headers, { ok: false, error: 'TIP_NOT_FOUND' }, 404);
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
