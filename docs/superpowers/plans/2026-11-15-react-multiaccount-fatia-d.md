# Fatia D — Minha página (slug + etapas) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/admin/minha-pagina` publica o slug e o conteúdo (história, data, local, etapas); `/casal/:slug` deixa de ser “Em breve” para contas novas; o slug do parceiro permanece `dani-carine`.

**Architecture:** `claimAccountSlug` valida e grava `accounts.slug`. `couple_pages` guarda o texto da página por `account_id`. `GET/PUT /api/admin/page` autenticam por cookie. `GET /api/casal/:slug` passa a incluir `page` (sem id/email). O SPA troca `ComingSoon` por `MinhaPagina`; `CoupleSite` usa `PartnerHome` (parceiro, textos da API + fotos hardcoded) ou `CoupleHome` (demais).

**Tech Stack:** Vite 8, React 19, react-router-dom 7, Cloudflare Pages Functions, D1, `node --test`, happy-dom.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-11-15-react-multiaccount-fatia-d-design.md` (mãe: `docs/superpowers/specs/2026-11-14-react-multiaccount-design.md`)
- Cloudflare Pages Free: Functions 100 mil req/dia, 10 ms CPU
- Cookie `cb_session`; inquilino = sessão; ignorar `account_id` / `wedding_key` do cliente
- JSON público **sem** `id`, `email`, `account_id`, `weddingKey`
- Parceiro: slug `dani-carine` imóvel (`SLUG_LOCKED`)
- Sem slug → URL pública não existe (404 já implementado)
- Sem upload de imagem nesta fatia
- Vite `db=null` usa memória de processo (não 503)
- `setAccountSlug` de testes/seed permanece sem validação HTTP; a UI usa `claimAccountSlug`
- UI em português; runner `node --test`; nenhum código de produção sem teste que falhou primeiro
- Commits em português, HEREDOC; não alterar `git config`; se o autor falhar, use `GIT_AUTHOR_NAME='Cursor Agent' GIT_AUTHOR_EMAIL='cursoragent@cursor.com'` (e COMMITTER) só no comando
- Não commitar `.env`, senhas, `dani-carine/admin.html`

## File map

| Path | Responsabilidade |
|---|---|
| `functions/_lib/slug.mjs` | `normalizeSlug`, `RESERVED_SLUGS`, `assertSlugFormat` |
| `functions/_lib/auth-service.mjs` | `claimAccountSlug` |
| `functions/_lib/partner-page-defaults.mjs` | Texto default do parceiro (sem imagens) |
| `functions/_lib/couple-page-service.mjs` | get/save page, memória + D1 |
| `migrations/0022_couple_pages.sql` | Tabela |
| `functions/api/admin/page.js` | GET/PUT sessão |
| `functions/api/casal/[slug].js` | Inclui `page` |
| `vite.config.js` | Proxy `/api/admin/page` |
| `src/lib/admin-api.mjs` | `getAdminPage`, `putAdminPage` |
| `src/pages/admin/MinhaPagina.jsx` | Formulário |
| `src/App.jsx` | Rota troca ComingSoon → MinhaPagina |
| `src/lib/casal-api.mjs` | `fetchCouplePage` devolve `page` |
| `src/pages/casal/CoupleHome.jsx` | Template genérico |
| `src/pages/casal/CoupleSite.jsx` | Partner vs CoupleHome; title |
| `src/pages/casal/PartnerHome.jsx` | Textos de `page` |
| `tests/slug-claim.test.mjs` | Formato + claim |
| `tests/couple-page-service.test.mjs` | Persistência |
| `tests/admin-page-api.test.mjs` | HTTP admin |
| `tests/casal-page-api.test.mjs` | `page` público |
| `tests/casal-ui.test.mjs` | Template + admin form |

---

### Task 1: Validar e reivindicar slug

**Files:**
- Create: `functions/_lib/slug.mjs`
- Modify: `functions/_lib/auth-service.mjs` — export `claimAccountSlug`
- Create: `tests/slug-claim.test.mjs`

**Interfaces:**
- Consumes: `resolveAccountBySlug`, `selectAccountById` (já em `auth-service.mjs`; se `selectAccountById` não for exportado, use a query existente / `getSessionAccount` não)
- Produces:
  - `normalizeSlug(raw)` → string minúscula trimada
  - `RESERVED_SLUGS` → `Set` com `admin`, `entrar`, `casal`, `games`, `game`, `api`, `app`, `www`, `static`, `login`, `signup`, `conta`, `dani-carine`
  - `assertSlugFormat(slug)` → throw `Error('SLUG_INVALID')` se falhar
  - `claimAccountSlug(db, accountId, raw)` → `{ slug }` ou throw `SLUG_INVALID` \| `SLUG_RESERVED` \| `SLUG_TAKEN` \| `SLUG_LOCKED` \| `ACCOUNT_NOT_FOUND`

- [ ] **Step 1: Write the failing tests**

`tests/slug-claim.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSlug, RESERVED_SLUGS, assertSlugFormat } from '../functions/_lib/slug.mjs';
import { signup, claimAccountSlug, PARTNER_ACCOUNT_ID } from '../functions/_lib/auth-service.mjs';
import { ensurePartnerAccount } from '../functions/_lib/partner-seed.mjs';

