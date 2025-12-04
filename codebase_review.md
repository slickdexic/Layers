# Layers MediaWiki Extension - Critical Code Review

**Review Date:** December 3, 2025  
**Last Updated:** December 3, 2025  
**Version:** 0.8.1-dev  
**Reviewer:** GitHub Copilot  
**Review Type:** Comprehensive Audit  
**Previous Review:** Earlier December 2025 (superseded by this revision with corrected metrics)

---

## Executive Summary

The "Layers" extension is a MediaWiki extension for non-destructive image annotation. The codebase demonstrates **solid backend security**, **excellent test coverage**, and has undergone **significant refactoring** since earlier reviews. However, **critical architectural issues remain** that create maintenance burden and impede future development.

**Overall Assessment: 5.5/10** — Functional and secure in core areas, but architectural debt, global side-effects, and fragmented state are significant maintenance and scaling risks.

### Key Findings

| Area | Status | Notes |
|------|--------|-------|
| **Backend Security** | 🟢 Good | CSRF, rate limiting, strict property whitelist are strong; some validation logic is overly complex and warrants tests and documentation |
| **Test Coverage** | 🟡 Good | High unit and integration coverage in JS; however, E2E and accessibility tests are missing and PHP coverage is comparatively thin in places |
| **init.js Refactoring** | ✅ Good | Initialization refactor was effective; small bootstrap and ViewerManager split are a good example to follow |
| **Error Handling** | ✅ Good | Logging and catch blocks are largely improved, but some async areas swallow or rethrow without annotated user-friendly messages |
| **Documentation** | 🟡 Mixed | README updates are a step forward; several docs contain outdated or aspirational claims and should be corrected; see P0 in improvement plan |
| **Message Helper** | ✅ Added | A MessageHelper exists, but adoption is partial — many files still use ad-hoc patterns |
| **Legacy Exports** | 🔴 Problematic | Multiple `window.*` exports remain; some legacy aliases are deprecated but still in the codebase and may cause collisions, test friction, and tooling limitations |
| **StateManager Migration** | 🟡 Partial | Migration progress exists, but StateManager is not universally relied upon; numerous components still mutate local properties directly |
| **God Classes** | 🔴 Critical | 3 JS files still exceed 1,500 lines each |
| **Global Pollution** | 🔴 Critical | 54 `window.*` exports blocking modern tooling |

**📋 Detailed improvement plan: [`improvement_plan.md`](./improvement_plan.md)**

---

## Assessment Scores (1-10 scale)

| Category | Score | Status | Notes |
|----------|-------|--------|-------|
| Architecture & Design | 3/10 | 🔴 Critical | God classes, IIFE globals, mixed concerns; untested cross-file side effects create risk for regressions |
| Code Quality | 6/10 | 🟡 Mixed | High unit test coverage, but brittle architecture increases risk and reduces velocity for contributors |
| Security | 9/10 | 🟢 Excellent | Defense-in-depth backend validation |
| Performance | 4/10 | 🔴 Concerning | Full canvas redraws, synchronous heavy redraws, and unthrottled event handling cause jank on large images; no profiling harness or benchmarks present |
| Accessibility | 2/10 | 🔴 Very Poor | Canvas UX has minimal ARIA and no SR-friendly fallbacks; keyboard navigation, focus management, and screen reader semantics are largely missing |
| Documentation | 6/10 | 🟢 Fixed | README updated, metrics accurate |
| **Testing** | 8/10 | 🟢 Good | 91% coverage, 2,356+ tests, integration suites |
| Error Handling | 8/10 | 🟢 Good | All catch blocks have proper logging after refactoring |
| Maintainability | 3/10 | 🔴 Critical | Large files, duplicated patterns, and partial migrations increase refactor cost and testing complexity |

---

## Current File Metrics (Verified December 3, 2025)

| File | Lines | Target | Status |
|------|-------|--------|--------|
| CanvasManager.js | **1,912** | <800 | 🔴 139% over target |
| LayersEditor.js | **1,820** | <800 | 🔴 128% over target |
| Toolbar.js | **1,683** | <800 | 🔴 110% over target |
| WikitextHooks.php | **775** | <400 | 🟡 94% over (improved from 1,143) |
| init.js | **201** | <400 | ✅ Below target (down from 886) |
| LayersDatabase.php | **829** | <500 | 🟡 66% over target |
| ServerSideLayerValidator.php | **582** | <400 | 🟡 46% over target |
| StyleController.js | **~100** | <200 | ✅ NEW: Extracted from CanvasManager |

