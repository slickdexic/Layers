# Layers Extension - Improvement Plan

**Last Updated:** January 31, 2026 (Comprehensive Critical Review v2)  
**Version:** 1.5.44  
**Status:** Production-Ready (8.5/10)

> **📋 NOTE:** See [GOD_CLASS_REFACTORING_PLAN.md](docs/GOD_CLASS_REFACTORING_PLAN.md) for the detailed phased plan to address god class issues.

---

## Executive Summary

The extension is **production-ready** with **comprehensive test coverage** and clean code practices. All **11,112** tests pass. This improvement plan prioritizes issues identified in the January 31, 2026 comprehensive critical review v2.

**Current Status:**
- ✅ **P0:** All resolved (no critical bugs)
- ✅ **P1:** All resolved (high-priority issues fixed)
- 🟡 **P2:** 2 open (medium-priority improvements)
- 🟢 **P3:** 14 open (low-priority backlog)

**Verified Metrics (January 31, 2026):**

| Metric | Value | Status |
|--------|-------|--------|
| Tests total | **11,112** (163 suites) | ✅ Excellent |
| Tests passing | **11,112** | ✅ All pass |
| Tests skipped | **0** | ✅ Clean |
| Statement coverage | **95.42%** | ✅ Excellent |
| Branch coverage | **85.25%** | ✅ Good |
| Function coverage | **93.72%** | ✅ Excellent |
| Line coverage | **95.55%** | ✅ Excellent |
| JS files | **141** (139 source + 2 dist) | ✅ |
| PHP files | **42** | ✅ |
| PHP strict_types | **42/42 files** | ✅ Complete |
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

---

## Phase 1 (P1): High Priority — ✅ ALL RESOLVED

All high-priority issues from previous reviews have been addressed:

| Issue | Resolution Date |
|-------|-----------------|
| Race condition in saveLayerSet | January 31, 2026 |
| Missing permission check in ApiLayersList | January 31, 2026 |
| isComplexityAllowed() layer type coverage | January 31, 2026 |
| Rate limiting on ApiLayersList | January 31, 2026 |
| paths array limit validation | January 31, 2026 |

---

## Phase 2 (P2): Medium Priority — 🟡 2 OPEN ITEMS (16 RESOLVED)

### Memory Management Issues (3 items)

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

**Status:** 🟡 OPEN  
**Priority:** P2 - Medium  
**Category:** API Consistency

**Problem:** Methods return false, null, or -1 inconsistently on errors.

**Solution:** Standardize to null for not-found, exceptions for errors.

**Files:** `src/Database/LayersDatabase.php`

**Estimated Effort:** 2 days (breaking change)

---

#### P2.10 Refactor SQL NOT IN Pattern

**Status:** ✅ RESOLVED (January 31, 2026 - Accepted as safe pattern)  
**Priority:** P2 - Medium  
**Category:** Code Quality

**Resolution:** Current implementation is well-documented and safe (integer validation via `intval`, `makeList()` escaping). MediaWiki DB layer doesn't provide cleaner NOT IN method.

---

### Architecture Issues (1 item)

#### P2.11 Reduce God Class Count

**Status:** 🟡 OPEN (Ongoing)  
**Priority:** P2 - Medium  
**Category:** Technical Debt

**Target:** Reduce from 18 to ≤15

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

## Phase 3 (P3): Long-Term — 🟢 14 ITEMS

### P3.1 SchemaManager Constructor Injection

Inject logger via constructor instead of global service access.

### P3.2 Configurable Transaction Timeouts

Make 3 retries/5000ms timeout configurable for high-load environments.

### P3.3 Upgrade ls_layer_count to SMALLINT

Change from TINYINT (max 255) to SMALLINT for future-proofing.

### P3.4 Standardize @codeCoverageIgnore Usage

Apply consistently across all API modules.

### P3.5 Remove Dead Boolean Normalization Path

Remove legacy empty string → true normalization (dead code).

### P3.6 Document CHECK Constraint Dependencies

Document that SQL constraints must be updated with PHP config.

### P3.7 Add Null Check in extractLayerSetData

Add try/catch or optional chaining for edge cases.

### P3.8 Add Prefix Length Limit in listSlides()

Prevent performance issues with very long prefixes.

### P3.9 Remove Unused ALLOWED_ENTITIES Constant

Clean up TextSanitizer unused constant.

### P3.10 Standardize Class Resolution Pattern

Use single consistent pattern across all JS files.

### P3.11 Add Class Resolution Caching

Cache resolved classes in LayersNamespace.findClass().

### P3.12 Improve DeepClone to Avoid JSON Fallback

Handle all cases without expensive JSON serialization.

### P3.13 Add getBoundingClientRect Guards

Check for zero dimensions before scale calculations.

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

### This Week
1. **P2.1:** Fix SlideController timeouts — 1 hour
2. **P2.2:** Fix ToolDropdown listeners — 1 hour
3. **P2.3:** Fix VirtualLayerList rAF — 15 min
4. **P2.12:** Sync documentation metrics — 2 hours
5. **P2.13:** Fix WIKITEXT_USAGE.md — 15 min
6. **P2.14:** Fix README versions — 10 min

### This Month
1. **P2.4:** Standardize set name validation — 2 hours
2. **P2.5:** Add slidename validation — 30 min
3. **P2.7:** Fix aborted request handling — 1 hour
4. **P2.8:** Standardize logger usage — 1 hour
5. **P2.9:** Standardize DB return types — 2 days
6. **P2.15:** Fix StateManager timing — 2 hours
7. **P2.16:** Add quota error handling — 30 min

### This Quarter
1. **P2.6:** Refactor promise patterns — 3 hours
2. **P2.10:** Refactor SQL NOT IN — 1 hour
3. **P2.11:** Extract 2 god class modules — 1 week
4. **P2.17-18:** Performance optimizations — 4 hours
5. **F4:** Add visual regression tests — 2 sprints

---

## Metrics to Track

| Metric | Current | Target | Notes |
|--------|---------|--------|-------|
| Test count | 11,112 | Maintain | All passing |
| Statement coverage | 95.42% | ≥95% | Excellent |
| Branch coverage | 85.25% | ≥85% | Good |
| God classes | 18 | ≤15 | Extract 3 |
| Near-threshold | 6 | ≤4 | Monitor |
| P2 issues | 18 | ≤10 | Focus area |
| P3 issues | 14 | Backlog | Low priority |

---

## Known Technical Debt

| Item | Impact | Effort | Priority |
|------|--------|--------|----------|
| Memory leak risks (P2.1-2.3) | Medium | 3h | P2 |
| Validation inconsistency (P2.4-5) | Medium | 2.5h | P2 |
| Promise anti-patterns (P2.6-7) | Low | 4h | P2 |
| Code consistency (P2.8-10) | Low | 4h | P2 |
| 18 god classes | Medium | 2-3 weeks | P2 |
| Documentation drift (P2.12-14) | Low | 3h | P2 |
| Error handling (P2.15-16) | Medium | 2.5h | P2 |
| Performance (P2.17-18) | Low | 4h | P2 |
| No visual regression | Medium | 2 sprints | P3 |
| No TypeScript | Low | Long-term | P3 |

---

*Last updated: January 31, 2026 (Comprehensive Critical Review v2)*
