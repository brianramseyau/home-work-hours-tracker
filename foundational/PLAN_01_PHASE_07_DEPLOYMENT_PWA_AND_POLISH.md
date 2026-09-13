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

- [ ] `docker build` and `docker run` against an empty volume: it boots, migrates and serves. The data persists across a container rebuild. File ownership matches PUID/PGID.
- [ ] The PWA installs on Android Chrome and on desktop Chrome, and the offline page shows when disconnected.
- [ ] `verify` is green, `check-pii --all` is clean, and the README screenshots contain only seed data.
