const GAME_HOSTS = new Set(['desafio.casebem.com', 'www.desafio.casebem.com']);
const SPA_INDEX = {
  '/games': '/games/index.html',
  '/app': '/app/index.html',
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
  for (const prefix of Object.keys(SPA_INDEX)) {
    if (path === prefix || path === `${prefix}/` || path.startsWith(`${prefix}/`)) {
      return SPA_INDEX[prefix];
    }
  }
  return null;
}

/**
 * Decide how Pages middleware should handle a request.
 * Functions skip `_redirects`, so nested SPA routes must be rewritten here.
 *
 * @returns {{ action: 'next' } | { action: 'rewrite', assetPath: string } | { action: 'redirect', pathname: string }}
 */
export function resolvePagesRoute(hostname, pathname) {
  const path = pathname || '/';

  if (path.startsWith('/api/') || isFilePath(path)) {
    return { action: 'next' };
  }

  if (isGameHost(hostname)) {
    if (path === '/games' || path.startsWith('/games/')) {
      const stripped = path.slice('/games'.length) || '/';
      return { action: 'redirect', pathname: stripped.startsWith('/') ? stripped : `/${stripped}` };
    }
    return { action: 'rewrite', assetPath: '/games/index.html' };
  }

  const spaIndex = spaIndexForPath(path);
  if (spaIndex) return { action: 'rewrite', assetPath: spaIndex };

  return { action: 'next' };
}
