export async function fetchActiveRaffle() {
  const res = await fetch('/api/desafio/raffle', { credentials: 'omit' });
  const data = await res.json().catch(() => ({}));
  if (res.status === 404) return null;
  if (!res.ok || !data.ok) throw new Error(data.message || data.error || 'Não deu para carregar o sorteio');
  return data.raffle || null;
}
