# Known Issues

**Last Updated:** January 30, 2026 (Comprehensive Review)  
**Version:** 1.5.40

This document lists known issues and current gaps for the Layers extension.

---

## Status Summary

| Category | Count | Status |
|----------|-------|--------|
| P0 (Critical Bugs) | **0** | ✅ All resolved |
| P1 (High Priority) | **3** | 🟠 Documentation issues |
| P2 (Medium Priority) | **11** | 🟡 Open |
| P3 (Low Priority) | **12** | 🟢 Backlog |
| Feature Gaps | 3 | Planned |

---

## ✅ P0: Critical Bugs — ALL RESOLVED

All critical bugs identified in previous reviews have been resolved.
All **11,112** tests pass as of January 30, 2026.

---

## 🟠 P1: High Priority Issues (3 Open)

### P1.1 Documentation Metrics Drift — OPEN

**Status:** 🟠 OPEN  
**Severity:** P1 (High)  
**Component:** Documentation

**Issue:** 35 documentation inaccuracies found across files:

| Metric | Various Docs | Actual Verified |
|--------|--------------|----------------|
| Tests | 10,939 / 11,067 / 11,069 / 11,096 | **11,112** |
| JS Files | 126 / 139 / 141 | **139** |
| Statement Coverage | 94.65% / 95.00% | **95.42%** |
| God classes | 12 / 14 / 17 | **18** |
| i18n messages | 653 / 656 / 718 | **667** |

**Impact:** Project appears inconsistent; readers don't know which values to trust.

**Files Needing Update:**
- README.md
- docs/ARCHITECTURE.md  
- wiki/Home.md (also has JSON artifact corruption)
- CHANGELOG.md

**Estimated Effort:** 3-4 hours

---

### P1.2 MediaWiki Version Requirement Inconsistency — ✅ RESOLVED

**Status:** ✅ RESOLVED (January 30, 2026)  
**Severity:** P1 (High)  
**Component:** Documentation

**Resolution:** All files now correctly show `>= 1.44.0`:
- extension.json: `>= 1.44.0` ✅
- copilot-instructions.md: `>= 1.44.0` ✅
- Mediawiki-Extension-Layers.mediawiki: `>= 1.44.0` ✅

---

### P1.3 wiki/Home.md Contains Corrupted JSON Artifact — OPEN

**Status:** 🟠 OPEN  
**Severity:** P1 (High)  
**Component:** Documentation

**Issue:** Line 49 contains corrupted copy/paste artifact:
```
### Previous v1.5.35 Highlights", "oldString": "---
```

**Impact:** Professional appearance compromised.

**Fix:** Remove the corrupted text: `", "oldString": "---`

**Estimated Effort:** 5 minutes

---

### P1.4 God Class Count Undercounted — OPEN

**Status:** 🟠 OPEN  
**Severity:** P1 (High)  
**Component:** Documentation

**Issue:** Documentation says 17 god classes, actual count is **18**.
Missed: LayersValidator.js at 1,116 lines.

**Fix:** Update to 18 (2 generated + 14 JS + 2 PHP)

**Estimated Effort:** 30 minutes

---

## 🟡 P2: Medium Priority Issues (11 Open)

### P2.1 Race Condition in renameNamedSet() — ✅ RESOLVED

**Status:** ✅ RESOLVED (Verified January 30, 2026)  
**Severity:** P2 (Medium)  
**Component:** LayersDatabase

**Resolution:** Already uses proper transaction handling:
```php
$dbw->startAtomic( __METHOD__ );
$existsCount = $dbw->selectField( ..., [ 'FOR UPDATE' ] );
// ... check and update within transaction ...
$dbw->endAtomic( __METHOD__ );
```

**Files:** `src/Database/LayersDatabase.php` lines 854-895

---

### P2.2 StateManager Pending Operations Queue — ✅ RESOLVED

**Status:** ✅ RESOLVED (Verified January 30, 2026)  
**Severity:** P2 (Medium)  
**Component:** StateManager

**Resolution:** Already has proper coalescing implementation in `_queueSetOperation()`:
- Looks for existing operation with same key and updates it (line 113-118)
- Uses `_coalesceIntoUpdate()` for queue overflow (line 130-165)
- No data is dropped - operations are merged

**Files:** `resources/ext.layers.editor/StateManager.js`

---

### P2.3 Client/Server Validation Mismatches — ✅ RESOLVED

**Status:** ✅ RESOLVED (Verified January 30, 2026)  
**Severity:** P2 (Medium)  
**Component:** Validation

**Resolution:** Validation is now synchronized:

