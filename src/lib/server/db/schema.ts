import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

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
