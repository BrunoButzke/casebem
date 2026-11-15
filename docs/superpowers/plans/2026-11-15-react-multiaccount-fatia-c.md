# Fatia C — Jogos em `/casal/:slug/game` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Os jogos (quiz, desafios, selo, ranking, galeria, telão) passam a viver em `/casal/:slug/game/*` no SPA raiz; APIs `/api/desafio/*` resolvem `slug → account_id`; slug desconhecido 404; `/games/` e `desafio.casebem.com` continuam no app `games/` com fallback do parceiro.

**Architecture:** O middleware já reescreve `/casal/:slug/game/*` para o SPA raiz. Esta fatia aninha as rotas do `games/src/App.jsx` sob `/casal/:slug/game` com paths **relativos** (sem `/` inicial) para o mesmo código servir o basename `/games` e o prefixo `/casal/:slug/game`. `slugFromRequest` + `resolvePublicSlugOrPartner` (fatia B) ligam challenges, theme, answer e gallery. Sem slug = parceiro (legado). Não apagar `games/`.

**Tech Stack:** Vite 8, React 19, react-router-dom 7, Cloudflare Pages Functions, D1, R2 `GALLERY`, `node --test`, happy-dom.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-11-14-react-multiaccount-design.md`
- Cloudflare Pages Free: Functions 100 mil req/dia, 10 ms CPU
- Jogos só em `/casal/:slug/game` no produto novo; basename do app legado: `/games` em casebem.com e `/` em `desafio.casebem.com`
- Slug inexistente → 404 na página e nas APIs (`error: 'SLUG_NOT_FOUND'`)
- Sem `slug` nas APIs `/api/desafio/*` → fallback `partner-dani-carine` (legado `/games` e desafio host)
- Inquilino = `resolveAccountBySlug`; ignorar `wedding_key` / `account_id` do cliente
- Sem login dos noivos nos jogos; cookie `cb_session` não autentica o jogo
- Não apagar `games/` nem `dani-carine/index.html`
- Não implementar Minha página / editor de slug (fatia D)
- Ranking nesta versão pode continuar local (só o convidado); não inventar placar global
- UI em português; runner `node --test`; nenhum código de produção sem teste que falhou primeiro
- Commits em português, HEREDOC; não alterar `git config`; se o autor falhar, use `GIT_AUTHOR_NAME='Cursor Agent' GIT_AUTHOR_EMAIL='cursoragent@cursor.com'` (e COMMITTER) só no comando
- Não commitar `.env`, senhas, `dani-carine/admin.html`

## File map

| Path | Responsabilidade |
|---|---|
| `src/lib/game-paths.mjs` | `gameSlugFromPathname`, `gameTo(path, { slug, basename })` |
| `src/pages/casal/CoupleGames.jsx` | Gate 404 + render `games/src/App.jsx` |
| `src/App.jsx` | Rota `/casal/:slug/game/*` lazy |
| `games/src/App.jsx` | Rotas relativas (`quiz`, não `/quiz`) |
| `games/src/pages/PlayShell.jsx` | NavLinks relativos; telao via `endsWith` |
| `games/src/pages/Welcome.jsx` | `Navigate` relativo |
| `games/src/game-api.mjs` | Fetch desafio com `?slug=` |
| `games/src/PlayContext.jsx` | Usa `game-api` |
| `games/src/gallery-api.js` | Usa `game-api` |
| `games/src/theme.js` | Theme com slug |
| `games/src/guest.js` | Storage namespaced por slug |
| `games/src/progress.js` | Progress namespaced por slug |
| `functions/api/desafio/challenges.js` | Catálogo por slug |
| `functions/api/desafio/answer.js` | Nota por slug |
| `functions/api/desafio/theme.js` | Tema por slug |
| `functions/api/desafio/gallery.js` | Lista/upload/delete por accountId |
| `functions/api/desafio/gallery/[id].js` | Meta por accountId |
| `functions/api/desafio/gallery/[id]/image.js` | Bytes por accountId |
| `functions/_lib/gallery-service.mjs` | `accountId` em SQL/memory/R2 key |
| `vite.config.js` | Proxy desafio com slug |
| `tests/game-paths.test.mjs` | Paths + slug |
| `tests/desafio-slug.test.mjs` | APIs isoladas |
| `tests/gallery-service.test.mjs` | Isolamento gallery |
| `tests/casal-ui.test.mjs` | Rota game + 404 |

---

### Task 1: Rotas relativas e `/casal/:slug/game/*`

**Files:**
- Create: `src/lib/game-paths.mjs`
- Create: `src/pages/casal/CoupleGames.jsx`
- Modify: `src/App.jsx`
- Modify: `games/src/App.jsx`
- Modify: `games/src/pages/PlayShell.jsx`
- Modify: `games/src/pages/Welcome.jsx`
- Modify: `games/src/pages/Galeria.jsx` — `Link to="telao"` relativo (hoje `to="/galeria/telao"`)
- Create: `tests/game-paths.test.mjs`
- Modify: `tests/casal-ui.test.mjs`

**Interfaces:**
- Consumes: `fetchCouplePage(slug)` de `src/lib/casal-api.mjs`
- Produces:
  - `gameSlugFromPathname(pathname)` → `string | null` (`/casal/Dani-Carine/game/quiz` → `dani-carine`; `/games/quiz` → `null`)
  - `gameTo(to, slug)` → se `slug` então `/casal/${slug}/game${to starts with / ? to : '/' + to}` senão `to` (com `/` inicial, para o basename `/games`)
  - Rota React `path="/casal/:slug/game/*"`
  - 404: heading `Página não encontrada` quando `fetchCouplePage` 404
  - Rotas internas do jogo **relativas**: `quiz`, `desafios`, `selo`, `ranking`, `galeria`, `galeria/telao` (sem `/` inicial). `index` = Welcome.

- [ ] **Step 1: Write the failing tests**

`tests/game-paths.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gameSlugFromPathname, gameTo } from '../src/lib/game-paths.mjs';

test('gameSlugFromPathname reads /casal/:slug/game and ignores /games', () => {
  assert.equal(gameSlugFromPathname('/casal/dani-carine/game'), 'dani-carine');
  assert.equal(gameSlugFromPathname('/casal/Dani-Carine/game/quiz'), 'dani-carine');
  assert.equal(gameSlugFromPathname('/casal/x/game/galeria/telao'), 'x');
  assert.equal(gameSlugFromPathname('/games/quiz'), null);
  assert.equal(gameSlugFromPathname('/casal/dani-carine'), null);
  assert.equal(gameSlugFromPathname('/quiz'), null);
});

test('gameTo prefixes couple slug and keeps absolute game paths for the /games basename', () => {
  assert.equal(gameTo('/quiz', 'dani-carine'), '/casal/dani-carine/game/quiz');
  assert.equal(gameTo('quiz', 'dani-carine'), '/casal/dani-carine/game/quiz');
  assert.equal(gameTo('/quiz', null), '/quiz');
  assert.equal(gameTo('/', 'dani-carine'), '/casal/dani-carine/game/');
});
```

Em `tests/casal-ui.test.mjs`:

```js
test('App.jsx nests games under /casal/:slug/game/*', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(app, /path="\/casal\/:slug\/game\/\*"/);
  const gamesApp = readFileSync(new URL('../games/src/App.jsx', import.meta.url), 'utf8');
  assert.match(gamesApp, /path="quiz"/);
  assert.doesNotMatch(gamesApp, /path="\/quiz"/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/game-paths.test.mjs tests/casal-ui.test.mjs`

Expected: FAIL module not found / App.jsx sem a rota.

- [ ] **Step 3: Write minimal implementation**

`src/lib/game-paths.mjs`:

```js
export function gameSlugFromPathname(pathname) {
  const m = String(pathname || '').match(/^\/casal\/([^/]+)\/game(?:\/|$)/i);
  return m ? decodeURIComponent(m[1]).trim().toLowerCase() : null;
}

export function gameTo(to, slug) {
  const path = String(to || '/');
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (!slug) return normalized === '' ? '/' : normalized;
  const base = `/casal/${encodeURIComponent(slug)}/game`;
  if (normalized === '/') return `${base}/`;
  return `${base}${normalized}`;
}
```

`games/src/App.jsx` — troque paths absolutos por relativos:

```jsx
<Routes>
  <Route index element={<Welcome />} />
  <Route element={<PlayShell />}>
    <Route path="quiz" element={<Quiz />} />
    <Route path="desafios" element={<Desafios />} />
    <Route path="selo" element={<Selo />} />
    <Route path="ranking" element={<Ranking />} />
    <Route path="galeria" element={<Galeria />} />
    <Route path="galeria/telao" element={<Telao />} />
  </Route>
  <Route path="home" element={<Navigate to="quiz" replace />} />
  <Route path="missoes" element={<Navigate to="quiz" replace />} />
  <Route path="*" element={<Navigate to="." replace />} />
</Routes>
```

`PlayShell.jsx`: `TABS` com `to: 'quiz'` (sem `/`). `telao` = `location.pathname.endsWith('/galeria/telao')`. `navigate('.')` ao sair (Welcome). `Navigate to="."` se sem guest. NavLink `to={tab.to}` relativo.

`Welcome.jsx`: `Navigate to="quiz"` e `navigate('quiz')`.

`Galeria.jsx`: `to="telao"` (relativo a `galeria`).

`CoupleGames.jsx`: `useParams().slug`, `fetchCouplePage`, loading/404 iguais ao `CoupleSite` (`Página não encontrada` só em 404). Sucesso: `<div className="couple-games"><GamesApp /></div>` importando `../../../games/src/App.jsx`. Importe `games/src/styles.css` **neste** arquivo (chunk lazy), não no `App.jsx` raiz.

`src/App.jsx`:

```jsx
const CoupleGames = lazy(() => import('./pages/casal/CoupleGames.jsx'));
// ...
<Route
  path="/casal/:slug/game/*"
  element={
    <Suspense fallback={<p>Carregando…</p>}>
      <CoupleGames />
    </Suspense>
  }
/>
```

Coloque **antes** de `/casal/:slug` para o splat não ser engolido (em RR7 o mais específico ganha se declarado; ainda assim declare a rota game primeiro).

Não mude `games/src/main.jsx` basename.

- [ ] **Step 4: Run tests**

Run: `node --test tests/game-paths.test.mjs tests/casal-ui.test.mjs tests/pages-routing.test.mjs`

Expected: PASS. `npm run build` se o import CSS/JSX quebrar.

- [ ] **Step 5: Commit**

```bash
git add src/lib/game-paths.mjs src/pages/casal/CoupleGames.jsx src/App.jsx games/src/App.jsx games/src/pages/PlayShell.jsx games/src/pages/Welcome.jsx games/src/pages/Galeria.jsx tests/game-paths.test.mjs tests/casal-ui.test.mjs
git commit -m "$(cat <<'EOF'
feat: servir os jogos em /casal/:slug/game no SPA

EOF
)"
```

---

### Task 2: Challenges, tema e resposta por slug

**Files:**
- Modify: `functions/api/desafio/challenges.js`
- Modify: `functions/api/desafio/answer.js`
- Modify: `functions/api/desafio/theme.js`
- Modify: `vite.config.js` — os três GET/POST leem slug
- Create: `tests/desafio-slug.test.mjs`

**Interfaces:**
- Consumes: `slugFromRequest`, `resolvePublicSlugOrPartner`, `listChallengesPublic(db, accountId)`, `gradeQuestion(db, accountId, questionId, selectedIndex)`, `getDesafioTheme(db, accountId)`
- Produces: `GET /api/desafio/challenges?slug=` / `theme?slug=` / `POST /api/desafio/answer` body `{ slug, questionId, selectedIndex }`; 404 `SLUG_NOT_FOUND`; isolamento A/B; sem slug = parceiro

- [ ] **Step 1: Write the failing tests**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signup, setAccountSlug } from '../functions/_lib/auth-service.mjs';
import {
  createQuestion,
  resetMemoryChallengesForTests,
} from '../functions/_lib/challenges-service.mjs';
import { onRequestGet as challengesGet } from '../functions/api/desafio/challenges.js';
import { onRequestPost as answerPost } from '../functions/api/desafio/answer.js';
import { onRequestGet as themeGet } from '../functions/api/desafio/theme.js';

test('challenges for slug B omit question created on A', async () => {
  resetMemoryChallengesForTests();
  const now = '2026-11-15T06:00:00.000Z';
  const a = await signup(null, { email: 'ch-a@x.com', password: 'segredo12', plan: 'pro' }, now);
  const b = await signup(null, { email: 'ch-b@x.com', password: 'segredo12', plan: 'pro' }, now);
  await setAccountSlug(null, a.accountId, 'ch-a');
  await setAccountSlug(null, b.accountId, 'ch-b');
  const q = await createQuestion(null, a.accountId, {
    prompt: 'Segredo A?',
    options: ['1', '2'],
    correctIndex: 0,
    points: 10,
  });
  const resB = await challengesGet({
    request: new Request('https://casebem.com/api/desafio/challenges?slug=ch-b'),
    env: { DB: null },
  });
  assert.equal(resB.status, 200);
  const body = await resB.json();
  assert.equal((body.questions || []).some((item) => item.id === q.id), false);

  const unknown = await challengesGet({
    request: new Request('https://casebem.com/api/desafio/challenges?slug=nao-existe'),
    env: { DB: null },
  });
  assert.equal(unknown.status, 404);
});

test('answer POST unknown slug is 404', async () => {
  const res = await answerPost({
    request: new Request('https://casebem.com/api/desafio/answer', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Origin: 'https://casebem.com' },
      body: JSON.stringify({ slug: 'nao-existe', questionId: 'x', selectedIndex: 0 }),
    }),
    env: { DB: null },
  });
  assert.equal(res.status, 404);
});

test('theme GET unknown slug is 404', async () => {
  const res = await themeGet({
    request: new Request('https://casebem.com/api/desafio/theme?slug=nao-existe'),
    env: { DB: null },
  });
  assert.equal(res.status, 404);
});
```

`createQuestion` — leia a assinatura real em `challenges-service.mjs` e ajuste o body do teste ao validador (não invente campos). `signup()` devolve `{ account, sessionId, accountId }` — use `accountId`, não `account.id`.

Se `validateOrigin` 403, omita Origin (mesmo padrão da fatia B).

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/desafio-slug.test.mjs`

Expected: FAIL — challenges ainda ignora slug (200 com seed do parceiro ou pergunta de A).

- [ ] **Step 3: Write minimal implementation**

Em cada handler:

```js
const slug = slugFromRequest(request, body);
const resolved = await resolvePublicSlugOrPartner(env.DB || null, slug);
if (!resolved.ok) {
  return json(headers, { error: resolved.error }, resolved.status);
}
const catalog = await listChallengesPublic(env.DB || null, resolved.account.id);
```

`answer.js`: parse body primeiro, depois slug (query ou `body.slug`). `gradeQuestion(..., resolved.account.id, ...)`.

`theme.js`: `getDesafioTheme(..., resolved.account.id)`.

Vite: os três endpoints `resolvePublicSlugOrPartner(null, parsed.searchParams.get('slug'))` e passam `account.id` no lugar de `PARTNER_ACCOUNT_ID`. POST answer lê slug do JSON.

- [ ] **Step 4: Run tests**

Run: `node --test tests/desafio-slug.test.mjs tests/challenges-service.test.mjs`

Expected: PASS. Se o arquivo de challenges tiver outro nome, rode o glob que já cobre o serviço.

- [ ] **Step 5: Commit**

```bash
git add functions/api/desafio/challenges.js functions/api/desafio/answer.js functions/api/desafio/theme.js vite.config.js tests/desafio-slug.test.mjs
git commit -m "$(cat <<'EOF'
feat: filtrar quiz, tema e respostas do jogo pelo slug

EOF
)"
```

---

### Task 3: Galeria por `account_id`

**Files:**
- Modify: `functions/_lib/gallery-service.mjs` — todas as queries públicas ganham `accountId = PARTNER_ACCOUNT_ID`; SQL `WHERE account_id = ?`; R2 key `desafio/${accountId}/${id}${ext}`; memory rows com `accountId`
- Modify: `functions/api/desafio/gallery.js`
- Modify: `functions/api/desafio/gallery/[id].js`
- Modify: `functions/api/desafio/gallery/[id]/image.js`
- Modify: `tests/gallery-service.test.mjs` — default continua parceiro (4º/2º arg omitido)
- Modify: `tests/desafio-slug.test.mjs` — isolamento A/B
- Modify: `vite.config.js` gallery GET/POST/DELETE

**Interfaces:**
- `listGalleryPhotos(db, accountId = PARTNER_ACCOUNT_ID)`
- `getGalleryPhoto(db, id, accountId = PARTNER_ACCOUNT_ID)`
- `getGalleryImage(db, id, bucket, accountId = PARTNER_ACCOUNT_ID)`
- `upsertGalleryPhoto(db, body, bucket, accountId = PARTNER_ACCOUNT_ID)`
- `deleteGalleryPhoto(db, query, bucket, accountId = PARTNER_ACCOUNT_ID)`
- HTTP: slug query/body; 404 slug desconhecido; foto da conta A não aparece no GET da conta B e GET `/api/desafio/gallery/:id?slug=b` é 404

- [ ] **Step 1: Write the failing tests**

Em `tests/desafio-slug.test.mjs`:

```js
import { resetMemoryGalleryForTests, upsertGalleryPhoto, listGalleryPhotos } from '../functions/_lib/gallery-service.mjs';
import { onRequestGet as galleryGet } from '../functions/api/desafio/gallery.js';

test('gallery list for slug B omits photo uploaded on A', async () => {
  resetMemoryGalleryForTests();
  const now = '2026-11-15T06:00:00.000Z';
  const a = await signup(null, { email: 'gal-a@x.com', password: 'segredo12', plan: 'pro' }, now);
  const b = await signup(null, { email: 'gal-b@x.com', password: 'segredo12', plan: 'pro' }, now);
  await setAccountSlug(null, a.accountId, 'gal-a');
  await setAccountSlug(null, b.accountId, 'gal-b');
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]);
  const photo = await upsertGalleryPhoto(
    null,
    { guestName: 'Ana', missionId: 'm1', title: 'A', bytes: jpeg, contentType: 'image/jpeg' },
    null,
    a.accountId
  );
  const res = await galleryGet({
    request: new Request('https://casebem.com/api/desafio/gallery?slug=gal-b'),
    env: { DB: null },
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal((body.photos || []).some((p) => p.id === photo.id), false);
  assert.equal((await listGalleryPhotos(null, b.accountId)).some((p) => p.id === photo.id), false);
});
```

Ajuste `bytes`/`contentType` ao validador real (`sniffContentType` — use um JPEG mínimo que os testes atuais já usam; copie o fixture de `tests/gallery-service.test.mjs`).

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/desafio-slug.test.mjs tests/gallery-service.test.mjs`

Expected: FAIL — `listGalleryPhotos` ignora accountId ou assinatura extra.

- [ ] **Step 3: Write minimal implementation**

Adicione `accountId` em cada função pública do gallery-service (default `PARTNER_ACCOUNT_ID`). Memory: filtre `row.accountId === accountId`. SQL: `account_id = ?` no lugar de `wedding_key = ?` nas cláusulas WHERE; mantenha `wedding_key` no INSERT (parceiro = `dani-carine`, outros = `accountId` ou slug — **não** vaze o UUID no JSON público). `toMeta` não inclui `accountId`.

Handlers: `resolvePublicSlugOrPartner` + passar `resolved.account.id`. GET `[id]` e `image` também leem `?slug=`.

Vite gallery: idem.

Atualize `tests/gallery-service.test.mjs` só se a assinatura quebrar (default preserva os testes antigos).

- [ ] **Step 4: Run tests**

Run: `node --test tests/desafio-slug.test.mjs tests/gallery-service.test.mjs`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add functions/_lib/gallery-service.mjs functions/api/desafio/gallery.js functions/api/desafio/gallery/[id].js functions/api/desafio/gallery/[id]/image.js vite.config.js tests/desafio-slug.test.mjs tests/gallery-service.test.mjs
git commit -m "$(cat <<'EOF'
feat: isolar a galeria do jogo pelo slug do casal

EOF
)"
```

---

### Task 4: Client dos jogos manda `slug`

**Files:**
- Create: `games/src/game-api.mjs`
- Modify: `games/src/PlayContext.jsx`
- Modify: `games/src/gallery-api.js`
- Modify: `games/src/theme.js`
- Modify: `src/pages/casal/CoupleGames.jsx` — chamar `loadAndApplyDesafioTheme` no mount (hoje só `games/src/main.jsx` faz isso)
- Modify: `tests/game-paths.test.mjs` ou `tests/casal-ui.test.mjs`

**Interfaces:**
- `desafioUrl(path, { slug, search })` → `/api/desafio/challenges?slug=dani-carine`
- `getGameSlug()` → `gameSlugFromPathname(window.location.pathname)` (null no `/games`)
- PlayContext GET challenges e POST answer incluem slug
- gallery-api e theme idem
- `credentials: 'omit'`

- [ ] **Step 1: Write the failing tests**

```js
import { desafioUrl, getGameSlug } from '../games/src/game-api.mjs';

test('desafioUrl adds slug query when present', () => {
  assert.equal(desafioUrl('/api/desafio/challenges', { slug: 'dani-carine' }), '/api/desafio/challenges?slug=dani-carine');
  assert.equal(desafioUrl('/api/desafio/challenges', { slug: null }), '/api/desafio/challenges');
  assert.equal(
    desafioUrl('/api/desafio/gallery/abc/image', { slug: 'x' }),
    '/api/desafio/gallery/abc/image?slug=x'
  );
});
```

```js
test('PlayContext and gallery-api call desafioUrl', () => {
  const play = readFileSync(new URL('../games/src/PlayContext.jsx', import.meta.url), 'utf8');
  const gal = readFileSync(new URL('../games/src/gallery-api.js', import.meta.url), 'utf8');
  const theme = readFileSync(new URL('../games/src/theme.js', import.meta.url), 'utf8');
  assert.match(play, /desafioUrl/);
  assert.match(gal, /desafioUrl/);
  assert.match(theme, /desafioUrl|getGameSlug/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/game-paths.test.mjs tests/casal-ui.test.mjs`

Expected: FAIL missing `game-api.mjs`.

- [ ] **Step 3: Write minimal implementation**

```js
import { gameSlugFromPathname } from '../../src/lib/game-paths.mjs';

export function getGameSlug() {
  if (typeof window === 'undefined') return null;
  return gameSlugFromPathname(window.location.pathname);
}

export function desafioUrl(path, { slug, search } = {}) {
  const url = new URL(path, 'https://casebem.local');
  const s = slug === undefined ? getGameSlug() : slug;
  if (s) url.searchParams.set('slug', s);
  if (search && typeof search === 'object') {
    for (const [k, v] of Object.entries(search)) {
      if (v != null && v !== '') url.searchParams.set(k, String(v));
    }
  }
  return `${url.pathname}${url.search}`;
}
```

PlayContext: `fetch(desafioUrl('/api/desafio/challenges'))` e POST answer `body: JSON.stringify({ questionId, selectedIndex, slug: getGameSlug() })` (omit `slug` se null).

gallery-api: prefixe URLs com `desafioUrl`. DELETE já usa query — preserve `id`/`guestName`/`missionId` e acrescente slug.

theme.js: `fetch(desafioUrl('/api/desafio/theme'))`.

CoupleGames: `useEffect` → `loadAndApplyDesafioTheme()`; cleanup **não** precisa limpar CSS vars (YAGNI).

- [ ] **Step 4: Run tests**

Run: `node --test tests/game-paths.test.mjs tests/casal-ui.test.mjs tests/desafio-slug.test.mjs`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add games/src/game-api.mjs games/src/PlayContext.jsx games/src/gallery-api.js games/src/theme.js src/pages/casal/CoupleGames.jsx tests/game-paths.test.mjs tests/casal-ui.test.mjs
git commit -m "$(cat <<'EOF'
feat: enviar o slug do casal nas APIs públicas do jogo

EOF
)"
```

---

### Task 5: Storage do convidado e progresso por slug

**Files:**
- Modify: `games/src/guest.js`
- Modify: `games/src/progress.js`
- Create: `tests/game-storage.test.mjs` (happy-dom `Window`)

**Interfaces:**
- `guestStorageKey(slug)` → `casebem_desafio_guest_name` se `!slug`; senão `casebem_desafio_guest_name:${slug}`
- `progressStorageKey(slug, guestName)` → `casebem_desafio_progress:${guest}:${slug}` quando slug; senão a chave atual `casebem_desafio_progress:${guest}`
- `getGuestName` / `loadProgress` leem `getGameSlug()`

- [ ] **Step 1: Write the failing tests**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';

test('guest name on couple game does not leak to /games', async () => {
  const window = new Window({ url: 'https://casebem.com/casal/dani-carine/game/quiz' });
  globalThis.window = window;
  globalThis.localStorage = window.localStorage;
  globalThis.sessionStorage = window.sessionStorage;
  const { setGuestName, getGuestName, clearGuestName } = await import('../games/src/guest.js');
  setGuestName('Ana');
  assert.equal(getGuestName(), 'Ana');
  window.happyDOM.setURL('https://casebem.com/games/quiz');
  // re-read pathname via window.location — if happy-dom não atualiza, instancie outro Window
});
```

Se o import de `guest.js` cachear `window` só na chamada (ele lê `window.location` via `getGameSlug` a cada vez), trocar a URL e chamar `getGuestName()` de novo deve devolver `''` se a chave for namespaced.

Mais simples e estável:

```js
import { guestStorageKey, progressStorageKey } from '../games/src/guest.js';
// exporte as funções de chave de guest.js e progress.js

test('storage keys differ by slug', () => {
  assert.equal(guestStorageKey(null), 'casebem_desafio_guest_name');
  assert.equal(guestStorageKey('dani-carine'), 'casebem_desafio_guest_name:dani-carine');
  assert.equal(progressStorageKey(null, 'Ana'), 'casebem_desafio_progress:ana');
  assert.equal(progressStorageKey('dani-carine', 'Ana'), 'casebem_desafio_progress:ana:dani-carine');
});
```

Exporte `guestStorageKey` de `guest.js` e `progressStorageKey` de `progress.js`. `loadProgress` usa `progressStorageKey(getGameSlug(), guestName)`. Mantenha o lower-case do nome como hoje.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/game-storage.test.mjs`

Expected: FAIL exports missing.

- [ ] **Step 3: Write minimal implementation**

Implemente as chaves e use-as em get/set/clear/load/save. `getGameSlug()` de `game-api.mjs`.

- [ ] **Step 4: Run tests**

Run: `node --test tests/game-storage.test.mjs`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add games/src/guest.js games/src/progress.js tests/game-storage.test.mjs
git commit -m "$(cat <<'EOF'
feat: separar nome e progresso do jogo por casal

EOF
)"
```

---

### Task 6: Smoke da fatia C

**Files:**
- Modify: `tests/casal-ui.test.mjs` — landing **não** precisa linkar jogos (YAGNI); CoupleGames 404 copy
- Modify: `tests/pages-routing.test.mjs` — já reescreve `/casal/x/game/quiz` para `/` (não quebrar); `/games/quiz` continua rewrite para `/games/`
- `npm run build`
- `node --test tests/*.test.mjs`

**Checklist de comportamento (teste de source + routing, não E2E):**

1. `App.jsx` tem `/casal/:slug/game/*` **e** `/casal/:slug`
2. `games/src/main.jsx` ainda usa `gamesRouterBasename`
3. `CoupleGames.jsx` não contém admin-login
4. `resolvePagesRoute('casebem.com', '/casal/dani-carine/game/quiz')` → rewrite `/`
5. `resolvePagesRoute('casebem.com', '/games/quiz')` → rewrite `/games/`
6. `resolvePagesRoute('desafio.casebem.com', '/quiz')` → rewrite `/games/`

- [ ] **Step 1: Write the failing tests** (só o que ainda não existir)

```js
test('legacy games host and /games stay on the games SPA', () => {
  assert.deepEqual(resolvePagesRoute('casebem.com', '/games/quiz'), {
    action: 'rewrite',
    assetPath: '/games/',
  });
  assert.deepEqual(resolvePagesRoute('desafio.casebem.com', '/quiz'), {
    action: 'rewrite',
    assetPath: '/games/',
  });
});

test('CoupleGames 404 copy matches CoupleSite', () => {
  const src = readFileSync(new URL('../src/pages/casal/CoupleGames.jsx', import.meta.url), 'utf8');
  assert.match(src, /Página não encontrada/);
  assert.doesNotMatch(src, /admin-login|Acesso dos noivos/);
  assert.match(src, /fetchCouplePage/);
});
```

- [ ] **Step 2: Run to verify fail if missing**

Run: `node --test tests/pages-routing.test.mjs tests/casal-ui.test.mjs`

- [ ] **Step 3: Fill gaps only**

Não adicione features. Se o 404 copy já existe, o teste passa.

- [ ] **Step 4: Run suite + build**

```
node --test tests/game-paths.test.mjs tests/game-storage.test.mjs tests/desafio-slug.test.mjs tests/gallery-service.test.mjs tests/casal-ui.test.mjs tests/pages-routing.test.mjs
npm run build
node --test tests/*.test.mjs
```

Expected: todos PASS, build exit 0.

- [ ] **Step 5: Commit**

```bash
git add tests/casal-ui.test.mjs tests/pages-routing.test.mjs src/pages/casal/CoupleGames.jsx
git commit -m "$(cat <<'EOF'
feat: smoke dos jogos por slug e do app legado /games

EOF
)"
```

Se não houver diff, não faça commit vazio — rode a suíte e reporte.

---

## Spec coverage

| Spec | Task |
|---|---|
| Jogos em `/casal/:slug/game/*` | 1, 6 |
| Slug inexistente → 404 | 1, 2 |
| APIs públicas galeria/ranking/quiz resolvem slug → account_id | 2–4 |
| Sem misturar casais | 2, 3, 5 |
| Sem login dos noivos | 1, 6 |
| `/games` e desafio.casebem.com permanecem | 1, 6 |
| Ranking global ao vivo | **fora** (placar local já existe) |
| Minha página | **fora** (fatia D) |

## Self-review

- Sem TBD de implementação
- `gradeQuestion(db, accountId, questionId, selectedIndex)` alinhado no handler
- `listGalleryPhotos(db, accountId)` default PARTNER para testes antigos
- Paths relativos no App dos jogos + `gameTo` só se algum link absoluto restar (PlayShell usa relativo)
- `signup().accountId` não `account.id` nos testes
