import { fail, redirect } from '@sveltejs/kit';
import { fySlug } from '$lib/core/fy';
import { db } from '$lib/server/db';
import { parseLegacyWorkbook, type ImportPreview } from '$lib/server/import';
import { commitImport, FinalisedYearError, type OfficeResolution } from '$lib/server/importCommit';
import { listOffices } from '$lib/server/repo/offices';
import { getYear } from '$lib/server/repo/years';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	return { offices: listOffices(db, { includeArchived: true }) };
};

/** Parses a "0.70"-style dollar string into integer cents, or null if it isn't a number. */
function parseDollarsToCents(value: FormDataEntryValue | null): number | null {
	if (typeof value !== 'string' || value.trim() === '') return null;
	const dollars = Number(value);
	if (!Number.isFinite(dollars)) return null;
	return Math.round(dollars * 100);
}

export const actions: Actions = {
	upload: async ({ request }) => {
		const formData = await request.formData();
		const file = formData.get('file');
		if (!(file instanceof File) || file.size === 0) {
			return fail(400, { form: 'upload' as const, error: 'Choose a .xlsx file to upload.' });
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
		let preview: ImportPreview | null;
		try {
			preview = typeof previewRaw === 'string' ? JSON.parse(previewRaw) : null;
		} catch {
			preview = null;
		}
		if (!preview) {
			return fail(400, {
				form: 'commit' as const,
				error: 'The review data was lost — upload the file again.',
				preview: null
			});
		}

		const rateCentsPerHour = parseDollarsToCents(formData.get('rateDollars'));
		if (rateCentsPerHour === null) {
			return fail(400, { form: 'commit' as const, error: 'Enter a valid rate.', preview });
		}

		const officeResolutions: OfficeResolution[] = preview.proposedOffices.map((name) => {
			const raw = formData.get(`office-${name}`);
			if (typeof raw === 'string' && raw.startsWith('map:')) {
				return { name, action: 'map', mapToOfficeId: Number(raw.slice(4)) };
			}
			if (raw === 'ignore') return { name, action: 'ignore' };
			return { name, action: 'create' };
		});

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
