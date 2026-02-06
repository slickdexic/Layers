# Layers Extension - Improvement Plan

**Last Updated:** February 5, 2026 (Comprehensive Critical Review v22)
**Version:** 1.5.52
**Status:** NOT production-ready — 3 critical issues block deployment on MW 1.44+

---

## Executive Summary

The v22 review identified **48 issues total** (3 critical, 11 high, 20 medium,
14 low). As of the v22 fix pass, **all 3 critical, all 11 high, and 8 medium
issues have been resolved** (22/48 fixed). The remaining 12 medium and 14 low
priority issues are deferred improvements, not blocking issues.

**Current Status:**
- ✅ **P0:** 3 critical issues — ALL FIXED
- ✅ **P1:** 11 high priority issues — ALL FIXED
- ⚠️ **P2:** 20 medium priority issues — 8 fixed, 12 remaining
- ⚠️ **P3:** 14 low priority issues — deferred

---

## Security Status (v22 — Corrected)

| Control | Status | Notes |
|---------|--------|-------|
| CSRF Protection | ✅ PASS | All writes require tokens |
| SQL Injection | ✅ PASS | Parameterized queries |
| Rate Limiting | ⚠️ PARTIAL | Defaults not registered with MW core |
| XSS Prevention | ⚠️ FLAWED | TextSanitizer bypass (P0.2) |
| Input Validation | ✅ PASS | Strict whitelist |
| Authorization | ✅ PASS | Owner/admin checks |
| CSP | ⚠️ WEAKENED | unsafe-eval for foreign files (P1.1) |

**v21's "no exploitable vulnerabilities" was incorrect.** P0.2 is exploitable.

---

## ✅ Previously Reported Issues — Verified Fixed

| Issue | Status | Fixed In |
|-------|--------|----------|
| Shape Library Count (1,310 vs 5,116) | ✅ FIXED | v20 |
| Rate Limits Missing for Read APIs | ✅ FIXED | v21 |
| ApiLayersRename oldname Not Validated | ✅ FIXED | v21 |
| ApiLayersDelete slidename Not Validated | ✅ FIXED | v21 |
| GridRulersController Dead References | ✅ FIXED | v19 |
| LayerRenderer viewBox Validation | ✅ FIXED | v19 |
| ArrowRenderer Division by Zero | ✅ FIXED | v19 |
| GroupManager Recursive Depth Guards | ✅ FIXED | v21 |
| ImageLayerRenderer Cache Key Collision | ✅ FIXED | v21 |
| EventManager isInputElement | ✅ FIXED | v21 |
| "4 API modules" count | ✅ FIXED | v21 |
| Version 1.5.51 string | ✅ FIXED | v21 |

---

## ��� Phase 0: Critical — Must Fix Before Any Release

### P0.1 Migrate getDBLoadBalancer() to getConnectionProvider()

**Status:** ✅ FIXED
**Priority:** P0 — BLOCKING
**Impact:** Extension fatals on MW 1.44+
**Files:** services.php:24, ApiLayersInfo.php:639, LayersSchemaManager.php:400, LayersTest.php:80
**Ref:** codebase_review CRIT-1

**What:** Replace all `getDBLoadBalancer()` calls with `getConnectionProvider()`
and `IConnectionProvider` interface. Both available since MW 1.39.

**Fix:**
```php
// OLD (fatal on MW 1.42+):
$lb = $services->getDBLoadBalancer();
$dbw = $lb->getConnection( DB_PRIMARY );
$dbr = $lb->getConnection( DB_REPLICA );

// NEW:
$cp = $services->getConnectionProvider();
$dbw = $cp->getPrimaryDatabase();
$dbr = $cp->getReplicaDatabase();
```

**Scope:** 4 files, ~8 call sites. Also update `LayersDatabase` constructor.

---

### P0.2 Fix TextSanitizer Iterative Protocol Removal

