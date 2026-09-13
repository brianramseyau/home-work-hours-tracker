import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/state', () => import('$lib/test-utils/pageFormStub.svelte'));

import { resetPageForm, setPageForm } from '$lib/test-utils/pageFormStub.svelte';
import { render } from 'vitest-browser-svelte';
import OfficeRow from './OfficeRow.svelte';

beforeEach(() => {
	resetPageForm();
});

const office = {
	id: 1,
	name: 'Office Location 1',
	address: null as string | null,
	archivedAt: null as string | null
};

describe('OfficeRow', () => {
	it('shows the office name, with no address and no badge by default', async () => {
		render(OfficeRow, { office });
		await expect.element(page.getByText('Office Location 1')).toBeInTheDocument();
		expect(page.getByText('Archived').elements()).toHaveLength(0);
	});

	it('shows the address when set', async () => {
		render(OfficeRow, {
			office: { ...office, address: '123 Example St, Sampletown VIC 3000' }
		});
		await expect.element(page.getByText('123 Example St, Sampletown VIC 3000')).toBeInTheDocument();
	});

	it('shows an Archived badge and an Unarchive action once archived', async () => {
		render(OfficeRow, { office: { ...office, archivedAt: '2027-01-01' } });
		await expect.element(page.getByText('Archived')).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Unarchive' })).toBeInTheDocument();
		expect(page.getByRole('button', { name: 'Archive', exact: true }).elements()).toHaveLength(0);
	});

	it('opens an inline rename form pre-filled with the current name and address', async () => {
		render(OfficeRow, {
			office: { ...office, address: '123 Example St, Sampletown VIC 3000' }
		});

		await page.getByRole('button', { name: 'Rename' }).click();
		await expect.element(page.getByLabelText('Name')).toHaveValue('Office Location 1');
		await expect
			.element(page.getByLabelText('Address'))
			.toHaveValue('123 Example St, Sampletown VIC 3000');

		await page.getByRole('button', { name: 'Cancel' }).click();
		expect(page.getByLabelText('Name').elements()).toHaveLength(0);
	});

	it('closes the rename form once the save actually succeeds', async () => {
		render(OfficeRow, { office });
		await page.getByRole('button', { name: 'Rename' }).click();
		await expect.element(page.getByLabelText('Name')).toBeInTheDocument();

		setPageForm({ form: 'officeUpdate', id: office.id, success: true });
		await expect.element(page.getByLabelText('Name')).not.toBeInTheDocument();
	});

	it('keeps the rename form open and shows the error when the save fails', async () => {
		render(OfficeRow, { office });
		await page.getByRole('button', { name: 'Rename' }).click();

		setPageForm({
			form: 'officeUpdate',
			id: office.id,
			errors: { name: ['An office already has this name.'] }
		});
		await expect
			.element(page.getByRole('alert'))
			.toHaveTextContent('An office already has this name.');
		await expect.element(page.getByLabelText('Name')).toBeInTheDocument();
	});

	it('does not show a stale error left over from a previous edit when reopening', async () => {
		render(OfficeRow, { office });
		await page.getByRole('button', { name: 'Rename' }).click();
		setPageForm({
			form: 'officeUpdate',
			id: office.id,
			errors: { name: ['An office already has this name.'] }
		});
		await expect.element(page.getByRole('alert')).toBeInTheDocument();

		await page.getByRole('button', { name: 'Cancel' }).click();
		await page.getByRole('button', { name: 'Rename' }).click();
		// Anchored on the form actually being back open (proving the reopen itself worked),
		// then awaited so the check doesn't just sample the DOM before Svelte's flush.
		await expect.element(page.getByLabelText('Name')).toBeInTheDocument();
		// page.form still carries the old failure, but reopening re-snapshots it as "already
		// seen", so it shouldn't render again as this fresh attempt's own outcome.
		await expect.element(page.getByRole('alert')).not.toBeInTheDocument();
	});

	it('ignores a save result for a different office', async () => {
		render(OfficeRow, { office });
		await page.getByRole('button', { name: 'Rename' }).click();

		setPageForm({ form: 'officeUpdate', id: office.id + 1, success: true });
		// Awaited, not a synchronous `.elements()` check: the effect that would close the form
		// on a scoping regression runs on Svelte's next flush, not synchronously with the state
		// write above, so an unawaited check here would pass even if the id scoping were broken.
		await expect.element(page.getByLabelText('Name')).toBeInTheDocument();
	});
});
