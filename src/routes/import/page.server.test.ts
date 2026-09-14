import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildLegacyWorkbook, standardHomeRow } from '$lib/server/import.fixtures';
import { createDb, type Db } from '$lib/server/db/create';
import { getDay } from '$lib/server/repo/days';
import { createOffice, listOffices } from '$lib/server/repo/offices';
import { createYear, finaliseYear, getYear } from '$lib/server/repo/years';
import { upsertDay } from '$lib/server/repo/days';
import { parseLegacyWorkbook, type ImportPreview } from '$lib/server/import';

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

function fileFrom(buffer: Buffer, name = 'diary.xlsx'): File {
	return new File([new Uint8Array(buffer)], name, {
		type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
	});
}

function uploadEvent(file: File | null): never {
	const formData = new FormData();
	if (file) formData.append('file', file);
	return { request: { formData: async () => formData } } as never;
}

function commitEvent(fields: Record<string, string>): never {
	const formData = new FormData();
	for (const [key, value] of Object.entries(fields)) formData.append(key, value);
	return { request: { formData: async () => formData } } as never;
}

describe('load', () => {
	it('returns the current offices', async () => {
		createOffice(db, { name: 'Office Location 1' });
		const { load } = await import('./+page.server');
		const result = load({} as never) as { offices: unknown[] };
		expect(result.offices).toHaveLength(1);
	});
});

describe('actions.upload', () => {
	it('fails when no file was chosen', async () => {
		const { actions } = await import('./+page.server');
		const result = (await actions.upload(uploadEvent(null))) as {
			status: number;
			data: { error: string };
		};
		expect(result.status).toBe(400);
		expect(result.data.error).toMatch(/Choose a .xlsx file/);
	});

	it('fails when the file is larger than the upload cap', async () => {
		const { actions } = await import('./+page.server');
		const big = fileFrom(Buffer.alloc(21 * 1024 * 1024));
		const result = (await actions.upload(uploadEvent(big))) as {
			status: number;
			data: { error: string };
		};
		expect(result.status).toBe(400);
		expect(result.data.error).toMatch(/too large/);
	});

	it('fails with the parser error message for an unreadable workbook', async () => {
		const { actions } = await import('./+page.server');
		const bad = fileFrom(Buffer.from('not a workbook'));
		const result = (await actions.upload(uploadEvent(bad))) as {
			status: number;
			data: { error: string };
		};
		expect(result.status).toBe(400);
		expect(result.data.error).toBeTruthy();
	});

	it('falls back to a generic message when the parser throws a non-Error value', async () => {
		vi.resetModules();
		vi.doMock('$lib/server/import', () => ({
			parseLegacyWorkbook: () => {
				throw 'not an Error object';
			}
		}));
		const { actions } = await import('./+page.server');
		const result = (await actions.upload(uploadEvent(fileFrom(Buffer.from('x'))))) as {
			status: number;
			data: { error: string };
		};
		expect(result.status).toBe(400);
		expect(result.data.error).toBe('Could not read this workbook.');
		vi.doUnmock('$lib/server/import');
		vi.resetModules();
	});

	it('returns a preview and the existing rate for a valid workbook', async () => {
		createYearShortcut(db, 2026, 65);
		const buffer = await buildLegacyWorkbook({
			fyStartYear: 2026,
			rows: [standardHomeRow('2026-07-01')]
		});
		const { actions } = await import('./+page.server');
		const result = (await actions.upload(uploadEvent(fileFrom(buffer)))) as {
			form: string;
			preview: { fyStartYear: number };
			existingRateCentsPerHour: number | null;
		};
		expect(result.form).toBe('upload');
		expect(result.preview.fyStartYear).toBe(2026);
		expect(result.existingRateCentsPerHour).toBe(65);
	});

	it('reports a null existing rate when the FY has not been created yet', async () => {
		const buffer = await buildLegacyWorkbook({
			fyStartYear: 2026,
			rows: [standardHomeRow('2026-07-01')]
		});
		const { actions } = await import('./+page.server');
		const result = (await actions.upload(uploadEvent(fileFrom(buffer)))) as {
			existingRateCentsPerHour: number | null;
		};
		expect(result.existingRateCentsPerHour).toBeNull();
	});
});

