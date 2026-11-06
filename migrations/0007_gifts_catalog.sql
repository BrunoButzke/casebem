-- Migration 0007: Editable gifts catalog (admin) — Cloudflare Free / D1
-- Static data/gifts-catalog.mjs remains seed + fallback when table empty

CREATE TABLE IF NOT EXISTS gifts_catalog (
  id TEXT PRIMARY KEY NOT NULL
    CHECK (length(id) >= 2 AND length(id) <= 40),
  name TEXT NOT NULL
    CHECK (length(name) >= 2 AND length(name) <= 100),
  description TEXT NOT NULL
    CHECK (length(description) >= 2 AND length(description) <= 300),
  price_in_cents INTEGER NOT NULL
    CHECK (price_in_cents >= 99 AND price_in_cents <= 100000000),
  image_url TEXT NOT NULL
    CHECK (length(image_url) >= 1 AND length(image_url) <= 300),
  mode TEXT NOT NULL
    CHECK (mode IN ('fixed', 'custom')),
  active INTEGER NOT NULL DEFAULT 1
    CHECK (active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gifts_catalog_active_sort
  ON gifts_catalog(active, sort_order, id);

INSERT INTO schema_migrations (version, applied_at)
VALUES ('0007', datetime('now'))
ON CONFLICT(version) DO NOTHING;
