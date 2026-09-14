// Synthetic legacy-workbook builders for import.ts's tests. Real spreadsheets are gitignored and
// must never be used as fixtures (see AGENTS.md §1) — everything here is generated with exceljs.

import ExcelJS from 'exceljs';

export interface FixtureRow {
	date: string; // ISO YYYY-MM-DD
	start?: string; // HH:mm
	end?: string; // HH:mm
	total?: number; // decimal hours, as the legacy sheet's own Total column shows
	notes?: string;
}

export interface LegacyWorkbookOptions {
	/** Omit to leave the sheet without a Year label cell (the parser then falls back to the FY of the first date). */
	fyStartYear?: number;
	/** Omit to leave the sheet without a Total Hours label cell. */
	totalHours?: number;
	/** Omit to leave the sheet without a Flat Rate label cell. */
	flatRate?: number;
	/** Reorders the header columns, to prove the parser finds columns by label, not position. */
	shuffleColumns?: boolean;
	rows: FixtureRow[];
}

const HEADERS = ['Week', 'Date', 'Start Time', 'End Time', 'Total', 'Notes'];
const SHUFFLED_HEADERS = ['Notes', 'Total', 'Date', 'Week', 'End Time', 'Start Time'];

function toDayFraction(hm: string): number {
	const [hours, minutes] = hm.split(':').map(Number);
	return (hours * 60 + minutes) / (24 * 60);
}

/** Builds an in-memory legacy-style "Home Work Diary" workbook, synthetic data only. */
export async function buildLegacyWorkbook(options: LegacyWorkbookOptions): Promise<Buffer> {
	const workbook = new ExcelJS.Workbook();
	const sheet = workbook.addWorksheet('Diary');

	let labelCol = 1;
	if (options.fyStartYear !== undefined) {
		sheet.getCell(1, labelCol).value = 'Year';
		sheet.getCell(1, labelCol + 1).value = options.fyStartYear;
		labelCol += 3;
	}
	if (options.totalHours !== undefined) {
		sheet.getCell(1, labelCol).value = 'Total Hours';
		sheet.getCell(1, labelCol + 1).value = options.totalHours;
		labelCol += 3;
	}
	if (options.flatRate !== undefined) {
		sheet.getCell(1, labelCol).value = 'Flat Rate';
		sheet.getCell(1, labelCol + 1).value = options.flatRate;
	}

	const headers = options.shuffleColumns ? SHUFFLED_HEADERS : HEADERS;
	headers.forEach((label, index) => {
		sheet.getCell(2, index + 1).value = label;
	});
	const columnOf = (label: string) => headers.indexOf(label) + 1;

	options.rows.forEach((row, rowIndex) => {
		const r = 3 + rowIndex;
		const [year, month, day] = row.date.split('-').map(Number);
		const dateCell = sheet.getCell(r, columnOf('Date'));
		dateCell.value = new Date(Date.UTC(year, month - 1, day));
		dateCell.numFmt = 'dd/mm/yyyy';

		if (row.start) {
			const cell = sheet.getCell(r, columnOf('Start Time'));
			cell.value = toDayFraction(row.start);
			cell.numFmt = 'hh:mm';
		}
		if (row.end) {
			const cell = sheet.getCell(r, columnOf('End Time'));
			cell.value = toDayFraction(row.end);
			cell.numFmt = 'hh:mm';
		}
		if (row.total !== undefined) {
			sheet.getCell(r, columnOf('Total')).value = row.total;
		}
		if (row.notes !== undefined) {
			sheet.getCell(r, columnOf('Notes')).value = row.notes;
		}
	});

	const arrayBuffer = await workbook.xlsx.writeBuffer();
	return Buffer.from(arrayBuffer);
}

/** A standard 09:00–17:06/30-min-break home day, at the given date, with no note. */
export function standardHomeRow(date: string): FixtureRow {
	return { date, start: '09:00', end: '17:06', total: 7.6 };
}
