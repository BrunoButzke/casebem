import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mpaSpaFallbackPlugin } from './dev/mpa-spa-fallback.mjs';
import {
  createPixPayment,
  createPlanPreference,
  getPaymentStatus,
  readJsonBody,
  sendJson,
} from './functions/_lib/mercadopago.mjs';
import {
  searchGuests,
  listGuestList,
  listGroups,
  addGuests,
  removeGuest,
  markGuestResponse,
  assertGuestAllowed,
  getRsvpMode,
  setRsvpMode,
  setGuestAttending,
  setGuestGroup,
  createGroup,
  deleteGroup,
  summarizeGuestList,
  parseGuestNamesInput,
} from './functions/_lib/rsvp-guest-list.mjs';
import { validateRsvpCreate } from './functions/_lib/rsvp-validators.mjs';
import { validateMessageCreate } from './functions/_lib/messages-validators.mjs';
import {
  getActiveCatalog,
  listCatalogAdmin,
  createGift,
  updateGift,
  deleteGift,
} from './functions/_lib/catalog-service.mjs';
import {
  listStationeryAdmin,
  presentStationery,
  createStationeryTemplate,
  updateStationeryTemplate,
  deleteStationeryTemplate,
} from './functions/_lib/stationery-service.mjs';
import {
  listQuestionsAdmin,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  listPhotoMissionsAdmin,
  createPhotoMission,
  updatePhotoMission,
  deletePhotoMission,
  listStampCardsAdmin,
  createStampCard,
  updateStampCard,
  deleteStampCard,
  listChallengesPublic,
  gradeQuestion,
} from './functions/_lib/challenges-service.mjs';
import {
  listGalleryPhotos,
  getGalleryPhoto,
  getGalleryImage,
  parseGalleryUpload,
  upsertGalleryPhoto,
  deleteGalleryPhoto,
} from './functions/_lib/gallery-service.mjs';
import {
  getDesafioTheme,
  updateDesafioTheme,
  themeToCssVars,
} from './functions/_lib/desafio-theme-service.mjs';
import { requireAccount } from './functions/_lib/session-auth.mjs';
import { PARTNER_ACCOUNT_ID } from './functions/_lib/auth-service.mjs';
import { ensurePartnerAccount } from './functions/_lib/partner-seed.mjs';
import { slugFromRequest, resolvePublicSlugOrPartner } from './functions/_lib/public-slug.mjs';
import { listMessagesAdmin } from './functions/_lib/admin-service.mjs';
import {
  onRequestPost as signupPost,
  onRequestOptions as signupOptions,
} from './functions/api/auth/signup.js';
import {
  onRequestPost as loginPost,
  onRequestOptions as loginOptions,
} from './functions/api/auth/login.js';
import {
  onRequestPost as logoutPost,
  onRequestOptions as logoutOptions,
} from './functions/api/auth/logout.js';
import {
  onRequestGet as meGet,
  onRequestOptions as meOptions,
} from './functions/api/auth/me.js';
import {
  onRequestPost as planPost,
  onRequestOptions as planOptions,
} from './functions/api/account/plan.js';

const rootDir = dirname(fileURLToPath(import.meta.url));

const PLANS = {
  basic: { name: 'Básico', amount: 0 },
  pro: { name: 'Pro', amount: 299 },
  vip: { name: 'VIP', amount: 499 },
};

/** Local-only RSVP store (Vite) so confirmação funciona sem D1 */
const localRsvpsByToken = new Map();

/** Local mural store — 6 recados mockados para a trilha rolante */
const hoursAgo = (h) => new Date(Date.now() - h * 3600_000).toISOString();
const localMessagesByAccount = new Map();
const localMessages = [
  {
    id: 'mock-1',
    weddingKey: 'dani-carine',
    guestName: 'Família Silva',
    message: 'Que o amor de vocês continue florindo em cada estação. Felicidades!',
    createdAt: hoursAgo(48),
  },
  {
    id: 'mock-2',
    weddingKey: 'dani-carine',
    guestName: 'Ana & Pedro',
    message: 'Mal podemos esperar para celebrar com vocês. Todo o carinho do mundo!',
    createdAt: hoursAgo(36),
  },
  {
    id: 'mock-3',
    weddingKey: 'dani-carine',
    guestName: 'Tia Márcia',
    message: 'Dani e Carine, que essa união seja leve, forte e cheia de risadas.',
    createdAt: hoursAgo(24),
  },
  {
    id: 'mock-4',
    weddingKey: 'dani-carine',
    guestName: 'Bruno Butzke',
    message: 'Orgulho enorme de vocês duas. Que a Lagoa guarde esse dia pra sempre.',
    createdAt: hoursAgo(18),
  },
  {
    id: 'mock-5',
    weddingKey: 'dani-carine',
    guestName: 'Camila & João',
    message: 'Amor que inspira! Obrigada por nos convidar a fazer parte desse momento.',
    createdAt: hoursAgo(10),
  },
  {
    id: 'mock-6',
    weddingKey: 'dani-carine',
    guestName: 'Grupo da faculdade',
    message: 'Das salas de aula até o altar — que linda história. Parabéns!',
    createdAt: hoursAgo(4),
  },
];
const localMessageIdempotency = new Map();