test('normalizeSlug trims and lowercases', () => {
  assert.equal(normalizeSlug('  Ana-E-Joao '), 'ana-e-joao');
});

test('assertSlugFormat rejects short, reserved-looking punctuation and double hyphen', () => {
  assert.throws(() => assertSlugFormat('ab'), { message: 'SLUG_INVALID' });
  assert.throws(() => assertSlugFormat('-abc'), { message: 'SLUG_INVALID' });
  assert.throws(() => assertSlugFormat('abc-'), { message: 'SLUG_INVALID' });
  assert.throws(() => assertSlugFormat('ana--joao'), { message: 'SLUG_INVALID' });
  assert.throws(() => assertSlugFormat('Ana E Joao'), { message: 'SLUG_INVALID' });
  assert.doesNotThrow(() => assertSlugFormat('ana-e-joao'));
  assert.doesNotThrow(() => assertSlugFormat('abc'));
});

test('RESERVED_SLUGS includes product paths and the partner slug', () => {
  for (const item of ['admin', 'entrar', 'casal', 'games', 'dani-carine']) {
    assert.equal(RESERVED_SLUGS.has(item), true);
  }
});

test('claimAccountSlug stores unique slug and rejects taken or reserved', async () => {
  const now = '2026-11-15T08:00:00.000Z';
  const a = await signup(null, { email: 'slug-a@x.com', password: 'segredo12', plan: 'basic' }, now);
  const b = await signup(null, { email: 'slug-b@x.com', password: 'segredo12', plan: 'basic' }, now);
  const ok = await claimAccountSlug(null, a.accountId, '  Ana-E-Joao ');
  assert.equal(ok.slug, 'ana-e-joao');
  await assert.rejects(() => claimAccountSlug(null, b.accountId, 'ana-e-joao'), { message: 'SLUG_TAKEN' });
  await assert.rejects(() => claimAccountSlug(null, b.accountId, 'admin'), { message: 'SLUG_RESERVED' });
  await assert.rejects(() => claimAccountSlug(null, b.accountId, 'x'), { message: 'SLUG_INVALID' });
});

