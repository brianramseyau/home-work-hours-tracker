import { env } from '$env/dynamic/private';
import { fyStartYear, fySummary } from '$lib/core/fy';
import { today } from '$lib/server/clock';
import type { LayoutServerLoad } from './$types';

// "Today" is decided on the server (process TZ) and handed to the client, so the two can
// never disagree about which day it is.
export const load: LayoutServerLoad = () => {
	const date = today(env);
	return { today: date, currentFy: fySummary(fyStartYear(date)) };
};
