/// <reference lib="webworker" />
// Custom service worker (injectManifest mode — see vite.config.ts's SvelteKitPWA options).
// Precaches the built app shell, then falls back to the static /offline page for any
// navigation the network and cache can't satisfy. Only navigations get a fallback (not images
// or fonts — offlineFallback only registers those when imageFallback/fontFallback are passed,
// which they aren't here).
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { offlineFallback } from 'workbox-recipes';
import { registerRoute } from 'workbox-routing';
import { NetworkOnly } from 'workbox-strategies';

declare let self: ServiceWorkerGlobalScope;

self.skipWaiting();
clientsClaim();

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// offlineFallback only supplies a *catch handler* — it never routes requests itself. Without
// this, a navigation to any URL that isn't already precached (almost every route: this app is
// server-rendered, not a static site) is never handled by Workbox at all, so it goes straight
// to the network and surfaces the browser's own offline error instead of ours. Network-only,
// not network-first: a stale cached page would show numbers this diary app never actually had.
registerRoute(({ request }) => request.mode === 'navigate', new NetworkOnly());

// Despite this route prerendering to offline.html on disk, @vite-pwa/sveltekit's kit
// integration rewrites the precache manifest entry to the clean SvelteKit URL ("offline", no
// extension) — verified against the actual build output, not assumed. `pageFallback` has to
// match that precache key exactly, or matchPrecache() inside offlineFallback silently misses.
offlineFallback({ pageFallback: 'offline' });
