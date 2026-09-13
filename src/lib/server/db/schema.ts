import { index, integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';

// Conventions (see foundational/PLAN_01_OVERVIEW.md → Data model): dates are ISO `YYYY-MM-DD`
// text, times are `HH:mm` text, durations are integer minutes, money is integer cents.

/** Singleton row (id = 1): app-wide preferences and the auto-prefill watermark. */
export const settings = sqliteTable('settings', {
	id: integer('id').primaryKey(),
	fullName: text('full_name'),
	holidayRegion: text('holiday_region').notNull().default('AU-VIC'),
	standardStart: text('standard_start').notNull().default('09:00'),
	standardEnd: text('standard_end').notNull().default('17:06'),
	standardBreakMinutes: integer('standard_break_minutes').notNull().default(30),
	includeWeekends: integer('include_weekends', { mode: 'boolean' }).notNull().default(false),
	// Last date auto-prefill has materialised; null until the first run.
	prefilledThrough: text('prefilled_through')
});

/** One row per Australian financial year (start_year 2026 ⇒ "FY27"). */
export const financialYears = sqliteTable('financial_years', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	startYear: integer('start_year').notNull().unique(),
	rateCentsPerHour: integer('rate_cents_per_hour').notNull(),
	rateNote: text('rate_note'),
	// Set once the year's figures are locked; prefill and edits are then blocked.
	finalisedAt: text('finalised_at')
});

/** A place a day can be worked from other than home. Archived, never deleted, once referenced. */
export const offices = sqliteTable('offices', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull().unique(),
	address: text('address'),
	archivedAt: text('archived_at')
});

/** A weekly/fortnightly working pattern, effective from a date until the next schedule starts. */
export const schedules = sqliteTable('schedules', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	effectiveFrom: text('effective_from').notNull().unique(),
	cycleWeeks: integer('cycle_weeks').notNull(), // 1 or 2
	// The Monday that counts as week index 0, for a fortnightly cycle's alternation.
	anchorMonday: text('anchor_monday').notNull()
});

/** One weekday's mode within a schedule's cycle. */
export const scheduleDays = sqliteTable(
	'schedule_days',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		scheduleId: integer('schedule_id')
			.notNull()
			.references(() => schedules.id, { onDelete: 'cascade' }),
		weekIndex: integer('week_index').notNull(), // 0 or 1
		weekday: integer('weekday').notNull(), // 1 = Mon … 7 = Sun
		mode: text('mode', { enum: ['home', 'office', 'off'] }).notNull(),
		officeId: integer('office_id').references(() => offices.id, { onDelete: 'restrict' })
	},
	(table) => [unique().on(table.scheduleId, table.weekIndex, table.weekday)]
);

/** One calendar day's record. Auto-prefill only ever touches `source = 'prefill'` rows. */
export const days = sqliteTable('days', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	date: text('date').notNull().unique(),
	kind: text('kind', { enum: ['work', 'leave', 'sick', 'public_holiday', 'off'] }).notNull(),
	officeId: integer('office_id').references(() => offices.id, { onDelete: 'restrict' }),
	notes: text('notes'),
	source: text('source', { enum: ['prefill', 'manual', 'import'] }).notNull(),
	updatedAt: text('updated_at').notNull()
});

/** A worked-from-home time span within a day. A day may have several (split days). */
export const homeBlocks = sqliteTable(
	'home_blocks',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		dayId: integer('day_id')
			.notNull()
			.references(() => days.id, { onDelete: 'cascade' }),
		start: text('start').notNull(), // HH:mm
		end: text('end').notNull(), // HH:mm
		breakMinutes: integer('break_minutes').notNull(),
		position: integer('position').notNull()
	},
	(table) => [index('home_blocks_day_id_position_idx').on(table.dayId, table.position)]
);

/** A public holiday, bundled from date-holidays or added by hand. */
export const holidays = sqliteTable(
	'holidays',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		date: text('date').notNull(),
		name: text('name').notNull(),
		region: text('region').notNull(),
		source: text('source', { enum: ['bundled', 'custom'] }).notNull(),
		// Custom holidays only: projected onto the same month/day every financial year.
		repeatsYearly: integer('repeats_yearly', { mode: 'boolean' }).notNull().default(false),
		disabled: integer('disabled', { mode: 'boolean' }).notNull().default(false)
	},
	(table) => [
		unique().on(table.date, table.region, table.name),
		index('holidays_region_date_idx').on(table.region, table.date)
	]
);
