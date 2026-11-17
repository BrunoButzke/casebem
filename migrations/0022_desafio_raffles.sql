-- Migration 0022: rifas / vendas e sorteios

CREATE TABLE IF NOT EXISTS desafio_raffles (
  id TEXT PRIMARY KEY NOT NULL
    CHECK (length(id) >= 2 AND length(id) <= 40),
  wedding_key TEXT NOT NULL,
  name TEXT NOT NULL
    CHECK (length(name) >= 2 AND length(name) <= 120),
  image_data TEXT,
  total_numbers INTEGER NOT NULL
    CHECK (total_numbers >= 1 AND total_numbers <= 200),
  price_cents INTEGER NOT NULL
    CHECK (price_cents >= 100 AND price_cents <= 100000000),
  active INTEGER NOT NULL DEFAULT 0
    CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_desafio_raffles_wedding
  ON desafio_raffles(wedding_key, active, updated_at, id);

CREATE TABLE IF NOT EXISTS desafio_raffle_sales (
  raffle_id TEXT NOT NULL,
  number INTEGER NOT NULL
    CHECK (number >= 1 AND number <= 200),
  guest_name TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (raffle_id, number)
);

CREATE INDEX IF NOT EXISTS idx_desafio_raffle_sales_raffle
  ON desafio_raffle_sales(raffle_id, number);

INSERT INTO schema_migrations (version, applied_at)
VALUES ('0022', datetime('now'))
ON CONFLICT(version) DO NOTHING;
