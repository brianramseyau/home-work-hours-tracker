import { describe, expect, it } from 'vitest';
import { buildLegacyWorkbook, standardHomeRow } from './import.fixtures';
import { parseLegacyWorkbook } from './import';

const OFFICES = [
	{ id: 1, name: 'Office Location 1' },
	{ id: 2, name: 'Office Location 2' }
];

describe('parseLegacyWorkbook', () => {
	it('parses standard weekday home rows, deriving the FY, rate and break from the sheet', async () => {
		const buffer = await buildLegacyWorkbook({
			fyStartYear: 2026,
			totalHours: 15.2,
			flatRate: 10.64,
			rows: [standardHomeRow('2026-07-01'), standardHomeRow('2026-07-02')]
		});
		const preview = await parseLegacyWorkbook(buffer, { offices: OFFICES });

		expect(preview.fyStartYear).toBe(2026);
		expect(preview.rateCentsPerHour).toBe(70);
		expect(preview.issues).toEqual([]);
		expect(preview.rows).toHaveLength(2);
		expect(preview.rows[0]).toMatchObject({
			date: '2026-07-01',
			kind: 'work',
			officeName: null,
			start: '09:00',
			end: '17:06',
			breakMinutes: 30,
			skip: false
		});
		expect(preview.appTotals.hours).toBeCloseTo(15.2, 5);
		expect(preview.mismatch).toBe(false);
	});

	it('maps a note matching an existing office (case-insensitive, trimmed) to an office day', async () => {
		const buffer = await buildLegacyWorkbook({
			fyStartYear: 2026,
			rows: [{ date: '2026-07-01', notes: '  office location 1  ' }]
		});
		const preview = await parseLegacyWorkbook(buffer, { offices: OFFICES });

		expect(preview.rows[0]).toMatchObject({
			kind: 'work',
			officeName: 'Office Location 1',
			start: null,
			end: null
		});
		expect(preview.proposedOffices).toEqual([]);
	});

	it('treats a timed row whose note matches an office as split', async () => {
		const buffer = await buildLegacyWorkbook({
			fyStartYear: 2026,
			rows: [
				{ date: '2026-07-01', start: '09:00', end: '13:00', total: 4, notes: 'Office Location 2' }
			]
		});
		const preview = await parseLegacyWorkbook(buffer, { offices: OFFICES });

		expect(preview.rows[0]).toMatchObject({
			kind: 'work',
			officeName: 'Office Location 2',
			start: '09:00',
			end: '13:00',
			breakMinutes: 0
		});
	});

	it('strips a trailing "?" from a note only for office matching, keeping the original note text', async () => {
		const buffer = await buildLegacyWorkbook({
			fyStartYear: 2026,
			rows: [{ date: '2026-07-01', notes: 'Office Location 1?' }]
		});
		const preview = await parseLegacyWorkbook(buffer, { offices: OFFICES });

		expect(preview.rows[0].officeName).toBe('Office Location 1');
		expect(preview.rows[0].notes).toBe('Office Location 1?');
	});

	it('proposes a new office for an unmatched short, single-word note', async () => {
		const buffer = await buildLegacyWorkbook({
			fyStartYear: 2026,
			rows: [{ date: '2026-07-01', notes: 'CityOffice' }]
		});
		const preview = await parseLegacyWorkbook(buffer, { offices: OFFICES });

		expect(preview.proposedOffices).toEqual(['CityOffice']);
		expect(preview.rows[0]).toMatchObject({ kind: 'work', officeName: 'CityOffice' });
	});

	it('maps "Sick" (any case) to a sick day, never as a proposed office', async () => {
		const buffer = await buildLegacyWorkbook({
			fyStartYear: 2026,
			rows: [{ date: '2026-07-01', notes: 'SICK' }]
		});
		const preview = await parseLegacyWorkbook(buffer, { offices: OFFICES });

		expect(preview.rows[0]).toMatchObject({ kind: 'sick', officeName: null });
		expect(preview.proposedOffices).toEqual([]);
	});

	it('expands a "start"…"end" marker range into leave for every date in between, inclusive', async () => {
		const buffer = await buildLegacyWorkbook({
			fyStartYear: 2026,
			rows: [
				{ date: '2026-07-06', notes: 'Leave start' },
				{ date: '2026-07-07' },
				{ date: '2026-07-08', notes: 'Leave end' },
				standardHomeRow('2026-07-09')
			]
		});
		const preview = await parseLegacyWorkbook(buffer, { offices: OFFICES });

		expect(preview.rows.slice(0, 3)).toEqual([
			{
				rowNumber: 3,
				date: '2026-07-06',
				kind: 'leave',
				officeName: null,
				start: null,
				end: null,
				breakMinutes: null,
				notes: 'Leave start',
				skip: false
			},
			{
				rowNumber: 4,
				date: '2026-07-07',
				kind: 'leave',
				officeName: null,
				start: null,
				end: null,
				breakMinutes: null,
				notes: null,
				skip: false
			},
			{
				rowNumber: 5,
				date: '2026-07-08',
				kind: 'leave',
				officeName: null,
				start: null,
				end: null,
				breakMinutes: null,
				notes: 'Leave end',
				skip: false
			}
		]);
		expect(preview.rows[3]).toMatchObject({ kind: 'work' });
	});

	it('supports a differently-worded range marker, e.g. "Xmas Hols START"/"…END"', async () => {
		const buffer = await buildLegacyWorkbook({
			fyStartYear: 2026,
			rows: [
				{ date: '2026-12-24', notes: 'Xmas Hols START' },
				{ date: '2026-12-25', notes: 'Xmas Hols END' }
			]
		});
		const preview = await parseLegacyWorkbook(buffer, { offices: OFFICES });

		expect(preview.rows.every((row) => row.kind === 'leave')).toBe(true);
	});

	it('skips a blank trailing row (a future date with no times and no note)', async () => {
		const buffer = await buildLegacyWorkbook({
			fyStartYear: 2026,
			rows: [standardHomeRow('2026-07-01'), { date: '2026-07-02' }]
		});
		const preview = await parseLegacyWorkbook(buffer, { offices: OFFICES });

		expect(preview.rows[1]).toMatchObject({ kind: 'off', skip: true });
		expect(preview.appTotals.hours).toBeCloseTo(7.6, 5);
	});

	it('falls back to the FY of the first date when the Year cell is missing', async () => {
		const buffer = await buildLegacyWorkbook({ rows: [standardHomeRow('2026-07-01')] });
		const preview = await parseLegacyWorkbook(buffer, { offices: OFFICES });
		expect(preview.fyStartYear).toBe(2026);
	});

	it('finds columns by header label even when the columns are reordered', async () => {
		const buffer = await buildLegacyWorkbook({
			fyStartYear: 2026,
			shuffleColumns: true,
			rows: [standardHomeRow('2026-07-01')]
		});
		const preview = await parseLegacyWorkbook(buffer, { offices: OFFICES });
		expect(preview.rows[0]).toMatchObject({ kind: 'work', start: '09:00', end: '17:06' });
	});

	it('takes a shorthand 17:00 end time literally, without treating it as the 17:06 standard', async () => {
		const buffer = await buildLegacyWorkbook({
			fyStartYear: 2026,
			rows: [{ date: '2026-07-01', start: '09:00', end: '17:00', total: 7.5 }]
		});
		const preview = await parseLegacyWorkbook(buffer, { offices: OFFICES });
		expect(preview.rows[0]).toMatchObject({ start: '09:00', end: '17:00', breakMinutes: 30 });
	});

	it('derives a non-standard break from the Total column', async () => {
		const buffer = await buildLegacyWorkbook({
			fyStartYear: 2026,
			rows: [{ date: '2026-07-01', start: '08:00', end: '16:00', total: 7 }]
		});
		const preview = await parseLegacyWorkbook(buffer, { offices: OFFICES });
		expect(preview.rows[0].breakMinutes).toBe(60);
	});

	it('flags an implausible break (negative or ≥ the span) as an issue and defaults it to 0', async () => {
		const buffer = await buildLegacyWorkbook({
			fyStartYear: 2026,
			rows: [{ date: '2026-07-01', start: '09:00', end: '17:00', total: 9 }]
		});
		const preview = await parseLegacyWorkbook(buffer, { offices: OFFICES });
		expect(preview.rows[0].breakMinutes).toBe(0);
		expect(preview.issues).toEqual([
			{ rowNumber: 3, reason: expect.stringContaining('Implausible break') }
		]);
	});

	it('flags a date outside the detected FY as an issue but still includes the row', async () => {
		const buffer = await buildLegacyWorkbook({
			fyStartYear: 2026,
			rows: [standardHomeRow('2025-07-01')]
		});
		const preview = await parseLegacyWorkbook(buffer, { offices: OFFICES });
		expect(preview.issues).toEqual([
			{ rowNumber: 3, reason: expect.stringContaining('falls outside FY27') }
		]);
		expect(preview.rows[0].kind).toBe('work');
	});

	it('reports a mismatch between the sheet totals and the recomputed app totals', async () => {
		const buffer = await buildLegacyWorkbook({
			fyStartYear: 2026,
			totalHours: 100,
			flatRate: 70,
			rows: [standardHomeRow('2026-07-01')]
		});
		const preview = await parseLegacyWorkbook(buffer, { offices: OFFICES });
		expect(preview.mismatch).toBe(true);
		expect(preview.sheetTotals).toEqual({ hours: 100, claimCents: 7000 });
	});

	it('reports no mismatch, and null sheet totals, when the sheet has no Total Hours cell', async () => {
		const buffer = await buildLegacyWorkbook({
			fyStartYear: 2026,
			rows: [standardHomeRow('2026-07-01')]
		});
		const preview = await parseLegacyWorkbook(buffer, { offices: OFFICES });
		expect(preview.mismatch).toBe(false);
		expect(preview.sheetTotals).toEqual({ hours: null, claimCents: null });
		expect(preview.rateCentsPerHour).toBeNull();
	});

	it('raises an issue for a row it cannot classify', async () => {
		const buffer = await buildLegacyWorkbook({
			fyStartYear: 2026,
			rows: [{ date: '2026-07-01', notes: 'a fairly long ambiguous free-text note here' }]
		});
		const preview = await parseLegacyWorkbook(buffer, { offices: OFFICES });
		expect(preview.rows[0]).toMatchObject({ kind: 'off', skip: true });
		expect(preview.issues).toEqual([
			{ rowNumber: 3, reason: expect.stringContaining('Could not classify') }
		]);
	});

	it('raises an issue when a row has no readable date', async () => {
		const workbook = await buildLegacyWorkbook({
			fyStartYear: 2026,
			rows: [standardHomeRow('2026-07-01'), standardHomeRow('2026-07-02')]
		});
		// Corrupt the second row's date cell directly via exceljs so the fixture builder's own
		// validation never gets in the way of exercising this branch, while the first row keeps
		// the workbook past the "no dated rows at all" check.
		const ExcelJS = (await import('exceljs')).default;
		const wb = new ExcelJS.Workbook();
		await wb.xlsx.load(workbook as unknown as ArrayBuffer);
		wb.worksheets[0].getCell(4, 2).value = 'not a date';
		const corrupted = Buffer.from(await wb.xlsx.writeBuffer());

		const preview = await parseLegacyWorkbook(corrupted, { offices: OFFICES });
		expect(preview.issues).toEqual([
			{ rowNumber: 4, reason: 'Could not read a date for this row' }
		]);
	});

	it('throws when the workbook has no header row', async () => {
		const ExcelJS = (await import('exceljs')).default;
		const wb = new ExcelJS.Workbook();
		wb.addWorksheet('Empty');
		const buffer = Buffer.from(await wb.xlsx.writeBuffer());
		await expect(parseLegacyWorkbook(buffer, { offices: OFFICES })).rejects.toThrow(
			/Could not find a header row/
		);
	});

	it('throws when the workbook has no dated rows at all', async () => {
		const buffer = await buildLegacyWorkbook({ fyStartYear: 2026, rows: [] });
		await expect(parseLegacyWorkbook(buffer, { offices: OFFICES })).rejects.toThrow(
			/Could not find any dated rows/
		);
	});

	it('reads a time cell stored as a plain fraction number rather than a Date', async () => {
		const buffer = await buildLegacyWorkbook({
			fyStartYear: 2026,
			rows: [standardHomeRow('2026-07-01')]
		});
		const ExcelJS = (await import('exceljs')).default;
		const wb = new ExcelJS.Workbook();
		await wb.xlsx.load(buffer as unknown as ArrayBuffer);
		const sheet = wb.worksheets[0];
		// Force plain numbers (no numFmt hint), which exceljs won't coerce to a Date on read.
		sheet.getCell(3, 3).value = 9 / 24;
		sheet.getCell(3, 3).numFmt = 'General';
		sheet.getCell(3, 4).value = 17.1 / 24;
		sheet.getCell(3, 4).numFmt = 'General';
		const rebuilt = Buffer.from(await wb.xlsx.writeBuffer());

		const preview = await parseLegacyWorkbook(rebuilt, { offices: OFFICES });
		expect(preview.rows[0]).toMatchObject({ start: '09:00', end: '17:06' });
	});

	it('reads a note stored as rich text', async () => {
		const buffer = await buildLegacyWorkbook({
			fyStartYear: 2026,
			rows: [{ date: '2026-07-01' }]
		});
		const ExcelJS = (await import('exceljs')).default;
		const wb = new ExcelJS.Workbook();
		await wb.xlsx.load(buffer as unknown as ArrayBuffer);
		wb.worksheets[0].getCell(3, 6).value = {
			richText: [{ text: 'Office Location 1' }]
		};
		const rebuilt = Buffer.from(await wb.xlsx.writeBuffer());

		const preview = await parseLegacyWorkbook(rebuilt, { offices: OFFICES });
		expect(preview.rows[0]).toMatchObject({ kind: 'work', officeName: 'Office Location 1' });
	});

	it('treats a lone "…end"-worded note (no matching start) as unclassifiable, not a range', async () => {
		const buffer = await buildLegacyWorkbook({
			fyStartYear: 2026,
			rows: [{ date: '2026-07-01', notes: 'Standalone end' }]
		});
		const preview = await parseLegacyWorkbook(buffer, { offices: OFFICES });
		expect(preview.rows[0]).toMatchObject({ kind: 'off', skip: true });
		expect(preview.issues).toEqual([
			{ rowNumber: 3, reason: expect.stringContaining('Could not classify') }
		]);
	});

	it('skips a fully blank physical row sitting between two data rows', async () => {
		const buffer = await buildLegacyWorkbook({
			fyStartYear: 2026,
			rows: [standardHomeRow('2026-07-01'), standardHomeRow('2026-07-02')]
		});
		const ExcelJS = (await import('exceljs')).default;
		const wb = new ExcelJS.Workbook();
		await wb.xlsx.load(buffer as unknown as ArrayBuffer);
		wb.worksheets[0].spliceRows(4, 0, []);
		const rebuilt = Buffer.from(await wb.xlsx.writeBuffer());

		const preview = await parseLegacyWorkbook(rebuilt, { offices: OFFICES });
		expect(preview.rows.map((row) => row.date)).toEqual(['2026-07-01', '2026-07-02']);
	});

	it('reads a date cell stored as a plain Excel serial number rather than a Date', async () => {
		const buffer = await buildLegacyWorkbook({
			fyStartYear: 2026,
			rows: [standardHomeRow('2026-07-01')]
		});
		const ExcelJS = (await import('exceljs')).default;
		const wb = new ExcelJS.Workbook();
		await wb.xlsx.load(buffer as unknown as ArrayBuffer);
		const cell = wb.worksheets[0].getCell(3, 2);
		cell.value = 46204; // the serial number for 2026-07-01
		cell.numFmt = 'General';
		const rebuilt = Buffer.from(await wb.xlsx.writeBuffer());

		const preview = await parseLegacyWorkbook(rebuilt, { offices: OFFICES });
		expect(preview.rows[0].date).toBe('2026-07-01');
	});

	it('reads a Total cell stored as a numeric string', async () => {
		const buffer = await buildLegacyWorkbook({
			fyStartYear: 2026,
			rows: [{ date: '2026-07-01', start: '09:00', end: '17:06' }]
		});
		const ExcelJS = (await import('exceljs')).default;
		const wb = new ExcelJS.Workbook();
		await wb.xlsx.load(buffer as unknown as ArrayBuffer);
		wb.worksheets[0].getCell(3, 5).value = '7.6';
		const rebuilt = Buffer.from(await wb.xlsx.writeBuffer());

		const preview = await parseLegacyWorkbook(rebuilt, { offices: OFFICES });
		expect(preview.rows[0].breakMinutes).toBe(30);
	});

	it('reads a date cell stored as plain ISO text', async () => {
		const buffer = await buildLegacyWorkbook({
			fyStartYear: 2026,
			rows: [standardHomeRow('2026-07-01')]
		});
		const ExcelJS = (await import('exceljs')).default;
		const wb = new ExcelJS.Workbook();
		await wb.xlsx.load(buffer as unknown as ArrayBuffer);
		wb.worksheets[0].getCell(3, 2).value = '2026-07-01';
		const rebuilt = Buffer.from(await wb.xlsx.writeBuffer());

		const preview = await parseLegacyWorkbook(rebuilt, { offices: OFFICES });
		expect(preview.rows[0].date).toBe('2026-07-01');
	});

	it('defaults the break to 0 for a timed row with no Total cell at all', async () => {
		const buffer = await buildLegacyWorkbook({
			fyStartYear: 2026,
			rows: [{ date: '2026-07-01', start: '09:00', end: '17:06' }]
		});
		const preview = await parseLegacyWorkbook(buffer, { offices: OFFICES });
		expect(preview.rows[0]).toMatchObject({ breakMinutes: 0 });
		expect(preview.issues).toEqual([]);
	});

	it('treats a whitespace-only note as no note at all', async () => {
		const buffer = await buildLegacyWorkbook({
			fyStartYear: 2026,
			rows: [{ date: '2026-07-01' }]
		});
		const ExcelJS = (await import('exceljs')).default;
		const wb = new ExcelJS.Workbook();
		await wb.xlsx.load(buffer as unknown as ArrayBuffer);
		wb.worksheets[0].getCell(3, 6).value = '   ';
		const rebuilt = Buffer.from(await wb.xlsx.writeBuffer());

		const preview = await parseLegacyWorkbook(rebuilt, { offices: OFFICES });
		expect(preview.rows[0]).toMatchObject({ kind: 'off', skip: true, notes: null });
	});

	it('treats an empty rich-text run as no note at all', async () => {
		const buffer = await buildLegacyWorkbook({
			fyStartYear: 2026,
			rows: [{ date: '2026-07-01' }]
		});
		const ExcelJS = (await import('exceljs')).default;
		const wb = new ExcelJS.Workbook();
		await wb.xlsx.load(buffer as unknown as ArrayBuffer);
		wb.worksheets[0].getCell(3, 6).value = { richText: [{ text: '  ' }] };
		const rebuilt = Buffer.from(await wb.xlsx.writeBuffer());

		const preview = await parseLegacyWorkbook(rebuilt, { offices: OFFICES });
		expect(preview.rows[0]).toMatchObject({ kind: 'off', skip: true, notes: null });
	});

	it('ignores a blank-labelled cell sitting in the header row', async () => {
		const buffer = await buildLegacyWorkbook({
			fyStartYear: 2026,
			rows: [standardHomeRow('2026-07-01')]
		});
		const ExcelJS = (await import('exceljs')).default;
		const wb = new ExcelJS.Workbook();
		await wb.xlsx.load(buffer as unknown as ArrayBuffer);
		wb.worksheets[0].getCell(2, 7).value = '   ';
		const rebuilt = Buffer.from(await wb.xlsx.writeBuffer());

		const preview = await parseLegacyWorkbook(rebuilt, { offices: OFFICES });
		expect(preview.rows[0]).toMatchObject({ kind: 'work' });
	});

	it('reads End Time/Total/Notes as absent when the header has no such column', async () => {
		const ExcelJS = (await import('exceljs')).default;
		const wb = new ExcelJS.Workbook();
		const sheet = wb.addWorksheet('Diary');
		sheet.getCell(1, 1).value = 'Date';
		sheet.getCell(1, 2).value = 'Start Time';
		sheet.getCell(2, 1).value = new Date(Date.UTC(2026, 6, 1));
		sheet.getCell(2, 2).value = 9 / 24;
		const buffer = Buffer.from(await wb.xlsx.writeBuffer());

		const preview = await parseLegacyWorkbook(buffer, { offices: OFFICES });
		// No End Time column means no block can be timed, so this falls through to a plain,
		// nothing-to-import row rather than "work" — there's no way to derive an end time at all.
		expect(preview.rows[0]).toMatchObject({
			date: '2026-07-01',
			kind: 'off',
			start: null,
			end: null,
			breakMinutes: null,
			notes: null,
			skip: true
		});
	});

	it('throws when the workbook has no worksheets', async () => {
		const ExcelJS = (await import('exceljs')).default;
		const wb = new ExcelJS.Workbook();
		const buffer = Buffer.from(await wb.xlsx.writeBuffer());
		await expect(parseLegacyWorkbook(buffer, { offices: OFFICES })).rejects.toThrow(/no sheets/);
	});
});
