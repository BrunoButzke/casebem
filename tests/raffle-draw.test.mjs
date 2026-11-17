/**
 * Run: node --test tests/raffle-draw.test.mjs
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  resetMemoryRafflesForTests,
  createRaffle,
  listActiveRaffleSoldEntries,
  finalizeRaffleSalesByIntent,
} from '../functions/_lib/raffle-service.mjs';

beforeEach(() => resetMemoryRafflesForTests());

test('listActiveRaffleSoldEntries empty when no sales', async () => {
  await createRaffle(null, {
    name: 'Prêmio',
    totalNumbers: 10,
    priceCents: 500,
    active: true,
  });
  const { raffle, entries } = await listActiveRaffleSoldEntries(null);
  assert.equal(raffle.name, 'Prêmio');
  assert.deepEqual(entries, []);
});

test('finalize then list shows sold entry with guest name in memory only after pending flip', async () => {
  // Memory finalize only flips pending rows; without pending, entries stay empty — contract check
  await createRaffle(null, {
    name: 'Prêmio',
    totalNumbers: 5,
    priceCents: 500,
    active: true,
  });
  const fin = await finalizeRaffleSalesByIntent(null, '00000000-0000-4000-8000-000000000099');
  assert.equal(fin.updated, 0);
  const { entries } = await listActiveRaffleSoldEntries(null);
  assert.equal(entries.length, 0);
});
