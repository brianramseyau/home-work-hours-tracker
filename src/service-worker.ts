/// <reference lib="webworker" />
// Custom service worker (injectManifest mode — see vite.config.ts's SvelteKitPWA options).
// Precaches the built app shell, then falls back to the static /offline page for any
// navigation, image or font request the network and cache can't satisfy.
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { offlineFallback } from 'workbox-recipes';

declare let self: ServiceWorkerGlobalScope;

self.skipWaiting();
clientsClaim();

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

offlineFallback({ pageFallback: '/offline' });
