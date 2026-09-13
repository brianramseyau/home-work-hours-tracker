import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '../db/create';
import { createOffice } from './offices';
import { createSchedule, deleteSchedule, listSchedules } from './schedules';

let db: Db;

beforeEach(() => {
	db = createDb(':memory:');
});

describe('createSchedule and listSchedules', () => {
	it('creates a schedule with its days and reads it back', () => {
		const office = createOffice(db, { name: 'Office Location 1' });
		createSchedule(db, {
			effectiveFrom: '2026-07-01',
			cycleWeeks: 2,
			anchorMonday: '2026-07-06',
			days: [
				{ weekIndex: 0, weekday: 1, mode: 'home', officeId: null },
				{ weekIndex: 0, weekday: 2, mode: 'office', officeId: office.id }
			]
		});

		const [schedule] = listSchedules(db);
		expect(schedule).toMatchObject({ effectiveFrom: '2026-07-01', cycleWeeks: 2 });
		expect(schedule.days).toEqual([
			{ weekIndex: 0, weekday: 1, mode: 'home', officeId: null },
			{ weekIndex: 0, weekday: 2, mode: 'office', officeId: office.id }
		]);
	});

	it('creates a schedule with no days', () => {
		createSchedule(db, {
			effectiveFrom: '2026-07-01',
			cycleWeeks: 1,
			anchorMonday: '2026-06-29',
			days: []
		});
		expect(listSchedules(db)[0].days).toEqual([]);
	});

	it('lists multiple versions oldest first', () => {
		createSchedule(db, {
			effectiveFrom: '2027-01-01',
			cycleWeeks: 1,
			anchorMonday: '2026-12-28',
			days: []
		});
		createSchedule(db, {
			effectiveFrom: '2026-07-01',
			cycleWeeks: 1,
			anchorMonday: '2026-06-29',
			days: []
		});
		expect(listSchedules(db).map((s) => s.effectiveFrom)).toEqual(['2026-07-01', '2027-01-01']);
	});
});

describe('deleteSchedule', () => {
	it('removes a schedule and cascades its days', () => {
		const schedule = createSchedule(db, {
			effectiveFrom: '2026-07-01',
			cycleWeeks: 1,
			anchorMonday: '2026-06-29',
			days: [{ weekIndex: 0, weekday: 1, mode: 'home', officeId: null }]
		});
		deleteSchedule(db, schedule.id);
		expect(listSchedules(db)).toEqual([]);
	});
});
