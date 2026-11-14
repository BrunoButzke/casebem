/**
 * Host-based routing: desafio.casebem.com → games SPA at `/`
 * Nested /games/* on casebem.com also rewrites here because Pages Functions
 * skip `_redirects` SPA fallback.
 */

import { resolvePagesRoute } from './_lib/pages-routing.mjs';

async function fetchAsset(context, assetPath, requestUrl) {
  const origin = new URL(requestUrl).origin;
  const headers = new Headers(context.request.headers);
  let url = new URL(assetPath, origin);
  url.search = new URL(requestUrl).search;

  for (let hop = 0; hop < 3; hop += 1) {
    const res = await context.env.ASSETS.fetch(new Request(url.toString(), { method: 'GET', headers }));
    if (res.status < 300 || res.status >= 400) return res;
    const location = res.headers.get('Location');
    if (!location) return res;
    url = new URL(location, url);
  }

  return new Response(null, { status: 404 });
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const route = resolvePagesRoute(url.hostname, url.pathname);

  if (route.action === 'redirect') {
    const dest = new URL(route.pathname, url);
    dest.search = url.search;
    return Response.redirect(dest.toString(), 302);
  }

  if (route.action === 'rewrite' && context.env?.ASSETS) {
    return fetchAsset(context, route.assetPath, url);
  }

  return context.next();
}
