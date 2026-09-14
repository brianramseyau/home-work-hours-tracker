import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

// Shares the suite's webServer and database with settings.e2e.ts and smoke.e2e.ts (see
// playwright.config.ts), so every step here is idempotent — it sets up whatever it needs itself,
// rather than assuming another file has already run. "Today" is pinned to 2026-09-14 (FY27).

async function submitAndWait(page: Page, action: string, button: Locator) {
	await Promise.all([page.waitForResponse((res) => res.url().includes(action)), button.click()]);
}

/** Ensures FY27, both offices and a Mon–Fri home schedule exist, so the diary has data to show. */
async function ensureSetUp(page: Page) {
	await page.goto('/years');
	if (
		!(await page
			.getByRole('heading', { name: 'FY27' })
			.isVisible()
			.catch(() => false))
	) {
		await submitAndWait(page, '?/create', page.getByRole('button', { name: /^Add FY/ }));
	}

	await page.goto('/settings');
	await page.getByRole('tab', { name: 'Offices' }).click();
	for (const name of ['Office Location 1', 'Office Location 2']) {
		if (
			await page
				.getByText(name, { exact: true })
				.isVisible()
				.catch(() => false)
		)
			continue;
		await page.locator('#new-office-name').fill(name);
		await submitAndWait(page, '?/officeCreate', page.getByRole('button', { name: 'Add office' }));
	}

	await page.getByRole('tab', { name: 'Schedule' }).click();
	if (
		await page
			.getByText('No schedule set yet — add one below.')
			.isVisible()
			.catch(() => false)
	) {
		await submitAndWait(page, '?/schedule', page.getByRole('button', { name: 'Save schedule' }));
	}
}

test('diary: auto-fill, editing a day, marking leave, and a deep link', async ({ page }) => {
	await ensureSetUp(page);

	// 1. Visiting the diary fills days through today from the schedule.
	await page.goto('/fy27');
	await expect(page.getByRole('heading', { name: 'FY27 diary' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Mark leave' })).toBeVisible();

	// 2. Edit 16 Sep to a Split day (two blocks, an office, a note), via its deep link — the
	// same page a shallow-routed open would show, and independent of mobile vs desktop layout.
	await page.goto('/fy27/day/2026-09-16');
	await expect(page.getByRole('heading', { name: 'Wed 16 Sep 2026' })).toBeVisible();
	await page.getByRole('radio', { name: 'Split' }).click();
	await page.getByRole('radio', { name: 'Office Location 1' }).click();
	await page.locator('#day-notes').fill('Half day in the office');
	await submitAndWait(page, '?/saveDay', page.getByRole('button', { name: 'Save day' }));
	await expect(page.getByRole('alert')).not.toBeVisible();

	// 3. Reload the same deep link: the override survives.
	await page.goto('/fy27/day/2026-09-16');
	await expect(page.getByRole('radio', { name: 'Split' })).toHaveAttribute('data-state', 'on');
	await expect(page.locator('#day-notes')).toHaveValue('Half day in the office');

	// 4. Mark a short range as leave, from the diary page (desktop table or mobile week pager).
	await page.goto('/fy27');
	await page.getByRole('button', { name: 'Mark leave' }).click();
	await page.getByLabel('From').fill('2026-09-07');
	await page.getByLabel('To').fill('2026-09-07');
	await expect(page.getByRole('radio', { name: 'Leave' })).toHaveAttribute('data-state', 'on');
	await submitAndWait(page, '?/markRange', page.getByRole('button', { name: 'Mark days' }));
	await expect(page.getByRole('button', { name: 'Mark days' })).not.toBeVisible();

	await page.goto('/fy27/day/2026-09-07');
	await expect(page.getByRole('radio', { name: 'Leave' })).toHaveAttribute('data-state', 'on');

	// 5. Accessibility: no violations on the populated diary.
	await page.goto('/fy27');
	const results = await new AxeBuilder({ page }).analyze();
	expect(results.violations).toEqual([]);
});
