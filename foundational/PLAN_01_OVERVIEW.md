# PLAN_01 — Home Work Hours Tracker: Overview

> Master plan. Each build phase has its own doc (`PLAN_01_PHASE_NN_*.md`, see [Phase index](#phase-index)).
> Design tokens and brand rules live in [DESIGN.md](DESIGN.md).

## ⚠️ PUBLIC REPO: NO PII, EVER

This is a **public** project. **No personally identifiable information may ever be committed.** That covers code, plans, docs, commit messages, tests, fixtures, seed data, screenshots and generated files.

- **Never commit:**
  - Real names.
  - Employer or office names or addresses.
  - Home addresses.
  - Real work patterns or dates tied to the owner.
  - Real totals or claim amounts.
  - Legacy spreadsheets (`*.xlsx`).
  - The SQLite db (`data/`, `*.db`).
  - `.env`.
- **Placeholders only:**
  - People: **John Doe / Jane Doe**.
  - Offices: **"Office Location 1" / "Office Location 2"** (etc.).
  - Addresses: "123 Example St, Sampletown VIC 3000".
  - Figures and dates: synthetic.
- **Enforcement** (built in Phase 01):
  1. `.gitignore`.
  2. `scripts/check-pii.mjs` as a pre-commit and commit-msg hook (`simple-git-hooks`), reading a local, gitignored `.pii-denylist`.
  3. A CI `pii-scan` job reading the `PII_DENYLIST` Actions secret. **CI output must never print the matched term**, only `file:line`, because CI logs on a public repo are public.
  4. Agents review every diff for PII before committing.

## Context

A self-hosted, single-user app that replaces a yearly Excel "home work diary". The diary records the hours worked from home in each Australian financial year (1 Jul – 30 Jun). At tax time those hours are claimed under the **ATO fixed-rate method**: hours × a per-year rate set by the government (currently $0.70/hr).

The app:

- **Fills days automatically** from a weekly or fortnightly schedule, the standard hours and public holidays.
- Lets any day be overridden, with notes and an optional office.
- Exports a branded `.xlsx` for an accountant.

It is modelled on [`brianramseyau/ev-charging-log`](https://github.com/brianramseyau/ev-charging-log), which uses the same scaffolding: SvelteKit + Drizzle + SQLite, Docker/Unraid, PWA.

### What the legacy spreadsheet encodes

- There is one sheet, `Diary`, with the columns `Week | Date | Start Time | End Time | Total | Notes`. The summary sits in `G2` (Total Hours = `SUM(E)`), `H2` (claim = `G2 * rate`) and `I2` (the FY start year).
- It lists weekdays only, 1 Jul → 30 Jun. The week number starts at 1 on 1 Jul and goes up every Monday (53 weeks).
- `Total = (End − Start) × 24 − 0.5`, which means a **30-minute break** is always deducted.
- **Standard hours: 09:00–17:06 less 30 min = 7.6 h.** This is one global setting. Some sheets record `17:00` as shorthand; the import takes rows literally but doesn't treat that as a new standard.
- The Notes column carries the day type:
  - An office name means an office day.
  - `Sick`.
  - Ranges: `Leave start`…`Leave end` and `Xmas Hols START`…`Xmas Hols END`.
- Office days follow a **fortnightly alternating pattern**, and the pattern changes mid-year. So the schedule needs a 1- or 2-week cycle with effective-from versions.
- Each sheet's own `G2`/`H2` totals are the import acceptance check.

## Decisions

| Area            | Decision                                                                                                                                                                                                   |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stack           | SvelteKit (Svelte 5 runes, TS) for the frontend and the server. No separate API: `+page.server.ts` loads and form actions talk to Drizzle/SQLite (`better-sqlite3`). Drizzle Kit migrations apply on boot. |
| UI              | shadcn-svelte (Tailwind v4), mobile-first, with desktop as a first-class layout. The design follows the `frontend-design` skill (see [DESIGN.md](DESIGN.md)).                                              |
| Deployment      | A Docker image (PUID/PGID entrypoint), an Unraid CA template, a GHCR publish workflow, and an installable **PWA**. No Electron.                                                                            |
| Prefill         | **Automatic.** Days up to today fill themselves in from the schedule, standard hours and holidays. Overrides are never touched.                                                                            |
| Legacy import   | A "Historical import" section at the bottom of **Settings** links to `/import`. It isn't in the main nav. Upload, review, commit.                                                                          |
| Public holidays | Configurable AU state/region, seeded from `date-holidays` into an editable table. Custom/regional holidays can be added (one-off or repeating yearly), and any bundled one can be disabled.                |
| Split days      | A day has **multiple home-work time blocks** (start, end, break). The default is one.                                                                                                                      |
| Offices         | Unlimited (add, rename, archive). An office is optional on any day.                                                                                                                                        |
| Weekends        | The setting **"Include weekends"** is **off by default**.                                                                                                                                                  |
| Export          | A styled `.xlsx`: a Summary sheet and a Diary sheet with live formulas. Branded footer linking to the GitHub repo.                                                                                         |
| Timezone        | Comes from the process `TZ` env (Unraid passes `Australia/Melbourne`). It isn't an app setting.                                                                                                            |
| Unit coverage   | **100%** lines/branches/functions/statements over all TS **and** Svelte components (Vitest node + browser mode), enforced in CI.                                                                           |
| E2E             | The Playwright Test runner, with mobile and desktop projects.                                                                                                                                              |
| Auth            | None. Single user, and the home network is the trust boundary.                                                                                                                                             |
| Repo            | **Public** at `github.com/brianramseyau/home-work-hours-tracker`. The remote is created only after the PII hook exists, and only with the owner's confirmation.                                            |

## Domain rules

- **Financial year:** `FY27` = 2026-07-01 … 2027-06-30. The label is `FY` + the last two digits of the end year. The URL slug is `fy27`.
- **Week number:** `floor((mondayOf(date) − mondayOf(1 Jul)) / 7) + 1`.
- **Time block:** minutes = `end − start − break`, stored as **integer minutes**, with no floats for hours. The end must be after the start (no overnight blocks). The break must be ≥ 0 and less than the span.
- **Claim:** `round(totalHomeMinutes × rateCentsPerHour / 60)` cents, rounded once, at the end. The rate is integer cents per hour, per FY.
- **Day kinds:** `work | leave | sick | public_holiday | off`.
  - A `work` day's display type is derived: **Home** (blocks, no office), **Office** (no blocks), **Split** (blocks + office).
  - Only home blocks count toward the claim.
- **Source:** every day row has `source: prefill | manual | import`. Any edit sets `manual`. "Reset to schedule" goes back to `prefill`.
- **Automatic prefill** is `ensurePrefilled(db, today)`, called from the root `+layout.server.ts` load. It's idempotent and cheap.
  1. It materialises dates from `settings.prefilled_through + 1` through today. For each date:
     - A holiday (bundled or custom, not disabled) makes the day `public_holiday`.
     - Otherwise the schedule version in effect (the latest `effective_from` ≤ date) and the cycle week (`floor(daysSince(anchor_monday) / 7) mod cycle_weeks`) decide it: `home` gets one block with the standard hours, `office` gets the office id, and `off` gets no row.
     - Weekend dates are only considered when the schedule has a non-`off` mode for that weekday.
  2. It advances the watermark.
  - **Re-plan:** a schedule, standard-hours or holiday change that reaches back into the past re-plans the `prefill` rows from that date up to the watermark. `manual` and `import` rows are never touched.
  - **First run:** the watermark starts at the later of the current FY start and the first schedule's `effective_from`. An import commit raises the watermark to its last date, so there's no back-fill of historical gaps.
  - **Finalised FYs** are frozen.
  - **Future days** aren't stored. The current week shows upcoming scheduled days as uncounted ghost rows. Future leave is stored as `manual`.
- **Today** is the server's local date under `TZ`. Build it from local getters or `Intl.DateTimeFormat(...).formatToParts()`. **Never** use `toISOString().slice(0, 10)`. Loads pass `today` to the client.

## Data model (`src/lib/server/db/schema.ts`)

```text
settings            singleton: full_name?, holiday_region ('AU-VIC'),
                    standard_start '09:00', standard_end '17:06', standard_break_minutes 30,
                    include_weekends (bool, default false), prefilled_through (ISO date?)
financial_years     id, start_year UNIQUE (2026 ⇒ FY27), rate_cents_per_hour (70), rate_note?, finalised_at?
offices             id, name UNIQUE, address?, archived_at?
schedules           id, effective_from (ISO date), cycle_weeks (1|2), anchor_monday (ISO date)
schedule_days       id, schedule_id FK cascade, week_index (0|1), weekday (1–7), mode ('home'|'office'|'off'), office_id FK?
days                id, date UNIQUE (ISO), kind, office_id FK?, notes?, source, updated_at
home_blocks         id, day_id FK cascade, start 'HH:mm', end 'HH:mm', break_minutes, position
holidays            id, date, name, region, source ('bundled'|'custom'), repeats_yearly (bool), disabled (bool)
                    UNIQUE(date, region, name)
```

Totals, week numbers and display types are derived, never stored. A new FY copies the previous FY's rate.

## Architecture

**From ev-charging-log:**

- `db/index.ts`: the connection-level `PRAGMA foreign_keys=OFF` → `migrate()` → `foreign_key_check` → `ON` pattern, with the explanatory comment kept verbatim. Refactored into `createDb(path)` plus a thin singleton.
- `hooks.server.ts`, which imports the db so migrations run on boot.
- `drizzle.config.ts`, `.nvmrc` (24), `.npmrc` (`engine-strict`), `eslint.config.js`, the prettier config, and the vite runes-forcing and `__APP_VERSION__` define.
- The Dockerfile, entrypoint, GHCR workflow, Unraid XML and `generate-icons.mjs`.

**Layering:**

- `src/lib/core/*.ts` holds pure domain logic shared by client and server: `fy`, `time`, `schedule`, `prefill`, `totals`, `dayType`, `validation` (zod).
- `src/lib/server/*.ts` holds server-only logic: `holidays` (wraps `date-holidays`), `export` (exceljs builder), `import` (legacy parser), `clock` (today from `TZ`, plus `APP_FIXED_DATE` to pin "today" for E2E, which production never sets), `autoPrefill`.
- `src/lib/server/repo/*.ts` holds Drizzle queries that take `db` as a parameter, so they're injectable in tests.
- `src/routes/**/+page.server.ts` wires those layers into loads and form actions (`use:enhance`, zod-validated).
- `src/lib/branding.ts` holds `REPO_URL`, `APP_NAME` and `APP_SHORT_NAME`.

**Routes:**

```text
/                         → redirect to /<current fy>
/[fy]                     Diary (mobile week pager / desktop full-year table) + summary
/[fy]/day/[date]          Day editor deep link (normally a Drawer/Sheet via shallow routing)
/[fy]/year                Punch-card year overview + breakdowns
/[fy]/export              Export page;  GET /[fy]/export.xlsx streams the workbook
/years                    Financial years: create, rate, finalise
/settings                 General · Offices · Schedule · Holidays · Historical import (→ /import)
/import                   Upload legacy xlsx → review → commit
+error.svelte             Branded error / offline page
```

**Main nav:** Week, Year, Export, Settings. That's the mobile bottom tabs and the desktop rail. `/years` is reached from the FY switcher.

## Testing strategy

- **Vitest projects:**
  - `server` (node): `src/**/*.test.ts` and `scripts/pii/**/*.test.ts`, excluding `*.svelte.test.ts`.
  - `client` (browser mode, `@vitest/browser-playwright` + `vitest-browser-svelte`, Chromium): `src/**/*.svelte.test.ts`.
- **Coverage:** `@vitest/coverage-v8`, including `src/**/*.{ts,svelte}` and `scripts/pii/**`, with `thresholds: { 100: true }`.
- **Explicit exclusions (the only ones allowed):**
  - `src/lib/components/ui/**` (vendored shadcn-svelte primitives).
  - `**/*.d.ts`, `src/app.html`, `drizzle/**`, `scripts/**` except `scripts/pii/**`, config files, and the `@vite-pwa` service-worker glue.
  - Any addition must be justified in the phase doc and listed in AGENTS.md.
- **DB code** is tested against `createDb(':memory:')` with the real migrations, via `vi.mock('$lib/server/db')`.
- **Pages and components** are rendered in browser mode with fixture `data` props.
- **Fixtures** are synthetic only: John/Jane Doe, Office Location N, and workbooks generated inside the tests.
- **E2E** (`e2e/`, `@playwright/test`):
  - `webServer` = build + preview on a fresh `data/e2e.db`, with `APP_FIXED_DATE=2026-09-14` and `TZ=Australia/Melbourne`.
  - Projects `mobile` (Pixel 7) and `desktop` (Desktop Chrome), locale `en-GB`, timezone `Australia/Melbourne`.
  - `@axe-core/playwright` on the main pages in both colour schemes.
- **Scripts:** `test`, `test:unit`, `test:coverage`, `test:e2e`, and `verify` (= `lint && check && test:coverage && test:e2e`).
- **CI** `ci.yml` has two jobs:
  - `pii-scan`.
  - `verify`: `npm ci` → `npx playwright install --with-deps chromium` → `npm run verify`.

## Phase index

| #   | Doc                                                                                                        | Depends on | Summary                                                                                                              |
| --- | ---------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------- |
| 01  | [PLAN_01_PHASE_01_FOUNDATION_AND_SCAFFOLD.md](PLAN_01_PHASE_01_FOUNDATION_AND_SCAFFOLD.md)                 | —          | git, PII guard, SvelteKit + shadcn scaffold, tokens, branding, shell, db bootstrap, test and CI infra, AGENTS/CLAUDE |
| 02  | [PLAN_01_PHASE_02_DOMAIN_CORE_AND_DATA_MODEL.md](PLAN_01_PHASE_02_DOMAIN_CORE_AND_DATA_MODEL.md)           | 01         | Schema, pure core modules, holidays, clock, auto-prefill engine, repos                                               |
| 03  | [PLAN_01_PHASE_03_SETTINGS_YEARS_OFFICES_SCHEDULE.md](PLAN_01_PHASE_03_SETTINGS_YEARS_OFFICES_SCHEDULE.md) | 02         | Years, settings, offices, schedule editor, holidays UI                                                               |
| 04  | [PLAN_01_PHASE_04_DIARY_AND_AUTO_PREFILL.md](PLAN_01_PHASE_04_DIARY_AND_AUTO_PREFILL.md)                   | 02, 03     | Diary, day editor, auto-prefill wiring, leave ranges, year punch card                                                |
| 05  | [PLAN_01_PHASE_05_ACCOUNTANT_EXPORT.md](PLAN_01_PHASE_05_ACCOUNTANT_EXPORT.md)                             | 02         | Branded xlsx export                                                                                                  |
| 06  | [PLAN_01_PHASE_06_LEGACY_IMPORT.md](PLAN_01_PHASE_06_LEGACY_IMPORT.md)                                     | 02         | Legacy xlsx parser + review/commit                                                                                   |
| 07  | [PLAN_01_PHASE_07_DEPLOYMENT_PWA_AND_POLISH.md](PLAN_01_PHASE_07_DEPLOYMENT_PWA_AND_POLISH.md)             | all        | Docker/Unraid, PWA, seed, README, a11y and visual pass                                                               |

```text
01 ──▶ 02 ──┬──▶ 03 ──▶ 04 ──┐
            ├──▶ 05 ─────────┼──▶ 07
            └──▶ 06 ─────────┘
```

Phases 03, 05 and 06 can run as parallel agents once 02 has merged. Every phase ends with a green `npm run verify`, updated docs, a PII-checked diff and a commit on `main`.

## Verification (whole plan)

0. `node scripts/check-pii.mjs --all` is clean, and `git ls-files | grep -E '\.(xlsx|db)$|^data/|^\.env$'` is empty.
1. `npm run verify` is green.
2. Manual walkthrough: create FY27 → set the schedule → days auto-fill → override a day → export, then open the xlsx in Excel/Numbers.
3. Import the real historical spreadsheets **locally only** and confirm the totals match each sheet's `G2`/`H2`.
4. Screenshots at 390px and 1440px in both themes, reviewed against DESIGN.md.
5. `docker build` + `docker run -e TZ=Australia/Melbourne …`, then a smoke test.

## Open items

- The logo motif and final colour contrast values get validated with screenshots (P01/P07).

## Resolved items

- **AU-VIC regional holidays (P02):** `date-holidays` covers both Melbourne Cup and AFL Grand
  Final Friday as `type: 'public'` rows, so no custom holiday is needed for AU-VIC by default.
  See PLAN_01_PHASE_02's "Holiday coverage findings".
