// The `holidays` table: the bundled seed plus any custom rows, per region.

import { and, asc, eq } from 'drizzle-orm';
import type { Db } from '../db/create';
import { holidays } from '../db/schema';

export type Holiday = typeof holidays.$inferSelect;

export function listHolidays(db: Db, region: string): Holiday[] {
	return db
		.select()
		.from(holidays)
		.where(eq(holidays.region, region))
		.orderBy(asc(holidays.date))
		.all();
}

/**
 * Replaces the bundled rows for `region` with `rows`, leaving custom rows untouched. Used on
 * first setup and whenever the holiday region setting changes.
 */
export function replaceBundledHolidays(
	db: Db,
	region: string,
	rows: { date: string; name: string }[]
): void {
	db.transaction((tx) => {
		tx.delete(holidays)
			.where(and(eq(holidays.region, region), eq(holidays.source, 'bundled')))
			.run();
		if (rows.length > 0) {
			tx.insert(holidays)
				.values(rows.map((row) => ({ ...row, region, source: 'bundled' as const })))
				.run();
		}
	});
}

export function addCustomHoliday(
	db: Db,
	input: { date: string; name: string; region: string; repeatsYearly: boolean }
): Holiday {
	return db
		.insert(holidays)
		.values({ ...input, source: 'custom', disabled: false })
		.returning()
		.get();
}

export function setHolidayDisabled(db: Db, id: number, disabled: boolean): Holiday {
	return db.update(holidays).set({ disabled }).where(eq(holidays.id, id)).returning().get();
}

export function deleteHoliday(db: Db, id: number): void {
	db.delete(holidays).where(eq(holidays.id, id)).run();
}
