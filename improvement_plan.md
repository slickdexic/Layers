# Layers Extension - Improvement Plan

**Last Updated:** January 27, 2026  
**Version:** 1.5.36  
**Status:** Production-Ready, High Quality (8.5/10)

> **📋 NOTE:** See [GOD_CLASS_REFACTORING_PLAN.md](docs/GOD_CLASS_REFACTORING_PLAN.md) for the detailed phased plan to address god class issues.

---

## Executive Summary

The extension is **production-ready** with **comprehensive test coverage** and clean code practices. A comprehensive critical review (v43) identified a HIGH-priority documentation consistency issue and several medium-priority items.

**Current Status:**
- ✅ All P0 items complete (version consistency fixed with automation)
- 🟡 P1: 1 open (HIGH-1: docs/ARCHITECTURE.md stale metrics)
- 🟡 P2 items: 6 open (8 completed, including 2 false positives resolved)
- 🟡 P3 items: 8 open (4 completed)

**Verified Metrics (January 27, 2026):**

| Metric | Value | Status |
|--------|-------|--------|
| Tests passing | **10,667** (157 suites) | ✅ Excellent |
| Statement coverage | **95.85%** | ✅ Excellent |
| Branch coverage | **85.39%** | ✅ Excellent |
| Function coverage | **93.99%** | ✅ Excellent |
| Line coverage | **95.97%** | ✅ Excellent |
| JS files | 132 | All resources/ext.layers* |
| JS lines | ~88,000+ | Includes generated data |
| PHP files | 40 | ✅ |
| PHP lines | ~14,378 | ✅ |
| PHP strict_types | **40/40 files** | ✅ Complete |
| ES6 classes | All JS files | 100% migrated |
| God classes (≥1,000 lines) | 19 | 2 generated, 17 JS, 2 PHP |
| ESLint errors | 0 | ✅ |
| ESLint disables | 11 | ✅ All legitimate |
| innerHTML usages | 63 | ✅ Audited - all safe |
| Skipped tests | 0 | ✅ All tests run |
| Weak assertions | **0** | ✅ All fixed |
| i18n messages | 720 | All documented in qqq.json |
| Deprecated code markers | 7 | 🟡 Technical debt |
| TODO/FIXME/HACK comments | 0 | ✅ Clean |
| console.log in production | 0 | ✅ Clean (only in scripts/) |

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
- Updated all files to match extension.json source of truth (1.5.36)
- Created `scripts/update-version.js` to automate version synchronization
- Added `npm run check:version` and `npm run update:version` commands
- Added version consistency check to CI workflow

---

## Phase 1 (P1): High Priority — ✅ ALL RESOLVED

### P1.3 Update docs/ARCHITECTURE.md Metrics — ✅ COMPLETED

**Status:** ✅ COMPLETED (January 28, 2026)  
**Priority:** P1 - High  
**Category:** Documentation / Professionalism  
**Discovered:** v43 Review (January 27, 2026)

**Problem:** docs/ARCHITECTURE.md contained stale metrics.

| Metric | docs/ARCHITECTURE.md | Actual (Verified) | Discrepancy |
|--------|----------------------|-------------------|-------------|
| Version | 1.5.35 | 1.5.36 | ❌ Off by 1 |
| Test Count | 10,643 | 10,667 | ❌ Difference of 24 |
| Statement Coverage | 94.45% | 95.85% | ❌ ~1.4% difference |
| JS Files | 127 | 132 | ❌ Off by 5 |
| JS Lines | ~115,282 | ~88,000+ | ❌ Major discrepancy |
| God Classes | 23 | 19 | ❌ Different counts |
| i18n Messages | 697 | 720 | ❌ Off by 23 |

**Impact:** Stale documentation undermines project credibility.

**Fix Applied:**
- Updated version to 1.5.36, test count to 10,667, coverage to 95.85%
- Corrected JS file count to 132, god class count to 22
- Added ViewerManager.js and PHP god classes to tables
- Updated last updated date to January 28, 2026

### Previously Completed P1 Items:
- ✅ P1.0: Documentation metrics in codebase_review.md updated
- ✅ P1.1: paths array validation for customShape layers
- ✅ P1.2: Cache invalidation race condition fixed

---

## Phase 2 (P2): Medium Priority — 🟡 5 OPEN ITEMS

### P2.1 Silent .catch() Blocks — ✅ RESOLVED (FALSE POSITIVES)

**Status:** ✅ Resolved  
**Priority:** N/A (Not an issue)  
**Reviewed:** v42 Verification (January 27, 2026)

**Finding:** All 4 reported `.catch()` blocks were audited and found to be correctly handled:

| File | Line | Assessment |
|------|------|------------|
| Toolbar.js | 1625 | ✅ OK — Comment documents error handled by ImportExportManager |
| EmojiPickerPanel.js | 533 | ✅ OK — Shows visual "?" fallback for failed emoji load |
| PathToolHandler.js | N/A | ❌ False positive — file is 230 lines, no .catch exists |
| EmojiLibraryIndex.js | N/A | ❌ False positive — line 841 in build script, not production |

**Conclusion:** No action needed. All production catch blocks have appropriate handling.

