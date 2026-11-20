/** Progresso do convidado no /games — tenant dani-carine no backend. */

export async function fetchProgress(guestName) {
  const q = new URLSearchParams({ guestName: String(guestName || '').trim() });
  const res = await fetch(`/api/desafio/progress?${q}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(data.message || data.error || 'Não deu para carregar o progresso');
  }
  return data.progress;
}

export async function pushProgress({ guestName, answers, photos }) {
  const res = await fetch('/api/desafio/progress', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ guestName, answers, photos }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(data.message || data.error || 'Não deu para salvar o progresso');
  }
  return data.progress;
}
