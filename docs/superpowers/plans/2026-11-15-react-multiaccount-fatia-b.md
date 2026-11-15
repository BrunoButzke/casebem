# Fatia B — Site público `/casal/:slug` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/casal/:slug` deixa de redirecionar para o HTML estático e passa a ser o template React do casamento; slug desconhecido responde 404; APIs públicas de catálogo, lista, RSVP, mural e checkout resolvem `slug → account_id` sem misturar casais.

**Architecture:** O middleware já reescreve `/casal/*` para o SPA, exceto o stopgap 302 de `/casal/dani-carine` → `/dani-carine/`. Esta fatia remove o 302. `resolveAccountBySlug` (já existe) alimenta `GET /api/casal/:slug` e as APIs públicas via query/body `slug`. O React em `src/pages/casal/` porta o conteúdo do parceiro (sem login dos noivos, playlist, hospedagem ou papelaria). `dani-carine/index.html` e `games/` ficam no ar até as fatias seguintes; APIs sem `slug` continuam no casal parceiro para o MPA antigo não quebrar.

**Tech Stack:** Vite 8, React 19, react-router-dom 7, Cloudflare Pages Functions, D1, `node --test`, happy-dom. Sem React Testing Library — testes de UI exercitam helpers/APIs client, como `tests/spa-auth-ui.test.mjs`.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-11-14-react-multiaccount-design.md`
- Cloudflare Pages Free: Functions 100 mil req/dia, 10 ms CPU
- Cookie `cb_session` não autentica o site público; não há modal de login dos noivos em `/casal/:slug`
- Slug inexistente → 404 na página e nas APIs públicas (`error: 'SLUG_NOT_FOUND'`)
- Sem `slug` nas APIs públicas → fallback `partner-dani-carine` (MPA `/dani-carine/` ainda chama sem slug)
- Inquilino público = `resolveAccountBySlug`; ignorar `wedding_key` / `account_id` mandados pelo cliente
- Não renderizar playlist, hospedagem, papelaria, nem jogos (jogos = fatia C)
- Não apagar `dani-carine/index.html` nem `games/`
- Não implementar Minha página / editor de slug (fatia D)
- UI em português; runner `node --test`; nenhum código de produção sem teste que falhou primeiro
- Commits em português, foco no porquê; `git commit` com HEREDOC; não alterar `git config`; se o autor falhar, use `GIT_AUTHOR_NAME='Cursor Agent' GIT_AUTHOR_EMAIL='cursoragent@cursor.com'` (e o equivalente COMMITTER) só no comando
- Não commitar `.env`, senhas, `dani-carine/admin.html` sujo

## File map

| Path | Responsabilidade |
|---|---|
| `functions/_lib/pages-routing.mjs` | `/casal/dani-carine` reescreve para `/` (SPA), não 302 |
| `functions/_lib/public-slug.mjs` | Lê slug; 404 desconhecido; fallback parceiro se omitido |
| `functions/api/casal/[slug].js` | `GET` payload público `{ ok, slug, isPartner }` |
| `functions/api/gifts/catalog.js` | Catálogo por slug |
| `functions/api/guests/search.js` | Busca de convidados por slug |
| `functions/api/rsvp.js` | RSVP por slug / `account_id` |
| `functions/api/messages.js` | Mural por slug / `account_id` |
| `functions/_lib/messages-service.mjs` | `getMessages(..., accountId)` |
| `functions/_lib/rsvp-service.mjs` | `createRsvp` grava `account_id` |
| `functions/_lib/gifts-service.mjs` | Checkout usa catálogo da conta do slug |
| `functions/api/gifts/checkout.js` | Encaminha `accountId` resolvido |
| `vite.config.js` | Proxy local `/api/casal/:slug` e `slug` nas APIs públicas |
| `src/App.jsx` | Rotas `/casal/:slug` |
| `src/lib/casal-api.mjs` | Fetch público com `credentials: 'omit'` |
| `src/pages/casal/CoupleSite.jsx` | Shell + 404 |
| `src/pages/casal/partner-copy.mjs` | Texto/imagens do parceiro |
| `src/pages/casal/RsvpSection.jsx` | Confirmar presença |
| `src/pages/casal/GiftsSection.jsx` | Lista + carrinho Pix |
| `src/pages/casal/MessagesSection.jsx` | Mural |
| `src/dani-carine/style.css` | Visual portado (import só no chunk do casal) |
| `tests/pages-routing.test.mjs` | Sem 302 do parceiro |
| `tests/public-slug.test.mjs` | Resolvedor |
| `tests/casal-page-api.test.mjs` | GET `/api/casal/:slug` |
| `tests/public-catalog-slug.test.mjs` | Catálogo isolado |
| `tests/public-rsvp-slug.test.mjs` | RSVP isolado |
| `tests/casal-ui.test.mjs` | Helpers do template React |

---

### Task 1: `/casal/dani-carine` vira SPA

**Files:**
- Modify: `functions/_lib/pages-routing.mjs`
- Modify: `tests/pages-routing.test.mjs`
- Test: `tests/pages-routing.test.mjs`

**Interfaces:**
- Consumes: `resolvePagesRoute(hostname, pathname)` → `{ action, assetPath?, pathname? }`
- Produces: `/casal/dani-carine` e `/casal/dani-carine/` → `{ action: 'rewrite', assetPath: '/' }`; `/dani-carine/` continua `{ action: 'next' }`; `/casal` continua 302 `/entrar`

- [ ] **Step 1: Write the failing tests**

Em `tests/pages-routing.test.mjs`, **substitua** o teste `/casal/dani-carine redirects to the static partner landing` por:

```js
test('/casal/dani-carine rewrites to the root SPA', () => {
  for (const path of ['/casal/dani-carine', '/casal/dani-carine/']) {
    assert.deepEqual(resolvePagesRoute('casebem.com', path), {
      action: 'rewrite',
      assetPath: '/',
    });
  }
});

test('legacy /dani-carine/ static site is unchanged', () => {
  assert.deepEqual(resolvePagesRoute('casebem.com', '/dani-carine/'), { action: 'next' });
  assert.deepEqual(resolvePagesRoute('casebem.com', '/dani-carine/index.html'), { action: 'next' });
});
```

Mantenha o teste `product routes rewrite to the root SPA` (já inclui `/casal/outro-casal`).

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/pages-routing.test.mjs`

Expected: FAIL — o teste novo ainda vê `action: 'redirect'`.

- [ ] **Step 3: Write minimal implementation**

Em `functions/_lib/pages-routing.mjs`, **apague** o bloco:

```js
if (path === '/casal/dani-carine' || path === '/casal/dani-carine/') {
  return { action: 'redirect', pathname: '/dani-carine/' };
}
```

O loop `spaRoots` (`/entrar`, `/admin`, `/casal`) já reescreve `/casal/dani-carine` para `/`.

- [ ] **Step 4: Run tests**

Run: `node --test tests/pages-routing.test.mjs tests/mpa-spa-fallback.test.mjs`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add functions/_lib/pages-routing.mjs tests/pages-routing.test.mjs
git commit -m "$(cat <<'EOF'
feat: servir /casal/dani-carine no SPA em vez do HTML estático

