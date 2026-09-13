import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/state', () => import('$lib/test-utils/pageFormStub.svelte'));

import { resetPageForm, setPageForm } from '$lib/test-utils/pageFormStub.svelte';
import { render } from 'vitest-browser-svelte';
import OfficesTab from './OfficesTab.svelte';

beforeEach(() => {
	resetPageForm();
});

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

	it('shows a field error message after a failed add', async () => {
		setPageForm({ form: 'officeCreate', errors: { name: ['An office already has this name.'] } });
		render(OfficesTab, { offices: [] });
		await expect
			.element(page.getByRole('alert'))
			.toHaveTextContent('An office already has this name.');
	});
});
