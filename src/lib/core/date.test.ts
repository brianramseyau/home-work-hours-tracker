import { describe, expect, it } from 'vitest';
import {
	addDays,
	daysBetween,
	eachDate,
	formatFullDate,
	formatIsoDate,
	formatShortDate,
	isBetween,
	isWeekend,
	mondayOf,
	parseIsoDate,
	weekday,
	weekdayShort
} from './date';

describe('parseIsoDate', () => {
	it('parses a valid date onto UTC noon', () => {
		const date = parseIsoDate('2026-09-14');
		expect(date.getUTCFullYear()).toBe(2026);
		expect(date.getUTCMonth()).toBe(8);
		expect(date.getUTCDate()).toBe(14);
		expect(date.getUTCHours()).toBe(12);
	});

	it('rejects a malformed string', () => {
		expect(() => parseIsoDate('14/09/2026')).toThrow('Expected a YYYY-MM-DD date');
	});

	it('rejects an out-of-range calendar date', () => {
		expect(() => parseIsoDate('2026-02-30')).toThrow('is not a valid calendar date');
		expect(() => parseIsoDate('2026-13-01')).toThrow('is not a valid calendar date');
	});
});

describe('formatIsoDate', () => {
	it('pads single-digit months and days', () => {
		expect(formatIsoDate(new Date(Date.UTC(2026, 0, 2, 12)))).toBe('2026-01-02');
	});
});

describe('addDays', () => {
	it('adds and subtracts days, crossing month and year boundaries', () => {
		expect(addDays('2026-06-30', 1)).toBe('2026-07-01');
		expect(addDays('2026-07-01', -1)).toBe('2026-06-30');
		expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
	});

	it('crosses a DST transition without shifting the calendar day', () => {
		// AEDT → AEST ends 2026-04-05 in Melbourne; UTC-noon arithmetic is unaffected either way.
		expect(addDays('2026-04-04', 1)).toBe('2026-04-05');
	});
});

describe('weekday', () => {
	it('numbers Monday as 1 and Sunday as 7', () => {
		expect(weekday('2026-07-06')).toBe(1); // Monday
		expect(weekday('2026-07-07')).toBe(2);
		expect(weekday('2026-07-08')).toBe(3);
		expect(weekday('2026-07-09')).toBe(4);
		expect(weekday('2026-07-10')).toBe(5);
		expect(weekday('2026-07-11')).toBe(6); // Saturday
		expect(weekday('2026-07-12')).toBe(7); // Sunday
	});
});

describe('mondayOf', () => {
	it('returns the same date when already a Monday', () => {
		expect(mondayOf('2026-07-06')).toBe('2026-07-06');
	});

	it('rewinds to the preceding Monday', () => {
		expect(mondayOf('2026-07-12')).toBe('2026-07-06'); // Sunday → that week's Monday
		expect(mondayOf('2026-07-08')).toBe('2026-07-06'); // Wednesday
	});
});

describe('daysBetween', () => {
	it('is 0 for the same date', () => {
		expect(daysBetween('2026-07-01', '2026-07-01')).toBe(0);
	});

	it('is positive when to is after from, negative otherwise', () => {
		expect(daysBetween('2026-07-01', '2026-07-08')).toBe(7);
		expect(daysBetween('2026-07-08', '2026-07-01')).toBe(-7);
	});
});

describe('eachDate', () => {
	it('lists every date inclusive of both ends', () => {
		expect(eachDate('2026-06-29', '2026-07-02')).toEqual([
			'2026-06-29',
			'2026-06-30',
			'2026-07-01',
			'2026-07-02'
		]);
	});

	it('returns a single date when from equals to', () => {
		expect(eachDate('2026-07-01', '2026-07-01')).toEqual(['2026-07-01']);
	});

	it('returns an empty array when from is after to', () => {
		expect(eachDate('2026-07-02', '2026-07-01')).toEqual([]);
	});
});

describe('isWeekend', () => {
	it('is true for Saturday and Sunday, false for weekdays', () => {
		expect(isWeekend('2026-07-11')).toBe(true);
		expect(isWeekend('2026-07-12')).toBe(true);
		expect(isWeekend('2026-07-06')).toBe(false);
	});
});

describe('isBetween', () => {
	it('is true at the inclusive bounds and false outside them', () => {
		expect(isBetween('2026-07-01', '2026-07-01', '2026-07-31')).toBe(true);
		expect(isBetween('2026-07-31', '2026-07-01', '2026-07-31')).toBe(true);
		expect(isBetween('2026-06-30', '2026-07-01', '2026-07-31')).toBe(false);
		expect(isBetween('2026-08-01', '2026-07-01', '2026-07-31')).toBe(false);
	});
});

describe('formatFullDate', () => {
	it('formats an ISO date as weekday, day, short month and year', () => {
		expect(formatFullDate('2026-09-16')).toBe('Wed 16 Sep 2026');
		expect(formatFullDate('2027-01-01')).toBe('Fri 1 Jan 2027');
	});
});

describe('formatShortDate', () => {
	it('formats an ISO date as weekday, day and short month, without the year', () => {
		expect(formatShortDate('2026-09-14')).toBe('Mon 14 Sep');
	});
});

describe('weekdayShort', () => {
	it('formats an ISO date as just its short weekday name', () => {
		expect(weekdayShort('2026-09-14')).toBe('Mon');
		expect(weekdayShort('2026-09-20')).toBe('Sun');
	});
});
