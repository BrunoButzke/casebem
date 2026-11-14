const STORAGE_KEY = 'casebem_desafio_guest_name';

export function getGuestName() {
  try {
    return sessionStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function setGuestName(name) {
  sessionStorage.setItem(STORAGE_KEY, String(name || '').trim());
}

export function clearGuestName() {
  sessionStorage.removeItem(STORAGE_KEY);
}
