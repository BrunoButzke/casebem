-- Broadcast do sorteio ao vivo (admin → telões). Uma linha por casamento.

CREATE TABLE IF NOT EXISTS desafio_raffle_draw_broadcast (
  wedding_key TEXT PRIMARY KEY NOT NULL,
  phase TEXT NOT NULL DEFAULT 'gallery'
    CHECK (phase IN ('gallery', 'soon', 'spinning', 'winner')),
  started_at TEXT,
  duration_ms INTEGER NOT NULL DEFAULT 8000
    CHECK (duration_ms >= 1000 AND duration_ms <= 60000),
  winner_number INTEGER,
  winner_name TEXT,
  raffle_id TEXT,
  pool_json TEXT,
  updated_at TEXT NOT NULL
);

INSERT INTO schema_migrations (version, applied_at)
VALUES ('0034', datetime('now'))
ON CONFLICT(version) DO NOTHING;
