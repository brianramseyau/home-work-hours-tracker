import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '../db/create';
import { getSettings, setPrefilledThrough, updateSettings } from './settings';

let db: Db;

beforeEach(() => {
	db = createDb(':memory:');
});

describe('getSettings', () => {
	it('inserts the defaults on first read', () => {
		expect(getSettings(db)).toEqual({
			id: 1,
			fullName: null,
			holidayRegion: 'AU-VIC',
			standardStart: '09:00',
			standardEnd: '17:06',
			standardBreakMinutes: 30,
			includeWeekends: false,
			prefilledThrough: null
		});
	});

	it('returns the same row on a second read', () => {
		getSettings(db);
		expect(getSettings(db).id).toBe(1);
	});
});

describe('updateSettings', () => {
	it('patches the fields given, leaving the rest untouched', () => {
		updateSettings(db, { fullName: 'John Doe' });
		const updated = updateSettings(db, { standardBreakMinutes: 45 });
		expect(updated.fullName).toBe('John Doe');
		expect(updated.standardBreakMinutes).toBe(45);
	});

	it('creates the row first if updateSettings is called before any read', () => {
		expect(updateSettings(db, { includeWeekends: true }).includeWeekends).toBe(true);
	});
});

describe('setPrefilledThrough', () => {
	it('moves the watermark', () => {
		expect(setPrefilledThrough(db, '2026-09-14').prefilledThrough).toBe('2026-09-14');
	});
});
