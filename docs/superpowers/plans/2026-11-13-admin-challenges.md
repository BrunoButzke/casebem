# Admin Desafios (quiz, fotos, cartões) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** No painel HTML dos noivos, cadastrar perguntas de múltipla escolha, desafios de foto (com selo opcional) e vários cartões virtuais de selos — só admin, sem jogo dos convidados.

**Architecture:** Validators + service com store em memória (Vite) e D1 (produção), três rotas admin REST espelhando papelaria/presentes, UI em `dani-carine/admin.html` na seção Desafios aberta a partir do card em Entretenimento.

**Tech Stack:** Cloudflare Pages Functions, D1, Vite middleware mock, vanilla JS no admin, `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-13-admin-challenges-design.md`

## Global Constraints

- Fatia **somente admin** — sem progresso/upload/ranking do convidado
- Quiz: **uma** resposta correta; 2–4 opções; points 1–999
- Foto: `awards_stamp` 0|1 → se 1, sempre **1 selo**
- Vários cartões: `stamps_required` 1–50 + `reward_text`
- `wedding_key` fixo `dani-carine` (constante `WEDDING_KEY`)
- Padrão de erro service: `Error('VALIDATION')` com `err.details`, `NOT_FOUND`, `EXISTS`, `INVALID_ID`, `EMPTY_PATCH`
- Auth: `requireAdmin` como nas outras rotas `/api/admin/*`
- Não migrar este CRUD para React nesta fatia
- Commits só se o ambiente tiver `user.name`/`user.email`; senão stage + reportar

---

## File map

| File | Responsibility |
|------|----------------|
| `migrations/0013_challenges.sql` | Schema D1 das 3 tabelas |
| `functions/_lib/challenges-validators.mjs` | LIMITS + validate create/patch das 3 entidades |
| `functions/_lib/challenges-service.mjs` | CRUD memória + D1 |
| `functions/api/admin/challenges/questions.js` | HTTP questions |
| `functions/api/admin/challenges/photo-missions.js` | HTTP photo missions |
| `functions/api/admin/challenges/stamp-cards.js` | HTTP stamp cards |
| `tests/challenges-validators.test.mjs` | Testes de validação |
| `tests/challenges-service.test.mjs` | Testes CRUD memória |
| `vite.config.js` | Mocks `/api/admin/challenges/*` |
| `dani-carine/admin.html` | Seção + modais + JS |
| `src/dani-carine/admin.css` | Estilos grids/cards desafios |

---

### Task 1: Validators (TDD)

**Files:**
- Create: `functions/_lib/challenges-validators.mjs`
- Test: `tests/challenges-validators.test.mjs`

**Interfaces:**
- Produces:
  - `WEDDING_KEY = 'dani-carine'`
  - `CHALLENGE_LIMITS` object (prompt/title/name/reward/points/stamps/options bounds)
  - `validateQuestionCreate(body) → { valid, errors, data }`
  - `validateQuestionPatch(body) → { valid, errors, data }`
  - `validatePhotoMissionCreate(body) → { valid, errors, data }`
  - `validatePhotoMissionPatch(body) → { valid, errors, data }`
  - `validateStampCardCreate(body) → { valid, errors, data }`
  - `validateStampCardPatch(body) → { valid, errors, data }`
- `data` de create inclui: `id` (slug ou body.id), campos normalizados, `active` default true, `sortOrder` default 0
- Question `data.options`: `string[]` length 2–4; `correctIndex`: number

- [ ] **Step 1: Write failing tests**

