/**
 * GET /api/admin/summary — painel dos noivos
 * Auth: cookie cb_session
 * Free-tier: Pages Function + D1 only
 */

import { requireAccount } from '../../_lib/session-auth.mjs';
import { listMessagesAdmin, listGiftsAdmin } from '../../_lib/admin-service.mjs';
import {
  getRsvpMode,
  listGuestList,
  listGroups,
  summarizeGuestList,
} from '../../_lib/rsvp-guest-list.mjs';
import { getCorsHeaders } from '../../_lib/http-helpers.mjs';

export async function onRequestOptions(context) {
  return new Response(null, { status: 204, headers: getCorsHeaders(context.request) });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const headers = getCorsHeaders(request);
  headers.set('Content-Type', 'application/json; charset=utf-8');

  const auth = await requireAccount(request, env);
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
    const accountId = auth.account.id;
    const [messages, gifts, rsvpMode, guestList, groups] = await Promise.all([
      listMessagesAdmin(env.DB, accountId),
      listGiftsAdmin(env.DB),
      getRsvpMode(env.DB, accountId),
      listGuestList(env.DB, accountId),
      listGroups(env.DB, accountId),
    ]);

    const guestStats = summarizeGuestList(guestList);
    const paidGifts = gifts.filter((g) => g.paid);
    const paidCents = paidGifts.reduce((s, g) => s + (g.amountCents || 0), 0);

    return Response.json(
      {
        ok: true,
        summary: {
          attendingCount: guestStats.attendingCount,
          declinedCount: guestStats.declinedCount,
          pendingCount: guestStats.pendingCount,
          messagesVisible: messages.filter((m) => !m.hidden).length,
          messagesHidden: messages.filter((m) => m.hidden).length,
          giftsPending: gifts.filter((g) => !g.paid && g.status === 'pending').length,
          giftsPaid: paidGifts.length,
          giftsPaidCents: paidCents,
          rsvpMode,
          guestListCount: guestStats.guestListCount,
          groupsCount: groups.length,
        },
        rsvpMode,
        guestList,
        groups,
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
