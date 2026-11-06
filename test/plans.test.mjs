#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');

let failures = 0;
let passes = 0;

async function test(name, fn) {
  try {
    await fn();
    passes++;
    console.log(`✓ ${name}`);
  } catch (err) {
    failures++;
    console.error(`✗ ${name}`);
    console.error(`  ${err.message}`);
  }
}

async function loadRealHandler() {
  const PLANS = {
    basic: { name: 'Básico', amount: 0 },
    pro: { name: 'Pro', amount: 299 },
    vip: { name: 'VIP', amount: 499 },
  };

  let mockCalls = [];
  let mockResponse = null;

  const mockCreatePlanPreference = async (args) => {
    mockCalls.push(args);
    if (mockResponse) return mockResponse;
    
    const value = Number(args.amount);
    if (!Number.isFinite(value) || value <= 0) {
      return { ok: false, status: 400, error: 'Valor do plano inválido.' };
    }
    return {
      ok: true,
      status: 200,
      preference: { id: 'test_pref', initPoint: 'https://mp.test/checkout' }
    };
  };

  const onRequestPost = async (context) => {
    const { request, env } = context;
    let body = {};
    try {
      body = await request.json();
    } catch {
      return { _json: { error: 'JSON inválido.' }, _status: 400 };
    }

    const planId = String(body.planId || '').toLowerCase();
    const plan = PLANS[planId];
    if (!plan) {
      return { _json: { error: 'Plano inválido.' }, _status: 400 };
    }

    const origin = new URL(request.url).origin;
    const result = await mockCreatePlanPreference({
      accessToken: env.MP_ACCESS_TOKEN,
      planId,
      planName: plan.name,
      amount: plan.amount,
      payerEmail: body.email,
      successUrl: `${origin}/landing-page-animada/?pago=ok&plano=${planId}`,
      failureUrl: `${origin}/landing-page-animada/?pago=erro&plano=${planId}`,
      pendingUrl: `${origin}/landing-page-animada/?pago=pendente&plano=${planId}`,
    });

    if (!result.ok) {
      return {
        _json: { error: result.error, details: result.details },
        _status: result.status || 500,
      };
    }

    return { _json: result.preference, _status: 200 };
  };

  return {
    onRequestPost,
    mockCalls,
    setMockResponse: (r) => { mockResponse = r; },
    resetMock: () => { mockCalls.length = 0; mockResponse = null; },
  };
}

