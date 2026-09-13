import { describe, expect, it } from 'vitest';
import {
	daySchema,
	firstFieldError,
	holidaySchema,
	leaveRangeSchema,
	officeSchema,
	scheduleSchema,
	settingsSchema,
	yearSchema
} from './validation';

describe('settingsSchema', () => {
	const valid = {
		fullName: 'John Doe',
		holidayRegion: 'AU-VIC',
		standardStart: '09:00',
		standardEnd: '17:06',
		standardBreakMinutes: 30,
		includeWeekends: false
	};

	it('accepts the standard hours, and a null full name', () => {
		expect(settingsSchema.safeParse(valid).success).toBe(true);
		expect(settingsSchema.safeParse({ ...valid, fullName: null }).success).toBe(true);
	});

	it('rejects a malformed time', () => {
		expect(settingsSchema.safeParse({ ...valid, standardStart: '9:00' }).success).toBe(false);
	});

	it('rejects standard hours where the break does not fit the span', () => {
		const result = settingsSchema.safeParse({ ...valid, standardBreakMinutes: 600 });
		expect(result.success).toBe(false);
	});

	it('rejects an empty holiday region', () => {
		expect(settingsSchema.safeParse({ ...valid, holidayRegion: '' }).success).toBe(false);
	});

	it('rejects a region date-holidays has no AU state data for', () => {
		expect(settingsSchema.safeParse({ ...valid, holidayRegion: 'US-CA' }).success).toBe(false);
	});
});

describe('yearSchema', () => {
	it('accepts a valid financial year', () => {
		expect(
			yearSchema.safeParse({ startYear: 2026, rateCentsPerHour: 70, rateNote: null }).success
		).toBe(true);
	});

	it('rejects a negative rate', () => {
		expect(
			yearSchema.safeParse({ startYear: 2026, rateCentsPerHour: -1, rateNote: null }).success
		).toBe(false);
	});

	it('rejects a start year outside the sane range', () => {
		expect(
			yearSchema.safeParse({ startYear: 1999, rateCentsPerHour: 70, rateNote: null }).success
		).toBe(false);
	});
});

describe('officeSchema', () => {
	it('accepts a name with a null address', () => {
		expect(officeSchema.safeParse({ name: 'Office Location 1', address: null }).success).toBe(true);
	});

	it('rejects a blank name', () => {
		expect(officeSchema.safeParse({ name: '   ', address: null }).success).toBe(false);
	});
});

describe('scheduleSchema', () => {
	const valid = {
		effectiveFrom: '2026-07-01',
		cycleWeeks: 2 as const,
		anchorMonday: '2026-07-06',
		days: [{ weekIndex: 0, weekday: 1, mode: 'home' as const, officeId: null }]
	};

	it('accepts a valid fortnightly schedule', () => {
		expect(scheduleSchema.safeParse(valid).success).toBe(true);
	});

	it('accepts a valid weekly schedule', () => {
		expect(scheduleSchema.safeParse({ ...valid, cycleWeeks: 1 }).success).toBe(true);
	});

	it('rejects an anchor date that is not a Monday', () => {
		expect(scheduleSchema.safeParse({ ...valid, anchorMonday: '2026-07-07' }).success).toBe(false);
	});

	it('rejects a day whose weekIndex is outside the cycle length', () => {
		const result = scheduleSchema.safeParse({
			...valid,
			cycleWeeks: 1,
			days: [{ weekIndex: 1, weekday: 1, mode: 'home', officeId: null }]
		});
		expect(result.success).toBe(false);
	});

	it('rejects an unsupported cycle length', () => {
		expect(scheduleSchema.safeParse({ ...valid, cycleWeeks: 3 }).success).toBe(false);
	});

	it('rejects a duplicate weekIndex/weekday pair', () => {
		const result = scheduleSchema.safeParse({
			...valid,
			days: [
				{ weekIndex: 0, weekday: 1, mode: 'home', officeId: null },
				{ weekIndex: 0, weekday: 1, mode: 'office', officeId: null }
			]
		});
		expect(result.success).toBe(false);
	});

	it('accepts the same weekday in two different cycle weeks', () => {
		const result = scheduleSchema.safeParse({
			...valid,
			days: [
				{ weekIndex: 0, weekday: 1, mode: 'home', officeId: null },
				{ weekIndex: 1, weekday: 1, mode: 'office', officeId: 1 }
			]
		});
		expect(result.success).toBe(true);
	});

	it('rejects an office day with no office', () => {
		// Guards a crafted request bypassing the schedule editor's own UI, which disables the
		// "Office" toggle whenever there are no offices to pick from. `days` is always the
		// flattened key (zod prepends it to every issue inside the array, ahead of any `path`
		// set inside scheduleDaySchema's own refine), which is why there's no `path` there.
		const result = scheduleSchema.safeParse({
			...valid,
			days: [{ weekIndex: 0, weekday: 1, mode: 'office', officeId: null }]
		});
		expect(result.success).toBe(false);
		expect(result.success ? undefined : result.error.flatten().fieldErrors.days).toContain(
			'An office day needs an office'
		);
	});

	it('rejects a non-positive office id', () => {
		const result = scheduleSchema.safeParse({
			...valid,
			days: [{ weekIndex: 0, weekday: 1, mode: 'office', officeId: 0 }]
		});
		expect(result.success).toBe(false);
	});

	it('accepts an office day with an office', () => {
		const result = scheduleSchema.safeParse({
			...valid,
			days: [{ weekIndex: 0, weekday: 1, mode: 'office', officeId: 1 }]
		});
		expect(result.success).toBe(true);
	});
});