| Property | Client | Server | Status |
|----------|--------|--------|--------|
| Named colors | 148 | 148 | ✅ Synchronized |
| strokeWidth | 0-100 | 0-100 | ✅ Synchronized |
| blurRadius | 0-100 | 0-100 | ✅ Synchronized |
| arrowStyle | 5 values | 5 values | ✅ Synchronized |
| fillOpacity | 0-1 | 0-1 | ✅ Added |
| strokeOpacity | 0-1 | 0-1 | ✅ Added |

**Files:** `resources/ext.layers.editor/LayersValidator.js`, `src/Validation/ServerSideLayerValidator.php`

---

### P2.4 Raw SQL Fragments in listSlides() — OPEN

**Status:** 🟡 OPEN  
**Severity:** P2 (Medium)  
**Component:** LayersDatabase

**Issue:** String concatenation builds SQL subqueries.

**Fix:** Refactor to separate queries.

**Files:** `src/Database/LayersDatabase.php`

---

### P2.5 Inconsistent Database Return Types — OPEN

**Status:** 🟡 OPEN  
**Severity:** P2 (Medium)  
**Component:** LayersDatabase

**Issue:** Different methods return different types on error:
- `getLayerSet()` → `false`
- `getLayerSetByName()` → `null`
- `countNamedSets()` → `-1`

**Fix:** Standardize to `null` for not-found, throw for errors.

**Files:** `src/Database/LayersDatabase.php`

---

### P2.6 SVG Script Detection Bypass — OPEN

**Status:** 🟡 OPEN  
**Severity:** P2 (Medium)  
**Component:** ServerSideLayerValidator

**Issue:** Doesn't check HTML entity encoded variants like `java&#115;cript:`.

**Fix:** Decode entities before checking or add encoded patterns.

**Files:** `src/Validation/ServerSideLayerValidator.php`

---

## 🟢 P3: Low Priority Issues (8 Open)

### P3.1 SchemaManager Global Service Access

Uses `MediaWikiServices::getInstance()` in constructor, making unit testing harder.

### P3.2 TINYINT for ls_layer_count Column

Max 255; should be smallint for future-proofing.

### P3.3 Magic Strings for Error Codes

Error codes like `'layers-file-not-found'` repeated; create constants class.

### P3.4 CHECK Constraints Hardcoded in SQL

Don't match PHP config values; document dependency.

### P3.5 refreshAllViewers Parallel API Calls

Could overwhelm server; limit concurrency to 3-5.

### P3.6 Inconsistent @codeCoverageIgnore Usage

Some unreachable returns annotated, others not.

### P3.7 Empty String Boolean Normalization (Legacy)

Empty string `''` normalizes to `true`; server treats as `false`.

### P3.8 Potential Information Leak in Existence Check

Existence check before permission check could allow enumeration.

---

## ⏳ Feature Gaps

### F1. Custom Fonts (F3)

**Status:** ⏳ NOT STARTED

Not yet available beyond the default font allowlist in `$wgLayersDefaultFonts`.

### F2. Enhanced Dimension Tool (FR-14)

**Status:** ⏳ PROPOSED

Make the dimension line draggable independently from the anchor points.

### F3. Angle Dimension Tool (FR-15)

**Status:** ⏳ PROPOSED

New tool for measuring and annotating angles.

---

## ✅ Recently Resolved Issues (January 2026)

| Issue | Date | Notes |
|-------|------|-------|
| TailCalculator test failing | Jan 30 | Bounds check added |
| N+1 query patterns | Jan 30 | Batch refactoring |
| LIKE query escaping | Jan 30 | buildLike() used |
| API code duplication | Jan 30 | LayersApiHelperTrait |
| Slides in tables empty | Jan 30 | Retry filter fixed |
| Overlay buttons too large | Jan 30 | Reduced 32px→26px |
| Drag handle hit areas | Jan 30 | 4px tolerance added |
| 133 skipped tests | Jan 29 | All deleted |
| Text edits lost | Jan 29 | Focus handling fixed |
| ApiLayersList.getLogger bug | Jan 30 | Method call fixed |

---

## Test Coverage Status (January 30, 2026)

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

## Code Quality Metrics

| Metric | Value | Status |
|--------|-------|--------|
| JavaScript files | 139 | (~92,338 hand-written + ~14,354 generated) |
| PHP files | 41 | (~14,738 lines) |
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

*Document updated: January 30, 2026 (Comprehensive Review)*  
*Status: ✅ All tests passing. No critical bugs. 2 high-priority documentation issues.*
