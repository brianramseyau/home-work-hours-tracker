# PLAN_01 · Phase 03 — Settings, financial years, offices, schedule

**Goal:** every piece of configuration the auto-prefill engine needs is editable in the UI, and every change that touches past dates triggers a re-plan.

**Depends on:** Phase 02. **Runs in parallel with:** Phases 05 and 06. **Unblocks:** Phase 04.

Load `/frontend-design` and follow [DESIGN.md](DESIGN.md) before building any UI.

## Routes and components

### `/years`

- A list of FYs (label, date range, rate, total hours so far, a finalised badge).
- **Create FY:**
  - The start year defaults to the next missing year.
  - The rate is copied from the previous FY, with 70 c/hr as the fallback.
  - The rate note is optional ("ATO fixed rate method").
- **Edit:** the rate (entered as dollars `0.70`, stored as cents) and the note.
- **Finalise / Unfinalise**, with a confirmation dialog explaining that finalised years are read-only.
- The FY switcher in the shell lists these years and links to "Manage years".

### `/settings` (tabs; each tab is its own form with its own action)

**General:**

- Name (optional; shown on the export).
- Holiday region (a select of AU states and territories).
- Standard start, end and break, with a live "= 7.6 h per day" preview computed by `core/time`.
- The **"Include weekends"** switch, default off.

**Offices:**

- A list of offices with add, rename, and set an optional address.
- Archive and unarchive. Archived offices are hidden from pickers but kept on existing days.
- Unlimited count. The empty state says "Add the places you work from when you're not at home".

**Schedule:**

- The schedule versions, listed newest first, with their `effective_from` dates.
- The editor:
  - Cycle length is a toggle between "Every week" and "Alternating fortnight".
  - The grid has rows for week A (and week B) and columns Mon–Fri, with Sat/Sun only when "Include weekends" is on.
  - Each cell is a segmented control: Home / Office (then an office picker) / Off.
  - The anchor is set with "The week of {date} is week A".
- Saving a version whose `effective_from` is in the past calls `replanFrom(effective_from)`, and a toast reports how many days changed.

**Holidays:**

- An FY picker, then a list of the effective holidays: date, name, and a bundled/custom badge.
- A bundled holiday can be disabled and re-enabled. A custom holiday can be edited or deleted.
- **Add holiday:** date, name, and "Repeats every year".
- Any change on a past date calls `replanFrom(date)`. Changing the region re-seeds the `bundled` rows, keeps the custom ones, and re-plans from the current FY start.

**Historical import:**

- A section at the bottom of the page: a short explanation and an outlined "Import a spreadsheet" button linking to `/import`, the same pattern as ev-charging-log's Settings page. The route itself lands in Phase 06; until then the link can be feature-flagged off.

Standard-hours changes call `replanFrom(current FY start)`. Only `prefill` rows change.

## Server

- Each tab has a `+page.server.ts` action: `?/general`, `?/office`, `?/archiveOffice`, `?/schedule`, `?/deleteSchedule`, `?/holiday`, `?/toggleHoliday`, `?/deleteHoliday`, `?/region`.
- Validation uses `core/validation` zod schemas, and field errors are returned with `fail(400, …)`.
- Actions are progressively enhanced with `use:enhance`, and each success shows a sonner toast whose wording matches the button ("Save schedule" gives "Schedule saved").

## Tests

- Browser-mode tests for every component and page: form states, validation errors, the weekends toggle changing the grid columns, and archived offices hidden from pickers.
- Server tests on the in-memory db for every load and action, including the re-plan side effects (`manual` rows untouched).
- **E2E, both viewports:**
  1. Create FY27 at 0.70.
  2. Set 09:00–17:06 with a 30 min break, and see 7.6 h.
  3. Add "Office Location 1" and "Office Location 2".
  4. Build an alternating-fortnight schedule.
  5. Add a custom holiday.
  6. Toggle weekends and see the Sat/Sun columns appear.
  7. axe clean.

## Acceptance criteria

- [x] 100% coverage. `verify` is green.
- [x] Screenshots of every tab at 390px and 1440px, light and dark.
- [x] Synthetic names only in tests and screenshots.

## Notes and deviations (as built)

