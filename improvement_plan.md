# Layers Extension - Improvement Plan

**Last Updated:** January 26, 2026  
**Version:** 1.5.35  
**Status:** Production-Ready, Good Quality with Quality Gaps (8.3/10)

> **📋 NOTE:** See [GOD_CLASS_REFACTORING_PLAN.md](docs/GOD_CLASS_REFACTORING_PLAN.md) for the detailed phased plan to address god class issues.

---

## Executive Summary

The extension is **production-ready** with **comprehensive test coverage** and clean code practices. A critical review (v38) discovered version inconsistencies and stale documentation, which have now been **fully resolved**.

**Current Status:**
- ✅ All P0 items complete (version consistency fixed with automation)
- ✅ All P1 items complete (documentation metrics updated)
- 🟡 P2 items: 5 open (6 completed)
- 🟡 P3 items: 8 open (3 completed)

**Verified Metrics (January 26, 2026):**

| Metric | Value | Status |
|--------|-------|--------|
| Tests passing | **10,643** (157 suites) | ✅ Excellent |
| Statement coverage | **94.15%** | ✅ Excellent |
| Branch coverage | **84.43%** | ✅ Excellent |
| Function coverage | **92.18%** | ✅ Excellent |
| Line coverage | **94.28%** | ✅ Excellent |
| JS files | 127 | Excludes dist/ and scripts/ |
| JS lines | ~115,271 | Includes generated data |
| PHP files | 40 | ✅ |
| PHP lines | ~14,225 | ✅ |
| PHP strict_types | **40/40 files** | ✅ Complete |
| ES6 classes | 127 files | 100% migrated |
| God classes (≥1,000 lines) | 21 | 3 generated, 18 hand-written |
| ESLint errors | 0 | ✅ |
| ESLint disables | 11 | ✅ All legitimate |
| innerHTML usages | 57 | ✅ Audited - all safe |
| Skipped tests | 0 | ✅ All tests run |
| Weak assertions | **0** | ✅ All fixed |
| i18n messages | 684 | All documented in qqq.json |
| Deprecated code markers | 5 | 🟡 Technical debt |

---

## Priority Definitions

| Priority | Timeline | Description |
|----------|----------|-------------|
| **P0** | Immediate | Critical bugs or security issues |
| **P1** | 1–2 weeks | High-impact security and data integrity issues |
| **P2** | 1–3 months | Architecture improvements, code quality, features |
| **P3** | 3–6 months | Long-term improvements and technical debt |

---

## Phase 0 (P0): Critical Issues — ✅ ALL RESOLVED

### P0.1 Fix Version Number Inconsistencies

**Status:** ✅ COMPLETED (January 26, 2026)  
**Priority:** P0 - Critical (Immediate)  
**Category:** Release Management / Professionalism  
**Discovered:** January 26, 2026 (Audit v38)

**Problem:** Version numbers were inconsistent across 6+ files, ranging from v1.5.26 to v1.5.35.

**Fix Applied:**
- Updated all files to match extension.json source of truth (1.5.35)
- Created `scripts/update-version.js` to automate version synchronization
- Added `npm run check:version` and `npm run update:version` commands
- Added version consistency check to CI workflow (`.github/workflows/ci.yml`)

**Files Updated:**
- `resources/ext.layers.editor/LayersNamespace.js`
- `README.md`
- `Mediawiki-Extension-Layers.mediawiki`
- `wiki/Home.md`
- `wiki/Installation.md`
- `improvement_plan.md`

---

**Previously Fixed P0 Issues:**
- ✅ Missing `mustBePosted()` on Write API Modules (Fixed January 24, 2026)
- ✅ console.log in Production Code (Fixed January 24, 2026)
- ✅ CSRF token protection on all write APIs
- ✅ Rate limiting on save/delete/rename operations

---

## Phase 1 (P1): High Priority — ✅ ALL COMPLETED

