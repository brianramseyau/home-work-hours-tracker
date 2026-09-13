import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '../db/create';
import {
	createYear,
	finaliseYear,
	getYear,
	listYears,
	unfinaliseYear,
	updateYearRate
} from './years';

let db: Db;

beforeEach(() => {
	db = createDb(':memory:');
});

describe('createYear and getYear', () => {
	it('creates a year and reads it back', () => {
		createYear(db, { startYear: 2026, rateCentsPerHour: 70 });
		expect(getYear(db, 2026)).toMatchObject({
			startYear: 2026,
			rateCentsPerHour: 70,
			rateNote: null
		});
	});

	it('accepts a rate note', () => {
		createYear(db, { startYear: 2026, rateCentsPerHour: 70, rateNote: 'ATO fixed rate' });
		expect(getYear(db, 2026)?.rateNote).toBe('ATO fixed rate');
	});

	it('is null for a year that does not exist', () => {
		expect(getYear(db, 2030)).toBeNull();
	});
});

describe('listYears', () => {
	it('lists years in startYear order', () => {
		createYear(db, { startYear: 2027, rateCentsPerHour: 72 });
		createYear(db, { startYear: 2026, rateCentsPerHour: 70 });
		expect(listYears(db).map((year) => year.startYear)).toEqual([2026, 2027]);
	});
});

describe('updateYearRate', () => {
	it('changes the rate and note', () => {
		createYear(db, { startYear: 2026, rateCentsPerHour: 70 });
		const updated = updateYearRate(db, 2026, { rateCentsPerHour: 75, rateNote: 'Rate rise' });
		expect(updated.rateCentsPerHour).toBe(75);
		expect(updated.rateNote).toBe('Rate rise');
	});

	it('defaults a missing note to null', () => {
		createYear(db, { startYear: 2026, rateCentsPerHour: 70, rateNote: 'Old note' });
		const updated = updateYearRate(db, 2026, { rateCentsPerHour: 75 });
		expect(updated.rateNote).toBeNull();
	});
});

describe('finaliseYear and unfinaliseYear', () => {
	it('sets and clears finalisedAt', () => {
		createYear(db, { startYear: 2026, rateCentsPerHour: 70 });
		const finalised = finaliseYear(db, 2026, '2027-07-15');
		expect(finalised.finalisedAt).toBe('2027-07-15');

		const reopened = unfinaliseYear(db, 2026);
		expect(reopened.finalisedAt).toBeNull();
	});
});
