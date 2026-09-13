import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import OfficeRow from './OfficeRow.svelte';

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

	it('closes the rename form as soon as Save office is clicked', async () => {
		render(OfficeRow, { office });
		await page.getByRole('button', { name: 'Rename' }).click();
		await page.getByRole('button', { name: 'Save office' }).click();
		expect(page.getByLabelText('Name').elements()).toHaveLength(0);
	});
});
