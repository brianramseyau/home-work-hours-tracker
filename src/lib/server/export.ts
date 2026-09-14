// Builds the accountant-facing .xlsx: a Summary sheet (key figures, monthly breakdown) and a
// Diary sheet (one row per home block, live formulas an accountant can audit). A pure function
// of its inputs — no DB access, no filesystem access; the caller loads the data and the logo.

import ExcelJS from 'exceljs';
import { isWeekend, weekdayShort } from '$lib/core/date';
import type { Day, DisplayType } from '$lib/core/dayType';
import { displayType, displayTypeLabel } from '$lib/core/dayType';
import { datesInFy, monthLabel, monthsInFy, weekOfFy } from '$lib/core/fy';
import { blockMinutes, toMinutes } from '$lib/core/time';
import { claimCents, claimCentsByGroup, dayHomeMinutes, summarise } from '$lib/core/totals';
import { APP_NAME, REPO_URL } from '$lib/branding';

const INK = 'FF1D2640';
const LAMP = 'FFF2A93B';
const WHITE = 'FFFFFFFF';
const MUTED = 'FF6B7690';

const ROW_TINT: Record<DisplayType, string | null> = {
	home: 'FFFBE9CC',
	office: 'FFE7EBF2',
	split: 'FFF3E4CE',
	leave: 'FFEFE7F7',
	sick: 'FFFAE3E5',
	public_holiday: 'FFE3EDE6',
	off: null
};

export interface ExportFy {
	startYear: number;
	label: string;
	range: string;
	rateCentsPerHour: number;
	rateNote: string | null;
}

export interface ExportSettings {
	fullName: string | null;
	includeWeekends: boolean;
}

export interface ExportOffice {
	id: number;
	name: string;
}

export interface ExportHoliday {
	date: string;
	name: string;
}

export interface BuildWorkbookInput {
	fy: ExportFy;
	settings: ExportSettings;
	days: Day[];
	offices: ExportOffice[];
	holidays: ExportHoliday[];
	/** ISO date (YYYY-MM-DD) of export generation, for the footer and workbook metadata. */
	generatedAt: string;
	/** The logo mark PNG bytes for the Summary title band; omitted skips the image. */
	logo?: Buffer;
}

interface DiaryRow {
	date: string;
	week: number;
	displayType: DisplayType;
	officeName: string | null;
	start: string | null; // HH:mm
	end: string | null; // HH:mm
	breakMinutes: number | null;
	notes: string | null;
	/** The row's Hours formula, evaluated ahead of time so the workbook opens with a cached
	 *  result — matches what `=IF(F="","",(G-F)*24-H/60)` computes, at full precision (rounding
	 *  only at the claim, per AGENTS.md's "round once, at the end"). `''` for a blank row. */
	hoursValue: number | '';
}

/** Excel's day fraction for a HH:mm time-of-day value. */
function timeFraction(hm: string): number {
	return toMinutes(hm) / (24 * 60);
}

function parseIsoParts(iso: string): [number, number, number] {
	const [year, month, day] = iso.split('-').map(Number);
	return [year, month - 1, day];
}

function countByDisplayType(days: Day[]): Record<DisplayType, number> {
	const counts: Record<DisplayType, number> = {
		home: 0,
		office: 0,
		split: 0,
		leave: 0,
		sick: 0,
		public_holiday: 0,
		off: 0
	};
	for (const day of days) counts[displayType(day)] += 1;
	return counts;
}

/**
 * One row per home block; one blank-time row for every other date, for a complete audit trail.
 * Dates are every weekday in the FY, plus every weekend date that has a recorded day — a
 * weekend entry saved while "Include weekends" is off still counts toward the app's own totals
 * (`diaryLoad.ts` sums `listRange` unfiltered), so it must not silently disappear from the export.
 */
