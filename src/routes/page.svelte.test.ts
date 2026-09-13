import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { fySummary } from '$lib/core/fy';
import Page from './+page.svelte';

describe('home page', () => {
	it('invites setting up the current year', async () => {
		render(Page, {
			data: { today: '2026-09-14', currentFy: fySummary(2026) }
		} as unknown as Parameters<typeof render<typeof Page>>[1]);

		await expect
			.element(page.getByRole('heading', { level: 1 }))
			.toHaveTextContent('Your hours at home, kept for tax time');
		await expect
			.element(page.getByRole('link', { name: 'Set up FY27' }))
			.toHaveAttribute('href', '/years');
	});
});