describe('daySchema', () => {
	const valid = {
		date: '2026-07-01',
		kind: 'work' as const,
		officeId: null,
		notes: null,
		blocks: [{ start: '09:00', end: '17:06', breakMinutes: 30 }]
	};

	it('accepts a valid home day', () => {
		expect(daySchema.safeParse(valid).success).toBe(true);
	});

	it('accepts a day with no blocks (an office or leave day)', () => {
		expect(daySchema.safeParse({ ...valid, kind: 'leave', blocks: [] }).success).toBe(true);
	});

	it('rejects an invalid block', () => {
		const result = daySchema.safeParse({
			...valid,
			blocks: [{ start: '09:00', end: '09:00', breakMinutes: 0 }]
		});
		expect(result.success).toBe(false);
	});

	it('rejects a malformed block time without throwing', () => {
		const result = daySchema.safeParse({
			...valid,
			blocks: [{ start: '9:00', end: '17:06', breakMinutes: 30 }]
		});
		expect(result.success).toBe(false);
	});

	it('rejects an unknown kind', () => {
		expect(daySchema.safeParse({ ...valid, kind: 'holiday' }).success).toBe(false);
	});

	it('rejects overlapping blocks, in whatever order they are submitted', () => {
		const overlapping = [
			{ start: '13:00', end: '15:00', breakMinutes: 0 },
			{ start: '09:00', end: '14:00', breakMinutes: 0 } // ends after the other starts
		];
		expect(daySchema.safeParse({ ...valid, blocks: overlapping }).success).toBe(false);
	});

	it('accepts back-to-back, non-overlapping blocks', () => {
		const backToBack = [
			{ start: '09:00', end: '12:00', breakMinutes: 0 },
			{ start: '12:00', end: '15:00', breakMinutes: 0 }
		];
		expect(daySchema.safeParse({ ...valid, blocks: backToBack }).success).toBe(true);
	});

	it('does not report a false overlap when a block is already malformed', () => {
		const result = daySchema.safeParse({
			...valid,
			blocks: [{ start: '9:00', end: '17:06', breakMinutes: 30 }]
		});
		expect(result.success).toBe(false);
	});
});

describe('holidaySchema', () => {
	it('accepts a valid custom holiday', () => {
		expect(
			holidaySchema.safeParse({
				date: '2026-11-03',
				name: 'Melbourne Cup',
				region: 'AU-VIC',
				repeatsYearly: true,
				disabled: false
			}).success
		).toBe(true);
	});

	it('rejects a blank name', () => {
		expect(
			holidaySchema.safeParse({
				date: '2026-11-03',
				name: '',
				region: 'AU-VIC',
				repeatsYearly: true,
				disabled: false
			}).success
		).toBe(false);
	});
});

describe('leaveRangeSchema', () => {
	it('accepts a valid range', () => {
		expect(
			leaveRangeSchema.safeParse({ from: '2026-12-24', to: '2026-12-31', kind: 'leave' }).success
		).toBe(true);
	});

	it('accepts a single-day range', () => {
		expect(
			leaveRangeSchema.safeParse({ from: '2026-12-24', to: '2026-12-24', kind: 'sick' }).success
		).toBe(true);
	});

	it('rejects a range that ends before it starts', () => {
		expect(
			leaveRangeSchema.safeParse({ from: '2026-12-31', to: '2026-12-24', kind: 'leave' }).success
		).toBe(false);
	});
});

describe('firstFieldError', () => {
	it('returns null for no errors', () => {
		expect(firstFieldError(undefined)).toBeNull();
		expect(firstFieldError(null)).toBeNull();
	});

	it('returns null when every field has no messages', () => {
		expect(firstFieldError({ name: undefined })).toBeNull();
	});

	it('returns the first message, in field-declaration order', () => {
		const parsed = officeSchema.safeParse({ name: '', address: null });
		expect(firstFieldError(parsed.success ? undefined : parsed.error.flatten().fieldErrors)).toBe(
			'Name the office'
		);
	});
});