test('partner cannot change slug away from dani-carine', async () => {
  await ensurePartnerAccount(null, {}, '2026-11-15T08:00:00.000Z');
  await assert.rejects(
    () => claimAccountSlug(null, PARTNER_ACCOUNT_ID, 'outro-casal'),
    { message: 'SLUG_LOCKED' }
  );
  const same = await claimAccountSlug(null, PARTNER_ACCOUNT_ID, 'dani-carine');
  assert.equal(same.slug, 'dani-carine');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/slug-claim.test.mjs`

Expected: FAIL módulo `slug.mjs` ausente / `claimAccountSlug` não exportado.

- [ ] **Step 3: Write minimal implementation**

`functions/_lib/slug.mjs`:

```js
export const RESERVED_SLUGS = new Set([
  'admin',
  'entrar',
  'casal',
  'games',
  'game',
  'api',
  'app',
  'www',
  'static',
  'login',
  'signup',
  'conta',
  'dani-carine',
]);

export function normalizeSlug(raw) {
  return String(raw ?? '').trim().toLowerCase();
}

export function assertSlugFormat(slug) {
  const value = String(slug || '');
  if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(value)) {
    throw new Error('SLUG_INVALID');
  }
  if (value.includes('--')) throw new Error('SLUG_INVALID');
}
```

Em `auth-service.mjs`, **exporte** `selectAccountById` se ainda for interno, e:

```js
import { normalizeSlug, RESERVED_SLUGS, assertSlugFormat } from './slug.mjs';

export async function claimAccountSlug(db, accountId, raw) {
  db = resolveDb(db);
  const row = await selectAccountById(db, accountId);
  if (!row) throw new Error('ACCOUNT_NOT_FOUND');
  const slug = normalizeSlug(raw);
  const isPartner = Boolean(Number(row.is_partner));
  if (isPartner) {
    if (slug !== 'dani-carine') throw new Error('SLUG_LOCKED');
    return { slug: 'dani-carine' };
  }
  assertSlugFormat(slug);
  if (RESERVED_SLUGS.has(slug)) throw new Error('SLUG_RESERVED');
  const taken = await resolveAccountBySlug(db, slug);
  if (taken && taken.id !== accountId) throw new Error('SLUG_TAKEN');
  await db.prepare('UPDATE accounts SET slug = ? WHERE id = ?').bind(slug, accountId).run();
  return { slug };
}
```

Não altere o comportamento de `setAccountSlug` (testes das fatias B/C).

- [ ] **Step 4: Run tests**

Run: `node --test tests/slug-claim.test.mjs tests/auth-service.test.mjs`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add functions/_lib/slug.mjs functions/_lib/auth-service.mjs tests/slug-claim.test.mjs
git commit -m "$(cat <<'EOF'
feat: validar e reivindicar o slug público da conta

EOF
)"
```

---

### Task 2: Serviço `couple_pages`

**Files:**
- Create: `migrations/0022_couple_pages.sql`
- Create: `functions/_lib/partner-page-defaults.mjs`
- Create: `functions/_lib/couple-page-service.mjs`
- Create: `tests/couple-page-service.test.mjs`

**Interfaces:**
- Consumes: `PARTNER_ACCOUNT_ID`
- Produces:
  - `emptyCouplePage()` → objeto com `names: []`, `etapas: []`, demais strings `''`
  - `getCouplePage(db, accountId)` → page pública (parceiro: defaults onde vazio)
  - `saveCouplePage(db, accountId, patch)` → page salva; throw `VALIDATION` com `err.details`
  - `resetMemoryCouplePagesForTests()`
  - `toPublicPage(row)` **não** inclui `accountId`

- [ ] **Step 1: Write the failing tests**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signup } from '../functions/_lib/auth-service.mjs';
import { PARTNER_ACCOUNT_ID } from '../functions/_lib/auth-service.mjs';
import { ensurePartnerAccount } from '../functions/_lib/partner-seed.mjs';
import {
  emptyCouplePage,
  getCouplePage,
  saveCouplePage,
  resetMemoryCouplePagesForTests,
} from '../functions/_lib/couple-page-service.mjs';

test('emptyCouplePage has no names or etapas', () => {
  const page = emptyCouplePage();
  assert.deepEqual(page.names, []);
  assert.deepEqual(page.etapas, []);
  assert.equal(page.story, '');
  assert.equal('accountId' in page, false);
});

