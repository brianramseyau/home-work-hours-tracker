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

const DATA_URI_PREFIX = 'data:';

export function loadLogoBuffer(): Buffer {
	// Guarded rather than assumed: if a future Vite version ever resolves `?inline` to something
	// other than a base64 data: URI (e.g. a plain URL, or a differently-encoded data URI), this
	// throws loudly instead of quietly embedding corrupt bytes in every generated workbook.
	const commaIndex = logoDataUri.indexOf(',');
	if (!logoDataUri.startsWith(DATA_URI_PREFIX) || commaIndex === -1) {
		throw new Error(
			`Expected a base64 data: URI for the logo asset, got "${logoDataUri.slice(0, 40)}…"`
		);
	}
	return Buffer.from(logoDataUri.slice(commaIndex + 1), 'base64');
}
