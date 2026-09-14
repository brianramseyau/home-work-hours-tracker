import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/state', () => import('$lib/test-utils/pageFormStub.svelte'));

import { render } from 'vitest-browser-svelte';
import { resetPageForm, setPageForm } from '$lib/test-utils/pageFormStub.svelte';
import DayEditor from './DayEditor.svelte';

const STANDARD = { start: '09:00', end: '17:06', breakMinutes: 30 };
const offices = [
	{ id: 1, name: 'Office Location 1' },
	{ id: 2, name: 'Office Location 2' }
];

const homeDay = {
	date: '2026-09-16',
	displayType: 'home' as const,
	officeId: null,
	notes: null,
	blocks: [STANDARD]
};

beforeEach(() => {
	resetPageForm();
});

describe('DayEditor', () => {
	it('shows the time blocks for a home day, with the current type selected', async () => {
		render(DayEditor, { day: homeDay, offices, standard: STANDARD, finalised: false });

		await expect
			.element(page.getByRole('radio', { name: 'Home' }))
			.toHaveAttribute('data-state', 'on');
		await expect.element(page.getByLabelText('Start')).toHaveValue('09:00');
		await expect.element(page.getByLabelText('End')).toHaveValue('17:06');
		await expect
			.element(page.getByRole('radio', { name: 'Office Location 1' }))
			.not.toBeInTheDocument();
	});

	it('switching to Office hides the blocks and reveals the office picker, defaulted to the first', async () => {
		render(DayEditor, { day: homeDay, offices, standard: STANDARD, finalised: false });

		await page.getByRole('radio', { name: 'Office', exact: true }).click();
		await expect
			.element(page.getByRole('radio', { name: 'Office Location 1' }))
			.toHaveAttribute('data-state', 'on');
		await expect.element(page.getByLabelText('Start')).not.toBeInTheDocument();
	});

	it('switching to Split shows both the blocks and the office picker', async () => {
		render(DayEditor, {
			day: { ...homeDay, displayType: 'off', blocks: [] },
			offices,
			standard: STANDARD,
			finalised: false
		});

		await page.getByRole('radio', { name: 'Split' }).click();
		await expect.element(page.getByLabelText('Start')).toBeInTheDocument();
		await expect
			.element(page.getByRole('radio', { name: 'Office Location 1' }))
			.toHaveAttribute('data-state', 'on');
	});

	it('adds and removes a time block', async () => {
		render(DayEditor, { day: homeDay, offices, standard: STANDARD, finalised: false });

		expect(page.getByRole('button', { name: 'Remove' }).elements()).toHaveLength(0);
		await page.getByRole('button', { name: 'Add block' }).click();
		expect(page.getByLabelText('Start').elements()).toHaveLength(2);
		expect(page.getByRole('button', { name: 'Remove' }).elements()).toHaveLength(2);

		await page.getByRole('button', { name: 'Remove' }).first().click();
		expect(page.getByRole('button', { name: 'Remove' }).elements()).toHaveLength(0);
	});

	it('lets the time block fields and notes be edited', async () => {
		render(DayEditor, { day: homeDay, offices, standard: STANDARD, finalised: false });

		await page.getByLabelText('Start').fill('08:30');
		await page.getByLabelText('End').fill('16:30');
		await page.getByLabelText('Break (min)').fill('15');
		await page.getByLabelText('Notes').fill('Worked through lunch');

		const blocksField = document.querySelector('input[name="blocks"]') as HTMLInputElement;
		expect(JSON.parse(blocksField.value)).toEqual([
			{ start: '08:30', end: '16:30', breakMinutes: 15 }
		]);
		await expect.element(page.getByLabelText('Notes')).toHaveValue('Worked through lunch');
	});

	it('disables the Office and Split toggles when there are no offices', async () => {
		render(DayEditor, { day: homeDay, offices: [], standard: STANDARD, finalised: false });

		await expect.element(page.getByRole('radio', { name: 'Office', exact: true })).toBeDisabled();
		await expect.element(page.getByRole('radio', { name: 'Split' })).toBeDisabled();
	});

	it('disables every field once the year is finalised', async () => {
		render(DayEditor, { day: homeDay, offices, standard: STANDARD, finalised: true });

		await expect.element(page.getByRole('button', { name: 'Save day' })).toBeDisabled();
		await expect.element(page.getByLabelText('Start')).toBeDisabled();
		await expect
			.element(page.getByText('This financial year is finalised.', { exact: false }))
			.toBeInTheDocument();
	});

	it('shows this day’s own validation error', async () => {
		render(DayEditor, { day: homeDay, offices, standard: STANDARD, finalised: false });
		setPageForm({
			form: 'day',
			date: '2026-09-16',
			success: false,
			errors: { blocks: ['Bad block'] }
		});

		await expect.element(page.getByRole('alert')).toHaveTextContent('Bad block');
	});

	it('ignores a result for a different date', async () => {
		render(DayEditor, { day: homeDay, offices, standard: STANDARD, finalised: false });
		setPageForm({
			form: 'day',
			date: '2026-09-17',
			success: false,
			errors: { blocks: ['Bad block'] }
		});

		await expect.element(page.getByRole('button', { name: 'Save day' })).toBeInTheDocument();
		await expect.element(page.getByRole('alert')).not.toBeInTheDocument();
	});

	it('calls onSaved once this day saves successfully', async () => {
		let saved = 0;
		render(DayEditor, {
			day: homeDay,
			offices,
			standard: STANDARD,
			finalised: false,
			onSaved: () => saved++
		});

		setPageForm({ form: 'day', date: '2026-09-16', success: true });
		await expect.poll(() => saved).toBe(1);
	});

	it('keeps the selected office when its own radio is clicked again (a bits-ui deselect)', async () => {
		render(DayEditor, { day: homeDay, offices, standard: STANDARD, finalised: false });

		await page.getByRole('radio', { name: 'Office', exact: true }).click();
		await page.getByRole('radio', { name: 'Office Location 1' }).click();

		const officeIdField = document.querySelector('input[name="officeId"]') as HTMLInputElement;
		expect(officeIdField.value).toBe('1');
	});

	it('lets a different office be chosen once one is already selected', async () => {
		render(DayEditor, { day: homeDay, offices, standard: STANDARD, finalised: false });

		await page.getByRole('radio', { name: 'Office', exact: true }).click();
		await page.getByRole('radio', { name: 'Office Location 2' }).click();

		const officeIdField = document.querySelector('input[name="officeId"]') as HTMLInputElement;
		expect(officeIdField.value).toBe('2');
	});

	it('keeps the office already chosen when switching from Office to Split', async () => {
		render(DayEditor, { day: homeDay, offices, standard: STANDARD, finalised: false });

		await page.getByRole('radio', { name: 'Office', exact: true }).click();
		await page.getByRole('radio', { name: 'Office Location 2' }).click();
		await page.getByRole('radio', { name: 'Split' }).click();

		const officeIdField = document.querySelector('input[name="officeId"]') as HTMLInputElement;
		expect(officeIdField.value).toBe('2');
	});

	it('ignores the kind toggle deselecting down to no value', async () => {
		render(DayEditor, { day: homeDay, offices, standard: STANDARD, finalised: false });

		await page.getByRole('radio', { name: 'Home' }).click(); // already active — a bits-ui deselect
		await expect.element(page.getByLabelText('Start')).toBeInTheDocument(); // still a Home day
	});

	it('prevents the browser default on a form reset, so a save does not blank the draft', () => {
		render(DayEditor, { day: homeDay, offices, standard: STANDARD, finalised: false });

		const form = document.querySelector('form[action="?/saveDay"]') as HTMLFormElement;
		const event = new Event('reset', { cancelable: true });
		form.dispatchEvent(event);
		expect(event.defaultPrevented).toBe(true);
	});

	it('re-syncs its fields when the day prop itself changes (e.g. Reset to schedule reloading it)', async () => {
		const { rerender } = render(DayEditor, {
			day: homeDay,
			offices,
			standard: STANDARD,
			finalised: false
		});

		await page.getByLabelText('Notes').fill('Draft note, about to be discarded');

		await rerender({
			day: { ...homeDay, displayType: 'office', officeId: 2, notes: null, blocks: [] },
			offices,
			standard: STANDARD,
			finalised: false
		});

		await expect
			.element(page.getByRole('radio', { name: 'Office', exact: true }))
			.toHaveAttribute('data-state', 'on');
		await expect
			.element(page.getByRole('radio', { name: 'Office Location 2' }))
			.toHaveAttribute('data-state', 'on');
		await expect.element(page.getByLabelText('Notes')).toHaveValue('');
	});

	it('re-syncs its blocks too, when the day prop changes to a different home day', async () => {
		const { rerender } = render(DayEditor, {
			day: { ...homeDay, displayType: 'office', officeId: 1, blocks: [] },
			offices,
			standard: STANDARD,
			finalised: false
		});

		await rerender({
			day: {
				...homeDay,
				displayType: 'home',
				officeId: null,
				blocks: [{ start: '08:00', end: '16:00', breakMinutes: 15 }]
			},
			offices,
			standard: STANDARD,
			finalised: false
		});

		await expect.element(page.getByLabelText('Start')).toHaveValue('08:00');
		await expect.element(page.getByLabelText('End')).toHaveValue('16:00');
	});

	it('keeps an in-progress draft when the day prop reference changes but its values do not', async () => {
		const { rerender } = render(DayEditor, {
			day: homeDay,
			offices,
			standard: STANDARD,
			finalised: false
		});

		await page.getByLabelText('Notes').fill('Draft note, not yet saved');

		// A new object with the exact same field values, as `use:enhance`'s default reload
		// produces on every invalidation, including ones unrelated to this date.
		await rerender({
			day: { ...homeDay },
			offices,
			standard: STANDARD,
			finalised: false
		});

		await expect.element(page.getByLabelText('Notes')).toHaveValue('Draft note, not yet saved');
	});

	it('does not re-fire onSaved for a result that was already there when it opened', async () => {
		setPageForm({ form: 'day', date: '2026-09-16', success: true });
		let saved = 0;
		render(DayEditor, {
			day: homeDay,
			offices,
			standard: STANDARD,
			finalised: false,
			onSaved: () => saved++
		});

		await expect.element(page.getByRole('button', { name: 'Save day' })).toBeInTheDocument();
		expect(saved).toBe(0);
	});
});