### P1.0 Audit and Update Stale Documentation Metrics

**Status:** ✅ COMPLETED (January 26, 2026)  
**Priority:** P1 - High  
**Category:** Documentation / Quality Assurance  
**Discovered:** January 26, 2026 (Audit v38)

**Problem:** Documentation files contained outdated metrics that didn't match actual values.

**Fix Applied:**
- Updated all metrics in wiki/Home.md (test count, coverage, JS files, etc.)
- Updated copilot-instructions.md with correct values
- Updated codebase_review.md to v38 with accurate metrics
- Updated improvement_plan.md header and status table

**Verified Metrics (January 26, 2026):**
- Test count: 10,643 tests in 157 suites
- Coverage: 94.15% statement, 84.43% branch, 92.18% function, 94.28% line
- JS files: 127, ~115,271 lines
- PHP files: 40, ~14,225 lines
- ESLint disables: 11 (all legitimate)
- i18n messages: 684

---

### P1.1 Validate `paths` Array Contents in customShape Layers

**Status:** ✅ COMPLETED (January 25, 2026)  
**Category:** Security / Input Validation  
**Location:** `src/Validation/ServerSideLayerValidator.php`

**Fix Applied:** Added validation loop that calls `validateSvgPath()` on each string in the paths array for customShape layers.

---

### P1.2 Fix Cache Invalidation Race Condition

**Status:** ✅ COMPLETED (January 25, 2026)  
**Category:** Performance / Data Consistency  
**Location:** `src/Api/ApiLayersSave.php`

**Fix Applied:** Implemented hybrid approach:
- File page purged synchronously (fast, always needed)
- Backlink pages purged via `HTMLCacheUpdateJob::newForBacklinks()` (async)
- Added `SYNC_BACKLINK_PURGE_LIMIT` constant to eliminate magic number
- Fallback to synchronous purge if job queue unavailable

---

## Phase 2 (P2): Medium Priority — 🟡 5 OPEN ITEMS

### P2.1 Standardize Database Method Return Types

**Status:** Open  
**Priority:** P2 - Medium  
**Category:** Code Quality / API Consistency  
**Location:** `src/Database/LayersDatabase.php`

**Problem:** Inconsistent return types across methods:
- `getLayerSet()` returns `false` on error
- `getLayerSetByName()` returns `null` on error
- `getLatestLayerSet()` returns `false` on error
- `namedSetExists()` returns `null` on DB error, `bool` on success
- `countNamedSets()` returns `-1` on error

**Solution:** Standardize to:
- Return `null` for "not found"
- Throw `\RuntimeException` for database errors

**Breaking Change:** Yes — requires updating 15+ call sites across 5 PHP files:
- `ApiLayersInfo.php` (2 usages)
- `LayerInjector.php` (5 usages)
- `LayeredFileRenderer.php` (2 usages)
- `ImageLinkProcessor.php` (6 usages)
- Unit tests (8+ assertions)

**Estimated Effort:** 1-2 days

---

### P2.2 Refactor PHP God Classes

**Status:** Planned  
**Priority:** P2 - Medium  
**Category:** Architecture  

**Target Classes:**

1. **LayersDatabase.php** (1,080 lines) → Split into:
   - `LayerSetRepository` — CRUD operations for layer sets
   - `NamedSetRepository` — Named set operations
   - `RevisionRepository` — Revision management
   - `LayerQueryService` — Query building and execution

2. **ServerSideLayerValidator.php** (1,164 lines) → Use strategy pattern:
   - `LayerTypeValidatorInterface` — Common validation interface
   - `TextLayerValidator`, `ArrowLayerValidator`, `ShapeLayerValidator`, etc.
   - `PropertyValidator` — Shared property validation (colors, dimensions)
   - `ValidationContext` — Shared state during validation

**Estimated Effort:** 2-3 days per class

---

### P2.3 Add E2E Tests for ShapeLibraryPanel — ✅ COMPLETED

