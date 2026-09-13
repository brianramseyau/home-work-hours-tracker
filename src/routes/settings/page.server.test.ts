import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PageData } from './$types';
import { createDb, type Db } from '$lib/server/db/create';
import { getDay, upsertDay } from '$lib/server/repo/days';
import { createOffice, listOffices } from '$lib/server/repo/offices';
import { addCustomHoliday, listHolidays } from '$lib/server/repo/holidays';
import { listSchedules } from '$lib/server/repo/schedules';
import { getSettings } from '$lib/server/repo/settings';

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

// `load`'s declared PageServerLoad type falls back to a generic (void-inclusive) shape when
// called with a synthetic event; this casts the runtime result back to the real, precisely
// inferred PageData shape (which $types derives straight from the load function's own body).
function asData(result: unknown): PageData {
	return result as PageData;
}

function actionEvent(fields: Record<string, string> = {}, url = 'http://localhost/settings') {
	const formData = new FormData();
	for (const [key, value] of Object.entries(fields)) formData.append(key, value);
	return {
		request: { formData: async () => formData },
		url: new URL(url)
	} as never;
}

describe('load', () => {
	it('returns settings, offices, schedules and this FY’s holidays', async () => {
		const { load } = await import('./+page.server');
		const result = asData(load(actionEvent()));

		expect(result.settings.holidayRegion).toBe('AU-VIC');
		expect(result.offices).toEqual([]);
		expect(result.schedules).toEqual([]);
		expect(result.holidayFy).toEqual({
			startYear: 2026,
			label: 'FY27',
			slug: 'fy27',
			range: 'Jul 2026 – Jun 2027'
		});
	});

	it('seeds bundled AU-VIC holidays for the FY on first load', async () => {
		const { load } = await import('./+page.server');
		const result = asData(load(actionEvent()));

		const names = result.holidays.map((h) => h.name);
		expect(names).toContain('Melbourne Cup');
		expect(result.holidays.every((h) => h.source === 'bundled')).toBe(true);
	});

	it('reads the FY to show from the ?fy query param', async () => {
		const { load } = await import('./+page.server');
		const result = asData(load(actionEvent({}, 'http://localhost/settings?fy=fy28')));
		expect(result.holidayFy.label).toBe('FY28');
	});

	it('falls back to the current FY for a malformed ?fy param', async () => {
		const { load } = await import('./+page.server');
		const result = asData(load(actionEvent({}, 'http://localhost/settings?fy=nonsense')));
		expect(result.holidayFy.label).toBe('FY27');
	});

	it('shows a disabled repeating custom holiday, projected onto the viewed FY', async () => {
		addCustomHoliday(db, {
			date: '2020-09-14',
			name: 'Office Location 1 anniversary',
			region: 'AU-VIC',
			repeatsYearly: true
		});
		const { setHolidayDisabled } = await import('$lib/server/repo/holidays');
		const [holiday] = listHolidays(db, 'AU-VIC').filter((h) => h.source === 'custom');
		setHolidayDisabled(db, holiday.id, true);

		const { load } = await import('./+page.server');
		const result = asData(load(actionEvent()));
		const row = result.holidays.find((h) => h.name === 'Office Location 1 anniversary');
		expect(row).toMatchObject({ disabled: true, displayDate: '2026-09-14' });
	});

	it('shows a one-off custom holiday only when it falls in the viewed FY', async () => {
		addCustomHoliday(db, {
			date: '2026-08-01',
			name: 'One-off',
			region: 'AU-VIC',
			repeatsYearly: false
		});
		const { load } = await import('./+page.server');

		const inFy = asData(load(actionEvent()));
		expect(inFy.holidays.some((h) => h.name === 'One-off')).toBe(true);

		const nextFy = asData(load(actionEvent({}, 'http://localhost/settings?fy=fy28')));
		expect(nextFy.holidays.some((h) => h.name === 'One-off')).toBe(false);
	});
});

