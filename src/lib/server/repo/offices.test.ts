import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '../db/create';
import { archiveOffice, createOffice, listOffices, unarchiveOffice, updateOffice } from './offices';

let db: Db;

beforeEach(() => {
	db = createDb(':memory:');
});

describe('createOffice and listOffices', () => {
	it('creates offices and lists them alphabetically', () => {
		createOffice(db, { name: 'Office Location 2' });
		createOffice(db, { name: 'Office Location 1', address: '123 Example St, Sampletown VIC 3000' });
		expect(listOffices(db).map((office) => office.name)).toEqual([
			'Office Location 1',
			'Office Location 2'
		]);
	});

	it('defaults a missing address to null', () => {
		const office = createOffice(db, { name: 'Office Location 1' });
		expect(office.address).toBeNull();
	});
});

describe('updateOffice', () => {
	it('renames an office and updates its address', () => {
		const office = createOffice(db, { name: 'Office Location 1' });
		const updated = updateOffice(db, office.id, {
			name: 'Office Location 1 (renamed)',
			address: '123 Example St, Sampletown VIC 3000'
		});
		expect(updated.name).toBe('Office Location 1 (renamed)');
		expect(updated.address).toBe('123 Example St, Sampletown VIC 3000');
	});

	it('defaults a missing address to null', () => {
		const office = createOffice(db, {
			name: 'Office Location 1',
			address: '123 Example St, Sampletown VIC 3000'
		});
		const updated = updateOffice(db, office.id, { name: 'Office Location 1' });
		expect(updated.address).toBeNull();
	});
});

describe('archiveOffice and listOffices filtering', () => {
	it('excludes archived offices by default, and includes them on request', () => {
		const office = createOffice(db, { name: 'Office Location 1' });
		createOffice(db, { name: 'Office Location 2' });
		archiveOffice(db, office.id, '2027-01-01');

		expect(listOffices(db).map((o) => o.name)).toEqual(['Office Location 2']);
		expect(listOffices(db, { includeArchived: true }).map((o) => o.name)).toEqual([
			'Office Location 1',
			'Office Location 2'
		]);
	});
});

describe('unarchiveOffice', () => {
	it('brings an archived office back into the default listing', () => {
		const office = createOffice(db, { name: 'Office Location 1' });
		archiveOffice(db, office.id, '2027-01-01');
		expect(listOffices(db)).toEqual([]);

		unarchiveOffice(db, office.id);
		expect(listOffices(db).map((o) => o.name)).toEqual(['Office Location 1']);
	});
});
