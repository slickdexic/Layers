# Layers Extension - Improvement Plan

**Last Updated:** January 30, 2026  
**Version:** 1.5.41  
**Status:** Production-Ready (8.7/10)

> **📋 NOTE:** See [GOD_CLASS_REFACTORING_PLAN.md](docs/GOD_CLASS_REFACTORING_PLAN.md) for the detailed phased plan to address god class issues.

---

## Executive Summary

The extension is **production-ready** with **comprehensive test coverage** and clean code practices. All **11,112** tests pass. This improvement plan prioritizes remaining issues identified in the January 30, 2026 comprehensive critical review.

**Current Status:**
- ✅ **P0:** All resolved (no critical bugs)
- 🟠 **P1:** 3 open (documentation sync, wiki corruption, god class count)
- 🟡 **P2:** 8 open (code quality improvements)
- 🟢 **P3:** 12 open (minor improvements)

**Verified Metrics (January 30, 2026):**

| Metric | Value | Status |
|--------|-------|--------|
| Tests total | **11,112** (163 suites) | ✅ Excellent |
| Tests passing | **11,112** | ✅ All pass |
| Tests skipped | **0** | ✅ Clean |
| Statement coverage | **95.42%** | ✅ Excellent |
| Branch coverage | **85.25%** | ✅ Good |
| Function coverage | **93.72%** | ✅ Excellent |
| Line coverage | **95.55%** | ✅ Excellent |
| JS files | 139 | (~92,338 hand-written + ~14,354 generated) |
| PHP files | 41 | (~14,738 lines) |
| PHP strict_types | **41/41 files** | ✅ Complete |
| ES6 classes | All JS files | 100% migrated |
| God classes (≥1,000 lines) | **18** | 2 generated, 14 JS, 2 PHP |
| Near-threshold files (900-999) | **6** | ⚠️ Watch |
| ESLint errors | 0 | ✅ |
| ESLint disables | 11 | ✅ All legitimate |
| innerHTML usages | 73 | Safe patterns |
| Weak assertions | **0** | ✅ Clean |
| i18n messages | **667** | All documented in qqq.json |
| TODO/FIXME/HACK | 0 | ✅ Clean |
| console.log in production | 0 | ✅ Clean |

---

## Priority Definitions

| Priority | Timeline | Description |
|----------|----------|-------------|
| **P0** | Immediate | Critical bugs or security issues |
| **P1** | 1–2 days | High-impact issues affecting users |
| **P2** | 1–3 months | Architecture, code quality, features |
| **P3** | 3–6 months | Long-term improvements, technical debt |

---

## Phase 0 (P0): Critical Issues — ✅ ALL RESOLVED

No critical bugs remain. All **11,112** tests pass.

Previous P0 items resolved:
- ✅ TailCalculator test fixed (January 30, 2026)
- ✅ ApiLayersList.getLogger bug fixed (January 30, 2026)

---

## Phase 1 (P1): High Priority — 🟠 3 OPEN ITEMS

### P1.1 Fix Documentation Metrics Drift — OPEN

**Status:** 🟠 OPEN  
**Priority:** P1 - High  
**Category:** Documentation / Professionalism

**Problem:** 35 documentation inaccuracies found across files:

| Metric | Listed Values | Actual |
|--------|--------------|--------|
| Test count | 10,939 / 11,067 / 11,069 / 11,096 | **11,112** |
| JS files | 126 / 139 / 141 | **139** |
| Coverage | 94.65% / 95.00% | **95.42%** |
| God classes | 12 / 14 / 17 | **18** |
| i18n | 653 / 656 / 718 | **667** |

**Files Needing Update:**
- [ ] README.md
- [ ] docs/ARCHITECTURE.md
- [ ] wiki/Home.md (+ fix JSON artifact corruption)
- [ ] CHANGELOG.md

**Estimated Effort:** 3-4 hours

---

### P1.2 Fix MediaWiki Version Inconsistency — ✅ RESOLVED

**Status:** ✅ RESOLVED (January 30, 2026)  
**Priority:** P1 - High  
**Category:** Documentation

**Resolution:** All files now correctly show `>= 1.44.0`:
- extension.json: `>= 1.44.0` ✅
- copilot-instructions.md: `>= 1.44.0` ✅
- Mediawiki-Extension-Layers.mediawiki: `>= 1.44.0` ✅

---

### P1.3 Fix wiki/Home.md Corruption — OPEN

**Status:** 🟠 OPEN  
**Priority:** P1 - High  
**Category:** Documentation

**Problem:** Line 49 contains corrupted JSON artifact from a previous edit.

**Fix:** Remove the text: `", "oldString": "---`

**Estimated Effort:** 5 minutes

---

### P1.4 Update God Class Count — OPEN

**Status:** 🟠 OPEN  
**Priority:** P1 - High  
**Category:** Documentation

**Problem:** Documentation says 17 god classes, actual is **18** (missed LayersValidator.js).

