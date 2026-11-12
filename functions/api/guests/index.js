/**
 * Lista oculta de convidados — /api/guests
 * GET  — lista completa (página /lista)
 * POST — { names: string[] } adicionar
 * DELETE — ?id=... remover
 *
 * Sem auth por enquanto (URL oculta). Trocar por admin token depois.
 */

import { getCorsHeaders, validateOrigin } from '../../_lib/http-helpers.mjs';
import {
  listGuestList,
  addGuests,
  removeGuest,
} from '../../_lib/rsvp-guest-list.mjs';

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
  headers.set('Cache-Control', 'no-store');

  try {
    const guests = await listGuestList(env.DB || null);
    return json(headers, { ok: true, guests, count: guests.length });
  } catch (err) {
    return json(headers, { ok: false, error: 'LIST_FAILED', message: err?.message }, 500);
  }
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
    return json(headers, { ok: false, error: 'INVALID_JSON' }, 400);
  }

  try {
    const result = await addGuests(env.DB || null, body?.names || []);
    const guests = await listGuestList(env.DB || null);
    return json(headers, { ok: true, ...result, guests });
  } catch (err) {
    if (err.message === 'EMPTY_GUEST_LIST') {
      return json(headers, { ok: false, error: 'EMPTY_GUEST_LIST', message: 'Informe names: string[]' }, 400);
    }
    if (err.message === 'GUEST_LIST_TOO_LARGE') {
      return json(headers, { ok: false, error: 'GUEST_LIST_TOO_LARGE', message: 'Máximo 500 nomes por vez' }, 400);
    }
    return json(headers, { ok: false, error: 'ADD_FAILED', message: err.message }, 500);
  }
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  const headers = getCorsHeaders(request);

  const originCheck = validateOrigin(request);
  if (!originCheck.valid) {
    return json(headers, { ok: false, error: 'ORIGIN_DENIED', message: originCheck.error }, 403);
  }

  const id = new URL(request.url).searchParams.get('id');
  try {
    await removeGuest(env.DB || null, id);
    const guests = await listGuestList(env.DB || null);
    return json(headers, { ok: true, removed: id, guests });
  } catch (err) {
    if (err.message === 'GUEST_NOT_FOUND' || err.message === 'INVALID_GUEST_ID') {
      return json(headers, { ok: false, error: err.message }, 404);
    }
    return json(headers, { ok: false, error: 'DELETE_FAILED', message: err.message }, 500);
  }
}
