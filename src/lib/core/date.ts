// Pure ISO-date (YYYY-MM-DD) arithmetic. Every date in and out of this module is a plain
// string; internally it's parsed onto UTC noon (not midnight) so that adding/subtracting days
// can never land on a different calendar day because of a DST transition in the *host's*
// timezone. Local "today" comes from clock.ts, never from this module.

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseIsoDate(iso: string): Date {
	const match = ISO_DATE.exec(iso);
	if (!match) throw new Error(`Expected a YYYY-MM-DD date, got "${iso}"`);
	const [, year, month, day] = match;
	const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12));
	// New Date(Date.UTC(...)) normalises out-of-range fields (e.g. month 13, day 32) instead of
	// throwing, so a bad calendar date must be caught by comparing the parts back out.
	if (
		date.getUTCFullYear() !== Number(year) ||
		date.getUTCMonth() !== Number(month) - 1 ||
		date.getUTCDate() !== Number(day)
	) {
		throw new Error(`"${iso}" is not a valid calendar date`);
	}
	return date;
}

export function formatIsoDate(date: Date): string {
	const year = String(date.getUTCFullYear()).padStart(4, '0');
	const month = String(date.getUTCMonth() + 1).padStart(2, '0');
	const day = String(date.getUTCDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

export function addDays(iso: string, days: number): string {
	const date = parseIsoDate(iso);
	date.setUTCDate(date.getUTCDate() + days);
	return formatIsoDate(date);
}

/** 1 = Monday … 7 = Sunday (ISO weekday numbering). */
export function weekday(iso: string): number {
	const jsDay = parseIsoDate(iso).getUTCDay(); // 0 = Sunday … 6 = Saturday
	return jsDay === 0 ? 7 : jsDay;
}

const WEEKDAY_NAMES = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
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

/** "Wed 16 Sep 2026" for "2026-09-16" — the day editor's heading, in place of the raw ISO date. */
export function formatFullDate(iso: string): string {
	const [year, month, day] = iso.split('-');
	return `${WEEKDAY_NAMES[weekday(iso)]} ${Number(day)} ${MONTH_NAMES[Number(month) - 1]} ${year}`;
}

/** "Mon 14 Sep" for "2026-09-14" — a diary row's date label, without the year. */
export function formatShortDate(iso: string): string {
	const [, month, day] = iso.split('-');
	return `${WEEKDAY_NAMES[weekday(iso)]} ${Number(day)} ${MONTH_NAMES[Number(month) - 1]}`;
}

/** "Mon" for "2026-09-14" — a diary row's weekday label, without the date. */
export function weekdayShort(iso: string): string {
	return WEEKDAY_NAMES[weekday(iso)];
}

/**
 * "21–27 Sep" for a week within one month, or "29 Sep–5 Oct" when it spans two — a week
 * heading's date range, always naming the month so it isn't ambiguous out of context.
 */
export function formatDateRange(from: string, to: string): string {
	const [, fromMonth, fromDay] = from.split('-');
	const [, toMonth, toDay] = to.split('-');
	const toLabel = `${Number(toDay)} ${MONTH_NAMES[Number(toMonth) - 1]}`;
	const fromLabel =
		fromMonth === toMonth
			? `${Number(fromDay)}`
			: `${Number(fromDay)} ${MONTH_NAMES[Number(fromMonth) - 1]}`;
	return `${fromLabel}–${toLabel}`;
}

/** The Monday of the week containing `iso`. */
export function mondayOf(iso: string): string {
	return addDays(iso, -(weekday(iso) - 1));
}

/** Whole calendar days between two ISO dates (`to − from`), which may be negative. */
export function daysBetween(from: string, to: string): number {
	const msPerDay = 24 * 60 * 60 * 1000;
	return Math.round((parseIsoDate(to).getTime() - parseIsoDate(from).getTime()) / msPerDay);
}

/** Every ISO date from `from` to `to` inclusive. Empty if `from` is after `to`. */
export function eachDate(from: string, to: string): string[] {
	const count = daysBetween(from, to);
	if (count < 0) return [];
	const dates: string[] = [];
	let cursor = from;
	for (let i = 0; i <= count; i++) {
		dates.push(cursor);
		cursor = addDays(cursor, 1);
	}
	return dates;
}

export function isWeekend(iso: string): boolean {
	const day = weekday(iso);
	return day === 6 || day === 7;
}

/** True when `iso` is within [from, to] inclusive. */
export function isBetween(iso: string, from: string, to: string): boolean {
	return iso >= from && iso <= to;
}
