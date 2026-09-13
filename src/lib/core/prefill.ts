// The auto-prefill planner. Pure: given a date range, the schedule versions, the effective
// holidays and the existing day rows, it decides what should change. It never proposes a change
// to a `manual` or `import` row, and running it again against its own output is a no-op.

import { eachDate, isWeekend } from './date';
import type { Day, HomeBlock } from './dayType';
import { modeFor, type Schedule } from './schedule';

export interface PrefillHoliday {
	date: string; // ISO date
}

export interface PrefillInput {
	from: string; // ISO date, inclusive
	to: string; // ISO date, inclusive
	/** Day rows already on record for (at least) this range, of any source. */
	existing: Day[];
	schedules: Schedule[];
	holidays: PrefillHoliday[];
	/** The block used for a `home` scheduled day. */
	standard: HomeBlock;
	/**
	 * Weekend dates are only ever planned when this is true. It's a belt-and-braces guard: the
	 * schedule editor doesn't expose Sat/Sun cells while "Include weekends" is off, so a weekend
	 * day would default to `off` anyway, but this makes the rule explicit and independent of
	 * whatever the schedule happens to contain.
	 */
	includeWeekends: boolean;
}

export interface PrefillPlan {
	inserts: Day[];
	updates: Day[];
	deletes: string[]; // dates of prefill rows to remove
}

export function planPrefill(input: PrefillInput): PrefillPlan {
	const existingByDate = new Map(input.existing.map((day) => [day.date, day]));
	const holidayDates = new Set(input.holidays.map((holiday) => holiday.date));

	const inserts: Day[] = [];
	const updates: Day[] = [];
	const deletes: string[] = [];

	for (const date of eachDate(input.from, input.to)) {
		if (isWeekend(date) && !input.includeWeekends) continue;

		const desired = desiredDay(date, holidayDates, input.schedules, input.standard);
		const current = existingByDate.get(date);

		if (!current) {
			if (desired) inserts.push(desired);
			continue;
		}

		if (current.source !== 'prefill') continue; // manual and import rows are never touched

		if (!desired) {
			deletes.push(date);
		} else if (!sameDay(current, desired)) {
			updates.push(desired);
		}
	}

	return { inserts, updates, deletes };
}

/** What `date` should be, or `null` when it should have no row at all (an "off" day). */
function desiredDay(
	date: string,
	holidayDates: Set<string>,
	schedules: Schedule[],
	standard: HomeBlock
): Day | null {
	if (holidayDates.has(date)) {
		return {
			date,
			kind: 'public_holiday',
			officeId: null,
			notes: null,
			source: 'prefill',
			blocks: []
		};
	}

	const resolved = modeFor(schedules, date);
	if (!resolved || resolved.mode === 'off') return null;

	if (resolved.mode === 'home') {
		return {
			date,
			kind: 'work',
			officeId: null,
			notes: null,
			source: 'prefill',
			blocks: [standard]
		};
	}

	return {
		date,
		kind: 'work',
		officeId: resolved.officeId,
		notes: null,
		source: 'prefill',
		blocks: []
	};
}

function sameDay(a: Day, b: Day): boolean {
	return (
		a.kind === b.kind &&
		a.officeId === b.officeId &&
		a.blocks.length === b.blocks.length &&
		a.blocks.every((block, index) => sameBlock(block, b.blocks[index]))
	);
}

function sameBlock(a: HomeBlock, b: HomeBlock): boolean {
	return a.start === b.start && a.end === b.end && a.breakMinutes === b.breakMinutes;
}
