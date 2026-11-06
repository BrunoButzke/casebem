# CaseBem · Landing + exemplo Dani & Carine

Produto **CaseBem** e o site do casal parceiro.

## Rotas

| URL | Página |
|-----|--------|
| `/landing-page-animada/` | Landing do produto CaseBem |
| `/dani-carine/` | Exemplo de casal parceiro |
| `/` | Redireciona para a landing |

## Desenvolvimento

```bash
cp .env.example .env
# Cole o Access Token de TESTE do Mercado Pago em MP_ACCESS_TOKEN
npm install
npm run dev
```

Abre em `/landing-page-animada/`.

## Mercado Pago

1. Crie um app em [Suas integrações](https://www.mercadopago.com.br/developers/panel/app).
2. Copie o **Access Token** (teste → produção depois).
3. No `.env` local: `MP_ACCESS_TOKEN=APP_USR-...`
4. No Cloudflare Pages: Settings → Environment variables → `MP_ACCESS_TOKEN` (produção).
5. Painel noivos (Free): `ADMIN_PANEL_SECRET` (≥16 chars) → `/dani-carine/admin.html`
6. Opcional e-mail (Resend free, fora da CF): `RESEND_API_KEY` + `ADMIN_NOTIFY_EMAIL`
7. Webhook MP (Pix + cartão/boleto): `https://seu-dominio/api/webhooks/mercadopago`
8. Migration `0005_admin_and_paid.sql` no D1 após deploy
9. Migration `0006_rsvp_closed.sql` — RSVP aberto/fechado + lista no painel
10. Migration `0007_gifts_catalog.sql` — catálogo editável no painel (`/api/gifts/catalog`)
11. Migration `0008_lodging_tips.sql` — hospedagem/dicas no site + painel (`/api/lodging`)
12. Migration `0009_stationery.sql` — papelaria / convite WhatsApp (`/api/stationery`)
13. Migration `0010_media_playlist.sql` — playlist/vídeo YouTube (`/api/media`)
14. Painel: export CSV presentes pagos — `GET /api/admin/gifts.csv` (sem migration)

**Custo:** mantenha **Workers/Pages Free**. Não ative Workers Paid. E-mail é opcional e externo. Subdomínio `casal.casebem.com` fica para depois (Cloudflare for SaaS).

### O que está integrado

| Fluxo | Onde | Comportamento |
|-------|------|----------------|
| Presentes | `/dani-carine/` modal | **Pix** (QR) + **cartão/boleto** (Checkout Pro redirect) |
| Planos | Landing → lista de espera → **Pagar plano agora** | Checkout Pro (redirect MP) |

APIs (dev via Vite; prod via Cloudflare Pages Functions):

- `POST /api/create-pix`
- `GET /api/payment-status?id=`
- `POST /api/create-preference`

O dinheiro cai na conta Mercado Pago ligada a esse Access Token (sua SLU / CaseBem). Presentes no casal (split/OAuth) ficam para um passo seguinte.

## Build

```bash
npm run build
```

Saída em `dist/` (Cloudflare Pages: build `npm run build`, output `dist`). A pasta `functions/` sobe junto no Pages.

## Planos (marketing)

- **Básico** Gratuito — site + convite + lista → Pix
- **Pro** R$ 299,00 — Básico + app/dinâmicas + sessões + painel de mesas
- **VIP** R$ 499,00 — Pro + site exclusivo + link personalizado + assessor

## Conteúdo do exemplo

Dani & Carine — 21/11/2026, 8h, Indaiá Eventos, Florianópolis.