EOF
)"
```

---

### Task 2: `GET /api/casal/:slug` + resolvedor público

**Files:**
- Create: `functions/_lib/public-slug.mjs`
- Create: `functions/api/casal/[slug].js`
- Create: `tests/public-slug.test.mjs`
- Create: `tests/casal-page-api.test.mjs`
- Modify: `vite.config.js` — desviar `GET /api/casal/:slug` para o handler
- Test: `tests/public-slug.test.mjs`, `tests/casal-page-api.test.mjs`

**Interfaces:**
- Consumes: `resolveAccountBySlug(db, slug)` de `functions/_lib/auth-service.mjs` (devolve row com `id`, `slug`, `isPartner`; `null` se não achar)
- Produces:
  - `slugFromRequest(request, body = null)` → `string | null` (query `slug` ou `body.slug`, trim + lowercase)
  - `resolvePublicSlug(db, slug)` → `{ ok: true, account }` \| `{ ok: false, status: 400, error: 'SLUG_REQUIRED' }` \| `{ ok: false, status: 404, error: 'SLUG_NOT_FOUND' }`
  - `resolvePublicSlugOrPartner(db, slug)` → se `slug` é null/vazio, resolve `'dani-carine'` (ou `{ id: PARTNER_ACCOUNT_ID, slug: 'dani-carine', isPartner: true }` se a linha ainda não existir na memory); senão igual a `resolvePublicSlug`
  - `GET /api/casal/:slug` 200 `{ ok: true, slug, isPartner }` **sem** `id` nem `email`; 404 `{ error: 'SLUG_NOT_FOUND' }`
  - `setAccountSlug(db, accountId, slug)` → `UPDATE accounts SET slug = ? WHERE id = ?` (só para testes e seed; sem UI)

- [ ] **Step 1: Write the failing tests**

`tests/public-slug.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryAuthDb } from './helpers/memory-auth-db.mjs';
import { signup, PARTNER_ACCOUNT_ID } from '../functions/_lib/auth-service.mjs';
import { ensurePartnerAccount } from '../functions/_lib/partner-seed.mjs';
import {
  slugFromRequest,
  resolvePublicSlug,
  resolvePublicSlugOrPartner,
} from '../functions/_lib/public-slug.mjs';

test('slugFromRequest reads query then body, lowercased', () => {
  const req = new Request('https://casebem.com/api/gifts/catalog?slug=Dani-Carine');
  assert.equal(slugFromRequest(req), 'dani-carine');
  const req2 = new Request('https://casebem.com/api/rsvp', { method: 'POST' });
  assert.equal(slugFromRequest(req2, { slug: 'Outro' }), 'outro');
  assert.equal(slugFromRequest(req2, {}), null);
});

test('resolvePublicSlug 400 without slug, 404 unknown, 200 known', async () => {
  const db = new MemoryAuthDb();
  const now = '2026-11-15T03:00:00.000Z';
  await ensurePartnerAccount(db, { email: 'dani@casebem.com', password: 'segredo12' }, now);
  assert.equal((await resolvePublicSlug(db, '')).error, 'SLUG_REQUIRED');
  assert.equal((await resolvePublicSlug(db, 'nao-existe')).status, 404);
  const hit = await resolvePublicSlug(db, 'dani-carine');
  assert.equal(hit.ok, true);
  assert.equal(hit.account.id, PARTNER_ACCOUNT_ID);
});

test('resolvePublicSlugOrPartner falls back to partner when slug omitted', async () => {
  const db = new MemoryAuthDb();
  await ensurePartnerAccount(db, { email: 'dani@casebem.com', password: 'segredo12' }, '2026-11-15T03:00:00.000Z');
  const hit = await resolvePublicSlugOrPartner(db, null);
  assert.equal(hit.ok, true);
  assert.equal(hit.account.id, PARTNER_ACCOUNT_ID);
});
```

`tests/casal-page-api.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryAuthDb } from './helpers/memory-auth-db.mjs';
import { ensurePartnerAccount } from '../functions/_lib/partner-seed.mjs';
import { signup } from '../functions/_lib/auth-service.mjs';
import { onRequestGet } from '../functions/api/casal/[slug].js';

function ctx(slug, db) {
  return {
    request: new Request(`https://casebem.com/api/casal/${slug}`),
    env: { DB: db },
    params: { slug },
  };
}

test('GET /api/casal/dani-carine returns slug without id or email', async () => {
  const db = new MemoryAuthDb();
  await ensurePartnerAccount(db, { email: 'dani@casebem.com', password: 'segredo12' }, '2026-11-15T03:00:00.000Z');
  const res = await onRequestGet(ctx('dani-carine', db));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.slug, 'dani-carine');
  assert.equal(body.isPartner, true);
  assert.equal('id' in body, false);
  assert.equal('email' in body, false);
});

test('GET /api/casal/unknown is 404 SLUG_NOT_FOUND', async () => {
  const db = new MemoryAuthDb();
  const res = await onRequestGet(ctx('nao-existe', db));
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.equal(body.error, 'SLUG_NOT_FOUND');
});

test('GET /api/casal/:slug of a non-partner account with slug is 200 isPartner false', async () => {
  const db = new MemoryAuthDb();
  const now = '2026-11-15T03:00:00.000Z';
  const { account } = await signup(db, { email: 'a@x.com', password: 'segredo12', plan: 'basic' }, now);
  await db.prepare('UPDATE accounts SET slug = ? WHERE id = ?').bind('casal-a', account.id).run();
  const res = await onRequestGet(ctx('casal-a', db));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.isPartner, false);
  assert.equal(body.slug, 'casal-a');
});
```

Se `MemoryAuthDb` ainda não implementar `UPDATE accounts SET slug`, adicione **somente** esse ramo em `tests/helpers/memory-auth-db.mjs` (e o equivalente em `ProcessMemoryAuthDb` se o teste bater nele). Não invente editor de slug no produto.

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/public-slug.test.mjs tests/casal-page-api.test.mjs`

Expected: FAIL module not found.

- [ ] **Step 3: Write minimal implementation**

`functions/_lib/public-slug.mjs`:

```js
import { PARTNER_ACCOUNT_ID, resolveAccountBySlug } from './auth-service.mjs';

export function slugFromRequest(request, body = null) {
  const url = new URL(request.url);
  const q = String(url.searchParams.get('slug') || '').trim().toLowerCase();
  if (q) return q;
  if (body && typeof body.slug === 'string') {
    const s = body.slug.trim().toLowerCase();
    if (s) return s;
  }
  return null;
}

export async function resolvePublicSlug(db, slug) {
  const normalized = String(slug || '').trim().toLowerCase();
  if (!normalized) return { ok: false, status: 400, error: 'SLUG_REQUIRED' };
  const account = await resolveAccountBySlug(db, normalized);
  if (!account) return { ok: false, status: 404, error: 'SLUG_NOT_FOUND' };
  return { ok: true, account };
}

const PARTNER_FALLBACK = {
  id: PARTNER_ACCOUNT_ID,
  slug: 'dani-carine',
  isPartner: true,
};

export async function resolvePublicSlugOrPartner(db, slug) {
  const normalized = slug == null ? '' : String(slug).trim().toLowerCase();
  if (!normalized) {
    const account = await resolveAccountBySlug(db, 'dani-carine');
    return { ok: true, account: account || PARTNER_FALLBACK, legacy: true };
  }
  return resolvePublicSlug(db, normalized);
}
```

`functions/api/casal/[slug].js`:

