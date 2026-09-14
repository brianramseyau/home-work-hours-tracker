import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { buildDiaryDays, groupDiaryDaysByWeek } from '$lib/core/diary';
import { weekOfFy } from '$lib/core/fy';
import WeekPager from './WeekPager.svelte';

const STANDARD = { start: '09:00', end: '17:06', breakMinutes: 30 };
const TODAY = '2026-09-14';
const CURRENT_WEEK = weekOfFy(TODAY);

function weeksFor(today = TODAY) {
	const days = buildDiaryDays({
		startYear: 2026,
		today,
		days: [],
		schedules: [],
		holidays: [],
		standard: STANDARD,
		includeWeekends: false
	});
	return groupDiaryDaysByWeek(days);
}

describe('WeekPager', () => {
	it('opens on the current week and lists its days', async () => {
		render(WeekPager, { weeks: weeksFor(), currentWeek: CURRENT_WEEK, onOpenDay: () => {} });
		await expect.element(page.getByText(`Week ${CURRENT_WEEK}`)).toBeInTheDocument();
		await expect.element(page.getByText('Mon 14 Sep')).toBeInTheDocument();
	});

	it('moves to the next and previous week', async () => {
		render(WeekPager, { weeks: weeksFor(), currentWeek: CURRENT_WEEK, onOpenDay: () => {} });

		await page.getByRole('button', { name: 'Next week' }).click();
		await expect.element(page.getByText(`Week ${CURRENT_WEEK + 1}`)).toBeInTheDocument();

		await page.getByRole('button', { name: 'Previous week' }).click();
		await expect.element(page.getByText(`Week ${CURRENT_WEEK}`)).toBeInTheDocument();
	});

	it('disables Previous on the first week', async () => {
		const weeks = weeksFor();
		render(WeekPager, { weeks, currentWeek: weeks[0][0].week, onOpenDay: () => {} });
		await expect.element(page.getByRole('button', { name: 'Previous week' })).toBeDisabled();
	});

	it('disables Next on the last week', async () => {
		const weeks = weeksFor();
		render(WeekPager, { weeks, currentWeek: weeks.at(-1)![0].week, onOpenDay: () => {} });
		await expect.element(page.getByRole('button', { name: 'Next week' })).toBeDisabled();
	});

	it('calls onOpenDay when a day row is tapped', async () => {
		let opened: string | null = null;
		render(WeekPager, {
			weeks: weeksFor(),
			currentWeek: CURRENT_WEEK,
			onOpenDay: (date) => (opened = date)
		});

		await page.getByText('Mon 14 Sep').click();
		expect(opened).toBe('2026-09-14');
	});

	it('falls back to the first week when the current week is not found', async () => {
		render(WeekPager, { weeks: weeksFor(), currentWeek: 999, onOpenDay: () => {} });
		await expect.element(page.getByText('Week 1', { exact: true })).toBeInTheDocument();
	});
});
