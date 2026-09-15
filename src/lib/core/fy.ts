// Australian financial year helpers. A financial year runs 1 Jul – 30 Jun and is identified
// by its start year: startYear 2026 is "FY27" (1 Jul 2026 – 30 Jun 2027).
// Pure and string-based by design (no Date, no timezone).

import { daysBetween, eachDate, isWeekend, mondayOf } from './date';

const ISO_DATE = /^(\d{4})-(\d{2})-\d{2}$/;
const FY_LABEL = /^FY(\d{2})$/;
const FY_SLUG = /^fy(\d{2})$/;

/** The start year of the financial year containing `isoDate` (YYYY-MM-DD). */
export function fyStartYear(isoDate: string): number {
	const match = ISO_DATE.exec(isoDate);
	if (!match) throw new Error(`Expected a YYYY-MM-DD date, got "${isoDate}"`);
	const year = Number(match[1]);
	const month = Number(match[2]);
	return month >= 7 ? year : year - 1;
}

/** "FY27" for startYear 2026. */
export function fyLabel(startYear: number): string {
	return `FY${String((startYear + 1) % 100).padStart(2, '0')}`;
}

/** URL slug, e.g. "fy27". */
export function fySlug(startYear: number): string {
	return fyLabel(startYear).toLowerCase();
}

/**
 * The start year encoded by a "FY27"-style label. Two-digit years are read as 2000s, which
 * holds for the lifetime of this app (it stops being unambiguous in 2100).
 */
export function parseFyLabel(label: string): number {
	const match = FY_LABEL.exec(label);
	if (!match) throw new Error(`Expected a label like "FY27", got "${label}"`);
	return 2000 + Number(match[1]) - 1;
}

/** The start year encoded by a "fy27"-style URL slug. */
export function parseFySlug(slug: string): number {
	const match = FY_SLUG.exec(slug);
	if (!match) throw new Error(`Expected a slug like "fy27", got "${slug}"`);
	return 2000 + Number(match[1]) - 1;
}

/** "Jul 2026 – Jun 2027". */
export function fyRangeLabel(startYear: number): string {
	return `Jul ${startYear} – Jun ${startYear + 1}`;
}

/** The financial year's inclusive date bounds. */
export function fyBounds(startYear: number): { start: string; end: string } {
	return { start: `${startYear}-07-01`, end: `${startYear + 1}-06-30` };
}

/**
 * The week number of `isoDate` within its own financial year: 1 on 1 Jul, incrementing on
 * every Monday (so the first, possibly short, week is week 1), reaching 53 at the FY's end.
 */
export function weekOfFy(isoDate: string): number {
	const { start } = fyBounds(fyStartYear(isoDate));
	return Math.floor(daysBetween(mondayOf(start), mondayOf(isoDate)) / 7) + 1;
}

/** Every date in the financial year, weekdays only unless `includeWeekends` is set. */
export function datesInFy(
	startYear: number,
	options: { includeWeekends?: boolean } = {}
): string[] {
	const { start, end } = fyBounds(startYear);
	const dates = eachDate(start, end);
	return options.includeWeekends ? dates : dates.filter((date) => !isWeekend(date));
}

const MONTH_NAMES = [
	'Jan',
	'Feb',
	'Mar',
	'Apr',
	'May',
	'Jun',
	'Jul',
	'Aug',
	'Sep',
	'Oct',
	'Nov',
	'Dec'
];

/** The financial year's 12 calendar months, in order, as "YYYY-MM". */
export function monthsInFy(startYear: number): string[] {
	return [...Array(12).keys()].map((offset) => {
		const monthIndex = (6 + offset) % 12; // 0 = Jan … 6 = Jul
		const year = monthIndex >= 6 ? startYear : startYear + 1;
		return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
	});
}

/** "Jul 2026" for "2026-07". */
export function monthLabel(month: string): string {
	const [year, monthNumber] = month.split('-');
	return `${MONTH_NAMES[Number(monthNumber) - 1]} ${year}`;
}

export interface FySummary {
	startYear: number;
	label: string;
	slug: string;
	range: string;
}

export function fySummary(startYear: number): FySummary {
	return {
		startYear,
		label: fyLabel(startYear),
		slug: fySlug(startYear),
		range: fyRangeLabel(startYear)
	};
}

const FY_PATH = /^\/(fy\d{2})(?:\/|$)/;

/** The financial year a `/[fy]/...` pathname is showing, or null for any other route. */
export function fyFromPath(pathname: string): FySummary | null {
	const match = FY_PATH.exec(pathname);
	return match ? fySummary(parseFySlug(match[1])) : null;
}
