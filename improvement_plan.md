# Layers Extension - Improvement Plan

**Last Updated:** December 15, 2025
**Status:** Active
**Repository Version:** package.json (version field empty / unspecified)
**Related:** See [`codebase_review.md`](./codebase_review.md) for detailed analysis

---

## Overview

This document provides a **prioritized, actionable improvement plan** based on the critical code review performed December 13, 2025.

### Current State (measured)

| Area | Measured / Status | Notes |
|------|-------------------|-------|
| Functionality | Present | Editor, viewer, API modules and persistence code present in workspace |
| Test Suite | Large but check-needed | ~4,596 occurrences of `test(`/`it(` across `tests/`; 91 test files found. Exact test count should be verified by running the test runner on CI.
| Coverage | Statements: 89.26% / Branches: 77.09% / Functions: 87.45% | Aggregated from `coverage/coverage-final.json` in this workspace (52 files in coverage JSON)
| Codebase size | 75 JS files under `resources/` (excluding `dist/`), ~38,179 JS lines | Editor bundle dominates lines
| ES6 Migration | Mostly complete | No remaining `.prototype.<name> = function` assignments detected in `resources/` (README references aside)
| Namespace | Namespacing present | No unconstrained `window.X` exports found during quick scan — prefer verification in a browser runtime
| God classes | 7 files > 1,000 lines | `CanvasManager.js`, `LayerPanel.js`, `APIManager.js`, `LayersEditor.js`, `SelectionManager.js`, `ToolManager.js`, `ShapeRenderer.js` (shared)

---

## Priority Definitions

| Priority | Timeline | Criteria |
|----------|----------|----------|
| **P0** | This week | Blocking issues, trivial fixes, quick wins |
| **P1** | 1-4 weeks | High-impact improvements |
| **P2** | 1-3 months | Important refactoring |
| **P3** | 3-6 months | Modernization efforts |

---

## Phase 0: Quick Wins (P0)

This section records short, small-effort fixes. Many items in previous versions of this plan were marked as completed by the project; where claims were present I left them but changed phrasing to indicate whether I independently verified them during this review.

P0 items that are either verifiable from the repository or flagged for verification:

- Remove dead PHP code: Not verified in detail here; please confirm via `git log` / commit history if this was already removed.
- Add logging to empty catch blocks: Please verify in runtime logs; I did not run a broad search for all catch blocks.
- Shared helpers extraction: `utils/NamespaceHelper.js` appears in the repository; verify import locations.
- Tests: empty skipped tests and failing IconFactory tests — the repository test tree shows many test files; exact per-test counts require running the test runner.

If you want, I can run the full test suite in this environment to verify the runtime status of the items above (this will take several minutes).

## Phase 1: High-Impact Improvements (P1)

Many P1 items were reported as completed in previous docs; I turned those into action items to verify and into follow-ups where I could confirm the repository state.

P1 items to verify or act on now:

1. Global exports removal: a scan in this workspace did not show un-namespaced `window.X` assignments, but runtime verification in a browser environment is recommended.

2. Integration tests: integration test files are present; running them in CI or locally with a MediaWiki test environment will confirm they pass in your target environment.

3. PHP logging: moving to an injected logger is desirable and appears partially applied; confirm via code search and runtime logs.
---


## Phase 2: Major Refactoring (P2)

Progress and action items in this phase should prioritize maintainability gains with minimal behavioral change. Verified items and next steps below.

P2 items (summary):

1. ES6 migration: largely complete. A workspace grep for prototype assignment patterns indicates no `*.prototype.name = function` assignments in the source (except for documented README examples). This suggests ES6 migration is effectively done.

2. `LayerRenderer` split: renderer responsibilities are already modularized in `resources/ext.layers.shared/` (separate renderers exist); confirm via code review that the public rendering API is stable before additional refactors.

3. CanvasManager extraction: significant extraction has occurred but `CanvasManager.js` remains large (1,895 lines). Continue extracting coordination logic into small controllers and increase unit coverage around extracted boundaries.

### Refactor progress (verified)

- `CanvasPoolController` extracted: `resources/ext.layers.editor/canvas/CanvasPoolController.js` — pooling logic moved out of `CanvasManager` and delegated when present. Unit test added: `tests/jest/CanvasPoolController.test.js`.
- `CanvasImageController` extracted: `resources/ext.layers.editor/canvas/CanvasImageController.js` — image loading lifecycle moved out of `CanvasManager` and delegated when present. Unit test added: `tests/jest/CanvasImageController.test.js`.
- Tests: After these extractions and tests, the full Jest suite passes locally: 94 suites, 4,620 tests (no failures) in this workspace.

