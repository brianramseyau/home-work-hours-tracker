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

const BASE64_MARKER = ';base64,';
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function loadLogoBuffer(): Buffer {
	// Guarded rather than assumed: if a future Vite version ever resolves `?inline` to something
	// other than a base64 data: URI (e.g. a plain URL, or a URL-encoded data URI), this throws
	// loudly instead of quietly embedding corrupt bytes in every generated workbook. Checking for
	// `;base64,` specifically (not just any comma) matters because `Buffer.from(x, 'base64')`
	// never throws on malformed input — it silently drops invalid characters — so a non-base64
	// payload would otherwise decode "successfully" into garbage. The PNG signature check below
	// is the same defence one layer further in: even a well-formed base64 payload could be the
	// wrong asset.
	const markerIndex = logoDataUri.indexOf(BASE64_MARKER);
	if (!logoDataUri.startsWith('data:') || markerIndex === -1) {
		throw new Error(
			`Expected a base64 data: URI for the logo asset, got "${logoDataUri.slice(0, 40)}…"`
		);
	}
	const buffer = Buffer.from(logoDataUri.slice(markerIndex + BASE64_MARKER.length), 'base64');
	if (!buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
		throw new Error('Decoded logo asset does not start with a PNG signature');
	}
	return buffer;
}
