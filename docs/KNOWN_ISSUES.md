# Known Issues

**Last Updated:** January 31, 2026 (Comprehensive Critical Review v3)  
**Version:** 1.5.44

This document lists known issues and current gaps for the Layers extension.

---

## Status Summary

| Category | Count | Status |
|----------|-------|--------|
| P0 (Critical Bugs) | **0** | ✅ All resolved |
| P1 (High Priority) | **1** | 🔴 1 open (validation gap) |
| P2 (Medium Priority) | **3** | 🟡 3 open (animation, race condition, docs) |
| P3 (Low Priority) | **14** | 🟢 14 open |
| Feature Gaps | 3 | Planned |

---

## 🔴 P1: High Priority Issues (1 Open)

### P1.3 Missing Enum Validation for Constrained String Properties 🆕

**Status:** 🔴 OPEN  
**Severity:** P1 (High)  
**Component:** ServerSideLayerValidator / Security

**Issue:** The `VALUE_CONSTRAINTS` constant defines allowed values for 15 enum-like string properties, but `validateStringProperty()` only validates 9 of them. These 8 properties are NOT validated:
- `tailDirection` (callout tail direction)
- `tailStyle` (callout tail style)
- `style` (marker style)
- `endStyle` (dimension end style)
- `textPosition` (dimension text position)
- `orientation` (dimension orientation)
- `textDirection` (dimension text direction)
- `toleranceType` (dimension tolerance)

**Impact:** Arbitrary strings can be stored for these properties, potentially causing rendering issues or unexpected behavior.

**Files:** `src/Validation/ServerSideLayerValidator.php` lines 506-513

**Fix:** Add the 8 missing properties to the `in_array()` check in `validateStringProperty()`.

**Estimated Effort:** 30 minutes

---

## ✅ P1: Previously Resolved Issues

All critical bugs identified in previous reviews have been resolved.
All **11,112** tests pass as of January 31, 2026.

---

## ✅ P1: Previously Resolved High Priority Issues

All high priority issues from previous reviews have been resolved:

| Issue | Resolution Date |
|-------|-----------------|
| Race condition in saveLayerSet | January 31, 2026 |
| Missing permission check in ApiLayersList | January 31, 2026 |
| Documentation metrics drift | January 30, 2026 |
| MediaWiki version inconsistency | January 30, 2026 |

---

## 🟡 P2: Medium Priority Issues (3 Open, 15 Resolved)

### P2.19 ZoomPanController Animation Frame Not Canceled 🆕

**Status:** 🟡 OPEN  
**Severity:** P2 (Medium)  
**Component:** ZoomPanController / Animation

**Issue:** `smoothZoomTo()` starts a new animation via `requestAnimationFrame` without canceling any existing animation. Rapid zoom operations can cause multiple animation loops running simultaneously, causing jittery zoom behavior.

**Files:** `resources/ext.layers.editor/canvas/ZoomPanController.js` line 155

**Fix:** Add `cancelAnimationFrame(this.animationFrameId)` before starting new animation.

**Estimated Effort:** 15 minutes

---

### P2.20 TransformController Stale Layer Reference in rAF 🆕

**Status:** 🟡 OPEN  
**Severity:** P2 (Medium)  
**Component:** TransformController / Race Condition

**Issue:** `_pendingResizeLayer` may become stale if the layer is deleted between scheduling the rAF and execution. The callback emits events with potentially invalid layer references.

**Files:** `resources/ext.layers.editor/canvas/TransformController.js`

**Fix:** Validate layer still exists in layers array before emitting in the rAF callback.

**Estimated Effort:** 30 minutes

---

### P2.21 Version Inconsistency in Mediawiki-Extension-Layers.mediawiki 🆕

**Status:** 🟡 OPEN  
**Severity:** P2 (Medium)  
**Component:** Documentation

**Issue:** Version info box at top shows 1.5.44, but the branch version table shows 1.5.43.

**Files:** `Mediawiki-Extension-Layers.mediawiki` line 122

**Fix:** Update branch table to show 1.5.44 versions.

**Estimated Effort:** 5 minutes

---

### P2.1 Untracked Timeouts in SlideController ✅ RESOLVED

**Status:** ✅ RESOLVED (January 31, 2026)  
**Resolution:** Already implemented - `_retryTimeouts` array tracks IDs, `destroy()` clears all.

---

### P2.2 Untracked Event Listeners in ToolDropdown ✅ RESOLVED