---

## 🔴 Critical Issues

### 1. God Classes — Persistent Architectural Problem

Three JavaScript files continue to exceed reasonable size limits despite previous refactoring efforts:

| File | Lines | Responsibilities | Impact |
|------|-------|------------------|--------|
| **CanvasManager.js** | 1,912 | Canvas init, zoom/pan, selection, layers, clipboard, history, mouse, grid, rendering coordination | High change risk |
| **LayersEditor.js** | 1,820 | UI orchestration, layer CRUD, state, API, events, shortcuts, revisions, named sets, validation | Complex dependencies |
| **Toolbar.js** | 1,683 | Tool buttons, color picker, style controls, import/export, keyboard shortcuts | UI changes spread across file |

**Why This Matters:**
- Changes to any single feature require understanding 1,500+ lines
- Code reviews are difficult due to mixed concerns
- Testing becomes complex due to tight coupling
- New developers face steep learning curve
- Memory leak risk: many DOM event listeners are installed but lack explicit teardown in lifecycle flows
- Network and performance regressions are hard to detect due to lack of E2E/benchmark tests

**Evidence of Progress:** 9 controllers were extracted from CanvasManager (ZoomPan, GridRulers, Transform, HitTest, Drawing, Clipboard, RenderCoordinator, Interaction, **StyleController**) reducing it from ~5,400 to 1,912 lines. **This successful pattern should continue.**

---

### 2. Global Namespace Pollution — 54 `window.*` Exports

The codebase uses the outdated IIFE pattern with extensive global exports:

```javascript
( function () {
    'use strict';
    function CanvasManager( config ) { ... }
    window.CanvasManager = CanvasManager;  // Global pollution
}());
```

**Verified Export Count:** 54 `window.X =` assignments across all JS files

**Worst Offenders:**
| File | window.* Refs | Issue |
|------|---------------|-------|
| Toolbar.js | 64 | Heavy global access + export |
| LayersEditor.js | 52 | Multiple exports and dependencies |
| LayerPanel.js | 23 | Global checks throughout |
| ErrorHandler.js | 16 | Multiple singleton patterns |

**Duplicate Exports Found:**
- `ToolManager` exported as both `window.ToolManager` AND `window.LayersToolManager`
- `SelectionManager` exported as `window.LayersSelectionManager` in addition
- `ModuleRegistry` exported under 3 different names
- `ErrorHandler` exported as both class and singleton instance

**Problems Caused:**
1. Load order fragility
2. No tree-shaking possible
3. Blocks TypeScript adoption
4. Namespace collision risk with other extensions
5. Duplicate exports waste memory and cause confusion

---

### 3. StateManager Bypass — Fragmented State

StateManager was implemented but is bypassed in multiple places:

**CanvasManager local state properties (partial list):**
```javascript
this.zoom = 1.0;
this.pan = { x: 0, y: 0 };
this.currentTool = 'pointer';
this.layers = [];
this.selectedLayers = [];
this.gridEnabled = false;
this.showRulers = false;
// 40+ more local state properties
```

**Components bypassing StateManager:**
- CanvasManager: 56+ local properties
- Toolbar: Direct canvas manipulation
- LayerPanel: Direct canvas method calls

**Impact:** State can desync between components, causing hard-to-reproduce bugs, and these bugs are often only visible under heavy interaction (dragging, copy/paste, rapid undo/redo). These can lead to UI state that is difficult to reconcile without manual debugging.

---

### 4. Documentation Accuracy Issues

Several documents contain inaccurate or aspirational claims:

| Document | Issue |
|----------|-------|
| README.md | Claims "Layer IDs: `01`–`FF` (255 possible layers)" — Actually uses UUIDs |
| README.md | Claims "Layers can be grouped and nested" — Not implemented |
| README.md | Claims "Layer thumbnails auto-generated" — Not implemented |
| copilot-instructions.md | CanvasManager claimed as 5,462 lines (actually 1,899) |

