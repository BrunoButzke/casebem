const SPA_PREFIXES = ['/games', '/app', '/entrar', '/admin', '/casal'];

export function rewriteMpaSpaUrl(url) {
  const raw = String(url || '/');
  const qIndex = raw.indexOf('?');
  const path = qIndex >= 0 ? raw.slice(0, qIndex) : raw;
  const query = qIndex >= 0 ? raw.slice(qIndex) : '';
  const last = path.slice(path.lastIndexOf('/') + 1);
  if (last.includes('.')) return raw;

  if (path === '/entrar' || path.startsWith('/entrar/')) return `/index.html${query}`;
  if (path === '/admin' || path.startsWith('/admin/')) return `/index.html${query}`;
  if (path === '/casal' || path.startsWith('/casal/')) return `/index.html${query}`;

  for (const prefix of ['/games', '/app']) {
    if (path === prefix || path === `${prefix}/`) return raw;
    if (path.startsWith(`${prefix}/`)) return `${prefix}/index.html${query}`;
  }
  return raw;
}

function attach(server) {
  server.middlewares.use((req, _res, next) => {
    if (req.url) req.url = rewriteMpaSpaUrl(req.url);
    next();
  });
}

export function mpaSpaFallbackPlugin() {
  return {
    name: 'mpa-spa-fallback',
    configureServer: attach,
    configurePreviewServer: attach,
  };
}