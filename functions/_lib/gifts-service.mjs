/**
 * Gifts Service - Lógica de negócio para checkout de presentes
 */

import { GIFTS_CATALOG, getGiftById, calculateTotal } from '../../data/gifts-catalog.mjs';
import { validateCartItems } from '../../src/dani-carine/cart-storage.mjs';

const ALLOWED_PAYMENT_METHODS = ['pix', 'card', 'boleto'];

/**
 * Valida requisição de checkout
 * @param {object} request - Requisição { paymentMethod, gifterName, items }
 * @returns {{valid: boolean, error?: string}}
 */
export function validateCheckoutRequest(request) {
  if (!request || typeof request !== 'object') {
    return { valid: false, error: 'Requisição inválida' };
  }

  const { paymentMethod, gifterName, items } = request;

  // Validar método de pagamento
  if (!paymentMethod || typeof paymentMethod !== 'string') {
    return { valid: false, error: 'Método de pagamento obrigatório' };
  }

  if (!ALLOWED_PAYMENT_METHODS.includes(paymentMethod)) {
    return { valid: false, error: 'Método de pagamento inválido' };
  }

  // Validar nome do presenteador
  if (!gifterName || typeof gifterName !== 'string') {
    return { valid: false, error: 'Nome do presenteador obrigatório' };
  }

  const trimmedName = gifterName.trim();
  if (trimmedName.length < 2) {
    return { valid: false, error: 'Nome deve ter pelo menos 2 caracteres' };
  }

  if (trimmedName.length > 100) {
    return { valid: false, error: 'Nome deve ter no máximo 100 caracteres' };
  }

  // Validar items
  if (!Array.isArray(items)) {
    return { valid: false, error: 'Items deve ser um array' };
  }

  if (items.length === 0) {
    return { valid: false, error: 'Carrinho vazio' };
  }

  // Validar estrutura dos items
  const cartValidation = validateCartItems(items);
  if (!cartValidation.valid) {
    return cartValidation;
  }

  // Validar que todos os giftIds existem no catálogo
  for (const item of items) {
    const gift = getGiftById(item.giftId);
    if (!gift) {
      return { valid: false, error: `Presente não encontrado: ${item.giftId}` };
    }
  }

  return { valid: true };
}

/**
 * Cria pagamento via adapter
 * @param {object} request - Requisição validada
 * @param {object} env - Environment variables
 * @returns {Promise<object>} Resultado do pagamento
 */
export async function createCheckoutPayment(request, env) {
  // Validar requisição
  const validation = validateCheckoutRequest(request);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const { paymentMethod, gifterName, items } = request;

  // Recalcular total no servidor (não confiar no cliente)
  const totalInCents = calculateTotal(items);

  // Processar pagamento conforme método
  if (paymentMethod === 'pix') {
    return await createPixCheckout({ gifterName, items, totalInCents, env });
  }

  if (paymentMethod === 'card' || paymentMethod === 'boleto') {
    // Gateway não configurado
    return {
      ok: false,
      status: 503,
      error: 'PAYMENT_PROVIDER_NOT_CONFIGURED',
      message: 'Pagamento com cartão/boleto ainda não disponível. Use Pix.',
      availableMethods: ['pix'],
    };
  }

  throw new Error('Método de pagamento inválido');
}

/**
 * Cria checkout Pix via Mercado Pago
 * @private
 */
async function createPixCheckout({ gifterName, items, totalInCents, env }) {
  // Mock para testes unitários (se globalThis.__testCreatePixPayment definido)
  if (typeof globalThis.__testCreatePixPayment === 'function') {
    const mockResult = await globalThis.__testCreatePixPayment({
      gifterName,
      items,
      amount: totalInCents / 100,  // MP espera em reais
    });

    if (!mockResult.ok) {
      throw new Error(mockResult.error || 'Falha ao criar pagamento Pix');
    }

    return {
      ok: true,
      method: 'pix',
      status: 'pending',
      payment: {
        id: mockResult.payment?.id || 'test_payment',
        qrCode: mockResult.payment?.qrCode || 'test_qr_code',
        qrCodeBase64: mockResult.payment?.qrCodeBase64 || '',
      },
    };
  }

  // Implementação real com Mercado Pago
  const { createPixPayment } = await import('./mercadopago.mjs');

  // Montar descrição dos itens
  const description = items
    .map(item => {
      const gift = getGiftById(item.giftId);
      return `${gift?.name || item.giftId} x${item.quantity}`;
    })
    .join(', ');

  const result = await createPixPayment({
    accessToken: env.MP_ACCESS_TOKEN,
    amount: totalInCents / 100,  // Converter centavos para reais
    title: `Presentes - ${gifterName}`,
    email: 'noreply@casebem.com',  // E-mail fictício (não coletamos)
    message: description,
    giftId: 'multi-gifts',
    payerName: gifterName,
  });

  if (!result.ok) {
    throw new Error(result.error || 'Falha ao criar pagamento Pix');
  }

  return {
    ok: true,
    method: 'pix',
    status: 'pending',
    payment: result.payment,
  };
}
