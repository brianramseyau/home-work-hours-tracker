import { beforeEach, describe, expect, it } from 'vitest';
import { ensurePrefilled, raiseWatermark, replanFrom } from './autoPrefill';
import { createDb, type Db } from './db/create';
import { getDay, listRange, upsertDay } from './repo/days';
import { createOffice } from './repo/offices';
import { replaceBundledHolidays } from './repo/holidays';
import { createSchedule } from './repo/schedules';
import { getSettings, updateSettings } from './repo/settings';
import { createYear, finaliseYear } from './repo/years';

let db: Db;

beforeEach(() => {
	db = createDb(':memory:');
});

function homeWeekdaySchedule(effectiveFrom: string, anchorMonday: string) {
	createSchedule(db, {
		effectiveFrom,
		cycleWeeks: 1,
		anchorMonday,
		days: [1, 2, 3, 4, 5].map((weekday) => ({
			weekIndex: 0,
			weekday,
			mode: 'home' as const,
			officeId: null
		}))
	});
}

describe('ensurePrefilled', () => {
	it('does nothing when there is no schedule yet', () => {
		expect(ensurePrefilled(db, '2026-09-14')).toEqual({ filled: 0 });
		expect(listRange(db, '2026-07-01', '2027-06-30')).toEqual([]);
	});

	it('fills weekdays from the schedule through today, and advances the watermark', () => {
		homeWeekdaySchedule('2026-07-01', '2026-06-29');
		// Weekdays 1–8 Jul: Wed/Thu/Fri, then Mon/Tue/Wed (weekend 4th/5th excluded) = 6 days.
		const result = ensurePrefilled(db, '2026-07-08');

		expect(result.filled).toBe(6);
		expect(getSettings(db).prefilledThrough).toBe('2026-07-08');
		expect(getDay(db, '2026-07-06')).toMatchObject({ kind: 'work', source: 'prefill' });
		expect(getDay(db, '2026-07-04')).toBeNull(); // Saturday, unscheduled
	});

	it('is idempotent: a second call with the same today applies nothing further', () => {
		homeWeekdaySchedule('2026-07-01', '2026-06-29');
		ensurePrefilled(db, '2026-07-08');
		expect(ensurePrefilled(db, '2026-07-08')).toEqual({ filled: 0 });
	});

	it('only fills the days since the watermark on a later call', () => {
		homeWeekdaySchedule('2026-07-01', '2026-06-29');
		ensurePrefilled(db, '2026-07-06'); // fills 1–3 and 6 Jul
		const second = ensurePrefilled(db, '2026-07-08'); // fills just 7–8 Jul
		expect(second.filled).toBe(2);
	});

	it('starts from the current FY, not an older schedule start, on first run', () => {
		// The schedule has been in effect since well before the current FY.
		homeWeekdaySchedule('2020-01-06', '2020-01-06');
		const result = ensurePrefilled(db, '2026-07-02'); // Thu, 2 days into FY27

		expect(result.filled).toBe(2); // 07-01 (Wed), 07-02 (Thu) — not back to 2020
		expect(getDay(db, '2020-01-06')).toBeNull();
	});

	it('finds the earliest schedule regardless of creation order, on first run', () => {
		homeWeekdaySchedule('2026-07-08', '2026-07-06'); // created first, but starts later
		homeWeekdaySchedule('2020-01-06', '2020-01-06'); // created second, but starts earlier
		const result = ensurePrefilled(db, '2026-07-02');
		// The earliest schedule (2020) is still before the current FY start, so FY start wins.
		expect(result.filled).toBe(2); // 07-01 (Wed), 07-02 (Thu)
	});

	it('starts from the schedule start when it begins after the current FY start', () => {
		homeWeekdaySchedule('2026-07-08', '2026-07-06'); // starts on the second Wednesday
		const result = ensurePrefilled(db, '2026-07-08');
		expect(result.filled).toBe(1); // only 07-08 itself
		expect(getDay(db, '2026-07-01')).toBeNull();
	});

	it('respects a public holiday over the schedule', () => {
		homeWeekdaySchedule('2026-07-01', '2026-06-29');
		updateSettings(db, { holidayRegion: 'AU-VIC' });
		// Melbourne Cup, 2026-11-03, is a Tuesday the schedule would otherwise call home.
		replaceBundledHolidays(db, 'AU-VIC', [{ date: '2026-11-03', name: 'Melbourne Cup' }]);

		ensurePrefilled(db, '2026-11-03');
		expect(getDay(db, '2026-11-03')).toMatchObject({ kind: 'public_holiday' });
	});

	it('skips a finalised financial year entirely', () => {
		homeWeekdaySchedule('2026-07-01', '2026-06-29');
		createYear(db, { startYear: 2026, rateCentsPerHour: 70 });
		finaliseYear(db, 2026, '2026-07-10');

		const result = ensurePrefilled(db, '2026-07-08');
		expect(result.filled).toBe(0);
		expect(getDay(db, '2026-07-06')).toBeNull();
		expect(getSettings(db).prefilledThrough).toBe('2026-07-08'); // watermark still advances
	});

	it('fills the new FY but skips the finalised old one, across a FY boundary', () => {
		homeWeekdaySchedule('2026-01-05', '2026-01-05'); // Monday, weekly, home every weekday
		createYear(db, { startYear: 2025, rateCentsPerHour: 68 });
		finaliseYear(db, 2025, '2026-08-01');
		ensurePrefilled(db, '2026-06-29'); // establishes a watermark inside FY26 (finalised)

		const result = ensurePrefilled(db, '2026-07-02'); // crosses into FY27

		expect(getDay(db, '2026-06-30')).toBeNull(); // still in the finalised FY26
		expect(getDay(db, '2026-07-01')).toMatchObject({ kind: 'work' }); // Wed, in FY27
		expect(result.filled).toBe(2); // 07-01, 07-02 only
	});
});

