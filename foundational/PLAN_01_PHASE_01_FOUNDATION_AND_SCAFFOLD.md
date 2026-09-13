# PLAN_01 · Phase 01 — Foundation and scaffold

**Goal:** a committed, PII-guarded SvelteKit project with the design system, branding, app shell, database bootstrap, and a complete test and CI harness that's already at 100% coverage. After this phase, every later phase only adds features.

**Depends on:** nothing. **Unblocks:** Phase 02.

## Tasks

### 1. Repository and PII guard (do this before anything is committed)

1. `git init -b main`.
2. Extend `.gitignore`:
   `node_modules/`, `.svelte-kit/`, `build/`, `data/`, `*.db`, `*.db-journal`, `.env*`, `!.env.example`, `coverage/`, `test-results/`, `playwright-report/`, `*.xlsx`, `.pii-denylist`, `.DS_Store`.
3. PII scanner:
   - The pure logic goes in `scripts/pii/scan.mjs`: `scan(files: {path, content}[], terms: string[]) → {path, line, termIndex}[]` and `blockedPath(path) → reason | null`.
     - Matching is case-insensitive and whole-word.
     - Blocked paths are `.xlsx`, `.db`, and `.env` other than `.env.example`.
   - The CLI goes in `scripts/check-pii.mjs`:
     - `--staged` reads staged blobs via `git show :<path>`.
     - `--all` covers `git ls-files`.
     - `--commit-msg <file>`.
     - Terms come from `.pii-denylist` (one per line, `#` comments) or the `PII_DENYLIST` env (newline-separated).
     - **Output shows `path:line (term #n)` and never the term itself.** CI logs are public.
     - No terms configured → a warning locally, and a failure in CI (`CI=true`).
   - Tests in `scripts/pii/scan.test.ts` use a synthetic denylist (`Doe`, `Office Location 9`) and are included in the coverage scope.
4. `simple-git-hooks` in `package.json`: `pre-commit: node scripts/check-pii.mjs --staged`, `commit-msg: node scripts/check-pii.mjs --commit-msg $1`. It's installed by the `prepare` script.
5. Ask the owner to create a local `.pii-denylist` (real surname, employer and office suburbs, street). **Agents must never write real terms into any tracked file**, including this doc.

### 2. Scaffold

1. `npx sv create .`: minimal template, TypeScript, add-ons `eslint`, `prettier`, `tailwindcss`, `vitest` (both component and unit), `playwright`, `drizzle` (sqlite + better-sqlite3).
2. Switch to `@sveltejs/adapter-node`. Set `engines.node: 24.x`, `.nvmrc` = `24`, `.npmrc` = `engine-strict=true`.
3. Match ev-charging-log's majors: Svelte 5, Kit 2, Vite 8, Vitest 4, TypeScript 6, ESLint 10.
4. `vite.config.ts`: force runes mode outside `node_modules` (copy from ev-charging-log) and define `__APP_VERSION__` from `APP_VERSION || package.json version`.
5. `.env.example`: `DATABASE_URL=./data/home-work-hours.db` and `TZ=Australia/Melbourne`.
6. Copy ev-charging-log's `eslint.config.js` and prettier config, minus the Electron `.cjs` override.

### 3. shadcn-svelte and the design system

1. `npx shadcn-svelte@latest init`, then add: button, input, label, select, tabs, drawer, sheet, dialog, toggle-group, textarea, badge, table, sonner, calendar, range-calendar, popover, command, separator, tooltip, skeleton, switch.
2. `mode-watcher` for the light/dark/system theme toggle.
3. `@fontsource-variable/bricolage-grotesque` and `@fontsource-variable/public-sans`, imported in `+layout.svelte`.
4. `src/app.css`: map the [DESIGN.md](DESIGN.md) tokens onto shadcn variables (`--background`, `--foreground`, `--primary`, `--accent`, `--muted`, `--border`, `--ring`, …) plus app tokens (`--lamp`, `--slate`, `--heather`, `--rosehip`, `--gum`), in light and dark. Also the pattern utilities (`.pattern-hatch`, `.pattern-dots`, `.pattern-ring`, `.pattern-outline`) and a `tabular-nums` default on `[data-numeric]`.

### 4. Branding (see DESIGN.md → Branding)

1. Hand-author `src/lib/assets/logo-mark.svg`, `logo-lockup.svg` (wordmark converted to outlines) and `logo-mark-mono.svg`. Add a simplified `favicon-glyph.svg` for 16/32px.
2. Adapt `scripts/generate-icons.mjs` from ev-charging-log (sharp). It writes:
   - `static/favicon.svg` (with `prefers-color-scheme` handling) and `static/favicon.ico` (16/32/48).
   - `static/apple-touch-icon.png` (180).
   - `static/icons/icon-{192,512}.png` and `icon-maskable-{192,512}.png`.
   - `static/brand/logo-lockup.png` (used by the xlsx export in P05).
   - Run it as part of `prepare`/`assets:generate`.
3. Add the favicon and apple-touch links to `src/app.html`.
4. Screenshot the mark at 16/32/180/512px on light and dark grounds, then review.

### 5. App shell

- `src/lib/branding.ts`: `APP_NAME = 'Home Work Hours Tracker'`, `APP_SHORT_NAME = 'Home Hours'`, `REPO_URL = 'https://github.com/brianramseyau/home-work-hours-tracker'`.
- `+layout.svelte`:
  - The desktop nav rail (lockup, Week, Year, Export, Settings) and the mobile bottom tabs.
  - An FY switcher placeholder.
  - The theme toggle.
  - A footer with the repo link and `__APP_VERSION__`.
  - Nav items resolve to `/` until the real routes exist.
