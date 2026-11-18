/**
 * Admin read/moderation queries — D1 only (Cloudflare Free).
 */

import { WEDDING_KEY as DEFAULT_WEDDING_KEY } from './messages-validators.mjs';

function resolveWeddingKey(weddingKey) {
  const k = String(weddingKey || DEFAULT_WEDDING_KEY).trim();
  return k || DEFAULT_WEDDING_KEY;
}

export async function listRsvps(db, { limit = 200, weddingKey = DEFAULT_WEDDING_KEY } = {}) {
  const key = resolveWeddingKey(weddingKey);
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
    .bind(key, safeLimit)
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

export async function listMessagesAdmin(
  db,
  { includeHidden = true, limit = 200, weddingKey = DEFAULT_WEDDING_KEY } = {}
) {
  const key = resolveWeddingKey(weddingKey);
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
    .bind(key, includeHidden ? 1 : 0, safeLimit)
    .all();

  return (rows?.results || []).map((m) => ({
    id: m.id,
    guestName: m.guest_name,
    message: m.message,
    createdAt: m.created_at,
    hidden: Boolean(m.hidden),
  }));
}

export async function setMessageHidden(db, messageId, hidden, weddingKey = DEFAULT_WEDDING_KEY) {
  if (!messageId || typeof messageId !== 'string') {
    throw new Error('INVALID_MESSAGE_ID');
  }
  const key = resolveWeddingKey(weddingKey);
  const flag = hidden ? 1 : 0;
  const result = await db
    .prepare(
      `UPDATE wedding_messages
       SET hidden = ?
       WHERE id = ? AND wedding_key = ?`
    )
    .bind(flag, messageId, key)
    .run();

  const changes = Number(result?.meta?.changes ?? result?.changes ?? 0);
  if (changes === 0) throw new Error('MESSAGE_NOT_FOUND');
  return { id: messageId, hidden: Boolean(flag) };
}

function parseCanonicalItems(raw) {
  try {
    const items = JSON.parse(raw || '[]');
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

/** Intents de rifa usam giftId no formato raffle-{raffleId}-{n} */
export function isRaffleCheckoutItems(items) {
  if (!Array.isArray(items) || items.length === 0) return false;
  return items.every((item) => String(item?.giftId || '').startsWith('raffle-'));
}

export async function listGiftsAdmin(db, { limit = 200, weddingKey = DEFAULT_WEDDING_KEY } = {}) {
  const key = resolveWeddingKey(weddingKey);
  const safeLimit = Math.min(Math.max(Number(limit) || 200, 1), 500);
  const rows = await db
    .prepare(
      `SELECT intent_key, gifter_name, amount_cents, payment_method, status,
              provider_reference, canonical_items, created_at, updated_at, paid_at
       FROM checkout_intents
       WHERE COALESCE(wedding_key, ?) = ?
         AND canonical_items NOT LIKE '%"giftId":"raffle-%'
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .bind(DEFAULT_WEDDING_KEY, key, safeLimit)
    .all();

  return (rows?.results || [])
    .map((g) => {
      const items = parseCanonicalItems(g.canonical_items);
      const paid = Boolean(g.paid_at);
      return {
        intentKey: g.intent_key,
        gifterName: g.gifter_name,
        amountCents: g.amount_cents,
        paymentMethod: g.payment_method,
        status: paid ? 'paid' : g.status,
        paid,
        paidAt: g.paid_at || null,
        providerReference: g.provider_reference,
        items,
        createdAt: g.created_at,
        updatedAt: g.updated_at,
      };
    })
    .filter((g) => !isRaffleCheckoutItems(g.items));
}

function giftItemsLabel(items) {
  if (!Array.isArray(items) || !items.length) return 'Presente';
  return items
    .map((it) => String(it?.name || it?.giftId || 'Presente').trim() || 'Presente')
    .join(', ');
}

/**
 * Compilado financeiro: presentes + números de sorteio vendidos.
 * kind: 'gift' | 'raffle'
 */
export async function listFinanceAdmin(db, { limit = 300, weddingKey = DEFAULT_WEDDING_KEY } = {}) {
  const key = resolveWeddingKey(weddingKey);
  const { listRaffleSalesAdmin } = await import('./raffle-service.mjs');
  const half = Math.max(50, Math.floor(Number(limit) / 2) || 150);
  const [gifts, sales] = await Promise.all([
    db ? listGiftsAdmin(db, { limit: half, weddingKey: key }) : Promise.resolve([]),
    listRaffleSalesAdmin(db, { limit: half }, key),
  ]);

  const giftRows = gifts.map((g) => ({
    id: `gift:${g.intentKey}`,
    kind: 'gift',
    who: g.gifterName || 'Convidado',
    detail: giftItemsLabel(g.items),
    amountCents: Number(g.amountCents) || 0,
    paid: Boolean(g.paid),
    status: g.paid ? 'paid' : 'pending',
    at: g.paidAt || g.createdAt || '',
  }));

  const raffleRows = sales.map((s) => ({
    id: `raffle:${s.raffleId}:${s.number}:${s.createdAt || ''}`,
    kind: 'raffle',
    who: s.guestName || 'Convidado',
    detail: `${s.raffleName || 'Sorteio'} · nº ${s.number}`,
    amountCents: Number(s.priceCents) || 0,
    paid: true,
    status: 'paid',
    at: s.createdAt || '',
  }));

  return [...giftRows, ...raffleRows].sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

/**
 * Grava checkout de presente (create-pix legado) em checkout_intents
 * para aparecer em Recebidos e ser marcado pelo webhook.
 */
export async function recordGiftCheckoutIntent(db, params) {
  if (!db) return { recorded: false };
  const paymentId = params?.paymentId != null ? String(params.paymentId) : '';
  if (!paymentId) return { recorded: false };

  const amountCents = Math.round(Number(params.amountCents ?? Number(params.amount) * 100) || 0);
  if (!Number.isFinite(amountCents) || amountCents < 99) return { recorded: false };

  const weddingKey = resolveWeddingKey(params?.weddingKey);
  const giftId = String(params.giftId || 'gift').trim().slice(0, 60) || 'gift';
  const title = String(params.title || 'Presente').trim().slice(0, 120) || 'Presente';
  const gifterName = String(params.gifterName || params.email || 'Convidado').trim().slice(0, 80) || 'Convidado';
  const items = [
    {
      giftId,
      name: title,
      quantity: 1,
      priceInCents: amountCents,
    },
  ];
  const { createCheckoutFingerprint } = await import('./checkout-idempotency.mjs');
  const fingerprint = await createCheckoutFingerprint({
    gifterName,
    items,
    paymentMethod: 'pix',
    amountCents,
  });
  const intentKey = crypto.randomUUID();
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO checkout_intents (
        intent_key, fingerprint, provider, provider_reference,
        amount_cents, gifter_name, canonical_items, payment_method,
        status, qr_code, qr_code_base64, created_at, updated_at, wedding_key
      ) VALUES (?, ?, 'mercadopago', ?, ?, ?, ?, 'pix', 'pending', ?, ?, ?, ?, ?)`
    )
    .bind(
      intentKey,
      fingerprint,
      paymentId,
      amountCents,
      gifterName,
      JSON.stringify(items),
      params.qrCode || null,
      params.qrCodeBase64 || null,
      now,
      now,
      weddingKey
    )
    .run();

  return { recorded: true, intentKey };
}

/**
 * Mark checkout intent paid by Mercado Pago payment id (provider_reference)
 */
export async function markIntentPaidByProviderRef(db, providerReference, paidAtIso) {
  if (!providerReference) return { updated: false };
  const result = await db
    .prepare(
      `UPDATE checkout_intents
       SET paid_at = COALESCE(paid_at, ?),
           status = 'paid',
           updated_at = ?
       WHERE provider_reference = ?`
    )
    .bind(paidAtIso, paidAtIso, String(providerReference))
    .run();

  const changes = Number(result?.meta?.changes ?? result?.changes ?? 0);
  return { updated: changes > 0 };
}

/**
 * Mark paid by external_reference casebem:gift:{intentKey}
 * (Checkout Pro card/boleto — preference id ≠ payment id)
 */
export async function markIntentPaidByExternalRef(db, externalReference, paymentId, paidAtIso) {
  if (!externalReference || typeof externalReference !== 'string') {
    return { updated: false };
  }
  const match = externalReference.match(/^casebem:(?:gift|raffle):([0-9a-f-]{36})$/i);
  if (!match) return { updated: false };
  const intentKey = match[1];
  const kind = /^casebem:raffle:/i.test(externalReference) ? 'raffle' : 'gift';

  const result = await db
    .prepare(
      `UPDATE checkout_intents
       SET paid_at = COALESCE(paid_at, ?),
           provider_reference = COALESCE(?, provider_reference),
           status = 'paid',
           updated_at = ?
       WHERE intent_key = ?`
    )
    .bind(paidAtIso, paymentId ? String(paymentId) : null, paidAtIso, intentKey)
    .run();

  const changes = Number(result?.meta?.changes ?? result?.changes ?? 0);
  return { updated: changes > 0, intentKey, kind };
}