**Note:** Some prior claims in docs or earlier reviews are stale; this is a sign the docs and the review process need to be kept in-sync with the code changes via CI checks and a small maintenance process to avoid stale statements.

---

## 🟡 Medium Issues

### 5. PHP Code Complexity

Several PHP files exceed recommended complexity:

| File | Lines | Concerns |
|------|-------|----------|
| LayersDatabase.php | 829 | Many query methods, could split read/write |
| WikitextHooks.php | 775 | Still handles 13+ hooks despite processor extraction |
| ServerSideLayerValidator.php | 582 | Large property whitelist, validation logic |
| ApiLayersSave.php | 473 | Save workflow could be simplified |
| ApiLayersInfo.php | 423 | Multiple query paths |

**Processor Extraction (Completed):**
- `Processors/ImageLinkProcessor.php` (478 lines)
- `Processors/ThumbnailProcessor.php` (363 lines)
- `Processors/LayersParamExtractor.php` (303 lines)
- `Processors/LayersHtmlInjector.php` (259 lines)
- `Processors/LayeredFileRenderer.php` (286 lines)
- `Processors/LayerInjector.php` (256 lines)

### 6. Repeated Code Patterns

**Pattern 1: mw.message fallback** (20+ occurrences)
```javascript
const t = ( window.mw && mw.message ) ? mw.message( 'key' ).text() : 'Fallback';
```
*Should be extracted to a helper function.*

**Pattern 2: Logger retrieval** (5 different implementations across PHP files)
*Should use a consistent factory pattern via services.php.*

**Pattern 3: RepoGroup file lookup** (10+ occurrences)
```php
$services = MediaWikiServices::getInstance();
$repoGroup = $services ? $services->getRepoGroup() : null;
$file = $repoGroup ? $repoGroup->findFile( $title ) : null;
```
*Should be extracted to a FileResolver service.*

### 7. Event Listener Cleanup & Memory Leaks

Many modules add DOM and window event listeners but lack documented teardown or lifecycle hooks which increases the risk of memory leaks, particularly in single-page or long-lived pages where the editor or viewer may be created/destroyed multiple times. Tests for teardown are absent.

**Symptoms:**
- Event listeners on `document`/`window` not removed on destroy
- Multiple `mousemove`/`pointermove` handlers added on repeated initialization
- No smoke tests for life cycle (create/destroy) cases

**Recommendation:** Add a lifecycle API for all modules (init/attach/detach/destroy) and write unit tests that create/destroy the editor multiple times asserting no listener growth.

### 7. PHP Style Warnings

`npm run test:php` shows ~70 warnings:
- Long lines exceeding 120 characters
- Comments not on new lines (MediaWiki standard)
- `assertEmpty` usage (discouraged)

---

## 🟢 Strengths

### Backend Security (Excellent)

The PHP backend demonstrates security best practices:

1. **CSRF Token Enforcement** — All write operations require tokens
2. **Rate Limiting** — Per-action limits via MediaWiki's rate limiter
3. **Strict Property Whitelist** — 47 validated fields in ServerSideLayerValidator
4. **Multi-layer Input Validation:**
   - Size limit before JSON parsing (DoS prevention)
   - Set name sanitization (path traversal prevention)
   - Enum validation for types, blend modes
   - Points array capped at 1,000
5. **Parameterized Queries** — All DB operations use prepared statements

### Test Coverage (Strong but incomplete)

**JavaScript:**
- 2,352 tests across 52 test files
- 91% statement coverage
- 2 integration test suites (SaveLoadWorkflow, LayerWorkflow)

**PHP:**
- 17 test files covering API, validation, database, security
- Good coverage of critical paths

**Extracted Controllers (97%+ average coverage):**
| Controller | Coverage |
|------------|----------|
| ZoomPanController | 100% |
| DrawingController | 100% |
| InteractionController | 100% |
| HitTestController | 99% |
| ClipboardController | 99% |
| GridRulersController | 98% |
| RenderCoordinator | 92% |
| TransformController | 91% |

### Successful Refactoring — init.js

The viewer initialization was properly decomposed:

