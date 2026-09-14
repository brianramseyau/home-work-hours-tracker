import { beforeEach, describe, expect, it } from 'vitest';
import type { ImportRow } from './import';
import { commitImport, FinalisedYearError } from './importCommit';
import { createDb, type Db } from './db/create';
import { getDay, upsertDay } from './repo/days';
import { createOffice, listOffices } from './repo/offices';
import { finaliseYear, getYear } from './repo/years';
import { getSettings } from './repo/settings';

let db: Db;

beforeEach(() => {
	db = createDb(':memory:');
});

function row(overrides: Partial<ImportRow>): ImportRow {
	return {
		rowNumber: 1,
		date: '2026-07-01',
		kind: 'work',
		officeName: null,
		start: '09:00',
		end: '17:06',
		breakMinutes: 30,
		notes: null,
		skip: false,
		...overrides
	};
}

describe('commitImport', () => {
	it('creates the FY when it does not exist yet', () => {
		commitImport(db, {
			fyStartYear: 2026,
			rateCentsPerHour: 70,
			rows: [row({})],
			officeResolutions: [],
			replaceManualEdits: false
		});
		expect(getYear(db, 2026)).toMatchObject({ startYear: 2026, rateCentsPerHour: 70 });
	});

	it('leaves an existing FY alone rather than resetting its rate', () => {
		commitImport(db, {
			fyStartYear: 2026,
			rateCentsPerHour: 70,
			rows: [],
			officeResolutions: [],
			replaceManualEdits: false
		});
		commitImport(db, {
			fyStartYear: 2026,
			rateCentsPerHour: 99,
			rows: [],
			officeResolutions: [],
			replaceManualEdits: false
		});
		expect(getYear(db, 2026)?.rateCentsPerHour).toBe(70);
	});

	it('throws FinalisedYearError and writes nothing when the FY is finalised', () => {
		commitImport(db, {
			fyStartYear: 2026,
			rateCentsPerHour: 70,
			rows: [],
			officeResolutions: [],
			replaceManualEdits: false
		});
		finaliseYear(db, 2026, '2026-08-01');

		expect(() =>
			commitImport(db, {
				fyStartYear: 2026,
				rateCentsPerHour: 70,
				rows: [row({})],
				officeResolutions: [],
				replaceManualEdits: false
			})
		).toThrow(FinalisedYearError);
		expect(getDay(db, '2026-07-01')).toBeNull();
	});

	it('imports a work day with a home block, counted as imported', () => {
		const result = commitImport(db, {
			fyStartYear: 2026,
			rateCentsPerHour: 70,
			rows: [row({})],
			officeResolutions: [],
			replaceManualEdits: false
		});
		expect(result).toEqual({ imported: 1, skipped: 0 });
		expect(getDay(db, '2026-07-01')).toMatchObject({
			kind: 'work',
			source: 'import',
			blocks: [{ start: '09:00', end: '17:06', breakMinutes: 30 }]
		});
	});

	it('imports a non-work kind (leave/sick) with no blocks', () => {
		commitImport(db, {
			fyStartYear: 2026,
			rateCentsPerHour: 70,
			rows: [row({ kind: 'sick', start: null, end: null, breakMinutes: null, notes: 'Sick' })],
			officeResolutions: [],
			replaceManualEdits: false
		});
		expect(getDay(db, '2026-07-01')).toMatchObject({ kind: 'sick', blocks: [], notes: 'Sick' });
	});

	it('counts a skip:true row as skipped and never writes it', () => {
		const result = commitImport(db, {
			fyStartYear: 2026,
			rateCentsPerHour: 70,
			rows: [row({ skip: true })],
			officeResolutions: [],
			replaceManualEdits: false
		});
		expect(result).toEqual({ imported: 0, skipped: 1 });
		expect(getDay(db, '2026-07-01')).toBeNull();
	});

	it('creates a proposed office and links the row to it', () => {
		commitImport(db, {
			fyStartYear: 2026,
			rateCentsPerHour: 70,
			rows: [row({ officeName: 'CityOffice', start: null, end: null, breakMinutes: null })],
			officeResolutions: [{ name: 'CityOffice', action: 'create' }],
			replaceManualEdits: false
		});
		const office = listOffices(db).find((o) => o.name === 'CityOffice');
		expect(office).toBeDefined();
		expect(getDay(db, '2026-07-01')?.officeId).toBe(office!.id);
	});

	it('maps a proposed office name to an existing office id', () => {
		const existingOffice = createOffice(db, { name: 'Office Location 1' });
		commitImport(db, {
			fyStartYear: 2026,
			rateCentsPerHour: 70,
			rows: [row({ officeName: 'HQ', start: null, end: null, breakMinutes: null })],
			officeResolutions: [{ name: 'HQ', action: 'map', mapToOfficeId: existingOffice.id }],
			replaceManualEdits: false
		});
		expect(getDay(db, '2026-07-01')?.officeId).toBe(existingOffice.id);
	});

	it('maps a proposed office with no mapToOfficeId to no office at all', () => {
		commitImport(db, {
			fyStartYear: 2026,
			rateCentsPerHour: 70,
			rows: [row({ officeName: 'HQ', start: null, end: null, breakMinutes: null })],
			officeResolutions: [{ name: 'HQ', action: 'map' }],
			replaceManualEdits: false
		});
		expect(getDay(db, '2026-07-01')?.officeId).toBeNull();
	});

	it('defaults a missing breakMinutes to 0 for a timed row', () => {
		commitImport(db, {
			fyStartYear: 2026,
			rateCentsPerHour: 70,
			rows: [row({ breakMinutes: null })],
			officeResolutions: [],
			replaceManualEdits: false
		});
		expect(getDay(db, '2026-07-01')?.blocks).toEqual([
			{ start: '09:00', end: '17:06', breakMinutes: 0 }
		]);
	});

	it('ignores a proposed office, dropping it so the row has no office', () => {
		commitImport(db, {
			fyStartYear: 2026,
			rateCentsPerHour: 70,
			rows: [row({ officeName: 'Nonsense', start: null, end: null, breakMinutes: null })],
			officeResolutions: [{ name: 'Nonsense', action: 'ignore' }],
			replaceManualEdits: false
		});
		expect(getDay(db, '2026-07-01')?.officeId).toBeNull();
	});

	it("resolves a row's office name against an already-existing office without a resolution entry", () => {
		const existingOffice = createOffice(db, { name: 'Office Location 1' });
		commitImport(db, {
			fyStartYear: 2026,
			rateCentsPerHour: 70,
			rows: [
				row({
					officeName: 'Office Location 1',
					start: null,
					end: null,
					breakMinutes: null
				})
			],
			officeResolutions: [],
			replaceManualEdits: false
		});
		expect(getDay(db, '2026-07-01')?.officeId).toBe(existingOffice.id);
	});

	it('replaces an existing prefill row unconditionally', () => {
		upsertDay(
			db,
			{
				date: '2026-07-01',
				kind: 'work',
				officeId: null,
				notes: null,
				source: 'prefill',
				blocks: [{ start: '09:00', end: '17:06', breakMinutes: 30 }]
			},
			'2026-07-01T00:00:00.000Z'
		);
		commitImport(db, {
			fyStartYear: 2026,
			rateCentsPerHour: 70,
			rows: [row({ date: '2026-07-01', kind: 'sick', start: null, end: null, breakMinutes: null })],
			officeResolutions: [],
			replaceManualEdits: false
		});
		expect(getDay(db, '2026-07-01')).toMatchObject({ kind: 'sick', source: 'import' });
	});

	it('does not overwrite a manual row unless replaceManualEdits is set', () => {
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

		const skippedResult = commitImport(db, {
			fyStartYear: 2026,
			rateCentsPerHour: 70,
			rows: [row({ date: '2026-07-01' })],
			officeResolutions: [],
			replaceManualEdits: false
		});
		expect(skippedResult).toEqual({ imported: 0, skipped: 1 });
		expect(getDay(db, '2026-07-01')).toMatchObject({ source: 'manual', kind: 'leave' });

		const replacedResult = commitImport(db, {
			fyStartYear: 2026,
			rateCentsPerHour: 70,
			rows: [row({ date: '2026-07-01' })],
			officeResolutions: [],
			replaceManualEdits: true
		});
		expect(replacedResult).toEqual({ imported: 1, skipped: 0 });
		expect(getDay(db, '2026-07-01')).toMatchObject({ source: 'import', kind: 'work' });
	});

	it('raises the watermark to the latest imported date, never back-filling earlier gaps', () => {
		commitImport(db, {
			fyStartYear: 2026,
			rateCentsPerHour: 70,
			rows: [row({ date: '2026-07-01' }), row({ date: '2026-07-03' })],
			officeResolutions: [],
			replaceManualEdits: false
		});
		expect(getSettings(db).prefilledThrough).toBe('2026-07-03');
	});

	it('leaves the watermark alone when every row is skipped', () => {
		commitImport(db, {
			fyStartYear: 2026,
			rateCentsPerHour: 70,
			rows: [row({ skip: true })],
			officeResolutions: [],
			replaceManualEdits: false
		});
		expect(getSettings(db).prefilledThrough).toBeNull();
	});
});
