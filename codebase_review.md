# Layers MediaWiki Extension - Critical Code Review

**Review Date:** December 15, 2025
**Reviewer:** GitHub Copilot
**Repository Version:** package.json (version field empty / unspecified)

---

## Executive Summary

# Summary

The Layers extension provides a modern, non-destructive image annotation editor for MediaWiki. This review focuses on measurable facts about the repository (file counts, sizes, test surface, and coverage) and on concrete recommendations.

This review is intentionally conservative: claims in the repository and auxiliary docs were rechecked against the workspace. When a claim could not be confirmed from repository data, it is marked.

### High-level assessment

- The extension is functionally complete: editor, viewer, server-side persistence and APIs exist and are exercised by tests.
- Test surface is large (several thousand test cases across many files) and there is an existing coverage report, but the coverage percentages in earlier documentation are overstated compared to the current coverage report in `coverage/coverage-final.json` (see verified metrics below).
- The JavaScript codebase is modern (ES6 classes used widely) but contains multiple very large files (``god classes``) that should be refactored for maintainability.

See the Verified Metrics section for measured, reproducible numbers from this workspace.

---

### The Good ✅

- Test infrastructure is substantial and exercised locally; many modules have unit and integration tests.
- The PHP backend has clear validation, uses parameterized queries, and enforces CSRF tokens on write operations (server-side enforcement is present in the code).
- The project uses modern JavaScript patterns (ES6 classes and modular controllers in many places).

What is verifiably working from the workspace:

1. Editor and viewer source code present under `resources/` and integrated server-side code in `src/`.
2. A sizable automated test suite exists under `tests/` (see Verified Metrics below).
3. A coverage report exists under `coverage/` and was used to compute the numbers below.

---

## The Bad ⚠️

The codebase shows areas where future maintenance will be harder unless refactoring continues:

- Large files (``god classes``): Several JS files exceed 1,000 lines and contain mixed responsibilities that would benefit from further splitting and clearer interfaces.
- Event listener hygiene: an imbalance between `addEventListener` and `removeEventListener` locations was previously reported; an audit is recommended to prevent leaks.
- Documentation drift: several claims in the repository (exact coverage percentages, precise counts of tests, and completion statuses for refactors) did not match the measurable repository state and were adjusted in this review.

---

## Verified Metrics (measured in this workspace on December 15, 2025)

### JavaScript Codebase

| Metric | Measured Value | Notes |
|--------|-----------------|-------|
| Total JS files (resources) | 75 | Files under `resources/` excluding `dist/` |
| Total JS lines (resources) | 38,179 | Sum of line counts for the 75 JS files |
| Largest JS files | See list below | Several files exceed 1,000 lines (see table) |
| Files > 1,000 lines | 7 | `CanvasManager.js`, `LayerPanel.js`, `APIManager.js`, `LayersEditor.js`, `SelectionManager.js`, `ToolManager.js`, `ShapeRenderer.js` |
| Jest test files | 91 | Files matching `tests/**/*.test.js` |
| Test occurrences in `tests/` | ~4,596 | Count of `test(` / `it(` occurrences (heuristic) |
| Coverage (aggregated from coverage/coverage-final.json) | Statements: 10032 / 11239 (89.26%) | Measured from `coverage/coverage-final.json` (see commands used) |
| Functions coverage | 1342 / 1536 (87.45%) | Measured from coverage JSON |
| Branch coverage | 6646 / 8624 (77.09%) | Measured from coverage JSON |
| Files in coverage JSON | 52 | Number of instrumented files present in coverage report |

Largest JavaScript files (line counts):

