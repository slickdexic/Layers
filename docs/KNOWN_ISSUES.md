# Known Issues

**Last Updated:** February 5, 2026 (Comprehensive Critical Review v22)
**Version:** 1.5.52

This document lists known issues and current gaps for the Layers extension.
Cross-reference with [codebase_review.md](../codebase_review.md) and
[improvement_plan.md](../improvement_plan.md) for details and fix plans.

---

## Status Summary

| Category | Count | Status |
|----------|-------|--------|
| P0 (Critical) | **3** | ❌ MUST FIX before release |
| P1 (High Priority) | **11** | ❌ Open |
| P2 (Medium Priority) | **20** | ❌ Open |
| P3 (Low Priority) | **14** | ⚠️ Deferred/Low |

---

## Security Controls Status (v22 — Corrected from v21)

| Control | Status | Notes |
|---------|--------|-------|
| CSRF Protection | ✅ Verified | All writes require tokens |
| SQL Injection | ✅ Verified | Parameterized queries |
| Rate Limiting | ⚠️ PARTIAL | Code exists but defaults not registered with MW |
| XSS Prevention | ⚠️ FLAWED | TextSanitizer protocol removal bypassable |
| Input Validation | ✅ Verified | Strict whitelist (50+ fields) |
| Authorization | ✅ Verified | Owner/admin checks |
| CSP | ⚠️ WEAKENED | unsafe-eval/unsafe-inline for foreign files |
| Data Normalization | ⚠️ INCOMPLETE | Missing blurRadius, tailWidth |

**v21's claim of "No exploitable security vulnerabilities" was premature.**
See CRIT-2, P1.1, P1.6.

---

## ✅ Previously Reported Issues — Fixed

| Issue | Status | Fixed In |
|-------|--------|----------|
| Shape Library Count Wrong | ✅ FIXED | v20 |
| Version Drift (1.5.51 → 1.5.52) | ✅ FIXED | v20 |
| Rate Limits Missing for Read APIs | ✅ FIXED | v21 |
| ApiLayersRename oldname Not Validated | ✅ FIXED | v21 |
| ApiLayersDelete slidename Not Validated | ✅ FIXED | v21 |
| GridRulersController Dead References | ✅ FIXED | v19 |
| EmojiLibraryData Documentation | ✅ FIXED | v19 |
| layerslist API Missing from Docs | ✅ FIXED | v21 |
| LayerRenderer viewBox Validation | ✅ FIXED | v19 |
| ArrowRenderer Division by Zero | ✅ FIXED | v19 |
| ShapeRenderer Negative Radius | ✅ FIXED | v19 |
| ShadowRenderer Unbounded Canvas | ✅ FIXED | v19 |
| GroupManager Recursive Depth Guards | ✅ FIXED | v21 (improvement_plan P1.2) |
| ImageLayerRenderer Cache Key Collision | ✅ FIXED | v21 (improvement_plan P1.4) |
| EventManager isInputElement Incomplete | ✅ FIXED | v21 (improvement_plan P2.4) |
| "4 API modules" in copilot-instructions | ✅ FIXED | v21 (improvement_plan P2.3) |
| Version 1.5.51 in copilot-instructions | ✅ FIXED | v21 (improvement_plan P2.2) |

---

## ��� P0 — Critical Issues (NEW in v22)

### P0.1 getDBLoadBalancer() Fatal on MW >= 1.42

**Status:** ❌ OPEN
**Ref:** codebase_review CRIT-1
**Files:** services.php:24, ApiLayersInfo.php:639, LayersSchemaManager.php:400, LayersTest.php:80

`MediaWikiServices::getDBLoadBalancer()` was removed in MW 1.42. Since
`extension.json` requires MW >= 1.44, the extension **fatals immediately** on
any supported MediaWiki version.

---

### P0.2 TextSanitizer Protocol Bypass via Nesting

**Status:** ❌ OPEN
**Ref:** codebase_review CRIT-2
**File:** src/Validation/TextSanitizer.php:82-92

Single-pass `str_ireplace()` allows nested protocol strings to survive:
`"javajavaScript:script:alert(1)"` → `"javascript:alert(1)"`. XSS risk.

---

### P0.3 Schema Mismatch — layer_sets Unique Key

**Status:** ❌ OPEN
**Ref:** codebase_review CRIT-3
**Files:** sql/layers_tables.sql:19 vs sql/tables/layer_sets.sql:16

Per-table schema file uses old unique key without `ls_name`. Fresh installs
using per-table files will have broken named layer sets.

---

## ��� P1 — High Priority Issues

### P1.1 CSP Includes unsafe-eval / unsafe-inline

**Status:** ❌ OPEN
**Ref:** codebase_review HIGH-1
**File:** src/Action/EditLayersAction.php:348

CSP header for foreign file pages includes `'unsafe-eval' 'unsafe-inline'`
in script-src, negating XSS protection.

---

### P1.2 Canvas Pool destroy() Doesn't Free Memory

