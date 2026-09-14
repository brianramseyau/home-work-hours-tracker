import { afterEach, describe, expect, it, vi } from 'vitest';
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

	async function withMockedAsset(dataUri: string): Promise<() => Buffer> {
		vi.resetModules();
		vi.doMock('$lib/assets/logo-mark-light.png?inline', () => ({ default: dataUri }));
		const { loadLogoBuffer: loadWithMockedAsset } = await import('./logo');
		return loadWithMockedAsset;
	}

	afterEach(() => {
		vi.doUnmock('$lib/assets/logo-mark-light.png?inline');
		vi.resetModules();
	});

	it('throws loudly rather than embedding corrupt bytes if the ?inline import is not a data URI at all', async () => {
		const load = await withMockedAsset('not-a-data-uri');
		expect(() => load()).toThrow(/Expected a base64 data: URI/);
	});

	it('throws loudly for a data URI that is not base64-encoded (e.g. URL-encoded)', async () => {
		// Satisfies a naive "starts with data: and has a comma" check, which is exactly why the
		// guard specifically requires the `;base64,` marker instead.
		const load = await withMockedAsset('data:image/svg+xml,%3Csvg%3E%3C/svg%3E');
		expect(() => load()).toThrow(/Expected a base64 data: URI/);
	});

	it('throws loudly if the decoded bytes are not a PNG (wrong asset swapped in)', async () => {
		const notAPng = Buffer.from('not a png').toString('base64');
		const load = await withMockedAsset(`data:image/png;base64,${notAPng}`);
		expect(() => load()).toThrow(/does not start with a PNG signature/);
	});
});
