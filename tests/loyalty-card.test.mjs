/**
 * Run: node --test tests/loyalty-card.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loyaltyCardCopy } from '../games/src/loyalty-card.js';

test('loyalty card copy matches admin preview layout', () => {
  const copy = loyaltyCardCopy(
    {
      name: 'TESTE',
      stampsRequired: 5,
      rewardText: '123',
      barHint: 'Mostre este cartão no bar',
      footerTemplate: 'Faltam {n} pontos para o próximo drink 🍸',
    },
    1
  );
  assert.equal(copy.bannerStrong, '🥂 1 123');
  assert.equal(copy.bannerHint, 'Mostre este cartão no bar');
  assert.equal(copy.footer, 'Faltam 4 pontos para o próximo drink 🍸');
  assert.equal(copy.slots, 5);
  assert.equal(copy.stamps, 1);
});

test('points card fills one bolinha per pointsPerSlot and {n} is points to finish', () => {
  const card = {
    name: 'TESTE',
    fillMode: 'points',
    stampsRequired: 4,
    pointsPerSlot: 10,
    rewardText: 'TESTE',
    barHint: 'Mostre este cartão no bar',
    footerTemplate: 'Faltam {n} pontos para o próximo drink 🍸',
  };
  const copy = loyaltyCardCopy(card, { points: 10, stamps: 99 });
  assert.equal(copy.stamps, 1);
  assert.equal(copy.footer, 'Faltam 30 pontos para o próximo drink 🍸');
  assert.equal(loyaltyCardCopy(card, { points: 25 }).stamps, 2);
  assert.equal(loyaltyCardCopy(card, { points: 40 }).stamps, 4);
  assert.equal(loyaltyCardCopy(card, { points: 40 }).footer, 'Faltam 0 pontos para o próximo drink 🍸');
});

test('loyalty card copy uses remaining stamps in footer, not bar hint as footer', () => {
  const copy = loyaltyCardCopy(
    {
      name: 'Drink fora do cardápio',
      stampsRequired: 6,
      rewardText: 'Acesso a um drink que não está no cardápio',
      barHint: 'Mostre este cartão no bar',
      footerTemplate: 'Algumas fotos valem selos',
    },
    0
  );
  assert.equal(copy.bannerStrong, '🥂 0 Acesso a um drink que não está no cardápio');
  assert.equal(copy.bannerHint, 'Mostre este cartão no bar');
  assert.equal(copy.footer, 'Algumas fotos valem selos');
});