**Status:** ✅ RESOLVED (v1.5.44)  
**Resolution:** Added `boundHandleTriggerClick` and `_menuItemHandlers` Map.

---

### P2.3 VirtualLayerList rAF Callback Missing Destroyed Check ✅ RESOLVED

**Status:** ✅ RESOLVED (January 31, 2026)  
**Resolution:** `if (this.destroyed) return;` check added at line 239.

---

### P2.4 Inconsistent Set Name Validation Standards ✅ RESOLVED

**Status:** ✅ RESOLVED (January 31, 2026)  
**Resolution:** ApiLayersRename now uses SetNameSanitizer consistently.

---

### P2.5 Slide Name Not Validated in ApiLayersSave ✅ RESOLVED

**Status:** ✅ RESOLVED (January 31, 2026)  
**Resolution:** SlideNameValidator now validates slidename before processing.

---

### P2.6 Promise Constructor Anti-Pattern in APIManager ✅ RESOLVED

**Status:** ✅ RESOLVED (Verified as valid pattern)  
**Resolution:** Pattern is legitimate - enables request tracking, abort support.

---

### P2.7 Aborted Request Handling Shows Spurious Errors ✅ RESOLVED

**Status:** ✅ RESOLVED (Already implemented)  
**Resolution:** Both `loadRevision()` and `loadSetByName()` include abort detection.

---

### P2.8 Inconsistent Logger Usage in API Modules ✅ RESOLVED

**Status:** ✅ RESOLVED (v1.5.44)  
**Resolution:** Replaced `LoggerFactory::getInstance()` with `$this->getLogger()`.

---

### P2.9 Inconsistent Database Method Return Types

**Fix:** Store handler references and remove them in destroy(), or use EventTracker.

**Estimated Effort:** 1 hour

---

### P2.3 VirtualLayerList rAF Callback Missing Destroyed Check

**Status:** 🟡 OPEN  
**Severity:** P2 (Medium)  
**Component:** VirtualLayerList / Race Condition

**Issue:** If destroy() is called after _scheduleRender() is scheduled but 
before the requestAnimationFrame callback fires, _performRender() will 
execute on a destroyed instance, potentially causing errors.

**Files:** `resources/ext.layers.editor/ui/VirtualLayerList.js` lines 280-287

**Fix:** Add `if (this.destroyed) return;` at the start of the rAF callback.

**Estimated Effort:** 15 minutes

---

### P2.4 Inconsistent Set Name Validation Standards

**Status:** 🟡 OPEN  
**Severity:** P2 (Medium)  
**Component:** Validation

**Issue:** Two different validation standards exist for set names:
- `ApiLayersRename.isValidSetName()` — Only allows `[a-zA-Z0-9_-]`, max 50 chars
- `SetNameSanitizer::isValid()` — Allows Unicode `\p{L}\p{N}_\-\s`, max 255 chars

**Files:** `src/Api/ApiLayersRename.php`, `src/Validation/SetNameSanitizer.php`

**Fix:** Use SetNameSanitizer consistently across all modules.

**Estimated Effort:** 2 hours

---

### P2.5 Slide Name Not Validated in ApiLayersSave

**Status:** 🟡 OPEN  
**Severity:** P2 (Medium)  
**Component:** ApiLayersSave / Input Validation

**Issue:** The `$slidename` parameter is passed directly to logging without
sanitization, potentially allowing log injection with newlines or control chars.

**Files:** `src/Api/ApiLayersSave.php`

**Fix:** Use SetNameSanitizer::sanitize() on slidename before logging.

**Estimated Effort:** 30 minutes

---

### P2.6 Promise Constructor Anti-Pattern in APIManager

**Status:** 🟡 OPEN  
**Severity:** P2 (Medium)  
**Component:** APIManager / Code Quality

**Issue:** Several methods wrap mw.Api promises unnecessarily in new Promise()
constructors. mw.Api already returns a thenable, so wrapping is redundant
and loses jQuery Deferred features.

**Files:** `resources/ext.layers.editor/APIManager.js`

**Fix:** Return the mw.Api promise directly without wrapping.

**Estimated Effort:** 3 hours

---

### P2.7 Aborted Request Handling Shows Spurious Errors

**Status:** 🟡 OPEN  
**Severity:** P2 (Medium)  
**Component:** APIManager / Error Handling

**Issue:** When a request is aborted via _trackRequest(), the catch handler
still runs and may show error notifications for intentionally aborted requests.

**Files:** `resources/ext.layers.editor/APIManager.js` lines 62-78