describe('actions.commit', () => {
	it('fails when the preview field is missing or unparsable', async () => {
		const { actions } = await import('./+page.server');
		const result = (await actions.commit(commitEvent({ preview: 'not json' }))) as {
			status: number;
			data: { error: string };
		};
		expect(result.status).toBe(400);
		expect(result.data.error).toMatch(/upload the file again/);
	});

	it('fails when the rate is blank', async () => {
		const preview = await previewFor(db, [standardHomeRow('2026-07-01')]);
		const { actions } = await import('./+page.server');
		const result = (await actions.commit(
			commitEvent({ preview: JSON.stringify(preview), rateDollars: '' })
		)) as { status: number; data: { error: string } };
		expect(result.status).toBe(400);
		expect(result.data.error).toMatch(/valid rate/);
	});

	it('fails when the rate is not a number', async () => {
		const preview = await previewFor(db, [standardHomeRow('2026-07-01')]);
		const { actions } = await import('./+page.server');
		const result = (await actions.commit(
			commitEvent({ preview: JSON.stringify(preview), rateDollars: 'not-a-number' })
		)) as { status: number; data: { error: string } };
		expect(result.status).toBe(400);
		expect(result.data.error).toMatch(/valid rate/);
	});

	it('fails when the rate is negative', async () => {
		const preview = await previewFor(db, [standardHomeRow('2026-07-01')]);
		const { actions } = await import('./+page.server');
		const result = (await actions.commit(
			commitEvent({ preview: JSON.stringify(preview), rateDollars: '-1' })
		)) as { status: number; data: { error: string } };
		expect(result.status).toBe(400);
		expect(result.data.error).toMatch(/valid rate/);
	});

	it('fails when the rate is absurdly large (a crafted POST)', async () => {
		const preview = await previewFor(db, [standardHomeRow('2026-07-01')]);
		const { actions } = await import('./+page.server');
		const result = (await actions.commit(
			commitEvent({ preview: JSON.stringify(preview), rateDollars: '1000000' })
		)) as { status: number; data: { error: string } };
		expect(result.status).toBe(400);
		expect(result.data.error).toMatch(/valid rate/);
	});

	it('fails when the preview JSON parses but has the wrong shape', async () => {
		const { actions } = await import('./+page.server');
		const result = (await actions.commit(commitEvent({ preview: '{}', rateDollars: '0.70' }))) as {
			status: number;
			data: { error: string };
		};
		expect(result.status).toBe(400);
		expect(result.data.error).toMatch(/upload the file again/);
	});

	it('fails when the preview field is entirely absent from the form', async () => {
		const { actions } = await import('./+page.server');
		const result = (await actions.commit(commitEvent({ rateDollars: '0.70' }))) as {
			status: number;
			data: { error: string };
		};
		expect(result.status).toBe(400);
		expect(result.data.error).toMatch(/upload the file again/);
	});

	it('fails when the target FY is already finalised', async () => {
		createYearShortcut(db, 2026, 70);
		finaliseYear(db, 2026, '2026-08-01');
		const preview = await previewFor(db, [standardHomeRow('2026-07-01')]);
		const { actions } = await import('./+page.server');
		const result = (await actions.commit(
			commitEvent({ preview: JSON.stringify(preview), rateDollars: '0.70' })
		)) as { status: number; data: { error: string } };
		expect(result.status).toBe(400);
		expect(result.data.error).toMatch(/already finalised/);
	});

	it('re-throws an error from commitImport that is not FinalisedYearError', async () => {
		const preview = await previewFor(db, [standardHomeRow('2026-07-01')]);
		vi.resetModules();
		vi.doMock('$lib/server/importCommit', () => ({
			commitImport: () => {
				throw new Error('boom');
			},
			FinalisedYearError: class FinalisedYearError extends Error {}
		}));
		const { actions } = await import('./+page.server');
		await expect(
			actions.commit(
				commitEvent({
					preview: JSON.stringify(preview),
					rateDollars: '0.70',
					[`include-${preview.rows[0].rowNumber}`]: 'on'
				})
			)
		).rejects.toThrow('boom');
		vi.doUnmock('$lib/server/importCommit');
		vi.resetModules();
	});

	it('commits the reviewed rows and redirects to the FY, counting every included row', async () => {
		const preview = await previewFor(db, [
			standardHomeRow('2026-07-01'),
			standardHomeRow('2026-07-02')
		]);
		const { actions } = await import('./+page.server');
		try {
			await actions.commit(
				commitEvent({
					preview: JSON.stringify(preview),
					rateDollars: '0.70',
					[`include-${preview.rows[0].rowNumber}`]: 'on',
					[`include-${preview.rows[1].rowNumber}`]: 'on'
				})
			);
			expect.unreachable('expected a redirect');
		} catch (error) {
			expect(error).toMatchObject({ status: 303, location: '/fy27?imported=2' });
		}
		expect(getYear(db, 2026)).toMatchObject({ rateCentsPerHour: 70 });
		expect(getDay(db, '2026-07-01')).toMatchObject({ source: 'import' });
	});

	it('resolves a proposed office per the chosen action (create/map/ignore)', async () => {
		const existingOffice = createOffice(db, { name: 'Office Location 1' });
		const preview = await previewFor(db, [
			{ date: '2026-07-01', notes: 'CityOffice' },
			{ date: '2026-07-02', notes: 'HQ' },
			{ date: '2026-07-03', notes: 'Nonsense' }
		]);
		const { actions } = await import('./+page.server');
		const includeFields = Object.fromEntries(
			preview.rows.map((row) => [`include-${row.rowNumber}`, 'on'])
		);
		try {
			await actions.commit(
				commitEvent({
					preview: JSON.stringify(preview),
					rateDollars: '0.70',
					...includeFields,
					'office-CityOffice': 'create',
					'office-HQ': `map:${existingOffice.id}`,
					'office-Nonsense': 'ignore'
				})
			);
			expect.unreachable('expected a redirect');
		} catch {
			// redirect expected — assertions are on the resulting DB state below
		}

		const cityOffice = listOffices(db).find((office) => office.name === 'CityOffice');
		expect(cityOffice).toBeDefined();
		expect(getDay(db, '2026-07-01')?.officeId).toBe(cityOffice!.id);
		expect(getDay(db, '2026-07-02')?.officeId).toBe(existingOffice.id);
		expect(getDay(db, '2026-07-03')?.officeId).toBeNull();
	});

	it('fails when a proposed office is mapped to an office id that does not exist', async () => {
		const preview = await previewFor(db, [{ date: '2026-07-01', notes: 'CityOffice' }]);
		const { actions } = await import('./+page.server');
		const result = (await actions.commit(
			commitEvent({
				preview: JSON.stringify(preview),
				rateDollars: '0.70',
				[`include-${preview.rows[0].rowNumber}`]: 'on',
				'office-CityOffice': 'map:99999'
			})
		)) as { status: number; data: { error: string } };
		expect(result.status).toBe(400);
		expect(result.data.error).toMatch(/no longer exists/);
	});

	it('fails when a proposed office is mapped to a non-numeric id', async () => {
		const preview = await previewFor(db, [{ date: '2026-07-01', notes: 'CityOffice' }]);
		const { actions } = await import('./+page.server');
		const result = (await actions.commit(
			commitEvent({
				preview: JSON.stringify(preview),
				rateDollars: '0.70',
				[`include-${preview.rows[0].rowNumber}`]: 'on',
				'office-CityOffice': 'map:not-a-number'
			})
		)) as { status: number; data: { error: string } };
		expect(result.status).toBe(400);
		expect(result.data.error).toMatch(/no longer exists/);
	});

	it('excludes a row whose include checkbox is unchecked', async () => {
		const preview = await previewFor(db, [standardHomeRow('2026-07-01')]);
		const { actions } = await import('./+page.server');
		try {
			await actions.commit(commitEvent({ preview: JSON.stringify(preview), rateDollars: '0.70' }));
		} catch {
			// redirect expected
		}
		expect(getDay(db, '2026-07-01')).toBeNull();
	});

	it('passes replaceManualEdits through to the commit', async () => {
		const preview = await previewFor(db, [standardHomeRow('2026-07-01')]);
		upsertDay(
			db,
			{
				date: '2026-07-01',
				kind: 'leave',
				officeId: null,
				notes: 'Kept by hand',
				source: 'manual',
				blocks: []
			},
			'2026-07-01T00:00:00.000Z'
		);
		const { actions } = await import('./+page.server');
		try {
			await actions.commit(
				commitEvent({
					preview: JSON.stringify(preview),
					rateDollars: '0.70',
					[`include-${preview.rows[0].rowNumber}`]: 'on',
					replaceManualEdits: 'on'
				})
			);
		} catch {
			// redirect expected
		}
		expect(getDay(db, '2026-07-01')).toMatchObject({ source: 'import', kind: 'work' });
	});
});

// Local helpers, kept file-scoped since they lean on this file's own `db` fixture wiring.

function createYearShortcut(database: Db, startYear: number, rateCentsPerHour: number) {
	createYear(database, { startYear, rateCentsPerHour });
}

async function previewFor(
	database: Db,
	rows: Parameters<typeof buildLegacyWorkbook>[0]['rows']
): Promise<ImportPreview> {
	const buffer = await buildLegacyWorkbook({ fyStartYear: 2026, rows });
	return parseLegacyWorkbook(buffer, { offices: listOffices(database) });
}
