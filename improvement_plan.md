# Layers Extension - Improvement Plan

**Last Updated:** February 2, 2026 (Comprehensive Critical Review v6)  
**Version:** 1.5.47  
**Status:** Production-Ready (8.5/10)

> **📋 NOTE:** See [GOD_CLASS_REFACTORING_PLAN.md](docs/GOD_CLASS_REFACTORING_PLAN.md) for the detailed phased plan to address god class issues.

---

## Executive Summary

The extension is **production-ready** with **comprehensive test coverage** and clean code practices. All **11,157** tests pass. This improvement plan prioritizes issues identified in the February 2, 2026 comprehensive critical review v6.

**Current Status:**
- ✅ **P0:** All resolved (no critical bugs)
- ⚠️ **P1:** 2 open (dead code with fatal bugs)
- ⚠️ **P2:** 7 open (various issues)
- ⚠️ **P3:** 10 open (low-priority backlog)

**Verified Metrics (February 2, 2026):**

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
| ESLint errors | 0 | ✅ |
| ESLint disables | 11 | ✅ All legitimate |
| i18n messages | **667** | All documented in qqq.json |
| TODO/FIXME/HACK | 0 | ✅ Clean |
| console.log in production | 0 | ✅ Clean |
| Dead code files | 2 | ApiSlidesSave, ApiSlideInfo |

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

## Phase 1 (P1): High Priority — ��� 2 OPEN

### P1.1 Delete ApiSlidesSave.php (Dead Code)

**Status:** ��� OPEN  
**Priority:** P1 - High  
**Category:** Dead Code Cleanup

**Problem:** `src/Api/ApiSlidesSave.php` has 6+ fatal bugs that would crash immediately:

