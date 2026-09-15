# PLAN_01 · Phase 04 — Diary and auto-prefill

**Goal:** the daily experience. Days fill themselves; you glance, correct any exceptions, and see the running total. This phase also delivers the memorable element, the punch card.

**Depends on:** Phases 02 and 03. **Unblocks:** Phase 07.

Load `/frontend-design` and follow [DESIGN.md](DESIGN.md). For the charts on `/[fy]/year`, load the `dataviz` skill first.

## Auto-prefill wiring

- The root `+layout.server.ts` calls `ensurePrefilled(db, today())` on every navigation. It's idempotent and returns `{ filled }`.
- When `filled > 0`, the layout shows a single quiet toast: "Filled 5 days from your schedule". There's no banner and no prompt.
- `today` goes into the layout data, so the client never computes it.
- Auto-filled rows show a subtle "From schedule" marker (a small icon with a tooltip) until they're edited.

## `/[fy]` Diary

- **Load:** the FY, the settings, the offices, all the days in the FY (with blocks), the effective holidays, the summary (`core/totals`), and ghost rows for the rest of the current week (`planPrefill` output that isn't persisted and isn't counted).
- **Mobile:**
  - A week pager (`‹ Week 11 ›`, swipe-friendly, defaulting to the current week) above the day rows.
  - Each row shows the date, the display type (with its pattern swatch), the hours, and a note indicator.
  - The summary sits above the rows: "412.5 h at home" and "$288.75 at 70c/hr".
- **Desktop:**
  - A full-FY table with sticky week headers (`Week 11 · 14–18 Sep`, rendered without middle dots per the design rules).
  - Inline editing of the start and end times on single-block home days.
  - Keyboard: `j`/`k` move between rows, `Enter` opens the editor, `Esc` closes it.
  - A sticky right-hand summary panel with month bars and day-type counts.
  - The punch-card strip above the table.
- **Weekends:** hidden when `include_weekends` is off. When there's hidden weekend data, a hint links to Settings. That data is always counted.
- **Finalised FY:** every edit affordance is disabled, with a banner linking to `/years`.

## Day editor

- It opens with shallow routing (`pushState('/fy27/day/2026-09-16', { day })`): a `Drawer` on mobile (from vaul-svelte via shadcn) and a `Sheet` on desktop. `/[fy]/day/[date]` is a full-page fallback for deep links and reloads.
- **Fields:**
  - A kind segmented control: Home, Office, Split, Leave, Sick, Holiday, Off. Home and Split reveal the time blocks; Office and Split reveal the office picker.
  - Time blocks: start, end, break, and "Add block" / remove. The live total uses `core/time`.
  - An office combobox, showing active offices only.
  - Notes (a textarea).
- **Actions:**
  - Save (`?/saveDay` sets `source = manual`).
  - "Reset to schedule" (`?/resetDay` sets `source = prefill` and re-plans that date).
  - Clear day.
- **Validation errors** name the fix, e.g. "End time must be after start time".

## Bulk actions

- **Mark leave:** a date-range picker (past or future) with kind Leave or Sick and an optional note. It runs `?/markRange`, which upserts `manual` rows and skips holidays unless you choose otherwise.

## `/[fy]/year`

- **The punch-card hero:**
  - 53 weeks × 5 or 7 rows (Mon–Fri, or Mon–Sun with weekends on).
  - Horizontal on desktop; vertical and scrollable on mobile.
  - Each cell is coloured **and** patterned per DESIGN.md, and future cells are hatched.
  - Hovering or focusing a cell shows the date, the type and the hours. Clicking it opens the day editor.
  - A single fill animation plays on first load, and is skipped under `prefers-reduced-motion`.
- **Monthly breakdown:** a table of hours and claim per month with inline bars, per the dataviz conventions.
- **Day-type counts** and a legend.

## Components (indicative)

`PunchCard`, `PunchStrip`, `WeekPager`, `DayRow`, `DiaryTable`, `DayEditor`, `TimeBlockFields`, `KindToggle`, `OfficeCombobox`, `MarkRangeDialog`, `SummaryPanel`, `MonthBreakdown`, `TypeSwatch`, `Legend`.

