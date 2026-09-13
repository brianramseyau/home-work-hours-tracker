// Zod schemas shared by every form action and its client-side counterpart. Kept in `core` (not
// `server`) so a `+page.svelte` can reuse the same schema for client-side validation.

import { z } from 'zod';
import { weekday } from './date';
import { validateBlock } from './time';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HH_MM = /^([0-1]\d|2[0-3]):([0-5]\d)$/;

const isoDate = z.string().regex(ISO_DATE, 'Expected a date in YYYY-MM-DD format');
const hhMm = z.string().regex(HH_MM, 'Expected a time in HH:mm format');

// The AU states date-holidays has data for. bundledHolidays() passes this straight to
// `new Holidays(country, state)`, which throws (or silently returns nothing) on a code it
// doesn't recognise — validated here so a bad value is a field error, not a 500.
const AU_HOLIDAY_REGIONS = [
	'AU-ACT',
	'AU-NSW',
	'AU-NT',
	'AU-QLD',
	'AU-SA',
	'AU-TAS',
	'AU-VIC',
	'AU-WA'
] as const;
const holidayRegion = z.enum(AU_HOLIDAY_REGIONS, 'Choose a holiday region');

export const settingsSchema = z
	.object({
		fullName: z.string().trim().min(1).nullable(),
		holidayRegion,
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
	})
	.refine(
		(value) => {
			const keys = value.days.map((day) => `${day.weekIndex}-${day.weekday}`);
			return keys.length === new Set(keys).size;
		},
		{
			message: 'Each weekday can only appear once per week of the cycle',
			path: ['days']
		}
	);

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

/** True if any two (already HH:mm-valid) blocks overlap, once sorted by start time. */
function hasOverlappingBlocks(blocks: { start: string; end: string }[]): boolean {
	const validlyTimed = blocks.filter((block) => HH_MM.test(block.start) && HH_MM.test(block.end));
	const sorted = [...validlyTimed].sort((a, b) => a.start.localeCompare(b.start));
	return sorted.some((block, index) => index > 0 && block.start < sorted[index - 1].end);
}

export const daySchema = z
	.object({
		date: isoDate,
		kind: z.enum(['work', 'leave', 'sick', 'public_holiday', 'off']),
		officeId: z.number().int().nullable(),
		notes: z.string().trim().min(1).nullable(),
		blocks: z.array(homeBlockSchema)
	})
	.refine((value) => !hasOverlappingBlocks(value.blocks), {
		message:
			'Time blocks cannot overlap — each home block counted toward the claim must be a separate span',
		path: ['blocks']
	});

export const holidaySchema = z.object({
	date: isoDate,
	name: z.string().trim().min(1, 'Name the holiday'),
	region: holidayRegion,
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

/**
 * Parses a form field expected to hold a number, treating a blank or whitespace-only string as
 * invalid rather than the `0` that `Number('')` would otherwise silently produce — the schema's
 * `z.number()` then rejects the resulting `NaN` with a proper field error instead of the field
 * ending up saved as a real (and wrong) zero.
 */
export function parseNumberField(value: FormDataEntryValue | null): number {
	if (typeof value !== 'string' || value.trim() === '') return NaN;
	return Number(value);
}

/**
 * The first message out of a zod `flatten().fieldErrors` object, in field-declaration order —
 * enough for a form to show one line explaining why its last submit failed, without listing
 * every field's errors separately.
 */
export function firstFieldError(
	errors: Record<string, string[] | undefined> | null | undefined
): string | null {
	if (!errors) return null;
	for (const messages of Object.values(errors)) {
		if (messages && messages.length > 0) return messages[0];
	}
	return null;
}

export type SettingsInput = z.infer<typeof settingsSchema>;
export type YearInput = z.infer<typeof yearSchema>;
export type OfficeInput = z.infer<typeof officeSchema>;
export type ScheduleInput = z.infer<typeof scheduleSchema>;
export type DayInput = z.infer<typeof daySchema>;
export type HolidayInput = z.infer<typeof holidaySchema>;
export type LeaveRangeInput = z.infer<typeof leaveRangeSchema>;
