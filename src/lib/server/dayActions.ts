// The single-day form actions (saveDay, resetDay, clearDay), shared by `/[fy]` (the Diary,
// editing through the shallow-routed overlay) and `/[fy]/day/[date]` (the deep-link fallback).
// Actions don't get a `parent()` (that's a `load`-only concept), so each one re-derives the FY
// context itself from `params.fy`, via the same helper the `[fy]` layout's load uses.

import { fail, type RequestEvent } from '@sveltejs/kit';
import { daySchema, ISO_DATE } from '$lib/core/validation';
import { resetDayToSchedule } from './autoPrefill';
import { db } from './db';
import { loadFyContext } from './fyContext';
import { upsertDay } from './repo/days';

/** Rejects a date outside the financial year being viewed, or one that's been finalised. */
function dayGuardFailure(
	date: string,
	{
		fyBounds,
		year
	}: { fyBounds: { start: string; end: string }; year: { finalisedAt: string | null } | null }
) {
	if (!ISO_DATE.test(date)) {
		return fail(400, {
			form: 'day',
			date,
			errors: { date: ['Expected a date in YYYY-MM-DD format'] }
		});
	}
	if (date < fyBounds.start || date > fyBounds.end) {
		return fail(400, {
			form: 'day',
			date,
			errors: { date: ['This date is outside the financial year being viewed.'] }
		});
	}
	if (year?.finalisedAt) {
		return fail(400, {
			form: 'day',
			date,
			errors: { date: ['This financial year is finalised — unfinalise it first.'] }
		});
	}
	return null;
}

export async function saveDay({ request, params }: RequestEvent<{ fy: string }>) {
	const context = loadFyContext(params);
	const formData = await request.formData();
	const date = formData.get('date');
	const notesRaw = formData.get('notes');
	const officeIdRaw = formData.get('officeId');
	let blocksRaw: unknown;
	try {
		blocksRaw = JSON.parse(String(formData.get('blocks') ?? '[]'));
	} catch {
		blocksRaw = null;
	}

	const parsed = daySchema.safeParse({
		date,
		kind: formData.get('kind'),
		officeId: typeof officeIdRaw === 'string' && officeIdRaw ? Number(officeIdRaw) : null,
		notes: typeof notesRaw === 'string' && notesRaw.trim() ? notesRaw.trim() : null,
		blocks: blocksRaw
	});
	if (!parsed.success) {
		return fail(400, {
			form: 'day',
			date: typeof date === 'string' ? date : null,
			errors: parsed.error.flatten().fieldErrors
		});
	}

	const guarded = dayGuardFailure(parsed.data.date, context);
	if (guarded) return guarded;

	// daySchema only rules out an obviously-invalid id; whether it's an office that actually
	// exists is checked here, the same way the schedule action checks it — a crafted request
	// bypassing the editor's own office picker would otherwise reach a live foreign-key
	// constraint and 500 instead of a field error.
	const officeIds = new Set(context.offices.map((office) => office.id));
	if (parsed.data.officeId !== null && !officeIds.has(parsed.data.officeId)) {
		return fail(400, {
			form: 'day',
			date: parsed.data.date,
			errors: { officeId: ['This office does not exist.'] }
		});
	}

	upsertDay(db, { ...parsed.data, source: 'manual' }, new Date().toISOString());
	return { form: 'day', date: parsed.data.date, success: true };
}

export async function resetDay({ request, params }: RequestEvent<{ fy: string }>) {
	const context = loadFyContext(params);
	const formData = await request.formData();
	const date = String(formData.get('date') ?? '');

	const guarded = dayGuardFailure(date, context);
	if (guarded) return guarded;

	resetDayToSchedule(db, date);
	return { form: 'day', date, success: true };
}

export async function clearDay({ request, params }: RequestEvent<{ fy: string }>) {
	const context = loadFyContext(params);
	const formData = await request.formData();
	const date = String(formData.get('date') ?? '');

	const guarded = dayGuardFailure(date, context);
	if (guarded) return guarded;

	upsertDay(
		db,
		{ date, kind: 'off', officeId: null, notes: null, source: 'manual', blocks: [] },
		new Date().toISOString()
	);
	return { form: 'day', date, success: true };
}