**Fix:** Update all references to 18 (2 generated + 14 JS + 2 PHP).

**Estimated Effort:** 30 minutes

---

## Phase 2 (P2): Medium Priority — 🟡 8 OPEN ITEMS

### P2.1 Fix Race Condition in renameNamedSet() — ✅ RESOLVED

**Status:** ✅ RESOLVED (Verified January 30, 2026)  
**Priority:** P2 - Medium  
**Category:** Bug / Race Condition

**Resolution:** Already properly implemented with `startAtomic()` and `FOR UPDATE`:
```php
$dbw->startAtomic( __METHOD__ );
$existsCount = $dbw->selectField( ..., [ 'FOR UPDATE' ] );
// Proper transaction handling with endAtomic in all paths
```

**Files:** `src/Database/LayersDatabase.php` lines 854-895

---

### P2.2 Fix StateManager Queue Data Loss — ✅ RESOLVED

**Status:** ✅ RESOLVED (Verified January 30, 2026)  
**Priority:** P2 - Medium  
**Category:** Bug

**Resolution:** Already has proper coalescing in `_queueSetOperation()`:
1. Looks for existing operation with same key and updates it
2. Uses `_coalesceIntoUpdate()` for queue overflow
3. No data is dropped - operations are merged into update batches

**Files:** `resources/ext.layers.editor/StateManager.js` lines 110-165

---

### P2.3 Synchronize Client/Server Validation — ✅ RESOLVED

**Status:** ✅ RESOLVED (Verified January 30, 2026)  
**Priority:** P2 - Medium  
**Category:** Validation Consistency

**Resolution:** Client and server validation now synchronized:

| Area | Status |
|------|--------|
| Named colors | 148 ✅ |
| strokeWidth | 0-100 ✅ |
| blurRadius | 0-100 ✅ |
| arrowStyle | 5 values ✅ |
| fillOpacity | 0-1 ✅ |
| strokeOpacity | 0-1 ✅ |
| gradient | Full validation ✅ |

**Files:** `resources/ext.layers.editor/LayersValidator.js`

**Estimated Effort:** 3-4 hours

---

### P2.4 Refactor listSlides() SQL Fragments — OPEN

**Status:** 🟡 OPEN  
**Priority:** P2 - Medium  
**Category:** Code Quality

**Problem:** String concatenation builds SQL subqueries.

**Solution:** Refactor to separate queries or proper subquery builder.

**Files:** `src/Database/LayersDatabase.php`

**Estimated Effort:** 2-3 hours

---

### P2.5 Standardize Database Return Types — OPEN

**Status:** 🟡 OPEN  
**Priority:** P2 - Medium  
**Category:** API Consistency

**Problem:** Inconsistent return types:
- `getLayerSet()` → `false`
- `getLayerSetByName()` → `null`
- `countNamedSets()` → `-1`

**Solution:** Standardize to `null` for not-found, throw for errors.

**Files:** `src/Database/LayersDatabase.php` (15+ call sites)

**Estimated Effort:** 1-2 days (breaking change)

---

### P2.6 Fix SVG Script Detection Bypass — OPEN

**Status:** 🟡 OPEN  
**Priority:** P2 - Medium  
**Category:** Security Enhancement

**Problem:** Doesn't check HTML entity encoded variants.

**Solution:** Decode entities before checking:
```php
$decoded = html_entity_decode( $svg, ENT_QUOTES | ENT_HTML5, 'UTF-8' );
if ( preg_match( '/javascript\s*:/i', $decoded ) ) {
    // block
}
```

**Files:** `src/Validation/ServerSideLayerValidator.php`

**Estimated Effort:** 1 hour

---

## Phase 3 (P3): Long-Term — 🟢 8 ITEMS

### P3.1 Reduce JavaScript God Class Count

**Status:** Ongoing  
**Priority:** P3 - Low  
**Category:** Architecture

**Target:** Reduce from 15 (13 hand-written + 2 generated) to ≤12

**Priority Extractions:**

| File | Lines | Strategy | Effort |
|------|-------|----------|--------|
| InlineTextEditor.js | 1,521 | Extract RichTextToolbar | 2-3 days |
| APIManager.js | 1,393 | Extract RetryManager | 2 days |
| ServerSideLayerValidator.php | 1,296 | Strategy pattern | 2-3 days |
| LayersDatabase.php | 1,277 | Repository split | 3-4 days |

**Near-Threshold Files (900-999) to Monitor:**
- ToolbarStyleControls.js (998)
- TextBoxRenderer.js (996)
- ResizeCalculator.js (995)
- ShapeRenderer.js (994)
- PropertiesForm.js (994)
- TransformController.js (992)

---

### P3.2 TypeScript Migration for Core Modules

**Status:** Not Started  
**Priority:** P3 - Low  
**Category:** Code Quality

**Candidates:** StateManager.js, APIManager.js, GroupManager.js

