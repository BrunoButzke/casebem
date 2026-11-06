/**
 * POST|GET /api/webhooks/mercadopago
 * Mercado Pago IPN/webhook — marks checkout_intents.paid_at when approved.
 * Free-tier: one Pages Function invocation + optional outbound GET to MP.
 *
 * Configure in MP dashboard:
 *   https://casebem.com/api/webhooks/mercadopago
 */

import { processMercadoPagoWebhook } from '../../_lib/mp-webhook.mjs';

async function handle(context) {
  const { request, env } = context;

  if (!env.DB) {
    return Response.json({ ok: false, error: 'DB_NOT_CONFIGURED' }, { status: 503 });
  }

  let payload = {};
  try {
    if (request.method === 'GET') {
      const url = new URL(request.url);
      payload = {
        topic: url.searchParams.get('topic') || url.searchParams.get('type'),
        id: url.searchParams.get('id') || url.searchParams.get('data.id'),
      };
    } else {
      payload = await request.json().catch(() => ({}));
      const url = new URL(request.url);
      // Merge query params (MP sometimes uses both)
      if (!payload.data?.id && url.searchParams.get('data.id')) {
        payload = {
          ...payload,
          data: { id: url.searchParams.get('data.id') },
          topic: payload.topic || url.searchParams.get('topic'),
        };
      }
    }
  } catch {
    payload = {};
  }

  const result = await processMercadoPagoWebhook({ db: env.DB, env, payload });

  // Always 200 to MP when we understood the notification shape (avoid retries storms)
  if (result.ok) {
    return Response.json(result, { status: 200 });
  }

  return Response.json(result, { status: 500 });
}

export const onRequestPost = handle;
export const onRequestGet = handle;