**Fix:** Check for abort status before showing error notifications:
```javascript
if ( code === 'http' && result && result.textStatus === 'abort' ) {
    return; // Intentionally aborted
}
```

**Estimated Effort:** 1 hour

---

### P2.8 Inconsistent Logger Usage in API Modules

**Status:** 🟡 OPEN  
**Severity:** P2 (Medium)  
**Component:** API Modules / Code Quality

**Issue:** Some API files use the injected LayersLogger service via 
`$this->getLogger()`, while others call LoggerFactory directly.

**Files:** Multiple API modules, e.g., `src/Api/ApiLayersInfo.php` line 424

**Fix:** Use `$this->getLogger()` pattern consistently in all API modules.

**Estimated Effort:** 1 hour

---

### P2.9 Inconsistent Database Method Return Types

**Status:** 🟡 OPEN  
**Severity:** P2 (Medium)  
**Component:** LayersDatabase / API Consistency

**Issue:** Different methods return different types on error:
- `getLayerSet()` → `false`
- `getLayerSetByName()` → `null`
- `countNamedSets()` → `-1`

**Files:** `src/Database/LayersDatabase.php`

**Fix:** Standardize to `null` for not-found, throw exceptions for errors.

**Estimated Effort:** 2 days (breaking change)

---

### P2.10 God Classes (18 Files Over 1,000 Lines)

**Status:** 🟡 OPEN (Ongoing)  
**Severity:** P2 (Medium)  
**Component:** Architecture / Technical Debt

**Issue:** 18 files exceed 1,000 lines (2 generated, 14 JS, 2 PHP). While
all use proper delegation patterns, some could be further extracted.

**Priority Extractions:**
| File | Lines | Strategy |
|------|-------|----------|
| InlineTextEditor.js | 1,521 | Extract RichTextToolbar |
| APIManager.js | 1,403 | Extract RetryManager |
| ServerSideLayerValidator.php | 1,327 | Strategy pattern |
| LayersDatabase.php | 1,355 | Repository split |

**Near-Threshold Files (900-999 lines) to Monitor:**
- ToolbarStyleControls.js (998)
- TextBoxRenderer.js (996)
- ResizeCalculator.js (995)
- ShapeRenderer.js (994)
- PropertiesForm.js (994)
- TransformController.js (992)

**Estimated Effort:** 2-3 days per extraction

---

### P2.11 Documentation Metrics Inconsistencies

**Status:** 🟡 OPEN  
**Severity:** P2 (Medium)  
**Component:** Documentation

**Issue:** Multiple documentation files have outdated metrics:

| Document | Issue |
|----------|-------|
| wiki/Home.md | Version says 1.5.41 (should be 1.5.43) |
| wiki/Home.md | God class count says 20 (should be 18) |
| wiki/Architecture.md | Coverage 92.59% (should be 95.42%) |
| wiki/Architecture.md | Test count 9,967+ (should be 11,112) |
| wiki/Architecture.md | JS files 139 (should be 141) |
| wiki/Changelog.md | Missing v1.5.43 section |
| CONTRIBUTING.md | God class count says 20 (should be 18) |
| copilot-instructions.md | PHP count says 41 (should be 42) |
| DEVELOPER_ONBOARDING.md | Outdated line counts |

**Estimated Effort:** 2-3 hours

---

### P2.12 buildImageNameLookup() Creates Redundant Variants

**Status:** 🟡 OPEN  
**Severity:** P2 (Medium)  
**Component:** LayersDatabase / Performance

**Issue:** Creates an array of image name variants for every database query
when MediaWiki normalizes file names consistently.

**Files:** `src/Database/LayersDatabase.php`

**Fix:** After migration period, use normalized name alone.

**Estimated Effort:** 2 hours

---

### P2.13 WIKITEXT_USAGE.md Documents Unimplemented Feature

**Status:** ✅ RESOLVED (January 31, 2026)  
**Severity:** P2 (Medium)  
**Component:** Documentation

**Issue:** Originally claimed `lock=view` syntax was documented in WIKITEXT_USAGE.md.

**Verification:** WIKITEXT_USAGE.md does not contain any `lock` references. The README.md `lock=view` example was fixed in v1.5.43 to use `noedit` parameter. No action required.

---

### P2.14 StateManager 30s Auto-Recovery May Interrupt Operations

**Status:** ✅ RESOLVED (Verified as correct behavior)  
**Severity:** P2 (Medium)  
**Component:** StateManager / State Management

