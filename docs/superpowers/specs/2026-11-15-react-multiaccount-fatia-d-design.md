# CaseBem — Fatia D: Minha página (slug + etapas)

## Objetivo

O tile **Minha página** deixa de ser “em breve”. A conta escolhe o slug público e edita história, data, local e etapas. Com slug, `/casal/:slug` passa a mostrar esse conteúdo (não só o parceiro). Sem slug, o convidado continua sem URL.

Complementa `docs/superpowers/specs/2026-11-14-react-multiaccount-design.md`. Onde esta spec calar, vale a spec-mãe.

## Fora de escopo

- Upload de fotos da página (R2 da galeria dos jogos permanece)
- Countdown genérico, looks de madrinha, marquee, playlist, hospedagem
- Desfazer slug (não há “despublicar”)
- Subdomínio por casal
- Redirects de URLs antigas
- Login Google / pagamento real

## Slug

- Formato: 3–40 caracteres, minúsculas, `[a-z0-9]`, hífen no meio; sem hífen no começo/fim; sem `--`.
- Normalização: `trim` + minúsculas **antes** de validar.
- Reservados (sempre 400 `SLUG_RESERVED` para conta não-parceira): `admin`, `entrar`, `casal`, `games`, `game`, `api`, `app`, `www`, `static`, `login`, `signup`, `conta`, `dani-carine`.
- Único em `accounts.slug` → 409 `SLUG_TAKEN`.
- Parceiro (`is_partner`): slug `dani-carine` **imóvel**. Tentativa de trocar → 403 `SLUG_LOCKED`. GET do admin devolve `slugLocked: true`.
- Conta comum pode trocar o slug (typo); o antigo deixa de resolver (404). Sem redirect do slug antigo.
- Cadastro continua sem slug. PUT sem campo `slug` não mexe no slug atual.
- `slug: ""` ou omitido na criação → 400 `SLUG_INVALID` se o cliente mandar string vazia. Não há endpoint para zerar.

`setAccountSlug` de testes/seed **não** é a API HTTP. A UI e `PUT /api/admin/page` usam `claimAccountSlug`.

## Conteúdo da página

Uma linha por `account_id` em `couple_pages`. Campos públicos (sem `id`, `email`, `account_id`, `weddingKey`):

| Campo | Tipo | Limite |
|---|---|---|
| `names` | 1 ou 2 strings | 1–40 cada |
| `dateLine` | string | 0–80 |
| `city` | string | 0–80 |
| `welcomeTitle` | string | 0–120 |
| `welcomeBody` | string | 0–4000 |
| `story` | string | 0–4000 |
| `venueName` | string | 0–80 |
| `venuePlace` | string | 0–120 |
| `mapsHref` | string | vazio ou `http(s)://` ≤ 500 |
| `dressTitle` | string | 0–80 |
| `dressRule` | string | 0–120 |
| `etapas` | `{ title, detail }[]` | máx. 8; `title` 1–80; `detail` 0–200 |

Campos omitidos no PUT não apagam os demais (merge). `etapas: []` é válido e zera a lista. Validação falha → 400 `VALIDATION` + `details`.

Parceiro: se a linha ainda não existe, o GET público/admin preenche os vazios com o texto atual de Dani & Carine (mesmos nomes, data, local, etapas Cerimônia/Brunch/Festa). Imagens do parceiro **continuam** em `PARTNER_COPY` (hardcoded). Conta nova: página vazia (strings `""`, `names: []`, `etapas: []`).

## APIs

| Método | Rota | Auth | Corpo / resposta |
|---|---|---|---|
| GET | `/api/admin/page` | cookie | `{ ok, slug, slugLocked, page }` — `slug` pode ser `null` |
| PUT | `/api/admin/page` | cookie | body `{ slug?, page? }`; 200 `{ ok, slug, slugLocked, page }`; 401 sem sessão |
| GET | `/api/casal/:slug` | pública | `{ ok, slug, isPartner, page }` — ainda **sem** `id`/`email` |

`GET /api/auth/me` já devolve `slug`; continua igual.

Vite (`db=null`) usa memória de processo, como auth/galeria — **não** 503.

## UI admin (`/admin/minha-pagina`)

- Substitui `ComingSoon`.
- Formulário: slug (readonly se `slugLocked`) + campos da tabela acima. Etapas: até 8 pares título/detalhe, botão “Adicionar etapa”.
- Sucesso: `role="status"` “Página publicada.” + link `/casal/:slug` se houver slug.
- Erros: `SLUG_TAKEN` → “Este endereço já está em uso”; `SLUG_RESERVED` → “Este endereço não está disponível”; `SLUG_LOCKED` → “O endereço do casal parceiro não muda”; `SLUG_INVALID` → “Use 3 a 40 letras minúsculas, números ou hífen”; `VALIDATION` → “Confira os campos da página.”
- Sem sessão → `/entrar` (já no `RequireAuth`).

## Site público

- Slug inexistente: 404 `Página não encontrada` (já existe).
- Parceiro: `PartnerHome` lê textos de `page`; fotos/madrinha/countdown/marquee ficam como hoje.
- Demais contas: `CoupleHome` com as mesmas âncoras do nav (`#boas-vindas`, `#o-casal`, `#o-dia`, `#local`, RSVP, presentes, mural). Sem fotos hardcoded. Título `names.join(' & ')` ou, se `names` vazio, o slug. `document.title` idem.
- RSVP / presentes / mural já isolados por slug (fatias B/C) — reutilizar.

## Dados

`migrations/0022_couple_pages.sql`:

```sql
CREATE TABLE IF NOT EXISTS couple_pages (
  account_id TEXT PRIMARY KEY NOT NULL,
  names_json TEXT NOT NULL DEFAULT '[]',
  date_line TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  welcome_title TEXT NOT NULL DEFAULT '',
  welcome_body TEXT NOT NULL DEFAULT '',
  story TEXT NOT NULL DEFAULT '',
  venue_name TEXT NOT NULL DEFAULT '',
  venue_place TEXT NOT NULL DEFAULT '',
  maps_href TEXT NOT NULL DEFAULT '',
  dress_title TEXT NOT NULL DEFAULT '',
  dress_rule TEXT NOT NULL DEFAULT '',
  etapas_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL
);
```

Sem backfill SQL do parceiro: o serviço aplica defaults em memória/leitura.

## Testes (TDD, `node --test`)

1. `normalizeSlug` / formato / reservados
2. `claimAccountSlug`: unique 409, partner lock 403, sucesso grava minúsculo
3. Admin GET/PUT 401 sem cookie; PUT isola A/B; JSON público sem UUID
4. `GET /api/casal/:slug` inclui `page`; parceiro tem etapas Cerimônia/Brunch/Festa mesmo sem linha
5. Conta nova com slug e página preenchida aparece no template (não “Em breve”)
6. `ComingSoon` some de `/admin/minha-pagina`

## Entrega

Uma fatia, um plano TDD. Depois: commit + push da branch, **sem PR para main**.
