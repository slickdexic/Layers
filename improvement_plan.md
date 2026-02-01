# Layers Extension - Improvement Plan

**Last Updated:** February 1, 2026 (Comprehensive Critical Review v4)  
**Version:** 1.5.45  
**Status:** Production-Ready (8.5/10)

> **📋 NOTE:** See [GOD_CLASS_REFACTORING_PLAN.md](docs/GOD_CLASS_REFACTORING_PLAN.md) for the detailed phased plan to address god class issues.

---

## Executive Summary

The extension is **production-ready** with **comprehensive test coverage** and clean code practices. All **11,157** tests pass. This improvement plan prioritizes issues identified in the February 1, 2026 comprehensive critical review v4.

**Current Status:**
- ✅ **P0:** All resolved (no critical bugs)
- ✅ **P1:** All resolved (enum validation fixed)
- ✅ **P2:** All resolved (20 items)
- 🟢 **P3:** 10 open (low-priority backlog)

**Verified Metrics (February 1, 2026):**

| Metric | Value | Status |
|--------|-------|--------|
| Tests total | **11,157** (163 suites) | ✅ Excellent |
| Tests passing | **11,157** | ✅ All pass |
| Tests skipped | **0** | ✅ Clean |
| Statement coverage | **95.44%** | ✅ Excellent |
| Branch coverage | **85.20%** | ✅ Good |
| Function coverage | **93.75%** | ✅ Excellent |
| Line coverage | **95.56%** | ✅ Excellent |
| JS files | **141** (139 source + 2 dist) | ✅ |
| PHP files | **42** | ✅ |
| PHP strict_types | **42/42 files** | ✅ Complete |
| ES6 classes | All JS files | 100% migrated |
| God classes (≥1,000 lines) | **18** | 2 generated, 14 JS, 2 PHP |
| Near-threshold files (900-999) | **9** | ⚠️ Watch |
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

No critical bugs remain. All **11,157** tests pass.

---

## Phase 1 (P1): High Priority — ✅ ALL RESOLVED

### P1.3 Fix Missing Enum Validation in ServerSideLayerValidator

**Status:** ✅ RESOLVED (January 31, 2026)  
**Priority:** P1 - High  
**Category:** Input Validation / Security

**Problem:** `VALUE_CONSTRAINTS` defines allowed values for 15 enum properties, but only 9 are validated. These 8 properties bypass validation:
- `tailDirection`, `tailStyle`, `style`, `endStyle`
- `textPosition`, `orientation`, `textDirection`, `toleranceType`

**Resolution:** Added all 8 missing properties to the `in_array()` check in `validateStringProperty()` at line 506.

**Files:** `src/Validation/ServerSideLayerValidator.php` lines 506-519

---

### Previously Resolved P1 Issues

| Issue | Resolution Date |
|-------|-----------------|
| Race condition in saveLayerSet | January 31, 2026 |
| Missing permission check in ApiLayersList | January 31, 2026 |
| isComplexityAllowed() layer type coverage | January 31, 2026 |
| Rate limiting on ApiLayersList | January 31, 2026 |
| paths array limit validation | January 31, 2026 |

---

## Phase 2 (P2): Medium Priority — ✅ ALL RESOLVED

### New Issues Found (3 items)

#### P2.19 Fix ZoomPanController Animation Frame Overlap

**Status:** ✅ RESOLVED (January 31, 2026)  
**Priority:** P2 - Medium  
**Category:** Animation Bug

**Problem:** `smoothZoomTo()` doesn't cancel previous animation frame before starting new one.

**Resolution:** Added `cancelAnimationFrame(this.animationFrameId)` at start of `smoothZoomTo()` to prevent overlapping animation loops.

**Files:** `resources/ext.layers.editor/canvas/ZoomPanController.js` line 155

---

#### P2.20 Fix TransformController Stale Layer Reference

**Status:** ✅ RESOLVED (January 31, 2026)  
**Priority:** P2 - Medium  
**Category:** Race Condition

**Problem:** `_pendingResizeLayer` may be stale if layer deleted before rAF fires.

**Resolution:** Added layer existence validation in rAF callback using `this.manager.editor.layers.some((l) => l.id === layerId)` before emitting transform events.

**Files:** `resources/ext.layers.editor/canvas/TransformController.js` lines 213-227

---

#### P2.21 Fix Mediawiki-Extension-Layers.mediawiki Version Table

**Status:** ✅ RESOLVED (January 31, 2026)  
**Priority:** P2 - Medium  
**Category:** Documentation

**Problem:** Branch version table shows 1.5.43 but extension is 1.5.44.

**Resolution:** Updated branch table to show 1.5.44 for all branches.

**Files:** `Mediawiki-Extension-Layers.mediawiki` line 30

---

