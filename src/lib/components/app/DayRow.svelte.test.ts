import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { DiaryDay } from '$lib/core/diary';
import DayRow from './DayRow.svelte';

const baseDay: DiaryDay = {
	date: '2026-09-14',
	weekday: 1,
	week: 11,
	status: 'recorded',
	kind: 'work',
	source: 'manual',
	officeId: null,
	notes: null,
	blocks: [{ start: '09:00', end: '17:06', breakMinutes: 30 }],
	homeMinutes: 456,
	displayType: 'home'
};

describe('DayRow', () => {
	it('shows the date, type and hours, and calls onOpen when tapped', async () => {
		let opened: string | null = null;
		render(DayRow, { day: baseDay, onOpen: (date) => (opened = date) });

		await expect.element(page.getByText('Mon 14 Sep')).toBeInTheDocument();
		await expect.element(page.getByText('Home', { exact: true })).toBeInTheDocument();
		await expect.element(page.getByText('7.6 h')).toBeInTheDocument();

		await page.getByRole('button').click();
		expect(opened).toBe('2026-09-14');
	});

	it('shows no hours figure for a day with none', async () => {
		render(DayRow, {
			day: { ...baseDay, homeMinutes: 0, displayType: 'off', kind: 'off' },
			onOpen: () => {}
		});
		expect(page.getByText(/h$/).elements().length).toBe(0);
	});

	it('marks a prefill-sourced day as from the schedule', async () => {
		render(DayRow, { day: { ...baseDay, source: 'prefill' }, onOpen: () => {} });
		await expect.element(page.getByText('From schedule')).toBeInTheDocument();
	});

	it('marks a ghost preview as from the schedule too', async () => {
		render(DayRow, { day: { ...baseDay, source: null, status: 'ghost' }, onOpen: () => {} });
		await expect.element(page.getByText('From schedule')).toBeInTheDocument();
	});

	it('does not show the schedule marker for a manually recorded day', async () => {
		render(DayRow, { day: baseDay, onOpen: () => {} });
		expect(page.getByText('From schedule').elements().length).toBe(0);
	});

	it('shows a note indicator when the day has notes', async () => {
		render(DayRow, { day: { ...baseDay, notes: 'Worked late' }, onOpen: () => {} });
		await expect.element(page.getByText('Has a note')).toBeInTheDocument();
	});
});
