/**
 * Gifts Service - Lógica de negócio para checkout de presentes
 */

import { GIFTS_CATALOG, getGiftById, calculateTotal } from '../../data/gifts-catalog.mjs';
import { validateCartItems } from '../../src/dani-carine/cart-storage.mjs';

const ALLOWED_PAYMENT_METHODS = ['pix', 'card', 'boleto'];

/**
 * Valida requisição de checkout
 * @param {object} request - Requisição { paymentMethod, gifterName, items, intentKey }
 * @returns {{valid: boolean, error?: string}}
 */
export function validateCheckoutRequest(request) {
  if (!request || typeof request !== 'object') {
    return { valid: false, error: 'Requisição inválida' };
  }

  const { paymentMethod, gifterName, items, intentKey } = request;

  // Validar intentKey (opcional aqui, validação detalhada no service)
  if (intentKey !== undefined && typeof intentKey !== 'string') {
    return { valid: false, error: 'Intent key inválido' };
  }

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
 * Normaliza items do carrinho (merge duplicatas) com validação de limites
 * @param {Array} items - Items do carrinho
 * @param {Array} catalog - Catálogo de presentes (para validar giftIds)
 * @returns {{valid: boolean, items?: Array, error?: string}}
 */
export function normalizeCartItems(items, catalog = GIFTS_CATALOG) {
  const merged = new Map();
  
  for (const item of items) {
    // Ignorar items com giftId inválido (não no catálogo)
    if (!catalog.find(g => g.id === item.giftId)) {
      continue;
    }
    
    // Validar qty individual antes de merge
    if (item.quantity > 99) {
      return { valid: false, error: 'Quantidade por item deve ser no máximo 99' };
    }
    
    const existing = merged.get(item.giftId);
    if (existing) {
      // Merge quantidade SEM saturar - rejeitar se exceder
      const newQty = existing.quantity + item.quantity;
      if (newQty > 99) {
        return { valid: false, error: `Quantidade total do presente ${item.giftId} excede o limite de 99 unidades` };
      }
      merged.set(item.giftId, { giftId: item.giftId, quantity: newQty });
    } else {
      merged.set(item.giftId, { giftId: item.giftId, quantity: item.quantity });
    }
  }
  
  // Calcular total de items APÓS merge
  const mergedItems = Array.from(merged.values());
  const totalItems = mergedItems.reduce((sum, item) => sum + item.quantity, 0);
  
  // Validar total de items (sum de quantities após merge)
  if (totalItems > 999) {
    return { valid: false, error: 'Total de itens no carrinho excede o limite de 999 unidades' };
  }
  
  return { valid: true, items: mergedItems };
}

/**
 * Cria pagamento via adapter (com idempotência)
 * @param {object} request - Requisição validada
 * @param {object} env - Environment variables
 * @param {D1Database} db - D1 database (requerido para idempotência)
 * @param {string} ipAddress - Client IP (para rate limit)
 * @returns {Promise<object>} Resultado do pagamento
 */
export async function createCheckoutPayment(request, env, db, ipAddress) {
  // Validar D1 disponível (crítico para idempotência)
  if (!db) {
    return {
      ok: false,
      status: 503,
      error: 'DATABASE_UNAVAILABLE',
      message: 'Serviço temporariamente indisponível',
    };
  }

  // Validar RSVP_SECRET (necessário para HMAC)
  if (!env.RSVP_SECRET) {
    return {
      ok: false,
      status: 503,
      error: 'SECRET_NOT_CONFIGURED',
      message: 'Serviço temporariamente indisponível',
    };
  }

  // Validar requisição
  const validation = validateCheckoutRequest(request);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const { paymentMethod, gifterName, intentKey } = request;

  // Validar intent_key presente
  if (!intentKey || typeof intentKey !== 'string') {
    throw new Error('Intent key obrigatório');
  }

  // Normalizar items (merge duplicatas) com validação de limites
  const normalizationResult = normalizeCartItems(request.items, GIFTS_CATALOG);
  if (!normalizationResult.valid) {
    throw new Error(normalizationResult.error);
  }
  const normalizedItems = normalizationResult.items;

  // Recalcular total no servidor (não confiar no cliente)
  const totalInCents = calculateTotal(normalizedItems);

  // Verificar método de pagamento antes de criar intent
  if (paymentMethod === 'card' || paymentMethod === 'boleto') {
    return {
      ok: false,
      status: 503,
      error: 'PAYMENT_PROVIDER_NOT_CONFIGURED',
      message: 'Pagamento com cartão/boleto ainda não disponível. Use Pix.',
      availableMethods: ['pix'],
    };
  }

  if (paymentMethod !== 'pix') {
    throw new Error('Método de pagamento inválido');
  }

  // Rate limit (antes de criar intent)
  const { checkCheckoutRateLimit } = await import('./checkout-idempotency.mjs');
  const rateLimit = await checkCheckoutRateLimit(db, ipAddress, env.RSVP_SECRET, 5);
  
  if (!rateLimit.allowed) {
    return {
      ok: false,
      status: 429,
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Muitas requisições. Aguarde antes de tentar novamente.',
    };
  }

  // Criar fingerprint do payload
  const { createCheckoutFingerprint, getOrCreateIntent, updateIntentWithPayment } = 
    await import('./checkout-idempotency.mjs');
  
  const fingerprint = await createCheckoutFingerprint({
    gifterName,
    items: normalizedItems,
    paymentMethod,
    amountCents: totalInCents,
  });

  // Get ou criar intent (idempotente)
  const intentResult = await getOrCreateIntent(db, {
    intentKey,
    fingerprint,
    gifterName,
    items: normalizedItems,
    paymentMethod,
    amountCents: totalInCents,
  }, env.RSVP_SECRET);

  // Conflito: mesmo intent_key, payload diferente
  if (intentResult.conflict) {
    return {
      ok: false,
      status: 409,
      error: 'INTENT_CONFLICT',
      message: 'Intent key já usado com dados diferentes. Use um novo intent key.',
    };
  }

  // Intent já existe com mesmo payload
  if (intentResult.status === 'existing') {
    const intent = intentResult.intent;
    
    // Se já tem pagamento pendente, retornar
    if (intent.status === 'pending' && intent.qrCode) {
      return {
        ok: true,
        method: 'pix',
        status: 'pending',
        payment: {
          id: intent.providerReference,
          qrCode: intent.qrCode,
          qrCodeBase64: intent.qrCodeBase64 || '',
        },
        fromCache: true,
      };
    }

    // Se está 'creating', outro worker está processando
    if (intent.status === 'creating') {
      return {
        ok: false,
        status: 409,
        error: 'INTENT_PROCESSING',
        message: 'Pagamento já está sendo processado. Aguarde.',
      };
    }
  }

  // Novo intent criado, processar pagamento
  return await createPixCheckout({
    gifterName,
    items: normalizedItems,
    totalInCents,
    intentKey,
    env,
    db,
  });
}

/**
 * Cria checkout Pix via Mercado Pago (com idempotência)
 * @private
 */
async function createPixCheckout({ gifterName, items, totalInCents, intentKey, env, db }) {
  // Verificar token MP configurado
  if (!env.MP_ACCESS_TOKEN) {
    // Atualizar intent como failed
    const { updateIntentWithPayment } = await import('./checkout-idempotency.mjs');
    await updateIntentWithPayment(db, intentKey, {}, 'failed');
    
    return {
      ok: false,
      status: 503,
      error: 'PAYMENT_SERVICE_NOT_CONFIGURED',
      message: 'Serviço de pagamento não configurado. Contate o suporte.',
    };
  }

  // Gerar MP idempotency key (estável baseado em intent_key)
  const { generateMPIdempotencyKey } = await import('./checkout-idempotency.mjs');
  const mpIdempotencyKey = await generateMPIdempotencyKey(intentKey, env.RSVP_SECRET);

  // Mock para testes unitários
  if (typeof globalThis.__testCreatePixPayment === 'function') {
    const mockResult = await globalThis.__testCreatePixPayment({
      gifterName,
      items,
      amount: totalInCents / 100,
      mpIdempotencyKey,
      intentKey,
    });

    if (!mockResult.ok) {
      // Salvar falha no D1
      const { updateIntentWithPayment } = await import('./checkout-idempotency.mjs');
      await updateIntentWithPayment(db, intentKey, {}, 'failed');
      
      return {
        ok: false,
        status: mockResult.status || 503,
        error: mockResult.error || 'PAYMENT_SERVICE_ERROR',
        message: mockResult.message || 'Erro ao processar pagamento',
      };
    }

    const payment = {
      id: mockResult.payment?.id || 'test_payment',
      qrCode: mockResult.payment?.qrCode || 'test_qr_code',
      qrCodeBase64: mockResult.payment?.qrCodeBase64 || '',
    };

    // Salvar no D1
    const { updateIntentWithPayment } = await import('./checkout-idempotency.mjs');
    await updateIntentWithPayment(db, intentKey, payment, 'pending');

    return {
      ok: true,
      method: 'pix',
      status: 'pending',
      payment,
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

  // Chamar MP com nova assinatura (intentKey estável, items canônicos)
  const result = await createPixPayment({
    accessToken: env.MP_ACCESS_TOKEN,
    gifterName,
    items: normalizedItems.map(item => ({
      giftId: item.giftId,
      quantity: item.quantity,
      priceInCents: getGiftById(item.giftId)?.priceInCents || 0,
    })),
    totalInCents,
    intentKey,
  });

  if (!result.ok) {
    // Salvar falha no D1
    const { updateIntentWithPayment } = await import('./checkout-idempotency.mjs');
    await updateIntentWithPayment(db, intentKey, {}, 'failed');
    
    return {
      ok: false,
      status: 503,
      error: 'PAYMENT_SERVICE_ERROR',
      message: 'Erro ao processar pagamento. Tente novamente.',
    };
  }

  // Validar resposta do MP
  const payment = result.payment;
  if (!payment || !payment.id) {
    const { updateIntentWithPayment } = await import('./checkout-idempotency.mjs');
    await updateIntentWithPayment(db, intentKey, {}, 'failed');
    
    return {
      ok: false,
      status: 502,
      error: 'INVALID_PAYMENT_RESPONSE',
      message: 'Resposta inválida do serviço de pagamento',
    };
  }

  // Validar dados Pix
  const hasQrCode = payment.qrCode && typeof payment.qrCode === 'string';
  if (!hasQrCode) {
    const { updateIntentWithPayment } = await import('./checkout-idempotency.mjs');
    await updateIntentWithPayment(db, intentKey, payment, 'failed');
    
    return {
      ok: false,
      status: 502,
      error: 'MISSING_PIX_DATA',
      message: 'Dados Pix incompletos na resposta',
    };
  }

  // Salvar sucesso no D1
  const { updateIntentWithPayment } = await import('./checkout-idempotency.mjs');
  await updateIntentWithPayment(db, intentKey, payment, 'pending');

  return {
    ok: true,
    method: 'pix',
    status: 'pending',
    payment: {
      id: payment.id,
      qrCode: payment.qrCode,
      qrCodeBase64: payment.qrCodeBase64 || '',
    },
  };
}
