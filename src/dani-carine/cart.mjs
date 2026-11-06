/**
 * Cart UI - Interface do carrinho de presentes
 */

import { CartStorage } from './cart-storage.mjs';
import { GIFTS_CATALOG, getGiftById, formatPrice } from '../../data/gifts-catalog.mjs';

let cart = null;

/**
 * Inicializa o carrinho
 */
export function initCart() {
  cart = new CartStorage(sessionStorage);

  setupCartBadge();
  setupGiftCards();
  setupCartModal();
  updateCartBadge();
}

/**
 * Configura badge do carrinho
 */
function setupCartBadge() {
  const existingBadge = document.querySelector('.cart-badge');
  if (existingBadge) return;

  const nav = document.querySelector('.nav__links');
  if (!nav) return;

  const cartLink = document.createElement('button');
  cartLink.type = 'button';
  cartLink.className = 'btn btn--sm magnetic cart-trigger';
  cartLink.setAttribute('aria-label', 'Ver carrinho');
  cartLink.innerHTML = `
    Carrinho
    <span class="cart-badge" aria-live="polite">0</span>
  `;

  cartLink.addEventListener('click', openCartModal);
  
  const parent = nav.parentElement;
  parent.appendChild(cartLink);
}

/**
 * Configura cards de presentes para adicionar ao carrinho
 */
function setupGiftCards() {
  const giftCards = document.querySelectorAll('.gift-card');
  
  giftCards.forEach(card => {
    card.addEventListener('click', (e) => {
      e.preventDefault();
      const giftId = card.dataset.gift;
      if (!giftId) return;

      // Adicionar ao carrinho
      cart.addItem(giftId, 1);
      updateCartBadge();
      
      // Feedback visual
      showCartFeedback(`Presente adicionado ao carrinho!`);
    });
  });
}

/**
 * Atualiza badge do carrinho
 */
function updateCartBadge() {
  const badge = document.querySelector('.cart-badge');
  if (!badge) return;

  const count = cart.getCount();
  badge.textContent = String(count);
  badge.style.display = count > 0 ? 'inline-flex' : 'none';
}

/**
 * Mostra feedback ao adicionar item
 */
function showCartFeedback(message) {
  const existing = document.querySelector('.cart-feedback');
  if (existing) existing.remove();

  const feedback = document.createElement('div');
  feedback.className = 'cart-feedback';
  feedback.setAttribute('role', 'status');
  feedback.setAttribute('aria-live', 'polite');
  feedback.textContent = message;
  
  document.body.appendChild(feedback);

  requestAnimationFrame(() => {
    feedback.classList.add('is-visible');
  });

  setTimeout(() => {
    feedback.classList.remove('is-visible');
    setTimeout(() => feedback.remove(), 300);
  }, 2000);
}

/**
 * Abre modal do carrinho
 */
function openCartModal() {
  let modal = document.getElementById('cart-modal');
  
  if (!modal) {
    modal = createCartModal();
    document.body.appendChild(modal);
  }

  renderCartItems();
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  
  // Focus no primeiro elemento interativo
  const firstButton = modal.querySelector('button:not([disabled])');
  if (firstButton) firstButton.focus();
}

/**
 * Fecha modal do carrinho
 */
function closeCartModal() {
  const modal = document.getElementById('cart-modal');
  if (!modal) return;

  modal.hidden = true;
  document.body.style.overflow = '';
}

/**
 * Cria estrutura do modal do carrinho
 */
