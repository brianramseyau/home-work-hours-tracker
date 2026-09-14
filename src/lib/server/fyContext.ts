// Loads everything keyed off a `/[fy]/*` route's slug: used by the `[fy]` layout's `load` (which
// has a `parent()` to build on) and by the day-editing actions (which don't get one — actions
// only ever receive the raw `RequestEvent`, so they re-derive this themselves from `params.fy`).

import { error } from '@sveltejs/kit';
import { fyBounds, fySummary, parseFySlug } from '$lib/core/fy';
import { db } from './db';
import { effectiveHolidays } from './holidays';
import { listHolidays } from './repo/holidays';
import { listOffices } from './repo/offices';
import { listSchedules } from './repo/schedules';
import { getSettings } from './repo/settings';
import { getYear } from './repo/years';

export function loadFyContext(params: { fy: string }) {
	let startYear: number;
	try {
		startYear = parseFySlug(params.fy);
	} catch {
		error(404, 'Not a financial year');
	}

	const settings = getSettings(db);
	const holidayRows = listHolidays(db, settings.holidayRegion);
	const holidays = effectiveHolidays(
		holidayRows.filter((row) => row.source === 'bundled'),
		holidayRows.filter((row) => row.source === 'custom'),
		{ startYear }
	);

	return {
		fy: fySummary(startYear),
		fyBounds: fyBounds(startYear),
		year: getYear(db, startYear),
		settings,
		// Includes archived offices: a day recorded against one before it was archived still
		// needs its name resolved. Pages offering an office *picker* filter this down themselves.
		offices: listOffices(db, { includeArchived: true }),
		schedules: listSchedules(db),
		holidays
	};
}
