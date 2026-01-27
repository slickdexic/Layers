# Layers Extension - Improvement Plan

**Last Updated:** January 26, 2026  
**Version:** 1.5.35  
**Status:** Production-Ready, High Quality (8.5/10)

> **📋 NOTE:** See [GOD_CLASS_REFACTORING_PLAN.md](docs/GOD_CLASS_REFACTORING_PLAN.md) for the detailed phased plan to address god class issues.

---

## Executive Summary

The extension is **production-ready** with **comprehensive test coverage** and clean code practices. A comprehensive critical review (v40) identified some new medium-priority issues related to Promise error handling.

**Current Status:**
- ✅ All P0 items complete (version consistency fixed with automation)
- ✅ All P1 items complete (documentation metrics updated)
- 🟡 P2 items: 7 open (6 completed)
- 🟡 P3 items: 8 open (3 completed)

**Verified Metrics (January 26, 2026):**

| Metric | Value | Status |
|--------|-------|--------|
| Tests passing | **10,658** (157 suites) | ✅ Excellent |
| Statement coverage | **93.52%** | ✅ Excellent |
| Branch coverage | **84.24%** | ✅ Excellent |
| Function coverage | **91.58%** | ✅ Excellent |
| Line coverage | **93.66%** | ✅ Excellent |
| JS files | 127 | Excludes dist/ and scripts/ |
| JS lines | ~115,282 | Includes generated data |
| PHP files | 40 | ✅ |
| PHP lines | ~14,388 | ✅ |
| PHP strict_types | **40/40 files** | ✅ Complete |
| ES6 classes | 127 files | 100% migrated |
| God classes (≥1,000 lines) | 21 | 3 generated, 18 JS, 2 PHP |
| ESLint errors | 0 | ✅ |
| ESLint disables | 11 | ✅ All legitimate |
| innerHTML usages | 57 | ✅ Audited - all safe |
| Skipped tests | 0 | ✅ All tests run |
| Weak assertions | **0** | ✅ All fixed |
| i18n messages | 697 | All documented in qqq.json |
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

**Problem:** Version numbers were inconsistent across 6+ files.

**Fix Applied:**
- Updated all files to match extension.json source of truth (1.5.35)
- Created `scripts/update-version.js` to automate version synchronization
- Added `npm run check:version` and `npm run update:version` commands
- Added version consistency check to CI workflow

---

## Phase 1 (P1): High Priority — ✅ ALL COMPLETED

All high-priority issues have been resolved:
- ✅ P1.0: Documentation metrics updated
- ✅ P1.1: paths array validation for customShape layers
- ✅ P1.2: Cache invalidation race condition fixed

---

## Phase 2 (P2): Medium Priority — 🟡 5 OPEN ITEMS

### P2.1 ~~Add .catch() Handlers to Promise Chains~~ ✅ RESOLVED

**Status:** Resolved  
**Priority:** P2 - Medium  
**Category:** Error Handling / Reliability  
**Discovered:** v40 Review (January 26, 2026)  
**Resolved:** January 26, 2026

**Finding:** Upon verification, most files already had proper `.catch()` handlers:
- SetSelectorController.js - Lines 427, 499, 583 all have `.catch()` ✓
- Toolbar.js - Lines 793, 864 have `.catch()` ✓
- SlidePropertiesPanel.js - Line 656 has `.catch()` ✓

**One actual issue found and fixed:**
- SpecialSlides.js - Line 274: `OO.ui.confirm().then()` - Added `.catch()` handler ✅

---

### P2.2 ~~Wrap Async Functions in Try-Catch~~ ✅ ALREADY HANDLED

**Status:** False Positive  
**Priority:** P2 - Medium  
**Category:** Error Handling  
**Discovered:** v40 Review (January 26, 2026)  
**Verified:** January 26, 2026

**Finding:** Upon verification, these functions already have proper error handling:
- LayerSetManager.js - Both methods have try-catch ✓
- RevisionManager.js - Both methods have try-catch ✓
- DraftManager.js - Uses only sync operations and safe dialog wrappers ✓
- UIManager.js - Thin wrappers with native fallbacks, no error risk ✓

---

### P2.3 Standardize Database Method Return Types

