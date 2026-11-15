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
  return { ok: true, slug: data.slug, isPartner: Boolean(data.isPartner), page: data.page || null };
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

export async function fetchCatalog(slug) {
  const params = new URLSearchParams({ slug: String(slug ?? '') });
  const res = await fetch(`/api/gifts/catalog?${params}`, { credentials: 'omit' });
  const data = await readJson(res);
  if (!res.ok) {
    return { ok: false, status: res.status, error: data.error, gifts: [] };
  }
  return data;
}

export async function submitCheckout(slug, payload) {
  const res = await fetch('/api/gifts/checkout', {
    method: 'POST',
    credentials: 'omit',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...payload,
      slug,
      paymentMethod: 'pix',
    }),
  });
  const data = await readJson(res);
  return { ok: res.ok, status: res.status, ...data };
}

export async function fetchMessages(slug, { limit = 12, cursor } = {}) {
  const params = new URLSearchParams({
    slug: String(slug ?? ''),
    limit: String(limit),
  });
  if (cursor) params.set('cursor', String(cursor));
  const res = await fetch(`/api/messages?${params}`, { credentials: 'omit' });
  const data = await readJson(res);
  if (!res.ok) {
    return { ok: false, status: res.status, error: data.error, messages: [], nextCursor: null };
  }
  return data;
}

export async function postMessage(slug, payload) {
  const key = crypto.randomUUID();
  const res = await fetch('/api/messages', {
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
