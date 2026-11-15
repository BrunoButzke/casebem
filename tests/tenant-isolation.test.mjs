import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addGuests, listGuestList, resetMemoryGuestsForTests } from '../functions/_lib/rsvp-guest-list.mjs';
import { createMessage, resetMemoryMessagesForTests } from '../functions/_lib/messages-service.mjs';
import { listMessagesAdmin } from '../functions/_lib/admin-service.mjs';
import { signup } from '../functions/_lib/auth-service.mjs';
import {
  onRequestGet as guestListGet,
  onRequestPost as guestListPost,
  onRequestPatch as guestListPatch,
} from '../functions/api/admin/guest-list.js';

const TEST_SECRET = Buffer.from('a'.repeat(32)).toString('base64');

function guestListCtx(url, { method = 'GET', body, cookie } = {}) {
  const headers = { origin: 'http://localhost:5173' };
  if (cookie) headers.cookie = cookie;
  if (body) headers['content-type'] = 'application/json';
  return {
    request: new Request(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    }),
    env: { DB: null },
  };
}

test('guest list is per accountId', async () => {
  resetMemoryGuestsForTests();
  await addGuests(null, ['Ana Silva'], { groupId: null, accountId: 'acc-a' });
  const b = await listGuestList(null, 'acc-b');
  assert.equal(b.length, 0);
  const a = await listGuestList(null, 'acc-a');
  assert.equal(a.some((g) => g.displayName === 'Ana Silva'), true);
});

test('messages mural is per accountId', async () => {
  resetMemoryMessagesForTests();
  await createMessage(
    null,
    {
      guestName: 'Joao',
      message: 'Parabens aos noivos!',
      consentGiven: true,
    },
    null,
    TEST_SECRET,
    'acc-a'
  );
  const b = await listMessagesAdmin(null, 'acc-b');
  assert.equal(b.length, 0);
  const a = await listMessagesAdmin(null, 'acc-a');
  assert.equal(a.some((m) => m.guestName === 'Joao'), true);
});

test('guest-list handler POST as A is empty for B', async () => {
  resetMemoryGuestsForTests();
  const now = new Date().toISOString();
  const accountA = await signup(
    null,
    { email: 'lista-iso-a@x.com', password: 'segredo12', plan: 'basic' },
    now
  );
  const accountB = await signup(
    null,
    { email: 'lista-iso-b@x.com', password: 'segredo12', plan: 'basic' },
    now
  );

  const posted = await guestListPost(
    guestListCtx('http://localhost/api/admin/guest-list', {
      method: 'POST',
      cookie: `cb_session=${accountA.sessionId}`,
      body: { names: ['Ana Silva'], wedding_key: 'dani-carine' },
    })
  );
  assert.equal(posted.status, 200);

  const listedB = await guestListGet(
    guestListCtx('http://localhost/api/admin/guest-list', {
      cookie: `cb_session=${accountB.sessionId}`,
    })
  );
  assert.equal(listedB.status, 200);
  const bodyB = await listedB.json();
  assert.equal(bodyB.guests.length, 0);

  const patched = await guestListPatch(
    guestListCtx('http://localhost/api/admin/guest-list', {
      method: 'PATCH',
      cookie: `cb_session=${accountB.sessionId}`,
      body: { wedding_key: 'dani-carine', rsvpMode: 'open' },
    })
  );
  assert.equal(patched.status, 200);

  const listedA = await guestListGet(
    guestListCtx('http://localhost/api/admin/guest-list', {
      cookie: `cb_session=${accountA.sessionId}`,
    })
  );
  const bodyA = await listedA.json();
  assert.equal(bodyA.guests.some((g) => g.displayName === 'Ana Silva'), true);
});

test('admin guest-list uses session account not body wedding_key', async () => {
  resetMemoryGuestsForTests();
  const now = new Date().toISOString();
  const a = await signup(null, { email: 'ga@x.com', password: 'segredo12', plan: 'basic' }, now);
  const b = await signup(null, { email: 'gb@x.com', password: 'segredo12', plan: 'basic' }, now);

  const posted = await guestListPost(
    guestListCtx('http://localhost/api/admin/guest-list', {
      method: 'POST',
      cookie: `cb_session=${a.sessionId}`,
      body: { names: ['Ana Silva'], wedding_key: 'dani-carine' },
    })
  );
  assert.equal(posted.status, 200);

  const listedB = await guestListGet(
    guestListCtx('http://localhost/api/admin/guest-list', {
      cookie: `cb_session=${b.sessionId}`,
    })
  );
  assert.equal(listedB.status, 200);
  const bodyB = await listedB.json();
  assert.equal(bodyB.guests.length, 0);
});