function buildDiaryRows(input: BuildWorkbookInput): DiaryRow[] {
	const byDate = new Map(input.days.map((day) => [day.date, day]));
	const officesById = new Map(input.offices.map((office) => [office.id, office.name]));
	const holidayNameByDate = new Map(input.holidays.map((holiday) => [holiday.date, holiday.name]));
	const rows: DiaryRow[] = [];

	const dates = datesInFy(input.fy.startYear, { includeWeekends: true }).filter(
		(date) => input.settings.includeWeekends || !isWeekend(date) || byDate.has(date)
	);

	for (const date of dates) {
		const day: Day = byDate.get(date) ?? {
			date,
			kind: 'off',
			officeId: null,
			notes: null,
			source: 'prefill',
			blocks: []
		};
		const type = displayType(day);
		const officeName = day.officeId !== null ? (officesById.get(day.officeId) ?? null) : null;
		const notes =
			day.notes ?? (type === 'public_holiday' ? (holidayNameByDate.get(date) ?? null) : null);

		// Gated on kind, not just blocks.length — `dayHomeMinutes` (the app's single source of
		// truth for home hours) only counts a `work` day's blocks, so a non-`work` day that
		// somehow carries blocks (the schema doesn't forbid it) must not be shown as timed hours
		// here either, or the export would count minutes the app itself does not.
		if (day.kind === 'work' && day.blocks.length > 0) {
			for (const block of day.blocks) {
				rows.push({
					date,
					week: weekOfFy(date),
					displayType: type,
					officeName,
					start: block.start,
					end: block.end,
					breakMinutes: block.breakMinutes,
					notes,
					hoursValue: blockMinutes(block) / 60
				});
			}
		} else {
			rows.push({
				date,
				week: weekOfFy(date),
				displayType: type,
				officeName,
				start: null,
				end: null,
				breakMinutes: null,
				notes,
				hoursValue: ''
			});
		}
	}

	return rows;
}

function addTitleBand(
	sheet: ExcelJS.Worksheet,
	title: string,
	subtitle: string,
	name: string,
	logo: Buffer | undefined
) {
	sheet.mergeCells('A1:D1');
	sheet.mergeCells('A2:D2');
	sheet.mergeCells('A3:D3');
	sheet.getCell('A1').value = title;
	sheet.getCell('A1').font = {
		name: 'Bricolage Grotesque',
		size: 18,
		bold: true,
		color: { argb: WHITE }
	};
	sheet.getCell('A2').value = subtitle;
	sheet.getCell('A2').font = { size: 11, color: { argb: WHITE } };
	sheet.getCell('A3').value = name;
	sheet.getCell('A3').font = { size: 11, italic: true, color: { argb: WHITE } };
	for (const rowNumber of [1, 2, 3]) {
		const row = sheet.getRow(rowNumber);
		row.height = rowNumber === 1 ? 26 : 18;
		for (let col = 1; col <= 4; col++) {
			row.getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INK } };
		}
	}

	if (logo) {
		// exceljs's own .d.ts shadows the ambient `Buffer` type with a near-empty local
		// interface, so a real Node Buffer needs an explicit cast to satisfy it here.
		const imageId = sheet.workbook.addImage({
			buffer: logo as unknown as ArrayBuffer,
			extension: 'png'
		});
		sheet.addImage(imageId, { tl: { col: 4.1, row: 0.15 }, ext: { width: 54, height: 54 } });
	}
}

function addFooter(
	sheet: ExcelJS.Worksheet,
	rowNumber: number,
	lastColumn: number,
	generatedAt: string
) {
	sheet.mergeCells(rowNumber, 1, rowNumber, lastColumn);
	const footerCell = sheet.getCell(rowNumber, 1);
	footerCell.value = { text: `Prepared with ${APP_NAME} — ${REPO_URL}`, hyperlink: REPO_URL };
	footerCell.font = { italic: true, size: 9, color: { argb: MUTED }, underline: true };

	sheet.mergeCells(rowNumber + 1, 1, rowNumber + 1, lastColumn);
	const generatedCell = sheet.getCell(rowNumber + 1, 1);
	generatedCell.value = `Generated ${generatedAt}`;
	generatedCell.font = { italic: true, size: 9, color: { argb: MUTED } };

	sheet.headerFooter.oddFooter = `&L${APP_NAME} — ${REPO_URL}&RPage &P of &N`;
}

