// The logo mark's PNG bytes, for the export's Summary title band. Isolated from `export.ts` so
// the workbook builder itself stays a pure function of its inputs (see AGENTS.md layering).
//
// Imported via Vite's `?inline` suffix (a base64 data: URI, embedded in the JS bundle at build
// time) rather than read from disk at request time: under adapter-node the build output is
// self-contained and nothing guarantees a `static/...`-relative path still exists relative to
// the server process's cwd once deployed (e.g. in the Docker image) — an `fs.readFileSync` here
// would 500 the export in production while working fine in dev, `vite preview` and vitest,
// which all happen to run from the repo root.
import logoDataUri from '$lib/assets/logo-mark-light.png?inline';

export function loadLogoBuffer(): Buffer {
	const base64 = logoDataUri.slice(logoDataUri.indexOf(',') + 1);
	return Buffer.from(base64, 'base64');
}
