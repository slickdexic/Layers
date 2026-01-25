# Layers Extension - Improvement Plan

**Last Updated:** January 25, 2026  
**Version:** 1.5.30  
**Status:** Production-Ready, High Quality (8.4/10)

> **📋 NOTE:** See [GOD_CLASS_REFACTORING_PLAN.md](docs/GOD_CLASS_REFACTORING_PLAN.md) for the detailed phased plan to address god class issues.

---

## Executive Summary

The extension is **production-ready and high quality** with **comprehensive test coverage** and clean code practices. This improvement plan addresses the issues identified in the comprehensive critical audit v35.

**Current Status:**
- ✅ All P0 items complete (no critical issues)
- ✅ All P1 items complete (January 25, 2026)
- 🟡 P2 items: 2 open (5 completed)
- 🟡 P3 items: 8 long-term improvements

**Verified Metrics (January 25, 2026):**

| Metric | Value | Status |
|--------|-------|--------|
| Tests passing | **10,626** (157 suites) | ✅ Excellent |
| Statement coverage | **94.19%** | ✅ Excellent |
| Branch coverage | **84.43%** | ✅ Excellent |
| Function coverage | **92.19%** | ✅ Excellent |
| Line coverage | **94.32%** | ✅ Excellent |
| JS files | 127 | Excludes dist/ and scripts/ |
| JS lines | ~115,002 | Includes generated data |
| PHP files | 40 | ✅ |
| PHP lines | ~14,169 | ✅ |
| PHP strict_types | **40/40 files** | ✅ Complete |
| ES6 classes | 127 files | 100% migrated |
| God classes (≥1,000 lines) | 21 | 3 generated, 18 hand-written |
| ESLint errors | 0 | ✅ |
| ESLint disables | 11 | ✅ All legitimate |
| innerHTML usages | 63 | ✅ Audited - all safe |
| Skipped tests | 0 | ✅ All tests run |
| Weak assertions | **0** | ✅ All fixed |
| i18n messages | 676 | 4 missing qqq.json docs |
| Deprecated code markers | 17 | 🟡 Technical debt |

---

## Priority Definitions

| Priority | Timeline | Description |
|----------|----------|-------------|
| **P0** | Immediate | Critical bugs or security issues |
| **P1** | 1–2 weeks | High-impact security and data integrity issues |
| **P2** | 1–3 months | Architecture improvements, code quality, features |
| **P3** | 3–6 months | Long-term improvements and technical debt |

---

## Phase 0 (P0): Critical Issues — ✅ NONE

No critical security vulnerabilities or stability issues identified.

**Previously Fixed P0 Issues:**
- ✅ Missing `mustBePosted()` on Write API Modules (Fixed January 24, 2026)
- ✅ console.log in Production Code (Fixed January 24, 2026)
- ✅ CSRF token protection on all write APIs
- ✅ Rate limiting on save/delete/rename operations

---

## Phase 1 (P1): High Priority — ✅ ALL COMPLETED

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

## Phase 2 (P2): Medium Priority — 🟡 6 OPEN ITEMS

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

1. **LayersDatabase.php** (1,075 lines) → Split into:
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

### P2.3 Add Layer Search/Filter Feature

**Status:** ✅ COMPLETED (January 25, 2026)  
**Priority:** P2 - Medium  
**Category:** Feature  
**Evidence:** Documented as F2 in KNOWN_ISSUES.md

**Implemented:**
- Added search input at top of LayerPanel
- Real-time filtering as user types (by layer name or text content)
- Shows "Showing N of M layers" count during filter
- Clear button to reset filter
- Full dark mode support (night and OS themes)
- 3 new i18n messages added

**UI Mockup:**
```
┌─────────────────────────────────┐
│ 🔍 Search layers...         [×] │
│ Showing 5 of 42 layers          │
├─────────────────────────────────┤
│ ▼ Matched Layer 1               │
│ ▼ Matched Layer 2               │
│ ...                             │
└─────────────────────────────────┘
```

**Estimated Effort:** 2-3 days

---

### P2.4 Complete i18n Documentation

**Status:** ✅ VERIFIED COMPLETE (January 25, 2026)  
**Priority:** P2 - Medium  
**Category:** Documentation / i18n  
**Location:** `i18n/qqq.json`

**Finding:** Banana i18n checker passes with no missing documentation. The 4-line difference between en.json (679 lines) and qqq.json (675 lines) is metadata only. All 679 message keys are documented.