test('saveCouplePage isolates accounts and validates etapas', async () => {
  resetMemoryCouplePagesForTests();
  const now = '2026-11-15T08:00:00.000Z';
  const a = await signup(null, { email: 'pg-a@x.com', password: 'segredo12', plan: 'basic' }, now);
  const b = await signup(null, { email: 'pg-b@x.com', password: 'segredo12', plan: 'basic' }, now);
  await saveCouplePage(null, a.accountId, {
    names: ['Ana', 'João'],
    dateLine: '1 de maio',
    etapas: [{ title: 'Cerimônia', detail: '10h' }],
  });
  const pageA = await getCouplePage(null, a.accountId);
  const pageB = await getCouplePage(null, b.accountId);
  assert.deepEqual(pageA.names, ['Ana', 'João']);
  assert.equal(pageA.etapas[0].title, 'Cerimônia');
  assert.deepEqual(pageB.names, []);
  await assert.rejects(
    () => saveCouplePage(null, a.accountId, { etapas: [{ title: '', detail: 'x' }] }),
    (err) => err.message === 'VALIDATION'
  );
});

test('partner getCouplePage fills Dani and Carine defaults without a row', async () => {
  resetMemoryCouplePagesForTests();
  await ensurePartnerAccount(null, {}, '2026-11-15T08:00:00.000Z');
  const page = await getCouplePage(null, PARTNER_ACCOUNT_ID);
  assert.deepEqual(page.names, ['Dani', 'Carine']);
  assert.equal(page.etapas.map((item) => item.title).join(','), 'Cerimônia,Brunch,Festa');
  assert.equal('accountId' in page, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/couple-page-service.test.mjs`

Expected: FAIL módulo ausente.

- [ ] **Step 3: Write minimal implementation**

`migrations/0022_couple_pages.sql` — exatamente o SQL da spec.

`functions/_lib/partner-page-defaults.mjs`:

```js
export const PARTNER_PAGE_DEFAULT = {
  names: ['Dani', 'Carine'],
  dateLine: '21 de novembro · 8h',
  city: 'Florianópolis · Lagoa da Conceição',
  welcomeTitle: 'Sejam muito bem-vindos ao nosso cantinho especial!',
  welcomeBody:
    'Criamos este site para compartilhar com vocês todos os detalhes do nosso grande dia.',
  story:
    'Acreditamos que o amor é um ato de sonhar — sonhar com uma vida compartilhada, construída com companheirismo, respeito e amizade.',
  venueName: 'Indaiá Eventos',
  venuePlace: 'Canto da Lagoa · Florianópolis',
  mapsHref:
    'https://www.google.com/maps/search/?api=1&query=Indai%C3%A1+Eventos+Canto+da+Lagoa+Florian%C3%B3polis',
  dressTitle: 'Social completo',
  dressRule: 'Branco proibido',
  etapas: [
    { title: 'Cerimônia', detail: '21 de novembro · 8h' },
    { title: 'Brunch', detail: 'Buffet de café da manhã' },
    { title: 'Festa', detail: 'Indaiá Eventos' },
  ],
};
```

`couple-page-service.mjs` — memória `Map` quando `!db`; SQL quando `db`. `fillPartnerDefaults(page, accountId)`: se `accountId === PARTNER_ACCOUNT_ID`, para cada string vazia / `names` vazio / `etapas` vazio, copie o default. `toPublicPage` só os campos da spec.

Validação `saveCouplePage`:
- `names`: array 0–2; cada item trim 1–40 (item `''` após trim → VALIDATION)
- strings: respetivos máximos; `mapsHref` vazio ou `/^https?:\/\//i` e ≤ 500
- `etapas`: array ≤ 8; cada `{ title: trim 1–80, detail: trim 0–200 }`
- merge com página atual (omitido = mantém)

Leia a assinatura real de `PARTNER_ACCOUNT_ID` (já exportada).

- [ ] **Step 4: Run tests**

Run: `node --test tests/couple-page-service.test.mjs tests/slug-claim.test.mjs`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add migrations/0022_couple_pages.sql functions/_lib/partner-page-defaults.mjs functions/_lib/couple-page-service.mjs tests/couple-page-service.test.mjs
git commit -m "$(cat <<'EOF'
feat: persistir o conteúdo público de Minha página

EOF
)"
```

---

### Task 3: HTTP admin `GET/PUT /api/admin/page`

**Files:**
- Create: `functions/api/admin/page.js`
- Modify: `vite.config.js` — ramo `/api/admin/page`
- Create: `tests/admin-page-api.test.mjs`

**Interfaces:**
- Consumes: `requireAccount`, `claimAccountSlug`, `getCouplePage`, `saveCouplePage`, `validateOrigin` no PUT
- Produces: `{ ok, slug, slugLocked, page }`; 401 sem cookie; erros de slug com o `error` igual à `message` throw (`SLUG_TAKEN` etc.)

- [ ] **Step 1: Write the failing tests**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signup } from '../functions/_lib/auth-service.mjs';
import { resetMemoryCouplePagesForTests } from '../functions/_lib/couple-page-service.mjs';
import { onRequestGet, onRequestPut } from '../functions/api/admin/page.js';

function ctx(account, { method = 'GET', body } = {}) {
  return {
    request: new Request('https://casebem.com/api/admin/page', {
      method,
      headers: {
        cookie: `cb_session=${account.sessionId}`,
        origin: 'https://casebem.com',
        'content-type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    }),
    env: { DB: null },
  };
}

test('admin page GET is 401 without cookie', async () => {
  const res = await onRequestGet({
    request: new Request('https://casebem.com/api/admin/page'),
    env: { DB: null },
  });
  assert.equal(res.status, 401);
});

test('PUT page claims slug and does not leak account id', async () => {
  resetMemoryCouplePagesForTests();
  const now = '2026-11-15T08:00:00.000Z';
  const a = await signup(null, { email: 'adm-a@x.com', password: 'segredo12', plan: 'basic' }, now);
  const b = await signup(null, { email: 'adm-b@x.com', password: 'segredo12', plan: 'basic' }, now);
  const res = await onRequestPut(
    ctx(a, {
      method: 'PUT',
      body: { slug: 'casal-ana', page: { names: ['Ana'], dateLine: 'maio' } },
    })
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.slug, 'casal-ana');
  assert.equal(body.slugLocked, false);
  assert.deepEqual(body.page.names, ['Ana']);
  assert.equal('id' in body, false);
  assert.equal('accountId' in body, false);
  assert.equal('accountId' in body.page, false);

  const taken = await onRequestPut(
    ctx(b, { method: 'PUT', body: { slug: 'casal-ana' } })
  );
  assert.equal(taken.status, 409);
  assert.equal((await taken.json()).error, 'SLUG_TAKEN');

  const mine = await onRequestGet(ctx(b));
  assert.equal((await mine.json()).slug, null);
});
```

Se `validateOrigin` 403, omita `origin` (padrão fatia B) **ou** use um Origin aceito — leia `validateOrigin`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/admin-page-api.test.mjs`

Expected: FAIL módulo da rota ausente.

- [ ] **Step 3: Write minimal implementation**

Espelhe `functions/api/admin/gifts.js` (CORS, `requireAccount`, `validateOrigin` no PUT). **Não** exija `env.DB` — passe `env.DB || null` aos serviços.

Mapa de status: `SLUG_INVALID`/`SLUG_RESERVED`/`VALIDATION` → 400; `SLUG_TAKEN` → 409; `SLUG_LOCKED` → 403; `ACCOUNT_NOT_FOUND` → 404.

`slugLocked = Boolean(auth.account.isPartner)`.

Vite: no `adminApiPlugin`, se `path === '/api/admin/page'`, importe o handler e encaminhe GET/PUT (como gifts). Sem 503.

- [ ] **Step 4: Run tests**

Run: `node --test tests/admin-page-api.test.mjs tests/couple-page-service.test.mjs tests/slug-claim.test.mjs`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add functions/api/admin/page.js vite.config.js tests/admin-page-api.test.mjs
git commit -m "$(cat <<'EOF'
feat: expor GET e PUT autenticados de Minha página

EOF
)"
```

---

### Task 4: `GET /api/casal/:slug` inclui `page`

**Files:**
- Modify: `functions/api/casal/[slug].js`
- Modify: `src/lib/casal-api.mjs`
- Modify: `tests/casal-page-api.test.mjs`

**Interfaces:**
- Produces: `{ ok, slug, isPartner, page }`; ainda sem `id`/`email`

- [ ] **Step 1: Write the failing tests**

Em `tests/casal-page-api.test.mjs` acrescente:

```js
import { claimAccountSlug } from '../functions/_lib/auth-service.mjs';
import { saveCouplePage, resetMemoryCouplePagesForTests } from '../functions/_lib/couple-page-service.mjs';

test('GET /api/casal/:slug includes public page without ids', async () => {
  resetMemoryCouplePagesForTests();
  const now = '2026-11-15T08:00:00.000Z';
  const created = await signup(null, { email: 'pub@x.com', password: 'segredo12', plan: 'basic' }, now);
  await claimAccountSlug(null, created.accountId, 'pub-casal');
  await saveCouplePage(null, created.accountId, { names: ['Lia'], story: 'Oi' });
  const res = await onRequestGet({
    request: new Request('https://casebem.com/api/casal/pub-casal'),
    env: { DB: null },
    params: { slug: 'pub-casal' },
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body.page.names, ['Lia']);
  assert.equal(body.page.story, 'Oi');
  assert.equal('id' in body, false);
  assert.equal('email' in body, false);
});

test('GET partner page includes default etapas', async () => {
  resetMemoryCouplePagesForTests();
  const res = await onRequestGet({
    request: new Request('https://casebem.com/api/casal/dani-carine'),
    env: { DB: null },
    params: { slug: 'dani-carine' },
  });
  const body = await res.json();
  assert.equal(body.page.etapas[0].title, 'Cerimônia');
});
```

Ajuste os testes antigos deste arquivo: eles ainda passam se só ganharem `page` extra — não assertem `Object.keys` fechado.

Em `tests/casal-ui.test.mjs` ou `tests/casal-page-api.test.mjs` (fonte):

```js
test('fetchCouplePage returns page from JSON', async () => {
  const src = readFileSync(new URL('../src/lib/casal-api.mjs', import.meta.url), 'utf8');
  assert.match(src, /page:/);
});
```

Só se `casal-ui` já lê arquivos com `readFileSync`; senão coloque o assert de fonte em `casal-page-api` **não** — implemente `fetchCouplePage` para devolver `page: data.page || empty`. Sem teste de fonte se o teste HTTP + o client forem cobertos por Task 5. Nesta task: altere `fetchCouplePage`:

```js
return { ok: true, slug: data.slug, isPartner: Boolean(data.isPartner), page: data.page || null };
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/casal-page-api.test.mjs`

Expected: FAIL `page` undefined.

- [ ] **Step 3: Write minimal implementation**

Handler: após `resolvePublicSlug`, `page = await getCouplePage(env.DB || null, resolved.account.id)` e inclua no JSON. Vite já delega a este handler — não duplique.

- [ ] **Step 4: Run tests**

Run: `node --test tests/casal-page-api.test.mjs tests/admin-page-api.test.mjs`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add functions/api/casal/[slug].js src/lib/casal-api.mjs tests/casal-page-api.test.mjs
git commit -m "$(cat <<'EOF'
feat: publicar o conteúdo de Minha página no GET do casal

EOF
)"
```

---

### Task 5: UI admin Minha página

**Files:**
- Create: `src/pages/admin/MinhaPagina.jsx`
- Modify: `src/App.jsx` — importar `MinhaPagina` no lugar de `ComingSoon` nesta rota
- Modify: `src/lib/admin-api.mjs`
- Modify: `tests/casal-ui.test.mjs` (ou `tests/spa-auth-ui.test.mjs` se for o arquivo de fonte do admin)

**Interfaces:**
- `getAdminPage()` → `GET /api/admin/page` credentials include
- `putAdminPage(body)` → `PUT /api/admin/page`
- Copy de erro exatamente da spec
- Sucesso: `role="status"` texto `Página publicada.`

- [ ] **Step 1: Write the failing tests**

Em `tests/casal-ui.test.mjs` (já usa `readFileSync`):

```js
test('App.jsx mounts MinhaPagina instead of ComingSoon on /admin/minha-pagina', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(app, /MinhaPagina/);
  assert.doesNotMatch(app, /path="\/admin\/minha-pagina"[\s\S]*ComingSoon/);
  const page = readFileSync(new URL('../src/pages/admin/MinhaPagina.jsx', import.meta.url), 'utf8');
  assert.match(page, /Página publicada/);
  assert.match(page, /Este endereço já está em uso/);
  assert.match(page, /putAdminPage|\/api\/admin\/page/);
  assert.match(page, /Adicionar etapa/);
});
```

Se o regex `doesNotMatch` do bloco da rota for frágil, asserta `import MinhaPagina` e que a rota `minha-pagina` contém `<MinhaPagina`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/casal-ui.test.mjs`

