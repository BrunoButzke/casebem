const GAME_HOSTS = new Set(['desafio.casebem.com', 'www.desafio.casebem.com']);
const SPA_INDEX = {
  '/games': '/games/',
  '/app': '/app/',
  '/demo/game': '/demo/game/',
};

/** Prefixo de path que NÃO é tenant (slug noiva-noivo). */
const RESERVED_TENANT_SEGMENTS = new Set([
  'api',
  'games',
  'app',
  'demo',
  'landing-page-animada',
  'lista',
  'images',
  'assets',
  'src',
  'public',
  'config',
  'docs',
  'functions',
  'migrations',
  'node_modules',
  'test',
  'tests',
  'data',
  'dist',
  'dev',
  'scripts',
]);

/**
 * Reescreve /{slug}/ e /{slug}/admin para o template compartilhado (dani-carine).
 * @returns {{ action: 'rewrite', assetPath: string } | null}
 */
export function resolveTenantAssetRewrite(pathname) {
  const raw = String(pathname || '/');
  const path = raw.replace(/\/+$/, '') || '/';
  const match = path.match(
    /^\/([a-z0-9]+(?:-[a-z0-9]+)*)(?:\/(admin(?:\.html)?|lista(?:\.html)?))?$/i
  );
  if (!match) return null;

  const slug = match[1].toLowerCase();
  if (RESERVED_TENANT_SEGMENTS.has(slug)) return null;

  const page = String(match[2] || '').toLowerCase();

  // Pasta física do casal parceiro: só pretty URL de admin/lista.
  if (slug === 'dani-carine') {
    if (page === 'admin') return { action: 'rewrite', assetPath: '/dani-carine/admin.html' };
    if (page === 'lista') return { action: 'rewrite', assetPath: '/dani-carine/lista.html' };
    return null;
  }

  if (!page) return { action: 'rewrite', assetPath: '/dani-carine/' };
  if (page.startsWith('admin')) return { action: 'rewrite', assetPath: '/dani-carine/admin.html' };
  if (page.startsWith('lista')) return { action: 'rewrite', assetPath: '/dani-carine/lista.html' };
  return null;
}

export function isGameHost(hostname) {
  return GAME_HOSTS.has(String(hostname || '').toLowerCase());
}

export function gamesRouterBasename(hostname) {
  return isGameHost(hostname) ? '/' : '/games';
}

function lastSegment(pathname) {
  const trimmed = String(pathname || '/').replace(/\/+$/, '') || '/';
  return trimmed.slice(trimmed.lastIndexOf('/') + 1);
}

function isFilePath(pathname) {
  return lastSegment(pathname).includes('.');
}

function spaIndexForPath(pathname) {
  const path = String(pathname || '/');
  for (const [prefix, asset] of Object.entries(SPA_INDEX)) {
    if (path === prefix || path === `${prefix}/`) return null;
    if (path.startsWith(`${prefix}/`)) return asset;
  }
  return null;
}

/**
 * Decide how Pages middleware should handle a request.
 * Functions skip `_redirects`, so nested SPA routes must be rewritten here.
 * Rewrite to the directory (`/games/`), never `/games/index.html` — Pages 308s
 * index.html onto the pretty URL and that dropped the original path.
 *
 * @returns {{ action: 'next' } | { action: 'rewrite', assetPath: string } | { action: 'redirect', pathname: string }}
 */
export function resolvePagesRoute(hostname, pathname) {
  const path = pathname || '/';

  if (path.startsWith('/api/')) {
    return { action: 'next' };
  }

  if (isGameHost(hostname)) {
    if (isFilePath(path)) return { action: 'next' };
    if (path === '/games' || path.startsWith('/games/')) {
      const stripped = path.slice('/games'.length) || '/';
      return { action: 'redirect', pathname: stripped.startsWith('/') ? stripped : `/${stripped}` };
    }
    return { action: 'rewrite', assetPath: '/games/' };
  }

  const tenantRewrite = resolveTenantAssetRewrite(path);
  if (tenantRewrite) return tenantRewrite;

  if (isFilePath(path)) {
    return { action: 'next' };
  }

  if (path === '/' || path === '') {
    return { action: 'redirect', pathname: '/landing-page-animada/' };
  }

  const spaIndex = spaIndexForPath(path);
  if (spaIndex) return { action: 'rewrite', assetPath: spaIndex };

  return { action: 'next' };
}
