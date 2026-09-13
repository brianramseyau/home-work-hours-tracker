// Wires the pure prefill planner to the repo layer. This is the only place that decides *when*
// to plan (the watermark, finalised-year checks) and *applies* the plan in a transaction; the
// decision of *what* a date should be lives entirely in `core/prefill.ts`.

import { addDays } from '$lib/core/date';
import type { HomeBlock } from '$lib/core/dayType';
import { fyBounds, fyStartYear } from '$lib/core/fy';
import { planPrefill } from '$lib/core/prefill';
import type { Schedule } from '$lib/core/schedule';
import type { Db } from './db/create';
import { effectiveHolidays } from './holidays';
import { deleteDay, listRange, upsertDay } from './repo/days';
import { listHolidays } from './repo/holidays';
import { listSchedules } from './repo/schedules';
import { getSettings, setPrefilledThrough } from './repo/settings';
import { getYear } from './repo/years';

export interface EnsurePrefilledResult {
	filled: number; // inserts + updates + deletes applied, across every non-finalised FY touched
}

/**
 * Materialises days from the watermark through `today`, and advances the watermark. Cheap and
 * idempotent: calling it again with the same `today` and no data changes applies nothing.
 */
export function ensurePrefilled(db: Db, today: string): EnsurePrefilledResult {
	const settings = getSettings(db);
	const schedules = listSchedules(db);

	const from = startOfPlanning(settings.prefilledThrough, schedules, today);
	if (!from || from > today) return { filled: 0 };

	const filled = applyPlanAcrossYears(db, {
		from,
		to: today,
		schedules,
		holidayRegion: settings.holidayRegion,
		standard: standardBlockOf(settings),
		includeWeekends: settings.includeWeekends
	});

	setPrefilledThrough(db, today);
	return { filled };
}

/**
 * Re-plans `prefill` rows from `fromDate` up to the current watermark, for a schedule, standard
 * hours or holiday change that reaches into the past. Does nothing if there's no watermark yet,
 * or `fromDate` is already past it.
 */
export function replanFrom(db: Db, fromDate: string): EnsurePrefilledResult {
	const settings = getSettings(db);
	if (!settings.prefilledThrough || fromDate > settings.prefilledThrough) return { filled: 0 };

	const filled = applyPlanAcrossYears(db, {
		from: fromDate,
		to: settings.prefilledThrough,
		schedules: listSchedules(db),
		holidayRegion: settings.holidayRegion,
		standard: standardBlockOf(settings),
		includeWeekends: settings.includeWeekends
	});

	return { filled };
}

/** Raises the watermark without planning anything, so an import never back-fills its own gaps. */
export function raiseWatermark(db: Db, date: string): void {
	const settings = getSettings(db);
	if (!settings.prefilledThrough || date > settings.prefilledThrough) {
		setPrefilledThrough(db, date);
	}
}

function standardBlockOf(settings: {
	standardStart: string;
	standardEnd: string;
	standardBreakMinutes: number;
}): HomeBlock {
	return {
		start: settings.standardStart,
		end: settings.standardEnd,
		breakMinutes: settings.standardBreakMinutes
	};
}

interface PlanRangeInput {
	from: string;
	to: string;
	schedules: Schedule[];
	holidayRegion: string;
	standard: HomeBlock;
	includeWeekends: boolean;
}

/** Applies the plan for [from, to], one financial year at a time, skipping finalised ones. */
function applyPlanAcrossYears(db: Db, input: PlanRangeInput): number {
	let filled = 0;
	for (const segment of fySegments(input.from, input.to)) {
		const year = getYear(db, segment.startYear);
		if (year?.finalisedAt) continue;
		filled += applyPlan(db, { ...input, from: segment.start, to: segment.end });
	}
	return filled;
}

function applyPlan(db: Db, input: PlanRangeInput): number {
	const existing = listRange(db, input.from, input.to);
	const holidayRows = listHolidays(db, input.holidayRegion);
	const holidays = effectiveHolidays(
		holidayRows.filter((row) => row.source === 'bundled'),
		holidayRows.filter((row) => row.source === 'custom'),
		{ startYear: fyStartYear(input.from) }
	);

	const plan = planPrefill({
		from: input.from,
		to: input.to,
		existing,
		schedules: input.schedules,
		holidays,
		standard: input.standard,
		includeWeekends: input.includeWeekends
	});

	const now = new Date().toISOString();
	for (const day of [...plan.inserts, ...plan.updates]) upsertDay(db, day, now);
	for (const date of plan.deletes) deleteDay(db, date);

	return plan.inserts.length + plan.updates.length + plan.deletes.length;
}

/** Splits [from, to] at every financial-year boundary it crosses. */
function fySegments(from: string, to: string): { start: string; end: string; startYear: number }[] {
	const segments: { start: string; end: string; startYear: number }[] = [];
	let cursor = from;
	while (cursor <= to) {
		const startYear = fyStartYear(cursor);
		const fyEnd = fyBounds(startYear).end;
		const segmentEnd = fyEnd < to ? fyEnd : to;
		segments.push({ start: cursor, end: segmentEnd, startYear });
		cursor = addDays(segmentEnd, 1);
	}
	return segments;
}

/** The date to start planning from: the day after the watermark, or the later of the first
 *  schedule's start and the current financial year's start when there's no watermark yet. */
function startOfPlanning(
	prefilledThrough: string | null,
	schedules: Schedule[],
	today: string
): string | null {
	if (prefilledThrough) return addDays(prefilledThrough, 1);
	if (schedules.length === 0) return null;

	// `listSchedules` always returns its rows ordered by effectiveFrom ascending, so the first
	// one is the earliest.
	const earliestSchedule = schedules[0].effectiveFrom;
	const currentFyStart = fyBounds(fyStartYear(today)).start;
	return earliestSchedule > currentFyStart ? earliestSchedule : currentFyStart;
}