Expected: FAIL `MinhaPagina.jsx` ausente.

- [ ] **Step 3: Write minimal implementation**

`src/lib/admin-api.mjs`:

```js
export function getAdminPage() {
  return api('/api/admin/page');
}
export function putAdminPage(body) {
  return api('/api/admin/page', { method: 'PUT', body: JSON.stringify(body) });
}
```

`MinhaPagina.jsx` usa `AdminSection` (eyebrow `Minha página`, title `Publique o site do casal`). Campos: slug (readOnly se `slugLocked`), names (dois inputs), dateLine, city, welcomeTitle, welcomeBody, story, venueName, venuePlace, mapsHref, dressTitle, dressRule, lista de etapas (title+detail) + botão `Adicionar etapa` (no-op se já há 8). Submit chama `putAdminPage({ slug, page })`. Link `Ver página` só se `slug` (href `/casal/${slug}`).

Mapa de `error` → copy da spec. `ComingSoon.jsx` pode permanecer no repo (outras rotas não o usam nesta fatia — YAGNI: não apague se ainda importado em nada crítico; a rota minha-pagina não o usa).

- [ ] **Step 4: Run tests**

Run: `node --test tests/casal-ui.test.mjs tests/spa-auth-ui.test.mjs tests/admin-page-api.test.mjs`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin/MinhaPagina.jsx src/App.jsx src/lib/admin-api.mjs tests/casal-ui.test.mjs
git commit -m "$(cat <<'EOF'
feat: editar slug e etapas em Minha página