```js
import { getCorsHeaders } from '../../_lib/http-helpers.mjs';
import { resolvePublicSlug } from '../../_lib/public-slug.mjs';

export async function onRequestOptions(context) {
  return new Response(null, { status: 204, headers: getCorsHeaders(context.request) });
}

export async function onRequestGet(context) {
  const { request, env, params } = context;
  const headers = getCorsHeaders(request);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  const resolved = await resolvePublicSlug(env.DB || null, params?.slug);
  if (!resolved.ok) {
    return Response.json({ error: resolved.error }, { status: resolved.status, headers });
  }
  return Response.json(
    { ok: true, slug: resolved.account.slug, isPartner: Boolean(resolved.account.isPartner) },
    { status: 200, headers }
  );
}
```

No `vite.config.js`, no plugin de auth/API local, **antes** dos outros `/api/` handlers:

```js
const casalPage = path.match(/^\/api\/casal\/([^/]+)\/?$/);
if (casalPage && req.method === 'GET') {
  const { onRequestGet } = await import('./functions/api/casal/[slug].js');
  const res = await onRequestGet({
    request: new Request(`http://localhost${path}`),
    env: { DB: null },
    params: { slug: decodeURIComponent(casalPage[1]) },
  });
  const text = await res.text();
  return sendJson(resOut, res.status, JSON.parse(text));
}
```

Use o `sendJson` já existente; se `DB: null` não resolver o parceiro, chame `ensurePartnerAccount` no boot do plugin **não** — o Vite sem D1 usa `ProcessMemoryAuthDb`, que começa vazio. Para o preview local do parceiro funcionar, no handler Vite de `/api/casal/:slug` use:

```js
import { ensurePartnerAccount } from './functions/_lib/partner-seed.mjs';
await ensurePartnerAccount(null, {
  email: process.env.PARTNER_EMAIL,
  password: process.env.PARTNER_BOOTSTRAP_PASSWORD,
}, new Date().toISOString());
```

`ensurePartnerAccount` já é no-op sem email/password. Nos testes unitários o `MemoryAuthDb` é injetado; não dependa do Vite.

Também exporte `setAccountSlug` e implemente `UPDATE accounts SET slug` em `MemoryAuthDb` e `ProcessMemoryAuthDb`.

- [ ] **Step 4: Run tests**

Run: `node --test tests/public-slug.test.mjs tests/casal-page-api.test.mjs tests/partner-seed.test.mjs tests/auth-service.test.mjs`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add functions/_lib/public-slug.mjs functions/api/casal/[slug].js tests/public-slug.test.mjs tests/casal-page-api.test.mjs tests/helpers/memory-auth-db.mjs vite.config.js functions/_lib/auth-service.mjs
git commit -m "$(cat <<'EOF'
feat: resolver slug público e expor GET /api/casal/:slug

EOF
)"
```

Só adicione `auth-service.mjs` se o `UPDATE slug` da memory db viver lá (ProcessMemory). Prefira o helper de teste.

---

### Task 3: Catálogo e busca de convidados por slug

**Files:**
- Modify: `functions/api/gifts/catalog.js`
- Modify: `functions/api/guests/search.js`
- Modify: `vite.config.js` — passar slug resolvido para `getActiveCatalog` / `searchGuests`
- Create: `tests/public-catalog-slug.test.mjs`
- Test: `tests/public-catalog-slug.test.mjs`

**Interfaces:**
- Consumes: `slugFromRequest`, `resolvePublicSlugOrPartner`, `getActiveCatalog(db, accountId)`, `searchGuests(db, q, accountId)`
- Produces: `GET /api/gifts/catalog?slug=` e `GET /api/guests/search?q=&slug=` 404 se slug desconhecido; isolamento A/B; sem slug = parceiro

- [ ] **Step 1: Write the failing tests**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signup, setAccountSlug } from '../functions/_lib/auth-service.mjs';
import { createGift, resetMemoryCatalogForTests } from '../functions/_lib/catalog-service.mjs';
import { addGuests, resetMemoryGuestsForTests } from '../functions/_lib/rsvp-guest-list.mjs';
import { onRequestGet as catalogGet } from '../functions/api/gifts/catalog.js';
import { onRequestGet as searchGet } from '../functions/api/guests/search.js';

async function twoAccounts() {
  const now = '2026-11-15T03:00:00.000Z';
  const a = await signup(null, { email: 'a@public-catalog.example', password: 'segredo12', plan: 'basic' }, now);
  const b = await signup(null, { email: 'b@public-catalog.example', password: 'segredo12', plan: 'basic' }, now);
  await setAccountSlug(null, a.account.id, 'casal-a');
  await setAccountSlug(null, b.account.id, 'casal-b');
  return { a: a.account, b: b.account };
}

test('catalog for slug B does not include gift created on A', async () => {
  resetMemoryCatalogForTests();
  const { a } = await twoAccounts();
  const gift = await createGift(null, a.id, {
    name: 'Lua A',
    description: 'Viagem',
    priceInCents: 1000,
    mode: 'fixed',
  });
  const resB = await catalogGet({
    request: new Request('https://casebem.com/api/gifts/catalog?slug=casal-b'),
    env: { DB: null },
  });
  assert.equal(resB.status, 200);
  const body = await resB.json();
  assert.equal(body.gifts.some((g) => g.id === gift.id), false);

  const resUnknown = await catalogGet({
    request: new Request('https://casebem.com/api/gifts/catalog?slug=nao-existe'),
    env: { DB: null },
  });
  assert.equal(resUnknown.status, 404);
});

test('guest search for slug B does not return guest of A', async () => {
  resetMemoryGuestsForTests();
  const { a } = await twoAccounts();
  await addGuests(null, ['Ana Alpha'], { accountId: a.id });
  const resB = await searchGet({
    request: new Request('https://casebem.com/api/guests/search?q=Ana&slug=casal-b'),
    env: { DB: null },
  });
  assert.equal(resB.status, 200);
  const body = await resB.json();
  assert.equal(body.count, 0);
});
```

`getActiveCatalog(null, accountId)` usa o mapa em memória — o `env.DB` do handler é o auth db. O catálogo memory **não** lê o auth db. Isso é ok: o handler resolve o slug no auth db e passa `account.id` para `getActiveCatalog(env.DB || null, account.id)`. Com `env.DB = authDb` o catálogo tentará SQL. Nos testes, passe `env: { DB: db }` só para o slug; o catálogo memory precisa `db=null` **ou** o handler deve chamar `getActiveCatalog(null, id)` quando o prepare do auth db não fala `gifts_catalog`.

Regra: depois de resolver o slug, chame os serviços de casamento com `env.DB` (D1 real). Nos testes unitários de isolamento, use `env.DB = db` (MemoryAuthDb) **somente** para `resolveAccountBySlug`. Para não quebrar o catálogo, faça o handler:

```js
const resolved = await resolvePublicSlugOrPartner(env.DB || null, slugFromRequest(request));
if (!resolved.ok) return Response.json({ error: resolved.error }, { status: resolved.status, headers });
const catalog = await getActiveCatalog(env.DB || null, resolved.account.id);
```

Se `MemoryAuthDb.prepare` lançar `unsupported` em `gifts_catalog`, os testes de catálogo vão falhar por SQL, não por isolamento. **Nesses testes**, crie as contas no `ProcessMemoryAuthDb` via `signup(null, …)` / `ensurePartnerAccount(null, …)` (db null = process memory de auth) **e** `createGift(null, id, …)`. Aí `env.DB` nos handlers deve ser `null` para os dois mapas process-wide.

Ajuste o teste: use `env: { DB: null }` e `signup(null, …)` + `ensurePartnerAccount(null, …)`. Garanta que `ProcessMemoryAuthDb` suporte `UPDATE accounts SET slug`. Faça um `reset` de contas se existir; se não existir, use slugs únicos por teste (`casal-a-${Date.now()}` não — use ids fixos e `UPDATE`).

Como o process memory persiste entre testes, no `twoAccounts` use emails únicos:

`a@public-catalog.example`, `b@public-catalog.example`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/public-catalog-slug.test.mjs`

