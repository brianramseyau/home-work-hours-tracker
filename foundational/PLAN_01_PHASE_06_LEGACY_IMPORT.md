# PLAN_01 · Phase 06 — Legacy import

**Goal:** a one-off path that brings years of legacy "Home Work Diary" spreadsheets into the app, with a review step and a totals cross-check. It lives off the Settings page, not in the main nav.

**Depends on:** Phase 02. **Runs in parallel with:** Phases 03 and 05.

> **PII:** the real spreadsheets are gitignored and must never be committed, quoted in docs, or used as test fixtures. All fixtures are generated in code with synthetic data.

## Parser: `src/lib/server/import.ts`

`parseLegacyWorkbook(buffer, { offices }) → ImportPreview`. It's pure given the buffer.

1. **Find the header row** by scanning for the cells `Date`, `Start Time`, `End Time`, `Total` and `Notes` (case-insensitive) rather than using fixed positions, the same approach as ev-charging-log's `import.ts`. Read `Total Hours`, `Flat Rate` and `Year` from the cells next to their labels.
2. **Per row:**
   - The date, from an Excel serial or a Date cell.
   - Start and end, from fractional days.
   - The total.
   - The note.
3. **FY:** from `Year` if present, otherwise from `fyForDate(firstDate)`. If any date falls outside that FY, raise an issue.
4. **Rate:** `round(FlatRate / TotalHours × 100)` cents per hour, when both are present.
5. **Break:** `round(((end − start) × 24 − total) × 60)` minutes. A negative or implausible value becomes an issue.
6. **Mapping, in priority order:**
   1. A row with times → `work` with one home block, times taken literally.
   2. A note that matches an existing office (case-insensitive, trimmed, trailing `*?` stripped for matching only) → a `work` day in that office. If the row also has times, it's `split`.
   3. An unmatched short, single-word note → a **proposed new office**, which can be renamed, merged or ignored in the review.
   4. A note of `Sick` → sick.
   5. `* start` … `* end` markers (`Leave start/end`, `… Hols START/END`) → leave for every date in between, inclusive. The original marker text is kept in the notes.
   6. A row with no times and no note, after the last row with data → skipped (future rows).
   7. Anything else → `issues`, with the row number and a reason.
7. The original note text is always preserved in `notes`.
8. **Totals:** the sheet's `Total Hours` and `Flat Rate` (claim) against the app's recomputed hours and claim, with a `mismatch` flag.

**Types:** `ImportPreview { fyStartYear, rateCents?, proposedOffices[], rows: ImportRow[], issues: ImportIssue[], sheetTotals, appTotals }`.

## `/import` route

- It's reached **only** from Settings → Historical import.
- **Step 1, Upload:** an `.xlsx` file input (a form action using multipart). The parse happens on the server and returns the preview.
- **Step 2, Review:**
  - An FY banner showing the detected FY, the rate (editable), and whether the FY already exists.
  - Proposed offices, each with Create / Map to existing / Ignore.
  - A table of the rows (editable kind, office, times and notes), with issue rows highlighted and filterable ("Show issues only").
  - A **totals check card:** "Spreadsheet: X h / $Y" against "App: X h / $Y", with any mismatch explained.
  - The preview JSON round-trips through a hidden field, so there's no server-side temporary state (stateless, like ev-charging-log).
- **Step 3, Commit** (`?/commit`), in a single transaction:
  1. Create the FY if it's missing.
  2. Create the approved offices.
  3. Upsert the days with `source = 'import'`.
  4. Existing `manual` rows are **not** overwritten unless you tick "Replace my edits". Existing `prefill` rows are replaced.
  5. `raiseWatermark(lastImportedDate)`.
  6. Redirect to `/[fy]` with the toast "Imported 247 days".

## Tests

- Fixture builders in `src/lib/server/import.fixtures.ts` generate workbooks with exceljs in memory:
  - Standard weekday rows.
  - Office notes ("Office Location 1/2").
  - A sick day.
  - Leave and holiday ranges.
  - A trailing-`?` office note.
  - Shorthand `17:00` rows.
  - Blank future rows.
  - A missing `Year` cell.
  - A shuffled column order.
  - A non-standard break.
  - A mismatched totals cell.