**Original Issue:** The 30-second auto-recovery forces unlock regardless of
whether a legitimate slow operation is in progress.

**Resolution:** After code review, the concern is unfounded:
- `lockState()` is only called internally in `update()` and `atomic()` methods
- Both methods use try-finally blocks ensuring locks are always released
- All operations are synchronous (complete in milliseconds)
- No external code calls `lockState()` directly
- The 30s timeout is a reasonable safety net for extreme edge cases

**Files:** `resources/ext.layers.editor/StateManager.js` lines 305-315

---

### P2.15 SQL NOT IN Pattern Uses Unconventional Syntax

**Status:** 🟡 OPEN  
**Severity:** P2 (Medium)  
**Component:** LayersDatabase / Code Quality

**Issue:** Uses raw string concatenation in condition array for NOT IN clause:
```php
'ls_id NOT IN (' . $dbw->makeList( $safeKeepIds ) . ')'
```

While safe (integers validated), this is unconventional for MediaWiki DB layer.

**Files:** `src/Database/LayersDatabase.php` lines 662-672

**Fix:** Consider two-query approach or IDatabase::makeWhereFrom2d().

**Estimated Effort:** 1 hour

---

### P2.16 DraftManager Missing QuotaExceededError Handling

**Status:** 🟡 OPEN  
**Severity:** P2 (Medium)  
**Component:** DraftManager / Error Handling

**Issue:** saveDraft() calls localStorage.setItem without try/catch for
QuotaExceededError when storage is full.

**Files:** `resources/ext.layers.editor/DraftManager.js`

**Fix:** Wrap setItem in try/catch and handle quota exceeded gracefully.

**Estimated Effort:** 30 minutes

---

### P2.17 Repeated Service Lookups in PHP

**Status:** 🟡 OPEN  
**Severity:** P2 (Medium)  
**Component:** PHP / Performance

**Issue:** MediaWikiServices::getInstance()->get() called repeatedly instead
of caching service references.

**Files:** Multiple PHP files

**Fix:** Cache service references in class properties or use constructor injection.

**Estimated Effort:** 2 hours

---

### P2.18 README Branch Versions Outdated

**Status:** 🟡 OPEN  
**Severity:** P2 (Medium)  
**Component:** Documentation

**Issue:** README shows outdated branch versions:
- REL1_43: shows 1.5.26-REL1_43 (actual: 1.5.40-REL1_43)
- REL1_39: shows 1.1.14 (actual: 1.5.40-REL1_39)

**Files:** `README.md`

**Fix:** Update branch version numbers.

**Estimated Effort:** 10 minutes

---

## 🟢 P3: Low Priority Issues (14 Open)

### P3.1 SchemaManager Global Service Access

**Issue:** Uses `MediaWikiServices::getInstance()` in constructor, 
making unit testing harder.

**Fix:** Inject logger via constructor.

---

### P3.2 Hardcoded Transaction Timeout Values

**Issue:** 3 retries, 5000ms timeout hardcoded in LayersDatabase.

**Status:** Acceptable defaults but could be configurable.

---

### P3.3 TINYINT for ls_layer_count Column

**Issue:** Max 255; should be smallint for future-proofing.

**Fix:** Add schema patch to change to smallint.

---

### P3.4 Inconsistent @codeCoverageIgnore Usage

**Issue:** Some unreachable returns annotated, others not.

**Fix:** Standardize usage across all API modules.

---

### P3.5 Empty String Boolean Normalization

**Issue:** Client normalizes `''` → `true` (legacy path, dead code).

**Fix:** Remove dead code path (low priority).

---

### P3.6 CHECK Constraints Hardcoded in SQL

**Issue:** SQL CHECK constraints don't match PHP config values.

**Fix:** Document dependency or remove CHECK constraints.

---

### P3.7 Missing null Check in extractLayerSetData

**Issue:** Potential null access in edge cases.

**Fix:** Add try/catch or optional chaining.

---

### P3.8 $prefix in listSlides() Not Length-Limited

**Issue:** Very long prefix could cause performance issues.

**Fix:** Add `substr($prefix, 0, 255)`.

---

### P3.9 Unused ALLOWED_ENTITIES Constant

**Issue:** TextSanitizer defines ALLOWED_ENTITIES but never uses it.

**Fix:** Remove unused constant.

---

### P3.10 Inconsistent Class Resolution Patterns

**Issue:** Some files use `window.layersGetClass`, others use 
`window.Layers.Utils.getClass`.

**Fix:** Standardize to single pattern.

