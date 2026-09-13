// Zod schemas shared by every form action and its client-side counterpart. Kept in `core` (not
// `server`) so a `+page.svelte` can reuse the same schema for client-side validation.

import { z } from 'zod';
import { weekday } from './date';
import { validateBlock } from './time';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HH_MM = /^([0-1]\d|2[0-3]):([0-5]\d)$/;

const isoDate = z.string().regex(ISO_DATE, 'Expected a date in YYYY-MM-DD format');
const hhMm = z.string().regex(HH_MM, 'Expected a time in HH:mm format');

export const settingsSchema = z
	.object({
		fullName: z.string().trim().min(1).nullable(),
		holidayRegion: z.string().min(1, 'Choose a holiday region'),
		standardStart: hhMm,
		standardEnd: hhMm,
		standardBreakMinutes: z.number().int().min(0),
		includeWeekends: z.boolean()
	})
	.refine(
		(value) =>
			// Skip when the times aren't even HH:mm; the field-level regex already reports that.
			!HH_MM.test(value.standardStart) ||
			!HH_MM.test(value.standardEnd) ||
			validateBlock({
				start: value.standardStart,
				end: value.standardEnd,
				breakMinutes: value.standardBreakMinutes
			}) === null,
		{
			message: 'Standard hours must be a valid time span with a break shorter than it',
			path: ['standardEnd']
		}
	);

export const yearSchema = z.object({
	startYear: z.number().int().min(2000).max(2100),
	rateCentsPerHour: z.number().int().min(0, 'The rate cannot be negative'),
	rateNote: z.string().trim().min(1).nullable()
});

export const officeSchema = z.object({
	name: z.string().trim().min(1, 'Name the office'),
	address: z.string().trim().min(1).nullable()
});

const scheduleDaySchema = z.object({
	weekIndex: z.number().int().min(0).max(1),
	weekday: z.number().int().min(1).max(7),
	mode: z.enum(['home', 'office', 'off']),
	officeId: z.number().int().nullable()
});

export const scheduleSchema = z
	.object({
		effectiveFrom: isoDate,
		cycleWeeks: z.union([z.literal(1), z.literal(2)]),
		anchorMonday: isoDate,
		days: z.array(scheduleDaySchema)
	})
	.refine((value) => weekday(value.anchorMonday) === 1, {
		message: 'The anchor date must be a Monday',
		path: ['anchorMonday']
	})
	.refine((value) => value.days.every((day) => day.weekIndex < value.cycleWeeks), {
		message: 'A day belongs to a week index outside the cycle length',
		path: ['days']
	});

const homeBlockSchema = z
	.object({
		start: hhMm,
		end: hhMm,
		breakMinutes: z.number().int().min(0)
	})
	.refine(
		(block) => !HH_MM.test(block.start) || !HH_MM.test(block.end) || validateBlock(block) === null,
		{
			message: 'End time must be after start time, with a break shorter than the block',
			path: ['end']
		}
	);

export const daySchema = z.object({
	date: isoDate,
	kind: z.enum(['work', 'leave', 'sick', 'public_holiday', 'off']),
	officeId: z.number().int().nullable(),
	notes: z.string().trim().min(1).nullable(),
	blocks: z.array(homeBlockSchema)
});

export const holidaySchema = z.object({
	date: isoDate,
	name: z.string().trim().min(1, 'Name the holiday'),
	region: z.string().min(1),
	repeatsYearly: z.boolean(),
	disabled: z.boolean()
});

export const leaveRangeSchema = z
	.object({
		from: isoDate,
		to: isoDate,
		kind: z.enum(['leave', 'sick'])
	})
	.refine((value) => value.from <= value.to, {
		message: 'The range must end on or after it starts',
		path: ['to']
	});

export type SettingsInput = z.infer<typeof settingsSchema>;
export type YearInput = z.infer<typeof yearSchema>;
export type OfficeInput = z.infer<typeof officeSchema>;
export type ScheduleInput = z.infer<typeof scheduleSchema>;
export type DayInput = z.infer<typeof daySchema>;
export type HolidayInput = z.infer<typeof holidaySchema>;
export type LeaveRangeInput = z.infer<typeof leaveRangeSchema>;