**Status:** ✅ COMPLETED (January 26, 2026)  
**Priority:** P2 - Medium  
**Category:** Testing  
**Location:** `resources/ext.layers.editor/shapeLibrary/ShapeLibraryPanel.js`

**Problem:** ShapeLibraryPanel has 0% unit test coverage due to tight OOUI integration making unit testing impractical.

**Solution (Implemented):**
1. Created comprehensive Playwright E2E tests in `tests/e2e/shape-library.spec.js`
2. Test scenarios covered:
   - ✅ Open shape library panel via toolbar button
   - ✅ Close panel via close button, Escape key, and overlay click
   - ✅ Navigate between categories (10 categories)
   - ✅ Search shapes (1,310 total) with debounced filtering
   - ✅ Insert shape onto canvas
   - ✅ Accessibility (ARIA attributes, keyboard navigation)
   - ✅ Visual regression checks (panel dimensions, SVG loading)
3. Added shape library selectors to `tests/e2e/fixtures.js`

**Files Added/Modified:**
- `tests/e2e/shape-library.spec.js` (new, ~400 lines)
- `tests/e2e/fixtures.js` (added 11 shape library selectors)

---

### P2.4 Address HistoryManager Memory for Large Images

**Status:** Open (Mitigation Applied)  
**Priority:** P2 - Medium  
**Category:** Performance / Memory  
**Location:** `resources/ext.layers.editor/HistoryManager.js`

**Problem:** When DeepClone fallback is used, entire base64 image data is copied per undo step.

**Current Mitigation:** Warning log added when JSON fallback used with image layers.

**Full Solution:**
1. Make DeepClone a hard dependency in extension.json module loading
2. Implement image data reference counting (only clone on mutation)
3. Add client-side warning when image layer exceeds recommended size
4. Consider storing image references separately from layer state

**Estimated Effort:** 2 days for full implementation

---

### P2.5 Reduce JavaScript God Class Count

**Status:** Ongoing  
**Priority:** P2 - Medium  
**Category:** Architecture  

**Target:** Reduce hand-written god classes from 18 to ≤12

**Priority Order (by improvement potential):**

| File | Lines | Strategy | Impact |
|------|-------|----------|--------|
| ViewerManager.js | 2,003 | Extract SlideRenderer, ImageRenderer | High |
| APIManager.js | 1,524 | Extract RetryManager, RequestTracker | High |
| Toolbar.js | 1,891 | Extract ToolbarSections by category | Medium |
| ToolbarStyleControls.js | 1,098 | Extract style category controllers | Medium |

**Files Already Well-Delegated (acceptable as-is):**
- CanvasManager.js — Facade with 10+ controllers
- LayerPanel.js — Delegates to 9 controllers
- SelectionManager.js — Good module separation
- LayersEditor.js — Main entry point with clear responsibilities

**Files Where Size is Justified:**
- ArrowRenderer.js, CalloutRenderer.js — Complex math/geometry
- ResizeCalculator.js, TransformController.js — Math-intensive
- PropertyBuilders.js — UI builder pattern (many small methods)
- InlineTextEditor.js — Rich text complexity

**Estimated Effort:** 2-3 days per major extraction

---

## Completed P2 Items (for reference)

### P2.A Layer Search/Filter Feature — ✅ COMPLETED

**Status:** ✅ COMPLETED (January 25, 2026)  
**Location:** `resources/ext.layers.editor/LayerPanel.js`

**Implemented:**
- Search input at top of LayerPanel
- Real-time filtering by layer name, type, or text content
- "Showing N of M layers" count display
- Clear button to reset filter
- Full dark mode support (night and OS themes)
- 13 new tests added

---

### P2.B i18n Documentation — ✅ VERIFIED COMPLETE

**Status:** ✅ VERIFIED (January 25, 2026)  
**Location:** `i18n/qqq.json`

