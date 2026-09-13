import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ErrorPage from './+error.svelte';

const state = vi.hoisted(() => ({
	page: {
		status: 404,
		error: null as { message: string } | null,
		url: new URL('http://localhost/nowhere')
	}
}));
vi.mock('$app/state', () => state);

describe('error page', () => {
	beforeEach(() => {
		state.page.status = 404;
		state.page.error = null;
	});

	it('explains a missing page', async () => {
		render(ErrorPage);
		await expect
			.element(page.getByRole('heading', { level: 1 }))
			.toHaveTextContent('This page is off the clock');
		await expect.element(page.getByText(/nothing at \/nowhere/)).toBeInTheDocument();
		await expect.element(page.getByText('Error 404')).toBeInTheDocument();
		await expect
			.element(page.getByRole('link', { name: 'Back to your diary' }))
			.toHaveAttribute('href', '/');
	});

	it('shows the error message for other failures', async () => {
		state.page.status = 500;
		state.page.error = { message: 'Database is locked' };
		render(ErrorPage);
		await expect
			.element(page.getByRole('heading', { level: 1 }))
			.toHaveTextContent('Something went wrong');
		await expect.element(page.getByText('Database is locked')).toBeInTheDocument();
	});

	it('falls back to a generic message when there is no error detail', async () => {
		state.page.status = 500;
		render(ErrorPage);
		await expect
			.element(page.getByText('An unexpected error stopped this page from loading.'))
			.toBeInTheDocument();
	});
});
