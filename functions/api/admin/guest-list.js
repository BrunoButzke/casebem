/**
 * Admin guest list + RSVP mode
 * GET  — list guests + mode
 * POST — { names: string[] } add guests
 * PATCH — { rsvpMode: 'open'|'closed' } and/or { removeId }
 * Auth: Bearer ADMIN_PANEL_SECRET
 */

import { requireAdmin } from '../../_lib/admin-auth.mjs';
import { getCorsHeaders, validateOrigin } from '../../_lib/http-helpers.mjs';
import {
  getRsvpMode,
  setRsvpMode,
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
  const auth = requireAdmin(request, env);
  if (!auth.ok) return json(headers, { ok: false, error: auth.error, message: auth.message }, auth.status);
  if (!env.DB) return json(headers, { ok: false, error: 'DB_NOT_CONFIGURED' }, 503);

  const [rsvpMode, guests] = await Promise.all([getRsvpMode(env.DB), listGuestList(env.DB)]);
  return json(headers, { ok: true, rsvpMode, guests, count: guests.length });
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
    const result = await addGuests(env.DB, body?.names || []);
    const guests = await listGuestList(env.DB);
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

  try {
    if (body?.removeId) {
      await removeGuest(env.DB, String(body.removeId));
    }
    let modeResult = null;
    if (body?.rsvpMode) {
      modeResult = await setRsvpMode(env.DB, body.rsvpMode);
    }
    const [rsvpMode, guests] = await Promise.all([getRsvpMode(env.DB), listGuestList(env.DB)]);
    return json(headers, {
      ok: true,
      rsvpMode,
      guests,
      ...(modeResult ? { updatedAt: modeResult.updatedAt } : {}),
    });
  } catch (err) {
    if (err.message === 'INVALID_RSVP_MODE') {
      return json(headers, { ok: false, error: 'INVALID_RSVP_MODE' }, 400);
    }
    if (err.message === 'GUEST_NOT_FOUND') {
      return json(headers, { ok: false, error: 'GUEST_NOT_FOUND' }, 404);
    }
    return json(headers, { ok: false, error: 'PATCH_FAILED', message: err.message }, 500);
  }
}
