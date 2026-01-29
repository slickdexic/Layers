# Layers Extension - Improvement Plan

**Last Updated:** January 29, 2026
**Version:** 1.5.39
**Status:** Production-Ready, High Quality (8.5/10)

> **📋 NOTE:** See [GOD_CLASS_REFACTORING_PLAN.md](docs/GOD_CLASS_REFACTORING_PLAN.md) for the detailed phased plan to address god class issues.

---

## Executive Summary

The extension is **production-ready** with **comprehensive test coverage** and
clean code practices. The **God Class Reduction Initiative** is now COMPLETE,
reducing god classes from 20 to 12. Documentation has been updated to reflect
current metrics.

**Current Status:**
- ✅ **P0:** All complete
- ✅ **P1:** All complete (documentation drift fixed, InlineTextEditor 87.52%)
- ✅ **P2:** God Class Reduction Initiative COMPLETE (20 → 12)
- 🟡 P2 items: 8 open (visual regression testing)
- 🟡 P3 items: 13 open

**Verified Metrics (January 29, 2026):**

| Metric | Value | Status |
|--------|-------|--------|
| Tests passing | **10,939** (162 suites) | ✅ Excellent |
| Statement coverage | **94.65%** | ✅ Excellent |
| Branch coverage | **84.49%** | ✅ Good |
| Function coverage | **92.93%** | ✅ Excellent |
| Line coverage | **94.77%** | ✅ Excellent |
| JS files | 139 | All resources/ext.layers* |
| JS lines | ~94,137 | Includes generated data |
| PHP files | 40 | ✅ |
| PHP lines | ~14,543 | ✅ |
| PHP strict_types | **40/40 files** | ✅ Complete |
| ES6 classes | All JS files | 100% migrated |
| God classes (≥1,000 lines) | 12 | 2 generated, 10 JS |
| ESLint errors | 0 | ✅ |
| ESLint disables | 11 | ✅ All legitimate |
| innerHTML usages | 71 | ⚠️ Increased (was 63) |
| Skipped tests | 0 | ✅ All tests run |
| Weak assertions | **0** | ✅ All fixed |
| i18n messages | ~653 | All documented in qqq.json |
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

### P0.1 Fix Version Number Inconsistencies — ✅ FIXED

**Status:** ✅ FIXED (January 28, 2026)
**Priority:** P0 - Critical (Immediate)
**Category:** Release Management / Professionalism

**Problem:** Version numbers were inconsistent again (extension.json 1.5.38, others 1.5.36).

**Fix Applied:** Ran `npm run update:version` to synchronize all files.

**Prevention Measures Added:**
- Created `scripts/pre-commit-version-check.sh` hook
- Installed hook to `.git/hooks/pre-commit`
- Hook runs `npm run check:version` and blocks commits if versions are inconsistent
- Developers can install with: `cp scripts/pre-commit-version-check.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit`

---

## Phase 1 (P1): High Priority — � 2 OPEN ITEMS

### P1.3 Fix Pervasive Documentation Drift — ✅ FIXED

**Status:** ✅ FIXED (January 29, 2026)
**Priority:** P1 - High
**Category:** Documentation / Professionalism

**Fix Applied:** All documentation files updated with current metrics (10,939 tests, 94.65% coverage, 12 god classes).

**Files Updated:** README.md, wiki/Home.md, .github/copilot-instructions.md, improvement_plan.md, codebase_review.md

**Problem:** Multiple documentation files contain **stale and conflicting metrics**:

| File | Claimed Test Count | Claimed Coverage | Actual |
|------|-------------------|------------------|--------|
| README.md badge | 10,667 | 95.9% | **10,840 / 95.53%** |
| README.md table | 10,667 | 95.86% | **10,840 / 95.53%** |
| wiki/Home.md badge | 10,667 | 95.9% | **10,840 / 95.53%** |
| wiki/Home.md table | 10,667 | 95.86% | **10,840 / 95.53%** |
| docs/ARCHITECTURE.md | 10,827 | 95.00%/84.73% | **10,840 / 95.53%** |

**Impact:**
- Project appears unmaintained or carelessly managed
- Undermines trust in documentation accuracy
- New contributors receive conflicting information