/** @returns the row number of the totals cell in the Diary sheet, for the E2E cross-check. */
function buildDiarySheet(
	workbook: ExcelJS.Workbook,
	input: BuildWorkbookInput,
	rows: DiaryRow[],
	totalMinutes: number
) {
	const sheet = workbook.addWorksheet('Diary', {
		views: [{ state: 'frozen', ySplit: 1, xSplit: 2 }],
		pageSetup: {
			paperSize: 9,
			orientation: 'landscape',
			fitToPage: true,
			fitToWidth: 1,
			printTitlesRow: '1:1'
		}
	});
	sheet.columns = [
		{ header: 'Week', key: 'week', width: 7 },
		{ header: 'Date', key: 'date', width: 12 },
		{ header: 'Day', key: 'day', width: 6 },
		{ header: 'Type', key: 'type', width: 12 },
		{ header: 'Office', key: 'office', width: 18 },
		{ header: 'Start', key: 'start', width: 8 },
		{ header: 'End', key: 'end', width: 8 },
		{ header: 'Break (min)', key: 'break', width: 11 },
		{ header: 'Hours', key: 'hours', width: 9 },
		{ header: 'Notes', key: 'notes', width: 32 },
		{ header: 'Month', key: 'month', width: 9 }
	];
	sheet.getRow(1).eachCell((cell) => {
		cell.font = { bold: true, color: { argb: WHITE } };
		cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INK } };
	});
	sheet.getColumn('month').hidden = true;
	sheet.autoFilter = { from: 'A1', to: 'K1' };

	let rowNumber = 2;
	let previousWeek: number | null = null;
	for (const diaryRow of rows) {
		const excelRow = sheet.addRow({
			week: diaryRow.week,
			date: new Date(Date.UTC(...parseIsoParts(diaryRow.date))),
			day: weekdayShort(diaryRow.date),
			type: displayTypeLabel(diaryRow.displayType),
			office: diaryRow.officeName ?? '',
			start: diaryRow.start ? timeFraction(diaryRow.start) : null,
			end: diaryRow.end ? timeFraction(diaryRow.end) : null,
			break: diaryRow.breakMinutes,
			notes: diaryRow.notes ?? '',
			month: diaryRow.date.slice(0, 7)
		});
		excelRow.getCell('date').numFmt = 'dd/mm/yyyy';
		excelRow.getCell('start').numFmt = 'hh:mm';
		excelRow.getCell('end').numFmt = 'hh:mm';
		const hoursCell = excelRow.getCell('hours');
		hoursCell.value = {
			// Not rounded here — AGENTS.md's domain rule is to round once, at the end (the
			// claim), not per row; `numFmt` below only formats the display to 2 dp.
			formula: `IF(F${rowNumber}="","",(G${rowNumber}-F${rowNumber})*24-H${rowNumber}/60)`,
			result: diaryRow.hoursValue === '' ? undefined : diaryRow.hoursValue
		};
		hoursCell.numFmt = '0.00';

		const tint = ROW_TINT[diaryRow.displayType];
		if (tint) {
			excelRow.eachCell({ includeEmpty: true }, (cell) => {
				cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: tint } };
			});
		}
		if (previousWeek !== null && diaryRow.week !== previousWeek) {
			excelRow.eachCell({ includeEmpty: true }, (cell) => {
				cell.border = { ...cell.border, top: { style: 'medium', color: { argb: INK } } };
			});
		}
		previousWeek = diaryRow.week;
		rowNumber++;
	}

	const lastDataRow = rowNumber - 1;
	const totalsRow = sheet.addRow({ type: 'Total' });
	totalsRow.getCell('type').font = { bold: true };
	const totalsHoursCell = totalsRow.getCell('hours');
	totalsHoursCell.value = { formula: `SUM(I2:I${lastDataRow})`, result: totalMinutes / 60 };
	totalsHoursCell.numFmt = '0.00';
	totalsHoursCell.font = { bold: true };

	addFooter(sheet, rowNumber + 2, 11, input.generatedAt);

	return lastDataRow;
}

