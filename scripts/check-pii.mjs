#!/usr/bin/env node
// Blocks PII from reaching this PUBLIC repository (AGENTS.md §1).
//
//   node scripts/check-pii.mjs --staged              pre-commit: staged blobs (what will be committed)
//   node scripts/check-pii.mjs --commit-msg <file>   commit-msg hook
//   node scripts/check-pii.mjs --all                 every tracked file (CI)
//
// Terms come from the gitignored `.pii-denylist` (one per line, # comments) and/or the
// PII_DENYLIST env var (newline-separated; a GitHub Actions secret in CI). Output names a
// term only by its number, never its text, because CI logs on a public repo are public.
// The pure logic lives in ./pii/scan.mjs (unit tested); this file is thin git/fs glue.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { formatFinding, parseTerms, scan } from './pii/scan.mjs';

const [mode, arg] = process.argv.slice(2);

/** @param {string[]} args */
function git(args) {
	return execFileSync('git', args, { maxBuffer: 512 * 1024 * 1024 });
}

/** @param {Buffer} out */
function nulList(out) {
	return out.toString('utf8').split('\0').filter(Boolean);
}

function loadTerms() {
	const fromFile = existsSync('.pii-denylist') ? readFileSync('.pii-denylist', 'utf8') : '';
	return [...new Set([...parseTerms(process.env.PII_DENYLIST ?? ''), ...parseTerms(fromFile)])];
}

function stagedFiles() {
	return nulList(git(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'])).map(
		(path) => ({ path, content: git(['show', `:${path}`]) })
	);
}

function trackedFiles() {
	return nulList(git(['ls-files', '-z']))
		.filter((path) => existsSync(path) && statSync(path).isFile())
		.map((path) => ({ path, content: readFileSync(path) }));
}

/** @param {string | undefined} file */
function commitMessage(file) {
	if (!file) throw new Error('--commit-msg needs the message file path');
	return [{ path: 'commit message', content: readFileSync(file) }];
}

let files;
if (mode === '--staged') files = stagedFiles();
else if (mode === '--all') files = trackedFiles();
else if (mode === '--commit-msg') files = commitMessage(arg);
else {
	console.error('Usage: check-pii.mjs --staged | --all | --commit-msg <file>');
	process.exit(2);
}

const terms = loadTerms();
if (terms.length === 0) {
	if (process.env.CI) {
		console.error('✖ PII scan: no denylist terms configured. Set the PII_DENYLIST secret.');
		process.exit(1);
	}
	console.warn('⚠ PII scan: no .pii-denylist found. Only blocked file types are checked.');
}

const { findings, blocked } = scan(files, terms);

for (const b of blocked) console.error(`✖ ${b.path}: ${b.reason} must never be committed`);
for (const f of findings) console.error(`✖ ${formatFinding(f)}`);

if (blocked.length || findings.length) {
	console.error(
		`\nPII scan failed (${findings.length} match(es), ${blocked.length} blocked file(s)).` +
			'\nThis repo is public: replace real details with placeholders (John Doe, Office Location 1).' +
			'\nDo not bypass with --no-verify.'
	);
	process.exit(1);
}
console.log(`✔ PII scan passed (${files.length} item(s), ${terms.length} term(s)).`);
