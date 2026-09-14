import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { ImportPreview } from '$lib/server/import';
import Page from './+page.svelte';

const data = {
	offices: [
		{ id: 1, name: 'Office Location 1', address: null, archivedAt: null },
		{ id: 2, name: 'Office Location 2', address: null, archivedAt: null }
	]
};

function previewFixture(overrides: Partial<ImportPreview> = {}): ImportPreview {
	return {
		fyStartYear: 2026,
		rateCentsPerHour: 70,
		proposedOffices: [],
		rows: [
			{
				rowNumber: 3,
				date: '2026-07-01',
				kind: 'work',
				officeName: null,
				start: '09:00',
				end: '17:06',
				breakMinutes: 30,
				notes: null,
				skip: false
			}
		],
		issues: [],
		sheetTotals: { hours: 7.6, claimCents: 532 },
		appTotals: { hours: 7.6, claimCents: 532 },
		mismatch: false,
		...overrides
	};
}

describe('import page — upload step', () => {
	it('shows the upload form when there is no review data yet', async () => {
		render(Page, { data, form: undefined } as unknown as Parameters<typeof render<typeof Page>>[1]);
		await expect.element(page.getByLabelText('Legacy .xlsx file')).toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: 'Upload and review' }))
			.toBeInTheDocument();
	});

	it('shows the upload error when the last upload failed', async () => {
		render(Page, {
			data,
			form: { form: 'upload', error: 'Could not read this workbook.' }
		} as unknown as Parameters<typeof render<typeof Page>>[1]);
		await expect.element(page.getByText('Could not read this workbook.')).toBeInTheDocument();
	});
});