describe('actions.general', () => {
	function validGeneralFields(overrides: Record<string, string> = {}) {
		return {
			fullName: 'John Doe',
			holidayRegion: 'AU-NSW',
			standardStart: '09:00',
			standardEnd: '17:06',
			standardBreakMinutes: '30',
			...overrides
		};
	}

	it('saves the general settings', async () => {
		const { actions } = await import('./+page.server');
		await actions.general(actionEvent(validGeneralFields({ includeWeekends: 'on' })));

		const settings = getSettings(db);
		expect(settings).toMatchObject({
			fullName: 'John Doe',
			holidayRegion: 'AU-NSW',
			standardStart: '09:00',
			standardEnd: '17:06',
			standardBreakMinutes: 30,
			includeWeekends: true
		});
	});

	it('re-seeds bundled holidays for the new region', async () => {
		const { actions } = await import('./+page.server');
		await actions.general(actionEvent(validGeneralFields()));

		const rows = listHolidays(db, 'AU-NSW');
		expect(rows.some((row) => row.source === 'bundled')).toBe(true);
	});

	it('re-plans prefill rows from the current FY start, leaving manual rows alone', async () => {
		upsertDay(
			db,
			{
				date: '2026-07-01',
				kind: 'work',
				officeId: null,
				notes: null,
				source: 'manual',
				blocks: [{ start: '09:00', end: '17:00', breakMinutes: 0 }]
			},
			'2026-07-01T00:00:00.000Z'
		);

		const { actions } = await import('./+page.server');
		await actions.general(actionEvent(validGeneralFields()));

		expect(getDay(db, '2026-07-01')?.source).toBe('manual');
	});

	it('fails on an invalid region', async () => {
		const { actions } = await import('./+page.server');
		const result = await actions.general(
			actionEvent(validGeneralFields({ holidayRegion: 'US-CA' }))
		);
		expect(result).toMatchObject({ status: 400 });
	});

	it('clears the full name when left blank', async () => {
		const { actions } = await import('./+page.server');
		await actions.general(actionEvent(validGeneralFields({ fullName: '' })));
		expect(getSettings(db).fullName).toBeNull();
	});
});

describe('office actions', () => {
	it('creates an office', async () => {
		const { actions } = await import('./+page.server');
		await actions.officeCreate(actionEvent({ name: 'Office Location 1', address: '' }));
		expect(listOffices(db).map((o) => o.name)).toEqual(['Office Location 1']);
	});

	it('creates an office with an address', async () => {
		const { actions } = await import('./+page.server');
		await actions.officeCreate(
			actionEvent({
				name: 'Office Location 1',
				address: '123 Example St, Sampletown VIC 3000'
			})
		);
		expect(listOffices(db)[0].address).toBe('123 Example St, Sampletown VIC 3000');
	});

	it('fails to create an office with a blank name', async () => {
		const { actions } = await import('./+page.server');
		const result = await actions.officeCreate(actionEvent({ name: '  ', address: '' }));
		expect(result).toMatchObject({ status: 400 });
	});

	it('updates an office', async () => {
		const office = createOffice(db, { name: 'Office Location 1' });
		const { actions } = await import('./+page.server');
		await actions.officeUpdate(
			actionEvent({
				id: String(office.id),
				name: 'Office Location 1 (renamed)',
				address: '123 Example St, Sampletown VIC 3000'
			})
		);
		expect(listOffices(db)[0]).toMatchObject({
			name: 'Office Location 1 (renamed)',
			address: '123 Example St, Sampletown VIC 3000'
		});
	});

	it('fails to update an office with a blank name', async () => {
		const office = createOffice(db, { name: 'Office Location 1' });
		const { actions } = await import('./+page.server');
		const result = await actions.officeUpdate(
			actionEvent({ id: String(office.id), name: '  ', address: '' })
		);
		expect(result).toMatchObject({ status: 400 });
	});

	it('archives and unarchives an office', async () => {
		const office = createOffice(db, { name: 'Office Location 1' });
		const { actions } = await import('./+page.server');

		await actions.officeArchive(actionEvent({ id: String(office.id) }));
		expect(listOffices(db)).toEqual([]);

		await actions.officeUnarchive(actionEvent({ id: String(office.id) }));
		expect(listOffices(db).map((o) => o.name)).toEqual(['Office Location 1']);
	});
});