**Status:** ❌ OPEN
**Ref:** codebase_review HIGH-2
**File:** resources/ext.layers.editor/CanvasManager.js:2014-2017

Sets width/height on wrapper object instead of `.canvas` element. Canvas GPU
memory not released on editor close.

---

### P1.3 InlineTextEditor _handleInput() Broken

**Status:** ❌ OPEN
**Ref:** codebase_review HIGH-3
**File:** resources/ext.layers.editor/canvas/InlineTextEditor.js:883-887

Uses `.value` on contentEditable `<div>` (returns undefined). Text silently
erased during inline editing of textbox/callout layers.

---

### P1.4 Lightbox md5First2() Wrong URLs

**Status:** ❌ OPEN
**Ref:** codebase_review HIGH-4
**File:** resources/ext.layers/viewer/LayersLightbox.js:277-282

Takes first 2 characters of filename instead of computing MD5 hash. Produces
404 errors for lightbox full-size image URLs.

---

### P1.5 ViewerOverlay Memory Leak (Event Listeners)

**Status:** ❌ OPEN
**Ref:** codebase_review HIGH-5
**File:** resources/ext.layers/viewer/ViewerOverlay.js:305-321

focusin/focusout listeners added but never removed in destroy(). focusout
uses anonymous function so can never be removed.

---

### P1.6 Rate Limiter Defaults Not Registered

**Status:** ❌ OPEN
**Ref:** codebase_review HIGH-6
**File:** src/Security/RateLimiter.php:131-143

Computed default limits are never passed to MediaWiki's limiter. Without
manual `$wgRateLimits` config, rate limiting is completely disabled.

---

### P1.7 blurRadius/tailWidth Missing from Normalizer

**Status:** ❌ OPEN
**Ref:** codebase_review HIGH-7
**File:** resources/ext.layers.shared/LayerDataNormalizer.js:49-61

Numeric properties not listed in NUMERIC_PROPERTIES. String values from
API cause NaN in calculations.

---

### P1.8 Hardcoded /wiki/ Path

**Status:** ❌ OPEN
**Ref:** codebase_review HIGH-8
**File:** src/Hooks/Processors/LayeredFileRenderer.php:260

Hardcodes `/wiki/File:` instead of using `Title::getLocalURL()`. Breaks on
non-standard article path configurations.

---

### P1.9 DB CHECK Constraint Hardcodes 2MB

**Status:** ❌ OPEN
**Ref:** codebase_review HIGH-9
**File:** sql/patches/patch-add-check-constraints.sql:14

Database constrains `ls_size <= 2097152` but `$wgLayersMaxBytes` is
configurable. Admins who increase the limit get DB rejections.

---

### P1.10 GradientRenderer radius Mismatch

**Status:** ❌ OPEN
**Ref:** codebase_review HIGH-10
**File:** resources/ext.layers.shared/GradientRenderer.js:341-347

Client validates radius 0-1, server allows 0-2. Server-saved values
rejected by client renderer.

---

### P1.11 Path Tool Unlimited Points

**Status:** ❌ OPEN
**Ref:** codebase_review HIGH-11
**File:** resources/ext.layers.editor/canvas/DrawingController.js:555-557

No client-side cap on freehand path points. Server silently truncates to
~1000, creating mismatch between drawn and saved shape.

---

## ��� P2 — Medium Priority Issues

### P2.1 ApiLayersInfo Missing Schema Check
**Ref:** MED-1. No `isSchemaReady()` call; generic error instead of `dbschema-missing`.

### P2.2 Rate Limiting After Expensive DB Work
**Ref:** MED-2. Delete/Rename check rate limits after permission checks and queries.

### P2.3 Slide Save Missing Validation
**Ref:** MED-3. `backgroundColor` and `canvasWidth/canvasHeight` not validated.

### P2.4 ApiLayersRename Race Condition
**Ref:** MED-4. Name existence check and rename not atomic.

### P2.5 isForeignFile() Duplicated in 5+ Files
**Ref:** MED-5. Fragile `strpos($className, 'Foreign')` pattern repeated everywhere.

### P2.6 enrichWithUserNames Deprecated Query
**Ref:** MED-6. Direct `user` table query instead of `UserFactory`.

### P2.7 WikitextHooks Static State Leak
**Ref:** MED-7. Static properties persist across requests in long-running processes.

### P2.8 ThumbnailProcessor json_encode No Error Handling
**Ref:** MED-8. Invalid UTF-8 produces `"false"` in HTML attribute.

### P2.9 CanvasRenderer Hash Misses Nested Objects
**Ref:** MED-9. `gradient`/`richText` become `"[object Object]"` in cache key.

### P2.10 ShadowRenderer Temp Canvas Per Call
**Ref:** MED-10 / P3.4 from v21. Creates canvas each call; GC pressure.

### P2.11 DeepClone Fallback Returns Original
**Ref:** MED-11. Should throw rather than return uncloned reference.

### P2.12 getMessage() Missing Null Check
**Ref:** MED-12. Inconsistent null guards across LayersEditor/APIManager.