function createCartModal() {
  const modal = document.createElement('div');
  modal.id = 'cart-modal';
  modal.className = 'gift-modal';
  modal.hidden = true;

  modal.innerHTML = `
    <div class="gift-modal__backdrop" data-close-cart></div>
    <div class="gift-modal__dialog cart-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="cart-modal-title">
      <button type="button" class="gift-modal__close" data-close-cart aria-label="Fechar">×</button>
      
      <h3 id="cart-modal-title">Seu carrinho</h3>
      
      <div class="cart-items" id="cart-items" aria-live="polite">
        <!-- Items renderizados via JS -->
      </div>
      
      <div class="cart-total">
        <strong>Total:</strong>
        <span id="cart-total-value">R$ 0,00</span>
      </div>
      
      <div class="cart-checkout" id="cart-checkout">
        <div class="form-field">
          <label for="gifter-name">Seu nome <span class="required">*</span></label>
          <input
            type="text"
            id="gifter-name"
            required
            minlength="2"
            maxlength="100"
            autocomplete="name"
            placeholder="João Silva"
            aria-describedby="gifter-name-error"
          />
          <span class="form-error" id="gifter-name-error" role="alert"></span>
        </div>
        
        <fieldset class="form-field">
          <legend>Forma de pagamento <span class="required">*</span></legend>
          <div class="radio-group">
            <label class="radio-label">
              <input type="radio" name="paymentMethod" value="pix" checked />
              <span>Pix</span>
            </label>
            <label class="radio-label">
              <input type="radio" name="paymentMethod" value="card" />
              <span>Cartão de crédito</span>
            </label>
            <label class="radio-label">
              <input type="radio" name="paymentMethod" value="boleto" />
              <span>Boleto bancário</span>
            </label>
          </div>
        </fieldset>
        
        <p class="cart-error" id="cart-error" hidden role="alert"></p>
        
        <button type="button" class="btn magnetic" id="cart-checkout-btn">
          Finalizar compra
        </button>
      </div>
      
      <div class="cart-payment-result" id="cart-payment-result" hidden>
        <!-- Resultado do pagamento -->
      </div>
    </div>
  `;

  // Event listeners
  modal.querySelectorAll('[data-close-cart]').forEach(el => {
    el.addEventListener('click', closeCartModal);
  });

  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeCartModal();
  });

  const checkoutBtn = modal.querySelector('#cart-checkout-btn');
  checkoutBtn.addEventListener('click', handleCheckout);

  return modal;
}

/**
 * Renderiza itens do carrinho
 */
function renderCartItems() {
  const container = document.getElementById('cart-items');
  const totalEl = document.getElementById('cart-total-value');
  if (!container || !totalEl) return;

  const items = cart.getItems();

  if (items.length === 0) {
    container.innerHTML = '<p class="cart-empty">Seu carrinho está vazio</p>';
    totalEl.textContent = 'R$ 0,00';
    
    const checkoutBtn = document.getElementById('cart-checkout-btn');
    if (checkoutBtn) checkoutBtn.disabled = true;
    
    return;
  }

  // Calcular total
  let total = 0;
  const itemsHtml = items.map(item => {
    const gift = getGiftById(item.giftId);
    if (!gift) return '';

    const subtotal = gift.priceInCents * item.quantity;
    total += subtotal;

    return `
      <article class="cart-item">
        <img src="${gift.imageUrl}" alt="${gift.name}" width="80" height="80" />
        <div class="cart-item__info">
          <h4>${gift.name}</h4>
          <p>${formatPrice(gift.priceInCents)}</p>
        </div>
        <div class="cart-item__actions">
          <button type="button" class="cart-qty-btn" data-action="dec" data-gift-id="${item.giftId}" aria-label="Diminuir quantidade">−</button>
          <span class="cart-qty" aria-label="Quantidade">${item.quantity}</span>
          <button type="button" class="cart-qty-btn" data-action="inc" data-gift-id="${item.giftId}" aria-label="Aumentar quantidade">+</button>
        </div>
        <div class="cart-item__subtotal">
          ${formatPrice(subtotal)}
        </div>
        <button type="button" class="cart-item__remove" data-gift-id="${item.giftId}" aria-label="Remover ${gift.name}">×</button>
      </article>
    `;
  }).join('');

  container.innerHTML = itemsHtml;
  totalEl.textContent = formatPrice(total);

  // Event listeners para quantidade
  container.querySelectorAll('.cart-qty-btn').forEach(btn => {
    btn.addEventListener('click', handleQuantityChange);
  });

  container.querySelectorAll('.cart-item__remove').forEach(btn => {
    btn.addEventListener('click', handleRemoveItem);
  });

  const checkoutBtn = document.getElementById('cart-checkout-btn');
  if (checkoutBtn) checkoutBtn.disabled = false;
}

/**
 * Manipula mudança de quantidade
 */
function handleQuantityChange(e) {
  const btn = e.currentTarget;
  const giftId = btn.dataset.giftId;
  const action = btn.dataset.action;

  const items = cart.getItems();
  const item = items.find(i => i.giftId === giftId);
  if (!item) return;

  let newQuantity = item.quantity;
  if (action === 'inc') {
    newQuantity = Math.min(item.quantity + 1, 99);
  } else if (action === 'dec') {
    newQuantity = Math.max(item.quantity - 1, 0);
  }

  if (newQuantity === 0) {
    cart.removeItem(giftId);
  } else {
    cart.updateQuantity(giftId, newQuantity);
  }

  updateCartBadge();
  renderCartItems();
}

