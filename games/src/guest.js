import { getGameSlug } from './game-api.mjs';

export function guestStorageKey(slug) {
  if (!slug) return 'casebem_desafio_guest_name';
  return `casebem_desafio_guest_name:${slug}`;
}

function currentStorageKey() {
  return guestStorageKey(getGameSlug());
}

function readStore(store) {
  try {
    return store.getItem(currentStorageKey()) || '';
  } catch {
    return '';
  }
}

function writeStore(store, value) {
  try {
    const key = currentStorageKey();
    if (value) store.setItem(key, value);
    else store.removeItem(key);
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