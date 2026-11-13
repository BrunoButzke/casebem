# CaseBem híbrido — casca React (design)

## Decisão
- Site do casamento (`dani-carine/`, landing) permanece HTML + Vite.
- Produto CaseBem (admin, desafios, propaganda) nasce em React + Vite na pasta `app/`.
- URL base: `/app/*`. APIs continuam em `functions/`.

## Fatia 1 — casca
- Login (credencial temporária, mesmo token do admin local).
- Home mobile com cards (Admin, Desafios).
- Stubs: `/app/admin` (link/ponte pro painel HTML), `/app/desafios`.
- Bottom nav pós-login. Sem PWA nesta fatia.

## Fora de escopo agora
- Migrar CRUD do admin HTML para React.
- Implementar desafios de verdade.
- Auth definitiva.
EOF
