# DESIGN — Home Work Hours Tracker

The design system and brand rules. Load the `/frontend-design` skill before any UI work, and log decisions and deviations at the bottom of this file.

## Brief

- **Subject:** a personal work diary that mostly fills itself.
- **Job:** produce an auditable "hours worked from home" figure at tax time.
- **Audience:** one person, glancing at a phone daily ("did yesterday fill right? I was actually in the office") and reviewing on a desktop occasionally. At the end of the year the output goes to an accountant.

## Concept: "the desk lamp"

The app looks like a cool ink-and-paper timesheet. **The home hours glow a warm lamp-amber, so the tax-relevant thing is the only warm colour on screen.** Everything else stays cool and quiet.

## Colour

| Token     | Light     | Dark      | Role                                                       |
| --------- | --------- | --------- | ---------------------------------------------------------- |
| `paper`   | `#F4F6FA` | `#141A2B` | Background (cool paper / ink-navy, never pure black)       |
| `ink`     | `#1D2640` | `#E6EAF2` | Text, primary actions                                      |
| `lamp`    | `#F2A93B` | `#F2A93B` | **Home** hours and the logo glow only. Text on lamp is ink |
| `slate`   | `#8193B2` | `#6F82A6` | Office                                                     |
| `heather` | `#A98BD1` | `#9C7FC6` | Leave                                                      |
| `rosehip` | `#D9727E` | `#CC6572` | Sick                                                       |
| `gum`     | `#7FA88A` | `#6E9A7A` | Public holiday                                             |

These are mapped onto the shadcn-svelte variables in `src/routes/layout.css`: `--background` = paper, `--foreground` = ink, `--primary` = ink, plus the derived muted, border and accent tints. shadcn's `--accent` (hover backgrounds) is deliberately a cool tint, **not** lamp, because lamp is reserved for Home data. The brand colours are also exposed as Tailwind colours (`bg-lamp`, `text-slate`, …), and the patterns as `pattern-*` utilities that read `--swatch`. The final contrast values are validated with screenshots and axe.

### Status is never shown by colour alone

| Type           | Colour       | Pattern                                    |
| -------------- | ------------ | ------------------------------------------ |
| Home           | lamp         | solid fill                                 |
| Office         | slate        | outline only                               |
| Split          | lamp + slate | half-solid / half-outline (diagonal split) |
| Leave          | heather      | diagonal hatch                             |
| Sick           | rosehip      | dots                                       |
| Public holiday | gum          | ring                                       |
| Off / empty    | —            | faint dash                                 |
| Future         | —            | light hatch at low opacity                 |

The same scheme is used in the punch card, the legend, the day rows and the export (as row tints).

## Type

- **Display:** _Bricolage Grotesque_ (variable). Used for page titles and the running total. Its optical-size axis is an active element: the hours numeral is set large, and the browser picks the tighter display cut automatically (`font-optical-sizing: auto`). The width axis isn't available in the combined fontsource file; see the decisions log.
- **UI/body:** _Public Sans_ (variable). A civic, plain face that suits a tax-adjacent tool.
- Both are self-hosted via `@fontsource-variable` for the offline PWA.
- Times, hours and money always use `font-variant-numeric: tabular-nums`, and numbers are right-aligned in tables.
- Scale (1.25 ratio): 12 / 14 / 16 (base) / 20 / 25 / 31 / 39 / 49 px. Body line-height is 1.5, and headings are 1.15.

### Copy rules

- Sentence case everywhere. No all-caps labels or eyebrows.
- No middle-dot meta strings, no `→` appended to buttons, no spaced em-dash label fragments.
- Buttons are verb-first and say exactly what happens ("Save day", "Download spreadsheet"), and the toast uses the same verb ("Day saved").
- Errors say what to do ("End time must be after start time"). Empty states invite action.

## Layout

Mobile-first. Desktop is a first-class layout, not a stretched phone.

```text
Mobile (<768px)                         Desktop (≥1024px)
┌──────────────────────┐                ┌────┬───────────────────────────────┬──────────────┐
│ FY27 ▾   ‹ Week 11 › │                │rail│ punch-card strip               │ 412.5 h home │
│ ▮▮▯▮▮ punch strip    │                │nav │───────────────────────────────│ $288.75      │
│ 412.5 h at home      │                │    │ Week 11  Mon 14 Sep  Home 7.6h │ at 70c/hr    │
│ Mon 14  Home   7.6 h │                │    │          Tue 15 Sep  Home 7.6h │ month bars   │
│ Tue 15  Home   7.6 h │                │    │          Wed 16 Sep  Office 1  │ day counts   │
│ Wed 16  Office 1     │                │    │ sticky week headers, inline    │              │
│ Thu 17  Office 2     │                │    │ time editing, j/k navigation   │              │
│ Fri 18  Home  (ghost)│                │    │ day editor opens as right Sheet│              │
├──────────────────────┤                │    │                               │              │
│ Week  Year Export  ⚙ │                └────┴───────────────────────────────┴──────────────┘
└──────────────────────┘
```