EOF
)"
```

---

### Task 6: Template público + smoke

**Files:**
- Create: `src/pages/casal/CoupleHome.jsx`
- Modify: `src/pages/casal/CoupleSite.jsx`
- Modify: `src/pages/casal/PartnerHome.jsx` — receber `page` e preferir textos da API
- Modify: `tests/casal-ui.test.mjs`
- Modify: `tests/pages-routing.test.mjs` só se algo quebrar (não deve)

**Interfaces:**
- `CoupleHome({ slug, page })` renderiza âncoras `#boas-vindas`, `#o-casal`, `#o-dia`, `#local` e as seções RSVP/presentes/mural já existentes
- Heading: `page.names.filter(Boolean).join(' & ')` ou o `slug`
- Sem o h1 `Em breve` para conta com slug
- Parceiro: `PartnerHome` usa `page.names`, `dateLine`, `city`, `welcomeTitle`, `etapas` (title/detail); imagens continuam `PARTNER_COPY`

- [ ] **Step 1: Write the failing tests**

```js
test('CoupleSite uses CoupleHome for non-partner pages', () => {
  const site = readFileSync(new URL('../src/pages/casal/CoupleSite.jsx', import.meta.url), 'utf8');
  assert.match(site, /CoupleHome/);
  assert.doesNotMatch(site, /<h1>Em breve<\/h1>/);
  const home = readFileSync(new URL('../src/pages/casal/CoupleHome.jsx', import.meta.url), 'utf8');
  assert.match(home, /id="o-dia"/);
  assert.match(home, /RsvpSection/);
  const partner = readFileSync(new URL('../src/pages/casal/PartnerHome.jsx', import.meta.url), 'utf8');
  assert.match(partner, /page\./);
});
```

