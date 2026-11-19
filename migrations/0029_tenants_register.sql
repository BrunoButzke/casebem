-- Cadastro de casamentos (tenants) + nome de exibição nos acessos
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  noiva_name TEXT NOT NULL,
  noivo_name TEXT NOT NULL,
  couple_names TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'basic',
  admin_path TEXT NOT NULL,
  site_path TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_owner_email
  ON tenants(owner_email);

CREATE INDEX IF NOT EXISTS idx_tenants_created_at
  ON tenants(created_at);

ALTER TABLE admin_members ADD COLUMN display_name TEXT;

-- Seed do casal parceiro atual (idempotente)
INSERT OR IGNORE INTO tenants (
  id, noiva_name, noivo_name, couple_names, owner_email, plan,
  admin_path, site_path, created_at, updated_at
) VALUES (
  'dani-carine',
  'Carine',
  'Dani',
  'Dani & Carine',
  'dani-carine@casebem.local',
  'vip',
  '/dani-carine/admin',
  '/dani-carine/',
  datetime('now'),
  datetime('now')
);
