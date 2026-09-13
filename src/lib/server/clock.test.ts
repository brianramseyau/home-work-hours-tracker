import { describe, expect, it } from 'vitest';
import { localIsoDate, today } from './clock';

// 15:30 UTC on 13 Sep is 01:30 on 14 Sep in Melbourne (AEST, UTC+10).
const LATE_UTC = new Date('2026-09-13T15:30:00Z');

describe('localIsoDate', () => {
	it('returns the local calendar day, not the UTC day', () => {
		expect(localIsoDate(LATE_UTC, 'Australia/Melbourne')).toBe('2026-09-14');
		expect(localIsoDate(LATE_UTC, 'UTC')).toBe('2026-09-13');
	});

	it('handles daylight saving time (AEDT, UTC+11)', () => {
		expect(localIsoDate(new Date('2026-12-31T13:30:00Z'), 'Australia/Melbourne')).toBe(
			'2027-01-01'
		);
	});
});

describe('today', () => {
	it('uses TZ when set', () => {
		expect(today({ TZ: 'Australia/Melbourne' }, LATE_UTC)).toBe('2026-09-14');
	});

	it('falls back to the process timezone when TZ is empty', () => {
		expect(today({ TZ: '' }, LATE_UTC)).toBe(localIsoDate(LATE_UTC));
	});

	it('defaults to now', () => {
		expect(today({ TZ: 'UTC' })).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});

	it('honours APP_FIXED_DATE', () => {
		expect(today({ TZ: 'UTC', APP_FIXED_DATE: '2026-09-14' }, LATE_UTC)).toBe('2026-09-14');
	});

	it('rejects a malformed APP_FIXED_DATE', () => {
		expect(() => today({ APP_FIXED_DATE: '14/09/2026' })).toThrow(/YYYY-MM-DD/);
	});
});
