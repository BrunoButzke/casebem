/**
 * Cart UI - Interface do carrinho de presentes
 */

import { CartStorage } from './cart-storage.mjs';
import { GIFTS_CATALOG, getGiftById, formatPrice } from '../../data/gifts-catalog.mjs';

let cart = null;
let _window = null;
let _document = null;
let _sessionStorage = null;
let _crypto = null;
let _fetch = null;

/**
 * Adiciona item ao carrinho (API pública para testes)
 * @param {string} giftId - ID do presente
 * @param {number} quantity - Quantidade
 * @public
 */
export function addToCart(giftId, quantity = 1) {
  if (!cart) return;
  cart.addItem(giftId, quantity);
  resetIntentKey();
  updateCartBadge();
}

/**
 * Inicializa o carrinho
 * @param {Window} windowObj - Window object (para testes injetarem deps)
 */
export function initCart(windowObj) {
  // Injetar dependências
  _window = windowObj || (typeof window !== 'undefined' ? window : null);
  if (!_window) return;
  
  _document = _window.document;
  _sessionStorage = _window.sessionStorage;
  _crypto = _window.crypto;
  _fetch = _window.fetch || (typeof fetch !== 'undefined' ? fetch : null);
  
  if (!_document || !_sessionStorage) return;
  
  cart = new CartStorage(_sessionStorage);

  setupCartBadge();
  setupGiftCards();
  setupModalEvents();
  updateCartBadge();
}

/**
 * Setup eventos do modal (chamado uma vez no init)
 * @private
 */
function setupModalEvents() {
  if (!_document) return;
  
  // Eventos globais
  _document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const modal = _document.getElementById('cart-modal');
      if (modal && !modal.hidden) {
        closeCartModal();
      }
    }
  });
}

/**
 * Configura badge do carrinho
 */
