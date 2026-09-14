// Shared by `/[fy]` and `/[fy]/year`, which both need the FY's diary days, summary and claim —
// just laid out differently (the week table vs. the punch card and monthly breakdown).

import { buildDiaryDays, type DiaryDay } from '$lib/core/diary';
import type { Schedule } from '$lib/core/schedule';
import { claimCents, summarise, type Summary } from '$lib/core/totals';
import { db } from './db';
import { listRange } from './repo/days';

export interface DiaryLoadInput {
	fy: { startYear: number };
	fyBounds: { start: string; end: string };
	year: { rateCentsPerHour: number } | null;
	settings: {
		standardStart: string;
		standardEnd: string;
		standardBreakMinutes: number;
		includeWeekends: boolean;
	};
	schedules: Schedule[];
	holidays: { date: string }[];
	today: string;
}

export interface DiaryLoadResult {
	days: DiaryDay[];
	summary: Summary;
	claimCents: number | null;
}

export function loadDiaryData(input: DiaryLoadInput): DiaryLoadResult {
	const days = listRange(db, input.fyBounds.start, input.fyBounds.end);
	const diaryDays = buildDiaryDays({
		startYear: input.fy.startYear,
		today: input.today,
		days,
		schedules: input.schedules,
		holidays: input.holidays,
		standard: {
			start: input.settings.standardStart,
			end: input.settings.standardEnd,
			breakMinutes: input.settings.standardBreakMinutes
		},
		includeWeekends: input.settings.includeWeekends
	});

	const summary = summarise(days);

	return {
		days: diaryDays,
		summary,
		claimCents: input.year ? claimCents(summary.homeMinutes, input.year.rateCentsPerHour) : null
	};
}
