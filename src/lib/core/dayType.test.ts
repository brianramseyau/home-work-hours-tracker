import { describe, expect, it } from 'vitest';
import { displayType } from './dayType';

const base = { kind: 'work' as const, officeId: null as number | null, blocks: [] as never[] };

describe('displayType', () => {
	it('is home for a work day with blocks and no office', () => {
		expect(
			displayType({ ...base, blocks: [{ start: '09:00', end: '17:06', breakMinutes: 30 }] })
		).toBe('home');
	});

	it('is office for a work day with an office and no blocks', () => {
		expect(displayType({ ...base, officeId: 1 })).toBe('office');
	});

	it('is split for a work day with both blocks and an office', () => {
		expect(
			displayType({
				...base,
				officeId: 1,
				blocks: [{ start: '09:00', end: '12:00', breakMinutes: 0 }]
			})
		).toBe('split');
	});

	it('is off for a work day with neither blocks nor an office', () => {
		expect(displayType(base)).toBe('off');
	});

	it('passes non-work kinds through unchanged', () => {
		expect(displayType({ ...base, kind: 'leave' })).toBe('leave');
		expect(displayType({ ...base, kind: 'sick' })).toBe('sick');
		expect(displayType({ ...base, kind: 'public_holiday' })).toBe('public_holiday');
		expect(displayType({ ...base, kind: 'off' })).toBe('off');
	});
});
