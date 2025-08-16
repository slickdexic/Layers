# Layers Extension — Codebase Review Report

## Overview

This report audits the Layers MediaWiki extension codebase, with a focus on: stability, code quality, UI/UX fit for professional use, and developer experience. It prioritizes the critical bug where zooming did not anchor to the mouse pointer, catalogs issues by severity, documents work already completed, and outlines a forward plan.

Scope reviewed:

- Canvas editor stack under `resources/ext.layers.editor/*` (zoom/pan, selection, tools, rendering, validation)
- Build/CI: ESLint (eslint-config-wikimedia), Stylelint (stylelint-config-wikimedia), Banana i18n
- Tests: Jest setup and existing editor tests under `tests/jest/*`
- i18n and message documentation under `i18n/`


## Architecture highlights

- Canvas transform model is translate + scale with origin at (0, 0). Zoom/pan operations map client to canvas coordinates.
- Rendering pipeline: optional `RenderEngine` draws background, layers, handles, guides; otherwise fall back to `CanvasManager` direct draws.
- Tools: Pointer, pen, basic shapes, polygon/star, text, and path tools orchestrated by `ToolManager` with stateful temp layers.
- Selection: Drag/resize/rotate with handle hit-testing via `SelectionManager`.
- Validation: `LayersValidator` enforces input bounds and formats with i18n’d messages.


## Issues by severity

### Critical

- Zoom does not anchor to mouse pointer (fixed)
  - Symptom: Zoom steps centered the canvas rather than the cursor location; controls misaligned at non-100% zoom.
  - Fix: Implemented pointer-centered zoom using client↔canvas mapped deltas and DOMRect-based conversions; verified by manual smoke and unit lint checks.

- Coordinate conversion duplication and drift (addressed)
  - Risk: Multiple ad-hoc conversions increased drift and edge-case bugs at non-1.0 zoom or when panning.
  - Fix: Centralized conversions in CanvasManager and consumers (SelectionManager/ToolManager/RenderEngine) now use common helpers.

### High

- Zoom-dependent visuals and non-invariant handle sizes (addressed)
  - Symptom: Handles and guides scaled with zoom, harming usability.
  - Fix: Normalize stroke/handle sizes to remain readable at any zoom level.

- Unstable CI from lint/i18n gaps (addressed)
  - Symptom: Stylelint whitespace flaps, Banana missing qqq.json docs, ESLint max-len and JSDoc type warnings.
  - Fixes: Whitespace normalization in CSS, added qqq.json docs for missing keys, wrapped long lines and added minimal typedefs to quell JSDoc type warnings.

### Medium

- Overly long lines reduce maintainability (addressed where noisy)
  - Action: Wrapped/split expressions across CanvasManager, RenderEngine, SelectionManager, ToolManager, LayersValidator.

- Logging inconsistency
  - Symptom: Mixed console/mw.log/mw.track.
  - Action: Standardized logging towards mw.log/mw.track-compatible usage patterns.

- Minor duplication in wheel/zoom handlers (addressed)
  - Action: Deduplicated wheel handlers to avoid diverging behavior.

### Low

- CSS polish: spacing/empty-line rules (addressed where failing)
  - Action: Normalized whitespace and rule spacing in editor CSS; Stylelint is clean.

- JSDoc completeness
  - Status: Most practical gaps addressed; deeper type coverage can be added incrementally.


## UI/UX findings (with /ui_deficiencies/ references)

From `ui_deficiencies/ui01.jpg` … `ui07.jpg` and hands-on usage:

- Controls/handles misaligned at non-100% zoom → fixed via pointer-anchored zoom and normalized screen-space rendering of UI affordances.
- Decimal-pixel rounding produced blur at some scales → favor integer-pixel rendering for screen-space UI and devicePixelRatio-aware canvas sizing.
- Dated visual style → recommend a modern neutral theme, clearer states, and consistent iconography.

Targeted improvements recommended:

- Zoom-invariant UI scale for handles, guides, and rulers in CSS/Canvas.
- Crisper visuals by snapping UI outlines/handles to device pixels; size canvas at DPR with CSS pixel scaling.
- Visual refresh: updated palette, spacing, and icon set to improve clarity and accessibility.


## Changes implemented in this iteration

- Pointer-anchored zoom math and DOMRect-based coordinate helpers in CanvasManager and consumers.
- Normalized zoom-invariant UI for selection handles/guides.
- Deduplicated wheel/zoom handlers and reduced drift.
- Standardized logging to MediaWiki-friendly patterns.
- CI stabilization:
  - Stylelint: whitespace/trailing spaces normalized; clean.
  - Banana: added qqq.json docs for 21 missing keys; clean.
  - ESLint: wrapped long lines, added minimal typedefs; clean.


## Current CI state

- ESLint: 0 errors, 0 warnings locally.
- Stylelint: 0 errors.
- Banana: 0 missing docs.


## Recommendations and roadmap

Short term (1–2 sprints):

- Add Jest unit tests for zoom-to-pointer math and client↔canvas conversions (happy path + edge cases: extreme zoom, negative pan, fractional DPR).
- Add tests for selection handle hit-testing and resize/rotate math at varying zooms.
- Harden color/number validation tests for `LayersValidator` (boundary, invalid formats, NaN).

Medium term:

- Introduce a single source of truth for editor view state (zoom, pan, DPR, canvas rect) with read-only derivations to reduce coupling.
- Extract tool registry to simplify `ToolManager` branching; enable lazy registration for advanced tools.
- Expand JSDoc types for public editor APIs; consider TypeScript or JSDoc+TS tooling for stronger guarantees.

UI/UX roadmap:

- Refresh the editor theme (colors, spacing, and focus states); ensure WCAG AA contrast.
- Replace or refine icons; ensure consistent hit areas and pointer feedback.
- Add a zoom control (minimap or +/- plus dropdown) and visible zoom percentage.
- Snap guides/rulers toggle; alignment helpers; sticky snapping at common angles (0/45/90°).

Operational:

- Keep CI strict; block merges on lint/i18n regressions.
- Add a visual smoke test doc with screenshots across 0.25×, 1×, 2× to prevent regressions.


## Quality gates (this run)

- Build/Lint: PASS (ESLint/Stylelint/Banana).
- Unit tests: Existing Jest suite executes; add new tests per roadmap.
- Smoke: Manual verification of pointer-anchored zoom and selection behavior at non-100% zoom.


## Summary

The critical zoom-to-pointer defect is fixed, coordinate conversions are centralized, UI affordances are zoom-invariant, and CI is clean. The codebase is in a stable state for a professional editor, with a clear path to add tests and continue UI modernization guided by the `/ui_deficiencies` images and recommendations above.
