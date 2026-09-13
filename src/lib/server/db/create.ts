import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import * as schema from './schema';

export type Db = BetterSQLite3Database<typeof schema> & { $client: Database.Database };

/**
 * Opens (creating if needed) the SQLite database at `path`, applies pending migrations and
 * returns a Drizzle client. `:memory:` gives an isolated, fully migrated db for tests.
 */
export function createDb(path: string, migrationsFolder = 'drizzle'): Db {
	if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });

	const client = new Database(path);

	// SQLite implements column-constraint changes (e.g. dropping NOT NULL) as a table
	// rebuild (CREATE __new_x / INSERT SELECT / DROP x / RENAME). With foreign keys
	// enforced — which better-sqlite3 does by default, unlike the sqlite3 CLI — the DROP
	// cascades into any table referencing x and silently deletes rows the rebuild meant
	// to preserve. drizzle-kit does emit `PRAGMA foreign_keys=OFF` around those blocks,
	// but its migrator runs each migration inside BEGIN/COMMIT and the pragma is a no-op
	// within a transaction. Setting it here, before migrate() opens one, is what actually
	// takes effect.
	client.pragma('foreign_keys = OFF');

	const db = drizzle(client, { schema });

	// Applies any pending migrations on boot, so local dev and the Docker image (which ships
	// without the drizzle-kit CLI) always end up on the same schema.
	migrate(db, { migrationsFolder });

	// Step 10 of SQLite's documented table-rebuild procedure: confirm the rebuild left
	// nothing dangling before enforcement is restored for the app's own queries. A
	// migration that boots "successfully" onto a corrupted relational state is worse
	// than one that refuses to boot at all.
	const violations = client.pragma('foreign_key_check') as unknown[];
	if (violations.length > 0) {
		client.close();
		throw new Error(
			`Migration left ${violations.length} foreign key violation(s): ${JSON.stringify(violations)}`
		);
	}

	client.pragma('foreign_keys = ON');
	return db;
}
