import { getGameSlug } from './game-api.mjs';

export function progressStorageKey(slug, guestName) {
  const guest = String(guestName || '').trim().toLowerCase();
  if (!slug) return `casebem_desafio_progress:${guest}`;
  return `casebem_desafio_progress:${guest}:${slug}`;
}

function storageKey(guestName) {
  return progressStorageKey(getGameSlug(), guestName);
}

export function emptyProgress() {
  return { answers: {}, photos: {} };
}

export function loadProgress(guestName) {
  try {
    const raw = localStorage.getItem(storageKey(guestName));
    if (!raw) return emptyProgress();
    const parsed = JSON.parse(raw);
    return {
      answers: parsed?.answers && typeof parsed.answers === 'object' ? parsed.answers : {},
      photos: parsed?.photos && typeof parsed.photos === 'object' ? parsed.photos : {},
    };
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(guestName, progress) {
  localStorage.setItem(storageKey(guestName), JSON.stringify(progress));
}

export function photoEntry(shot) {
  if (!shot) return null;
  if (typeof shot === 'object') return shot;
  return { done: Boolean(shot) };
}