// Parses a legacy "Home Work Diary" .xlsx into a reviewable preview. Pure given the buffer: no
// DB access, so it can run inside the upload action and round-trip through a hidden form field
// without any server-side temporary state (see AGENTS.md and the phase doc for the approach,
// copied from ev-charging-log's import.ts: find columns by header label, not fixed cell refs).

import ExcelJS from 'exceljs';
import { z } from 'zod';
import type { DayKind } from '$lib/core/dayType';
import { formatIsoDate, parseIsoDate } from '$lib/core/date';
import { fyBounds, fyLabel, fyStartYear as fyStartYearOf } from '$lib/core/fy';
import { formatHm, toMinutes, validateBlock } from '$lib/core/time';
import { claimCents } from '$lib/core/totals';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const HH_MM_RE = /^([0-1]\d|2[0-3]):([0-5]\d)$/;
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

/**
 * A formula cell (`{formula, result}`) resolves to its cached `result` — a legacy sheet computing
 * `Total`, `Flat Rate`, or a date with a live formula (rather than a literal value) would
 * otherwise read as null everywhere below, silently understating hours/claim rather than erroring.
 * Every other shape (primitive, `Date`, rich text) passes through unchanged.
 */
function resolveFormula(value: ExcelJS.CellValue): ExcelJS.CellValue {
	if (
		typeof value === 'object' &&
		value !== null &&
		!(value instanceof Date) &&
		'result' in value
	) {
		return value.result;
	}
	return value;
}

function asNumber(value: ExcelJS.CellValue): number | null {
	const resolved = resolveFormula(value);
	if (typeof resolved === 'number') return resolved;
	if (typeof resolved === 'string' && resolved.trim() !== '' && !Number.isNaN(Number(resolved))) {
		return Number(resolved);
	}
	return null;
}

function excelSerialToUtcDate(serial: number): Date {
	return new Date(Math.round((serial - EXCEL_EPOCH_OFFSET_DAYS) * 86_400_000));
}

function readDateCell(value: ExcelJS.CellValue): string | null {
	const resolved = resolveFormula(value);
	if (resolved instanceof Date) return formatIsoDate(resolved);
	if (typeof resolved === 'number') return formatIsoDate(excelSerialToUtcDate(resolved));
	if (typeof resolved === 'string' && ISO_DATE_RE.test(resolved.trim())) return resolved.trim();
	return null;
}

/** A time-of-day cell: a fraction of a day, read via UTC getters so no host timezone leaks in. */
function readTimeCell(value: ExcelJS.CellValue): string | null {
	const resolved = resolveFormula(value);
	if (resolved instanceof Date) {
		return formatHm({ hours: resolved.getUTCHours(), minutes: resolved.getUTCMinutes() });
	}
	if (typeof resolved === 'number') {
		const totalMinutes = Math.round((resolved % 1) * 24 * 60) % (24 * 60);
		return formatHm({ hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 });
	}
	return null;
}

function readNoteCell(value: ExcelJS.CellValue): string | null {
	const resolved = resolveFormula(value);
	if (resolved == null) return null;
	if (typeof resolved === 'object' && 'richText' in resolved) {
		const text = resolved.richText
			.map((run) => run.text)
			.join('')
			.trim();
		return text || null;
	}
	const text = String(resolved).trim();
	return text || null;
}

/** Strips a trailing `*`/`?` (an uncertainty marker in the legacy notes). */
function stripUncertaintyMarker(name: string): string {
	return name
		.trim()
		.replace(/[*?]+$/, '')
		.trim();
}

/** Same as `stripUncertaintyMarker`, lowercased — for matching only, never for display. */
function normalizeOfficeName(name: string): string {
	return stripUncertaintyMarker(name).toLowerCase();
}

function findExistingOffice(note: string, offices: ImportOffice[]): string | null {
	const normalized = normalizeOfficeName(note);
	return offices.find((office) => office.name.trim().toLowerCase() === normalized)?.name ?? null;
}

/** A short, single-word note that isn't a recognised keyword is proposed as a new office. */
function isOfficeCandidate(note: string): boolean {
	return /^\S+$/.test(note) && note.length <= 40;
}

/** "Sick" with an uncertainty marker (`Sick?`, `Sick*`) is still sick — checked on the stripped
 *  form so it's never instead proposed as a new office named "Sick" (see `resolveOfficeName`). */
function isSickNote(noteText: string): boolean {
	return /^sick$/i.test(stripUncertaintyMarker(noteText));
}