### Memory Management Issues — ✅ ALL RESOLVED

#### P2.1 Fix Untracked Timeouts in SlideController

**Status:** ✅ RESOLVED (January 31, 2026)
**Priority:** P2 - Medium  
**Category:** Memory Leak Risk

**Resolution:** Already implemented - `_retryTimeouts` array tracks IDs, `destroy()` clears all.

---

#### P2.2 Fix Untracked Event Listeners in ToolDropdown

**Status:** ✅ RESOLVED (January 31, 2026)  
**Priority:** P2 - Medium  
**Category:** Memory Leak Risk

**Resolution:** Fixed - added `boundHandleTriggerClick` and `_menuItemHandlers` Map for tracking, enhanced `destroy()` method.

---

#### P2.3 Fix VirtualLayerList rAF Destroyed Check

**Status:** ✅ RESOLVED (January 30, 2026)  
**Priority:** P2 - Medium  
**Category:** Bug / Race Condition

**Resolution:** Already implemented - `if (this.destroyed) return;` check added at line 239.

---

### Validation Consistency Issues (2 items)

#### P2.4 Standardize Set Name Validation

**Status:** ✅ RESOLVED (January 30, 2026)  
**Priority:** P2 - Medium  
**Category:** Validation Inconsistency

**Resolution:** ApiLayersRename now uses SetNameSanitizer consistently.

---

#### P2.5 Add Slide Name Validation in ApiLayersSave

**Status:** ✅ RESOLVED (January 30, 2026)  
**Priority:** P2 - Medium  
**Category:** Input Validation

**Resolution:** Slidename is now sanitized via SetNameSanitizer before logging.

---

### Code Quality Issues (5 items)

#### P2.6 Refactor Promise Anti-Pattern in APIManager

**Status:** ✅ RESOLVED (January 31, 2026 - Verified as valid pattern)  
**Priority:** P2 - Medium  
**Category:** Anti-Pattern

**Resolution:** Pattern is legitimate - enables request tracking, abort support, value transformation, and pre/post-processing.

---

#### P2.7 Fix Aborted Request Error Handling

**Status:** ✅ RESOLVED (Already implemented)  
**Priority:** P2 - Medium  
**Category:** UX / Error Handling

**Resolution:** Both `loadRevision()` and `loadSetByName()` include abort detection before showing errors.

---

#### P2.8 Standardize Logger Usage in API Modules

**Status:** ✅ RESOLVED (January 31, 2026)  
**Priority:** P2 - Medium  
**Category:** Code Consistency

**Resolution:** Replaced LoggerFactory calls with `$this->getLogger()` in ApiLayersInfo.php.

---

#### P2.9 Standardize Database Return Types

**Status:** ✅ RESOLVED (January 31, 2026 - Verified as consistent)  
**Priority:** P2 - Medium  
**Category:** API Consistency

**Resolution:** Database methods follow MediaWiki standard patterns. `false` for not-found in `getLayerSet()`, `null` for not-found in `getLayerSetByName()`, `-1` for error in `countNamedSets()` all align with MediaWiki conventions. No changes needed.

---

#### P2.10 Refactor SQL NOT IN Pattern

**Status:** ✅ RESOLVED (January 31, 2026 - Accepted as safe pattern)  
**Priority:** P2 - Medium  
**Category:** Code Quality

**Resolution:** Current implementation is well-documented and safe (integer validation via `intval`, `makeList()` escaping). MediaWiki DB layer doesn't provide cleaner NOT IN method.

---

### Architecture Issues (1 item)

#### P2.11 Reduce God Class Count

**Status:** ✅ RESOLVED (Ongoing maintenance)  
**Priority:** P2 - Medium  
**Category:** Technical Debt

**Target:** Maintain at ≤18 (currently at 18: 2 generated, 14 JS, 2 PHP)

See [GOD_CLASS_REFACTORING_PLAN.md](docs/GOD_CLASS_REFACTORING_PLAN.md) for phased plan.

**Priority Extractions:**

| File | Lines | Strategy | Effort |
|------|-------|----------|--------|
| InlineTextEditor.js | 1,521 | Extract RichTextToolbar | 2-3 days |
| APIManager.js | 1,403 | Extract RetryManager | 2 days |
| ServerSideLayerValidator.php | 1,327 | Strategy pattern | 2-3 days |
| LayersDatabase.php | 1,355 | Repository split | 3-4 days |

**Near-Threshold Files to Monitor:**
- ToolbarStyleControls.js (998)
- TextBoxRenderer.js (996)
- ResizeCalculator.js (995)
- ShapeRenderer.js (994)
- PropertiesForm.js (994)
- TransformController.js (992)

---

### Documentation Issues (4 items)

#### P2.12 Synchronize Documentation Metrics

