async function readJson(res) {
  const type = res.headers.get('content-type') || '';
  return type.includes('json') ? await res.json().catch(() => ({})) : {};
}

export async function fetchCouplePage(slug) {
  const res = await fetch(`/api/casal/${encodeURIComponent(slug)}`, { credentials: 'omit' });
  const data = await readJson(res);
  if (!res.ok) {
    return { ok: false, status: res.status, error: data.error || 'SLUG_NOT_FOUND' };
  }
  return { ok: true, slug: data.slug, isPartner: Boolean(data.isPartner) };
}

export async function searchGuestsPublic(slug, q) {
  const params = new URLSearchParams({ q: String(q ?? ''), slug: String(slug ?? '') });
  const res = await fetch(`/api/guests/search?${params}`, { credentials: 'omit' });
  const data = await readJson(res);
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: data.error,
      message: data.message,
      matches: [],
      count: 0,
    };
  }
  return data;
}

export async function submitRsvp(slug, payload) {
  const key = crypto.randomUUID();
  const res = await fetch('/api/rsvp', {
    method: 'POST',
    credentials: 'omit',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': key,
    },
    body: JSON.stringify({ ...payload, slug }),
  });
  const data = await readJson(res);
  return { ok: res.ok, status: res.status, ...data };
}