- `+error.svelte`: the lamp-off illustration and "This page is off the clock" copy, showing the status and message, with a link home.
- `/`: a placeholder page (replaced in P04).

### 6. Database bootstrap

- `src/lib/server/db/create.ts`: `createDb(path, migrationsFolder = 'drizzle')` → the drizzle instance. It uses the FK-pragma pattern and keeps ev-charging-log's comment verbatim. `index.ts` is a thin singleton reading `DATABASE_URL` from `$env/dynamic/private` and creating its parent directory.
- `src/hooks.server.ts` imports the db, so migrations run on boot.
- `drizzle.config.ts` is copied from ev-charging-log.
- `schema.ts` starts with only the `settings` singleton table, so the migration pipeline is proven. P02 extends it.
- Tests:
  - `createDb(':memory:')` applies the migrations and turns FK enforcement back on.
  - The FK-violation branch throws.
  - `index.ts` throws when `DATABASE_URL` is missing (via `vi.mock('$env/dynamic/private')`).

### 7. Test and CI infrastructure

- `vite.config.ts` test projects: `server` (node) and `client` (browser, Playwright provider, Chromium).
- `@vitest/coverage-v8`, with `include`/`exclude` exactly as in the Overview and `thresholds: { 100: true }`.
- Scripts:
  - `test`, `test:unit`, `test:coverage`, `test:e2e` (`playwright test`), `verify`.
  - `db:generate`, `db:studio`.
  - `assets:generate`.
- `playwright.config.ts`:
  - `webServer`: `npm run build && npm run preview`, with `DATABASE_URL=./data/e2e.db`, `APP_FIXED_DATE=2026-09-14` and `TZ=Australia/Melbourne`. The webServer command runs `e2e/reset-db.mjs` first to delete the old e2e db.
  - Projects `mobile` (Pixel 7) and `desktop` (Desktop Chrome), with `locale: 'en-GB'` and `timezoneId: 'Australia/Melbourne'`.
- `e2e/smoke.spec.ts`: the shell renders, the nav is visible for each viewport, the theme toggle works, and axe reports no violations in light and dark.
- Browser-mode tests for the layout, error page and theme toggle.
- `.github/workflows/ci.yml`:
  - Job `pii-scan`: checkout → `node scripts/check-pii.mjs --all`, with `PII_DENYLIST: ${{ secrets.PII_DENYLIST }}`.
  - Job `verify`: Node 24 → `npm ci` → `npx playwright install --with-deps chromium` → `npm run verify`.

### 8. Agent docs

- Finalise `AGENTS.md` (commands now real) and the `CLAUDE.md` shell, both drafted in Step 0.
- Write `foundational/DESIGN.md`'s decisions log entries for anything that changed during the build.

### 9. Commit and remote

- Commit only after `npm run verify` passes and `check-pii --all` is clean.
- **Ask the owner** before `gh repo create brianramseyau/home-work-hours-tracker --public`, and remind them to add the `PII_DENYLIST` secret first.

## Acceptance criteria

- [x] The pre-commit hook blocks a staged file containing a denylisted term, as well as any staged `.xlsx`. Also verified: the commit-msg hook blocks, and CI fails closed when no terms are configured.
- [x] `npm run verify` is green, with coverage at 100/100/100/100.
- [x] Shell screenshots at 390px and 1440px, light and dark, reviewed against DESIGN.md.
- [x] Logo, favicon and PWA icons generated, and legible at 16px (via the simplified favicon glyph).
- [x] AGENTS.md opens with the PII rule. CLAUDE.md imports AGENTS.md.

## Notes and deviations (as built)

- **npm bug workaround:** npm 11.16's arborist crashed (`Cannot read properties of null (reading 'children')`) on `npm i <pkg>` against the scaffolded lockfile. Adding dependencies via `npm pkg set` and doing a fresh `npm install` worked. If it recurs, use the same approach.
- **shadcn-svelte** 1.6 requires a design-system preset. The project was initialised with preset code `b1rc` (style nova, neutral base, Lucide icons, Public Sans), then the tokens were replaced with the DESIGN.md palette in `src/routes/layout.css`.
- **ESLint:** `svelte/no-navigation-without-resolve` runs with `ignoreLinks: true`. The app is served from the root, typed `resolve()` rejects routes that later phases add, and the rule also flagged vendored shadcn and external links. `goto`/`pushState` are still checked.
- **Svelte branch coverage:** mixed interpolations compile to an uncoverable `?? ''` branch. The convention (AGENTS.md §5) is to use one template-literal expression instead.
- **Pulled forward from P02:** a minimal `core/fy.ts` (start year, label, slug, range) and `server/clock.ts` (`today`), because the shell's FY switcher needs them. P02 extends both.
- **`APP_FIXED_DATE`** is honoured whenever it's set, not only outside production, because E2E runs against `vite preview` (a production build). Production deployments simply never set it.
- **Settings table:** the full `settings` singleton from the data model landed in the first migration (`drizzle/0000_init.sql`), rather than a stub.
- **Lockup:** the outlined-wordmark SVG/PNG is deferred to P05 (see the DESIGN.md decisions log).
- **Remote:** not created yet. It waits for the owner's go-ahead, and the `PII_DENYLIST` Actions secret must be added first.
