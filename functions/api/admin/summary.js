/**
 * GET /api/admin/summary — RSVPs, messages, gifts for noivos panel
 * Auth: Authorization: Bearer $ADMIN_PANEL_SECRET
 * Free-tier: Pages Function + D1 only
 */

import { requireAdmin } from '../../_lib/admin-auth.mjs';
import {
  listRsvps,
  listMessagesAdmin,
  listGiftsAdmin,
} from '../../_lib/admin-service.mjs';
import { getCorsHeaders } from '../../_lib/http-helpers.mjs';

export async function onRequestOptions(context) {
  return new Response(null, { status: 204, headers: getCorsHeaders(context.request) });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const headers = getCorsHeaders(request);
  headers.set('Content-Type', 'application/json; charset=utf-8');

  const auth = requireAdmin(request, env);
  if (!auth.ok) {
    return Response.json(
      { ok: false, error: auth.error, message: auth.message },
      { status: auth.status, headers }
    );
  }

  if (!env.DB) {
    return Response.json(
      { ok: false, error: 'DB_NOT_CONFIGURED' },
      { status: 503, headers }
    );
  }

  try {
    const [rsvps, messages, gifts] = await Promise.all([
      listRsvps(env.DB),
      listMessagesAdmin(env.DB),
      listGiftsAdmin(env.DB),
    ]);

    const attending = rsvps.filter((r) => r.attending);
    const adults = attending.reduce((s, r) => s + (r.adultsCount || 0), 0);
    const children = attending.reduce((s, r) => s + (r.childrenCount || 0), 0);
    const paidGifts = gifts.filter((g) => g.paid);
    const paidCents = paidGifts.reduce((s, g) => s + (g.amountCents || 0), 0);

    return Response.json(
      {
        ok: true,
        summary: {
          rsvpTotal: rsvps.length,
          attendingCount: attending.length,
          adults,
          children,
          messagesVisible: messages.filter((m) => !m.hidden).length,
          messagesHidden: messages.filter((m) => m.hidden).length,
          giftsPending: gifts.filter((g) => !g.paid && g.status === 'pending').length,
          giftsPaid: paidGifts.length,
          giftsPaidCents: paidCents,
        },
        rsvps,
        messages,
        gifts,
      },
      { status: 200, headers }
    );
  } catch (err) {
    return Response.json(
      { ok: false, error: 'ADMIN_QUERY_FAILED', message: err?.message || 'error' },
      { status: 500, headers }
    );
  }
}
