import { describe, expect, it } from 'vitest';
import { cycleWeekIndex, modeFor, resolveSchedule, type Schedule } from './schedule';

const fortnightly: Schedule = {
	effectiveFrom: '2026-07-01',
	cycleWeeks: 2,
	anchorMonday: '2026-07-06',
	days: [
		{ weekIndex: 0, weekday: 1, mode: 'home', officeId: null },
		{ weekIndex: 0, weekday: 2, mode: 'office', officeId: 1 },
		{ weekIndex: 0, weekday: 3, mode: 'home', officeId: null },
		{ weekIndex: 0, weekday: 4, mode: 'office', officeId: 2 },
		{ weekIndex: 0, weekday: 5, mode: 'home', officeId: null },
		{ weekIndex: 1, weekday: 1, mode: 'home', officeId: null },
		{ weekIndex: 1, weekday: 2, mode: 'home', officeId: null },
		{ weekIndex: 1, weekday: 3, mode: 'office', officeId: 1 },
		{ weekIndex: 1, weekday: 4, mode: 'home', officeId: null },
		{ weekIndex: 1, weekday: 5, mode: 'office', officeId: 2 }
	]
};

describe('resolveSchedule', () => {
	it('is null when no schedule has started yet', () => {
		expect(resolveSchedule([fortnightly], '2026-06-30')).toBeNull();
	});

	it('picks the schedule whose effectiveFrom is on the date', () => {
		expect(resolveSchedule([fortnightly], '2026-07-01')).toBe(fortnightly);
	});

	it('picks the latest schedule that has started, when several have', () => {
		const changed: Schedule = { ...fortnightly, effectiveFrom: '2027-01-01', cycleWeeks: 1 };
		expect(resolveSchedule([fortnightly, changed], '2026-12-31')).toBe(fortnightly);
		expect(resolveSchedule([fortnightly, changed], '2027-01-01')).toBe(changed);
		expect(resolveSchedule([fortnightly, changed], '2027-06-01')).toBe(changed);
	});

	it('is unaffected by an earlier candidate appearing after a later one', () => {
		const changed: Schedule = { ...fortnightly, effectiveFrom: '2027-01-01', cycleWeeks: 1 };
		const evenEarlier: Schedule = { ...fortnightly, effectiveFrom: '2026-01-01' };
		expect(resolveSchedule([fortnightly, changed, evenEarlier], '2027-06-01')).toBe(changed);
	});
});

describe('cycleWeekIndex', () => {
	it('is always 0 for a weekly (cycleWeeks: 1) schedule', () => {
		const weekly: Schedule = { ...fortnightly, cycleWeeks: 1 };
		expect(cycleWeekIndex(weekly, '2026-07-06')).toBe(0);
		expect(cycleWeekIndex(weekly, '2026-07-13')).toBe(0);
	});

	it('alternates forward from the anchor week', () => {
		expect(cycleWeekIndex(fortnightly, '2026-07-06')).toBe(0);
		expect(cycleWeekIndex(fortnightly, '2026-07-10')).toBe(0); // same week, Friday
		expect(cycleWeekIndex(fortnightly, '2026-07-13')).toBe(1);
		expect(cycleWeekIndex(fortnightly, '2026-07-20')).toBe(0);
	});

	it('alternates correctly for weeks before the anchor', () => {
		expect(cycleWeekIndex(fortnightly, '2026-06-29')).toBe(1);
		expect(cycleWeekIndex(fortnightly, '2026-06-22')).toBe(0);
	});
});

describe('modeFor', () => {
	it('is null before any schedule has started', () => {
		expect(modeFor([fortnightly], '2026-06-30')).toBeNull();
	});

	it('resolves the mode and office for the cycle week in effect', () => {
		// 2026-07-01 is a Wednesday in the anchor week's preceding cycle (week index 1).
		expect(modeFor([fortnightly], '2026-07-01')).toEqual({ mode: 'office', officeId: 1 });
		// 2026-07-08 is the Wednesday of week index 0.
		expect(modeFor([fortnightly], '2026-07-08')).toEqual({ mode: 'home', officeId: null });
	});

	it('treats a weekday with no configured ScheduleDay as off', () => {
		expect(modeFor([fortnightly], '2026-07-11')).toEqual({ mode: 'off', officeId: null }); // Saturday
	});
});
