import { env } from '$env/dynamic/private';
import { today } from '$lib/server/clock';
import { db } from '$lib/server/db';
import { buildWorkbook } from '$lib/server/export';
import { loadFyContext } from '$lib/server/fyContext';
import { loadLogoBuffer } from '$lib/server/logo';
import { listRange } from '$lib/server/repo/days';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const context = loadFyContext(params); // errors 404 for a slug that isn't a valid FY

	const days = listRange(db, context.fyBounds.start, context.fyBounds.end);
	const buffer = await buildWorkbook({
		fy: {
			startYear: context.fy.startYear,
			label: context.fy.label,
			range: context.fy.range,
			rateCentsPerHour: context.year?.rateCentsPerHour ?? 0,
			rateNote: context.year?.rateNote ?? null
		},
		settings: {
			fullName: context.settings.fullName,
			includeWeekends: context.settings.includeWeekends
		},
		days,
		offices: context.offices,
		holidays: context.holidays,
		generatedAt: today(env),
		logo: loadLogoBuffer()
	});

	return new Response(new Uint8Array(buffer), {
		headers: {
			'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			'Content-Disposition': `attachment; filename="${context.fy.label}-home-work-diary.xlsx"`
		}
	});
};
