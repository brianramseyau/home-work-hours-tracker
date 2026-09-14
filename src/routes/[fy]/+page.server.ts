import { fail } from '@sveltejs/kit';
import { addDays } from '$lib/core/date';
import { leaveRangeSchema } from '$lib/core/validation';
import { clearDay, resetDay, saveDay } from '$lib/server/dayActions';
import { db } from '$lib/server/db';
import { loadDiaryData } from '$lib/server/diaryLoad';
import { loadFyContext } from '$lib/server/fyContext';
import { upsertDay } from '$lib/server/repo/days';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const parentData = await parent();
	return { ...loadDiaryData(parentData), finalised: Boolean(parentData.year?.finalisedAt) };
};

export const actions: Actions = {
	saveDay,
	resetDay,
	clearDay,

	markRange: async ({ request, params }) => {
		const { fyBounds, year, holidays } = loadFyContext(params);
		const formData = await request.formData();
		const noteRaw = formData.get('note');

		const parsed = leaveRangeSchema.safeParse({
			from: formData.get('from'),
			to: formData.get('to'),
			kind: formData.get('kind')
		});
		if (!parsed.success) {
			return fail(400, { form: 'markRange', errors: parsed.error.flatten().fieldErrors });
		}
		if (parsed.data.from < fyBounds.start || parsed.data.to > fyBounds.end) {
			return fail(400, {
				form: 'markRange',
				errors: { from: ['The range must stay within the financial year being viewed.'] }
			});
		}
		if (year?.finalisedAt) {
			return fail(400, {
				form: 'markRange',
				errors: { from: ['This financial year is finalised — unfinalise it first.'] }
			});
		}

		const note = typeof noteRaw === 'string' && noteRaw.trim() ? noteRaw.trim() : null;
		const holidayDates = new Set(holidays.map((holiday) => holiday.date));
		const now = new Date().toISOString();

		for (let date = parsed.data.from; date <= parsed.data.to; date = addDays(date, 1)) {
			if (holidayDates.has(date)) continue;
			upsertDay(
				db,
				{ date, kind: parsed.data.kind, officeId: null, notes: note, source: 'manual', blocks: [] },
				now
			);
		}

		return { form: 'markRange', success: true };
	}
};