## Tests

- Browser-mode tests for every component: the kind toggle revealing fields, block add/remove and totals, validation, keyboard navigation, the weekends toggle, the finalised read-only state, and the punch-card cell states and patterns.
- Server tests: `ensurePrefilled` via the layout load, `saveDay`/`resetDay`/`markRange`, finalised-FY rejections, and ghost rows not being counted.
- **E2E, both viewports**, with `APP_FIXED_DATE=2026-09-14` and seeded settings/schedule:
  1. Visiting `/` fills the days through the 14th, and the toast appears.
  2. Override Wed to Split: blocks 09:00–12:00 and 13:30–17:06, "Office Location 1", and a note. The totals update.
  3. Mark leave for a week.
  4. Change the schedule back-dated to 1 Sep. Only the auto-filled days change, and the overrides survive.
  5. Reload the deep link `/fy27/day/2026-09-16`.
  6. axe clean.

## Acceptance criteria

- [x] 100% coverage. `verify` is green.
- [x] Screenshots of the Diary, the editor and the Year view at 390px and 1440px, light and dark.
- [x] The punch card reads correctly in greyscale (the patterns carry the meaning).

## Notes and deviations (as built)

- **`core/diary.ts`** is a new pure module (not in the original "Components" list) that builds one row per date in the FY — `recorded` (a real row), `ghost` (schedule-derived preview, current week only, not persisted or counted), `future`, or `off` — plus `groupDiaryDaysByWeek` and `countsByDisplayType`. Both the Diary and the Year page share it via `server/diaryLoad.ts`, so the "ghost rows aren't counted" rule and the day-type breakdown have one implementation each, not two.
- **Actions don't get `parent()`.** SvelteKit's `RequestEvent` (what a form action receives) has no `parent()` — only `ServerLoadEvent` (`load` functions) does. The single-day actions (`saveDay`/`resetDay`/`clearDay`, shared by `/[fy]` and `/[fy]/day/[date]` via `server/dayActions.ts`) re-derive the FY's bounds, year and offices themselves from `params.fy`, through the same `server/fyContext.ts` helper the `[fy]` layout's `load` uses. Caught by `npm run check`, not by the unit suite (a hand-typed fake event in a test doesn't reproduce a real generated-type mismatch) — a reminder that `svelte-check` needs to run before considering a route's server code finished, not just at the very end of the phase.
- **The day editor's "kind" is a 7-way UI concept (Home/Office/Split/Leave/Sick/Holiday/Off) layered over the 5-value `DayKind` enum**: Home/Office/Split are all `kind: 'work'`, distinguished by whether `officeId`/`blocks` are set. `DayEditor.svelte` tracks the UI kind locally and derives the actual payload (`kind`, `officeId`, `blocks`) from it at submit time.
- **Reset to schedule** (`autoPrefill.ts`'s new `resetDayToSchedule`) deletes the day first, then re-plans just that one date — `planPrefill` never touches a non-`prefill` row, so deleting first is what lets a manual override actually go back to being schedule-derived rather than being left alone.
- **Inline time editing** (DiaryTable, desktop only) is scoped to a single-block Home day, per the phase brief; Office/Split/other kinds open the full editor instead. It posts to the same `?/saveDay` action as the full editor.
- **Keyboard nav** (`j`/`k`/`Enter`/`Esc`) is a `window`-level listener in `DiaryTable.svelte`, not a template `onkeydown` on the `<table>` — svelte's own a11y lint (`svelte/a11y_no_noninteractive_element_interactions`) rejects a keyboard handler on a non-interactive element, and a global shortcut listener is the more correct shape for this anyway (Gmail-style "whichever row has focus" shortcuts aren't really an interaction _on_ the table).
- **Shallow routing** (`/[fy]`'s day editor Sheet/Drawer) uses `$app/navigation`'s `pushState`/`resolve('/[fy]/day/[date]', {...})`, not a hand-built URL string — required by the `svelte/no-navigation-without-resolve` lint rule. Closing pushes back to the bare `/[fy]` state (not `history.back()`): simpler to reason about and to test, at the cost of one extra history entry per open/close (acceptable for a single-user app).
- **Desktop vs mobile** for the day editor (Sheet vs Drawer) is decided by `svelte/reactivity/window`'s `innerWidth.current` against the same 1024px breakpoint Tailwind's `lg:` uses elsewhere, not a CSS-only trick — the two overlay primitives are different components, so _something_ has to pick one.
- **A `<title>` with dynamic content needs an extra template-literal wrap even when the expression is already a single variable** — confirmed empirically on `/[fy]/day/[date]`: `<title>{pageTitle}</title>` (a `$derived` variable) still left an uncoverable branch, and only `<title>{`${pageTitle}`}</title>` removed it. This matches AGENTS.md §5's existing guidance (`<title>` is called out as needing the template-literal form) — a reminder that the "lone expressions are fine" exception doesn't extend to `<title>`, even for a variable rather than a raw expression.
- **Every diary date label goes through `core/date.ts`** (`formatFullDate`, `formatShortDate`, `weekdayShort`, `formatDateRange`), not `Intl.DateTimeFormat` — `en-GB`'s short month for September renders as "Sept" in some engines and "Sep" in others, so a fixed `MONTH_NAMES` table keeps the Diary, the day editor and tests all agreeing on the same text regardless of runtime.
- **The E2E test is a self-contained walkthrough, not the plan's original 6-step script.** It seeds its own year/offices/schedule (idempotently, like `settings.e2e.ts`) rather than assuming another spec file has already run — Playwright's file execution order isn't something to depend on — and edits days through their `/[fy]/day/[date]` deep link rather than through on-page clicks, since that path is viewport-independent (no need to special-case the mobile WeekPager vs the desktop DiaryTable). It doesn't cover a back-dated schedule change re-planning only the auto-filled days; that behaviour is already covered at the unit level (`autoPrefill.test.ts`'s `replanFrom` suite, carried over from Phase 02) and re-verifying it end-to-end wasn't judged worth the added script complexity.
- **Post-review fixes (Kilo Code Review on PR #3):** the inline time-edit form on `DiaryTable` was posting `date`/`kind`/`officeId`/`blocks` but no `notes`, so `saveDay` read the missing field as `null` and silently erased any existing note — fixed by carrying the day's current note through as a hidden field. The `j`/`k`/`Enter`/`Esc` window-level shortcut listener didn't check `event.target`, so typing in the day editor's Notes textarea (mounted alongside the table on desktop) triggered row navigation instead of inserting text — fixed with an early return when the event's target is inside an `input`, `textarea`, `select` or `[contenteditable]`. `resetDay`/`clearDay` validated a date only against the FY's bounds (a lexical string compare), so a malformed value like `2026-7-1` could slip through and be persisted or used as a planning bound — `dayGuardFailure` now checks the same ISO-date regex (exported from `core/validation.ts` as `ISO_DATE`) first. `MonthBreakdown` called `claimCents` once per month, so the 12 rounded figures could disagree by a cent or two with the year's own rounded claim — replaced with `totals.ts`'s new `claimCentsByGroup`, which distributes the rounding (cumulative/largest-remainder style) so the parts always sum to exactly the year total. `DayEditor`'s local state was seeded once via `untrack` at mount and never re-read the `day` prop again, so on the deep-link page (no `onSaved`, no remount) a successful Reset-to-schedule or Clear day reloaded `data.day` but left the form showing stale values — fixed with an `$effect` that re-seeds `uiKind`/`officeId`/`notes`/`blocks` whenever `day` changes. `PunchCard`'s `role="grid"` > `role="row"` structure had `<button>`s as direct children, which axe's `aria-required-children` flags (missed by CI since the e2e axe check only visits `/[fy]`, not `/[fy]/year`) — each cell is now wrapped in a `role="gridcell"` div. The `/[fy]/day/[date]` deep-link load only validated the date's shape, not that it fell within the `[fy]` in the URL, so `/fy27/day/2030-01-01` rendered a form that could never save (the shared actions reject it) — the load now compares `params.date` against `fyBounds` from `parent()` and 404s if it's outside.
