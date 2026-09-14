// Builds one row per date in a financial year for the Diary and the year punch card: a
// persisted day where one exists, a schedule-derived "ghost" preview for the rest of the
// current week, or an empty placeholder otherwise. Pure — no DB, no `Date.now()`.

import { addDays, mondayOf, weekday as weekdayOf } from './date';
import type { Day, DayKind, DaySource, DisplayType, HomeBlock } from './dayType';
import { displayType, DISPLAY_TYPES } from './dayType';
import { datesInFy, fyStartYear, weekOfFy } from './fy';
import { planPrefill, type PrefillHoliday } from './prefill';
import type { Schedule } from './schedule';
import { dayHomeMinutes } from './totals';

export type DiaryDayStatus = 'recorded' | 'ghost' | 'future' | 'off';

export interface DiaryDay {
	date: string;
	weekday: number; // 1 = Mon … 7 = Sun
	week: number; // week of the financial year, per fy.weekOfFy
	status: DiaryDayStatus;
	kind: DayKind;
	source: DaySource | null; // null for a status other than 'recorded'
	officeId: number | null;
	notes: string | null;
	blocks: HomeBlock[];
	homeMinutes: number;
	displayType: DisplayType;
}

export interface BuildDiaryDaysInput {
	startYear: number;
	today: string;
	/** Every persisted row already on record within the financial year. */
	days: Day[];
	schedules: Schedule[];
	holidays: PrefillHoliday[];
	standard: HomeBlock;
	includeWeekends: boolean;
}

/** The last date of "the rest of the current week" that ghost rows preview. */
function endOfCurrentWeek(today: string, includeWeekends: boolean): string {
	return addDays(mondayOf(today), includeWeekends ? 6 : 4);
}

function toDiaryDay(
	status: DiaryDayStatus,
	date: string,
	source: DaySource | null,
	day: Day
): DiaryDay {
	return {
		date,
		weekday: weekdayOf(date),
		week: weekOfFy(date),
		status,
		kind: day.kind,
		source,
		officeId: day.officeId,
		notes: day.notes,
		blocks: day.blocks,
		homeMinutes: dayHomeMinutes(day),
		displayType: displayType(day)
	};
}

const BLANK_DAY: Omit<Day, 'date'> = {
	kind: 'off',
	officeId: null,
	notes: null,
	source: 'prefill',
	blocks: []
};

/** Counts recorded days by display type (Home/Office/Split/…), for the year view's breakdown. */
export function countsByDisplayType(days: DiaryDay[]): Record<DisplayType, number> {
	const counts = Object.fromEntries(DISPLAY_TYPES.map((type) => [type, 0])) as Record<
		DisplayType,
		number
	>;
	for (const day of days) {
		if (day.status === 'recorded') counts[day.displayType] += 1;
	}
	return counts;
}

/** Groups a flat, date-ordered list of diary days into one array per week of the FY. */
export function groupDiaryDaysByWeek(days: DiaryDay[]): DiaryDay[][] {
	const weeks = new Map<number, DiaryDay[]>();
	for (const day of days) {
		const bucket = weeks.get(day.week) ?? [];
		bucket.push(day);
		weeks.set(day.week, bucket);
	}
	return [...weeks.entries()].sort(([a], [b]) => a - b).map(([, bucket]) => bucket);
}

export function buildDiaryDays(input: BuildDiaryDaysInput): DiaryDay[] {
	const existingByDate = new Map(input.days.map((day) => [day.date, day]));

	const isCurrentFy = fyStartYear(input.today) === input.startYear;
	const ghostFrom = addDays(input.today, 1);
	const ghostTo = endOfCurrentWeek(input.today, input.includeWeekends);
	const ghostByDate =
		isCurrentFy && ghostFrom <= ghostTo
			? new Map(
					planPrefill({
						from: ghostFrom,
						to: ghostTo,
						existing: [],
						schedules: input.schedules,
						holidays: input.holidays,
						standard: input.standard,
						includeWeekends: input.includeWeekends
					}).inserts.map((day) => [day.date, day])
				)
			: new Map<string, Day>();

	return datesInFy(input.startYear, { includeWeekends: input.includeWeekends }).map((date) => {
		const existing = existingByDate.get(date);
		if (existing) return toDiaryDay('recorded', date, existing.source, existing);

		const ghost = ghostByDate.get(date);
		if (ghost) return toDiaryDay('ghost', date, null, ghost);

		const status: DiaryDayStatus = date > input.today ? 'future' : 'off';
		return toDiaryDay(status, date, null, { date, ...BLANK_DAY });
	});
}
