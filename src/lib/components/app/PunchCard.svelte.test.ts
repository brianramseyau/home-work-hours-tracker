import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { buildDiaryDays, groupDiaryDaysByWeek } from '$lib/core/diary';
import PunchCard from './PunchCard.svelte';

const STANDARD = { start: '09:00', end: '17:06', breakMinutes: 30 };

function weeks() {
	const days = buildDiaryDays({
		startYear: 2026,
		today: '2026-09-14',
		days: [
			{
				date: '2026-09-14',
				kind: 'work',
				officeId: null,
				notes: null,
				source: 'manual',
				blocks: [STANDARD]
			}
		],
		schedules: [],
		holidays: [],
		standard: STANDARD,
		includeWeekends: false
	});
	return groupDiaryDaysByWeek(days);
}

describe('PunchCard', () => {
	it('renders one cell per day, grouped into rows per week', async () => {
		const grouped = weeks();
		render(PunchCard, { weeks: grouped });

		await expect
			.element(page.getByRole('grid', { name: 'Financial year punch card' }))
			.toBeInTheDocument();
		expect(page.getByRole('row').elements().length).toBe(grouped.length);
	});

	it('describes a recorded home day with its hours in the accessible label', async () => {
		render(PunchCard, { weeks: weeks() });
		await expect
			.element(page.getByRole('button', { name: '2026-09-14, Home, 7.6 h' }))
			.toBeInTheDocument();
	});

	it('describes a day with no home hours without an hours figure', async () => {
		render(PunchCard, { weeks: weeks() });
		await expect.element(page.getByRole('button', { name: '2026-09-07, Off' })).toBeInTheDocument();
	});

	it('describes a future day with nothing scheduled as not yet', async () => {
		render(PunchCard, { weeks: weeks() });
		await expect
			.element(page.getByRole('button', { name: '2026-09-15, Not yet' }))
			.toBeInTheDocument();
	});

	it('describes a schedule preview without claiming its hours', async () => {
		const days = buildDiaryDays({
			startYear: 2026,
			today: '2026-09-14',
			days: [],
			schedules: [
				{
					effectiveFrom: '2026-07-01',
					cycleWeeks: 1,
					anchorMonday: '2026-06-29',
					days: [{ weekIndex: 0, weekday: 2, mode: 'home', officeId: null }]
				}
			],
			holidays: [],
			standard: STANDARD,
			includeWeekends: false
		});
		render(PunchCard, { weeks: groupDiaryDaysByWeek(days) });
		await expect
			.element(page.getByRole('button', { name: '2026-09-15, Home from schedule' }))
			.toBeInTheDocument();
	});

	it('calls onSelectDay with the clicked date', async () => {
		let selected: string | null = null;
		render(PunchCard, { weeks: weeks(), onSelectDay: (date) => (selected = date) });

		await page.getByRole('button', { name: '2026-09-14, Home, 7.6 h' }).click();
		expect(selected).toBe('2026-09-14');
	});

	it('renders without a click handler', async () => {
		render(PunchCard, { weeks: weeks() });
		const cell = page.getByRole('button', { name: '2026-09-14, Home, 7.6 h' });
		await cell.click();
		await expect.element(cell).toBeInTheDocument();
	});
});
