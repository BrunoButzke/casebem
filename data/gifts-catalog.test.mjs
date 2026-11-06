/**
 * Tests for gifts catalog (data layer)
 * Run with: node --test data/gifts-catalog.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GIFTS_CATALOG, getGiftById, calculateTotal } from './gifts-catalog.mjs';

test('Catálogo tem 9 presentes', () => {
  assert.equal(GIFTS_CATALOG.length, 9);
});

test('Todos presentes têm ID único', () => {
  const ids = GIFTS_CATALOG.map(g => g.id);
  const uniqueIds = new Set(ids);
  assert.equal(ids.length, uniqueIds.size);
});

test('Todos presentes têm IDs válidos (string não-vazia)', () => {
  GIFTS_CATALOG.forEach(gift => {
    assert.ok(typeof gift.id === 'string');
    assert.ok(gift.id.length > 0);
  });
});

test('Todos presentes têm nome (string não-vazia)', () => {
  GIFTS_CATALOG.forEach(gift => {
    assert.ok(typeof gift.name === 'string');
    assert.ok(gift.name.length > 0);
  });
});

test('Todos presentes têm descrição (string não-vazia)', () => {
  GIFTS_CATALOG.forEach(gift => {
    assert.ok(typeof gift.description === 'string');
    assert.ok(gift.description.length > 0);
  });
});

test('Todos preços são inteiros positivos em centavos', () => {
  GIFTS_CATALOG.forEach(gift => {
    assert.ok(Number.isInteger(gift.priceInCents));
    assert.ok(gift.priceInCents > 0);
    assert.ok(gift.priceInCents < 1000000); // Menos de R$ 10.000
  });
});

test('Todos presentes têm imageUrl válida', () => {
  GIFTS_CATALOG.forEach(gift => {
    assert.ok(typeof gift.imageUrl === 'string');
    assert.ok(gift.imageUrl.startsWith('/images/gifts/'));
    assert.ok(gift.imageUrl.endsWith('.jpg'));
  });
});

test('Mode é fixed ou custom', () => {
  GIFTS_CATALOG.forEach(gift => {
    assert.ok(gift.mode === 'fixed' || gift.mode === 'custom');
  });
});

test('Presente custom tem preço mínimo 99 centavos', () => {
  const customGift = GIFTS_CATALOG.find(g => g.mode === 'custom');
  assert.ok(customGift);
  assert.equal(customGift.priceInCents, 99);
});

test('getGiftById retorna presente existente', () => {
  const gift = getGiftById('danca');
  assert.ok(gift);
  assert.equal(gift.id, 'danca');
  assert.equal(gift.name, 'Aula de dança');
  assert.equal(gift.priceInCents, 15000);
});

test('getGiftById retorna null para ID inexistente', () => {
  const gift = getGiftById('inexistente');
  assert.equal(gift, null);
});

test('calculateTotal com um item', () => {
  const items = [
    { giftId: 'danca', quantity: 1 }
  ];
  const total = calculateTotal(items);
  assert.equal(total, 15000);
});

test('calculateTotal com múltiplos itens diferentes', () => {
  const items = [
    { giftId: 'danca', quantity: 1 },    // 15000
    { giftId: 'spa', quantity: 1 },      // 30000
  ];
  const total = calculateTotal(items);
  assert.equal(total, 45000);
});

test('calculateTotal com quantidade maior que 1', () => {
  const items = [
    { giftId: 'danca', quantity: 3 }  // 15000 * 3 = 45000
  ];
  const total = calculateTotal(items);
  assert.equal(total, 45000);
});

test('calculateTotal com carrinho vazio', () => {
  const total = calculateTotal([]);
  assert.equal(total, 0);
});

test('calculateTotal ignora itens com giftId inexistente', () => {
  const items = [
    { giftId: 'danca', quantity: 1 },
    { giftId: 'inexistente', quantity: 10 },
  ];
  const total = calculateTotal(items);
  assert.equal(total, 15000);
});

test('calculateTotal ignora itens com quantidade inválida', () => {
  const items = [
    { giftId: 'danca', quantity: 1 },
    { giftId: 'spa', quantity: 0 },      // Inválido
    { giftId: 'hotel', quantity: -1 },   // Inválido
    { giftId: 'lua', quantity: null },   // Inválido
  ];
  const total = calculateTotal(items);
  assert.equal(total, 15000);
});

test('calculateTotal com quantidade máxima (99)', () => {
  const items = [
    { giftId: 'mensagem', quantity: 99 }  // 99 * 99 = 9801
  ];
  const total = calculateTotal(items);
  assert.equal(total, 9801);
});
