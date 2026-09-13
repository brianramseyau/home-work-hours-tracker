# AGENTS.md

Guidance for AI coding agents (Claude Code, Codex, etc.) working in this repository. `CLAUDE.md` imports this file.

## ⚠️ 1. PUBLIC REPO: NO PII, EVER (read first, applies to everything)

This repository is **public**. **Never commit personally identifiable information.** That covers code, docs, plans, commit messages, tests, fixtures, seed data, screenshots and generated files.

- **Forbidden:**
  - Real names.
  - Employer or office names or addresses.
  - Home addresses.
  - Real work patterns, dates or totals tied to the owner.
  - The owner's spreadsheets (`*.xlsx`).
  - The SQLite db (`data/`, `*.db`).
  - `.env`.
- **Always use placeholders:**
  - People: **John Doe / Jane Doe**.
  - Offices: **"Office Location 1" / "Office Location 2"**.
  - Addresses: "123 Example St, Sampletown VIC 3000".
  - Numbers and dates: synthetic.
- **Guards:**
  - The pre-commit and commit-msg hooks run `scripts/check-pii.mjs` against a local, gitignored `.pii-denylist`.
  - CI runs the same scan using the `PII_DENYLIST` secret, and **never prints matched terms**.
  - **Do not bypass the hooks** (`--no-verify` is forbidden).
  - Never write real terms into any tracked file, including docs that describe the denylist.
- **Before every commit,** read your diff specifically looking for PII. If you're unsure whether something is PII, treat it as PII and ask.

## 2. What this is

A self-hosted, single-user SvelteKit app. It records the hours worked from home in each Australian financial year (1 Jul – 30 Jun) for the ATO fixed-rate claim (hours × a per-year rate), replacing a yearly spreadsheet. Days **auto-fill** from a weekly or fortnightly schedule, the standard hours and public holidays. Any day can be overridden (split days, office, leave, sick, notes). It exports a branded `.xlsx` for an accountant. There's no auth; the home network is the trust boundary. It deploys as a Docker image on Unraid and installs as a PWA.

**Plans:** [foundational/PLAN_01_OVERVIEW.md](foundational/PLAN_01_OVERVIEW.md) is the master doc, and each phase has `foundational/PLAN_01_PHASE_NN_*.md`. Design lives in [foundational/DESIGN.md](foundational/DESIGN.md). New plans follow `foundational/PLAN_NN_OVERVIEW.md` + `PLAN_NN_PHASE_NN_TITLE.md`. When you finish a phase, tick its acceptance criteria and note any deviations in its doc.

## 3. Commands

These are available once Phase 01's scaffold lands.

```sh
npm run dev                 # dev server
npm run build && npm run preview
npm run check               # svelte-kit sync + svelte-check
npm run lint                # prettier --check + eslint
npm run format
npm run test                # vitest, single run (server + browser projects)
npm run test:unit           # vitest watch
npm run test:coverage       # vitest with 100% thresholds (fails below 100)
npm run test:e2e            # playwright (mobile + desktop projects)
npm run verify              # lint && check && test:coverage && test:e2e  ← run before finishing any phase
npx vitest run path/to/file.test.ts
npm run db:generate         # drizzle migration after editing schema.ts
npm run db:studio
npm run db:seed             # synthetic demo data (John Doe, Office Location 1/2)
npm run assets:generate     # logo → favicon / PWA icons
node scripts/check-pii.mjs --all
```

Migrations apply automatically on server boot (`src/hooks.server.ts` imports `$lib/server/db`). `DATABASE_URL` and `TZ` come from `.env` (copy `.env.example`).

## 4. Architecture and layering

- **No separate API.** `+page.server.ts` loads and form actions (`use:enhance`, zod-validated) talk to Drizzle/SQLite directly.
- `src/lib/core/*.ts` holds **pure** domain logic shared by client and server (`date`, `fy`, `time`, `schedule`, `prefill`, `totals`, `dayType`, `validation`). No DB, env or `Date.now()`; "today" is always a parameter. **Business-logic changes belong here.**
- `src/lib/server/*.ts` holds server-only logic: `clock` (today from `TZ`, plus `APP_FIXED_DATE` to pin "today" for E2E, which production never sets), `holidays` (`date-holidays` plus custom rows), `autoPrefill`, `export` (exceljs), `import` (legacy parser).
- `src/lib/server/repo/*.ts` holds Drizzle queries that **take `db` as a parameter**.
- `src/lib/server/db/create.ts` holds `createDb(path)`. It sets the connection-level `PRAGMA foreign_keys=OFF` before `migrate()`, runs `foreign_key_check`, then turns it `ON`. **Do not "clean up" these pragmas.** The in-migration pragmas drizzle-kit emits are no-ops inside the migrator's transaction, and without this, SQLite table rebuilds cascade-delete rows.
- `src/lib/branding.ts` holds `APP_NAME`, `APP_SHORT_NAME`, `REPO_URL` (the single source for the export footer and the app footer).

### Domain rules that are easy to get wrong

