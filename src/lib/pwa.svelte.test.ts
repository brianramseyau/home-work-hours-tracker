import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerServiceWorker } from './pwa';

describe('registerServiceWorker', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('registers the service worker in production when the API is available', async () => {
		const register = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal('navigator', { serviceWorker: { register } });

		registerServiceWorker(true);

		expect(register).toHaveBeenCalledWith('/service-worker.js');
	});

	it('swallows a registration failure', async () => {
		const register = vi.fn().mockRejectedValue(new Error('nope'));
		vi.stubGlobal('navigator', { serviceWorker: { register } });

		expect(() => registerServiceWorker(true)).not.toThrow();
		await Promise.resolve(); // let the rejection's .catch() run
	});

	it('does nothing when the API is unavailable', () => {
		vi.stubGlobal('navigator', {});

		expect(() => registerServiceWorker(true)).not.toThrow();
	});

	it('does nothing outside production (e.g. vite dev, which emits no Workbox worker)', () => {
		const register = vi.fn();
		vi.stubGlobal('navigator', { serviceWorker: { register } });

		registerServiceWorker(false);

		expect(register).not.toHaveBeenCalled();
	});
});