Create `tests/challenges-validators.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WEDDING_KEY,
  CHALLENGE_LIMITS,
  validateQuestionCreate,
  validateQuestionPatch,
  validatePhotoMissionCreate,
  validateStampCardCreate,
} from '../functions/_lib/challenges-validators.mjs';

test('WEDDING_KEY', () => assert.equal(WEDDING_KEY, 'dani-carine'));

test('question create ok', () => {
  const r = validateQuestionCreate({
    prompt: 'Onde se conheceram?',
    options: ['Praia', 'Faculdade', 'App', ''],
    correctIndex: 1,
    points: 10,
  });
  assert.equal(r.valid, true);
  assert.deepEqual(r.data.options, ['Praia', 'Faculdade', 'App']);
  assert.equal(r.data.correctIndex, 1);
  assert.equal(r.data.points, 10);
});

test('question rejects 1 option', () => {
  const r = validateQuestionCreate({
    prompt: 'Pergunta?',
    options: ['Só uma'],
    correctIndex: 0,
    points: 5,
  });
  assert.equal(r.valid, false);
});

test('question rejects invalid correctIndex', () => {
  const r = validateQuestionCreate({
    prompt: 'Pergunta?',
    options: ['A', 'B'],
    correctIndex: 5,
    points: 5,
  });
  assert.equal(r.valid, false);
});

test('photo mission create with stamp', () => {
  const r = validatePhotoMissionCreate({
    title: 'Selfie com os noivos',
    points: 20,
    awardsStamp: true,
  });
  assert.equal(r.valid, true);
  assert.equal(r.data.awardsStamp, true);
  assert.equal(r.data.title, 'Selfie com os noivos');
});

test('stamp card create ok', () => {
  const r = validateStampCardCreate({
    name: 'Drink',
    stampsRequired: 5,
    rewardText: 'Drink do casamento',
  });
  assert.equal(r.valid, true);
  assert.equal(r.data.stampsRequired, 5);
});

test('stamp card rejects stampsRequired 0', () => {
  const r = validateStampCardCreate({
    name: 'Drink',
    stampsRequired: 0,
    rewardText: 'Drink',
  });
  assert.equal(r.valid, false);
});

test('question patch points only', () => {
  const r = validateQuestionPatch({ points: 15 });
  assert.equal(r.valid, true);
  assert.equal(r.data.points, 15);
  assert.equal(r.data.prompt, undefined);
});
```

- [ ] **Step 2: Run tests — expect FAIL (module missing)**

```bash
node --test tests/challenges-validators.test.mjs
```

Expected: ERR_MODULE_NOT_FOUND for `challenges-validators.mjs`

- [ ] **Step 3: Implement validators**

Create `functions/_lib/challenges-validators.mjs`:

