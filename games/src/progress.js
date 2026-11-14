function storageKey(guestName) {
  return `casebem_desafio_progress:${String(guestName || '').trim().toLowerCase()}`;
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
