// Commits a reviewed import preview: creates the FY if it's missing, creates or maps the
// approved offices, upserts the days (never overwriting a `manual` row unless
// `replaceManualEdits` is set — `prefill` rows are always replaced), and raises the prefill
// watermark so historical gaps are never back-filled. Kept separate from import.ts, which stays a
// pure parser with no DB access (see AGENTS.md's layering rule).
//
// Not wrapped in a single outer `db.transaction()`: every repo function here (like the rest of
// the app's actions — see settings/+page.server.ts) takes the plain `Db`, and each of `upsertDay`
// etc. is already atomic on its own row. A single top-level transaction would need every repo
// function to also accept the driver's transaction type, which no other call site in this
// codebase needs, for a case (an upload the user reviewed and explicitly committed) where a
// mid-import crash leaving the earlier rows written is an acceptable, correctable outcome.

import type { Day } from '$lib/core/dayType';
import type { ImportRow } from './import';
import { raiseWatermark } from './autoPrefill';
import type { Db } from './db/create';
import { getDay, upsertDay } from './repo/days';
import { createOffice, listOffices } from './repo/offices';
import { createYear, getYear } from './repo/years';

export interface OfficeResolution {
	/** The proposed office name from the preview (`ImportPreview.proposedOffices`). */
	name: string;
	action: 'create' | 'map' | 'ignore';
	/** Required when `action` is 'map': the id of the existing office to use instead. */
	mapToOfficeId?: number | null;
}

export interface CommitImportInput {
	fyStartYear: number;
	rateCentsPerHour: number;
	/** The reviewed rows — `skip: true` rows are counted but never written. */
	rows: ImportRow[];
	officeResolutions: OfficeResolution[];
	replaceManualEdits: boolean;
}

export interface CommitImportResult {
	imported: number;
	skipped: number;
}

/** Thrown when the target FY is already finalised — a finalised year is frozen (see AGENTS.md). */
export class FinalisedYearError extends Error {}

export function commitImport(db: Db, input: CommitImportInput): CommitImportResult {
	let year = getYear(db, input.fyStartYear);
	if (!year) {
		year = createYear(db, {
			startYear: input.fyStartYear,
			rateCentsPerHour: input.rateCentsPerHour
		});
	}
	if (year.finalisedAt) {
		throw new FinalisedYearError(`FY${input.fyStartYear + 1 - 2000} is already finalised`);
	}

	const officeIdByName = new Map<string, number | null>();
	for (const resolution of input.officeResolutions) {
		if (resolution.action === 'create') {
			const office = createOffice(db, { name: resolution.name });
			officeIdByName.set(resolution.name, office.id);
		} else if (resolution.action === 'map') {
			officeIdByName.set(resolution.name, resolution.mapToOfficeId ?? null);
		} else {
			officeIdByName.set(resolution.name, null);
		}
	}
	// A row's office name may already be a real, existing office (the parser only proposes
	// *unmatched* names) — those aren't in officeResolutions at all, so resolve them here too.
	for (const office of listOffices(db, { includeArchived: true })) {
		if (!officeIdByName.has(office.name)) officeIdByName.set(office.name, office.id);
	}

	let imported = 0;
	let skipped = 0;
	let lastDate: string | null = null;
	const now = new Date().toISOString();

	for (const row of input.rows) {
		if (row.skip) {
			skipped++;
			continue;
		}
		const existing = getDay(db, row.date);
		if (existing && existing.source === 'manual' && !input.replaceManualEdits) {
			skipped++;
			continue;
		}

		const day: Day = {
			date: row.date,
			kind: row.kind,
			officeId: row.officeName ? (officeIdByName.get(row.officeName) ?? null) : null,
			notes: row.notes,
			source: 'import',
			blocks:
				row.kind === 'work' && row.start !== null && row.end !== null
					? [{ start: row.start, end: row.end, breakMinutes: row.breakMinutes ?? 0 }]
					: []
		};
		upsertDay(db, day, now);
		imported++;
		if (lastDate === null || row.date > lastDate) lastDate = row.date;
	}

	if (lastDate) raiseWatermark(db, lastDate);

	return { imported, skipped };
}
