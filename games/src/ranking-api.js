export async function fetchRanking() {
  const res = await fetch('/api/desafio/ranking', { credentials: 'omit' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.message || 'Não deu para carregar o ranking');
  return Array.isArray(data.rows) ? data.rows : [];
}

export async function reportRankingScore({ guestName, points, stamps }) {
  const res = await fetch('/api/desafio/ranking', {
    method: 'POST',
    credentials: 'omit',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ guestName, points, stamps }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.message || data.error || 'Não deu para atualizar o ranking');
  return Array.isArray(data.rows) ? data.rows : [];
}
