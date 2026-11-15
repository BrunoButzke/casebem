/**
 * Público — corrige uma resposta do quiz (não devolve o gabarito)
 */

import { getCorsHeaders, validateOrigin } from '../../_lib/http-helpers.mjs';
import { gradeQuestion } from '../../_lib/challenges-service.mjs';
import { PARTNER_ACCOUNT_ID } from '../../_lib/auth-service.mjs';

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
    return json(headers, { ok: false, error: 'INVALID_JSON' }, 400);
  }

  try {
    const result = await gradeQuestion(
      env.DB || null,
      PARTNER_ACCOUNT_ID,
      String(body?.questionId || ''),
      body?.selectedIndex
    );
    return json(headers, { ok: true, ...result });
  } catch (err) {
    if (err.message === 'NOT_FOUND') return json(headers, { ok: false, error: 'NOT_FOUND' }, 404);
    if (err.message === 'INVALID_ID') return json(headers, { ok: false, error: 'INVALID_ID' }, 400);
    if (err.message === 'VALIDATION') {
      return json(headers, { ok: false, error: 'VALIDATION', details: err.details }, 400);
    }
    return json(headers, { ok: false, error: 'GRADE_FAILED', message: err.message }, 500);
  }
}
