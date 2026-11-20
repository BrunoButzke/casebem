import { resolveTenantAssetRewrite } from '../functions/_lib/pages-routing.mjs';

const SPA_PREFIXES = ['/games', '/app', '/demo/game'];

export function rewriteMpaSpaUrl(url) {
  const raw = String(url || '/');
  const qIndex = raw.indexOf('?');
  const path = qIndex >= 0 ? raw.slice(0, qIndex) : raw;
  const query = qIndex >= 0 ? raw.slice(qIndex) : '';

  const tenant = resolveTenantAssetRewrite(path);
  if (tenant?.action === 'rewrite') {
    return `${tenant.assetPath}${query}`;
  }

  for (const prefix of SPA_PREFIXES) {
    if (path === prefix || path === `${prefix}/`) return raw;
    if (!path.startsWith(`${prefix}/`)) continue;
    const last = path.slice(path.lastIndexOf('/') + 1);
    if (last.includes('.')) return raw;
    return `${prefix}/index.html${query}`;
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
