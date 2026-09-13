import { describe, expect, it } from 'vitest';
import { bundledHolidays, effectiveHolidays, type HolidayRow } from './holidays';

describe('bundledHolidays', () => {
	it('covers AU-VIC public holidays across the FY, including the regional ones', () => {
		const rows = bundledHolidays('AU-VIC', 2026);
		const names = rows.map((row) => row.name);

		expect(names).toContain('Melbourne Cup');
		expect(names).toContain('AFL Grand Final Friday');
		expect(names).toContain('Christmas Day');
		expect(names).toContain("New Year's Day");
	});

	it('excludes non-public rows (school terms, observances)', () => {
		const rows = bundledHolidays('AU-VIC', 2026);
		const names = rows.map((row) => row.name);

		expect(names).not.toContain("Mother's Day");
		expect(names.some((name) => name.includes('school'))).toBe(false);
	});

	it('only returns dates within the financial year', () => {
		const rows = bundledHolidays('AU-VIC', 2026);
		for (const row of rows) {
			expect(row.date >= '2026-07-01' && row.date <= '2027-06-30').toBe(true);
		}
		// New Year's Day, 1 Jan, belongs to the second calendar year of FY27.
		expect(rows.some((row) => row.date === '2027-01-01')).toBe(true);
	});

	it('supports a different state', () => {
		const rows = bundledHolidays('AU-NSW', 2026);
		expect(rows.length).toBeGreaterThan(0);
		expect(rows.some((row) => row.name === 'Melbourne Cup')).toBe(false);
	});
});

describe('effectiveHolidays', () => {
	const fy = { startYear: 2026 };

	it('includes enabled bundled rows within the FY', () => {
		const bundled: HolidayRow[] = [
			{ date: '2026-12-25', name: 'Christmas Day', repeatsYearly: false, disabled: false }
		];
		expect(effectiveHolidays(bundled, [], fy)).toEqual([
			{ date: '2026-12-25', name: 'Christmas Day' }
		]);
	});

	it('excludes disabled bundled rows', () => {
		const bundled: HolidayRow[] = [
			{ date: '2026-12-25', name: 'Christmas Day', repeatsYearly: false, disabled: true }
		];
		expect(effectiveHolidays(bundled, [], fy)).toEqual([]);
	});

	it('excludes a bundled row outside the FY bounds', () => {
		const bundled: HolidayRow[] = [
			{ date: '2025-12-25', name: 'Christmas Day', repeatsYearly: false, disabled: false }
		];
		expect(effectiveHolidays(bundled, [], fy)).toEqual([]);
	});

	it('keeps a one-off custom holiday whose date is inside the FY', () => {
		const custom: HolidayRow[] = [
			{
				date: '2026-09-25',
				name: 'Office Location 1 closure',
				repeatsYearly: false,
				disabled: false
			}
		];
		expect(effectiveHolidays([], custom, fy)).toEqual([
			{ date: '2026-09-25', name: 'Office Location 1 closure' }
		]);
	});

	it('drops a one-off custom holiday whose date falls outside the FY', () => {
		const custom: HolidayRow[] = [
			{ date: '2024-01-01', name: 'One-off', repeatsYearly: false, disabled: false }
		];
		expect(effectiveHolidays([], custom, fy)).toEqual([]);
	});

	it('projects a repeating custom holiday in the Jul–Dec half onto the FY start year', () => {
		const custom: HolidayRow[] = [
			{ date: '2019-09-14', name: 'Anniversary', repeatsYearly: true, disabled: false }
		];
		expect(effectiveHolidays([], custom, fy)).toEqual([
			{ date: '2026-09-14', name: 'Anniversary' }
		]);
	});

	it('projects a repeating custom holiday in the Jan–Jun half onto the FY end year', () => {
		const custom: HolidayRow[] = [
			{ date: '2019-03-15', name: 'Anniversary', repeatsYearly: true, disabled: false }
		];
		expect(effectiveHolidays([], custom, fy)).toEqual([
			{ date: '2027-03-15', name: 'Anniversary' }
		]);
	});

	it('clamps a 29 Feb anniversary to 28 Feb when the projected year is not a leap year', () => {
		// FY27 ends June 2027, and 2027 is not a leap year.
		const custom: HolidayRow[] = [
			{ date: '2020-02-29', name: 'Leap anniversary', repeatsYearly: true, disabled: false }
		];
		expect(effectiveHolidays([], custom, fy)).toEqual([
			{ date: '2027-02-28', name: 'Leap anniversary' }
		]);
	});

	it('keeps 29 Feb as-is when the projected year is a leap year', () => {
		// FY28 ends June 2028, and 2028 is a leap year.
		const custom: HolidayRow[] = [
			{ date: '2020-02-29', name: 'Leap anniversary', repeatsYearly: true, disabled: false }
		];
		expect(effectiveHolidays([], custom, { startYear: 2027 })).toEqual([
			{ date: '2028-02-29', name: 'Leap anniversary' }
		]);
	});

	it('excludes a disabled repeating custom holiday', () => {
		const custom: HolidayRow[] = [
			{ date: '2019-09-14', name: 'Anniversary', repeatsYearly: true, disabled: true }
		];
		expect(effectiveHolidays([], custom, fy)).toEqual([]);
	});

	it('merges bundled and custom rows', () => {
		const bundled: HolidayRow[] = [
			{ date: '2026-12-25', name: 'Christmas Day', repeatsYearly: false, disabled: false }
		];
		const custom: HolidayRow[] = [
			{ date: '2026-09-14', name: 'Anniversary', repeatsYearly: true, disabled: false }
		];
		expect(effectiveHolidays(bundled, custom, fy)).toEqual([
			{ date: '2026-12-25', name: 'Christmas Day' },
			{ date: '2026-09-14', name: 'Anniversary' }
		]);
	});
});