```js
import { slugifyId } from './catalog-service.mjs';

export const WEDDING_KEY = 'dani-carine';

export const CHALLENGE_LIMITS = {
  PROMPT_MIN: 2,
  PROMPT_MAX: 200,
  TITLE_MIN: 2,
  TITLE_MAX: 100,
  NAME_MIN: 2,
  NAME_MAX: 80,
  REWARD_MIN: 2,
  REWARD_MAX: 200,
  OPTIONS_MIN: 2,
  OPTIONS_MAX: 4,
  POINTS_MIN: 1,
  POINTS_MAX: 999,
  STAMPS_MIN: 1,
  STAMPS_MAX: 50,
  ID_MIN: 2,
  ID_MAX: 40,
};

function normalizeOptions(raw) {
  const list = (Array.isArray(raw) ? raw : [])
    .map((s) => String(s || '').trim())
    .filter(Boolean)
    .slice(0, CHALLENGE_LIMITS.OPTIONS_MAX);
  return list;
}

function parseId(body, fallbackText) {
  const idRaw = body?.id != null ? String(body.id).trim() : '';
  return idRaw || slugifyId(fallbackText || 'item');
}

function validateId(id, errors) {
  if (
    id.length < CHALLENGE_LIMITS.ID_MIN ||
    id.length > CHALLENGE_LIMITS.ID_MAX ||
    !/^[a-z0-9][a-z0-9-]*$/.test(id)
  ) {
    errors.push('id inválido (a-z, 0-9, hífen)');
  }
}

export function validateQuestionCreate(body) {
  const errors = [];
  const prompt = String(body?.prompt || '').trim();
  const options = normalizeOptions(body?.options);
  const correctIndex = Number(body?.correctIndex);
  const points = Number(body?.points);
  const id = parseId(body, prompt);

  validateId(id, errors);
  if (prompt.length < CHALLENGE_LIMITS.PROMPT_MIN || prompt.length > CHALLENGE_LIMITS.PROMPT_MAX) {
    errors.push('prompt inválido');
  }
  if (options.length < CHALLENGE_LIMITS.OPTIONS_MIN || options.length > CHALLENGE_LIMITS.OPTIONS_MAX) {
    errors.push('informe de 2 a 4 respostas');
  }
  if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
    errors.push('resposta correta inválida');
  }
  if (!Number.isInteger(points) || points < CHALLENGE_LIMITS.POINTS_MIN || points > CHALLENGE_LIMITS.POINTS_MAX) {
    errors.push('points inválido');
  }

  return {
    valid: errors.length === 0,
    errors,
    data: {
      id,
      prompt,
      options,
      correctIndex,
      points,
      active: body?.active !== false,
      sortOrder: Number.isInteger(Number(body?.sortOrder)) ? Number(body.sortOrder) : 0,
    },
  };
}

export function validateQuestionPatch(body) {
  const errors = [];
  const out = {};
  if (body.prompt !== undefined) {
    const prompt = String(body.prompt || '').trim();
    if (prompt.length < CHALLENGE_LIMITS.PROMPT_MIN || prompt.length > CHALLENGE_LIMITS.PROMPT_MAX) {
      errors.push('prompt inválido');
    } else out.prompt = prompt;
  }
  if (body.options !== undefined || body.correctIndex !== undefined) {
    const options = body.options !== undefined ? normalizeOptions(body.options) : null;
    if (options) {
      if (options.length < CHALLENGE_LIMITS.OPTIONS_MIN || options.length > CHALLENGE_LIMITS.OPTIONS_MAX) {
        errors.push('informe de 2 a 4 respostas');
      } else out.options = options;
    }
    if (body.correctIndex !== undefined) {
      const correctIndex = Number(body.correctIndex);
      const len = out.options?.length;
      // caller/service must re-check against existing options if options omitted
      if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) {
        errors.push('resposta correta inválida');
      } else if (len != null && correctIndex >= len) {
        errors.push('resposta correta inválida');
      } else out.correctIndex = correctIndex;
    }
  }
  if (body.points !== undefined) {
    const points = Number(body.points);
    if (!Number.isInteger(points) || points < CHALLENGE_LIMITS.POINTS_MIN || points > CHALLENGE_LIMITS.POINTS_MAX) {
      errors.push('points inválido');
    } else out.points = points;
  }
  if (body.active !== undefined) {
    if (typeof body.active !== 'boolean') errors.push('active deve ser boolean');
    else out.active = body.active;
  }
  if (body.sortOrder !== undefined) {
    const sortOrder = Number(body.sortOrder);
    if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 10000) errors.push('sortOrder inválido');
    else out.sortOrder = sortOrder;
  }
  return { valid: errors.length === 0, errors, data: out };
}

export function validatePhotoMissionCreate(body) {
  const errors = [];
  const title = String(body?.title || '').trim();
  const points = Number(body?.points);
  const id = parseId(body, title);
  validateId(id, errors);
  if (title.length < CHALLENGE_LIMITS.TITLE_MIN || title.length > CHALLENGE_LIMITS.TITLE_MAX) {
    errors.push('title inválido');
  }
  if (!Number.isInteger(points) || points < CHALLENGE_LIMITS.POINTS_MIN || points > CHALLENGE_LIMITS.POINTS_MAX) {
    errors.push('points inválido');
  }
  return {
    valid: errors.length === 0,
    errors,
    data: {
      id,
      title,
      points,
      awardsStamp: Boolean(body?.awardsStamp),
      active: body?.active !== false,
      sortOrder: Number.isInteger(Number(body?.sortOrder)) ? Number(body.sortOrder) : 0,
    },
  };
}

export function validatePhotoMissionPatch(body) {
  const errors = [];
  const out = {};
  if (body.title !== undefined) {
    const title = String(body.title || '').trim();
    if (title.length < CHALLENGE_LIMITS.TITLE_MIN || title.length > CHALLENGE_LIMITS.TITLE_MAX) {
      errors.push('title inválido');
    } else out.title = title;
  }
  if (body.points !== undefined) {
    const points = Number(body.points);
    if (!Number.isInteger(points) || points < CHALLENGE_LIMITS.POINTS_MIN || points > CHALLENGE_LIMITS.POINTS_MAX) {
      errors.push('points inválido');
    } else out.points = points;
  }
  if (body.awardsStamp !== undefined) {
    if (typeof body.awardsStamp !== 'boolean') errors.push('awardsStamp deve ser boolean');
    else out.awardsStamp = body.awardsStamp;
  }
  if (body.active !== undefined) {
    if (typeof body.active !== 'boolean') errors.push('active deve ser boolean');
    else out.active = body.active;
  }
  if (body.sortOrder !== undefined) {
    const sortOrder = Number(body.sortOrder);
    if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 10000) errors.push('sortOrder inválido');
    else out.sortOrder = sortOrder;
  }
  return { valid: errors.length === 0, errors, data: out };
}

export function validateStampCardCreate(body) {
  const errors = [];
  const name = String(body?.name || '').trim();
  const rewardText = String(body?.rewardText || '').trim();
  const stampsRequired = Number(body?.stampsRequired);
  const id = parseId(body, name);
  validateId(id, errors);
  if (name.length < CHALLENGE_LIMITS.NAME_MIN || name.length > CHALLENGE_LIMITS.NAME_MAX) {
    errors.push('name inválido');
  }
  if (
    !Number.isInteger(stampsRequired) ||
    stampsRequired < CHALLENGE_LIMITS.STAMPS_MIN ||
    stampsRequired > CHALLENGE_LIMITS.STAMPS_MAX
  ) {
    errors.push('stampsRequired inválido');
  }
  if (rewardText.length < CHALLENGE_LIMITS.REWARD_MIN || rewardText.length > CHALLENGE_LIMITS.REWARD_MAX) {
    errors.push('rewardText inválido');
  }
  return {
    valid: errors.length === 0,
    errors,
    data: {
      id,
      name,
      stampsRequired,
      rewardText,
      active: body?.active !== false,
      sortOrder: Number.isInteger(Number(body?.sortOrder)) ? Number(body.sortOrder) : 0,
    },
  };
}

export function validateStampCardPatch(body) {
  const errors = [];
  const out = {};
  if (body.name !== undefined) {
    const name = String(body.name || '').trim();
    if (name.length < CHALLENGE_LIMITS.NAME_MIN || name.length > CHALLENGE_LIMITS.NAME_MAX) {
      errors.push('name inválido');
    } else out.name = name;
  }
  if (body.stampsRequired !== undefined) {
    const stampsRequired = Number(body.stampsRequired);
    if (
      !Number.isInteger(stampsRequired) ||
      stampsRequired < CHALLENGE_LIMITS.STAMPS_MIN ||
      stampsRequired > CHALLENGE_LIMITS.STAMPS_MAX
    ) {
      errors.push('stampsRequired inválido');
    } else out.stampsRequired = stampsRequired;
  }
  if (body.rewardText !== undefined) {
    const rewardText = String(body.rewardText || '').trim();
    if (rewardText.length < CHALLENGE_LIMITS.REWARD_MIN || rewardText.length > CHALLENGE_LIMITS.REWARD_MAX) {
      errors.push('rewardText inválido');
    } else out.rewardText = rewardText;
  }
  if (body.active !== undefined) {
    if (typeof body.active !== 'boolean') errors.push('active deve ser boolean');
    else out.active = body.active;
  }
  if (body.sortOrder !== undefined) {
    const sortOrder = Number(body.sortOrder);
    if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 10000) errors.push('sortOrder inválido');
    else out.sortOrder = sortOrder;
  }
  return { valid: errors.length === 0, errors, data: out };
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
node --test tests/challenges-validators.test.mjs
```

