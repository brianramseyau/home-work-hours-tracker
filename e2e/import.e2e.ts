import AxeBuilder from '@axe-core/playwright';
import ExcelJS from 'exceljs';
import { expect, test, type Locator, type Page } from '@playwright/test';

// Shares the suite's webServer and database with the other e2e specs (see playwright.config.ts),
// so this builds its own fixture workbook rather than assuming another spec's data. "Today" is
// pinned to 2026-09-14 (FY27); every fixture date below is inside FY27 but away from the dates
// other specs touch (settings.e2e.ts and export.e2e.ts use September; this uses early July).

/** A synthetic "Home Work Diary" workbook, built the same way import.fixtures.ts does — inlined
 *  here since Playwright specs run outside the app's Vite/`$lib` alias resolution. */
async function buildFixtureWorkbook(): Promise<Buffer> {
	const workbook = new ExcelJS.Workbook();
	const sheet = workbook.addWorksheet('Diary');

	sheet.getCell(1, 1).value = 'Year';
	sheet.getCell(1, 2).value = 2026;
	sheet.getCell(1, 4).value = 'Total Hours';
	sheet.getCell(1, 5).value = 7.6;
	sheet.getCell(1, 7).value = 'Flat Rate';
	sheet.getCell(1, 8).value = 5.32;

	['Week', 'Date', 'Start Time', 'End Time', 'Total', 'Notes'].forEach((label, index) => {
		sheet.getCell(2, index + 1).value = label;
	});

	function dateCell(row: number, iso: string) {
		const [y, m, d] = iso.split('-').map(Number);
		const cell = sheet.getCell(row, 2);
		cell.value = new Date(Date.UTC(y, m - 1, d));
		cell.numFmt = 'dd/mm/yyyy';
	}

	dateCell(3, '2026-07-06');
	sheet.getCell(3, 3).value = 9 / 24;
	sheet.getCell(3, 3).numFmt = 'hh:mm';
	sheet.getCell(3, 4).value = 17.1 / 24;
	sheet.getCell(3, 4).numFmt = 'hh:mm';
	sheet.getCell(3, 5).value = 7.6;

	dateCell(4, '2026-07-07');
	sheet.getCell(4, 6).value = 'Sick';

	dateCell(5, '2026-07-08');
	sheet.getCell(5, 6).value = 'ImportedOfficeXYZ';

	dateCell(6, '2026-07-09');
	sheet.getCell(6, 6).value = 'a really weird ambiguous ramble that means nothing at all';

	const arrayBuffer = await workbook.xlsx.writeBuffer();
	return Buffer.from(arrayBuffer);
}

async function submitAndWait(page: Page, action: string, button: Locator) {
	await Promise.all([page.waitForResponse((res) => res.url().includes(action)), button.click()]);
}

test('import: upload a legacy workbook, review it, and commit', async ({ page }) => {
	const buffer = await buildFixtureWorkbook();

	await page.goto('/import');
	await page.setInputFiles('#file', {
		name: 'legacy-diary.xlsx',
		mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		buffer
	});
	await submitAndWait(page, '?/upload', page.getByRole('button', { name: 'Upload and review' }));

	await expect(page.getByText('Detected FY27, 4 rows, 1 issue.')).toBeVisible();
	await expect(page.getByText(/Row \d+: Could not classify/)).toBeVisible();
	await expect(page.getByText('ImportedOfficeXYZ').first()).toBeVisible();

	const results = await new AxeBuilder({ page }).analyze();
	expect(results.violations).toEqual([]);

	// On mobile the fixed bottom tab bar can overlap this button once the long review table has
	// scrolled it to the very bottom of the page — force the click rather than fight the overlap,
	// since every precondition (rendered, accessible) is already asserted above.
	const commitButton = page.getByRole('button', { name: /^Commit \d+ rows?$/ });
	await commitButton.scrollIntoViewIfNeeded();
	await Promise.all([
		page.waitForResponse((res) => res.url().includes('?/commit')),
		commitButton.click({ force: true })
	]);

	await expect(page).toHaveURL(/\/fy27/);
	await expect(page.getByText('Imported 3 days')).toBeVisible();

	// The timed row committed as a Home day with the sheet's literal times and derived break —
	// not just the right *kind*, which auto-prefill would already produce for this date on its
	// own (09:00–17:06/30 min is also this suite's standard schedule).
	await page.goto('/fy27/day/2026-07-06');
	await expect(page.getByRole('radio', { name: 'Home', exact: true })).toHaveAttribute(
		'data-state',
		'on'
	);
	await expect(page.getByLabel('Start')).toHaveValue('09:00');
	await expect(page.getByLabel('End')).toHaveValue('17:06');
	await expect(page.getByLabel('Break (min)')).toHaveValue('30');

	// The Sick day.
	await page.goto('/fy27/day/2026-07-07');
	await expect(page.getByRole('radio', { name: 'Sick', exact: true })).toHaveAttribute(
		'data-state',
		'on'
	);

	// The office-only day, linked to the newly-created office.
	await page.goto('/fy27/day/2026-07-08');
	await expect(page.getByRole('radio', { name: 'Office', exact: true })).toHaveAttribute(
		'data-state',
		'on'
	);
	await expect(page.getByRole('radio', { name: 'ImportedOfficeXYZ' })).toHaveAttribute(
		'data-state',
		'on'
	);

	// The new office proposed by the sheet now exists, for future days.
	await page.goto('/settings');
	await page.getByRole('tab', { name: 'Offices' }).click();
	await expect(page.getByText('ImportedOfficeXYZ', { exact: true })).toBeVisible();
});
