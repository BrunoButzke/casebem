/**
 * Cart Storage - Gerenciamento do carrinho em sessionStorage
 * Resiliente a storage denied/malformed
 */

const STORAGE_KEY = 'casebem_cart';
const MAX_QUANTITY = 99;
const MAX_TOTAL_ITEMS = 999;

/**
 * Validação de item individual do carrinho
 * @param {object} item - Item { giftId, quantity }
 * @returns {{valid: boolean, error?: string}}
 */
export function validateCartItem(item) {
  if (!item || typeof item !== 'object') {
    return { valid: false, error: 'Item inválido' };
  }

  const { giftId, quantity } = item;

  if (typeof giftId !== 'string' || giftId.length === 0) {
    return { valid: false, error: 'giftId inválido' };
  }

  if (!Number.isInteger(quantity)) {
    return { valid: false, error: 'Quantidade deve ser um número inteiro' };
  }

  if (quantity < 1 || quantity > MAX_QUANTITY) {
    return { valid: false, error: `Quantidade deve estar entre 1 e ${MAX_QUANTITY}` };
  }

  if (!Number.isFinite(quantity)) {
    return { valid: false, error: 'Quantidade inválida' };
  }

  return { valid: true };
}

/**
 * Validação de array de itens do carrinho
 * @param {Array} items - Array de items
 * @returns {{valid: boolean, error?: string}}
 */
export function validateCartItems(items) {
  if (!Array.isArray(items)) {
    return { valid: false, error: 'Items deve ser um array' };
  }

  if (items.length === 0) {
    return { valid: false, error: 'Carrinho vazio' };
  }

  // Validar cada item
  for (const item of items) {
    const validation = validateCartItem(item);
    if (!validation.valid) {
      return validation;
    }
  }

  // Validar quantidade total
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  if (totalQuantity > MAX_TOTAL_ITEMS) {
    return { valid: false, error: 'Carrinho com muitos itens' };
  }

  return { valid: true };
}

/**
 * Classe para gerenciar carrinho com storage plugável
 */
export class CartStorage {
  constructor(storage) {
    this.storage = storage;
    this.fallbackItems = [];
    this.usesFallback = false;
    
    // Tentar carregar do storage
    this._loadFromStorage();
  }

  /**
   * Carrega carrinho do storage
   * @private
   */
  _loadFromStorage() {
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (!raw) {
        this.fallbackItems = [];
        return;
      }

      const data = JSON.parse(raw);
      
      if (!data || typeof data !== 'object' || !Array.isArray(data.items)) {
        this.fallbackItems = [];
        return;
      }

      // Validar estrutura
      const validItems = data.items.filter(item => {
        const validation = validateCartItem(item);
        return validation.valid;
      });

      this.fallbackItems = validItems;
    } catch (err) {
      // Storage denied, JSON inválido, etc.
      this.usesFallback = true;
      this.fallbackItems = [];
    }
  }

  /**
   * Salva carrinho no storage
   * @private
   */
  _saveToStorage() {
    try {
      const data = { items: this.fallbackItems };
      this.storage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      // Storage denied - continua em memória
      this.usesFallback = true;
    }
  }

  /**
   * Retorna todos os itens do carrinho
   * @returns {Array<{giftId: string, quantity: number}>}
   */
  getItems() {
    return [...this.fallbackItems];
  }

  /**
   * Retorna contagem total de itens
   * @returns {number}
   */
  getCount() {
    return this.fallbackItems.reduce((sum, item) => sum + item.quantity, 0);
  }

  /**
   * Adiciona item ao carrinho ou incrementa quantidade
   * @param {string} giftId - ID do presente
   * @param {number} quantity - Quantidade a adicionar
   */
  addItem(giftId, quantity) {
    const existing = this.fallbackItems.find(item => item.giftId === giftId);

    if (existing) {
      // Incrementa quantidade, respeitando limite
      const newQuantity = Math.min(existing.quantity + quantity, MAX_QUANTITY);
      existing.quantity = newQuantity;
    } else {
      // Adiciona novo item
      const clampedQuantity = Math.min(Math.max(1, quantity), MAX_QUANTITY);
      this.fallbackItems.push({
        giftId,
        quantity: clampedQuantity,
      });
    }

    this._saveToStorage();
  }

  /**
   * Atualiza quantidade de um item
   * @param {string} giftId - ID do presente
   * @param {number} quantity - Nova quantidade
   */
  updateQuantity(giftId, quantity) {
    if (quantity <= 0) {
      this.removeItem(giftId);
      return;
    }

    const existing = this.fallbackItems.find(item => item.giftId === giftId);
    if (existing) {
      existing.quantity = Math.min(Math.max(1, quantity), MAX_QUANTITY);
      this._saveToStorage();
    }
  }

  /**
   * Remove item do carrinho
   * @param {string} giftId - ID do presente
   */
  removeItem(giftId) {
    this.fallbackItems = this.fallbackItems.filter(item => item.giftId !== giftId);
    this._saveToStorage();
  }

  /**
   * Limpa todo o carrinho
   */
  clear() {
    this.fallbackItems = [];
    try {
      this.storage.removeItem(STORAGE_KEY);
    } catch (err) {
      // Ignorar erro de storage
    }
  }
}
