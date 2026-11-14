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

  // Static/SPA under /games
  if (url.pathname === '/games' || url.pathname.startsWith('/games/')) {
    return context.next();
  }

  // Map desafio.* root (and unknown paths) onto the games SPA.
  const rewritten = new URL(context.request.url);
  rewritten.pathname = url.pathname === '/' || url.pathname === '' ? '/games/' : `/games${url.pathname}`;

  if (context.env?.ASSETS) {
    return context.env.ASSETS.fetch(new Request(rewritten.toString(), context.request));
  }

  return Response.redirect(rewritten.toString(), 302);
}