function resolveOfficeName(
	noteText: string | null,
	offices: ImportOffice[]
): { officeName: string | null; proposed: boolean } {
	if (!noteText) return { officeName: null, proposed: false };
	const existing = findExistingOffice(noteText, offices);
	if (existing) return { officeName: existing, proposed: false };
	// Every check below runs on the stripped form: an uncertainty marker must never change what a
	// note *means* (a marker-only note strips to "", and "Sick*" must still read as sick, not as
	// a proposed office called "Sick" that every later exact "Sick" note would then match).
	const stripped = stripUncertaintyMarker(noteText);
	if (!stripped) return { officeName: null, proposed: false };
	if (isSickNote(stripped)) return { officeName: null, proposed: false };
	if (RANGE_START_RE.test(stripped) || RANGE_END_RE.test(stripped)) {
		return { officeName: null, proposed: false };
	}
	if (isOfficeCandidate(stripped)) return { officeName: stripped, proposed: true };
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

		if (noteText !== null && isSickNote(noteText)) {
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

// The review step round-trips the whole preview through a hidden form field, so the commit
// action receives it as untrusted, client-supplied JSON — the shape below is not merely
// convenient typing, it's the trust boundary. `importPreviewSchema.safeParse` is what stands
// between a crafted `preview={}` (or `[]`, `5`, a partial object, …) and a 500 from
// `preview.rows.filter` or similar reaching straight for an assumed-present property.
const importRowSchema = z
	.object({
		rowNumber: z.number().int(),
		date: z.string().regex(ISO_DATE_RE),
		kind: z.enum(['work', 'leave', 'sick', 'public_holiday', 'off']),
		officeName: z.string().nullable(),
		start: z.string().regex(HH_MM_RE).nullable(),
		end: z.string().regex(HH_MM_RE).nullable(),
		breakMinutes: z.number().int().min(0).nullable(),
		notes: z.string().nullable(),
		skip: z.boolean()
	})
	// The type-level checks above (HH:mm shape, a non-negative integer break) aren't enough on
	// their own to keep a bad row from reaching `upsertDay` (which does no validation of its
	// own) and then permanently 500ing every later read of the year — `end` must still be after
	// `start` with a break shorter than the span, exactly what `core/time.ts`'s own writers
	// (`dayHomeMinutes` → `blockMinutes` → `toMinutes`) assume of a persisted block.
	.refine(
		(row) =>
			row.start === null ||
			row.end === null ||
			// Skip when a time isn't even HH:mm; the field-level regex above already reports
			// that, and validateBlock's own toMinutes throws rather than returning false on one.
			!HH_MM_RE.test(row.start) ||
			!HH_MM_RE.test(row.end) ||
			// A null break is validated as 0, not skipped — `commitImport` applies exactly that
			// same `row.breakMinutes ?? 0` fallback when writing the block, so a timed row with a
			// null break must satisfy the same span check the written block will actually have.
			validateBlock({
				start: row.start,
				end: row.end,
				breakMinutes: row.breakMinutes ?? 0
			}) === null,
		{ message: 'Invalid time block', path: ['end'] }
	);
const importIssueSchema = z.object({ rowNumber: z.number().int(), reason: z.string() });
const importTotalsSchema = z.object({
	hours: z.number().nullable(),
	claimCents: z.number().nullable()
});
const appTotalsSchema = z.object({ hours: z.number(), claimCents: z.number().nullable() });

export const importPreviewSchema = z
	.object({
		// Bounded the same as `core/validation.ts`'s `yearSchema` — an arbitrary large/negative
		// year is never a real FY, and `fyBounds` would otherwise happily hand back a bogus range.
		fyStartYear: z.number().int().min(2000).max(2100),
		rateCentsPerHour: z.number().nullable(),
		proposedOffices: z.array(z.string()),
		rows: z.array(importRowSchema),
		issues: z.array(importIssueSchema),
		sheetTotals: importTotalsSchema,
		appTotals: appTotalsSchema,
		mismatch: z.boolean()
	})
	// The parser itself only ever proposes dates inside `fyBounds(fyStartYear)` (an out-of-range
	// date becomes an `issues` entry instead) — re-checked here because the preview is untrusted,
	// client-supplied JSON by the time it reaches this schema. Without this, a single crafted row
	// dated e.g. 9999-12-31 reaches `commitImport`'s `raiseWatermark`, which would push the
	// prefill watermark far into the future and silently stop `ensurePrefilled` from ever
	// materialising another day (see `autoPrefill.ts`'s `startOfPlanning`).
	.superRefine((preview, ctx) => {
		const { start, end } = fyBounds(preview.fyStartYear);
		preview.rows.forEach((row, index) => {
			// `ISO_DATE_RE` only checks the YYYY-MM-DD shape, so a non-existent calendar date
			// (e.g. 2026-11-31) would otherwise pass the string comparison below and reach
			// `upsertDay` — every later `parseIsoDate` call (weekday labels, the week number, …)
			// then throws instead of returning a display value.
			try {
				parseIsoDate(row.date);
			} catch {
				ctx.addIssue({
					code: 'custom',
					message: `${row.date} is not a valid calendar date`,
					path: ['rows', index, 'date']
				});
				return;
			}
			if (row.date < start || row.date > end) {
				ctx.addIssue({
					code: 'custom',
					message: `${row.date} is outside ${fyLabel(preview.fyStartYear)}`,
					path: ['rows', index, 'date']
				});
			}
		});
	});
