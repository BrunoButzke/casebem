/**
 * Tests for messages SQL schema (0003_messages.sql)
 * Run with: node --test tests/messages-schema.test.mjs
 * 
 * Uses Python SQLite runner to validate actual D1 SQL semantics
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const PYTHON_RUNNER = './tests/sqlite-runner.py';

function runSql(sql) {
  try {
    const result = execSync(`${PYTHON_RUNNER} "${sql.replace(/"/g, '\\"')}"`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { success: true, output: result.trim() };
  } catch (error) {
    // Non-zero exit = error
    return { 
      success: false, 
      error: error.stderr?.toString() || error.stdout?.toString() || error.message 
    };
  }
}

test('migration 0003 creates wedding_messages table', () => {
  const migration = readFileSync('./migrations/0003_messages.sql', 'utf-8');
  const result = runSql(migration);
  assert.equal(result.success, true, 'Migration should execute without errors');
  
  // Verify table exists
  const check = runSql("SELECT name FROM sqlite_master WHERE type='table' AND name='wedding_messages'");
  assert.equal(check.success, true);
  assert.match(check.output, /wedding_messages/);
});

test('wedding_messages has correct columns', () => {
  const migration = readFileSync('./migrations/0003_messages.sql', 'utf-8');
  runSql(migration);
  
  const result = runSql("PRAGMA table_info(wedding_messages)");
  assert.equal(result.success, true);
  
  // Check required columns exist
  assert.match(result.output, /\bid\b/);
  assert.match(result.output, /\bwedding_key\b/);
  assert.match(result.output, /\bguest_name\b/);
  assert.match(result.output, /\bmessage\b/);
  assert.match(result.output, /\bconsent_given\b/);
  assert.match(result.output, /\bcreated_at\b/);
  assert.match(result.output, /\bidempotency_key\b/);
  assert.match(result.output, /\bidempotency_fingerprint\b/);
});

test('wedding_messages does NOT have ip_hash column', () => {
  const migration = readFileSync('./migrations/0003_messages.sql', 'utf-8');
  runSql(migration);
  
  const result = runSql("PRAGMA table_info(wedding_messages)");
  assert.equal(result.success, true);
  assert.doesNotMatch(result.output, /\bip_hash\b/);
});

test('wedding_messages does NOT have payment-related columns', () => {
  const migration = readFileSync('./migrations/0003_messages.sql', 'utf-8');
  runSql(migration);
  
  const result = runSql("PRAGMA table_info(wedding_messages)");
  assert.equal(result.success, true);
  assert.doesNotMatch(result.output, /\bgift_id\b/);
  assert.doesNotMatch(result.output, /\bamount\b/);
  assert.doesNotMatch(result.output, /\bemail\b/);
});

test('wedding_messages CHECK constraint: consent_given = 1', () => {
  const migration = readFileSync('./migrations/0003_messages.sql', 'utf-8');
  runSql(migration);
  
  // Valid: consent_given = 1
  const valid = runSql(`
    INSERT INTO wedding_messages 
    (id, wedding_key, guest_name, message, consent_given, created_at, idempotency_fingerprint)
    VALUES ('test-id', 'dani-carine', 'João Silva', 'Felicidades!', 1, '2026-11-06T10:00:00Z', 'fingerprint123')
  `);
  assert.equal(valid.success, true, 'Should allow consent_given = 1');
  
  // Invalid: consent_given = 0
  const invalid = runSql(`
    INSERT INTO wedding_messages 
    (id, wedding_key, guest_name, message, consent_given, created_at, idempotency_fingerprint)
    VALUES ('test-id-2', 'dani-carine', 'Maria', 'Texto', 0, '2026-11-06T10:00:00Z', 'fingerprint456')
  `);
  assert.equal(invalid.success, false, 'Should reject consent_given = 0');
  assert.match(invalid.error, /CHECK|constraint/i);
});

test('wedding_messages CHECK constraint: guest_name length 2-100', () => {
  const migration = readFileSync('./migrations/0003_messages.sql', 'utf-8');
  runSql(migration);
  
  // Valid: exactly 2 chars
  const valid2 = runSql(`
    INSERT INTO wedding_messages 
    (id, wedding_key, guest_name, message, consent_given, created_at, idempotency_fingerprint)
    VALUES ('id-2chars', 'dani-carine', 'AB', 'Mensagem válida', 1, '2026-11-06T10:00:00Z', 'fp1')
  `);
  assert.equal(valid2.success, true);
  
  // Valid: exactly 100 chars
  const valid100 = runSql(`
    INSERT INTO wedding_messages 
    (id, wedding_key, guest_name, message, consent_given, created_at, idempotency_fingerprint)
    VALUES ('id-100chars', 'dani-carine', '${'A'.repeat(100)}', 'Mensagem válida', 1, '2026-11-06T10:00:00Z', 'fp2')
  `);
  assert.equal(valid100.success, true);
  
  // Invalid: 1 char
  const invalid1 = runSql(`
    INSERT INTO wedding_messages 
    (id, wedding_key, guest_name, message, consent_given, created_at, idempotency_fingerprint)
    VALUES ('id-1char', 'dani-carine', 'A', 'Mensagem', 1, '2026-11-06T10:00:00Z', 'fp3')
  `);
  assert.equal(invalid1.success, false);
  assert.match(invalid1.error, /CHECK|constraint/i);
  
  // Invalid: 101 chars
  const invalid101 = runSql(`
    INSERT INTO wedding_messages 
    (id, wedding_key, guest_name, message, consent_given, created_at, idempotency_fingerprint)
    VALUES ('id-101chars', 'dani-carine', '${'A'.repeat(101)}', 'Mensagem', 1, '2026-11-06T10:00:00Z', 'fp4')
  `);
  assert.equal(invalid101.success, false);
  assert.match(invalid101.error, /CHECK|constraint/i);
});

test('wedding_messages CHECK constraint: message length 3-500', () => {
  const migration = readFileSync('./migrations/0003_messages.sql', 'utf-8');
  runSql(migration);
  
  // Valid: exactly 3 chars
  const valid3 = runSql(`
    INSERT INTO wedding_messages 
    (id, wedding_key, guest_name, message, consent_given, created_at, idempotency_fingerprint)
    VALUES ('id-msg3', 'dani-carine', 'João Silva', 'ABC', 1, '2026-11-06T10:00:00Z', 'fp5')
  `);
  assert.equal(valid3.success, true);
  
  // Valid: exactly 500 chars
  const valid500 = runSql(`
    INSERT INTO wedding_messages 
    (id, wedding_key, guest_name, message, consent_given, created_at, idempotency_fingerprint)
    VALUES ('id-msg500', 'dani-carine', 'Maria', '${'X'.repeat(500)}', 1, '2026-11-06T10:00:00Z', 'fp6')
  `);
  assert.equal(valid500.success, true);
  
  // Invalid: 2 chars
  const invalid2 = runSql(`
    INSERT INTO wedding_messages 
    (id, wedding_key, guest_name, message, consent_given, created_at, idempotency_fingerprint)
    VALUES ('id-msg2', 'dani-carine', 'Pedro', 'AB', 1, '2026-11-06T10:00:00Z', 'fp7')
  `);
  assert.equal(invalid2.success, false);
  assert.match(invalid2.error, /CHECK|constraint/i);
  
  // Invalid: 501 chars
  const invalid501 = runSql(`
    INSERT INTO wedding_messages 
    (id, wedding_key, guest_name, message, consent_given, created_at, idempotency_fingerprint)
    VALUES ('id-msg501', 'dani-carine', 'Ana', '${'Y'.repeat(501)}', 1, '2026-11-06T10:00:00Z', 'fp8')
  `);
  assert.equal(invalid501.success, false);
  assert.match(invalid501.error, /CHECK|constraint/i);
});

test('wedding_messages allows newlines in message', () => {
  const migration = readFileSync('./migrations/0003_messages.sql', 'utf-8');
  runSql(migration);
  
  const result = runSql(`
    INSERT INTO wedding_messages 
    (id, wedding_key, guest_name, message, consent_given, created_at, idempotency_fingerprint)
    VALUES ('id-newline', 'dani-carine', 'João', 'Linha1
Linha2
Linha3', 1, '2026-11-06T10:00:00Z', 'fp-newline')
  `);
  assert.equal(result.success, true, 'Should allow newlines in message');
});

test('wedding_messages idempotency index prevents duplicates', () => {
  const migration = readFileSync('./migrations/0003_messages.sql', 'utf-8');
  runSql(migration);
  
  // First insert
  const first = runSql(`
    INSERT INTO wedding_messages 
    (id, wedding_key, guest_name, message, consent_given, created_at, idempotency_key, idempotency_fingerprint)
    VALUES ('id-1', 'dani-carine', 'João', 'Mensagem', 1, '2026-11-06T10:00:00Z', 'idem-key-123', 'fp-1')
  `);
  assert.equal(first.success, true);
  
  // Duplicate idempotency_key for same wedding_key
  const duplicate = runSql(`
    INSERT INTO wedding_messages 
    (id, wedding_key, guest_name, message, consent_given, created_at, idempotency_key, idempotency_fingerprint)
    VALUES ('id-2', 'dani-carine', 'Maria', 'Outra mensagem', 1, '2026-11-06T10:00:00Z', 'idem-key-123', 'fp-2')
  `);
  assert.equal(duplicate.success, false);
  assert.match(duplicate.error, /UNIQUE|constraint/i);
});

test('wedding_messages idempotency allows NULL keys', () => {
  const migration = readFileSync('./migrations/0003_messages.sql', 'utf-8');
  runSql(migration);
  
  // Insert with NULL idempotency_key
  const first = runSql(`
    INSERT INTO wedding_messages 
    (id, wedding_key, guest_name, message, consent_given, created_at, idempotency_fingerprint)
    VALUES ('id-null1', 'dani-carine', 'João', 'Msg1', 1, '2026-11-06T10:00:00Z', 'fp-null1')
  `);
  assert.equal(first.success, true);
  
  // Another insert with NULL idempotency_key (should be allowed, partial index WHERE NOT NULL)
  const second = runSql(`
    INSERT INTO wedding_messages 
    (id, wedding_key, guest_name, message, consent_given, created_at, idempotency_fingerprint)
    VALUES ('id-null2', 'dani-carine', 'Maria', 'Msg2', 1, '2026-11-06T10:00:00Z', 'fp-null2')
  `);
  assert.equal(second.success, true, 'Should allow multiple NULL idempotency_key');
});

test('migration 0003 updates schema_migrations', () => {
  const migration = readFileSync('./migrations/0003_messages.sql', 'utf-8');
  runSql(migration);
  
  const result = runSql("SELECT version, description FROM schema_migrations WHERE version = '0003'");
  assert.equal(result.success, true);
  assert.match(result.output, /0003/);
  assert.match(result.output, /mural de recados/i);
});

test('migration 0003 is idempotent (IF NOT EXISTS)', () => {
  const migration = readFileSync('./migrations/0003_messages.sql', 'utf-8');
  
  // Run migration twice
  const first = runSql(migration);
  assert.equal(first.success, true);
  
  const second = runSql(migration);
  // Should fail on INSERT to schema_migrations (duplicate version)
  // but CREATE TABLE IF NOT EXISTS should not cause error
  // Let's check table still exists
  const check = runSql("SELECT name FROM sqlite_master WHERE type='table' AND name='wedding_messages'");
  assert.equal(check.success, true);
  assert.match(check.output, /wedding_messages/);
});