---

### P2.5 Simplify getNamedSetsForImage Query

**Status:** ✅ COMPLETED (January 25, 2026)  
**Priority:** P2 - Medium  
**Category:** Performance / Maintainability  
**Location:** `src/Database/LayersDatabase.php`

**Implemented:** Replaced complex self-join with correlated subquery with a clearer two-query approach:

1. **Query 1:** Get aggregates per named set (count, max revision, max timestamp)
2. **Query 2:** For each set, fetch user_id from the latest revision row (simple primary key lookup)

**Benefits:**
- Much easier to read and maintain
- Each query is straightforward (no self-joins or subqueries)
- Performance is identical since each image has ≤15 named sets (config limit)
- Updated unit tests to validate new query pattern

---

### P2.6 Raise Jest Coverage Thresholds

**Status:** ✅ COMPLETED (January 25, 2026)  
**Priority:** P2 - Medium  
**Category:** Quality / Regression Prevention  
**Location:** `jest.config.js` lines 33-38

**Implemented:** Updated coverage thresholds to protect against regression:

| Metric | Old Threshold | New Threshold | Actual |
|--------|---------------|---------------|--------|
| Branches | 65% | 80% | 84.43% |
| Functions | 80% | 90% | 92.19% |
| Lines | 80% | 92% | 94.32% |
| Statements | 80% | 92% | 94.19% |

**Solution:**
```javascript
coverageThreshold: {
  global: {
    branches: 80,     // Was 65
    functions: 90,    // Was 80
    lines: 92,        // Was 80
    statements: 92    // Was 80
  }
}
```

**Estimated Effort:** 30 minutes

---

## Completed P2 Items (for reference)

### P2.A Add 8-Digit Hex Color (RGBA) Support — ✅ COMPLETED

**Status:** ✅ COMPLETED (January 25, 2026)  
**Location:** `src/Validation/ColorValidator.php`