All 679 message keys are documented. Banana i18n checker passes.

---

### P2.C Simplify getNamedSetsForImage Query — ✅ COMPLETED

**Status:** ✅ COMPLETED (January 25, 2026)  
**Location:** `src/Database/LayersDatabase.php`

Replaced complex self-join with cleaner two-query approach.

---

### P2.D Raise Jest Coverage Thresholds — ✅ COMPLETED

**Status:** ✅ COMPLETED (January 25, 2026)  
**Location:** `jest.config.js`

Updated thresholds: 80% branches, 90% functions, 92% lines/statements.

---

### P2.E Add 8-Digit Hex Color (RGBA) Support — ✅ COMPLETED

**Status:** ✅ COMPLETED (January 25, 2026)  
**Location:** `src/Validation/ColorValidator.php`

Updated regex to accept 3/4/6/8-digit hex colors.

---

### P2.F Fix DraftManager Subscription Leak — ✅ COMPLETED

**Status:** ✅ COMPLETED (January 25, 2026)  
**Location:** `resources/ext.layers.editor/DraftManager.js`

Added cleanup of existing subscription at start of `initialize()`.

---

## Phase 3 (P3): Long-Term Improvements — 🟡 8 ITEMS

### P3.1 Add Visual Regression Testing

**Status:** Not Started  
**Priority:** P3 - Low  
**Category:** Testing  

**Problem:** No visual snapshot tests for canvas rendering. Rendering bugs could slip through.

**Solution:**
1. Add jest-image-snapshot for canvas output testing
2. Create baseline snapshots for key rendering scenarios:
   - Basic shapes (rectangle, circle, ellipse)
   - Text rendering (different fonts, sizes)
   - Arrows (straight, curved, heads)
   - Blur fill effects
   - Gradient fills
   - Multi-layer compositions
3. Run visual tests on CI

**Tools to Consider:**
- jest-image-snapshot (simple, Jest integration)
- Percy (cloud-based, cross-browser)
- Chromatic (Storybook integration)

**Estimated Effort:** 1-2 sprints

---

### P3.2 TypeScript Migration for Complex Modules

**Status:** Not Started  
**Priority:** P3 - Low  
**Category:** Code Quality  

**Candidate Modules (by complexity):**
1. **StateManager.js** (830 lines) — Central state with subscription system
2. **APIManager.js** (1,524 lines) — API communication layer
3. **GroupManager.js** (1,172 lines) — Layer grouping logic
4. **SelectionManager.js** (1,431 lines) — Multi-selection handling
5. **HistoryManager.js** (825 lines) — Undo/redo with complex state

**Benefits:**
- Catch type errors at compile time
- Better IDE autocomplete and refactoring
- Self-documenting interfaces
- Easier onboarding for new contributors

**Migration Strategy:**
1. Add TypeScript build pipeline
2. Start with new modules as .ts
3. Gradually convert existing modules
4. Use JSDoc types as bridge during migration

**Estimated Effort:** 2-3 sprints per module

---

### P3.3 Deprecated Code Removal Plan

**Status:** Not Started  
**Priority:** P3 - Low  
**Category:** Technical Debt  

**Deprecated APIs to Remove in v2.0 (5 markers):**

| File | Deprecated Item | Replacement |
|------|-----------------|-------------|
| ToolbarStyleControls.js | `hideControlsForTool()` | Use `hideControlsForSelectedLayers()` |
| ModuleRegistry.js | `window.layersModuleRegistry` | Use `window.layersRegistry` |
| ModuleRegistry.js | Legacy export pattern | Use `window.Layers.*` namespace |
| LayerPanel.js | `createNewFolder()` | Use `createFolder()` |
| LayerPanel.js | Code panel methods | Moved to UIManager |

**Plan:**
1. Create migration guide document for each deprecated API
2. Add console warnings for deprecated API usage
3. Communicate deprecation in CHANGELOG for 2 minor versions
4. Remove in v2.0 release

