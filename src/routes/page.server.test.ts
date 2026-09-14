import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDb, type Db } from '$lib/server/db/create';
import { createYear } from '$lib/server/repo/years';

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

describe('root load', () => {
	it('shows the welcome copy when the current financial year has not been created', async () => {
		const { load } = await import('./+page.server');
		expect(load({} as Parameters<typeof load>[0])).toEqual({
			currentFy: { startYear: 2026, label: 'FY27', slug: 'fy27', range: 'Jul 2026 – Jun 2027' }
		});
	});

	it('redirects to the diary once the current financial year exists', async () => {
		createYear(db, { startYear: 2026, rateCentsPerHour: 70 });
		const { load } = await import('./+page.server');
		try {
			load({} as Parameters<typeof load>[0]);
			expect.unreachable('expected a redirect');
		} catch (error) {
			expect(error).toMatchObject({ status: 307, location: '/fy27' });
		}
	});
});