describe('import page — review step', () => {
	it('shows the detected FY, totals and the row table', async () => {
		render(Page, {
			data,
			form: { form: 'upload', preview: previewFixture(), existingRateCentsPerHour: 65 }
		} as unknown as Parameters<typeof render<typeof Page>>[1]);

		await expect.element(page.getByText(/Detected FY27, 1 row, 0 issues/)).toBeInTheDocument();
		await expect.element(page.getByText('2026-07-01')).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Commit 1 row' })).toBeInTheDocument();
	});

	it('shows an em dash when the sheet has no totals at all, and no rate cell', async () => {
		render(Page, {
			data,
			form: {
				form: 'upload',
				preview: previewFixture({
					rateCentsPerHour: null,
					sheetTotals: { hours: null, claimCents: null },
					appTotals: { hours: 7.6, claimCents: null }
				}),
				existingRateCentsPerHour: null
			}
		} as unknown as Parameters<typeof render<typeof Page>>[1]);
		await expect.element(page.getByText('—', { exact: true })).toBeInTheDocument();
	});

	it('flags a mismatch between the sheet and recomputed totals', async () => {
		render(Page, {
			data,
			form: {
				form: 'upload',
				preview: previewFixture({ mismatch: true, sheetTotals: { hours: 100, claimCents: 7000 } }),
				existingRateCentsPerHour: null
			}
		} as unknown as Parameters<typeof render<typeof Page>>[1]);
		await expect.element(page.getByText(/don't match/)).toBeInTheDocument();
	});

	it('lists an issue and highlights its row, unchecked by default', async () => {
		const preview = previewFixture({
			rows: [
				{
					rowNumber: 4,
					date: '2026-07-02',
					kind: 'off',
					officeName: null,
					start: null,
					end: null,
					breakMinutes: null,
					notes: 'a weird note',
					skip: false
				}
			],
			issues: [{ rowNumber: 4, reason: 'Could not classify the note "a weird note"' }]
		});
		render(Page, {
			data,
			form: { form: 'upload', preview, existingRateCentsPerHour: null }
		} as unknown as Parameters<typeof render<typeof Page>>[1]);

		await expect
			.element(page.getByText('Row 4: Could not classify the note "a weird note"'))
			.toBeInTheDocument();
		const checkbox = page.getByRole('checkbox', { name: 'Import 2026-07-02' });
		await expect.element(checkbox).not.toBeChecked();
	});

	it('filters to issue rows only when "Show issues only" is checked', async () => {
		const preview = previewFixture({
			rows: [
				{
					rowNumber: 3,
					date: '2026-07-01',
					kind: 'work',
					officeName: null,
					start: '09:00',
					end: '17:06',
					breakMinutes: 30,
					notes: null,
					skip: false
				},
				{
					rowNumber: 4,
					date: '2026-07-02',
					kind: 'off',
					officeName: null,
					start: null,
					end: null,
					breakMinutes: null,
					notes: 'ambiguous',
					skip: false
				}
			],
			issues: [{ rowNumber: 4, reason: 'Could not classify the note "ambiguous"' }]
		});
		render(Page, {
			data,
			form: { form: 'upload', preview, existingRateCentsPerHour: null }
		} as unknown as Parameters<typeof render<typeof Page>>[1]);

		await expect.element(page.getByText('2026-07-01')).toBeVisible();
		const includeGoodRow = page.getByRole('checkbox', { name: 'Import 2026-07-01' });
		await includeGoodRow.click();
		await expect.element(includeGoodRow).not.toBeChecked();

		await page.getByLabelText('Show issues only').click();
		// Hidden via the `hidden` attribute, not removed from the DOM — its own checked state
		// (unchecked, above) must survive the filter toggle so a manually-excluded row stays
		// excluded, and a filtered-out row's checkbox is never silently missing from the form.
		await expect.element(page.getByText('2026-07-01')).not.toBeVisible();
		await expect.element(page.getByText('2026-07-02')).toBeVisible();

		await page.getByLabelText('Show issues only').click();
		await expect.element(includeGoodRow).not.toBeChecked();
	});

	it('toggles "Replace my manual edits"', async () => {
		render(Page, {
			data,
			form: { form: 'upload', preview: previewFixture(), existingRateCentsPerHour: null }
		} as unknown as Parameters<typeof render<typeof Page>>[1]);
		const toggle = page.getByRole('switch', { name: 'Replace my manual edits' });
		await expect.element(toggle).not.toBeChecked();
		await toggle.click();
		await expect.element(toggle).toBeChecked();
	});

	it('offers create/map/ignore choices for each proposed office', async () => {
		const preview = previewFixture({ proposedOffices: ['CityOffice'] });
		render(Page, {
			data,
			form: { form: 'upload', preview, existingRateCentsPerHour: null }
		} as unknown as Parameters<typeof render<typeof Page>>[1]);

		await expect.element(page.getByText('CityOffice')).toBeInTheDocument();
		await expect
			.element(page.getByRole('radio', { name: 'Create new office' }))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('radio', { name: 'Map to Office Location 1' }))
			.toBeInTheDocument();

		await page.getByRole('radio', { name: 'Map to Office Location 1' }).click();
		await expect
			.element(page.getByRole('radio', { name: 'Map to Office Location 1' }))
			.toHaveAttribute('data-state', 'on');

		// Clicking the already-selected item deselects it (bits-ui reports an empty value), which
		// this component deliberately ignores rather than clearing the choice.
		await page.getByRole('radio', { name: 'Map to Office Location 1' }).click();
	});

	it('shows the commit error from a failed commit attempt', async () => {
		render(Page, {
			data,
			form: {
				form: 'commit',
				error: 'FY27 is already finalised',
				// No rate on the preview either, so the default-rate fallback falls all the way to
				// the hardcoded 70c/hr default rather than an existing FY's rate (a 'commit' failure
				// never carries `existingRateCentsPerHour` — that field only comes back from 'upload').
				preview: previewFixture({ rateCentsPerHour: null })
			}
		} as unknown as Parameters<typeof render<typeof Page>>[1]);
		await expect.element(page.getByText('FY27 is already finalised')).toBeInTheDocument();
		await expect.element(page.getByLabelText(/Rate for FY27/)).toHaveValue(70 / 100);
	});

	it('falls back to the upload step when a commit failure carries no preview', async () => {
		render(Page, {
			data,
			form: {
				form: 'commit',
				error: 'The review data was lost — upload the file again.',
				preview: null
			}
		} as unknown as Parameters<typeof render<typeof Page>>[1]);
		await expect.element(page.getByLabelText('Legacy .xlsx file')).toBeInTheDocument();
	});
});
