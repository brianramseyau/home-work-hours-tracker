import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/state', () => import('$lib/test-utils/pageFormStub.svelte'));

import { render } from 'vitest-browser-svelte';
import { resetPageForm, setPageForm } from '$lib/test-utils/pageFormStub.svelte';
import { buildDiaryDays, groupDiaryDaysByWeek } from '$lib/core/diary';
import DiaryTable from './DiaryTable.svelte';

beforeEach(() => {
	resetPageForm();
});

const STANDARD = { start: '09:00', end: '17:06', breakMinutes: 30 };

function weeksFor() {
	const days = buildDiaryDays({
		startYear: 2026,
		today: '2026-09-14',
		days: [
			{
				date: '2026-09-14',
				kind: 'work',
				officeId: null,
				notes: 'Focus day',
				source: 'manual',
				blocks: [STANDARD]
			},
			{
				date: '2026-09-15',
				kind: 'work',
				officeId: 1,
				notes: null,
				source: 'manual',
				blocks: [{ start: '09:00', end: '12:00', breakMinutes: 0 }]
			}
		],
		schedules: [],
		holidays: [],
		standard: STANDARD,
		includeWeekends: false
	});
	return groupDiaryDaysByWeek(days);
}

describe('DiaryTable', () => {
	it('renders a week header and one row per day', async () => {
		render(DiaryTable, { weeks: weeksFor(), onOpenDay: () => {} });
		await expect.element(page.getByText('Week 1 (01–03)')).toBeInTheDocument();
		expect(document.querySelectorAll('tbody tr').length).toBeGreaterThan(2);
	});

	it('shows the note and schedule markers, and the hours for a home day', async () => {
		render(DiaryTable, { weeks: weeksFor(), onOpenDay: () => {} });
		await expect.element(page.getByText('Has a note')).toBeInTheDocument();
		await expect.element(page.getByText('7.6 h')).toBeInTheDocument();
	});

	it('reads "Not yet" for a future day with nothing scheduled', async () => {
		render(DiaryTable, { weeks: weeksFor(), onOpenDay: () => {} });
		await expect.element(page.getByText('Not yet').first()).toBeInTheDocument();
	});

	it('mutes a schedule preview row, and only that row', async () => {
		const days = buildDiaryDays({
			startYear: 2026,
			today: '2026-09-14',
			days: [],
			schedules: [
				{
					effectiveFrom: '2026-07-01',
					cycleWeeks: 1,
					anchorMonday: '2026-06-29',
					days: [{ weekIndex: 0, weekday: 3, mode: 'home', officeId: null }]
				}
			],
			holidays: [],
			standard: STANDARD,
			includeWeekends: false
		});
		render(DiaryTable, { weeks: groupDiaryDaysByWeek(days), onOpenDay: () => {} });
		expect(document.getElementById('day-row-2026-09-16')!.className).toContain(
			'text-muted-foreground'
		);
		expect(document.getElementById('day-row-2026-09-15')!.className).not.toContain(
			'text-muted-foreground'
		);
	});

	it('opens the day editor when the type is clicked', async () => {
		let opened: string | null = null;
		render(DiaryTable, { weeks: weeksFor(), onOpenDay: (date) => (opened = date) });

		await page.getByRole('button', { name: 'Home', exact: true }).first().click();
		expect(opened).toBe('2026-09-14');
	});

	it('opens the day editor when the date is clicked', async () => {
		let opened: string | null = null;
		render(DiaryTable, { weeks: weeksFor(), onOpenDay: (date) => (opened = date) });

		await page.getByRole('button', { name: 'Mon 14' }).first().click();
		expect(opened).toBe('2026-09-14');
	});

	it('lets a single-block home day’s times be edited inline', async () => {
		render(DiaryTable, { weeks: weeksFor(), onOpenDay: () => {} });

		await page.getByRole('button', { name: 'Edit time block 09:00–17:06' }).click();
		await expect.element(page.getByRole('button', { name: 'Save' })).toBeInTheDocument();

		await page.getByRole('button', { name: 'Cancel' }).click();
		await expect
			.element(page.getByRole('button', { name: 'Edit time block 09:00–17:06' }))
			.toBeInTheDocument();
	});

	it('does not offer inline time editing for a split day', () => {
		render(DiaryTable, { weeks: weeksFor(), onOpenDay: () => {} });
		const row = document.getElementById('day-row-2026-09-15') as HTMLElement;
		const button = row.querySelector('button[aria-label="No time set"]') as HTMLButtonElement;
		expect(button.disabled).toBe(true);
	});

	it('does not offer inline time editing once the year is finalised', () => {
		render(DiaryTable, { weeks: weeksFor(), onOpenDay: () => {}, finalised: true });
		const row = document.getElementById('day-row-2026-09-14') as HTMLElement;
		const button = row.querySelector('button[aria-label="No time set"]') as HTMLButtonElement;
		expect(button.disabled).toBe(true);
	});

	it('moves focus with j/k and opens the focused day with Enter', async () => {
		let opened: string | null = null;
		render(DiaryTable, { weeks: weeksFor(), onOpenDay: (date) => (opened = date) });

		const table = document.querySelector('table') as HTMLTableElement;
		const firstRow = document.getElementById('day-row-2026-09-14') as HTMLTableRowElement;
		firstRow.focus();

		table.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', bubbles: true }));
		table.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		expect(opened).toBe('2026-09-15');

		table.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', bubbles: true }));
		table.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		expect(opened).toBe('2026-09-14');
	});

	it('does nothing on Enter before any row has been focused', () => {
		render(DiaryTable, { weeks: weeksFor(), onOpenDay: () => {} });
		const table = document.querySelector('table') as HTMLTableElement;
		table.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		expect(table).toBeInTheDocument();
	});

	it('closes an inline edit on Escape', async () => {
		render(DiaryTable, { weeks: weeksFor(), onOpenDay: () => {} });
		await page.getByRole('button', { name: 'Edit time block 09:00–17:06' }).click();

		const table = document.querySelector('table') as HTMLTableElement;
		table.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		await expect
			.element(page.getByRole('button', { name: 'Edit time block 09:00–17:06' }))
			.toBeInTheDocument();
	});

	it('lets the inline start and end times be edited', async () => {
		render(DiaryTable, { weeks: weeksFor(), onOpenDay: () => {} });
		await page.getByRole('button', { name: 'Edit time block 09:00–17:06' }).click();

		const [start, end] = Array.from(
			document.querySelectorAll('input[type="time"]')
		) as HTMLInputElement[];
		start.value = '08:00';
		start.dispatchEvent(new Event('input', { bubbles: true }));
		end.value = '16:00';
		end.dispatchEvent(new Event('input', { bubbles: true }));

		await expect.poll(() => start.value).toBe('08:00');
		await expect.poll(() => end.value).toBe('16:00');
	});

	it('closes the inline edit once the save succeeds', async () => {
		render(DiaryTable, { weeks: weeksFor(), onOpenDay: () => {} });
		await page.getByRole('button', { name: 'Edit time block 09:00–17:06' }).click();

		setPageForm({ form: 'day', date: '2026-09-14', success: true });
		await expect.element(page.getByRole('button', { name: 'Save' })).not.toBeInTheDocument();
	});

	it('does not close a different day’s inline edit on an unrelated save', async () => {
		render(DiaryTable, { weeks: weeksFor(), onOpenDay: () => {} });
		await page.getByRole('button', { name: 'Edit time block 09:00–17:06' }).click();

		setPageForm({ form: 'day', date: '2099-01-01', success: true });
		await expect.element(page.getByRole('button', { name: 'Save' })).toBeInTheDocument();
	});

	it('closes an inline edit on Escape even while a field inside it has focus', async () => {
		render(DiaryTable, { weeks: weeksFor(), onOpenDay: () => {} });
		await page.getByRole('button', { name: 'Edit time block 09:00–17:06' }).click();

		const [start] = Array.from(
			document.querySelectorAll('input[type="time"]')
		) as HTMLInputElement[];
		start.focus();
		start.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

		await expect
			.element(page.getByRole('button', { name: 'Edit time block 09:00–17:06' }))
			.toBeInTheDocument();
	});

	it('leaves an open inline edit alone when Escape is typed into an unrelated field', async () => {
		render(DiaryTable, { weeks: weeksFor(), onOpenDay: () => {} });
		await page.getByRole('button', { name: 'Edit time block 09:00–17:06' }).click();

		const unrelatedField = document.createElement('textarea');
		document.body.appendChild(unrelatedField);
		unrelatedField.focus();
		unrelatedField.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		unrelatedField.remove();

		await expect.element(page.getByRole('button', { name: 'Save' })).toBeInTheDocument();
	});

	it('leaves an open inline edit alone on Escape from the day editor’s own ?/saveDay form', async () => {
		// The day editor (mounted alongside this table on desktop) posts to the same `?/saveDay`
		// action, so the guard can't just match on the form's action — it needs `data-inline-edit`
		// specifically, or an Escape typed into the day editor's Notes textarea would reach across
		// and cancel an unrelated open inline edit.
		render(DiaryTable, { weeks: weeksFor(), onOpenDay: () => {} });
		await page.getByRole('button', { name: 'Edit time block 09:00–17:06' }).click();

		const otherSaveDayForm = document.createElement('form');
		otherSaveDayForm.setAttribute('action', '?/saveDay');
		const notesField = document.createElement('textarea');
		otherSaveDayForm.appendChild(notesField);
		document.body.appendChild(otherSaveDayForm);
		notesField.focus();
		notesField.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		otherSaveDayForm.remove();

		await expect.element(page.getByRole('button', { name: 'Save' })).toBeInTheDocument();
	});

	it('ignores keyboard shortcuts typed into a field', async () => {
		render(DiaryTable, { weeks: weeksFor(), onOpenDay: () => {} });
		await page.getByRole('button', { name: 'Edit time block 09:00–17:06' }).click();

		const [start] = Array.from(
			document.querySelectorAll('input[type="time"]')
		) as HTMLInputElement[];
		start.focus();
		start.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', bubbles: true }));

		expect(document.activeElement).toBe(start);
	});

	it('stops listening for keyboard shortcuts once unmounted', async () => {
		const { unmount } = render(DiaryTable, { weeks: weeksFor(), onOpenDay: () => {} });
		await unmount();
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j' }));
		expect(document.querySelector('table')).toBeNull();
	});

	it('carries a note-free day’s (empty) note through the inline time edit', async () => {
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

		render(DiaryTable, { weeks: groupDiaryDaysByWeek(days), onOpenDay: () => {} });
		await page.getByRole('button', { name: 'Edit time block 09:00–17:06' }).click();

		const notesInput = document.querySelector('input[name="notes"]') as HTMLInputElement;
		expect(notesInput.value).toBe('');
	});

	it('shows the schedule marker for a prefill or ghost day', async () => {
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

		render(DiaryTable, { weeks: groupDiaryDaysByWeek(days), onOpenDay: () => {} });
		await expect.element(page.getByText('From schedule').first()).toBeInTheDocument();
	});
});