function buildSummarySheet(
	workbook: ExcelJS.Workbook,
	input: BuildWorkbookInput,
	diaryLastRow: number,
	totalMinutes: number,
	minutesByMonth: Map<string, number>
) {
	const totalHours = totalMinutes / 60;
	const rateCentsPerHour = input.fy.rateCentsPerHour;
	// Rounded once, from integer minutes — matches `core/totals.claimCents` exactly (AGENTS.md's
	// "round once, at the end"), rather than summing per-row hours already rounded to 2 dp.
	const annualClaimCents = claimCents(totalMinutes, rateCentsPerHour);
	// Each month gets whatever rounds its own running total correctly (see
	// `claimCentsByGroup`'s own comment), so the twelve cached figures always sum to exactly
	// `annualClaimCents` — the same guarantee `MonthBreakdown.svelte` gives the in-app view.
	const months = monthsInFy(input.fy.startYear);
	const monthlyClaimCents = claimCentsByGroup(
		months.map((month) => minutesByMonth.get(month) ?? 0),
		rateCentsPerHour
	);
	const sheet = workbook.addWorksheet('Summary', {
		pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1 }
	});
	sheet.columns = [{ width: 30 }, { width: 16 }, { width: 24 }, { width: 12 }];

	addTitleBand(
		sheet,
		`Home work diary ${input.fy.label}`,
		input.fy.range,
		input.settings.fullName ?? 'Name not set',
		input.logo
	);

	let row = 5;
	sheet.getCell(row, 1).value = 'Method';
	sheet.getCell(row, 2).value = 'ATO fixed rate method';
	row++;

	const rateRow = row;
	sheet.getCell(row, 1).value = 'Rate';
	const rateCell = sheet.getCell(row, 2);
	rateCell.value = input.fy.rateCentsPerHour / 100;
	rateCell.numFmt = '"$"0.00" per hour"';
	if (input.fy.rateNote) {
		sheet.getCell(row, 3).value = input.fy.rateNote;
		sheet.getCell(row, 3).font = { italic: true, size: 9, color: { argb: MUTED } };
	}
	row++;

	const hoursRow = row;
	sheet.getCell(row, 1).value = 'Total hours worked from home';
	const hoursCell = sheet.getCell(row, 2);
	// Note: if totalHours is exactly 0 (a brand new FY with no data yet), exceljs's own
	// FormulaValue._copyModel drops a falsy cached `result` on write/read, so the cell shows
	// blank until the spreadsheet app recalculates — cosmetic only, the live formula is correct.
	hoursCell.value = { formula: `SUM(Diary!I2:I${diaryLastRow})`, result: totalHours };
	hoursCell.numFmt = '0.00';
	row++;

	sheet.getCell(row, 1).value = 'Claim';
	const claimCell = sheet.getCell(row, 2);
	claimCell.value = {
		formula: `ROUND(B${hoursRow}*B${rateRow},2)`,
		result: annualClaimCents / 100
	};
	claimCell.numFmt = '"$"#,##0.00';
	row++;

	const counts = countByDisplayType(input.days);
	const countRows: [string, number][] = [
		['Days worked from home (fully or partly)', counts.home + counts.split],
		['Office days', counts.office],
		['Leave days', counts.leave],
		['Sick days', counts.sick],
		['Public holidays', counts.public_holiday]
	];
	for (const [label, value] of countRows) {
		sheet.getCell(row, 1).value = label;
		sheet.getCell(row, 2).value = value;
		row++;
	}
	row++;

	sheet.getCell(row, 1).value = 'Monthly breakdown';
	sheet.getCell(row, 1).font = { bold: true };
	row++;
	sheet.getCell(row, 1).value = 'Month';
	sheet.getCell(row, 2).value = 'Hours';
	sheet.getCell(row, 3).value = 'Claim';
	for (let col = 1; col <= 3; col++) {
		sheet.getCell(row, col).font = { bold: true, color: { argb: WHITE } };
		sheet.getCell(row, col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INK } };
	}
	row++;
	const monthStartRow = row;
	months.forEach((month, index) => {
		sheet.getCell(row, 1).value = monthLabel(month);
		// Diary!K holds the "YYYY-MM" key, not the visible "Jul 2026" label, so a hidden helper
		// cell in column D carries the matching key for SUMIFS to compare against.
		sheet.getCell(row, 4).value = month;
		const monthHours = (minutesByMonth.get(month) ?? 0) / 60;
		const monthHoursCell = sheet.getCell(row, 2);
		monthHoursCell.value = {
			formula: `SUMIFS(Diary!I$2:I$${diaryLastRow},Diary!K$2:K$${diaryLastRow},D${row})`,
			result: monthHours
		};
		monthHoursCell.numFmt = '0.00';
		const monthClaimCell = sheet.getCell(row, 3);
		monthClaimCell.value = {
			// The live formula independently rounds each month, unlike the cached result above
			// it (which distributes rounding so the twelve months sum to the annual claim) — a
			// spreadsheet formula can't easily see the running total the way `claimCentsByGroup`
			// does, so a recalculation can shift a cached month claim by at most one cent.
			formula: `ROUND(B${row}*B${rateRow},2)`,
			result: monthlyClaimCents[index] / 100
		};
		monthClaimCell.numFmt = '"$"#,##0.00';
		row++;
	});
	const monthEndRow = row - 1;
	sheet.getColumn(4).hidden = true;
	// exceljs's DataBarRuleType type is missing `color`, even though the xform reads it —
	// see node_modules/exceljs/lib/xlsx/xform/sheet/cf/databar-xform.js.
	const dataBarRule = {
		type: 'dataBar',
		priority: 1,
		cfvo: [{ type: 'min' }, { type: 'max' }],
		color: { argb: LAMP }
	} as unknown as ExcelJS.DataBarRuleType;
	sheet.addConditionalFormatting({
		ref: `B${monthStartRow}:B${monthEndRow}`,
		rules: [dataBarRule]
	});
	row++;

	sheet.getCell(row, 1).value =
		"Method note: hours worked from home are claimed under the ATO fixed-rate method, using the standard rate for the year. Hours come from the diary's recorded time blocks.";
	sheet.getCell(row, 1).font = { italic: true, size: 9, color: { argb: MUTED } };
	sheet.mergeCells(row, 1, row, 4);
	sheet.getRow(row).alignment = { wrapText: true };
	row += 2;

	addFooter(sheet, row, 4, input.generatedAt);
}

