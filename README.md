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

### O que está integrado

| Fluxo | Onde | Comportamento |
|-------|------|----------------|
| Presentes | `/dani-carine/` modal | Gera **Pix** (QR + copia-e-cola), consulta status |
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

- **Standard** R$ 299,90 — site + convite + lista → Pix
- **Plus** R$ 499,90 — Standard + app/dinâmicas + sessões + painel de mesas
- **VIP** R$ 1.199,90 — Plus + site exclusivo + link personalizado + assessor

## Conteúdo do exemplo

Dani & Carine — 21/11/2026, 8h, Indaiá Eventos, Florianópolis.