describe('replanFrom', () => {
	it('re-plans prefill rows from a back-dated schedule change', () => {
		homeWeekdaySchedule('2026-06-01', '2026-06-01'); // earlier, so a 1 Jul version can replace it
		ensurePrefilled(db, '2026-07-10');

		const office = createOffice(db, { name: 'Office Location 1' });
		createSchedule(db, {
			effectiveFrom: '2026-07-01',
			cycleWeeks: 1,
			anchorMonday: '2026-06-29',
			days: [1, 2, 3, 4, 5].map((weekday) => ({
				weekIndex: 0,
				weekday,
				mode: weekday === 2 ? ('office' as const) : ('home' as const),
				officeId: weekday === 2 ? office.id : null
			}))
		});

		const result = replanFrom(db, '2026-07-01');
		expect(result.filled).toBeGreaterThan(0);
		expect(getDay(db, '2026-07-07')).toMatchObject({ kind: 'work', officeId: office.id });
	});

	it('does nothing when there is no watermark yet', () => {
		expect(replanFrom(db, '2026-07-01')).toEqual({ filled: 0 });
	});

	it('does nothing when fromDate is after the watermark', () => {
		homeWeekdaySchedule('2026-07-01', '2026-06-29');
		ensurePrefilled(db, '2026-07-06');
		expect(replanFrom(db, '2026-07-08')).toEqual({ filled: 0 });
	});

	it('leaves a manual override untouched', () => {
		homeWeekdaySchedule('2026-06-01', '2026-06-01'); // earlier, so a 1 Jul version can replace it
		ensurePrefilled(db, '2026-07-08');

		const manualDate = '2026-07-07';
		const dayBefore = getDay(db, manualDate);
		expect(dayBefore).not.toBeNull();

		// Simulate the user editing the day (source becomes 'manual'), then re-plan across it
		// with a schedule change that would otherwise turn every day off.
		upsertDay(
			db,
			{ ...dayBefore!, kind: 'leave', source: 'manual', notes: 'Rostered day off' },
			'2026-07-07T00:00:00.000Z'
		);

		createSchedule(db, {
			effectiveFrom: '2026-07-01',
			cycleWeeks: 1,
			anchorMonday: '2026-06-29',
			days: []
		});

		replanFrom(db, '2026-07-01');
		expect(getDay(db, manualDate)).toMatchObject({ kind: 'leave', source: 'manual' });
	});
});

describe('raiseWatermark', () => {
	it('sets the watermark without planning anything', () => {
		raiseWatermark(db, '2026-09-14');
		expect(getSettings(db).prefilledThrough).toBe('2026-09-14');
		expect(listRange(db, '2026-07-01', '2027-06-30')).toEqual([]);
	});

	it('never moves the watermark backwards', () => {
		raiseWatermark(db, '2026-09-14');
		raiseWatermark(db, '2026-01-01');
		expect(getSettings(db).prefilledThrough).toBe('2026-09-14');
	});

	it('does not back-fill the gap an import leaves behind', () => {
		homeWeekdaySchedule('2026-07-01', '2026-06-29');
		raiseWatermark(db, '2026-08-31'); // pretend an import committed through August

		const result = ensurePrefilled(db, '2026-09-02');
		expect(getDay(db, '2026-07-06')).toBeNull(); // never back-filled
		expect(result.filled).toBe(2); // just 09-01, 09-02
	});
});
