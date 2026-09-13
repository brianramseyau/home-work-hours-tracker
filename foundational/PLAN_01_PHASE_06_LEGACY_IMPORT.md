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

- [ ] 100% coverage. `verify` is green.
- [ ] **Manual, local only, never committed:** the owner imports each historical sheet, and the app's totals match each sheet's `G2`/`H2`. Any parser fixes are covered by a new synthetic fixture.
