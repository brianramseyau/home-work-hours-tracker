import { describe, expect, it } from 'vitest';
import {
	blockMinutes,
	formatHm,
	formatHours,
	formatMinutesAsHm,
	parseHm,
	toMinutes,
	validateBlock
} from './time';

describe('parseHm', () => {
	it('parses a valid HH:mm', () => {
		expect(parseHm('09:00')).toEqual({ hours: 9, minutes: 0 });
		expect(parseHm('23:59')).toEqual({ hours: 23, minutes: 59 });
	});

	it('rejects an invalid time', () => {
		expect(() => parseHm('24:00')).toThrow('Expected a time in HH:mm format');
		expect(() => parseHm('9:00')).toThrow('Expected a time in HH:mm format');
		expect(() => parseHm('09:60')).toThrow('Expected a time in HH:mm format');
	});
});

describe('toMinutes', () => {
	it('converts HH:mm to minutes since midnight', () => {
		expect(toMinutes('00:00')).toBe(0);
		expect(toMinutes('09:00')).toBe(540);
		expect(toMinutes('17:06')).toBe(1026);
	});
});

describe('formatHm', () => {
	it('pads to HH:mm', () => {
		expect(formatHm({ hours: 9, minutes: 0 })).toBe('09:00');
		expect(formatHm({ hours: 17, minutes: 6 })).toBe('17:06');
	});
});

describe('formatMinutesAsHm', () => {
	it('omits a zero minute remainder', () => {
		expect(formatMinutesAsHm(456)).toBe('7h 36m');
		expect(formatMinutesAsHm(420)).toBe('7h');
	});
});

describe('formatHours', () => {
	it('formats minutes as one decimal place of hours', () => {
		expect(formatHours(456)).toBe('7.6');
		expect(formatHours(30)).toBe('0.5');
	});
});

describe('validateBlock', () => {
	it('accepts the standard 09:00–17:06 / 30 min block', () => {
		expect(validateBlock({ start: '09:00', end: '17:06', breakMinutes: 30 })).toBeNull();
	});

	it('rejects an end time at or before the start', () => {
		expect(validateBlock({ start: '09:00', end: '09:00', breakMinutes: 0 })).toBe(
			'End time must be after start time'
		);
		expect(validateBlock({ start: '17:00', end: '09:00', breakMinutes: 0 })).toBe(
			'End time must be after start time'
		);
	});

	it('rejects a negative break', () => {
		expect(validateBlock({ start: '09:00', end: '17:00', breakMinutes: -1 })).toBe(
			'Break cannot be negative'
		);
	});

	it('rejects a break at or longer than the span', () => {
		expect(validateBlock({ start: '09:00', end: '10:00', breakMinutes: 60 })).toBe(
			'Break must be shorter than the time block'
		);
		expect(validateBlock({ start: '09:00', end: '10:00', breakMinutes: 90 })).toBe(
			'Break must be shorter than the time block'
		);
	});

	it('allows a zero-minute break', () => {
		expect(validateBlock({ start: '09:00', end: '10:00', breakMinutes: 0 })).toBeNull();
	});
});

describe('blockMinutes', () => {
	it('computes 7.6h for the standard block', () => {
		expect(blockMinutes({ start: '09:00', end: '17:06', breakMinutes: 30 })).toBe(456);
	});

	it('throws for an invalid block', () => {
		expect(() => blockMinutes({ start: '09:00', end: '09:00', breakMinutes: 0 })).toThrow(
			'End time must be after start time'
		);
	});
});