function setupCartBadge() {
  if (!_document) return;
  
  const existingBadge = _document.querySelector('.cart-badge');
  if (existingBadge) return;

  const nav = _document.querySelector('.nav__links');
  if (!nav) return;

  const cartLink = _document.createElement('button');
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
  if (!_document) return;
  
  const giftCards = _document.querySelectorAll('.gift-card');
  
  giftCards.forEach(card => {
    card.addEventListener('click', (e) => {
      e.preventDefault();
      const giftId = card.dataset.gift;
      if (!giftId) return;

      // Adicionar ao carrinho
      cart.addItem(giftId, 1);
      resetIntentKey();  // Reset intent quando carrinho muda
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
  if (!_document) return;
  
  const badge = _document.querySelector('.cart-badge');
  if (!badge) return;

  const count = cart.getCount();
  badge.textContent = String(count);
  badge.style.display = count > 0 ? 'inline-flex' : 'none';
}

/**
 * Mostra feedback ao adicionar item
 */
function showCartFeedback(message) {
  const existing = _document.querySelector('.cart-feedback');
  if (existing) existing.remove();

  const feedback = _document.createElement('div');
  feedback.className = 'cart-feedback';
  feedback.setAttribute('role', 'status');
  feedback.setAttribute('aria-live', 'polite');
  feedback.textContent = message;
  
  _document.body.appendChild(feedback);

  const raf = _window.requestAnimationFrame || ((cb) => setTimeout(cb, 0));
  raf(() => {
    feedback.classList.add('is-visible');
  });

  setTimeout(() => {
    feedback.classList.remove('is-visible');
    setTimeout(() => feedback.remove(), 300);
  }, 2000);
}

let previousActiveElement = null;
let currentIntentKey = null;

/**
 * Gera ou recupera intent key do sessionStorage
 * Reseta apenas quando cart muda deliberadamente
 * @private
 */
function getOrCreateIntentKey() {
  try {
    // Tentar recuperar intent key existente
    const stored = _sessionStorage.getItem('casebem_intent_key');
    if (stored) {
      currentIntentKey = stored;
      return stored;
    }
  } catch (e) {
    // Storage denied, usar memória
  }

  // Gerar novo intent key (UUID v4)
  if (_crypto && typeof _crypto.randomUUID === 'function') {
    currentIntentKey = _crypto.randomUUID();
  } else {
    // Fallback
    currentIntentKey = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Salvar no sessionStorage
  try {
    _sessionStorage.setItem('casebem_intent_key', currentIntentKey);
  } catch (e) {
    // Storage denied, continuar com memória
  }

  return currentIntentKey;
}

/**
 * Reseta intent key (quando usuário edita cart deliberadamente)
 * @private
 */
function resetIntentKey() {
  currentIntentKey = null;
  try {
    _sessionStorage.removeItem('casebem_intent_key');
  } catch (e) {
    // Storage denied
  }
}

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
      if (_document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      // Tab
      if (_document.activeElement === lastElement) {
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
 * @public
 */
export function openCartModal() {
  let modal = _document.getElementById('cart-modal');
  
  if (!modal) {
    modal = createCartModal();
    _document.body.appendChild(modal);
  } else {
    // Modal já existe (ex: testes), garantir que listeners estão configurados
    const checkoutBtn = modal.querySelector('#cart-checkout-btn');
    if (checkoutBtn && !checkoutBtn.hasAttribute('data-listener-attached')) {
      checkoutBtn.addEventListener('click', handleCheckout);
      checkoutBtn.setAttribute('data-listener-attached', 'true');
    }
  }

  // Salvar elemento ativo anterior
  previousActiveElement = _document.activeElement;

  renderCartItems();
  modal.hidden = false;
  _document.body.style.overflow = 'hidden';
  
  // Tornar background inert (apenas modal interativo)
  const mainContent = _document.querySelector('main');
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
    const raf = _window.requestAnimationFrame || ((cb) => setTimeout(cb, 0));
    raf(() => {
      firstButton.focus();
    });
  }
}

/**
 * Fecha modal do carrinho
 * @public
 */
export function closeCartModal() {
  const modal = _document.getElementById('cart-modal');
  if (!modal) return;

  modal.hidden = true;
  _document.body.style.overflow = '';

  // Remover inert do background
  const mainContent = _document.querySelector('main');
  if (mainContent) {
    mainContent.removeAttribute('inert');
    mainContent.setAttribute('aria-hidden', 'false');
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
  const modal = _document.createElement('div');
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
  const article = _document.createElement('article');
  article.className = 'cart-item';

  // Imagem
  const img = _document.createElement('img');
  img.src = gift.imageUrl;
  img.alt = gift.name;
  img.width = 80;
  img.height = 80;
  article.appendChild(img);

  // Info
  const info = _document.createElement('div');
  info.className = 'cart-item__info';
  
  const h4 = _document.createElement('h4');
  h4.textContent = gift.name;
  info.appendChild(h4);
  
  const price = _document.createElement('p');
  price.textContent = formatPrice(gift.priceInCents);
  info.appendChild(price);
  
  article.appendChild(info);

  // Actions (quantidade)
  const actions = _document.createElement('div');
  actions.className = 'cart-item__actions';
  
  const decBtn = _document.createElement('button');
  decBtn.type = 'button';
  decBtn.className = 'cart-qty-btn';
  decBtn.dataset.action = 'dec';
  decBtn.dataset.giftId = item.giftId;
  decBtn.setAttribute('aria-label', 'Diminuir quantidade');
  decBtn.textContent = '−';
  decBtn.addEventListener('click', () => {
    if (item.quantity > 1) {
      cart.updateQuantity(item.giftId, item.quantity - 1);
    } else {
      cart.removeItem(item.giftId);
    }
    resetIntentKey();
    updateCartBadge();
    renderCartItems();
  });
  actions.appendChild(decBtn);
  
  const qty = _document.createElement('span');
  qty.className = 'cart-qty';
  qty.setAttribute('aria-label', 'Quantidade');
  qty.textContent = String(item.quantity);
  actions.appendChild(qty);
  
  const incBtn = _document.createElement('button');
  incBtn.type = 'button';
  incBtn.className = 'cart-qty-btn';
  incBtn.dataset.action = 'inc';
  incBtn.dataset.giftId = item.giftId;
  incBtn.setAttribute('aria-label', 'Aumentar quantidade');
  incBtn.textContent = '+';
  incBtn.addEventListener('click', () => {
    cart.updateQuantity(item.giftId, item.quantity + 1);
    resetIntentKey();
    updateCartBadge();
    renderCartItems();
  });
  actions.appendChild(incBtn);
  
  article.appendChild(actions);

  // Subtotal
  const subtotalDiv = _document.createElement('div');
  subtotalDiv.className = 'cart-item__subtotal';
  subtotalDiv.textContent = formatPrice(subtotal);
  article.appendChild(subtotalDiv);

  // Botão remover
  const removeBtn = _document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'cart-item__remove';
  removeBtn.dataset.giftId = item.giftId;
  removeBtn.setAttribute('aria-label', `Remover ${gift.name}`);
  removeBtn.textContent = '×';
  removeBtn.addEventListener('click', () => {
    cart.removeItem(item.giftId);
    resetIntentKey();
    updateCartBadge();
    renderCartItems();
  });
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
  const container = _document.getElementById('cart-items');
  const totalEl = _document.getElementById('cart-total-value');
  if (!container || !totalEl) return;

  const items = cart.getItems();

  if (items.length === 0) {
    container.innerHTML = '';
    const emptyMsg = _document.createElement('p');
    emptyMsg.className = 'cart-empty';
    emptyMsg.textContent = 'Seu carrinho está vazio';
    container.appendChild(emptyMsg);
    
    totalEl.textContent = 'R$ 0,00';
    
    const checkoutBtn = _document.getElementById('cart-checkout-btn');
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

  const checkoutBtn = _document.getElementById('cart-checkout-btn');
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
  
  resetIntentKey();  // Reset intent quando carrinho muda

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
  resetIntentKey();  // Reset intent quando carrinho muda
  updateCartBadge();
  renderCartItems();
}

/**
 * Manipula finalização de compra
 */
async function handleCheckout() {
  const nameInput = _document.getElementById('gifter-name');
  const nameError = _document.getElementById('gifter-name-error');
  const cartError = _document.getElementById('cart-error');
  const checkoutBtn = _document.getElementById('cart-checkout-btn');
  
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
  const paymentMethodInput = _document.querySelector('input[name="paymentMethod"]:checked');
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

  // Obter ou criar intent key
  const intentKey = getOrCreateIntentKey();

  try {
    const response = await _fetch('/api/gifts/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        paymentMethod,
        gifterName,
        items,
        intentKey,
      }),
    });

    const data = await response.json();

    if (data.ok) {
      // Pagamento criado com sucesso (Pix)
      showPaymentResult(data);
      // NÃO limpar carrinho - usuário precisa do QR até confirmação manual
      // Desabilitar checkout para evitar duplicatas
      checkoutBtn.disabled = true;
      checkoutBtn.textContent = 'Pagamento Pendente';
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
  const checkoutEl = _document.getElementById('cart-checkout');
  const resultEl = _document.getElementById('cart-payment-result');
  const itemsEl = _document.getElementById('cart-items');
  
  if (!checkoutEl || !resultEl || !itemsEl) return;

  checkoutEl.hidden = true;
  itemsEl.hidden = true;

  const { payment } = data;

  // Criar elementos de forma segura (sem innerHTML)
  const container = _document.createElement('div');
  container.className = 'payment-success';

  const title = _document.createElement('h4');
  title.textContent = 'Pagamento Pix gerado!';
  container.appendChild(title);

  const instruction = _document.createElement('p');
  instruction.textContent = 'Escaneie o QR Code ou copie o código Pix:';
  container.appendChild(instruction);

  // QR Code image (validar base64 antes de usar)
  if (payment.qrCodeBase64 && isValidBase64(payment.qrCodeBase64)) {
    const qrImg = _document.createElement('img');
    qrImg.src = `data:image/png;base64,${payment.qrCodeBase64}`;
    qrImg.alt = 'QR Code Pix';
    qrImg.className = 'gift-modal__qr';
    qrImg.width = 200;
    qrImg.height = 200;
    container.appendChild(qrImg);
  }

  // Label do código Pix
  const label = _document.createElement('label');
  label.setAttribute('for', 'pix-code-final');
  label.textContent = 'Código Pix copia e cola:';
  container.appendChild(label);

  // Textarea com código Pix (usar .value, não innerHTML)
  const textarea = _document.createElement('textarea');
  textarea.id = 'pix-code-final';
  textarea.rows = 3;
  textarea.readOnly = true;
  textarea.value = payment.qrCode || '';
  container.appendChild(textarea);

  // Botão copiar
  const copyBtn = _document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'btn btn--ghost';
  copyBtn.id = 'copy-pix-final';
  copyBtn.textContent = 'Copiar código';
  container.appendChild(copyBtn);

  // Nota sobre confirmação manual (honesta)
  const note = _document.createElement('p');
  note.className = 'payment-note';
  note.textContent = 'Pedido Pix criado e pendente. Não há confirmação automática neste MVP. Guarde este código até a confirmação manual pelos noivos.';
  container.appendChild(note);

  // Botão fechar
  const closeBtn = _document.createElement('button');
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