---

### P3.11 Inefficient Class Resolution in LayersNamespace

**Issue:** `findClass()` traverses namespace path repeatedly without caching.

**Fix:** Add cache for resolved classes.

---

### P3.12 JSON Fallback for Layer Cloning

**Issue:** Fallback to JSON.parse/stringify is expensive for large base64 images.

**Fix:** Improve DeepClone to handle all cases without JSON fallback.

---

### P3.13 getBoundingClientRect Unchecked

**Issue:** Canvas getBoundingClientRect could return zero dimensions if not in DOM.

**Fix:** Add guard checks before scale calculations.

---

### P3.14 Information Disclosure in Error Logging

**Issue:** User IDs + filenames logged together could enable correlation.

**Fix:** Consider hashing user identifiers in logs.

---

## ⏳ Feature Gaps

### F1. Custom Fonts (F3)

**Status:** ⏳ NOT STARTED

Not yet available beyond the default font allowlist in `$wgLayersDefaultFonts`.

---

### F2. Enhanced Dimension Tool (FR-14)

**Status:** ⏳ PROPOSED

Make the dimension line draggable independently from the anchor points.

---

### F3. Angle Dimension Tool (FR-15)

**Status:** ⏳ PROPOSED

New tool for measuring and annotating angles.

---

## ✅ Recently Resolved Issues (January 2026)

| Issue | Date | Notes |
|-------|------|-------|
| Race condition in saveLayerSet | Jan 31 | FOR UPDATE inside transaction |
| ApiLayersList permission check | Jan 31 | read + rate limiting added |
| isComplexityAllowed() coverage | Jan 31 | All 15 layer types |
| listSlides() SQL refactored | Jan 31 | Batch queries |
| ApiLayersList rate limiting | Jan 31 | pingLimiter added |
| paths array limit validation | Jan 31 | Max 100 paths |
| TailCalculator test failing | Jan 30 | Bounds check added |
| N+1 query patterns | Jan 30 | Batch refactoring |
| LIKE query escaping | Jan 30 | buildLike() used |
| API code duplication | Jan 30 | LayersApiHelperTrait |
| refreshAllViewers parallelism | Jan 31 | Limited to 5 |
| Magic complexity threshold | Jan 31 | Configurable |

---

## Test Coverage Status (January 31, 2026)

| Metric | Value | Status |
|--------|-------|---------|
| Tests total | **11,112** (163 suites) | ✅ |
| Tests passing | **11,112** | ✅ All pass |
| Tests failing | **0** | ✅ |
| Statement coverage | **95.42%** | ✅ Excellent |
| Branch coverage | **85.25%** | ✅ Good |
| Function coverage | **93.72%** | ✅ Excellent |
| Line coverage | **95.55%** | ✅ Excellent |

---

## Code Quality Metrics (Verified January 31, 2026)

| Metric | Value | Status |
|--------|-------|--------|
| JavaScript files | **141** (139 source + 2 dist) | ✅ |
| PHP files | **42** | ✅ |
| God classes (≥1,000 lines) | **18** | 2 generated, 14 JS, 2 PHP |
| Near-threshold files (900-999) | 6 | ⚠️ Watch |
| innerHTML usages | 73 | Safe patterns |
| ESLint disables | 11 | All legitimate |
| i18n messages | **667** | All documented |
| TODO/FIXME/HACK | 0 | ✅ Clean |
| console.log in production | 0 | ✅ Clean |

---

## Browser Compatibility

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 120+ | ✅ Fully supported |
| Firefox | 120+ | ✅ Fully supported |
| Safari | 17+ | ✅ Fully supported |
| Edge | 120+ | ✅ Fully supported |

---

## Performance Recommendations

| Resource | Recommended | Maximum |
|----------|-------------|---------|
| Image size | < 2048px | 4096px |
| Layer count | < 50 | 100 |
| Layer set size | < 1MB | 2MB |
| Imported image size | < 500KB | 1MB |

---

## Reporting Issues

If you encounter issues:

1. Check this document first
2. Search existing [GitHub issues](https://github.com/slickdexic/Layers/issues)
3. Create a new issue with:
   - Steps to reproduce
   - Expected vs actual behavior
   - Browser and MediaWiki version
   - Console errors (F12 → Console tab)
   - Screenshots if applicable

---

*Document updated: January 31, 2026 (Comprehensive Critical Review v3)*  
*Status: ✅ All tests passing. No P0 bugs. 1 HIGH priority issue (validation gap).*
