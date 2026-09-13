# CLAUDE.md

@AGENTS.md

## Claude Code specifics

- **PII first:** this is a public repo. Re-read AGENTS.md §1 before any commit, and never pass `--no-verify`.
- **Skills:**
  - Load `frontend-design` (`.claude/skills/frontend-design`) before building or reshaping any UI.
  - Load `dataviz` before writing chart code (the punch card, monthly bars).
- **Plans:** work from `foundational/PLAN_01_PHASE_NN_*.md`. Tick the acceptance criteria as you go, and record deviations in the phase doc.
- **Parallel agents:** after Phase 02, Phases 03, 05 and 06 are independent. Give each agent its phase doc, AGENTS.md and DESIGN.md, and consider a separate worktree per agent.
- **UI verification:** use the Playwright screenshot recipe in AGENTS.md §7 and look at the images (both viewports, both themes) before calling any UI work done.
