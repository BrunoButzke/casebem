import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
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
} from './functions/_lib/challenges-service.mjs';

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

function guestListApiPlugin() {
  return {
    name: 'guest-list-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          const rawUrl = req.url || '/';
          const parsed = new URL(rawUrl, 'http://localhost');
          const path = parsed.pathname;

          if (path === '/api/rsvp' && req.method === 'POST') {
            const idem = req.headers['idempotency-key'];
            if (!idem) return sendJson(res, 400, { error: 'Header Idempotency-Key é obrigatório' });
            const body = await readJsonBody(req);
            const validation = validateRsvpCreate(body);
            if (!validation.valid) {
              return sendJson(res, 400, { error: 'Dados inválidos', details: validation.errors });
            }
            const data = validation.data;
            await markGuestResponse(null, data.guestName, data.attending);
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

          if (path === '/api/guests/search' && req.method === 'GET') {
            const q = parsed.searchParams.get('q') || '';
            if (String(q).trim().length < 2) {
              return sendJson(res, 400, {
                ok: false,
                error: 'QUERY_TOO_SHORT',
                message: 'Digite pelo menos 2 letras para buscar.',
              });
            }
            const matches = await searchGuests(null, q);
            return sendJson(res, 200, {
              ok: true,
              query: q,
              count: matches.length,
              matches: matches.map((g) => ({ id: g.id, displayName: g.displayName })),
            });
          }

          if (path === '/api/guests' && req.method === 'GET') {
            const guests = await listGuestList(null);
            return sendJson(res, 200, { ok: true, guests, count: guests.length });
          }

          if (path === '/api/guests' && req.method === 'POST') {
            const body = await readJsonBody(req);
            try {
              const result = await addGuests(null, body?.names || []);
              const guests = await listGuestList(null);
              return sendJson(res, 200, { ok: true, ...result, guests });
            } catch (err) {
              const status = err.message === 'EMPTY_GUEST_LIST' ? 400 : 500;
              return sendJson(res, status, { ok: false, error: err.message });
            }
          }

          if (path === '/api/guests' && req.method === 'DELETE') {
            const id = parsed.searchParams.get('id');
            try {
              await removeGuest(null, id);
              const guests = await listGuestList(null);
              return sendJson(res, 200, { ok: true, removed: id, guests });
            } catch (err) {
              const status =
                err.message === 'GUEST_NOT_FOUND' || err.message === 'INVALID_GUEST_ID' ? 404 : 500;
              return sendJson(res, status, { ok: false, error: err.message });
            }
          }

          if (path === '/api/messages' && req.method === 'GET') {
            const limitRaw = parseInt(parsed.searchParams.get('limit') || '12', 10);
            const limit = Number.isFinite(limitRaw)
              ? Math.min(50, Math.max(3, limitRaw))
              : 12;
            const cursor = parsed.searchParams.get('cursor');
            const sorted = [...localMessages].sort((a, b) => {
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
            const validation = validateMessageCreate(body);
            if (!validation.valid) {
              return sendJson(res, 400, {
                error: 'Dados inválidos',
                details: validation.errors,
              });
            }
            if (localMessageIdempotency.has(idem)) {
              return sendJson(res, 201, localMessageIdempotency.get(idem));
            }
            const created = {
              id: crypto.randomUUID(),
              weddingKey: 'dani-carine',
              guestName: validation.data.guestName,
              message: validation.data.message,
              createdAt: new Date().toISOString(),
            };
            localMessages.unshift(created);
            localMessageIdempotency.set(idem, created);
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

          const secret = env.ADMIN_PANEL_SECRET || '';
          const auth = req.headers.authorization || '';
          const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
          if (!secret || secret.length < 16) {
            return sendJson(res, 503, {
              ok: false,
              error: 'ADMIN_NOT_CONFIGURED',
              message: 'Defina ADMIN_PANEL_SECRET (≥16) no .env',
            });
          }
          if (token !== secret) {
            return sendJson(res, 401, {
              ok: false,
              error: 'UNAUTHORIZED',
              message: 'Token admin inválido.',
            });
          }

          if (path === '/api/admin/summary' && req.method === 'GET') {
            const guests = await listGuestList(null);
            const groups = await listGroups(null);
            const guestStats = summarizeGuestList(guests);
            const rsvpMode = await getRsvpMode(null);
            const messages = localMessages.map((m) => ({
              id: m.id,
              guestName: m.guestName,
              message: m.message,
              createdAt: m.createdAt,
              hidden: false,
            }));
            return sendJson(res, 200, {
              ok: true,
              summary: {
                attendingCount: guestStats.attendingCount,
                declinedCount: guestStats.declinedCount,
                pendingCount: guestStats.pendingCount,
                messagesVisible: messages.length,
                messagesHidden: 0,
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
                getRsvpMode(null),
                listGuestList(null),
                listGroups(null),
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
                const result = await addGuests(null, names, { groupId: body?.groupId || null });
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
                if (body?.createGroup?.name) await createGroup(null, body.createGroup.name);
                if (body?.deleteGroupId) await deleteGroup(null, String(body.deleteGroupId));
                if (body?.removeId) await removeGuest(null, String(body.removeId));
                if (body?.guestId && Object.prototype.hasOwnProperty.call(body, 'attending')) {
                  await setGuestAttending(null, String(body.guestId), body.attending);
                }
                if (body?.guestId && Object.prototype.hasOwnProperty.call(body, 'groupId')) {
                  await setGuestGroup(null, String(body.guestId), body.groupId);
                }
                let modeResult = null;
                if (body?.rsvpMode) modeResult = await setRsvpMode(null, body.rsvpMode);
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
                const gifts = await listCatalogAdmin(null);
                return sendJson(res, 200, { ok: true, gifts });
              }
              if (req.method === 'POST') {
                const body = await readJsonBody(req);
                const gift = await createGift(null, body || {});
                return sendJson(res, 201, { ok: true, gift, gifts: await listCatalogAdmin(null) });
              }
              if (req.method === 'PATCH') {
                const body = await readJsonBody(req);
                if (!body?.id) return sendJson(res, 400, { ok: false, error: 'MISSING_ID' });
                const gift = await updateGift(null, String(body.id), body);
                return sendJson(res, 200, { ok: true, gift });
              }
              if (req.method === 'DELETE') {
                const id = parsed.searchParams.get('id');
                if (!id) return sendJson(res, 400, { ok: false, error: 'MISSING_ID' });
                await deleteGift(null, id);
                return sendJson(res, 200, {
                  ok: true,
                  removed: id,
                  gifts: await listCatalogAdmin(null),
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
                const templates = presentStationery(await listStationeryAdmin(null), origin);
                return sendJson(res, 200, { ok: true, templates });
              }
              if (req.method === 'POST') {
                const body = await readJsonBody(req);
                const template = await createStationeryTemplate(null, body || {});
                const [presented] = presentStationery([template], origin);
                return sendJson(res, 201, {
                  ok: true,
                  template: presented,
                  templates: presentStationery(await listStationeryAdmin(null), origin),
                });
              }
              if (req.method === 'PATCH') {
                const body = await readJsonBody(req);
                if (!body?.id) return sendJson(res, 400, { ok: false, error: 'MISSING_ID' });
                const template = await updateStationeryTemplate(null, String(body.id), body);
                const [presented] = presentStationery([template], origin);
                return sendJson(res, 200, { ok: true, template: presented });
              }
              if (req.method === 'DELETE') {
                const id = parsed.searchParams.get('id');
                if (!id) return sendJson(res, 400, { ok: false, error: 'MISSING_ID' });
                await deleteStationeryTemplate(null, id);
                return sendJson(res, 200, {
                  ok: true,
                  removed: id,
                  templates: presentStationery(await listStationeryAdmin(null), origin),
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
                return sendJson(res, 200, { ok: true, questions: await listQuestionsAdmin(null) });
              }
              if (req.method === 'POST') {
                const body = await readJsonBody(req);
                const question = await createQuestion(null, body || {});
                return sendJson(res, 201, {
                  ok: true,
                  question,
                  questions: await listQuestionsAdmin(null),
                });
              }
              if (req.method === 'PATCH') {
                const body = await readJsonBody(req);
                if (!body?.id) return sendJson(res, 400, { ok: false, error: 'MISSING_ID' });
                const question = await updateQuestion(null, String(body.id), body);
                return sendJson(res, 200, { ok: true, question });
              }
              if (req.method === 'DELETE') {
                const id = parsed.searchParams.get('id');
                if (!id) return sendJson(res, 400, { ok: false, error: 'MISSING_ID' });
                await deleteQuestion(null, id);
                return sendJson(res, 200, {
                  ok: true,
                  removed: id,
                  questions: await listQuestionsAdmin(null),
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
                  photoMissions: await listPhotoMissionsAdmin(null),
                });
              }
              if (req.method === 'POST') {
                const body = await readJsonBody(req);
                const photoMission = await createPhotoMission(null, body || {});
                return sendJson(res, 201, {
                  ok: true,
                  photoMission,
                  photoMissions: await listPhotoMissionsAdmin(null),
                });
              }
              if (req.method === 'PATCH') {
                const body = await readJsonBody(req);
                if (!body?.id) return sendJson(res, 400, { ok: false, error: 'MISSING_ID' });
                const photoMission = await updatePhotoMission(null, String(body.id), body);
                return sendJson(res, 200, { ok: true, photoMission });
              }
              if (req.method === 'DELETE') {
                const id = parsed.searchParams.get('id');
                if (!id) return sendJson(res, 400, { ok: false, error: 'MISSING_ID' });
                await deletePhotoMission(null, id);
                return sendJson(res, 200, {
                  ok: true,
                  removed: id,
                  photoMissions: await listPhotoMissionsAdmin(null),
                });
              }
            } catch (err) {
              return mapChallengeErr(err);
            }
          }

          if (path === '/api/admin/challenges/stamp-cards') {
            try {
              if (req.method === 'GET') {
                return sendJson(res, 200, {
                  ok: true,
                  stampCards: await listStampCardsAdmin(null),
                });
              }
              if (req.method === 'POST') {
                const body = await readJsonBody(req);
                const stampCard = await createStampCard(null, body || {});
                return sendJson(res, 201, {
                  ok: true,
                  stampCard,
                  stampCards: await listStampCardsAdmin(null),
                });
              }
              if (req.method === 'PATCH') {
                const body = await readJsonBody(req);
                if (!body?.id) return sendJson(res, 400, { ok: false, error: 'MISSING_ID' });
                const stampCard = await updateStampCard(null, String(body.id), body);
                return sendJson(res, 200, { ok: true, stampCard });
              }
              if (req.method === 'DELETE') {
                const id = parsed.searchParams.get('id');
                if (!id) return sendJson(res, 400, { ok: false, error: 'MISSING_ID' });
                await deleteStampCard(null, id);
                return sendJson(res, 200, {
                  ok: true,
                  removed: id,
                  stampCards: await listStampCardsAdmin(null),
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
    plugins: [react(), guestListApiPlugin(), adminApiPlugin(env), mercadopagoApiPlugin(env)],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          landing: resolve(rootDir, 'landing-page-animada/index.html'),
          daniCarine: resolve(rootDir, 'dani-carine/index.html'),
          daniCarineAdmin: resolve(rootDir, 'dani-carine/admin.html'),
          daniCarineLista: resolve(rootDir, 'dani-carine/lista.html'),
          lista: resolve(rootDir, 'lista/index.html'),
          casebemApp: resolve(rootDir, 'app/index.html'),
        },
      },
    },
    server: {
      open: '/app/',
    },
    preview: {
      open: '/app/',
    },
  };
});