**Estimated Effort:** 1 sprint

---

### P3.4 Custom Fonts Support (F3)

**Status:** Not Started  
**Priority:** P3 - Low  
**Category:** Feature  
**Evidence:** Documented as F3 in KNOWN_ISSUES.md

**Problem:** Limited to default font allowlist in `$wgLayersDefaultFonts`.

**Solution:**
1. Add web font loader utility
2. Allow users to specify fonts via config
3. Validate font names to prevent XSS
4. Cache loaded fonts for performance
5. Fallback gracefully if font fails to load

**Security Considerations:**
- Validate font URLs against allowlist
- Sanitize font family names
- Consider CSP implications

**Estimated Effort:** 1 week

---

### P3.5 Zoom-to-Cursor Feature (F5) — ✅ COMPLETED

**Status:** ✅ COMPLETED (January 26, 2026)  
**Priority:** P3 - Low  
**Category:** UX Enhancement  
**Evidence:** Documented as F5 in KNOWN_ISSUES.md

**Problem:** Zoom anchors at top-left corner, not mouse pointer position.

**Solution (Implemented):**
- `CanvasEvents.handleWheel()` captures mouse position via `cm.getMousePoint(e)`
- `ZoomPanController.zoomBy(delta, point)` calculates screen position before zoom
- Pan offset adjusted after zoom to keep point under cursor stable
- Full test coverage in `ZoomAndCoords.test.js` and `ZoomPanController.test.js`

**Implementation Location:** `resources/ext.layers.editor/canvas/ZoomPanController.js`

---

### P3.6 Canvas Accessibility Improvements — ✅ COMPLETED

**Status:** ✅ COMPLETED (January 25, 2026)  
**Priority:** P3 - Low  
**Category:** Accessibility  

**Completed:**
- ✅ LayerPanel has `announceToScreenReader()` method
- ✅ ARIA roles on toolbar buttons
- ✅ Keyboard navigation for layer panel
- ✅ Tool changes announced via `announceTop()` method
- ✅ Zoom display has `aria-live="polite"` and updates `aria-label` on change
- ✅ ARIA labels on all major UI regions (canvas, toolbar, panel)

---

### P3.7 Complete Slide Mode Documentation — ✅ COMPLETED

**Status:** ✅ COMPLETED (January 25, 2026)  
**Priority:** P3 - Low  
**Category:** Documentation  

**Implemented:**
- ✅ Added comprehensive "Slide Mode Architecture" section to ARCHITECTURE.md
- ✅ Documented API endpoints with parameters and responses
- ✅ Added "Slide Mode Development" section to DEVELOPER_ONBOARDING.md

---

### P3.8 Standardize Timeout Tracking — ✅ AUDITED

**Status:** ✅ AUDITED - Low Priority (January 25, 2026)  
**Priority:** P3 - Low  
**Category:** Code Quality / Memory Safety  

**Audit Results:**
Found 58 setTimeout/setInterval usages. Analysis shows most are properly handled:

| Category | Count | Status |
|----------|-------|--------|
| Tracked via instance properties | 15 | ✅ Proper cleanup |
| Short-lived `setTimeout(..., 0)` | 20 | ✅ Safe (UI sync) |
| Self-limiting retry chains | 8 | ✅ Safe (bounded) |
| Module-level (tracked) | 10 | ✅ Proper cleanup |
| Fire-and-forget (safe) | 5 | ✅ Short operations |

**Conclusion:** Current timeout handling is adequate. TimeoutTracker utility available for new code.

---

### P3.9 Magic Number Extraction

**Status:** Not Started  
**Priority:** P3 - Low  
**Category:** Code Quality  

**Problem:** Various magic numbers scattered through the codebase:
- Timeout values (100ms, 200ms, 1000ms)
- Canvas padding (20, 50)
- Backlink limit (100)
- Retry counts and delays

