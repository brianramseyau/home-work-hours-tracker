// The full-page fallback for a day, reached by a deep link or reload of the shallow-routed
// overlay's URL (see `/[fy]/+page.svelte`). Shares its form actions with that page.

import { error } from '@sveltejs/kit';
import { displayType } from '$lib/core/dayType';
import { clearDay, resetDay, saveDay } from '$lib/server/dayActions';
import { db } from '$lib/server/db';
import { getDay } from '$lib/server/repo/days';
import type { Actions, PageServerLoad } from './$types';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const load: PageServerLoad = ({ params }) => {
	if (!ISO_DATE.test(params.date)) error(404, 'Not a date');

	const row = getDay(db, params.date);
	const day = {
		date: params.date,
		officeId: row?.officeId ?? null,
		notes: row?.notes ?? null,
		blocks: row?.blocks ?? []
	};

	return { day: { ...day, displayType: displayType({ kind: row?.kind ?? 'off', ...day }) } };
};

export const actions: Actions = { saveDay, resetDay, clearDay };
