-- Isolamento multi-tenant: wedding_key em tabelas que ainda eram globais
-- Linhas existentes ficam no casal parceiro dani-carine.

ALTER TABLE checkout_intents ADD COLUMN wedding_key TEXT NOT NULL DEFAULT 'dani-carine';
CREATE INDEX IF NOT EXISTS idx_checkout_intents_wedding
  ON checkout_intents(wedding_key, created_at);

ALTER TABLE gifts_catalog ADD COLUMN wedding_key TEXT NOT NULL DEFAULT 'dani-carine';
CREATE INDEX IF NOT EXISTS idx_gifts_catalog_wedding_active_sort
  ON gifts_catalog(wedding_key, active, sort_order, id);

ALTER TABLE lodging_tips ADD COLUMN wedding_key TEXT NOT NULL DEFAULT 'dani-carine';
CREATE INDEX IF NOT EXISTS idx_lodging_tips_wedding_active_sort
  ON lodging_tips(wedding_key, active, sort_order, id);

ALTER TABLE stationery_templates ADD COLUMN wedding_key TEXT NOT NULL DEFAULT 'dani-carine';
CREATE INDEX IF NOT EXISTS idx_stationery_wedding_active_sort
  ON stationery_templates(wedding_key, active, sort_order, id);

ALTER TABLE media_playlist ADD COLUMN wedding_key TEXT NOT NULL DEFAULT 'dani-carine';
CREATE INDEX IF NOT EXISTS idx_media_playlist_wedding_active_sort
  ON media_playlist(wedding_key, active, sort_order, id);