Expected: FAIL — catalog ainda ignora slug (sempre parceiro) ou 200 com gift de A.

- [ ] **Step 3: Write minimal implementation**

Em `catalog.js` e `search.js`, no GET:

```js
const slug = slugFromRequest(request);
const resolved = await resolvePublicSlugOrPartner(env.DB || null, slug);
if (!resolved.ok) {
  return Response.json({ error: resolved.error }, { status: resolved.status, headers });
}
// catalog:
const catalog = await getActiveCatalog(env.DB || null, resolved.account.id);
// search:
const matches = await searchGuests(env.DB || null, q, resolved.account.id);
```

Vite `GET /api/gifts/catalog` e `GET /api/guests/search`: leia `slug` da query e use `resolvePublicSlugOrPartner(null, slug)` + o `account.id` nas chamadas que hoje passam `PARTNER_ACCOUNT_ID`.

- [ ] **Step 4: Run tests**

Run: `node --test tests/public-catalog-slug.test.mjs tests/catalog-isolation.test.mjs tests/catalog-editor.test.mjs`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add functions/api/gifts/catalog.js functions/api/guests/search.js vite.config.js tests/public-catalog-slug.test.mjs functions/_lib/auth-service.mjs
git commit -m "$(cat <<'EOF'
feat: filtrar catálogo e busca de convidados pelo slug da URL

EOF
)"
```

---

### Task 4: RSVP, mural e checkout por `account_id` do slug

**Files:**
- Modify: `functions/_lib/messages-service.mjs` — `getMessages(db, limit, cursor, accountId = PARTNER_ACCOUNT_ID)`
- Modify: `functions/api/messages.js`
- Modify: `functions/_lib/rsvp-service.mjs` — `createRsvp(..., accountId = PARTNER_ACCOUNT_ID)` inclui `account_id` no INSERT e no WHERE de idempotência
- Modify: `functions/api/rsvp.js` — resolve slug; `assertGuestAllowed(db, name, account.id)`
- Modify: `functions/_lib/gifts-service.mjs` — `getActiveCatalog(db, options.accountId || PARTNER_ACCOUNT_ID)`
- Modify: `functions/api/gifts/checkout.js` — resolve slug do body
- Modify: testes que mockam SQL de `getMessages` / INSERT rsvp se a assinatura/SQL mudar
- Create: `tests/public-rsvp-slug.test.mjs`
- Modify: `vite.config.js` (messages GET/POST, rsvp POST, checkout se existir)

**Interfaces:**
- Consumes: `resolvePublicSlugOrPartner`, `slugFromRequest`, `createMessage(..., accountId)`, `assertGuestAllowed`
- Produces: mural/RSVP/checkout da conta A invisíveis via slug B; slug desconhecido 404; payload **não** ecoa `account_id`

Exporte de `functions/_lib/auth-service.mjs` (se a Task 2 ainda não o fez):

```js
export async function setAccountSlug(db, accountId, slug) {
  db = resolveDb(db);
  await db.prepare('UPDATE accounts SET slug = ? WHERE id = ?').bind(slug, accountId).run();
  return resolveAccountBySlug(db, slug);
}
```

Implemente `UPDATE accounts SET slug` em `ProcessMemoryAuthDb` e `MemoryAuthDb`.

- [ ] **Step 1: Write the failing tests**

`tests/public-rsvp-slug.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signup, setAccountSlug } from '../functions/_lib/auth-service.mjs';
import { addGuests, resetMemoryGuestsForTests } from '../functions/_lib/rsvp-guest-list.mjs';
import { createMessage, resetMemoryMessagesForTests } from '../functions/_lib/messages-service.mjs';
import { createGift, getActiveCatalog, resetMemoryCatalogForTests } from '../functions/_lib/catalog-service.mjs';
import { onRequestGet as messagesGet, onRequestPost as messagesPost } from '../functions/api/messages.js';
import { onRequestPost as rsvpPost } from '../functions/api/rsvp.js';
import { onRequestPost as checkoutPost } from '../functions/api/gifts/checkout.js';

const SECRET = Buffer.alloc(32, 7).toString('base64');

test('messages GET for slug B does not list message created on A', async () => {
  resetMemoryMessagesForTests();
  const a = await signup(null, { email: 'msg-a@x.com', password: 'segredo12', plan: 'basic' }, '2026-11-15T03:00:00.000Z');
  const b = await signup(null, { email: 'msg-b@x.com', password: 'segredo12', plan: 'basic' }, '2026-11-15T03:00:00.000Z');
  await setAccountSlug(null, a.account.id, 'msg-a');
  await setAccountSlug(null, b.account.id, 'msg-b');
  await createMessage(null, { guestName: 'Ana', message: 'Oi do A', consentGiven: true }, 'k-a', SECRET, a.account.id);
  const res = await messagesGet({
    request: new Request('https://casebem.com/api/messages?slug=msg-b'),
    env: { DB: null, RSVP_SECRET: SECRET },
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  const texts = (body.messages || []).map((m) => m.message);
  assert.equal(texts.includes('Oi do A'), false);
});

test('messages POST unknown slug is 404', async () => {
  const res = await messagesPost({
    request: new Request('https://casebem.com/api/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'Idempotency-Key': 'k-unknown' },
      body: JSON.stringify({
        slug: 'nao-existe',
        guestName: 'Ana',
        message: 'Oi',
        consentGiven: true,
      }),
    }),
    env: { DB: null, RSVP_SECRET: SECRET },
  });
  assert.equal(res.status, 404);
});

test('RSVP for slug B cannot confirm guest that only exists on A', async () => {
  resetMemoryGuestsForTests();
  const a = await signup(null, { email: 'g-a@x.com', password: 'segredo12', plan: 'basic' }, '2026-11-15T03:00:00.000Z');
  const b = await signup(null, { email: 'g-b@x.com', password: 'segredo12', plan: 'basic' }, '2026-11-15T03:00:00.000Z');
  await setAccountSlug(null, a.account.id, 'g-a');
  await setAccountSlug(null, b.account.id, 'g-b');
  await addGuests(null, ['Ana Alpha'], { accountId: a.account.id });
  const res = await rsvpPost({
    request: new Request('https://casebem.com/api/rsvp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'Idempotency-Key': 'rsvp-b-1' },
      body: JSON.stringify({
        slug: 'g-b',
        guestName: 'Ana Alpha',
        attending: true,
        adultsCount: 1,
        childrenCount: 0,
        consentGiven: true,
      }),
    }),
    env: { DB: null, RSVP_SECRET: SECRET },
  });
  assert.ok(res.status === 400 || res.status === 403);
});
```

Se `rsvp.js` exige D1 (`env.DB`) e falha 503 com `null`, o teste deve usar um fake D1 mínimo **ou** o ramo memory de `createRsvp`. Prefira: se `!db`, `createRsvp` já tem caminho? Se não, **não** invente memory RSVP completo — teste o handler com fake:

```js
function fakeRsvpDb(accountId) {
  const rows = [];
  return {
    prepare(sql) {
      return {
        _p: [],
        bind(...p) { this._p = p; return this; },
        async first() { return null; },
        async run() { return { success: true }; },
        async all() { return { results: [] }; },
      };
    },
    async batch(stmts) { return stmts.map(() => ({ success: true })); },
  };
}
```

O isolamento real de RSVP neste teste é `assertGuestAllowed`: convidado de A não está na lista memory de B → erro `GUEST_NOT_ON_LIST` (ou a mensagem atual). Leia `assertGuestAllowed` e aceite o status que o handler já mapeia (provavelmente 400).

Checkout: teste de serviço, não HTTP, para não puxar Mercado Pago:

```js
import { getActiveCatalog, createGift, resetMemoryCatalogForTests } from '../functions/_lib/catalog-service.mjs';

