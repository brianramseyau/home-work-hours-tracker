import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';

vi.mock('$app/navigation', async () => {
	const actual = await vi.importActual<object>('$app/navigation');
	return { ...actual, pushState: vi.fn() };
});

import { render } from 'vitest-browser-svelte';
import { buildDiaryDays, countsByDisplayType } from '$lib/core/diary';
import { fySummary } from '$lib/core/fy';
import { summarise } from '$lib/core/totals';
import Page from './+page.svelte';

function baseData() {
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
				blocks: [{ start: '09:00', end: '17:06', breakMinutes: 30 }]
			}
		],
		schedules: [],
		holidays: [],
		standard: { start: '09:00', end: '17:06', breakMinutes: 30 },
		includeWeekends: false
	});

	return {
		fy: fySummary(2026),
		year: { startYear: 2026, rateCentsPerHour: 70, rateNote: null, finalisedAt: null },
		days,
		summary: summarise(days),
		claimCents: 532
	};
}

describe('Year page', () => {
	it('shows the punch card, legend, summary and monthly breakdown', async () => {
		render(Page, { data: baseData() } as unknown as Parameters<typeof render<typeof Page>>[1]);

		await expect.element(page.getByRole('heading', { name: 'FY27 year' })).toBeInTheDocument();
		await expect
			.element(page.getByRole('grid', { name: 'Financial year punch card' }))
			.toBeInTheDocument();
		await expect.element(page.getByText('Public holiday').first()).toBeInTheDocument();
		await expect.element(page.getByText('7.6 h at home')).toBeInTheDocument();
		await expect
			.element(page.getByRole('heading', { name: 'Monthly breakdown' }))
			.toBeInTheDocument();
	});

	it('shows the day-type counts, home days included', async () => {
		const data = baseData();
		render(Page, { data } as unknown as Parameters<typeof render<typeof Page>>[1]);

		const counts = countsByDisplayType(data.days);
		await expect.element(page.getByRole('heading', { name: 'Days by type' })).toBeInTheDocument();
		expect(counts.home).toBe(1);
	});

	it('shows a placeholder claim when the financial year has not been created yet', async () => {
		render(Page, {
			data: { ...baseData(), year: null, claimCents: null }
		} as unknown as Parameters<typeof render<typeof Page>>[1]);

		await expect
			.element(page.getByText("Set this year's rate in Years to see the claim.").first())
			.toBeInTheDocument();
	});

	it('opens the day editor from a punch card cell', async () => {
		const { pushState } = await import('$app/navigation');
		render(Page, { data: baseData() } as unknown as Parameters<typeof render<typeof Page>>[1]);

		await page.getByRole('button', { name: /2026-09-14/ }).click();
		expect(pushState).toHaveBeenCalledWith('/fy27/day/2026-09-14', { dayDate: '2026-09-14' });
	});
});
