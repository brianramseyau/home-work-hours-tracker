// The `settings` singleton (id = 1). Every function takes `db` so tests inject `createDb(':memory:')`.

import { eq } from 'drizzle-orm';
import type { Db } from '../db/create';
import { settings } from '../db/schema';

export type Settings = typeof settings.$inferSelect;
export type SettingsPatch = Partial<Omit<Settings, 'id'>>;

const DEFAULTS: Omit<Settings, 'id'> = {
	fullName: null,
	holidayRegion: 'AU-VIC',
	standardStart: '09:00',
	standardEnd: '17:06',
	standardBreakMinutes: 30,
	includeWeekends: false,
	prefilledThrough: null
};

/** The settings row, inserting the defaults on first read. */
export function getSettings(db: Db): Settings {
	const existing = db.select().from(settings).where(eq(settings.id, 1)).get();
	if (existing) return existing;

	return db
		.insert(settings)
		.values({ id: 1, ...DEFAULTS })
		.returning()
		.get();
}

export function updateSettings(db: Db, patch: SettingsPatch): Settings {
	getSettings(db); // ensure the row exists before updating it
	return db.update(settings).set(patch).where(eq(settings.id, 1)).returning().get();
}

/** Moves the auto-prefill watermark forward (or back, for the import's raiseWatermark). */
export function setPrefilledThrough(db: Db, date: string): Settings {
	return updateSettings(db, { prefilledThrough: date });
}
