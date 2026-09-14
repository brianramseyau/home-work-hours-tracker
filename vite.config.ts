import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import pkg from './package.json' with { type: 'json' };

// package.json's version only bumps for tagged releases; untagged CI builds set APP_VERSION
// to `dev-<short sha>` so the footer never shows a stale release number.
const appVersion = process.env.APP_VERSION || pkg.version;

export default defineConfig({
	define: {
		__APP_VERSION__: JSON.stringify(appVersion)
	},
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter(),
			typescript: {
				config: (config) => {
					config.include.push('../drizzle.config.ts');
				}
			}
		}),
		SvelteKitPWA({
			// Registration is done by hand (src/lib/pwa.ts), not via the `virtual:pwa-register`
			// module this project never imports, and app.html isn't Vite-HTML-transformed the way
			// injectRegister's auto-injection expects — so both options below would be dead code.
			injectRegister: null,
			strategies: 'injectManifest',
			includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon.png'],
			manifest: {
				name: 'Home Work Hours Tracker',
				short_name: 'Home Hours',
				description:
					'A self-hosted diary of hours worked from home, with automatic prefill and an accountant-ready export.',
				theme_color: '#1D2640',
				background_color: '#F4F6FA',
				display: 'standalone',
				start_url: '/',
				icons: [
					{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
					{ src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
					{
						src: '/icons/icon-maskable-192.png',
						sizes: '192x192',
						type: 'image/png',
						purpose: 'maskable'
					},
					{
						src: '/icons/icon-maskable-512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable'
					}
				]
			},
			injectManifest: {
				globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}']
			},
			devOptions: {
				enabled: false
			}
		})
	],
	test: {
		expect: { requireAssertions: true },
		coverage: {
			provider: 'v8',
			include: ['src/**/*.{ts,svelte}', 'scripts/pii/**/*.mjs'],
			// The ONLY permitted exclusions: see AGENTS.md §5. Adding one needs a justification
			// in the current phase doc.
			exclude: [
				'src/lib/components/ui/**', // vendored shadcn-svelte primitives (CLI-generated)
				'src/**/*.d.ts',
				'src/**/*.{test,spec}.ts',
				'src/**/test-utils/**',
				// Declarative table shape only, no branching logic. Its `.references(() => ...)`
				// thunks are unreachable from the app: drizzle only calls them when generating DDL
				// (drizzle-kit, a separate CLI), never when applying pre-built migrations at
				// runtime or running plain queries. Covered functionally by create.test.ts, which
				// applies the real migration and checks `foreign_key_check`. See AGENTS.md §5.
				'src/lib/server/db/schema.ts',
				// The @vite-pwa/sveltekit-compiled service worker: it only ever runs in the browser's
				// separate service-worker execution context (no DOM, no vitest), so nothing in this
				// project's test runners can import or exercise it. See AGENTS.md §5.
				'src/service-worker.ts'
			],
			thresholds: { 100: true },
			reporter: ['text', 'html', 'json', 'json-summary']
		},
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium', headless: true }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**']
				}
			},
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}', 'scripts/pii/**/*.test.ts'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
