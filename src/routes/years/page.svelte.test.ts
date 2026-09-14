import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';

const nextFy = { startYear: 2026, label: 'FY27', slug: 'fy27', range: 'Jul 2026 – Jun 2027' };

describe('years page', () => {
	it('invites creating the first year when none exist', async () => {
		render(Page, { data: { years: [], nextFy } } as unknown as Parameters<
			typeof render<typeof Page>
		>[1]);

		await expect.element(page.getByText('No financial years yet.')).toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: 'Add FY27' }))
			.toHaveAttribute('type', 'submit');
	});

	it('lists existing years', async () => {
		render(Page, {
			data: {
				years: [
					{
						startYear: 2026,
						rateCentsPerHour: 70,
						rateNote: null,
						finalisedAt: null,
						fy: { label: 'FY27', slug: 'fy27', range: 'Jul 2026 – Jun 2027' },
						homeMinutes: 456,
						claimCents: 532
					}
				],
				nextFy: { startYear: 2027, label: 'FY28', slug: 'fy28', range: 'Jul 2027 – Jun 2028' }
			}
		} as unknown as Parameters<typeof render<typeof Page>>[1]);

		await expect.element(page.getByRole('heading', { name: 'FY27' })).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Add FY28' })).toBeInTheDocument();
	});
});
