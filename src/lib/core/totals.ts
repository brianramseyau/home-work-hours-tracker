// Minutes and claim arithmetic. Everything is summed in integer minutes; the claim is
// converted to cents once, at the end, never per day or per block (see AGENTS.md domain rules).

import type { Day, DayKind } from './dayType';
import { weekOfFy } from './fy';
import { blockMinutes } from './time';

/** A work day's worked-from-home minutes (0 for every other kind, or a work day with none). */
export function dayHomeMinutes(day: Pick<Day, 'kind' | 'blocks'>): number {
	if (day.kind !== 'work') return 0;
	return day.blocks.reduce((sum, block) => sum + blockMinutes(block), 0);
}

export interface MonthTotal {
	month: string; // YYYY-MM
	minutes: number;
}

export interface WeekTotal {
	week: number;
	minutes: number;
}

export interface Summary {
	homeMinutes: number;
	byMonth: MonthTotal[];
	byWeek: WeekTotal[];
	kindCounts: Record<DayKind, number>;
}

const EMPTY_KIND_COUNTS: Record<DayKind, number> = {
	work: 0,
	leave: 0,
	sick: 0,
	public_holiday: 0,
	off: 0
};

/** Summarises a set of day records (typically one financial year's rows) for the year view. */
export function summarise(days: Pick<Day, 'date' | 'kind' | 'blocks'>[]): Summary {
	const kindCounts = { ...EMPTY_KIND_COUNTS };
	const byMonthMap = new Map<string, number>();
	const byWeekMap = new Map<number, number>();
	let homeMinutes = 0;

	for (const day of days) {
		kindCounts[day.kind] += 1;
		const minutes = dayHomeMinutes(day);
		if (minutes === 0) continue;

		homeMinutes += minutes;
		const month = day.date.slice(0, 7);
		byMonthMap.set(month, (byMonthMap.get(month) ?? 0) + minutes);
		const week = weekOfFy(day.date);
		byWeekMap.set(week, (byWeekMap.get(week) ?? 0) + minutes);
	}

	const byMonth = [...byMonthMap.entries()]
		.map(([month, minutes]) => ({ month, minutes }))
		.sort((a, b) => a.month.localeCompare(b.month));
	const byWeek = [...byWeekMap.entries()]
		.map(([week, minutes]) => ({ week, minutes }))
		.sort((a, b) => a.week - b.week);

	return { homeMinutes, byMonth, byWeek, kindCounts };
}

/** The ATO fixed-rate claim, in cents, rounded once at the end. */
export function claimCents(totalMinutes: number, rateCentsPerHour: number): number {
	return Math.round((totalMinutes * rateCentsPerHour) / 60);
}

/**
 * Splits a claim across an ordered group (e.g. one entry per month) so the parts sum to exactly
 * `claimCents(sum(minutesList), rateCentsPerHour)` — rounding each entry independently can drift
 * from the year total (AGENTS.md: round once, at the end). Uses cumulative (largest-remainder
 * style) rounding: each entry gets whatever rounds the running total correctly, so the drift
 * never accumulates past a single cent and the parts always reconcile with the whole.
 */
export function claimCentsByGroup(minutesList: number[], rateCentsPerHour: number): number[] {
	// Accumulates integer minutes, not floating-point cents: `claimCents` rounds the exactly
	// representable `totalMinutes × rateCentsPerHour / 60`, and summing float terms along the way
	// (rather than the integer minutes themselves) can drift a hair off that — the exact one-cent
	// mismatch this helper exists to remove. Telescoping this way makes the running total, and so
	// the final entry, identical to calling `claimCents` on the whole group.
	let cumulativeMinutes = 0;
	let cumulativeRounded = 0;
	return minutesList.map((minutes) => {
		cumulativeMinutes += minutes;
		const roundedSoFar = claimCents(cumulativeMinutes, rateCentsPerHour);
		const entryClaim = roundedSoFar - cumulativeRounded;
		cumulativeRounded = roundedSoFar;
		return entryClaim;
	});
}
