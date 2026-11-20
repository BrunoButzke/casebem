# Modo sorteio sincronizado — Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Admin controla fases do sorteio no D1; telões (React + vanilla) fazem poll e sincronizam “em breve” → roleta 8s → ganhador + confete → galeria.

**Architecture:** Uma linha D1 por `wedding_key`; PUT autenticado; GET público; animação local via `started_at` + pool + vencedor.

**Tech Stack:** D1, Pages Functions, Games React, `/telao` vanilla ES5, CSS animations.

**Spec:** `docs/superpowers/specs/2026-11-20-raffle-draw-broadcast-design.md`

## Global Constraints

- Phases: `gallery` | `soon` | `spinning` | `winner`
- Spin duration: 8000 ms
- Sync: local reel from server fields (not frame-by-frame)
- Both `/games/galeria/telao` and `/telao`

---

### Task 1: Migration + broadcast service + APIs

**Files:**
- Create: `migrations/0034_desafio_raffle_draw_broadcast.sql`
- Create: `functions/_lib/draw-broadcast-service.mjs`
- Create: `functions/api/admin/raffles/draw/broadcast.js`
- Create: `functions/api/desafio/raffle/draw-broadcast.js`
- Create: `tests/draw-broadcast-service.test.mjs`
- Modify: `vite.config.js` (local stubs)
- Modify: `games/src/admin-api.js` + public fetch helper

- [ ] Migration table with CHECK on phase
- [ ] `getBroadcast` / `upsertBroadcast` in service
- [ ] Admin PUT + public GET
- [ ] Tests for default gallery + upsert phases
- [ ] Apply migration to prod D1

### Task 2: Shared reel helper + confetti

**Files:**
- Create: `games/src/draw-reel.mjs`
- Create: `games/src/confetti.js` (or reuse Selo if exists)
- Create: `tests/draw-reel.test.mjs`

- [ ] `reelDisplayAt({ pool, startedAt, durationMs, winnerNumber, now })`
- [ ] Confetti burst helper
- [ ] Unit tests for landing after duration

### Task 3: AdminSorteio modes + longer draw

**Files:**
- Modify: `games/src/pages/AdminSorteio.jsx`
- Modify: `games/src/styles.css`

- [ ] Modo sorteio / Modo telão buttons
- [ ] 8s spin + PUT spinning/winner
- [ ] Confetti on win
- [ ] Disable controls while spinning

### Task 4: Telão React + vanilla

**Files:**
- Modify: `games/src/pages/Telao.jsx`
- Modify: `games/src/styles.css`
- Modify: `public/telao/telao.js`, `telao.css`, `index.html`

- [ ] Poll broadcast
- [ ] soon / spinning / winner overlays
- [ ] Confetti once per startedAt
- [ ] ES5-friendly vanilla path

### Task 5: Verify

- [ ] Run unit tests
- [ ] Manual smoke checklist in PR notes
