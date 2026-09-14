// Registers the service worker vite-plugin-pwa built (see vite.config.ts's SvelteKitPWA
// options). SvelteKit's app.html isn't run through Vite's HTML transform, so — unlike a plain
// Vite SPA — the registration script isn't auto-injected; this is the app calling it itself.
// A no-op in browsers without the API, and registration failures are swallowed: a missing
// service worker degrades to "not installable as a PWA", never a broken app.
export function registerServiceWorker(): void {
	if (!('serviceWorker' in navigator)) return;
	navigator.serviceWorker.register('/service-worker.js').catch(() => {});
}
