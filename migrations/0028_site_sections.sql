-- Construtor "Nossa página": seções do site do casamento
CREATE TABLE IF NOT EXISTS site_sections (
  id TEXT PRIMARY KEY,
  wedding_key TEXT NOT NULL,
  section_key TEXT NOT NULL,
  label TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  content_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_site_sections_wedding_key
  ON site_sections(wedding_key, section_key);

CREATE INDEX IF NOT EXISTS idx_site_sections_wedding_sort
  ON site_sections(wedding_key, sort_order, section_key);
