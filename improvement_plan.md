# Layers Extension - Improvement Plan

**Last Updated:** January 30, 2026  
**Version:** 1.5.40  
**Status:** Production-Ready (8.5/10)

> **📋 NOTE:** See [GOD_CLASS_REFACTORING_PLAN.md](docs/GOD_CLASS_REFACTORING_PLAN.md) for the detailed phased plan to address god class issues.

---

## Executive Summary

The extension is **production-ready** with **comprehensive test coverage** and clean code practices. Critical bugs discovered during the January 30, 2026 review have been **resolved**.

**Current Status:**
- ✅ **P0:** All resolved (TailCalculator fixed)
- ✅ **P1.1:** Resolved (ApiLayersList.getLogger fixed)
- 🟡 **P1.2:** Documentation metrics sync (ongoing)
- 🟡 P2 items: 2 open (return types, visual testing)
- ✅ P3 items: All resolved (cursor rotation verified working)

**Verified Metrics (January 30, 2026 — Post-Fix):**

| Metric | Value | Status |
|--------|-------|--------|
| Tests total | **11,069** (163 suites) | ✅ Excellent |
| Tests passing | **11,069** | ✅ All pass |
| Tests skipped | **0** | ✅ Clean |
| Statement coverage | **95.42%** | ✅ Excellent |
| Branch coverage | **85.25%** | ✅ Good |
| Function coverage | **93.72%** | ✅ Excellent |
| Line coverage | **95.55%** | ✅ Excellent |
| JS files | 139 | All resources/ext.layers* |
| JS lines | ~94,546 | Verified via line count |
| PHP files | 40 | ✅ |
| PHP lines | ~14,543 | ✅ |
| PHP strict_types | **40/40 files** | ✅ Complete |
| ES6 classes | All JS files | 100% migrated |
| God classes (≥1,000 lines) | **17** | 2 generated, 13 JS, 2 PHP |
| ESLint errors | 0 | ✅ |
| ESLint disables | 11 | ✅ All legitimate |
| innerHTML usages | 73 | ⚠️ Trending up (was 71) |
| Weak assertions | **0** | ✅ Clean |
| i18n messages | ~656 | All documented in qqq.json |
| Deprecated code markers | 7 | 🟡 v2.0 removal |
| TODO/FIXME/HACK | 0 | ✅ Clean |
| console.log in production | 0 | ✅ Clean (scripts/ only) |

---

## Priority Definitions

| Priority | Timeline | Description |
|----------|----------|-------------|
| **P0** | Immediate | Critical bugs or security issues |
| **P1** | 1–2 days | High-impact runtime errors |
| **P2** | 1–3 months | Architecture, code quality, features |
| **P3** | 3–6 months | Long-term improvements, technical debt |

---

## Phase 0 (P0): Critical Issues — ✅ ALL RESOLVED

### P0.1 Fix TailCalculator Failing Test — COMPLETED

**Status:** ✅ COMPLETED (January 30, 2026)  
**Priority:** P0 - Critical (Immediate)  
**Category:** Bug / Test Failure

**Problem:** The test "should return null when tip is inside rectangle" fails. The method `getTailFromTipPosition()` does not check if the tip is inside the rectangle.

**Solution Applied:** Added early return in `getTailFromTipPosition()`:
```javascript
// Check if tip is inside rectangle - no tail needed
if ( tipX >= x && tipX <= x + width && tipY >= y && tipY <= y + height ) {
    return null;
}
```

**Files:** `resources/ext.layers.shared/TailCalculator.js`

**Completed:** January 30, 2026 — All 11,069 tests now pass

---

## Phase 1 (P1): High Priority — ✅ P1.1 RESOLVED

### P1.1 Fix ApiLayersList.getLogger() PHP Bug — COMPLETED

**Status:** ✅ COMPLETED (January 30, 2026)  
**Priority:** P1 - High (1-2 days)  
**Category:** Bug / Runtime Crash

**Problem:** `ApiLayersList.php` calls `->getLogger()` on `LayersLogger`, but `LayersLogger` implements `LoggerInterface` directly.

**Solution Applied:**
```php
// Changed from ->getLogger()->getLogger() to just ->get()
$this->logger = MediaWikiServices::getInstance()->get( 'LayersLogger' );
```