**Strategy:**
1. Add TypeScript build pipeline
2. Start with new modules as .ts
3. Gradually convert existing modules

**Estimated Effort:** 2-3 sprints per module

---

### P3.3 Create Error Constants Class

**Status:** Not Started  
**Priority:** P3 - Low  
**Category:** Code Quality

**Problem:** Error codes repeated as strings across files.

**Solution:** Create `LayersErrors.php` constants class.

**Estimated Effort:** 2 hours

---

### P3.4 Deprecated Code Removal Plan

**Status:** Planned for v2.0  
**Priority:** P3 - Low  
**Category:** Technical Debt

**7 deprecated APIs to remove in v2.0.**

**Plan:**
1. Create migration guide for each
2. Add console warnings in v1.6
3. Remove in v2.0

---

### P3.5 Custom Fonts Support (F3)

**Status:** Not Started  
**Priority:** P3 - Low  
**Category:** Feature

Limited to default font allowlist in `$wgLayersDefaultFonts`.

---

### P3.6 Enhanced Dimension Tool (FR-14)

**Status:** Proposed  
**Priority:** P3 - Low  
**Category:** Feature Enhancement

Make dimension line draggable independently from anchors.

---

### P3.7 Angle Dimension Tool (FR-15)

**Status:** Proposed  
**Priority:** P3 - Low  
**Category:** New Feature

New tool for measuring and annotating angles.

---

### P3.8 Visual Regression Testing

**Status:** Not Started  
**Priority:** P3 - Low  
**Category:** Testing

**Problem:** No visual snapshot tests for canvas rendering.

**Solution:** Add jest-image-snapshot for key scenarios.

**Estimated Effort:** 1-2 sprints

---

## Completed Items (January 2026)

### P0 Items Completed
| Item | Date | Notes |
|------|------|-------|
| TailCalculator bug | Jan 30 | Bounds check added |
| ApiLayersList.getLogger | Jan 30 | Method call fixed |

### P1 Items Completed
| Item | Date | Notes |
|------|------|-------|
| 133 skipped tests deleted | Jan 29 | All removed |
| InlineTextEditor coverage | Jan 28 | Improved |

### P2 Items Completed
| Item | Date | Notes |
|------|------|-------|
| N+1 in getNamedSetsForImage() | Jan 30 | Batch query |
| N+1 in listSlides() | Jan 30 | Batch query |
| LIKE query escaping | Jan 30 | buildLike() |
| Exception handling (\Throwable) | Jan 30 | Standardized |
| API code duplication | Jan 30 | LayersApiHelperTrait |
| Slides-in-tables bug | Jan 30 | Retry filter fixed |

### P3 Items Completed
| Item | Date | Notes |
|------|------|-------|
| Drag handle hit areas | Jan 30 | 4px tolerance |
| Overlay button size | Jan 30 | Reduced 32→26px |
| window.onbeforeunload | Jan 28 | addEventListener |
| Layer search/filter | Jan 25 | Full UI |
| Zoom-to-cursor | Jan 26 | Mouse anchor |

---

## Known Technical Debt

| Item | Impact | Effort | Priority |
|------|--------|--------|----------|
| Documentation drift | High | 2 hours | P1.1 |
| Version inconsistency | High | 30 min | P1.2 |
| renameNamedSet() race | Medium | 2 hours | P2.1 |
| Client/server validation | Medium | 4 hours | P2.3 |
| 17 god classes | Medium | 2-3 weeks | P3.1 |
| Inconsistent DB returns | Medium | 2 days | P2.5 |
| No visual regression | Medium | 1-2 sprints | P3.8 |
| 7 deprecated APIs | Low | 1 sprint | P3.4 |
| No TypeScript | Low | Long-term | P3.2 |

---

## Immediate Action Items

### This Week
1. **🟠 Sync documentation metrics** (P1.1) — 2 hours
2. **🟠 Fix MW version strings** (P1.2) — 30 minutes

### This Month
3. **🟡 Fix renameNamedSet() race** (P2.1) — 2 hours
4. **🟡 Sync client/server validation** (P2.3) — 4 hours
5. **🟡 Fix SVG script detection** (P2.6) — 1 hour

### This Quarter
6. **🟢 Extract 2 god class modules** (P3.1) — 1 week
7. **🟢 Standardize DB return types** (P2.5) — 2 days

---

## Metrics to Track

| Metric | Current | Target | Notes |
|--------|---------|--------|-------|
| Test count | 11,112 | Maintain | All passing |
| Statement coverage | 95.42% | ≥95% | Excellent |
| Branch coverage | 85.25% | ≥85% | Good |
| God classes | 18 | ≤15 | Extract 3 |
| Near-threshold | 6 | ≤4 | Monitor |
| innerHTML | 73 | ≤70 | Reduce |

---

*Last updated: January 30, 2026 (Comprehensive Review)*
