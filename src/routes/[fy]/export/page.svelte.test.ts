import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { fySummary } from '$lib/core/fy';
import Page from './+page.svelte';

function baseData(overrides: Partial<Record<string, unknown>> = {}) {
	return {
		fy: fySummary(2026),
		summary: {
			homeMinutes: 456,
			byMonth: [{ month: '2026-07', minutes: 456 }],
			byWeek: [],
			kindCounts: {}
		},
		claimCents: 532,
		rateCentsPerHour: 70,
		fullName: 'John Doe',
		finalised: false,
		...overrides
	};
}

describe('Export page', () => {
	it('shows the FY heading, summary and a download link', async () => {
		render(Page, { data: baseData() } as unknown as Parameters<typeof render<typeof Page>>[1]);

		await expect.element(page.getByRole('heading', { name: 'FY27 export' })).toBeInTheDocument();
		await expect.element(page.getByText('7.6 h at home')).toBeInTheDocument();
		const link = page.getByRole('link', { name: 'Download spreadsheet' });
		await expect.element(link).toBeInTheDocument();
		await expect.element(link).toHaveAttribute('href', '/fy27/export/download');
	});

	it('warns when the name is not set', async () => {
		render(Page, {
			data: baseData({ fullName: null })
		} as unknown as Parameters<typeof render<typeof Page>>[1]);

		await expect.element(page.getByText(/Your name isn't set/)).toBeInTheDocument();
	});

	it('does not warn about the name once it is set', async () => {
		render(Page, { data: baseData() } as unknown as Parameters<typeof render<typeof Page>>[1]);
		expect(page.getByText(/Your name isn't set/).elements()).toHaveLength(0);
	});

	it('warns when the year is not finalised', async () => {
		render(Page, { data: baseData() } as unknown as Parameters<typeof render<typeof Page>>[1]);
		await expect.element(page.getByText(/isn't finalised yet/)).toBeInTheDocument();
	});

	it('does not warn once the year is finalised', async () => {
		render(Page, {
			data: baseData({ finalised: true })
		} as unknown as Parameters<typeof render<typeof Page>>[1]);
		expect(page.getByText(/isn't finalised yet/).elements()).toHaveLength(0);
	});
});
