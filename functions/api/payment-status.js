import { getPaymentStatus } from '../_lib/mercadopago.mjs';

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const paymentId = url.searchParams.get('id');

  const result = await getPaymentStatus({
    accessToken: env.MP_ACCESS_TOKEN,
    paymentId,
  });

  if (!result.ok) {
    return Response.json(
      { error: result.error, details: result.details },
      { status: result.status || 500 },
    );
  }

  return Response.json(result.payment);
}
