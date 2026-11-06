-- Migration 0008: Hospedagem / dicas editáveis (admin) — Cloudflare Free / D1
-- Static data/lodging-tips.mjs remains seed + fallback when table empty

CREATE TABLE IF NOT EXISTS lodging_tips (
  id TEXT PRIMARY KEY NOT NULL
    CHECK (length(id) >= 2 AND length(id) <= 40),
  name TEXT NOT NULL
    CHECK (length(name) >= 2 AND length(name) <= 120),
  description TEXT NOT NULL
    CHECK (length(description) >= 2 AND length(description) <= 500),
  area TEXT NOT NULL DEFAULT ''
    CHECK (length(area) <= 80),
  maps_url TEXT NOT NULL DEFAULT ''
    CHECK (length(maps_url) <= 500),
  website_url TEXT NOT NULL DEFAULT ''
    CHECK (length(website_url) <= 500),
  active INTEGER NOT NULL DEFAULT 1
    CHECK (active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lodging_tips_active_sort
  ON lodging_tips(active, sort_order, id);

INSERT INTO schema_migrations (version, applied_at)
VALUES ('0008', datetime('now'))
ON CONFLICT(version) DO NOTHING;
