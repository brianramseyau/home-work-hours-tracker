import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/state', () => import('$lib/test-utils/pageFormStub.svelte'));

import { resetPageForm, setPageForm } from '$lib/test-utils/pageFormStub.svelte';
import { render } from 'vitest-browser-svelte';
import GeneralTab from './GeneralTab.svelte';

beforeEach(() => {
	resetPageForm();
});

const settings = {
	fullName: null as string | null,
	holidayRegion: 'AU-VIC',
	standardStart: '09:00',
	standardEnd: '17:06',
	standardBreakMinutes: 30,
	includeWeekends: false
};

describe('GeneralTab', () => {
	it('shows the standard-hours preview for the loaded settings', async () => {
		render(GeneralTab, { settings });
		await expect.element(page.getByText('= 7.6 h per day')).toBeInTheDocument();
	});

	it('pre-fills the name and region from settings', async () => {
		render(GeneralTab, { settings: { ...settings, fullName: 'John Doe' } });
		await expect.element(page.getByLabelText('Name')).toHaveValue('John Doe');
		await expect.element(page.getByLabelText('Holiday region')).toHaveValue('AU-VIC');
	});

	it('updates the preview as the break changes', async () => {
		render(GeneralTab, { settings });
		const breakInput = page.getByLabelText('Break (min)');
		await breakInput.fill('90');
		await expect.element(page.getByText('= 6.6 h per day')).toBeInTheDocument();
	});

	it('lets the region be changed', async () => {
		render(GeneralTab, { settings });
		const regionSelect = page.getByLabelText('Holiday region');
		await regionSelect.selectOptions('AU-NSW');
		await expect.element(regionSelect).toHaveValue('AU-NSW');
	});

	it('updates the preview as the end time changes', async () => {
		render(GeneralTab, { settings });
		const endInput = page.getByLabelText('End', { exact: true });
		await endInput.fill('16:00');
		await expect.element(page.getByText('= 6.5 h per day')).toBeInTheDocument();
	});

	it('does not clear the standard-hours fields if the browser resets the form', async () => {
		// SvelteKit's default use:enhance behaviour calls form.reset() after a successful
		// submit; without the guard this would blank a bound time/number input rather than
		// leave the just-saved value showing.
		render(GeneralTab, { settings });
		const form = document.querySelector('form') as HTMLFormElement;
		form.dispatchEvent(new Event('reset', { cancelable: true }));
		await expect.element(page.getByLabelText('Start')).toHaveValue('09:00');
	});

	it('lets the include-weekends switch be toggled on', async () => {
		render(GeneralTab, { settings });
		const weekendsSwitch = page.getByRole('switch', { name: 'Include weekends' });
		await expect.element(weekendsSwitch).toHaveAttribute('aria-checked', 'false');
		await weekendsSwitch.click();
		await expect.element(weekendsSwitch).toHaveAttribute('aria-checked', 'true');
	});

	it('shows guidance instead of a preview once the start time is cleared', async () => {
		render(GeneralTab, { settings });
		const startInput = page.getByLabelText('Start');
		await startInput.element().focus();
		await startInput.fill('');
		await expect
			.element(page.getByText('Enter a valid start, end and break to see the daily total.'))
			.toBeInTheDocument();
	});

	it('shows guidance instead of a preview when the break makes the block invalid', async () => {
		render(GeneralTab, { settings });
		const breakInput = page.getByLabelText('Break (min)');
		await breakInput.fill('600');
		await expect
			.element(page.getByText('Enter a valid start, end and break to see the daily total.'))
			.toBeInTheDocument();
	});

	it('shows guidance instead of a preview when the break is cleared', async () => {
		// An empty number input binds to null, not 0 — a cleared break must not compute as a
		// valid (zero-minute) block.
		render(GeneralTab, { settings });
		const breakInput = page.getByLabelText('Break (min)');
		await breakInput.fill('');
		await expect
			.element(page.getByText('Enter a valid start, end and break to see the daily total.'))
			.toBeInTheDocument();
	});

	it('shows a field error message after a failed save', async () => {
		setPageForm({
			form: 'general',
			errors: { standardStart: ['Expected a time in HH:mm format'] }
		});
		render(GeneralTab, { settings });
		await expect
			.element(page.getByRole('alert'))
			.toHaveTextContent('Expected a time in HH:mm format');
	});

	it('does not show an error left over from a different form', async () => {
		setPageForm({ form: 'officeCreate', errors: { name: ['Name the office'] } });
		render(GeneralTab, { settings });
		expect(page.getByRole('alert').elements()).toHaveLength(0);
	});
});