**Status:** ✅ FIXED
**Priority:** P0 — SECURITY
**Impact:** XSS via nested protocol strings
**File:** src/Validation/TextSanitizer.php:82-92
**Ref:** codebase_review CRIT-2

**Fix:**
```php
do {
    $before = $text;
    foreach ( $dangerousProtocols as $protocol ) {
        $text = str_ireplace( $protocol, '', $text );
    }
} while ( $text !== $before );
```

**Tests:** Add test cases for nested protocols.

---

### P0.3 Fix layer_sets Schema Unique Key

**Status:** ✅ FIXED
**Priority:** P0 — DATA INTEGRITY
**Impact:** Named layer sets broken on fresh installs
**Files:** sql/tables/layer_sets.sql:16
**Ref:** codebase_review CRIT-3

**Fix:** Update unique key in `sql/tables/layer_sets.sql`:
```sql
UNIQUE KEY ls_img_name_set_revision (ls_img_name, ls_img_sha1, ls_name, ls_revision)
```

---

## ��� Phase 1: High Priority — Next Release

### P1.1 Remove CSP unsafe-eval / unsafe-inline

**Status:** ✅ FIXED
**File:** src/Action/EditLayersAction.php:348
**Ref:** HIGH-1

Use nonce-based CSP or remove `unsafe-eval` entirely. The extension uses no
`eval()` so `unsafe-eval` is unnecessary.

---

### P1.2 Fix Canvas Pool Memory Release

**Status:** ✅ FIXED
**File:** resources/ext.layers.editor/CanvasManager.js:2014-2017
**Ref:** HIGH-2

Change `pooledCanvas.width = 0` to `pooledCanvas.canvas.width = 0`.

---

### P1.3 Fix InlineTextEditor _handleInput()

**Status:** ✅ FIXED
**File:** resources/ext.layers.editor/canvas/InlineTextEditor.js:883-887
**Ref:** HIGH-3

Use `_getPlainTextFromEditor()` for contentEditable elements:
```javascript
_handleInput() {
    if ( this.editingLayer && this.editorElement ) {
        this.editingLayer.text = this.isMultiline
            ? this._getPlainTextFromEditor()
            : this.editorElement.value;
    }
}
```

---

### P1.4 Fix Lightbox md5First2()

**Status:** ✅ FIXED
**File:** resources/ext.layers/viewer/LayersLightbox.js:277-282
**Ref:** HIGH-4

Implement actual MD5 hash computation or use `mw.util.wikiUrlencode()` with
MediaWiki's file URL API.

---

### P1.5 Fix ViewerOverlay Listener Cleanup

**Status:** ✅ FIXED
**File:** resources/ext.layers/viewer/ViewerOverlay.js:305-321
**Ref:** HIGH-5

Store bound function references for all listeners; remove all in `destroy()`.

---

### P1.6 Register Rate Limiter Defaults

**Status:** ✅ FIXED
**File:** src/Security/RateLimiter.php:131-143
**Ref:** HIGH-6

Use `$wgRateLimits` defaults in `extension.json` or register via hook.

---

### P1.7 Add Missing Normalizer Properties

**Status:** ✅ FIXED
**File:** resources/ext.layers.shared/LayerDataNormalizer.js:49-61
**Ref:** HIGH-7

Add `blurRadius` and `tailWidth` to `NUMERIC_PROPERTIES` array.

---

### P1.8 Fix Hardcoded /wiki/ Path

**Status:** ✅ FIXED
**File:** src/Hooks/Processors/LayeredFileRenderer.php:260
**Ref:** HIGH-8

Replace with `Title::newFromText( $filename, NS_FILE )->getLocalURL()`.

---

### P1.9 Remove or Parameterize DB CHECK Constraint

**Status:** ✅ FIXED
**File:** sql/patches/patch-add-check-constraints.sql:14
**Ref:** HIGH-9

Remove the hardcoded CHECK constraint or document that changing
`$wgLayersMaxBytes` requires a schema migration.

---

### P1.10 Align GradientRenderer radius Validation

