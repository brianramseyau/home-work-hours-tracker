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