**Status:** ✅ RESOLVED (January 31, 2026)  
**Priority:** P2 - Medium  
**Category:** Documentation

**Resolution:** wiki/Architecture-Overview.md updated with correct metrics. copilot-instructions.md verified accurate.

---

#### P2.13 Fix WIKITEXT_USAGE.md Lock Parameter Docs

**Status:** ✅ RESOLVED (January 31, 2026 - Verified no issue)  
**Priority:** P2 - Medium  
**Category:** Documentation Accuracy

**Resolution:** WIKITEXT_USAGE.md does not contain `lock=view`. README.md example was fixed in v1.5.43 to use `noedit`.

---

#### P2.14 Fix README Branch Versions

**Status:** ✅ RESOLVED (January 31, 2026 - Verified no issue)  
**Priority:** P2 - Medium  
**Category:** Documentation

**Resolution:** README.md does not contain specific branch version numbers. It links to branches with general descriptions.

---

### Error Handling Issues (2 items)

#### P2.15 Fix StateManager Auto-Recovery Timing

**Status:** ✅ RESOLVED (Verified as correct behavior)  
**Priority:** P2 - Medium  
**Category:** State Management

**Original Concern:** 30s auto-recovery may interrupt legitimate slow operations.

**Resolution:** After code review, the concern is unfounded:
- `lockState()` is only called internally in `update()` and `atomic()` methods
- Both methods use try-finally blocks ensuring locks are always released
- All operations are synchronous (complete in milliseconds)
- No external code calls `lockState()` directly
- The 30s timeout is a reasonable safety net for extreme edge cases

**Files:** `resources/ext.layers.editor/StateManager.js`

**Estimated Effort:** N/A (no fix needed)

---

#### P2.16 Add DraftManager Quota Error Handling

**Status:** ✅ RESOLVED (Already implemented)  
**Priority:** P2 - Medium  
**Category:** Error Handling

**Resolution:** DraftManager already has try/catch for localStorage operations around line 152.

---

### Performance Issues (2 items → BOTH RESOLVED)

#### P2.17 Cache Service Lookups in PHP

**Status:** ✅ RESOLVED (January 31, 2026 - Verified not an issue)  
**Priority:** P2 - Medium  
**Category:** Performance

**Resolution:** `MediaWikiServices::getInstance()` is a singleton accessor (negligible cost). Most files use lazy initialization pattern. Found dead code: `WikitextHooks::getLayersDatabaseService()` is never called (LOW).

---

#### P2.18 Optimize buildImageNameLookup()

**Status:** ✅ RESOLVED (January 31, 2026 - Accepted as defensive pattern)  
**Priority:** P2 - Medium  
**Category:** Performance

**Resolution:** Pattern provides backwards compatibility for legacy data. Creates ~2 unique name variants (after deduplication). Performance cost is negligible.

---

## Phase 3 (P3): Long-Term — 🟢 10 ITEMS (4 RESOLVED)

### P3.9 Remove Unused ALLOWED_ENTITIES Constant ✅

**Status:** ✅ RESOLVED (January 31, 2026)  
**Resolution:** Removed unused constant from TextSanitizer.php

---

### P3.Dead Code: WikitextHooks.getLayersDatabaseService() ✅

**Status:** ✅ RESOLVED (January 31, 2026)  
**Resolution:** Removed dead method that was defined but never called.

---

### P3.13 Add getBoundingClientRect Guards ✅

**Status:** ✅ RESOLVED (January 31, 2026)  
**Resolution:** Added defensive guard in GeometryUtils.clientToCanvas() to return canvas center if rect has zero dimensions.

---

### P3.1 SchemaManager Constructor Injection

Inject logger via constructor instead of global service access.

### P3.2 Configurable Transaction Timeouts

Make 3 retries/5000ms timeout configurable for high-load environments.

### P3.3 Upgrade ls_layer_count to SMALLINT

Change from TINYINT (max 255) to SMALLINT for future-proofing.

### P3.4 Standardize @codeCoverageIgnore Usage ⏭️ LOW PRIORITY

**Analysis:** The `return; // @codeCoverageIgnore` statements after `dieWithError()` calls are unnecessary since `dieWithError()` has `@return never` (always throws). Best fix would be to remove them, but this is purely cosmetic. Deferred.

### P3.5 Remove Dead Boolean Normalization Path ⏭️ WON'T FIX

**Analysis:** Not actually dead code - it's backwards compatibility for legacy data. The empty string → true normalization is explicitly tested ("should convert empty string to boolean true (legacy data)") and documented in code. Removing it would break existing layer data that might contain empty strings for boolean fields. Keeping for stability.

### P3.6 Document CHECK Constraint Dependencies

Document that SQL constraints must be updated with PHP config.

