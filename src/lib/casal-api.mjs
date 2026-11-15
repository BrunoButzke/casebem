export async function fetchCouplePage(slug) {
  const res = await fetch(`/api/casal/${encodeURIComponent(slug)}`, { credentials: 'omit' });
  const type = res.headers.get('content-type') || '';
  const data = type.includes('json') ? await res.json().catch(() => ({})) : {};
  if (!res.ok) {
    return { ok: false, status: res.status, error: data.error || 'SLUG_NOT_FOUND' };
  }
  return { ok: true, slug: data.slug, isPartner: Boolean(data.isPartner) };
}