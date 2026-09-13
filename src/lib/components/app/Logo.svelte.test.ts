import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Logo from './Logo.svelte';

describe('Logo', () => {
	it('is decorative by default', async () => {
		const { container } = render(Logo, { class: 'size-10' });
		const mark = container.querySelector('.logo-mark');
		expect(mark?.getAttribute('aria-hidden')).toBe('true');
		expect(mark?.getAttribute('role')).toBeNull();
		expect(mark?.classList.contains('size-10')).toBe(true);
		expect(mark?.querySelector('svg')).not.toBeNull();
	});

	it('is an accessible image when labelled', async () => {
		render(Logo, { label: 'Home Work Hours Tracker' });
		await expect
			.element(page.getByRole('img', { name: 'Home Work Hours Tracker' }))
			.toBeInTheDocument();
	});
});
