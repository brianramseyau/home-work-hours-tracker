import { describe, expect, it } from 'vitest';
import { blockedPath, buildMatchers, formatFinding, isBinary, parseTerms, scan } from './scan.mjs';

// Synthetic terms only; this repo is public (AGENTS.md §1).
const TERMS = ['Doe', 'Office Location 9', 'a.b'];

describe('parseTerms', () => {
	it('trims lines and drops blanks and comments', () => {
		expect(parseTerms('# comment\n  Doe  \n\r\nOffice Location 9\r\n#another\n')).toEqual([
			'Doe',
			'Office Location 9'
		]);
	});

	it('returns nothing for an empty denylist', () => {
		expect(parseTerms('')).toEqual([]);
	});
});

describe('buildMatchers', () => {
	const [doe, office, dotted] = buildMatchers(TERMS);

	it('numbers terms from 1', () => {
		expect([doe.index, office.index, dotted.index]).toEqual([1, 2, 3]);
	});

	it('matches whole words case-insensitively', () => {
		expect(doe.pattern.test('Signed, John doe.')).toBe(true);
		expect(doe.pattern.test('doe-notes.md')).toBe(true);
		expect(doe.pattern.test('Doer of things')).toBe(false);
		expect(doe.pattern.test('JohnDoe')).toBe(false);
		expect(doe.pattern.test('Doe2')).toBe(false);
	});

	it('matches multi-word terms', () => {
		expect(office.pattern.test('Worked at office location 9 today')).toBe(true);
		expect(office.pattern.test('Office Location 99')).toBe(false);
	});

	it('treats regex characters literally', () => {
		expect(dotted.pattern.test('a.b')).toBe(true);
		expect(dotted.pattern.test('axb')).toBe(false);
	});

	it('uses unicode-aware word boundaries', () => {
		const [jose] = buildMatchers(['José']);
		expect(jose.pattern.test('José went home')).toBe(true);
		expect(jose.pattern.test('Josééé')).toBe(false);
	});
});

describe('blockedPath', () => {
	it.each([
		['Home Work Diary FY26.xlsx', 'spreadsheet or database file'],
		['exports/REPORT.XLSX', 'spreadsheet or database file'],
		['legacy.xls', 'spreadsheet or database file'],
		['dump.csv', 'spreadsheet or database file'],
		['local.db', 'spreadsheet or database file'],
		['x.db-wal', 'spreadsheet or database file'],
		['data', 'local data directory'],
		['data/home-work-hours.db', 'local data directory'],
		['.env', 'environment file'],
		['.env.local', 'environment file'],
		['nested/.env.production', 'environment file'],
		['.pii-denylist', 'PII denylist']
	])('blocks %s', (path, reason) => {
		expect(blockedPath(path)).toBe(reason);
	});

	it.each(['.env.example', 'src/lib/data.ts', 'README.md', 'metadata/notes.md'])(
		'allows %s',
		(path) => {
			expect(blockedPath(path)).toBeNull();
		}
	);
});

describe('isBinary', () => {
	it('detects NUL bytes', () => {
		expect(isBinary(new Uint8Array([0x89, 0x50, 0x00, 0x47]))).toBe(true);
		expect(isBinary(new TextEncoder().encode('plain text'))).toBe(false);
	});
});

describe('scan', () => {
	it('reports line numbers for content matches, string or bytes', () => {
		const { findings, blocked } = scan(
			[
				{ path: 'notes.md', content: 'first line\nsecond line mentions Doe\n' },
				{ path: 'b.txt', content: new TextEncoder().encode('Office Location 9\r\nok') }
			],
			TERMS
		);
		expect(blocked).toEqual([]);
		expect(findings).toEqual([
			{ path: 'notes.md', line: 2, term: 1 },
			{ path: 'b.txt', line: 1, term: 2 }
		]);
	});

	it('reports matches in the file path as line 0', () => {
		const { findings } = scan([{ path: 'docs/doe-notes.md', content: 'clean' }], TERMS);
		expect(findings).toEqual([{ path: 'docs/doe-notes.md', line: 0, term: 1 }]);
	});

	it('skips the contents of binary files but still checks their path', () => {
		const bytes = new Uint8Array([...new TextEncoder().encode('Doe'), 0]);
		const { findings, blocked } = scan([{ path: 'photo-doe.png', content: bytes }], TERMS);
		expect(findings).toEqual([{ path: 'photo-doe.png', line: 0, term: 1 }]);
		expect(blocked).toEqual([]);
	});

	it('blocks forbidden paths even with no terms configured', () => {
		const { findings, blocked } = scan(
			[
				{ path: 'Home Work Diary FY27.xlsx', content: new Uint8Array([0]) },
				{ path: 'src/app.ts', content: 'John Doe' }
			],
			[]
		);
		expect(findings).toEqual([]);
		expect(blocked).toEqual([
			{ path: 'Home Work Diary FY27.xlsx', reason: 'spreadsheet or database file' }
		]);
	});
});

describe('formatFinding', () => {
	it('never includes the matched term', () => {
		const line = formatFinding({ path: 'notes.md', line: 2, term: 1 });
		expect(line).toBe('notes.md:2  matches denylist term #1');
		expect(line).not.toMatch(/doe/i);
	});

	it('labels file-name matches', () => {
		expect(formatFinding({ path: 'doe.md', line: 0, term: 3 })).toBe(
			'doe.md (file name)  matches denylist term #3'
		);
	});
});
