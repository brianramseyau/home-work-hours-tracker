import { describe, expect, it } from 'vitest';
import { APP_NAME, APP_SHORT_NAME, REPO_URL } from './branding';

describe('branding', () => {
	it('exposes the app identity used by the footer and the export', () => {
		expect(APP_NAME).toBe('Home Work Hours Tracker');
		expect(APP_SHORT_NAME).toBe('Home Hours');
		expect(REPO_URL).toBe('https://github.com/brianramseyau/home-work-hours-tracker');
	});
});
