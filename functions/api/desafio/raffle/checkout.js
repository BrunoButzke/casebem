/**
 * POST /api/desafio/raffle/checkout — Pix dos números do sorteio
 */

import { getCorsHeaders, validateOrigin } from '../../../_lib/http-helpers.mjs';
import { createRaffleCheckout } from '../../../_lib/raffle-service.mjs';

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
    return json(headers, { ok: false, error: 'DB_NOT_CONFIGURED', message: 'Banco não configurado' }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json(headers, { ok: false, error: 'INVALID_JSON' }, 400);
  }

  const origin = request.headers.get('Origin') || new URL(request.url).origin;
  try {
    const result = await createRaffleCheckout(env.DB, env, body || {}, { origin });
    const status = result.ok ? 200 : result.status || 400;
    return json(headers, result, status);
  } catch (err) {
    return json(
      headers,
      { ok: false, error: 'CHECKOUT_FAILED', message: err.message || 'Falha no checkout' },
      500
    );
  }
}
