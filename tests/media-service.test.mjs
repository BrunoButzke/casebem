import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractYoutubeId,
  youtubeEmbedUrl,
  validateMediaCreate,
  createMediaItem,
  updateMediaItem,
  getActiveMedia,
} from '../functions/_lib/media-service.mjs';
import { onRequestGet as publicGet } from '../functions/api/media.js';

class MockStatement {
  constructor(db, sql) {
    this.db = db;
    this.sql = sql;
    this.args = [];
  }
  bind(...args) {
    this.args = args;
    return this;
  }
  async first() {
    if (/WHERE id = \?/.test(this.sql)) {
      return this.db.rows.find((r) => r.id === this.args[0]) || null;
    }
    return null;
  }
  async all() {
    let rows = [...this.db.rows];
    if (/WHERE active = 1/.test(this.sql)) rows = rows.filter((r) => r.active === 1);
    rows.sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
    return { results: rows };
  }
  async run() {
    if (/INSERT INTO media_playlist/.test(this.sql)) {
      const [id, title, youtube_url, sort_order, updated_at] = this.args;
      this.db.rows.push({ id, title, youtube_url, active: 1, sort_order, updated_at });
      return { success: true, meta: { changes: 1 } };
    }
    if (/UPDATE media_playlist/.test(this.sql)) {
      const [title, youtube_url, active, sort_order, updated_at, id] = this.args;
      const row = this.db.rows.find((r) => r.id === id);
      Object.assign(row, { title, youtube_url, active, sort_order, updated_at });
      return { success: true, meta: { changes: 1 } };
    }
    return { success: true, meta: { changes: 0 } };
  }
}

class MockDB {
  constructor(rows = []) {
    this.rows = rows;
  }
  prepare(sql) {
    return new MockStatement(this, sql);
  }
}

test('extractYoutubeId: watch, short, embed', () => {
  assert.equal(extractYoutubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(extractYoutubeId('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(extractYoutubeId('https://www.youtube.com/embed/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(extractYoutubeId('https://example.com/x'), null);
});

test('youtubeEmbedUrl usa nocookie', () => {
  assert.match(youtubeEmbedUrl('dQw4w9WgXcQ'), /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/);
});

test('validateMediaCreate rejeita URL inválida', () => {
  const r = validateMediaCreate({ title: 'X', youtubeUrl: 'https://vimeo.com/1' });
  assert.equal(r.valid, false);
});

test('create + update + getActiveMedia', async () => {
  const db = new MockDB([]);
  const created = await createMediaItem(db, {
    title: 'Nossa música',
    youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  });
  assert.ok(created.videoId);
  await updateMediaItem(db, created.id, { active: false });
  const active = await getActiveMedia(db);
  assert.equal(active.length, 0);
});

test('GET /api/media sem DB retorna lista vazia', async () => {
  const res = await publicGet({
    request: new Request('https://casebem.com/api/media'),
    env: {},
  });
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.deepEqual(data.items, []);
});
