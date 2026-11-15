CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('basic', 'pro', 'vip')),
  plan_status TEXT NOT NULL CHECK (plan_status IN ('active', 'pending_payment')),
  slug TEXT UNIQUE,
  is_partner INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_account ON sessions(account_id);
CREATE INDEX IF NOT EXISTS idx_accounts_slug ON accounts(slug);

INSERT INTO accounts (
  id, email, password_hash, password_salt, plan, plan_status, slug, is_partner, created_at
) VALUES (
  'partner-dani-carine',
  '',
  '',
  '',
  'pro',
  'active',
  'dani-carine',
  1,
  datetime('now')
);

-- account_id nas tabelas de casamento (SQLite ADD COLUMN)
ALTER TABLE gifts_catalog ADD COLUMN account_id TEXT NOT NULL DEFAULT 'partner-dani-carine';
ALTER TABLE rsvp_guest_list ADD COLUMN account_id TEXT NOT NULL DEFAULT 'partner-dani-carine';
ALTER TABLE guest_groups ADD COLUMN account_id TEXT NOT NULL DEFAULT 'partner-dani-carine';
ALTER TABLE wedding_settings ADD COLUMN account_id TEXT NOT NULL DEFAULT 'partner-dani-carine';
ALTER TABLE wedding_messages ADD COLUMN account_id TEXT NOT NULL DEFAULT 'partner-dani-carine';
ALTER TABLE stationery_templates ADD COLUMN account_id TEXT NOT NULL DEFAULT 'partner-dani-carine';
ALTER TABLE rsvps ADD COLUMN account_id TEXT NOT NULL DEFAULT 'partner-dani-carine';
ALTER TABLE challenge_questions ADD COLUMN account_id TEXT NOT NULL DEFAULT 'partner-dani-carine';
ALTER TABLE challenge_photo_missions ADD COLUMN account_id TEXT NOT NULL DEFAULT 'partner-dani-carine';
ALTER TABLE challenge_stamp_cards ADD COLUMN account_id TEXT NOT NULL DEFAULT 'partner-dani-carine';
ALTER TABLE desafio_gallery ADD COLUMN account_id TEXT NOT NULL DEFAULT 'partner-dani-carine';
ALTER TABLE desafio_theme ADD COLUMN account_id TEXT NOT NULL DEFAULT 'partner-dani-carine';
ALTER TABLE checkout_intents ADD COLUMN account_id TEXT NOT NULL DEFAULT 'partner-dani-carine';

CREATE INDEX IF NOT EXISTS idx_gifts_account ON gifts_catalog(account_id);
CREATE INDEX IF NOT EXISTS idx_guests_account ON rsvp_guest_list(account_id);
CREATE INDEX IF NOT EXISTS idx_messages_account ON wedding_messages(account_id);

INSERT INTO schema_migrations (version, applied_at)
VALUES ('0021', datetime('now'))
ON CONFLICT(version) DO NOTHING;