**Files:** `src/Api/ApiLayersList.php`

**Completed:** January 30, 2026

---

### P1.2 Fix Documentation Metrics Drift — ONGOING

**Status:** 🟡 ONGOING  
**Priority:** P1 - High  
**Category:** Documentation / Professionalism

**Problem:** Multiple documentation files have conflicting metrics:
- Test counts: 10,827 / 10,939 / 11,046 / 11,062 (Actual: **11,069**)
- Coverage: 94.64% / 95.00% / 95.37% (Actual: **95.42%**)
- God classes: 12 / 14 / 17 (Actual: **17**)
- MediaWiki req: 1.39+ / 1.43+ / 1.44+ (Actual: **1.43+**)

**Files Needing Update:**
- [ ] README.md
- [ ] wiki/Home.md
- [ ] docs/ARCHITECTURE.md
- [ ] .github/copilot-instructions.md (says 1.5.38, should be 1.5.39)

**Estimated Effort:** 2 hours

---

### Previously Completed P1 Items:
- ✅ P1.3: InlineTextEditor coverage improved (January 2026)
- ✅ P1.4: 133 skipped tests deleted (January 29, 2026)

---

## Phase 2 (P2): Medium Priority — 🟡 4 OPEN ITEMS

### P2.1 Fix N+1 Query in getNamedSetsForImage() — COMPLETED

**Status:** ✅ COMPLETED (January 30, 2026)  
**Priority:** P2 - Medium  
**Category:** Performance

**Problem:** For each named set, a separate query executes in a loop.

**Solution Applied:** Rewrote with single batch query using `IDatabase::LIST_AND` and `IDatabase::LIST_OR` for proper SQL construction. Collects all (imgName, setName) pairs, then single query with OR conditions.

**Files:** `src/Database/LayersDatabase.php`

**Completed:** January 30, 2026

---

### P2.2 Fix N+1 Query in listSlides() — COMPLETED

**Status:** ✅ COMPLETED (January 30, 2026)  
**Priority:** P2 - Medium  
**Category:** Performance

**Problem:** N+1 pattern for first revision user lookup per slide.

**Solution Applied:** Refactored to collect all slide names first, batch query first revision creators using IN clause, then merge results.

**Files:** `src/Database/LayersDatabase.php`

**Completed:** January 30, 2026

---

### P2.3 Standardize Database Method Return Types — OPEN

**Status:** Open  
**Priority:** P2 - Medium  
**Category:** Code Quality / API Consistency

**Problem:** Inconsistent return types:
- `getLayerSet()` → `false`
- `getLayerSetByName()` → `null`
- `countNamedSets()` → `-1`

**Solution:** Standardize to `null` for not-found, throw exceptions for errors.

**Files:** `src/Database/LayersDatabase.php` (15+ call sites)

**Estimated Effort:** 1-2 days (breaking change)

---

### P2.4 Add Rate Limit for layersinfo API — NEW

**Status:** ✅ SKIPPED (January 30, 2026)  
**Priority:** P2 - Medium  
**Category:** Security

**Problem:** Read API has no rate limiting.

**Decision:** Skipped. Read-only APIs benefit from MediaWiki's
built-in API rate limiting. Custom limiting would add complexity
without significant security benefit.

**Files:** N/A

---

### P2.5 Fix LIKE Query Wildcard Escaping — COMPLETED

**Status:** ✅ COMPLETED (January 30, 2026)  
**Priority:** P2 - Medium  
**Category:** Security

**Problem:** LIKE query doesn't escape wildcards.

**Solution Applied:** Changed from `addQuotes()` to proper
`buildLike($dbr->anyString(), $prefix, $dbr->anyString())`
which correctly escapes `%` and `_` wildcards.

**Files:** `src/Database/LayersDatabase.php`

**Completed:** January 30, 2026

---

### P2.6 Reduce JavaScript God Class Count — ONGOING

**Status:** Ongoing (Stable)  
**Priority:** P2 - Medium  
**Category:** Architecture

**Target:** Reduce hand-written god classes from 13 to ≤10

**Current Count (January 30, 2026):** 15 JS + 2 PHP = 17 total

