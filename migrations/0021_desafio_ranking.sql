-- Migration 0021: placar ao vivo dos desafios (um convidado por linha)

CREATE TABLE IF NOT EXISTS desafio_ranking (
  wedding_key TEXT NOT NULL,
  guest_key TEXT NOT NULL,
  guest_name TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  stamps INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (wedding_key, guest_key)
);

CREATE INDEX IF NOT EXISTS idx_desafio_ranking_points
  ON desafio_ranking(wedding_key, points, stamps, guest_name);

INSERT INTO schema_migrations (version, applied_at)
VALUES ('0021', datetime('now'))
ON CONFLICT(version) DO NOTHING;
