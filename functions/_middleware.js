/**
 * Host-based routing: desafio.casebem.com → games SPA at `/`
 * Nested /games/* on casebem.com also rewrites here because Pages Functions
 * skip `_redirects` SPA fallback.
 */

import { resolvePagesRoute } from './_lib/pages-routing.mjs';

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const route = resolvePagesRoute(url.hostname, url.pathname);

  if (route.action === 'redirect') {
    const dest = new URL(route.pathname, url);
    dest.search = url.search;
    return Response.redirect(dest.toString(), 302);
  }

  if (route.action === 'rewrite' && context.env?.ASSETS) {
    const assetUrl = new URL(route.assetPath, url.origin);
    assetUrl.search = url.search;
    return context.env.ASSETS.fetch(new Request(assetUrl.toString(), context.request));
  }

  return context.next();
}
