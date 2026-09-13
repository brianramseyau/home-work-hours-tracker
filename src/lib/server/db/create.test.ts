import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createDb } from './create';
import { settings } from './schema';

const tempDirs: string[] = [];
function tempDir() {
	const dir = mkdtempSync(join(tmpdir(), 'hwht-db-'));
	tempDirs.push(dir);
	return dir;
}

afterEach(() => {
	for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** Writes a one-migration drizzle folder that leaves a foreign-key violation behind. */
function violatingMigrations(): string {
	const folder = join(tempDir(), 'migrations');
	mkdirSync(join(folder, 'meta'), { recursive: true });
	writeFileSync(
		join(folder, 'meta', '_journal.json'),
		JSON.stringify({
			version: '7',
			dialect: 'sqlite',
			entries: [{ idx: 0, version: '6', when: 1, tag: '0000_bad', breakpoints: true }]
		})
	);
	writeFileSync(
		join(folder, '0000_bad.sql'),
		[
			'CREATE TABLE parent (id integer PRIMARY KEY);',
			'--> statement-breakpoint',
			'CREATE TABLE child (id integer PRIMARY KEY, parent_id integer REFERENCES parent(id));',
			'--> statement-breakpoint',
			'INSERT INTO child (id, parent_id) VALUES (1, 42);'
		].join('\n')
	);
	return folder;
}

describe('createDb', () => {
	it('migrates an in-memory database and enforces foreign keys afterwards', () => {
		const db = createDb(':memory:');
		expect(db.select().from(settings).all()).toEqual([]);
		expect(db.$client.pragma('foreign_keys', { simple: true })).toBe(1);
	});

	it('creates the parent directory for a file database', () => {
		const path = join(tempDir(), 'nested', 'dir', 'test.db');
		const db = createDb(path);
		expect(existsSync(path)).toBe(true);
		db.$client.close();
	});

	it('refuses to boot when migrations leave foreign key violations', () => {
		expect(() => createDb(':memory:', violatingMigrations())).toThrow(
			/Migration left 1 foreign key violation/
		);
	});
});
