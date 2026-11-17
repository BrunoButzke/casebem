function newIntentKey() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function fetchActiveRaffle() {
  const res = await fetch('/api/desafio/raffle', { credentials: 'omit' });
  const data = await res.json().catch(() => ({}));
  if (res.status === 404) return null;
  if (!res.ok || !data.ok) throw new Error(data.message || data.error || 'Não deu para carregar o sorteio');
  return data.raffle || null;
}

export async function checkoutRaffle({ raffleId, numbers, guestName, payerEmail, intentKey }) {
  const res = await fetch('/api/desafio/raffle/checkout', {
    method: 'POST',
    credentials: 'omit',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      raffleId,
      numbers,
      guestName,
      payerEmail,
      intentKey: intentKey || newIntentKey(),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    const err = new Error(data.message || data.error || 'Não deu para gerar o Pix');
    err.code = data.error;
    err.status = res.status;
    err.details = data;
    throw err;
  }
  return data;
}

export async function confirmRafflePayment(paymentId) {
  const res = await fetch('/api/desafio/raffle/confirm', {
    method: 'POST',
    credentials: 'omit',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.message || data.error || 'Falha ao confirmar');
  return data;
}

export async function fetchPaymentStatus(paymentId) {
  const res = await fetch(`/api/payment-status?id=${encodeURIComponent(paymentId)}`, {
    credentials: 'omit',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Falha ao consultar pagamento');
  return data;
}

export { newIntentKey };
