import { describe, expect, it } from 'vitest';
import type { Day, HomeBlock } from './dayType';
import { planPrefill, type PrefillInput } from './prefill';
import type { Schedule } from './schedule';

const standard: HomeBlock = { start: '09:00', end: '17:06', breakMinutes: 30 };

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

function baseInput(overrides: Partial<PrefillInput> = {}): PrefillInput {
	return {
		from: '2026-07-06',
		to: '2026-07-17',
		existing: [],
		schedules: [fortnightly],
		holidays: [],
		standard,
		includeWeekends: false,
		...overrides
	};
}

function insertedFor(plan: ReturnType<typeof planPrefill>, date: string): Day | undefined {
	return plan.inserts.find((day) => day.date === date);
}

describe('planPrefill: fortnightly alternating two-office pattern', () => {
	it('assigns home and office days by the cycle week', () => {
		const plan = planPrefill(baseInput());

		// Week index 0 (starting 2026-07-06): Mon/Wed/Fri home, Tue office 1, Thu office 2.
		expect(insertedFor(plan, '2026-07-06')).toMatchObject({ kind: 'work', officeId: null });
		expect(insertedFor(plan, '2026-07-07')).toMatchObject({ kind: 'work', officeId: 1 });
		expect(insertedFor(plan, '2026-07-09')).toMatchObject({ kind: 'work', officeId: 2 });

		// Week index 1 (starting 2026-07-13): Mon/Tue/Thu home, Wed office 1, Fri office 2.
		expect(insertedFor(plan, '2026-07-13')).toMatchObject({ kind: 'work', officeId: null });
		expect(insertedFor(plan, '2026-07-14')).toMatchObject({ kind: 'work', officeId: null });
		expect(insertedFor(plan, '2026-07-15')).toMatchObject({ kind: 'work', officeId: 1 });
		expect(insertedFor(plan, '2026-07-17')).toMatchObject({ kind: 'work', officeId: 2 });
	});

	it('gives a home day exactly the standard block', () => {
		const plan = planPrefill(baseInput());
		expect(insertedFor(plan, '2026-07-06')?.blocks).toEqual([standard]);
	});

	it('gives an office day no blocks', () => {
		const plan = planPrefill(baseInput());
		expect(insertedFor(plan, '2026-07-07')?.blocks).toEqual([]);
	});
});

describe('planPrefill: mid-year schedule version change', () => {
	it('uses the new schedule from its effective date, and the old one before it', () => {
		const allHome: Schedule = {
			effectiveFrom: '2027-01-01',
			cycleWeeks: 1,
			anchorMonday: '2026-12-28',
			days: [1, 2, 3, 4, 5].map((weekday) => ({
				weekIndex: 0,
				weekday,
				mode: 'home' as const,
				officeId: null
			}))
		};

		const plan = planPrefill(
			baseInput({ from: '2026-12-28', to: '2027-01-04', schedules: [fortnightly, allHome] })
		);

		// 2026-12-30 (Wed) is still on the fortnightly schedule (week index 1 → office 1).
		expect(insertedFor(plan, '2026-12-30')).toMatchObject({ kind: 'work', officeId: 1 });
		// 2027-01-01 (Fri) is on the new all-home schedule.
		expect(insertedFor(plan, '2027-01-01')).toMatchObject({ kind: 'work', officeId: null });
	});
});

describe('planPrefill: a holiday on a scheduled office day', () => {
	it('makes the day a public holiday instead of an office day', () => {
		// 2026-07-07 is a Tuesday, scheduled as office 1 in week index 0.
		const plan = planPrefill(baseInput({ holidays: [{ date: '2026-07-07' }] }));
		expect(insertedFor(plan, '2026-07-07')).toEqual({
			date: '2026-07-07',
			kind: 'public_holiday',
			officeId: null,
			notes: null,
			source: 'prefill',
			blocks: []
		});
	});
});

describe('planPrefill: weekends', () => {
	it('skips weekend dates when includeWeekends is off, even so', () => {
		const plan = planPrefill(baseInput({ to: '2026-07-12' })); // includes Sat 11th, Sun 12th
		expect(insertedFor(plan, '2026-07-11')).toBeUndefined();
		expect(insertedFor(plan, '2026-07-12')).toBeUndefined();
	});

	it('plans a weekend date when includeWeekends is on and the schedule covers it', () => {
		const weekendSchedule: Schedule = {
			...fortnightly,
			days: [...fortnightly.days, { weekIndex: 0, weekday: 6, mode: 'home', officeId: null }]
		};
		const plan = planPrefill(
			baseInput({
				to: '2026-07-12',
				schedules: [weekendSchedule],
				includeWeekends: true
			})
		);
		expect(insertedFor(plan, '2026-07-11')).toMatchObject({ kind: 'work', officeId: null });
	});

	it('still skips a weekend date left unscheduled even with includeWeekends on', () => {
		const plan = planPrefill(baseInput({ to: '2026-07-12', includeWeekends: true }));
		expect(insertedFor(plan, '2026-07-11')).toBeUndefined();
	});

	it('deletes a stale prefill row on a weekend once includeWeekends is turned off', () => {
		const staleWeekendRow: Day = {
			date: '2026-07-11', // Saturday
			kind: 'work',
			officeId: null,
			notes: null,
			source: 'prefill',
			blocks: [standard]
		};
		const plan = planPrefill(
			baseInput({ to: '2026-07-12', existing: [staleWeekendRow], includeWeekends: false })
		);
		expect(plan.deletes).toEqual(['2026-07-11']);
		expect(insertedFor(plan, '2026-07-11')).toBeUndefined();
	});

	it('leaves a manual or import row on a weekend alone when includeWeekends is off', () => {
		const manualWeekendRow: Day = {
			date: '2026-07-11',
			kind: 'sick',
			officeId: null,
			notes: null,
			source: 'manual',
			blocks: []
		};
		const plan = planPrefill(
			baseInput({ to: '2026-07-12', existing: [manualWeekendRow], includeWeekends: false })
		);
		expect(plan.deletes).toHaveLength(0);
		expect(plan.updates).toHaveLength(0);
	});
});

