// Parses a legacy "Home Work Diary" .xlsx into a reviewable preview. Pure given the buffer: no
// DB access, so it can run inside the upload action and round-trip through a hidden form field
// without any server-side temporary state (see AGENTS.md and the phase doc for the approach,
// copied from ev-charging-log's import.ts: find columns by header label, not fixed cell refs).

import ExcelJS from 'exceljs';
import type { DayKind } from '$lib/core/dayType';
import { formatIsoDate } from '$lib/core/date';
import { fyBounds, fyLabel, fyStartYear as fyStartYearOf } from '$lib/core/fy';
import { formatHm, toMinutes } from '$lib/core/time';
import { claimCents } from '$lib/core/totals';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// Matches "Leave start" / "Xmas Hols START" — a marker note ending in the word start/end.
const RANGE_START_RE = /^.*\S\s+start$/i;
const RANGE_END_RE = /^.*\S\s+end$/i;
// Excel's "1900 date system": serial 25569 is 1970-01-01, so subtracting it and scaling by a
// day in ms converts a serial straight to a UTC instant (the well-known 1900 leap-year bug only
// affects dates before March 1900, long before any real diary row).
const EXCEL_EPOCH_OFFSET_DAYS = 25569;

export interface ImportOffice {
	id: number;
	name: string;
}

export interface ImportRow {
	rowNumber: number;
	date: string;
	kind: DayKind;
	/** An existing office's name, or a proposed new office's name — null otherwise. */
	officeName: string | null;
	start: string | null; // HH:mm
	end: string | null; // HH:mm
	breakMinutes: number | null;
	notes: string | null;
	/** True for a row with nothing to import (no times, no note): not committed, not an issue. */
	skip: boolean;
}

export interface ImportIssue {
	rowNumber: number;
	reason: string;
}

export interface ImportTotals {
	hours: number | null;
	claimCents: number | null;
}

/** Unlike the sheet's own totals, `hours` is always known — it's summed from the parsed rows. */
export interface AppTotals {
	hours: number;
	claimCents: number | null;
}

export interface ImportPreview {
	fyStartYear: number;
	rateCentsPerHour: number | null;
	proposedOffices: string[];
	rows: ImportRow[];
	issues: ImportIssue[];
	sheetTotals: ImportTotals;
	appTotals: AppTotals;
	mismatch: boolean;
}

// Only ever called with a value from `eachCell`, which never yields a null/undefined cell.
function normalizeLabel(value: ExcelJS.CellValue): string {
	if (typeof value === 'object' && value !== null && 'richText' in value) {
		return value.richText
			.map((run) => run.text)
			.join('')
			.trim()
			.toLowerCase();
	}
	return String(value).trim().toLowerCase();
}

function asNumber(value: ExcelJS.CellValue): number | null {
	if (typeof value === 'number') return value;
	if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
		return Number(value);
	}
	return null;
}

function excelSerialToUtcDate(serial: number): Date {
	return new Date(Math.round((serial - EXCEL_EPOCH_OFFSET_DAYS) * 86_400_000));
}

function readDateCell(value: ExcelJS.CellValue): string | null {
	if (value instanceof Date) return formatIsoDate(value);
	if (typeof value === 'number') return formatIsoDate(excelSerialToUtcDate(value));
	if (typeof value === 'string' && ISO_DATE_RE.test(value.trim())) return value.trim();
	return null;
}

/** A time-of-day cell: a fraction of a day, read via UTC getters so no host timezone leaks in. */
function readTimeCell(value: ExcelJS.CellValue): string | null {
	if (value instanceof Date) {
		return formatHm({ hours: value.getUTCHours(), minutes: value.getUTCMinutes() });
	}
	if (typeof value === 'number') {
		const totalMinutes = Math.round((value % 1) * 24 * 60) % (24 * 60);
		return formatHm({ hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 });
	}
	return null;
}

function readNoteCell(value: ExcelJS.CellValue): string | null {
	if (value == null) return null;
	if (typeof value === 'object' && 'richText' in value) {
		const text = value.richText
			.map((run) => run.text)
			.join('')
			.trim();
		return text || null;
	}
	const text = String(value).trim();
	return text || null;
}

/** Strips a trailing `*`/`?` (an uncertainty marker in the legacy notes) for matching only. */
function normalizeOfficeName(name: string): string {
	return name
		.trim()
		.replace(/[*?]+$/, '')
		.trim()
		.toLowerCase();
}

function findExistingOffice(note: string, offices: ImportOffice[]): string | null {
	const normalized = normalizeOfficeName(note);
	return offices.find((office) => office.name.trim().toLowerCase() === normalized)?.name ?? null;
}

/** A short, single-word note that isn't a recognised keyword is proposed as a new office. */
function isOfficeCandidate(note: string): boolean {
	return /^\S+$/.test(note) && note.length <= 40;
}

