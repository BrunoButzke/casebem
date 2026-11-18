-- Contas Noiva/Noivo com acesso ao painel do casamento (máx. 2 por wedding_key).
-- Super admin da plataforma NÃO entra nesta tabela.

CREATE TABLE IF NOT EXISTS admin_members (
  id TEXT PRIMARY KEY,
  wedding_key TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('noiva', 'noivo')),
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_members_wedding_email
  ON admin_members(wedding_key, email);

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_members_wedding_role
  ON admin_members(wedding_key, role);

CREATE INDEX IF NOT EXISTS idx_admin_members_email
  ON admin_members(email);
