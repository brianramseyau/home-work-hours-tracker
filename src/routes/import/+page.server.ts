import { fail, redirect } from '@sveltejs/kit';
import { fySlug } from '$lib/core/fy';
import { db } from '$lib/server/db';
import { importPreviewSchema, parseLegacyWorkbook, type ImportPreview } from '$lib/server/import';
import { commitImport, FinalisedYearError, type OfficeResolution } from '$lib/server/importCommit';
import { listOffices } from '$lib/server/repo/offices';
import { getYear } from '$lib/server/repo/years';
import type { Actions, PageServerLoad } from './$types';

// A real "Home Work Diary" is a few hundred rows of text and formulas — a few MB, generously.
// Capped well below that to bound how much a single upload can make exceljs allocate/decompress.
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
// A sanity ceiling on the editable rate field, not a real-world limit — just enough to stop a
// crafted POST from creating an FY with an absurd (or negative) claim.
const MAX_RATE_DOLLARS = 1000;

export const load: PageServerLoad = () => {
	return { offices: listOffices(db, { includeArchived: true }) };
};

/** Parses a "0.70"-style dollar string into integer cents, or null if it isn't a sane rate. */
function parseDollarsToCents(value: FormDataEntryValue | null): number | null {
	if (typeof value !== 'string' || value.trim() === '') return null;
	const dollars = Number(value);
	if (!Number.isFinite(dollars) || dollars < 0 || dollars > MAX_RATE_DOLLARS) return null;
	return Math.round(dollars * 100);
}

export const actions: Actions = {
	upload: async ({ request }) => {
		const formData = await request.formData();
		const file = formData.get('file');
		if (!(file instanceof File) || file.size === 0) {
			return fail(400, { form: 'upload' as const, error: 'Choose a .xlsx file to upload.' });
		}
		if (file.size > MAX_UPLOAD_BYTES) {
			return fail(400, {
				form: 'upload' as const,
				error: `This file is too large (over ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB).`
			});
		}

		const buffer = Buffer.from(await file.arrayBuffer());
		const offices = listOffices(db, { includeArchived: true });
		let preview: ImportPreview;
		try {
			preview = await parseLegacyWorkbook(buffer, { offices });
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Could not read this workbook.';
			return fail(400, { form: 'upload' as const, error: message });
		}

		const existingYear = getYear(db, preview.fyStartYear);
		return {
			form: 'upload' as const,
			preview,
			existingRateCentsPerHour: existingYear?.rateCentsPerHour ?? null
		};
	},

	commit: async ({ request }) => {
		const formData = await request.formData();
		const previewRaw = formData.get('preview');
		let previewJson: unknown;
		try {
			previewJson = typeof previewRaw === 'string' ? JSON.parse(previewRaw) : null;
		} catch {
			previewJson = null;
		}
		// The preview is client-supplied (round-tripped through a hidden field), so it's parsed
		// against its full schema here, not just checked for truthiness — a crafted `preview={}`
		// or `preview=[]` is still "truthy" but has none of the shape the code below assumes.
		const parsedPreview = importPreviewSchema.safeParse(previewJson);
		if (!parsedPreview.success) {
			return fail(400, {
				form: 'commit' as const,
				error: 'The review data was lost or invalid — upload the file again.',
				preview: null
			});
		}
		const preview = parsedPreview.data;

		const rateCentsPerHour = parseDollarsToCents(formData.get('rateDollars'));
		if (rateCentsPerHour === null) {
			return fail(400, { form: 'commit' as const, error: 'Enter a valid rate.', preview });
		}

		const officeIds = new Set(
			listOffices(db, { includeArchived: true }).map((office) => office.id)
		);
		const officeResolutions: OfficeResolution[] = [];
		for (const name of preview.proposedOffices) {
			const raw = formData.get(`office-${name}`);
			if (typeof raw === 'string' && raw.startsWith('map:')) {
				const mapToOfficeId = Number(raw.slice(4));
				if (!Number.isInteger(mapToOfficeId) || !officeIds.has(mapToOfficeId)) {
					return fail(400, {
						form: 'commit' as const,
						error: `"${name}" is mapped to an office that no longer exists.`,
						preview
					});
				}
				officeResolutions.push({ name, action: 'map', mapToOfficeId });
			} else if (raw === 'ignore') {
				officeResolutions.push({ name, action: 'ignore' });
			} else {
				officeResolutions.push({ name, action: 'create' });
			}
		}

		const rows = preview.rows
			.filter((row) => !row.skip)
			.map((row) => ({ ...row, skip: formData.get(`include-${row.rowNumber}`) !== 'on' }));
		const replaceManualEdits = formData.get('replaceManualEdits') === 'on';

		let result;
		try {
			result = commitImport(db, {
				fyStartYear: preview.fyStartYear,
				rateCentsPerHour,
				rows,
				officeResolutions,
				replaceManualEdits
			});
		} catch (error) {
			if (error instanceof FinalisedYearError) {
				return fail(400, { form: 'commit' as const, error: error.message, preview });
			}
			throw error;
		}

		redirect(303, `/${fySlug(preview.fyStartYear)}?imported=${result.imported}`);
	}
};
