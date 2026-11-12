/**
 * Tests for RSVP validators
 * TDD: RED → GREEN
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  normalizeName,
  validateName,
  validateAttending,
  validateAdultsCount,
  validateChildrenCount,
  validateObservations,
  validateConsent,
  validateRsvpCreate,
  validateRsvpUpdate,
  LIMITS,
} from '../functions/_lib/rsvp-validators.mjs';

describe('normalizeName', () => {
  it('should trim whitespace', () => {
    assert.equal(normalizeName('  Maria  '), 'Maria');
  });

  it('should collapse multiple spaces', () => {
    assert.equal(normalizeName('Maria  Silva   Santos'), 'Maria Silva Santos');
  });

  it('should handle empty string', () => {
    assert.equal(normalizeName(''), '');
  });

  it('should handle non-string', () => {
    assert.equal(normalizeName(null), '');
    assert.equal(normalizeName(123), '');
  });
});

describe('validateName', () => {
  it('should accept valid name', () => {
    const result = validateName('Maria Silva');
    assert.equal(result.valid, true);
    assert.equal(result.value, 'Maria Silva');
  });

  it('should normalize and accept valid name', () => {
    const result = validateName('  João  Pedro  ');
    assert.equal(result.valid, true);
    assert.equal(result.value, 'João Pedro');
  });

  it('should reject empty name', () => {
    const result = validateName('');
    assert.equal(result.valid, false);
    assert.match(result.error, /obrigatório/i);
  });

  it('should reject name too short', () => {
    const result = validateName('A');
    assert.equal(result.valid, false);
    assert.match(result.error, /2-100/);
  });

  it('should reject name too long', () => {
    const longName = 'A'.repeat(101);
    const result = validateName(longName);
    assert.equal(result.valid, false);
    assert.match(result.error, /2-100/);
  });

  it('should accept name at max length', () => {
    const maxName = 'A'.repeat(100);
    const result = validateName(maxName);
    assert.equal(result.valid, true);
  });

  it('should accept international characters', () => {
    const result = validateName('José María Peña');
    assert.equal(result.valid, true);
    assert.equal(result.value, 'José María Peña');
  });
});

describe('validateAttending', () => {
  it('should accept true', () => {
    const result = validateAttending(true);
    assert.equal(result.valid, true);
    assert.equal(result.value, true);
  });

  it('should accept false', () => {
    const result = validateAttending(false);
    assert.equal(result.valid, true);
    assert.equal(result.value, false);
  });

  it('should reject non-boolean', () => {
    assert.equal(validateAttending('true').valid, false);
    assert.equal(validateAttending(1).valid, false);
    assert.equal(validateAttending(null).valid, false);
  });
});

describe('validateAdultsCount', () => {
  it('should accept 0', () => {
    const result = validateAdultsCount(0);
    assert.equal(result.valid, true);
    assert.equal(result.value, 0);
  });

  it('should accept 5', () => {
    const result = validateAdultsCount(5);
    assert.equal(result.valid, true);
    assert.equal(result.value, 5);
  });

  it('should accept 10 (max)', () => {
    const result = validateAdultsCount(10);
    assert.equal(result.valid, true);
    assert.equal(result.value, 10);
  });

  it('should reject negative', () => {
    const result = validateAdultsCount(-1);
    assert.equal(result.valid, false);
    assert.match(result.error, /0-10/);
  });

  it('should reject above max', () => {
    const result = validateAdultsCount(11);
    assert.equal(result.valid, false);
    assert.match(result.error, /0-10/);
  });

  it('should reject float', () => {
    const result = validateAdultsCount(2.5);
    assert.equal(result.valid, false);
    assert.match(result.error, /inteiro/i);
  });

  it('should reject string', () => {
    const result = validateAdultsCount('5');
    assert.equal(result.valid, false);
  });
});

describe('validateChildrenCount', () => {
  it('should accept 0', () => {
    const result = validateChildrenCount(0);
    assert.equal(result.valid, true);
  });

  it('should accept 10 (max)', () => {
    const result = validateChildrenCount(10);
    assert.equal(result.valid, true);
  });

  it('should reject negative', () => {
    const result = validateChildrenCount(-1);
    assert.equal(result.valid, false);
  });

  it('should reject above max', () => {
    const result = validateChildrenCount(11);
    assert.equal(result.valid, false);
  });

  it('should reject float', () => {
    const result = validateChildrenCount(1.5);
    assert.equal(result.valid, false);
  });
});

describe('validateObservations', () => {
  it('should accept null', () => {
    const result = validateObservations(null);
    assert.equal(result.valid, true);
    assert.equal(result.value, null);
  });

  it('should accept empty string as null', () => {
    const result = validateObservations('');
    assert.equal(result.valid, true);
    assert.equal(result.value, null);
  });

  it('should accept valid text', () => {
    const result = validateObservations('Alergia a frutos do mar');
    assert.equal(result.valid, true);
    assert.equal(result.value, 'Alergia a frutos do mar');
  });

  it('should accept text at max length', () => {
    const maxText = 'A'.repeat(LIMITS.OBSERVATIONS_MAX);
    const result = validateObservations(maxText);
    assert.equal(result.valid, true);
  });

  it('should reject text exceeding max', () => {
    const tooLong = 'A'.repeat(LIMITS.OBSERVATIONS_MAX + 1);
    const result = validateObservations(tooLong);
    assert.equal(result.valid, false);
    assert.match(result.error, new RegExp(String(LIMITS.OBSERVATIONS_MAX)));
  });

  it('should reject non-string', () => {
    const result = validateObservations(123);
    assert.equal(result.valid, false);
  });
});

describe('validateConsent', () => {
  it('should accept true', () => {
    const result = validateConsent(true);
    assert.equal(result.valid, true);
    assert.equal(result.value, true);
  });

  it('should reject false', () => {
    const result = validateConsent(false);
    assert.equal(result.valid, false);
    assert.match(result.error, /obrigatório/i);
  });

  it('should reject non-boolean', () => {
    const result = validateConsent('true');
    assert.equal(result.valid, false);
  });

  it('should accept omitted/null (consentimento implícito ao enviar)', () => {
    assert.equal(validateConsent(null).valid, true);
    assert.equal(validateConsent(undefined).valid, true);
    assert.equal(validateConsent(null).value, true);
  });
});

describe('validateRsvpCreate', () => {
  const validPayload = {
    guestName: 'Maria Silva',
    attending: true,
    adultsCount: 2,
    childrenCount: 1,
    observations: 'Alergia a frutos do mar',
    consentGiven: true,
  };

  it('should accept valid payload', () => {
    const result = validateRsvpCreate(validPayload);
    assert.equal(result.valid, true);
    assert.deepEqual(result.data, validPayload);
  });

  it('should accept payload without observations', () => {
    const payload = { ...validPayload, observations: null };
    const result = validateRsvpCreate(payload);
    assert.equal(result.valid, true);
    assert.equal(result.data.observations, null);
  });

  it('should normalize name', () => {
    const payload = { ...validPayload, guestName: '  João  Pedro  ' };
    const result = validateRsvpCreate(payload);
    assert.equal(result.valid, true);
    assert.equal(result.data.guestName, 'João Pedro');
  });

  it('should reject missing name', () => {
    const payload = { ...validPayload, guestName: '' };
    const result = validateRsvpCreate(payload);
    assert.equal(result.valid, false);
    assert.ok(result.errors.guestName);
  });

  it('should reject invalid attending', () => {
    const payload = { ...validPayload, attending: 'yes' };
    const result = validateRsvpCreate(payload);
    assert.equal(result.valid, false);
    assert.ok(result.errors.attending);
  });

  it('should reject negative adults', () => {
    const payload = { ...validPayload, adultsCount: -1 };
    const result = validateRsvpCreate(payload);
    assert.equal(result.valid, false);
    assert.ok(result.errors.adultsCount);
  });

  it('should reject excessive children', () => {
    const payload = { ...validPayload, childrenCount: 11 };
    const result = validateRsvpCreate(payload);
    assert.equal(result.valid, false);
    assert.ok(result.errors.childrenCount);
  });

  it('should reject long observations', () => {
    const payload = { ...validPayload, observations: 'A'.repeat(LIMITS.OBSERVATIONS_MAX + 1) };
    const result = validateRsvpCreate(payload);
    assert.equal(result.valid, false);
    assert.ok(result.errors.observations);
  });

  it('should reject without consent', () => {
    const payload = { ...validPayload, consentGiven: false };
    const result = validateRsvpCreate(payload);
    assert.equal(result.valid, false);
    assert.ok(result.errors.consentGiven);
  });

  it('should collect multiple errors', () => {
    const payload = {
      guestName: '',
      attending: 'maybe',
      adultsCount: -1,
      childrenCount: 11,
      observations: 'A'.repeat(LIMITS.OBSERVATIONS_MAX + 1),
      consentGiven: false,
    };
    const result = validateRsvpCreate(payload);
    assert.equal(result.valid, false);
    assert.equal(Object.keys(result.errors).length, 6);
  });
});

describe('validateRsvpUpdate', () => {
  it('should accept partial update - attending only', () => {
    const result = validateRsvpUpdate({ attending: false });
    assert.equal(result.valid, true);
    assert.deepEqual(result.data, { attending: false });
  });

  it('should accept partial update - multiple fields', () => {
    const update = {
      attending: false,
      adultsCount: 0,
      childrenCount: 0,
      observations: 'Não poderei comparecer',
    };
    const result = validateRsvpUpdate(update);
    assert.equal(result.valid, true);
    assert.deepEqual(result.data, update);
  });

  it('should reject invalid attending in update', () => {
    const result = validateRsvpUpdate({ attending: 'no' });
    assert.equal(result.valid, false);
    assert.ok(result.errors.attending);
  });

  it('should reject invalid adultsCount in update', () => {
    const result = validateRsvpUpdate({ adultsCount: 11 });
    assert.equal(result.valid, false);
    assert.ok(result.errors.adultsCount);
  });

  it('should reject empty update', () => {
    const result = validateRsvpUpdate({});
    assert.equal(result.valid, false);
    assert.ok(result.errors._);
  });

  it('should ignore non-updateable fields', () => {
    const result = validateRsvpUpdate({
      guestName: 'New Name',
      consentGiven: false,
      attending: true,
    });
    assert.equal(result.valid, true);
    assert.deepEqual(result.data, { attending: true });
    assert.ok(!result.data.guestName);
  });
});
