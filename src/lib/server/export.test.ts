import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import type { Day } from '$lib/core/dayType';
import { datesInFy } from '$lib/core/fy';
import { claimCents } from '$lib/core/totals';
import { REPO_URL } from '$lib/branding';
import { buildWorkbook, totalHomeMinutes, type BuildWorkbookInput } from './export';

const office1 = { id: 1, name: 'Office Location 1' };
const office2 = { id: 2, name: 'Office Location 2' };

function baseInput(overrides: Partial<BuildWorkbookInput> = {}): BuildWorkbookInput {
	return {
		fy: {
			startYear: 2026,
			label: 'FY27',
			range: 'Jul 2026 – Jun 2027',
			rateCentsPerHour: 70,
			rateNote: null
		},
		settings: { fullName: 'John Doe', includeWeekends: false },
		days: [],
		offices: [office1, office2],
		holidays: [],
		generatedAt: '2026-09-14',
		...overrides
	};
}

const homeBlock = { start: '09:00', end: '17:06', breakMinutes: 30 }; // 456 min = 7.6h

async function loadWorkbook(buffer: Buffer): Promise<ExcelJS.Workbook> {
	const workbook = new ExcelJS.Workbook();
	// Same exceljs Buffer/ArrayBuffer typing quirk as export.ts's addImage call.
	await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
	return workbook;
}

/** exceljs's Worksheet type omits this (real, runtime) property — see worksheet.js. */
function conditionalFormattingsOf(
	sheet: ExcelJS.Worksheet
): ExcelJS.ConditionalFormattingOptions[] {
	return (sheet as unknown as { conditionalFormattings: ExcelJS.ConditionalFormattingOptions[] })
		.conditionalFormattings;
}

