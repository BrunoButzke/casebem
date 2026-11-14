-- Migration 0015: visual theme for desafio app + loyalty card

CREATE TABLE IF NOT EXISTS desafio_theme (
  wedding_key TEXT PRIMARY KEY NOT NULL,
  -- App palette
  app_bg_from TEXT NOT NULL DEFAULT '#f8f0ef',
  app_bg_mid TEXT NOT NULL DEFAULT '#f4f6f0',
  app_bg_to TEXT NOT NULL DEFAULT '#f8f3ec',
  app_rose TEXT NOT NULL DEFAULT '#d47a86',
  app_rose_deep TEXT NOT NULL DEFAULT '#c45d6c',
  app_ink TEXT NOT NULL DEFAULT '#4a3a38',
  app_muted TEXT NOT NULL DEFAULT '#7d6e6a',
  -- Loyalty card
  card_title TEXT NOT NULL DEFAULT 'CARTÃO FIDELIDADE DO AMOR',
  card_bg TEXT NOT NULL DEFAULT '#fdfbf8',
  card_accent TEXT NOT NULL DEFAULT '#d66d81',
  card_accent_soft TEXT NOT NULL DEFAULT '#f9e4e8',
  card_text TEXT NOT NULL DEFAULT '#7d6e6a',
  card_border TEXT NOT NULL DEFAULT '#e8b4bc',
  card_slots INTEGER NOT NULL DEFAULT 5
    CHECK (card_slots >= 1 AND card_slots <= 12),
  card_reward_label TEXT NOT NULL DEFAULT 'drinks secretos liberados!',
  card_bar_hint TEXT NOT NULL DEFAULT 'Mostre este cartão no bar',
  card_footer_template TEXT NOT NULL DEFAULT 'Faltam {n} pontos para o próximo drink 🍸',
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO desafio_theme (wedding_key, updated_at)
VALUES ('dani-carine', datetime('now'));

INSERT INTO schema_migrations (version, applied_at)
VALUES ('0015', datetime('now'))
ON CONFLICT(version) DO NOTHING;
