import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDb, type Db } from '$lib/server/db/create';
import type { loadFyContext } from '$lib/server/fyContext';
import { createYear } from '$lib/server/repo/years';

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

function layoutEvent(fy: string) {
	return { params: { fy } } as Parameters<Awaited<typeof import('./+layout.server')>['load']>[0];
}

describe('[fy] layout load', () => {
	it('404s on a malformed slug', async () => {
		const { load } = await import('./+layout.server');
		try {
			load(layoutEvent('not-a-fy'));
			expect.unreachable('expected an error');
		} catch (thrown) {
			expect(thrown).toMatchObject({ status: 404 });
		}
	});

	it('loads a null year when the financial year has not been created yet', async () => {
		const { load } = await import('./+layout.server');
		const result = load(layoutEvent('fy27')) as ReturnType<typeof loadFyContext>;
		expect(result.fy).toEqual({
			startYear: 2026,
			label: 'FY27',
			slug: 'fy27',
			range: 'Jul 2026 – Jun 2027'
		});
		expect(result.fyBounds).toEqual({ start: '2026-07-01', end: '2027-06-30' });
		expect(result.year).toBeNull();
	});

	it('loads the year, settings, offices, schedules and effective holidays', async () => {
		createYear(db, { startYear: 2026, rateCentsPerHour: 70 });
		const { createOffice, archiveOffice } = await import('$lib/server/repo/offices');
		const office = createOffice(db, { name: 'Office Location 1' });
		archiveOffice(db, office.id, '2026-08-01');
		const { addCustomHoliday } = await import('$lib/server/repo/holidays');
		addCustomHoliday(db, {
			date: '2026-12-25',
			name: 'Christmas Day',
			region: 'AU-VIC',
			repeatsYearly: false
		});

		const { load } = await import('./+layout.server');
		const result = load(layoutEvent('fy27')) as ReturnType<typeof loadFyContext>;

		expect(result.year).toMatchObject({ startYear: 2026, rateCentsPerHour: 70 });
		expect(result.settings).toMatchObject({ holidayRegion: 'AU-VIC' });
		// Archived offices stay in the list so a day recorded against one still resolves its name.
		expect(result.offices).toEqual([expect.objectContaining({ name: 'Office Location 1' })]);
		expect(result.schedules).toEqual([]);
		expect(result.holidays).toEqual([{ date: '2026-12-25', name: 'Christmas Day' }]);
	});
});
