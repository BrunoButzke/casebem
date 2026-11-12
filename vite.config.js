import { defineConfig, loadEnv } from 'vite';
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
  addGuests,
  removeGuest,
  markGuestResponse,
} from './functions/_lib/rsvp-guest-list.mjs';
import { validateRsvpCreate } from './functions/_lib/rsvp-validators.mjs';

const rootDir = dirname(fileURLToPath(import.meta.url));

const PLANS = {
  basic: { name: 'Básico', amount: 0 },
  pro: { name: 'Pro', amount: 299 },
  vip: { name: 'VIP', amount: 499 },
};

/** Local-only RSVP store (Vite) so confirmação funciona sem D1 */
const localRsvpsByToken = new Map();

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
    plugins: [guestListApiPlugin(), mercadopagoApiPlugin(env)],
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
        },
      },
    },
    server: {
      open: '/landing-page-animada/',
    },
    preview: {
      open: '/landing-page-animada/',
    },
  };
});