| Bug | Issue |
|-----|-------|
| Line 68 | Wrong RateLimiter constructor (passes User, expects Config) |
| Line 69 | Wrong method name (isLimited() doesn't exist, should be checkRateLimit()) |
| Line 75-77 | SlideNameValidator::validate() returns ?string, not ValidationResult |
| Line 87 | Wrong ServerSideLayerValidator constructor (passes arg, takes none) |
| Line 95 | Wrong method name (getSanitizedData() vs getData()) |
| Line 128 | Missing method (sanitizeColor() not defined) |
| Line 132 | Missing database method (saveSlide() not in LayersDatabase) |

**Mitigating Factor:** NOT registered in extension.json APIModules (dead code).

**Recommended Action:** Delete file (slides work via `ApiLayersSave::executeSlideSave()`).

**Effort:** 5 minutes to delete.

---

### P1.2 Delete ApiSlideInfo.php (Dead Code)

**Status:** ��� OPEN  
**Priority:** P1 - High  
**Category:** Dead Code Cleanup

**Problem:** `src/Api/ApiSlideInfo.php` has 3+ fatal bugs:

| Bug | Issue |
|-----|-------|
| Line 66-68 | SlideNameValidator::validate() returns ?string, not ValidationResult |
| Line 67 | getMessage() called on string (doesn't exist) |
| Line 74 | Missing database method (getSlideByName() not in LayersDatabase) |

**Mitigating Factor:** NOT registered in extension.json APIModules (dead code).

**Recommended Action:** Delete file (slides work via `ApiLayersInfo::executeSlideRequest()`).

**Effort:** 5 minutes to delete.

---

## Phase 2 (P2): Medium Priority — ��� 7 OPEN

### P2.1 Add Missing Boolean Properties to preserveLayerBooleans

**Status:** ��� OPEN  
**Priority:** P2 - Medium  
**Category:** Data Integrity

**Problem:** `preserveLayerBooleans()` only converts 7 of 12 boolean properties.

**Missing properties:**
- `expanded` (group layers)
- `isMultiPath` (custom shapes)
- `strokeOnly` (custom shapes)
- `showUnit` (dimension layers)
- `showBackground` (dimension layers)

**Impact:** False values for these properties may be lost during API serialization.

**Files:** `src/Api/ApiLayersInfo.php` lines 365-368

**Fix:**
```php
$booleanProps = [
    'visible', 'locked', 'shadow', 'glow', 'textShadow', 'preserveAspectRatio', 'hasArrow',
    'expanded', 'isMultiPath', 'strokeOnly', 'showUnit', 'showBackground'
];
```

**Effort:** 15 minutes

---

### P2.2 Add InlineTextEditor to CanvasManager Destroy List

**Status:** ��� OPEN  
**Priority:** P2 - Medium  
**Category:** Memory Leak Prevention

**Problem:** The `inlineTextEditor` controller is initialized at line 308 but NOT included in `controllersToDestroy`.

**Files:** `resources/ext.layers.editor/CanvasManager.js` lines 1957-1973

**Fix:** Add `'inlineTextEditor'` to the array after `'textInputController'`.

**Effort:** 5 minutes

---

### P2.3 Add Slide Support to ApiLayersRename

**Status:** ��� OPEN  
**Priority:** P2 - Medium  
**Category:** Feature Parity

**Problem:** Unlike ApiLayersSave, ApiLayersInfo, and ApiLayersDelete, the ApiLayersRename module does not support slides.

**Files:** `src/Api/ApiLayersRename.php`

**Fix:** Add `executeSlideRename()` method following the pattern of other API modules.

**Effort:** 2 hours

---

### P2.4 Fix Documentation Version Inconsistencies

**Status:** ��� OPEN  
**Priority:** P2 - Medium  
**Category:** Documentation

**Problem:** Several files show 1.5.45 instead of 1.5.46:
- `Mediawiki-Extension-Layers.mediawiki`
- `wiki/Home.md`
- `.github/copilot-instructions.md`

**Effort:** 30 minutes

---

### P2.5 Review Font Family Validation

**Status:** ��� OPEN  
**Priority:** P2 - Medium  
**Category:** Data Integrity

**Problem:** Font validation rejects any font not in `$wgLayersDefaultFonts` (defaults to ['Arial', 'sans-serif']).

**Files:** `src/Validation/ServerSideLayerValidator.php` lines 500-506

**Options:**
1. Make font validation a warning (keep value) rather than rejection
2. Expand default font list to include common web fonts
3. Add more fonts to the default configuration

**Effort:** 30 minutes

---

### P2.6 Sync wiki/Changelog.md with CHANGELOG.md

**Status:** ��� OPEN  
**Priority:** P2 - Medium  
**Category:** Documentation

**Problem:** wiki/Changelog.md is missing v1.5.46 entry.

**Effort:** 15 minutes

---

### P2.7 Fix Branch Version Table Inconsistencies

**Status:** ��� OPEN  
**Priority:** P2 - Medium  
**Category:** Documentation

**Problem:** REL1_43 and REL1_39 version references are inconsistent.

**Files:** `wiki/Home.md`, `Mediawiki-Extension-Layers.mediawiki`

**Effort:** 15 minutes

---

## Phase 3 (P3): Long-Term — ��� 10 OPEN

### P3.1 Standardize API Error Codes

Standardize to use `'filenotfound'` consistently across all API modules.

---

### P3.2 Document All Rate Limit Keys

Document `editlayers-rename`, `editlayers-delete`, `editlayers-list` in copilot-instructions.md.

---

### P3.3 Review Text Sanitizer Keyword Removal

Consider whether removing JavaScript keywords is too aggressive.

---

### P3.4 SchemaManager Constructor Injection

Inject logger via constructor instead of global service access.

---

### P3.5 Configurable Transaction Timeouts

Make 3 retries/5000ms timeout configurable for high-load environments.

---

### P3.6 Upgrade ls_layer_count to SMALLINT

Change from TINYINT (max 255) to SMALLINT for future-proofing.

---

### P3.7-P3.10 Documentation Line Count Discrepancies

Accept minor discrepancies (1-10 lines) as line counts change frequently.

---

## God Class Reduction Plan

Current count: **18 god classes** (2 generated + 14 JS + 2 PHP)

| File | Lines | Strategy | Priority |
|------|-------|----------|----------|
| InlineTextEditor.js | 1,521 | Extract RichTextToolbar | Medium |
| APIManager.js | 1,403 | Extract RetryManager | Medium |
| ServerSideLayerValidator.php | 1,341 | Strategy pattern | Low |
| LayersDatabase.php | 1,360 | Repository split | Low |

See [GOD_CLASS_REFACTORING_PLAN.md](docs/GOD_CLASS_REFACTORING_PLAN.md) for detailed plan.

---

## Action Items Summary

### Immediate (This Week)

| Priority | Item | Effort | Status |
|----------|------|--------|--------|
| P1 | Delete ApiSlidesSave.php | 5 min | ��� |
| P1 | Delete ApiSlideInfo.php | 5 min | ��� |
| P2 | Add missing booleans to preserveLayerBooleans | 15 min | ��� |
| P2 | Add inlineTextEditor to CanvasManager destroy | 5 min | ��� |

### This Month

| Priority | Item | Effort | Status |
|----------|------|--------|--------|
| P2 | Add slide support to ApiLayersRename | 2 hours | ��� |
| P2 | Fix documentation version inconsistencies | 1 hour | ��� |
| P2 | Review font family validation | 30 min | ��� |

### This Quarter

| Priority | Item | Effort | Status |
|----------|------|--------|--------|
| P3 | Standardize API error codes | 1 hour | ��� |
| P3 | Document all rate limit keys | 30 min | ��� |
| P3 | Extract 2 god class modules | 1 week | ��� |

---

## Test Coverage Goals

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Statement | 95.44% | 90% | ✅ Exceeds |
| Branch | 85.20% | 85% | ✅ At target |
| Function | 93.75% | 85% | ✅ Exceeds |
| Lines | 95.56% | 90% | ✅ Exceeds |

No immediate coverage improvements needed. Focus on maintaining current levels.

---

## Documentation Updates Needed

| Document | Update |
|----------|--------|
| Mediawiki-Extension-Layers.mediawiki | Update version to 1.5.46 |
| wiki/Home.md | Update version references |
| wiki/Changelog.md | Add v1.5.46 entry |
| .github/copilot-instructions.md | Update version to 1.5.46 |

---

*Document updated: February 2, 2026 (Comprehensive Critical Review v6)*  
*Status: Production-ready. 2 P1 dead code issues. 7 P2 issues. 10 P3 issues.*
