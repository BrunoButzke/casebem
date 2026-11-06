-- Migration 0002: Add Idempotency and Fingerprint Columns
-- Created: 2026-11-06
-- Database: Cloudflare D1

-- Add idempotency columns
ALTER TABLE rsvps ADD COLUMN idempotency_key TEXT;
ALTER TABLE rsvps ADD COLUMN idempotency_fingerprint TEXT NOT NULL DEFAULT '';

-- Create unique index for idempotency per wedding
CREATE UNIQUE INDEX IF NOT EXISTS idx_rsvps_idempotency
  ON rsvps(wedding_key, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Note: SQLite ALTER TABLE cannot add CHECK constraints to existing tables
-- For new deployments, use 0001_rsvps_v2.sql with constraints built-in
-- For existing data, the application enforces: attending=0 => counts=0

-- Update migration metadata
INSERT INTO schema_migrations (version, applied_at, description)
VALUES ('0002', datetime('now'), 'Add idempotency key and fingerprint columns');