Expected: all tests pass

- [ ] **Step 5: Commit** (se git identity ok)

```bash
git add functions/_lib/challenges-validators.mjs tests/challenges-validators.test.mjs
git commit -m "feat(challenges): validators for quiz, photo missions and stamp cards"
```

---

### Task 2: Service memory CRUD (TDD)

**Files:**
- Create: `functions/_lib/challenges-service.mjs`
- Test: `tests/challenges-service.test.mjs`

**Interfaces:**
- Consumes: validators from Task 1; `slugifyId` already via validators
- Produces (all `db` nullable — `null` = memory):
  - `resetMemoryChallengesForTests()`
  - `listQuestionsAdmin(db)`, `createQuestion(db, body)`, `updateQuestion(db, id, patch)`, `deleteQuestion(db, id)`
  - `listPhotoMissionsAdmin(db)`, `createPhotoMission(db, body)`, `updatePhotoMission(db, id, patch)`, `deletePhotoMission(db, id)`
  - `listStampCardsAdmin(db)`, `createStampCard(db, body)`, `updateStampCard(db, id, patch)`, `deleteStampCard(db, id)`
- Domain shapes (camelCase):
  - Question: `{ id, weddingKey, prompt, options, correctIndex, points, active, sortOrder, updatedAt }`
  - PhotoMission: `{ id, weddingKey, title, points, awardsStamp, active, sortOrder, updatedAt }`
  - StampCard: `{ id, weddingKey, name, stampsRequired, rewardText, active, sortOrder, updatedAt }`