### P2.13 Arrow Tip Drag No rAF Throttling
**Ref:** MED-13. Renders every mousemove unlike other drag ops.

### P2.14 applyToSelection() In-Place Mutation
**Ref:** MED-14. Breaks immutable state pattern.

### P2.15 Duplicate generateLayerId()
**Ref:** MED-15. Identical code in SelectionManager and ToolManager.

### P2.16 SlideManager.js Dead Code
**Ref:** MED-16. Exists, tested, but not in ResourceLoader module.

### P2.17 Inconsistent DB Return Types
**Ref:** MED-17. `getLayerSet()` returns `array|false`, `getLayerSetByName()` returns `?array`.

### P2.18 ON DELETE CASCADE Destroys Layer Data
**Ref:** MED-18. User deletion cascades to all their layer sets.

### P2.19 TINYINT ls_layer_count Cap
**Ref:** MED-19. Max 255; will overflow if config raised significantly.

### P2.20 parseContinueParameter Duplicated
**Ref:** MED-20. Local method shadows trait; dead code.

---

## ⚠️ P3 — Low Priority / Deferred Issues

### P3.1 Redundant AutoloadClasses
**Ref:** LOW-1. ~30 classes duplicate PSR-4 autoloading.

### P3.2 IE11 Code in MW >= 1.44
**Ref:** LOW-2. Unnecessary compatibility code.

### P3.3 Redundant method_exists Checks
**Ref:** LOW-3. getWidth/getHeight always exist on File.

### P3.4 createRateLimiter() Duplicated
**Ref:** LOW-4. Trait + local definitions.

### P3.5 editLayerName Listener Leak
**Ref:** LOW-5. New listeners added without removing old.

### P3.6 Toolbar destroy() Incomplete
**Ref:** LOW-6. Shape/emoji panels not cleaned up.

### P3.7 GroupManager Triple Registration
**Ref:** LOW-7. Registers on window, Layers, Layers.Core.

### P3.8 Deprecated execCommand
**Ref:** LOW-8. No replacement available yet.

### P3.9 Lightbox Race During Animation
**Ref:** LOW-9. 300ms window for duplicate overlays.

### P3.10 JSON Roundtrip for Clone
**Ref:** LOW-10. Efficient cloner already exists.

### P3.11 Shallow Copy of Nested Layer Objects
**Ref:** LOW-11. gradient/richText shared by reference after scaling.

### P3.12 Verbose Debug Logging
**Ref:** LOW-12. Helper would reduce ~60 lines.

### P3.13 Selection Sync Missing
**Ref:** LOW-13. duplicateSelected doesn't notify StateManager.

### P3.14 Stale Boolean Fallback List
**Ref:** LOW-14. LayersViewer missing 5+ properties.

---

## Carried Forward from v21 (Status Changed)

| v21 Issue | v21 Status | v22 Status | Notes |
|-----------|------------|------------|-------|
| P1.1 API-Reference layerslist | ❌ OPEN | ✅ FIXED | improvement_plan said fixed |
| P1.2 GroupManager depth guards | ❌ OPEN | ✅ FIXED | improvement_plan said fixed |
| P1.3 APIManager abort behavior | ❌ OPEN | ⚠️ DEFERRED | Intentional design |
| P1.4 ImageLayerRenderer cache | ❌ OPEN | ✅ FIXED | improvement_plan said fixed |
| P2.1 JS file count | ❌ OPEN (claimed 142) | ❌ OPEN (actual 140) | v21 had wrong count |
| P2.2 Version in copilot-inst | ❌ OPEN | ✅ FIXED | Now says 1.5.52 |
| P2.3 "4 API modules" | ❌ OPEN | ✅ FIXED | Now says 5 |
| P2.4 EventManager isInputElement | ❌ OPEN | ✅ FIXED | Missing elements added |
| P2.5 StateManager forceUnlock | ❌ OPEN | ❌ OPEN | Still unfixed |
| P3.1 README date | ❌ OPEN | ❌ OPEN | Still wrong |
| P3.4 ShadowRenderer canvas | ⚠️ DEFERRED | ❌ OPEN (P2.10) | Upgraded to P2 |

---

## Documentation Issues

See codebase_review.md DOC-1 through DOC-12 for full details. Key items:

| ID | Issue | Severity |
|----|-------|----------|
| DOC-1 | JS file count says 142, actual 140 | HIGH |
| DOC-2 | NAMED_LAYER_SETS.md uses wrong syntax | HIGH |
| DOC-3 | God class line counts stale (6+ files) | MEDIUM |
| DOC-4 | Version date inconsistent (Feb 3 vs Feb 5) | MEDIUM |
| DOC-5 | RELEASE_GUIDE wrong filename references | MEDIUM |
| DOC-6 | ACCESSIBILITY.md wrong shortcut | MEDIUM |
| DOC-7 | KNOWN_ISSUES & improvement_plan were out of sync | MEDIUM |
