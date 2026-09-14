# PLAN_01 · Phase 07 — Deployment, PWA and polish

**Goal:** the app runs on Unraid from a published image, installs as a PWA, and has passed a full visual and accessibility review.

**Depends on:** all previous phases.

## Docker and Unraid (adapted from ev-charging-log)

- **`Dockerfile`**, multi-stage (build / prod-deps / runtime) on `node:24-alpine`:
  - `python3 make g++` for better-sqlite3.
  - `ENV DATABASE_URL=/data/home-work-hours.db`, `PORT=3000`, `TZ=Australia/Melbourne` (overridden by Unraid's injected `TZ`).
  - Build-time `DATABASE_URL=/tmp/build-time.db`, because SvelteKit's analyse step imports the hooks.
  - The `APP_VERSION` build arg.
  - `apk add tzdata` if the local-date check below fails without it.
- **`docker/entrypoint.sh`:** the PUID/PGID logic copied verbatim (defaults 99/100, `su-exec`).
- **`.dockerignore`:** node_modules, data, .env, `*.xlsx`, coverage, test output, `.pii-denylist`.
- **`.github/workflows/docker-publish.yml`:** GHCR, tags for `latest`/semver/sha, and the `dev-<sha>` APP_VERSION on untagged builds.
- **`unraid/home-work-hours-tracker.xml`:** WebUI port 3000, `/data` → `/mnt/user/appdata/home-work-hours-tracker`, PUID, PGID, and `TZ` (default `Australia/Melbourne`, for non-Unraid hosts).
- **Verify:** the container reports the correct local "today" under `TZ`, and a day created at 23:30 local lands on the right date.

## PWA

- `@vite-pwa/sveltekit` with `registerType: 'autoUpdate'`.
- Manifest:
  - `name`: APP_NAME. `short_name`: "Home Hours".
  - `theme_color`: ink. `background_color`: paper.
  - `display`: standalone.
  - The P01 icon set, including the maskable icons.
- Workbox globs for the app shell and the self-hosted fonts. The offline fallback renders `+error.svelte` with offline copy ("You're offline. Your diary will be here when you reconnect.").
- Service-worker registration in the layout, the same pattern as ev-charging-log.

## Seed and docs

- `scripts/seed-dev-db.ts` → `npm run db:seed`, with a confirmation prompt and a `--yes` flag. It creates:
  - "John Doe".
  - Offices "Office Location 1" and "Office Location 2".
  - FY26 and FY27 at 70 c/hr.
  - An alternating-fortnight schedule.
  - Some leave, sick days and splits.
  - Synthetic data only.
- **README:**
  - The logo header, what the app is, and the features.
  - Screenshots (mobile and desktop, light and dark) **taken from the seed data only**.
  - Quick start (dev), Docker/Unraid install, backup notes (copy `/data`), and the export description.
  - The PII policy for contributors.
- `RELEASE_NOTES.md` starting at v0.1.0.
- `docs/social-preview.png` (1280×640) generated from the lockup. Remind the owner to set it in the GitHub repo settings.

## Polish pass

- Load `/frontend-design` and critique every screen against DESIGN.md, then remove one accessory, per the skill.
- axe clean on all pages in both themes, and a visible keyboard focus.
- `prefers-reduced-motion` respected, and no horizontal scroll at 400px.
- Check all copy for sentence case, verb-first buttons, errors that say how to fix things, and empty states that invite action.
- Lighthouse PWA installability check.

## Acceptance criteria

- [x] `docker build` and `docker run` against an empty volume: it boots, migrates and serves. The data persists across a container rebuild. File ownership matches PUID/PGID.
- [ ] The PWA installs on Android Chrome and on desktop Chrome, and the offline page shows when disconnected. (Verified structurally — see Notes below — but not on a physical Android device, which this environment doesn't have.)
- [x] `verify` is green, `check-pii --all` is clean, and the README screenshots contain only seed data.

## Notes and deviations

- **PWA strategy: `injectManifest`, not `generateSW`.** This app is SSR (adapter-node), not a SPA, so `workbox.navigateFallback` (the usual `generateSW` offline recipe) is the wrong tool — it unconditionally serves a cached fallback for every unmatched navigation, online or not, which would break routing to any page not already precached (every `/[fy]/...` route). Instead `src/service-worker.ts` is a small custom worker (`workbox-precaching` + `workbox-recipes`' `offlineFallback`, which registers a `NetworkOnly` navigation route with a precached-page catch handler) — it only ever substitutes `/offline` when the network genuinely fails. `src/service-worker.ts` is excluded from coverage (see AGENTS.md §5): it only runs in the browser's service-worker execution context, which no test runner here can reach.
- **`src/service-worker.ts`, not `src/pwa-sw.ts` or a custom `srcDir`/`filename`.** `@vite-pwa/sveltekit`'s `injectManifest` mode relies on SvelteKit's own reserved service-worker path being compiled by SvelteKit itself first, then injects the precache manifest into that compiled output at `build/client/service-worker.js`. A custom path silently produces a missing-file build error.
- **`/offline` is a prerendered SvelteKit route**, not a static file outside the SvelteKit build, so it renders with the app's own shell/styling and gets a real revisioned cache entry from the same build. It reuses the `+error.svelte` illustration and layout pattern.
- **Service worker registration is manual** (`src/lib/pwa.ts`, called from `+layout.svelte`'s `$effect`). `@vite-pwa/sveltekit`'s `injectRegister` auto-injection targets a Vite-processed `index.html`; SvelteKit's `app.html` isn't transformed the same way for an SSR adapter, so nothing injects the registration script automatically. The manifest `<link>` in `app.html` is likewise added by hand.
- **`docker build`/`docker run` were exercised for real** against a local Docker daemon (not just read for plausibility): an empty-volume boot, a stop/restart with the same volume to confirm the SQLite file persists and isn't re-migrated from scratch, and a file-ownership check against the default `PUID=99`/`PGID=100`.
- **Docker image publishing is multi-arch** (`linux/amd64` + `linux/arm64`, via QEMU) even though the plan didn't call it out explicitly, since Unraid boxes are occasionally ARM (and `better-sqlite3`'s native build makes single-arch an easy trap to fall into later).
- `npm run db:seed` is a `.ts` script run via `tsx` (added as a devDependency) rather than plain `node`: the script imports the app's own `src/lib/**`/`src/lib/server/**` modules using this codebase's extensionless relative-import convention, which plain Node's built-in TS stripping can't resolve without a bundler-aware loader.
