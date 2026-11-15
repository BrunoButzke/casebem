/**
 * Público — tema do app desafio (sem auth)
 */

import { getCorsHeaders } from '../../_lib/http-helpers.mjs';
import { getDesafioTheme, themeToCssVars } from '../../_lib/desafio-theme-service.mjs';
import { slugFromRequest, resolvePublicSlugOrPartner } from '../../_lib/public-slug.mjs';

function json(headers, body, status = 200) {
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return Response.json(body, { status, headers });
}

export async function onRequestOptions(context) {
  return new Response(null, { status: 204, headers: getCorsHeaders(context.request) });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const headers = getCorsHeaders(request);

  try {
    const slug = slugFromRequest(request);
    const resolved = await resolvePublicSlugOrPartner(env.DB || null, slug);
    if (!resolved.ok) {
      return json(headers, { error: resolved.error }, resolved.status);
    }
    const theme = await getDesafioTheme(env.DB || null, resolved.account.id);
    return json(headers, { ok: true, theme, cssVars: themeToCssVars(theme) });
  } catch (err) {
    return json(headers, { ok: false, error: 'THEME_FAILED', message: err.message }, 500);
  }
}
