import { createPlanPreference } from '../_lib/mercadopago.mjs';

const PLANS = {
  standard: { name: 'Standard', amount: 299.9 },
  plus: { name: 'Plus', amount: 499.9 },
  vip: { name: 'VIP', amount: 1199.9 },
};

export async function onRequestPost(context) {
  const { request, env } = context;
  let body = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const planId = String(body.planId || '').toLowerCase();
  const plan = PLANS[planId];
  if (!plan) {
    return Response.json({ error: 'Plano inválido.' }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  const result = await createPlanPreference({
    accessToken: env.MP_ACCESS_TOKEN,
    planId,
    planName: plan.name,
    amount: plan.amount,
    payerEmail: body.email,
    successUrl: `${origin}/landing-page-animada/?pago=ok&plano=${planId}`,
    failureUrl: `${origin}/landing-page-animada/?pago=erro&plano=${planId}`,
    pendingUrl: `${origin}/landing-page-animada/?pago=pendente&plano=${planId}`,
  });

  if (!result.ok) {
    return Response.json(
      { error: result.error, details: result.details },
      { status: result.status || 500 },
    );
  }

  return Response.json(result.preference);
}
