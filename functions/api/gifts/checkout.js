/**
 * Cloudflare Pages Function: POST /api/gifts/checkout
 * Processa checkout de presentes com múltiplos itens
 */

import { createCheckoutPayment } from '../../_lib/gifts-service.mjs';

export async function onRequestPost(context) {
  const { request, env } = context;

  // Parse request body
  let body = {};
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: 'JSON inválido' },
      { status: 400 }
    );
  }

  try {
    // Processar checkout
    const result = await createCheckoutPayment(body, env);

    // Se o result tem status (ex: 503), usar esse status
    const statusCode = result.ok ? 200 : (result.status || 400);

    return Response.json(result, { status: statusCode });
  } catch (error) {
    console.error('Checkout error:', error);
    
    return Response.json(
      { 
        ok: false,
        error: error.message || 'Erro ao processar checkout'
      },
      { status: 400 }
    );
  }
}
