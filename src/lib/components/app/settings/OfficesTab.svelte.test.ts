import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import OfficesTab from './OfficesTab.svelte';

describe('OfficesTab', () => {
	it('invites adding the first office when there are none', async () => {
		render(OfficesTab, { offices: [] });
		await expect
			.element(page.getByText("Add the places you work from when you're not at home."))
			.toBeInTheDocument();
	});

	it('lists existing offices', async () => {
		render(OfficesTab, {
			offices: [
				{ id: 1, name: 'Office Location 1', address: null, archivedAt: null },
				{ id: 2, name: 'Office Location 2', address: null, archivedAt: null }
			]
		});
		await expect.element(page.getByText('Office Location 1')).toBeInTheDocument();
		await expect.element(page.getByText('Office Location 2')).toBeInTheDocument();
	});

	it('has an add-office form', async () => {
		render(OfficesTab, { offices: [] });
		await expect.element(page.getByLabelText('Name')).toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: 'Add office' }))
			.toHaveAttribute('type', 'submit');
	});
});
