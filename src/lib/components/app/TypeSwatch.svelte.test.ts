import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import TypeSwatch from './TypeSwatch.svelte';

describe('TypeSwatch', () => {
	it('renders a distinct pattern for every display type', () => {
		const types = ['home', 'office', 'split', 'leave', 'sick', 'public_holiday', 'off'] as const;
		for (const type of types) {
			const { container, unmount } = render(TypeSwatch, { type });
			expect(container.querySelector('span')).not.toBeNull();
			unmount();
		}
	});

	it('renders a faint hatch for a future day, regardless of its type', () => {
		const { container } = render(TypeSwatch, { type: 'home', future: true });
		const swatch = container.querySelector('span');
		expect(swatch?.className).toContain('pattern-hatch');
		expect(swatch?.className).toContain('opacity-30');
	});
});
