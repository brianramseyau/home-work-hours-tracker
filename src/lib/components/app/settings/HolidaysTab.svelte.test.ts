import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/state', () => import('$lib/test-utils/pageFormStub.svelte'));

import { resetPageForm, setPageForm } from '$lib/test-utils/pageFormStub.svelte';
import { render } from 'vitest-browser-svelte';
import HolidaysTab from './HolidaysTab.svelte';

const fy = { startYear: 2026, label: 'FY27' };

beforeEach(() => {
	resetPageForm();
});

describe('HolidaysTab', () => {
	it('shows an empty state when there are no holidays for the FY', async () => {
		render(HolidaysTab, { holidays: [], fy });
		await expect.element(page.getByText('No holidays recorded for FY27.')).toBeInTheDocument();
	});

	it('lists holidays for the FY', async () => {
		render(HolidaysTab, {
			holidays: [
				{
					id: 1,
					name: 'Melbourne Cup',
					source: 'bundled',
					disabled: false,
					displayDate: '2026-11-03'
				}
			],
			fy
		});
		await expect.element(page.getByText('Melbourne Cup')).toBeInTheDocument();
	});

	it('links the previous and next FY navigation to the right slugs', async () => {
		render(HolidaysTab, { holidays: [], fy });
		await expect
			.element(page.getByRole('link', { name: 'Show FY26' }))
			.toHaveAttribute('href', '?fy=fy26');
		await expect
			.element(page.getByRole('link', { name: 'Show FY28' }))
			.toHaveAttribute('href', '?fy=fy28');
	});

	it('has an add-holiday form', async () => {
		render(HolidaysTab, { holidays: [], fy });
		await expect.element(page.getByLabelText('Date')).toBeInTheDocument();
		await expect.element(page.getByLabelText('Name')).toBeInTheDocument();
		await expect.element(page.getByLabelText('Repeats every year')).toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: 'Add holiday' }))
			.toHaveAttribute('type', 'submit');
	});

	it('shows a field error message after a failed add', async () => {
		setPageForm({
			form: 'holidayCreate',
			errors: { name: ['This holiday is already recorded on this date.'] }
		});
		render(HolidaysTab, { holidays: [], fy });
		await expect
			.element(page.getByRole('alert'))
			.toHaveTextContent('This holiday is already recorded on this date.');
	});
});
