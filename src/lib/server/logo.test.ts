import { describe, expect, it } from 'vitest';
import { loadLogoBuffer } from './logo';

describe('loadLogoBuffer', () => {
	it('reads the logo mark PNG from static/brand', () => {
		const buffer = loadLogoBuffer();
		expect(buffer.length).toBeGreaterThan(0);
		// A PNG file signature, so a future asset swap that breaks the path fails loudly here
		// rather than only inside a generated .xlsx nobody opens.
		expect(buffer.subarray(0, 8)).toEqual(
			Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
		);
	});

	it('caches the buffer across calls', () => {
		expect(loadLogoBuffer()).toBe(loadLogoBuffer());
	});
});
