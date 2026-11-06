/**
 * Papelaria — placeholders, seed, API pública
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fillStationeryPlaceholders,
  whatsappShareUrl,
  STATIONERY_TEMPLATES,
} from '../data/stationery-templates.mjs';
import {
  presentStationery,
  validateStationeryPatch,
  seedStationeryIfEmpty,
  getActiveStationery,
  updateStationeryTemplate,
} from '../functions/_lib/stationery-service.mjs';
import { onRequestGet as publicGet } from '../functions/api/stationery.js';

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
    if (/COUNT\(\*\)/.test(this.sql)) return { c: this.db.rows.length };
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
    if (/INSERT INTO stationery_templates/.test(this.sql)) {
      const [id, title, body, kind, sort_order, updated_at] = this.args;
      this.db.rows.push({
        id,
        title,
        body,
        kind,
        active: 1,
        sort_order,
        updated_at,
      });
      return { success: true, meta: { changes: 1 } };
    }
    if (/UPDATE stationery_templates/.test(this.sql)) {
      const [title, body, kind, active, sort_order, updated_at, id] = this.args;
      const row = this.db.rows.find((r) => r.id === id);
      if (!row) return { success: true, meta: { changes: 0 } };
      Object.assign(row, { title, body, kind, active, sort_order, updated_at });
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

test('fillStationeryPlaceholders substitui vars', () => {
  const out = fillStationeryPlaceholders('Oi {{names}} em {{date}}', {
    names: 'Dani & Carine',
    date: '21/11',
  });
  assert.equal(out, 'Oi Dani & Carine em 21/11');
});

test('whatsappShareUrl codifica texto', () => {
  const url = whatsappShareUrl('Olá mundo');
  assert.match(url, /^https:\/\/wa\.me\/\?text=/);
  assert.match(url, /Ol%C3%A1/);
});

test('presentStationery gera shareUrl', () => {
  const [first] = presentStationery(STATIONERY_TEMPLATES.slice(0, 1), 'https://casebem.com');
  assert.match(first.text, /Dani & Carine/);
  assert.match(first.text, /https:\/\/casebem\.com\/dani-carine\//);
  assert.match(first.shareUrl, /^https:\/\/wa\.me\/\?text=/);
});

test('validateStationeryPatch rejeita body curto', () => {
  const r = validateStationeryPatch({ body: 'x' });
  assert.equal(r.valid, false);
});

test('seed + update stationery', async () => {
  const db = new MockDB([]);
  const seeded = await seedStationeryIfEmpty(db);
  assert.equal(seeded.seeded, true);
  assert.equal(db.rows.length, STATIONERY_TEMPLATES.length);

  const updated = await updateStationeryTemplate(db, 'convite', {
    title: 'Convite atualizado',
    active: true,
  });
  assert.equal(updated.title, 'Convite atualizado');

  const active = await getActiveStationery(db);
  assert.ok(active.some((t) => t.id === 'convite'));
});

test('GET /api/stationery sem DB', async () => {
  const res = await publicGet({
    request: new Request('https://casebem.com/api/stationery'),
    env: {},
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.ok(data.templates.length >= 2);
  assert.ok(data.templates[0].shareUrl);
});
