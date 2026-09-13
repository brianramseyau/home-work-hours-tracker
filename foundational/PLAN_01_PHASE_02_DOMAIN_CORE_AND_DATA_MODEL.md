# PLAN_01 · Phase 02 — Domain core and data model

**Goal:** the full schema plus every piece of pure domain logic, and the auto-prefill engine, all at 100% coverage with no UI. Later phases only wire this to the screens.

**Depends on:** Phase 01. **Unblocks:** Phases 03, 05 and 06, which can run in parallel.

## Tasks

### 1. Schema and migration

Extend `src/lib/server/db/schema.ts` with the tables in the Overview's data model, then run `npm run db:generate`.

- **Dates** are ISO `text` (`YYYY-MM-DD`). **Times** are `text` `HH:mm`. **Money** is integer cents. **Durations** are integer minutes.
- **`settings`** is a singleton row with id = 1, inserted by the migration or on first read, with the defaults:
  - `holiday_region 'AU-VIC'`, `standard_start '09:00'`, `standard_end '17:06'`, `standard_break_minutes 30`, `include_weekends false`.
  - `full_name` is null, so the export falls back to "Name not set".
- **Enums** go through drizzle `text({ enum })`:
  - `days.kind`: `work|leave|sick|public_holiday|off`.
  - `days.source`: `prefill|manual|import`.
  - `schedule_days.mode`: `home|office|off`.
  - `holidays.source`: `bundled|custom`.
- **Indexes:** `days(date)` unique, `home_blocks(day_id, position)`, `holidays(region, date)`, `schedules(effective_from)` unique.
- **FKs:** `home_blocks.day_id` and `schedule_days.schedule_id` are `ON DELETE CASCADE`. `office_id` references are `ON DELETE RESTRICT`, because offices are archived, never deleted, once referenced.

### 2. Pure core (`src/lib/core/`)

Each module has a co-located `*.test.ts` and uses **no DB, no Date-now, no env**. "Today" is always a parameter.

| Module          | Exports (indicative)                                                                                                                                                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `date.ts`       | `parseIsoDate`, `formatIsoDate`, `addDays`, `mondayOf`, `weekday (1=Mon…7=Sun)`, `eachDate(from, to)`. Pure UTC-noon arithmetic on ISO strings, which avoids DST bugs                                                                             |
| `fy.ts`         | `fyForDate(iso) → startYear`, `fyBounds(startYear)`, `fyLabel(startYear) → 'FY27'`, `fySlug`/`parseFySlug('fy27')`, `weekOfFy(iso)`, `datesInFy(startYear, {includeWeekends})`                                                                    |
| `time.ts`       | `parseHm`, `formatHm`, `blockMinutes({start,end,breakMinutes})`, `validateBlock` (end > start, 0 ≤ break < span), `formatHours(minutes) → '7.6'`, `formatHm(minutes) → '7h 36m'`                                                                  |
| `schedule.ts`   | `resolveSchedule(schedules, iso)`, `cycleWeekIndex(schedule, iso)`, `modeFor(schedules, iso) → {mode, officeId} \| null`                                                                                                                          |
| `prefill.ts`    | `planPrefill({ from, to, existing, schedules, holidays, standard, includeWeekends }) → { inserts, updates, deletes }`. It never proposes changes to `manual`/`import` rows. It's idempotent: planning the output against itself yields no changes |
| `totals.ts`     | `dayHomeMinutes`, `summarise(days) → { homeMinutes, byMonth[], byWeek[], kindCounts }`, `claimCents(minutes, rateCents)` (one final rounding)                                                                                                     |
| `dayType.ts`    | `displayType(day) → 'home' \| 'office' \| 'split' \| 'leave' \| 'sick' \| 'public_holiday' \| 'off'`                                                                                                                                              |
| `validation.ts` | zod schemas: `settingsSchema`, `yearSchema`, `officeSchema`, `scheduleSchema`, `daySchema` (with a blocks array), `holidaySchema`, `leaveRangeSchema`                                                                                             |

### 3. Server modules (`src/lib/server/`)

- **`clock.ts`:** already built in Phase 01 (`today(env)`, `localIsoDate`). It uses the process `TZ` via `Intl…formatToParts()`, and returns `APP_FIXED_DATE` whenever that's set, because E2E runs a production build via `vite preview`. Extend it only if P02 needs more; `core/fy.ts` likewise already has `fyStartYear`, `fyLabel`, `fySlug`, `fyRangeLabel` and `fySummary`.
- **`holidays.ts`:**
  - `bundledHolidays(region, startYear)` uses `date-holidays` (country `AU`, state from the region) and keeps only `type === 'public'`. It returns `{date, name}[]` for the whole FY, which spans two calendar years.
  - `effectiveHolidays(bundledRows, customRows, fy)` projects `repeats_yearly` custom rows into the FY and removes disabled ones.
  - **Investigate** AU-VIC coverage of Melbourne Cup and AFL Grand Final Friday, and record the findings in this doc. Anything missing is handled by custom holidays.
- **`repo/`**, one module per table (`settings.ts`, `years.ts`, `offices.ts`, `schedules.ts`, `days.ts`, `holidays.ts`). Every function takes `db` as its first parameter. `days.ts` provides `listRange(db, from, to)` (a day joined with ordered blocks), `upsertDay(db, dayWithBlocks)` (in a transaction) and `deleteDay`.
- **`autoPrefill.ts`:**
  - `ensurePrefilled(db, today)`:
    1. Compute the start (`prefilled_through + 1`, or on the first run the later of the current FY start and the earliest schedule's `effective_from`; a no-op if there's no schedule).
    2. Skip finalised FYs.
    3. Call `planPrefill`.
    4. Apply the plan in one transaction.
    5. Set `prefilled_through = today`.
    6. Return `{ filled: n }`.
  - `replanFrom(db, fromDate)`: re-plan `prefill` rows from `fromDate` to the watermark.
  - `raiseWatermark(db, date)`: used by the import.

## Tests (must include)

- **FY boundaries:** 30 Jun vs 1 Jul, and week numbering matching the legacy sheet (1 Jul is week 1, and the week number goes up on Mondays, reaching 53).
- **Block maths:** 09:00–17:06 with a 30 min break = 456 min = 7.6 h. Invalid blocks are rejected.
- **Claim rounding:** the sum of minutes is rounded once, not per day.
- **Prefill scenarios**, table-driven with synthetic data only and offices "Office Location 1/2":
  - A fortnightly alternating two-office pattern.
  - A mid-year schedule version change.
  - A holiday on a scheduled office day.
  - Weekends skipped unless scheduled.
  - A back-dated schedule change re-plans only the `prefill` rows and leaves `manual`/`import` rows intact.
  - A watermark raised by an import, with no back-fill.
  - Idempotency.
  - A finalised FY skipped.
- **Holidays:** a region switch, repeats-yearly projection, disabled removal, and the FY spanning two calendar years.
- **Clock:** already covered in P01 (`TZ` around midnight UTC, daylight saving, `APP_FIXED_DATE` validation). Keep those tests green if the module changes.

## Acceptance criteria

- [ ] The migration applies cleanly on an empty db and on the P01 db.
- [ ] 100% coverage. `verify` is green.
- [ ] The holiday coverage findings are recorded in this doc.
