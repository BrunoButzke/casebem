const STORAGE_KEY = 'casebem_desafio_guest_name';

function readStore(store) {
  try {
    return store.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

function writeStore(store, value) {
  try {
    if (value) store.setItem(STORAGE_KEY, value);
    else store.removeItem(STORAGE_KEY);
  } catch {
    /* ignore quota / private mode */
  }
}

export function getGuestName() {
  const local = readStore(localStorage);
  if (local) return local;
  const session = readStore(sessionStorage);
  if (session) writeStore(localStorage, session);
  return session;
}

export function setGuestName(name) {
  const value = String(name || '').trim();
  writeStore(localStorage, value);
  writeStore(sessionStorage, value);
}

export function clearGuestName() {
  writeStore(localStorage, '');
  writeStore(sessionStorage, '');
}
