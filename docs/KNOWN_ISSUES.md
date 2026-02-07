# Known Issues

**Last Updated:** February 7, 2026 (Comprehensive Critical Review v24)
**Version:** 1.5.52

This document lists known issues and current gaps for the Layers extension.
Cross-reference with [codebase_review.md](../codebase_review.md) and
[improvement_plan.md](../improvement_plan.md) for details and fix plans.

---

## Status Summary

| Category | Count | Status |
|----------|-------|--------|
| P0 (Critical) | **4** | ❌ NEW — Require immediate attention |
| P1 (High Priority) | **11** | ❌ NEW — Require fix before next release |
| P2 (Medium Priority) | **16** | ❌ Open |
| P3 (Low Priority) | **14** | ⚠️ Deferred |
| Documentation | **50** | ❌ 11 HIGH, 19 MEDIUM, 20 LOW |

---

## Security Controls Status (v24 — Revised Assessment)

| Control | Status | Notes |
|---------|--------|-------|
| CSRF Protection | ✅ PASS | All writes require tokens |
| SQL Injection | ✅ PASS | Parameterized queries |
| Rate Limiting | ❌ FAIL | Defaults exist but NOT registered with MW — no-op |
| XSS Prevention | ✅ PASS | TextSanitizer iterative removal |
| Input Validation | ⚠️ PARTIAL | Strict whitelist, but shapeData allows arbitrary keys |
| Authorization | ⚠️ PARTIAL | Files checked; slides bypass read permission |
| CSP | ⚠️ PARTIAL | No unsafe-eval, but may conflict with MW CSP |
| Data Normalization | ✅ PASS | All properties normalized |
| SVG Sanitization | ⚠️ PARTIAL | Checks xlink:href but not SVG2 plain href |
| Server File Access | ❌ FAIL | ImageMagick `@` file disclosure via text layers |

**v24 corrects v23's overly optimistic assessment.** Rate limiting was marked
"PASS" in v23 but is actually a no-op. Authorization was marked "PASS" but
slides bypass read checks. Server file access was not previously assessed.

---

## ❌ P0 — Critical Issues (NEW in v24)

### P0.1 ImageMagick `@` File Disclosure via Text Layers

**Status:** ❌ OPEN
**Ref:** codebase_review CRIT-v24-1
**File:** src/ThumbnailRenderer.php (~L262, ~L353)

User-supplied `$layer['text']` passed directly to IM `-annotate`. Text
starting with `@` causes IM to read server files. TextSanitizer does not
strip `@`. Any user with `editlayers` can exfiltrate `/etc/passwd` etc.

---

### P0.2 Slide Requests Bypass Read Permission Check

**Status:** ❌ OPEN
**Ref:** codebase_review CRIT-v24-2
**File:** src/Api/ApiLayersInfo.php (~L103-125)

Slide requests routed before `userCan('read')` check. On private wikis,
anonymous users can read all slide data.

---

### P0.3 Rate Limiting is Effectively Disabled by Default

**Status:** ❌ OPEN
**Ref:** codebase_review CRIT-v24-3
**File:** src/Security/RateLimiter.php (~L68-148)

Default limits defined in PHP but never registered in `$wgRateLimits`.
`$user->pingLimiter()` always returns false. All operations are unthrottled.
v23 incorrectly marked the prior HIGH-6 as "FIXED."

---

### P0.4 preg_replace Backreference Corruption in LayersHtmlInjector

**Status:** ❌ OPEN
**Ref:** codebase_review CRIT-v24-4
**File:** src/Hooks/Processors/LayersHtmlInjector.php (~L209-218)

Layer text containing `$` + digits (e.g. `"$100"`) is silently corrupted
by `preg_replace()` backreference expansion. Affects all page views.

---

## ❌ P1 — High Priority Issues (NEW in v24)

### P1.1 GroupManager Saves History BEFORE State Mutation

**Status:** ❌ OPEN
**Ref:** codebase_review HIGH-v24-1
**File:** resources/ext.layers.editor/GroupManager.js (10 methods)

All group/folder operations have reversed undo behavior. `saveState()` is
called before `stateManager.set()`, capturing the wrong state for undo.

---

### P1.2 Double Rotation for Polygon/Star in Blur Blend Mode

**Status:** ❌ OPEN
**Ref:** codebase_review HIGH-v24-2
**File:** resources/ext.layers.shared/LayerRenderer.js

Canvas-level rotation AND vertex-angle rotation both applied, producing
2× the specified angle. Only affects blur blend mode rendering path.

---

### P1.3 AlignmentController Incorrect Bounds for 3 Shape Types

