-- Migration 0023: holds de números (pending) até o Pix ser aprovado

ALTER TABLE desafio_raffle_sales ADD COLUMN status TEXT NOT NULL DEFAULT 'sold';
ALTER TABLE desafio_raffle_sales ADD COLUMN intent_key TEXT;
ALTER TABLE desafio_raffle_sales ADD COLUMN payment_id TEXT;

CREATE INDEX IF NOT EXISTS idx_desafio_raffle_sales_intent
  ON desafio_raffle_sales(intent_key);

CREATE INDEX IF NOT EXISTS idx_desafio_raffle_sales_status
  ON desafio_raffle_sales(raffle_id, status, number);

INSERT INTO schema_migrations (version, applied_at)
VALUES ('0023', datetime('now'))
ON CONFLICT(version) DO NOTHING;
