import { describe, expect, it } from 'vitest';
import { prerender } from './+page';

describe('offline +page.ts', () => {
	it('is prerendered, so it exists as static HTML for the service worker to precache', () => {
		expect(prerender).toBe(true);
	});
});
