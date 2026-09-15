import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// Runs on both the mobile and desktop projects (see playwright.config.ts), with "today"
// pinned to 2026-09-14, so the current financial year is FY27.

for (const colorScheme of ['light', 'dark'] as const) {
	test.describe(`${colorScheme} theme`, () => {
		test.use({ colorScheme });

		test('home page shows the app shell with no accessibility violations', async ({ page }) => {
			await page.goto('/');
			// Once FY27 exists (another spec in this shared-database suite may have created it
			// already), `/` redirects straight to its diary; before that, it's the welcome page
			// inviting you to set one up. Either way the same app shell wraps it.
			await expect(page.getByRole('heading', { level: 1 })).toHaveText(
				/Your hours at home, kept for tax time|FY27 diary/
			);

			const nav = page.getByRole('navigation', { name: 'Primary' });
			for (const label of ['Week', 'Year', 'Export', 'Settings']) {
				await expect(nav.getByRole('link', { name: label })).toBeVisible();
			}
			// The year switcher (not the "Set up FY27" call to action). It's a pop-out trigger
			// now, so it's a button; opening it lists every year and links to the years page.
			const switcher = page.locator('button:visible', { hasText: /^FY27/ }).first();
			await expect(switcher).toBeVisible();
			await switcher.click();
			await expect(page.getByRole('link', { name: 'Manage financial years' })).toBeVisible();

			const results = await new AxeBuilder({ page }).analyze();
			expect(results.violations).toEqual([]);
		});

		test('unknown pages show the branded error page', async ({ page }) => {
			const response = await page.goto('/nowhere');
			expect(response?.status()).toBe(404);
			await expect(page.getByRole('heading', { level: 1 })).toHaveText(
				'This page is off the clock'
			);

			const results = await new AxeBuilder({ page }).analyze();
			expect(results.violations).toEqual([]);
		});
	});
}

test('theme toggle switches between light and dark', async ({ page }) => {
	await page.emulateMedia({ colorScheme: 'light' });
	await page.goto('/');
	const html = page.locator('html');
	await expect(html).not.toHaveClass(/\bdark\b/);

	await page.getByRole('button', { name: 'Use dark theme' }).click();
	await expect(html).toHaveClass(/\bdark\b/);

	await page.getByRole('button', { name: 'Use light theme' }).click();
	await expect(html).not.toHaveClass(/\bdark\b/);
});

test('the offline fallback page is reachable and accessible', async ({ page }) => {
	// Precached by the service worker as the true offline fallback (see src/service-worker.ts);
	// this just checks the page itself renders cleanly, not the offline interception.
	await page.goto('/offline');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText("You're offline");
	await expect(page.getByRole('link', { name: 'Try again' })).toHaveAttribute('href', '/');

	const results = await new AxeBuilder({ page }).analyze();
	expect(results.violations).toEqual([]);
});

test('footer links to the GitHub repository', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('link', { name: 'Source code on GitHub' })).toHaveAttribute(
		'href',
		'https://github.com/brianramseyau/home-work-hours-tracker'
	);
});
