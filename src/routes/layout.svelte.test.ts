import { page } from 'vitest/browser';
import { createRawSnippet } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { fySummary } from '$lib/core/fy';
import Layout from './+layout.svelte';

vi.mock('$app/state', () => ({
	page: { url: new URL('http://localhost/fy27/export') }
}));

const children = createRawSnippet(() => ({ render: () => '<p>Page body</p>' }));
const data = { today: '2026-09-14', currentFy: fySummary(2026) };

describe('root layout', () => {
	it('wraps the page in the app shell', async () => {
		render(Layout, { data, children } as unknown as Parameters<typeof render<typeof Layout>>[1]);

		await expect.element(page.getByText('Page body')).toBeInTheDocument();
		await expect.element(page.getByRole('main')).toBeInTheDocument();
		await expect
			.element(page.getByRole('link', { name: 'Skip to content' }))
			.toHaveAttribute('href', '#main');

		const primary = page.getByRole('navigation', { name: 'Primary' });
		await expect
			.element(primary.getByRole('link', { name: 'Export' }))
			.toHaveAttribute('aria-current', 'page');
		await expect
			.element(page.getByRole('link', { name: 'Source code on GitHub' }))
			.toBeInTheDocument();
	});
});
