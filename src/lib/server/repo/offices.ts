// The `offices` table. Offices are archived, never deleted, once referenced (see AGENTS.md).

import { asc, eq, isNull } from 'drizzle-orm';
import type { Db } from '../db/create';
import { offices } from '../db/schema';

export type Office = typeof offices.$inferSelect;

export function listOffices(db: Db, options: { includeArchived?: boolean } = {}): Office[] {
	const query = db.select().from(offices).orderBy(asc(offices.name));
	return options.includeArchived ? query.all() : query.where(isNull(offices.archivedAt)).all();
}

export function createOffice(db: Db, input: { name: string; address?: string | null }): Office {
	return db
		.insert(offices)
		.values({ name: input.name, address: input.address ?? null })
		.returning()
		.get();
}

export function updateOffice(
	db: Db,
	id: number,
	input: { name: string; address?: string | null }
): Office {
	return db
		.update(offices)
		.set({ name: input.name, address: input.address ?? null })
		.where(eq(offices.id, id))
		.returning()
		.get();
}

export function archiveOffice(db: Db, id: number, archivedAt: string): Office {
	return db.update(offices).set({ archivedAt }).where(eq(offices.id, id)).returning().get();
}
