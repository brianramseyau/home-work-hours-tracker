import { describe, expect, it } from 'vitest';
import { buildDiaryDays, countsByDisplayType, groupDiaryDaysByWeek } from './diary';

const STANDARD = { start: '09:00', end: '17:06', breakMinutes: 30 };

function homeWeekdaySchedule() {
	return [
		{
			effectiveFrom: '2026-07-01',
			cycleWeeks: 1 as const,
			anchorMonday: '2026-06-29',
			days: [1, 2, 3, 4, 5].map((weekday) => ({
				weekIndex: 0,
				weekday,
				mode: 'home' as const,
				officeId: null
			}))
		}
	];
}

describe('buildDiaryDays', () => {
	it('marks an existing row as recorded, with its own source', () => {
		const rows = buildDiaryDays({
			startYear: 2026,
			today: '2026-09-14', // a Monday
			days: [
				{
					date: '2026-09-14',
					kind: 'work',
					officeId: null,
					notes: 'Focus day',
					source: 'manual',
					blocks: [STANDARD]
				}
			],
			schedules: [],
			holidays: [],
			standard: STANDARD,
			includeWeekends: false
		});

		const monday = rows.find((row) => row.date === '2026-09-14');
		expect(monday).toMatchObject({
			status: 'recorded',
			source: 'manual',
			displayType: 'home',
			homeMinutes: 456,
			notes: 'Focus day'
		});
	});

	it('previews the rest of the current week from the schedule, as ghost rows', () => {
		const rows = buildDiaryDays({
			startYear: 2026,
			today: '2026-09-14', // Monday of week 11
			days: [],
			schedules: homeWeekdaySchedule(),
			holidays: [],
			standard: STANDARD,
			includeWeekends: false
		});

		const tuesday = rows.find((row) => row.date === '2026-09-15');
		expect(tuesday).toMatchObject({ status: 'ghost', source: null, displayType: 'home' });
	});

	it('lets a holiday take priority over the schedule within a ghost preview', () => {
		const rows = buildDiaryDays({
			startYear: 2026,
			today: '2026-09-14',
			days: [],
			schedules: homeWeekdaySchedule(),
			holidays: [{ date: '2026-09-15' }],
			standard: STANDARD,
			includeWeekends: false
		});

		const tuesday = rows.find((row) => row.date === '2026-09-15');
		expect(tuesday).toMatchObject({ status: 'ghost', kind: 'public_holiday' });
	});

	it('does not preview past the end of the current week', () => {
		const rows = buildDiaryDays({
			startYear: 2026,
			today: '2026-09-14', // Monday
			days: [],
			schedules: homeWeekdaySchedule(),
			holidays: [],
			standard: STANDARD,
			includeWeekends: false
		});

		// The following Monday is a new week — not a ghost preview, and not yet reached either.
		const nextMonday = rows.find((row) => row.date === '2026-09-21');
		expect(nextMonday).toMatchObject({ status: 'future', displayType: 'off' });
	});

	it('marks a past day with no row as off, not future', () => {
		const rows = buildDiaryDays({
			startYear: 2026,
			today: '2026-09-14',
			days: [],
			schedules: [],
			holidays: [],
			standard: STANDARD,
			includeWeekends: false
		});

		const earlierMonday = rows.find((row) => row.date === '2026-09-07');
		expect(earlierMonday).toMatchObject({ status: 'off', displayType: 'off', homeMinutes: 0 });
	});

	it('has no ghost rows at all when today is the last visible day of the week', () => {
		const rows = buildDiaryDays({
			startYear: 2026,
			today: '2026-09-18', // Friday, and weekends are hidden
			days: [],
			schedules: homeWeekdaySchedule(),
			holidays: [],
			standard: STANDARD,
			includeWeekends: false
		});

		expect(rows.some((row) => row.status === 'ghost')).toBe(false);
	});

	it('previews Saturday when weekends are included and the week is not over yet', () => {
		const rows = buildDiaryDays({
			startYear: 2026,
			today: '2026-09-18', // Friday
			days: [],
			schedules: [
				{
					effectiveFrom: '2026-07-01',
					cycleWeeks: 1,
					anchorMonday: '2026-06-29',
					days: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
						weekIndex: 0,
						weekday,
						mode: 'home' as const,
						officeId: null
					}))
				}
			],
			holidays: [],
			standard: STANDARD,
			includeWeekends: true
		});

		const saturday = rows.find((row) => row.date === '2026-09-19');
		expect(saturday).toMatchObject({ status: 'ghost', displayType: 'home' });
	});

	it('has no ghost rows when viewing a financial year other than the current one', () => {
		const rows = buildDiaryDays({
			startYear: 2027, // FY28, while today is in FY27
			today: '2026-09-14',
			days: [],
			schedules: homeWeekdaySchedule(),
			holidays: [],
			standard: STANDARD,
			includeWeekends: false
		});

		expect(rows.every((row) => row.status === 'future')).toBe(true);
	});

	it('treats every day of an entirely past financial year as off, not future', () => {
		const rows = buildDiaryDays({
			startYear: 2024, // FY25, well before today
			today: '2026-09-14',
			days: [],
			schedules: [],
			holidays: [],
			standard: STANDARD,
			includeWeekends: false
		});

		expect(rows.every((row) => row.status === 'off')).toBe(true);
	});
});

describe('countsByDisplayType', () => {
	it('counts only recorded days, by their display type', () => {
		const rows = buildDiaryDays({
			startYear: 2026,
			today: '2026-09-14',
			days: [
				{
					date: '2026-09-14',
					kind: 'work',
					officeId: null,
					notes: null,
					source: 'manual',
					blocks: [STANDARD]
				},
				{
					date: '2026-09-08',
					kind: 'leave',
					officeId: null,
					notes: null,
					source: 'manual',
					blocks: []
				}
			],
			schedules: [],
			holidays: [],
			standard: STANDARD,
			includeWeekends: false
		});

		const counts = countsByDisplayType(rows);
		expect(counts.home).toBe(1);
		expect(counts.leave).toBe(1);
		expect(counts.off).toBe(0); // every un-recorded day is excluded, not counted as off
	});
});

describe('groupDiaryDaysByWeek', () => {
	it('groups days into one array per week, in week order', () => {
		const rows = buildDiaryDays({
			startYear: 2026,
			today: '2026-09-14',
			days: [],
			schedules: [],
			holidays: [],
			standard: STANDARD,
			includeWeekends: false
		});

		const weeks = groupDiaryDaysByWeek(rows);
		expect(weeks[0].every((day) => day.week === weeks[0][0].week)).toBe(true);
		expect(weeks.map((week) => week[0].week)).toEqual(
			[...weeks.map((week) => week[0].week)].sort((a, b) => a - b)
		);
		expect(weeks.flat().length).toBe(rows.length);
	});
});
