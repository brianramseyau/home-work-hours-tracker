import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

// E2E runs against a production build on a fresh, throwaway database with "today" pinned,
// so date-dependent screens (auto-prefill, the current week) are deterministic.
// Locale is en-GB: day-first like en-AU, which Chromium doesn't ship (see AGENTS.md §7).
export default defineConfig({
	testDir: 'e2e',
	testMatch: '**/*.e2e.ts',
	workers: 1,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI
		? [['github'], ['html', { open: 'never' }]]
		: [['list'], ['html', { open: 'never' }]],
	use: {
		baseURL: `http://localhost:${PORT}`,
		locale: 'en-GB',
		timezoneId: 'Australia/Melbourne',
		trace: 'retain-on-failure'
	},
	projects: [
		{ name: 'mobile', use: { ...devices['Pixel 7'] } },
		{
			name: 'desktop',
			use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }
		}
	],
	webServer: {
		command: `node e2e/reset-db.mjs && npm run build && npm run preview -- --port ${PORT} --strictPort`,
		port: PORT,
		reuseExistingServer: !process.env.CI,
		timeout: 180_000,
		env: {
			DATABASE_URL: './data/e2e.db',
			APP_FIXED_DATE: '2026-09-14',
			TZ: 'Australia/Melbourne'
		}
	}
});
