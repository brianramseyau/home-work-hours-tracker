import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db', () => ({ db: {} }));

describe('handle', () => {
	it('passes every request straight through to SvelteKit', async () => {
		const { handle } = await import('./hooks.server');
		const event = { url: new URL('http://localhost/') } as RequestEvent;
		const response = new Response('ok');
		const resolve = vi.fn().mockResolvedValue(response);

		await expect(handle({ event, resolve })).resolves.toBe(response);
		expect(resolve).toHaveBeenCalledWith(event);
	});
});
