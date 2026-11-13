/**
 * Auth temporária — alinhada ao painel HTML (Dani/Carine → Bearer admin-local-dev-ok).
 * Trocar depois por login real.
 */

export const TEMP_USER = 'Dani';
export const TEMP_PASS = 'Carine';
export const TEMP_TOKEN = 'admin-local-dev-ok';
export const STORAGE_KEY = 'casebem_admin_token';

export function getToken() {
  try {
    return sessionStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function setToken(token) {
  sessionStorage.setItem(STORAGE_KEY, token);
}

export function clearToken() {
  sessionStorage.removeItem(STORAGE_KEY);
}

export function isLoggedIn() {
  return getToken() === TEMP_TOKEN;
}

export function tryLogin(user, pass) {
  if (user === TEMP_USER && pass === TEMP_PASS) {
    setToken(TEMP_TOKEN);
    return true;
  }
  return false;
}

export function logout() {
  clearToken();
}