function muralFor(accountId) {
  if (accountId === PARTNER_ACCOUNT_ID) return localMessages;
  if (!localMessagesByAccount.has(accountId)) localMessagesByAccount.set(accountId, []);
  return localMessagesByAccount.get(accountId);
}

function nodeHeadersToFetch(req) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value == null) continue;
    headers.set(key, Array.isArray(value) ? value.join(', ') : String(value));
  }
  return headers;
}

async function nodeRequestToFetch(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const method = req.method || 'GET';
  const body = method === 'GET' || method === 'HEAD' ? undefined : Buffer.concat(chunks);
  return new Request(`http://localhost${req.url}`, { method, headers: nodeHeadersToFetch(req), body });
}

async function sendFunctionResponse(res, response) {
  res.statusCode = response.status;
  const cookies =
    typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
  for (const [key, value] of response.headers.entries()) {
    if (key.toLowerCase() === 'set-cookie') continue;
    res.setHeader(key, value);
  }
  if (cookies.length) {
    res.setHeader('Set-Cookie', cookies);
  } else {
    const single = response.headers.get('set-cookie');
    if (single) res.setHeader('Set-Cookie', single);
  }
  const buf = Buffer.from(await response.arrayBuffer());
  res.end(buf.length ? buf : undefined);
}

function authApiPlugin(env) {
  const pagesEnv = {
    DB: null,
    PARTNER_EMAIL: env.PARTNER_EMAIL,
    PARTNER_BOOTSTRAP_PASSWORD: env.PARTNER_BOOTSTRAP_PASSWORD,
  };
  const routes = {
    '/api/auth/signup': { POST: signupPost, OPTIONS: signupOptions },
    '/api/auth/login': { POST: loginPost, OPTIONS: loginOptions },
    '/api/auth/logout': { POST: logoutPost, OPTIONS: logoutOptions },
    '/api/auth/me': { GET: meGet, OPTIONS: meOptions },
    '/api/account/plan': { POST: planPost, OPTIONS: planOptions },
  };
  return {
    name: 'auth-api-local',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          const parsed = new URL(req.url || '/', 'http://localhost');
          const handlers = routes[parsed.pathname];
          if (!handlers) return next();
          const method = String(req.method || 'GET').toUpperCase();
          const handler = handlers[method];
          if (!handler) return next();
          const request = await nodeRequestToFetch(req);
          const response = await handler({ request, env: pagesEnv });
          return sendFunctionResponse(res, response);
        } catch (err) {
          return sendJson(res, 500, { ok: false, error: err?.message || 'Erro interno.' });
        }
      });
    },
  };
}

function sendBytes(res, status, bytes, contentType) {
  res.statusCode = status;
  res.setHeader('Content-Type', contentType || 'application/octet-stream');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.end(Buffer.from(bytes));
}

