import { env } from '$env/dynamic/private';
import { fyStartYear, fySummary } from '$lib/core/fy';
import { ensurePrefilled } from '$lib/server/autoPrefill';
import { today } from '$lib/server/clock';
import { db } from '$lib/server/db';
import type { LayoutServerLoad } from './$types';

// "Today" is decided on the server (process TZ) and handed to the client, so the two can
// never disagree about which day it is.
export const load: LayoutServerLoad = ({ url }) => {
	// Reading `url.pathname` makes it a tracked dependency, so this load (and ensurePrefilled
	// with it) reruns on every client-side navigation to a new route, not just on first load.
	void url.pathname;
	const date = today(env);
	const { filled } = ensurePrefilled(db, date);
	return { today: date, currentFy: fySummary(fyStartYear(date)), filled };
};
