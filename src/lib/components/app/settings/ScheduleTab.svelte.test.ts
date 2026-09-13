import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ScheduleTab from './ScheduleTab.svelte';

const offices = [{ id: 1, name: 'Office Location 1' }];

describe('ScheduleTab', () => {
	it('invites adding a schedule when there are none', async () => {
		render(ScheduleTab, { schedules: [], offices, includeWeekends: false, today: '2026-09-14' });
		await expect
			.element(page.getByText('No schedule set yet — add one below.'))
			.toBeInTheDocument();
	});

	it('lists an existing weekly schedule version', async () => {
		render(ScheduleTab, {
			schedules: [
				{
					id: 1,
					effectiveFrom: '2026-07-01',
					cycleWeeks: 1,
					anchorMonday: '2026-06-29',
					days: []
				}
			],
			offices,
			includeWeekends: false,
			today: '2026-09-14'
		});
		await expect.element(page.getByText('From 2026-07-01')).toBeInTheDocument();
		await expect.element(page.getByText('Every week').first()).toBeInTheDocument();
	});

	it('describes a fortnightly schedule version', async () => {
		render(ScheduleTab, {
			schedules: [
				{
					id: 1,
					effectiveFrom: '2026-07-01',
					cycleWeeks: 2,
					anchorMonday: '2026-06-29',
					days: []
				}
			],
			offices,
			includeWeekends: false,
			today: '2026-09-14'
		});
		await expect.element(page.getByText('Alternating fortnight').first()).toBeInTheDocument();
	});

	it('has a delete action for each schedule version', async () => {
		render(ScheduleTab, {
			schedules: [
				{
					id: 1,
					effectiveFrom: '2026-07-01',
					cycleWeeks: 1,
					anchorMonday: '2026-06-29',
					days: []
				}
			],
			offices,
			includeWeekends: false,
			today: '2026-09-14'
		});
		await expect.element(page.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
	});

	it('includes the new-schedule editor', async () => {
		render(ScheduleTab, { schedules: [], offices, includeWeekends: false, today: '2026-09-14' });
		await expect.element(page.getByRole('button', { name: 'Save schedule' })).toBeInTheDocument();
	});
});
