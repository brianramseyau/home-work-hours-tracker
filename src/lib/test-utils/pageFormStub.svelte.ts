// A minimal, reactive stand-in for `$app/state`'s `page` store, for component tests that need to
// drive `page.form` (the last form action's result) without a real SvelteKit server round trip.
// Excluded from coverage as test-only code (vite.config.ts).
//
// Usage: `vi.mock('$app/state', () => import('$lib/test-utils/pageFormStub.svelte.ts'))`, then
// import `setPageForm`/`resetPageForm` from the same module to drive it within a test.

export type PageFormResult = Record<string, unknown> | null;

let form = $state<PageFormResult>(null);

export const page = {
	get form() {
		return form;
	}
};

export function setPageForm(value: PageFormResult): void {
	form = value;
}

export function resetPageForm(): void {
	form = null;
}
