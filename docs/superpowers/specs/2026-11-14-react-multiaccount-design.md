# CaseBem — app React único e multi-conta (design)

## Objetivo

Um único app React (Vite + React Router) no Cloudflare Pages Free: landing em `/`, painel em `/admin`, site do casamento em `/casal/:slug`, jogos em `/casal/:slug/game`. Uma conta = um casal. O admin é a fonte da verdade; a página pública é o que esse painel publica.

## Fora de escopo

- Login Google (fica para depois; não desenhar OAuth)
- Recuperação de senha
- Stripe / checkout real (botão e status “pagamento em breve” só)
- Editor de slug / etapas (**Minha página** nesta versão é só “em breve”)
- Redirects de URLs antigas (`/landing-page-animada`, `/dani-carine`, `/games`, `desafio.casebem.com`)
- Playlist / vídeo e hospedagem (saem do produto; tabelas D1 podem permanecer, sem UI/API nova)
- Subdomínio por casal e Cloudflare for SaaS
- Workers Paid

A spec `docs/superpowers/specs/2026-11-13-casebem-react-shell-design.md` (casca `/app`) fica **substituída** por esta.

## Restrições (Cloudflare Free)

- Pages + Functions + D1 + R2, sem custo extra de hostname
- Assets estáticos ilimitados; Functions: 100 mil req/dia, 10 ms CPU/invocação
- Hash de senha: Web Crypto **PBKDF2-SHA-256**, 10 000 iterações, salt 16 bytes, chave 32 bytes (cabe no limite de CPU)
- Sem JWT, sem Cloudflare Access

## Arquitetura

O `index.html` da raiz do repo vira o SPA (Vite + React Router), com code-split por superfície (landing, admin, casal, game). `functions/` continua nas APIs. Middleware do Pages: caminho com extensão e `/api/*` seguem; `/casal` (sem slug) responde 302 para `/entrar`; qualquer outra rota HTML reescreve para `/` (o `index.html` do SPA — nunca `/games/` nem `/landing-page-animada/`).

Saem como apps separados: `landing-page-animada/`, `dani-carine/*.html`, `games/` como SPA com basename próprio, `app/`.

Sessão: cookie `cb_session` opaco (`HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`). Valor = id em `sessions`. Sem token no `localStorage`. APIs de admin **ignoram** `wedding_key` / `account_id` mandados pelo cliente; o inquilino vem só da sessão.

O Bearer `ADMIN_PANEL_SECRET` deixa de autenticar a UI e as rotas `/api/admin/*`. Substitui `requireAdmin` por sessão de conta.

## URLs

| Caminho | Superfície | Auth |
|---|---|---|
| `/` | Landing (criar conta) | pública |
| `/entrar` | Login | pública; com sessão válida → `/admin` |
| `/admin` | Painel | cookie; sem sessão → `/entrar` |
| `/casal/:slug` | Site do casamento | pública; slug inexistente → 404 |
| `/casal/:slug/game/*` | Jogos daquele casal | pública; slug inexistente → 404 |
| `/casal` (sem slug) | — | middleware 302 → `/entrar` |
| `/api/*` | Functions | cada rota decide |

Jogos (basename `/casal/:slug/game`): `/`, `/quiz`, `/desafios`, `/selo`, `/ranking`, `/galeria`, `/galeria/telao`.

## Conta e planos

- Um e-mail = uma conta = um casal. Sem slug no cadastro.
- Cadastro: e-mail (trim, minúsculo, único), senha (≥ 8), plano `basic` \| `pro` \| `vip`. Plano omitido → `basic`. Sucesso: cookie + redirect `/admin`.
- Login: e-mail + senha → cookie + `/admin`.
- Logout: apaga a linha em `sessions` e o cookie.

| Evento | `plan` | `plan_status` | Efeito no admin |
|---|---|---|---|
| Cadastro Básico | `basic` | `active` | usa normal |
| Cadastro Pro ou VIP | `pro` / `vip` | `pending_payment` | usa normal + aviso “pagamento em breve” |
| Upgrade a partir de Básico | `pro` / `vip` | `pending_payment` | idem |
| Cobrança pendente | — | — | **não** trava rotas; **nunca** HTTP 402 |

