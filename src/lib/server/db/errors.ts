// better-sqlite3 throws a SqliteError with this code for a UNIQUE constraint violation. Actions
// that insert or rename into a unique column (office names, schedule effective-from dates,
// custom holidays) check this instead of pre-querying for a collision, since the constraint is
// the single source of truth and a pre-check would still race a concurrent request.
export function isUniqueConstraintError(error: unknown): boolean {
	return (
		error instanceof Error &&
		'code' in error &&
		(error as { code?: unknown }).code === 'SQLITE_CONSTRAINT_UNIQUE'
	);
}
