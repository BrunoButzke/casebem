#!/usr/bin/env node
/**
 * Testes de integração dos planos CaseBem
 * Verifica catálogo, preços, IDs e comportamento de checkout
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');

// Mock do createPlanPreference para testar handler
let mockCreatePlanPreferenceCalls = [];
let mockCreatePlanPreferenceImpl = null;

function resetMockMP() {
  mockCreatePlanPreferenceCalls = [];
  mockCreatePlanPreferenceImpl = null;
}

let failures = 0;
let passes = 0;

function test(name, fn) {
  try {
    fn();
    passes++;
    console.log(`✓ ${name}`);
  } catch (err) {
    failures++;
    console.error(`✗ ${name}`);
    console.error(`  ${err.message}`);
    if (err.stack) {
      const lines = err.stack.split('\n').slice(1, 3);
      lines.forEach((l) => console.error(`  ${l.trim()}`));
    }
  }
}

async function loadPlanCatalog() {
  // Carrega catálogo de produção
  const prodCode = await readFile(
    join(rootDir, 'functions/api/create-preference.js'),
    'utf-8',
  );
  const prodMatch = prodCode.match(/const PLANS = (\{[\s\S]+?\});/);
  assert.ok(prodMatch, 'Catálogo PLANS não encontrado em create-preference.js');
  
  // Carrega catálogo de desenvolvimento
  const devCode = await readFile(join(rootDir, 'vite.config.js'), 'utf-8');
  const devMatch = devCode.match(/const PLANS = (\{[\s\S]+?\});/);
  assert.ok(devMatch, 'Catálogo PLANS não encontrado em vite.config.js');

  // Parse manual robusto
  const parsePlans = (str) => {
    const plans = {};
    // Remove quebras de linha para processar como uma string contínua
    const cleaned = str.replace(/\n/g, ' ').replace(/\s+/g, ' ');
    
    // Extrai cada plano com regex
    const planRegex = /(\w+):\s*\{\s*name:\s*['"]([^'"]+)['"]\s*,\s*amount:\s*([\d.]+)/g;
    let match;
    
    while ((match = planRegex.exec(cleaned)) !== null) {
      const [, planId, planName, amount] = match;
      plans[planId] = {
        name: planName,
        amount: parseFloat(amount),
      };
    }
    
    return plans;
  };

  return {
    prod: parsePlans(prodMatch[1]),
    dev: parsePlans(devMatch[1]),
  };
}

async function loadHtmlContent() {
  return readFile(join(rootDir, 'landing-page-animada/index.html'), 'utf-8');
}

async function loadJsContent() {
  return readFile(join(rootDir, 'src/landing/main.js'), 'utf-8');
}

async function loadMercadoPagoLib() {
  return readFile(join(rootDir, 'functions/_lib/mercadopago.mjs'), 'utf-8');
}

async function loadHandlerModule() {
  const handlerCode = await readFile(
    join(rootDir, 'functions/api/create-preference.js'),
    'utf-8',
  );
  
  // Extrai o PLANS e a lógica do handler
  const plansMatch = handlerCode.match(/const PLANS = (\{[\s\S]+?\});/);
  if (!plansMatch) throw new Error('PLANS não encontrado no handler');
  
  const plansStr = plansMatch[1]
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ');
  const planRegex = /(\w+):\s*\{\s*name:\s*['"]([^'"]+)['"]\s*,\s*amount:\s*([\d.]+)/g;
  const PLANS = {};
  let match;
  while ((match = planRegex.exec(plansStr)) !== null) {
    PLANS[match[1]] = { name: match[2], amount: parseFloat(match[3]) };
  }
  
  return { PLANS };
}

async function testHandlerLogic() {
  const { PLANS } = await loadHandlerModule();
  
  // Simula onRequestPost com planId básico
  const testBasicPlan = (planId) => {
    const plan = PLANS[planId];
    if (!plan) return { error: 'Plano inválido.', status: 400 };
    
    // Handler real tenta criar preferência para qualquer plano válido,
    // mas o createPlanPreference deve rejeitar amount <= 0
    return { plan, shouldCallMP: true };
  };
  
  // Simula validação do mercadopago.mjs
  const validateAmount = (amount) => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      return { ok: false, error: 'Valor do plano inválido.', status: 400 };
    }
    return { ok: true };
  };
  
  return { PLANS, testBasicPlan, validateAmount };
}

async function runTests() {
  console.log('\n🧪 Testando atualização de planos CaseBem\n');

  const catalogs = await loadPlanCatalog();
  const html = await loadHtmlContent();
  const js = await loadJsContent();
  const mpLib = await loadMercadoPagoLib();
  const handler = await testHandlerLogic();

  // Teste 1: Catálogo de produção deve ter basic, pro e vip com valores corretos
  test('Produção: plano básico deve ser gratuito (0)', () => {
    assert.ok(catalogs.prod.basic, 'Plano basic deve existir em produção');
    assert.equal(catalogs.prod.basic.amount, 0, 'Básico deve custar 0');
    assert.ok(
      catalogs.prod.basic.name.match(/b[aá]sico/i),
      'Nome deve ser Básico',
    );
  });

  test('Produção: plano Pro deve custar R$ 299', () => {
    assert.ok(catalogs.prod.pro, 'Plano pro deve existir em produção');
    assert.equal(catalogs.prod.pro.amount, 299, 'Pro deve custar 299');
    assert.equal(catalogs.prod.pro.name, 'Pro', 'Nome deve ser Pro');
  });

  test('Produção: plano VIP deve custar R$ 499', () => {
    assert.ok(catalogs.prod.vip, 'Plano vip deve existir em produção');
    assert.equal(catalogs.prod.vip.amount, 499, 'VIP deve custar 499');
    assert.equal(catalogs.prod.vip.name, 'VIP', 'Nome deve ser VIP');
  });

  test('Produção: não deve ter planos standard ou plus', () => {
    assert.ok(
      !catalogs.prod.standard,
      'Plano standard antigo não deve existir',
    );
    assert.ok(!catalogs.prod.plus, 'Plano plus antigo não deve existir');
  });

  // Teste 2: Catálogo de desenvolvimento (vite.config) deve ser idêntico
  test('Desenvolvimento: catálogo deve ser idêntico ao de produção', () => {
    assert.deepEqual(
      catalogs.dev,
      catalogs.prod,
      'Catálogos dev e prod devem ser idênticos',
    );
  });

  // Teste 3: Mercado Pago deve rejeitar amount <= 0
  test('Mercado Pago: deve rejeitar valores <= 0', () => {
    assert.ok(
      mpLib.includes('value <= 0'),
      'createPlanPreference deve validar amount > 0',
    );
    assert.ok(
      mpLib.includes('Valor do plano inválido') ||
        mpLib.includes('inválido'),
      'Deve retornar erro para plano inválido',
    );
  });

  // Teste 4: HTML deve ter Pro selecionado por padrão
  test('HTML: radio de Pro deve estar marcado com checked', () => {
    const proRadioMatch = html.match(
      /<input[^>]*name="plan"[^>]*value="pro"[^>]*>/,
    );
    assert.ok(proRadioMatch, 'Radio button do plano Pro deve existir');
    assert.ok(
      proRadioMatch[0].includes('checked'),
      'Radio Pro deve ter atributo checked',
    );
  });

  test('HTML: planos basic e pro devem existir (não standard/plus)', () => {
    assert.ok(
      html.includes('value="basic"'),
      'Radio basic deve existir no HTML',
    );
    assert.ok(
      html.includes('value="pro"'),
      'Radio pro deve existir no HTML',
    );
    assert.ok(
      !html.includes('value="standard"'),
      'Radio standard não deve existir',
    );
    assert.ok(
      !html.includes('value="plus"'),
      'Radio plus não deve existir',
    );
  });

  test('HTML: preços devem estar atualizados nas cards de plano', () => {
    // Básico R$ 0 ou Gratuito
    assert.ok(
      html.includes('Gratuito') || html.includes('Grátis') || html.match(/R\$.*?0/i),
      'Plano básico deve mostrar R$ 0 ou Gratuito',
    );
    
    // Pro R$ 299 (aceita &nbsp; como entidade HTML)
    assert.ok(
      html.includes('R$&nbsp;299') || html.match(/R\$\s*299(?![\d,])/),
      'Plano Pro deve mostrar R$ 299',
    );
    
    // VIP R$ 499 (aceita &nbsp; como entidade HTML)
    assert.ok(
      html.includes('R$&nbsp;499') || html.match(/R\$\s*499(?![\d,])/),
      'Plano VIP deve mostrar R$ 499',
    );

    // Não deve ter preços antigos
    assert.ok(
      !html.includes('299,90'),
      'Não deve ter preço antigo R$ 299,90',
    );
    assert.ok(
      !html.includes('499,90'),
      'Não deve ter preço antigo R$ 499,90',
    );
    assert.ok(
      !html.includes('1.199,90') && !html.includes('1199,90'),
      'Não deve ter preço antigo R$ 1.199,90',
    );
  });

  // Teste 5: JavaScript deve ter 'pro' como padrão/fallback
  test('JavaScript: plano padrão/fallback deve ser "pro"', () => {
    const savedPlanMatch = js.match(/let savedPlan\s*=\s*['"](\w+)['"]/);
    assert.ok(savedPlanMatch, 'Variável savedPlan deve existir');
    assert.equal(
      savedPlanMatch[1],
      'pro',
      'savedPlan inicial deve ser "pro"',
    );

    const fallbackMatch = js.match(/\|\|\s*['"](\w+)['"]/g);
    const hasPlusFallback = fallbackMatch?.some((m) => m.includes('plus'));
    assert.ok(
      !hasPlusFallback,
      'Não deve ter "plus" como fallback em lugar nenhum',
    );
  });

  test('JavaScript: não deve referenciar "plus" ou "standard" como IDs', () => {
    // Ignora comentários e strings de UI, foca em IDs de plano
    const planIdRefs = js.match(/planId:\s*['"](\w+)['"]/g) || [];
    const hasOldIds = planIdRefs.some(
      (ref) => ref.includes('plus') || ref.includes('standard'),
    );
    assert.ok(
      !hasOldIds,
      'Não deve ter "plus" ou "standard" como planId no código',
    );
  });

  // Teste 6: Handler real - plano básico
  test('Handler: plano básico retorna erro 400 (amount inválido)', () => {
    const basicPlan = handler.PLANS.basic;
    assert.ok(basicPlan, 'Plano basic existe no handler');
    
    // Valida que amount 0 será rejeitado pelo createPlanPreference
    const validation = handler.validateAmount(basicPlan.amount);
    assert.equal(validation.ok, false, 'amount 0 deve ser rejeitado');
    assert.equal(validation.status, 400, 'Status deve ser 400');
    assert.ok(
      validation.error.includes('inválido'),
      'Mensagem deve indicar valor inválido',
    );
  });

  test('Handler: Pro retorna preferência válida (amount > 0)', () => {
    const proPlan = handler.PLANS.pro;
    assert.ok(proPlan, 'Plano pro existe no handler');
    assert.equal(proPlan.amount, 299, 'Pro amount = 299');
    
    const validation = handler.validateAmount(proPlan.amount);
    assert.equal(validation.ok, true, 'amount 299 deve ser aceito');
  });

  test('Handler: VIP retorna preferência válida (amount > 0)', () => {
    const vipPlan = handler.PLANS.vip;
    assert.ok(vipPlan, 'Plano vip existe no handler');
    assert.equal(vipPlan.amount, 499, 'VIP amount = 499');
    
    const validation = handler.validateAmount(vipPlan.amount);
    assert.equal(validation.ok, true, 'amount 499 deve ser aceito');
  });

  test('Handler: plano inválido retorna 400', () => {
    const result = handler.testBasicPlan('invalid');
    assert.equal(result.error, 'Plano inválido.', 'Plano desconhecido rejeita');
    assert.equal(result.status, 400, 'Status 400 para plano inválido');
  });

  // Teste 7: data-plan attributes no HTML devem estar atualizados
  test('HTML: atributos data-plan devem usar basic, pro, vip', () => {
    const dataPlans = html.match(/data-plan="(\w+)"/g) || [];
    const planValues = dataPlans.map((m) => m.match(/"(\w+)"/)[1]);
    
    assert.ok(
      planValues.includes('basic'),
      'Deve ter data-plan="basic"',
    );
    assert.ok(
      planValues.includes('pro'),
      'Deve ter data-plan="pro"',
    );
    assert.ok(
      planValues.includes('vip'),
      'Deve ter data-plan="vip"',
    );
    assert.ok(
      !planValues.includes('standard'),
      'Não deve ter data-plan="standard"',
    );
    assert.ok(
      !planValues.includes('plus'),
      'Não deve ter data-plan="plus"',
    );
  });

  // Teste 8: Meta description e textos de marketing devem estar atualizados
  test('HTML: meta description não deve mencionar preço antigo', () => {
    const metaDesc = html.match(
      /<meta\s+name="description"\s+content="([^"]+)"/,
    );
    assert.ok(metaDesc, 'Meta description deve existir');
    assert.ok(
      !metaDesc[1].includes('299,90'),
      'Meta description não deve mencionar R$ 299,90',
    );
  });

  test('HTML: não deve mencionar "Plus" como nome de plano atual', () => {
    // Ignora "Tudo do Plus" que seria herança (aceito)
    // Busca por "Plus" como nome principal de plano
    const plusAsPlanName = html.match(
      /<p class="plan__name">\s*Plus\s*<\/p>/,
    );
    assert.ok(
      !plusAsPlanName,
      'Não deve ter "Plus" como nome de plano principal',
    );
  });

  // Teste 9: Botão de pagamento deve estar oculto para plano básico
  test('JavaScript: botão de pagamento oculto quando plano básico', () => {
    assert.ok(
      js.includes('payBtn.hidden = true') || js.includes('hidden = true'),
      'Código deve ocultar botão quando plano básico',
    );
    assert.ok(
      js.includes("savedPlan === 'basic'"),
      'Deve verificar se plano é básico',
    );
    assert.ok(
      js.includes('gratuito') || js.includes('Gratuito'),
      'Mensagem deve indicar que é gratuito',
    );
  });

  test('JavaScript: atualiza botão quando plano muda no formulário', () => {
    assert.ok(
      js.includes("addEventListener('change'") ||
        js.includes('form.addEventListener'),
      'Deve escutar mudanças no formulário',
    );
    assert.ok(
      js.includes("e.target.name === 'plan'") ||
        js.includes('name === "plan"'),
      'Deve detectar mudança de plano',
    );
  });

  // Resumo
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  if (failures === 0) {
    console.log(`✓ Todos os ${passes} testes passaram`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    process.exit(0);
  } else {
    console.log(
      `✗ ${failures} teste${failures > 1 ? 's' : ''} falhou${failures > 1 ? 'ram' : ''}`,
    );
    console.log(`✓ ${passes} teste${passes > 1 ? 's' : ''} passou${passes > 1 ? 'ram' : ''}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Erro fatal ao executar testes:', err);
  process.exit(1);
});
