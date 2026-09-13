import { env } from '$env/dynamic/private';
import { fail } from '@sveltejs/kit';
import { fyBounds, fyStartYear, fySummary, parseFySlug } from '$lib/core/fy';
import {
	holidaySchema,
	officeSchema,
	parseNumberField,
	scheduleSchema,
	settingsSchema
} from '$lib/core/validation';
import { today } from '$lib/server/clock';
import { db } from '$lib/server/db';
import { isUniqueConstraintError } from '$lib/server/db/errors';
import { replanFrom } from '$lib/server/autoPrefill';
import { bundledHolidays, projectIntoFy } from '$lib/server/holidays';
import {
	archiveOffice,
	createOffice,
	listOffices,
	unarchiveOffice,
	updateOffice
} from '$lib/server/repo/offices';
import {
	addCustomHoliday,
	deleteHoliday,
	listHolidays,
	replaceBundledHolidays,
	setHolidayDisabled
} from '$lib/server/repo/holidays';
import { createSchedule, deleteSchedule, listSchedules } from '$lib/server/repo/schedules';
import { getSettings, updateSettings } from '$lib/server/repo/settings';
import type { Actions, PageServerLoad } from './$types';

function currentFyStartYear(): number {
	return fyStartYear(today(env));
}

/** Keeps the bundled holiday rows for `region` in sync with date-holidays, for the given FY. */
function reseedBundled(region: string, startYear: number) {
	replaceBundledHolidays(db, region, startYear, bundledHolidays(region, startYear));
}

export const load: PageServerLoad = ({ url }) => {
	const settings = getSettings(db);
	const offices = listOffices(db, { includeArchived: true });
	const schedules = listSchedules(db);

	const fySlug = url.searchParams.get('fy');
	let holidayStartYear = currentFyStartYear();
	try {
		if (fySlug) holidayStartYear = parseFySlug(fySlug);
	} catch {
		// Keep the current FY if the query param is malformed.
	}

	reseedBundled(settings.holidayRegion, holidayStartYear);
	const holidayRows = listHolidays(db, settings.holidayRegion);
	const { start, end } = fyBounds(holidayStartYear);
	// A repeating custom holiday is projected onto the FY being viewed regardless of whether
	// it's disabled — disabled rows still need to show up so they can be re-enabled.
	const holidays = holidayRows
		.map((row) => ({
			...row,
			displayDate:
				row.source === 'custom' && row.repeatsYearly
					? projectIntoFy(row.date, holidayStartYear)
					: row.date
		}))
		.filter((row) => row.displayDate >= start && row.displayDate <= end)
		.sort((a, b) => a.displayDate.localeCompare(b.displayDate));

	return {
		settings,
		offices,
		schedules,
		holidayFy: fySummary(holidayStartYear),
		holidays
	};
};

