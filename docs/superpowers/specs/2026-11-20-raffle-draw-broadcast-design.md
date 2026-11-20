# Design: Modo sorteio sincronizado (admin ↔ telões)

**Date:** 2026-11-20  
**Status:** Approved for planning  
**Stack:** Cloudflare Pages Functions + D1 · Games SPA (React) · Telão vanilla `/telao`

## Goal

A noiva controla o clima do sorteio pelo admin em `/admin/sorteio`. Vários telões (aparelhos distintos) passam a:

1. **Modo sorteio** → tela “Sorteio em breve” (animação leve)
2. **Sortear** → roleta de números ~8s, sincronizada com o admin
3. **Fim** → número + nome do ganhador + confete
4. **Modo telão** → volta a slideshow da galeria

## Non-goals

- WebSocket / Durable Objects
- Persistência histórica de sorteios (quem ganhou no passado)
- Alterar compra de números / checkout Pix
- Sincronia frame-a-frame do dígito exibido

## Decisions locked

| Topic | Choice |
|--------|--------|
| Sync entre aparelhos | Estado no **D1**, telões fazem **poll** |
| Animação da roleta | Cada cliente anima **localmente** a partir de `started_at` + vencedor + pool |
| Duração do spin | **8000 ms** |
| Telões afetados | React `/games/galeria/telao` **e** vanilla `/telao` |

## Architecture

```
AdminSorteio  --PUT (auth)-->  /api/admin/raffles/draw/broadcast  --> D1
Telao /telao  --GET (public)--> /api/desafio/raffle/draw-broadcast  <-- D1
```

Phases (single source of truth):

`gallery` → `soon` → `spinning` → `winner` → `gallery`

## Data model

Table `desafio_raffle_draw_broadcast` — **one row per `wedding_key`**.

| Column | Type | Notes |
|--------|------|--------|
| `wedding_key` | TEXT PK | e.g. `dani-carine` |
| `phase` | TEXT | `gallery` \| `soon` \| `spinning` \| `winner` |
| `started_at` | TEXT NULL | ISO start of spin (also keys confetti once) |
| `duration_ms` | INTEGER | default `8000` |
| `winner_number` | INTEGER NULL | set when entering `spinning` |
| `winner_name` | TEXT NULL | guest name or null |
| `raffle_id` | TEXT NULL | active raffle id |
| `pool_json` | TEXT NULL | JSON array of `{ number, guestName }` used by reel |
| `updated_at` | TEXT NOT NULL | ISO |

CHECK: `phase IN ('gallery','soon','spinning','winner')`.

Migration: `0034_desafio_raffle_draw_broadcast.sql` (+ apply remote when deploying).

## API

### `PUT /api/admin/raffles/draw/broadcast` (admin auth)

Body (partial updates allowed; server validates transitions):

```json
{
  "phase": "soon" | "spinning" | "winner" | "gallery",
  "winnerNumber": 41,
  "winnerName": "Carine",
  "raffleId": "alexa-mega-blaster-irada",
  "durationMs": 8000,
  "pool": [{ "number": 7, "guestName": "Carine" }],
  "startedAt": "2026-11-20T21:00:00.000Z"
}
```

Rules:

- `soon` / `gallery`: set `phase`; on `gallery` clear spin fields.
- `spinning`: requires `winnerNumber`, non-empty `pool`, `raffleId`. Server sets `started_at` if omitted.
- `winner`: requires winner fields already set or provided; idempotent.

Response: `{ ok: true, broadcast: { ...public shape } }`.

### `GET /api/desafio/raffle/draw-broadcast` (public)

Returns broadcast public shape; if no row: `{ ok: true, broadcast: { phase: "gallery" } }`.

Tenant: default `dani-carine` for `/games` and `/telao`.

## Client behavior

### Admin

- **Modo sorteio** → `PUT phase=soon`
- **Modo telão** → `PUT phase=gallery`
- **Sortear** → pick winner → `PUT spinning` → local 8s reel → `PUT winner` + confetti
- Disable controls while spinning

### Telões

- Poll ~2s; phases soon / spinning / winner / gallery
- Confetti once per `startedAt`
- Vanilla ES5-friendly (CSS animations preferred)

## Testing

- Unit: reel helper lands on winner after duration; service upsert
- API: admin auth; public GET default
