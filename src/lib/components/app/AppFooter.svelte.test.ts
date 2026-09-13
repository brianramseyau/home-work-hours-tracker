import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { REPO_URL } from '$lib/branding';
import AppFooter from './AppFooter.svelte';

describe('AppFooter', () => {
	it('shows the version and links to the repository', async () => {
		render(AppFooter, { version: '1.2.3' });
		await expect.element(page.getByText('Home Work Hours Tracker 1.2.3')).toBeInTheDocument();
		await expect
			.element(page.getByRole('link', { name: 'Source code on GitHub' }))
			.toHaveAttribute('href', REPO_URL);
	});
});
