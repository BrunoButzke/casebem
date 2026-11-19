/**
 * GET/POST/DELETE /api/admin/access — contas Noiva/Noivo do painel
 * Auth: Bearer ADMIN_PANEL_SECRET (tenant)
 */

import { requireAdmin } from '../../_lib/admin-auth.mjs';
import { getCorsHeaders, validateOrigin } from '../../_lib/http-helpers.mjs';
import {
  listAdminMembers,
  upsertAdminMember,
  removeAdminMember,
} from '../../_lib/admin-members-service.mjs';

function json(headers, body, status = 200) {
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return Response.json(body, { status, headers });
}

function mapError(headers, err) {
  const map = {
    EMAIL_INVALID: 400,
    ROLE_INVALID: 400,
    PASSWORD_WEAK: 400,
    MEMBER_LIMIT: 409,
    ROLE_TAKEN: 409,
    NOT_FOUND: 404,
  };
  const status = map[err.message] || 500;
  return json(
    headers,
    {
      ok: false,
      error: err.message || 'ACCESS_FAILED',
      message: err.details || err.message || 'Falha ao gerenciar acessos',
    },
    status
  );
}

export async function onRequestOptions(context) {
  return new Response(null, { status: 204, headers: getCorsHeaders(context.request) });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const headers = getCorsHeaders(request);
  const auth = await requireAdmin(request, env);
  if (!auth.ok) return json(headers, { ok: false, error: auth.error, message: auth.message }, auth.status);

  try {
    const members = await listAdminMembers(env.DB || null, auth.weddingKey);
    return json(headers, {
      ok: true,
      members,
      limits: { maxMembers: 2 },
      weddingKey: auth.weddingKey,
    });
  } catch (err) {
    return mapError(headers, err);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const headers = getCorsHeaders(request);

  const originCheck = validateOrigin(request);
  if (!originCheck.valid) {
    return json(headers, { ok: false, error: 'ORIGIN_DENIED', message: originCheck.error }, 403);
  }

  const auth = await requireAdmin(request, env);
  if (!auth.ok) return json(headers, { ok: false, error: auth.error, message: auth.message }, auth.status);

  let body;
  try {
    body = await request.json();
  } catch {
    return json(headers, { ok: false, error: 'INVALID_JSON' }, 400);
  }

  try {
    const member = await upsertAdminMember(env.DB || null, body, auth.weddingKey);
    const members = await listAdminMembers(env.DB || null, auth.weddingKey);
    return json(headers, { ok: true, member, members, weddingKey: auth.weddingKey });
  } catch (err) {
    return mapError(headers, err);
  }
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  const headers = getCorsHeaders(request);

  const originCheck = validateOrigin(request);
  if (!originCheck.valid) {
    return json(headers, { ok: false, error: 'ORIGIN_DENIED', message: originCheck.error }, 403);
  }

  const auth = await requireAdmin(request, env);
  if (!auth.ok) return json(headers, { ok: false, error: auth.error, message: auth.message }, auth.status);

  const email = new URL(request.url).searchParams.get('email');
  try {
    await removeAdminMember(env.DB || null, email, auth.weddingKey);
    const members = await listAdminMembers(env.DB || null, auth.weddingKey);
    return json(headers, { ok: true, removed: email, members });
  } catch (err) {
    return mapError(headers, err);
  }
}