describe('schedule actions', () => {
	it('creates a schedule and re-plans from its effective date', async () => {
		const { actions } = await import('./+page.server');
		const days = [{ weekIndex: 0, weekday: 1, mode: 'home', officeId: null }];
		await actions.schedule(
			actionEvent({
				effectiveFrom: '2026-07-01',
				cycleWeeks: '1',
				anchorMonday: '2026-06-29',
				days: JSON.stringify(days)
			})
		);

		expect(listSchedules(db)).toHaveLength(1);
	});

	it('fails when the days field is missing entirely', async () => {
		const { actions } = await import('./+page.server');
		const result = await actions.schedule(
			actionEvent({ effectiveFrom: '2026-07-01', cycleWeeks: '1', anchorMonday: '2026-06-29' })
		);
		expect(result).toMatchObject({ status: 400 });
	});

	it('fails on malformed days JSON', async () => {
		const { actions } = await import('./+page.server');
		const result = await actions.schedule(
			actionEvent({
				effectiveFrom: '2026-07-01',
				cycleWeeks: '1',
				anchorMonday: '2026-06-29',
				days: '{not json'
			})
		);
		expect(result).toMatchObject({ status: 400 });
	});

	it('fails when the anchor is not a Monday', async () => {
		const { actions } = await import('./+page.server');
		const result = await actions.schedule(
			actionEvent({
				effectiveFrom: '2026-07-01',
				cycleWeeks: '1',
				anchorMonday: '2026-07-01',
				days: '[]'
			})
		);
		expect(result).toMatchObject({ status: 400 });
	});

	it('deletes a schedule and re-plans from its effective date', async () => {
		const { actions } = await import('./+page.server');
		await actions.schedule(
			actionEvent({
				effectiveFrom: '2026-07-01',
				cycleWeeks: '1',
				anchorMonday: '2026-06-29',
				days: '[]'
			})
		);
		const [schedule] = listSchedules(db);

		await actions.deleteSchedule(
			actionEvent({ id: String(schedule.id), effectiveFrom: '2026-07-01' })
		);
		expect(listSchedules(db)).toEqual([]);
	});

	it('deletes a schedule without an effectiveFrom hint without throwing', async () => {
		const { actions } = await import('./+page.server');
		await actions.schedule(
			actionEvent({
				effectiveFrom: '2026-07-01',
				cycleWeeks: '1',
				anchorMonday: '2026-06-29',
				days: '[]'
			})
		);
		const [schedule] = listSchedules(db);
		await expect(
			actions.deleteSchedule(actionEvent({ id: String(schedule.id) }))
		).resolves.toBeDefined();
	});
});

describe('holiday actions', () => {
	it('creates a custom holiday under the current region', async () => {
		const { actions } = await import('./+page.server');
		await actions.holidayCreate(
			actionEvent({ date: '2026-09-14', name: 'Office Location 1 anniversary' })
		);
		const rows = listHolidays(db, 'AU-VIC').filter((row) => row.source === 'custom');
		expect(rows).toMatchObject([{ name: 'Office Location 1 anniversary', repeatsYearly: false }]);
	});

	it('fails to create a holiday with a blank name', async () => {
		const { actions } = await import('./+page.server');
		const result = await actions.holidayCreate(actionEvent({ date: '2026-09-14', name: '' }));
		expect(result).toMatchObject({ status: 400 });
	});

	it('toggles a holiday disabled and back', async () => {
		const holiday = addCustomHoliday(db, {
			date: '2026-09-14',
			name: 'Office Location 1 anniversary',
			region: 'AU-VIC',
			repeatsYearly: false
		});
		const { actions } = await import('./+page.server');

		await actions.holidayToggle(actionEvent({ id: String(holiday.id), disabled: 'true' }));
		expect(listHolidays(db, 'AU-VIC')[0].disabled).toBe(true);

		await actions.holidayToggle(actionEvent({ id: String(holiday.id), disabled: 'false' }));
		expect(listHolidays(db, 'AU-VIC')[0].disabled).toBe(false);
	});

	it('deletes a custom holiday', async () => {
		const holiday = addCustomHoliday(db, {
			date: '2026-09-14',
			name: 'Office Location 1 anniversary',
			region: 'AU-VIC',
			repeatsYearly: false
		});
		const { actions } = await import('./+page.server');
		await actions.holidayDelete(actionEvent({ id: String(holiday.id) }));
		expect(listHolidays(db, 'AU-VIC')).toEqual([]);
	});
});