function resolveOfficeName(
	noteText: string | null,
	offices: ImportOffice[]
): { officeName: string | null; proposed: boolean } {
	if (!noteText) return { officeName: null, proposed: false };
	const existing = findExistingOffice(noteText, offices);
	if (existing) return { officeName: existing, proposed: false };
	// Excluded so "Sick" and range markers never get proposed as offices — both would otherwise
	// pass the single-word/no-space shape isOfficeCandidate looks for.
	if (/^sick$/i.test(noteText)) return { officeName: null, proposed: false };
	if (RANGE_START_RE.test(noteText) || RANGE_END_RE.test(noteText)) {
		return { officeName: null, proposed: false };
	}
	if (isOfficeCandidate(noteText)) return { officeName: noteText, proposed: true };
	return { officeName: null, proposed: false };
}

interface HeaderInfo {
	rowNumber: number;
	columns: Record<string, number>;
}

/** Scans the first few rows for the header labels, rather than assuming fixed cell positions. */
function findHeaderRow(sheet: ExcelJS.Worksheet): HeaderInfo | null {
	const scanLimit = Math.min(sheet.rowCount, 10);
	for (let r = 1; r <= scanLimit; r++) {
		const row = sheet.getRow(r);
		const columns: Record<string, number> = {};
		row.eachCell((cell, colNumber) => {
			const label = normalizeLabel(cell.value);
			if (label) columns[label] = colNumber;
		});
		if (columns['date'] && columns['start time']) return { rowNumber: r, columns };
	}
	return null;
}

/** Finds a `label` cell anywhere in the sheet and reads the value immediately to its right. */
function findLabelValue(sheet: ExcelJS.Worksheet, label: string): ExcelJS.CellValue {
	const target = label.toLowerCase();
	let found: ExcelJS.CellValue = null;
	sheet.eachRow((row) => {
		row.eachCell((cell, colNumber) => {
			if (found !== null) return;
			if (normalizeLabel(cell.value) === target) found = row.getCell(colNumber + 1).value;
		});
	});
	return found;
}

interface RawRow {
	rowNumber: number;
	date: string | null;
	start: string | null;
	end: string | null;
	total: number | null;
	notes: string | null;
}

function readRawRows(sheet: ExcelJS.Worksheet, header: HeaderInfo): RawRow[] {
	const { rowNumber: headerRowNumber, columns } = header;
	// Date and Start Time are guaranteed present — findHeaderRow only returns a header whose
	// columns include both — so only End Time/Total/Notes need the "maybe absent" handling below.
	const dateCol = columns['date'];
	const startCol = columns['start time'];
	const endCol = columns['end time'];
	const totalCol = columns['total'];
	const notesCol = columns['notes'];

	const rawRows: RawRow[] = [];
	for (let r = headerRowNumber + 1; r <= sheet.rowCount; r++) {
		const row = sheet.getRow(r);
		const date = readDateCell(row.getCell(dateCol).value);
		const start = readTimeCell(row.getCell(startCol).value);
		const end = endCol ? readTimeCell(row.getCell(endCol).value) : null;
		const total = totalCol ? asNumber(row.getCell(totalCol).value) : null;
		const notes = notesCol ? readNoteCell(row.getCell(notesCol).value) : null;
		if (date === null && start === null && end === null && total === null && notes === null) {
			continue; // a fully empty physical row carries nothing to read
		}
		rawRows.push({ rowNumber: r, date, start, end, total, notes });
	}
	return rawRows;
}

