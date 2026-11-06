-- Migration 0005: Admin panel support + Pix paid marker + message moderation
-- Cloudflare Free / D1 compatible (ADD COLUMN only — no paid CF products)

-- Mark Pix as confirmed by webhook/manual without rewriting status CHECK
ALTER TABLE checkout_intents ADD COLUMN paid_at TEXT;

-- Soft-hide messages for moderation (public list filters hidden = 0)
ALTER TABLE wedding_messages ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_checkout_intents_paid_at
  ON checkout_intents(paid_at) WHERE paid_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_hidden
  ON wedding_messages(wedding_key, hidden, created_at DESC);

INSERT INTO schema_migrations (version, applied_at)
VALUES ('0005', datetime('now'))
ON CONFLICT(version) DO NOTHING;
