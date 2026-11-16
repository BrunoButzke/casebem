/**
 * Sessão do painel do jogo. O Bearer vem de POST /api/admin/login
 * (ADMIN_PANEL_SECRET do ambiente), não fica hardcoded no front.
 */

export const GAMES_ADMIN_USER = 'Carine';
export const GAMES_ADMIN_PASS = 'Dani';
export const GAMES_ADMIN_STORAGE_KEY = 'casebem_games_admin_token';

export function isGamesAdminPath(pathname) {
  const path = String(pathname || '');
  return path === '/admin' || path.startsWith('/admin/');
}

export function acceptsGamesAdminCredentials(user, pass) {
  return String(user || '').trim() === GAMES_ADMIN_USER && String(pass || '') === GAMES_ADMIN_PASS;
}

function readToken() {
  try {
    return sessionStorage.getItem(GAMES_ADMIN_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

function writeToken(token) {
  try {
    if (token) sessionStorage.setItem(GAMES_ADMIN_STORAGE_KEY, token);
    else sessionStorage.removeItem(GAMES_ADMIN_STORAGE_KEY);
  } catch {
    /* ignore quota / private mode */
  }
}

export function getGamesAdminToken() {
  return readToken();
}

export function setGamesAdminToken(token) {
  const value = String(token || '').trim();
  writeToken(value);
}

export function isGamesAdminLoggedIn() {
  return getGamesAdminToken().length >= 16;
}

export function logoutGamesAdmin() {
  writeToken('');
}
