/**
 * Tests for cart domain logic
 * Run with: node --test tests/cart-domain.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CartStorage,
  validateCartItem,
  validateCartItems,
} from '../src/dani-carine/cart-storage.mjs';

test('CartStorage inicializa vazio quando storage vazio', () => {
  const mockStorage = new Map();
  const cart = new CartStorage({
    getItem: (key) => mockStorage.get(key) || null,
    setItem: (key, val) => mockStorage.set(key, val),
    removeItem: (key) => mockStorage.delete(key),
  });

  const items = cart.getItems();
  assert.deepEqual(items, []);
  assert.equal(cart.getCount(), 0);
});

test('CartStorage recupera carrinho salvo', () => {
  const mockStorage = new Map([
    ['casebem_cart', JSON.stringify({ items: [
      { giftId: 'danca', quantity: 2 }
    ]})]
  ]);

  const cart = new CartStorage({
    getItem: (key) => mockStorage.get(key) || null,
    setItem: (key, val) => mockStorage.set(key, val),
    removeItem: (key) => mockStorage.delete(key),
  });

  const items = cart.getItems();
  assert.equal(items.length, 1);
  assert.equal(items[0].giftId, 'danca');
  assert.equal(items[0].quantity, 2);
  assert.equal(cart.getCount(), 2);
});

test('CartStorage adiciona novo item', () => {
  const mockStorage = new Map();
  const cart = new CartStorage({
    getItem: (key) => mockStorage.get(key) || null,
    setItem: (key, val) => mockStorage.set(key, val),
    removeItem: (key) => mockStorage.delete(key),
  });

  cart.addItem('danca', 1);
  
  const items = cart.getItems();
  assert.equal(items.length, 1);
  assert.equal(items[0].giftId, 'danca');
  assert.equal(items[0].quantity, 1);
});

test('CartStorage incrementa quantidade de item existente', () => {
  const mockStorage = new Map();
  const cart = new CartStorage({
    getItem: (key) => mockStorage.get(key) || null,
    setItem: (key, val) => mockStorage.set(key, val),
    removeItem: (key) => mockStorage.delete(key),
  });

  cart.addItem('danca', 1);
  cart.addItem('danca', 2);
  
  const items = cart.getItems();
  assert.equal(items.length, 1);
  assert.equal(items[0].quantity, 3);
});

test('CartStorage limita quantidade máxima em 99', () => {
  const mockStorage = new Map();
  const cart = new CartStorage({
    getItem: (key) => mockStorage.get(key) || null,
    setItem: (key, val) => mockStorage.set(key, val),
    removeItem: (key) => mockStorage.delete(key),
  });

  cart.addItem('danca', 98);
  cart.addItem('danca', 5); // Tentará adicionar 5, mas deve limitar a 99
  
  const items = cart.getItems();
  assert.equal(items[0].quantity, 99);
});

test('CartStorage atualiza quantidade', () => {
  const mockStorage = new Map();
  const cart = new CartStorage({
    getItem: (key) => mockStorage.get(key) || null,
    setItem: (key, val) => mockStorage.set(key, val),
    removeItem: (key) => mockStorage.delete(key),
  });

  cart.addItem('danca', 1);
  cart.updateQuantity('danca', 5);
  
  const items = cart.getItems();
  assert.equal(items[0].quantity, 5);
});

test('CartStorage remove item ao atualizar quantidade para 0', () => {
  const mockStorage = new Map();
  const cart = new CartStorage({
    getItem: (key) => mockStorage.get(key) || null,
    setItem: (key, val) => mockStorage.set(key, val),
    removeItem: (key) => mockStorage.delete(key),
  });

  cart.addItem('danca', 3);
  cart.updateQuantity('danca', 0);
  
  const items = cart.getItems();
  assert.equal(items.length, 0);
});

test('CartStorage remove item', () => {
  const mockStorage = new Map();
  const cart = new CartStorage({
    getItem: (key) => mockStorage.get(key) || null,
    setItem: (key, val) => mockStorage.set(key, val),
    removeItem: (key) => mockStorage.delete(key),
  });

  cart.addItem('danca', 2);
  cart.addItem('spa', 1);
  cart.removeItem('danca');
  
  const items = cart.getItems();
  assert.equal(items.length, 1);
  assert.equal(items[0].giftId, 'spa');
});

test('CartStorage limpa carrinho', () => {
  const mockStorage = new Map();
  const cart = new CartStorage({
    getItem: (key) => mockStorage.get(key) || null,
    setItem: (key, val) => mockStorage.set(key, val),
    removeItem: (key) => mockStorage.delete(key),
  });

  cart.addItem('danca', 2);
  cart.addItem('spa', 1);
  cart.clear();
  
  const items = cart.getItems();
  assert.equal(items.length, 0);
  assert.equal(cart.getCount(), 0);
});

test('CartStorage getCount retorna soma de quantidades', () => {
  const mockStorage = new Map();
  const cart = new CartStorage({
    getItem: (key) => mockStorage.get(key) || null,
    setItem: (key, val) => mockStorage.set(key, val),
    removeItem: (key) => mockStorage.delete(key),
  });

  cart.addItem('danca', 2);
  cart.addItem('spa', 3);
  cart.addItem('hotel', 1);
  
  assert.equal(cart.getCount(), 6);
});

test('CartStorage fallback quando storage denied', () => {
  const cart = new CartStorage({
    getItem: () => { throw new Error('SecurityError'); },
    setItem: () => { throw new Error('SecurityError'); },
    removeItem: () => { throw new Error('SecurityError'); },
  });

  // Não deve lançar erro
  cart.addItem('danca', 1);
  
  // Funciona em memória
  const items = cart.getItems();
  assert.equal(items.length, 1);
  assert.equal(items[0].giftId, 'danca');
});

test('CartStorage fallback quando storage retorna JSON inválido', () => {
  const mockStorage = new Map([
    ['casebem_cart', 'invalid json {']
  ]);

  const cart = new CartStorage({
    getItem: (key) => mockStorage.get(key) || null,
    setItem: (key, val) => mockStorage.set(key, val),
    removeItem: (key) => mockStorage.delete(key),
  });

  // Não deve lançar erro, deve inicializar vazio
  const items = cart.getItems();
  assert.deepEqual(items, []);
});

test('CartStorage fallback quando storage retorna estrutura inválida', () => {
  const mockStorage = new Map([
    ['casebem_cart', JSON.stringify({ wrong: 'structure' })]
  ]);

  const cart = new CartStorage({
    getItem: (key) => mockStorage.get(key) || null,
    setItem: (key, val) => mockStorage.set(key, val),
    removeItem: (key) => mockStorage.delete(key),
  });

  const items = cart.getItems();
  assert.deepEqual(items, []);
});

test('validateCartItem aceita item válido', () => {
  const result = validateCartItem({ giftId: 'danca', quantity: 1 });
  assert.equal(result.valid, true);
});

test('validateCartItem rejeita giftId vazio', () => {
  const result = validateCartItem({ giftId: '', quantity: 1 });
  assert.equal(result.valid, false);
  assert.match(result.error, /giftId/i);
});

test('validateCartItem rejeita quantidade zero', () => {
  const result = validateCartItem({ giftId: 'danca', quantity: 0 });
  assert.equal(result.valid, false);
  assert.match(result.error, /quantidade/i);
});

test('validateCartItem rejeita quantidade negativa', () => {
  const result = validateCartItem({ giftId: 'danca', quantity: -1 });
  assert.equal(result.valid, false);
  assert.match(result.error, /quantidade/i);
});

test('validateCartItem rejeita quantidade maior que 99', () => {
  const result = validateCartItem({ giftId: 'danca', quantity: 100 });
  assert.equal(result.valid, false);
  assert.match(result.error, /quantidade/i);
});

test('validateCartItem rejeita quantidade não-inteira', () => {
  const result = validateCartItem({ giftId: 'danca', quantity: 1.5 });
  assert.equal(result.valid, false);
  assert.match(result.error, /inteiro/i);
});

test('validateCartItem rejeita quantidade infinita', () => {
  const result = validateCartItem({ giftId: 'danca', quantity: Infinity });
  assert.equal(result.valid, false);
  assert.match(result.error, /quantidade/i);
});

test('validateCartItems aceita array vazio', () => {
  const result = validateCartItems([]);
  assert.equal(result.valid, false);
  assert.match(result.error, /vazio/i);
});

test('validateCartItems aceita items válidos', () => {
  const items = [
    { giftId: 'danca', quantity: 2 },
    { giftId: 'spa', quantity: 1 },
  ];
  const result = validateCartItems(items);
  assert.equal(result.valid, true);
});

test('validateCartItems rejeita se algum item inválido', () => {
  const items = [
    { giftId: 'danca', quantity: 2 },
    { giftId: 'spa', quantity: 0 }, // Inválido
  ];
  const result = validateCartItems(items);
  assert.equal(result.valid, false);
  assert.ok(result.error);
});

test('validateCartItems rejeita quantidade total maior que 999', () => {
  const items = [
    { giftId: 'danca', quantity: 99 },
    { giftId: 'spa', quantity: 99 },
    { giftId: 'hotel', quantity: 99 },
    { giftId: 'lua', quantity: 99 },
    { giftId: 'jantar', quantity: 99 },
    { giftId: 'adega', quantity: 99 },
    { giftId: 'brunch', quantity: 99 },
    { giftId: 'churrasco', quantity: 99 },
    { giftId: 'mensagem', quantity: 99 },
    { giftId: 'custom1', quantity: 99 },  // Total: 990
    { giftId: 'custom2', quantity: 10 },   // Total: 1000 (> 999)
  ];
  const result = validateCartItems(items);
  assert.equal(result.valid, false);
  assert.match(result.error, /muitos/i);
});
