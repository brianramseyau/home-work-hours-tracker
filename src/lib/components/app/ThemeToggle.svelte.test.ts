import { page } from 'vitest/browser';
import { setMode } from 'mode-watcher';
import { beforeEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ThemeToggle from './ThemeToggle.svelte';

describe('ThemeToggle', () => {
	beforeEach(() => {
		setMode('light');
	});

	it('switches from light to dark and back', async () => {
		render(ThemeToggle);

		await page.getByRole('button', { name: 'Use dark theme' }).click();
		await expect.element(page.getByRole('button', { name: 'Use light theme' })).toBeInTheDocument();

		await page.getByRole('button', { name: 'Use light theme' }).click();
		await expect.element(page.getByRole('button', { name: 'Use dark theme' })).toBeInTheDocument();
	});
});
