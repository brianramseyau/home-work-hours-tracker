import { env } from '$env/dynamic/private';
import { createDb } from './create';

if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

// The app-wide connection. Opening it runs pending migrations (see create.ts); tests use
// createDb(':memory:') instead of importing this module.
export const db = createDb(env.DATABASE_URL, env.MIGRATIONS_FOLDER || 'drizzle');
