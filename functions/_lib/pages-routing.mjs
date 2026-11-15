const GAME_HOSTS = new Set(['desafio.casebem.com', 'www.desafio.casebem.com']);
const SPA_INDEX = {
  '/games': '/games/',
  '/app': '/app/',
};

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

  if (path.startsWith('/api/') || isFilePath(path)) {
    return { action: 'next' };
  }

  if (path === '/casal' || path === '/casal/') {
    return { action: 'redirect', pathname: '/entrar' };
  }

  if (!isGameHost(hostname) && (path === '/' || path === '/index.html')) {
    return { action: 'next' };
  }

  const spaRoots = ['/entrar', '/admin', '/casal'];
  for (const root of spaRoots) {
    if (path === root || path.startsWith(`${root}/`)) {
      return { action: 'rewrite', assetPath: '/' };
    }
  }

  if (isGameHost(hostname)) {
    if (path === '/games' || path.startsWith('/games/')) {
      const stripped = path.slice('/games'.length) || '/';
      return { action: 'redirect', pathname: stripped.startsWith('/') ? stripped : `/${stripped}` };
    }
    return { action: 'rewrite', assetPath: '/games/' };
  }

  const spaIndex = spaIndexForPath(path);
  if (spaIndex) return { action: 'rewrite', assetPath: spaIndex };

  return { action: 'next' };
}
