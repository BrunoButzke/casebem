/**
 * Admin rifas — GET / POST / PATCH { id } / DELETE ?id=
 */

import { requireAdmin } from '../../_lib/admin-auth.mjs';
import { getCorsHeaders, validateOrigin } from '../../_lib/http-helpers.mjs';
import {
  listRafflesAdmin,
  listRaffleSalesAdmin,
  createRaffle,
  updateRaffle,
  deleteRaffle,
} from '../../_lib/raffle-service.mjs';

function json(headers, body, status = 200) {
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return Response.json(body, { status, headers });
}

function mapWriteError(headers, err) {
  if (err.message === 'NOT_FOUND') {
    return json(headers, { ok: false, error: 'NOT_FOUND' }, 404);
  }
  if (err.message === 'EXISTS') {
    return json(headers, { ok: false, error: 'EXISTS', message: 'Já existe uma rifa com este id' }, 409);
  }
  if (err.message === 'VALIDATION') {
    return json(headers, { ok: false, error: 'VALIDATION', details: err.details }, 400);
  }
  if (err.message === 'EMPTY_PATCH') {
    return json(headers, { ok: false, error: 'EMPTY_PATCH' }, 400);
  }
  if (err.message === 'INVALID_ID') {
    return json(headers, { ok: false, error: 'INVALID_ID' }, 400);
  }
  return json(headers, { ok: false, error: 'WRITE_FAILED', message: err.message }, 500);
}

export async function onRequestOptions(context) {
  return new Response(null, { status: 204, headers: getCorsHeaders(context.request) });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const headers = getCorsHeaders(request);
  const auth = await requireAdmin(request, env);
  if (!auth.ok) return json(headers, { ok: false, error: auth.error, message: auth.message }, auth.status);
  if (!env.DB) return json(headers, { ok: false, error: 'DB_NOT_CONFIGURED' }, 503);

  try {
    const wk = auth.weddingKey;
    const [raffles, sales] = await Promise.all([
      listRafflesAdmin(env.DB, wk),
      listRaffleSalesAdmin(env.DB, {}, wk),
    ]);
    return json(headers, { ok: true, raffles, sales, weddingKey: wk });
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

  const auth = await requireAdmin(request, env);
  if (!auth.ok) return json(headers, { ok: false, error: auth.error, message: auth.message }, auth.status);
  if (!env.DB) return json(headers, { ok: false, error: 'DB_NOT_CONFIGURED' }, 503);

  let body;
  try {
    body = await request.json();
  } catch {
    return json(headers, { ok: false, error: 'INVALID_JSON' }, 400);
  }

  try {
    const wk = auth.weddingKey;
    const raffle = await createRaffle(env.DB, body || {}, wk);
    const raffles = await listRafflesAdmin(env.DB, wk);
    return json(headers, { ok: true, raffle, raffles }, 201);
  } catch (err) {
    return mapWriteError(headers, err);
  }
}

export async function onRequestPatch(context) {
  const { request, env } = context;
  const headers = getCorsHeaders(request);

  const originCheck = validateOrigin(request);
  if (!originCheck.valid) {
    return json(headers, { ok: false, error: 'ORIGIN_DENIED', message: originCheck.error }, 403);
  }

  const auth = await requireAdmin(request, env);
  if (!auth.ok) return json(headers, { ok: false, error: auth.error, message: auth.message }, auth.status);
  if (!env.DB) return json(headers, { ok: false, error: 'DB_NOT_CONFIGURED' }, 503);

  let body;
  try {
    body = await request.json();
  } catch {
    return json(headers, { ok: false, error: 'INVALID_JSON' }, 400);
  }

  if (!body?.id) return json(headers, { ok: false, error: 'MISSING_ID' }, 400);

  try {
    const raffle = await updateRaffle(env.DB, String(body.id), body, auth.weddingKey);
    return json(headers, { ok: true, raffle });
  } catch (err) {
    return mapWriteError(headers, err);
  }
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  const headers = getCorsHeaders(request);

  const originCheck = validateOrigin(request);
  if (!originCheck.valid) {
    return json(headers, { ok: false, error: 'ORIGIN_DENIED', message: originCheck.error }, 403);
  }

  const auth = await requireAdmin(request, env);
  if (!auth.ok) return json(headers, { ok: false, error: auth.error, message: auth.message }, auth.status);
  if (!env.DB) return json(headers, { ok: false, error: 'DB_NOT_CONFIGURED' }, 503);

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return json(headers, { ok: false, error: 'MISSING_ID' }, 400);

  try {
    const wk = auth.weddingKey;
    await deleteRaffle(env.DB, id, wk);
    const raffles = await listRafflesAdmin(env.DB, wk);
    return json(headers, { ok: true, removed: id, raffles });
  } catch (err) {
    return mapWriteError(headers, err);
  }
}
