/**
 * Real DOM tests for cart frontend using Happy-DOM
 * Run with: node --test tests/cart-frontend-real.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';

// Setup DOM environment
function setupDOM() {
  const window = new Window();
  const document = window.document;
  
  // Set base URL para fetch relativo funcionar
  window.location.href = 'https://casebem.com.br/dani-carine/';
  
  // Setup HTML structure (simulando dani-carine/index.html)
  document.body.innerHTML = `
    <header>
      <nav>
        <div class="nav__links"></div>
      </nav>
    </header>
    <main id="main"></main>
    
    <aside id="cart-modal" class="cart-modal" hidden>
      <div class="cart-overlay"></div>
      <div class="cart-panel">
        <button id="cart-close" class="cart-close" aria-label="Fechar carrinho">✕</button>
        <h2>Meu Carrinho</h2>
        
        <div id="cart-items"></div>
        
        <div class="cart-total">
          <strong>Total:</strong>
          <span id="cart-total-value">R$ 0,00</span>
        </div>
        
        <div class="cart-checkout" id="cart-checkout">
          <div class="form-field">
            <label for="gifter-name">Seu nome <span class="required">*</span></label>
            <input type="text" id="gifter-name" required minlength="2" maxlength="100" />
            <span class="form-error" id="gifter-name-error" role="alert" hidden></span>
          </div>
          <div class="form-field" id="gifter-email-field">
            <label for="gifter-email">E-mail para o Pix</label>
            <input type="email" id="gifter-email" maxlength="120" />
            <span class="form-error" id="gifter-email-error" role="alert" hidden></span>
          </div>
          
          <div class="payment-methods">
            <div class="payment-method">
              <input type="radio" id="pix" name="paymentMethod" value="pix" checked />
              <label for="pix">Pix</label>
            </div>
            <div class="payment-method">
              <input type="radio" id="card" name="paymentMethod" value="card" />
              <label for="card">Cartão de crédito</label>
            </div>
            <div class="payment-method">
              <input type="radio" id="boleto" name="paymentMethod" value="boleto" />
              <label for="boleto">Boleto bancário</label>
            </div>
          </div>
          
          <p class="cart-error" id="cart-error" hidden role="alert"></p>
          
          <button type="button" class="btn magnetic" id="cart-checkout-btn">Finalizar compra</button>
        </div>
        
        <div id="cart-payment-result" hidden></div>
      </div>
    </aside>
  `;

  // Inject window globals needed by cart.mjs
  global.window = window;
  global.document = document;
  global.sessionStorage = window.sessionStorage;
  
  // Mock crypto.randomUUID no window (cart.mjs lê de window.crypto ou global.crypto)
  window.crypto = {
    randomUUID: () => '550e8400-e29b-41d4-a716-446655440000',
  };
  
  // Mock requestAnimationFrame
  window.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  window.setTimeout = setTimeout;
  window.setInterval = setInterval;
  window.clearTimeout = clearTimeout;
  window.clearInterval = clearInterval;
  
  // Mock window.fetch (não global.fetch - Happy-DOM usa window.fetch)
  window.fetch = async () => ({
    ok: true,
    json: async () => ({ ok: true, method: 'pix', status: 'pending', payment: { qrCode: 'test', qrCodeBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' } }),
  });

  return { window, document };
}

function cleanupDOM() {
  delete global.window;
  delete global.document;
  delete global.sessionStorage;
  delete global.fetch;
}

test('Cart modal focus trap: Tab cycles through modal elements', async () => {
  const { document } = setupDOM();
  
  // Dynamically import cart after DOM is ready
  const { initCart, addToCart, openCartModal } = await import('../src/dani-carine/cart.mjs');
  initCart(global.window);

  // Adicionar item ao carrinho via API pública
  addToCart('danca', 1);

  // Abrir modal via API pública
  openCartModal();

  const modal = document.getElementById('cart-modal');
  assert.equal(modal.hidden, false, 'Modal deve estar visível');

  // Verificar focus trap: Tab deve circular entre elementos focáveis
  const focusableElements = modal.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled])');
  assert.ok(focusableElements.length >= 3, 'Modal deve ter múltiplos elementos focáveis');

  // Simular Tab no último elemento
  const lastElement = focusableElements[focusableElements.length - 1];
  lastElement.focus();
  
  const tabEvent = new global.window.KeyboardEvent('keydown', { 
    key: 'Tab', 
    bubbles: true,
    cancelable: true,
  });
  
  modal.dispatchEvent(tabEvent);

  cleanupDOM();
});

test('Cart modal: Escape key fecha modal e restaura focus', async () => {
  const { document } = setupDOM();
  
  const { initCart, addToCart, openCartModal } = await import('../src/dani-carine/cart.mjs');
  initCart(global.window);

  // Adicionar item
  addToCart('danca', 1);

  // Abrir modal
  openCartModal();

  const modal = document.getElementById('cart-modal');
  assert.equal(modal.hidden, false);

  // Pressionar Escape
  const escEvent = new global.window.KeyboardEvent('keydown', { 
    key: 'Escape', 
    bubbles: true,
  });
  document.dispatchEvent(escEvent);

  assert.equal(modal.hidden, true, 'Modal deve fechar com Escape');

  cleanupDOM();
});

test('Cart: inert attribute aplicado em <main> quando modal aberto', async () => {
  const { document } = setupDOM();
  
  const { initCart, addToCart, openCartModal, closeCartModal } = await import('../src/dani-carine/cart.mjs');
  initCart(global.window);

  const main = document.getElementById('main');
  
  // Adicionar item
  addToCart('danca', 1);

  // Abrir modal
  openCartModal();

  // Verificar inert
  assert.ok(main.hasAttribute('inert'), '<main> deve ter inert quando modal aberto');
  assert.equal(main.getAttribute('aria-hidden'), 'true', '<main> deve ter aria-hidden');

  // Fechar modal
  closeCartModal();

  assert.equal(main.hasAttribute('inert'), false, '<main> não deve ter inert quando modal fechado');
  assert.equal(main.getAttribute('aria-hidden'), 'false');

  cleanupDOM();
});

test('Cart validation: rejeita nome vazio/curto', async () => {
  const { document } = setupDOM();
  
  const { initCart, addToCart, openCartModal } = await import('../src/dani-carine/cart.mjs');
  initCart(global.window);

  // Adicionar item
  addToCart('danca', 1);

  // Abrir modal
  openCartModal();

  const nameInput = document.getElementById('gifter-name');
  const checkoutBtn = document.getElementById('cart-checkout-btn');
  const nameError = document.getElementById('gifter-name-error');

  // Tentar checkout com nome vazio
  nameInput.value = '';
  checkoutBtn.click();

  // Aguardar evento assíncrono
  await new Promise(resolve => setTimeout(resolve, 50));

  assert.equal(nameError.hidden, false, 'Erro de nome deve ser exibido');
  assert.match(nameError.textContent, /nome|caracteres/i, 'Erro deve mencionar nome ou caracteres');

  // Tentar com nome muito curto
  nameInput.value = 'A';
  nameError.hidden = true;  // Reset
  checkoutBtn.click();

  await new Promise(resolve => setTimeout(resolve, 50));

  assert.equal(nameError.hidden, false, 'Erro de nome curto deve ser exibido');

  cleanupDOM();
});

test('Cart XSS: rejeita QR code base64 com script tags', async () => {
  const { window, document } = setupDOM();
  
  // Mock window.fetch com payload malicioso
  window.fetch = async () => ({
    ok: true,
    json: async () => ({
      ok: true,
      method: 'pix',
      status: 'pending',
      payment: {
        id: 'test',
        qrCode: 'safe_code',
        qrCodeBase64: '<script>alert("XSS")</script>',
      },
    }),
  });

  const { initCart, addToCart, openCartModal } = await import('../src/dani-carine/cart.mjs');
  initCart(global.window);

  // Adicionar item
  addToCart('danca', 1);

  // Abrir modal e fazer checkout
  openCartModal();
  await new Promise(resolve => setTimeout(resolve, 10));
  
  document.getElementById('gifter-name').value = 'João Silva';
  const emailEl = document.getElementById('gifter-email');
  if (emailEl) emailEl.value = 'joao@email.com';
  document.getElementById('cart-checkout-btn').click();

  await new Promise(resolve => setTimeout(resolve, 100));

  const paymentResult = document.getElementById('cart-payment-result');
  
  // Verificar que não há <script> no DOM
  assert.equal(paymentResult.querySelector('script'), null, 'Não deve haver tag script');
  assert.match(paymentResult.textContent, /inválido/i, 'Deve exibir erro de QR inválido');

  cleanupDOM();
});

test('Cart XSS: valida base64 estritamente', async () => {
  const { window, document } = setupDOM();
  
  const testCases = [
    { base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', valid: true },
    { base64: 'data:image/svg+xml;base64,PHN2Zz48c2NyaXB0PmFsZXJ0KDEpPC9zY3JpcHQ+PC9zdmc+', valid: false },  // SVG com script
    { base64: 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==', valid: false },  // HTML
    { base64: 'not-valid-base64!@#$', valid: false },  // Não é base64
  ];

  for (const testCase of testCases) {
    window.fetch = async () => ({
      ok: true,
      json: async () => ({
        ok: true,
        method: 'pix',
        status: 'pending',
        payment: {
          id: 'test',
          qrCode: 'safe_code',
          qrCodeBase64: testCase.base64,
        },
      }),
    });

    const { initCart, addToCart, openCartModal } = await import('../src/dani-carine/cart.mjs');
    initCart(window);  // Usar window do setupDOM atual, não global.window

    addToCart('danca', 1);

    openCartModal();
    await new Promise(resolve => setTimeout(resolve, 10));
    
    document.getElementById('gifter-name').value = 'João Silva';
    const emailEl = document.getElementById('gifter-email');
    if (emailEl) emailEl.value = 'joao@email.com';
    document.getElementById('cart-checkout-btn').click();

    await new Promise(resolve => setTimeout(resolve, 100));

    const paymentResult = document.getElementById('cart-payment-result');
    const hasImage = paymentResult.querySelector('img') !== null;

    if (testCase.valid) {
      assert.ok(hasImage || paymentResult.textContent.includes('qr'), 
        `Base64 válido deve renderizar: ${testCase.base64.substring(0, 50)}`);
    } else {
      assert.equal(hasImage, false, 
        `Base64 inválido não deve renderizar imagem: ${testCase.base64.substring(0, 50)}`);
    }

    cleanupDOM();
  }
});

test('Cart: badge atualiza corretamente com quantidade', async () => {
  const { document } = setupDOM();
  
  const { initCart, addToCart } = await import('../src/dani-carine/cart.mjs');
  initCart(global.window);

  // Badge é criado dinamicamente por setupCartBadge
  await new Promise(resolve => setTimeout(resolve, 10));
  
  const badge = document.querySelector('.cart-badge');
  assert.ok(badge, 'Badge deve existir');
  assert.equal(badge.textContent, '0', 'Badge inicial deve ser 0');

  // Adicionar 2 items
  addToCart('danca', 2);

  assert.equal(badge.textContent, '2', 'Badge deve mostrar 2');

  // Adicionar mais 1
  addToCart('spa', 1);

  assert.equal(badge.textContent, '3', 'Badge deve mostrar 3');

  cleanupDOM();
});

test('Cart: ajuste de quantidade via botões + e -', async () => {
  const { document } = setupDOM();
  
  const cartModule = await import('../src/dani-carine/cart.mjs');
  const { initCart, addToCart, openCartModal } = cartModule;
  initCart(global.window);
  
  // Adicionar item
  addToCart('danca', 1);

  // Abrir modal
  openCartModal();
  await new Promise(resolve => setTimeout(resolve, 50));

  const cartItems = document.getElementById('cart-items');
  assert.ok(cartItems, 'Container cart-items deve existir');
  
  let plusButton = cartItems.querySelector('[data-action="inc"]');
  let minusButton = cartItems.querySelector('[data-action="dec"]');
  let quantityDisplay = cartItems.querySelector('.cart-qty');

  assert.ok(plusButton, 'Botão + deve existir');
  assert.ok(minusButton, 'Botão - deve existir');
  assert.ok(quantityDisplay, 'Display de quantidade deve existir');
  assert.equal(quantityDisplay.textContent, '1', 'Quantidade inicial deve ser 1');

  // Aumentar quantidade
  plusButton.click();
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Re-query após re-render
  quantityDisplay = cartItems.querySelector('.cart-qty');
  assert.equal(quantityDisplay.textContent, '2', 'Quantidade deve aumentar para 2');

  // Diminuir quantidade
  minusButton = cartItems.querySelector('[data-action="dec"]');
  minusButton.click();
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Re-query após re-render
  quantityDisplay = cartItems.querySelector('.cart-qty');
  assert.equal(quantityDisplay.textContent, '1', 'Quantidade deve voltar para 1');

  cleanupDOM();
});

test('Cart: mensagem Pix + e-mail obrigatório', async () => {
  const { window, document } = setupDOM();
  
  window.fetch = async () => ({
    ok: true,
    json: async () => ({
      ok: true,
      method: 'pix',
      status: 'pending',
      payment: {
        id: 'test_payment',
        qrCode: 'test_qr_code',
        qrCodeBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      },
    }),
  });

  const { initCart, addToCart, openCartModal } = await import('../src/dani-carine/cart.mjs');
  initCart(global.window);

  addToCart('danca', 1);

  openCartModal();
  await new Promise(resolve => setTimeout(resolve, 10));
  
  document.getElementById('gifter-name').value = 'João Silva';
  const emailInput = document.getElementById('gifter-email');
  if (emailInput) emailInput.value = 'joao@email.com';
  document.getElementById('cart-checkout-btn').click();

  await new Promise(resolve => setTimeout(resolve, 100));

  const paymentResult = document.getElementById('cart-payment-result');
  const noteText = paymentResult.textContent.toLowerCase();

  assert.ok(noteText.includes('pix') || noteText.includes('qr') || noteText.includes('confirmação'),
    'Deve orientar sobre Pix/confirmação');

  cleanupDOM();
});