**Status:** ❌ OPEN
**Ref:** codebase_review HIGH-v24-3
**File:** resources/ext.layers.editor/canvas/AlignmentController.js

Ellipse, polygon, and star fall through to default case which treats
`x,y` as top-left and reads `width/height` (often 0). Circle is correct.
All alignment/distribution operations broken for these shapes.

---

### P1.4 SetName Validation Inconsistency (Create vs Rename)

**Status:** ❌ OPEN
**Ref:** codebase_review HIGH-v24-4
**Files:** src/Api/ApiLayersRename.php, SetSelectorController.js

PHP: Rename uses `isValid()` (loose), save/delete use `sanitize()` (strict).
Creates orphaned sets with special characters.
JS: Create allows Unicode/spaces, rename allows ASCII only. Sets created
with Unicode names cannot be renamed.

---

### P1.5 Short ID Matching Inconsistency (Prefix vs Suffix)

**Status:** ❌ OPEN
**Ref:** codebase_review HIGH-v24-5
**Files:** LayerInjector.php (~L178), ImageLinkProcessor.php (~L456)

LayerInjector uses `substr($id, 0, 4)` (prefix), ImageLinkProcessor uses
`str_ends_with()` (suffix). Same wikitext selects different layers.

---

### P1.6 `noedit` Bare Flag Silently Ignored

**Status:** ❌ OPEN
**Ref:** codebase_review HIGH-v24-6
**File:** src/Hooks/SlideHooks.php (~L249-268)

Documented syntax `{{#Slide: Name | noedit}}` doesn't work.
`parseArguments()` only parses `key=value` pairs. No else branch.

---

### P1.7 Missing Import Sanitization

**Status:** ❌ OPEN
**Ref:** codebase_review HIGH-v24-7
**File:** resources/ext.layers.editor/ImportExportManager.js

Imported JSON layers not validated. `__proto__` injection possible.
Server validates on save, but client operates on unsanitized data.

---

### P1.8 SVG Validation Misses SVG2 `href` Attribute

**Status:** ❌ OPEN
**Ref:** codebase_review HIGH-v24-8
**File:** src/Validation/ServerSideLayerValidator.php (~L1273)

Only checks `xlink:href` for external URLs. SVG2 `href` (no namespace)
is unchecked. Mitigated by canvas rendering (not DOM injection).

---

### P1.9 RenderCoordinator Hash Only Checks First 20 Layers

**Status:** ❌ OPEN
**Ref:** codebase_review HIGH-v24-9
**File:** resources/ext.layers.editor/canvas/RenderCoordinator.js (~L198)

Layers 21-100 are invisible to the change-detection hash. Modifications
to deeper layers don't trigger re-render via targeted scheduleRedraw().

---

### P1.10 CanvasRenderer Missing try/finally for Context Swap

**Status:** ❌ OPEN
**Ref:** codebase_review HIGH-v24-10
**File:** resources/ext.layers.editor/CanvasRenderer.js (~L500)

If drawLayerWithEffects() throws during export, renderer context is
permanently corrupted. No recovery path.

---

### P1.11 CanvasRenderer richText Cache Hash Truncation

**Status:** ❌ OPEN
**Ref:** codebase_review HIGH-v24-11
**File:** resources/ext.layers.editor/CanvasRenderer.js (~L170)

richText JSON truncated to 200 chars in cache key. Edits past 200th
character produce same hash, serving stale cached canvas.

---

## ✅ Previously Reported Issues — Fixed (v22/v23)

### All P0 (Critical) from v22 — FIXED

| Issue | Fixed In | Description |
|-------|----------|-------------|
| getDBLoadBalancer() | v22 | Migrated to getConnectionProvider() |
| TextSanitizer bypass | v22 | Iterative loop prevents nesting bypass |
| Schema unique key | v22 | ls_name included in unique constraint |

### All P1 (High) from v22 — FIXED

| Issue | Fixed In | Description |
|-------|----------|-------------|
| CSP unsafe-eval | v22 | Uses script-src 'self' only |
| Canvas pool memory | v22 | Properly frees canvas.width/height |
| InlineTextEditor input | v22 | Uses _getPlainTextFromEditor() |
| Lightbox URLs | v22 | Uses Special:Redirect fallback |
| ViewerOverlay listeners | v22 | All listeners cleanly removed |
| Rate limiter defaults | v22 | Defaults defined (but see P0.3 caveat) |
| Normalizer properties | v22 | blurRadius, tailWidth added |
| Hardcoded /wiki/ path | v22 | Uses Title::getLocalURL() |
| DB CHECK constraint | v22 | Removed hardcoded limit |
| Gradient radius | v22 | Client/server aligned to 0-2 |
| Path point cap | v22 | Client-side cap added |