Sem downgrade. Sem pagamento real.

Landing: some a lista de espera. Seções de marketing (como funciona, temas, cards, planos) permanecem. CTAs “Lista de espera” / “Entrar na lista” viram criar conta (`#cadastro`). “Quero o Básico/Pro/VIP” pré-seleciona o plano e rola ao form. Rádio padrão: **Básico**. “Entrar” → `/entrar`. “Ver exemplo Dani & Carine” → `/casal/dani-carine`.

## Painel (`/admin`)

Admin é a fonte; a página pública nasce dele. Toda conta vê o **mesmo hub** (não um painel “só parceiro”).

Tiles:

1. Minha página — slug e etapas; nesta versão só **em breve** (sem formulário de slug)
2. Lista de convidados
3. Presentes
4. Papelaria (templates WhatsApp; não é seção do site público)
5. Mural de recados
6. Entretenimento (desafios, jogos, ranking)
7. Álbum compartilhado

Cabeçalho: marca, e-mail, selo do plano, Sair. Se `plan_status = pending_payment`, aviso visível e não bloqueante. Conta Básico: tiles Entretenimento e Álbum visíveis; o clique mostra CTA de upgrade (são Pro/VIP). Os demais tiles funcionam com dados vazios daquela conta.

Sem tiles de playlist/vídeo e hospedagem.

Dados gravados no D1 com `account_id` da sessão, **mesmo sem slug**. Convidado não vê nada até Minha página existir (fatia futura).

Parceiro: `id` estável `partner-dani-carine`, `is_partner = 1`, `slug = dani-carine` (imóvel nesta versão). Login é e-mail/senha, não usuário `Dani` / senha `Carine` na UI. A migração cria essa conta e faz backfill das linhas atuais para esse `account_id`. E-mail e hash só são preenchidos por seed em código (Function ou script) quando existem `PARTNER_EMAIL` e `PARTNER_BOOTSTRAP_PASSWORD` — nunca commitados, nunca senha em texto no SQL. Sem essas env, o backfill vale; o login do parceiro permanece indisponível.

## Site público e jogos

Um template React, não um HTML por casal. Resolve `slug` → `accounts.id`. Sem linha ou slug nulo → 404.

Não há modal de login dos noivos no site do casamento.

| No site | Origem no admin |
|---|---|
| História, data, local, etapas | Minha página (em breve). Parceiro: conteúdo atual portado |
| Confirmar presença | Lista de convidados |
| Presentes → Pix | Presentes |
| Mural | Mural de recados |

Papelaria não renderiza no site. Playlist e hospedagem não renderizam. Jogos só em `/casal/:slug/game`. APIs públicas (RSVP, mural, presentes, galeria, ranking) resolvem slug → `account_id` e **não** misturam casais.

Nesta versão só o parceiro tem slug, então só `/casal/dani-carine` e `/casal/dani-carine/game` existem de fato.

## Dados (D1)

### `accounts`

- `id` TEXT PK
- `email` TEXT NOT NULL UNIQUE (sempre minúsculo)
- `password_hash` TEXT NOT NULL
- `password_salt` TEXT NOT NULL
- `plan` TEXT NOT NULL CHECK (`basic`, `pro`, `vip`)
- `plan_status` TEXT NOT NULL CHECK (`active`, `pending_payment`)
- `slug` TEXT UNIQUE (nullable)
- `is_partner` INTEGER NOT NULL DEFAULT 0
- `created_at` TEXT NOT NULL

### `sessions`

- `id` TEXT PK (valor do cookie)
- `account_id` TEXT NOT NULL → `accounts.id`
- `expires_at` TEXT NOT NULL (14 dias a partir do login/cadastro)
- `created_at` TEXT NOT NULL

Índice: `sessions(account_id)`, `accounts(slug)` onde slug NÃO NULL.

