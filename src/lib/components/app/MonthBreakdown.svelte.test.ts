import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import MonthBreakdown from './MonthBreakdown.svelte';

describe('MonthBreakdown', () => {
	it('lists all 12 months of the financial year, even ones with no hours', async () => {
		render(MonthBreakdown, {
			startYear: 2026,
			byMonth: [{ month: '2026-07', minutes: 456 }],
			rateCentsPerHour: 70
		});

		await expect.element(page.getByRole('rowheader', { name: 'Jul 2026' })).toBeInTheDocument();
		await expect.element(page.getByRole('rowheader', { name: 'Jun 2027' })).toBeInTheDocument();
		await expect.element(page.getByText('7.6 h')).toBeInTheDocument();
		await expect.element(page.getByText('$5.32')).toBeInTheDocument();
		expect(page.getByText('0.0 h').elements().length).toBe(11); // every other month
	});

	it('shows a placeholder claim when the year has no rate yet', async () => {
		render(MonthBreakdown, {
			startYear: 2026,
			byMonth: [{ month: '2026-07', minutes: 456 }],
			rateCentsPerHour: null
		});

		expect(page.getByText('—').elements().length).toBeGreaterThan(0);
	});
});