**Solution:**
1. Create `LayersConstants.js` for JS magic numbers
2. Add PHP config options for configurable limits
3. Document the purpose of each constant

**Estimated Effort:** 4 hours

---

## God Class Status Summary

### 21 Files ≥1,000 Lines

| Category | Count | Files |
|----------|-------|-------|
| Generated (exempt) | 3 | EmojiLibraryData, ShapeLibraryData, EmojiLibraryIndex |
| Well-delegated | 10 | CanvasManager, LayerPanel, SelectionManager, etc. |
| Math/Rendering | 5 | ArrowRenderer, ResizeCalculator, TransformController, etc. |
| Needs Attention | 3 | ViewerManager, APIManager, Toolbar |
| PHP | 2 | LayersDatabase, ServerSideLayerValidator |

---

## Progress Tracking

### Completed (✅)

| Item | Date | Notes |
|------|------|-------|
| P0: CSRF tokens | Jan 24, 2026 | All write APIs protected |
| P0: console.log removal | Jan 24, 2026 | Production code clean |
| P1.1: paths validation | Jan 25, 2026 | customShape layers validated |
| P1.2: cache invalidation | Jan 25, 2026 | Job queue async purge |
| P2.A: Layer search | Jan 25, 2026 | Full search/filter UI |
| P2.B: i18n docs | Jan 25, 2026 | All 679 keys documented |
| P2.C: Query simplification | Jan 25, 2026 | Two-query approach |
| P2.D: Coverage thresholds | Jan 25, 2026 | Raised to 80-92% |
| P2.E: RGBA hex colors | Jan 25, 2026 | 3/4/6/8-digit support |
| P2.F: DraftManager leak | Jan 25, 2026 | Subscription cleanup |
| P3.5: Zoom-to-cursor | Jan 26, 2026 | Already implemented |
| P2.3: ShapeLibrary E2E | Jan 26, 2026 | 400+ lines of tests |
| P3.6: Accessibility | Jan 25, 2026 | ARIA regions complete |
| P3.7: Slide docs | Jan 25, 2026 | Architecture documented |
| P3.8: Timeout audit | Jan 25, 2026 | Adequate handling |

### In Progress (🟡)

| Item | Status | Assigned |
|------|--------|----------|
| P2.1: DB return types | Planned | TBD |
| P2.2: PHP god classes | Planned | TBD |
| P2.5: JS god classes | Ongoing | TBD |

### Blocked (🔴)

None currently blocked.

---

## Next Steps

### Immediate (This Week)
1. **P2.1:** Standardize DB return types — High impact, moderate effort

### This Sprint
2. ~~**P2.3:** Add Playwright E2E tests for ShapeLibraryPanel~~ — ✅ COMPLETED
3. ~~**P3.5:** Implement zoom-to-cursor~~ — ✅ Already implemented

### Next Milestone
4. **P2.2:** PHP god class refactoring
5. **P2.5:** Continue JS god class reduction

### Long-Term (v2.0)
6. **P3.1:** Visual regression testing
7. **P3.2:** TypeScript migration
8. **P3.3:** Deprecated code removal
9. **P3.4:** Custom fonts support

---

## Metrics to Track

| Metric | Current | Target | Notes |
|--------|---------|--------|-------|
| Test count | 10,643 | Maintain | No regression |
| Statement coverage | 94.45% | ≥92% | Threshold in jest.config |
| Branch coverage | 84.87% | ≥80% | Threshold in jest.config |
| Hand-written god classes | 18 | ≤12 | Reduce by 6 |
| Deprecated markers | 5 | 0 | Remove in v2.0 |
| ESLint disables | 11 | ≤15 | Minimized |
| Overall score | 8.6 | 9.0 | Path to world-class |

---

*Last updated: January 26, 2026*  
*Overall score: 8.6/10 — Production-ready, high quality with areas for improvement*