- [ ] **Step 2: Run to verify fail**

Run: `node --test tests/casal-ui.test.mjs`

Expected: FAIL CoupleHome ausente.

- [ ] **Step 3: Write minimal implementation**

`CoupleHome.jsx`: layout simples (classes `couple-site` / seções com os ids do nav). Importe `RsvpSection`, `GiftsSection`, `MessagesSection` como `PartnerHome`. Importe `../../dani-carine/style.css` **não** — o CSS já entra no chunk via `PartnerHome`/`CoupleSite`. Se CoupleSite não importar o CSS hoje, importe-o **só** em `CoupleSite.jsx` (já lazy) para os dois templates, **ou** deixe CoupleHome importar o mesmo CSS (chunk do casal). Não importe no `App.jsx` raiz.

`CoupleSite`: `fetchCouplePage` guarda `page`; `isPartner ? <PartnerHome slug page /> : <CoupleHome slug page />`. Title: parceiro `Dani & Carine`; senão names ou slug.

`PartnerHome`: `const copy = { ...PARTNER_COPY, ...pageFields }` onde pageFields mapeia `page.names` etc. quando presentes. Etapas: se `page.etapas?.length`, use-as no lugar de `copy.moments` para title/detail; imagens de `PARTNER_COPY.moments[i]` se existirem.

