import { describe, expect, it } from 'vitest';
import { fyLabel, fyRangeLabel, fySlug, fyStartYear, fySummary } from './fy';

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