---

### P2.2 Async Functions Without Try-Catch — ✅ RESOLVED (FALSE POSITIVES)

**Status:** ✅ Resolved  
**Priority:** N/A (Not an issue)  
**Reviewed:** v42 Verification (January 27, 2026)

**Finding:** All mentioned files use Promise chains with .catch() handlers, not async/await.
The codebase uses consistent Promise-based error handling throughout the emoji modules.

| File | Assessment |
|------|------------|
| EmojiPickerPanel.js | ✅ Uses Promise chains with .catch() |
| EmojiLibraryIndex.js | ✅ Uses Promise chains with proper error re-throw |

**Conclusion:** No action needed. Promise chains handle errors correctly.

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

**Target:** Reduce hand-written god classes from 17 to ≤12

**Current Count (January 27, 2026):** 17 hand-written JS files ≥1,000 lines

**Priority Order (by improvement potential):**

| File | Lines | Strategy | Impact |
|------|-------|----------|--------|
| ViewerManager.js | 2,014 | Extract SlideRenderer, ImageRenderer | High |
| APIManager.js | 1,523 | Extract RetryManager, RequestTracker | High |
| Toolbar.js | 1,891 | Extract ToolbarSections by category | Medium |
| ToolbarStyleControls.js | 1,070 | Extract style category controllers | Medium |

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

1. **LayersDatabase.php** (1,243 lines) → Split into:
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

### P2.8 Fix window.onbeforeunload Direct Assignment — ✅ COMPLETED

**Status:** ✅ COMPLETED (January 28, 2026)  
**Priority:** P2 - Medium  
**Category:** Code Quality / Compatibility  
**Location:** `resources/ext.layers.slides/SlideManager.js`  
**Discovered:** v43 Review (January 27, 2026)

**Problem:** SlideManager directly assigned to `window.onbeforeunload`.

**Fix Applied:**
- Added `beforeUnloadHandler` bound function to constructor
- Refactored `handleDirty()` to use `addEventListener`/`removeEventListener`
- Handler now only fires when `isDirty` is true
- Properly tracks dirty state transitions to avoid duplicate listeners

**Estimated Effort:** 30 minutes

---

## Completed P2 Items (for reference)

| Item | Date | Notes |
|------|------|-------|
| P2.A: ViewerManager test fix | Jan 27, 2026 | Added missing lockMode parameter |
| P2.B: Layer search/filter | Jan 25, 2026 | Full search/filter UI |
| P2.C: i18n docs | Jan 25, 2026 | All ~718 keys documented |
| P2.D: Query simplification | Jan 25, 2026 | Two-query approach |
| P2.E: Coverage thresholds | Jan 25, 2026 | Raised to 80-92% |
| P2.F: RGBA hex colors | Jan 25, 2026 | 3/4/6/8-digit support |
| P2.G: DraftManager leak | Jan 25, 2026 | Subscription cleanup |
| P2.H: Deprecated code dates | Jan 27, 2026 | All 7 have v2.0 dates |

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

**Status:** Planned for v2.0  
**Priority:** P3 - Low  
**Category:** Technical Debt  

**Deprecated APIs to Remove in v2.0 (7 markers):**

| File | Deprecated Item | Replacement |
|------|-----------------|-------------|
| ToolbarStyleControls.js (753) | Context-aware toolbar setting | Now always enabled |
| ToolbarStyleControls.js (1009) | `hideControlsForTool()` | Use `hideControlsForSelectedLayers()` |
| ModuleRegistry.js (311) | `window.layersModuleRegistry` | Use `window.layersRegistry` |
| ModuleRegistry.js (338) | Legacy export pattern | Use `window.Layers.*` namespace |
| LayerPanel.js (529) | `createNewFolder()` | Use `createFolder()` |
| LayerPanel.js (886) | Code panel methods | Moved to UIManager |
| TransformationEngine.js (332) | Direct transform methods | Use canvas context transforms |

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

### P3.12 Fix Read-Only API Permission Checks

**Status:** Open  
**Priority:** P3 - Low  
**Category:** Security Hardening  
**Discovered:** v42 Review (January 27, 2026)

**Problem:** Two read-only special pages lack explicit permission checks:

| File | Issue |
|------|-------|
| SpecialSlides.php | `execute()` has no `checkUserRightsAny()` before listing slides |
| SpecialEditSlide.php | `execute()` has no permission check before returning slide data |

**Note:** ApiLayersInfo does check `userCan('read')` on line 86.

**Solution:** Add `$this->checkUserRightsAny( 'read' )` to both special pages.

**Estimated Effort:** 30 minutes

---

### P3.13 Rich Text Formatting (FR-16) — HIGH VALUE

**Status:** Open  
**Priority:** P3 - Medium (High Value)  
**Category:** Feature Enhancement  
**Proposed:** January 28, 2026

**Problem:** Text Box and Callout layers currently support only uniform formatting. All text in a layer shares identical font size, color, weight, and style. This limits expressive capability compared to tools like Figma, Canva, and PowerPoint.

**Desired Behavior:**
- Select a portion of text within a text box
- Apply formatting (bold, italic, color, size) to selection only
- Mixed formatting persists through save/load

