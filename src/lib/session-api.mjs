export function api(path, { method = 'GET', body } = {}) {
  return fetch(path, {
    method,
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body,
  });
}

export function signupRequest({ email, password, plan }) {
  return api('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, plan }),
  });
}

export function loginRequest({ email, password }) {
  return api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function logoutRequest() {
  return api('/api/auth/logout', { method: 'POST' });
}

export function meRequest() {
  return api('/api/auth/me');
}

export async function parseMe(res) {
  if (!res || !res.ok) return null;
  const type = res.headers.get('content-type') || '';
  if (!type.includes('json')) return null;
  try {
    const data = await res.json();
    if (!data || typeof data.email !== 'string') return null;
    return data;
  } catch {
    return null;
  }
}

export function upgradePlanRequest(plan) {
  return api('/api/account/plan', {
    method: 'POST',
    body: JSON.stringify({ plan }),
  });
}
