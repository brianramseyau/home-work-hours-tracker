import { beforeEach, describe, expect, it } from 'vitest';
import type { Day } from '$lib/core/dayType';
import { createDb, type Db } from '../db/create';
import { deleteDay, getDay, listRange, upsertDay } from './days';
import { createOffice } from './offices';

let db: Db;
let officeId: number;

beforeEach(() => {
	db = createDb(':memory:');
	officeId = createOffice(db, { name: 'Office Location 1' }).id;
});

function homeDay(date: string): Day {
	return {
		date,
		kind: 'work',
		officeId: null,
		notes: null,
		source: 'prefill',
		blocks: [{ start: '09:00', end: '17:06', breakMinutes: 30 }]
	};
}

describe('upsertDay and getDay', () => {
	it('inserts a new day with its blocks', () => {
		upsertDay(db, homeDay('2026-07-01'), '2026-07-01T00:00:00.000Z');
		expect(getDay(db, '2026-07-01')).toEqual(homeDay('2026-07-01'));
	});

	it('is null for a date with no row', () => {
		expect(getDay(db, '2026-07-01')).toBeNull();
	});

	it('replaces an existing day and its blocks', () => {
		upsertDay(db, homeDay('2026-07-01'), '2026-07-01T00:00:00.000Z');

		const officeDay: Day = {
			date: '2026-07-01',
			kind: 'work',
			officeId,
			notes: null,
			source: 'manual',
			blocks: []
		};
		upsertDay(db, officeDay, '2026-07-02T00:00:00.000Z');

		expect(getDay(db, '2026-07-01')).toEqual(officeDay);
	});

	it('preserves block order by position', () => {
		const split: Day = {
			date: '2026-07-01',
			kind: 'work',
			officeId,
			notes: null,
			source: 'manual',
			blocks: [
				{ start: '09:00', end: '12:00', breakMinutes: 0 },
				{ start: '13:00', end: '15:00', breakMinutes: 0 }
			]
		};
		upsertDay(db, split, '2026-07-01T00:00:00.000Z');
		expect(getDay(db, '2026-07-01')?.blocks).toEqual(split.blocks);
	});

	it('keeps notes and preserves them on read', () => {
		const withNotes: Day = {
			date: '2026-07-01',
			kind: 'sick',
			officeId: null,
			notes: 'Felt unwell',
			source: 'manual',
			blocks: []
		};
		upsertDay(db, withNotes, '2026-07-01T00:00:00.000Z');
		expect(getDay(db, '2026-07-01')?.notes).toBe('Felt unwell');
	});
});

describe('listRange', () => {
	it('returns days within the range, ordered by date, blocks included', () => {
		upsertDay(db, homeDay('2026-07-01'), 'x');
		upsertDay(db, homeDay('2026-07-03'), 'x');
		upsertDay(db, homeDay('2026-07-02'), 'x');
		upsertDay(db, homeDay('2026-08-01'), 'x'); // outside the range below

		const result = listRange(db, '2026-07-01', '2026-07-31');
		expect(result.map((d) => d.date)).toEqual(['2026-07-01', '2026-07-02', '2026-07-03']);
		expect(result[0].blocks).toEqual(homeDay('2026-07-01').blocks);
	});

	it('is empty when nothing is in range', () => {
		expect(listRange(db, '2026-07-01', '2026-07-31')).toEqual([]);
	});

	it('includes days with no blocks (office/leave/sick days)', () => {
		const officeDay: Day = {
			date: '2026-07-01',
			kind: 'work',
			officeId,
			notes: null,
			source: 'manual',
			blocks: []
		};
		upsertDay(db, officeDay, 'x');
		expect(listRange(db, '2026-07-01', '2026-07-01')).toEqual([officeDay]);
	});
});

describe('deleteDay', () => {
	it('removes the day and its blocks', () => {
		upsertDay(db, homeDay('2026-07-01'), 'x');
		deleteDay(db, '2026-07-01');
		expect(getDay(db, '2026-07-01')).toBeNull();
	});

	it('is a no-op for a date with no row', () => {
		expect(() => deleteDay(db, '2026-07-01')).not.toThrow();
	});
});
