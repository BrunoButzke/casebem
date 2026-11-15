export const RESERVED_SLUGS = new Set([
  'admin',
  'entrar',
  'casal',
  'games',
  'game',
  'api',
  'app',
  'www',
  'static',
  'login',
  'signup',
  'conta',
  'dani-carine',
]);

export function normalizeSlug(raw) {
  return String(raw ?? '').trim().toLowerCase();
}

export function assertSlugFormat(slug) {
  const value = String(slug || '');
  if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(value)) {
    throw new Error('SLUG_INVALID');
  }
  if (value.includes('--')) throw new Error('SLUG_INVALID');
}
