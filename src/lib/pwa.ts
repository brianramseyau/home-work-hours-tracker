// Registers the service worker vite-plugin-pwa built (see vite.config.ts's SvelteKitPWA
// options). SvelteKit's app.html isn't run through Vite's HTML transform, so — unlike a plain
// Vite SPA — the registration script isn't auto-injected; this is the app calling it itself.
// A no-op in browsers without the API, and registration failures are swallowed: a missing
// service worker degrades to "not installable as a PWA", never a broken app.
//
// `isProd` defaults to the real build flag but is an explicit parameter so tests don't need to
// stub `import.meta.env`. `devOptions.enabled` is false (vite.config.ts), so `vite dev` never
// emits a Workbox worker at all — registering there would either 404 or, worse, pick up
// whatever non-Workbox file happens to sit at that path.
export function registerServiceWorker(isProd: boolean = import.meta.env.PROD): void {
	if (!isProd || !('serviceWorker' in navigator)) return;
	navigator.serviceWorker.register('/service-worker.js').catch(() => {});
}
