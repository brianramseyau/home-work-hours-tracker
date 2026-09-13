// The `schedules` / `schedule_days` tables, mapped to and from the pure `core/schedule.ts` shape.

import { asc, eq } from 'drizzle-orm';
import type { Schedule, ScheduleDay } from '$lib/core/schedule';
import type { Db } from '../db/create';
import { scheduleDays, schedules } from '../db/schema';

export interface ScheduleWithId extends Schedule {
	id: number;
}

/** Every schedule version, oldest first, each with its days. */
export function listSchedules(db: Db): ScheduleWithId[] {
	const rows = db.select().from(schedules).orderBy(asc(schedules.effectiveFrom)).all();
	return rows.map((row) => ({
		id: row.id,
		effectiveFrom: row.effectiveFrom,
		cycleWeeks: row.cycleWeeks as 1 | 2,
		anchorMonday: row.anchorMonday,
		days: db
			.select()
			.from(scheduleDays)
			.where(eq(scheduleDays.scheduleId, row.id))
			.all()
			.map((day): ScheduleDay => ({
				weekIndex: day.weekIndex,
				weekday: day.weekday,
				mode: day.mode,
				officeId: day.officeId
			}))
	}));
}

export function createSchedule(
	db: Db,
	input: { effectiveFrom: string; cycleWeeks: 1 | 2; anchorMonday: string; days: ScheduleDay[] }
): ScheduleWithId {
	return db.transaction((tx) => {
		const schedule = tx
			.insert(schedules)
			.values({
				effectiveFrom: input.effectiveFrom,
				cycleWeeks: input.cycleWeeks,
				anchorMonday: input.anchorMonday
			})
			.returning()
			.get();

		if (input.days.length > 0) {
			tx.insert(scheduleDays)
				.values(
					input.days.map((day) => ({
						scheduleId: schedule.id,
						weekIndex: day.weekIndex,
						weekday: day.weekday,
						mode: day.mode,
						officeId: day.officeId
					}))
				)
				.run();
		}

		return {
			id: schedule.id,
			effectiveFrom: schedule.effectiveFrom,
			cycleWeeks: schedule.cycleWeeks as 1 | 2,
			anchorMonday: schedule.anchorMonday,
			days: input.days
		};
	});
}

/** Removes a schedule version (its days cascade with it), for correcting a mistaken entry. */
export function deleteSchedule(db: Db, id: number): void {
	db.delete(schedules).where(eq(schedules.id, id)).run();
}
