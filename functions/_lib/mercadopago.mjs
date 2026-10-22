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
}) {
  if (!accessToken) {
    return jsonError(500, 'MP_ACCESS_TOKEN não configurado no servidor.');
  }

  const value = Number(amount);
  if (!Number.isFinite(value) || value < 0.99) {
    return jsonError(400, 'Valor mínimo é R$ 0,99.');
  }

  const payerEmail = String(email || '')
    .trim()
    .toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(payerEmail)) {
    return jsonError(400, 'Informe um e-mail válido para o Pix.');
  }

  const description = String(title || 'Presente CaseBem').slice(0, 200);
  const idempotencyKey = crypto.randomUUID();

  const body = {
    transaction_amount: Math.round(value * 100) / 100,
    description,
    payment_method_id: 'pix',
    payer: {
      email: payerEmail,
      ...(payerName ? { first_name: String(payerName).slice(0, 60) } : {}),
    },
    metadata: {
      gift_id: String(giftId).slice(0, 60),
      message: String(message).slice(0, 300),
      source: 'casebem-dani-carine',
    },
    external_reference: `gift:${giftId || 'custom'}:${Date.now()}`,
  };

  const res = await fetch(`${MP_API}/v1/payments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey,
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
