/**
 * Hospedagem / dicas — serviço D1 + validação
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  slugifyLodgingId,
  validateLodgingCreate,
  validateLodgingPatch,
  getActiveLodging,
  seedLodgingIfEmpty,
  createLodgingTip,
  updateLodgingTip,
  listLodgingAdmin,
} from '../functions/_lib/lodging-service.mjs';
import { LODGING_TIPS } from '../data/lodging-tips.mjs';
import { onRequestGet as publicGet } from '../functions/api/lodging.js';

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
    if (/COUNT\(\*\)/.test(this.sql)) {
      return { c: this.db.rows.length };
    }
    if (/SELECT id FROM lodging_tips WHERE id/.test(this.sql)) {
      const id = this.args[0];
      return this.db.rows.find((r) => r.id === id) || null;
    }
    if (/SELECT id, name, description/.test(this.sql) && /WHERE id/.test(this.sql)) {
      const id = this.args[0];
      return this.db.rows.find((r) => r.id === id) || null;
    }
    return null;
  }
  async all() {
    let rows = [...this.db.rows];
    if (/WHERE active = 1/.test(this.sql)) {
      rows = rows.filter((r) => r.active === 1);
    }
    rows.sort((a, b) => (a.sort_order - b.sort_order) || a.id.localeCompare(b.id));
    return { results: rows };
  }
  async run() {
    if (/INSERT INTO lodging_tips/.test(this.sql)) {
      const [
        id,
        name,
        description,
        area,
        maps_url,
        website_url,
        sort_order,
        updated_at,
      ] = this.args;
      // INSERT binds: id, name, description, area, maps, web, sort, now — active is literal 1
      // Check SQL for seed vs create — both use active=1 literal
      this.db.rows.push({
        id,
        name,
        description,
        area,
        maps_url,
        website_url,
        active: 1,
        sort_order,
        updated_at,
      });
      return { success: true, meta: { changes: 1 } };
    }
    if (/UPDATE lodging_tips/.test(this.sql)) {
      const [
        name,
        description,
        area,
        maps_url,
        website_url,
        active,
        sort_order,
        updated_at,
        id,
      ] = this.args;
      const row = this.db.rows.find((r) => r.id === id);
      if (!row) return { success: true, meta: { changes: 0 } };
      Object.assign(row, {
        name,
        description,
        area,
        maps_url,
        website_url,
        active,
        sort_order,
        updated_at,
      });
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

test('slugifyLodgingId normaliza acentos', () => {
  assert.equal(slugifyLodgingId('Pousada São José'), 'pousada-sao-jose');
});

test('validateLodgingCreate rejeita name curto', () => {
  const r = validateLodgingCreate({ name: 'A', description: 'Dica válida aqui' });
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => /name/.test(e)));
});

test('validateLodgingCreate aceita payload mínimo', () => {
  const r = validateLodgingCreate({
    name: 'Hotel Teste',
    description: 'Perto do local da festa',
  });
  assert.equal(r.valid, true);
  assert.equal(r.data.name, 'Hotel Teste');
});

test('validateLodgingPatch rejeita mapsUrl sem https', () => {
  const r = validateLodgingPatch({ mapsUrl: 'ftp://x' });
  assert.equal(r.valid, false);
});

test('getActiveLodging sem DB usa seed estático', async () => {
  const tips = await getActiveLodging(null);
  assert.ok(tips.length >= LODGING_TIPS.length);
  assert.equal(tips[0].id, LODGING_TIPS[0].id);
});

test('seedLodgingIfEmpty popula tabela vazia', async () => {
  const db = new MockDB([]);
  const r = await seedLodgingIfEmpty(db);
  assert.equal(r.seeded, true);
  assert.equal(db.rows.length, LODGING_TIPS.length);
});

test('createLodgingTip + updateLodgingTip', async () => {
  const db = new MockDB([
    {
      id: 'seed',
      name: 'Seed',
      description: 'Já existe',
      area: '',
      maps_url: '',
      website_url: '',
      active: 1,
      sort_order: 0,
      updated_at: '2026-01-01T00:00:00.000Z',
    },
  ]);
  const created = await createLodgingTip(db, {
    name: 'Nova Pousada',
    description: 'Ótima opção perto da Lagoa',
    area: 'Lagoa',
    mapsUrl: 'https://maps.google.com/?q=pousada',
  });
  assert.equal(created.name, 'Nova Pousada');
  assert.match(created.id, /^nova-pousada/);

  const updated = await updateLodgingTip(db, created.id, { active: false });
  assert.equal(updated.active, false);

  const admin = await listLodgingAdmin(db);
  assert.ok(admin.some((t) => t.id === created.id && t.active === false));
});

test('GET /api/lodging retorna tips sem DB', async () => {
  const res = await publicGet({ request: new Request('https://casebem.com/api/lodging'), env: {} });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.ok(Array.isArray(data.tips));
  assert.ok(data.tips.length > 0);
  assert.ok(data.tips[0].name);
});
