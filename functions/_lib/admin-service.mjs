/**
 * Admin read/moderation queries — D1 only (Cloudflare Free).
 */

const WEDDING_KEY = 'dani-carine';

export async function listRsvps(db, { limit = 200 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 200, 1), 500);
  const rows = await db
    .prepare(
      `SELECT id, guest_name, attending, adults_count, children_count,
              observations, created_at, updated_at
       FROM rsvps
       WHERE wedding_key = ?
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .bind(WEDDING_KEY, safeLimit)
    .all();

  return (rows?.results || []).map((r) => ({
    id: r.id,
    guestName: r.guest_name,
    attending: Boolean(r.attending),
    adultsCount: r.adults_count,
    childrenCount: r.children_count,
    observations: r.observations || '',
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export function rsvpsToCsv(rsvps) {
  const header = [
    'id',
    'guest_name',
    'attending',
    'adults_count',
    'children_count',
    'observations',
    'created_at',
    'updated_at',
  ];
  const escape = (v) => {
    const s = String(v ?? '');
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [header.join(',')];
  for (const r of rsvps) {
    lines.push(
      [
        r.id,
        r.guestName,
        r.attending ? 'yes' : 'no',
        r.adultsCount,
        r.childrenCount,
        r.observations,
        r.createdAt,
        r.updatedAt,
      ]
        .map(escape)
        .join(',')
    );
  }
  return lines.join('\n') + '\n';
}

export async function listMessagesAdmin(db, { includeHidden = true, limit = 200 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 200, 1), 500);
  const rows = await db
    .prepare(
      `SELECT id, guest_name, message, created_at, COALESCE(hidden, 0) AS hidden
       FROM wedding_messages
       WHERE wedding_key = ?
         AND (? = 1 OR COALESCE(hidden, 0) = 0)
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .bind(WEDDING_KEY, includeHidden ? 1 : 0, safeLimit)
    .all();

  return (rows?.results || []).map((m) => ({
    id: m.id,
    guestName: m.guest_name,
    message: m.message,
    createdAt: m.created_at,
    hidden: Boolean(m.hidden),
  }));
}

export async function setMessageHidden(db, messageId, hidden) {
  if (!messageId || typeof messageId !== 'string') {
    throw new Error('INVALID_MESSAGE_ID');
  }
  const flag = hidden ? 1 : 0;
  const result = await db
    .prepare(
      `UPDATE wedding_messages
       SET hidden = ?
       WHERE id = ? AND wedding_key = ?`
    )
    .bind(flag, messageId, WEDDING_KEY)
    .run();

  const changes = Number(result?.meta?.changes ?? result?.changes ?? 0);
  if (changes === 0) throw new Error('MESSAGE_NOT_FOUND');
  return { id: messageId, hidden: Boolean(flag) };
}

export async function listGiftsAdmin(db, { limit = 200 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 200, 1), 500);
  const rows = await db
    .prepare(
      `SELECT intent_key, gifter_name, amount_cents, payment_method, status,
              provider_reference, canonical_items, created_at, updated_at, paid_at
       FROM checkout_intents
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .bind(safeLimit)
    .all();

  return (rows?.results || []).map((g) => {
    let items = [];
    try {
      items = JSON.parse(g.canonical_items || '[]');
    } catch {
      items = [];
    }
    return {
      intentKey: g.intent_key,
      gifterName: g.gifter_name,
      amountCents: g.amount_cents,
      paymentMethod: g.payment_method,
      status: g.status,
      paid: Boolean(g.paid_at),
      paidAt: g.paid_at || null,
      providerReference: g.provider_reference,
      items,
      createdAt: g.created_at,
      updatedAt: g.updated_at,
    };
  });
}

/**
 * Mark checkout intent paid by Mercado Pago payment id (provider_reference)
 */
export async function markIntentPaidByProviderRef(db, providerReference, paidAtIso) {
  if (!providerReference) return { updated: false };
  const result = await db
    .prepare(
      `UPDATE checkout_intents
       SET paid_at = COALESCE(paid_at, ?), updated_at = ?
       WHERE provider_reference = ?`
    )
    .bind(paidAtIso, paidAtIso, String(providerReference))
    .run();

  const changes = Number(result?.meta?.changes ?? result?.changes ?? 0);
  return { updated: changes > 0 };
}
