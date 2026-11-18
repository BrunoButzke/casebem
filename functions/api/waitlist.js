/**
 * POST /api/waitlist — cadastro na lista de espera (landing)
 */

import { getCorsHeaders, validateOrigin } from '../_lib/http-helpers.mjs';
import { addWaitlistSignup, validateWaitlistPayload } from '../_lib/waitlist-service.mjs';

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

  let body;
  try {
    body = await request.json();
  } catch {
    return json(headers, { ok: false, error: 'INVALID_JSON', message: 'JSON inválido.' }, 400);
  }

  const validated = validateWaitlistPayload(body);
  if (!validated.ok) {
    return json(headers, { ok: false, error: validated.error, message: validated.message }, 400);
  }

  try {
    const result = await addWaitlistSignup(env.DB || null, validated);
    return json(headers, {
      ok: true,
      updated: result.updated,
      entry: { email: result.entry.email, plan: result.entry.plan },
    });
  } catch (err) {
    console.error('waitlist signup failed', err?.message || err);
    return json(
      headers,
      { ok: false, error: 'WAITLIST_FAILED', message: 'Não foi possível salvar. Tente de novo.' },
      500
    );
  }
}