- [ ] **Step 1: Write failing service tests**

```js
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  resetMemoryChallengesForTests,
  createQuestion,
  listQuestionsAdmin,
  updateQuestion,
  deleteQuestion,
  createPhotoMission,
  createStampCard,
  listStampCardsAdmin,
} from '../functions/_lib/challenges-service.mjs';

beforeEach(() => resetMemoryChallengesForTests());

test('create and list question in memory', async () => {
  const q = await createQuestion(null, {
    prompt: 'Cor favorita?',
    options: ['Azul', 'Verde', 'Rosa'],
    correctIndex: 2,
    points: 10,
  });
  assert.equal(q.prompt, 'Cor favorita?');
  assert.equal(q.correctIndex, 2);
  const list = await listQuestionsAdmin(null);
  assert.equal(list.length, 1);
});

test('update question points', async () => {
  const q = await createQuestion(null, {
    prompt: 'Pergunta longa ok',
    options: ['A', 'B'],
    correctIndex: 0,
    points: 5,
  });
  const updated = await updateQuestion(null, q.id, { points: 99 });
  assert.equal(updated.points, 99);
});

test('delete question', async () => {
  const q = await createQuestion(null, {
    prompt: 'Apagar?',
    options: ['Sim', 'Não'],
    correctIndex: 0,
    points: 1,
  });
  await deleteQuestion(null, q.id);
  assert.equal((await listQuestionsAdmin(null)).length, 0);
});

test('photo mission awardsStamp', async () => {
  const m = await createPhotoMission(null, {
    title: 'Foto no altar',
    points: 30,
    awardsStamp: true,
  });
  assert.equal(m.awardsStamp, true);
});

test('stamp card create list', async () => {
  await createStampCard(null, {
    name: 'Lembrancinha',
    stampsRequired: 3,
    rewardText: 'Kit lembrancinha',
  });
  const list = await listStampCardsAdmin(null);
  assert.equal(list[0].stampsRequired, 3);
});

test('duplicate id throws EXISTS', async () => {
  const body = {
    id: 'q-dup',
    prompt: 'Dup?',
    options: ['A', 'B'],
    correctIndex: 0,
    points: 1,
  };
  await createQuestion(null, body);
  await assert.rejects(() => createQuestion(null, body), /EXISTS/);
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
node --test tests/challenges-service.test.mjs
```

- [ ] **Step 3: Implement service (memory + D1 stubs in same file)**

Implement `functions/_lib/challenges-service.mjs` following `stationery-service.mjs` patterns:

- Three memory arrays via `ensureMemory()`
- `throwValidation(errors)`, map create/update/delete
- On question patch: if `correctIndex` set without `options`, validate against existing question.options length; if both, validate together; if only options, ensure existing correctIndex still in range or require correctIndex in patch
- D1 SQL using tables from Task 3 (write D1 paths now; migration lands in Task 3 — service D1 can be completed in Task 3 if preferred, but keep memory complete here)
- Error names: `QUESTION_EXISTS` / `QUESTION_NOT_FOUND`, `PHOTO_MISSION_EXISTS` / `PHOTO_MISSION_NOT_FOUND`, `STAMP_CARD_EXISTS` / `STAMP_CARD_NOT_FOUND` (or unified `EXISTS`/`NOT_FOUND` — **use unified `EXISTS` and `NOT_FOUND`** to match test above)
- Store `options` as JSON string in D1 column `options_json`

