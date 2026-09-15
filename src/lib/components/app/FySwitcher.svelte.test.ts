import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { fySummary } from '$lib/core/fy';
import FySwitcher from './FySwitcher.svelte';

const fy = fySummary(2026);
const years = [fySummary(2026), fySummary(2025)];

describe('FySwitcher', () => {
	it('shows the viewed year and its date range on the trigger', async () => {
		render(FySwitcher, { fy, years });
		const trigger = page.getByRole('button', { name: /FY27/ });
		await expect.element(trigger).toHaveTextContent('Jul 2026 – Jun 2027');
	});

	it('has a compact form with a full accessible name', async () => {
		render(FySwitcher, { fy, years, compact: true });
		await expect
			.element(
				page.getByRole('button', { name: 'FY27, Jul 2026 – Jun 2027. Switch financial year' })
			)
			.toBeInTheDocument();
	});

	it('opens a pop-out listing years newest first, linking each to its diary', async () => {
		render(FySwitcher, { fy, years });
		await page.getByRole('button', { name: /FY27/ }).click();

		const items = page.getByRole('listitem').elements();
		expect(items).toHaveLength(2);
		await expect.element(page.getByRole('link', { name: /FY27/ })).toHaveAttribute('href', '/fy27');
		await expect.element(page.getByRole('link', { name: /FY26/ })).toHaveAttribute('href', '/fy26');
	});

	it('marks the year being viewed as the current one', async () => {
		render(FySwitcher, { fy, years });
		await page.getByRole('button', { name: /FY27/ }).click();
		await expect
			.element(page.getByRole('link', { name: /FY27/ }))
			.toHaveAttribute('aria-current', 'page');
	});

	it('links the cog to the years CRUD page', async () => {
		render(FySwitcher, { fy, years });
		await page.getByRole('button', { name: /FY27/ }).click();
		await expect
			.element(page.getByRole('link', { name: 'Manage financial years' }))
			.toHaveAttribute('href', '/years');
	});

	it('says so when there are no years yet', async () => {
		render(FySwitcher, { fy, years: [] });
		await page.getByRole('button', { name: /FY27/ }).click();
		await expect.element(page.getByText('No financial years yet.')).toBeInTheDocument();
	});

	it('closes the pop-out once a year is picked', async () => {
		render(FySwitcher, { fy, years });
		await page.getByRole('button', { name: /FY27/ }).click();

		// Click the link without letting it actually navigate, so the pop-out's own close handler
		// is what removes the list.
		const link = document.querySelector('a[href="/fy26"]') as HTMLAnchorElement;
		link.addEventListener('click', (event) => event.preventDefault());
		link.click();

		await expect.element(page.getByText('Financial years')).not.toBeInTheDocument();
	});

	it('closes the pop-out when the cog is used', async () => {
		render(FySwitcher, { fy, years });
		await page.getByRole('button', { name: /FY27/ }).click();

		const cog = document.querySelector('a[href="/years"]') as HTMLAnchorElement;
		cog.addEventListener('click', (event) => event.preventDefault());
		cog.click();

		await expect.element(page.getByText('Financial years')).not.toBeInTheDocument();
	});
});