describe('buildWorkbook', () => {
	it('builds a Summary sheet and a Diary sheet, in that order', async () => {
		const buffer = await buildWorkbook(baseInput());
		const workbook = await loadWorkbook(buffer);
		expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['Summary', 'Diary']);
	});

	it('titles the Summary sheet with the FY label, range and name', async () => {
		const buffer = await buildWorkbook(baseInput());
		const workbook = await loadWorkbook(buffer);
		const summary = workbook.getWorksheet('Summary')!;
		expect(summary.getCell('A1').value).toBe('Home work diary FY27');
		expect(summary.getCell('A2').value).toBe('Jul 2026 – Jun 2027');
		expect(summary.getCell('A3').value).toBe('John Doe');
	});

	it('shows "Name not set" when the settings name is null', async () => {
		const buffer = await buildWorkbook(
			baseInput({ settings: { fullName: null, includeWeekends: false } })
		);
		const workbook = await loadWorkbook(buffer);
		expect(workbook.getWorksheet('Summary')!.getCell('A3').value).toBe('Name not set');
	});

	it('embeds the logo image when one is provided', async () => {
		const buffer = await buildWorkbook(baseInput({ logo: Buffer.from([0x89, 0x50, 0x4e, 0x47]) }));
		const workbook = await loadWorkbook(buffer);
		expect(workbook.model.media.length).toBeGreaterThan(0);
	});

	it('skips the image entirely when no logo is provided', async () => {
		const buffer = await buildWorkbook(baseInput());
		const workbook = await loadWorkbook(buffer);
		expect(workbook.model.media.length).toBe(0);
	});

	it('freezes the Diary header row and first two columns, with an autofilter', async () => {
		const buffer = await buildWorkbook(baseInput());
		const workbook = await loadWorkbook(buffer);
		const diary = workbook.getWorksheet('Diary')!;
		expect(diary.views).toMatchObject([{ state: 'frozen', xSplit: 2, ySplit: 1 }]);
		expect(diary.autoFilter).toBe('A1:K1');
	});

	it('hides the Month helper column on the Diary sheet', async () => {
		const buffer = await buildWorkbook(baseInput());
		const workbook = await loadWorkbook(buffer);
		expect(workbook.getWorksheet('Diary')!.getColumn('K').hidden).toBe(true);
	});

	it('writes one Diary row per date in the financial year when there are no recorded days', async () => {
		const buffer = await buildWorkbook(baseInput());
		const workbook = await loadWorkbook(buffer);
		const diary = workbook.getWorksheet('Diary')!;
		// Header + one row per weekday in the FY + a totals row + a blank gap + a two-line footer.
		const weekdayCount = datesInFy(2026).length;
		expect(diary.rowCount).toBe(weekdayCount + 5);
	});

	it('writes a home day with its recorded start, end and break', async () => {
		const days: Day[] = [
			{
				date: '2026-07-01',
				kind: 'work',
				officeId: null,
				notes: null,
				source: 'manual',
				blocks: [homeBlock]
			}
		];
		const buffer = await buildWorkbook(baseInput({ days }));
		const workbook = await loadWorkbook(buffer);
		const diary = workbook.getWorksheet('Diary')!;
		const row = diary.getRow(2);
		expect(row.getCell('D').value).toBe('Home');
		expect(row.getCell('F').numFmt).toBe('hh:mm');
		expect(row.getCell('I').value).toMatchObject({
			formula: 'IF(F2="","",(G2-F2)*24-H2/60)',
			result: 7.6
		});
	});

	it('writes a split day as one row per block, with the office named on every block', async () => {
		const days: Day[] = [
			{
				date: '2026-07-01',
				kind: 'work',
				officeId: office1.id,
				notes: null,
				source: 'manual',
				blocks: [
					{ start: '09:00', end: '12:00', breakMinutes: 0 },
					{ start: '13:00', end: '16:00', breakMinutes: 0 }
				]
			}
		];
		const buffer = await buildWorkbook(baseInput({ days }));
		const workbook = await loadWorkbook(buffer);
		const diary = workbook.getWorksheet('Diary')!;
		expect(diary.getRow(2).getCell('D').value).toBe('Split');
		expect(diary.getRow(2).getCell('E').value).toBe('Office Location 1');
		expect(diary.getRow(3).getCell('E').value).toBe('Office Location 1');
		expect(diary.getRow(2).getCell('I').value).toMatchObject({ result: 3 });
		expect(diary.getRow(3).getCell('I').value).toMatchObject({ result: 3 });
	});

	it('writes an office-only day with blank times and the office name', async () => {
		const days: Day[] = [
			{
				date: '2026-07-01',
				kind: 'work',
				officeId: office2.id,
				notes: null,
				source: 'manual',
				blocks: []
			}
		];
		const buffer = await buildWorkbook(baseInput({ days }));
		const workbook = await loadWorkbook(buffer);
		const row = workbook.getWorksheet('Diary')!.getRow(2);
		expect(row.getCell('D').value).toBe('Office');
		expect(row.getCell('E').value).toBe('Office Location 2');
		expect(row.getCell('F').value).toBeNull();
		expect(row.getCell('I').value).toMatchObject({
			formula: 'IF(F2="","",(G2-F2)*24-H2/60)'
		});
	});

	it("fills a public holiday row's notes from the holiday name when the day has none", async () => {
		const days: Day[] = [
			{
				date: '2026-07-01',
				kind: 'public_holiday',
				officeId: null,
				notes: null,
				source: 'prefill',
				blocks: []
			}
		];
		const buffer = await buildWorkbook(
			baseInput({ days, holidays: [{ date: '2026-07-01', name: 'Made-up day' }] })
		);
		const workbook = await loadWorkbook(buffer);
		const row = workbook.getWorksheet('Diary')!.getRow(2);
		expect(row.getCell('D').value).toBe('Public holiday');
		expect(row.getCell('J').value).toBe('Made-up day');
	});

	it('leaves the holiday note blank when no holiday row matches the date', async () => {
		const days: Day[] = [
			{
				date: '2026-07-01',
				kind: 'public_holiday',
				officeId: null,
				notes: null,
				source: 'prefill',
				blocks: []
			}
		];
		const buffer = await buildWorkbook(baseInput({ days, holidays: [] }));
		const workbook = await loadWorkbook(buffer);
		expect(workbook.getWorksheet('Diary')!.getRow(2).getCell('J').value).toBe('');
	});

	it('leaves the office name blank for an office not passed in (e.g. archived and filtered out)', async () => {
		const days: Day[] = [
			{ date: '2026-07-01', kind: 'work', officeId: 999, notes: null, source: 'manual', blocks: [] }
		];
		const buffer = await buildWorkbook(baseInput({ days, offices: [office1] }));
		const workbook = await loadWorkbook(buffer);
		expect(workbook.getWorksheet('Diary')!.getRow(2).getCell('E').value).toBe('');
	});

	it('keeps a manual note over the holiday name when both exist', async () => {
		const days: Day[] = [
			{
				date: '2026-07-01',
				kind: 'public_holiday',
				officeId: null,
				notes: 'Observed differently this year',
				source: 'manual',
				blocks: []
			}
		];
		const buffer = await buildWorkbook(
			baseInput({ days, holidays: [{ date: '2026-07-01', name: 'Made-up day' }] })
		);
		const workbook = await loadWorkbook(buffer);
		expect(workbook.getWorksheet('Diary')!.getRow(2).getCell('J').value).toBe(
			'Observed differently this year'
		);
	});

	it('tints a home row and leaves an off row untinted', async () => {
		const days: Day[] = [
			{
				date: '2026-07-01',
				kind: 'work',
				officeId: null,
				notes: null,
				source: 'manual',
				blocks: [homeBlock]
			}
		];
		const buffer = await buildWorkbook(baseInput({ days }));
		const workbook = await loadWorkbook(buffer);
		const diary = workbook.getWorksheet('Diary')!;
		const homeFill = diary.getRow(2).getCell('A').fill;
		expect(homeFill).toMatchObject({ type: 'pattern', pattern: 'solid' });
		const offFill = diary.getRow(3).getCell('A').fill;
		expect(offFill).toBeUndefined();
	});

	it('marks the Diary totals row with a SUM formula over the data rows', async () => {
		const days: Day[] = [
			{
				date: '2026-07-01',
				kind: 'work',
				officeId: null,
				notes: null,
				source: 'manual',
				blocks: [homeBlock]
			}
		];
		const buffer = await buildWorkbook(baseInput({ days }));
		const workbook = await loadWorkbook(buffer);
		const diary = workbook.getWorksheet('Diary')!;
		let totalsRow: ExcelJS.Row | null = null;
		diary.eachRow((row) => {
			if (row.getCell('D').value === 'Total') totalsRow = row;
		});
		expect(totalsRow).not.toBeNull();
		expect(totalsRow!.getCell('I').value).toMatchObject({ result: 7.6 });
	});

	it('carries the REPO_URL hyperlink in the footer of both sheets', async () => {
		const buffer = await buildWorkbook(baseInput());
		const workbook = await loadWorkbook(buffer);
		for (const name of ['Summary', 'Diary']) {
			const sheet = workbook.getWorksheet(name)!;
			const footerCell = sheet.getRow(sheet.rowCount - 1).getCell('A');
			const value = footerCell.value as { hyperlink?: string };
			expect(value.hyperlink).toBe(REPO_URL);
			expect(sheet.headerFooter.oddFooter).toContain(REPO_URL);
		}
	});

	it('computes the Summary claim to equal core/totals.claimCents / 100', async () => {
		const days: Day[] = [
			{
				date: '2026-07-01',
				kind: 'work',
				officeId: null,
				notes: null,
				source: 'manual',
				blocks: [homeBlock]
			},
			{
				date: '2026-07-02',
				kind: 'work',
				officeId: null,
				notes: null,
				source: 'manual',
				blocks: [homeBlock]
			}
		];
		const buffer = await buildWorkbook(baseInput({ days }));
		const workbook = await loadWorkbook(buffer);
		const summary = workbook.getWorksheet('Summary')!;
		const claimCell = summary.getCell('B8').value as { formula: string; result: number };
		const expectedClaim = claimCents(totalHomeMinutes(days), 70) / 100;
		expect(claimCell.result).toBeCloseTo(expectedClaim, 2);
	});

	it('matches core/totals.claimCents exactly even when per-block hours do not round evenly', async () => {
		// Two 457-minute blocks (7.61666… h each) would round to 7.62 h independently and sum to
		// 15.24 h -> a $10.67 claim; rounding once from the 914 integer minutes gives $10.66
		// (`claimCents(914, 70)`) — the two only agree if the claim is computed from minutes,
		// not from a sum of already-rounded per-row hours.
		const days: Day[] = [
			{
				date: '2026-07-01',
				kind: 'work',
				officeId: null,
				notes: null,
				source: 'manual',
				blocks: [{ start: '09:00', end: '16:37', breakMinutes: 0 }] // 457 min
			},
			{
				date: '2026-07-02',
				kind: 'work',
				officeId: null,
				notes: null,
				source: 'manual',
				blocks: [{ start: '09:00', end: '16:37', breakMinutes: 0 }] // 457 min
			}
		];
		const buffer = await buildWorkbook(baseInput({ days }));
		const workbook = await loadWorkbook(buffer);
		const summary = workbook.getWorksheet('Summary')!;
		const claimCell = summary.getCell('B8').value as { result: number };
		expect(claimCell.result).toBe(claimCents(914, 70) / 100);
		expect(claimCell.result).not.toBeCloseTo(10.67, 2);
	});

	it('adds a data-bar rule to the monthly Hours column', async () => {
		const buffer = await buildWorkbook(baseInput());
		const workbook = await loadWorkbook(buffer);
		const summary = workbook.getWorksheet('Summary')!;
		const rules = conditionalFormattingsOf(summary).flatMap((cf) => cf.rules);
		expect(rules.some((rule) => rule.type === 'dataBar')).toBe(true);
	});

	it('counts days by display type in the Summary key figures', async () => {
		const days: Day[] = [
			{
				date: '2026-07-01',
				kind: 'work',
				officeId: null,
				notes: null,
				source: 'manual',
				blocks: [homeBlock]
			},
			{
				date: '2026-07-02',
				kind: 'work',
				officeId: office1.id,
				notes: null,
				source: 'manual',
				blocks: []
			},
			{
				date: '2026-07-03',
				kind: 'sick',
				officeId: null,
				notes: null,
				source: 'manual',
				blocks: []
			},
			{
				date: '2026-07-06',
				kind: 'leave',
				officeId: null,
				notes: null,
				source: 'manual',
				blocks: []
			}
		];
		const buffer = await buildWorkbook(baseInput({ days }));
		const workbook = await loadWorkbook(buffer);
		const summary = workbook.getWorksheet('Summary')!;
		expect(summary.getCell('B9').value).toBe(1); // home + split
		expect(summary.getCell('B10').value).toBe(1); // office
		expect(summary.getCell('B11').value).toBe(1); // leave
		expect(summary.getCell('B12').value).toBe(1); // sick
	});

	it('includes weekend dates only when includeWeekends is on', async () => {
		const withoutWeekends = await loadWorkbook(await buildWorkbook(baseInput()));
		const withWeekends = await loadWorkbook(
			await buildWorkbook(baseInput({ settings: { fullName: 'John Doe', includeWeekends: true } }))
		);
		expect(withWeekends.getWorksheet('Diary')!.rowCount).toBeGreaterThan(
			withoutWeekends.getWorksheet('Diary')!.rowCount
		);
	});

	it('still includes a weekend day that has data, even with includeWeekends off', async () => {
		// 2026-07-04 is a Saturday. A day saved through the deep-link editor still counts toward
		// the app's own totals (`diaryLoad.ts` sums `listRange` unfiltered), so it must not
		// silently disappear from the export just because the weekend toggle is off.
		const days: Day[] = [
			{
				date: '2026-07-04',
				kind: 'work',
				officeId: null,
				notes: null,
				source: 'manual',
				blocks: [homeBlock]
			}
		];
		const buffer = await buildWorkbook(baseInput({ days }));
		const workbook = await loadWorkbook(buffer);
		const diary = workbook.getWorksheet('Diary')!;
		let saturdayRow: ExcelJS.Row | null = null;
		diary.eachRow((row) => {
			if (row.getCell('B').value instanceof Date && row.getCell('D').value === 'Home') {
				saturdayRow = row;
			}
		});
		expect(saturdayRow).not.toBeNull();
		expect(saturdayRow!.getCell('I').value).toMatchObject({ result: 7.6 });

		const summary = workbook.getWorksheet('Summary')!;
		expect((summary.getCell('B7').value as { result: number }).result).toBe(7.6);
	});

	it('does not count blocks on a non-work day, even if the row carries them', async () => {
		// The schema doesn't forbid a leave/sick/off/public_holiday day from carrying blocks
		// (`daySchema` has no kind-to-blocks rule), and `dayHomeMinutes` — the single source of
		// truth for home hours — only ever counts a `work` day's blocks. The export must agree.
		const days: Day[] = [
			{
				date: '2026-07-01',
				kind: 'leave',
				officeId: null,
				notes: null,
				source: 'manual',
				blocks: [homeBlock]
			},
			// A real home day too, so the assertion below is actually discriminating: a buggy
			// implementation that (wrongly) counts the leave day's block would sum to 15.2
			// hours, not the correct 7.6 — without this second day, that same bug would instead
			// produce exactly 7.6 (from the leave day's block alone) and the test would pass for
			// the wrong reason. It also sidesteps exceljs's own formula-cell serialization
			// dropping a cached `result: 0` (`FormulaValue._copyModel`'s `if (value)` check
			// treats 0 as absent) — a correct 0-hours result would otherwise round-trip as
			// `undefined`, which this test isn't trying to exercise.
			{
				date: '2026-07-02',
				kind: 'work',
				officeId: null,
				notes: null,
				source: 'manual',
				blocks: [homeBlock]
			}
		];
		const buffer = await buildWorkbook(baseInput({ days }));
		const workbook = await loadWorkbook(buffer);
		const row = workbook.getWorksheet('Diary')!.getRow(2);
		expect(row.getCell('D').value).toBe('Leave');
		expect(row.getCell('F').value).toBeNull();
		expect(row.getCell('I').value).toMatchObject({
			formula: 'IF(F2="","",(G2-F2)*24-H2/60)'
		});

		const summary = workbook.getWorksheet('Summary')!;
		expect((summary.getCell('B7').value as { result: number }).result).toBe(7.6);
	});

	it('sets the print footer and paper orientation on both sheets', async () => {
		const buffer = await buildWorkbook(baseInput());
		const workbook = await loadWorkbook(buffer);
		const summary = workbook.getWorksheet('Summary')!;
		const diary = workbook.getWorksheet('Diary')!;
		expect(summary.pageSetup.orientation).toBe('portrait');
		expect(diary.pageSetup.orientation).toBe('landscape');
	});

	it('sets workbook creator metadata', async () => {
		const buffer = await buildWorkbook(baseInput());
		const workbook = await loadWorkbook(buffer);
		expect(workbook.creator).toBe('Home Work Hours Tracker');
		expect(workbook.lastModifiedBy).toBe('Home Work Hours Tracker');
	});

	it('shows the rate note beside the rate when one is set', async () => {
		const buffer = await buildWorkbook(
			baseInput({
				fy: {
					startYear: 2026,
					label: 'FY27',
					range: 'Jul 2026 – Jun 2027',
					rateCentsPerHour: 70,
					rateNote: 'ATO-published rate'
				}
			})
		);
		const workbook = await loadWorkbook(buffer);
		expect(workbook.getWorksheet('Summary')!.getCell('C6').value).toBe('ATO-published rate');
	});
});

describe('totalHomeMinutes', () => {
	it("sums only work days' block minutes", () => {
		const days: Day[] = [
			{
				date: '2026-07-01',
				kind: 'work',
				officeId: null,
				notes: null,
				source: 'manual',
				blocks: [homeBlock]
			},
			{
				date: '2026-07-02',
				kind: 'sick',
				officeId: null,
				notes: null,
				source: 'manual',
				blocks: []
			}
		];
		expect(totalHomeMinutes(days)).toBe(456);
	});
});
