/**
 * Admin guest list + mode + groups
 * GET  — list guests + groups + mode
 * POST — { names: string[], groupId?: string|null } add guests
 * PATCH — rsvpMode | removeId | guestId+attending | guestId+groupId
 *         | createGroup:{name} | deleteGroupId
 * Auth: Bearer ADMIN_PANEL_SECRET
 */

import { requireAdmin } from '../../_lib/admin-auth.mjs';
import { getCorsHeaders, validateOrigin } from '../../_lib/http-helpers.mjs';
import {
  getRsvpMode,
  setRsvpMode,
  listGuestList,
  listGroups,
  addGuests,
  removeGuest,
  setGuestAttending,
  setGuestGroup,
  createGroup,
  deleteGroup,
} from '../../_lib/rsvp-guest-list.mjs';

function json(headers, body, status = 200) {
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return Response.json(body, { status, headers });
}

async function snapshot(db) {
  const [rsvpMode, guests, groups] = await Promise.all([
    getRsvpMode(db),
    listGuestList(db),
    listGroups(db),
  ]);
  return { rsvpMode, guests, groups, count: guests.length };
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

  return json(headers, { ok: true, ...(await snapshot(env.DB)) });
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
    const result = await addGuests(env.DB, body?.names || [], {
      groupId: body?.groupId || null,
    });
    return json(headers, { ok: true, ...result, ...(await snapshot(env.DB)) });
  } catch (err) {
    if (err.message === 'EMPTY_GUEST_LIST') {
      return json(headers, { ok: false, error: 'EMPTY_GUEST_LIST', message: 'Informe names: string[]' }, 400);
    }
    if (err.message === 'GUEST_LIST_TOO_LARGE') {
      return json(headers, { ok: false, error: 'GUEST_LIST_TOO_LARGE', message: 'Máximo 500 nomes por vez' }, 400);
    }
    if (err.message === 'GROUP_NOT_FOUND') {
      return json(headers, { ok: false, error: 'GROUP_NOT_FOUND', message: 'Grupo não encontrado' }, 404);
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
    let modeResult = null;

    if (body?.createGroup?.name) {
      await createGroup(env.DB, body.createGroup.name);
    }
    if (body?.deleteGroupId) {
      await deleteGroup(env.DB, String(body.deleteGroupId));
    }
    if (body?.removeId) {
      await removeGuest(env.DB, String(body.removeId));
    }
    if (body?.guestId && Object.prototype.hasOwnProperty.call(body, 'attending')) {
      await setGuestAttending(env.DB, String(body.guestId), body.attending);
    }
    if (body?.guestId && Object.prototype.hasOwnProperty.call(body, 'groupId')) {
      await setGuestGroup(env.DB, String(body.guestId), body.groupId);
    }
    if (body?.rsvpMode) {
      modeResult = await setRsvpMode(env.DB, body.rsvpMode);
    }

    return json(headers, {
      ok: true,
      ...(await snapshot(env.DB)),
      ...(modeResult ? { updatedAt: modeResult.updatedAt } : {}),
    });
  } catch (err) {
    const map = {
      INVALID_RSVP_MODE: 400,
      INVALID_GROUP_NAME: 400,
      INVALID_ATTENDING: 400,
      INVALID_GUEST_ID: 400,
      INVALID_GROUP_ID: 400,
      GROUP_EXISTS: 409,
      GROUP_NOT_FOUND: 404,
      GUEST_NOT_FOUND: 404,
    };
    const status = map[err.message] || 500;
    return json(
      headers,
      { ok: false, error: err.message === 'PATCH_FAILED' ? 'PATCH_FAILED' : err.message, message: err.message },
      status
    );
  }
}
