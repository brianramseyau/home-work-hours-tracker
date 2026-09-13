import { env } from '$env/dynamic/private';
import { fail } from '@sveltejs/kit';
import { fyBounds, fyStartYear, fySummary } from '$lib/core/fy';
import { claimCents, summarise } from '$lib/core/totals';
import { yearSchema } from '$lib/core/validation';
import { today } from '$lib/server/clock';
import { db } from '$lib/server/db';
import { listRange } from '$lib/server/repo/days';
import {
	createYear,
	finaliseYear,
	getYear,
	listYears,
	unfinaliseYear,
	updateYearRate
} from '$lib/server/repo/years';
import type { Actions, PageServerLoad } from './$types';

/** ATO's current fixed rate, used only as a fallback when there's no previous year to copy. */
const FALLBACK_RATE_CENTS = 70;

function nextMissingStartYear(existingStartYears: number[]): number {
	if (existingStartYears.length === 0) return fyStartYear(today(env));
	return Math.max(...existingStartYears) + 1;
}

export const load: PageServerLoad = () => {
	const years = listYears(db);

	const rows = years.map((year) => {
		const { start, end } = fyBounds(year.startYear);
		const summary = summarise(listRange(db, start, end));
		return {
			startYear: year.startYear,
			rateCentsPerHour: year.rateCentsPerHour,
			rateNote: year.rateNote,
			finalisedAt: year.finalisedAt,
			fy: fySummary(year.startYear),
			homeMinutes: summary.homeMinutes,
			claimCents: claimCents(summary.homeMinutes, year.rateCentsPerHour)
		};
	});

	const nextStartYear = nextMissingStartYear(years.map((year) => year.startYear));

	return { years: rows, nextFy: fySummary(nextStartYear) };
};

/** Parses a "0.70"-style dollar string into integer cents, or null if it isn't a number. */
function parseDollarsToCents(value: FormDataEntryValue | null): number | null {
	// `Number('')` and `Number('  ')` are both 0, not NaN, so a blank field must be rejected
	// before the conversion — otherwise clearing the field would silently zero the rate.
	if (typeof value !== 'string' || value.trim() === '') return null;
	const dollars = Number(value);
	if (!Number.isFinite(dollars)) return null;
	return Math.round(dollars * 100);
}

export const actions: Actions = {
	create: () => {
		// No `await` runs between this read and the insert below, so — Node being
		// single-threaded — nothing else can create a year in between. `startYear` is always
		// one past every existing row (or the current FY, if there are none), so it can never
		// collide with one.
		const years = listYears(db);
		const startYear = nextMissingStartYear(years.map((year) => year.startYear));
		const previous = years.find((year) => year.startYear === startYear - 1);
		createYear(db, {
			startYear,
			rateCentsPerHour: previous?.rateCentsPerHour ?? FALLBACK_RATE_CENTS,
			rateNote: null
		});
		return { success: true };
	},

	updateRate: async ({ request }) => {
		const formData = await request.formData();
		const startYear = Number(formData.get('startYear'));
		const rateCentsPerHour = parseDollarsToCents(formData.get('rateDollars'));
		const rateNoteRaw = formData.get('rateNote');
		const rateNote =
			typeof rateNoteRaw === 'string' && rateNoteRaw.trim() ? rateNoteRaw.trim() : null;

		const parsed = yearSchema.safeParse({ startYear, rateCentsPerHour, rateNote });
		if (!parsed.success) {
			return fail(400, {
				form: 'updateRate',
				startYear,
				errors: parsed.error.flatten().fieldErrors
			});
		}

		const year = getYear(db, parsed.data.startYear);
		if (!year) {
			return fail(400, {
				form: 'updateRate',
				startYear,
				errors: { startYear: ['This financial year does not exist.'] }
			});
		}
		if (year.finalisedAt) {
			return fail(400, {
				form: 'updateRate',
				startYear,
				errors: { startYear: ['Unfinalise this year before changing its rate.'] }
			});
		}

		updateYearRate(db, parsed.data.startYear, {
			rateCentsPerHour: parsed.data.rateCentsPerHour,
			rateNote: parsed.data.rateNote
		});
		return { form: 'updateRate', startYear: parsed.data.startYear, success: true };
	},

	finalise: async ({ request }) => {
		const formData = await request.formData();
		const startYear = Number(formData.get('startYear'));
		finaliseYear(db, startYear, today(env));
		return { success: true };
	},

	unfinalise: async ({ request }) => {
		const formData = await request.formData();
		const startYear = Number(formData.get('startYear'));
		unfinaliseYear(db, startYear);
		return { success: true };
	}
};
