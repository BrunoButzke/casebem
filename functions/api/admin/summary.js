/**
 * GET /api/admin/summary — painel dos noivos
 * Auth: Authorization: Bearer $ADMIN_PANEL_SECRET
 * Free-tier: Pages Function + D1 only
 */

import { requireAdmin } from '../../_lib/admin-auth.mjs';
import { listMessagesAdmin, listGiftsAdmin, listFinanceAdmin } from '../../_lib/admin-service.mjs';
import {
  getRsvpMode,
  listGuestList,
  listGroups,
  summarizeGuestList,
} from '../../_lib/rsvp-guest-list.mjs';
import { getTenantById } from '../../_lib/tenant-service.mjs';
import {
  PUBLISHED_WEDDING_KEY,
  coupleNamesFallbackFromSlug,
} from '../../_lib/wedding-path.mjs';
import { getCorsHeaders } from '../../_lib/http-helpers.mjs';

export async function onRequestOptions(context) {
  return new Response(null, { status: 204, headers: getCorsHeaders(context.request) });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const headers = getCorsHeaders(request);
  headers.set('Content-Type', 'application/json; charset=utf-8');

  const auth = await requireAdmin(request, env);
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
    const wk = auth.weddingKey;
    const [messages, gifts, finance, rsvpMode, guestList, groups, tenant] = await Promise.all([
      listMessagesAdmin(env.DB, { weddingKey: wk }),
      listGiftsAdmin(env.DB, { weddingKey: wk }).catch((err) => {
        console.error('listGiftsAdmin', err?.message || err);
        return [];
      }),
      listFinanceAdmin(env.DB, { weddingKey: wk }).catch((err) => {
        console.error('listFinanceAdmin', err?.message || err);
        return [];
      }),
      getRsvpMode(env.DB, wk),
      listGuestList(env.DB, wk),
      listGroups(env.DB, wk),
      getTenantById(env.DB, wk).catch(() => null),
    ]);

    const guestStats = summarizeGuestList(guestList);
    const paidGifts = gifts.filter((g) => g.paid);
    const paidCents = paidGifts.reduce((s, g) => s + (g.amountCents || 0), 0);
    const financePaid = finance.filter((r) => r.paid);
    const financePaidCents = financePaid.reduce((s, r) => s + (r.amountCents || 0), 0);
    const coupleNames =
      tenant?.coupleNames ||
      (wk === PUBLISHED_WEDDING_KEY ? 'Dani & Carine' : coupleNamesFallbackFromSlug(wk));

    return Response.json(
      {
        ok: true,
        tenant: {
          id: wk,
          coupleNames,
          sitePath: tenant?.sitePath || `/${wk}/`,
          adminPath: tenant?.adminPath || `/${wk}/admin`,
        },
        summary: {
          attendingCount: guestStats.attendingCount,
          declinedCount: guestStats.declinedCount,
          pendingCount: guestStats.pendingCount,
          messagesVisible: messages.filter((m) => !m.hidden).length,
          messagesHidden: messages.filter((m) => m.hidden).length,
          giftsPending: gifts.filter((g) => !g.paid && g.status === 'pending').length,
          giftsPaid: paidGifts.length,
          giftsPaidCents: paidCents,
          financePaid: financePaid.length,
          financePaidCents,
          rsvpMode,
          guestListCount: guestStats.guestListCount,
          groupsCount: groups.length,
        },
        rsvpMode,
        guestList,
        groups,
        messages,
        gifts,
        finance,
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
