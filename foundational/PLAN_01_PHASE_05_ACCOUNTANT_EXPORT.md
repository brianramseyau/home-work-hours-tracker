# PLAN_01 · Phase 05 — Accountant export

**Goal:** one click produces a polished, auditable `.xlsx` that an accountant can check and file, branded with the logo and a link to the GitHub repository.

**Depends on:** Phase 02. **Runs in parallel with:** Phases 03 and 06.

## Builder: `src/lib/server/export.ts`

`buildWorkbook({ fy, settings, days, offices, holidays, generatedAt }) → Promise<Buffer>` uses exceljs, builds the workbook from scratch with no template file, and is a pure function of its inputs.

### Sheet 1: "Summary"

1. **Title band.** Rows 1–3 are merged across and filled with ink. The logo (`static/brand/logo-lockup.png`) is placed with `addImage`. The title reads "Home work diary FY27", the subtitle "1 Jul 2026 – 30 Jun 2027", and then the name (`settings.full_name`, or "Name not set").
2. **Key figures**, as label/value pairs:
   - Method: "ATO fixed rate method".
   - Rate: `$0.70 per hour`, with the `rate_note`.
   - Total hours worked from home: a formula referencing the Diary total.
   - Claim: `=ROUND(total_hours * rate, 2)`, formatted as currency.
   - Days worked from home (fully or partly), plus counts of office, leave, sick and public holiday days.
3. **Monthly breakdown:** Jul → Jun. The hours column is `SUMIFS(Diary!Hours, Diary!Month, month)`, the claim column is `ROUND(hours * rate, 2)`, and the hours column carries **amber data bars** (conditional formatting `dataBar`, lamp colour).
4. **Method note:** the fixed-rate explanation in plain words, and a note that the hours are from the diary's time records.
5. **Footer:** a merged, hyperlinked row: "Prepared with Home Work Hours Tracker — https://github.com/brianramseyau/home-work-hours-tracker" (`REPO_URL`), in small italic ink-muted text, followed by a "Generated {date}" line.

### Sheet 2: "Diary"

- **Columns:** Week, Date, Day, Type, Office, Start, End, Break (min), Hours, Notes, and a hidden helper Month (`YYYY-MM`).
- **Rows:**
  - One row per home block. A Split day's second block is indented, with the date repeated in muted text.
  - Non-home days are included, with blank times, for a complete audit trail.
  - Weekends are included only if `include_weekends` is on or they have data.
- **Formulas:** Hours is `=IF(F="","",ROUND((G-F)*24 - H/60, 2))`. Start and End are written as Excel time values (fractions of a day) with an `hh:mm` format. The totals row is `=SUM(I:I)` over the data range.
- **Styling:**
  - Header row: ink fill and white bold text.
  - Row tints per day type (light versions of the DESIGN.md palette).
  - A thicker bottom border after the last day of each week.
  - Frozen header row and first two columns. Autofilter on.
- **Footer:** the same hyperlinked footer row.

### Workbook-wide

- **Properties:** `creator` / `lastModifiedBy` = "Home Work Hours Tracker", `company` blank, `created` = `generatedAt`.
- **Print setup** on both sheets: A4, Summary portrait and Diary landscape, fit to one page wide, repeated Diary header row, and a print footer (`oddFooter`) of `&L{APP_NAME} — {REPO_URL}&RPage &P of &N`.

## Route and page

- `/[fy]/export/+page.svelte`:
  - An in-app preview of the Summary (the same figures, the palette, the month bars).
  - A primary "Download spreadsheet" button, and a short line saying what's included.
  - A warning if the name isn't set, linking to Settings.
  - A warning if the FY isn't finalised ("You can still edit this year").
- `/[fy]/export.xlsx/+server.ts`:
  - `GET` loads the data through the repos and calls `buildWorkbook`.
  - It responds with `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` and `Content-Disposition: attachment; filename="FY27-home-work-diary.xlsx"`.
  - An unknown FY returns 404.

## Tests

- The unit tests re-load the Buffer with exceljs and assert:
  - The sheet names, title text, frozen panes and autofilter.
  - The formulas exactly, and the cached result values.
  - The hyperlink target equals `REPO_URL` on both sheets.
  - The image is present.
  - The fills per day type.
  - The data-bar rule.
  - The print footer.
  - The Summary claim equals `core/totals.claimCents / 100`.
- Edge cases: an empty FY, a Split day, weekend data with weekends off, an unset name, and archived offices.
- Server tests for the route: a 200 with the headers, and a 404.
- Browser-mode tests for the export page.
- **E2E:** click Download, save the file, parse it with exceljs, and assert the totals match the Diary page.
- Fixtures: John Doe, Office Location 1/2, synthetic hours.

## Acceptance criteria

- [x] 100% coverage. `verify` is green.
- [ ] Opened manually in Excel and in Numbers or LibreOffice: the formulas recalculate, the link is clickable, the logo renders, and the print preview fits. (Not run by the agent — no Excel/Numbers/LibreOffice available in this environment. The generated workbook was re-parsed with exceljs and spot-checked instead: sheet order, formulas, cached results, the hyperlink, the embedded image and the data-bar rule all round-trip correctly. The owner should still open a real download once in a spreadsheet app before relying on it.)
- [x] Screenshot of the export page at both viewports and in both themes.

## Notes and deviations

- **Download route is `/[fy]/export/download`, not `/[fy]/export.xlsx`.** A literal `export.xlsx` path segment matches the repo-wide `*.xlsx` rule in `.gitignore` (AGENTS.md §1's guard against ever committing a real spreadsheet), so `git` silently ignored the route file under that name. The served filename is unaffected — `Content-Disposition` still names the download `FY27-home-work-diary.xlsx`; only the URL path changed.
- **Logo image is the existing `static/brand/logo-mark-light.png` mark**, not a `logo-lockup.png`. Phase 01 never produced a lockup asset (only `logo-mark.svg`, `favicon-glyph.svg` and `lamp-off.svg` exist under `src/lib/assets/`, plus the one PNG under `static/brand/`), so the title band uses the mark alone rather than blocking this phase on new asset creation. The workbook title and subtitle text next to it already carry the wordmark's job.
- **Monthly `SUMIFS` formulas match against a hidden helper column D** (the "YYYY-MM" key) on the Summary sheet, since the visible month label ("Jul 2026") doesn't equal the Diary's own hidden Month column value and SUMIFS needs an exact match.
- Every formula cell also carries a **pre-computed cached result** (not left for the spreadsheet app to calculate on first open), computed directly from the same `days` data the formulas reference, so the workbook shows correct figures immediately and the unit/E2E tests can assert on real numbers without a spreadsheet engine.