test('checkout catalog lookup uses options.accountId not the partner default', async () => {
  resetMemoryCatalogForTests();
  const giftA = await createGift(null, 'acc-checkout-a', {
    name: 'A',
    description: 'd',
    priceInCents: 1000,
    mode: 'fixed',
  });
  const catalogB = await getActiveCatalog(null, 'acc-checkout-b');
  assert.equal(catalogB.some((g) => g.id === giftA.id), false);
});
```

No `createCheckoutPayment`, troque `PARTNER_ACCOUNT_ID` por `options.accountId || PARTNER_ACCOUNT_ID`. Teste extra:

```js
import { createCheckoutPayment } from '../functions/_lib/gifts-service.mjs';

test('createCheckoutPayment rejects gift from another account catalog', async () => {
  resetMemoryCatalogForTests();
  await createGift(null, 'pay-a', {
    name: 'A',
    description: 'd',
    priceInCents: 1000,
    mode: 'fixed',
  });
  const result = await createCheckoutPayment(
    {
      paymentMethod: 'pix',
      gifterName: 'Ana',
      intentKey: 'intent-b-1',
      items: [{ giftId: 'a' /* id real giftA.id */, quantity: 1 }],
    },
    { RSVP_SECRET: SECRET, MP_ACCESS_TOKEN: 'x' },
    { prepare() { throw new Error('no d1'); } },
    '1.1.1.1',
    { accountId: 'pay-b' }
  );
  // Esperado: throw ou ok:false porque o gift não está no catálogo B
});
```

Use `giftA.id` de verdade. Se `createCheckoutPayment` exige D1 de intents e explode antes do catálogo, o assert é `Presente não encontrado` **ou** `DATABASE` — ajuste o fake D1 só o suficiente para passar da checagem de intent **depois** da checagem de catálogo (a ordem atual é catálogo primeiro: linhas 161–167). Com `db` truthy e `getActiveCatalog` SQL falhando, o teste fica instável. **Use `db: null` não** — a função retorna 503 se `!db`. Passe um objeto `db` cujo `prepare` para `gifts_catalog` devolva vazio, **ou** faça `getActiveCatalog` ser chamado com memory quando `options.accountId` está setado e um flag `options.useMemoryCatalog`. YAGNI: altere só a linha do `getActiveCatalog(db, accountId)` e, neste teste, mocke `db.prepare` para queries de catálogo retornarem `{ results: [] }` / `first: null`. O importante é `accountId: 'pay-b'` não ver o gift de `pay-a`. Com D1 fake vazio, ambos vazios — ainda prova que não usa PARTNER memory. Melhor: `getActiveCatalog` se `db` tem `prepare` vai SQL. Então o teste de isolamento de catálogo memory (`getActiveCatalog(null, 'acc-checkout-b')`) já cobre o serviço; o handler HTTP de checkout só precisa passar `accountId`. Teste HTTP do checkout **pode** ser omitido se o plugin Vite não for o alvo. Teste o handler:

Em `checkout.js`, depois do JSON parse:

```js
const slug = slugFromRequest(request, body);
const resolved = await resolvePublicSlugOrPartner(env.DB || null, slug);
if (!resolved.ok) return Response.json({ error: resolved.error }, { status: resolved.status, headers });
const result = await createCheckoutPayment(body, env, env.DB, ipAddress, {
  origin,
  accountId: resolved.account.id,
});
```

Teste handler 404:

```js
import { onRequestPost as checkoutPost } from '../functions/api/gifts/checkout.js';

test('checkout unknown slug is 404', async () => {
  const res = await checkoutPost({
    request: new Request('https://casebem.com/api/gifts/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Origin: 'https://casebem.com' },
      body: JSON.stringify({
        slug: 'nao-existe',
        paymentMethod: 'pix',
        gifterName: 'Ana',
        intentKey: 'i1',
        items: [{ giftId: 'x', quantity: 1 }],
      }),
    }),
    env: { DB: { prepare() { return { bind() { return this; }, first: async () => null }; } } },
  });
  assert.equal(res.status, 404);
});
```

`validateOrigin` pode 403. Use Origin permitido (`https://casebem.com` se o helper aceitar) ou omita Origin.

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/public-rsvp-slug.test.mjs`

Expected: FAIL (mural lista recado de A ou POST ignora slug).

- [ ] **Step 3: Write minimal implementation**

`getMessages`: adicione `accountId = PARTNER_ACCOUNT_ID`. SQL `WHERE account_id = ?` no lugar de `wedding_key = ?`. Memory: se `!db`, leia `listMemoryMessages(accountId)` (não hidden), paginare como o SQL. Testes antigos de `getMessages(db, …)` que mockam `wedding_key` **precisam** mockar `account_id` **ou** receber o 4º arg e continuar. Atualize `tests/messages-service.test.mjs` / `tests/messages-api.test.mjs` para `account_id` nas strings SQL e no `bind` (parceiro = `partner-dani-carine`).

`messages.js` GET/POST: `resolvePublicSlugOrPartner` + passar `account.id` para `getMessages` / `createMessage`.

`createRsvp`: parâmetro `accountId = PARTNER_ACCOUNT_ID`; INSERT inclui `account_id`; WHERE idempotência `account_id = ?` (mantenha `wedding_key` preenchido com `weddingKeyFor(accountId)` se a coluna continuar NOT NULL). Atualize mocks em `tests/rsvp-api.test.mjs` se quebrarem.

`rsvp.js` POST: resolve slug; `assertGuestAllowed(env.DB || null, data.guestName, account.id)` antes de criar; passe `account.id` para `createRsvp`.

`createCheckoutPayment`: `const accountId = options.accountId || PARTNER_ACCOUNT_ID` na linha do catálogo.

`messages.js` GET atual ignora hidden via SQL; no memory filtre `hidden !== 1`.

- [ ] **Step 4: Run tests**

Run: `node --test tests/public-rsvp-slug.test.mjs tests/messages-service.test.mjs tests/messages-api.test.mjs tests/rsvp-api.test.mjs tests/rsvp-security.test.mjs`

Expected: PASS. Se um arquivo rsvp não listado quebrar por SQL, atualize o mock `account_id` (não reverta o filtro).

- [ ] **Step 5: Commit**

```bash
git add functions/_lib/messages-service.mjs functions/api/messages.js functions/_lib/rsvp-service.mjs functions/api/rsvp.js functions/_lib/gifts-service.mjs functions/api/gifts/checkout.js functions/_lib/auth-service.mjs tests/helpers/memory-auth-db.mjs tests/public-rsvp-slug.test.mjs tests/messages-service.test.mjs tests/messages-api.test.mjs tests/rsvp-api.test.mjs vite.config.js
git commit -m "$(cat <<'EOF'
feat: isolar mural, RSVP e checkout pelo slug público