function guestListApiPlugin(env = {}) {
  return {
    name: 'guest-list-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          const rawUrl = req.url || '/';
          const parsed = new URL(rawUrl, 'http://localhost');
          const path = parsed.pathname;

          const casalPage = path.match(/^\/api\/casal\/([^/]+)\/?$/);
          if (casalPage && req.method === 'GET') {
            await ensurePartnerAccount(null, {
              email: process.env.PARTNER_EMAIL,
              password: process.env.PARTNER_BOOTSTRAP_PASSWORD,
            }, new Date().toISOString());
            const { onRequestGet } = await import('./functions/api/casal/[slug].js');
            const resFn = await onRequestGet({
              request: new Request(`http://localhost${path}`),
              env: { DB: null },
              params: { slug: decodeURIComponent(casalPage[1]) },
            });
            const text = await resFn.text();
            return sendJson(res, resFn.status, JSON.parse(text));
          }

          if (path === '/api/gifts/checkout' && req.method === 'POST') {
            await ensurePartnerAccount(null, {
              email: process.env.PARTNER_EMAIL,
              password: process.env.PARTNER_BOOTSTRAP_PASSWORD,
            }, new Date().toISOString());
            const { onRequestPost } = await import('./functions/api/gifts/checkout.js');
            const request = await nodeRequestToFetch(req);
            const resFn = await onRequestPost({
              request,
              env: {
                DB: null,
                RSVP_SECRET: env.RSVP_SECRET || process.env.RSVP_SECRET,
                MP_ACCESS_TOKEN: env.MP_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN,
              },
            });
            const text = await resFn.text();
            let payload;
            try {
              payload = JSON.parse(text);
            } catch {
              payload = { ok: false, error: text || 'Erro interno.' };
            }
            return sendJson(res, resFn.status, payload);
          }

          if (path === '/api/desafio/theme' && req.method === 'GET') {
            const resolved = await resolvePublicSlugOrPartner(null, parsed.searchParams.get('slug'));
            if (!resolved.ok) return sendJson(res, resolved.status, { error: resolved.error });
            const theme = await getDesafioTheme(null, resolved.account.id);
            const { weddingKey: _weddingKey, ...publicTheme } = theme;
            return sendJson(res, 200, { ok: true, theme: publicTheme, cssVars: themeToCssVars(theme) });
          }

          if (path === '/api/desafio/challenges' && req.method === 'GET') {
            const resolved = await resolvePublicSlugOrPartner(null, parsed.searchParams.get('slug'));
            if (!resolved.ok) return sendJson(res, resolved.status, { error: resolved.error });
            const catalog = await listChallengesPublic(null, resolved.account.id);
            return sendJson(res, 200, { ok: true, ...catalog });
          }

          if (path === '/api/desafio/gallery' && req.method === 'GET') {
            const resolved = await resolvePublicSlugOrPartner(null, parsed.searchParams.get('slug'));
            if (!resolved.ok) return sendJson(res, resolved.status, { error: resolved.error });
            return sendJson(res, 200, { ok: true, photos: await listGalleryPhotos(null, resolved.account.id) });
          }

          if (path === '/api/desafio/gallery' && req.method === 'POST') {
            try {
              const request = await nodeRequestToFetch(req);
              const payload = await parseGalleryUpload(request);
              const resolved = await resolvePublicSlugOrPartner(null, slugFromRequest(request, payload));
              if (!resolved.ok) return sendJson(res, resolved.status, { error: resolved.error });
              const photo = await upsertGalleryPhoto(null, payload, null, resolved.account.id);
              return sendJson(res, 201, { ok: true, photo });
            } catch (err) {
              const map = { VALIDATION: 400, GALLERY_UNAVAILABLE: 503 };
              return sendJson(res, map[err.message] || 500, {
                ok: false,
                error: err.message,
                details: err.details,
                message: err.message,
              });
            }
          }

          if (path === '/api/desafio/gallery' && req.method === 'DELETE') {
            try {
              const resolved = await resolvePublicSlugOrPartner(null, parsed.searchParams.get('slug'));
              if (!resolved.ok) return sendJson(res, resolved.status, { error: resolved.error });
              await deleteGalleryPhoto(
                null,
                {
                  id: parsed.searchParams.get('id'),
                  guestName: parsed.searchParams.get('guestName'),
                  missionId: parsed.searchParams.get('missionId'),
                },
                null,
                resolved.account.id
              );
              return sendJson(res, 200, { ok: true, removed: true });
            } catch (err) {
              const map = { NOT_FOUND: 404, INVALID_ID: 400 };
              return sendJson(res, map[err.message] || 500, { ok: false, error: err.message });
            }
          }

          const galleryImage = path.match(/^\/api\/desafio\/gallery\/([^/]+)\/image$/);
          if (galleryImage && req.method === 'GET') {
            try {
              const resolved = await resolvePublicSlugOrPartner(null, parsed.searchParams.get('slug'));
              if (!resolved.ok) return sendJson(res, resolved.status, { error: resolved.error });
              const image = await getGalleryImage(
                null,
                decodeURIComponent(galleryImage[1]),
                null,
                resolved.account.id
              );
              return sendBytes(res, 200, image.bytes, image.contentType);
            } catch (err) {
              const map = { NOT_FOUND: 404, INVALID_ID: 400 };
              return sendJson(res, map[err.message] || 500, { ok: false, error: err.message });
            }
          }

          const galleryOne = path.match(/^\/api\/desafio\/gallery\/([^/]+)$/);
          if (galleryOne && req.method === 'GET') {
            try {
              const resolved = await resolvePublicSlugOrPartner(null, parsed.searchParams.get('slug'));
              if (!resolved.ok) return sendJson(res, resolved.status, { error: resolved.error });
              const photo = await getGalleryPhoto(
                null,
                decodeURIComponent(galleryOne[1]),
                resolved.account.id
              );
              return sendJson(res, 200, { ok: true, photo });
            } catch (err) {
              const map = { NOT_FOUND: 404, INVALID_ID: 400 };
              return sendJson(res, map[err.message] || 500, { ok: false, error: err.message });
            }
          }

          if (path === '/api/desafio/answer' && req.method === 'POST') {
            const body = await readJsonBody(req);
            const slugReq = new Request(`http://localhost${req.url}`);
            const resolved = await resolvePublicSlugOrPartner(null, slugFromRequest(slugReq, body));
            if (!resolved.ok) return sendJson(res, resolved.status, { error: resolved.error });
            try {
              const result = await gradeQuestion(
                null,
                resolved.account.id,
                String(body?.questionId || ''),
                body?.selectedIndex
              );
              return sendJson(res, 200, { ok: true, ...result });
            } catch (err) {
              const map = { NOT_FOUND: 404, INVALID_ID: 400, VALIDATION: 400 };
              return sendJson(res, map[err.message] || 500, {
                ok: false,
                error: err.message,
                details: err.details,
              });
            }
          }

          if (path === '/api/rsvp' && req.method === 'POST') {
            const idem = req.headers['idempotency-key'];
            if (!idem) return sendJson(res, 400, { error: 'Header Idempotency-Key é obrigatório' });
            const body = await readJsonBody(req);
            const slugReq = new Request(`http://localhost${req.url}`);
            const resolved = await resolvePublicSlugOrPartner(null, slugFromRequest(slugReq, body));
            if (!resolved.ok) return sendJson(res, resolved.status, { error: resolved.error });
            const { slug: _slug, ...payload } = body || {};
            const validation = validateRsvpCreate(payload);
            if (!validation.valid) {
              return sendJson(res, 400, { error: 'Dados inválidos', details: validation.errors });
            }
            const data = validation.data;
            const gate = await assertGuestAllowed(null, data.guestName, resolved.account.id);
            if (!gate.allowed) {
              return sendJson(res, 403, {
                error: gate.message || 'Convidado não autorizado',
                details: { error: gate.error, rsvpMode: gate.mode },
              });
            }
            await markGuestResponse(null, data.guestName, data.attending, resolved.account.id);
            const manageToken = crypto.randomUUID().replaceAll('-', '');
            const now = new Date().toISOString();
            const rsvp = {
              id: crypto.randomUUID(),
              guestName: data.guestName,
              attending: data.attending,
              adultsCount: data.attending ? data.adultsCount : 0,
              childrenCount: 0,
              observations: data.observations ?? null,
              consentGiven: true,
              createdAt: now,
              updatedAt: now,
              manageToken,
            };
            localRsvpsByToken.set(manageToken, rsvp);
            return sendJson(res, 201, rsvp);
          }

          if (path === '/api/rsvp' && req.method === 'GET') {
            const auth = req.headers.authorization || '';
            const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
            const rsvp = localRsvpsByToken.get(token);
            if (!rsvp) return sendJson(res, 401, { error: 'Token de autorização inválido' });
            const { manageToken, ...publicRsvp } = rsvp;
            return sendJson(res, 200, publicRsvp);
          }

          if (path === '/api/gifts/catalog' && req.method === 'GET') {
            const request = await nodeRequestToFetch(req);
            const resolved = await resolvePublicSlugOrPartner(null, slugFromRequest(request));
            if (!resolved.ok) return sendJson(res, resolved.status, { error: resolved.error });
            const catalog = await getActiveCatalog(null, resolved.account.id);
            return sendJson(res, 200, {
              ok: true,
              gifts: catalog.map((g) => ({
                id: g.id,
                name: g.name,
                description: g.description,
                priceInCents: g.priceInCents,
                imageUrl: g.imageUrl,
                mode: g.mode,
              })),
            });
          }

          if (path === '/api/guests/search' && req.method === 'GET') {
            const q = parsed.searchParams.get('q') || '';
            if (String(q).trim().length < 2) {
              return sendJson(res, 400, {
                ok: false,
                error: 'QUERY_TOO_SHORT',
                message: 'Digite pelo menos 2 letras para buscar.',
              });
            }
            const request = await nodeRequestToFetch(req);
            const resolved = await resolvePublicSlugOrPartner(null, slugFromRequest(request));
            if (!resolved.ok) return sendJson(res, resolved.status, { error: resolved.error });
            const matches = await searchGuests(null, q, resolved.account.id);
            return sendJson(res, 200, {
              ok: true,
              query: q,
              count: matches.length,
              matches: matches.map((g) => ({ id: g.id, displayName: g.displayName })),
            });
          }

          if (path === '/api/guests' && req.method === 'GET') {
            const guests = await listGuestList(null, PARTNER_ACCOUNT_ID);
            return sendJson(res, 200, { ok: true, guests, count: guests.length });
          }

          if (path === '/api/guests' && req.method === 'POST') {
            const body = await readJsonBody(req);
            try {
              const result = await addGuests(null, body?.names || [], {
                accountId: PARTNER_ACCOUNT_ID,
              });
              const guests = await listGuestList(null, PARTNER_ACCOUNT_ID);
              return sendJson(res, 200, { ok: true, ...result, guests });
            } catch (err) {
              const status = err.message === 'EMPTY_GUEST_LIST' ? 400 : 500;
              return sendJson(res, status, { ok: false, error: err.message });
            }
          }

          if (path === '/api/guests' && req.method === 'DELETE') {
            const id = parsed.searchParams.get('id');
            try {
              await removeGuest(null, id, PARTNER_ACCOUNT_ID);
              const guests = await listGuestList(null, PARTNER_ACCOUNT_ID);
              return sendJson(res, 200, { ok: true, removed: id, guests });
            } catch (err) {
              const status =
                err.message === 'GUEST_NOT_FOUND' || err.message === 'INVALID_GUEST_ID' ? 404 : 500;
              return sendJson(res, status, { ok: false, error: err.message });
            }
          }

          if (path === '/api/messages' && req.method === 'GET') {
            const request = await nodeRequestToFetch(req);
            const resolved = await resolvePublicSlugOrPartner(null, slugFromRequest(request));
            if (!resolved.ok) return sendJson(res, resolved.status, { error: resolved.error });
            const limitRaw = parseInt(parsed.searchParams.get('limit') || '12', 10);
            const limit = Number.isFinite(limitRaw)
              ? Math.min(50, Math.max(3, limitRaw))
              : 12;
            const cursor = parsed.searchParams.get('cursor');
            const mural = muralFor(resolved.account.id).filter((m) => m.hidden !== 1 && m.hidden !== true);
            const sorted = [...mural].sort((a, b) => {
              if (a.createdAt === b.createdAt) return a.id < b.id ? 1 : -1;
              return a.createdAt < b.createdAt ? 1 : -1;
            });
            let start = 0;
            if (cursor) {
              try {
                const json = Buffer.from(
                  cursor.replace(/-/g, '+').replace(/_/g, '/'),
                  'base64'
                ).toString('utf8');
                const { createdAt, id } = JSON.parse(json);
                start = sorted.findIndex(
                  (m) => m.createdAt < createdAt || (m.createdAt === createdAt && m.id < id)
                );
                if (start < 0) start = sorted.length;
              } catch {
                return sendJson(res, 400, { error: 'Cursor inválido' });
              }
            }
            const slice = sorted.slice(start, start + limit + 1);
            const hasMore = slice.length > limit;
            const messages = slice.slice(0, limit).map(({ id, guestName, message, createdAt }) => ({
              id,
              guestName,
              message,
              createdAt,
            }));
            let nextCursor = null;
            if (hasMore && messages.length) {
              const last = messages[messages.length - 1];
              nextCursor = Buffer.from(JSON.stringify({ createdAt: last.createdAt, id: last.id }))
                .toString('base64')
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/g, '');
            }
            return sendJson(res, 200, { messages, nextCursor });
          }

          if (path === '/api/messages' && req.method === 'POST') {
            const idem = req.headers['idempotency-key'];
            if (!idem) {
              return sendJson(res, 400, { error: 'Header Idempotency-Key é obrigatório' });
            }
            const body = await readJsonBody(req);
            const slugReq = new Request(`http://localhost${req.url}`);
            const resolved = await resolvePublicSlugOrPartner(null, slugFromRequest(slugReq, body));
            if (!resolved.ok) return sendJson(res, resolved.status, { error: resolved.error });
            const { slug: _slug, ...payload } = body || {};
            const validation = validateMessageCreate(payload);
            if (!validation.valid) {
              return sendJson(res, 400, {
                error: 'Dados inválidos',
                details: validation.errors,
              });
            }
            const idemKey = `${resolved.account.id}:${idem}`;
            if (localMessageIdempotency.has(idemKey)) {
              return sendJson(res, 201, localMessageIdempotency.get(idemKey));
            }
            const created = {
              id: crypto.randomUUID(),
              weddingKey: resolved.account.slug || resolved.account.id,
              guestName: validation.data.guestName,
              message: validation.data.message,
              createdAt: new Date().toISOString(),
            };
            muralFor(resolved.account.id).unshift(created);
            localMessageIdempotency.set(idemKey, created);
            return sendJson(res, 201, created);
          }
        } catch (err) {
          return sendJson(res, 500, { ok: false, error: err?.message || 'Erro interno.' });
        }
        next();
      });
    },
  };
}

