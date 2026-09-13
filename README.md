# Home Work Hours Tracker

A self-hosted, single-user diary of the hours you work from home, for the Australian financial year (1 July – 30 June). It's built for the ATO fixed-rate method: hours worked from home × the rate for that year.

- **Fills itself in.** Set your standard hours and a weekly or fortnightly schedule, and each day is filled from it, including public holidays for your state.
- **Override anything.** Split days, office days (with the office), leave, sick days and notes.
- **Accountant-ready export.** A styled spreadsheet with a summary and the full diary, with formulas the accountant can check.
- **Mobile-first, desktop-ready.** Installable as a PWA, and deployed as a Docker container (Unraid template included).

> **Status:** early development. The build plan lives in [foundational/](foundational/PLAN_01_OVERVIEW.md).

## Development

Requires Node 24.

```sh
cp .env.example .env
npm install
npm run dev
```

`npm run verify` runs lint, type checks, unit tests (100% coverage required) and Playwright end-to-end tests. See [AGENTS.md](AGENTS.md) for commands and conventions.

## Privacy

This repository is public. Personal data never belongs in it: no real names, workplaces, addresses, work patterns or spreadsheets. Tests and demo data use placeholders like John Doe and "Office Location 1". A pre-commit hook and a CI check enforce this. See [AGENTS.md](AGENTS.md#-1-public-repo-no-pii-ever-read-first-applies-to-everything).

Your own diary lives only in your SQLite database (`data/`, gitignored).
