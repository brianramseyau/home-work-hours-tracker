// The `financial_years` table.

import { eq } from 'drizzle-orm';
import type { Db } from '../db/create';
import { financialYears } from '../db/schema';

export type FinancialYear = typeof financialYears.$inferSelect;

export function listYears(db: Db): FinancialYear[] {
	return db.select().from(financialYears).orderBy(financialYears.startYear).all();
}

export function getYear(db: Db, startYear: number): FinancialYear | null {
	return (
		db.select().from(financialYears).where(eq(financialYears.startYear, startYear)).get() ?? null
	);
}

export function createYear(
	db: Db,
	input: { startYear: number; rateCentsPerHour: number; rateNote?: string | null }
): FinancialYear {
	return db
		.insert(financialYears)
		.values({
			startYear: input.startYear,
			rateCentsPerHour: input.rateCentsPerHour,
			rateNote: input.rateNote ?? null
		})
		.returning()
		.get();
}

export function updateYearRate(
	db: Db,
	startYear: number,
	input: { rateCentsPerHour: number; rateNote?: string | null }
): FinancialYear {
	return db
		.update(financialYears)
		.set({ rateCentsPerHour: input.rateCentsPerHour, rateNote: input.rateNote ?? null })
		.where(eq(financialYears.startYear, startYear))
		.returning()
		.get();
}

export function finaliseYear(db: Db, startYear: number, finalisedAt: string): FinancialYear {
	return db
		.update(financialYears)
		.set({ finalisedAt })
		.where(eq(financialYears.startYear, startYear))
		.returning()
		.get();
}

export function unfinaliseYear(db: Db, startYear: number): FinancialYear {
	return db
		.update(financialYears)
		.set({ finalisedAt: null })
		.where(eq(financialYears.startYear, startYear))
		.returning()
		.get();
}
