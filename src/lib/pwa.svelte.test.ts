import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerServiceWorker } from './pwa';

describe('registerServiceWorker', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('registers the service worker when the API is available', async () => {
		const register = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal('navigator', { serviceWorker: { register } });

		registerServiceWorker();

		expect(register).toHaveBeenCalledWith('/service-worker.js');
	});

	it('swallows a registration failure', async () => {
		const register = vi.fn().mockRejectedValue(new Error('nope'));
		vi.stubGlobal('navigator', { serviceWorker: { register } });

		expect(() => registerServiceWorker()).not.toThrow();
		await Promise.resolve(); // let the rejection's .catch() run
	});

	it('does nothing when the API is unavailable', () => {
		vi.stubGlobal('navigator', {});

		expect(() => registerServiceWorker()).not.toThrow();
	});
});