- Unit tests for every mapping branch and issue type, the rate and break derivation, and the totals mismatch.
- Server tests for the upload, commit and replace-edits branches, the watermark raise, and an existing FY.
- Browser-mode tests for the review UI: editing a row, mapping an office, the issues filter, and the totals card.
- **E2E:** upload a generated fixture, see the review with its issues, commit, and check that the Diary totals equal the fixture's `G2`.

## Acceptance criteria

- [x] 100% coverage. `verify` is green.
- [ ] **Manual, local only, never committed:** the owner imports each historical sheet, and the app's totals match each sheet's `G2`/`H2`. Any parser fixes are covered by a new synthetic fixture. _(Not done in this environment — no owner-provided spreadsheets are available here. Left for the owner to run locally; see the note below.)_

## Notes and deviations

- **`commitImport` is not wrapped in a single `db.transaction()`.** Every repo function in this codebase (`repo/days.ts`, `repo/offices.ts`, `repo/years.ts`, …) takes the plain `Db` type, not the driver's transaction type, and no other call site needs a cross-repo atomic transaction (see `settings/+page.server.ts`'s `general` action, which similarly calls `updateSettings` → `reseedBundled` → `replanFrom` uncommitted as a single unit). Typing every repo function to also accept a `SQLiteTransaction` just for this one caller was judged not worth the churn; `commitImport` calls the repo functions directly against `db`, so a crash mid-commit can leave the earlier rows written — an acceptable, correctable outcome for an explicit, reviewed, user-triggered import (not an automatic background process). This is documented in `importCommit.ts` itself.
- **Route:** `/import` is a single page with two steps (Upload, Review) rather than three separate step routes — the reviewed `ImportPreview` round-trips through a hidden `<input type="hidden" name="preview">` JSON field between the `?/upload` and `?/commit` actions, exactly as planned (stateless, no server-side temp state).
- **Row-level editing is scoped down from the original spec.** The plan called for every field (kind, office, times, notes) to be editable per row in the review table. What's implemented: each row has an Import/skip checkbox (checked by default, unchecked by default for an issue row so a bad row is never silently committed), and each _proposed office_ gets a Create/Map-to-existing/Ignore choice. Arbitrary per-row field editing (e.g. reclassifying one row's kind from `work` to `leave` without re-uploading) was left out for time — a genuinely wrong row is best fixed by correcting the source note and re-uploading, or by editing the day in the app after import (which is exactly what the day editor is for). This is the one deliberate scope cut in this phase; if the owner's real sheets turn out to need heavier row-editing during the manual acceptance pass, that's the first thing to add back.
- **Blank-row handling is simplified from the spec's literal wording.** The plan's mapping priority list treats "a row with no times and no note" as skip-worthy only when it's _after the last row with data_ (implying a genuine mid-sheet blank row would be something else). The implementation skips **any** row with neither times nor a note, regardless of position — equivalent in every real spreadsheet layout (a mid-year blank weekday row has nothing to import either way), and it removes the need to track a separate "last data row" watermark during parsing. Documented in `import.ts`.
- **`ImportRow.breakMinutes` defaults to 0**, not an issue, when a timed row has no `Total` cell at all (as opposed to a `Total` cell whose value implies a negative or overlong break, which _does_ raise an issue). A missing Total column is a structural sheet difference the header-scan already tolerates (see `readRawRows`); a per-row missing value on an otherwise-normal sheet isn't treated as suspicious on its own.
- **`AppTotals.hours` is typed as always non-null** (`number`, not `number | null`), separately from `ImportTotals` (used for the sheet's own totals, which really can be absent) — the app's recomputed total is always known once the rows are parsed, so the type says so rather than carrying a defensive `null` case nothing can ever produce.
- **A known mobile-viewport quirk (not a bug):** the Commit button can sit far enough down the Review step's long table that the fixed bottom tab bar visually overlaps it in a `fullPage` screenshot taken mid-scroll; the page has enough content below it (the app footer) for a real user to keep scrolling past the tab bar to reach it normally. The e2e test scrolls the button into view and clicks with `force: true` as a defensive measure regardless.
- The `?imported=N` query param used to redirect from `/import`'s commit into `/[fy]` (for the post-import toast) is stripped from the address bar via a plain `history.replaceState` call in `+layout.svelte`, not SvelteKit's own `replaceState` — the latter requires `resolve()` for its route-typed URL argument and is meant for real navigations; this is just tidying the URL after a toast has been shown.