Minimal memory createQuestion sketch:

```js
export async function createQuestion(db, body) {
  const validation = validateQuestionCreate(body);
  if (!validation.valid) {
    const err = new Error('VALIDATION');
    err.details = validation.errors;
    throw err;
  }
  const d = validation.data;
  const now = new Date().toISOString();
  if (!db) {
    const mem = ensureMemory().questions;
    if (mem.some((q) => q.id === d.id)) throw new Error('EXISTS');
    const row = {
      id: d.id,
      weddingKey: WEDDING_KEY,
      prompt: d.prompt,
      options: d.options,
      correctIndex: d.correctIndex,
      points: d.points,
      active: d.active,
      sortOrder: d.sortOrder,
      updatedAt: now,
    };
    mem.push(row);
    return { ...row };
  }
  // D1 INSERT … (Task 3 tables)
}
```

Mirror for photo + stamp. Export `resetMemoryChallengesForTests`.

- [ ] **Step 4: Run — expect PASS**

```bash
node --test tests/challenges-service.test.mjs tests/challenges-validators.test.mjs
```

- [ ] **Step 5: Commit**

```bash
git add functions/_lib/challenges-service.mjs tests/challenges-service.test.mjs
git commit -m "feat(challenges): in-memory CRUD service for admin desafios"
```

---

### Task 3: Migration D1 + finish service SQL

**Files:**
- Create: `migrations/0013_challenges.sql`
- Modify: `functions/_lib/challenges-service.mjs` (D1 branches if not done)

- [ ] **Step 1: Write migration**

```sql
-- Migration 0013: Admin desafios (quiz, fotos, cartões de selos)

CREATE TABLE IF NOT EXISTS challenge_questions (
  id TEXT PRIMARY KEY NOT NULL
    CHECK (length(id) >= 2 AND length(id) <= 40),
  wedding_key TEXT NOT NULL,
  prompt TEXT NOT NULL
    CHECK (length(prompt) >= 2 AND length(prompt) <= 200),
  options_json TEXT NOT NULL,
  correct_index INTEGER NOT NULL
    CHECK (correct_index >= 0 AND correct_index <= 3),
  points INTEGER NOT NULL
    CHECK (points >= 1 AND points <= 999),
  active INTEGER NOT NULL DEFAULT 1
    CHECK (active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_challenge_questions_wedding
  ON challenge_questions(wedding_key, active, sort_order, id);

CREATE TABLE IF NOT EXISTS challenge_photo_missions (
  id TEXT PRIMARY KEY NOT NULL
    CHECK (length(id) >= 2 AND length(id) <= 40),
  wedding_key TEXT NOT NULL,
  title TEXT NOT NULL
    CHECK (length(title) >= 2 AND length(title) <= 100),
  points INTEGER NOT NULL
    CHECK (points >= 1 AND points <= 999),
  awards_stamp INTEGER NOT NULL DEFAULT 0
    CHECK (awards_stamp IN (0, 1)),
  active INTEGER NOT NULL DEFAULT 1
    CHECK (active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_challenge_photo_wedding
  ON challenge_photo_missions(wedding_key, active, sort_order, id);

CREATE TABLE IF NOT EXISTS challenge_stamp_cards (
  id TEXT PRIMARY KEY NOT NULL
    CHECK (length(id) >= 2 AND length(id) <= 40),
  wedding_key TEXT NOT NULL,
  name TEXT NOT NULL
    CHECK (length(name) >= 2 AND length(name) <= 80),
  stamps_required INTEGER NOT NULL
    CHECK (stamps_required >= 1 AND stamps_required <= 50),
  reward_text TEXT NOT NULL
    CHECK (length(reward_text) >= 2 AND length(reward_text) <= 200),
  active INTEGER NOT NULL DEFAULT 1
    CHECK (active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_challenge_stamp_cards_wedding
  ON challenge_stamp_cards(wedding_key, active, sort_order, id);

INSERT INTO schema_migrations (version, applied_at)
VALUES ('0013', datetime('now'))
ON CONFLICT(version) DO NOTHING;
```

