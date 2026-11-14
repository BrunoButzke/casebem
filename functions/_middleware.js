/**
 * Host-based routing: desafio.casebem.com → /games SPA
 * Same Pages project shares Functions + D1.
 * Local/dev path remains /games/; production host is desafio.casebem.com.
 */

function isGameHost(hostname) {
  return hostname === 'desafio.casebem.com' || hostname === 'www.desafio.casebem.com';
}

export async function onRequest(context) {
  const url = new URL(context.request.url);

  if (!isGameHost(url.hostname)) {
    return context.next();
  }

  // API stays on this host (same Functions / D1).
  if (url.pathname.startsWith('/api/')) {
    return context.next();
  }

  // Already under /games — serve normally (static + _redirects SPA fallback).
  if (url.pathname === '/games' || url.pathname.startsWith('/games/')) {
    return context.next();
  }

  // Root and unknown paths → games SPA.
  // Prefer an explicit 302 to /games/ (proven 200 in production) so we never
  // depend on ASSETS.fetch path quirks for the host apex.
  if (url.pathname === '/' || url.pathname === '') {
    return Response.redirect(new URL('/games/', url).toString(), 302);
  }

  const assetPath =
    url.pathname.includes('.') ? `/games${url.pathname}` : `/games/index.html`;

  if (context.env?.ASSETS) {
    const assetUrl = new URL(assetPath, url.origin);
    const res = await context.env.ASSETS.fetch(new Request(assetUrl.toString(), context.request));
    if (res.status !== 404) return res;
    return context.env.ASSETS.fetch(new Request(new URL('/games/index.html', url.origin).toString(), context.request));
  }

  return Response.redirect(new URL('/games/', url).toString(), 302);
}
