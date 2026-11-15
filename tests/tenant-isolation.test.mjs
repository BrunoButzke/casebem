import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addGuests, listGuestList, resetMemoryGuestsForTests } from '../functions/_lib/rsvp-guest-list.mjs';
import { createMessage, resetMemoryMessagesForTests } from '../functions/_lib/messages-service.mjs';
import { listMessagesAdmin } from '../functions/_lib/admin-service.mjs';
import { signup } from '../functions/_lib/auth-service.mjs';
import { MemoryAuthDb } from './helpers/memory-auth-db.mjs';
import {
  onRequestGet as guestListGet,
  onRequestPost as guestListPost,
  onRequestPatch as guestListPatch,
} from '../functions/api/admin/guest-list.js';
import { onRequestGet as rsvpsCsvGet } from '../functions/api/admin/rsvps.csv.js';
import { onRequestGet as lodgingGet } from '../functions/api/admin/lodging.js';
import { onRequestPost as lodgingPost } from '../functions/api/admin/lodging.js';
import { onRequestGet as mediaGet } from '../functions/api/admin/media.js';
import { onRequestPost as mediaPost } from '../functions/api/admin/media.js';

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

class CsvAuthDb extends MemoryAuthDb {
  constructor(rsvps = []) {
    super();
    this.rsvps = rsvps;
  }

  prepare(sql) {
    if (String(sql).includes('FROM rsvps')) {
      const self = this;
      return {
        params: [],
        bind(...params) {
          this.params = params;
          return this;
        },
        async all() {
          const accountId = this.params[0];
          const limit = this.params[1] ?? 500;
          const results = self.rsvps
            .filter((row) => row.account_id === accountId)
            .slice(0, limit);
          return { results };
        },
      };
    }
    return super.prepare(sql);
  }
}

test('account B CSV export does not include account A guest names', async () => {
  const now = new Date().toISOString();
  const db = new CsvAuthDb();
  const a = await signup(db, { email: 'csv-a@x.com', password: 'segredo12', plan: 'basic' }, now);
  const b = await signup(db, { email: 'csv-b@x.com', password: 'segredo12', plan: 'basic' }, now);
  db.rsvps = [
    {
      id: 'rsvp-a',
      guest_name: 'Alice Da Conta A',
      attending: 1,
      adults_count: 2,
      children_count: 0,
      observations: '',
      created_at: now,
      updated_at: now,
      account_id: a.accountId,
    },
    {
      id: 'rsvp-b',
      guest_name: 'Bruno Da Conta B',
      attending: 1,
      adults_count: 1,
      children_count: 0,
      observations: '',
      created_at: now,
      updated_at: now,
      account_id: b.accountId,
    },
  ];

  const res = await rsvpsCsvGet({
    request: new Request('http://localhost/api/admin/rsvps.csv', {
      headers: { origin: 'http://localhost:5173', cookie: `cb_session=${b.sessionId}` },
    }),
    env: { DB: db },
  });
  assert.equal(res.status, 200);
  const csv = await res.text();
  assert.match(csv, /Bruno Da Conta B/);
  assert.doesNotMatch(csv, /Alice Da Conta A/);
  assert.match(res.headers.get('content-disposition') || '', /filename="rsvps\.csv"/);
});

test('non-partner lodging and media admin writes return 403 FORBIDDEN', async () => {
  const now = new Date().toISOString();
  const account = await signup(
    null,
    { email: `lodging-${Date.now()}@x.com`, password: 'segredo12', plan: 'pro' },
    now
  );
  const cookie = `cb_session=${account.sessionId}`;
  const getCtx = (url) => ({
    request: new Request(url, {
      headers: { origin: 'http://localhost:5173', cookie },
    }),
    env: { DB: null },
  });
  const postCtx = (url) => ({
    request: new Request(url, {
      method: 'POST',
      headers: {
        origin: 'http://localhost:5173',
        'content-type': 'application/json',
        cookie,
      },
      body: JSON.stringify({ name: 'Hotel', description: 'Perto da festa' }),
    }),
    env: { DB: null },
  });

  const lodging = await lodgingGet(getCtx('http://localhost/api/admin/lodging'));
  assert.equal(lodging.status, 403);
  assert.equal((await lodging.json()).error, 'FORBIDDEN');

  const lodgingWrite = await lodgingPost(postCtx('http://localhost/api/admin/lodging'));
  assert.equal(lodgingWrite.status, 403);
  assert.equal((await lodgingWrite.json()).error, 'FORBIDDEN');

  const media = await mediaGet(getCtx('http://localhost/api/admin/media'));
  assert.equal(media.status, 403);
  assert.equal((await media.json()).error, 'FORBIDDEN');

  const mediaWrite = await mediaPost({
    request: new Request('http://localhost/api/admin/media', {
      method: 'POST',
      headers: {
        origin: 'http://localhost:5173',
        'content-type': 'application/json',
        cookie,
      },
      body: JSON.stringify({ title: 'Vídeo', youtubeUrl: 'https://youtu.be/abc' }),
    }),
    env: { DB: null },
  });
  assert.equal(mediaWrite.status, 403);
  assert.equal((await mediaWrite.json()).error, 'FORBIDDEN');
});
