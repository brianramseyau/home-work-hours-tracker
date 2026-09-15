import { page } from 'vitest/browser';
import { createRawSnippet } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page as appStatePage } from '$app/state';
import { fySummary } from '$lib/core/fy';
import Layout from './+layout.svelte';

vi.mock('$app/state', () => ({
	page: { url: new URL('http://localhost/fy27/export') }
}));

const children = createRawSnippet(() => ({ render: () => '<p>Page body</p>' }));
const data = {
	today: '2026-09-14',
	currentFy: fySummary(2026),
	years: [fySummary(2026)],
	filled: 0
};

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

	it('opens the year switcher from both the rail and the mobile header', async () => {
		render(Layout, { data, children } as unknown as Parameters<typeof render<typeof Layout>>[1]);

		const triggers = Array.from(document.querySelectorAll('[data-slot="popover-trigger"]'));
		expect(triggers).toHaveLength(2);
		triggers.forEach((trigger) => (trigger as HTMLElement).click());

		await expect.element(page.getByRole('link', { name: /FY27/ }).first()).toBeInTheDocument();
	});

	it('shows the current open period when the route is not a financial year', async () => {
		appStatePage.url = new URL('http://localhost/years') as typeof appStatePage.url;
		render(Layout, {
			data: { ...data, currentFy: fySummary(2025) },
			children
		} as unknown as Parameters<typeof render<typeof Layout>>[1]);

		await expect.element(page.getByRole('button', { name: /FY26/ }).first()).toBeInTheDocument();
		appStatePage.url = new URL('http://localhost/fy27/export') as typeof appStatePage.url;
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

	describe('the post-import toast', () => {
		afterEach(() => {
			appStatePage.url = new URL('http://localhost/fy27/export') as typeof appStatePage.url;
		});

		it('toasts the imported count and strips the query param from the address bar', async () => {
			appStatePage.url = new URL('http://localhost/fy27?imported=3') as typeof appStatePage.url;
			const replaceStateSpy = vi.spyOn(history, 'replaceState');

			render(Layout, { data, children } as unknown as Parameters<typeof render<typeof Layout>>[1]);

			await expect.element(page.getByText('Imported 3 days')).toBeInTheDocument();
			expect(replaceStateSpy).toHaveBeenCalled();
			const [, , url] = replaceStateSpy.mock.calls[0];
			expect(String(url)).not.toContain('imported');
			replaceStateSpy.mockRestore();
		});

		it('uses the singular for exactly one imported day', async () => {
			appStatePage.url = new URL('http://localhost/fy27?imported=1') as typeof appStatePage.url;
			render(Layout, { data, children } as unknown as Parameters<typeof render<typeof Layout>>[1]);
			await expect.element(page.getByText('Imported 1 day')).toBeInTheDocument();
		});

		it('does not toast for a non-integer imported value (a hand-edited URL)', async () => {
			appStatePage.url = new URL('http://localhost/fy27?imported=1.5') as typeof appStatePage.url;
			render(Layout, { data, children } as unknown as Parameters<typeof render<typeof Layout>>[1]);
			await expect.element(page.getByRole('main')).toBeInTheDocument();
			await expect.element(page.getByText(/Imported/)).not.toBeInTheDocument();
		});

		it('does not toast when imported=0', async () => {
			appStatePage.url = new URL('http://localhost/fy27?imported=0') as typeof appStatePage.url;
			render(Layout, { data, children } as unknown as Parameters<typeof render<typeof Layout>>[1]);
			await expect.element(page.getByRole('main')).toBeInTheDocument();
			await expect.element(page.getByText(/Imported/)).not.toBeInTheDocument();
		});

		it('does nothing when there is no imported param at all', async () => {
			render(Layout, { data, children } as unknown as Parameters<typeof render<typeof Layout>>[1]);
			await expect.element(page.getByRole('main')).toBeInTheDocument();
			await expect.element(page.getByText(/Imported/)).not.toBeInTheDocument();
		});
	});
});