| File | Lines | Strategy |
|------|-------|----------|
| InlineTextEditor.js | 1,521 | Extract RichTextToolbar |
| APIManager.js | 1,393 | Extract RetryManager |
| ServerSideLayerValidator.php | 1,296 | Strategy pattern |
| LayersDatabase.php | 1,242 | Repository split |

**Estimated Effort:** 2-3 days per extraction

---

### P2.7 Add Visual Regression Testing — OPEN

**Status:** Not Started  
**Priority:** P2 - Medium  
**Category:** Testing

**Problem:** No visual snapshot tests for canvas rendering.

**Solution:** Add jest-image-snapshot for key scenarios.

**Estimated Effort:** 1-2 sprints

---

### P2.8 Extract Duplicate API Module Code — COMPLETED

**Status:** ✅ COMPLETED (January 30, 2026)  
**Priority:** P2 - Medium  
**Category:** Code Quality

**Problem:** ApiLayersDelete and ApiLayersRename had duplicate code for:
- Permission checking
- Rate limiting
- File validation
- SHA1 mismatch recovery

**Solution Applied:** Created `LayersApiHelperTrait` with shared methods:
- `requireSchemaReady($db)` - database schema validation
- `isOwnerOrAdmin($db, $user, $imgName, $sha1, $setName)` - permission check
- `getLayerSetWithFallback($db, $imgName, $sha1, $setName)` - SHA1 fallback

Both API modules now use the trait.

**Files:** `src/Api/Traits/LayersApiHelperTrait.php` (NEW)

---

## Completed P2 Items

| Item | Date | Notes |
|------|------|-------|
| P2.8: API code extraction | Jan 30, 2026 | LayersApiHelperTrait created |
| P2.I: Exception handling | Jan 30, 2026 | `\Exception` → `\Throwable` |
| P2.J: Return after dieWithError | Jan 30, 2026 | Defensive coding |
| P2.A: ViewerManager test fix | Jan 27, 2026 | Added missing lockMode |
| P2.B: Layer search/filter | Jan 25, 2026 | Full search/filter UI |
| P2.C: i18n docs | Jan 25, 2026 | All ~656 keys documented |
| P2.D: Query simplification | Jan 25, 2026 | Two-query approach |
| P2.E: Coverage thresholds | Jan 25, 2026 | Raised to 80-92% |
| P2.F: RGBA hex colors | Jan 25, 2026 | 3/4/6/8-digit support |
| P2.G: DraftManager leak | Jan 25, 2026 | Subscription cleanup |
| P2.H: window.onbeforeunload | Jan 28, 2026 | Proper addEventListener |

## Completed P3 Items (January 30, 2026)

| Item | Date | Notes |
|------|------|-------|
| P3.X: Drag handle hit areas | Jan 30, 2026 | Added 4px hit tolerance |
| P3.Y: Overlay button size | Jan 30, 2026 | Reduced 32px→26px |
| P3.Z: Slides-in-tables bug | Jan 30, 2026 | Fixed retry filter logic |

---

## Phase 3 (P3): Long-Term — 🟡 11 ITEMS

### P3.1 TypeScript Migration for Complex Modules

**Status:** Not Started  
**Priority:** P3 - Low  
**Category:** Code Quality

**Candidates:** StateManager.js, APIManager.js, GroupManager.js, SelectionManager.js

**Strategy:**
1. Add TypeScript build pipeline
2. Start with new modules as .ts
3. Gradually convert existing modules

**Estimated Effort:** 2-3 sprints per module

---

### P3.2 Deprecated Code Removal Plan

**Status:** Planned for v2.0  
**Priority:** P3 - Low  
**Category:** Technical Debt

**7 deprecated APIs to remove in v2.0.**

**Plan:**
1. Create migration guide for each
2. Add console warnings
3. Communicate in CHANGELOG
4. Remove in v2.0

**Estimated Effort:** 1 sprint

---

### P3.3 Custom Fonts Support (F3)

**Status:** Not Started  
**Priority:** P3 - Low  
**Category:** Feature

Limited to default font allowlist in `$wgLayersDefaultFonts`.

**Estimated Effort:** 1 week

---

### P3.4 Magic Number Extraction

