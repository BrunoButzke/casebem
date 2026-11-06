/**
 * Helpers Mercado Pago (Pix + Preference).
 * Usado pelo middleware do Vite (dev) e pelas Cloudflare Pages Functions.
 */

const MP_API = 'https://api.mercadopago.com';

function jsonError(status, message, details) {
  return { ok: false, status, error: message, details };
}

export async function createPixPayment({
  accessToken,
  amount,
  title,
  email,
  message = '',
  giftId = '',
  payerName = '',
  idempotencyKey = null,
  // Nova assinatura para checkout multi-item
  gifterName,
  items,
  totalInCents,
  intentKey,
  payerEmail,
}) {
  if (!accessToken) {
    return jsonError(500, 'MP_ACCESS_TOKEN não configurado no servidor.');
  }
  
  // Suportar nova e antiga assinatura (backward compatible)
  const isNewSignature = intentKey && items && totalInCents !== undefined;
  
  let finalAmount, finalDescription, finalExternalRef, finalIdempotencyKey, finalItems, finalPayerEmail;
  
  if (isNewSignature) {
    // Nova assinatura: multi-item com intentKey estável
    finalAmount = totalInCents / 100; // Converter cents para reais
    finalDescription = `Presentes CaseBem - ${gifterName || 'Convidado'}`.slice(0, 200);
    finalExternalRef = `casebem:gift:${intentKey}`; // ESTÁVEL - sem timestamp
    finalIdempotencyKey = intentKey; // Usar intentKey como idempotency key do MP
    finalPayerEmail = payerEmail || 'noreply@casebem.com'; // Service email, not customer identity
    
    // Items em ordem canônica (alfabética por giftId) para consistência
    const sortedItems = [...items].sort((a, b) => a.giftId.localeCompare(b.giftId));
    finalItems = sortedItems.map(item => ({
      title: item.giftId,
      quantity: item.quantity,
      unit_price: Math.round((item.priceInCents || 0) / 100 * 100) / 100,
    }));
  } else {
    // Antiga assinatura: single gift (planos)
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 0.99) {
      return jsonError(400, 'Valor mínimo é R$ 0,99.');
    }
    
    const payerEmail = String(email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(payerEmail)) {
      return jsonError(400, 'Informe um e-mail válido para o Pix.');
    }
    
    finalAmount = value;
    finalDescription = String(title || 'Presente CaseBem').slice(0, 200);
    finalIdempotencyKey = idempotencyKey || crypto.randomUUID();
    finalExternalRef = `casebem:plan:${finalIdempotencyKey}`; // Estável via idempotencyKey
    finalItems = null;
  }

  const body = {
    transaction_amount: Math.round(finalAmount * 100) / 100,
    description: finalDescription,
    payment_method_id: 'pix',
    payer: isNewSignature ? {
      email: finalPayerEmail,
      first_name: (gifterName || 'Convidado').slice(0, 60),
    } : {
      email: String(email || '').trim().toLowerCase(),
      ...(payerName ? { first_name: String(payerName).slice(0, 60) } : {}),
    },
    metadata: {
      gift_id: isNewSignature ? 'multi' : String(giftId).slice(0, 60),
      message: String(message).slice(0, 300),
      source: 'casebem-dani-carine',
    },
    external_reference: finalExternalRef,
    ...(finalItems ? { items: finalItems } : {}),
  };

  const res = await fetch(`${MP_API}/v1/payments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': finalIdempotencyKey,
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      data?.message ||
      data?.cause?.[0]?.description ||
      `Mercado Pago retornou ${res.status}`;
    return jsonError(res.status, msg, data);
  }

  const tx = data.point_of_interaction?.transaction_data || {};
  return {
    ok: true,
    status: 200,
    payment: {
      id: data.id,
      status: data.status,
      statusDetail: data.status_detail,
      amount: data.transaction_amount,
      qrCode: tx.qr_code || '',
      qrCodeBase64: tx.qr_code_base64 || '',
      ticketUrl: tx.ticket_url || '',
    },
  };
}

export async function getPaymentStatus({ accessToken, paymentId }) {
  if (!accessToken) {
    return jsonError(500, 'MP_ACCESS_TOKEN não configurado no servidor.');
  }
  if (!paymentId) {
    return jsonError(400, 'paymentId obrigatório.');
  }

  const res = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return jsonError(res.status, data?.message || 'Falha ao consultar pagamento.', data);
  }

  return {
    ok: true,
    status: 200,
    payment: {
      id: data.id,
      status: data.status,
      statusDetail: data.status_detail,
      amount: data.transaction_amount,
      externalReference: data.external_reference || null,
    },
  };
}

/**
 * Checkout Pro — presentes multi-item (cartão / boleto via redirect).
 * Free-tier CF: só Functions + fetch ao MP. external_reference estável = intentKey.
 */
export async function createGiftPreference({
  accessToken,
  intentKey,
  gifterName,
  items,
  totalInCents,
  paymentMethod, // 'card' | 'boleto'
  payerEmail,
  successUrl,
  failureUrl,
  pendingUrl,
}) {
  if (!accessToken) {
    return jsonError(500, 'MP_ACCESS_TOKEN não configurado no servidor.');
  }
  if (!intentKey || !Array.isArray(items) || items.length === 0) {
    return jsonError(400, 'intentKey e items obrigatórios.');
  }
  if (paymentMethod !== 'card' && paymentMethod !== 'boleto') {
    return jsonError(400, 'paymentMethod deve ser card ou boleto.');
  }

  const amount = Number(totalInCents) / 100;
  if (!Number.isFinite(amount) || amount < 0.99) {
    return jsonError(400, 'Valor mínimo é R$ 0,99.');
  }

  const sorted = [...items].sort((a, b) => String(a.giftId).localeCompare(String(b.giftId)));
  const mpItems = sorted.map((item) => ({
    id: String(item.giftId).slice(0, 60),
    title: String(item.name || item.giftId).slice(0, 200),
    quantity: item.quantity,
    currency_id: 'BRL',
    unit_price: Math.round((item.priceInCents || 0) / 100 * 100) / 100,
  }));

  const isLocal =
    String(successUrl || '').includes('localhost') ||
    String(successUrl || '').includes('127.0.0.1');

  // boleto no MP = tipo ticket; cartão = credit/debit
  const paymentMethods =
    paymentMethod === 'boleto'
      ? {
          excluded_payment_types: [
            { id: 'credit_card' },
            { id: 'debit_card' },
            { id: 'prepaid_card' },
            { id: 'bank_transfer' },
          ],
        }
      : {
          excluded_payment_types: [
            { id: 'ticket' },
            { id: 'bank_transfer' },
            { id: 'atm' },
          ],
        };

  const body = {
    items: mpItems,
    payer: {
      email: String(payerEmail || 'noreply@casebem.com').trim().toLowerCase(),
      name: String(gifterName || 'Convidado').slice(0, 60),
    },
    back_urls: {
      success: successUrl,
      failure: failureUrl,
      pending: pendingUrl,
    },
    ...(isLocal ? {} : { auto_return: 'approved' }),
    external_reference: `casebem:gift:${intentKey}`,
    metadata: {
      source: 'casebem-gifts',
      intent_key: intentKey,
      payment_method: paymentMethod,
    },
    payment_methods: paymentMethods,
    statement_descriptor: 'CASEBEM',
  };

  const res = await fetch(`${MP_API}/checkout/preferences`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Idempotency-Key': intentKey,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return jsonError(res.status, data?.message || 'Falha ao criar preferência de presente.', data);
  }

  return {
    ok: true,
    status: 200,
    preference: {
      id: data.id,
      initPoint: data.init_point,
      sandboxInitPoint: data.sandbox_init_point,
    },
  };
}

/** Checkout Pro — planos CaseBem (redirect). */
export async function createPlanPreference({
  accessToken,
  planId,
  planName,
  amount,
  payerEmail,
  successUrl,
  failureUrl,
  pendingUrl,
}) {
  if (!accessToken) {
    return jsonError(500, 'MP_ACCESS_TOKEN não configurado no servidor.');
  }

  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) {
    return jsonError(400, 'Valor do plano inválido.');
  }

  const isLocal =
    String(successUrl || '').includes('localhost') ||
    String(successUrl || '').includes('127.0.0.1');

  const body = {
    items: [
      {
        id: String(planId || 'plan'),
        title: `CaseBem · ${planName || 'Plano'}`,
        quantity: 1,
        currency_id: 'BRL',
        unit_price: Math.round(value * 100) / 100,
      },
    ],
    payer: payerEmail ? { email: String(payerEmail).trim().toLowerCase() } : undefined,
    back_urls: {
      success: successUrl,
      failure: failureUrl,
      pending: pendingUrl,
    },
    ...(isLocal ? {} : { auto_return: 'approved' }),
    external_reference: `plan:${planId}:${Date.now()}`,
    metadata: { source: 'casebem-landing', plan_id: planId },
  };

  const res = await fetch(`${MP_API}/checkout/preferences`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return jsonError(res.status, data?.message || 'Falha ao criar preferência.', data);
  }

  return {
    ok: true,
    status: 200,
    preference: {
      id: data.id,
      initPoint: data.init_point,
      sandboxInitPoint: data.sandbox_init_point,
    },
  };
}

export async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  return JSON.parse(raw);
}

export function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}
