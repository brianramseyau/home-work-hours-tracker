import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDb, type Db } from '$lib/server/db/create';
import type { loadDiaryData } from '$lib/server/diaryLoad';
import { getDay } from '$lib/server/repo/days';
import { addCustomHoliday } from '$lib/server/repo/holidays';
import { createOffice } from '$lib/server/repo/offices';
import { createYear, finaliseYear } from '$lib/server/repo/years';

type LoadResult = ReturnType<typeof loadDiaryData> & { finalised: boolean };

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

function parentData(overrides: Partial<Record<string, unknown>> = {}) {
	return async () => ({
		fy: { startYear: 2026, label: 'FY27', slug: 'fy27', range: 'Jul 2026 – Jun 2027' },
		fyBounds: { start: '2026-07-01', end: '2027-06-30' },
		year: null,
		settings: { holidayRegion: 'AU-VIC', includeWeekends: false, ...STANDARD },
		schedules: [],
		holidays: [] as { date: string; name: string }[],
		today: '2026-09-14',
		...overrides
	});
}

function actionEvent(fields: Record<string, string>) {
	const formData = new FormData();
	for (const [key, value] of Object.entries(fields)) formData.append(key, value);
	return {
		request: { formData: async () => formData },
		params: { fy: 'fy27' }
	} as never;
}