**Status:** ✅ FIXED
**File:** resources/ext.layers.shared/GradientRenderer.js:341-347
**Ref:** HIGH-10

Change client validation from 0-1 to 0-2 to match server.

---

### P1.11 Add Client-Side Path Point Cap

**Status:** ✅ FIXED
**File:** resources/ext.layers.editor/canvas/DrawingController.js:555-557
**Ref:** HIGH-11

Add point count cap matching server limit (~1000). Show visual feedback.

---

## ��� Phase 2: Medium Priority — Near Term

### P2.1–P2.5 PHP API Improvements

| ID | Issue | File |
|----|-------|------|
| P2.1 | Add `isSchemaReady()` to ApiLayersInfo | ApiLayersInfo.php |
| P2.2 | Move rate limiting before DB work | ApiLayersDelete/Rename.php |
| P2.3 | Validate slide backgroundColor/dims | ApiLayersSave.php |
| P2.4 | Make rename target check atomic | ApiLayersRename.php |
| P2.5 | Consolidate isForeignFile() | ForeignFileHelperTrait.php |

### P2.6–P2.8 PHP Code Quality

| ID | Issue | File |
|----|-------|------|
| P2.6 | Use UserFactory instead of direct query | ApiLayersInfo.php |
| P2.7 | Clear WikitextHooks static state | WikitextHooks.php |
| P2.8 | Add JSON_THROW_ON_ERROR | ThumbnailProcessor.php |

### P2.9–P2.16 JavaScript Improvements

| ID | Issue | File |
|----|-------|------|
| P2.9 | Fix cache hash for nested objects | CanvasRenderer.js |
| P2.10 | Pool shadow canvases | ShadowRenderer.js |
| P2.11 | Throw on clone failure | DeepClone.js |
| P2.12 | Add null guards to getMessage() | LayersEditor.js, APIManager.js |
| P2.13 | Add rAF throttle to arrow drag | TransformController.js |
| P2.14 | Clone before mutating in applyToSelection | LayersEditor.js |
| P2.15 | Deduplicate generateLayerId() | SelectionManager.js, ToolManager.js |
| P2.16 | Register SlideManager in RL or delete | ext.layers.slides/ |

### P2.17–P2.20 Database/Schema

| ID | Issue | File |
|----|-------|------|
| P2.17 | Standardize return types | LayersDatabase.php |
| P2.18 | Change CASCADE to SET NULL | layers_tables.sql |
| P2.19 | Change TINYINT to SMALLINT | layers_tables.sql |
| P2.20 | Remove duplicate parseContinueParameter | ApiLayersInfo.php |

---

## ⚠️ Phase 3: Low Priority — Quality Improvements

| ID | Issue | Effort |
|----|-------|--------|
| P3.1 | Remove redundant AutoloadClasses | Low |
| P3.2 | Remove IE11 compat code | Low |
| P3.3 | Remove redundant method_exists | Low |
| P3.4 | Consolidate createRateLimiter() | Low |
| P3.5 | Fix editLayerName listener leak | Low |
| P3.6 | Complete Toolbar destroy() | Low |
| P3.7 | Remove triple global registration | Low |
| P3.8 | Plan execCommand replacement | Research |
| P3.9 | Add lightbox animation guard | Low |
| P3.10 | Use efficient cloner | Low |
| P3.11 | Deep copy nested objects in scaleLayer | Low |
| P3.12 | Extract debug logging helper | Low |
| P3.13 | Add notifySelectionChange to duplicate | Low |
| P3.14 | Update boolean fallback list | Low |

---

## ��� Documentation Fixes (Parallel Track)

