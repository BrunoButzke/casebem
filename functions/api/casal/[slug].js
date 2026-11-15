import { getCorsHeaders } from '../../_lib/http-helpers.mjs';
import { resolvePublicSlug } from '../../_lib/public-slug.mjs';

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
  return Response.json(
    { ok: true, slug: resolved.account.slug, isPartner: Boolean(resolved.account.isPartner) },
    { status: 200, headers }
  );
}
