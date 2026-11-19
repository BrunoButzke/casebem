-- Normaliza paths de tenants para /{slug}/ e /{slug}/admin
UPDATE tenants
SET
  admin_path = '/' || id || '/admin',
  site_path = '/' || id || '/',
  updated_at = datetime('now')
WHERE admin_path LIKE '%dani-carine%'
   OR admin_path LIKE '%.html'
   OR site_path = '/dani-carine/';
