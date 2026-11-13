-- Migration 0012: foto do presente (data URL / blob textual)
-- image_url continua para paths curtos; image_data para upload base64

ALTER TABLE gifts_catalog ADD COLUMN image_data TEXT;

INSERT INTO schema_migrations (version, applied_at)
VALUES ('0012', datetime('now'))
ON CONFLICT(version) DO NOTHING;