describe('planPrefill: manual and import rows are never touched', () => {
	it('leaves a manual row alone even when the schedule now disagrees with it', () => {
		const manualDay: Day = {
			date: '2026-07-07', // schedule says office 1
			kind: 'leave',
			officeId: null,
			notes: 'Rostered day off',
			source: 'manual',
			blocks: []
		};
		const plan = planPrefill(baseInput({ existing: [manualDay] }));
		expect(insertedFor(plan, '2026-07-07')).toBeUndefined();
		expect(plan.updates.find((day) => day.date === '2026-07-07')).toBeUndefined();
		expect(plan.deletes).not.toContain('2026-07-07');
	});

	it('leaves an import row alone the same way', () => {
		const importedDay: Day = {
			date: '2026-07-06',
			kind: 'sick',
			officeId: null,
			notes: null,
			source: 'import',
			blocks: []
		};
		const plan = planPrefill(baseInput({ existing: [importedDay] }));
		expect(insertedFor(plan, '2026-07-06')).toBeUndefined();
		expect(plan.updates).toHaveLength(0);
		expect(plan.deletes).toHaveLength(0);
	});
});

describe('planPrefill: re-planning a back-dated schedule change', () => {
	it('updates a stale prefill row and deletes one that is now off', () => {
		const changedFortnightly: Schedule = {
			...fortnightly,
			days: fortnightly.days.map((day) =>
				day.weekIndex === 0 && day.weekday === 2
					? { ...day, mode: 'home' as const, officeId: null } // Tue was office 1, now home
					: day
			)
		};

		const existingTuesday: Day = {
			date: '2026-07-07',
			kind: 'work',
			officeId: 1,
			notes: null,
			source: 'prefill',
			blocks: []
		};
		const existingWednesday: Day = {
			date: '2026-07-08',
			kind: 'work',
			officeId: null,
			notes: null,
			source: 'prefill',
			blocks: [standard]
		};

		const plan = planPrefill(
			baseInput({
				existing: [existingTuesday, existingWednesday],
				schedules: [changedFortnightly]
			})
		);

		expect(plan.updates).toEqual([
			{
				date: '2026-07-07',
				kind: 'work',
				officeId: null,
				notes: null,
				source: 'prefill',
				blocks: [standard]
			}
		]);
		expect(plan.deletes).toHaveLength(0);
	});

	it('deletes a prefill row when the day becomes off', () => {
		const offOnMonday: Schedule = {
			...fortnightly,
			days: fortnightly.days.map((day) =>
				day.weekIndex === 0 && day.weekday === 1 ? { ...day, mode: 'off' as const } : day
			)
		};
		const existingMonday: Day = {
			date: '2026-07-06',
			kind: 'work',
			officeId: null,
			notes: null,
			source: 'prefill',
			blocks: [standard]
		};

		const plan = planPrefill(baseInput({ existing: [existingMonday], schedules: [offOnMonday] }));
		expect(plan.deletes).toEqual(['2026-07-06']);
		expect(plan.updates).toHaveLength(0);
	});
});

describe('planPrefill: range bounding (no back-fill)', () => {
	it('never plans a date outside [from, to], regardless of what existing contains', () => {
		const outOfRangeExisting: Day = {
			date: '2026-06-01',
			kind: 'work',
			officeId: null,
			notes: null,
			source: 'prefill',
			blocks: [standard]
		};
		const plan = planPrefill(baseInput({ existing: [outOfRangeExisting] }));
		expect(plan.inserts.some((day) => day.date === '2026-06-01')).toBe(false);
		expect(plan.updates.some((day) => day.date === '2026-06-01')).toBe(false);
		expect(plan.deletes).not.toContain('2026-06-01');
	});
});

describe('planPrefill: idempotency', () => {
	it('produces no further changes once its own output is committed', () => {
		const input = baseInput({ holidays: [{ date: '2026-07-07' }] });
		const firstPlan = planPrefill(input);

		const committed = [...input.existing, ...firstPlan.inserts];
		const secondPlan = planPrefill({ ...input, existing: committed });

		expect(secondPlan).toEqual({ inserts: [], updates: [], deletes: [] });
	});
});
