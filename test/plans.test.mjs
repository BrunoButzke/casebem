#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');

let failures = 0;
let passes = 0;

function test(name, fn) {
  return Promise.resolve(fn()).then(
    () => { passes++; console.log(`✓ ${name}`); },
    (err) => { failures++; console.error(`✗ ${name}\n  ${err.message}`); }
  );
}

globalThis.__testMockCalls = [];
globalThis.__testCreatePlanPreference = async (args) => {
  globalThis.__testMockCalls.push(args);
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

const makeRequest = (body) => ({
  json: async () => body,
  url: 'http://localhost:5174/api/create-preference'
});

async function runTests() {
  console.log('\n🧪 Testes de planos CaseBem\n');

  const { onRequestPost } = await import('../functions/api/create-preference.js');

  await test('Handler real: basic (0) chama createPlanPreference → 400', async () => {
    globalThis.__testMockCalls = [];
    const res = await onRequestPost({
      request: makeRequest({ planId: 'basic', email: 'test@test.com' }),
      env: { MP_ACCESS_TOKEN: 'TEST' }
    });
    assert.equal(res._status || res.status, 400);
    assert.equal(globalThis.__testMockCalls.length, 1);
    assert.equal(globalThis.__testMockCalls[0].amount, 0);
  });

  await test('Handler real: pro (299) → preferência válida', async () => {
    globalThis.__testMockCalls = [];
    const res = await onRequestPost({
      request: makeRequest({ planId: 'pro', email: 'test@test.com' }),
      env: { MP_ACCESS_TOKEN: 'TEST' }
    });
    assert.equal(res._status || res.status, 200);
    assert.equal(globalThis.__testMockCalls[0].amount, 299);
  });

  await test('Handler real: vip (499) → preferência válida', async () => {
    globalThis.__testMockCalls = [];
    const res = await onRequestPost({
      request: makeRequest({ planId: 'vip', email: 'test@test.com' }),
      env: { MP_ACCESS_TOKEN: 'TEST' }
    });
    assert.equal(res._status || res.status, 200);
    assert.equal(globalThis.__testMockCalls[0].amount, 499);
  });

  await test('Handler real: planId inválido → 400 sem chamar MP', async () => {
    globalThis.__testMockCalls = [];
    const res = await onRequestPost({
      request: makeRequest({ planId: 'invalid', email: 'test@test.com' }),
      env: { MP_ACCESS_TOKEN: 'TEST' }
    });
    assert.equal(res._status || res.status, 400);
    assert.equal(globalThis.__testMockCalls.length, 0);
  });

  await test('Handler real: JSON inválido → 400', async () => {
    globalThis.__testMockCalls = [];
    const res = await onRequestPost({
      request: { json: async () => { throw new Error('Bad'); }, url: 'http://test' },
      env: { MP_ACCESS_TOKEN: 'TEST' }
    });
    assert.equal(res._status || res.status, 400);
  });

  const parseCatalog = async (file) => {
    const code = await readFile(join(rootDir, file), 'utf-8');
    const m = code.match(/const PLANS = (\{[\s\S]+?\});/);
    const str = m[1].replace(/\n/g, ' ');
    const plans = {};
    const re = /(\w+):\s*\{\s*name:\s*['"]([^'"]+)['"]\s*,\s*amount:\s*([\d.]+)/g;
    let match;
    while ((match = re.exec(str)) !== null) {
      plans[match[1]] = { name: match[2], amount: parseFloat(match[3]) };
    }
    return plans;
  };

  const prod = await parseCatalog('functions/api/create-preference.js');
  const dev = await parseCatalog('vite.config.js');

  await test('Catálogo: basic=0, pro=299, vip=499', () => {
    assert.equal(prod.basic.amount, 0);
    assert.equal(prod.pro.amount, 299);
    assert.equal(prod.vip.amount, 499);
  });

  await test('Catálogo: dev === prod', () => {
    assert.deepEqual(dev, prod);
  });

  const html = await readFile(join(rootDir, 'landing-page-animada/index.html'), 'utf-8');

  await test('HTML estrutural: radio pro checked', () => {
    const m = html.match(/<input[^>]*name="plan"[^>]*value="pro"[^>]*>/);
    assert.ok(m && m[0].includes('checked'));
  });

  await test('HTML estrutural: preços atualizados', () => {
    assert.ok(html.includes('Gratuito'));
    assert.ok(html.includes('R$&nbsp;299'));
    assert.ok(!html.includes('299,90'));
  });

  const js = await readFile(join(rootDir, 'src/landing/main.js'), 'utf-8');

  await test('JS: savedPlan inicial "pro"', () => {
    assert.ok(js.match(/let savedPlan\s*=\s*['"]pro['"]/));
  });

  await test('JS: updatePayButton oculta botão', () => {
    assert.ok(js.includes('payBtn.hidden = true'));
    assert.ok(js.includes("savedPlan === 'basic'"));
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
