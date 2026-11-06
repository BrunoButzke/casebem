/**
 * Mercado Pago webhook processor — Free-tier (Pages Function + D1 only).
 * Fetches payment from MP API and marks matching checkout_intent as paid.
 */

import { getPaymentStatus } from './mercadopago.mjs';
import {
  markIntentPaidByProviderRef,
  markIntentPaidByExternalRef,
} from './admin-service.mjs';
import { sendAdminNotification } from './notify-email.mjs';

/**
 * @param {object} params
 * @param {D1Database} params.db
 * @param {object} params.env
 * @param {object} params.payload - raw webhook / query notification
 * @returns {Promise<{ok: boolean, handled?: boolean, reason?: string}>}
 */
export async function processMercadoPagoWebhook({ db, env, payload }) {
  // MP sends { type/action, data: { id } } or query ?topic=payment&id=
  const topic = payload?.type || payload?.topic || payload?.action || '';
  const paymentId =
    payload?.data?.id ||
    payload?.id ||
    payload?.['data.id'] ||
    null;

  const isPayment =
    String(topic).includes('payment') ||
    payload?.topic === 'payment' ||
    Boolean(paymentId);

  if (!isPayment || !paymentId) {
    return { ok: true, handled: false, reason: 'ignored_non_payment' };
  }

  if (!env.MP_ACCESS_TOKEN) {
    return { ok: false, handled: false, reason: 'MP_ACCESS_TOKEN missing' };
  }

  const statusResult = await getPaymentStatus({
    accessToken: env.MP_ACCESS_TOKEN,
    paymentId: String(paymentId),
  });

  if (!statusResult.ok) {
    return { ok: false, handled: false, reason: statusResult.error || 'mp_fetch_failed' };
  }

  const payment = statusResult.payment;
  if (payment.status !== 'approved') {
    return {
      ok: true,
      handled: true,
      reason: `status_${payment.status}`,
      paymentStatus: payment.status,
    };
  }

  const now = new Date().toISOString();

  // Pix: provider_reference = payment id. Card/boleto: preference id ≠ payment id → external_reference
  let mark = await markIntentPaidByProviderRef(db, payment.id, now);
  if (!mark.updated && payment.externalReference) {
    mark = await markIntentPaidByExternalRef(
      db,
      payment.externalReference,
      payment.id,
      now
    );
  }

  if (mark.updated) {
    await sendAdminNotification(env, {
      subject: `[CaseBem] Pagamento aprovado — #${payment.id}`,
      text: `Pagamento Mercado Pago aprovado.\nID: ${payment.id}\nValor: R$ ${Number(payment.amount || 0).toFixed(2)}\nRef: ${payment.externalReference || '-'}\nHorário: ${now}`,
    });
  }

  return {
    ok: true,
    handled: true,
    paid: mark.updated,
    paymentId: payment.id,
    paymentStatus: payment.status,
  };
}
