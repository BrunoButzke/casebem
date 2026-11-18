-- Lista de espera da landing (Garanta a vaga)
CREATE TABLE IF NOT EXISTS waitlist_signups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('basic', 'pro', 'vip')),
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_waitlist_signups_email
  ON waitlist_signups(email);

CREATE INDEX IF NOT EXISTS idx_waitlist_signups_created_at
  ON waitlist_signups(created_at);
