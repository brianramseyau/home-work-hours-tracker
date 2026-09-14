import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Legend from './Legend.svelte';

describe('Legend', () => {
	it('lists every day type', async () => {
		render(Legend, {});
		for (const label of ['Home', 'Office', 'Split', 'Leave', 'Sick', 'Public holiday', 'Off']) {
			await expect.element(page.getByText(label, { exact: true })).toBeInTheDocument();
		}
	});
});
