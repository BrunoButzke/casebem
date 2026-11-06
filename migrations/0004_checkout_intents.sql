-- Migration 0004: Checkout intents for idempotent payment creation
-- Prevents duplicate charges via client correlation ID + server fingerprint

-- Checkout intents table
CREATE TABLE IF NOT EXISTS checkout_intents (
  intent_key TEXT PRIMARY KEY NOT NULL CHECK(length(intent_key) = 36),
  fingerprint TEXT NOT NULL CHECK(length(fingerprint) = 64),
  provider TEXT NOT NULL CHECK(provider IN ('mercadopago')),
  provider_reference TEXT,
  amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
  gifter_name TEXT NOT NULL CHECK(length(gifter_name) >= 2 AND length(gifter_name) <= 100),
  canonical_items TEXT NOT NULL,
  payment_method TEXT NOT NULL CHECK(payment_method IN ('pix', 'card', 'boleto')),
  status TEXT NOT NULL CHECK(status IN ('creating', 'pending', 'failed')),
  qr_code TEXT,
  qr_code_base64 TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_checkout_intents_fingerprint ON checkout_intents(fingerprint);
CREATE INDEX IF NOT EXISTS idx_checkout_intents_status ON checkout_intents(status);
CREATE INDEX IF NOT EXISTS idx_checkout_intents_created_at ON checkout_intents(created_at);

-- Rate limiting reuses existing rate_limits table with namespace 'checkout:'
-- No schema changes to rate_limits

-- Track schema version
INSERT INTO schema_migrations (version, applied_at) 
VALUES (4, datetime('now'))
ON CONFLICT(version) DO NOTHING;
