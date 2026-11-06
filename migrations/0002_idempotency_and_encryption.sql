-- Migration 0002: Add Idempotency and Token Encryption
-- Created: 2026-11-06
-- Database: Cloudflare D1

-- Add idempotency column to rsvps table
ALTER TABLE rsvps ADD COLUMN idempotency_key TEXT;

-- Add encrypted token column (AES-GCM encrypted manageToken)
ALTER TABLE rsvps ADD COLUMN manage_token_encrypted TEXT NOT NULL DEFAULT '';

-- Create unique index for idempotency per wedding
CREATE UNIQUE INDEX IF NOT EXISTS idx_rsvps_idempotency 
  ON rsvps(wedding_key, idempotency_key) 
  WHERE idempotency_key IS NOT NULL;

-- Update migration metadata
INSERT INTO schema_migrations (version, applied_at, description)
VALUES ('0002', datetime('now'), 'Add idempotency key and encrypted token storage');

-- Note: Existing rsvps will have empty manage_token_encrypted
-- This is OK for MVP as they already have manage_token_hash for auth
-- New creates will use both hash (for lookup) and encrypted (for recovery)
