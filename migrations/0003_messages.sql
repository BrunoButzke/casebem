-- Migration 0003: Wedding Messages (Mural de Recados)
-- Created: 2026-11-06
-- Database: Cloudflare D1

-- Messages table - public guestbook independent of gifts/payments
CREATE TABLE IF NOT EXISTS wedding_messages (
  id TEXT PRIMARY KEY,                    -- UUID v4 (crypto.randomUUID)
  wedding_key TEXT NOT NULL,              -- Always 'dani-carine' for this event
  guest_name TEXT NOT NULL,               -- Normalized guest name (2-100 chars)
  message TEXT NOT NULL,                  -- Message content (3-500 chars, newlines OK)
  consent_given INTEGER NOT NULL,         -- 1 = consented, required
  created_at TEXT NOT NULL,               -- ISO 8601 timestamp
  idempotency_key TEXT,                   -- Optional unique key for idempotent creation
  idempotency_fingerprint TEXT NOT NULL,  -- SHA-256 hash of canonical payload
  
  -- Constraints
  CHECK (consent_given = 1),
  CHECK (length(guest_name) >= 2 AND length(guest_name) <= 100),
  CHECK (length(message) >= 3 AND length(message) <= 500)
);

-- Unique index for idempotency per wedding
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_idempotency
  ON wedding_messages(wedding_key, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Index for wedding queries with pagination (created_at DESC, id DESC)
CREATE INDEX IF NOT EXISTS idx_messages_wedding_time
  ON wedding_messages(wedding_key, created_at DESC, id DESC);

-- Migration metadata
INSERT INTO schema_migrations (version, applied_at, description)
VALUES ('0003', datetime('now'), 'Wedding messages (mural de recados)');
