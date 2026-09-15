// Builds one row per date in a financial year for the Diary and the year punch card: a
// persisted day where one exists, a schedule-derived "ghost" preview for every day after today
// that has none, or an empty placeholder otherwise. Pure — no DB, no `Date.now()`.

import { addDays, weekday as weekdayOf } from './date';
import type { Day, DayKind, DaySource, DisplayType, HomeBlock } from './dayType';
import { displayType, displayTypeLabel, DISPLAY_TYPES } from './dayType';
import { datesInFy, fyBounds, weekOfFy } from './fy';
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
	/** A finalised year is frozen — nothing is ever planned into it again, so nothing is previewed. */
	finalised?: boolean;
}

export type ScheduledDayInput = Pick<
	BuildDiaryDaysInput,
	'schedules' | 'holidays' | 'standard' | 'includeWeekends'
>;

/** What the schedule will make `date` once it's reached, or `null` for a day it leaves off. */
export function scheduledDay(date: string, input: ScheduledDayInput): Day | null {
	return planPrefill({ from: date, to: date, existing: [], ...input }).inserts[0] ?? null;
}

/** What a diary day reads as. A day not reached yet, with nothing scheduled, isn't "Off" yet. */
export function diaryDayLabel(day: DiaryDay): string {
	return day.status === 'future' ? 'Not yet' : displayTypeLabel(day.displayType);
}

/** A day after today — hatched on the punch card whatever the schedule previews for it. */
export function isUpcoming(day: DiaryDay): boolean {
	return day.status === 'ghost' || day.status === 'future';
}

/**
 * The name of the office a day was worked at, or null if it has none (or the office no longer
 * exists). Archived offices are included in `offices`, so a day recorded before its office was
 * archived still resolves its name.
 */
export function diaryOfficeName(
	day: Pick<DiaryDay, 'officeId'>,
	offices: { id: number; name: string }[]
): string | null {
	if (day.officeId === null) return null;
	return offices.find((office) => office.id === day.officeId)?.name ?? null;
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

	// Future days aren't stored until they're reached (see autoPrefill.ts), so every day after
	// today without a row previews what the schedule will make it — otherwise the rest of the
	// year would read as a run of "Off" days that simply haven't happened yet.
	const bounds = fyBounds(input.startYear);
	const tomorrow = addDays(input.today, 1);
	const ghostFrom = tomorrow > bounds.start ? tomorrow : bounds.start;
	const ghostByDate =
		!input.finalised && ghostFrom <= bounds.end
			? new Map(
					planPrefill({
						from: ghostFrom,
						to: bounds.end,
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
