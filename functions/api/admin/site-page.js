/**
 * GET/PATCH /api/admin/site-page — construtor Nossa página
 * PATCH body: { sectionKey, active?, content? }
 */

import { requireAdmin } from '../../_lib/admin-auth.mjs';
import { getCorsHeaders, validateOrigin } from '../../_lib/http-helpers.mjs';
import {
  VIP_SITE_FIELDS,
  listSiteSectionsAdmin,
  updateSiteSection,
} from '../../_lib/site-page-service.mjs';
import { getTenantById } from '../../_lib/tenant-service.mjs';
import { PUBLISHED_WEDDING_KEY } from '../../_lib/wedding-path.mjs';

async function resolvePlan(db, weddingKey) {
  const tenant = await getTenantById(db, weddingKey).catch(() => null);
  if (tenant?.plan) return String(tenant.plan).toLowerCase();
  return weddingKey === PUBLISHED_WEDDING_KEY ? 'vip' : 'basic';
}

function json(headers, body, status = 200) {
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return Response.json(body, { status, headers });
}

function mapError(headers, err) {
  const map = {
    SECTION_NOT_FOUND: 404,
    IMAGE_TOO_LARGE: 400,
    IMAGE_INVALID: 400,
    URL_INVALID: 400,
  };
  return json(
    headers,
    {
      ok: false,
      error: err.message || 'SITE_PAGE_FAILED',
      message: err.details || err.message || 'Falha ao salvar seção',
    },
    map[err.message] || 500
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
    const plan = await resolvePlan(env.DB || null, auth.weddingKey);
    const sections = await listSiteSectionsAdmin(env.DB || null, auth.weddingKey);
    return json(headers, {
      ok: true,
      sections,
      weddingKey: auth.weddingKey,
      plan,
      isVip: plan === 'vip',
    });
  } catch (err) {
    return mapError(headers, err);
  }
}

export async function onRequestPatch(context) {
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
    const plan = await resolvePlan(env.DB || null, auth.weddingKey);
    const patch = { ...body };
    if (plan !== 'vip' && patch.content && typeof patch.content === 'object') {
      const next = { ...patch.content };
      for (const field of VIP_SITE_FIELDS) delete next[field];
      patch.content = next;
    }
    const section = await updateSiteSection(env.DB || null, patch?.sectionKey, patch, auth.weddingKey);
    const sections = await listSiteSectionsAdmin(env.DB || null, auth.weddingKey);
    return json(headers, { ok: true, section, sections, plan, isVip: plan === 'vip' });
  } catch (err) {
    return mapError(headers, err);
  }
}
