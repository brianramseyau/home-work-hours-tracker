import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '../db/create';
import {
	addCustomHoliday,
	deleteHoliday,
	listHolidays,
	replaceBundledHolidays,
	setHolidayDisabled
} from './holidays';

let db: Db;

beforeEach(() => {
	db = createDb(':memory:');
});

describe('replaceBundledHolidays', () => {
	it('seeds bundled rows for a region', () => {
		replaceBundledHolidays(db, 'AU-VIC', [
			{ date: '2026-12-25', name: 'Christmas Day' },
			{ date: '2026-11-03', name: 'Melbourne Cup' }
		]);
		const rows = listHolidays(db, 'AU-VIC');
		expect(rows.map((row) => row.name)).toEqual(['Melbourne Cup', 'Christmas Day']);
		expect(rows.every((row) => row.source === 'bundled')).toBe(true);
	});

	it('replaces the bundled rows without touching custom ones', () => {
		replaceBundledHolidays(db, 'AU-VIC', [{ date: '2026-12-25', name: 'Christmas Day' }]);
		addCustomHoliday(db, {
			date: '2026-09-14',
			name: 'Office Location 1 anniversary',
			region: 'AU-VIC',
			repeatsYearly: true
		});

		replaceBundledHolidays(db, 'AU-VIC', [{ date: '2027-01-01', name: "New Year's Day" }]);

		const rows = listHolidays(db, 'AU-VIC');
		expect(rows.map((row) => row.name).sort()).toEqual([
			"New Year's Day",
			'Office Location 1 anniversary'
		]);
	});

	it('handles an empty bundle', () => {
		replaceBundledHolidays(db, 'AU-VIC', []);
		expect(listHolidays(db, 'AU-VIC')).toEqual([]);
	});

	it('re-seeds bundled rows cleanly even when a custom row shares a date, region and name', () => {
		addCustomHoliday(db, {
			date: '2026-12-25',
			name: 'Christmas Day',
			region: 'AU-VIC',
			repeatsYearly: false
		});

		expect(() =>
			replaceBundledHolidays(db, 'AU-VIC', [{ date: '2026-12-25', name: 'Christmas Day' }])
		).not.toThrow();

		const rows = listHolidays(db, 'AU-VIC');
		expect(rows).toHaveLength(2);
		expect(rows.map((row) => row.source).sort()).toEqual(['bundled', 'custom']);
	});
});

describe('addCustomHoliday', () => {
	it('inserts an enabled custom row', () => {
		const holiday = addCustomHoliday(db, {
			date: '2026-09-14',
			name: 'Office Location 1 anniversary',
			region: 'AU-VIC',
			repeatsYearly: true
		});
		expect(holiday).toMatchObject({ source: 'custom', disabled: false, repeatsYearly: true });
	});
});

describe('setHolidayDisabled and deleteHoliday', () => {
	it('toggles a holiday disabled and back', () => {
		const holiday = addCustomHoliday(db, {
			date: '2026-09-14',
			name: 'Office Location 1 anniversary',
			region: 'AU-VIC',
			repeatsYearly: false
		});
		expect(setHolidayDisabled(db, holiday.id, true).disabled).toBe(true);
		expect(setHolidayDisabled(db, holiday.id, false).disabled).toBe(false);
	});

	it('deletes a holiday', () => {
		const holiday = addCustomHoliday(db, {
			date: '2026-09-14',
			name: 'Office Location 1 anniversary',
			region: 'AU-VIC',
			repeatsYearly: false
		});
		deleteHoliday(db, holiday.id);
		expect(listHolidays(db, 'AU-VIC')).toEqual([]);
	});
});
