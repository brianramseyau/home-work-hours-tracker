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
const data = { today: '2026-09-14', currentFy: fySummary(2026), filled: 0 };

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

	it('does not toast when nothing was filled', async () => {
		render(Layout, { data, children } as unknown as Parameters<typeof render<typeof Layout>>[1]);
		await expect.element(page.getByRole('main')).toBeInTheDocument();
		await expect.element(page.getByText(/Filled \d/)).not.toBeInTheDocument();
	});

	it('shows a quiet toast when auto-prefill filled some days', async () => {
		render(Layout, {
			data: { ...data, filled: 5 },
			children
		} as unknown as Parameters<typeof render<typeof Layout>>[1]);

		await expect.element(page.getByText('Filled 5 days from your schedule')).toBeInTheDocument();
	});

	it('uses the singular when exactly one day was filled', async () => {
		render(Layout, {
			data: { ...data, filled: 1 },
			children
		} as unknown as Parameters<typeof render<typeof Layout>>[1]);

		await expect.element(page.getByText('Filled 1 day from your schedule')).toBeInTheDocument();
	});
});