- [ ] **Step 2: Complete D1 CRUD in service** — SELECT/INSERT/UPDATE/DELETE filtered by `WEDDING_KEY`; parse `options_json` with `JSON.parse`

- [ ] **Step 3: Re-run memory tests**

```bash
node --test tests/challenges-service.test.mjs
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add migrations/0013_challenges.sql functions/_lib/challenges-service.mjs
git commit -m "feat(challenges): D1 schema and SQL CRUD for desafios"
```

---

### Task 4: Admin API routes + Vite mocks

**Files:**
- Create: `functions/api/admin/challenges/questions.js`
- Create: `functions/api/admin/challenges/photo-missions.js`
- Create: `functions/api/admin/challenges/stamp-cards.js`
- Modify: `vite.config.js` — import service + handle three paths before o stub genérico admin

**Interfaces:**
- Consumes: service functions from Task 2
- HTTP: GET list `{ ok, questions|photoMissions|stampCards }`; POST 201 create; PATCH body.id; DELETE `?id=`

- [ ] **Step 1: Create `questions.js`** mirroring `functions/api/admin/stationery.js` (requireAdmin, CORS, mapWriteError with VALIDATION/EXISTS/NOT_FOUND/INVALID_ID/EMPTY_PATCH)

Response keys:
- GET `{ ok: true, questions: [...] }`
- POST `{ ok: true, question, questions }`
- PATCH `{ ok: true, question }`
- DELETE `{ ok: true, removed, questions }`

- [ ] **Step 2: Create `photo-missions.js`** — keys `photoMissions` / `photoMission`

- [ ] **Step 3: Create `stamp-cards.js`** — keys `stampCards` / `stampCard`

- [ ] **Step 4: Wire Vite** in the admin API middleware (near stationery block):

```js
import {
  listQuestionsAdmin,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  listPhotoMissionsAdmin,
  createPhotoMission,
  updatePhotoMission,
  deletePhotoMission,
  listStampCardsAdmin,
  createStampCard,
  updateStampCard,
  deleteStampCard,
} from './functions/_lib/challenges-service.mjs';
```

For each path `/api/admin/challenges/questions`, `/photo-missions`, `/stamp-cards`: GET/POST/PATCH/DELETE with `db=null`, same status map as stationery (`EXISTS`→409, `NOT_FOUND`→404, etc.).

- [ ] **Step 5: Manual smoke (dev server)**

```bash
# with token from admin login flow, or TEMP token header used by project
curl -s -H "Authorization: Bearer <token>" http://127.0.0.1:5173/api/admin/challenges/questions
```

Expected: `{ "ok": true, "questions": [] }`

- [ ] **Step 6: Commit**

```bash
git add functions/api/admin/challenges/ vite.config.js
git commit -m "feat(challenges): admin API routes and Vite mocks"
```

---

### Task 5: Admin UI — seção Desafios + perguntas

**Files:**
- Modify: `dani-carine/admin.html`
- Modify: `src/dani-carine/admin.css`

- [ ] **Step 1: Navigation**

- No card Desafios dentro de Entretenimento: trocar “Em breve” por botão que chama `openSection('challenges')` (ex. `type="button" class="admin-entertainment-card" id="open-challenges-section"`).
- Adicionar `<article class="admin-card admin-section" data-section="challenges" hidden>` com três subheads: Perguntas, Desafios de foto, Cartões de selos.
- Grids: `#questions-grid`, `#photo-missions-grid`, `#stamp-cards-grid` + botões `+` `#open-create-question`, etc.

- [ ] **Step 2: Modal pergunta**

Dialog `#modal-question` fields:
- `#q-edit-id` hidden
- `#q-prompt`
- `#q-opt-0` … `#q-opt-3`
- radios `name="q-correct"` value 0–3
- `#q-points`
- `#q-active`
- Salvar `#save-question-btn`

