-- Migration 0019: galeria compartilhada das fotos dos desafios

CREATE TABLE IF NOT EXISTS desafio_gallery (
  id TEXT PRIMARY KEY NOT NULL,
  wedding_key TEXT NOT NULL,
  guest_name TEXT NOT NULL,
  mission_id TEXT NOT NULL,
  title TEXT NOT NULL,
  preview TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_desafio_gallery_wedding
  ON desafio_gallery(wedding_key, created_at, id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_desafio_gallery_guest_mission
  ON desafio_gallery(wedding_key, guest_name, mission_id);

INSERT INTO schema_migrations (version, applied_at)
VALUES ('0019', datetime('now'))
ON CONFLICT(version) DO NOTHING;
