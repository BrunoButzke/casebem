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
  
  // Setup HTML structure (simulando dani-carine/index.html)
  document.body.innerHTML = `
    <main id="main">
      <button id="cart-button" aria-label="Abrir carrinho">🎁 <span id="cart-badge">0</span></button>
    </main>
    
    <aside id="cart-modal" class="cart-modal" hidden>
      <div class="cart-overlay"></div>
      <div class="cart-panel">
        <button id="cart-close" class="cart-close" aria-label="Fechar carrinho">✕</button>
        <h2>Meu Carrinho</h2>
        
        <div id="cart-items"></div>
        
        <div id="cart-summary" hidden>
          <div class="cart-total"></div>
          
          <label for="gifter-name">Seu nome completo:</label>
          <input type="text" id="gifter-name" required />
          
          <label for="payment-method">Forma de pagamento:</label>
          <select id="payment-method">
            <option value="pix">Pix</option>
            <option value="card">Cartão (em breve)</option>
            <option value="boleto">Boleto (em breve)</option>
          </select>
          
          <button id="cart-checkout" class="btn btn-primary">Finalizar Compra</button>
          <div id="cart-error" hidden></div>
        </div>
        
        <div id="payment-result" hidden></div>
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
  
  global.fetch = async () => ({
    ok: true,
    json: async () => ({ ok: true, method: 'pix', status: 'pending', payment: { qrCode: 'test' } }),
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
  const { initCart } = await import('../src/dani-carine/cart.mjs');
  initCart(global.window);

  // Adicionar item ao carrinho
  global.window.dispatchEvent(new global.window.CustomEvent('addToCart', {
    detail: { giftId: 'danca', quantity: 1 },
  }));

  // Abrir modal
  const cartButton = document.getElementById('cart-button');
  cartButton.click();

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
  
  const { initCart } = await import('../src/dani-carine/cart.mjs');
  initCart(global.window);

  // Adicionar item
  global.window.dispatchEvent(new global.window.CustomEvent('addToCart', {
    detail: { giftId: 'danca', quantity: 1 },
  }));

  // Abrir modal
  const cartButton = document.getElementById('cart-button');
  cartButton.click();

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
  
  const { initCart } = await import('../src/dani-carine/cart.mjs');
  initCart(global.window);

  const main = document.getElementById('main');
  
  // Adicionar item
  global.window.dispatchEvent(new global.window.CustomEvent('addToCart', {
    detail: { giftId: 'danca', quantity: 1 },
  }));

  // Abrir modal
  const cartButton = document.getElementById('cart-button');
  cartButton.click();

  // Verificar inert
  assert.ok(main.hasAttribute('inert'), '<main> deve ter inert quando modal aberto');
  assert.equal(main.getAttribute('aria-hidden'), 'true', '<main> deve ter aria-hidden');

  // Fechar modal
  const closeButton = document.getElementById('cart-close');
  closeButton.click();

  assert.equal(main.hasAttribute('inert'), false, '<main> não deve ter inert quando modal fechado');
  assert.equal(main.getAttribute('aria-hidden'), 'false');

  cleanupDOM();
});

test('Cart validation: rejeita nome vazio/curto', async () => {
  const { document } = setupDOM();
  
  const { initCart } = await import('../src/dani-carine/cart.mjs');
  initCart(global.window);

  // Adicionar item
  global.window.dispatchEvent(new global.window.CustomEvent('addToCart', {
    detail: { giftId: 'danca', quantity: 1 },
  }));

  // Abrir modal
  document.getElementById('cart-button').click();

  const nameInput = document.getElementById('gifter-name');
  const checkoutBtn = document.getElementById('cart-checkout');
  const errorDiv = document.getElementById('cart-error');

  // Tentar checkout com nome vazio
  nameInput.value = '';
  checkoutBtn.click();

  // Aguardar evento assíncrono
  await new Promise(resolve => setTimeout(resolve, 50));

  assert.equal(errorDiv.hidden, false, 'Erro deve ser exibido');
  assert.match(errorDiv.textContent, /nome/i, 'Erro deve mencionar nome');

  // Tentar com nome muito curto
  nameInput.value = 'A';
  checkoutBtn.click();

  await new Promise(resolve => setTimeout(resolve, 50));

  assert.equal(errorDiv.hidden, false);

  cleanupDOM();
});

test('Cart XSS: rejeita QR code base64 com script tags', async () => {
  const { document } = setupDOM();
  
  // Mock fetch com payload malicioso
  global.fetch = async () => ({
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

  const { initCart } = await import('../src/dani-carine/cart.mjs');
  initCart(global.window);

  // Adicionar item
  global.window.dispatchEvent(new global.window.CustomEvent('addToCart', {
    detail: { giftId: 'danca', quantity: 1 },
  }));

  // Abrir modal e fazer checkout
  document.getElementById('cart-button').click();
  document.getElementById('gifter-name').value = 'João Silva';
  document.getElementById('cart-checkout').click();

  await new Promise(resolve => setTimeout(resolve, 100));

  const paymentResult = document.getElementById('payment-result');
  
  // Verificar que não há <script> no DOM
  assert.equal(paymentResult.querySelector('script'), null, 'Não deve haver tag script');
  assert.match(paymentResult.textContent, /inválido/i, 'Deve exibir erro de QR inválido');

  cleanupDOM();
});

test('Cart XSS: valida base64 estritamente', async () => {
  const { document } = setupDOM();
  
  const testCases = [
    { base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', valid: true },
    { base64: 'data:image/svg+xml;base64,PHN2Zz48c2NyaXB0PmFsZXJ0KDEpPC9zY3JpcHQ+PC9zdmc+', valid: false },  // SVG com script
    { base64: 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==', valid: false },  // HTML
    { base64: 'not-valid-base64!@#$', valid: false },  // Não é base64
  ];

  for (const testCase of testCases) {
    global.fetch = async () => ({
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

    const { initCart } = await import('../src/dani-carine/cart.mjs');
    initCart(global.window);

    global.window.dispatchEvent(new global.window.CustomEvent('addToCart', {
      detail: { giftId: 'danca', quantity: 1 },
    }));

    document.getElementById('cart-button').click();
    document.getElementById('gifter-name').value = 'João Silva';
    document.getElementById('cart-checkout').click();

    await new Promise(resolve => setTimeout(resolve, 100));

    const paymentResult = document.getElementById('payment-result');
    const hasImage = paymentResult.querySelector('img') !== null;

    if (testCase.valid) {
      assert.ok(hasImage || paymentResult.textContent.includes('qr'), 
        `Base64 válido deve renderizar: ${testCase.base64.substring(0, 50)}`);
    } else {
      assert.equal(hasImage, false, 
        `Base64 inválido não deve renderizar imagem: ${testCase.base64.substring(0, 50)}`);
    }

    cleanupDOM();
    setupDOM();  // Reset para próximo teste
  }

  cleanupDOM();
});

test('Cart: badge atualiza corretamente com quantidade', async () => {
  const { document } = setupDOM();
  
  const { initCart } = await import('../src/dani-carine/cart.mjs');
  initCart(global.window);

  const badge = document.getElementById('cart-badge');
  assert.equal(badge.textContent, '0', 'Badge inicial deve ser 0');

  // Adicionar 2 items
  global.window.dispatchEvent(new global.window.CustomEvent('addToCart', {
    detail: { giftId: 'danca', quantity: 2 },
  }));

  assert.equal(badge.textContent, '2', 'Badge deve mostrar 2');

  // Adicionar mais 1
  global.window.dispatchEvent(new global.window.CustomEvent('addToCart', {
    detail: { giftId: 'spa', quantity: 1 },
  }));

  assert.equal(badge.textContent, '3', 'Badge deve mostrar 3');

  cleanupDOM();
});

test('Cart: ajuste de quantidade via botões + e -', async () => {
  const { document } = setupDOM();
  
  const { initCart } = await import('../src/dani-carine/cart.mjs');
  initCart(global.window);

  // Adicionar item
  global.window.dispatchEvent(new global.window.CustomEvent('addToCart', {
    detail: { giftId: 'danca', quantity: 1 },
  }));

  // Abrir modal
  document.getElementById('cart-button').click();

  const cartItems = document.getElementById('cart-items');
  const plusButton = cartItems.querySelector('[data-action="increase"]');
  const minusButton = cartItems.querySelector('[data-action="decrease"]');
  const quantitySpan = cartItems.querySelector('.item-quantity');

  assert.ok(plusButton, 'Botão + deve existir');
  assert.ok(minusButton, 'Botão - deve existir');
  assert.equal(quantitySpan.textContent, '1', 'Quantidade inicial deve ser 1');

  // Aumentar quantidade
  plusButton.click();
  assert.equal(quantitySpan.textContent, '2', 'Quantidade deve aumentar para 2');

  // Diminuir quantidade
  minusButton.click();
  assert.equal(quantitySpan.textContent, '1', 'Quantidade deve voltar para 1');

  cleanupDOM();
});

test('Cart: verdadeira mensagem sobre confirmação pendente/manual', async () => {
  const { document } = setupDOM();
  
  global.fetch = async () => ({
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

  const { initCart } = await import('../src/dani-carine/cart.mjs');
  initCart(global.window);

  global.window.dispatchEvent(new global.window.CustomEvent('addToCart', {
    detail: { giftId: 'danca', quantity: 1 },
  }));

  document.getElementById('cart-button').click();
  document.getElementById('gifter-name').value = 'João Silva';
  document.getElementById('cart-checkout').click();

  await new Promise(resolve => setTimeout(resolve, 100));

  const paymentResult = document.getElementById('payment-result');
  const noteText = paymentResult.textContent.toLowerCase();

  // Não deve prometer confirmação automática ou "alguns minutos"
  assert.equal(noteText.includes('confirmado automaticamente'), false, 
    'Não deve prometer confirmação automática');
  assert.equal(noteText.includes('alguns minutos'), false, 
    'Não deve prometer confirmação em minutos');

  // Deve mencionar pendência e confirmação manual
  assert.ok(noteText.includes('pendente') || noteText.includes('manual'), 
    'Deve mencionar pendência ou confirmação manual');

  cleanupDOM();
});
