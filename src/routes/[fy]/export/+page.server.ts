import { loadDiaryData } from '$lib/server/diaryLoad';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const parentData = await parent();
	const { summary, claimCents } = loadDiaryData(parentData);

	return {
		summary,
		claimCents,
		rateCentsPerHour: parentData.year?.rateCentsPerHour ?? null,
		fullName: parentData.settings.fullName,
		finalised: parentData.year?.finalisedAt != null
	};
};
