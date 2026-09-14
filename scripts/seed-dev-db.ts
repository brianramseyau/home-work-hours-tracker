// Seeds a synthetic demo dataset for local dev and README screenshots. Never run against a real
// database — always confirms first (or pass --yes) since it overwrites DATABASE_URL's contents.
// Data is entirely synthetic: see AGENTS.md §1 (public repo, no PII).
import { createInterface } from 'node:readline/promises';
import { addDays } from '../src/lib/core/date';
import { fyStartYear } from '../src/lib/core/fy';
import type { Day } from '../src/lib/core/dayType';
import { createDb } from '../src/lib/server/db/create';
import { ensurePrefilled } from '../src/lib/server/autoPrefill';
import { createOffice } from '../src/lib/server/repo/offices';
import { upsertDay } from '../src/lib/server/repo/days';
import { createSchedule } from '../src/lib/server/repo/schedules';
import { updateSettings } from '../src/lib/server/repo/settings';
import { createYear } from '../src/lib/server/repo/years';

const TODAY = '2026-09-14'; // matches APP_FIXED_DATE in .env.example / e2e config

async function confirm(): Promise<boolean> {
	if (process.argv.includes('--yes')) return true;
	const rl = createInterface({ input: process.stdin, output: process.stdout });
	const dbPath = process.env.DATABASE_URL ?? '(DATABASE_URL not set)';
	const answer = await rl.question(
		`This overwrites the demo dataset in ${dbPath} with synthetic seed data. Continue? [y/N] `
	);
	rl.close();
	return answer.trim().toLowerCase() === 'y';
}

async function main() {
	if (!(await confirm())) {
		console.log('Aborted.');
		return;
	}

	const dbPath = process.env.DATABASE_URL;
	if (!dbPath) throw new Error('DATABASE_URL is not set');
	const db = createDb(dbPath);

	updateSettings(db, {
		fullName: 'John Doe',
		holidayRegion: 'AU-VIC',
		standardStart: '09:00',
		standardEnd: '17:06',
		standardBreakMinutes: 30,
		includeWeekends: false
	});

	const office1 = createOffice(db, { name: 'Office Location 1' });
	const office2 = createOffice(db, { name: 'Office Location 2' });

	createYear(db, { startYear: 2025, rateCentsPerHour: 67 });
	createYear(db, { startYear: 2026, rateCentsPerHour: 70 });

	// A fortnightly alternating pattern: every weekday is Home by default, except Tue (always
	// office 1) and, in week B only, Thu (office 2 too).
	const homeDays = (weekIndex: 0 | 1, weekdays: number[]) =>
		weekdays.map((wd) => ({ weekIndex, weekday: wd, mode: 'home' as const, officeId: null }));

	createSchedule(db, {
		effectiveFrom: '2025-07-01',
		cycleWeeks: 2,
		anchorMonday: '2025-06-30',
		days: [
			...homeDays(0, [1, 3, 4, 5]),
			{ weekIndex: 0, weekday: 2, mode: 'office', officeId: office1.id },
			...homeDays(1, [1, 3, 5]),
			{ weekIndex: 1, weekday: 2, mode: 'office', officeId: office1.id },
			{ weekIndex: 1, weekday: 4, mode: 'office', officeId: office2.id }
		]
	});

	ensurePrefilled(db, TODAY);

	// A handful of manual overrides to show off splits, leave and sick days. Offsets are chosen
	// to land on weekdays (1 Jul 2026 is a Wednesday), since weekend days don't otherwise show
	// up in the demo (include_weekends defaults off).
	const startOfCurrentFy = `${fyStartYear(TODAY)}-07-01`;
	const splitDay = addDays(startOfCurrentFy, 14); // Wed
	const sickDay = addDays(startOfCurrentFy, 16); // Thu
	const leaveStart = addDays(startOfCurrentFy, 21); // Wed–Fri

	upsertDay(
		db,
		{
			date: splitDay,
			kind: 'work',
			officeId: office1.id,
			notes: 'Half day in, finished at home',
			source: 'manual',
			blocks: [{ start: '09:00', end: '13:00', breakMinutes: 0 }]
		} satisfies Day,
		new Date().toISOString()
	);

	upsertDay(
		db,
		{
			date: sickDay,
			kind: 'sick',
			officeId: null,
			notes: null,
			source: 'manual',
			blocks: []
		} satisfies Day,
		new Date().toISOString()
	);

	for (let i = 0; i < 3; i++) {
		upsertDay(
			db,
			{
				date: addDays(leaveStart, i),
				kind: 'leave',
				officeId: null,
				notes: 'Annual leave',
				source: 'manual',
				blocks: []
			} satisfies Day,
			new Date().toISOString()
		);
	}

	console.log(`Seeded ${dbPath} with demo data for John Doe (FY26 and FY27, today = ${TODAY}).`);
}

main();
