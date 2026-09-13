// The `days` / `home_blocks` tables, mapped to and from the pure `core/dayType.ts` shape.

import { and, asc, eq, gte, lte } from 'drizzle-orm';
import type { Day } from '$lib/core/dayType';
import type { Db } from '../db/create';
import { days, homeBlocks } from '../db/schema';

function toDay(row: typeof days.$inferSelect, blocks: (typeof homeBlocks.$inferSelect)[]): Day {
	return {
		date: row.date,
		kind: row.kind,
		officeId: row.officeId,
		notes: row.notes,
		source: row.source,
		blocks: blocks
			.sort((a, b) => a.position - b.position)
			.map((block) => ({ start: block.start, end: block.end, breakMinutes: block.breakMinutes }))
	};
}

/** Every day row (with its blocks) between `from` and `to`, inclusive. */
export function listRange(db: Db, from: string, to: string): Day[] {
	const dayRows = db
		.select()
		.from(days)
		.where(and(gte(days.date, from), lte(days.date, to)))
		.orderBy(asc(days.date))
		.all();
	if (dayRows.length === 0) return [];

	const blockRows = db
		.select()
		.from(homeBlocks)
		.innerJoin(days, eq(homeBlocks.dayId, days.id))
		.where(and(gte(days.date, from), lte(days.date, to)))
		.all();

	const blocksByDayId = new Map<number, (typeof homeBlocks.$inferSelect)[]>();
	for (const { home_blocks: block } of blockRows) {
		const bucket = blocksByDayId.get(block.dayId) ?? [];
		bucket.push(block);
		blocksByDayId.set(block.dayId, bucket);
	}

	return dayRows.map((row) => toDay(row, blocksByDayId.get(row.id) ?? []));
}

export function getDay(db: Db, date: string): Day | null {
	const row = db.select().from(days).where(eq(days.date, date)).get();
	if (!row) return null;
	const blocks = db.select().from(homeBlocks).where(eq(homeBlocks.dayId, row.id)).all();
	return toDay(row, blocks);
}

/** Inserts or replaces the day at `day.date` and its blocks, in one transaction. */
export function upsertDay(db: Db, day: Day, updatedAt: string): Day {
	return db.transaction((tx) => {
		const existing = tx.select().from(days).where(eq(days.date, day.date)).get();

		const row = existing
			? tx
					.update(days)
					.set({
						kind: day.kind,
						officeId: day.officeId,
						notes: day.notes,
						source: day.source,
						updatedAt
					})
					.where(eq(days.id, existing.id))
					.returning()
					.get()
			: tx
					.insert(days)
					.values({
						date: day.date,
						kind: day.kind,
						officeId: day.officeId,
						notes: day.notes,
						source: day.source,
						updatedAt
					})
					.returning()
					.get();

		if (existing) {
			tx.delete(homeBlocks).where(eq(homeBlocks.dayId, row.id)).run();
		}

		if (day.blocks.length > 0) {
			tx.insert(homeBlocks)
				.values(
					day.blocks.map((block, position) => ({
						dayId: row.id,
						start: block.start,
						end: block.end,
						breakMinutes: block.breakMinutes,
						position
					}))
				)
				.run();
		}

		return day;
	});
}

export function deleteDay(db: Db, date: string): void {
	db.delete(days).where(eq(days.date, date)).run();
}
