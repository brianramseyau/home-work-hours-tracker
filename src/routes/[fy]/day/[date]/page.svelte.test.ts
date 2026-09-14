import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';

vi.mock('$app/state', () => import('$lib/test-utils/pageFormStub.svelte'));

import { render } from 'vitest-browser-svelte';
import { fySummary } from '$lib/core/fy';
import Page from './+page.svelte';

function baseData(overrides: Partial<Record<string, unknown>> = {}) {
	return {
		fy: fySummary(2026),
		year: { startYear: 2026, rateCentsPerHour: 70, rateNote: null, finalisedAt: null },
		settings: { standardStart: '09:00', standardEnd: '17:06', standardBreakMinutes: 30 },
		offices: [{ id: 1, name: 'Office Location 1', archivedAt: null }],
		day: {
			date: '2026-09-16',
			officeId: null,
			notes: null,
			blocks: [],
			displayType: 'off' as const
		},
		...overrides
	};
}

describe('day deep-link page', () => {
	it('shows the date, a back link, and the day editor', async () => {
		render(Page, { data: baseData() } as unknown as Parameters<typeof render<typeof Page>>[1]);

		await expect
			.element(page.getByRole('heading', { name: 'Wed 16 Sep 2026' }))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('link', { name: /Back to FY27/ }))
			.toHaveAttribute('href', '/fy27');
		await expect.element(page.getByRole('button', { name: 'Save day' })).toBeInTheDocument();
	});

	it('disables editing once the year is finalised', async () => {
		render(Page, {
			data: baseData({
				year: { startYear: 2026, rateCentsPerHour: 70, rateNote: null, finalisedAt: '2026-09-14' }
			})
		} as unknown as Parameters<typeof render<typeof Page>>[1]);

		await expect.element(page.getByRole('button', { name: 'Save day' })).toBeDisabled();
	});

	it('filters out archived offices from the picker', async () => {
		render(Page, {
			data: baseData({
				offices: [
					{ id: 1, name: 'Office Location 1', archivedAt: null },
					{ id: 2, name: 'Office Location 2', archivedAt: '2026-01-01' }
				],
				day: {
					date: '2026-09-16',
					officeId: 1,
					notes: null,
					blocks: [],
					displayType: 'office' as const
				}
			})
		} as unknown as Parameters<typeof render<typeof Page>>[1]);

		await expect
			.element(page.getByRole('radio', { name: 'Office Location 1' }))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('radio', { name: 'Office Location 2' }))
			.not.toBeInTheDocument();
	});
});
