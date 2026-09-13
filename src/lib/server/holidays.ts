// Public holidays: the date-holidays bundle for a region, merged with custom rows already on
// record (repeating ones projected onto the financial year), with disabled rows removed. This
// module has no DB access itself — it takes and returns plain rows, so it's easy to unit test.

import Holidays from 'date-holidays';
import { fyBounds } from '$lib/core/fy';

export interface BundledHoliday {
	date: string; // ISO date
	name: string;
}

/**
 * The AU public holidays for `region` (e.g. "AU-VIC") that fall within the financial year
 * starting `startYear`. Only `type === 'public'` rows are kept — date-holidays also lists
 * school terms and observances (Mother's Day, etc.), which aren't public holidays.
 */
export function bundledHolidays(region: string, startYear: number): BundledHoliday[] {
	const [country, state] = region.split('-');
	const holidays = new Holidays(country, state);
	const { start, end } = fyBounds(startYear);

	// A financial year (1 Jul – 30 Jun) always spans exactly two calendar years.
	return [startYear, startYear + 1]
		.flatMap((year) => holidays.getHolidays(year))
		.filter((row) => row.type === 'public')
		.map((row) => ({ date: row.date.slice(0, 10), name: row.name }))
		.filter((row) => row.date >= start && row.date <= end);
}

export interface HolidayRow {
	date: string; // ISO date
	name: string;
	repeatsYearly: boolean;
	disabled: boolean;
}

// The full Gregorian century-exception rule doesn't matter for any year this app will ever
// realistically compute a financial year for.
function isLeapYear(year: number): boolean {
	return year % 4 === 0;
}

/**
 * Projects a repeating custom holiday's month/day onto the financial year starting `startYear`.
 * A 29 Feb anniversary clamps to 28 Feb in a non-leap projected year, rather than producing a
 * calendar date that doesn't exist (which would just silently never match any real date).
 */
function projectIntoFy(date: string, startYear: number): string {
	const [, month, day] = date.split('-');
	// Jul–Dec belongs to the FY's first calendar year; Jan–Jun to its second.
	const year = Number(month) >= 7 ? startYear : startYear + 1;
	const projectedDay = month === '02' && day === '29' && !isLeapYear(year) ? '28' : day;
	return `${year}-${month}-${projectedDay}`;
}

/**
 * The holidays that actually apply within the financial year: enabled bundled rows within its
 * bounds, plus enabled custom rows (one-off ones kept only if their date already falls inside
 * the FY; repeating ones projected onto it first).
 */
export function effectiveHolidays(
	bundledRows: HolidayRow[],
	customRows: HolidayRow[],
	fy: { startYear: number }
): BundledHoliday[] {
	const { start, end } = fyBounds(fy.startYear);
	const inFy = (date: string) => date >= start && date <= end;

	const bundled = bundledRows.filter((row) => !row.disabled && inFy(row.date));
	const custom = customRows
		.filter((row) => !row.disabled)
		.map((row) =>
			row.repeatsYearly ? { ...row, date: projectIntoFy(row.date, fy.startYear) } : row
		)
		.filter((row) => inFy(row.date));

	return [...bundled, ...custom].map(({ date, name }) => ({ date, name }));
}
