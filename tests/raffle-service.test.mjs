/**
 * Run: node --test tests/raffle-service.test.mjs
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  resetMemoryRafflesForTests,
  createRaffle,
  listRafflesAdmin,
  updateRaffle,
  deleteRaffle,
  getActiveRafflePublic,
  availableNumbers,
} from '../functions/_lib/raffle-service.mjs';

const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

beforeEach(() => resetMemoryRafflesForTests());

test('create and list raffle in memory', async () => {
  const raffle = await createRaffle(null, {
    name: 'Cesta de vinhos',
    imageData: TINY_PNG,
    totalNumbers: 50,
    priceCents: 1000,
  });
  assert.equal(raffle.name, 'Cesta de vinhos');
  assert.equal(raffle.totalNumbers, 50);
  assert.equal(raffle.priceCents, 1000);
  assert.equal(raffle.active, false);
  assert.equal((await listRafflesAdmin(null)).length, 1);
});

test('activating one raffle deactivates the others', async () => {
  const a = await createRaffle(null, {
    name: 'Rifa A',
    totalNumbers: 10,
    priceCents: 500,
    active: true,
  });
  const b = await createRaffle(null, {
    name: 'Rifa B',
    totalNumbers: 20,
    priceCents: 800,
    active: true,
  });
  const list = await listRafflesAdmin(null);
  assert.equal(list.find((r) => r.id === a.id).active, false);
  assert.equal(list.find((r) => r.id === b.id).active, true);

  await updateRaffle(null, a.id, { active: true });
  const after = await listRafflesAdmin(null);
  assert.equal(after.find((r) => r.id === a.id).active, true);
  assert.equal(after.find((r) => r.id === b.id).active, false);
});

test('public active raffle exposes soldNumbers empty and derived available', async () => {
  await createRaffle(null, {
    name: 'Prêmio',
    imageData: TINY_PNG,
    totalNumbers: 5,
    priceCents: 1500,
    active: true,
  });
  const pub = await getActiveRafflePublic(null);
  assert.equal(pub.name, 'Prêmio');
  assert.deepEqual(pub.soldNumbers, []);
  assert.deepEqual(pub.availableNumbers, [1, 2, 3, 4, 5]);
  assert.equal(pub.imageUrl, TINY_PNG);
});

test('availableNumbers subtracts sold set', () => {
  assert.deepEqual(availableNumbers(5, [2, 5]), [1, 3, 4]);
});

test('delete raffle', async () => {
  const raffle = await createRaffle(null, {
    name: 'Apagar',
    totalNumbers: 3,
    priceCents: 200,
  });
  await deleteRaffle(null, raffle.id);
  assert.equal((await listRafflesAdmin(null)).length, 0);
  assert.equal(await getActiveRafflePublic(null), null);
});

test('validation rejects bad totals and price', async () => {
  await assert.rejects(
    () => createRaffle(null, { name: 'X', totalNumbers: 0, priceCents: 100 }),
    (err) => err.message === 'VALIDATION'
  );
  await assert.rejects(
    () => createRaffle(null, { name: 'Ok nome', totalNumbers: 10, priceCents: 50 }),
    (err) => err.message === 'VALIDATION'
  );
});