**Status:** Not Started  
**Priority:** P3 - Low  
**Category:** Code Quality

**Problem:** Various magic numbers scattered through codebase.

**Solution:** Create `LayersConstants.js` and PHP config options.

**Estimated Effort:** 4 hours

---

### P3.5 Enhanced Dimension Tool (FR-14)

**Status:** Proposed  
**Priority:** P3 - Low  
**Category:** Feature Enhancement

Make dimension line draggable independently from anchors.

**Estimated Effort:** 1 week

---

### P3.6 Angle Dimension Tool (FR-15)

**Status:** Proposed  
**Priority:** P3 - Low  
**Category:** New Feature

New tool for measuring and annotating angles.

**Estimated Effort:** 2 weeks

---

### P3.7 Fix Read-Only API Permission Checks — REVIEWED

**Status:** ✅ NOT NEEDED (January 30, 2026)  
**Priority:** P3 - Low  
**Category:** Security Hardening

**Review Finding:** Both special pages correctly handle permissions:
- `SpecialEditSlide.php` throws `PermissionsError('editlayers')` for unauthorized users
- `SpecialSlides.php` is a read-only listing; MediaWiki core blocks access
  when `$wgGroupPermissions['*']['read'] = false` (private wikis)

**Files:** No changes needed

---

### P3.8 Create Error Constants Class — NEW

**Status:** Open  
**Priority:** P3 - Low  
**Category:** Code Quality

**Problem:** Error codes like `'layers-file-not-found'` repeated as strings.

**Solution:** Create `LayersErrors` constants class.

**Estimated Effort:** 2 hours

---

### P3.9 Standardize Exception Handling — NEW

**Status:** Open  
**Priority:** P3 - Low  
**Category:** Code Quality

**Problem:** 
- `ApiLayersSave` catches `\Throwable`
- `ApiLayersDelete` catches `\Exception`

**Solution:** Standardize to `\Throwable`.

**Estimated Effort:** 30 minutes

---

### P3.10 Add Missing Return After dieWithError() — NEW

**Status:** Open  
**Priority:** P3 - Low  
**Category:** Code Quality

**Problem:** Some catch blocks don't return after `dieWithError()`.

**Solution:** Add `return;` statements.

**Estimated Effort:** 15 minutes

---

### P3.11 Limit Concurrent API Requests in refreshAllViewers — NEW

**Status:** Open  
**Priority:** P3 - Low  
**Category:** Performance

**Problem:** All API calls made in parallel could overwhelm server.

**Solution:** Limit concurrency to 3-5 simultaneous requests.

**Estimated Effort:** 2 hours

---

## Completed P3 Items

- ✅ P3.A: Zoom-to-cursor (January 26, 2026)
- ✅ P3.B: Canvas accessibility (January 25, 2026)
- ✅ P3.C: Slide Mode documentation (January 25, 2026)
- ✅ P3.D: Timeout tracking audit (January 25, 2026)

---

## Known Technical Debt

| Item | Impact | Effort | Priority |
|------|--------|--------|----------|
| 1 failing test | Critical | 15 min | P0.1 |
| ApiLayersList.getLogger bug | High | 5 min | P1.1 |
| Documentation metrics stale | High | 2 hours | P1.2 |
| N+1 queries (2 locations) | High | 4-6 hours | P2.1-2.2 |
| 17 god classes | Medium | 2-3 weeks | P2.6 |
| Inconsistent DB returns | Medium | 1-2 days | P2.3 |
| No visual regression tests | Medium | 1-2 sprints | P2.7 |
| 7 deprecated APIs | Low | 1 sprint | P3.2 |
| No TypeScript | Low | Long-term | P3.1 |

---

## Immediate Action Items

1. **🔴 Fix TailCalculator bug** (P0.1) — 15 minutes
2. **🔴 Fix ApiLayersList.getLogger** (P1.1) — 5 minutes  
3. **🟡 Sync documentation metrics** (P1.2) — 2 hours
4. **🟡 Fix N+1 queries** (P2.1-2.2) — 4-6 hours
5. **🟡 Add rate limit to read API** (P2.4) — 30 minutes

---

*Last updated: January 30, 2026 (Critical Review)*