- **`/years`** shipped as part of this phase too (the plan lists it under Phase 03's "Routes and
  components"). Create has no input fields at all — the start year is always "the next missing
  one" and the rate always copies forward (or falls back to 70c/hr), so there's nothing for the
  user to fill in; rate/note become editable afterwards via "Edit rate".
- **Action names deviate from the plan's suggested list** (`?/general`, `?/office`,
  `?/archiveOffice`, `?/schedule`, `?/deleteSchedule`, `?/holiday`, `?/toggleHoliday`,
  `?/deleteHoliday`, `?/region`). Built instead: `general` (region is one of its fields, not a
  separate `?/region` action — one settings row, one form), `officeCreate`/`officeUpdate` split
  instead of one overloaded `?/office`, `officeArchive`/`officeUnarchive`, `schedule`,
  `deleteSchedule`, `holidayCreate`, `holidayToggle`, `holidayDelete`.
- **The schedule editor's per-day office picker is a `ToggleGroup`, not a `<select>` or bits-ui's
  `Select`.** See AGENTS.md §5 ("For a dynamic single-pick control...") — a native
  `<option value={expr}>` in a `{#each}` carries an unreachable coverage branch with no fix, and
  bits-ui's `Select` threw and tore down sibling markup inside the browser-mode test harness on
  first open. `ToggleGroup` has neither problem and matches the Home/Office/Off control right
  above it.
- **Real bug caught by the end-to-end test, not by unit tests:** SvelteKit's default
  `use:enhance` calls `form.reset()` after a successful submit, which silently blanked
  `GeneralTab`'s bound time/number inputs (and would have done the same to
  `ScheduleEditor`'s effective-from/cycle-length) back to empty rather than leaving the
  just-saved values showing. Fixed with `onreset={(e) => e.preventDefault()}` on both forms —
  synchronous and unit-tested (dispatch a `reset` event, assert the field is untouched), so it
  didn't reintroduce the untestable-async-callback problem the `YearRow.svelte` forms were
  deliberately built to avoid in this same phase.
- **Two real accessibility findings from the end-to-end axe check, both fixed:** the inactive
  tab-trigger text (`text-foreground/60`, the shadcn default) fell short of WCAG AA contrast
  against this app's `--muted` tab-list background — fixed by overriding to
  `text-muted-foreground` at the call site, not by editing the vendored component. And
  `ScheduleTab`'s two `<h3>`s skipped a heading level under the page's `<h1>` — changed to
  `<h2>`, matching "Historical import"'s existing `<h2>`.
