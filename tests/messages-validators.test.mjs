/**
 * Tests for messages validators
 * Run with: node --test tests/messages-validators.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  WEDDING_KEY,
  LIMITS,
  validateGuestName,
  validateMessage,
  validateConsent,
  validateIdempotencyKey,
  validateMessageCreate,
  normalizeMessage,
} from '../functions/_lib/messages-validators.mjs';

test('WEDDING_KEY is dani-carine', () => {
  assert.equal(WEDDING_KEY, 'dani-carine');
});

test('LIMITS are defined correctly', () => {
  assert.equal(LIMITS.NAME_MIN, 2);
  assert.equal(LIMITS.NAME_MAX, 100);
  assert.equal(LIMITS.MESSAGE_MIN, 3);
  assert.equal(LIMITS.MESSAGE_MAX, 500);
  assert.equal(LIMITS.IDEMPOTENCY_KEY_MAX, 128);
  assert.equal(LIMITS.BODY_SIZE_MAX, 8192);
});

// Guest Name Validation
test('validateGuestName accepts valid name', () => {
  const result = validateGuestName('João Silva');
  assert.equal(result.valid, true);
  assert.equal(result.value, 'João Silva');
});

test('validateGuestName trims and collapses spaces', () => {
  const result = validateGuestName('  Maria   Santos  ');
  assert.equal(result.valid, true);
  assert.equal(result.value, 'Maria Santos');
});

test('validateGuestName rejects empty name', () => {
  const result = validateGuestName('');
  assert.equal(result.valid, false);
  assert.match(result.error, /obrigatório/i);
});

test('validateGuestName rejects name too short', () => {
  const result = validateGuestName('A');
  assert.equal(result.valid, false);
  assert.match(result.error, /2-100/);
});

test('validateGuestName rejects name too long', () => {
  const result = validateGuestName('A'.repeat(101));
  assert.equal(result.valid, false);
  assert.match(result.error, /2-100/);
});

test('validateGuestName accepts exactly 2 chars', () => {
  const result = validateGuestName('AB');
  assert.equal(result.valid, true);
  assert.equal(result.value, 'AB');
});

test('validateGuestName accepts exactly 100 chars', () => {
  const result = validateGuestName('A'.repeat(100));
  assert.equal(result.valid, true);
  assert.equal(result.value, 'A'.repeat(100));
});

test('validateGuestName rejects non-string', () => {
  const result = validateGuestName(123);
  assert.equal(result.valid, false);
});

// Message Validation
test('normalizeMessage converts CRLF to LF', () => {
  const result = normalizeMessage('Line1\r\nLine2\r\nLine3');
  assert.equal(result, 'Line1\nLine2\nLine3');
});

test('normalizeMessage preserves LF', () => {
  const result = normalizeMessage('Line1\nLine2');
  assert.equal(result, 'Line1\nLine2');
});

test('normalizeMessage handles mixed whitespace', () => {
  const result = normalizeMessage('Line1\r\n\nLine2');
  assert.equal(result, 'Line1\n\nLine2');
});

test('validateMessage accepts valid message', () => {
  const result = validateMessage('Felicidades ao casal!');
  assert.equal(result.valid, true);
  assert.equal(result.value, 'Felicidades ao casal!');
});

test('validateMessage accepts message with newlines', () => {
  const result = validateMessage('Primeira linha\nSegunda linha');
  assert.equal(result.valid, true);
  assert.equal(result.value, 'Primeira linha\nSegunda linha');
});

test('validateMessage normalizes CRLF to LF', () => {
  const result = validateMessage('Linha1\r\nLinha2');
  assert.equal(result.valid, true);
  assert.equal(result.value, 'Linha1\nLinha2');
});

test('validateMessage rejects empty message', () => {
  const result = validateMessage('');
  assert.equal(result.valid, false);
  assert.match(result.error, /obrigatório/i);
});

test('validateMessage rejects message too short', () => {
  const result = validateMessage('OK');
  assert.equal(result.valid, false);
  assert.match(result.error, /3-500/);
});

test('validateMessage rejects message too long', () => {
  const result = validateMessage('A'.repeat(501));
  assert.equal(result.valid, false);
  assert.match(result.error, /3-500/);
});

test('validateMessage accepts exactly 3 chars', () => {
  const result = validateMessage('ABC');
  assert.equal(result.valid, true);
  assert.equal(result.value, 'ABC');
});

test('validateMessage accepts exactly 500 chars', () => {
  const result = validateMessage('A'.repeat(500));
  assert.equal(result.valid, true);
  assert.equal(result.value, 'A'.repeat(500));
});

test('validateMessage rejects non-string', () => {
  const result = validateMessage(123);
  assert.equal(result.valid, false);
});

// Consent Validation
test('validateConsent accepts true', () => {
  const result = validateConsent(true);
  assert.equal(result.valid, true);
  assert.equal(result.value, true);
});

test('validateConsent rejects false', () => {
  const result = validateConsent(false);
  assert.equal(result.valid, false);
  assert.match(result.error, /obrigatório/i);
});

test('validateConsent rejects null', () => {
  const result = validateConsent(null);
  assert.equal(result.valid, false);
});

test('validateConsent rejects string "true"', () => {
  const result = validateConsent('true');
  assert.equal(result.valid, false);
});

test('validateConsent rejects 1', () => {
  const result = validateConsent(1);
  assert.equal(result.valid, false);
});

// Idempotency Key Validation
test('validateIdempotencyKey accepts valid UUID', () => {
  const result = validateIdempotencyKey('550e8400-e29b-41d4-a716-446655440000');
  assert.equal(result.valid, true);
  assert.equal(result.value, '550e8400-e29b-41d4-a716-446655440000');
});

test('validateIdempotencyKey accepts alphanumeric with hyphens', () => {
  const result = validateIdempotencyKey('abc-123_XYZ');
  assert.equal(result.valid, true);
  assert.equal(result.value, 'abc-123_XYZ');
});

test('validateIdempotencyKey rejects special characters', () => {
  const result = validateIdempotencyKey('key-with-@special');
  assert.equal(result.valid, false);
  assert.match(result.error, /letras, números, hífens e underscores/);
});

test('validateIdempotencyKey rejects too long key', () => {
  const result = validateIdempotencyKey('a'.repeat(129));
  assert.equal(result.valid, false);
  assert.match(result.error, /128 caracteres/);
});

test('validateIdempotencyKey rejects empty string', () => {
  const result = validateIdempotencyKey('');
  assert.equal(result.valid, false);
});

test('validateIdempotencyKey rejects non-string', () => {
  const result = validateIdempotencyKey(123);
  assert.equal(result.valid, false);
});

// Complete Message Create Validation
test('validateMessageCreate accepts valid data', () => {
  const result = validateMessageCreate({
    guestName: 'João Silva',
    message: 'Felicidades!',
    consentGiven: true,
  });
  assert.equal(result.valid, true);
  assert.equal(result.data.guestName, 'João Silva');
  assert.equal(result.data.message, 'Felicidades!');
  assert.equal(result.data.consentGiven, true);
});

test('validateMessageCreate normalizes guestName', () => {
  const result = validateMessageCreate({
    guestName: '  Maria   Santos  ',
    message: 'Parabéns!',
    consentGiven: true,
  });
  assert.equal(result.valid, true);
  assert.equal(result.data.guestName, 'Maria Santos');
});

test('validateMessageCreate normalizes message CRLF', () => {
  const result = validateMessageCreate({
    guestName: 'Pedro',
    message: 'Linha1\r\nLinha2',
    consentGiven: true,
  });
  assert.equal(result.valid, true);
  assert.equal(result.data.message, 'Linha1\nLinha2');
});

test('validateMessageCreate rejects unknown fields', () => {
  const result = validateMessageCreate({
    guestName: 'João',
    message: 'Texto',
    consentGiven: true,
    giftId: 'abc123', // not allowed
  });
  assert.equal(result.valid, false);
  assert.match(result.errors._, /não permitidos.*giftId/);
});

test('validateMessageCreate rejects payment-related fields', () => {
  const result = validateMessageCreate({
    guestName: 'João',
    message: 'Texto',
    consentGiven: true,
    amount: 100,
    email: 'test@example.com',
  });
  assert.equal(result.valid, false);
  assert.match(result.errors._, /não permitidos/);
});

test('validateMessageCreate rejects missing guestName', () => {
  const result = validateMessageCreate({
    message: 'Texto',
    consentGiven: true,
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.guestName);
});

test('validateMessageCreate rejects missing message', () => {
  const result = validateMessageCreate({
    guestName: 'João',
    consentGiven: true,
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.message);
});

test('validateMessageCreate rejects missing consent', () => {
  const result = validateMessageCreate({
    guestName: 'João',
    message: 'Texto',
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.consentGiven);
});

test('validateMessageCreate rejects false consent', () => {
  const result = validateMessageCreate({
    guestName: 'João',
    message: 'Texto',
    consentGiven: false,
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.consentGiven);
});

test('validateMessageCreate rejects invalid guestName', () => {
  const result = validateMessageCreate({
    guestName: 'A', // too short
    message: 'Texto válido',
    consentGiven: true,
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.guestName);
});

test('validateMessageCreate rejects invalid message', () => {
  const result = validateMessageCreate({
    guestName: 'João Silva',
    message: 'AB', // too short
    consentGiven: true,
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.message);
});

test('validateMessageCreate rejects non-object input', () => {
  const result = validateMessageCreate(null);
  assert.equal(result.valid, false);
  assert.ok(result.errors._);
});

test('validateMessageCreate rejects array input', () => {
  const result = validateMessageCreate([{ guestName: 'João' }]);
  assert.equal(result.valid, false);
  assert.ok(result.errors._);
});

test('validateMessageCreate collects multiple errors', () => {
  const result = validateMessageCreate({
    guestName: 'A', // too short
    message: 'AB', // too short
    consentGiven: false, // invalid
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.guestName);
  assert.ok(result.errors.message);
  assert.ok(result.errors.consentGiven);
});
