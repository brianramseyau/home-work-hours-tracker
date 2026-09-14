import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';

const data = {
	today: '2026-09-14',
	settings: {
		fullName: null,
		holidayRegion: 'AU-VIC',
		standardStart: '09:00',
		standardEnd: '17:06',
		standardBreakMinutes: 30,
		includeWeekends: false
	},
	offices: [
		{ id: 1, name: 'Office Location 1', address: null, archivedAt: null },
		{ id: 2, name: 'Office Location 2', address: null, archivedAt: '2027-01-01' }
	],
	schedules: [],
	holidayFy: { startYear: 2026, label: 'FY27' },
	holidays: []
};

describe('settings page', () => {
	it('shows the General tab by default', async () => {
		render(Page, { data } as unknown as Parameters<typeof render<typeof Page>>[1]);
		await expect.element(page.getByPlaceholder('John Doe')).toBeInTheDocument();
	});

	it('only offers active offices to the schedule editor, not archived ones', async () => {
		render(Page, { data } as unknown as Parameters<typeof render<typeof Page>>[1]);
		await page.getByRole('tab', { name: 'Schedule' }).click();
		await page.getByRole('radio', { name: 'Mon office' }).click();
		await expect
			.element(page.getByRole('radio', { name: 'Office Location 1' }))
			.toBeInTheDocument();
		expect(page.getByRole('radio', { name: 'Office Location 2' }).elements()).toHaveLength(0);
	});

	it('links to the historical import flow', async () => {
		render(Page, { data } as unknown as Parameters<typeof render<typeof Page>>[1]);
		await expect
			.element(page.getByRole('link', { name: 'Import a spreadsheet' }))
			.toHaveAttribute('href', '/import');
	});
});
