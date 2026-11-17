import { useEffect, useMemo, useRef, useState } from 'react';
import { usePlay } from '../PlayContext.jsx';
import {
  checkoutRaffle,
  confirmRafflePayment,
  fetchActiveRaffle,
  fetchPaymentStatus,
  newIntentKey,
} from '../raffle-api.js';

function formatPrice(cents) {
  return (Number(cents || 0) / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export default function Sorteio() {
  const { guestName } = usePlay();
  const [raffle, setRaffle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [email, setEmail] = useState('');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [pix, setPix] = useState(null);
  const [paid, setPaid] = useState(false);
  const intentRef = useRef(newIntentKey());
  const pollRef = useRef(null);

  async function reload() {
    const next = await fetchActiveRaffle();
    setRaffle(next);
    setError('');
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const next = await fetchActiveRaffle();
        if (!cancelled) {
          setRaffle(next);
          setError('');
          setSelected(new Set());
        }
      } catch (err) {
        if (!cancelled) {
          setRaffle(null);
          setError(err.message || 'Não deu para carregar o sorteio.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, []);

  const available = raffle?.availableNumbers || [];
  const sold = raffle?.soldNumbers || [];
  const total = useMemo(
    () => selected.size * (Number(raffle?.priceCents) || 0),
    [selected, raffle?.priceCents]
  );

  function toggleNumber(n) {
    if (pix || pending) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  }

  function closeCheckout() {
    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = null;
    setCheckoutOpen(false);
    setCheckoutError('');
    if (paid) {
      setPix(null);
      setPaid(false);
      setSelected(new Set());
      intentRef.current = newIntentKey();
      reload().catch(() => {});
    }
  }

  function startPolling(paymentId) {
    if (pollRef.current) window.clearInterval(pollRef.current);
    let attempts = 0;
    pollRef.current = window.setInterval(async () => {
      attempts += 1;
      if (attempts > 50) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
        return;
      }
      try {
        const status = await fetchPaymentStatus(paymentId);
        const st = status.status || status.payment?.status;
        if (st === 'approved') {
          window.clearInterval(pollRef.current);
          pollRef.current = null;
          await confirmRafflePayment(paymentId);
          setPaid(true);
          await reload();
        } else if (st === 'cancelled' || st === 'rejected') {
          window.clearInterval(pollRef.current);
          pollRef.current = null;
          setCheckoutError('Pagamento não concluído. Tente de novo.');
        }
      } catch {
        /* ignore */
      }
    }, 3000);
  }

  async function onBuy() {
    if (!raffle || !selected.size || pending) return;
    setCheckoutOpen(true);
    setCheckoutError('');
    setPaid(false);
    setPix(null);
    setPending(true);
    try {
      const data = await checkoutRaffle({
        raffleId: raffle.id,
        numbers: [...selected].sort((a, b) => a - b),
        guestName: guestName || 'Convidado',
        payerEmail: email.trim(),
        intentKey: intentRef.current,
      });
      setPix(data.payment);
      if (data.payment?.id) startPolling(data.payment.id);
      await reload();
      setSelected(new Set());
    } catch (err) {
      setCheckoutError(err.message || 'Não deu para gerar o Pix');
      if (err.code === 'NUMBERS_UNAVAILABLE') {
        intentRef.current = newIntentKey();
        reload().catch(() => {});
      }
    } finally {
      setPending(false);
    }
  }

  if (loading) {
    return (
      <div className="play-page">
        <h1 className="sorteio-title">Sorteio</h1>
        <p className="play-sub">Carregando…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="play-page">
        <h1 className="sorteio-title">Sorteio</h1>
        <p className="hub-empty" role="status">
          {error}
        </p>
      </div>
    );
  }

  if (!raffle) {
    return (
      <div className="play-page">
        <h1 className="sorteio-title">Sorteio</h1>
        <p className="hub-empty" role="status">
          Nenhum sorteio ativo no momento.
        </p>
      </div>
    );
  }

  return (
    <div className="play-page sorteio-page">
      <h1 className="sorteio-title">{raffle.name}</h1>
      <p className="play-sub">Escolha seus números · {formatPrice(raffle.priceCents)} cada</p>

      {raffle.imageUrl ? (
        <div className="sorteio-photo">
          <img src={raffle.imageUrl} alt="" decoding="async" />
        </div>
      ) : null}

      <section className="sorteio-section" aria-labelledby="sorteio-disponiveis">
        <h2 id="sorteio-disponiveis">Disponíveis</h2>
        <div className="sorteio-grid">
          {available.map((n) => {
            const on = selected.has(n);
            return (
              <button
                key={n}
                type="button"
                className={`sorteio-num${on ? ' is-selected' : ''}`}
                aria-pressed={on}
                onClick={() => toggleNumber(n)}
              >
                {n}
              </button>
            );
          })}
        </div>
        {!available.length ? <p className="hub-empty">Todos os números já foram vendidos.</p> : null}
      </section>

      <section className="sorteio-section" aria-labelledby="sorteio-comprados">
        <h2 id="sorteio-comprados">Comprados</h2>
        {sold.length ? (
          <div className="sorteio-grid">
            {sold.map((n) => (
              <span key={n} className="sorteio-num is-sold">
                {n}
              </span>
            ))}
          </div>
        ) : (
          <p className="hub-empty">Nenhum número comprado ainda.</p>
        )}
      </section>

      <div className="sorteio-checkout">
        <label className="sorteio-email">
          <span className="sr-only">E-mail para o Pix</span>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="E-mail para o Pix"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={pending || Boolean(pix)}
          />
        </label>
        <p className="sorteio-total">
          {selected.size
            ? `${selected.size} número(s) · ${formatPrice(total)}`
            : 'Selecione um ou mais números'}
        </p>
        <button
          type="button"
          className="desafio__cta"
          disabled={!selected.size || !email.trim() || pending}
          onClick={onBuy}
        >
          {pending ? 'Gerando Pix…' : 'Comprar com Pix'}
        </button>
      </div>

      {checkoutOpen ? (
        <div className="quiz-modal" role="dialog" aria-modal="true" aria-labelledby="sorteio-pay-title">
          <button type="button" className="quiz-modal__backdrop" aria-label="Fechar" onClick={closeCheckout} />
          <div className="quiz-modal__panel">
            <p className="quiz-modal__kicker">Sorteio</p>
            <h2 id="sorteio-pay-title">{paid ? 'Pagamento confirmado!' : 'Pague com Pix'}</h2>
            {checkoutError ? <p className="hub-error">{checkoutError}</p> : null}
            {paid ? (
              <p className="play-sub">Seus números estão garantidos. Obrigado!</p>
            ) : pix ? (
              <>
                {pix.qrCodeBase64 ? (
                  <img
                    className="sorteio-pix-qr"
                    src={
                      String(pix.qrCodeBase64).startsWith('data:')
                        ? pix.qrCodeBase64
                        : `data:image/png;base64,${pix.qrCodeBase64}`
                    }
                    alt="QR Code Pix"
                  />
                ) : null}
                <p className="play-sub">Escaneie o QR ou copie o código Pix:</p>
                <textarea className="sorteio-pix-code" readOnly rows={3} value={pix.qrCode || ''} />
                <button
                  type="button"
                  className="desafio__cta desafio__cta--ghost"
                  onClick={() => {
                    if (pix.qrCode && navigator.clipboard) navigator.clipboard.writeText(pix.qrCode);
                  }}
                >
                  Copiar código
                </button>
                <p className="play-sub">Confirmamos automaticamente após o pagamento.</p>
              </>
            ) : pending ? (
              <p className="play-sub">Gerando Pix…</p>
            ) : null}
            <button type="button" className="desafio__cta" onClick={closeCheckout}>
              {paid ? 'Fechar' : 'Fechar'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