- [ ] **Step 4: Run suite + build**

```
node --test tests/slug-claim.test.mjs tests/couple-page-service.test.mjs tests/admin-page-api.test.mjs tests/casal-page-api.test.mjs tests/casal-ui.test.mjs tests/spa-auth-ui.test.mjs
npm run build
node --test tests/*.test.mjs
```

Expected: todos PASS, build exit 0.

Smoke no Vite (`npm run dev` se não estiver no ar):

1. Conta nova: `/admin/minha-pagina` publica slug `teste-d` + nomes → `/casal/teste-d` mostra os nomes, não “Em breve”
2. `/casal/nao-existe` → `Página não encontrada`
3. `/casal/dani-carine` continua Dani & Carine
4. Slug `admin` → erro “Este endereço não está disponível”
5. `/admin/minha-pagina` não mostra “Em breve” no h1 do hub

- [ ] **Step 5: Commit**

```bash
git add src/pages/casal/CoupleHome.jsx src/pages/casal/CoupleSite.jsx src/pages/casal/PartnerHome.jsx tests/casal-ui.test.mjs
git commit -m "$(cat <<'EOF'
feat: renderizar o site público a partir de Minha página

EOF
)"
```

Se não houver diff além do já commitado, não faça commit vazio — rode a suíte e reporte.

---

## Spec coverage

| Spec | Task |
|---|---|
| Formato / reservados / unique / partner lock | 1, 3 |
| `couple_pages` + defaults do parceiro | 2, 4 |
| GET/PUT `/api/admin/page` cookie | 3, 5 |
| GET público inclui `page` sem UUID | 4 |
| UI Minha página + copy de erro | 5 |
| CoupleHome vs PartnerHome | 6 |
| Sem upload / sem despublicar | — fora |

## Self-review

- Sem TBD de implementação
- `signup().accountId` não `account.id`
- `claimAccountSlug` ≠ `setAccountSlug`
- `toPublicPage` sem `accountId`
- Partner slug locked mesmo via PUT
- Paths e copy verbatim da spec
