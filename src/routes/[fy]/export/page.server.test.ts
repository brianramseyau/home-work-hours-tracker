import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fyBounds, fySummary } from '$lib/core/fy';
import { createDb, type Db } from '$lib/server/db/create';
import type { loadDiaryData } from '$lib/server/diaryLoad';

type LoadResult = ReturnType<typeof loadDiaryData> & {
	rateCentsPerHour: number | null;
	fullName: string | null;
	finalised: boolean;
};

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

function parentData(overrides: Partial<Record<string, unknown>> = {}) {
	return async () => ({
		fy: fySummary(2026),
		fyBounds: fyBounds(2026),
		year: null,
		settings: {
			fullName: 'John Doe',
			standardStart: '09:00',
			standardEnd: '17:06',
			standardBreakMinutes: 30,
			includeWeekends: false
		},
		schedules: [],
		holidays: [],
		today: '2026-09-14',
		...overrides
	});
}

describe('load', () => {
	it('summarises the FY and reports the rate, name and finalised state', async () => {
		const { load } = await import('./+page.server');
		const result = (await load({
			parent: parentData({ year: { startYear: 2026, rateCentsPerHour: 70, finalisedAt: null } })
		} as never)) as LoadResult;
		expect(result.rateCentsPerHour).toBe(70);
		expect(result.fullName).toBe('John Doe');
		expect(result.finalised).toBe(false);
		expect(result.claimCents).toBe(0);
	});

	it('reports a null rate and claim when the year has not been created yet', async () => {
		const { load } = await import('./+page.server');
		const result = (await load({ parent: parentData({ year: null }) } as never)) as LoadResult;
		expect(result.rateCentsPerHour).toBeNull();
		expect(result.claimCents).toBeNull();
	});

	it('reports a finalised year', async () => {
		const { load } = await import('./+page.server');
		const result = (await load({
			parent: parentData({
				year: { startYear: 2026, rateCentsPerHour: 70, finalisedAt: '2026-09-14' }
			})
		} as never)) as LoadResult;
		expect(result.finalised).toBe(true);
	});
});