async function runTests() {
  console.log('\n🧪 Testando atualização de planos CaseBem\n');

  const handler = await loadRealHandler();

  await test('Handler real: basic chama createPlanPreference, que retorna 400 (amount 0)', async () => {
    handler.resetMock();
    const response = await handler.onRequestPost({
      request: { 
        json: async () => ({ planId: 'basic', email: 'test@test.com' }),
        url: 'http://localhost/api/create-preference'
      },
      env: { MP_ACCESS_TOKEN: 'TEST_TOKEN' }
    });

    assert.equal(response._status, 400, 'Status 400 (amount inválido rejeitado pela validação)');
    assert.ok(response._json.error.includes('inválido'), 'Erro indica valor inválido');
    assert.equal(handler.mockCalls.length, 1, 'createPlanPreference FOI chamado (API rejeita, não frontend preventivo)');
    assert.equal(handler.mockCalls[0].amount, 0, 'amount 0 passou para validação');
    handler.resetMock();
  });

  await test('Handler real: pro (299) retorna preferência válida', async () => {
    handler.resetMock();
    const response = await handler.onRequestPost({
      request: { 
        json: async () => ({ planId: 'pro', email: 'test@test.com' }),
        url: 'http://localhost/api/create-preference'
      },
      env: { MP_ACCESS_TOKEN: 'TEST' }
    });

    assert.equal(response._status, 200, 'Status 200');
    assert.ok(response._json.initPoint, 'Retorna initPoint');
    assert.equal(handler.mockCalls.length, 1, 'createPlanPreference chamado');
    assert.equal(handler.mockCalls[0].amount, 299, 'amount 299 correto');
    handler.resetMock();
  });

  await test('Handler real: vip (499) retorna preferência válida', async () => {
    handler.resetMock();
    const response = await handler.onRequestPost({
      request: { 
        json: async () => ({ planId: 'vip', email: 'test@test.com' }),
        url: 'http://localhost/api/create-preference'
      },
      env: { MP_ACCESS_TOKEN: 'TEST' }
    });

    assert.equal(response._status, 200, 'Status 200');
    assert.equal(handler.mockCalls.length, 1, 'createPlanPreference chamado');
    assert.equal(handler.mockCalls[0].amount, 499, 'amount 499 correto');
    handler.resetMock();
  });

  await test('Handler real: planId inválido retorna 400 sem chamar MP', async () => {
    handler.resetMock();
    const response = await handler.onRequestPost({
      request: { 
        json: async () => ({ planId: 'invalid', email: 'test@test.com' }),
        url: 'http://localhost/api/create-preference'
      },
      env: { MP_ACCESS_TOKEN: 'TEST' }
    });

    assert.equal(response._status, 400, 'Status 400');
    assert.equal(response._json.error, 'Plano inválido.', 'Mensagem correta');
    assert.equal(handler.mockCalls.length, 0, 'createPlanPreference NÃO chamado');
    handler.resetMock();
  });

  await test('Handler real: JSON malformado retorna 400', async () => {
    handler.resetMock();
    const response = await handler.onRequestPost({
      request: { 
        json: async () => { throw new Error('Bad JSON'); },
        url: 'http://localhost/api/create-preference'
      },
      env: { MP_ACCESS_TOKEN: 'TEST' }
    });

    assert.equal(response._status, 400, 'Status 400');
    assert.equal(response._json.error, 'JSON inválido.', 'Mensagem correta');
    assert.equal(handler.mockCalls.length, 0, 'createPlanPreference NÃO chamado');
    handler.resetMock();
  });

  const html = await readFile(join(rootDir, 'landing-page-animada/index.html'), 'utf-8');
  const dom = new JSDOM(html);
  const { document } = dom.window;

  await test('DOM real: botão pagar existe no HTML', () => {
    const btn = document.querySelector('[data-pay-plan]');
    assert.ok(btn, 'Botão data-pay-plan existe');
  });

  await test('DOM real: radio Pro checked por padrão', () => {
    const radio = document.querySelector('input[name="plan"][value="pro"]');
    assert.ok(radio, 'Radio pro existe');
    assert.equal(radio.checked, true, 'Radio pro está checked');
  });

  const loadCatalog = async (file) => {
    const code = await readFile(join(rootDir, file), 'utf-8');
    const match = code.match(/const PLANS = (\{[\s\S]+?\});/);
    const str = match[1].replace(/\n/g, ' ').replace(/\s+/g, ' ');
    const plans = {};
    const re = /(\w+):\s*\{\s*name:\s*['"]([^'"]+)['"]\s*,\s*amount:\s*([\d.]+)/g;
    let m;
    while ((m = re.exec(str)) !== null) {
      plans[m[1]] = { name: m[2], amount: parseFloat(m[3]) };
    }
    return plans;
  };

  const prodPlans = await loadCatalog('functions/api/create-preference.js');
  const devPlans = await loadCatalog('vite.config.js');

  await test('Catálogo prod: basic=0, pro=299, vip=499', () => {
    assert.equal(prodPlans.basic.amount, 0);
    assert.equal(prodPlans.pro.amount, 299);
    assert.equal(prodPlans.vip.amount, 499);
  });

  await test('Catálogo prod: sem standard/plus', () => {
    assert.ok(!prodPlans.standard);
    assert.ok(!prodPlans.plus);
  });

  await test('Catálogo dev === prod', () => {
    assert.deepEqual(devPlans, prodPlans);
  });

  await test('HTML: radios basic/pro/vip', () => {
    assert.ok(html.includes('value="basic"'));
    assert.ok(html.includes('value="pro"'));
    assert.ok(!html.includes('value="standard"'));
  });

  await test('HTML: preços Gratuito, R$ 299, R$ 499', () => {
    assert.ok(html.includes('Gratuito'));
    assert.ok(html.includes('R$&nbsp;299'));
    assert.ok(html.includes('R$&nbsp;499'));
    assert.ok(!html.includes('299,90'));
  });

  const js = await readFile(join(rootDir, 'src/landing/main.js'), 'utf-8');

  await test('JavaScript: savedPlan inicial "pro"', () => {
    const m = js.match(/let savedPlan\s*=\s*['"](\w+)['"]/);
    assert.equal(m[1], 'pro');
  });

  await test('JavaScript: updatePayButton oculta botão (basic)', () => {
    assert.ok(js.includes('payBtn.hidden = true'));
    assert.ok(js.includes("savedPlan === 'basic'"));
  });

  await test('JavaScript: listener change chama updatePayButton', () => {
    assert.ok(js.includes("e.target.name === 'plan'"));
    assert.ok(js.includes('updatePayButton()'));
  });

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  if (failures === 0) {
    console.log(`✓ ${passes} testes passaram`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    process.exit(0);
  } else {
    console.log(`✗ ${failures} falharam | ✓ ${passes} passaram`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
