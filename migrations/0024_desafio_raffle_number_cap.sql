-- Migration 0024: permite expandir números além do teto 200 (pagamento tardio)

CREATE TABLE IF NOT EXISTS desafio_raffles_new (
  id TEXT PRIMARY KEY NOT NULL
    CHECK (length(id) >= 2 AND length(id) <= 40),
  wedding_key TEXT NOT NULL,
  name TEXT NOT NULL
    CHECK (length(name) >= 2 AND length(name) <= 120),
  image_data TEXT,
  total_numbers INTEGER NOT NULL
    CHECK (total_numbers >= 1 AND total_numbers <= 2000),
  price_cents INTEGER NOT NULL
    CHECK (price_cents >= 100 AND price_cents <= 100000000),
  active INTEGER NOT NULL DEFAULT 0
    CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO desafio_raffles_new
SELECT id, wedding_key, name, image_data, total_numbers, price_cents, active, created_at, updated_at
FROM desafio_raffles;

DROP TABLE desafio_raffles;
ALTER TABLE desafio_raffles_new RENAME TO desafio_raffles;

CREATE INDEX IF NOT EXISTS idx_desafio_raffles_wedding
  ON desafio_raffles(wedding_key, active, updated_at, id);

CREATE TABLE IF NOT EXISTS desafio_raffle_sales_new (
  raffle_id TEXT NOT NULL,
  number INTEGER NOT NULL
    CHECK (number >= 1 AND number <= 2000),
  guest_name TEXT,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sold',
  intent_key TEXT,
  payment_id TEXT,
  PRIMARY KEY (raffle_id, number)
);

INSERT INTO desafio_raffle_sales_new
SELECT raffle_id, number, guest_name, created_at,
       COALESCE(status, 'sold'), intent_key, payment_id
FROM desafio_raffle_sales;

DROP TABLE desafio_raffle_sales;
ALTER TABLE desafio_raffle_sales_new RENAME TO desafio_raffle_sales;

CREATE INDEX IF NOT EXISTS idx_desafio_raffle_sales_raffle
  ON desafio_raffle_sales(raffle_id, number);
CREATE INDEX IF NOT EXISTS idx_desafio_raffle_sales_intent
  ON desafio_raffle_sales(intent_key);
CREATE INDEX IF NOT EXISTS idx_desafio_raffle_sales_status
  ON desafio_raffle_sales(raffle_id, status, number);

INSERT INTO schema_migrations (version, applied_at)
VALUES ('0024', datetime('now'))
ON CONFLICT(version) DO NOTHING;
