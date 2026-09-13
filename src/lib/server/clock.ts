// "Today" for the server. Dates are local to the process timezone (TZ, which Unraid passes to
// containers), never the UTC day that `toISOString().slice(0, 10)` would give.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The calendar date (YYYY-MM-DD) of `instant` in `timeZone` (default: the process TZ). */
export function localIsoDate(instant: Date, timeZone?: string): string {
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).formatToParts(instant);
	const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
	return `${byType.year}-${byType.month}-${byType.day}`;
}

export interface ClockEnv {
	TZ?: string;
	/** Pins "today" (YYYY-MM-DD) for deterministic E2E runs. Never set in production. */
	APP_FIXED_DATE?: string;
	// SvelteKit's $env/dynamic/private ambient type is generated from whichever env vars are
	// literally present when `svelte-kit sync` runs, so it won't always include TZ/APP_FIXED_DATE
	// by name (e.g. no local .env in CI). Without an index signature here, TypeScript's "weak
	// type" check (all-optional properties, no name in common) rejects passing that env object
	// in, even though it's structurally compatible. The index signature fixes that for good,
	// rather than by accident of which vars happen to exist at sync time.
	[key: string]: string | undefined;
}

/** Today's local date as YYYY-MM-DD. */
export function today(env: ClockEnv, now: Date = new Date()): string {
	if (env.APP_FIXED_DATE) {
		if (!ISO_DATE.test(env.APP_FIXED_DATE)) {
			throw new Error('APP_FIXED_DATE must be a date in YYYY-MM-DD format');
		}
		return env.APP_FIXED_DATE;
	}
	return localIsoDate(now, env.TZ || undefined);
}
