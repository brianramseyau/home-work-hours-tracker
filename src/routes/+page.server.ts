import { redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { fyStartYear, fySummary, fySlug } from '$lib/core/fy';
import { today } from '$lib/server/clock';
import { db } from '$lib/server/db';
import { getYear } from '$lib/server/repo/years';
import type { PageServerLoad } from './$types';

/**
 * Once the current financial year has been created, `/` goes straight to its diary — the
 * welcome copy below is only ever seen before that first year exists.
 */
export const load: PageServerLoad = () => {
	const startYear = fyStartYear(today(env));
	if (getYear(db, startYear)) {
		redirect(307, `/${fySlug(startYear)}`);
	}
	return { currentFy: fySummary(startYear) };
};
