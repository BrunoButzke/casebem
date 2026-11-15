/**
 * Admin couple page
 * GET — slug, slugLocked e conteúdo
 * PUT — reivindica slug e salva a página
 */

import { requireAccount } from '../../_lib/session-auth.mjs';
import { getCorsHeaders, validateOrigin } from '../../_lib/http-helpers.mjs';
import { claimAccountSlug } from '../../_lib/auth-service.mjs';
import { getCouplePage, saveCouplePage } from '../../_lib/couple-page-service.mjs';

const SLUG_STATUS = {
  SLUG_INVALID: 400,
  SLUG_RESERVED: 400,
  VALIDATION: 400,
  SLUG_TAKEN: 409,
  SLUG_LOCKED: 403,
  ACCOUNT_NOT_FOUND: 404,
};

function json(headers, body, status = 200) {
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  return Response.json(body, { status, headers });
}

function mapWriteError(headers, err) {
  const status = SLUG_STATUS[err.message] || 500;
  const body = { ok: false, error: err.message };
  if (err.details) body.details = err.details;
  if (status === 500) body.message = err.message;
  return json(headers, body, status);
}

function pagePayload(auth, page, slug) {
  return {
    ok: true,
    slug: slug ?? auth.account.slug ?? null,
    slugLocked: Boolean(auth.account.isPartner),
    page,
  };
}

export async function onRequestOptions(context) {
  const headers = getCorsHeaders(context.request);
  headers.set('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  return new Response(null, { status: 204, headers });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const headers = getCorsHeaders(request);
  const auth = await requireAccount(request, env);
  if (!auth.ok) return json(headers, { ok: false, error: auth.error, message: auth.message }, auth.status);

  try {
    const page = await getCouplePage(env.DB || null, auth.account.id);
    return json(headers, pagePayload(auth, page));
  } catch (err) {
    return mapWriteError(headers, err);
  }
}

export async function onRequestPut(context) {
  const { request, env } = context;
  const headers = getCorsHeaders(request);

  const originCheck = validateOrigin(request);
  if (!originCheck.valid) {
    return json(headers, { ok: false, error: 'ORIGIN_DENIED', message: originCheck.error }, 403);
  }

  const auth = await requireAccount(request, env);
  if (!auth.ok) return json(headers, { ok: false, error: auth.error, message: auth.message }, auth.status);

  let body;
  try {
    body = await request.json();
  } catch {
    return json(headers, { ok: false, error: 'INVALID_JSON' }, 400);
  }

  const db = env.DB || null;
  try {
    let slug = auth.account.slug ?? null;
    if (body?.slug != null && String(body.slug).trim() !== '') {
      const claimed = await claimAccountSlug(db, auth.account.id, body.slug);
      slug = claimed.slug;
    }
    const page = await saveCouplePage(db, auth.account.id, body?.page || {});
    return json(headers, pagePayload(auth, page, slug));
  } catch (err) {
    return mapWriteError(headers, err);
  }
}
