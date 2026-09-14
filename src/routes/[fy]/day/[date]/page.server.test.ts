import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDb, type Db } from '$lib/server/db/create';
import { getDay, upsertDay } from '$lib/server/repo/days';

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

function loadEvent(date: string, fyBounds = { start: '2026-07-01', end: '2027-06-30' }) {
	return {
		params: { date },
		parent: async () => ({ fyBounds })
	} as Parameters<Awaited<typeof import('./+page.server')>['load']>[0];
}

interface LoadResult {
	day: {
		date: string;
		officeId: number | null;
		notes: string | null;
		blocks: { start: string; end: string; breakMinutes: number }[];
		displayType: string;
	};
}

describe('load', () => {
	it('404s on a malformed date', async () => {
		const { load } = await import('./+page.server');
		try {
			await load(loadEvent('not-a-date'));
			expect.unreachable('expected an error');
		} catch (thrown) {
			expect(thrown).toMatchObject({ status: 404 });
		}
	});

	it('404s on a date outside the financial year in the URL', async () => {
		const { load } = await import('./+page.server');
		try {
			await load(loadEvent('2030-01-01'));
			expect.unreachable('expected an error');
		} catch (thrown) {
			expect(thrown).toMatchObject({ status: 404 });
		}
	});

	it('defaults to an off day when no row exists yet', async () => {
		const { load } = await import('./+page.server');
		const result = (await load(loadEvent('2026-09-16'))) as LoadResult;
		expect(result.day).toEqual({
			date: '2026-09-16',
			officeId: null,
			notes: null,
			blocks: [],
			displayType: 'off'
		});
	});

	it('loads an existing day with its display type', async () => {
		upsertDay(
			db,
			{
				date: '2026-09-16',
				kind: 'work',
				officeId: null,
				notes: 'Focus day',
				source: 'manual',
				blocks: [{ start: '09:00', end: '17:06', breakMinutes: 30 }]
			},
			'2026-09-16T00:00:00.000Z'
		);

		const { load } = await import('./+page.server');
		const result = (await load(loadEvent('2026-09-16'))) as LoadResult;
		expect(result.day).toMatchObject({ notes: 'Focus day', displayType: 'home' });
	});
});

describe('actions', () => {
	it('shares saveDay with the Diary page, keyed by date', async () => {
		const { actions } = await import('./+page.server');
		const formData = new FormData();
		formData.append('date', '2026-09-16');
		formData.append('kind', 'off');
		formData.append('officeId', '');
		formData.append('notes', '');
		formData.append('blocks', '[]');

		const result = await actions.saveDay({
			request: { formData: async () => formData },
			params: { fy: 'fy27' }
		} as never);

		expect(result).toMatchObject({ form: 'day', date: '2026-09-16', success: true });
		expect(getDay(db, '2026-09-16')).toMatchObject({ kind: 'off' });
	});
});
