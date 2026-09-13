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

- [ ] 100% coverage. `verify` is green.
- [ ] Screenshots of every tab at 390px and 1440px, light and dark.
- [ ] Synthetic names only in tests and screenshots.
