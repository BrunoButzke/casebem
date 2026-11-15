/**
 * GET /api/admin/gallery — lista mínima do álbum da conta.
 * listGalleryPhotos ainda não filtra por accountId; contas novas veem lista vazia.
 */

import { requireAccount } from '../../_lib/session-auth.mjs';
import { getCorsHeaders } from '../../_lib/http-helpers.mjs';
import { listGalleryPhotos } from '../../_lib/gallery-service.mjs';
import { PARTNER_ACCOUNT_ID } from '../../_lib/auth-service.mjs';

export async function onRequestOptions(context) {
  return new Response(null, { status: 204, headers: getCorsHeaders(context.request) });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const headers = getCorsHeaders(request);
  headers.set('Content-Type', 'application/json; charset=utf-8');

  const auth = await requireAccount(request, env);
  if (!auth.ok) {
    return Response.json(
      { ok: false, error: auth.error, message: auth.message },
      { status: auth.status, headers }
    );
  }

  if (auth.account.id !== PARTNER_ACCOUNT_ID) {
    return Response.json({ ok: true, photos: [] }, { status: 200, headers });
  }

  const photos = await listGalleryPhotos(env.DB || null);
  return Response.json({ ok: true, photos }, { status: 200, headers });
}
