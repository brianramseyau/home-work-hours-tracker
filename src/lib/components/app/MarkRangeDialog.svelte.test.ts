import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/state', () => import('$lib/test-utils/pageFormStub.svelte'));

import { render } from 'vitest-browser-svelte';
import { resetPageForm, setPageForm } from '$lib/test-utils/pageFormStub.svelte';
import MarkRangeDialog from './MarkRangeDialog.svelte';

beforeEach(() => {
	resetPageForm();
});

describe('MarkRangeDialog', () => {
	it('opens with the range defaulted to today and Leave selected', async () => {
		render(MarkRangeDialog, { today: '2026-09-14', finalised: false });

		await page.getByRole('button', { name: 'Mark leave' }).click();
		await expect.element(page.getByLabelText('From')).toHaveValue('2026-09-14');
		await expect.element(page.getByLabelText('To')).toHaveValue('2026-09-14');
		await expect
			.element(page.getByRole('radio', { name: 'Leave' }))
			.toHaveAttribute('data-state', 'on');
	});

	it('lets Sick be chosen instead, and the note and range edited', async () => {
		render(MarkRangeDialog, { today: '2026-09-14', finalised: false });

		await page.getByRole('button', { name: 'Mark leave' }).click();
		await page.getByRole('radio', { name: 'Sick' }).click();
		await page.getByLabelText('From').fill('2026-09-15');
		await page.getByLabelText('To').fill('2026-09-18');
		await page.getByLabelText('Note (optional)').fill('Flu');

		const kindField = document.querySelector('input[name="kind"]') as HTMLInputElement;
		expect(kindField.value).toBe('sick');
		await expect.element(page.getByLabelText('From')).toHaveValue('2026-09-15');
		await expect.element(page.getByLabelText('To')).toHaveValue('2026-09-18');
		await expect.element(page.getByLabelText('Note (optional)')).toHaveValue('Flu');
	});

	it('ignores the kind toggle deselecting down to no value', async () => {
		render(MarkRangeDialog, { today: '2026-09-14', finalised: false });
		await page.getByRole('button', { name: 'Mark leave' }).click();

		await page.getByRole('radio', { name: 'Leave' }).click(); // already active — a bits-ui deselect
		const kindField = document.querySelector('input[name="kind"]') as HTMLInputElement;
		expect(kindField.value).toBe('leave');
	});

	it('closes on cancel', async () => {
		render(MarkRangeDialog, { today: '2026-09-14', finalised: false });

		await page.getByRole('button', { name: 'Mark leave' }).click();
		await page.getByRole('button', { name: 'Cancel' }).click();
		await expect.element(page.getByRole('button', { name: 'Mark days' })).not.toBeInTheDocument();
	});

	it('disables the trigger once the year is finalised', async () => {
		render(MarkRangeDialog, { today: '2026-09-14', finalised: true });
		await expect.element(page.getByRole('button', { name: 'Mark leave' })).toBeDisabled();
	});

	it('shows a validation error from the server', async () => {
		render(MarkRangeDialog, { today: '2026-09-14', finalised: false });
		await page.getByRole('button', { name: 'Mark leave' }).click();
		setPageForm({ form: 'markRange', success: false, errors: { from: ['Bad range'] } });

		await expect.element(page.getByRole('alert')).toHaveTextContent('Bad range');
	});

	it('closes once the range saves successfully', async () => {
		render(MarkRangeDialog, { today: '2026-09-14', finalised: false });
		await page.getByRole('button', { name: 'Mark leave' }).click();
		setPageForm({ form: 'markRange', success: true });

		await expect.element(page.getByRole('button', { name: 'Mark days' })).not.toBeInTheDocument();
	});

	it('prevents the browser default on a form reset', async () => {
		render(MarkRangeDialog, { today: '2026-09-14', finalised: false });
		await page.getByRole('button', { name: 'Mark leave' }).click();

		const form = document.querySelector('form[action="?/markRange"]') as HTMLFormElement;
		const event = new Event('reset', { cancelable: true });
		form.dispatchEvent(event);
		expect(event.defaultPrevented).toBe(true);
	});

	it('does not auto-close for a success result that predates opening', async () => {
		setPageForm({ form: 'markRange', success: true });
		render(MarkRangeDialog, { today: '2026-09-14', finalised: false });

		await page.getByRole('button', { name: 'Mark leave' }).click();
		await expect.element(page.getByRole('button', { name: 'Mark days' })).toBeInTheDocument();
	});
});
