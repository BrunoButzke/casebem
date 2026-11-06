/**
 * RSVP API Handler
 * Cloudflare Pages Function for /api/rsvp
 */

import { validateRsvpCreate, validateRsvpUpdate } from '../_lib/rsvp-validators.mjs';
import {
  createRsvp,
  getRsvpByToken,
  updateRsvpByToken,
  checkRateLimit,
} from '../_lib/rsvp-service.mjs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  ...CORS_HEADERS,
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: JSON_HEADERS,
  });
}

function errorResponse(error, status = 400, details = null) {
  const body = { error };
  if (details) body.details = details;
  return jsonResponse(body, status);
}

function extractBearerToken(request) {
  const auth = request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    return null;
  }
  return auth.substring(7);
}

function getClientIp(request) {
  return request.headers.get('CF-Connecting-IP') || 
         request.headers.get('X-Forwarded-For')?.split(',')[0] || 
         '0.0.0.0';
}

async function handlePost(request, env) {
  const contentType = request.headers.get('Content-Type');
  if (!contentType || !contentType.includes('application/json')) {
    return errorResponse('Content-Type deve ser application/json', 400);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse('JSON inválido', 400);
  }

  const validation = validateRsvpCreate(body);
  if (!validation.valid) {
    return errorResponse('Dados inválidos', 400, validation.errors);
  }

  const ip = getClientIp(request);
  const rateLimit = await checkRateLimit(env.DB, ip, 10);
  
  if (!rateLimit.allowed) {
    return errorResponse(
      'Muitas requisições. Tente novamente em alguns minutos.',
      429
    );
  }

  try {
    const rsvp = await createRsvp(env.DB, validation.data);
    return jsonResponse(rsvp, 201);
  } catch (error) {
    console.error('Failed to create RSVP:', error);
    return errorResponse('Erro ao criar confirmação', 500);
  }
}

async function handleGet(request, env) {
  const token = extractBearerToken(request);
  
  if (!token) {
    return errorResponse('Token de autorização inválido', 401);
  }

  try {
    const rsvp = await getRsvpByToken(env.DB, token);
    
    if (!rsvp) {
      return errorResponse('RSVP não encontrado', 404);
    }

    return jsonResponse(rsvp, 200);
  } catch (error) {
    console.error('Failed to get RSVP:', error);
    return errorResponse('Erro ao buscar confirmação', 500);
  }
}

async function handlePut(request, env) {
  const token = extractBearerToken(request);
  
  if (!token) {
    return errorResponse('Token de autorização inválido', 401);
  }

  const contentType = request.headers.get('Content-Type');
  if (!contentType || !contentType.includes('application/json')) {
    return errorResponse('Content-Type deve ser application/json', 400);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse('JSON inválido', 400);
  }

  const validation = validateRsvpUpdate(body);
  if (!validation.valid) {
    return errorResponse('Dados inválidos', 400, validation.errors);
  }

  try {
    const rsvp = await updateRsvpByToken(env.DB, token, validation.data);
    
    if (!rsvp) {
      return errorResponse('RSVP não encontrado', 404);
    }

    return jsonResponse(rsvp, 200);
  } catch (error) {
    console.error('Failed to update RSVP:', error);
    return errorResponse('Erro ao atualizar confirmação', 500);
  }
}

function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function onRequest(context) {
  const { request, env } = context;

  if (!env.DB) {
    console.error('DB binding not found');
    return errorResponse(
      'Serviço temporariamente indisponível. Tente novamente mais tarde.',
      503
    );
  }

  const method = request.method;

  if (method === 'OPTIONS') {
    return handleOptions();
  }

  if (method === 'POST') {
    return handlePost(request, env);
  }

  if (method === 'GET') {
    return handleGet(request, env);
  }

  if (method === 'PUT') {
    return handlePut(request, env);
  }

  return errorResponse('Método não suportado', 405);
}
