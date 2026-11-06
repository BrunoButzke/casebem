-- Migration 0009: Papelaria digital (templates WhatsApp) — Cloudflare Free / D1
-- Static data/stationery-templates.mjs = seed + fallback

CREATE TABLE IF NOT EXISTS stationery_templates (
  id TEXT PRIMARY KEY NOT NULL
    CHECK (length(id) >= 2 AND length(id) <= 40),
  title TEXT NOT NULL
    CHECK (length(title) >= 2 AND length(title) <= 120),
  body TEXT NOT NULL
    CHECK (length(body) >= 2 AND length(body) <= 1000),
  kind TEXT NOT NULL DEFAULT 'whatsapp'
    CHECK (kind IN ('whatsapp', 'copy')),
  active INTEGER NOT NULL DEFAULT 1
    CHECK (active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stationery_active_sort
  ON stationery_templates(active, sort_order, id);

INSERT INTO schema_migrations (version, applied_at)
VALUES ('0009', datetime('now'))
ON CONFLICT(version) DO NOTHING;
