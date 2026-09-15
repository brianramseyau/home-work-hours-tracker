import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDb, type Db } from '$lib/server/db/create';
import { createYear } from '$lib/server/repo/years';
import { upsertDay } from '$lib/server/repo/days';

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

function actionEvent(fields: Record<string, string>) {
	const formData = new FormData();
	for (const [key, value] of Object.entries(fields)) formData.append(key, value);
	return { request: { formData: async () => formData } } as never;
}

describe('load', () => {
	it('offers the current FY to create when none exist', async () => {
		const { load } = await import('./+page.server');
		expect(load({} as Parameters<typeof load>[0])).toEqual({
			years: [],
			nextFy: { startYear: 2026, label: 'FY27', slug: 'fy27', range: 'Jul 2026 – Jun 2027' }
		});
	});

	it('lists years newest first', async () => {
		createYear(db, { startYear: 2025, rateCentsPerHour: 68 });
		createYear(db, { startYear: 2026, rateCentsPerHour: 70 });

		const { load } = await import('./+page.server');
		const result = load({} as Parameters<typeof load>[0]) as { years: { fy: { label: string } }[] };
		expect(result.years.map((row) => row.fy.label)).toEqual(['FY27', 'FY26']);
	});

	it('lists years with their computed home hours and claim', async () => {
		createYear(db, { startYear: 2026, rateCentsPerHour: 70, rateNote: 'ATO fixed rate' });
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

		const { load } = await import('./+page.server');

		expect(load({} as Parameters<typeof load>[0])).toEqual({
			years: [
				{
					startYear: 2026,
					rateCentsPerHour: 70,
					rateNote: 'ATO fixed rate',
					finalisedAt: null,
					fy: { startYear: 2026, label: 'FY27', slug: 'fy27', range: 'Jul 2026 – Jun 2027' },
					homeMinutes: 456,
					claimCents: 532
				}
			],
			nextFy: { startYear: 2027, label: 'FY28', slug: 'fy28', range: 'Jul 2027 – Jun 2028' }
		});
	});
});

describe('actions.create', () => {
	it('creates the current FY at the fallback rate when none exist', async () => {
		const { actions } = await import('./+page.server');
		await actions.create(actionEvent({}));

		const { listYears } = await import('$lib/server/repo/years');
		expect(listYears(db)).toEqual([
			{ id: 1, startYear: 2026, rateCentsPerHour: 70, rateNote: null, finalisedAt: null }
		]);
	});

	it('copies the previous FY rate for the next one', async () => {
		createYear(db, { startYear: 2025, rateCentsPerHour: 68 });
		const { actions } = await import('./+page.server');
		await actions.create(actionEvent({}));

		const { getYear } = await import('$lib/server/repo/years');
		expect(getYear(db, 2026)?.rateCentsPerHour).toBe(68);
	});

	it('creates each successive missing year in turn', async () => {
		const { actions } = await import('./+page.server');
		await actions.create(actionEvent({}));
		await actions.create(actionEvent({}));

		const { listYears } = await import('$lib/server/repo/years');
		expect(listYears(db).map((year) => year.startYear)).toEqual([2026, 2027]);
	});
});

describe('actions.updateRate', () => {
	it('updates the rate and note', async () => {
		createYear(db, { startYear: 2026, rateCentsPerHour: 70 });
		const { actions } = await import('./+page.server');
		await actions.updateRate(
			actionEvent({ startYear: '2026', rateDollars: '0.75', rateNote: 'Rate rise' })
		);

		const { getYear } = await import('$lib/server/repo/years');
		expect(getYear(db, 2026)).toMatchObject({ rateCentsPerHour: 75, rateNote: 'Rate rise' });
	});

	it('clears the note when left blank', async () => {
		createYear(db, { startYear: 2026, rateCentsPerHour: 70, rateNote: 'Old note' });
		const { actions } = await import('./+page.server');
		await actions.updateRate(actionEvent({ startYear: '2026', rateDollars: '0.70', rateNote: '' }));

		const { getYear } = await import('$lib/server/repo/years');
		expect(getYear(db, 2026)?.rateNote).toBeNull();
	});

	it('fails when the rate field is missing entirely', async () => {
		createYear(db, { startYear: 2026, rateCentsPerHour: 70 });
		const { actions } = await import('./+page.server');
		const result = await actions.updateRate(actionEvent({ startYear: '2026', rateNote: '' }));
		expect(result).toMatchObject({ status: 400 });
	});

	it('fails on a non-numeric rate', async () => {
		createYear(db, { startYear: 2026, rateCentsPerHour: 70 });
		const { actions } = await import('./+page.server');
		const result = await actions.updateRate(
			actionEvent({ startYear: '2026', rateDollars: 'lots', rateNote: '' })
		);
		expect(result).toMatchObject({ status: 400 });
	});

	it('fails on a negative rate', async () => {
		createYear(db, { startYear: 2026, rateCentsPerHour: 70 });
		const { actions } = await import('./+page.server');
		const result = await actions.updateRate(
			actionEvent({ startYear: '2026', rateDollars: '-0.10', rateNote: '' })
		);
		expect(result).toMatchObject({ status: 400 });
	});

	it('fails on a blank rate, rather than silently zeroing it', async () => {
		createYear(db, { startYear: 2026, rateCentsPerHour: 70 });
		const { actions } = await import('./+page.server');
		const result = await actions.updateRate(
			actionEvent({ startYear: '2026', rateDollars: '  ', rateNote: '' })
		);
		expect(result).toMatchObject({ status: 400 });

		const { getYear } = await import('$lib/server/repo/years');
		expect(getYear(db, 2026)?.rateCentsPerHour).toBe(70);
	});

	it('fails to update the rate of a year that does not exist', async () => {
		const { actions } = await import('./+page.server');
		const result = await actions.updateRate(
			actionEvent({ startYear: '2099', rateDollars: '0.75', rateNote: '' })
		);
		expect(result).toMatchObject({
			status: 400,
			data: { errors: { startYear: ['This financial year does not exist.'] } }
		});
	});

	it('refuses to change the rate of a finalised year', async () => {
		const { finaliseYear } = await import('$lib/server/repo/years');
		createYear(db, { startYear: 2026, rateCentsPerHour: 70 });
		finaliseYear(db, 2026, '2026-09-14');

		const { actions } = await import('./+page.server');
		const result = await actions.updateRate(
			actionEvent({ startYear: '2026', rateDollars: '0.75', rateNote: '' })
		);
		expect(result).toMatchObject({ status: 400 });

		const { getYear } = await import('$lib/server/repo/years');
		expect(getYear(db, 2026)?.rateCentsPerHour).toBe(70);
	});
});

describe('actions.finalise and unfinalise', () => {
	it('sets finalisedAt to today, then clears it', async () => {
		createYear(db, { startYear: 2026, rateCentsPerHour: 70 });
		const { actions } = await import('./+page.server');

		await actions.finalise(actionEvent({ startYear: '2026' }));
		const { getYear } = await import('$lib/server/repo/years');
		expect(getYear(db, 2026)?.finalisedAt).toBe('2026-09-14');

		await actions.unfinalise(actionEvent({ startYear: '2026' }));
		expect(getYear(db, 2026)?.finalisedAt).toBeNull();
	});
});