- Content is left-aligned. The day editor is a bottom Drawer on mobile and a right Sheet on desktop.
- Hierarchy comes from type and spacing, **not** from a grid of identical rounded cards. Radius varies by role: inputs and buttons 8px, sheets and drawers 16px, punch-card cells 3px.
- No gradients and no soft grey shadow on everything. Elevation is used only for overlays.

## The memorable element: the FY punch card

- A grid of 53 weeks × Mon–Fri (Mon–Sun when "Include weekends" is on). It's horizontal on desktop and vertical and scrollable on mobile.
- Each cell carries the type's colour and pattern. Future cells are hatched.
- Hovering or focusing a cell shows the date, the type and the hours. Clicking opens the day editor.
- It's the hero of `/[fy]/year`, and a slim strip version sits at the top of the Diary.
- **The one orchestrated motion:** on first load the cells fill in week order (about 600ms total). It's skipped under `prefers-reduced-motion`. No other ambient animation. Motion in response to actions (a drawer opening, a save confirming) is fine.

## Branding

- **Name:** "Home Work Hours Tracker". The short form is "Home Hours" (the PWA `short_name` and the mobile header).
- **Mark:** an original desk lamp whose light cone falls on a timesheet or clock face. It's ink line work with a lamp-amber glow. A simplified glyph (lamp head and cone) is used at 16–32px.
- **Assets** (`src/lib/assets/`): `logo-mark.svg`, `logo-lockup.svg` (mark plus wordmark in Bricolage Grotesque, outlined), `logo-mark-mono.svg`, `favicon-glyph.svg`.
- **Generated files** (`scripts/generate-icons.mjs`): `favicon.svg` (dark-scheme aware), `favicon.ico` (16/32/48), `apple-touch-icon.png` (180), PWA `icon-{192,512}.png` plus maskable variants (ink ground, safe-zone padding), `brand/logo-lockup.png` (for the xlsx), and `docs/social-preview.png` (1280×640).
- **Where it appears:** the rail (lockup) and mobile header (mark), the tab, the PWA install and splash screens, `+error.svelte` (the lamp switched off: "This page is off the clock"), the export title band, the README header, and the GitHub social preview.
- **Rules:**
  - Clear-space equals the lamp-head height.
  - Minimum sizes: the mark 16px with the glyph, the lockup 120px wide.
  - Lamp-amber is reserved for the glow and for Home data. Never use it for generic buttons or links.
  - The mono variant is for print and single-colour contexts.
- **Export branding:** the logo in the Summary title band, and the footer "Prepared with Home Work Hours Tracker — https://github.com/brianramseyau/home-work-hours-tracker" on both sheets and in the print footer.

## Quality floor

- Responsive down to 360px with no horizontal scroll, and a visible keyboard focus (a 2px ink or lamp ring).
- `prefers-reduced-motion` respected, and axe clean in both themes.
- Screenshots at 390px and 1440px in light and dark for every UI change, using the en-GB locale (day-first).

## Decisions log

| Date       | Phase | Decision                                                                                                                                                                                                                                                                                                           |
| ---------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-09-13 | Plan  | Initial token system, "desk lamp" concept, punch-card hero, and branding brief agreed in PLAN_01.                                                                                                                                                                                                                  |
| 2026-09-13 | P01   | Bricolage Grotesque loads as `opsz.css` (optical size + weight). The fontsource package ships the width axis only as separate files, so the condensed-width numeral idea is dropped; large sizes get tighter optical-size cuts automatically.                                                                      |
| 2026-09-13 | P01   | Logo masters use `currentColor` for ink parts and are inlined (not `<img>`), so the mark follows the theme. Clock hands stay ink because they always sit on the amber face. PNGs pin the colour at generation time.                                                                                                |
| 2026-09-13 | P01   | The favicon uses the simplified glyph (shade, cone, clock): the full mark isn't legible at 16px. `favicon.svg` switches ink to light under `prefers-color-scheme: dark`.                                                                                                                                           |
| 2026-09-13 | P01   | Active nav is ink (bar and weight), never lamp, so amber stays reserved for Home hours.                                                                                                                                                                                                                            |
| 2026-09-13 | P01   | The outlined wordmark lockup (`logo-lockup.svg/png`) is deferred to P05, where the export first needs it. The in-app lockup is the inline mark plus live Bricolage text.                                                                                                                                           |
| 2026-09-14 | P03   | shadcn's default inactive-tab colour (`text-foreground/60`) fails WCAG AA against this app's `--muted` tab-list background (3.86:1, found by the E2E axe check). Overridden to `text-muted-foreground` at each call site — never edit the vendored `tabs-trigger.svelte` itself.                                   |
| 2026-09-14 | P03   | A dynamic single-pick control (the schedule editor's per-day office) uses `ToggleGroup`, not a native `<select>` or bits-ui's `Select` — see AGENTS.md §5 for why. It reads as one more segmented control next to Home/Office/Off, which is consistent with the "quiet, no stray widgets" layout principle anyway. |
