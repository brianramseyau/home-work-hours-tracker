import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const viewport = vi.hoisted(() => ({ width: 1440 }));

vi.mock('$app/state', () => import('$lib/test-utils/pageFormStub.svelte'));
vi.mock('$app/navigation', async () => {
	const actual = await vi.importActual<object>('$app/navigation');
	const stub = await import('$lib/test-utils/pageFormStub.svelte');
	return { ...actual, pushState: stub.pushState, replaceState: stub.replaceState };
});
vi.mock('svelte/reactivity/window', () => ({
	innerWidth: {
		get current() {
			return viewport.width;
		}
	}
}));

import { render } from 'vitest-browser-svelte';
import { resetPageForm, resetPageState, setPageState } from '$lib/test-utils/pageFormStub.svelte';
import { buildDiaryDays } from '$lib/core/diary';
import { fyBounds, fySummary } from '$lib/core/fy';
import Page from './+page.svelte';

const STANDARD = { standardStart: '09:00', standardEnd: '17:06', standardBreakMinutes: 30 };

function baseData(overrides: Partial<Record<string, unknown>> = {}) {
	const days = buildDiaryDays({
		startYear: 2026,
		today: '2026-09-14',
		days: [],
		schedules: [],
		holidays: [],
		standard: { start: '09:00', end: '17:06', breakMinutes: 30 },
		includeWeekends: false
	});

	return {
		fy: fySummary(2026),
		fyBounds: fyBounds(2026),
		year: { startYear: 2026, rateCentsPerHour: 70, rateNote: null, finalisedAt: null },
		settings: { holidayRegion: 'AU-VIC', includeWeekends: false, ...STANDARD },
		offices: [
			{ id: 1, name: 'Office Location 1', archivedAt: null },
			{ id: 2, name: 'Office Location 2', archivedAt: '2026-01-01' }
		] as { id: number; name: string; archivedAt: string | null }[],
		schedules: [],
		holidays: [],
		today: '2026-09-14',
		days,
		summary: { homeMinutes: 0, byMonth: [], byWeek: [], kindCounts: {} },
		claimCents: 0,
		finalised: false,
		...overrides
	};
}

beforeEach(() => {
	resetPageForm();
	resetPageState();
	viewport.width = 1440;
});

describe('Diary page', () => {
	it('shows the FY heading and the mark-leave action', async () => {
		render(Page, { data: baseData() } as unknown as Parameters<typeof render<typeof Page>>[1]);
		await expect.element(page.getByRole('heading', { name: 'FY27 diary' })).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Mark leave' })).toBeInTheDocument();
	});

	it('shows the office a day was worked at in the diary table', async () => {
		const days = buildDiaryDays({
			startYear: 2026,
			today: '2026-09-14',
			days: [
				{
					date: '2026-09-14',
					kind: 'work',
					officeId: 1,
					notes: null,
					source: 'manual',
					blocks: []
				}
			],
			schedules: [],
			holidays: [],
			standard: { start: '09:00', end: '17:06', breakMinutes: 30 },
			includeWeekends: false
		});
		render(Page, {
			data: baseData({ days })
		} as unknown as Parameters<typeof render<typeof Page>>[1]);
		await expect.element(page.getByText('Office Location 1').first()).toBeInTheDocument();
	});

	it('shows a finalised banner linking to Years', async () => {
		render(Page, {
			data: baseData({ finalised: true })
		} as unknown as Parameters<typeof render<typeof Page>>[1]);
		await expect
			.element(page.getByRole('link', { name: 'Unfinalise it' }))
			.toHaveAttribute('href', '/years');
	});

	it('opens the day editor in a Sheet on a desktop-width viewport', async () => {
		render(Page, { data: baseData() } as unknown as Parameters<typeof render<typeof Page>>[1]);

		await page.getByRole('button', { name: 'Mon 14' }).first().click();

		await expect
			.element(page.getByRole('heading', { name: 'Mon 14 Sep 2026' }))
			.toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Save day' })).toBeInTheDocument();
	});

	it('opens the day editor in a Drawer on a mobile-width viewport', async () => {
		viewport.width = 390;
		render(Page, { data: baseData() } as unknown as Parameters<typeof render<typeof Page>>[1]);

		setPageState({ dayDate: '2026-09-14' });
		await expect
			.element(page.getByRole('heading', { name: 'Mon 14 Sep 2026' }))
			.toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Save day' })).toBeInTheDocument();
	});

	it('closes the editor once the day saves', async () => {
		render(Page, { data: baseData() } as unknown as Parameters<typeof render<typeof Page>>[1]);
		setPageState({ dayDate: '2026-09-14' });
		await expect.element(page.getByRole('button', { name: 'Save day' })).toBeInTheDocument();

		const { setPageForm } = await import('$lib/test-utils/pageFormStub.svelte');
		setPageForm({ form: 'day', date: '2026-09-14', success: true });

		await expect.element(page.getByRole('button', { name: 'Save day' })).not.toBeInTheDocument();
	});

	it('closes the Sheet on Escape and clears the shallow route state', async () => {
		render(Page, { data: baseData() } as unknown as Parameters<typeof render<typeof Page>>[1]);
		setPageState({ dayDate: '2026-09-14' });
		await expect.element(page.getByRole('button', { name: 'Save day' })).toBeInTheDocument();

		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		await expect.element(page.getByRole('button', { name: 'Save day' })).not.toBeInTheDocument();
	});

	it('closes the Drawer on Escape and clears the shallow route state', async () => {
		viewport.width = 390;
		render(Page, { data: baseData() } as unknown as Parameters<typeof render<typeof Page>>[1]);
		setPageState({ dayDate: '2026-09-14' });
		await expect.element(page.getByRole('button', { name: 'Save day' })).toBeInTheDocument();

		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		await expect.element(page.getByRole('button', { name: 'Save day' })).not.toBeInTheDocument();
	});

	it('shows nothing extra when no day is open', async () => {
		render(Page, { data: baseData() } as unknown as Parameters<typeof render<typeof Page>>[1]);
		await expect.element(page.getByRole('button', { name: 'Save day' })).not.toBeInTheDocument();
	});

	it('ignores shallow-route state for a date outside the loaded financial year', async () => {
		render(Page, { data: baseData() } as unknown as Parameters<typeof render<typeof Page>>[1]);
		setPageState({ dayDate: '1999-01-01' });
		await expect.element(page.getByRole('button', { name: 'Save day' })).not.toBeInTheDocument();
	});

	it('falls back to a mobile layout when the viewport width is unknown (SSR)', async () => {
		viewport.width = undefined as unknown as number;
		render(Page, { data: baseData() } as unknown as Parameters<typeof render<typeof Page>>[1]);
		setPageState({ dayDate: '2026-09-14' });
		await expect.element(page.getByRole('button', { name: 'Save day' })).toBeInTheDocument();
	});

	it('shows a placeholder claim when the financial year has not been created yet', async () => {
		render(Page, {
			data: baseData({ year: null })
		} as unknown as Parameters<typeof render<typeof Page>>[1]);
		await expect
			.element(page.getByText("Set this year's rate in Years to see the claim.").first())
			.toBeInTheDocument();
	});
});
