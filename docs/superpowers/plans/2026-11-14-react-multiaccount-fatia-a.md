# Fatia A — SPA + auth + admin multi-conta Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um SPA React na raiz serve `/`, `/entrar` e `/admin`; cadastro/login com cookie HttpOnly; painel com o hub combinado; APIs admin autenticadas por sessão e filtradas por `account_id`.

**Architecture:** Pages middleware reescreve rotas do produto para o `index.html` da raiz. Contas e sessões no D1 (mapa em memória se `db` for `null`, padrão Vite). `requireAccount` substitui Bearer. `dani-carine/` e `games/` continuam MPA até as fatias B e C.

**Tech Stack:** Vite 8, React 19, react-router-dom 7, Cloudflare Pages Functions, D1, `node --test`, Web Crypto PBKDF2.

## Global Constraints

- Cloudflare Pages Free: Functions 100 mil req/dia, 10 ms CPU; hash PBKDF2-SHA-256, 10 000 iterações, salt 16 bytes, chave 32 bytes
- Cookie `cb_session`: opaco, `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age=1209600`; `Secure` só em HTTPS
- Sem JWT, sem `localStorage` de sessão, sem Google, sem reset de senha, sem Stripe
- Planos: `basic` \| `pro` \| `vip`; `plan_status`: `active` \| `pending_payment`; pending **nunca** HTTP 402
- Um e-mail = uma conta = um casal; slug só no parceiro nesta fatia (`dani-carine`)
- Admin ignora `wedding_key` / `account_id` do cliente; inquilino = sessão
- Sem playlist/hospedagem no hub; Minha página = “em breve”
- Partner id estável `partner-dani-carine`; env `PARTNER_EMAIL` e `PARTNER_BOOTSTRAP_PASSWORD` nunca no git
- UI em português; runner `node --test`; nenhum código de produção sem teste que falhou primeiro
- Spec: `docs/superpowers/specs/2026-11-14-react-multiaccount-design.md`

## File map

| Path | Responsabilidade |
|---|---|
| `functions/_lib/pages-routing.mjs` | SPA root + `/casal` → `/entrar` |
| `dev/mpa-spa-fallback.mjs` | Vite: `/entrar`, `/admin`, `/casal/*` → `/index.html` |
| `functions/_lib/password.mjs` | PBKDF2 hash/verify |
| `functions/_lib/auth-service.mjs` | signup/login/logout/me/upgrade + cookie + memory fallback |
| `functions/_lib/session-auth.mjs` | `requireAccount`, `parseSessionCookie` |
| `functions/_lib/partner-seed.mjs` | preenche e-mail/hash do parceiro a partir do env |
| `functions/api/auth/{signup,login,logout,me}.js` | HTTP auth |
| `functions/api/account/plan.js` | upgrade |
| `migrations/0021_accounts.sql` | accounts, sessions, `account_id` nas tabelas de casamento |
| `functions/_lib/catalog-service.mjs` | lista/CRUD por `accountId` |
| `functions/_lib/rsvp-guest-list.mjs` | queries por `accountId` (não `WEDDING_KEY`) |
| `functions/_lib/messages-service.mjs` | queries por `accountId` |
| `functions/api/admin/*.js` | `requireAccount` no lugar de `requireAdmin` |
| `index.html` | entry do SPA |
| `src/main.jsx`, `src/App.jsx` | router `/`, `/entrar`, `/admin`, `/admin/:section` |
| `src/pages/{Landing,Login,AdminHub}.jsx` | superfícies |
| `src/lib/session-api.mjs` | `fetch(..., { credentials: 'include' })` |
| `vite.config.js` | input `main: index.html`; plugin auth local |
| `public/_redirects` | `/entrar`, `/admin`, `/casal/*` → `/index.html` 200 |

---

### Task 1: Rotas Pages do SPA raiz

**Files:**
- Modify: `functions/_lib/pages-routing.mjs`
- Modify: `tests/pages-routing.test.mjs`
- Modify: `dev/mpa-spa-fallback.mjs`
- Modify: `tests/mpa-spa-fallback.test.mjs`
- Modify: `public/_redirects`

**Interfaces:**
- Produces: `resolvePagesRoute(hostname, pathname)` → `{ action: 'next' }` \| `{ action: 'rewrite', assetPath: '/' }` \| `{ action: 'redirect', pathname: string }`
- `rewriteMpaSpaUrl(url)` também trata `/entrar`, `/admin`, `/casal/:slug`

- [ ] **Step 1: Write the failing tests**

Em `tests/pages-routing.test.mjs`, **substitua** o teste que espera redirect de `/` para `/landing-page-animada/` por:

```js
test('apex / is the SPA, not the old landing redirect', () => {
  assert.deepEqual(resolvePagesRoute('casebem.com', '/'), { action: 'next' });
  assert.deepEqual(resolvePagesRoute('www.casebem.com', '/'), { action: 'next' });
});

test('product routes rewrite to the root SPA', () => {
  for (const path of ['/entrar', '/admin', '/admin/presentes', '/casal/dani-carine', '/casal/x/game/quiz']) {
    assert.deepEqual(resolvePagesRoute('casebem.com', path), {
      action: 'rewrite',
      assetPath: '/',
    });
  }
});

test('/casal without slug redirects to /entrar', () => {
  assert.deepEqual(resolvePagesRoute('casebem.com', '/casal'), {
    action: 'redirect',
    pathname: '/entrar',
  });
  assert.deepEqual(resolvePagesRoute('casebem.com', '/casal/'), {
    action: 'redirect',
    pathname: '/entrar',
  });
});
```

Em `tests/mpa-spa-fallback.test.mjs` adicione:

```js
test('product SPA paths fall back to root index.html', () => {
  assert.equal(rewriteMpaSpaUrl('/entrar'), '/index.html');
  assert.equal(rewriteMpaSpaUrl('/admin/presentes'), '/index.html');
  assert.equal(rewriteMpaSpaUrl('/casal/dani-carine?x=1'), '/index.html?x=1');
  assert.equal(rewriteMpaSpaUrl('/casal/dani-carine/game/quiz'), '/index.html');
});
```

Mantenha os testes de `/games` e `desafio.casebem.com` como estão.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/pages-routing.test.mjs tests/mpa-spa-fallback.test.mjs`

Expected: FAIL — `/` ainda redireciona para `/landing-page-animada/`; `rewriteMpaSpaUrl('/entrar')` devolve `/entrar`.

- [ ] **Step 3: Write minimal implementation**

Em `resolvePagesRoute`, **antes** do bloco `isGameHost`:

```js
if (path === '/casal' || path === '/casal/') {
  return { action: 'redirect', pathname: '/entrar' };
}

if (path === '/' || path === '/index.html') {
  return { action: 'next' };
}

