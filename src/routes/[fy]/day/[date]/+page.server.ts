// The full-page fallback for a day, reached by a deep link or reload of the shallow-routed
// overlay's URL (see `/[fy]/+page.svelte`). Shares its form actions with that page.

import { error } from '@sveltejs/kit';
import { displayType } from '$lib/core/dayType';
import { ISO_DATE } from '$lib/core/validation';
import { clearDay, resetDay, saveDay } from '$lib/server/dayActions';
import { db } from '$lib/server/db';
import { getDay } from '$lib/server/repo/days';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent }) => {
	if (!ISO_DATE.test(params.date)) error(404, 'Not a date');

	// The shared actions already reject a date outside this FY (`dayGuardFailure`); checking it
	// here too keeps the 404 consistent instead of rendering a deep link that can never save.
	const { fyBounds } = await parent();
	if (params.date < fyBounds.start || params.date > fyBounds.end) {
		error(404, 'Not a date in this financial year');
	}

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