export const actions: Actions = {
	general: async ({ request }) => {
		const formData = await request.formData();
		const fullNameRaw = formData.get('fullName');
		const parsed = settingsSchema.safeParse({
			fullName: typeof fullNameRaw === 'string' && fullNameRaw.trim() ? fullNameRaw.trim() : null,
			holidayRegion: formData.get('holidayRegion'),
			standardStart: formData.get('standardStart'),
			standardEnd: formData.get('standardEnd'),
			standardBreakMinutes: parseNumberField(formData.get('standardBreakMinutes')),
			includeWeekends: formData.get('includeWeekends') === 'on'
		});
		if (!parsed.success) {
			return fail(400, { form: 'general', errors: parsed.error.flatten().fieldErrors });
		}

		updateSettings(db, parsed.data);
		reseedBundled(parsed.data.holidayRegion, currentFyStartYear());
		replanFrom(db, fyBounds(currentFyStartYear()).start);
		return { form: 'general', success: true };
	},

	officeCreate: async ({ request }) => {
		const formData = await request.formData();
		const addressRaw = formData.get('address');
		const parsed = officeSchema.safeParse({
			name: formData.get('name'),
			address: typeof addressRaw === 'string' && addressRaw.trim() ? addressRaw.trim() : null
		});
		if (!parsed.success) {
			return fail(400, { form: 'officeCreate', errors: parsed.error.flatten().fieldErrors });
		}
		try {
			createOffice(db, parsed.data);
		} catch (error) {
			if (!isUniqueConstraintError(error)) throw error;
			return fail(400, {
				form: 'officeCreate',
				errors: { name: ['An office already has this name.'] }
			});
		}
		return { form: 'officeCreate', success: true };
	},

	officeUpdate: async ({ request }) => {
		const formData = await request.formData();
		const id = Number(formData.get('id'));
		const addressRaw = formData.get('address');
		const parsed = officeSchema.safeParse({
			name: formData.get('name'),
			address: typeof addressRaw === 'string' && addressRaw.trim() ? addressRaw.trim() : null
		});
		if (!parsed.success) {
			return fail(400, { form: 'officeUpdate', id, errors: parsed.error.flatten().fieldErrors });
		}
		try {
			updateOffice(db, id, parsed.data);
		} catch (error) {
			if (!isUniqueConstraintError(error)) throw error;
			return fail(400, {
				form: 'officeUpdate',
				id,
				errors: { name: ['An office already has this name.'] }
			});
		}
		return { form: 'officeUpdate', id, success: true };
	},

	officeArchive: async ({ request }) => {
		const formData = await request.formData();
		const id = Number(formData.get('id'));
		archiveOffice(db, id, today(env));
		return { form: 'officeArchive', success: true };
	},

	officeUnarchive: async ({ request }) => {
		const formData = await request.formData();
		const id = Number(formData.get('id'));
		unarchiveOffice(db, id);
		return { form: 'officeUnarchive', success: true };
	},

	schedule: async ({ request }) => {
		const formData = await request.formData();
		const daysRaw = formData.get('days');
		let days: unknown;
		try {
			days = typeof daysRaw === 'string' ? JSON.parse(daysRaw) : null;
		} catch {
			days = null;
		}

		const parsed = scheduleSchema.safeParse({
			effectiveFrom: formData.get('effectiveFrom'),
			cycleWeeks: Number(formData.get('cycleWeeks')),
			anchorMonday: formData.get('anchorMonday'),
			days
		});
		if (!parsed.success) {
			return fail(400, { form: 'schedule', errors: parsed.error.flatten().fieldErrors });
		}

		// scheduleSchema only rules out an obviously-invalid id (non-positive); an id that's
		// merely not a real office (a crafted request bypassing the editor's own picker, which
		// only ever offers real ones) is checked here, where the office list is available.
		const officeIds = new Set(
			listOffices(db, { includeArchived: true }).map((office) => office.id)
		);
		const unknownOfficeId = parsed.data.days.some(
			(day) => day.officeId !== null && !officeIds.has(day.officeId)
		);
		if (unknownOfficeId) {
			return fail(400, {
				form: 'schedule',
				errors: { days: ['One of these offices does not exist.'] }
			});
		}

		try {
			createSchedule(db, parsed.data);
		} catch (error) {
			if (!isUniqueConstraintError(error)) throw error;
			return fail(400, {
				form: 'schedule',
				errors: { effectiveFrom: ['A schedule already starts on this date.'] }
			});
		}
		replanFrom(db, parsed.data.effectiveFrom);
		return { form: 'schedule', success: true };
	},

	deleteSchedule: async ({ request }) => {
		const formData = await request.formData();
		const id = Number(formData.get('id'));
		const effectiveFrom = formData.get('effectiveFrom');
		deleteSchedule(db, id);
		if (typeof effectiveFrom === 'string') replanFrom(db, effectiveFrom);
		return { form: 'deleteSchedule', success: true };
	},

	holidayCreate: async ({ request }) => {
		const formData = await request.formData();
		const settings = getSettings(db);
		const parsed = holidaySchema.safeParse({
			date: formData.get('date'),
			name: formData.get('name'),
			region: settings.holidayRegion,
			repeatsYearly: formData.get('repeatsYearly') === 'on',
			disabled: false
		});
		if (!parsed.success) {
			return fail(400, { form: 'holidayCreate', errors: parsed.error.flatten().fieldErrors });
		}
		try {
			addCustomHoliday(db, parsed.data);
		} catch (error) {
			if (!isUniqueConstraintError(error)) throw error;
			return fail(400, {
				form: 'holidayCreate',
				errors: { name: ['This holiday is already recorded on this date.'] }
			});
		}
		replanFrom(db, fyBounds(currentFyStartYear()).start);
		return { form: 'holidayCreate', success: true };
	},

	holidayToggle: async ({ request }) => {
		const formData = await request.formData();
		const id = Number(formData.get('id'));
		const disabled = formData.get('disabled') === 'true';
		setHolidayDisabled(db, id, disabled);
		replanFrom(db, fyBounds(currentFyStartYear()).start);
		return { form: 'holidayToggle', success: true };
	},

	holidayDelete: async ({ request }) => {
		const formData = await request.formData();
		const id = Number(formData.get('id'));
		deleteHoliday(db, id);
		replanFrom(db, fyBounds(currentFyStartYear()).start);
		return { form: 'holidayDelete', success: true };
	}
};
