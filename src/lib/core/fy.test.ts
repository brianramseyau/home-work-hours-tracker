import { describe, expect, it } from 'vitest';
import {
	datesInFy,
	fyBounds,
	fyLabel,
	fyRangeLabel,
	fySlug,
	fyStartYear,
	fySummary,
	parseFyLabel,
	parseFySlug,
	weekOfFy
} from './fy';

describe('fyStartYear', () => {
	it.each([
		['2026-06-30', 2025],
		['2026-07-01', 2026],
		['2026-12-31', 2026],
		['2027-01-01', 2026],
		['2027-06-30', 2026]
	])('%s is in the FY starting %i', (date, start) => {
		expect(fyStartYear(date)).toBe(start);
	});

	it('rejects anything that is not YYYY-MM-DD', () => {
		expect(() => fyStartYear('14/09/2026')).toThrow(/YYYY-MM-DD/);
	});
});

describe('labels', () => {
	it('names the year by its end year', () => {
		expect(fyLabel(2026)).toBe('FY27');
		expect(fyLabel(2008)).toBe('FY09');
		expect(fyLabel(2099)).toBe('FY00');
		expect(fySlug(2026)).toBe('fy27');
		expect(fyRangeLabel(2026)).toBe('Jul 2026 – Jun 2027');
	});

	it('bundles everything the UI needs', () => {
		expect(fySummary(2025)).toEqual({
			startYear: 2025,
			label: 'FY26',
			slug: 'fy26',
			range: 'Jul 2025 – Jun 2026'
		});
	});
});

describe('parseFyLabel and parseFySlug', () => {
	it('round-trip with fyLabel/fySlug', () => {
		expect(parseFyLabel('FY27')).toBe(2026);
		expect(parseFySlug('fy27')).toBe(2026);
		expect(parseFyLabel(fyLabel(2008))).toBe(2008);
	});

	it('rejects a malformed label or slug', () => {
		expect(() => parseFyLabel('27')).toThrow(/Expected a label/);
		expect(() => parseFySlug('FY27')).toThrow(/Expected a slug/);
	});
});

describe('fyBounds', () => {
	it('spans 1 Jul to 30 Jun', () => {
		expect(fyBounds(2026)).toEqual({ start: '2026-07-01', end: '2027-06-30' });
	});
});

describe('weekOfFy', () => {
	it('is week 1 on 1 Jul, however far that day is from Monday', () => {
		expect(weekOfFy('2026-07-01')).toBe(1); // Wednesday
		expect(weekOfFy('2026-07-05')).toBe(1); // Sunday, still week 1
	});

	it('increments on the first Monday and every Monday after', () => {
		expect(weekOfFy('2026-07-06')).toBe(2);
	});

	it('reaches week 53 at the end of the financial year', () => {
		expect(weekOfFy('2027-06-29')).toBe(53);
		expect(weekOfFy('2027-06-30')).toBe(53);
	});
});

describe('datesInFy', () => {
	it('lists weekdays only by default', () => {
		const dates = datesInFy(2026);
		expect(dates[0]).toBe('2026-07-01');
		expect(dates.at(-1)).toBe('2027-06-30');
		expect(dates).not.toContain('2026-07-04'); // Saturday
		expect(dates).not.toContain('2026-07-05'); // Sunday
	});

	it('includes weekends when asked', () => {
		const dates = datesInFy(2026, { includeWeekends: true });
		expect(dates).toContain('2026-07-04');
		expect(dates).toContain('2026-07-05');
	});
});