EOF
)"
```

---

### Task 5: Shell React `/casal/:slug` + 404

**Files:**
- Create: `src/lib/casal-api.mjs`
- Create: `src/pages/casal/CoupleSite.jsx`
- Create: `src/pages/casal/couple-nav.mjs`
- Modify: `src/App.jsx`
- Create: `tests/casal-ui.test.mjs`

**Interfaces:**
- Consumes: `GET /api/casal/:slug`
- Produces:
  - `fetchCouplePage(slug)` → `{ ok, slug, isPartner } | { ok: false, status, error }`
  - `coupleNavItems()` → âncoras **somente** `#boas-vindas`, `#o-casal`, `#o-dia`, `#local`, `#confirmar-presenca`, `#presentes`, `#mural-recados` (sem playlist, hospedagem, papelaria, login)
  - Rota React `/casal/:slug` (sem basename)
  - 404: heading `Página não encontrada` quando status 404
  - Sem botão/modal `Acesso dos noivos` / `admin-login`

- [ ] **Step 1: Write the failing tests**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { coupleNavItems } from '../src/pages/casal/couple-nav.mjs';
import { fetchCouplePage } from '../src/lib/casal-api.mjs';
import { readFileSync } from 'node:fs';

test('couple nav omits playlist, lodging, stationery and login', () => {
  const ids = coupleNavItems().map((i) => i.href);
  assert.deepEqual(ids, [
    '#boas-vindas',
    '#o-casal',
    '#o-dia',
    '#local',
    '#confirmar-presenca',
    '#presentes',
    '#mural-recados',
  ]);
  assert.equal(ids.some((h) => h.includes('playlist') || h.includes('hosped')), false);
});

test('fetchCouplePage 404 yields SLUG_NOT_FOUND', async () => {
  const window = new Window({ url: 'http://localhost/casal/x' });
  globalThis.window = window;
  globalThis.fetch = async (url) => {
    assert.equal(String(url), '/api/casal/nao-existe');
    return new Response(JSON.stringify({ error: 'SLUG_NOT_FOUND' }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    });
  };
  const result = await fetchCouplePage('nao-existe');
  assert.equal(result.ok, false);
  assert.equal(result.status, 404);
  assert.equal(result.error, 'SLUG_NOT_FOUND');
});

