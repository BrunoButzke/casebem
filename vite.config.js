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

const rootDir = dirname(fileURLToPath(import.meta.url));

const PLANS = {
  standard: { name: 'Standard', amount: 299.9 },
  plus: { name: 'Plus', amount: 499.9 },
  vip: { name: 'VIP', amount: 1199.9 },
};

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
    plugins: [mercadopagoApiPlugin(env)],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          landing: resolve(rootDir, 'landing-page-animada/index.html'),
          daniCarine: resolve(rootDir, 'dani-carine/index.html'),
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