/**
 * Manipula remoção de item
 */
function handleRemoveItem(e) {
  const btn = e.currentTarget;
  const giftId = btn.dataset.giftId;

  cart.removeItem(giftId);
  updateCartBadge();
  renderCartItems();
}

/**
 * Manipula finalização de compra
 */
async function handleCheckout() {
  const nameInput = document.getElementById('gifter-name');
  const nameError = document.getElementById('gifter-name-error');
  const cartError = document.getElementById('cart-error');
  const checkoutBtn = document.getElementById('cart-checkout-btn');
  
  if (!nameInput || !checkoutBtn) return;

  // Validar nome
  const gifterName = nameInput.value.trim();
  if (gifterName.length < 2) {
    nameError.textContent = 'Nome deve ter pelo menos 2 caracteres';
    nameError.hidden = false;
    nameInput.focus();
    return;
  }
  nameError.hidden = true;

  // Obter método de pagamento
  const paymentMethodInput = document.querySelector('input[name="paymentMethod"]:checked');
  if (!paymentMethodInput) return;
  
  const paymentMethod = paymentMethodInput.value;

  // Obter itens
  const items = cart.getItems();
  if (items.length === 0) {
    cartError.textContent = 'Carrinho vazio';
    cartError.hidden = false;
    return;
  }

  // Desabilitar botão
  checkoutBtn.disabled = true;
  checkoutBtn.textContent = 'Processando...';
  cartError.hidden = true;

  try {
    const response = await fetch('/api/gifts/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        paymentMethod,
        gifterName,
        items,
      }),
    });

    const data = await response.json();

    if (data.ok) {
      // Pagamento criado com sucesso (Pix)
      showPaymentResult(data);
      cart.clear();
      updateCartBadge();
    } else {
      // Erro (ex: cartão/boleto não disponível)
      if (data.status === 503) {
        cartError.textContent = data.message || 'Método de pagamento não disponível. Use Pix.';
      } else {
        cartError.textContent = data.error || 'Erro ao processar pagamento';
      }
      cartError.hidden = false;
    }
  } catch (error) {
    console.error('Checkout error:', error);
    cartError.textContent = 'Erro ao processar pagamento. Tente novamente.';
    cartError.hidden = false;
  } finally {
    checkoutBtn.disabled = false;
    checkoutBtn.textContent = 'Finalizar compra';
  }
}

/**
 * Mostra resultado do pagamento (Pix)
 */
function showPaymentResult(data) {
  const checkoutEl = document.getElementById('cart-checkout');
  const resultEl = document.getElementById('cart-payment-result');
  const itemsEl = document.getElementById('cart-items');
  
  if (!checkoutEl || !resultEl || !itemsEl) return;

  checkoutEl.hidden = true;
  itemsEl.hidden = true;

  const { payment } = data;

  resultEl.innerHTML = `
    <div class="payment-success">
      <h4>Pagamento Pix gerado!</h4>
      <p>Escaneie o QR Code ou copie o código Pix:</p>
      
      ${payment.qrCodeBase64 ? `
        <img 
          src="data:image/png;base64,${payment.qrCodeBase64}" 
          alt="QR Code Pix" 
          class="gift-modal__qr"
          width="200"
          height="200"
        />
      ` : ''}
      
      <label for="pix-code-final">Código Pix copia e cola:</label>
      <textarea id="pix-code-final" rows="3" readonly>${payment.qrCode}</textarea>
      
      <button type="button" class="btn btn--ghost" id="copy-pix-final">
        Copiar código
      </button>
      
      <p class="payment-note">
        Após o pagamento, o presente será confirmado automaticamente.
      </p>
      
      <button type="button" class="btn" data-close-cart>
        Fechar
      </button>
    </div>
  `;

  resultEl.hidden = false;

  // Copiar código Pix
  const copyBtn = resultEl.querySelector('#copy-pix-final');
  const codeTextarea = resultEl.querySelector('#pix-code-final');
  
  if (copyBtn && codeTextarea) {
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(codeTextarea.value);
        copyBtn.textContent = 'Copiado!';
        setTimeout(() => {
          copyBtn.textContent = 'Copiar código';
        }, 2000);
      } catch {
        codeTextarea.select();
      }
    });
  }
}