test('App.jsx declares /casal/:slug and CoupleSite has no admin login', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(app, /path="\/casal\/:slug"/);
  const page = readFileSync(new URL('../src/pages/casal/CoupleSite.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(page, /admin-login|Acesso dos noivos/);
  assert.match(page, /Página não encontrada/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/casal-ui.test.mjs`

Expected: FAIL module not found.

- [ ] **Step 3: Write minimal implementation**

`src/lib/casal-api.mjs`:

```js
export async function fetchCouplePage(slug) {
  const res = await fetch(`/api/casal/${encodeURIComponent(slug)}`, { credentials: 'omit' });
  const type = res.headers.get('content-type') || '';
  const data = type.includes('json') ? await res.json().catch(() => ({})) : {};
  if (!res.ok) {
    return { ok: false, status: res.status, error: data.error || 'SLUG_NOT_FOUND' };
  }
  return { ok: true, slug: data.slug, isPartner: Boolean(data.isPartner) };
}
```

`src/pages/casal/couple-nav.mjs`:

```js
export function coupleNavItems() {
  return [
    { href: '#boas-vindas', label: 'Início' },
    { href: '#o-casal', label: 'O casal' },
    { href: '#o-dia', label: 'O dia' },
    { href: '#local', label: 'Local' },
    { href: '#confirmar-presenca', label: 'Presença' },
    { href: '#presentes', label: 'Presentes' },
    { href: '#mural-recados', label: 'Mural' },
  ];
}
```

`CoupleSite.jsx`: `useParams().slug`, `useEffect` → `fetchCouplePage`. Loading: `<p>Carregando…</p>`. 404: `<h1>Página não encontrada</h1>`. Sucesso: `<div className="couple-site">` + `<nav>` com `coupleNavItems()` como `<a href>`. Sem import de `admin-login`. Rota em `App.jsx`:

```jsx
<Route path="/casal/:slug" element={<CoupleSite />} />
```

Não capture `/casal/:slug/game/*` nesta fatia.

- [ ] **Step 4: Run tests**

Run: `node --test tests/casal-ui.test.mjs`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/casal-api.mjs src/pages/casal/CoupleSite.jsx src/pages/casal/couple-nav.mjs src/App.jsx tests/casal-ui.test.mjs
git commit -m "$(cat <<'EOF'
feat: abrir o site do casal no SPA com 404 para slug desconhecido

EOF
)"
```

---

### Task 6: Conteúdo do parceiro (história, dia, local, traje, manual)

**Files:**
- Create: `src/pages/casal/partner-copy.mjs`
- Create: `src/pages/casal/PartnerHome.jsx`
- Modify: `src/pages/casal/CoupleSite.jsx` — se `isPartner`, render `PartnerHome`; senão um `<main>` mínimo com `<h1>Em breve</h1>` (contas com slug que não são parceiro — só testes; produto ainda só o parceiro tem slug)
- Modify: `tests/casal-ui.test.mjs`
- Import: `src/dani-carine/style.css` em `PartnerHome.jsx` (chunk do casal)

**Interfaces:**
- Consumes: `isPartner` do GET
- Produces: `PARTNER_COPY` com os textos/imagens abaixo; seções com os ids da Task 5 **exceto** rsvp/presentes/mural (placeholders `<section id="…">` vazios para âncoras, preenchidos nas tasks 7–9)

`PARTNER_COPY` **obrigatório**:

```js
export const PARTNER_COPY = {
  city: 'Florianópolis · Lagoa da Conceição',
  names: ['Dani', 'Carine'],
  dateLine: '21 de novembro · 8h',
  heroImage: '/images/hero-casal.jpg',
  welcomeTitle: 'Sejam muito bem-vindos ao nosso cantinho especial!',
  storyEyebrow: 'Nossa história',
  manifesto: 'Um sim ao amanhecer.',
  manifestoImage: '/images/indaia-noite.jpg',
  portraits: [
    { src: '/images/casal-dani.png', alt: 'Dani', caption: 'Dani' },
    { src: '/images/casal-carine.png', alt: 'Carine', caption: 'Carine' },
  ],
  moments: [
    { n: '01', title: 'Cerimônia', detail: '21 de novembro · 8h', image: '/images/cerimonia-altar.png' },
    { n: '02', title: 'Brunch', detail: 'Buffet de café da manhã', image: '/images/brunch-saloes.png' },
    { n: '03', title: 'Festa', detail: 'Indaiá Eventos', image: '/images/festa-danca.jpg' },
  ],
  venueName: 'Indaiá Eventos',
  venuePlace: 'Canto da Lagoa · Florianópolis',
  mapsHref: 'https://www.google.com/maps/search/?api=1&query=Indai%C3%A1+Eventos+Canto+da+Lagoa+Florian%C3%B3polis',
  dressTitle: 'Social completo',
  dressRule: 'Branco proibido',
  manualImage: '/images/manual-convidado.png',
};
```

Porte o HTML das seções `hero`, `boas-vindas`, `manifesto` (countdown simples com `date-fns` **não** — use `setInterval` local ou números estáticos; countdown opcional), `o-casal`, `o-dia`, `local`, `dress-code`, `manual-convidado`, reusando as **classNames** de `dani-carine/index.html` para o CSS existente aplicar. Sem GSAP/Lenis nesta fatia.

Não inclua `#playlist`, hospedagem, papelaria.

- [ ] **Step 1: Write the failing tests**

Acrescente em `tests/casal-ui.test.mjs`:

```js
import { PARTNER_COPY } from '../src/pages/casal/partner-copy.mjs';

test('partner copy names Dani and Carine and keeps venue Indaiá', () => {
  assert.deepEqual(PARTNER_COPY.names, ['Dani', 'Carine']);
  assert.equal(PARTNER_COPY.venueName, 'Indaiá Eventos');
  assert.equal(PARTNER_COPY.dressRule, 'Branco proibido');
  assert.match(PARTNER_COPY.heroImage, /hero-casal/);
});

test('PartnerHome markup contains required section ids and omits playlist', () => {
  const src = readFileSync(new URL('../src/pages/casal/PartnerHome.jsx', import.meta.url), 'utf8');
  for (const id of ['boas-vindas', 'o-casal', 'o-dia', 'local', 'dress-code', 'manual-convidado']) {
    assert.match(src, new RegExp(`id="${id}"`));
  }
  assert.doesNotMatch(src, /id="playlist"|hospedagem|Papelaria/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/casal-ui.test.mjs`

Expected: FAIL missing `partner-copy.mjs`.

- [ ] **Step 3: Write minimal implementation**

Crie os arquivos. `CoupleSite` no sucesso:

```jsx
{page.isPartner ? <PartnerHome slug={page.slug} /> : (
  <main><h1>Em breve</h1></main>
)}
```

Placeholders no `PartnerHome` (ou no `CoupleSite` abaixo do partner):

```jsx
<section id="confirmar-presenca" />
<section id="presentes" />
<section id="mural-recados" />
```

Se os placeholders ficarem no `CoupleSite`, o teste de `PartnerHome` não precisa deles.

- [ ] **Step 4: Run tests**

Run: `node --test tests/casal-ui.test.mjs`

Expected: PASS. `npm run build` deve continuar exit 0 (Task 9 roda build; aqui rode se o import CSS quebrar).

- [ ] **Step 5: Commit**

```bash
git add src/pages/casal/partner-copy.mjs src/pages/casal/PartnerHome.jsx src/pages/casal/CoupleSite.jsx tests/casal-ui.test.mjs
git commit -m "$(cat <<'EOF'
feat: portar o conteúdo público do casal parceiro para o template React

EOF
)"
```

---

### Task 7: RSVP no React

**Files:**
- Create: `src/pages/casal/RsvpSection.jsx`
- Modify: `src/lib/casal-api.mjs` — `searchGuestsPublic`, `submitRsvp`
- Modify: `src/pages/casal/PartnerHome.jsx` (ou CoupleSite) — render `RsvpSection` em `#confirmar-presenca`
- Modify: `tests/casal-ui.test.mjs`

**Interfaces:**
- `searchGuestsPublic(slug, q)` → `GET /api/guests/search?q=&slug=`
- `submitRsvp(slug, payload)` → `POST /api/rsvp` JSON inclui `slug`; header `Idempotency-Key` (uuid)
- Fluxo: nome (≥2 letras) → busca → se 1 match seleciona; se vários, radios; se 0, erro `Nome não encontrado na lista`; depois Sim/Não e envio
- Copy: `Confirme até 15 de novembro.` / `Você vai estar com a gente?`

- [ ] **Step 1: Write the failing tests**

```js
import { searchGuestsPublic, submitRsvp } from '../src/lib/casal-api.mjs';

test('searchGuestsPublic and submitRsvp send slug', async () => {
  const window = new Window({ url: 'http://localhost/casal/dani-carine' });
  globalThis.window = window;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ ok: true, matches: [], count: 0 }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  await searchGuestsPublic('dani-carine', 'Ana');
  assert.equal(calls[0].url.includes('slug=dani-carine'), true);
  assert.equal(calls[0].url.includes('q=Ana'), true);
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ id: '1' }), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    });
  };
  await submitRsvp('dani-carine', {
    guestName: 'Ana Alpha',
    attending: true,
    adultsCount: 1,
    childrenCount: 0,
    consentGiven: true,
  });
  const last = calls[calls.length - 1];
  assert.equal(last.url, '/api/rsvp');
  assert.equal(last.init.method, 'POST');
  const body = JSON.parse(last.init.body);
  assert.equal(body.slug, 'dani-carine');
  const headers = last.init.headers;
  const key = headers['Idempotency-Key'] || headers['idempotency-key'] || (headers.get && headers.get('Idempotency-Key'));
  assert.ok(key && String(key).length >= 8);
});
```

Leia `RsvpSection.jsx`:

```js
test('RsvpSection asks to confirm by 15 November and has attending radios', () => {
  const src = readFileSync(new URL('../src/pages/casal/RsvpSection.jsx', import.meta.url), 'utf8');
  assert.match(src, /15 de novembro/);
  assert.match(src, /attending/);
  assert.match(src, /searchGuestsPublic/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/casal-ui.test.mjs`

Expected: FAIL missing exports.

- [ ] **Step 3: Write minimal implementation**

Helpers em `casal-api.mjs` (`credentials: 'omit'`). `RsvpSection({ slug })` com estado `phase: 'search' | 'choose' | 'confirm'`. `PartnerHome` recebe `slug` e renderiza `<RsvpSection slug={slug} />` dentro de `<section className="rsvp" id="confirmar-presenca">`.

Não use `localStorage` de manage token nesta fatia (YAGNI de “ver RSVP depois”). Só create.

- [ ] **Step 4: Run tests**

Run: `node --test tests/casal-ui.test.mjs`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/casal-api.mjs src/pages/casal/RsvpSection.jsx src/pages/casal/PartnerHome.jsx tests/casal-ui.test.mjs
git commit -m "$(cat <<'EOF'
feat: confirmar presença no site público pelo slug do casal

EOF
)"
```

---

### Task 8: Presentes + Pix no React

**Files:**
- Create: `src/pages/casal/GiftsSection.jsx`
- Modify: `src/lib/casal-api.mjs` — `fetchCatalog`, `submitCheckout`
- Reuse: `src/dani-carine/cart-storage.mjs` (`CartStorage`) — **não** reescreva regras de qty
- Modify: `PartnerHome.jsx`
- Modify: `tests/casal-ui.test.mjs`

**Interfaces:**
- `fetchCatalog(slug)` → `GET /api/gifts/catalog?slug=`
- `submitCheckout(slug, payload)` → `POST /api/gifts/checkout` com `slug`, `paymentMethod: 'pix'`, `gifterName`, `items`, `intentKey`
- UI: lista `gifts` (nome, preço `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`), botão adicionar, badge do carrinho, modal com nome do presenteador e e-mail se o endpoint atual exigir — leia `validateCheckoutRequest` (nome obrigatório; e-mail **não** está no validador de checkout — não peça e-mail extra)
- Carrinho vazio: não chama checkout
- Sem playlist

- [ ] **Step 1: Write the failing tests**

```js
test('fetchCatalog and submitCheckout include slug', async () => {
  globalThis.fetch = async (url, init) => {
    if (String(url).includes('/api/gifts/catalog')) {
      assert.equal(String(url).includes('slug=dani-carine'), true);
      return new Response(JSON.stringify({ ok: true, gifts: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    const body = JSON.parse(init.body);
    assert.equal(body.slug, 'dani-carine');
    assert.equal(body.paymentMethod, 'pix');
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  await fetchCatalog('dani-carine');
  await submitCheckout('dani-carine', {
    gifterName: 'Ana',
    intentKey: 'k1',
    items: [{ giftId: 'spa', quantity: 1 }],
  });
});

test('GiftsSection renders present list section id', () => {
  const src = readFileSync(new URL('../src/pages/casal/GiftsSection.jsx', import.meta.url), 'utf8');
  assert.match(src, /fetchCatalog/);
  assert.match(src, /CartStorage/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/casal-ui.test.mjs`

Expected: FAIL missing functions.

- [ ] **Step 3: Write minimal implementation**

`GiftsSection({ slug })`: no mount `fetchCatalog`; `new CartStorage(window.localStorage)` se disponível, senão memory da própria classe (ela já tem fallback). `intentKey` = `crypto.randomUUID()` por sessão de checkout (regenerar ao mudar o carrinho). Mostrar `result.pixQrCode` / `result.pixCopyPaste` **somente se** o JSON de sucesso trouxer esses campos (nomes: leia o retorno real de `createCheckoutPayment` e use as chaves existentes, sem inventar). Se o pagamento Pix local devolver `qrCodeBase64` / `copyPaste`, use esses nomes.

Não copie os 1000+ linhas de `cart.mjs`. UI mínima: lista + botão + aside/modal.

Substitua o placeholder `#presentes`.

- [ ] **Step 4: Run tests**

Run: `node --test tests/casal-ui.test.mjs tests/cart-storage.test.mjs`

Expected: PASS (`cart-storage` já existe; não quebre).

- [ ] **Step 5: Commit**

```bash
git add src/lib/casal-api.mjs src/pages/casal/GiftsSection.jsx src/pages/casal/PartnerHome.jsx tests/casal-ui.test.mjs
git commit -m "$(cat <<'EOF'
feat: listar presentes e Pix no site público por casal

EOF
)"
```

---

### Task 9: Mural + smoke da fatia B

**Files:**
- Create: `src/pages/casal/MessagesSection.jsx`
- Modify: `src/lib/casal-api.mjs` — `fetchMessages`, `postMessage`
- Modify: `PartnerHome.jsx`
- Modify: `tests/casal-ui.test.mjs`
- Modify: `src/pages/Landing.jsx` só se os links `/casal/dani-carine` tiverem sumido (devem **permanecer**)
- Test smoke: `tests/pages-routing.test.mjs` + `tests/casal-ui.test.mjs` + `tests/public-slug.test.mjs` + `tests/casal-page-api.test.mjs` + `tests/public-catalog-slug.test.mjs` + `tests/public-rsvp-slug.test.mjs`
- `npm run build`

**Interfaces:**
- `fetchMessages(slug, { limit = 12, cursor })` GET `/api/messages?slug=&limit=&cursor=`
- `postMessage(slug, { guestName, message, consentGiven })` POST com `Idempotency-Key` e `slug` no JSON
- Form: nome ≥2, mensagem 3–250, consent obrigatório
- Sem papelaria, playlist, hospedagem no `PartnerHome.jsx`

- [ ] **Step 1: Write the failing tests**

```js
test('message helpers send slug and idempotency key', async () => {
  globalThis.fetch = async (url, init) => {
    if (!init || init.method === 'GET' || !init.method) {
      assert.equal(String(url).includes('slug=dani-carine'), true);
      return new Response(JSON.stringify({ messages: [], nextCursor: null }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    const body = JSON.parse(init.body);
    assert.equal(body.slug, 'dani-carine');
    const h = init.headers;
    const key = h['Idempotency-Key'] || h['idempotency-key'];
    assert.ok(key);
    return new Response(JSON.stringify({ id: 'm1' }), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    });
  };
  await fetchMessages('dani-carine');
  await postMessage('dani-carine', { guestName: 'Ana', message: 'Felicidades', consentGiven: true });
});

test('PartnerHome wires mural and still omits playlist', () => {
  const home = readFileSync(new URL('../src/pages/casal/PartnerHome.jsx', import.meta.url), 'utf8');
  assert.match(home, /MessagesSection/);
  assert.match(home, /GiftsSection/);
  assert.match(home, /RsvpSection/);
  assert.doesNotMatch(home, /id="playlist"|Hospedagem|Papelaria/);
  const landing = readFileSync(new URL('../src/pages/Landing.jsx', import.meta.url), 'utf8');
  assert.match(landing, /\/casal\/dani-carine/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/casal-ui.test.mjs`

Expected: FAIL missing `fetchMessages`.

- [ ] **Step 3: Write minimal implementation**

`MessagesSection({ slug })`: lista + “Carregar mais” se `nextCursor`. Substitua placeholder `#mural-recados`. Classe `messages` do CSS antigo se couber sem copiar JSDOM marquee (lista simples é suficiente).

- [ ] **Step 4: Run tests + build**

Run:

```
node --test tests/casal-ui.test.mjs tests/pages-routing.test.mjs tests/public-slug.test.mjs tests/casal-page-api.test.mjs tests/public-catalog-slug.test.mjs tests/public-rsvp-slug.test.mjs tests/spa-auth-ui.test.mjs
npm run build
```

Expected: todos PASS, build exit 0.

Se o build falhar por import CSS/JSX, corrija na mesma task.

Rode também `node --test tests/*.test.mjs` uma vez. Se falhar só por SQL `wedding_key` residual das tasks 3–4, corrija os mocks. Não pule a suíte.

- [ ] **Step 5: Commit**

```bash
git add src/lib/casal-api.mjs src/pages/casal/MessagesSection.jsx src/pages/casal/PartnerHome.jsx src/pages/casal/CoupleSite.jsx tests/casal-ui.test.mjs
git commit -m "$(cat <<'EOF'
feat: mural público por slug e smoke da fatia B

EOF
)"
```

---

## Spec coverage

| Spec | Task |
|---|---|
| `/casal/:slug` template React; `/casal` → `/entrar`; rewrite SPA | 1, 5 |
| Slug inexistente → 404 página e API | 2, 5 |
| Sem login dos noivos no site do casamento | 5 |
| História/data/local do parceiro portados | 6 |
| Confirmar presença, presentes Pix, mural | 7–9 |
| APIs públicas resolvem slug → `account_id`; sem misturar casais | 3–4 |
| Sem playlist/hospedagem/papelaria no público | 5–9 |
| Sem redirects de URL antiga; `/dani-carine/` permanece | 1 |
| Jogos `/casal/:slug/game` | **fora** (fatia C) |
| Minha página slug/etapas | **fora** (fatia D) |

## Self-review

- Sem TBD/TODO de implementação
- `setAccountSlug(db, accountId, slug)` é o único jeito suportado de gravar slug fora da fatia D (seed parceiro já grava `dani-carine`)
- `getMessages(db, limit, cursor, accountId)` — 4º arg alinhado em handler e testes
- `createCheckoutPayment(..., { accountId })` alinhado com `checkout.js`
- Payload GET `/api/casal/:slug` sem `id`/`email`
- Fallback sem slug = parceiro, para o MPA `/dani-carine/`
