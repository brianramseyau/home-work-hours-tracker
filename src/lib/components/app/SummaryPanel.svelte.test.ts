import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import SummaryPanel from './SummaryPanel.svelte';

describe('SummaryPanel', () => {
	it('shows the home hours and the claim at the current rate', async () => {
		render(SummaryPanel, { homeMinutes: 456, claimCents: 532, rateCentsPerHour: 70 });
		await expect.element(page.getByText('7.6 h at home')).toBeInTheDocument();
		await expect.element(page.getByText('$5.32 at $0.70/hr')).toBeInTheDocument();
	});

	it('invites setting a rate when the financial year has none yet', async () => {
		render(SummaryPanel, { homeMinutes: 0, claimCents: null, rateCentsPerHour: null });
		await expect.element(page.getByText('0.0 h at home')).toBeInTheDocument();
		await expect
			.element(page.getByText("Set this year's rate in Years to see the claim."))
			.toBeInTheDocument();
	});
});
