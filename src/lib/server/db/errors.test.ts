import { describe, expect, it } from 'vitest';
import { createDb, type Db } from './create';
import { isUniqueConstraintError } from './errors';
import { offices } from './schema';

describe('isUniqueConstraintError', () => {
	it('is true for a real UNIQUE constraint violation', () => {
		const db: Db = createDb(':memory:');
		db.insert(offices).values({ name: 'Office Location 1' }).run();
		try {
			db.insert(offices).values({ name: 'Office Location 1' }).run();
			throw new Error('expected the insert to throw');
		} catch (error) {
			expect(isUniqueConstraintError(error)).toBe(true);
		}
	});

	it('is false for an unrelated error', () => {
		expect(isUniqueConstraintError(new Error('boom'))).toBe(false);
	});

	it('is false for a non-Error value', () => {
		expect(isUniqueConstraintError('boom')).toBe(false);
	});
});
