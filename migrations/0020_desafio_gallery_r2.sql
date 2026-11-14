-- Migration 0020: fotos da galeria no R2; D1 fica só com metadados + chave do objeto

ALTER TABLE desafio_gallery ADD COLUMN object_key TEXT;

INSERT INTO schema_migrations (version, applied_at)
VALUES ('0020', datetime('now'))
ON CONFLICT(version) DO NOTHING;