/** Parses a legacy workbook buffer into a reviewable, editable preview. */
export async function parseLegacyWorkbook(
	buffer: Buffer,
	options: { offices: ImportOffice[] }
): Promise<ImportPreview> {
	const workbook = new ExcelJS.Workbook();
	// exceljs's .d.ts shadows the ambient Buffer type; see export.ts for the same cast.
	await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
	const sheet = workbook.worksheets[0];
	if (!sheet) throw new Error('The workbook has no sheets');

	const header = findHeaderRow(sheet);
	if (!header) {
		throw new Error('Could not find a header row with "Date" and "Start Time" columns');
	}
	const rawRows = readRawRows(sheet, header);

	const firstDateRow = rawRows.find((row) => row.date !== null);
	if (!firstDateRow) throw new Error('Could not find any dated rows');
	const firstDate = firstDateRow.date!;

	const yearValue = asNumber(findLabelValue(sheet, 'Year'));
	const totalHoursValue = asNumber(findLabelValue(sheet, 'Total Hours'));
	const flatRateValue = asNumber(findLabelValue(sheet, 'Flat Rate'));

	const startYear = yearValue ?? fyStartYearOf(firstDate);
	const { start: fyStart, end: fyEnd } = fyBounds(startYear);

	const rows: ImportRow[] = [];
	const issues: ImportIssue[] = [];
	const proposedOfficesSet = new Set<string>();
	let activeLeaveRange = false;

	for (const raw of rawRows) {
		if (raw.date === null) {
			issues.push({ rowNumber: raw.rowNumber, reason: 'Could not read a date for this row' });
			continue;
		}
		if (raw.date < fyStart || raw.date > fyEnd) {
			issues.push({
				rowNumber: raw.rowNumber,
				reason: `${raw.date} falls outside ${fyLabel(startYear)} (${fyStart} – ${fyEnd})`
			});
		}
		const noteText = raw.notes;

		if (activeLeaveRange) {
			const isEnd = noteText !== null && RANGE_END_RE.test(noteText);
			rows.push({
				rowNumber: raw.rowNumber,
				date: raw.date,
				kind: 'leave',
				officeName: null,
				start: null,
				end: null,
				breakMinutes: null,
				notes: noteText,
				skip: false
			});
			if (isEnd) activeLeaveRange = false;
			continue;
		}

		if (noteText !== null && RANGE_START_RE.test(noteText) && !RANGE_END_RE.test(noteText)) {
			activeLeaveRange = true;
			rows.push({
				rowNumber: raw.rowNumber,
				date: raw.date,
				kind: 'leave',
				officeName: null,
				start: null,
				end: null,
				breakMinutes: null,
				notes: noteText,
				skip: false
			});
			continue;
		}

		const hasTimes = raw.start !== null && raw.end !== null;
		const { officeName, proposed } = resolveOfficeName(noteText, options.offices);
		if (proposed && officeName) proposedOfficesSet.add(officeName);

		if (hasTimes) {
			const spanMinutes = toMinutes(raw.end!) - toMinutes(raw.start!);
			let breakMinutes = 0;
			if (raw.total !== null) {
				const derivedBreak = Math.round(spanMinutes - raw.total * 60);
				if (derivedBreak < 0 || derivedBreak >= spanMinutes) {
					issues.push({
						rowNumber: raw.rowNumber,
						reason: `Implausible break (${derivedBreak} min) derived from the Total column`
					});
				} else {
					breakMinutes = derivedBreak;
				}
			}
			rows.push({
				rowNumber: raw.rowNumber,
				date: raw.date,
				kind: 'work',
				officeName,
				start: raw.start,
				end: raw.end,
				breakMinutes,
				notes: noteText,
				skip: false
			});
			continue;
		}

		if (officeName) {
			rows.push({
				rowNumber: raw.rowNumber,
				date: raw.date,
				kind: 'work',
				officeName,
				start: null,
				end: null,
				breakMinutes: null,
				notes: noteText,
				skip: false
			});
			continue;
		}

		if (noteText !== null && /^sick$/i.test(noteText)) {
			rows.push({
				rowNumber: raw.rowNumber,
				date: raw.date,
				kind: 'sick',
				officeName: null,
				start: null,
				end: null,
				breakMinutes: null,
				notes: noteText,
				skip: false
			});
			continue;
		}

		if (noteText === null) {
			rows.push({
				rowNumber: raw.rowNumber,
				date: raw.date,
				kind: 'off',
				officeName: null,
				start: null,
				end: null,
				breakMinutes: null,
				notes: null,
				skip: true
			});
			continue;
		}

		issues.push({ rowNumber: raw.rowNumber, reason: `Could not classify the note "${noteText}"` });
		rows.push({
			rowNumber: raw.rowNumber,
			date: raw.date,
			kind: 'off',
			officeName: null,
			start: null,
			end: null,
			breakMinutes: null,
			notes: noteText,
			skip: true
		});
	}

	const totalMinutes = rows
		.filter((row) => row.kind === 'work' && row.start !== null && row.end !== null)
		// A timed `work` row always has breakMinutes set alongside start/end (see the loop above).
		.reduce(
			(sum, row) => sum + (toMinutes(row.end!) - toMinutes(row.start!) - row.breakMinutes!),
			0
		);
	const rateCentsPerHour =
		totalHoursValue !== null && flatRateValue !== null && totalHoursValue !== 0
			? Math.round((flatRateValue / totalHoursValue) * 100)
			: null;
	const appHours = totalMinutes / 60;
	const appClaimCents =
		rateCentsPerHour !== null ? claimCents(totalMinutes, rateCentsPerHour) : null;
	const sheetClaimCents = flatRateValue !== null ? Math.round(flatRateValue * 100) : null;
	// A small epsilon: the sheet's own Total Hours cell is itself a rounded/displayed figure, so
	// an exact float comparison would flag harmless last-decimal noise as a mismatch.
	const mismatch = totalHoursValue !== null && Math.abs(totalHoursValue - appHours) > 0.05;

	return {
		fyStartYear: startYear,
		rateCentsPerHour,
		proposedOffices: [...proposedOfficesSet].sort(),
		rows,
		issues,
		sheetTotals: { hours: totalHoursValue, claimCents: sheetClaimCents },
		appTotals: { hours: appHours, claimCents: appClaimCents },
		mismatch
	};
}