| Component | Lines | Purpose |
|-----------|-------|---------|
| init.js | 201 | Thin orchestration layer |
| viewer/UrlParser.js | 476 | URL and parameter parsing |
| viewer/ViewerManager.js | 283 | Viewer initialization |
| viewer/ApiFallback.js | 357 | API fallback handling |

**This is the pattern to follow for the remaining god classes.**

---

## Recommendations by Priority

### P0 — Critical (This Week)

1. **Fix documentation accuracy** — Update README.md and `docs/` to align claims with implementation and list planned features explicitly. See the improvement plan for specific docs edits to be prioritized.
2. **Add CI gating and dependency/security scanning** — CI already exists for unit tests and linting; I added a Playwright smoke test workflow, Dependabot config, and security scan steps to the CI to surface vulnerabilities. Further refinement is needed to make E2E tests gating.
4. **Add deprecation shims and warnings** — Added a compatibility shim (`compat.js`) that emits deprecation warnings for legacy `window.*` exports to accelerate migration and reduce the risk of duplicate exports. Also added specific console.warn lines in `ModuleRegistry.js`, `MessageHelper.js`, and `LayersEditor.js` to mark legacy aliases as deprecated.
3. **Plan removal of `window.*` exports** — Replace global exports with ES modules and small backwards-compatible shims; add clear canonical export names; create a migration path and deprecation timeline.

### P1 — High (2-4 Weeks)

1. **Continue CanvasManager decomposition** — Extract StyleController, LayerOrderController and remaining state to StateManager
2. **Complete StateManager migration** — Remove local state properties from CanvasManager and enforce StateManager API usage across codebase
3. **Split Toolbar.js** — Into ToolButtons, StyleControls, ViewControls and add keyboard accessibility tests
4. **Extract message helper** — Reduce 20+ mw.message fallback patterns to single utility
5. **Add event teardown and memory-leak tests** — Add lifecycle tests and ensure teardown hooks remove `window`/`document` listeners
6. **Add performance profiling and benchmarks** — Add small benchmarks and CI job to catch regressions

### P2 — Medium (1-2 Months)

1. **Begin ES module migration** — Start with GeometryUtils, TextUtils (no dependencies)
2. **Extract PHP shared services** — FileResolver, LoggerFactory
3. **Add canvas accessibility** — ARIA labels, keyboard navigation, screen reader announcements
4. **Split LayersDatabase.php** — Separate read/write operations

### P3 — Long Term (3+ Months)

1. **TypeScript migration** — New code in TS, declaration files for existing
2. **Full E2E test suite** — Playwright/Cypress for browser testing
3. **Delete/Rename layer set API** — Administrative features

---

## Metrics Summary

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Jest tests | 2,352 | 1,500+ | ✅ Met |
| Statement coverage | 91% | 80% | ✅ Met |
| CanvasManager.js lines | 1,899 | <800 | 🔴 Needs work |
| LayersEditor.js lines | 1,756 | <800 | 🔴 Needs work |
| Toolbar.js lines | 1,678 | <800 | 🔴 Needs work |
| WikitextHooks.php lines | 775 | <400 | 🟡 Improved |
| init.js lines | 201 | <400 | ✅ Met |
| ESLint errors | 0 | 0 | ✅ Met |
| Window.* exports | 54 | <15 | 🔴 Needs work |
| Silent catch blocks | 0 | 0 | ✅ Fixed |

---

## Conclusion

The Layers extension is **functional and secure** for basic annotation tasks. The backend demonstrates excellent security practices, and test coverage is strong. Recent refactoring of init.js proves the development team can successfully decompose large files.

**However, three critical blockers remain:**

1. **God classes (CanvasManager, LayersEditor, Toolbar)** — Each change is high-risk
2. **54 global exports** — Blocks modern tooling adoption
3. **StateManager bypass** — Creates hard-to-debug state inconsistencies

**The extracted controllers (97%+ coverage) prove the path forward.** Apply the same decomposition pattern aggressively to the remaining god classes before adding new features.

**Recommended first action:** Address P0 documentation accuracy issues, then begin P1 CanvasManager decomposition following the successful controller extraction pattern.

---

*Review performed by GitHub Copilot on December 3, 2025*
