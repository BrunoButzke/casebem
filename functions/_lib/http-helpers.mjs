/**
 * HTTP Helpers - CORS, origin validation, error responses
 * Shared by messages, rsvp, gifts checkout
 */

/**
 * Get allowed origins for CORS
 * @param {Request} request - Cloudflare Request
 * @returns {string[]} Array of allowed origins
 */
export function getAllowedOrigins(request) {
  const requestUrl = new URL(request.url);
  const requestOrigin = requestUrl.origin;
  const hostname = requestUrl.hostname;
  
  const allowedOrigins = [requestOrigin];
  
  // Production: casebem.pages.dev and preview branches
  if (hostname === 'casebem.pages.dev' || hostname.endsWith('.casebem.pages.dev')) {
    allowedOrigins.push(
      'https://casebem.pages.dev',
      'https://www.casebem.pages.dev',
      'https://casebem.com',
      'https://www.casebem.com',
      'https://desafio.casebem.com'
    );
    const requestOriginParsed = request.headers.get('Origin');
    if (requestOriginParsed && requestOriginParsed.startsWith('https://') && 
        (requestOriginParsed.includes('.casebem.pages.dev') || requestOriginParsed.includes('casebem.pages.dev'))) {
      allowedOrigins.push(requestOriginParsed);
    }
  }
  
  // Production: casebem.com apex/www + desafio subdomain
  if (
    hostname === 'casebem.com' ||
    hostname === 'www.casebem.com' ||
    hostname === 'desafio.casebem.com' ||
    hostname === 'www.desafio.casebem.com'
  ) {
    allowedOrigins.push(
      'https://casebem.com',
      'https://www.casebem.com',
      'https://desafio.casebem.com',
      'https://www.desafio.casebem.com',
      'https://casebem.pages.dev'
    );
  }
  
  // Development
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    allowedOrigins.push(
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:8788',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174',
      'http://127.0.0.1:8788'
    );
  }
  
  return allowedOrigins;
}

/**
 * Validate origin for state-changing operations
 * @param {Request} request - Cloudflare Request
 * @returns {{valid: boolean, error?: string, allowedOrigins?: string[]}}
 */
export function validateOrigin(request) {
  const origin = request.headers.get('Origin');
  const allowedOrigins = getAllowedOrigins(request);
  
  if (!origin) {
    return { valid: false, error: 'Origin header obrigatório', allowedOrigins };
  }
  
  if (!allowedOrigins.includes(origin)) {
    return { valid: false, error: 'Origin não autorizado', allowedOrigins };
  }
  
  return { valid: true };
}

/**
 * Create CORS headers for response
 * @param {Request} request - Cloudflare Request
 * @returns {Headers} CORS headers
 */
export function getCorsHeaders(request) {
  const origin = request.headers.get('Origin');
  const allowedOrigins = getAllowedOrigins(request);
  
  const headers = new Headers();
  
  if (origin && allowedOrigins.includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
  }
  
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Idempotency-Key');
  headers.set('Access-Control-Max-Age', '86400');
  headers.set('Vary', 'Origin');
  
  return headers;
}

/**
 * Handle OPTIONS preflight
 * @param {Request} request - Cloudflare Request
 * @returns {Response} OPTIONS response
 */
export function handleOptions(request) {
  const headers = getCorsHeaders(request);
  return new Response(null, { status: 204, headers });
}

/**
 * Standard error responses with PT-BR messages
 */

export function errorResponse400(message) {
  return Response.json(
    { error: message },
    { status: 400 }
  );
}

export function errorResponse403(message = 'Origin não autorizado') {
  return Response.json(
    { error: message },
    { status: 403 }
  );
}

export function errorResponse503(message = 'Serviço temporariamente indisponível') {
  return Response.json(
    { error: message },
    { status: 503 }
  );
}

/**
 * Sanitize error for client (no stack traces, tokens, internal details)
 * @param {Error|string} error - Error object or message
 * @param {number} statusCode - HTTP status code
 * @returns {{error: string, status: number}}
 */
export function sanitizeError(error, statusCode = 500) {
  let message = typeof error === 'string' ? error : error.message || 'Erro interno';
  
  // Remove stack traces
  if (message.includes('\n')) {
    message = message.split('\n')[0];
  }
  
  // Remove potential tokens (APP_USR-, Bearer, etc.)
  message = message.replace(/APP_USR-[a-zA-Z0-9_-]+/g, '[TOKEN]');
  message = message.replace(/Bearer\s+[a-zA-Z0-9._-]+/g, '[TOKEN]');
  
  // Generic message for 500 errors
  if (statusCode >= 500) {
    message = 'Erro ao processar requisição';
  }
  
  return { error: message, status: statusCode };
}
