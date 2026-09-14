import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDb, type Db } from '$lib/server/db/create';

const testDb = vi.hoisted(() => ({ current: undefined as unknown }));

vi.mock('$env/dynamic/private', () => ({
	env: { APP_FIXED_DATE: '2026-09-14', TZ: 'Australia/Melbourne' }
}));

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

function layoutEvent(pathname = '/') {
	return { url: new URL(`http://localhost${pathname}`) } as Parameters<
		Awaited<typeof import('./+layout.server')>['load']
	>[0];
}

describe('root layout load', () => {
	it('provides today, the current financial year and how many days it filled', async () => {
		const { load } = await import('./+layout.server');
		expect(load(layoutEvent())).toEqual({
			today: '2026-09-14',
			currentFy: { startYear: 2026, label: 'FY27', slug: 'fy27', range: 'Jul 2026 – Jun 2027' },
			filled: 0
		});
	});

	it('fills days from the schedule on the first navigation of the day', async () => {
		const { createSchedule } = await import('$lib/server/repo/schedules');
		createSchedule(db, {
			effectiveFrom: '2026-07-01',
			cycleWeeks: 1,
			anchorMonday: '2026-06-29',
			days: [
				{ weekIndex: 0, weekday: 1, mode: 'home', officeId: null },
				{ weekIndex: 0, weekday: 2, mode: 'home', officeId: null },
				{ weekIndex: 0, weekday: 3, mode: 'home', officeId: null },
				{ weekIndex: 0, weekday: 4, mode: 'home', officeId: null },
				{ weekIndex: 0, weekday: 5, mode: 'home', officeId: null }
			]
		});

		const { load } = await import('./+layout.server');
		const result = load(layoutEvent()) as { filled: number };
		expect(result.filled).toBeGreaterThan(0);
	});
});