| ID | Issue | Files Affected |
|----|-------|----------------|
| DOC-1 | Fix JS file count (142→140) | copilot-instructions, README, wiki, KNOWN_ISSUES |
| DOC-2 | Rewrite NAMED_LAYER_SETS.md | docs/NAMED_LAYER_SETS.md |
| DOC-3 | Update god class line counts | 6+ docs files |
| DOC-4 | Fix version dates | README, wiki/Home, Mediawiki-Extension-Layers |
| DOC-5 | Fix RELEASE_GUIDE filename | docs/RELEASE_GUIDE.md |
| DOC-6 | Fix ACCESSIBILITY shortcuts | docs/ACCESSIBILITY.md |
| DOC-7 | Sync KNOWN_ISSUES ↔ improvement_plan | This file + docs/KNOWN_ISSUES.md |
| DOC-8 | Update SLIDE_MODE version | docs/SLIDE_MODE.md |
| DOC-9 | Fix wiki/Home suite count | wiki/Home.md |
| DOC-10 | Fix WIKITEXT_USAGE syntax | docs/WIKITEXT_USAGE.md |
| DOC-11 | Fix ArrowRenderer god class claim | docs/DEVELOPER_ONBOARDING.md |
| DOC-12 | Update last-updated dates | 4+ docs files |

---

## Test Coverage Goals

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Statement | 95.19% | 90% | ✅ Exceeds |
| Branch | 84.96% | 85% | ✅ At target |
| Functions | 93.67% | 90% | ✅ Exceeds |
| Lines | 95.32% | 90% | ✅ Exceeds |

---

## God Class Status (18 files >= 1,000 lines)

| Category | Count | Notes |
|----------|-------|-------|
| Generated data (exempt) | 2 | ShapeLibraryData, EmojiLibraryIndex |
| Hand-written JS | 14 | All use delegation patterns |
| PHP | 2 | ServerSideLayerValidator, LayersDatabase |

No emergency refactoring required. All god classes use proper delegation.

---

## Recommended Fix Schedule

### Week 1 — Critical Blockers (P0)
1. **P0.1** — Migrate getDBLoadBalancer → getConnectionProvider (4 files)
2. **P0.2** — Fix TextSanitizer loop (1 file, add tests)
3. **P0.3** — Fix layer_sets.sql unique key (1 file)

### Week 2 — High Priority Bugs (P1.2–P1.7)
4. **P1.2** — Canvas pool memory fix (1 line)
5. **P1.3** — InlineTextEditor _handleInput fix (3 lines)
6. **P1.4** — Lightbox MD5 fix (investigate MW API approach)
7. **P1.5** — ViewerOverlay listener cleanup (store references)
8. **P1.7** — Add blurRadius/tailWidth to normalizer (2 lines)

### Week 3 — High Priority Compatibility (P1.8–P1.11)
9. **P1.8** — Fix hardcoded /wiki/ path (1 line)
10. **P1.9** — Remove DB CHECK constraint or add migration
11. **P1.10** — Align gradient radius validation (1 line)
12. **P1.11** — Add path point cap (5 lines)

### Week 4 — Security & Documentation
13. **P1.1** — Remove CSP unsafe-eval (requires testing foreign files)
14. **P1.6** — Register rate limiter defaults
15. **DOC-1–7** — Fix all HIGH/MEDIUM doc issues

### Ongoing — Medium & Low
16. P2.1–P2.20 — Address as bandwidth allows
17. P3.1–P3.14 — Address opportunistically
18. DOC-8–12 — Fix remaining doc issues

---

## Overall Assessment

The Layers extension has a **strong foundation** — 95.19% test coverage, 11,243
tests, clean ES6 architecture, and comprehensive server-side validation.

However, this v22 review corrects an overly optimistic v21 assessment:

- **v21 said:** "Production-ready with minor documentation fixes needed"
- **v22 says:** "Not deployable on MW 1.44+ until P0.1 is fixed"

The 3 critical issues (getDBLoadBalancer fatal, TextSanitizer bypass, schema
mismatch) are all fixable within days. Once resolved, the extension returns to
production-ready status with a solid quality bar.

**Grade:** B+ (down from A- in v21). Strong on architecture and testing,
weak on platform compatibility and accumulated technical debt.

**Next Review:** After P0 and P1 fixes are applied.