- **Toasts on action success** (the plan's "each success shows a sonner toast whose wording
  matches the button") weren't built this phase — deferred, tracked as a gap for a future polish
  pass rather than Phase 04+ scope creep now.
- **Holiday tab's FY navigation** is prev/next only (no jump-to-year picker), matching what the
  page actually needs for now; `/years` already lists every year for a direct jump if one is
  ever wanted there.
- **PR #2's Kilo review round, fixed post-merge-checklist, pre-merge:**
  - **Critical:** `/settings`' `load` reseeded bundled holidays for the whole region on every
    view, deleting every other FY's bundled rows and resetting any bundled holiday's `disabled`
    flag. `replaceBundledHolidays` now takes the FY's `startYear` and scopes its delete/insert to
    that FY's date range, carrying a matched row's `disabled` flag across the reseed.
  - Duplicate office names, schedule effective-from dates and custom holidays threw an uncaught
    UNIQUE constraint error (a 500) instead of a field error — `officeCreate`/`officeUpdate`/
    `schedule`/`holidayCreate` now catch it via a new `isUniqueConstraintError` helper
    (`$lib/server/db/errors.ts`) and return `fail(400, …)`, re-throwing anything else.
  - `Number('')` is `0`, not `NaN`: a blanked rate or standard-break field silently saved as
    zero. Both `parseDollarsToCents` (`/years`) and the new `parseNumberField` (`core/validation`,
    used by `/settings`' `general` action) now reject a blank/whitespace string before conversion.
  - `updateRate` had no `finalisedAt` guard, so a finalised year's rate could still be changed —
    now checked and rejected with a field error.
  - `OfficeRow` and `YearRow`'s edit forms closed on click regardless of the server's response,
    silently discarding a validation failure. Both now close only from the actual `use:enhance`
    result (`$app/state`'s `page.form`, scoped per row by id/startYear since it's shared page-wide)
    and show the failure inline instead.
  - The same "results never surfaced" gap applied to `GeneralTab`, `OfficesTab`, `ScheduleEditor`
    and `HolidaysTab`'s add-forms — each now renders `page.form`'s first field error via a new
    `firstFieldError` helper (`core/validation`). A reactive `$app/state` test stub
    (`$lib/test-utils/pageFormStub.svelte.ts`, excluded from coverage) drives this in component
    tests without a real server round trip.
  - `ScheduleEditor`'s cycle-length `ToggleGroup` used `bind:value`, so re-clicking the active
    option (a bits-ui deselect) could blank `cycleWeeks`; switched to `onValueChange` with the
    same deselect guard already used by the mode/office groups.
  - An empty `standardBreakMinutes` binds to `null`, not `0` — `GeneralTab`'s preview and its
    explanatory comment were wrong; both fixed, and the field is now excluded from the preview
    when cleared.
  - The schedule editor could still persist `{ mode: 'office', officeId: null }` when there were
    no offices. The "Office" toggle is now `disabled` whenever `offices.length === 0`, which also
    made the old "No offices yet" placeholder branch dead code — removed.
  - Two small fixes: `YearRow`'s `<h3>` skipped a heading level under `/years`' `<h1>` (now
    `<h2>`, matching the same fix already made to `ScheduleTab`), and its rate/hours text carried
    the same hidden-branch pattern as elsewhere (template-literal fix).
  - Two test-quality fixes: a settings `load` test now asserts a bundled holiday from one FY
    survives viewing another (the regression test for the critical fix above), and the E2E
    schedule-save assertion is now scoped to the saved-versions list instead of matching text that
    the always-visible editor also carries (which could pass even if nothing had actually saved).
- **PR #2's second Kilo review round** (after the fixes above), also fixed:
  - `OfficeRow`/`YearRow` re-showed a stale error (or closed the form on a stale success) if the
    editor was reopened without a fresh submit — `page.form` doesn't clear itself. Both now
    snapshot `page.form` when the editor opens (`openedWithForm`) and only treat a *different*
    `page.form` reference as this attempt's own outcome, which also naturally covers switching
    tabs away and back without resubmitting.
  - `ScheduleEditor`'s `offices[0].id` (used only when a day is set to office mode) had no
    fallback, relying solely on the "Office" toggle being disabled. Restored
    `offices[0]?.id ?? null` with a `/* v8 ignore next */` (confirmed empirically that a
    Playwright `force: true` click still doesn't fire a native `disabled` button's click handler
    in Chromium, so the fallback branch has no way to be exercised through the UI) and added the
    real enforcement layer Kilo also suggested: `scheduleSchema` now rejects `{ mode: 'office',
    officeId: null }` outright, closing the "crafted POST" gap regardless of any client guard.
  - `updateRate` guarded a finalised year but not a non-existent `startYear` (any 2000–2100 value
    passes `yearSchema`); `getYear` returning nothing now fails the action instead of a
    `WHERE`-matches-nothing silent "success".
  - Three test-quality fixes: the cycle-length deselect-guard test asserted `getByText('Week A')`
    absence, which can't distinguish the fix from the bug (`''` and `'1'` are both `!== '2'`) —
    now checks the actual submitted hidden field. The cross-FY holiday test's final assertion
    re-loaded FY27, which would re-seed (and so re-insert) the very row being checked regardless
    of the bug — now reads the DB directly after the FY28 load, with no third load. And the
    `YearRow`/`OfficeRow` "ignores a result for a different row" tests asserted synchronously,
    before Svelte's `$effect` (which would wrongly close the form on a scoping regression) gets a
    chance to flush — now awaited, matching the sibling success/failure tests.
  - Kilo's second-pass run itself failed once first, with "Agent wrapper made no execution
    progress during the watchdog window" and zero new comments — an infrastructure timeout on
    its side, confirmed via the check run's own output text, not a review verdict. Retriggered
    with an empty commit rather than treated as a real finding.
