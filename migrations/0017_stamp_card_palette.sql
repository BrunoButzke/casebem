-- Migration 0017: paleta e textos visuais por cartão de selos

ALTER TABLE challenge_stamp_cards ADD COLUMN card_bg TEXT NOT NULL DEFAULT '#fdfbf8';
ALTER TABLE challenge_stamp_cards ADD COLUMN card_accent TEXT NOT NULL DEFAULT '#d66d81';
ALTER TABLE challenge_stamp_cards ADD COLUMN card_accent_soft TEXT NOT NULL DEFAULT '#f9e4e8';
ALTER TABLE challenge_stamp_cards ADD COLUMN card_text TEXT NOT NULL DEFAULT '#7d6e6a';
ALTER TABLE challenge_stamp_cards ADD COLUMN card_border TEXT NOT NULL DEFAULT '#e8b4bc';
ALTER TABLE challenge_stamp_cards ADD COLUMN bar_hint TEXT NOT NULL DEFAULT 'Mostre este cartão no bar';
ALTER TABLE challenge_stamp_cards ADD COLUMN footer_template TEXT NOT NULL DEFAULT 'Faltam {n} pontos para o próximo drink 🍸';

INSERT INTO schema_migrations (version, applied_at)
VALUES ('0017', datetime('now'))
ON CONFLICT(version) DO NOTHING;
