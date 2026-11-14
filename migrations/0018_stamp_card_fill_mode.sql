-- Migration 0018: cartão de selo pode encher por selo ou por pontos por bolinha

ALTER TABLE challenge_stamp_cards ADD COLUMN fill_mode TEXT NOT NULL DEFAULT 'stamp';
ALTER TABLE challenge_stamp_cards ADD COLUMN points_per_slot INTEGER NOT NULL DEFAULT 10;

INSERT INTO schema_migrations (version, applied_at)
VALUES ('0018', datetime('now'))
ON CONFLICT(version) DO NOTHING;
