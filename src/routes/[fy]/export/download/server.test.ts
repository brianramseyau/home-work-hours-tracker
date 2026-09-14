import ExcelJS from 'exceljs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDb, type Db } from '$lib/server/db/create';
import { createOffice } from '$lib/server/repo/offices';
import { updateSettings } from '$lib/server/repo/settings';
import { createYear } from '$lib/server/repo/years';
import { upsertDay } from '$lib/server/repo/days';

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

describe('GET /[fy]/export/download', () => {
	it('streams a workbook with the right headers, matching the diary totals', async () => {
		updateSettings(db, { fullName: 'John Doe' });
		createYear(db, { startYear: 2026, rateCentsPerHour: 70 });
		const office = createOffice(db, { name: 'Office Location 1' });
		upsertDay(
			db,
			{
				date: '2026-07-01',
				kind: 'work',
				officeId: office.id,
				notes: null,
				source: 'manual',
				blocks: [{ start: '09:00', end: '17:06', breakMinutes: 30 }]
			},
			'2026-07-01T00:00:00.000Z'
		);

		const { GET } = await import('./+server');
		const response = await GET({ params: { fy: 'fy27' } } as never);

		expect(response.headers.get('Content-Type')).toBe(
			'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
		);
		expect(response.headers.get('Content-Disposition')).toBe(
			'attachment; filename="FY27-home-work-diary.xlsx"'
		);

		const buffer = Buffer.from(await response.arrayBuffer());
		const workbook = new ExcelJS.Workbook();
		await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
		expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['Summary', 'Diary']);
		expect(workbook.getWorksheet('Diary')!.getRow(2).getCell('D').value).toBe('Split');
	});

	it('returns 404 for a slug that is not a financial year', async () => {
		const { GET } = await import('./+server');
		await expect(GET({ params: { fy: 'not-a-fy' } } as never)).rejects.toMatchObject({
			status: 404
		});
	});

	it('defaults the rate to 0 when the financial year has not been created yet', async () => {
		const { GET } = await import('./+server');
		const response = await GET({ params: { fy: 'fy27' } } as never);
		const buffer = Buffer.from(await response.arrayBuffer());
		const workbook = new ExcelJS.Workbook();
		await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
		expect(workbook.getWorksheet('Summary')!.getCell('B6').value).toBe(0);
	});
});