**Fix Applied:** Updated `isValidHexColor()` regex to accept 3/4/6/8-digit hex. Updated `normalizeHexColor()` to expand 4-digit (#RGBA) to 8-digit (#RRGGBBAA).

---

### P2.B Complete StateManager Lock Auto-Recovery — ✅ ALREADY IMPLEMENTED

**Status:** ✅ Verified (January 25, 2026)  
**Location:** `resources/ext.layers.editor/StateManager.js`

Auto-recovery fully implemented with:
- `LOCK_AUTO_RECOVERY_TIMEOUT_MS` (30s) triggers `forceUnlock('auto-recovery')`
- `LOCK_DETECTION_TIMEOUT_MS` (5s) logs warning for stuck locks
- `forceUnlock()` properly clears all timers and processes pending operations

---

### P2.C Fix DraftManager Subscription Leak — ✅ COMPLETED

**Status:** ✅ COMPLETED (January 25, 2026)  
**Location:** `resources/ext.layers.editor/DraftManager.js`

**Fix Applied:** Added cleanup of existing subscription at the start of `initialize()` before creating a new one.

---

### P2.D Address HistoryManager Memory Growth — ✅ ADDRESSED

**Status:** ✅ ADDRESSED (January 25, 2026)  
**Location:** `resources/ext.layers.editor/HistoryManager.js`

**Fix Applied:** Added warning log when JSON cloning fallback is used with image layers. The efficient `cloneLayersEfficient` function in DeepClone.js is used when available.

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

**Deprecated APIs to Remove in v2.0 (17 markers):**

| File | Deprecated Item | Replacement |
|------|-----------------|-------------|
| TransformationEngine.js | Coordinate transform methods | Use ZoomPanController |
| ToolbarStyleControls.js | `hideControlsForTool()` | Use `hideControlsForSelectedLayers()` |
| ModuleRegistry.js | `window.layersModuleRegistry` | Use `window.layersRegistry` |
| LayersNamespace.js | Direct `window.*` exports | Use `window.Layers.*` namespace |
| LayerPanel.js | `createNewFolder()` | Use `createFolder()` |

**Plan:**
1. Create migration guide document for each deprecated API
2. Add console warnings for deprecated API usage
3. Communicate deprecation in CHANGELOG for 2 minor versions
4. Remove in v2.0 release

**Estimated Effort:** 1 sprint

---

### P3.4 Custom Fonts Support

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

### P3.5 Canvas Accessibility Improvements

**Status:** Partially Complete  
**Priority:** P3 - Low  
**Category:** Accessibility  

**Completed:**
- ✅ LayerPanel has `announceToScreenReader()` method
- ✅ ARIA roles on toolbar buttons
- ✅ Keyboard navigation for layer panel

**Still Needed:**
- Announce zoom level changes
- Announce tool changes
- Add layer descriptions for screen readers
- Consider aria-describedby for canvas

**Estimated Effort:** 2-3 days

---

### P3.6 Standardize Timeout Tracking

**Status:** ✅ AUDITED - Low Priority  
**Priority:** P3 - Low  
**Category:** Code Quality / Memory Safety  

**Audit Results (January 25, 2026):**

Found 58 setTimeout/setInterval usages across the codebase. Analysis shows most are properly handled:

| Category | Count | Status |
|----------|-------|--------|
| Tracked via instance properties | 15 | ✅ Proper cleanup |
| Short-lived `setTimeout(..., 0)` | 20 | ✅ Safe (UI sync) |
| Self-limiting retry chains | 8 | ✅ Safe (bounded) |
| Module-level (tracked) | 10 | ✅ Proper cleanup |
| Fire-and-forget (safe) | 5 | ✅ Short operations |

**Conclusion:** Current timeout handling is adequate. Most long-lived timers are tracked via instance properties and cleaned up in destroy() methods. The TimeoutTracker utility is available for new code but migrating existing code provides minimal benefit.

**Recommendation:** Close as "Low Priority" - no immediate action needed.

---

### P3.7 Complete Slide Mode Documentation

**Status:** Not Started  
**Priority:** P3 - Low  
**Category:** Documentation  

**Problem:** Slide Mode well-documented in README.md but incomplete in:
- ARCHITECTURE.md (missing Slide Mode architecture)
- API.md (missing slide API endpoints)
- DEVELOPER_ONBOARDING.md (missing slide development guide)

**Solution:**
1. Add Slide Mode section to ARCHITECTURE.md with Mermaid diagrams
2. Document `ApiSlidesSave` and `ApiSlideInfo` in API.md
3. Add slide development examples to onboarding guide
4. Update KNOWN_ISSUES.md with slide-specific issues

**Estimated Effort:** 4 hours

---

### P3.8 Reduce JavaScript God Classes

**Status:** Ongoing  
**Priority:** P3 - Low  
**Category:** Architecture  

**Files Over 1,000 Lines (18 hand-written):**

| File | Lines | Strategy |
|------|-------|----------|
| CanvasManager.js | 2,045 | Already uses facade pattern ✅ |
| LayerPanel.js | 2,090 | Already delegates to 9 controllers ✅ |
| ViewerManager.js | 2,003 | Extract Slide/Image specific renderers |
| Toolbar.js | 1,891 | Extract tool groups into separate components |
| LayersEditor.js | 1,784 | Extract setup/teardown into EditorLifecycle |
| APIManager.js | 1,524 | Extract retry logic, request tracking |

**Approach:**
1. Identify cohesive responsibility groups
2. Extract into focused controller/helper classes
3. Maintain facade for backward compatibility
4. Add tests before and after refactoring

**Estimated Effort:** 2-3 days per major class

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
| P2.A: RGBA hex colors | Jan 25, 2026 | 3/4/6/8-digit support |
| P2.B: StateManager lock | Jan 25, 2026 | Already implemented |
| P2.C: DraftManager leak | Jan 25, 2026 | Subscription cleanup |
| P2.D: HistoryManager memory | Jan 25, 2026 | Warning log added |
| P2.3: Layer search | Jan 25, 2026 | Full search/filter UI with dark mode |
| P2.6: Coverage thresholds | Jan 25, 2026 | Raised to 80-92% |

### In Progress (🟡)

| Item | Status | Assigned |
|------|--------|----------|
| P2.2: PHP god classes | Planned | TBD |

### Blocked (🔴)

None currently blocked.

---

## Next Steps

1. **Immediate:** P2.1 (DB return types) — code quality
2. **This Sprint:** P2.5 (query simplification) — performance
3. **Next Milestone:** P2.2 (PHP god classes) — architecture

---

*Last updated: January 25, 2026*  
*Overall score: 8.4/10 — Production-ready, high quality with areas for improvement*
