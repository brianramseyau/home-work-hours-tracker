import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fyBounds, fySummary } from '$lib/core/fy';
import { createDb, type Db } from '$lib/server/db/create';
import type { loadDiaryData } from '$lib/server/diaryLoad';

const testDb = vi.hoisted(() => ({ current: undefined as unknown }));

vi.mock('$lib/server/db', () => ({
	get db() {
		return testDb.current;
	}
}));

let db: Db;

beforeEach(() => {
	db = createDb(':memory:');
	testDb.current = db;
});

describe('load', () => {
	it('delegates to loadDiaryData with the parent data', async () => {
		const { load } = await import('./+page.server');
		const parent = async () => ({
			fy: fySummary(2026),
			fyBounds: fyBounds(2026),
			year: null,
			settings: {
				standardStart: '09:00',
				standardEnd: '17:06',
				standardBreakMinutes: 30,
				includeWeekends: false
			},
			schedules: [],
			holidays: [],
			today: '2026-09-14'
		});

		const result = (await load({ parent } as never)) as ReturnType<typeof loadDiaryData>;
		expect(result.days.length).toBeGreaterThan(0);
		expect(result.claimCents).toBeNull();
	});
});
