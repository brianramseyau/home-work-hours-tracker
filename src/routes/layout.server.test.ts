import { describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: { APP_FIXED_DATE: '2026-09-14', TZ: 'Australia/Melbourne' }
}));

describe('root layout load', () => {
	it('provides today and the current financial year', async () => {
		const { load } = await import('./+layout.server');
		expect(load({} as Parameters<typeof load>[0])).toEqual({
			today: '2026-09-14',
			currentFy: { startYear: 2026, label: 'FY27', slug: 'fy27', range: 'Jul 2026 – Jun 2027' }
		});
	});
});
