import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signup } from '../functions/_lib/auth-service.mjs';
import { PARTNER_ACCOUNT_ID } from '../functions/_lib/auth-service.mjs';
import { ensurePartnerAccount } from '../functions/_lib/partner-seed.mjs';
import {
  emptyCouplePage,
  getCouplePage,
  saveCouplePage,
  resetMemoryCouplePagesForTests,
} from '../functions/_lib/couple-page-service.mjs';

test('emptyCouplePage has no names or etapas', () => {
  const page = emptyCouplePage();
  assert.deepEqual(page.names, []);
  assert.deepEqual(page.etapas, []);
  assert.equal(page.story, '');
  assert.equal('accountId' in page, false);
});

test('saveCouplePage isolates accounts and validates etapas', async () => {
  resetMemoryCouplePagesForTests();
  const now = '2026-11-15T08:00:00.000Z';
  const a = await signup(null, { email: 'pg-a@x.com', password: 'segredo12', plan: 'basic' }, now);
  const b = await signup(null, { email: 'pg-b@x.com', password: 'segredo12', plan: 'basic' }, now);
  await saveCouplePage(null, a.accountId, {
    names: ['Ana', 'João'],
    dateLine: '1 de maio',
    etapas: [{ title: 'Cerimônia', detail: '10h' }],
  });
  const pageA = await getCouplePage(null, a.accountId);
  const pageB = await getCouplePage(null, b.accountId);
  assert.deepEqual(pageA.names, ['Ana', 'João']);
  assert.equal(pageA.etapas[0].title, 'Cerimônia');
  assert.deepEqual(pageB.names, []);
  await assert.rejects(
    () => saveCouplePage(null, a.accountId, { etapas: [{ title: '', detail: 'x' }] }),
    (err) => err.message === 'VALIDATION'
  );
});

test('partner getCouplePage fills Dani and Carine defaults without a row', async () => {
  resetMemoryCouplePagesForTests();
  await ensurePartnerAccount(null, {}, '2026-11-15T08:00:00.000Z');
  const page = await getCouplePage(null, PARTNER_ACCOUNT_ID);
  assert.deepEqual(page.names, ['Dani', 'Carine']);
  assert.equal(page.etapas.map((item) => item.title).join(','), 'Cerimônia,Brunch,Festa');
  assert.equal('accountId' in page, false);
});
