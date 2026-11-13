-- Migration 0011: grupos de convidados
-- group_id nullable = sem grupo

CREATE TABLE IF NOT EXISTS guest_groups (
  id TEXT PRIMARY KEY NOT NULL,
  wedding_key TEXT NOT NULL,
  name TEXT NOT NULL
    CHECK (length(name) >= 1 AND length(name) <= 80),
  created_at TEXT NOT NULL,
  UNIQUE (wedding_key, name)
);

CREATE INDEX IF NOT EXISTS idx_guest_groups_wedding
  ON guest_groups(wedding_key);

ALTER TABLE rsvp_guest_list ADD COLUMN group_id TEXT;

CREATE INDEX IF NOT EXISTS idx_rsvp_guest_list_group
  ON rsvp_guest_list(wedding_key, group_id);

INSERT INTO schema_migrations (version, applied_at)
VALUES ('0011', datetime('now'))
ON CONFLICT(version) DO NOTHING;
