import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { buildDiaryDays } from '$lib/core/diary';
import PunchStrip from './PunchStrip.svelte';

describe('PunchStrip', () => {
	it('renders one swatch per day, hidden from assistive tech as a decorative preview', () => {
		const days = buildDiaryDays({
			startYear: 2026,
			today: '2026-09-14',
			days: [],
			schedules: [],
			holidays: [],
			standard: { start: '09:00', end: '17:06', breakMinutes: 30 },
			includeWeekends: false
		});

		const { container } = render(PunchStrip, { days });
		expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
		expect(container.querySelectorAll('span').length).toBe(days.length);
	});
});