function adminApiPlugin(env) {
  return {
    name: 'admin-api-local',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          const parsed = new URL(req.url || '/', 'http://localhost');
          const path = parsed.pathname;
          if (!path.startsWith('/api/admin/')) return next();

          // Header-only Fetch Request (nodeRequestToFetch would consume the body stream).
          const fetchRequest = new Request(`http://localhost${req.url}`, {
            method: req.method || 'GET',
            headers: nodeHeadersToFetch(req),
          });
          const auth = await requireAccount(fetchRequest, { DB: null });
          if (!auth.ok) {
            return sendJson(res, 401, {
              ok: false,
              error: auth.error,
              message: auth.message,
            });
          }

          if (path.startsWith('/api/admin/challenges/') && auth.account.plan === 'basic') {
            return sendJson(res, 403, { ok: false, error: 'PLAN_REQUIRED' });
          }

          if (path === '/api/admin/summary' && req.method === 'GET') {
            const guests = await listGuestList(null, auth.account.id);
            const groups = await listGroups(null, auth.account.id);
            const guestStats = summarizeGuestList(guests);
            const rsvpMode = await getRsvpMode(null, auth.account.id);
            const messages = await listMessagesAdmin(null, auth.account.id);
            return sendJson(res, 200, {
              ok: true,
              summary: {
                attendingCount: guestStats.attendingCount,
                declinedCount: guestStats.declinedCount,
                pendingCount: guestStats.pendingCount,
                messagesVisible: messages.filter((m) => !m.hidden).length,
                messagesHidden: messages.filter((m) => m.hidden).length,
                giftsPending: 0,
                giftsPaid: 0,
                giftsPaidCents: 0,
                rsvpMode,
                guestListCount: guestStats.guestListCount,
                groupsCount: groups.length,
              },
              rsvpMode,
              guestList: guests,
              groups,
              messages,
              gifts: [],
            });
          }

          if (path === '/api/admin/guest-list') {
            const snap = async () => {
              const [rsvpMode, guests, groups] = await Promise.all([
                getRsvpMode(null, auth.account.id),
                listGuestList(null, auth.account.id),
                listGroups(null, auth.account.id),
              ]);
              return { rsvpMode, guests, groups, count: guests.length };
            };

            if (req.method === 'GET') {
              return sendJson(res, 200, { ok: true, ...(await snap()) });
            }

            if (req.method === 'POST') {
              const body = await readJsonBody(req);
              try {
                const names = Array.isArray(body?.names)
                  ? body.names
                  : parseGuestNamesInput(body?.namesText || '');
                const result = await addGuests(null, names, {
                  groupId: body?.groupId || null,
                  accountId: auth.account.id,
                });
                return sendJson(res, 200, { ok: true, ...result, ...(await snap()) });
              } catch (err) {
                const status =
                  err.message === 'EMPTY_GUEST_LIST' || err.message === 'GUEST_LIST_TOO_LARGE'
                    ? 400
                    : err.message === 'GROUP_NOT_FOUND'
                      ? 404
                      : 500;
                return sendJson(res, status, { ok: false, error: err.message, message: err.message });
              }
            }

            if (req.method === 'PATCH') {
              const body = await readJsonBody(req);
              try {
                if (body?.createGroup?.name) {
                  await createGroup(null, body.createGroup.name, auth.account.id);
                }
                if (body?.deleteGroupId) await deleteGroup(null, String(body.deleteGroupId), auth.account.id);
                if (body?.removeId) await removeGuest(null, String(body.removeId), auth.account.id);
                if (body?.guestId && Object.prototype.hasOwnProperty.call(body, 'attending')) {
                  await setGuestAttending(null, String(body.guestId), body.attending, auth.account.id);
                }
                if (body?.guestId && Object.prototype.hasOwnProperty.call(body, 'groupId')) {
                  await setGuestGroup(null, String(body.guestId), body.groupId, auth.account.id);
                }
                let modeResult = null;
                if (body?.rsvpMode) modeResult = await setRsvpMode(null, body.rsvpMode, auth.account.id);
                return sendJson(res, 200, {
                  ok: true,
                  ...(await snap()),
                  ...(modeResult ? { updatedAt: modeResult.updatedAt } : {}),
                });
              } catch (err) {
                const map = {
                  INVALID_RSVP_MODE: 400,
                  INVALID_GROUP_NAME: 400,
                  INVALID_ATTENDING: 400,
                  INVALID_GUEST_ID: 400,
                  INVALID_GROUP_ID: 400,
                  GROUP_EXISTS: 409,
                  GROUP_NOT_FOUND: 404,
                  GUEST_NOT_FOUND: 404,
                };
                return sendJson(res, map[err.message] || 500, {
                  ok: false,
                  error: err.message,
                  message: err.message,
                });
              }
            }
          }

          if (path === '/api/admin/gifts') {
            const mapErr = (err) => {
              const map = {
                GIFT_NOT_FOUND: 404,
                GIFT_EXISTS: 409,
                VALIDATION: 400,
                EMPTY_PATCH: 400,
                INVALID_GIFT_ID: 400,
              };
              return sendJson(res, map[err.message] || 500, {
                ok: false,
                error: err.message,
                details: err.details,
                message: err.message,
              });
            };
            try {
              if (req.method === 'GET') {
                const gifts = await listCatalogAdmin(null, auth.account.id);
                return sendJson(res, 200, { ok: true, gifts });
              }
              if (req.method === 'POST') {
                const body = await readJsonBody(req);
                const gift = await createGift(null, auth.account.id, body || {});
                return sendJson(res, 201, { ok: true, gift, gifts: await listCatalogAdmin(null, auth.account.id) });
              }
              if (req.method === 'PATCH') {
                const body = await readJsonBody(req);
                if (!body?.id) return sendJson(res, 400, { ok: false, error: 'MISSING_ID' });
                const gift = await updateGift(null, auth.account.id, String(body.id), body);
                return sendJson(res, 200, { ok: true, gift });
              }
              if (req.method === 'DELETE') {
                const id = parsed.searchParams.get('id');
                if (!id) return sendJson(res, 400, { ok: false, error: 'MISSING_ID' });
                await deleteGift(null, auth.account.id, id);
                return sendJson(res, 200, {
                  ok: true,
                  removed: id,
                  gifts: await listCatalogAdmin(null, auth.account.id),
                });
              }
            } catch (err) {
              return mapErr(err);
            }
          }

          if (path === '/api/admin/stationery') {
            const origin = `http://${req.headers.host || 'localhost:5173'}`;
            const mapErr = (err) => {
              const map = {
                TEMPLATE_NOT_FOUND: 404,
                TEMPLATE_EXISTS: 409,
                VALIDATION: 400,
                EMPTY_PATCH: 400,
                INVALID_ID: 400,
              };
              return sendJson(res, map[err.message] || 500, {
                ok: false,
                error: err.message,
                details: err.details,
                message: err.message,
              });
            };
            try {
              if (req.method === 'GET') {
                const templates = presentStationery(await listStationeryAdmin(null, auth.account.id), origin);
                return sendJson(res, 200, { ok: true, templates });
              }
              if (req.method === 'POST') {
                const body = await readJsonBody(req);
                const template = await createStationeryTemplate(null, auth.account.id, body || {});
                const [presented] = presentStationery([template], origin);
                return sendJson(res, 201, {
                  ok: true,
                  template: presented,
                  templates: presentStationery(await listStationeryAdmin(null, auth.account.id), origin),
                });
              }
              if (req.method === 'PATCH') {
                const body = await readJsonBody(req);
                if (!body?.id) return sendJson(res, 400, { ok: false, error: 'MISSING_ID' });
                const template = await updateStationeryTemplate(null, auth.account.id, String(body.id), body);
                const [presented] = presentStationery([template], origin);
                return sendJson(res, 200, { ok: true, template: presented });
              }
              if (req.method === 'DELETE') {
                const id = parsed.searchParams.get('id');
                if (!id) return sendJson(res, 400, { ok: false, error: 'MISSING_ID' });
                await deleteStationeryTemplate(null, auth.account.id, id);
                return sendJson(res, 200, {
                  ok: true,
                  removed: id,
                  templates: presentStationery(await listStationeryAdmin(null, auth.account.id), origin),
                });
              }
            } catch (err) {
              return mapErr(err);
            }
          }

          const mapChallengeErr = (err) => {
            const map = {
              NOT_FOUND: 404,
              EXISTS: 409,
              VALIDATION: 400,
              EMPTY_PATCH: 400,
              INVALID_ID: 400,
            };
            return sendJson(res, map[err.message] || 500, {
              ok: false,
              error: err.message,
              details: err.details,
              message: err.message,
            });
          };

          if (path === '/api/admin/challenges/questions') {
            try {
              if (req.method === 'GET') {
                return sendJson(res, 200, {
                  ok: true,
                  questions: await listQuestionsAdmin(null, auth.account.id),
                });
              }
              if (req.method === 'POST') {
                const body = await readJsonBody(req);
                const question = await createQuestion(null, auth.account.id, body || {});
                return sendJson(res, 201, {
                  ok: true,
                  question,
                  questions: await listQuestionsAdmin(null, auth.account.id),
                });
              }
              if (req.method === 'PATCH') {
                const body = await readJsonBody(req);
                if (!body?.id) return sendJson(res, 400, { ok: false, error: 'MISSING_ID' });
                const question = await updateQuestion(null, auth.account.id, String(body.id), body);
                return sendJson(res, 200, { ok: true, question });
              }
              if (req.method === 'DELETE') {
                const id = parsed.searchParams.get('id');
                if (!id) return sendJson(res, 400, { ok: false, error: 'MISSING_ID' });
                await deleteQuestion(null, auth.account.id, id);
                return sendJson(res, 200, {
                  ok: true,
                  removed: id,
                  questions: await listQuestionsAdmin(null, auth.account.id),
                });
              }
            } catch (err) {
              return mapChallengeErr(err);
            }
          }

          if (path === '/api/admin/challenges/photo-missions') {
            try {
              if (req.method === 'GET') {
                return sendJson(res, 200, {
                  ok: true,
                  photoMissions: await listPhotoMissionsAdmin(null, auth.account.id),
                });
              }
              if (req.method === 'POST') {
                const body = await readJsonBody(req);
                const photoMission = await createPhotoMission(null, auth.account.id, body || {});
                return sendJson(res, 201, {
                  ok: true,
                  photoMission,
                  photoMissions: await listPhotoMissionsAdmin(null, auth.account.id),
                });
              }
              if (req.method === 'PATCH') {
                const body = await readJsonBody(req);
                if (!body?.id) return sendJson(res, 400, { ok: false, error: 'MISSING_ID' });
                const photoMission = await updatePhotoMission(null, auth.account.id, String(body.id), body);
                return sendJson(res, 200, { ok: true, photoMission });
              }
              if (req.method === 'DELETE') {
                const id = parsed.searchParams.get('id');
                if (!id) return sendJson(res, 400, { ok: false, error: 'MISSING_ID' });
                await deletePhotoMission(null, auth.account.id, id);
                return sendJson(res, 200, {
                  ok: true,
                  removed: id,
                  photoMissions: await listPhotoMissionsAdmin(null, auth.account.id),
                });
              }
            } catch (err) {
              return mapChallengeErr(err);
            }
          }

          if (path === '/api/admin/challenges/theme') {
            try {
              if (req.method === 'GET') {
                return sendJson(res, 200, { ok: true, theme: await getDesafioTheme(null, auth.account.id) });
              }
              if (req.method === 'PATCH') {
                const body = await readJsonBody(req);
                const theme = await updateDesafioTheme(null, auth.account.id, body || {});
                return sendJson(res, 200, { ok: true, theme });
              }
            } catch (err) {
              return mapChallengeErr(err);
            }
          }

          if (path === '/api/admin/messages' && req.method === 'GET') {
            const messages = await listMessagesAdmin(null, auth.account.id);
            return sendJson(res, 200, { ok: true, messages });
          }

          if (path === '/api/admin/gallery' && req.method === 'GET') {
            if (auth.account.id !== PARTNER_ACCOUNT_ID) {
              return sendJson(res, 200, { ok: true, photos: [] });
            }
            return sendJson(res, 200, { ok: true, photos: await listGalleryPhotos(null) });
          }

          if (path === '/api/admin/challenges/stamp-cards') {
            try {
              if (req.method === 'GET') {
                return sendJson(res, 200, {
                  ok: true,
                  stampCards: await listStampCardsAdmin(null, auth.account.id),
                });
              }
              if (req.method === 'POST') {
                const body = await readJsonBody(req);
                const stampCard = await createStampCard(null, auth.account.id, body || {});
                return sendJson(res, 201, {
                  ok: true,
                  stampCard,
                  stampCards: await listStampCardsAdmin(null, auth.account.id),
                });
              }
              if (req.method === 'PATCH') {
                const body = await readJsonBody(req);
                if (!body?.id) return sendJson(res, 400, { ok: false, error: 'MISSING_ID' });
                const stampCard = await updateStampCard(null, auth.account.id, String(body.id), body);
                return sendJson(res, 200, { ok: true, stampCard });
              }
              if (req.method === 'DELETE') {
                const id = parsed.searchParams.get('id');
                if (!id) return sendJson(res, 400, { ok: false, error: 'MISSING_ID' });
                await deleteStampCard(null, auth.account.id, id);
                return sendJson(res, 200, {
                  ok: true,
                  removed: id,
                  stampCards: await listStampCardsAdmin(null, auth.account.id),
                });
              }
            } catch (err) {
              return mapChallengeErr(err);
            }
          }

          // Demais rotas admin: stub ok local (evita 404 no painel)
          if (req.method === 'GET') {
            return sendJson(res, 200, { ok: true, gifts: [], items: [], lodging: [], stationery: [], templates: [] });
          }
          if (req.method === 'PATCH' || req.method === 'POST' || req.method === 'DELETE') {
            return sendJson(res, 200, { ok: true });
          }
        } catch (err) {
          return sendJson(res, 500, { ok: false, error: err?.message || 'Erro interno.' });
        }
        next();
      });
    },
  };
}