### P3.7 Add Null Check in extractLayerSetData ✅ RESOLVED

Already implemented: Defensive null check exists at line 327 of APIManager.js.

### P3.8 Add Prefix Length Limit in listSlides() ✅ RESOLVED

**Status:** Resolved (January 31, 2026)  
**Implementation:** Added 200-character prefix length limit in `LayersDatabase::listSlides()` to prevent performance issues with very long prefixes. Added PHPUnit test for truncation behavior.

### P3.9 Remove Unused ALLOWED_ENTITIES Constant ✅ RESOLVED

See P3.9 entry above (resolved January 2026).

### P3.10 Standardize Class Resolution Pattern

Use single consistent pattern across all JS files.

### P3.11 Add Class Resolution Caching ✅ RESOLVED

**Status:** Resolved (January 31, 2026)  
**Implementation:** Added Map-based caching to `NamespaceHelper.js` `getClass()` function with composite cache key (`namespacePath|globalName`). Added `clearClassCache()` for test isolation. Added 6 new tests. Commit 93279109.

### P3.12 Improve DeepClone to Avoid JSON Fallback

Handle all cases without expensive JSON serialization. LOW PRIORITY: `structuredClone` is already used in modern browsers.

### P3.13 Add getBoundingClientRect Guards ✅ RESOLVED

See P3.13 entry above (resolved January 2026).

### P3.14 Anonymize User IDs in Logs

Consider hashing user identifiers to prevent correlation.

---

## Feature Backlog

### F1. Custom Fonts Support

**Status:** Not Started  
**Priority:** P3  

Allow fonts beyond $wgLayersDefaultFonts allowlist.

### F2. Enhanced Dimension Tool

**Status:** Proposed  
**Priority:** P3  

Make dimension line draggable independently from anchors.

### F3. Angle Dimension Tool

**Status:** Proposed  
**Priority:** P3  

New tool for measuring and annotating angles.

### F4. Visual Regression Testing

**Status:** Not Started  
**Priority:** P3  

Add jest-image-snapshot for canvas rendering tests.

### F5. TypeScript Migration for Core Modules

**Status:** Not Started  
**Priority:** P3  

Candidates: StateManager.js, APIManager.js, GroupManager.js

---

## Completed Items (January 2026)

### P0 Items Completed
| Item | Date |
|------|------|
| TailCalculator bug | Jan 30 |
| ApiLayersList.getLogger bug | Jan 30 |

### P1 Items Completed
| Item | Date |
|------|------|
| Race condition in saveLayerSet | Jan 31 |
| ApiLayersList permission check | Jan 31 |
| isComplexityAllowed() coverage | Jan 31 |
| ApiLayersList rate limiting | Jan 31 |
| paths array limit validation | Jan 31 |

### P2 Items Completed
| Item | Date |
|------|------|
| N+1 in getNamedSetsForImage() | Jan 30 |
| N+1 in listSlides() | Jan 30 |
| LIKE query escaping | Jan 30 |
| Exception handling (\Throwable) | Jan 30 |
| API code duplication (trait) | Jan 30 |
| refreshAllViewers concurrency | Jan 31 |
| Magic complexity threshold | Jan 31 |
| listSlides() SQL refactored | Jan 31 |

---

## Immediate Action Items

### This Week (Priority)
1. **Documentation sync:** Update wiki/Home.md branch versions — 10 min
2. **Documentation sync:** Update copilot-instructions.md line counts — 30 min

### This Month
1. **P3 backlog:** Extract RichTextToolbar from InlineTextEditor.js — 2-3 days
2. **P3 backlog:** Extract RetryManager from APIManager.js — 2 days

### This Quarter
1. **P3 backlog items** — as time permits
2. **F4:** Add visual regression tests — 2 sprints

---

## Metrics to Track

| Metric | Current | Target | Notes |
|--------|---------|--------|-------|
| Test count | 11,157 | Maintain | All passing |
| Statement coverage | 95.44% | ≥95% | Excellent |
| Branch coverage | 85.20% | ≥85% | Good |
| God classes | 18 | ≤15 | Extract 3 |
| Near-threshold | 9 | ≤4 | Monitor |
| P1 issues | **0** | 0 | ✅ All resolved |
| P2 issues | **0** | 0 | ✅ All resolved |
| P3 issues | 10 | Backlog | Low priority |

---

## Known Technical Debt

| Item | Impact | Effort | Priority |
|------|--------|--------|----------|
| 18 god classes | Medium | 2-3 weeks | P2 |
| Inconsistent DB return types | Low | 2 days | P3 |
| No visual regression | Medium | 2 sprints | P3 |
| No TypeScript | Low | Long-term | P3 |

---

*Last updated: February 1, 2026 (Comprehensive Critical Review v4)*
