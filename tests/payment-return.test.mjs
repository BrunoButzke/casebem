import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import {
  parsePaymentReturn,
  showPaymentReturnBanner,
  cleanPaymentReturnUrl,
  initPaymentReturn,
} from '../src/dani-carine/payment-return.mjs';

test('parsePaymentReturn lê status e método', () => {
  assert.deepEqual(parsePaymentReturn('?pago=ok&metodo=card'), {
    status: 'ok',
    method: 'card',
  });
  assert.equal(parsePaymentReturn('?foo=1'), null);
  assert.equal(parsePaymentReturn('?pago=xyz'), null);
});

test('showPaymentReturnBanner + clean URL', () => {
  const window = new Window({
    url: 'https://casebem.com/dani-carine/?pago=ok&metodo=boleto',
  });
  const { document } = window;
  document.body.innerHTML = '<header class="nav"></header><main></main>';

  let cleared = false;
  const banner = showPaymentReturnBanner(
    document,
    { status: 'ok', method: 'boleto' },
    { clearCart: () => { cleared = true; } }
  );
  assert.ok(banner);
  assert.match(banner.textContent, /Pagamento confirmado/);
  assert.equal(cleared, true);

  cleanPaymentReturnUrl(window.location, window.history);
  assert.equal(window.location.search.includes('pago'), false);
});

test('initPaymentReturn erro não limpa carrinho', () => {
  const window = new Window({
    url: 'https://casebem.com/dani-carine/?pago=erro&metodo=card',
  });
  window.document.body.innerHTML = '<header class="nav"></header>';
  let cleared = false;
  initPaymentReturn(window, { clearCart: () => { cleared = true; } });
  assert.equal(cleared, false);
  assert.ok(window.document.getElementById('payment-return-banner'));
  assert.equal(window.location.search.includes('pago'), false);
});
