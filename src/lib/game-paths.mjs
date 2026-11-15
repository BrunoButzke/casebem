export function gameSlugFromPathname(pathname) {
  const m = String(pathname || '').match(/^\/casal\/([^/]+)\/game(?:\/|$)/i);
  return m ? decodeURIComponent(m[1]).trim().toLowerCase() : null;
}

export function gameTo(to, slug) {
  const path = String(to || '/');
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (!slug) return normalized === '' ? '/' : normalized;
  const base = `/casal/${encodeURIComponent(slug)}/game`;
  if (normalized === '/') return `${base}/`;
  return `${base}${normalized}`;
}
