import { gameSlugFromPathname } from '../../src/lib/game-paths.mjs';

export function getGameSlug() {
  if (typeof window === 'undefined') return null;
  return gameSlugFromPathname(window.location.pathname);
}

export function desafioUrl(path, { slug, search } = {}) {
  const url = new URL(path, 'https://casebem.local');
  const s = slug === undefined ? getGameSlug() : slug;
  if (s) url.searchParams.set('slug', s);
  if (search && typeof search === 'object') {
    for (const [k, v] of Object.entries(search)) {
      if (v != null && v !== '') url.searchParams.set(k, String(v));
    }
  }
  return `${url.pathname}${url.search}`;
}