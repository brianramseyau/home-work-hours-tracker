import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import HolidayRow from './HolidayRow.svelte';

const holiday = {
	id: 1,
	name: 'Melbourne Cup',
	source: 'bundled' as const,
	disabled: false,
	displayDate: '2026-11-03'
};

describe('HolidayRow', () => {
	it('shows the formatted date, name and a Bundled badge', async () => {
		render(HolidayRow, { holiday });
		await expect.element(page.getByText('3 Nov 2026')).toBeInTheDocument();
		await expect.element(page.getByText('Melbourne Cup')).toBeInTheDocument();
		await expect.element(page.getByText('Bundled')).toBeInTheDocument();
	});

	it('shows a Custom badge and a Delete action for a custom holiday', async () => {
		render(HolidayRow, { holiday: { ...holiday, source: 'custom' } });
		await expect.element(page.getByText('Custom')).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
	});

	it('has no Delete action for a bundled holiday', async () => {
		render(HolidayRow, { holiday });
		expect(page.getByRole('button', { name: 'Delete' }).elements()).toHaveLength(0);
	});

	it('offers to disable an enabled holiday, and re-enable a disabled one', async () => {
		const { rerender } = render(HolidayRow, { holiday });
		await expect.element(page.getByRole('button', { name: 'Disable' })).toBeInTheDocument();

		await rerender({ holiday: { ...holiday, disabled: true } });
		await expect.element(page.getByRole('button', { name: 'Enable' })).toBeInTheDocument();
	});

	it('shows a disabled holiday with strikethrough styling', async () => {
		render(HolidayRow, { holiday: { ...holiday, disabled: true } });
		const name = page.getByText('Melbourne Cup');
		await expect.element(name).toHaveClass(/line-through/);
	});
});