const spaRoots = ['/entrar', '/admin', '/casal'];
for (const root of spaRoots) {
  if (path === root || path.startsWith(`${root}/`)) {
    return { action: 'rewrite', assetPath: '/' };
  }
}
```

Remova o `if (path === '/' || path === '') { return { action: 'redirect', pathname: '/landing-page-animada/' }; }`.

Em `dev/mpa-spa-fallback.mjs`:

```js
const SPA_PREFIXES = ['/games', '/app', '/entrar', '/admin', '/casal'];

export function rewriteMpaSpaUrl(url) {
  const raw = String(url || '/');
  const qIndex = raw.indexOf('?');
  const path = qIndex >= 0 ? raw.slice(0, qIndex) : raw;
  const query = qIndex >= 0 ? raw.slice(qIndex) : '';
  const last = path.slice(path.lastIndexOf('/') + 1);
  if (last.includes('.')) return raw;

  if (path === '/entrar' || path.startsWith('/entrar/')) return `/index.html${query}`;
  if (path === '/admin' || path.startsWith('/admin/')) return `/index.html${query}`;
  if (path === '/casal' || path.startsWith('/casal/')) return `/index.html${query}`;

  for (const prefix of ['/games', '/app']) {
    if (path === prefix || path === `${prefix}/`) return raw;
    if (path.startsWith(`${prefix}/`)) return `${prefix}/index.html${query}`;
  }
  return raw;
}
```

`public/_redirects` — acrescente (não apague `/games` nem `/app`):

```
/entrar   /index.html  200
/entrar/* /index.html  200
/admin    /index.html  200
/admin/*  /index.html  200
/casal/*  /index.html  200
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/pages-routing.test.mjs tests/mpa-spa-fallback.test.mjs`

Expected: PASS. Ajuste o teste de middleware que ainda espera `Location: .../landing-page-animada/` para esperar 200/`next` em `https://casebem.com/`.

- [ ] **Step 5: Commit**

```bash
git add functions/_lib/pages-routing.mjs tests/pages-routing.test.mjs \
  dev/mpa-spa-fallback.mjs tests/mpa-spa-fallback.test.mjs public/_redirects
git commit -m "$(cat <<'EOF'
feat: servir o SPA na raiz em vez da landing antiga

EOF
)"
```

---

### Task 2: Hash de senha PBKDF2

**Files:**
- Create: `functions/_lib/password.mjs`
- Test: `tests/password.test.mjs`

**Interfaces:**
- Produces: `PBKDF2_ITERATIONS = 10000`
- `randomSaltB64()` → string base64 (16 bytes)
- `hashPassword(password: string, saltB64: string): Promise<string>` → base64 da chave 32 bytes
- `verifyPassword(password: string, saltB64: string, hashB64: string): Promise<boolean>` (timing-safe)

- [ ] **Step 1: Write the failing test**

```js
/**
 * Run: node --test tests/password.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PBKDF2_ITERATIONS,
  randomSaltB64,
  hashPassword,
  verifyPassword,
} from '../functions/_lib/password.mjs';

test('PBKDF2 uses 10000 iterations', () => {
  assert.equal(PBKDF2_ITERATIONS, 10000);
});

test('same password and salt verify; wrong password does not', async () => {
  const salt = randomSaltB64();
  const hash = await hashPassword('segredo12', salt);
  assert.equal(await verifyPassword('segredo12', salt, hash), true);
  assert.equal(await verifyPassword('outra-senha', salt, hash), false);
});

test('two random salts differ', () => {
  assert.notEqual(randomSaltB64(), randomSaltB64());
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/password.test.mjs`

Expected: FAIL `ERR_MODULE_NOT_FOUND` `password.mjs`

- [ ] **Step 3: Write minimal implementation**

`functions/_lib/password.mjs`:

```js
export const PBKDF2_ITERATIONS = 10000;

function bytesToB64(bytes) {
  return btoa(String.fromCharCode(...bytes));
}

function b64ToBytes(b64) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

export function randomSaltB64() {
  return bytesToB64(crypto.getRandomValues(new Uint8Array(16)));
}

async function derive(password, saltB64) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: b64ToBytes(saltB64),
      iterations: PBKDF2_ITERATIONS,
    },
    key,
    256
  );
  return bytesToB64(new Uint8Array(bits));
}

export async function hashPassword(password, saltB64) {
  return derive(password, saltB64);
}

export async function verifyPassword(password, saltB64, hashB64) {
  const got = await derive(password, saltB64);
  if (got.length !== hashB64.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ hashB64.charCodeAt(i);
  return diff === 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/password.test.mjs`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add functions/_lib/password.mjs tests/password.test.mjs
git commit -m "$(cat <<'EOF'
feat: hash de senha PBKDF2 compatível com o Free da Cloudflare

EOF
)"
```

---

### Task 3: Serviço de contas (memory + contrato D1)

**Files:**
- Create: `functions/_lib/auth-service.mjs`
- Create: `tests/helpers/memory-auth-db.mjs`
- Test: `tests/auth-service.test.mjs`

**Interfaces:**
- Consumes: `hashPassword`, `verifyPassword`, `randomSaltB64` de `password.mjs`
- Produces:
  - `PARTNER_ACCOUNT_ID = 'partner-dani-carine'`
  - `SESSION_COOKIE = 'cb_session'`
  - `SESSION_MAX_AGE_SEC = 1209600`
  - `sessionCookieHeader(sessionId, { secure: boolean }): string`
  - `parseSessionCookie(cookieHeader: string | null): string | null`
  - `publicAccount(row) → { email, plan, planStatus, slug, isPartner }` (`slug` pode ser `null`)
  - `signup(db, { email, password, plan }, nowIso): Promise<{ account, sessionId }>`
  - `login(db, { email, password }, nowIso)`
  - `logout(db, sessionId)`
  - `getSessionAccount(db, sessionId, nowIso)`
  - `upgradePlan(db, accountId, plan)`
  - `resolveAccountBySlug(db, slug)`
- Erros: `throw new Error(code)` com `INVALID_EMAIL` \| `PASSWORD_TOO_SHORT` \| `INVALID_PLAN` \| `EMAIL_TAKEN` \| `INVALID_CREDENTIALS` \| `ACCOUNT_NOT_BASIC` \| `SESSION_EXPIRED`

`memory-auth-db.mjs` é um fake mínimo: `prepare(sql).bind(...).first()/run()/all()` cobrindo `INSERT/SELECT` em `accounts` e `sessions` (Maps). Guarde o SQL na statement e ramifique por substring (`INSERT INTO accounts`, `SELECT * FROM accounts WHERE email`, etc.).

- [ ] **Step 1: Write the failing test** (`tests/auth-service.test.mjs`)

```js
/**
 * Run: node --test tests/auth-service.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryAuthDb } from './helpers/memory-auth-db.mjs';
import {
  signup,
  login,
  logout,
  getSessionAccount,
  upgradePlan,
  resolveAccountBySlug,
  sessionCookieHeader,
  parseSessionCookie,
  SESSION_COOKIE,
} from '../functions/_lib/auth-service.mjs';

const now = '2026-11-14T23:00:00.000Z';

test('signup basic is active; pro is pending_payment; cookie name is cb_session', async () => {
  const db = new MemoryAuthDb();
  const basic = await signup(db, { email: 'A@X.com', password: 'segredo12', plan: 'basic' }, now);
  assert.equal(basic.account.email, 'a@x.com');
  assert.equal(basic.account.plan, 'basic');
  assert.equal(basic.account.planStatus, 'active');
  assert.equal(basic.account.slug, null);
  assert.equal(basic.account.isPartner, false);
  const header = sessionCookieHeader(basic.sessionId, { secure: true });
  assert.match(header, new RegExp(`^${SESSION_COOKIE}=`));
  assert.match(header, /HttpOnly/);
  assert.match(header, /SameSite=Lax/);
  assert.match(header, /Path=\//);
  assert.match(header, /Secure/);
  const pro = await signup(db, { email: 'b@x.com', password: 'segredo12', plan: 'pro' }, now);
  assert.equal(pro.account.plan, 'pro');
  assert.equal(pro.account.planStatus, 'pending_payment');
});

test('duplicate email is EMAIL_TAKEN; short password is PASSWORD_TOO_SHORT', async () => {
  const db = new MemoryAuthDb();
  await signup(db, { email: 'a@x.com', password: 'segredo12', plan: 'basic' }, now);
  await assert.rejects(
    () => signup(db, { email: 'a@x.com', password: 'segredo12', plan: 'basic' }, now),
    { message: 'EMAIL_TAKEN' }
  );
  await assert.rejects(
    () => signup(db, { email: 'c@x.com', password: '123', plan: 'basic' }, now),
    { message: 'PASSWORD_TOO_SHORT' }
  );
});

test('login sets session; wrong password is INVALID_CREDENTIALS; logout expires session', async () => {
  const db = new MemoryAuthDb();
  await signup(db, { email: 'a@x.com', password: 'segredo12', plan: 'basic' }, now);
  const ok = await login(db, { email: 'a@x.com', password: 'segredo12' }, now);
  const me = await getSessionAccount(db, ok.sessionId, now);
  assert.equal(me.email, 'a@x.com');
  await assert.rejects(
    () => login(db, { email: 'a@x.com', password: 'erradaaaa' }, now),
    { message: 'INVALID_CREDENTIALS' }
  );
  await logout(db, ok.sessionId);
  assert.equal(await getSessionAccount(db, ok.sessionId, now), null);
});

test('upgrade basic to pro sets pending_payment; vip-to-pro is ACCOUNT_NOT_BASIC', async () => {
  const db = new MemoryAuthDb();
  const { account, sessionId } = await signup(
    db,
    { email: 'a@x.com', password: 'segredo12', plan: 'basic' },
    now
  );
  const updated = await upgradePlan(db, account.id || (await getSessionAccount(db, sessionId, now)).id, 'pro');
  assert.equal(updated.plan, 'pro');
  assert.equal(updated.planStatus, 'pending_payment');
  await assert.rejects(() => upgradePlan(db, updated.id, 'vip'), { message: 'ACCOUNT_NOT_BASIC' });
});

test('unknown slug resolves to null', async () => {
  const db = new MemoryAuthDb();
  assert.equal(await resolveAccountBySlug(db, 'nao-existe'), null);
});

test('parseSessionCookie reads cb_session', () => {
  assert.equal(parseSessionCookie('foo=1; cb_session=abc; bar=2'), 'abc');
  assert.equal(parseSessionCookie(null), null);
});
```

`signup` deve devolver `account.id` (adicione `id` no objeto de teste via `getSessionAccount` se `publicAccount` não expor `id` — **exponha `id` só internamente**: faça `signup` retornar `{ account: publicAccount(row), sessionId, accountId }`). Ajuste o teste de upgrade para usar `accountId`:

```js
const { accountId } = await signup(...);
const updated = await upgradePlan(db, accountId, 'pro');
```

`publicAccount` **não** inclui `id` (o JSON de `/api/auth/me` da spec não tem `id`). `upgradePlan` recebe `accountId` da sessão.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/auth-service.test.mjs`

Expected: FAIL module not found.

- [ ] **Step 3: Write minimal implementation**

Implemente `MemoryAuthDb` com Maps `accounts` (key email) e `sessions` (key id). Implemente `auth-service.mjs`:

- e-mail: `trim().toLowerCase()`; válido se contém `^[^@\s]+@[^@\s]+\.[^@\s]+$`
- senha `length >= 8`
- plano default `'basic'` se omitido/`''`; senão precisa ser `basic|pro|vip`
- `plan_status`: `basic` → `active`; `pro`/`vip` → `pending_payment`
- `sessionCookieHeader`: se `secure`, acrescente `; Secure`
- `getSessionAccount`: `expires_at < now` → `null`
- `resolveAccountBySlug`: `SELECT` por slug; vazio/null → `null`
- Sem `db`: use um módulo `memoryAuth` (Maps) igual ao catálogo — os testes passam `MemoryAuthDb`, então trate `db` como objeto com `.prepare`.

SQL esperado (D1 real na Task 4/5; o fake precisa reconhecer):

```sql
INSERT INTO accounts (id, email, password_hash, password_salt, plan, plan_status, slug, is_partner, created_at)
VALUES (?, ?, ?, ?, ?, ?, NULL, 0, ?)
INSERT INTO sessions (id, account_id, expires_at, created_at) VALUES (?, ?, ?, ?)
SELECT * FROM accounts WHERE email = ?
SELECT * FROM sessions WHERE id = ?
DELETE FROM sessions WHERE id = ?
UPDATE accounts SET plan = ?, plan_status = ? WHERE id = ?
SELECT * FROM accounts WHERE slug = ?
```

`expires_at` = `new Date(Date.parse(nowIso) + SESSION_MAX_AGE_SEC * 1000).toISOString()`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/auth-service.test.mjs`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add functions/_lib/auth-service.mjs tests/helpers/memory-auth-db.mjs tests/auth-service.test.mjs
git commit -m "$(cat <<'EOF'
feat: cadastro, sessão e upgrade de plano no domínio de contas

EOF
)"
```

---

### Task 4: HTTP `/api/auth/*` e `/api/account/plan`

**Files:**
- Create: `functions/api/auth/signup.js`, `login.js`, `logout.js`, `me.js`
- Create: `functions/api/account/plan.js`
- Test: `tests/auth-api.test.mjs`
- Modify: `functions/_lib/http-helpers.mjs` — `Access-Control-Allow-Credentials: true` e `Access-Control-Allow-Headers` inclui `Content-Type` (já tem)

**Interfaces:**
- Consumes: `signup`, `login`, `logout`, `getSessionAccount`, `upgradePlan`, `sessionCookieHeader`, `parseSessionCookie`, `SESSION_COOKIE`
- `onRequestPost` / `onRequestGet` padrão Pages
- Set-Cookie no 201/200 de signup/login; logout sempre 204 + cookie Max-Age=0
- Sem `env.DB`: passar `null` para o serviço (memory)
- HTTPS detectado por `new URL(request.url).protocol === 'https:'`

Mapa HTTP:

| Erro | Status | body.error |
|---|---|---|
| INVALID_EMAIL, PASSWORD_TOO_SHORT, INVALID_PLAN, ACCOUNT_NOT_BASIC | 400 | o código |
| EMAIL_TAKEN | 409 | `EMAIL_TAKEN` |
| INVALID_CREDENTIALS | 401 | `INVALID_CREDENTIALS` |
| sem sessão em `/me` ou `/account/plan` | 401 | `UNAUTHORIZED` |

- [ ] **Step 1: Write the failing test**

```js
/**
 * Run: node --test tests/auth-api.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost as signup } from '../functions/api/auth/signup.js';
import { onRequestPost as login } from '../functions/api/auth/login.js';
import { onRequestPost as logout } from '../functions/api/auth/logout.js';
import { onRequestGet as me } from '../functions/api/auth/me.js';
import { onRequestPost as plan } from '../functions/api/account/plan.js';

function ctx(url, { method = 'GET', body, cookie, db } = {}) {
  const headers = { origin: 'http://localhost:5173' };
  if (body) headers['content-type'] = 'application/json';
  if (cookie) headers.cookie = cookie;
  return {
    request: new Request(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    }),
    env: { DB: db || null },
  };
}

function cookieFrom(res) {
  return res.headers.get('set-cookie') || '';
}

test('signup 201 sets cb_session; me reads it; duplicate 409', async () => {
  const created = await signup(
    ctx('http://localhost/api/auth/signup', {
      method: 'POST',
      body: { email: 'nova@x.com', password: 'segredo12', plan: 'vip' },
    })
  );
  assert.equal(created.status, 201);
  const json = await created.json();
  assert.equal(json.account.plan, 'vip');
  assert.equal(json.account.planStatus, 'pending_payment');
  const set = cookieFrom(created);
  assert.match(set, /cb_session=/);
  assert.doesNotMatch(set, /Secure/); // http localhost
  const session = /cb_session=([^;]+)/.exec(set)[1];
  const mine = await me(ctx('http://localhost/api/auth/me', { cookie: `cb_session=${session}` }));
  assert.equal(mine.status, 200);
  assert.equal((await mine.json()).slug, null);
  const dup = await signup(
    ctx('http://localhost/api/auth/signup', {
      method: 'POST',
      body: { email: 'nova@x.com', password: 'segredo12', plan: 'basic' },
    })
  );
  assert.equal(dup.status, 409);
});

test('login 401 same message; logout 204 even without cookie', async () => {
  await signup(
    ctx('http://localhost/api/auth/signup', {
      method: 'POST',
      body: { email: 'l@x.com', password: 'segredo12', plan: 'basic' },
    })
  );
  const bad = await login(
    ctx('http://localhost/api/auth/login', {
      method: 'POST',
      body: { email: 'l@x.com', password: 'nope-nope' },
    })
  );
  assert.equal(bad.status, 401);
  const payload = await bad.json();
  assert.equal(payload.error, 'INVALID_CREDENTIALS');
  const naked = await logout(ctx('http://localhost/api/auth/logout', { method: 'POST' }));
  assert.equal(naked.status, 204);
});

test('me without cookie is 401; pending payment never 402', async () => {
  const res = await me(ctx('http://localhost/api/auth/me'));
  assert.equal(res.status, 401);
  const created = await signup(
    ctx('http://localhost/api/auth/signup', {
      method: 'POST',
      body: { email: 'p@x.com', password: 'segredo12', plan: 'pro' },
    })
  );
  assert.notEqual(created.status, 402);
});
```

Memory fallback precisa ser **process-wide** para signup → me no mesmo teste (módulo `auth-service` com Maps quando `db` é null). `MemoryAuthDb` da Task 3 é só para testes unitários; aqui `env.DB` é `null`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/auth-api.test.mjs`

Expected: FAIL module not found.

- [ ] **Step 3: Write minimal implementation**

Cada handler: `getCorsHeaders`, JSON, try/catch nos códigos da tabela. `signup.js` exemplo:

```js
import { getCorsHeaders } from '../../_lib/http-helpers.mjs';
import { signup, sessionCookieHeader } from '../../_lib/auth-service.mjs';

export async function onRequestOptions(context) {
  return new Response(null, { status: 204, headers: getCorsHeaders(context.request) });
}

export async function onRequestPost(context) {
  const headers = getCorsHeaders(context.request);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  const body = await context.request.json().catch(() => ({}));
  const secure = new URL(context.request.url).protocol === 'https:';
  try {
    const result = await signup(context.env.DB || null, body, new Date().toISOString());
    headers.set('Set-Cookie', sessionCookieHeader(result.sessionId, { secure }));
    return Response.json({ ok: true, account: result.account }, { status: 201, headers });
  } catch (err) {
    const map = {
      INVALID_EMAIL: 400,
      PASSWORD_TOO_SHORT: 400,
      INVALID_PLAN: 400,
      EMAIL_TAKEN: 409,
    };
    return Response.json({ ok: false, error: err.message }, { status: map[err.message] || 500, headers });
  }
}
```

`logout.js`: parse cookie; se houver id, `await logout(db, id)`; sempre `Set-Cookie: cb_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax` (+ Secure se https); status 204.

`plan.js`: `requireAccount` ainda não existe — parse cookie + `getSessionAccount`; se null → 401; senão `upgradePlan(db, accountId, body.plan)`.

Exporte `accountId` de `getSessionAccount` internamente: devolva `{ ...publicAccount(row), id: row.id }` **só para o servidor**; `/api/auth/me` serializa `{ email, plan, planStatus, slug, isPartner }` sem `id`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/auth-api.test.mjs tests/auth-service.test.mjs`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add functions/api/auth functions/api/account/plan.js tests/auth-api.test.mjs functions/_lib/auth-service.mjs functions/_lib/http-helpers.mjs
git commit -m "$(cat <<'EOF'
feat: APIs de cadastro, login e plano com cookie HttpOnly

EOF
)"
```

---

### Task 5: `requireAccount` no lugar do Bearer

**Files:**
- Create: `functions/_lib/session-auth.mjs`
- Modify: todos os `functions/api/admin/*.js` listados abaixo (trocar `requireAdmin` → `requireAccount`)
- Modify: `vite.config.js` `adminApiPlugin` (cookie em vez de Bearer)
- Test: `tests/session-auth.test.mjs`
- Modify: testes admin que mandam `Authorization: Bearer` — passar `Cookie: cb_session=`

Rotas: `summary.js`, `gifts.js`, `guest-list.js`, `stationery.js`, `messages.js`, `rsvps.csv.js`, `challenges/questions.js`, `challenges/photo-missions.js`, `challenges/stamp-cards.js`, `challenges/theme.js`, `media.js`, `lodging.js`.

**Interfaces:**
- Produces: `requireAccount(request, env) → Promise<{ ok: true, account } | { ok: false, status, error, message }>`
- `account` tem `id`, `email`, `plan`, `planStatus`, `slug`, `isPartner`

- [ ] **Step 1: Write the failing test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requireAccount } from '../functions/_lib/session-auth.mjs';
import { signup, sessionCookieHeader } from '../functions/_lib/auth-service.mjs';

test('requireAccount 401 without cookie and 200 with valid session', async () => {
  const missing = await requireAccount(new Request('http://localhost/api/admin/gifts'), { DB: null });
  assert.equal(missing.ok, false);
  assert.equal(missing.status, 401);
  const created = await signup(
    null,
    { email: 'adm@x.com', password: 'segredo12', plan: 'basic' },
    new Date().toISOString()
  );
  const req = new Request('http://localhost/api/admin/gifts', {
    headers: { cookie: `cb_session=${created.sessionId}` },
  });
  const ok = await requireAccount(req, { DB: null });
  assert.equal(ok.ok, true);
  assert.equal(ok.account.email, 'adm@x.com');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/session-auth.test.mjs`

Expected: FAIL module not found.

- [ ] **Step 3: Write minimal implementation**

```js
import { getSessionAccount, parseSessionCookie } from './auth-service.mjs';

export async function requireAccount(request, env) {
  const sessionId = parseSessionCookie(request.headers.get('cookie'));
  if (!sessionId) {
    return { ok: false, status: 401, error: 'UNAUTHORIZED', message: 'Sessão inválida.' };
  }
  const account = await getSessionAccount(env?.DB || null, sessionId, new Date().toISOString());
  if (!account) {
    return { ok: false, status: 401, error: 'UNAUTHORIZED', message: 'Sessão inválida.' };
  }
  return { ok: true, account };
}
```

Em cada admin handler, `const auth = await requireAccount(request, env);` (agora é async). Passe `auth.account.id` adiante na Task 6; nesta task as funções de serviço ainda ignoram o id (comportamento global atual) — o teste de sessão basta. **Não** remova `admin-auth.mjs` ainda se algum teste unitário o importa; atualize esses testes para sessão.

`adminApiPlugin`: em vez de Bearer vs `ADMIN_PANEL_SECRET`, `await requireAccount(fetchRequest, { DB: null })`. 401 se `!auth.ok`.

- [ ] **Step 4: Run tests**

Run: `node --test tests/session-auth.test.mjs tests/admin-panel.test.mjs`

Expected: PASS (corrija `admin-panel.test.mjs` e qualquer 401 de Bearer).

- [ ] **Step 5: Commit**

```bash
git add functions/_lib/session-auth.mjs functions/api/admin vite.config.js tests
git commit -m "$(cat <<'EOF'
feat: autenticar o admin com sessão em vez de Bearer compartilhado

EOF
)"
```

---

### Task 6: Migração D1 `0021` + isolamento de presentes

**Files:**
- Create: `migrations/0021_accounts.sql`
- Modify: `functions/_lib/catalog-service.mjs` — toda leitura/escrita recebe `accountId`
- Modify: `functions/api/admin/gifts.js` — `listCatalogAdmin(env.DB, auth.account.id)` etc.
- Modify: `functions/api/gifts/catalog.js` — ainda hardcode parceiro **só nesta fatia** via `PARTNER_ACCOUNT_ID` (site público é fatia B)
- Test: `tests/catalog-isolation.test.mjs`
- Modify: testes de catálogo existentes para passar `accountId`

**Interfaces:**
- `listCatalogAdmin(db, accountId)`
- `createGift(db, accountId, body)`
- `updateGift(db, accountId, id, body)` — 404 se a linha for de outro `account_id`
- `deleteGift(db, accountId, id)`
- `getActiveCatalog(db, accountId)`
- `seedCatalogIfEmpty(db, accountId)` — seed estático só na conta parceira

- [ ] **Step 1: Write the failing test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGift,
  listCatalogAdmin,
  updateGift,
  resetMemoryCatalogForTests,
} from '../functions/_lib/catalog-service.mjs';

test('account B cannot read or patch account A gifts', async () => {
  resetMemoryCatalogForTests();
  const a = await createGift(null, 'acc-a', {
    name: 'Lua de mel A',
    description: 'Viagem',
    priceInCents: 15000,
    mode: 'fixed',
  });
  const listB = await listCatalogAdmin(null, 'acc-b');
  assert.equal(listB.some((g) => g.id === a.id), false);
  await assert.rejects(() => updateGift(null, 'acc-b', a.id, { name: 'Hack' }), {
    message: 'GIFT_NOT_FOUND',
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/catalog-isolation.test.mjs`

Expected: FAIL — `createGift` ainda não recebe `accountId` ou o catálogo é global.

- [ ] **Step 3: Write minimal implementation**

`0021_accounts.sql`:

```sql
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('basic', 'pro', 'vip')),
  plan_status TEXT NOT NULL CHECK (plan_status IN ('active', 'pending_payment')),
  slug TEXT UNIQUE,
  is_partner INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_account ON sessions(account_id);
CREATE INDEX IF NOT EXISTS idx_accounts_slug ON accounts(slug);

INSERT INTO accounts (
  id, email, password_hash, password_salt, plan, plan_status, slug, is_partner, created_at
) VALUES (
  'partner-dani-carine',
  '',
  '',
  '',
  'pro',
  'active',
  'dani-carine',
  1,
  datetime('now')
);

-- account_id nas tabelas de casamento (SQLite ADD COLUMN)
ALTER TABLE gifts_catalog ADD COLUMN account_id TEXT NOT NULL DEFAULT 'partner-dani-carine';
ALTER TABLE rsvp_guest_list ADD COLUMN account_id TEXT NOT NULL DEFAULT 'partner-dani-carine';
ALTER TABLE guest_groups ADD COLUMN account_id TEXT NOT NULL DEFAULT 'partner-dani-carine';
ALTER TABLE wedding_settings ADD COLUMN account_id TEXT NOT NULL DEFAULT 'partner-dani-carine';
ALTER TABLE wedding_messages ADD COLUMN account_id TEXT NOT NULL DEFAULT 'partner-dani-carine';
ALTER TABLE stationery_templates ADD COLUMN account_id TEXT NOT NULL DEFAULT 'partner-dani-carine';
ALTER TABLE rsvps ADD COLUMN account_id TEXT NOT NULL DEFAULT 'partner-dani-carine';
ALTER TABLE challenge_questions ADD COLUMN account_id TEXT NOT NULL DEFAULT 'partner-dani-carine';
ALTER TABLE challenge_photo_missions ADD COLUMN account_id TEXT NOT NULL DEFAULT 'partner-dani-carine';
ALTER TABLE challenge_stamp_cards ADD COLUMN account_id TEXT NOT NULL DEFAULT 'partner-dani-carine';
ALTER TABLE desafio_gallery ADD COLUMN account_id TEXT NOT NULL DEFAULT 'partner-dani-carine';
ALTER TABLE desafio_theme ADD COLUMN account_id TEXT NOT NULL DEFAULT 'partner-dani-carine';
ALTER TABLE checkout_intents ADD COLUMN account_id TEXT NOT NULL DEFAULT 'partner-dani-carine';

CREATE INDEX IF NOT EXISTS idx_gifts_account ON gifts_catalog(account_id);
CREATE INDEX IF NOT EXISTS idx_guests_account ON rsvp_guest_list(account_id);
CREATE INDEX IF NOT EXISTS idx_messages_account ON wedding_messages(account_id);

INSERT INTO schema_migrations (version, applied_at)
VALUES ('0021', datetime('now'))
ON CONFLICT(version) DO NOTHING;
```

Catálogo em memória: `Map<accountId, Gift[]>`. SQL: `WHERE account_id = ?` em SELECT/UPDATE/DELETE. INSERT inclui `account_id`.

- [ ] **Step 4: Run tests**

Run: `node --test tests/catalog-isolation.test.mjs tests/gifts-checkout.test.mjs tests/catalog-editor.test.mjs`

Expected: PASS (atualize assinaturas nos testes velhos: usem `PARTNER_ACCOUNT_ID`).

- [ ] **Step 5: Commit**

```bash
git add migrations/0021_accounts.sql functions/_lib/catalog-service.mjs functions/api/admin/gifts.js functions/api/gifts tests
git commit -m "$(cat <<'EOF'
feat: contas no D1 e catálogo de presentes isolado por casal

EOF
)"
```

---

### Task 7: Isolamento lista e mural

**Files:**
- Modify: `functions/_lib/rsvp-guest-list.mjs` — trocar `WEDDING_KEY` por parâmetro `accountId` em SQL (`account_id = ?`). Manter `wedding_key` nas colunas antigas gravando ainda `'dani-carine'` **somente** quando `accountId === PARTNER_ACCOUNT_ID`; senão grave `accountId` também em `wedding_key` (coluna NOT NULL).
- Modify: `functions/_lib/messages-service.mjs` — idem
- Modify: `functions/api/admin/guest-list.js`, `messages.js`, `summary.js` — passar `auth.account.id`
- Test: `tests/tenant-isolation.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addGuests, listGuestList } from '../functions/_lib/rsvp-guest-list.mjs';

test('guest list is per accountId', async () => {
  await addGuests(null, ['Ana Silva'], { groupId: null, accountId: 'acc-a' });
  const b = await listGuestList(null, 'acc-b');
  assert.equal(b.length, 0);
  const a = await listGuestList(null, 'acc-a');
  assert.equal(a.some((g) => g.displayName === 'Ana Silva' || g.display_name === 'Ana Silva'), true);
});
```

Se `addGuests` hoje é `(db, names, { groupId })`, estenda para `(db, names, { groupId, accountId })` e `listGuestList(db, accountId)`. Ajuste o teste ao shape real de `displayName`.

Segundo teste no mesmo arquivo para mural: `createMessage` / `listMessagesAdmin` com dois `accountId` (use as funções reais de `messages-service.mjs`).

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/tenant-isolation.test.mjs`

Expected: FAIL lista global.

- [ ] **Step 3: Write minimal implementation**

Toda query `WHERE wedding_key = ?` vira `WHERE account_id = ?` com bind `accountId`. Memory fallback: Map por accountId. `summary.js` usa `auth.account.id` em `listGuestList` e recados.

Envie `wedding_key` alheio no body de um teste extra do handler `guest-list` PATCH e confirme que a sessão B não altera a lista A.

- [ ] **Step 4: Run tests**

Run: `node --test tests/tenant-isolation.test.mjs tests/rsvp-service.test.mjs tests/messages-service.test.mjs tests/admin-panel.test.mjs`

Expected: PASS (atualize helpers para passar `accountId`).

- [ ] **Step 5: Commit**

```bash
git add functions/_lib/rsvp-guest-list.mjs functions/_lib/messages-service.mjs functions/api/admin tests/tenant-isolation.test.mjs tests
git commit -m "$(cat <<'EOF'
feat: isolar lista de convidados e mural por conta

EOF
)"
```

---

### Task 8: Slug público + seed do parceiro

**Files:**
- Create: `functions/_lib/partner-seed.mjs`
- Modify: `functions/_lib/auth-service.mjs` — `resolveAccountBySlug` já existe; chame `ensurePartnerAccount` no `login` quando env estiver setado
- Test: `tests/partner-seed.test.mjs`

**Interfaces:**
- `ensurePartnerAccount(db, { email, password }, nowIso)`  
  - UPDATE da linha `partner-dani-carine`: email lowercase, novo salt/hash, `slug='dani-carine'`, `is_partner=1`, `plan='pro'`, `plan_status='active'`  
  - se `!email || !password` → no-op  
  - se a linha não existe → INSERT com esse id

- [ ] **Step 1: Write the failing test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryAuthDb } from './helpers/memory-auth-db.mjs';
import { ensurePartnerAccount } from '../functions/_lib/partner-seed.mjs';
import { login, resolveAccountBySlug, PARTNER_ACCOUNT_ID } from '../functions/_lib/auth-service.mjs';

test('partner seed can log in and resolves dani-carine slug', async () => {
  const db = new MemoryAuthDb();
  const now = '2026-11-14T23:00:00.000Z';
  await ensurePartnerAccount(db, { email: 'dani@casebem.com', password: 'segredo12' }, now);
  const acc = await resolveAccountBySlug(db, 'dani-carine');
  assert.equal(acc.id, PARTNER_ACCOUNT_ID);
  assert.equal(acc.isPartner, true);
  const session = await login(db, { email: 'dani@casebem.com', password: 'segredo12' }, now);
  assert.ok(session.sessionId);
  assert.equal(await resolveAccountBySlug(db, 'nao-existe'), null);
});
```

Exporte `PARTNER_ACCOUNT_ID` de `auth-service.mjs`. `resolveAccountBySlug` deve devolver o row interno com `id` (não só `publicAccount`).

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/partner-seed.test.mjs`

Expected: FAIL module not found.

- [ ] **Step 3: Write minimal implementation**

`ensurePartnerAccount` usa `hashPassword` + `randomSaltB64`. `login.js` no início:

```js
await ensurePartnerAccount(env.DB || null, {
  email: env.PARTNER_EMAIL,
  password: env.PARTNER_BOOTSTRAP_PASSWORD,
}, new Date().toISOString());
```

Documente no `wrangler.toml.example` as duas vars (sem valores).

- [ ] **Step 4: Run tests**

Run: `node --test tests/partner-seed.test.mjs tests/auth-service.test.mjs`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add functions/_lib/partner-seed.mjs functions/_lib/auth-service.mjs functions/api/auth/login.js wrangler.toml.example tests/partner-seed.test.mjs
git commit -m "$(cat <<'EOF'
feat: seed do casal parceiro com slug dani-carine

EOF
)"
```

---

### Task 9: SPA React — router, landing com cadastro, `/entrar`, hub admin

**Files:**
- Modify: `index.html` (trocar meta-refresh pelo root `#root` + `/src/main.jsx`)
- Create: `src/main.jsx`, `src/App.jsx`, `src/lib/session-api.mjs`
- Create: `src/pages/Landing.jsx`, `src/pages/Login.jsx`, `src/pages/AdminHub.jsx`
- Create: `src/pages/admin/ComingSoon.jsx`
- Modify: `vite.config.js` — `build.rollupOptions.input.main = resolve(rootDir, 'index.html')`; `server.open: '/'`
- Modify: `src/landing/main.js` usage — Landing.jsx importa `../landing/style.css` e, num `useEffect`, o init GSAP existente **ou** reimplementa só o bind `data-plan` + submit do form (preferir: portar o form de waitlist e manter o restante do markup convertido para JSX)
- Test: `tests/spa-auth-ui.test.mjs` (happy-dom)

**Interfaces:**
- `api(path, { method, body })` → `fetch(path, { method, credentials: 'include', headers: { 'content-type': 'application/json' }, body })`
- Rotas React: `/`, `/entrar`, `/admin`, `/admin/minha-pagina`, `/admin/convidados`, `/admin/presentes`, `/admin/papelaria`, `/admin/mural`, `/admin/entretenimento`, `/admin/album`
- Sem sessão em `/admin/*` → `<Navigate to="/entrar" />`
- Com sessão em `/entrar` → `<Navigate to="/admin" />`

- [ ] **Step 1: Write the failing test**

Use happy-dom para montar `App` com `MemoryRouter`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';

test('landing signup form posts to /api/auth/signup and goes to /admin', async () => {
  const window = new Window({ url: 'http://localhost/' });
  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url).includes('/api/auth/signup'), true);
    assert.equal(init.credentials, 'include');
    const body = JSON.parse(init.body);
    assert.equal(body.plan, 'basic');
    assert.ok(body.password.length >= 8);
    return new Response(JSON.stringify({
      ok: true,
      account: { email: body.email, plan: 'basic', planStatus: 'active', slug: null, isPartner: false },
    }), { status: 201, headers: { 'content-type': 'application/json' } });
  };
  // importe Landing depois do fetch mock, submeta o form #cadastro
});
```

Implemente o teste até o assert de `window.location.pathname === '/admin'` (use `react-router` `createMemoryRouter` + `createRoot`). Se o import ESM de React no `node --test` emperrar, teste só `src/lib/session-api.mjs` (`signupRequest`) **e** um teste de `AdminHub` selectors via happy-dom no HTML gerado por uma função `hubTiles(plan)` extraída para `src/pages/admin/hub-tiles.mjs` (sem React) — **obrigatório** ter essa lista de tiles testável:

```js
export function hubTiles(plan) {
  return [
    { id: 'minha-pagina', title: 'Minha página', to: '/admin/minha-pagina', needsUpgrade: false },
    { id: 'convidados', title: 'Lista de convidados', to: '/admin/convidados', needsUpgrade: false },
    { id: 'presentes', title: 'Presentes', to: '/admin/presentes', needsUpgrade: false },
    { id: 'papelaria', title: 'Papelaria', to: '/admin/papelaria', needsUpgrade: false },
    { id: 'mural', title: 'Mural de recados', to: '/admin/mural', needsUpgrade: false },
    { id: 'entretenimento', title: 'Entretenimento', to: '/admin/entretenimento', needsUpgrade: plan === 'basic' },
    { id: 'album', title: 'Álbum compartilhado', to: '/admin/album', needsUpgrade: plan === 'basic' },
  ];
}
```

Teste:

```js
import { hubTiles } from '../src/pages/admin/hub-tiles.mjs';
test('basic sees entertainment locked; pro does not', () => {
  assert.equal(hubTiles('basic').find((t) => t.id === 'entretenimento').needsUpgrade, true);
  assert.equal(hubTiles('pro').find((t) => t.id === 'entretenimento').needsUpgrade, false);
  assert.equal(hubTiles('basic').some((t) => t.id === 'hospedagem' || t.id === 'playlist'), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/spa-auth-ui.test.mjs`

Expected: FAIL module not found.

- [ ] **Step 3: Write minimal implementation**

`index.html`:

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>CaseBem</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

`src/main.jsx`: `BrowserRouter` **sem** basename.

`Landing.jsx`: copie as seções de `landing-page-animada/index.html` para JSX (`class` → `className`, `for` → `htmlFor`). Header CTA “Lista de espera” → `<Link to="/entrar">Entrar</Link>` + âncora Criar conta. Hero “Entrar na lista” → `#cadastro`. Links `/dani-carine/` → `/casal/dani-carine`. Seção `#lista` vira `#cadastro`:

- campos e-mail, senha (≥8), rádios `basic` (default) / `pro` / `vip`
- botão “Criar conta”
- `data-plan` nos cards de plano marca o rádio
- submit → `POST /api/auth/signup` com `credentials: 'include'`; sucesso `navigate('/admin')`; 409 mostra “Este e-mail já tem conta”

`Login.jsx`: e-mail + senha, `POST /api/auth/login`, sucesso `/admin`.

`AdminHub.jsx`: `GET /api/auth/me` no mount; 401 → `/entrar`. Cabeçalho com e-mail, selo do plano, Sair (`POST /api/auth/logout`). Se `planStatus === 'pending_payment'`, banner “Pagamento em breve” (`role="status"`). Grid com `hubTiles(plan)`. Clique com `needsUpgrade` mostra “Disponível no Pro e no VIP” + botões que `POST /api/account/plan` `{ plan: 'pro' }` ou `'vip'`. Tile Minha página → página “em breve” (sem input de slug). Outros tiles: nesta fatia podem renderizar `ComingSoon` **somente** se a API da seção ainda não estiver ligada; **não** faça isso para convidados/presentes/papelaria/mural — na Task 10 ligamos. Nesta task, esses tiles podem navegar para rotas que mostram um `<p>Carregando…</p>` vazio.

Não inclua tiles de playlist/hospedagem.

- [ ] **Step 4: Run tests + build**

Run: `node --test tests/spa-auth-ui.test.mjs && npm run build`

Expected: PASS; Vite emite `dist/index.html` (e ainda os outros HTML MPA). Se o input da raiz quebrar o build (EISDIR), o `main` entry é só o **arquivo** `index.html`, nunca um diretório.

- [ ] **Step 5: Commit**

```bash
git add index.html src vite.config.js tests/spa-auth-ui.test.mjs
git commit -m "$(cat <<'EOF'
feat: landing com cadastro, login e hub do admin no SPA

EOF
)"
```

---

### Task 10: Hub liga nas APIs admin existentes + plugin Vite de auth

**Files:**
- Create: `src/pages/admin/Guests.jsx`, `Gifts.jsx`, `Stationery.jsx`, `Messages.jsx`, `Entertainment.jsx`, `Album.jsx`
- Modify: `src/App.jsx` rotas
- Modify: `vite.config.js` — plugin `authApiPlugin` para `/api/auth/*` e `/api/account/plan` usando os `onRequest*` das Functions (converta Node req → Fetch `Request` como `nodeRequestToFetch`)
- `adminApiPlugin` já usa `requireAccount`

Não porte os 2000 linhas de `admin.html` pixel-perfect nesta task. Cada página: GET da API correspondente, lista simples, um form mínimo de criar, botão remover — suficiente para conta nova vazia e para o parceiro ver dados após seed. Reuse JSON já retornado (`guest-list`, `gifts`, `stationery`, `messages`, `challenges/questions`).

Entertainment e Álbum: se `needsUpgrade`, não chamam API; mostram CTA de upgrade.

Álbum: GET `/api/admin/summary` ou gallery admin se existir; se não houver rota admin de galeria, mostre a lista pública não — use `GET` stub `{ photos: [] }` só se a Function não existir. Preferir `functions/api/desafio/gallery.js` **não** no admin. Página Álbum: texto + “em breve” **somente** se não houver API admin de galeria hoje. Há gallery no desafio: crie `GET /api/admin/gallery` mínimo que chama `listGalleryPhotos(db)` filtrando `accountId` **se** a tabela já tem `account_id`; senão lista vazia para conta nova e lista atual para o parceiro.

- [ ] **Step 1: Write the failing test** (Guests page contract via API)

Estenda `tests/tenant-isolation.test.mjs` com um teste de handler:

```js
import { onRequestGet as getGuests } from '../functions/api/admin/guest-list.js';

test('admin guest-list uses session account not body wedding_key', async () => {
  const a = await signup(null, { email: 'ga@x.com', password: 'segredo12', plan: 'basic' }, now);
  const b = await signup(null, { email: 'gb@x.com', password: 'segredo12', plan: 'basic' }, now);
  // POST names as A, then GET as B → count 0
});
```

Use os handlers reais `onRequestPost`/`onRequestGet` de `guest-list.js` com cookie de A vs B.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/tenant-isolation.test.mjs`

Expected: FAIL se o POST ainda grava no `WEDDING_KEY` global.

- [ ] **Step 3: Write minimal implementation**

Garanta `guest-list.js` `addGuests(env.DB, names, { groupId, accountId: auth.account.id })`. Páginas React: fetch com `credentials: 'include'`. Plugin Vite: roteie `/api/auth` e `/api/account/plan`.

- [ ] **Step 4: Run tests + build**

Run: `node --test tests/tenant-isolation.test.mjs tests/auth-api.test.mjs tests/spa-auth-ui.test.mjs && npm run build`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin functions/api/admin vite.config.js tests
git commit -m "$(cat <<'EOF'
feat: ligar o hub do admin às APIs da conta logada

EOF
)"
```

---

### Task 11: Stationery, challenges e summary por `accountId` + regressão

**Files:**
- Modify: `functions/_lib/stationery-service.mjs`, `challenges-service.mjs`, `admin-service.mjs`, `desafio-theme-service.mjs` — parâmetro `accountId` no SQL
- Modify: handlers admin correspondentes
- Test: `tests/admin-account-scope.test.mjs` — um teste por serviço (`listStationeryAdmin`, `listQuestionsAdmin`) com dois ids

Mesmo padrão da Task 6. Memory maps por `accountId`.

- [ ] **Step 1: Write failing tests** (dois accounts, lista B vazia)
- [ ] **Step 2: Run — FAIL**
- [ ] **Step 3: Filter SQL/memory by accountId**
- [ ] **Step 4: `node --test tests/admin-account-scope.test.mjs tests/stationery-service.test.mjs tests/challenges-service.test.mjs` PASS**
- [ ] **Step 5: Commit** `feat: filtrar papelaria e desafios pela conta da sessão`

---

### Task 12: Smoke final da fatia A

**Files:** nenhum novo, só verificação.

- [ ] **Step 1: Write any missing spec test** — se `resolveAccountBySlug` 404 ainda não tem teste de Function pública, adicione `tests/slug-resolve.test.mjs`:

```js
import { resolveAccountBySlug, PARTNER_ACCOUNT_ID } from '../functions/_lib/auth-service.mjs';
import { MemoryAuthDb } from './helpers/memory-auth-db.mjs';
import { ensurePartnerAccount } from '../functions/_lib/partner-seed.mjs';

test('public slug resolver 404s unknown and hits partner', async () => {
  const db = new MemoryAuthDb();
  assert.equal(await resolveAccountBySlug(db, 'x'), null);
  await ensurePartnerAccount(db, { email: 'dani@casebem.com', password: 'segredo12' }, '2026-11-14T23:00:00.000Z');
  const acc = await resolveAccountBySlug(db, 'dani-carine');
  assert.equal(acc.id, PARTNER_ACCOUNT_ID);
});
```

Se já coberto na Task 8, não duplique — rode a suíte.

- [ ] **Step 2: Run full suite**

Run: `node --test tests/*.test.mjs tests/helpers/*.mjs`  
(helpers não são testes; use `node --test tests/*.test.mjs`)

Expected: todos PASS. Corrija quebras em `lodging-frontend` / `media-frontend` se o admin HTML de teste ainda espera Bearer: esses testes do MPA antigo podem continuar apontando para `dani-carine/admin.html` até a fatia B; **não** os apague. Se quebrarem por `requireAdmin` removido, atualize o mock de fetch para cookie **somente** se o teste importa Functions novas.

- [ ] **Step 3: `npm run build`**

Expected: exit 0; `dist/index.html` é o SPA.

- [ ] **Step 4: Commit vazio não**; só se houver correções.

```bash
git add -u
git commit -m "$(cat <<'EOF'
fix: regressão da fatia A no isolamento e no build SPA

EOF
)"
```

Só faça o commit se `git status` mostrar diffs.

---

## Spec coverage

| Spec | Task |
|---|---|
| `/` SPA, `/entrar`, `/admin`, `/casal` → entrar, rewrite SPA | 1 |
| Cookie `cb_session`, PBKDF2 10k | 2–4 |
| signup/login/logout/me/plan, 401/409/400, nunca 402 | 3–4 |
| `requireAccount` no `/api/admin/*` | 5 |
| `account_id` + IDOR presentes/lista/mural | 6–7, 11 |
| Seed parceiro `dani-carine` | 8 |
| Landing sem waitlist, hub tiles, upgrade basic, Minha página em breve, sem playlist/hospedagem | 9–10 |
| Site público / jogos | **fora** (fatias B e C) |

## Self-review

- Sem TBD/TODO no plano
- `publicAccount` sem `id`; `accountId` só no servidor
- `createGift(db, accountId, body)` consistente nas tasks 6 e 10
- Fatia A não apaga `games/` nem `dani-carine/index.html`
