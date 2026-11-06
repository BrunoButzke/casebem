-- Migration 0006: RSVP fechado (lista de convidados)
-- Cloudflare Free / D1 — default mode = open (comportamento atual)

CREATE TABLE IF NOT EXISTS wedding_settings (
  wedding_key TEXT PRIMARY KEY NOT NULL,
  rsvp_mode TEXT NOT NULL DEFAULT 'open'
    CHECK (rsvp_mode IN ('open', 'closed')),
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rsvp_guest_list (
  id TEXT PRIMARY KEY NOT NULL,
  wedding_key TEXT NOT NULL,
  display_name TEXT NOT NULL
    CHECK (length(display_name) >= 2 AND length(display_name) <= 100),
  name_key TEXT NOT NULL
    CHECK (length(name_key) >= 2 AND length(name_key) <= 100),
  created_at TEXT NOT NULL,
  UNIQUE (wedding_key, name_key)
);

CREATE INDEX IF NOT EXISTS idx_rsvp_guest_list_wedding
  ON rsvp_guest_list(wedding_key, name_key);

INSERT INTO wedding_settings (wedding_key, rsvp_mode, updated_at)
VALUES ('dani-carine', 'open', datetime('now'))
ON CONFLICT(wedding_key) DO NOTHING;

INSERT INTO schema_migrations (version, applied_at)
VALUES ('0006', datetime('now'))
ON CONFLICT(version) DO NOTHING;
