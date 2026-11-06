/**
 * Cloudflare Pages Function: POST /api/gifts/checkout
 * Processa checkout de presentes com múltiplos itens
 */

import { createCheckoutPayment } from '../../_lib/gifts-service.mjs';
import {
  validateOrigin,
  getCorsHeaders,
  handleOptions,
  errorResponse400,
  errorResponse403,
  sanitizeError,
} from '../../_lib/http-helpers.mjs';

/**
 * Handle OPTIONS preflight
 */
export async function onRequestOptions(context) {
  return handleOptions(context.request);
}

/**
 * Handle POST checkout
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  // Validate origin (state-changing operation)
  const originValidation = validateOrigin(request);
  if (!originValidation.valid) {
    return errorResponse403(originValidation.error);
  }

  // Parse request body
  let body = {};
  try {
    body = await request.json();
  } catch {
    return errorResponse400('JSON inválido');
  }

  try {
    // Processar checkout
    const result = await createCheckoutPayment(body, env);

    // Se o result tem status (ex: 503), usar esse status
    const statusCode = result.ok ? 200 : (result.status || 400);

    // Add CORS headers
    const headers = getCorsHeaders(request);
    headers.set('Content-Type', 'application/json');

    return new Response(JSON.stringify(result), {
      status: statusCode,
      headers,
    });
  } catch (error) {
    console.error('Checkout error:', error);
    
    // Sanitize error (remove stack traces, tokens)
    const sanitized = sanitizeError(error, 500);
    
    const headers = getCorsHeaders(request);
    headers.set('Content-Type', 'application/json');

    return new Response(
      JSON.stringify({ 
        ok: false,
        error: sanitized.error,
      }),
      { 
        status: sanitized.status,
        headers,
      }
    );
  }
}
