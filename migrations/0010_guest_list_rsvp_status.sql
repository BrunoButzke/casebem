-- Migration 0010: status de RSVP na lista de convidados
-- attending: NULL = pendente, 1 = vai, 0 = não vai

ALTER TABLE rsvp_guest_list ADD COLUMN attending INTEGER
  CHECK (attending IS NULL OR attending IN (0, 1));

ALTER TABLE rsvp_guest_list ADD COLUMN responded_at TEXT;

INSERT INTO schema_migrations (version, applied_at)
VALUES ('0010', datetime('now'))
ON CONFLICT(version) DO NOTHING;
