import { getCorsHeaders } from '../../_lib/http-helpers.mjs';
import { resolvePublicSlug } from '../../_lib/public-slug.mjs';
import { getCouplePage } from '../../_lib/couple-page-service.mjs';

export async function onRequestOptions(context) {
  return new Response(null, { status: 204, headers: getCorsHeaders(context.request) });
}

export async function onRequestGet(context) {
  const { request, env, params } = context;
  const headers = getCorsHeaders(request);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  const resolved = await resolvePublicSlug(env.DB || null, params?.slug);
  if (!resolved.ok) {
    return Response.json({ error: resolved.error }, { status: resolved.status, headers });
  }
  const page = await getCouplePage(env.DB || null, resolved.account.id);
  return Response.json(
    { ok: true, slug: resolved.account.slug, isPartner: Boolean(resolved.account.isPartner), page },
    { status: 200, headers }
  );
}