**Status:** Open  
**Priority:** P2 - Medium  
**Category:** Code Quality / API Consistency  
**Location:** `src/Database/LayersDatabase.php`

**Problem:** Inconsistent return types across methods:
- `getLayerSet()` returns `false` on error
- `getLayerSetByName()` returns `null` on error
- `countNamedSets()` returns `-1` on error

**Solution:** Standardize to:
- Return `null` for "not found"
- Throw `\RuntimeException` for database errors

**Breaking Change:** Yes — requires updating 15+ call sites across 5 PHP files.

**Estimated Effort:** 1-2 days

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
| ViewerManager.js | 2,014 | Extract SlideRenderer, ImageRenderer | High |
| APIManager.js | 1,523 | Extract RetryManager, RequestTracker | High |
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

### P2.6 Refactor PHP God Classes

**Status:** Planned  
**Priority:** P2 - Medium  
**Category:** Architecture  

**Target Classes:**

1. **LayersDatabase.php** (1,242 lines) → Split into:
   - `LayerSetRepository` — CRUD operations for layer sets
   - `NamedSetRepository` — Named set operations
   - `RevisionRepository` — Revision management
   - `LayerQueryService` — Query building and execution

2. **ServerSideLayerValidator.php** (1,163 lines) → Use strategy pattern:
   - `LayerTypeValidatorInterface` — Common validation interface
   - `TextLayerValidator`, `ArrowLayerValidator`, `ShapeLayerValidator`, etc.
   - `PropertyValidator` — Shared property validation (colors, dimensions)
   - `ValidationContext` — Shared state during validation

**Estimated Effort:** 2-3 days per class

---

### P2.7 Add Additional E2E Tests for ShapeLibraryPanel

**Status:** Partially Complete  
**Priority:** P2 - Medium  
**Category:** Testing  
**Location:** `resources/ext.layers.editor/shapeLibrary/ShapeLibraryPanel.js` (812 lines)

**Problem:** ShapeLibraryPanel has limited unit test coverage due to tight OOUI integration.

**Current Status:**
- ✅ Created comprehensive Playwright E2E tests in `tests/e2e/shape-library.spec.js`
- Test scenarios covered include open/close, category navigation, search, insertion
- Additional tests would increase confidence

**Recommended Additional Tests:**
- Keyboard navigation through shape grid
- Multiple shape insertions in sequence
- Shape library state persistence
- Error handling for failed SVG loads

**Estimated Effort:** 1-2 days for additional tests

---

## Completed P2 Items (for reference)

| Item | Date | Notes |
|------|------|-------|
| P2.A: Layer search/filter | Jan 25, 2026 | Full search/filter UI |
| P2.B: i18n docs | Jan 25, 2026 | All 697 keys documented |
| P2.C: Query simplification | Jan 25, 2026 | Two-query approach |
| P2.D: Coverage thresholds | Jan 25, 2026 | Raised to 80-92% |
| P2.E: RGBA hex colors | Jan 25, 2026 | 3/4/6/8-digit support |
| P2.F: DraftManager leak | Jan 25, 2026 | Subscription cleanup |

---

## Phase 3 (P3): Long-Term Improvements — 🟡 8 ITEMS

### P3.1 Add Visual Regression Testing

**Status:** Not Started  
**Priority:** P3 - Low  
**Category:** Testing  

**Problem:** No visual snapshot tests for canvas rendering.

**Solution:**
1. Add jest-image-snapshot for canvas output testing
2. Create baseline snapshots for key rendering scenarios
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

**Candidate Modules:**
1. **StateManager.js** (829 lines) — Central state with subscription system
2. **APIManager.js** (1,523 lines) — API communication layer
3. **GroupManager.js** (1,171 lines) — Layer grouping logic
4. **SelectionManager.js** (1,431 lines) — Multi-selection handling

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

**Problem:** Limited to default font allowlist in `$wgLayersDefaultFonts`.

**Solution:**
1. Add web font loader utility
2. Allow users to specify fonts via config
3. Validate font names to prevent XSS
4. Cache loaded fonts for performance
5. Fallback gracefully if font fails to load

**Estimated Effort:** 1 week

---

### P3.5 Zoom-to-Cursor Feature — ✅ COMPLETED

**Status:** ✅ COMPLETED (January 26, 2026)

---

