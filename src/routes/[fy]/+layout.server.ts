// Shared by every `/[fy]/*` page: parses the FY slug once, and loads the data every one of
// them needs (the year row, settings, active offices, schedules and this FY's effective
// holidays).

import { loadFyContext } from '$lib/server/fyContext';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ params }) => loadFyContext(params);