function mercadopagoApiPlugin(env) {
  return {
    name: 'mercadopago-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          const url = req.url?.split('?')[0];

          if (url === '/api/create-pix' && req.method === 'POST') {
            const body = await readJsonBody(req);
            const result = await createPixPayment({
              accessToken: env.MP_ACCESS_TOKEN,
              amount: body.amount,
              title: body.title,
              email: body.email,
              message: body.message,
              giftId: body.giftId,
              payerName: body.payerName,
              testPayerEmail: env.MP_TEST_PAYER_EMAIL,
            });
            return sendJson(res, result.status || (result.ok ? 200 : 500), result.ok ? result.payment : { error: result.error, details: result.details });
          }

          if (url === '/api/payment-status' && req.method === 'GET') {
            const paymentId = new URL(req.url, 'http://localhost').searchParams.get('id');
            const result = await getPaymentStatus({
              accessToken: env.MP_ACCESS_TOKEN,
              paymentId,
            });
            return sendJson(res, result.status || (result.ok ? 200 : 500), result.ok ? result.payment : { error: result.error, details: result.details });
          }

          if (url === '/api/create-preference' && req.method === 'POST') {
            const body = await readJsonBody(req);
            const planId = String(body.planId || '').toLowerCase();
            const plan = PLANS[planId];
            if (!plan) return sendJson(res, 400, { error: 'Plano inválido.' });

            const host = req.headers.host || 'localhost:5174';
            const proto = host.includes('localhost') ? 'http' : 'https';
            const origin = `${proto}://${host}`;

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
            return sendJson(res, result.status || (result.ok ? 200 : 500), result.ok ? result.preference : { error: result.error, details: result.details });
          }
        } catch (err) {
          return sendJson(res, 500, { error: err?.message || 'Erro interno.' });
        }
        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, rootDir, '');
  return {
    root: '.',
    publicDir: 'public',
    plugins: [
      mpaSpaFallbackPlugin(),
      react(),
      authApiPlugin(env),
      guestListApiPlugin(env),
      adminApiPlugin(env),
      mercadopagoApiPlugin(env),
    ],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          main: resolve(rootDir, 'index.html'),
          landing: resolve(rootDir, 'landing-page-animada/index.html'),
          daniCarine: resolve(rootDir, 'dani-carine/index.html'),
          daniCarineAdmin: resolve(rootDir, 'dani-carine/admin.html'),
          daniCarineLista: resolve(rootDir, 'dani-carine/lista.html'),
          lista: resolve(rootDir, 'lista/index.html'),
          casebemApp: resolve(rootDir, 'app/index.html'),
          casebemGames: resolve(rootDir, 'games/index.html'),
        },
      },
    },
    server: {
      open: '/',
    },
    preview: {
      open: '/games/',
    },
  };
});
