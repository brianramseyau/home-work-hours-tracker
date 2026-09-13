// Pure PII-scanning logic behind scripts/check-pii.mjs (see AGENTS.md §1).
//
// This repository is public, so the scanner must never reveal the terms it looks for:
// findings identify a term only by its 1-based index in the denylist, never by its text.
// That matters most in CI, where logs on a public repo are world-readable.

/** File extensions that must never be committed (the owner's spreadsheets and databases). */
export const BLOCKED_EXTENSIONS = [
	'.xlsx',
	'.xls',
	'.csv',
	'.db',
	'.db-journal',
	'.db-wal',
	'.db-shm'
];

/**
 * Parses a denylist: one term per line, `#` starts a comment line, blank lines ignored.
 * @param {string} text
 * @returns {string[]}
 */
export function parseTerms(text) {
	return text
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line !== '' && !line.startsWith('#'));
}

/** @param {string} value */
function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Case-insensitive, whole-word matchers. "Whole word" means the term isn't directly
 * preceded or followed by a letter or digit, so a term matches inside `doe-notes.md` or
 * `"Doe,"` but not inside `Doer`.
 * @param {string[]} terms
 * @returns {{ index: number; pattern: RegExp }[]}
 */
export function buildMatchers(terms) {
	return terms.map((term, i) => ({
		index: i + 1,
		pattern: new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(term)}(?![\\p{L}\\p{N}])`, 'iu')
	}));
}

/**
 * Why a path must never be committed, or null if it's fine.
 * @param {string} path repo-relative, forward slashes
 * @returns {string | null}
 */
export function blockedPath(path) {
	const lower = path.toLowerCase();
	const base = lower.slice(lower.lastIndexOf('/') + 1);
	if (base === '.pii-denylist') return 'PII denylist';
	if (base === '.env' || (base.startsWith('.env.') && base !== '.env.example')) {
		return 'environment file';
	}
	if (lower === 'data' || lower.startsWith('data/')) return 'local data directory';
	if (BLOCKED_EXTENSIONS.some((ext) => base.endsWith(ext))) return 'spreadsheet or database file';
	return null;
}

/**
 * Binary files (images, fonts) are skipped for content scanning; their paths are still checked.
 * @param {Uint8Array} bytes
 */
export function isBinary(bytes) {
	return bytes.subarray(0, 8000).includes(0);
}

/**
 * @typedef {{ path: string; line: number; term: number }} Finding
 *   `line` 0 means the match is in the file path itself.
 * @typedef {{ path: string; reason: string }} Blocked
 * @typedef {{ path: string; content: string | Uint8Array }} ScanFile
 */

/**
 * @param {ScanFile[]} files
 * @param {string[]} terms
 * @returns {{ findings: Finding[]; blocked: Blocked[] }}
 */
export function scan(files, terms) {
	const matchers = buildMatchers(terms);
	/** @type {Finding[]} */
	const findings = [];
	/** @type {Blocked[]} */
	const blocked = [];

	for (const file of files) {
		const reason = blockedPath(file.path);
		if (reason) blocked.push({ path: file.path, reason });

		for (const { index, pattern } of matchers) {
			if (pattern.test(file.path)) findings.push({ path: file.path, line: 0, term: index });
		}

		let text;
		if (typeof file.content === 'string') {
			text = file.content;
		} else if (isBinary(file.content)) {
			continue;
		} else {
			text = new TextDecoder().decode(file.content);
		}

		const lines = text.split(/\r?\n/);
		lines.forEach((line, i) => {
			for (const { index, pattern } of matchers) {
				if (pattern.test(line)) findings.push({ path: file.path, line: i + 1, term: index });
			}
		});
	}

	return { findings, blocked };
}

/**
 * Human-readable location of a finding that deliberately omits the matched text.
 * @param {Finding} finding
 */
export function formatFinding(finding) {
	const where =
		finding.line === 0 ? `${finding.path} (file name)` : `${finding.path}:${finding.line}`;
	return `${where}  matches denylist term #${finding.term}`;
}