- [ ] **Step 3: JS load/render/save**

```js
async function loadQuestions() {
  const res = await fetch('/api/admin/challenges/questions', { headers: authHeaders() });
  const data = await res.json().catch(() => ({}));
  cachedQuestions = data.questions || [];
  $('questions-grid').innerHTML = renderQuestions(cachedQuestions);
}

function renderQuestions(list) {
  if (!list.length) return `<p class="sub">Nenhuma pergunta ainda</p>`;
  return list.map((q) => `...card com prompt, pontos, Editar, Remover...`).join('');
}
```

Wire create/edit/delete like gifts. Call `loadQuestions` when opening challenges section (hook in `openSection` or click handler).

- [ ] **Step 4: CSS**

Reuse stationery-card patterns: `.admin-challenges-grid`, `.admin-challenge-card`, inactive opacity.

- [ ] **Step 5: Browser check** — login admin → Entretenimento → Desafios → criar pergunta com 3 opções → aparece card → editar pontos → remover

- [ ] **Step 6: Commit**

```bash
git add dani-carine/admin.html src/dani-carine/admin.css
git commit -m "feat(challenges): admin UI for quiz questions"
```

---

### Task 6: Admin UI — desafios de foto + cartões

**Files:**
- Modify: `dani-carine/admin.html`
- Modify: `src/dani-carine/admin.css` (se necessário)

- [ ] **Step 1: Modal foto** — `#modal-photo-mission`: title, points, `#pm-awards-stamp` checkbox “Vale 1 selo”, active; load/render/CRUD em `/api/admin/challenges/photo-missions`

- [ ] **Step 2: Modal cartão** — `#modal-stamp-card`: name, stampsRequired, rewardText, active; CRUD `/api/admin/challenges/stamp-cards`

- [ ] **Step 3: Cards na grade**

- Foto: mostrar título, pontos, badge “Selo” se `awardsStamp`
- Cartão: nome, “N selos → prêmio”

- [ ] **Step 4: `openSection('challenges')` carrega as três listas em paralelo**

```js
await Promise.all([loadQuestions(), loadPhotoMissions(), loadStampCards()]);
```

- [ ] **Step 5: Browser check** — criar foto com selo, criar 2 cartões (drink + lembrancinha), editar, desativar, excluir

- [ ] **Step 6: Commit**

```bash
git add dani-carine/admin.html src/dani-carine/admin.css
git commit -m "feat(challenges): admin UI for photo missions and stamp cards"
```

---

### Task 7: Verificação final

- [ ] **Step 1: Run all related tests**

```bash
node --test tests/challenges-validators.test.mjs tests/challenges-service.test.mjs
```

Expected: PASS

- [ ] **Step 2: Smoke checklist**
  - [ ] Entretenimento → Acesso (QR) ainda funciona
  - [ ] Desafios abre seção com 3 blocos
  - [ ] Pergunta 2–4 opções + correta + pontos
  - [ ] Foto com/sem selo
  - [ ] Vários cartões com metas/prêmios diferentes
  - [ ] Persistência no refresh (mock Vite)
  - [ ] Voltar ao painel / hub ok
  - [ ] Presentes/Papelaria/Lista sem regressão óbvia

- [ ] **Step 3: Commit final se houver leftovers** (CSS polish only)

---

## Self-review (plan vs spec)

| Spec item | Task |
|-----------|------|
| Seção Desafios via card Entretenimento | 5 |
| CRUD perguntas 2–4 opts, 1 correta, points | 1, 2, 4, 5 |
| CRUD foto + awards_stamp (1 selo) | 1, 2, 4, 6 |
| Vários cartões name/N/reward | 1, 2, 4, 6 |
| D1 migration 0013 | 3 |
| API 3 rotas + Vite mock | 4 |
| Fora de escopo (jogo convidado) | não incluído |
| Acesso QR intacto | Task 7 checklist |

No placeholders TBD. Error names unified to `EXISTS`/`NOT_FOUND` across entities for simpler Vite/API mapping.