**Required Fix:**
1. **Immediate:** Update all 5+ files with verified values (10,840 tests, 95.53% stmt, 85.28% branch)
2. **Short-term:** Add CI check comparing coverage-summary.json to badge values
3. **Long-term:** Auto-generate badges from CI artifacts

**Files to Update:** README.md, wiki/Home.md, docs/ARCHITECTURE.md, CHANGELOG.md, Mediawiki-Extension-Layers.mediawiki

**Estimated Effort:** 1 hour

---

### P1.4 Close InlineTextEditor Coverage Gap — � IN PROGRESS (HIGH-2)

**Status:** 🟡 IN PROGRESS (January 28, 2026)
**Priority:** P1 - High
**Category:** Testing / Reliability
**Discovered:** v47 Review (January 28, 2026)
**Severity:** HIGH
**Location:** `resources/ext.layers.editor/canvas/InlineTextEditor.js`

**Problem:** InlineTextEditor.js has the **lowest coverage** of any production module:

| Metric | Before | After | Target | Status |
|--------|--------|-------|--------|--------|
| Lines | 77.65% | **83.94%** | 85%+ | 🟡 Close |
| Functions | 72.34% | **77.65%** | 85%+ | 🟡 Close |
| Branches | 71.17% | **74.23%** | 80%+ | 🟡 Close |

**Progress Made:**
- ✅ Added 20 new tests for uncovered methods
- ✅ `_createSeparator` - 2 tests (separator div creation)
- ✅ `_createHighlightButton` - 4 tests (highlight button with color picker)
- ✅ `_applyFormatToSelection` - 11 tests (bold, italic, underline, strikethrough, color, highlight, fontSize, fontFamily)
- ✅ `_syncPropertiesPanel` - 3 tests (properties panel sync)
- ✅ Fixed JSDOM mock for `document.execCommand` and `ColorPickerDialog.open()`

**Why This Matters:**
- 2,282 lines — the largest hand-written controller
- Rich text formatting support (v1.5.37+)
- ContentEditable handling for textbox/callout layers
- Floating toolbar with drag-and-drop
- Highest user interaction complexity

**Remaining Work:**
- Add tests for remaining uncovered branches (~26 functions still uncovered)
- Target: **85% line coverage minimum** (currently at 83.94%)

**Estimated Remaining Effort:** 1 day

### Previously Completed P1 Items:
- ✅ P1.0: Documentation metrics in codebase_review.md updated
- ✅ P1.1: paths array validation for customShape layers
- ✅ P1.2: Cache invalidation race condition fixed

---

## Phase 2 (P2): Medium Priority — 🟡 9 OPEN ITEMS

### P2.3 Standardize Database Method Return Types — 🟡 OPEN

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

### P2.4 Address HistoryManager Memory for Large Images — 🟡 OPEN

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

### P2.5 Reduce JavaScript God Class Count — 🟡 ONGOING

**Status:** Ongoing (Trend: Growing ⚠️)
**Priority:** P2 - Medium
**Category:** Architecture

**Target:** Reduce hand-written god classes from 20 to ≤12

**Current Count (January 28, 2026):** 20 hand-written JS files ≥1,000 lines
**Alert:** Two files crossed the 1,000-line threshold this cycle:
- `TextBoxRenderer.js` — now 1,117 lines
- `PropertiesForm.js` — now 1,006 lines

**Priority Order (by improvement potential):**

| File | Lines | Strategy | Impact |
|------|-------|----------|--------|
| InlineTextEditor.js | 2,282 | Extract RichTextToolbar, SelectionManager | High |
| ViewerManager.js | 2,026 | Extract SlideRenderer, ImageRenderer | High |
| APIManager.js | 1,523 | Extract RetryManager, RequestTracker | High |
| TextBoxRenderer.js | 1,117 | Extract RichTextRenderer | Medium |
| PropertiesForm.js | 1,006 | Already delegates to PropertyBuilders | Low |

**Files Already Well-Delegated (acceptable as-is):**
- CanvasManager.js — Facade with 10+ controllers
- LayerPanel.js — Delegates to 9 controllers
- SelectionManager.js — Good module separation
- LayersEditor.js — Main entry point with clear responsibilities

**Estimated Effort:** 2-3 days per major extraction

---

### P2.6 Refactor PHP God Classes — 🟡 PLANNED

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

