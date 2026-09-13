// Resolves what a given date should be, from the weekly/fortnightly working pattern. Pure:
// callers pass in the schedule versions already loaded from the repo layer.

import { daysBetween, mondayOf, weekday } from './date';

export type ScheduleMode = 'home' | 'office' | 'off';

export interface ScheduleDay {
	weekIndex: number; // 0, or 0|1 for a fortnightly cycle
	weekday: number; // 1 = Mon … 7 = Sun
	mode: ScheduleMode;
	officeId: number | null;
}

export interface Schedule {
	effectiveFrom: string; // ISO date
	cycleWeeks: 1 | 2;
	anchorMonday: string; // ISO date, a Monday; counts as week index 0
	days: ScheduleDay[];
}

/** The schedule version in effect on `iso`: the latest whose `effectiveFrom` is on or before it. */
export function resolveSchedule(schedules: Schedule[], iso: string): Schedule | null {
	const candidates = schedules.filter((schedule) => schedule.effectiveFrom <= iso);
	if (candidates.length === 0) return null;
	return candidates.reduce((latest, candidate) =>
		candidate.effectiveFrom > latest.effectiveFrom ? candidate : latest
	);
}

/** Which week of the schedule's cycle `iso` falls in (0 for a weekly schedule). */
export function cycleWeekIndex(schedule: Schedule, iso: string): number {
	const weeksSinceAnchor = daysBetween(schedule.anchorMonday, mondayOf(iso)) / 7;
	// `%` in JS can return a negative result for a negative dividend (a date whose week is
	// before the anchor); floor-mod that back into [0, cycleWeeks).
	return ((weeksSinceAnchor % schedule.cycleWeeks) + schedule.cycleWeeks) % schedule.cycleWeeks;
}

export interface ResolvedMode {
	mode: ScheduleMode;
	officeId: number | null;
}

/**
 * What the schedule says for `iso`: `null` when no schedule is in effect yet. A weekday with no
 * matching `ScheduleDay` in the schedule's `days` is treated as `off`.
 */
export function modeFor(schedules: Schedule[], iso: string): ResolvedMode | null {
	const schedule = resolveSchedule(schedules, iso);
	if (!schedule) return null;

	const weekIndex = cycleWeekIndex(schedule, iso);
	const day = schedule.days.find((d) => d.weekIndex === weekIndex && d.weekday === weekday(iso));
	return day ? { mode: day.mode, officeId: day.officeId } : { mode: 'off', officeId: null };
}