**Solution Summary:**
1. Add `richText` array to layer data model (styled text runs)
2. Update TextBoxRenderer/CalloutRenderer to render runs
3. Replace textarea with contenteditable in InlineTextEditor
4. Integrate toolbar formatting with text selection

**Impact:** HIGH — Would significantly improve the editor's value proposition

**See:** `docs/FUTURE_IMPROVEMENTS.md` → FR-16 for detailed implementation plan

**Estimated Effort:** 3-4 weeks

---

## God Class Status Summary

### 19 Files ≥1,000 Lines

| Category | Count | Files |
|----------|-------|-------|
| Generated (exempt) | 2 | ShapeLibraryData, EmojiLibraryIndex |
| Well-delegated | 10 | CanvasManager, LayerPanel, SelectionManager, etc. |
| Math/Rendering | 5 | ArrowRenderer, ResizeCalculator, TransformController, etc. |
| Needs Attention | 2 | ViewerManager, APIManager |
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
| P2.A: ViewerManager test fix | Jan 27, 2026 | Added missing lockMode |
| P2.B: Layer search | Jan 25, 2026 | Full search/filter UI |
| P2.C: i18n docs | Jan 25, 2026 | All ~718 keys documented |
| P2.D: Query simplification | Jan 25, 2026 | Two-query approach |
| P2.E: Coverage thresholds | Jan 25, 2026 | Raised to 80-92% |
| P2.F: RGBA hex colors | Jan 25, 2026 | 3/4/6/8-digit support |
| P2.G: DraftManager leak | Jan 25, 2026 | Subscription cleanup |
| P2.H: Deprecated code dates | Jan 27, 2026 | All 7 have v2.0 dates |
| P3.5: Zoom-to-cursor | Jan 26, 2026 | Already implemented |
| P3.6: Accessibility | Jan 25, 2026 | ARIA regions complete |
| P3.7: Slide docs | Jan 25, 2026 | Architecture documented |
| P3.8: Timeout audit | Jan 25, 2026 | Adequate handling |

### In Progress (🟡)

| Item | Status | Priority |
|------|--------|----------|
| P2.1: Silent catch logging | Open | Medium |
| P2.2: Async try-catch | Open | Medium |
| P2.3: DB return types | Open | Medium |
| P2.4: HistoryManager memory | Mitigated | Medium |
| P2.5: JS god classes | Ongoing | Medium |
| P2.6: PHP god classes | Planned | Medium |
| P2.7: ShapeLibrary E2E | Partial | Medium |
| P2.8: onbeforeunload fix | ✅ Completed | Medium |

### Blocked (🔴)

None currently blocked.

---

## Next Steps

### Quick Wins (This Week)
1. ✅ **P1.3:** Update docs/ARCHITECTURE.md metrics — COMPLETED
2. ✅ **P2.8:** Fix window.onbeforeunload assignment — COMPLETED
3. **P3.12:** Add permission checks to special pages (30 min)

### This Sprint
4. **P2.3:** Standardize DB return types
5. **P2.4:** Make DeepClone a hard dependency

### Next Milestone
6. **P2.5:** Continue JS god class reduction
7. **P2.6:** PHP god class refactoring
8. **P2.7:** Additional ShapeLibrary E2E tests

### Long-Term (v2.0)
9. **P3.1:** Visual regression testing
10. **P3.2:** TypeScript migration
11. **P3.3:** Deprecated code removal
12. **P3.4:** Custom fonts support

---

## Metrics to Track

| Metric | Current | Target | Notes |
|--------|---------|--------|-------|
| Test count | 10,667 | Maintain | No regression |
| Statement coverage | 95.85% | ≥92% | Threshold in jest.config |
| Branch coverage | 85.39% | ≥80% | Threshold in jest.config |
| Hand-written god classes (JS) | 18 | ≤12 | Reduce by 6 |
| PHP god classes | 2 | 0 | Refactor both |
| Deprecated markers | 7 | 0 | Remove in v2.0 |
| ESLint disables | 11 | ≤15 | Minimized |
| Documentation stale | 0 files | 0 | ✅ Fixed |
| onbeforeunload issue | 0 files | 0 | ✅ Fixed |
| Overall score | 8.6 | 9.0 | Path to world-class |

---

## Known Technical Debt

| Item | Impact | Effort | Priority |
|------|--------|--------|----------|
| docs/ARCHITECTURE.md stale | ✅ Fixed | 0 | P1.3 |
| window.onbeforeunload issue | ✅ Fixed | 0 | P2.8 |
| 7 deprecated APIs | Medium - maintenance | 1 sprint | P3.3 |
| 22 god classes | Medium - cognitive load | 2-3 weeks | P2.5/P2.6 |
| Inconsistent DB return types | Medium - bug potential | 1-2 days | P2.3 |
| No visual regression tests | Medium - rendering bugs | 1-2 sprints | P3.1 |
| No TypeScript | Low - type safety | Long-term | P3.2 |

---

*Last updated: January 28, 2026*  
*Overall score: 8.6/10 — Production-ready, high quality (improved from 8.5 after doc fixes)*
