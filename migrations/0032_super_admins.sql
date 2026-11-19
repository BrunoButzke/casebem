-- Super admins da plataforma (fora de admin_members / tenants).
-- Credenciais NÃO ficam no código-fonte; seed inicial do dono CaseBem.

CREATE TABLE IF NOT EXISTS super_admins (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_super_admins_email
  ON super_admins(email);

-- Senha inicial: admin (PBKDF2). Trocar após o primeiro login seguro.
INSERT OR IGNORE INTO super_admins (id, email, password_hash, created_at, updated_at)
VALUES (
  'super-bruno',
  'brunobutzkesouza@gmail.com',
  'pbkdf2$100000$a1b2c3d4e5f60718293a4b5c6d7e8f90$17a434ff87fda4ef6910bd5a37944be0b59239482395aa860f37a566eac6ddcc',
  datetime('now'),
  datetime('now')
);