describe('load', () => {
	it('builds the diary days, summary and claim for the year', async () => {
		createYear(db, { startYear: 2026, rateCentsPerHour: 70 });
		const { load } = await import('./+page.server');
		const result = (await load({
			parent: parentData({ year: { startYear: 2026, rateCentsPerHour: 70, finalisedAt: null } })
		} as never)) as LoadResult;

		expect(result.days.length).toBeGreaterThan(0);
		expect(result.finalised).toBe(false);
		expect(result.claimCents).toBe(0); // no days recorded yet
	});

	it('leaves the claim null when the financial year has not been created yet', async () => {
		const { load } = await import('./+page.server');
		const result = (await load({ parent: parentData({ year: null }) } as never)) as LoadResult;
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

describe('actions.saveDay', () => {
	it('saves a home day as a manual override', async () => {
		const { actions } = await import('./+page.server');
		const result = await actions.saveDay(
			actionEvent({
				date: '2026-09-16',
				kind: 'work',
				officeId: '',
				notes: 'Focus day',
				blocks: JSON.stringify([{ start: '09:00', end: '17:06', breakMinutes: 30 }])
			})
		);
		expect(result).toMatchObject({ form: 'day', date: '2026-09-16', success: true });
		expect(getDay(db, '2026-09-16')).toMatchObject({
			kind: 'work',
			source: 'manual',
			notes: 'Focus day'
		});
	});

	it('fails on malformed blocks JSON rather than throwing', async () => {
		const { actions } = await import('./+page.server');
		const result = await actions.saveDay(
			actionEvent({
				date: '2026-09-16',
				kind: 'work',
				officeId: '',
				notes: '',
				blocks: '{not json'
			})
		);
		expect(result).toMatchObject({ status: 400 });
	});

	it('defaults to no blocks when the field is missing entirely', async () => {
		const { actions } = await import('./+page.server');
		const result = await actions.saveDay(
			actionEvent({ date: '2026-09-16', kind: 'off', officeId: '', notes: '' })
		);
		expect(result).toMatchObject({ form: 'day', success: true });
	});

	it('saves a split day against a real office', async () => {
		const office = createOffice(db, { name: 'Office Location 1' });

		const { actions } = await import('./+page.server');
		const result = await actions.saveDay(
			actionEvent({
				date: '2026-09-16',
				kind: 'work',
				officeId: String(office.id),
				notes: '',
				blocks: JSON.stringify([{ start: '09:00', end: '12:00', breakMinutes: 0 }])
			})
		);
		expect(result).toMatchObject({ form: 'day', success: true });
		expect(getDay(db, '2026-09-16')).toMatchObject({ kind: 'work', officeId: office.id });
	});

	it('rejects an office that does not exist', async () => {
		const { actions } = await import('./+page.server');
		const result = await actions.saveDay(
			actionEvent({ date: '2026-09-16', kind: 'work', officeId: '9999', notes: '', blocks: '[]' })
		);
		expect(result).toMatchObject({
			status: 400,
			data: { errors: { officeId: ['This office does not exist.'] } }
		});
	});

	it('reports a missing date field as null, rather than an empty string', async () => {
		const { actions } = await import('./+page.server');
		const result = await actions.saveDay(
			actionEvent({ kind: 'off', officeId: '', notes: '', blocks: '[]' })
		);
		expect(result).toMatchObject({ status: 400, data: { date: null } });
	});

	it('rejects a date outside the financial year being viewed', async () => {
		const { actions } = await import('./+page.server');
		const result = await actions.saveDay(
			actionEvent({ date: '2025-01-01', kind: 'off', officeId: '', notes: '', blocks: '[]' })
		);
		expect(result).toMatchObject({
			status: 400,
			data: { errors: { date: ['This date is outside the financial year being viewed.'] } }
		});
	});

	it('rejects an edit once the year is finalised', async () => {
		createYear(db, { startYear: 2026, rateCentsPerHour: 70 });
		finaliseYear(db, 2026, '2026-09-14');

		const { actions } = await import('./+page.server');
		const result = await actions.saveDay(
			actionEvent({ date: '2026-09-16', kind: 'off', officeId: '', notes: '', blocks: '[]' })
		);
		expect(result).toMatchObject({ status: 400 });
		expect(getDay(db, '2026-09-16')).toBeNull();
	});
});

describe('actions.resetDay', () => {
	it('resets a manual override back to the schedule', async () => {
		const { upsertDay } = await import('$lib/server/repo/days');
		upsertDay(
			db,
			{
				date: '2026-09-16',
				kind: 'leave',
				officeId: null,
				notes: 'RDO',
				source: 'manual',
				blocks: []
			},
			'2026-09-16T00:00:00.000Z'
		);

		const { actions } = await import('./+page.server');
		const result = await actions.resetDay(actionEvent({ date: '2026-09-16' }));
		expect(result).toMatchObject({ form: 'day', date: '2026-09-16', success: true });
		expect(getDay(db, '2026-09-16')).toBeNull(); // no schedule in effect — reverts to nothing
	});

	it('treats a missing date field as an empty string, which fails date validation', async () => {
		const { actions } = await import('./+page.server');
		const result = await actions.resetDay(actionEvent({}));
		expect(result).toMatchObject({ status: 400 });
	});

	it('rejects a malformed date rather than persisting or planning against it', async () => {
		const { actions } = await import('./+page.server');
		const result = await actions.resetDay(actionEvent({ date: '2026-7-1' }));
		expect(result).toMatchObject({ status: 400 });
	});

	it('rejects a reset once the year is finalised', async () => {
		createYear(db, { startYear: 2026, rateCentsPerHour: 70 });
		finaliseYear(db, 2026, '2026-09-14');

		const { actions } = await import('./+page.server');
		const result = await actions.resetDay(actionEvent({ date: '2026-09-16' }));
		expect(result).toMatchObject({ status: 400 });
	});
});

describe('actions.clearDay', () => {
	it('clears a day to an explicit, manual off', async () => {
		const { actions } = await import('./+page.server');
		const result = await actions.clearDay(actionEvent({ date: '2026-09-16' }));
		expect(result).toMatchObject({ form: 'day', date: '2026-09-16', success: true });
		expect(getDay(db, '2026-09-16')).toMatchObject({ kind: 'off', source: 'manual' });
	});

	it('rejects a date outside the financial year being viewed', async () => {
		const { actions } = await import('./+page.server');
		const result = await actions.clearDay(actionEvent({ date: '2099-01-01' }));
		expect(result).toMatchObject({ status: 400 });
	});

	it('treats a missing date field as an empty string, which fails date validation', async () => {
		const { actions } = await import('./+page.server');
		const result = await actions.clearDay(actionEvent({}));
		expect(result).toMatchObject({ status: 400 });
	});

	it('rejects a malformed date rather than persisting it verbatim', async () => {
		const { actions } = await import('./+page.server');
		const result = await actions.clearDay(actionEvent({ date: '2026-09-01junk' }));
		expect(result).toMatchObject({ status: 400 });
		expect(getDay(db, '2026-09-01junk')).toBeNull();
	});
});

function markRangeEvent(fields: Record<string, string>) {
	const formData = new FormData();
	for (const [key, value] of Object.entries(fields)) formData.append(key, value);
	return { request: { formData: async () => formData }, params: { fy: 'fy27' } } as never;
}

describe('actions.markRange', () => {
	it('marks a range of days as leave, skipping holidays', async () => {
		addCustomHoliday(db, {
			date: '2026-09-15',
			name: 'Made-up day',
			region: 'AU-VIC',
			repeatsYearly: false
		});

		const { actions } = await import('./+page.server');
		const result = await actions.markRange(
			markRangeEvent({ from: '2026-09-14', to: '2026-09-16', kind: 'leave', note: 'Family trip' })
		);
		expect(result).toMatchObject({ form: 'markRange', success: true });
		expect(getDay(db, '2026-09-14')).toMatchObject({ kind: 'leave', notes: 'Family trip' });
		expect(getDay(db, '2026-09-15')).toBeNull(); // the holiday is left alone
		expect(getDay(db, '2026-09-16')).toMatchObject({ kind: 'leave' });
	});

	it('marks a range with no note, leaving notes null', async () => {
		const { actions } = await import('./+page.server');
		const result = await actions.markRange(
			markRangeEvent({ from: '2026-09-14', to: '2026-09-14', kind: 'sick', note: '  ' })
		);
		expect(result).toMatchObject({ form: 'markRange', success: true });
		expect(getDay(db, '2026-09-14')).toMatchObject({ kind: 'sick', notes: null });
	});

	it('fails validation when the range ends before it starts', async () => {
		const { actions } = await import('./+page.server');
		const result = await actions.markRange(
			markRangeEvent({ from: '2026-09-16', to: '2026-09-14', kind: 'leave', note: '' })
		);
		expect(result).toMatchObject({ status: 400 });
	});

	it('rejects a range that reaches outside the financial year being viewed', async () => {
		const { actions } = await import('./+page.server');
		const result = await actions.markRange(
			markRangeEvent({ from: '2026-06-01', to: '2026-09-14', kind: 'leave', note: '' })
		);
		expect(result).toMatchObject({
			status: 400,
			data: { errors: { from: ['The range must stay within the financial year being viewed.'] } }
		});
	});

	it('rejects marking a range once the year is finalised', async () => {
		createYear(db, { startYear: 2026, rateCentsPerHour: 70 });
		finaliseYear(db, 2026, '2026-09-14');

		const { actions } = await import('./+page.server');
		const result = await actions.markRange(
			markRangeEvent({ from: '2026-09-14', to: '2026-09-16', kind: 'sick', note: '' })
		);
		expect(result).toMatchObject({ status: 400 });
		expect(getDay(db, '2026-09-14')).toBeNull();
	});
});