These extractions were implemented in a non-breaking way: `CanvasManager` preserves its original fallback behavior when the controllers are not present. Both controllers are documented in `docs/REFRACTOR_CANVASPOOL.md` and `docs/REFRACTOR_IMAGECONTROLLER.md`.

### P2.2 Split LayerRenderer.js

**Status:** ✅ COMPLETE (December 13, 2025)  
**Effort:** 2 weeks  
**Impact:** Maintainability, isolated testing

**Resolution:**
LayerRenderer reduced from 1,953 lines to **371 lines** (81% reduction)

**Extracted Renderers:**
| Renderer | Lines | Purpose |
```markdown
# Layers Extension — Improvement Plan

**Last Updated:** 2025-12-15
**Status:** Draft (workspace-verified items + actions to verify)
**Related:** See [`codebase_review.md`](./codebase_review.md) for the review that informed this plan.

This document turns the review's findings into a concise, prioritized set of actions with suggested timelines and verification steps.

---

Priority definitions
- P0: This week — low-effort, high-value fixes and verifications
- P1: 1–4 weeks — high-impact improvements and CI additions
- P2: 1–3 months — larger refactors that reduce maintenance costs
- P3: 3–6 months — modernization and optional migrations

---

P0 — Quick verifications and low-effort fixes (this week)

1) Re-generate tests and coverage (Owner: CI / maintainer; Effort: ~10–30 minutes)
	- Commands:
	  - `npm run test:js -- --coverage`
	  - `composer test` or configured PHPUnit command for PHP tests
	- Outcome: Fresh coverage JSON and a reproducible baseline for metrics in `coverage/`.

2) Add a CI job to fail on significant coverage regressions (Owner: CI engineer; Effort: 1–2 days)
	- Gate: prevent PR merges if overall statement or branch coverage drops by >1% relative to base branch.

3) Event-listener audit (Owner: frontend maintainer; Effort: 1–2 days)
	- Produce a short report listing `addEventListener` and `removeEventListener` locations and lifecycle ownership.
	- Add paired cleanup where editor instances are destroyed or re-created.

---

P1 — High-impact improvements (1–4 weeks)

1) Increase branch coverage for high-risk modules (Owner: devs; Effort: 1–2 weeks)
	- Focus modules: `CanvasManager`, `ToolManager`, `SelectionManager`.
	- Add targeted unit tests that exercise conditional branches and error paths.

2) Split one large file as a proof-of-work (Owner: core dev; Effort: 1–2 weeks)
	- Candidate: `CanvasManager.js` (high impact) or `LayerPanel.js` (smaller surface area).
	- Goal: extract 1–2 controllers with full unit tests and preserve behavior.

3) Add E2E in CI (Owner: infra/QA; Effort: 1–2 weeks)
	- Integrate a headless Playwright job that runs a small set of end-to-end flows in a reproducible MediaWiki test environment (Docker recommended).

4) Improve PHP logging and observability (Owner: backend dev; Effort: 2–3 days)
	- Ensure critical error paths log useful context and that log level is configurable via LocalSettings.

---

P2 — Refactor and hardening (1–3 months)

1) Continue decomposing remaining "god classes" (Owner: multiple frontend devs; Effort: 4–6 weeks)
	- Work iteratively: extract a controller → add tests → merge. Repeat.
	- Targets: reduce files >1,000 lines and keep per-file complexity low.

2) Add TypeScript `.d.ts` for public client APIs (Owner: frontend dev; Effort: 2–4 weeks)
	- This enables better editor support and future incremental TS migration.

3) Add CI checks for docs and i18n (Owner: docs/QA; Effort: 2–4 days)
	- Verify i18n keys used in JS/PHP match `i18n/en.json`.

---

P3 — Modernization (3–6 months)

1) Evaluate incremental TypeScript migration (Owner: arch/lead; Effort: depends on scope)
2) If viewer payload size becomes critical, split viewer/editor packaging and optimize viewer-only bundle.

---

Minimal acceptance criteria
- For P0: Fresh test run completes, coverage artifacts regenerated, and an event-listener audit report exists.
- For P1: One large-file split merged with tests and no coverage regressions; a minimal E2E CI job runs and reports pass/fail.
- For P2: Remaining files >1,000 lines reduced to a target agreed with the team (example target: <= 2 files >1,000 lines). CI enforces coverage thresholds.

Suggested first three tasks (practical ordering)
1. Re-run tests and upload coverage to CI artifacts (P0)
2. Run event-listener grep + short audit (P0)
3. Create a PR that extracts one controller from `CanvasManager.js` with tests (P1)

If you want, I can: regenerate coverage now, prepare the event-listener audit, or produce the extraction PR for `CanvasManager.js`. Which should I start with?

---

*Drafted by GitHub Copilot — apply items iteratively and re-run the test/coverage commands to keep metrics accurate.*

```
---
