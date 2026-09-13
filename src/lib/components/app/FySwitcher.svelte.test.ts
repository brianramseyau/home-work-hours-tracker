import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { fySummary } from '$lib/core/fy';
import FySwitcher from './FySwitcher.svelte';

const fy = fySummary(2026);

describe('FySwitcher', () => {
	it('shows the year and its date range', async () => {
		render(FySwitcher, { fy });
		const link = page.getByRole('link', { name: /FY27/ });
		await expect.element(link).toHaveAttribute('href', '/years');
		await expect.element(link).toHaveTextContent('Jul 2026 – Jun 2027');
	});

	it('has a compact form with a full accessible name', async () => {
		render(FySwitcher, { fy, compact: true });
		await expect
			.element(page.getByRole('link', { name: 'FY27, Jul 2026 – Jun 2027. Manage years' }))
			.toHaveAttribute('href', '/years');
	});
});
