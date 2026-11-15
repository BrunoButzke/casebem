import { useEffect, useState } from 'react';
import { CartStorage } from '../../dani-carine/cart-storage.mjs';
import { fetchCatalog, submitCheckout } from '../../lib/casal-api.mjs';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function createCartStorage() {
  const storage =
    typeof window !== 'undefined' && window.localStorage
      ? window.localStorage
      : {
          getItem() {
            return null;
          },
          setItem() {},
          removeItem() {},
        };
  return new CartStorage(storage);
}

function formatPrice(cents) {
  return brl.format((Number(cents) || 0) / 100);
}

function newIntentKey() {
  return crypto.randomUUID();
}

export default function GiftsSection({ slug }) {
  const [cart] = useState(createCartStorage);
  const [gifts, setGifts] = useState([]);
  const [cartItems, setCartItems] = useState(() => cart.getItems());
  const [cartCount, setCartCount] = useState(() => cart.getCount());
  const [intentKey, setIntentKey] = useState(newIntentKey);
  const [open, setOpen] = useState(false);
  const [gifterName, setGifterName] = useState('');
  const [nameError, setNameError] = useState('');
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [payment, setPayment] = useState(null);

  function syncCart() {
    setCartItems(cart.getItems());
    setCartCount(cart.getCount());
    setIntentKey(newIntentKey());
    setPayment(null);
  }

  useEffect(() => {
    let cancelled = false;
    fetchCatalog(slug)
      .then((data) => {
        if (cancelled) return;
        setGifts(Array.isArray(data.gifts) ? data.gifts : []);
        if (!data.ok) {
          setStatus({
            type: 'error',
            message: data.message || data.error || 'Não foi possível carregar os presentes.',
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus({ type: 'error', message: 'Erro de conexão ao carregar os presentes.' });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  function giftById(giftId) {
    return gifts.find((gift) => gift.id === giftId);
  }

  function addGift(giftId) {
    cart.addItem(giftId, 1);
    syncCart();
  }

  function removeGift(giftId) {
    cart.removeItem(giftId);
    syncCart();
  }

  async function checkout(event) {
    event.preventDefault();
    const items = cart.getItems();
    if (items.length === 0) return;

    const name = gifterName.trim();
    if (name.length < 2) {
      setNameError('Nome deve ter pelo menos 2 caracteres');
      return;
    }
    setNameError('');
    setBusy(true);
    setStatus(null);
    try {
      const result = await submitCheckout(slug, {
        gifterName: name,
        intentKey,
        items,
      });
      if (!result.ok) {
        setStatus({
          type: 'error',
          message: result.message || result.error || 'Não foi possível gerar o Pix.',
        });
        return;
      }
      setPayment(result.payment || null);
      setStatus({ type: 'success', message: 'Pix gerado. Escaneie o QR ou copie o código.' });
    } catch {
      setStatus({ type: 'error', message: 'Erro de conexão. Tente de novo.' });
    } finally {
      setBusy(false);
    }
  }

  const qrSrc =
    payment && payment.qrCodeBase64
      ? payment.qrCodeBase64.startsWith('data:')
        ? payment.qrCodeBase64
        : `data:image/png;base64,${payment.qrCodeBase64}`
      : '';
  const pixCopy = payment && payment.qrCode ? payment.qrCode : '';

  return (
    <div className="container">
      <p className="eyebrow">Presentes</p>
      <h2>Nossa lista</h2>
      <p className="gifts__lead">Escolha um presente e pague com Pix.</p>

      <button
        type="button"
        className="btn btn--ghost magnetic cart-trigger"
        onClick={() => setOpen(true)}
      >
        Carrinho
        <span className="cart-badge" aria-live="polite">
          {cartCount}
        </span>
      </button>

      {status && !open ? (
        <p className={`gifts__status gifts__status--${status.type}`}>{status.message}</p>
      ) : null}

      <div className="gifts__grid">
        {gifts.map((gift) => (
          <article key={gift.id} className="gift-card">
            {gift.imageUrl ? (
              <figure>
                <img src={gift.imageUrl} alt="" width="400" height="400" loading="lazy" />
              </figure>
            ) : null}
            <h3>{gift.name}</h3>
            <p>{formatPrice(gift.priceInCents)}</p>
            <button type="button" className="btn btn--sm magnetic" onClick={() => addGift(gift.id)}>
              Adicionar
            </button>
          </article>
        ))}
      </div>

      {open ? (
        <aside className="gift-modal" role="dialog" aria-modal="true" aria-labelledby="cart-title">
          <button type="button" className="gift-modal__backdrop" aria-label="Fechar carrinho" onClick={() => setOpen(false)} />
          <div className="gift-modal__dialog cart-modal__dialog">
            <h3 id="cart-title">Seu carrinho</h3>
            {cartItems.length === 0 ? (
              <p className="cart-empty">Carrinho vazio</p>
            ) : (
              <ul className="cart-items">
                {cartItems.map((item) => {
                  const gift = giftById(item.giftId);
                  return (
                    <li key={item.giftId} className="cart-item">
                      <div className="cart-item__info">
                        <h4>{gift?.name || item.giftId}</h4>
                        <p>
                          {item.quantity} × {formatPrice(gift?.priceInCents)}
                        </p>
                      </div>
                      <button type="button" className="cart-item__remove" onClick={() => removeGift(item.giftId)}>
                        ×
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {payment ? (
              <div className="cart-payment-result">
                <div className="payment-success">
                  {qrSrc ? <img className="gift-modal__qr" src={qrSrc} alt="QR Code Pix" width="200" height="200" /> : null}
                  {pixCopy ? (
                    <>
                      <label htmlFor="pix-code-final">Código Pix copia e cola:</label>
                      <textarea id="pix-code-final" rows={3} readOnly value={pixCopy} />
                    </>
                  ) : null}
                </div>
              </div>
            ) : (
              <form className="cart-checkout" onSubmit={checkout} noValidate>
                <div className="form-field">
                  <label htmlFor="gifter-name">
                    Seu nome <span className="required">*</span>
                  </label>
                  <input
                    id="gifter-name"
                    name="gifterName"
                    type="text"
                    autoComplete="name"
                    maxLength={100}
                    value={gifterName}
                    disabled={busy || cartItems.length === 0}
                    onChange={(event) => setGifterName(event.target.value)}
                  />
                  {nameError ? (
                    <span className="form-error" role="alert">
                      {nameError}
                    </span>
                  ) : null}
                </div>
                {status ? <p className="cart-error">{status.message}</p> : null}
                <button type="submit" className="btn magnetic" disabled={busy || cartItems.length === 0}>
                  {busy ? 'Gerando Pix…' : 'Pagar com Pix'}
                </button>
              </form>
            )}

            <button type="button" className="btn btn--ghost" onClick={() => setOpen(false)}>
              Fechar
            </button>
          </div>
        </aside>
      ) : null}
    </div>
  );
}