---

## ❌ P2 — Medium Priority Issues (Open)

### P2.1 Rate Limiting After DB Work in Slide Operations
**Ref:** MED-v24-1. Rate limit checked AFTER DB lookups in slide methods.

### P2.2 ext.layers Module Loaded on Every Page View (2x)
**Ref:** MED-v24-2. Unconditional addModules in two hooks. Performance impact.

### P2.3 EditLayersAction Custom CSP Conflicts with MW CSP
**Ref:** MED-v24-3. Raw header may break ResourceLoader scripts.

### P2.4 LayeredThumbnail Doesn't Call Parent Constructor
**Ref:** MED-v24-4. Parent properties uninitialized.

### P2.5 EditLayersAction Uses $wgUploadPath Global
**Ref:** MED-v24-5. Should use config service.

### P2.6 UIHooks Date Formatting Not Localized
**Ref:** MED-v24-6. English-only dates for all users.

### P2.7 SpecialEditSlide No backgroundColor Validation
**Ref:** MED-v24-7. Unvalidated URL param passed to JS.

### P2.8 ApiLayersInfo Doesn't Sanitize setname
**Ref:** MED-v24-8. Inconsistent with other endpoints.

### P2.9 StateManager Potential Reentrant Loop
**Ref:** MED-v24-9. No recursion depth limit.

### P2.10 InlineTextEditor Blur Handler Race Condition
**Ref:** MED-v24-10. 150ms vs 100ms timeout race.

### P2.11 SmartGuidesController Snap Cache Too Coarse
**Ref:** MED-v24-11. Layer moves don't invalidate snap cache.

### P2.12 LayersEditor.addLayer() Mutates State In-Place
**Ref:** MED-v24-12. Same array reference, observers skip notification.

### P2.13 Blur Blend Creates Full Canvas Per Frame
**Ref:** MED-v24-13. 16MB allocation per blur layer per frame.

### P2.14 DrawingController Ellipse Preview Drift
**Ref:** MED-v24-14. Center coordinate drifts during drag.

### P2.15 ResizeCalculator Wrong Diagonal Handle Direction
**Ref:** MED-v24-15. OR-logic vs dot product for grow/shrink.

### P2.16 Double HTML Escaping in SlideHooks
**Ref:** MED-v24-16. Background color double-escaped.

---

## ⚠️ P3 — Low Priority Issues (Deferred)

### P3.1 6x Code Duplication of getFileSha1()/isForeignFile()
### P3.2 ParserHooks.php Is Dead Code
### P3.3 UIHooks Excessive Defensive Coding for MW 1.44+
### P3.4 WikitextHooks Logs Wikitext Preview at Info Level
### P3.5 Hooks.php Checks Both `layers` and `Layers` URL Params
### P3.6 ColorValidator Duplicated Validation Logic
### P3.7 Database Cache Stores Null Results
### P3.8 LayersSchemaManager.CURRENT_VERSION Stale (0.8.1-dev)
### P3.9 RateLimiter Uses wfLogWarning Instead of PSR-3 Logger
### P3.10 LayersSchemaManager Constructor Uses Service Locator
### P3.11 applyPatch Schema Update Pattern Is Fragile
### P3.12 Inconsistent Error Response Patterns Across API Modules
### P3.13 Duplicated GradientRenderer Lookup in ShapeRenderer
### P3.14 Non-Cryptographic Layer ID Generation

---

## Documentation Issues

### HIGH (Factually Wrong / Misleading)

