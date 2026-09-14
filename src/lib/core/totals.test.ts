import { describe, expect, it } from 'vitest';
import type { Day } from './dayType';
import { claimCents, claimCentsByGroup, dayHomeMinutes, summarise } from './totals';

function day(overrides: Partial<Day>): Day {
	return {
		date: '2026-07-01',
		kind: 'work',
		officeId: null,
		notes: null,
		source: 'manual',
		blocks: [],
		...overrides
	};
}

describe('dayHomeMinutes', () => {
	it('sums the blocks of a work day', () => {
		expect(
			dayHomeMinutes(day({ blocks: [{ start: '09:00', end: '17:06', breakMinutes: 30 }] }))
		).toBe(456);
	});

	it('sums multiple blocks on a split day', () => {
		expect(
			dayHomeMinutes(
				day({
					officeId: 1,
					blocks: [
						{ start: '09:00', end: '12:00', breakMinutes: 0 },
						{ start: '13:00', end: '15:00', breakMinutes: 0 }
					]
				})
			)
		).toBe(300);
	});

	it('is 0 for non-work kinds even if blocks are (incorrectly) present', () => {
		expect(
			dayHomeMinutes(
				day({ kind: 'leave', blocks: [{ start: '09:00', end: '17:00', breakMinutes: 0 }] })
			)
		).toBe(0);
	});

	it('is 0 for a work day with no blocks', () => {
		expect(dayHomeMinutes(day({ officeId: 1 }))).toBe(0);
	});
});

describe('summarise', () => {
	it('totals home minutes, counts kinds, and buckets by month and week', () => {
		const days: Day[] = [
			day({
				date: '2026-07-01', // week 1
				blocks: [{ start: '09:00', end: '17:06', breakMinutes: 30 }]
			}),
			day({
				date: '2026-07-06', // week 2
				blocks: [{ start: '09:00', end: '17:06', breakMinutes: 30 }]
			}),
			day({ date: '2026-07-02', kind: 'sick' }),
			day({ date: '2026-07-03', officeId: 1 }), // office day, 0 home minutes
			day({
				date: '2026-08-03',
				blocks: [{ start: '09:00', end: '17:06', breakMinutes: 30 }]
			})
		];

		const summary = summarise(days);

		expect(summary.homeMinutes).toBe(456 * 3);
		expect(summary.kindCounts).toEqual({ work: 4, leave: 0, sick: 1, public_holiday: 0, off: 0 });
		expect(summary.byMonth).toEqual([
			{ month: '2026-07', minutes: 912 },
			{ month: '2026-08', minutes: 456 }
		]);
		expect(summary.byWeek).toEqual([
			{ week: 1, minutes: 456 },
			{ week: 2, minutes: 456 },
			{ week: 6, minutes: 456 }
		]);
	});

	it('returns zeroed totals for an empty day list', () => {
		expect(summarise([])).toEqual({
			homeMinutes: 0,
			byMonth: [],
			byWeek: [],
			kindCounts: { work: 0, leave: 0, sick: 0, public_holiday: 0, off: 0 }
		});
	});
});

describe('claimCents', () => {
	it('rounds the total once, at the end', () => {
		// 456 min at 70c/hr = 7.6 hours × 70c = 532c exactly.
		expect(claimCents(456, 70)).toBe(532);
	});

	it('rounds a fractional cent amount to the nearest cent', () => {
		// 100 min at 70c/hr = 1.6667 hours × 70c = 116.67c, which rounds to 117c.
		expect(claimCents(100, 70)).toBe(117);
	});

	it('rounds a sum, not per-part figures that would drift', () => {
		// Three days of 153 minutes at 70c/hr: 153/60*70 = 178.5c each (would round to 179×3=537
		// if rounded per-day); summed first it's 459 min → 535.5c → 536c.
		expect(claimCents(153 * 3, 70)).toBe(536);
	});
});

describe('claimCentsByGroup', () => {
	it('sums to exactly claimCents of the total, unlike rounding each entry independently', () => {
		// 50 + 50 minutes at 100c/hr: 50/60*100 = 83.33c each, which independently rounds to
		// 83c + 83c = 166c — one cent short of the true total claim of 167c.
		const parts = claimCentsByGroup([50, 50], 100);
		expect(parts.reduce((sum, cents) => sum + cents, 0)).toBe(claimCents(100, 100));
		expect(parts).toEqual([83, 84]);
	});

	it('matches claimCents for a single entry', () => {
		expect(claimCentsByGroup([456], 70)).toEqual([532]);
	});

	it('gives every zero-minute entry a zero claim', () => {
		expect(claimCentsByGroup([0, 456, 0], 70)).toEqual([0, 532, 0]);
	});
});