### P3.6 Canvas Accessibility Improvements — ✅ COMPLETED

**Status:** ✅ COMPLETED (January 25, 2026)

---

### P3.7 Complete Slide Mode Documentation — ✅ COMPLETED

**Status:** ✅ COMPLETED (January 25, 2026)

---

### P3.8 Standardize Timeout Tracking — ✅ AUDITED

**Status:** ✅ AUDITED - Low Priority (January 25, 2026)

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

### P3.10 Enhanced Dimension Tool (FR-14)

**Status:** Proposed  
**Priority:** P3 - Low  
**Category:** Feature Enhancement  

**Request:** Make the dimension line draggable independently from anchor points.

**Estimated Effort:** 1 week

---

### P3.11 Angle Dimension Tool (FR-15)

**Status:** Proposed  
**Priority:** P3 - Low  
**Category:** New Feature  

**Request:** New tool for measuring and annotating angles.

**Estimated Effort:** 2 weeks

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
| P0: Version consistency | Jan 26, 2026 | Automation script added |
| P1.0: Documentation metrics | Jan 26, 2026 | All metrics updated |
| P1.1: paths validation | Jan 25, 2026 | customShape layers validated |
| P1.2: cache invalidation | Jan 25, 2026 | Job queue async purge |
| P2.A: Layer search | Jan 25, 2026 | Full search/filter UI |
| P2.B: i18n docs | Jan 25, 2026 | All 697 keys documented |
| P2.C: Query simplification | Jan 25, 2026 | Two-query approach |
| P2.D: Coverage thresholds | Jan 25, 2026 | Raised to 80-92% |
| P2.E: RGBA hex colors | Jan 25, 2026 | 3/4/6/8-digit support |
| P2.F: DraftManager leak | Jan 25, 2026 | Subscription cleanup |
| P3.5: Zoom-to-cursor | Jan 26, 2026 | Already implemented |
| P3.6: Accessibility | Jan 25, 2026 | ARIA regions complete |
| P3.7: Slide docs | Jan 25, 2026 | Architecture documented |
| P3.8: Timeout audit | Jan 25, 2026 | Adequate handling |

### In Progress (🟡)

| Item | Status | Assigned |
|------|--------|----------|
| P2.1: Promise .catch() | **NEW** Open | TBD |
| P2.2: Async try-catch | **NEW** Open | TBD |
| P2.3: DB return types | Open | TBD |
| P2.4: HistoryManager memory | Mitigated | TBD |
| P2.5: JS god classes | Ongoing | TBD |
| P2.6: PHP god classes | Planned | TBD |
| P2.7: ShapeLibrary E2E | Partial | TBD |

### Blocked (🔴)

None currently blocked.

---

## Next Steps

### Immediate (This Week)
1. **P2.1:** Add .catch() to all Promise chains — High impact, quick fix
2. **P2.2:** Wrap async functions in try-catch — Quick win

### This Sprint
3. **P2.3:** Standardize DB return types
4. **P2.4:** Make DeepClone a hard dependency

### Next Milestone
5. **P2.5:** Continue JS god class reduction
6. **P2.6:** PHP god class refactoring
7. **P2.7:** Additional ShapeLibrary E2E tests

### Long-Term (v2.0)
8. **P3.1:** Visual regression testing
9. **P3.2:** TypeScript migration
10. **P3.3:** Deprecated code removal
11. **P3.4:** Custom fonts support

---

## Metrics to Track

| Metric | Current | Target | Notes |
|--------|---------|--------|-------|
| Test count | 10,658 | Maintain | No regression |
| Statement coverage | 93.52% | ≥92% | Threshold in jest.config |
| Branch coverage | 84.24% | ≥80% | Threshold in jest.config |
| Hand-written god classes (JS) | 18 | ≤12 | Reduce by 6 |
| PHP god classes | 2 | 0 | Refactor both |
| Deprecated markers | 5 | 0 | Remove in v2.0 |
| ESLint disables | 11 | ≤15 | Minimized |
| Unhandled promise chains | ~10 | 0 | **NEW** Priority |
| Overall score | 8.5 | 9.0 | Path to world-class |

---

*Last updated: January 26, 2026*  
*Overall score: 8.5/10 — Production-ready, high quality with areas for improvement*
