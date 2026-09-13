import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { navItems } from '$lib/nav';
import NavLinks from './NavLinks.svelte';

const items = navItems('fy27');

describe('NavLinks', () => {
	it.each(['rail', 'tabs'] as const)('renders every section as a %s', async (variant) => {
		render(NavLinks, { items, pathname: '/fy27/year', variant });

		const nav = page.getByRole('navigation', { name: 'Primary' });
		await expect.element(nav).toBeInTheDocument();
		await expect.element(nav.getByRole('link', { name: 'Week' })).toHaveAttribute('href', '/fy27');
		await expect
			.element(nav.getByRole('link', { name: 'Settings' }))
			.toHaveAttribute('href', '/settings');
	});

	it('marks only the current section', async () => {
		render(NavLinks, { items, pathname: '/fy27/year', variant: 'rail' });

		await expect
			.element(page.getByRole('link', { name: 'Year' }))
			.toHaveAttribute('aria-current', 'page');
		await expect
			.element(page.getByRole('link', { name: 'Week' }))
			.not.toHaveAttribute('aria-current');
	});
});
