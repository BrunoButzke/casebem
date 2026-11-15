import { PARTNER_ACCOUNT_ID, resolveAccountBySlug } from './auth-service.mjs';

export function slugFromRequest(request, body = null) {
  const url = new URL(request.url);
  const q = String(url.searchParams.get('slug') || '').trim().toLowerCase();
  if (q) return q;
  if (body && typeof body.slug === 'string') {
    const s = body.slug.trim().toLowerCase();
    if (s) return s;
  }
  return null;
}

export async function resolvePublicSlug(db, slug) {
  const normalized = String(slug || '').trim().toLowerCase();
  if (!normalized) return { ok: false, status: 400, error: 'SLUG_REQUIRED' };
  const account = await resolveAccountBySlug(db, normalized);
  if (!account) return { ok: false, status: 404, error: 'SLUG_NOT_FOUND' };
  return { ok: true, account };
}

const PARTNER_FALLBACK = {
  id: PARTNER_ACCOUNT_ID,
  slug: 'dani-carine',
  isPartner: true,
};

export async function resolvePublicSlugOrPartner(db, slug) {
  const normalized = slug == null ? '' : String(slug).trim().toLowerCase();
  if (!normalized) {
    const account = await resolveAccountBySlug(db, 'dani-carine');
    return { ok: true, account: account || PARTNER_FALLBACK, legacy: true };
  }
  return resolvePublicSlug(db, normalized);
}
