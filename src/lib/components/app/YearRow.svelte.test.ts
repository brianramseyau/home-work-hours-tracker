import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import YearRow from './YearRow.svelte';

const baseYear = {
	startYear: 2026,
	rateCentsPerHour: 70,
	rateNote: null as string | null,
	finalisedAt: null as string | null,
	fy: { label: 'FY27', range: 'Jul 2026 – Jun 2027' },
	homeMinutes: 456,
	claimCents: 532
};

describe('YearRow', () => {
	it('shows the FY, rate, hours and claim', async () => {
		render(YearRow, { year: baseYear });

		await expect.element(page.getByRole('heading', { name: 'FY27' })).toBeInTheDocument();
		await expect.element(page.getByText('Jul 2026 – Jun 2027')).toBeInTheDocument();
		await expect.element(page.getByText('$0.70/hr')).toBeInTheDocument();
		await expect.element(page.getByText('7.6 h')).toBeInTheDocument();
		await expect.element(page.getByText('$5.32')).toBeInTheDocument();
	});

	it('shows the rate note when set, and omits it otherwise', async () => {
		const { rerender } = render(YearRow, { year: baseYear });
		expect(page.getByText('ATO fixed rate method').elements()).toHaveLength(0);

		await rerender({ year: { ...baseYear, rateNote: 'ATO fixed rate method' } });
		await expect.element(page.getByText('ATO fixed rate method')).toBeInTheDocument();
	});

	it('shows a Finalised badge only once the year is finalised', async () => {
		const { rerender } = render(YearRow, { year: baseYear });
		expect(page.getByText('Finalised').elements()).toHaveLength(0);

		await rerender({ year: { ...baseYear, finalisedAt: '2027-07-15' } });
		await expect.element(page.getByText('Finalised')).toBeInTheDocument();
	});

	it('opens an inline rate-edit form pre-filled with the current rate and note', async () => {
		render(YearRow, { year: { ...baseYear, rateNote: 'ATO fixed rate method' } });

		await page.getByRole('button', { name: 'Edit rate' }).click();

		const rateInput = page.getByLabelText('Rate ($/hr)');
		await expect.element(rateInput).toHaveValue('0.70');
		const noteInput = page.getByLabelText('Note');
		await expect.element(noteInput).toHaveValue('ATO fixed rate method');

		await page.getByRole('button', { name: 'Cancel' }).click();
		expect(page.getByLabelText('Rate ($/hr)').elements()).toHaveLength(0);
	});

	it('closes the rate-edit form as soon as Save rate is clicked', async () => {
		render(YearRow, { year: baseYear });
		await page.getByRole('button', { name: 'Edit rate' }).click();
		await page.getByRole('button', { name: 'Save rate' }).click();
		expect(page.getByLabelText('Rate ($/hr)').elements()).toHaveLength(0);
	});

	it('offers to finalise an open year, and to unfinalise a finalised one', async () => {
		const { rerender } = render(YearRow, { year: baseYear });
		await expect.element(page.getByRole('button', { name: 'Finalise' })).toBeInTheDocument();

		await rerender({ year: { ...baseYear, finalisedAt: '2027-07-15' } });
		await expect.element(page.getByRole('button', { name: 'Unfinalise' })).toBeInTheDocument();
	});

	it('shows a confirmation dialog before finalising, closable without submitting', async () => {
		render(YearRow, { year: baseYear });

		await page.getByRole('button', { name: 'Finalise' }).click();
		await expect.element(page.getByRole('heading', { name: 'Finalise FY27?' })).toBeInTheDocument();
		await expect
			.element(page.getByText('Auto-fill and edits stop for this year', { exact: false }))
			.toBeInTheDocument();

		await page.getByRole('button', { name: 'Cancel' }).click();
		expect(page.getByRole('heading', { name: 'Finalise FY27?' }).elements()).toHaveLength(0);
	});

	it('shows the unfinalise wording and effect for an already-finalised year', async () => {
		render(YearRow, { year: { ...baseYear, finalisedAt: '2027-07-15' } });

		await page.getByRole('button', { name: 'Unfinalise' }).click();
		await expect
			.element(page.getByRole('heading', { name: 'Unfinalise FY27?' }))
			.toBeInTheDocument();
		await expect
			.element(page.getByText('Auto-fill and edits will resume', { exact: false }))
			.toBeInTheDocument();

		await page.getByRole('dialog').getByRole('button', { name: 'Unfinalise' }).click();
		await expect
			.element(page.getByRole('heading', { name: 'Unfinalise FY27?' }))
			.not.toBeInTheDocument();
	});

	it('closes the dialog as soon as its own Finalise button is clicked', async () => {
		render(YearRow, { year: baseYear });
		await page.getByRole('button', { name: 'Finalise' }).click();
		// Scoped to the dialog, since the trigger shares its accessible name with the button inside.
		await page.getByRole('dialog').getByRole('button', { name: 'Finalise' }).click();
		await expect
			.element(page.getByRole('heading', { name: 'Finalise FY27?' }))
			.not.toBeInTheDocument();
	});
});
