import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

// The whole suite shares one webServer (and one database) across both the mobile and desktop
// projects (see playwright.config.ts), so every step here is idempotent: it checks the current
// state before acting, rather than assuming a fresh database. "Today" is pinned to
// 2026-09-14, so the current financial year is FY27.

/** Clicks a submit button and waits for its form action's response, so a later assertion never
 *  races the reload that follows (e.g. a switch's own visual state flips optimistically, well
 *  before the server round-trip — and the data it controls — actually completes). */
async function submitAndWait(page: Page, action: string, button: Locator) {
	await Promise.all([page.waitForResponse((res) => res.url().includes(action)), button.click()]);
}

test('settings walkthrough: years, general hours, offices, schedule, holidays, weekends', async ({
	page
}) => {
	// 1. Create FY27 (rate defaults to 70c/hr, matching the ATO fixed rate, with no previous
	// year to copy from).
	await page.goto('/years');
	const fy27Heading = page.getByRole('heading', { name: 'FY27' });
	if (!(await fy27Heading.isVisible().catch(() => false))) {
		await submitAndWait(page, '?/create', page.getByRole('button', { name: /^Add FY/ }));
		await expect(fy27Heading).toBeVisible();
	}
	await expect(page.getByText('$0.70/hr')).toBeVisible();

	// 2. Standard hours default to 09:00–17:06 with a 30 min break = 7.6 h; saving proves the
	// general settings form round-trips even with unchanged values.
	await page.goto('/settings');
	await expect(page.getByText('= 7.6 h per day')).toBeVisible();
	await submitAndWait(
		page,
		'?/general',
		page.getByRole('button', { name: 'Save general settings' })
	);
	await expect(page.getByText('= 7.6 h per day')).toBeVisible();

	// 3. Add both offices, if they aren't already there from the other viewport's run. IDs, not
	// getByLabel('Name'), since every tab's own "Name" field stays in the DOM at once.
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
		await expect(page.getByText(name, { exact: true })).toBeVisible();
	}

	// 4. Build an alternating-fortnight schedule, unless a version already exists.
	await page.getByRole('tab', { name: 'Schedule' }).click();
	if (
		await page
			.getByText('No schedule set yet — add one below.')
			.isVisible()
			.catch(() => false)
	) {
		await page.getByRole('radio', { name: 'Alternating fortnight' }).click();
		await expect(page.getByText('Week A', { exact: true })).toBeVisible();
		await expect(page.getByText('Week B', { exact: true })).toBeVisible();
		await submitAndWait(page, '?/schedule', page.getByRole('button', { name: 'Save schedule' }));
		await expect(page.getByText('Alternating fortnight').first()).toBeVisible();
	}

	// 5. Add a custom holiday for FY27, unless it's already there.
	await page.getByRole('tab', { name: 'Holidays' }).click();
	const customHolidayName = 'Office Location 1 anniversary';
	if (
		!(await page
			.getByText(customHolidayName)
			.isVisible()
			.catch(() => false))
	) {
		await page.locator('#new-holiday-date').fill('2026-09-14');
		await page.locator('#new-holiday-name').fill(customHolidayName);
		await submitAndWait(page, '?/holidayCreate', page.getByRole('button', { name: 'Add holiday' }));
		await expect(page.getByText(customHolidayName)).toBeVisible();
	}
	await expect(page.getByText('Custom').first()).toBeVisible();

	// 6. Turn on "Include weekends" and see the schedule editor grow Sat/Sun columns.
	await page.getByRole('tab', { name: 'General' }).click();
	const weekendsSwitch = page.getByRole('switch', { name: 'Include weekends' });
	if ((await weekendsSwitch.getAttribute('aria-checked')) !== 'true') {
		await weekendsSwitch.click();
		await submitAndWait(
			page,
			'?/general',
			page.getByRole('button', { name: 'Save general settings' })
		);
	}
	await page.getByRole('tab', { name: 'Schedule' }).click();
	await expect(page.getByText('Sat', { exact: true }).first()).toBeVisible();
	await expect(page.getByText('Sun', { exact: true }).first()).toBeVisible();

	// 7. Accessibility: no violations on the settings page in its current (populated) state.
	const results = await new AxeBuilder({ page }).analyze();
	expect(results.violations).toEqual([]);
});
