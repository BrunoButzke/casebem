# CaseBem React Shell — Implementation Plan

> **For agentic workers:** Implement task-by-task. Wedding site HTML stays untouched.

**Goal:** Scaffold a mobile-first React+Vite shell at `/app` with login, home, and stubs.

**Architecture:** `app/` SPA entry in the existing Vite monorepo; React Router basename `/app`; Cloudflare `_redirects` for SPA fallback; reuse temp admin token storage.

**Tech Stack:** React 19, react-router-dom, @vitejs/plugin-react, Vite 8, existing Cloudflare Pages Functions.

## Global Constraints
- Do not rewrite `dani-carine/` or landing in this plan.
- Keep `ADMIN_PANEL_SECRET` / temp login compatible with current admin HTML.
- Portuguese UI copy for noivos/product.

---

### Task 1: Dependencies + Vite React entry

**Files:**
- Modify: `package.json`
- Modify: `vite.config.js`
- Create: `app/index.html`
- Create: `public/_redirects`

- [ ] Install `react`, `react-dom`, `react-router-dom`, `@vitejs/plugin-react`
- [ ] Add `app/index.html` to Vite `build.rollupOptions.input`
- [ ] Enable `@vitejs/plugin-react`
- [ ] Add SPA redirects for `/app/*`

### Task 2: Auth + routes shell

**Files:**
- Create: `app/src/main.jsx`, `App.jsx`, `auth.js`, pages + BottomNav + CSS

- [ ] Login with temp credentials → sessionStorage token
- [ ] Protected routes → home with bottom nav
- [ ] Stubs for admin + desafios

### Task 3: Smoke

- [ ] `npm run build` succeeds
- [ ] Dev: `/app/login` works
EOF