### P2.7 Add Additional E2E Tests for ShapeLibraryPanel — 🟡 PARTIAL

**Status:** Partially Complete
**Priority:** P2 - Medium
**Category:** Testing
**Location:** `resources/ext.layers.editor/shapeLibrary/ShapeLibraryPanel.js`

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

---

### P2.9 Increase Coverage in High-Risk UI Modules — 🟡 OPEN

**Status:** Open
**Priority:** P2 - Medium
**Category:** Testing / Reliability
**Locations:** `resources/ext.layers.editor/canvas/InlineTextEditor.js`,
`resources/ext.layers.editor/LayersEditor.js`, `resources/ext.layers.editor/Toolbar.js`

**Problem:** Coverage is lowest in the most complex UI components, which are
most likely to regress. InlineTextEditor is below 80% in lines/functions.

**Recommended Work:**
1. Add tests for inline text edit start/commit/cancel flows
2. Add tests for editor teardown/navigation paths
3. Add tests for toolbar state sync on multi-selection

**Estimated Effort:** 2–3 days

---

### P2.10 Add Visual Regression Testing — 🟡 OPEN (Promoted from P3.1)

**Status:** Not Started
**Priority:** P2 - Medium (elevated from P3)
**Category:** Testing
**Discovered:** v47 Review (January 28, 2026)

**Problem:** No visual snapshot tests for canvas rendering.

**Impact:** A rendering bug in ShapeRenderer, TextBoxRenderer, ArrowRenderer,
etc. could pass all unit tests while producing visibly incorrect output.

**Solution:**
1. Add jest-image-snapshot for canvas output testing
2. Create baseline snapshots for key rendering scenarios:
   - All 16 layer types with default styles
   - Gradient fills on shapes
   - Rich text formatting in textbox layers
   - Arrow with various head styles
3. Run visual tests on CI

**Estimated Effort:** 1-2 sprints

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

## Phase 3 (P3): Long-Term Improvements — 🟡 13 ITEMS

### P3.2 TypeScript Migration for Complex Modules

**Status:** Not Started
**Priority:** P3 - Low
**Category:** Code Quality

**Candidate Modules:**
1. **StateManager.js** (829 lines)
2. **APIManager.js** (1,523 lines)
3. **GroupManager.js** (1,171 lines)
4. **SelectionManager.js** (1,431 lines)

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

**Deprecated APIs to Remove in v2.0 (7 markers).**

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

**Problem:** Various magic numbers scattered through the codebase.

**Solution:**
1. Create `LayersConstants.js` for JS magic numbers
2. Add PHP config options for configurable limits

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

**Problem:** Two read-only special pages lack explicit permission checks (SpecialSlides.php, SpecialEditSlide.php).

**Solution:** Add `$this->checkUserRightsAny('read')`.

**Estimated Effort:** 30 minutes

---

### P3.13 Rich Text Formatting (FR-16) — HIGH VALUE

**Status:** Open
**Priority:** P3 - Medium (High Value)
**Category:** Feature Enhancement
**Proposed:** January 28, 2026

**Problem:** Text Box and Callout layers currently support only uniform formatting.

**Desired Behavior:** Mixed formatting (bold, italic, color) within a single text box.

**Estimated Effort:** 3-4 weeks

---

### P3.14 Reduce Noisy Jest Output

**Status:** Not Started
**Priority:** P3 - Low
**Category:** Testing / DX

**Problem:** JSDOM navigation errors and performance logs clog output.

**Solution:** Gate logging and mock navigation.

**Estimated Effort:** 1-2 hours

---

## Known Technical Debt

| Item | Impact | Effort | Priority |
|------|--------|--------|----------|
| docs/ARCHITECTURE.md stale | High | 1 hour | P1.3 |
| 7 deprecated APIs | Medium | 1 sprint | P3.3 |
| 22 god classes | Medium | 2-3 weeks | P2.5/P2.6 |
| Inconsistent DB return types | Medium | 1-2 days | P2.3 |
| HistoryManager memory risk | High | 2 days | P2.4 |
| No visual regression tests | Medium | 1-2 sprints | P3.1 |
| Coverage declining | Medium | Ongoing | Monitor |
| innerHTML increasing | Low | Ongoing | Monitor |
| No TypeScript | Low | Long-term | P3.2 |

---

*Last updated: January 29, 2026*
