/**
 * Helpers Mercado Pago (Pix + Preference).
 * Usado pelo middleware do Vite (dev) e pelas Cloudflare Pages Functions.
 */

const MP_API = 'https://api.mercadopago.com';

function jsonError(status, message, details) {
  return { ok: false, status, error: message, details };
}

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

/**
 * Extrai mensagem útil do erro MP (cause[] / message).
 */
export function extractMercadoPagoError(data, fallbackStatus) {
  const cause = Array.isArray(data?.cause) ? data.cause : [];
  const fromCause =
    cause.map((c) => c?.description || c?.message || c?.code).filter(Boolean).join('; ') || null;
  return (
    fromCause ||
    data?.message ||
    data?.error ||
    `Mercado Pago retornou ${fallbackStatus || 'erro'}`
  );
}

/**
 * E-mail do pagador compatível com sandbox MP.
 * Em TEST_*, o MP exige um comprador de "Contas de teste" (não inventar e-mail).
 * Preferência: e-mail @testuser.com informado → MP_TEST_PAYER_EMAIL → erro claro se faltar.
 */
export function resolvePixPayerEmail(email, accessToken, env = {}) {
  const trimmed = String(email || '').trim().toLowerCase();
  const token = String(accessToken || '');
  const configuredTestPayer = String(env.MP_TEST_PAYER_EMAIL || '').trim().toLowerCase();
  // Credenciais de teste do MP usam prefixo TEST- (não confundir com APP_USR- de produção)
  const isTestToken = /^TEST-/i.test(token);

  if (isTestToken) {
    if (trimmed.endsWith('@testuser.com') && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) {
      return trimmed;
    }
    if (
      configuredTestPayer.endsWith('@testuser.com') &&
      /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(configuredTestPayer)
    ) {
      return configuredTestPayer;
    }
    // Mantém o e-mail digitado só se já for testuser; senão usa o configurado.
    // Sem conta de teste válida o MP responde "Invalid users involved".
    return configuredTestPayer || trimmed || '';
  }

  if (trimmed && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) return trimmed;
  return 'noreply@casebem.com';
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
  notificationUrl = null,
  payerIdentification = null, // { type: 'CPF', number: '...' } opcional
  testPayerEmail = '',
}) {
  if (!accessToken) {
    return jsonError(500, 'MP_ACCESS_TOKEN não configurado no servidor.');
  }

  const emailEnv = { MP_TEST_PAYER_EMAIL: testPayerEmail };

  // Suportar nova e antiga assinatura (backward compatible)
  const isNewSignature = intentKey && items && totalInCents !== undefined;

  let finalAmount;
  let finalDescription;
  let finalExternalRef;
  let finalIdempotencyKey;
  let finalItems;
  let finalPayerEmail;
  let finalPayerName;

  if (isNewSignature) {
    finalAmount = totalInCents / 100;
    finalDescription = `Presentes CaseBem - ${gifterName || 'Convidado'}`.slice(0, 200);
    finalExternalRef = `casebem:gift:${intentKey}`;
    finalIdempotencyKey = idempotencyKey || intentKey;
    finalPayerEmail = resolvePixPayerEmail(payerEmail || email, accessToken, emailEnv);
    finalPayerName = String(gifterName || 'Convidado').slice(0, 60);

    const sortedItems = [...items].sort((a, b) =>
      String(a.giftId).localeCompare(String(b.giftId))
    );
    finalItems = sortedItems.map((item) => ({
      id: String(item.giftId).slice(0, 60),
      title: String(item.name || item.giftId).slice(0, 256),
      description: String(item.name || item.giftId).slice(0, 256),
      quantity: item.quantity,
      unit_price: roundMoney((item.priceInCents || 0) / 100),
      category_id: 'others',
    }));
  } else {
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 0.99) {
      return jsonError(400, 'Valor mínimo é R$ 0,99.');
    }

    const legacyEmail = String(email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(legacyEmail)) {
      return jsonError(400, 'Informe um e-mail válido para o Pix.');
    }

    finalAmount = value;
    finalDescription = String(title || 'Presente CaseBem').slice(0, 200);
    finalIdempotencyKey = idempotencyKey || crypto.randomUUID();
    finalExternalRef = `casebem:plan:${finalIdempotencyKey}`;
    finalItems = null;
    finalPayerEmail = resolvePixPayerEmail(legacyEmail, accessToken, emailEnv);
    finalPayerName = String(payerName || 'Convidado').slice(0, 60);
  }

  if (!Number.isFinite(finalAmount) || finalAmount < 0.99) {
    return jsonError(400, 'Valor mínimo é R$ 0,99.');
  }

  if (/^TEST-/i.test(String(accessToken || ''))) {
    if (!finalPayerEmail || !finalPayerEmail.endsWith('@testuser.com')) {
      return jsonError(
        400,
        'Token de teste: use o e-mail de um comprador em Contas de teste (@testuser.com) ou defina MP_TEST_PAYER_EMAIL no .env.'
      );
    }
  }

  // Pix expira em ~24h (MP)
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const payer = {
    email: finalPayerEmail,
    first_name: finalPayerName,
  };

  if (
    payerIdentification &&
    typeof payerIdentification === 'object' &&
    payerIdentification.type &&
    payerIdentification.number
  ) {
    const number = String(payerIdentification.number).replace(/\D/g, '');
    const type = String(payerIdentification.type).toUpperCase();
    if (number.length >= 11) {
      payer.identification = { type, number };
    }
  }

  const body = {
    transaction_amount: roundMoney(finalAmount),
    description: finalDescription,
    payment_method_id: 'pix',
    date_of_expiration: expires,
    payer,
    metadata: {
      gift_id: isNewSignature ? 'multi' : String(giftId).slice(0, 60),
      message: String(message || '').slice(0, 300),
      source: 'casebem-dani-carine',
      intent_key: intentKey || null,
    },
    external_reference: finalExternalRef,
  };

  if (finalItems && finalItems.length > 0) {
    // Campo oficial: additional_info.items (top-level `items` não é do Payments API)
    body.additional_info = { items: finalItems };
  }

  if (notificationUrl && String(notificationUrl).startsWith('https://')) {
    body.notification_url = String(notificationUrl).slice(0, 500);
  }

  const res = await fetch(`${MP_API}/v1/payments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': String(finalIdempotencyKey).slice(0, 128),
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return jsonError(res.status, extractMercadoPagoError(data, res.status), data);
  }

  const tx = data.point_of_interaction?.transaction_data || {};
  const qrCode = tx.qr_code || '';
  const qrCodeBase64 = tx.qr_code_base64 || '';

  if (!qrCode) {
    return jsonError(502, 'Mercado Pago não retornou QR Code Pix.', data);
  }

  return {
    ok: true,
    status: 200,
    payment: {
      id: data.id,
      status: data.status,
      statusDetail: data.status_detail,
      amount: data.transaction_amount,
      qrCode,
      qrCodeBase64,
      ticketUrl: tx.ticket_url || '',
      externalReference: data.external_reference || finalExternalRef,
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
    return jsonError(res.status, extractMercadoPagoError(data, res.status), data);
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
    unit_price: roundMoney((item.priceInCents || 0) / 100),
  }));

  const isLocal =
    String(successUrl || '').includes('localhost') ||
    String(successUrl || '').includes('127.0.0.1');

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
      email: resolvePixPayerEmail(payerEmail, accessToken),
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
    return jsonError(res.status, extractMercadoPagoError(data, res.status), data);
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
        unit_price: roundMoney(value),
      },
    ],
    payer: payerEmail
      ? { email: resolvePixPayerEmail(payerEmail, accessToken) }
      : undefined,
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
    return jsonError(res.status, extractMercadoPagoError(data, res.status), data);
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
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(body);
}
