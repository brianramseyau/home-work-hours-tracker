import AxeBuilder from '@axe-core/playwright';
import ExcelJS from 'exceljs';
import { expect, test, type Locator, type Page } from '@playwright/test';

// Shares the suite's webServer and database with diary.e2e.ts, settings.e2e.ts and
// smoke.e2e.ts (see playwright.config.ts), so this sets up whatever it needs itself rather than
// assuming another file already ran. "Today" is pinned to 2026-09-14 (FY27).

async function submitAndWait(page: Page, action: string, button: Locator) {
	await Promise.all([page.waitForResponse((res) => res.url().includes(action)), button.click()]);
}

/** Ensures FY27, both offices and a Mon–Fri home schedule exist, so there's something to export. */
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

test('export: download the FY27 spreadsheet and cross-check its totals against the app', async ({
	page
}) => {
	await ensureSetUp(page);

	await page.goto('/fy27');
	await page.waitForLoadState('networkidle');

	await page.goto('/fy27/export');
	const homeHoursText = await page.getByText(/h at home$/).textContent();
	const displayedHours = Number(homeHoursText!.replace(/[^\d.]/g, ''));

	const [download] = await Promise.all([
		page.waitForEvent('download'),
		page.getByRole('link', { name: 'Download spreadsheet' }).click()
	]);
	expect(download.suggestedFilename()).toBe('FY27-home-work-diary.xlsx');

	const filePath = await download.path();
	const workbook = new ExcelJS.Workbook();
	await workbook.xlsx.readFile(filePath!);

	expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['Summary', 'Diary']);
	const summary = workbook.getWorksheet('Summary')!;
	const hoursCell = summary.getCell('B7').value as { result: number };
	expect(hoursCell.result).toBeCloseTo(displayedHours, 1);

	const diary = workbook.getWorksheet('Diary')!;
	expect(diary.getRow(1).getCell('A').value).toBe('Week');
	expect(diary.rowCount).toBeGreaterThan(1);

	const results = await new AxeBuilder({ page }).analyze();
	expect(results.violations).toEqual([]);
});