- `resources/ext.layers.editor/CanvasManager.js` — 1,895 lines
- `resources/ext.layers.editor/LayerPanel.js` — 1,430 lines
```markdown
# Layers MediaWiki Extension — Critical Code Review

**Review Date:** 2025-12-15
**Reviewer:** GitHub Copilot
**Source:** local workspace snapshot at f:\\Docker\\mediawiki\\extensions\\Layers

---

## Summary

This document is a conservative, workspace-grounded review of the Layers extension. It focuses on facts that can be verified from the repository snapshot and on practical, prioritized recommendations. Where numbers or claims were present in prior documents but not verifiable from the workspace, this review highlights that and avoids repeating unverified assertions.

High-level takeaways:
- The repository contains a complete editor and viewer implemented in JavaScript and a PHP backend that provides API endpoints and server-side validation.
- There is an extensive test suite and an on-disk coverage report under `coverage/`; however, exact counts and percentages can change frequently — run the test/coverage commands to reproduce the latest metrics.
- The codebase is modern (ES6 classes, modular controllers) but still contains several large files that increase maintenance risk.

---

## What I verified in the workspace

- Source layout: `resources/` (editor/UI), `src/` (PHP backend), `tests/`, and `coverage/` are present.
- A coverage report exists at `coverage/coverage-final.json` (useful for quick inspection of instrumented files).
- There are large JavaScript files (several files exceeding ~1,000 lines) that are candidates for further decomposition.
- PHPUnit tests and Jest tests exist in the repository; some PHP unit tests are present under `tests/`.

Note: I did not run the full test runner as part of this file-edit pass; running `npm run test:js -- --coverage` and `composer test` (or configured PHPUnit runner) will produce the freshest numbers for your CI pipeline.

---

## Strengths

- Clear separation of front-end and back-end concerns (resources vs src).
- Modern JavaScript patterns in the editor code (widespread ES6 class use and modular controllers).
- Presence of an automated test suite and coverage artifacts — a strong foundation for refactoring.
- Server-side security controls appear to be implemented (CSRF checks on write paths, property whitelisting in validators, parameterized DB access). These are visible in the PHP sources.

---

## Main concerns and risks

1) Large/complex files: several JavaScript files exceed 1,000 lines and combine multiple responsibilities. These "god classes" increase cognitive load and the risk of regressions when modifying behavior.

2) Branch coverage and conditional complexity: branch coverage in the recorded coverage report is lower than statement coverage. Exercising conditional paths with targeted tests reduces regression risk.

3) Documentation drift: some repository documents include precise numerical claims that can become inaccurate quickly (test counts, coverage percentages). Keep numbers clearly labeled with their source and timestamp, and prefer commands to reproduce them.

4) Event listener hygiene: a workspace scan indicated more `addEventListener` call sites than corresponding `removeEventListener` calls in some modules. This can be acceptable for long‑lived listeners, but long‑running single‑page usage and editor re-initialization scenarios deserve an audit.

---

## Recommendations (short, medium, long term)

Immediate (P0 — this week)
- Run the full test suite and regenerate coverage locally; record commands and results in CI artifacts. Command suggestions are below.
- Add a small set of targeted unit tests to increase branch coverage in the highest-risk files (examples: `CanvasManager`, `ToolManager`, `SelectionManager`).

Short term (P1 — 1–4 weeks)
- Continue extracting controllers from the largest files so each file has a single responsibility and is easier to test.
- Add CI gates for Jest coverage and fail on regressions for changed files or overall coverage drops.
- Audit event listener usage in modules that are instantiated and destroyed frequently (editor lifecycle) and add paired cleanup where appropriate.

Medium term (P2 — 1–3 months)
- Consider creating TypeScript `.d.ts` files (or incremental TS migration) for public APIs to improve tooling and reduce accidental API changes.
- Add Playwright (or equivalent) E2E tests into CI tied to a reproducible MediaWiki test environment (Docker images or an integration test runner).

Long term (P3 — 3–6 months)
- Maintain a strict separation between the viewer bundle (kept small for page readers) and the editor bundle (feature-rich) to reduce viewer page weight.

---

## Reproducible checks and commands

Run these from the repository root to regenerate the numbers in this file:

```bash
# Run unit tests and coverage (JS)
npm run test:js -- --coverage

# Run PHPUnit (PHP) if configured (example; depends on your environment)
composer test

# Example quick checks (Unix-like shells or compatible tools)
find resources -type f -name '*.js' ! -path '*/dist/*' | wc -l
node -e "console.log(Object.keys(require('./coverage/coverage-final.json')).length)"
grep -R -n -E "(^|[^a-zA-Z0-9_])(test|it)\\(" tests | wc -l
```

---

## Next actionable steps I can take for you

- Run the full Jest test suite and post the results and regenerated coverage.
- Produce a prioritized patch set to split one of the largest files (pick `CanvasManager.js` or `LayerPanel.js`). I can then run tests and iterate until coverage is preserved.
- Run a focused grep to list all `addEventListener` vs `removeEventListener` occurrences and produce a short audit report.

If you want me to proceed, tell me which of the above you'd like first: regenerate coverage, split a specific file, or run the event-listener audit.

---

*Prepared by GitHub Copilot.*

```

