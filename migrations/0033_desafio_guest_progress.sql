-- Progresso do convidado no /games (quiz + missões foto).
-- Tenant padrão de /games: dani-carine. Fotos binárias ficam em desafio_gallery/R2.

CREATE TABLE IF NOT EXISTS desafio_guest_progress (
  wedding_key TEXT NOT NULL,
  guest_key TEXT NOT NULL,
  guest_name TEXT NOT NULL,
  answers_json TEXT NOT NULL DEFAULT '{}',
  photos_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (wedding_key, guest_key)
);

CREATE INDEX IF NOT EXISTS idx_desafio_guest_progress_updated
  ON desafio_guest_progress(wedding_key, updated_at);

INSERT INTO schema_migrations (version, applied_at)
VALUES ('0033', datetime('now'))
ON CONFLICT(version) DO NOTHING;