- Store **integer minutes** and **integer cents**. The claim is `round(totalMinutes × rateCents / 60)`, rounded once, at the end.
- Standard hours default to 09:00–17:06 less 30 min = **7.6 h**.
- **Never** derive a local date with `toISOString().slice(0, 10)`, which gives the UTC day. Use `clock.today()` on the server and pass it to the client.
- **`$env/dynamic/*` types are environment-dependent — always accept them via an indexed interface.** SvelteKit generates that ambient type from whichever vars are literally present when `svelte-kit sync` runs, so a plain `{ FOO?: string }` param type can pass locally (where `.env` sets `FOO`) and fail `svelte-check` in CI (no `.env` there) via TS's "weak type" check. Any interface a `$env/dynamic/*` value is passed into needs `[key: string]: string | undefined;` (see `ClockEnv` in `clock.ts`). When touching such code, sanity-check by temporarily renaming `.env` and re-running `npm run check`.
- Auto-prefill only ever creates or changes rows with `source = 'prefill'`. `manual` and `import` rows are sacred. Finalised FYs are frozen.
- The FY is 1 Jul → 30 Jun. The label `FY27` means the year ending June 2027. The week number starts at 1 on 1 Jul and goes up every Monday.

## 5. Testing: 100% coverage is mandatory

- Vitest `server` project (node) plus a `client` project (browser mode, Playwright/Chromium, `vitest-browser-svelte` for `*.svelte.test.ts`).
- The thresholds are **100% lines, branches, functions and statements**, and CI fails otherwise. New code ships with its tests in the same change.
- **The only coverage exclusions:** `src/lib/components/ui/**` (vendored shadcn-svelte), `**/*.d.ts`, `src/app.html`, `drizzle/**`, `scripts/**` except `scripts/pii/**`, config files, `src/lib/server/db/schema.ts` (declarative table shape; its `.references(() => …)` FK thunks are only ever called by drizzle-kit generating DDL, never by the app applying pre-built migrations or running queries — the migration itself is exercised for real by `create.test.ts`), and the `@vite-pwa` service-worker glue. Any addition needs a justification in the phase doc and must be listed here.
- DB code is tested against `createDb(':memory:')` via `vi.mock('$lib/server/db')`.
- **Svelte templates and branch coverage:** the compiler adds a hidden `?? ''` branch whenever an expression is mixed with other text, in a text node (`<p>{a} home</p>`), an attribute (`aria-label="{a} home"`), or `<title>{a}</title>`. That branch can never be covered. Write these as **one template-literal expression** instead: `{`${a} home`}`, `aria-label={`${a} home`}`, `<title>{`${a}`}</title>`. Lone expressions (`<span>{a}</span>`, `aria-label={a}`) are fine as they are.
- E2E lives in `e2e/` (`@playwright/test`), with projects `mobile` (Pixel 7) and `desktop`, locale `en-GB`, `TZ=Australia/Melbourne`, `APP_FIXED_DATE=2026-09-14`, and axe checks.
- **Fixtures are synthetic only** (see §1). Legacy-workbook fixtures are generated with exceljs inside the tests.

## 6. Design rules

- **Load the `/frontend-design` skill before any UI work** (`.claude/skills/frontend-design`, mirrored in `.agents/skills/`). Follow [foundational/DESIGN.md](foundational/DESIGN.md): the "desk lamp" concept, where lamp-amber is reserved for Home hours and the logo.
- Status is never shown by colour alone; each state also has a pattern. Bricolage Grotesque for display and Public Sans for UI. Tabular numerals for all numbers.
- Avoid the templated tells: all-caps eyebrows, middle-dot meta strings, `→` suffixes, identical card grids, gradient washes, and a single radius everywhere.
- Mobile-first, with desktop as a first-class layout. For charts, load the `dataviz` skill first.
- UI components come from shadcn-svelte. Wrap and compose them; don't edit `src/lib/components/ui/**` beyond what the CLI generates.

## 7. Verifying UI changes in a browser

Unit tests can't catch visual regressions. For any UI change, run the app and **look at screenshots**: 390px and 1440px, light and dark (`colorScheme`).

```sh
npm run dev &
LANGUAGE=en_GB:en node -e "
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--lang=en-GB'] });
  const page = await browser.newPage({ locale: 'en-GB', colorScheme: 'dark', viewport: { width: 390, height: 844 } });
  await page.goto('http://localhost:5173/<route>');
  await page.screenshot({ path: '/tmp/check.png', fullPage: true });
  await browser.close();
})();
"
```

Native date and time inputs follow the **browser's** UI language, not the page's `lang`. Use `en-GB` (day-first, like en-AU) through **both** the `LANGUAGE` env var and `--lang`, so an `MM/DD` rendering isn't mistaken for an app bug.

## 8. Conventions

- Svelte 5 runes mode is forced project-wide. TypeScript is strict. Prettier and ESLint must pass.
- Commit on `main` at the end of each phase, after `npm run verify` passes and the diff has been PII-checked. Never push to a remote or create the GitHub repo without the owner's confirmation.
- Keep the docs current: update the phase doc, DESIGN.md's decisions log, and this file when commands or rules change.
