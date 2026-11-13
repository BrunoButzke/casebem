-- Migration 0013: Admin desafios (quiz, fotos, cartões de selos)

CREATE TABLE IF NOT EXISTS challenge_questions (
  id TEXT PRIMARY KEY NOT NULL
    CHECK (length(id) >= 2 AND length(id) <= 40),
  wedding_key TEXT NOT NULL,
  prompt TEXT NOT NULL
    CHECK (length(prompt) >= 2 AND length(prompt) <= 200),
  options_json TEXT NOT NULL,
  correct_index INTEGER NOT NULL
    CHECK (correct_index >= 0 AND correct_index <= 3),
  points INTEGER NOT NULL
    CHECK (points >= 1 AND points <= 999),
  active INTEGER NOT NULL DEFAULT 1
    CHECK (active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_challenge_questions_wedding
  ON challenge_questions(wedding_key, active, sort_order, id);

CREATE TABLE IF NOT EXISTS challenge_photo_missions (
  id TEXT PRIMARY KEY NOT NULL
    CHECK (length(id) >= 2 AND length(id) <= 40),
  wedding_key TEXT NOT NULL,
  title TEXT NOT NULL
    CHECK (length(title) >= 2 AND length(title) <= 100),
  points INTEGER NOT NULL
    CHECK (points >= 1 AND points <= 999),
  awards_stamp INTEGER NOT NULL DEFAULT 0
    CHECK (awards_stamp IN (0, 1)),
  active INTEGER NOT NULL DEFAULT 1
    CHECK (active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_challenge_photo_wedding
  ON challenge_photo_missions(wedding_key, active, sort_order, id);

CREATE TABLE IF NOT EXISTS challenge_stamp_cards (
  id TEXT PRIMARY KEY NOT NULL
    CHECK (length(id) >= 2 AND length(id) <= 40),
  wedding_key TEXT NOT NULL,
  name TEXT NOT NULL
    CHECK (length(name) >= 2 AND length(name) <= 80),
  stamps_required INTEGER NOT NULL
    CHECK (stamps_required >= 1 AND stamps_required <= 50),
  reward_text TEXT NOT NULL
    CHECK (length(reward_text) >= 2 AND length(reward_text) <= 200),
  active INTEGER NOT NULL DEFAULT 1
    CHECK (active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_challenge_stamp_cards_wedding
  ON challenge_stamp_cards(wedding_key, active, sort_order, id);

INSERT INTO schema_migrations (version, applied_at)
VALUES ('0013', datetime('now'))
ON CONFLICT(version) DO NOTHING;
