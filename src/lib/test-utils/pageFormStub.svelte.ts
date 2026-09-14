// A minimal, reactive stand-in for `$app/state`'s `page` store and `$app/navigation`'s
// `pushState`/`replaceState`, for component tests that need to drive `page.form` (the last form
// action's result) and `page.state` (shallow-routing state) without a real SvelteKit server
// round trip or router. Excluded from coverage as test-only code (vite.config.ts).
//
// Usage: `vi.mock('$app/state', () => import('$lib/test-utils/pageFormStub.svelte'))` and/or
// `vi.mock('$app/navigation', () => import('$lib/test-utils/pageFormStub.svelte'))`, then import
// `setPageForm`/`resetPageForm`/`setPageState`/`resetPageState` to drive it within a test.

export type PageFormResult = Record<string, unknown> | null;
export type PageState = Record<string, unknown>;

let form = $state<PageFormResult>(null);
let state = $state<PageState>({});

export const page = {
	get form() {
		return form;
	},
	get state() {
		return state;
	}
};

export function setPageForm(value: PageFormResult): void {
	form = value;
}

export function resetPageForm(): void {
	form = null;
}

export function setPageState(value: PageState): void {
	state = value;
}

export function resetPageState(): void {
	state = {};
}

export function pushState(_url: string | URL, value: PageState): void {
	state = value;
}

export function replaceState(_url: string | URL, value: PageState): void {
	state = value;
}
