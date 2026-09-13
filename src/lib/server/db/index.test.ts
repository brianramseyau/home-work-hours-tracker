import { afterEach, describe, expect, it, vi } from 'vitest';

async function importWithEnv(env: Record<string, string | undefined>) {
	vi.resetModules();
	vi.doMock('$env/dynamic/private', () => ({ env }));
	return import('./index');
}

afterEach(() => {
	vi.doUnmock('$env/dynamic/private');
});

describe('db singleton', () => {
	it('throws when DATABASE_URL is missing', async () => {
		await expect(importWithEnv({})).rejects.toThrow('DATABASE_URL is not set');
	});

	it('opens and migrates the configured database', async () => {
		const { db } = await importWithEnv({ DATABASE_URL: ':memory:' });
		expect(db.$client.pragma('foreign_keys', { simple: true })).toBe(1);
	});

	it('honours MIGRATIONS_FOLDER', async () => {
		await expect(
			importWithEnv({ DATABASE_URL: ':memory:', MIGRATIONS_FOLDER: '/nonexistent/migrations' })
		).rejects.toThrow();
	});
});