/** Builds the accountant-facing .xlsx workbook from already-loaded data. */
export async function buildWorkbook(input: BuildWorkbookInput): Promise<Buffer> {
	const workbook = new ExcelJS.Workbook();
	workbook.creator = APP_NAME;
	workbook.lastModifiedBy = APP_NAME;
	workbook.created = new Date(`${input.generatedAt}T00:00:00Z`);

	const rows = buildDiaryRows(input);
	const diaryLastRow = 1 + rows.length;

	// The single source of truth for totals: the same `summarise` the in-app diary/year pages
	// use (via `diaryLoad.ts`), so the export can never disagree with what the app itself shows.
	const summary = summarise(input.days);
	const minutesByMonth = new Map(summary.byMonth.map((entry) => [entry.month, entry.minutes]));

	// Sheet order (Summary first) matters for how the workbook opens; the Summary's formulas
	// only need the Diary's row count and totals, both computed above, so it can be added
	// before the Diary sheet itself exists.
	buildSummarySheet(workbook, input, diaryLastRow, summary.homeMinutes, minutesByMonth);
	buildDiarySheet(workbook, input, rows, summary.homeMinutes);

	const arrayBuffer = await workbook.xlsx.writeBuffer();
	return Buffer.from(arrayBuffer);
}

/** For tests and the totals cross-check: the home minutes represented in `days`, independent of the workbook. */
export function totalHomeMinutes(days: Day[]): number {
	return days.reduce((sum, day) => sum + dayHomeMinutes(day), 0);
}
