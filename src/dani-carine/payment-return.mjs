/**
 * UX pós-redirect Checkout Pro — ?pago=ok|erro|pendente[&metodo=card|boleto]
 */

const MESSAGES = {
  ok: {
    tone: 'ok',
    title: 'Pagamento confirmado',
    body: 'Obrigado! Se o status ainda aparecer como pendente no comprovante, o webhook confirma em instantes.',
  },
  pendente: {
    tone: 'pending',
    title: 'Pagamento em análise',
    body: 'Recebemos seu retorno. Boleto e alguns cartões podem levar alguns minutos para confirmar.',
  },
  erro: {
    tone: 'error',
    title: 'Pagamento não concluído',
    body: 'Nada foi cobrado (ou a cobrança falhou). Você pode tentar de novo pela lista de presentes.',
  },
};

/**
 * @param {string|URLSearchParams|null} search
 * @returns {{status: 'ok'|'erro'|'pendente', method: string|null}|null}
 */
export function parsePaymentReturn(search) {
  let params;
  if (search instanceof URLSearchParams) params = search;
  else if (typeof search === 'string') {
    const q = search.startsWith('?') ? search.slice(1) : search;
    params = new URLSearchParams(q);
  } else return null;

  const raw = String(params.get('pago') || '').toLowerCase();
  if (raw !== 'ok' && raw !== 'erro' && raw !== 'pendente') return null;
  const method = params.get('metodo') || params.get('method') || null;
  return { status: raw, method: method ? String(method) : null };
}

function escapeText(el, text) {
  el.textContent = text;
}

/**
 * @param {Document} doc
 * @param {{status: string, method?: string|null}} info
 * @param {{clearCart?: () => void, openGifts?: () => void}} [hooks]
 */
export function showPaymentReturnBanner(doc, info, hooks = {}) {
  if (!doc?.body || !info?.status || !MESSAGES[info.status]) return null;

  const existing = doc.getElementById('payment-return-banner');
  if (existing) existing.remove();

  const msg = MESSAGES[info.status];
  const banner = doc.createElement('div');
  banner.id = 'payment-return-banner';
  banner.className = `payment-return payment-return--${msg.tone}`;
  banner.setAttribute('role', 'status');

  const inner = doc.createElement('div');
  inner.className = 'payment-return__inner container';

  const copy = doc.createElement('div');
  copy.className = 'payment-return__copy';
  const title = doc.createElement('strong');
  escapeText(title, msg.title);
  const body = doc.createElement('p');
  escapeText(body, msg.body);
  if (info.method) {
    const meta = doc.createElement('span');
    meta.className = 'payment-return__meta';
    escapeText(meta, `Método: ${info.method}`);
    copy.append(title, body, meta);
  } else {
    copy.append(title, body);
  }

  const actions = doc.createElement('div');
  actions.className = 'payment-return__actions';

  if (info.status === 'erro' || info.status === 'pendente') {
    const giftsBtn = doc.createElement('button');
    giftsBtn.type = 'button';
    giftsBtn.className = 'btn btn--sm';
    escapeText(giftsBtn, 'Ver presentes');
    giftsBtn.addEventListener('click', () => {
      if (typeof hooks.openGifts === 'function') hooks.openGifts();
      else {
        const el = doc.getElementById('presentes');
        el?.scrollIntoView({ behavior: 'smooth' });
      }
      banner.remove();
    });
    actions.appendChild(giftsBtn);
  }

  const closeBtn = doc.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'payment-return__close';
  closeBtn.setAttribute('aria-label', 'Fechar');
  escapeText(closeBtn, '×');
  closeBtn.addEventListener('click', () => banner.remove());
  actions.appendChild(closeBtn);

  inner.append(copy, actions);
  banner.appendChild(inner);

  const header = doc.querySelector('header.nav');
  if (header?.parentNode) {
    header.parentNode.insertBefore(banner, header.nextSibling);
  } else {
    doc.body.prepend(banner);
  }

  if (info.status === 'ok' && typeof hooks.clearCart === 'function') {
    hooks.clearCart();
  }

  return banner;
}

/**
 * Remove pago/metodo da URL sem reload.
 * @param {Location} location
 * @param {History} history
 */
export function cleanPaymentReturnUrl(location, history) {
  if (!location || !history?.replaceState) return;
  const url = new URL(location.href);
  if (!url.searchParams.has('pago')) return;
  url.searchParams.delete('pago');
  url.searchParams.delete('metodo');
  url.searchParams.delete('method');
  const next = `${url.pathname}${url.search}${url.hash}`;
  history.replaceState({}, '', next);
}

/**
 * @param {Window} win
 * @param {{clearCart?: () => void}} [hooks]
 */
export function initPaymentReturn(win = typeof window !== 'undefined' ? window : null, hooks = {}) {
  if (!win?.location || !win.document) return null;
  const info = parsePaymentReturn(win.location.search);
  if (!info) return null;
  const banner = showPaymentReturnBanner(win.document, info, hooks);
  cleanPaymentReturnUrl(win.location, win.history);
  return banner;
}
