import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import OfflinePage from './+page.svelte';

describe('offline page', () => {
	it('tells the reader they are offline and offers to retry', async () => {
		render(OfflinePage);
		await expect
			.element(page.getByRole('heading', { level: 1 }))
			.toHaveTextContent("You're offline");
		await expect
			.element(page.getByText('Your diary will be here when you reconnect.', { exact: false }))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('link', { name: 'Try again' }))
			.toHaveAttribute('href', '/');
	});
});
