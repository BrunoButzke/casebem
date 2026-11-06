-- Migration 0001: RSVP System for Dani & Carine Wedding
-- Created: 2026-11-06
-- Database: Cloudflare D1

-- Main RSVP table
CREATE TABLE IF NOT EXISTS rsvps (
  id TEXT PRIMARY KEY,                    -- UUID v4
  wedding_key TEXT NOT NULL,              -- Always 'dani-carine' for this event
  guest_name TEXT NOT NULL,               -- Normalized guest name (2-100 chars)
  attending INTEGER NOT NULL,             -- 1 = yes, 0 = no
  adults_count INTEGER NOT NULL DEFAULT 0, -- 0-10 adult guests
  children_count INTEGER NOT NULL DEFAULT 0, -- 0-10 children
  observations TEXT,                      -- Optional notes (max 500 chars)
  consent_given INTEGER NOT NULL,         -- 1 = consented, required
  manage_token_hash TEXT NOT NULL UNIQUE, -- bcrypt hash of manage token
  created_at TEXT NOT NULL,               -- ISO 8601 timestamp
  updated_at TEXT NOT NULL,               -- ISO 8601 timestamp
  
  -- Constraints
  CHECK (attending IN (0, 1)),
  CHECK (adults_count >= 0 AND adults_count <= 10),
  CHECK (children_count >= 0 AND children_count <= 10),
  CHECK (consent_given = 1),
  CHECK (length(guest_name) >= 2 AND length(guest_name) <= 100),
  CHECK (observations IS NULL OR length(observations) <= 500)
);

-- Index for faster lookups by token hash
CREATE INDEX IF NOT EXISTS idx_rsvps_token_hash 
  ON rsvps(manage_token_hash);

-- Index for wedding queries (future multi-wedding support)
CREATE INDEX IF NOT EXISTS idx_rsvps_wedding 
  ON rsvps(wedding_key, created_at DESC);

-- Rate limiting table
-- Tracks request counts per IP per time window
CREATE TABLE IF NOT EXISTS rate_limits (
  id TEXT PRIMARY KEY,                    -- Composite key: wedding_key:ip_hash:window
  wedding_key TEXT NOT NULL,              -- Wedding event identifier
  ip_hash TEXT NOT NULL,                  -- SHA-256 hash of IP (privacy)
  window_start TEXT NOT NULL,             -- ISO 8601 timestamp (hour window)
  request_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  
  -- Constraints
  CHECK (request_count >= 0)
);

-- Index for rate limit queries
CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup 
  ON rate_limits(wedding_key, ip_hash, window_start);

-- Index for cleanup of old windows (TTL simulation)
CREATE INDEX IF NOT EXISTS idx_rate_limits_cleanup 
  ON rate_limits(window_start);

-- Migration metadata
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL,
  description TEXT
);

INSERT INTO schema_migrations (version, applied_at, description)
VALUES ('0001', datetime('now'), 'Initial RSVP system with rate limiting');
