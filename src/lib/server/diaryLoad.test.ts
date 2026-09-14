import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fyBounds, fySummary } from '$lib/core/fy';
import { createDb, type Db } from './db/create';
import { loadDiaryData } from './diaryLoad';

const testDb = vi.hoisted(() => ({ current: undefined as unknown }));

vi.mock('$lib/server/db', () => ({
	get db() {
		return testDb.current;
	}
}));

let db: Db;

const STANDARD = { standardStart: '09:00', standardEnd: '17:06', standardBreakMinutes: 30 };

beforeEach(() => {
	db = createDb(':memory:');
	testDb.current = db;
});

function baseInput(overrides: Partial<Parameters<typeof loadDiaryData>[0]> = {}) {
	return {
		fy: fySummary(2026),
		fyBounds: fyBounds(2026),
		year: null,
		settings: { includeWeekends: false, ...STANDARD },
		schedules: [],
		holidays: [],
		today: '2026-09-14',
		...overrides
	};
}

describe('loadDiaryData', () => {
	it('builds the diary days, summary and claim for the year', async () => {
		const { upsertDay } = await import('./repo/days');
		upsertDay(
			db,
			{
				date: '2026-07-01',
				kind: 'work',
				officeId: null,
				notes: null,
				source: 'manual',
				blocks: [{ start: '09:00', end: '17:06', breakMinutes: 30 }]
			},
			'2026-07-01T00:00:00.000Z'
		);

		const result = loadDiaryData(baseInput({ year: { rateCentsPerHour: 70 } }));
		expect(result.days.length).toBeGreaterThan(0);
		expect(result.summary.homeMinutes).toBe(456);
		expect(result.claimCents).toBe(532);
	});

	it('leaves the claim null when the year has not been created yet', () => {
		const result = loadDiaryData(baseInput());
		expect(result.claimCents).toBeNull();
	});
});
