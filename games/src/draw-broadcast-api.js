/** Público — estado do sorteio para telões */

export async function fetchDrawBroadcast() {
  const res = await fetch('/api/desafio/raffle/draw-broadcast', {
    headers: { Accept: 'application/json' },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    return { phase: 'gallery' };
  }
  return data.broadcast || { phase: 'gallery' };
}