| ID | File | Issue |
|----|------|-------|
| DOC-1 | docs/ARCHITECTURE.md | Phantom `action=slideinfo` and `action=slidessave` API endpoints documented — do NOT exist |
| DOC-2 | docs/ARCHITECTURE.md | Phantom `createlayers` permission listed — does not exist in extension.json |
| DOC-3 | README.md, Mediawiki-Extension-Layers.mediawiki | Ghost configs `$wgLayersContextAwareToolbar` and `$wgLayersRejectAbortedRequests` — not in extension.json |
| DOC-4 | wiki/Home.md | "What's New in v1.5.52" lists wrong features (doesn't match CHANGELOG) |
| DOC-5 | wiki/Home.md | "v1.5.51 Highlights" misattributed — features are from v1.5.50 |
| DOC-6 | wiki/Home.md | "v1.5.49 Highlights" fabricated — features don't match CHANGELOG |
| DOC-7 | codebase_review.md (v23) | DOC-1 and DOC-2 were false positives (badge and date were already correct) |
| DOC-8 | docs/SLIDE_MODE.md | `lock` parameter extensively documented but NOT IMPLEMENTED |
| DOC-9 | docs/ARCHITECTURE.md | Says "4 API endpoints" — there are 5 |
| DOC-10 | docs/RELEASE_GUIDE.md | References `Mediawiki-Extension-Layers.txt` — wrong extension (.mediawiki) |
| DOC-11 | docs/ARCHITECTURE.md | Namespace version shows `0.8.5` — should be 1.5.52 |

### MEDIUM (Outdated / Incomplete)

| ID | File | Issue |
|----|------|-------|
| DOC-12 | README.md, Mediawiki-Extension-Layers.mediawiki | Missing `$wgLayersMaxComplexity` config |
| DOC-13 | README.md, Mediawiki-Extension-Layers.mediawiki | Missing all 6 Slide Mode configs |
| DOC-14 | docs/ARCHITECTURE.md | Stale line counts (100+ lines off for many modules) |
| DOC-15 | docs/ARCHITECTURE.md | Stale PHP line count (11,758 vs actual ~14,946) |
| DOC-16 | docs/NAMED_LAYER_SETS.md | Reads as proposal, not implementation doc. "Open Questions" for completed features. |
| DOC-17 | docs/NAMED_LAYER_SETS.md | Says "10-20 sets" but config default is 15 |
| DOC-18 | docs/SLIDE_MODE.md | Status says "Partially Implemented" but all 3 phases show ✅ COMPLETED |
| DOC-19 | docs/SLIDE_MODE.md | Phase 4 says to bump to 1.6.0 — current is 1.5.52 |
| DOC-20 | docs/FUTURE_IMPROVEMENTS.md | FR-14 (Draggable Dimension Tool) marked "Proposed" but implemented in v1.5.50 |
| DOC-21 | docs/DEVELOPER_ONBOARDING.md | Stale line counts for DialogManager and RevisionManager |
| DOC-22 | docs/API.md | Filename misleading — contains JSDoc output, not HTTP API docs |
| DOC-23 | docs/ACCESSIBILITY.md | Missing Marker (M) and Dimension (D) tool shortcuts |
| DOC-24 | README.md | Configuration section lists `$wgLayersUseBinaryOverlays` — not in extension.json |
| DOC-25 | README.md | Drawing tool table says "15 tools" but lists 16 rows |
| DOC-26 | docs/DOCUMENTATION_UPDATE_GUIDE.md | Missing Slide Mode configs from update checklist |
| DOC-27 | README.md | Test coverage date inconsistency (Feb 2 vs Feb 6) |
| DOC-28 | wiki/Home.md | 15+ "What's New" sections — consider trimming pre-v1.5.30 |
| DOC-29 | SECURITY.md | No mention of Slide Mode security considerations |
| DOC-30 | docs/DOCUMENTATION_UPDATE_GUIDE.md | Says "11 Files Rule" but procedure has 14 steps |

### LOW (Style / Formatting)

| ID | File | Issue |
|----|------|-------|
| DOC-31 | CHANGELOG.md | Unreleased section has exact test count (instantly stale) |
| DOC-32 | CHANGELOG.md | Em dash vs hyphen inconsistency |
| DOC-33 | CONTRIBUTING.md | Near-threshold files list missing PropertiesForm (~994) |
| DOC-34 | docs/ACCESSIBILITY.md | "Last Updated: February 2026" without specific day |
| DOC-35 | docs/DEVELOPER_ONBOARDING.md | "Last Updated: February 2026" without specific day |
| DOC-36 | docs/WIKITEXT_USAGE.md | No mention of `{{#Slide:}}` syntax |
| DOC-37 | docs/NAMED_LAYER_SETS.md | "Version: 1.1" ambiguous — document or extension? |
| DOC-38 | docs/RELEASE_GUIDE.md | Example version `1.3.2` is very outdated |
| DOC-39 | docs/RELEASE_GUIDE.md | Version history table has only one entry |
| DOC-40 | docs/FUTURE_IMPROVEMENTS.md | FR-16 marked ✅ but full implementation plan still below |
| DOC-41 | docs/FUTURE_IMPROVEMENTS.md | Inconsistent section numbering |
| DOC-42 | docs/KNOWN_ISSUES.md (v23) | Garbled emoji "📝" in heading (encoding issue) |
| DOC-43-50 | Various | Minor date/count inconsistencies across wiki pages |

---

## Test Coverage

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Statement | 95.19% | 90% | ✅ Exceeds |
| Branch | 84.96% | 85% | ✅ At target |
| Functions | 93.67% | 90% | ✅ Exceeds |
| Lines | 95.32% | 90% | ✅ Exceeds |

All coverage targets met or exceeded.
