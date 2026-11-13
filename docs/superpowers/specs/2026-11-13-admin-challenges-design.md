# Admin Desafios — design (fatia A)

## Objetivo
No painel HTML dos noivos (`dani-carine/admin.html`), permitir cadastrar o conteúdo de **Desafios** sem ainda expor o jogo aos convidados.

## Escopo
Inclui:
- Seção **Desafios** a partir do card em Entretenimento
- CRUD de **perguntas** (múltipla escolha)
- CRUD de **desafios de fotografia**
- CRUD de **cartões virtuais de selos** (vários por casamento)
- Persistência D1 + mock Vite local + auth admin existente

Fora desta fatia:
- App do convidado (`/app/desafios` jogável)
- Upload/moderação de fotos
- Progresso, ranking, resgate de prêmio
- Card **Jogos** / ligação Álbum ↔ desafios
- Migrar este CRUD para React
- Reordenação drag-and-drop (`sort_order` fica 0 / append na criação)

## Decisões fechadas
- Fatia **só admin**
- Quiz: **uma** resposta correta; pontos só se acertar (regra do jogo futuro)
- Selos vêm **somente** de desafios de foto com “vale selo”
- Foto com selo → sempre **1 selo** (não configurável por missão)
- **Vários** cartões: cada um com meta de selos + texto do prêmio
- Implementação no **admin HTML** (padrão Presentes/Papelaria), não no React nesta fatia

## Navegação e UI
1. Entretenimento mantém botão **Acesso** (link + QR).
2. Card **Desafios** abre seção com três blocos:
   - **Perguntas** — grid de cards; `+` abre modal criar/editar
   - **Desafios de foto** — idem
   - **Cartões de selos** — idem
3. Cards inativos com opacidade reduzida (como catálogo).
4. Exclusão com confirmação simples (`confirm`).

### Formulário — Pergunta
- Enunciado (obrigatório)
- Até 4 respostas; validar **2–4** não vazias
- Radio/seleção da **resposta correta** (índice)
- Pontos (inteiro)
- Ativo (checkbox)

### Formulário — Desafio de foto
- Título
- Pontos
- Toggle **Vale 1 selo**
- Ativo

### Formulário — Cartão de selos
- Nome do cartão
- Quantidade de selos para completar (`stamps_required`)
- Prêmio (`reward_text`, texto livre — ex.: drink, lembrancinha)
- Ativo

## Dados (D1)
Migração `0013_challenges.sql` (ou próximo número livre).

### `challenge_questions`
- `id` TEXT PK
- `wedding_key` TEXT NOT NULL
- `prompt` TEXT NOT NULL
- `options_json` TEXT NOT NULL — JSON array de 2–4 strings
- `correct_index` INTEGER NOT NULL — 0-based, menor que o número de opções
- `points` INTEGER NOT NULL
- `active` INTEGER NOT NULL DEFAULT 1
- `sort_order` INTEGER NOT NULL DEFAULT 0
- `updated_at` TEXT NOT NULL

### `challenge_photo_missions`
- `id` TEXT PK
- `wedding_key` TEXT NOT NULL
- `title` TEXT NOT NULL
- `points` INTEGER NOT NULL
- `awards_stamp` INTEGER NOT NULL DEFAULT 0 — 0|1
- `active` INTEGER NOT NULL DEFAULT 1
- `sort_order` INTEGER NOT NULL DEFAULT 0
- `updated_at` TEXT NOT NULL

### `challenge_stamp_cards`
- `id` TEXT PK
- `wedding_key` TEXT NOT NULL
- `name` TEXT NOT NULL
- `stamps_required` INTEGER NOT NULL
- `reward_text` TEXT NOT NULL
- `active` INTEGER NOT NULL DEFAULT 1
- `sort_order` INTEGER NOT NULL DEFAULT 0
- `updated_at` TEXT NOT NULL

Índices por `wedding_key` (+ active/sort onde fizer sentido).  
Sem tabelas de progresso do convidado nesta fatia.

## Validação
| Entidade | Regras |
|----------|--------|
| Pergunta | prompt 2–200; 2–4 opções (trim, não vazias); `correct_index` válido; points 1–999 |
| Foto | title 2–100; points 1–999; awards_stamp 0\|1 |
| Cartão | name 2–80; stamps_required 1–50; reward_text 2–200 |

## API
Auth: mesmo token/header das rotas `/api/admin/*`.

| Método | Rota | Ação |
|--------|------|------|
| GET | `/api/admin/challenges/questions` | listar |
| POST | `/api/admin/challenges/questions` | criar |
| PATCH | `/api/admin/challenges/questions` | atualizar (body com `id`) |
| DELETE | `/api/admin/challenges/questions?id=` | remover |
| GET/POST/PATCH/DELETE | `/api/admin/challenges/photo-missions` | idem |
| GET/POST/PATCH/DELETE | `/api/admin/challenges/stamp-cards` | idem |

Respostas no estilo existente: `{ ok, ... }` / erros com `message`.  
Service layer em `functions/_lib/` (ex.: `challenges-service.mjs` + validators).  
Vite: store em memória no plugin de middleware (paridade com gifts/stationery).

## Arquivos previstos (orientação)
- `dani-carine/admin.html` + `src/dani-carine/admin.css` — UI
- `functions/api/admin/challenges/*.js` — rotas
- `functions/_lib/challenges-*.mjs` — service/validators
- `migrations/0013_challenges.sql`
- `vite.config.js` — mocks
- `tests/challenges-*.test.mjs` — validadores/service

## Critérios de pronto
- Noivos criam/editam/excluem/ativam os três tipos pelo admin
- Dados persistem no mock Vite e no schema D1 documentado
- Entretenimento → Desafios navegável; Acesso (QR) intacto
- Sem regressão nas seções já existentes do admin