Tabelas de casamento existentes (`rsvp_guest_list`, `guest_groups`, `rsvps`, `gifts_catalog`, `wedding_messages`, `stationery_templates`, `wedding_settings`, `challenge_*`, `desafio_gallery`, `desafio_theme`, `checkout_intents`, etc.) ganham `account_id` TEXT NOT NULL + índice. Migração: cria a conta parceira, preenche `account_id` em todas as linhas atuais. `wedding_key` pode permanecer nas colunas antigas durante a transição; **leituras/escritas novas filtram por `account_id`**.

`lodging_tips` e `media_playlist`: sem mudança de produto; não expor no app novo.

## APIs

| Método | Rota | Auth | Comportamento |
|---|---|---|---|
| POST | `/api/auth/signup` | pública | body `{ email, password, plan }`; 201 + `Set-Cookie`; 409 e-mail; 400 validação |
| POST | `/api/auth/login` | pública | 200 + cookie; 401 credencial inválida (mesma mensagem para e-mail e senha) |
| POST | `/api/auth/logout` | opcional | 204 sempre (com ou sem cookie); se havia sessão, apaga a linha e expira o cookie |
| GET | `/api/auth/me` | cookie | `{ email, plan, planStatus, slug, isPartner }` — `slug` é `null` se ainda não publicado |
| POST | `/api/account/plan` | cookie | body `{ plan: "pro" \| "vip" }`; só se a conta está `basic`; senão 400; seta `pending_payment` |
| * | `/api/admin/*` | cookie | contrato atual das rotas existentes, sempre `WHERE account_id = sessão` |
| * | APIs públicas de casal/game | slug | 404 se slug não resolver |

Signup/login usam a tabela `rate_limits` já existente. Cookie: `cb_session=<id>; HttpOnly; SameSite=Lax; Path=/; Max-Age=1209600`. Atributo `Secure` só em HTTPS (em `localhost` HTTP o Vite precisa receber o cookie).

## Erros

- 401: sem cookie, sessão expirada, ou admin sem sessão
- 400: e-mail inválido, senha < 8, plano fora do enum
- 409: e-mail já cadastrado
- 404: slug desconhecido em página ou API pública
- Sem 402 para pagamento pendente
- 503: D1 ausente (padrão atual das Functions)

## Testes (obrigatório TDD)

Runner: `node --test`, como o restante do repo. Nenhum código de produção dessas regras sem teste que tenha falhado primeiro.

Cobertura mínima:

1. `resolvePagesRoute`: `/` não redireciona para landing antiga; `/admin`, `/casal/x`, `/casal/x/game/quiz` reescrevem para o SPA; `/api/*` e arquivos com extensão passam
2. Signup cria `accounts` + `sessions` + cookie; plano default `basic`/`active`; `pro`/`vip` → `pending_payment`
3. E-mail duplicado → 409; senha curta → 400
4. Login seta cookie; senha errada → 401; logout invalida sessão; `/api/auth/me` 401 sem cookie
5. Isolamento: conta B não lê/escreve presente, lista ou recado da conta A (IDOR), mesmo enviando `wedding_key` alheio
6. Slug inexistente → 404 no resolvedor público
7. Upgrade `basic` → `pro` deixa `pending_payment`; `GET /api/auth/me` devolve `planStatus: "pending_payment"`; o hub do admin permanece utilizável
8. Seed parceiro: `slug = dani-carine`, `is_partner = 1`, linhas antigas com o `account_id` dessa conta

Sem testes novos de playlist ou hospedagem como feature.

## Entrega em fatias (specs de implementação)

Uma arquitetura, vários planos TDD (cada um software testável):

| Fatia | Entrega |
|---|---|
| A | Rotas SPA, cadastro/login/cookie, landing sem waitlist, admin hub (tiles acima), APIs admin por `account_id`, seed parceiro |
| B | Template público `/casal/:slug` (parceiro primeiro) |
| C | Jogos em `/casal/:slug/game` com APIs pelo slug |
| D | Minha página (slug + etapas) — **não** esta spec além do tile “em breve” |

A fatia A é o primeiro plano a escrever depois desta spec aprovada.
