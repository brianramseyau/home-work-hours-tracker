// Australian financial year helpers. A financial year runs 1 Jul – 30 Jun and is identified
// by its start year: startYear 2026 is "FY27" (1 Jul 2026 – 30 Jun 2027).
// Pure and string-based by design (no Date, no timezone). Phase 02 extends this module.

const ISO_DATE = /^(\d{4})-(\d{2})-\d{2}$/;

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

/** "Jul 2026 – Jun 2027". */
export function fyRangeLabel(startYear: number): string {
	return `Jul ${startYear} – Jun ${startYear + 1}`;
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
