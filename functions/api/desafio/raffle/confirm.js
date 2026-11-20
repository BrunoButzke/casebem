/**
 * POST /api/desafio/raffle/confirm — após Pix aprovado (polling), libera os números
 */

import { getCorsHeaders, validateOrigin } from '../../../_lib/http-helpers.mjs';
import { getPaymentStatus } from '../../../_lib/mercadopago.mjs';
import {
  markIntentPaidByProviderRef,
  markIntentPaidByExternalRef,
} from '../../../_lib/admin-service.mjs';
import { finalizeRaffleSalesByIntent } from '../../../_lib/raffle-service.mjs';

function json(headers, body, status = 200) {
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return Response.json(body, { status, headers });
}

export async function onRequestOptions(context) {
  return new Response(null, { status: 204, headers: getCorsHeaders(context.request) });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const headers = getCorsHeaders(request);

  const originCheck = validateOrigin(request);
  if (!originCheck.valid) {
    return json(headers, { ok: false, error: 'ORIGIN_DENIED', message: originCheck.error }, 403);
  }

  if (!env.DB) {
    return json(headers, { ok: false, error: 'DB_NOT_CONFIGURED' }, 503);
  }
  if (!env.MP_ACCESS_TOKEN) {
    return json(headers, { ok: false, error: 'PAYMENT_SERVICE_NOT_CONFIGURED' }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json(headers, { ok: false, error: 'INVALID_JSON' }, 400);
  }

  const paymentId = String(body?.paymentId || '').trim();
  if (!paymentId) {
    return json(headers, { ok: false, error: 'MISSING_PAYMENT_ID' }, 400);
  }

  const statusResult = await getPaymentStatus({
    accessToken: env.MP_ACCESS_TOKEN,
    paymentId,
  });
  if (!statusResult.ok) {
    return json(headers, { ok: false, error: 'MP_FETCH_FAILED', message: statusResult.error }, 502);
  }

  const payment = statusResult.payment;
  if (payment.status !== 'approved') {
    return json(headers, {
      ok: true,
      paid: false,
      paymentStatus: payment.status,
    });
  }

  const now = new Date().toISOString();
  let mark = await markIntentPaidByProviderRef(env.DB, payment.id, now);
  if (!mark.updated && payment.externalReference) {
    mark = await markIntentPaidByExternalRef(env.DB, payment.externalReference, payment.id, now);
  }

  let raffleIntent =
    mark.intentKey ||
    (String(payment.externalReference || '').match(/^casebem:raffle:([0-9a-f-]{36})$/i) || [])[1];

  // Fallback: localizar hold pelo payment_id da sale (mesmo se intent_pay ficou "123.0")
  if (!raffleIntent) {
    const hold = await env.DB.prepare(
      `SELECT intent_key AS intentKey
       FROM desafio_raffle_sales
       WHERE payment_id = ? OR payment_id = ?
       LIMIT 1`
    )
      .bind(String(payment.id), `${payment.id}.0`)
      .first();
    raffleIntent = hold?.intentKey || null;
  }

  let finalized = 0;
  let numbers = [];
  let reassigned = false;
  if (raffleIntent) {
    const fin = await finalizeRaffleSalesByIntent(env.DB, raffleIntent);
    finalized = fin.updated || 0;
    numbers = fin.numbers || [];
    reassigned = Boolean(fin.reassigned);
  }

  return json(headers, {
    ok: true,
    paid: true,
    paymentStatus: payment.status,
    finalized,
    numbers,
    reassigned,
    intentKey: raffleIntent || null,
  });
}
