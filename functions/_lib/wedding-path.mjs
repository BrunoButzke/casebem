import { WEDDING_KEY as DEFAULT_WEDDING_KEY } from './messages-validators.mjs';

const RESERVED = new Set([
  'api',
  'games',
  'app',
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

/** Casal parceiro com site completo publicado. */
export const PUBLISHED_WEDDING_KEY = DEFAULT_WEDDING_KEY;

/**
 * Extrai o slug do casamento a partir de um pathname (/bruno-cris/admin → bruno-cris).
 */
export function weddingKeyFromPathname(pathname) {
  const path = String(pathname || '/');
  const match = path.match(/^\/([a-z0-9]+(?:-[a-z0-9]+)*)/i);
  if (!match) return DEFAULT_WEDDING_KEY;
  const slug = match[1].toLowerCase();
  if (RESERVED.has(slug)) return DEFAULT_WEDDING_KEY;
  return slug;
}

export function isPublishedWeddingSite(weddingKey) {
  return String(weddingKey || '').trim().toLowerCase() === PUBLISHED_WEDDING_KEY;
}

export function coupleNamesFallbackFromSlug(id) {
  const parts = String(id || '')
    .split('-')
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) return 'Os noivos';
  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' & ');
}
