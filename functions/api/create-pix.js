import { createPixPayment } from '../_lib/mercadopago.mjs';
import { recordGiftCheckoutIntent } from '../_lib/admin-service.mjs';

export async function onRequestPost(context) {
  const { request, env } = context;
  let body = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const result = await createPixPayment({
    accessToken: env.MP_ACCESS_TOKEN,
    amount: body.amount,
    title: body.title,
    email: body.email,
    message: body.message,
    giftId: body.giftId,
    payerName: body.payerName,
  });

  if (!result.ok) {
    return Response.json(
      { error: result.error, details: result.details },
      { status: result.status || 500 },
    );
  }

  if (env.DB) {
    try {
      await recordGiftCheckoutIntent(env.DB, {
        paymentId: result.payment.id,
        amount: result.payment.amount,
        giftId: body.giftId,
        title: body.title,
        gifterName: body.payerName || body.email,
        email: body.email,
        qrCode: result.payment.qrCode,
        qrCodeBase64: result.payment.qrCodeBase64,
      });
    } catch (err) {
      console.error('recordGiftCheckoutIntent failed', err?.message || err);
    }
  }

  return Response.json(result.payment);
}
