import { describe, expect, it } from 'vitest';
import { loadLogoBuffer } from './logo';

describe('loadLogoBuffer', () => {
	it('decodes the bundled logo mark PNG', () => {
		const buffer = loadLogoBuffer();
		expect(buffer.length).toBeGreaterThan(0);
		// A PNG file signature, so a future asset swap that breaks the encoding fails loudly here
		// rather than only inside a generated .xlsx nobody opens.
		expect(buffer.subarray(0, 8)).toEqual(
			Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
		);
	});
});
