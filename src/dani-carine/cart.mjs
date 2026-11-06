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

let previousActiveElement = null;

/**
 * Focus trap para modal
 * @private
 */
function setupFocusTrap(modal) {
  const focusableElements = modal.querySelectorAll(
    'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  
  if (focusableElements.length === 0) return;
  
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  const trapFocus = (e) => {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      // Tab
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  };

  modal.addEventListener('keydown', trapFocus);
  
  // Retornar função de cleanup
  return () => {
    modal.removeEventListener('keydown', trapFocus);
  };
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

  // Salvar elemento ativo anterior
  previousActiveElement = document.activeElement;

  renderCartItems();
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  
  // Tornar background inert (apenas modal interativo)
  const mainContent = document.querySelector('main');
  if (mainContent) {
    mainContent.setAttribute('inert', '');
    mainContent.setAttribute('aria-hidden', 'true');
  }

  // Setup focus trap
  setupFocusTrap(modal);
  
  // Focus no primeiro elemento interativo
  const firstButton = modal.querySelector('button:not([disabled])');
  if (firstButton) {
    // Pequeno delay para garantir que o modal está visível
    requestAnimationFrame(() => {
      firstButton.focus();
    });
  }
}

/**
 * Fecha modal do carrinho
 */
function closeCartModal() {
  const modal = document.getElementById('cart-modal');
  if (!modal) return;

  modal.hidden = true;
  document.body.style.overflow = '';

  // Remover inert do background
  const mainContent = document.querySelector('main');
  if (mainContent) {
    mainContent.removeAttribute('inert');
    mainContent.removeAttribute('aria-hidden');
  }

  // Restaurar focus anterior
  if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
    previousActiveElement.focus();
  }
  previousActiveElement = null;
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
 * Cria elemento de item do carrinho (XSS-safe)
 * @private
 */
function createCartItemElement(item, gift, subtotal) {
  const article = document.createElement('article');
  article.className = 'cart-item';

  // Imagem
  const img = document.createElement('img');
  img.src = gift.imageUrl;
  img.alt = gift.name;
  img.width = 80;
  img.height = 80;
  article.appendChild(img);

  // Info
  const info = document.createElement('div');
  info.className = 'cart-item__info';
  
  const h4 = document.createElement('h4');
  h4.textContent = gift.name;
  info.appendChild(h4);
  
  const price = document.createElement('p');
  price.textContent = formatPrice(gift.priceInCents);
  info.appendChild(price);
  
  article.appendChild(info);

  // Actions (quantidade)
  const actions = document.createElement('div');
  actions.className = 'cart-item__actions';
  
  const decBtn = document.createElement('button');
  decBtn.type = 'button';
  decBtn.className = 'cart-qty-btn';
  decBtn.dataset.action = 'dec';
  decBtn.dataset.giftId = item.giftId;
  decBtn.setAttribute('aria-label', 'Diminuir quantidade');
  decBtn.textContent = '−';
  actions.appendChild(decBtn);
  
  const qty = document.createElement('span');
  qty.className = 'cart-qty';
  qty.setAttribute('aria-label', 'Quantidade');
  qty.textContent = String(item.quantity);
  actions.appendChild(qty);
  
  const incBtn = document.createElement('button');
  incBtn.type = 'button';
  incBtn.className = 'cart-qty-btn';
  incBtn.dataset.action = 'inc';
  incBtn.dataset.giftId = item.giftId;
  incBtn.setAttribute('aria-label', 'Aumentar quantidade');
  incBtn.textContent = '+';
  actions.appendChild(incBtn);
  
  article.appendChild(actions);

  // Subtotal
  const subtotalDiv = document.createElement('div');
  subtotalDiv.className = 'cart-item__subtotal';
  subtotalDiv.textContent = formatPrice(subtotal);
  article.appendChild(subtotalDiv);

  // Botão remover
  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'cart-item__remove';
  removeBtn.dataset.giftId = item.giftId;
  removeBtn.setAttribute('aria-label', `Remover ${gift.name}`);
  removeBtn.textContent = '×';
  article.appendChild(removeBtn);

  // Event listeners
  decBtn.addEventListener('click', handleQuantityChange);
  incBtn.addEventListener('click', handleQuantityChange);
  removeBtn.addEventListener('click', handleRemoveItem);

  return article;
}

/**
 * Renderiza itens do carrinho (XSS-safe)
 */
function renderCartItems() {
  const container = document.getElementById('cart-items');
  const totalEl = document.getElementById('cart-total-value');
  if (!container || !totalEl) return;

  const items = cart.getItems();

  if (items.length === 0) {
    container.innerHTML = '';
    const emptyMsg = document.createElement('p');
    emptyMsg.className = 'cart-empty';
    emptyMsg.textContent = 'Seu carrinho está vazio';
    container.appendChild(emptyMsg);
    
    totalEl.textContent = 'R$ 0,00';
    
    const checkoutBtn = document.getElementById('cart-checkout-btn');
    if (checkoutBtn) checkoutBtn.disabled = true;
    
    return;
  }

  // Limpar container
  container.innerHTML = '';

  // Calcular total e renderizar items
  let total = 0;
  items.forEach(item => {
    const gift = getGiftById(item.giftId);
    if (!gift) return;

    const subtotal = gift.priceInCents * item.quantity;
    total += subtotal;

    const itemElement = createCartItemElement(item, gift, subtotal);
    container.appendChild(itemElement);
  });

  totalEl.textContent = formatPrice(total);

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
 * Valida base64 string
 * @param {string} str - String para validar
 * @returns {boolean}
 */
function isValidBase64(str) {
  if (typeof str !== 'string' || str.length === 0) return false;
  if (str.length > 100000) return false; // Max 100KB
  
  // Base64 pattern with padding
  const base64Pattern = /^[A-Za-z0-9+/]*={0,2}$/;
  return base64Pattern.test(str);
}

/**
 * Mostra resultado do pagamento (Pix)
 * XSS-safe: usa createElement e textContent
 */
function showPaymentResult(data) {
  const checkoutEl = document.getElementById('cart-checkout');
  const resultEl = document.getElementById('cart-payment-result');
  const itemsEl = document.getElementById('cart-items');
  
  if (!checkoutEl || !resultEl || !itemsEl) return;

  checkoutEl.hidden = true;
  itemsEl.hidden = true;

  const { payment } = data;

  // Criar elementos de forma segura (sem innerHTML)
  const container = document.createElement('div');
  container.className = 'payment-success';

  const title = document.createElement('h4');
  title.textContent = 'Pagamento Pix gerado!';
  container.appendChild(title);

  const instruction = document.createElement('p');
  instruction.textContent = 'Escaneie o QR Code ou copie o código Pix:';
  container.appendChild(instruction);

  // QR Code image (validar base64 antes de usar)
  if (payment.qrCodeBase64 && isValidBase64(payment.qrCodeBase64)) {
    const qrImg = document.createElement('img');
    qrImg.src = `data:image/png;base64,${payment.qrCodeBase64}`;
    qrImg.alt = 'QR Code Pix';
    qrImg.className = 'gift-modal__qr';
    qrImg.width = 200;
    qrImg.height = 200;
    container.appendChild(qrImg);
  }

  // Label do código Pix
  const label = document.createElement('label');
  label.setAttribute('for', 'pix-code-final');
  label.textContent = 'Código Pix copia e cola:';
  container.appendChild(label);

  // Textarea com código Pix (usar .value, não innerHTML)
  const textarea = document.createElement('textarea');
  textarea.id = 'pix-code-final';
  textarea.rows = 3;
  textarea.readOnly = true;
  textarea.value = payment.qrCode || '';
  container.appendChild(textarea);

  // Botão copiar
  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'btn btn--ghost';
  copyBtn.id = 'copy-pix-final';
  copyBtn.textContent = 'Copiar código';
  container.appendChild(copyBtn);

  // Nota sobre confirmação (corrigida: não promete automático)
  const note = document.createElement('p');
  note.className = 'payment-note';
  note.textContent = 'Aguarde a confirmação do pagamento. Isso pode levar alguns minutos.';
  container.appendChild(note);

  // Botão fechar
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'btn';
  closeBtn.setAttribute('data-close-cart', '');
  closeBtn.textContent = 'Fechar';
  container.appendChild(closeBtn);

  // Limpar e adicionar container
  resultEl.innerHTML = '';
  resultEl.appendChild(container);
  resultEl.hidden = false;

  // Event listener para copiar
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(textarea.value);
      copyBtn.textContent = 'Copiado!';
      setTimeout(() => {
        copyBtn.textContent = 'Copiar código';
      }, 2000);
    } catch {
      textarea.select();
    }
  });

  // Event listener para fechar
  closeBtn.addEventListener('click', closeCartModal);
}
