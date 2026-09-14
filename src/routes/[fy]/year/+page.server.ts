import { loadDiaryData } from '$lib/server/diaryLoad';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	return loadDiaryData(await parent());
};
