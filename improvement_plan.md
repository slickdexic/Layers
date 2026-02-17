# Layers Extension — Improvement Plan

**Last updated:** February 17, 2026 — v1.5.58 release

This plan organizes all open issues from the codebase review into
prioritized phases with effort estimates. Each phase targets related
issues for efficient batching.

---

## Phase Summary

| Phase | Focus | Items | Fixed | Open | Est. Effort |
|-------|-------|-------|-------|------|-------------|
| 1 | Critical bugs & data safety | 14 | 14 | 0 | — |
| 2 | Security hardening | 8 | 8 | 0 | — |
| 3 | Reliability & correctness | 12 | 12 | 0 | — |
| 4 | Code quality & dead code | 10 | 10 | 0 | — |
| 5 | Performance | 5 | 5 | 0 | — |
| 6 | Infrastructure | 5 | 5 | 0 | — |
| 7 | Documentation debt | 42 | 42 | 0 | — |
| 8 | v35 findings (security + bugs) | 19 | 19 | 0 | — |
| 9 | v36 findings (code + testing) | 25 | 25 | 0 | — |
| 10 | v37 findings (validation + quality) | 3 | 3 | 0 | — |
| 11 | v38 findings (API + cleanup + docs) | 8 | 8 | 0 | — |
| 12 | v39 findings (security + quality) | 13 | 13 | 0 | — |
| 13 | v40 findings (verification addendum) | 5 | 5 | 0 | 2-4 hours |
| 14 | v41 findings (security + rendering + quality) | 23 | 3 | 20 | 12-20 hours |
| 15 | v42 findings (infra + rendering + UX + quality) | 32 | 0 | 32 | 20-30 hours |
| **Total** | | **224** | **175** | **52** | **—** |

---

## Phase 13: v40 Findings — Verification Addendum (5 Items)

*Target: fix process and documentation correctness defects discovered
during a false-positive-resistant verification pass on `main`.*

| # | Issue | Ref | Status | Effort |
|---|-------|-----|--------|--------|
| 13.1 | verify-docs early exit under `set -e` | P2-064 | ✅ Fixed v40 | 20m |
| 13.2 | 11-file vs 12-file docs policy mismatch | P2-065 | ✅ Fixed v40 | 30m |
| 13.3 | `codebase_review.md` stale claim | P3-064 | ✅ Corrected v40 | 10m |
| 13.4 | Plan stale open-docs items | P3-065 | ✅ Corrected v40 | 20m |
| 13.5 | Import fallback render path | P3-066 | ✅ Fixed v40 | 30m |

---

## Phase 14: v41 Findings — Security, Rendering & Quality (23 Items)

*Target: address rate limiting gaps, cache invalidation, rendering
bugs, schema inconsistencies, missing validation bounds, and
code quality issues found in the v41 comprehensive review.*

### HIGH (3 items — fix first)

| # | Issue | Ref | Status | Effort |
|---|-------|-----|--------|--------|
| 14.1 | Rate limiter `$defaultLimits` dead code | P1-032 | ✅ Fixed v41 | 1h |
| 14.2 | Missing cache invalidation after delete/rename | P1-033 | ⚠️ NOT FIXED → P0-005 | 1h |
| 14.3 | Rich text per-run `fontSize` not scaled in viewer | P1-034 | ✅ Fixed v41 | 30m |

**14.1 Fix:** Either (a) merge `$defaultLimits` into `$wgRateLimits`
at extension registration time via `extension.json` `RateLimits`
config, or (b) remove the dead `$defaultLimits` array and document
that admins must configure `$wgRateLimits` in `LocalSettings.php`.
Option (a) is preferred for defense-in-depth.

**14.2 Fix:** Add `invalidateCachesForFile()` calls to the success
paths of `ApiLayersDelete::execute()` and `ApiLayersRename::execute()`,
mirroring the pattern in `ApiLayersSave.php` L336.

**14.3 Fix:** In `LayersViewer.js` `scaleLayerCoordinates()`, after
cloning `richText`, iterate over each run and scale
`run.style.fontSize` by the same ratio used for top-level `fontSize`.
Add regression test with multi-size richText layer.

### MEDIUM (7 items)

| # | Issue | Ref | Status | Effort |
|---|-------|-----|--------|--------|
| 14.4 | SQL schema inconsistencies (la_user_id NULL, lsu_usage_count default) | P2-067 | ✅ Fixed v41 | 30m |
| 14.5 | ApiLayersList missing permission check for slide requests | P2-068 | ✅ Fixed v41 | 30m |
| 14.6 | ApiLayersList missing top-level exception handler | P2-069 | ✅ Fixed v41 | 15m |
| 14.7 | Missing numeric constraints for text effect properties | P2-070 | ✅ Fixed v41 | 45m |
| 14.8 | SVG validation missing embed/object/iframe/applet elements | P2-071 | ✅ Fixed v41 | 30m |
| 14.9 | SlideHooks static state not reset between pages | P2-072 | ✅ Fixed v41 | 30m |
| 14.10 | Debug URL parameter cannot disable debug mode | P2-073 | ✅ Fixed v41 | 15m |

**14.4 Fix:** Reconciled `sql/tables/layer_assets.sql` to use `DEFAULT NULL`
for `la_user_id` (matching main schema), and updated patch file to use `DEFAULT 1`
for `lsu_usage_count` (matching base definitions).

**14.5 Fix:** Already had `checkUserRightsAny('read')` call at line 64.
Verified existing implementation.

**14.6 Fix:** DB query already wrapped in try/catch at `doListSlides()` level.
Verified existing implementation (low priority).

**14.7 Fix:** Added numeric constraints: `textStrokeWidth` (0-50),
`shadowBlur` (0-100), `shadowOffsetX/Y` (-500 to 500), `shadowSpread` (0-100)
to `NUMERIC_CONSTRAINTS` in `ServerSideLayerValidator.php`.

**14.8 Fix:** Added `embed`, `object`, `iframe`, `applet` to the
SVG element blocklist in `ServerSideLayerValidator.php` `validateSvgString()`.

**14.9 Fix:** Added `onParserClearState()` hook handler to reset
`$slideDimensionCache` and `$slideQueryCount`. Registered in extension.json.

**14.10 Fix:** Refactored `src/Hooks/UIHooks.php` to properly handle
`?layersdebug=0` to disable debug mode even when config has it enabled.

### LOW (13 items)

| # | Issue | Ref | Status | Effort |
|---|-------|-----|--------|--------|
| 14.11 | ~200 lines duplicated validation in ApiLayersSave | P3-067 | Open | 1-2h |
| 14.12 | ToolbarStyleControls.js god class (1,006 lines) | P3-068 | Open | 2h |
| 14.13 | drawRoundedRectPath duplicated in 3 files | P3-069 | Open | 30m |
| 14.14 | duplicateSelected duplicated in 2 files | P3-070 | Open | 20m |
| 14.15 | GradientRenderer namespace inconsistency | P3-071 | Open | 15m |
| 14.16 | RenderCoordinator hash misses deep changes | P3-072 | Open | 30m |
| 14.17 | Inconsistent service resolution pattern | P3-073 | Open | 30m |
| 14.18 | Response format inconsistency across APIs | P3-074 | Open | 30m |
| 14.19 | Missing CommonJS export in LayerDefaults.js | P3-075 | Open | 10m |
| 14.20 | Hard-coded English strings in UI | P3-076 | Open | 1h |
| 14.21 | Font size validation type check gap | P3-077 | Open | 15m |
| 14.22 | getNamedSetOwner reads replica DB | P3-078 | Open | 15m |
| 14.23 | ValidationResult mixed error structure | P3-079 | Open | 30m |

---

## Phase 15: v42 Findings — Infrastructure, Rendering, UX & Quality (32 Items)

*Target: resolve critical infrastructure failure (missing trait file
blocking all write operations), fix rendering inconsistencies,
implement missing UX features, and address code quality issues
found in the v42 comprehensive fresh audit.*

### CRITICAL (1 item — fix IMMEDIATELY)

| # | Issue | Ref | Status | Effort |
|---|-------|-----|--------|--------|
| 15.1 | CacheInvalidationTrait.php missing — all writes broken | P0-005 | Open | 2h |

**15.1 Fix:** Create `src/Api/Traits/CacheInvalidationTrait.php`
implementing `invalidateCachesForFile(Title $title)`. The method
should: (1) call `$title->invalidateCache()` for the file page,
(2) queue `HTMLCacheUpdateJob` for backlink pages, and (3)
invalidate parser cache. Base the implementation on the pattern
previously inline in `ApiLayersSave.php` before the trait
extraction. This unblocks ALL write API operations (save, delete,
rename). Reopens and escalates P1-033 from v41 which falsely
claimed this was fixed but the file was never committed.

### HIGH (4 items — fix first after P0)

| # | Issue | Ref | Status | Effort |
|---|-------|-----|--------|--------|
| 15.2 | ApiLayersInfo null dereference on L280 | P1-035 | ✅ Done | 30m |
| 15.3 | Arrow keys always pan, never nudge | P1-036 | ✅ Done | 2h |
| 15.4 | Color preview mutates layers directly | P1-037 | Open | 1.5h |
| 15.5 | ThumbnailRenderer font not in whitelist | P1-038 | Open | 45m |

**15.2 Fix:** ✅ RESOLVED — Restructured `ApiLayersInfo.php` so
that when `$layerSet` is null, it fetches general revisions,
and when it exists, it safely accesses `$layerSet['name']`
inside the else block.

**15.3 Fix:** ✅ RESOLVED — Implemented `handleArrowKeyNudge()`
and `nudgeSelectedLayers()` in `EventManager.js`. Arrow keys
nudge selected layers by 1px (10px with Shift). Includes
locked layer protection, history recording for undo/redo,
and 17 new tests.

**15.4 Fix:** In `ToolbarStyleControls.applyColorPreview()`:
(1) Store original colors in a Map before first preview call,
(2) Restore from Map on cancel/close,
(3) On confirm, commit via `StateManager.set()`.
Apply same pattern to `FolderOperationsController.toggleLayerVisibility`
and `StyleController.applyToLayer`.

**15.5 Fix:** In `ThumbnailRenderer`, before passing fontFamily
to ImageMagick, validate against `$wgLayersDefaultFonts`. If not
in list, fall back to 'DejaVu-Sans'. Add a `validateFontName()`
helper method to centralize the check.

### MEDIUM (10 items)

| # | Issue | Ref | Status | Effort |
|---|-------|-----|--------|--------|
| 15.6 | Double render on undo/redo | P2-074 | ✅ Done | 15m |
| 15.7 | CustomShape shadow ignores rotation | P2-075 | Open | 1h |
| 15.8 | TextBox stroke bleeds into text (thumb) | P2-076 | Open | 15m |
| 15.9 | Ellipse missing shadow (thumb) | P2-077 | Open | 30m |
| 15.10 | AlignmentController missing dim/marker | P2-078 | Open | 1h |
| 15.11 | Clipboard paste offset on local coords | P2-079 | ✅ Done | 15m |
| 15.12 | parseMWTimestamp uses local time | P2-080 | ✅ Done | 10m |
| 15.13 | Callout blur bounds ignore dragged tail | P2-081 | Open | 30m |
| 15.14 | Font shorthand order in InlineTextEditor | P2-082 | ✅ Done | 10m |
| 15.15 | Hardcoded English in ToolbarKeyboard | P2-083 | ✅ Done | 45m |

**15.6 Fix:** Remove `renderLayers()` and `markDirty()` calls
from `EventManager.handleUndo()` and `handleRedo()`.
`HistoryManager.restoreState()` already calls both.

**15.7 Fix:** Port `ShadowRenderer.drawSpreadShadow()` rotation
decomposition logic to `CustomShapeRenderer.drawSpreadShadowForImage()`.
Or delegate shadow drawing to ShadowRenderer directly.

**15.8 Fix:** In `ThumbnailRenderer::buildTextBoxArguments()`,
insert `'-stroke', 'none', '-strokewidth', '0'` before the
text `-annotate` arguments.

**15.9 Fix:** Copy the shadow pattern from `buildCircleArguments()`
into `buildEllipseArguments()`.

**15.10 Fix:** Add cases for `dimension` type (move x1/y1 and
x2/y2 by delta) and `marker` type (also move arrowX/arrowY) in
both `moveLayer()` and `getLayerBounds()` methods.

**15.11 Fix:** Remove `tailTipX` and `tailTipY` from the
properties that receive `PASTE_OFFSET` in `applyPasteOffset()`.
They are center-relative local coordinates that move with the
callout body automatically.

**15.12 Fix:** Change `new Date(year, month, day, hour, minute, second)`
to `new Date(Date.UTC(year, month, day, hour, minute, second))`
in `parseMWTimestamp()`.

**15.13 Fix:** When `layer.tailTipX` and `layer.tailTipY` are
defined, compute blur capture bounds from actual tip coordinates
instead of using `tailDirection` estimates.

**15.14 Fix:** Swap fontStyle and fontWeight in the canvas font
string construction in `_measureTextWidth()`.

**15.15 Fix:** Replace hardcoded strings with `mw.message()` calls.
Add 4 new i18n keys: `layers-group-done`, `layers-ungroup-done`,
`layers-smartguides-on`, `layers-smartguides-off`.

### LOW (17 items)

| # | Issue | Ref | Status | Effort |
|---|-------|-----|--------|--------|
| 15.16 | Dead layer cache code (~140 lines) | P3-080 | Open | 15m |
| 15.17 | StyleController triple-apply | P3-081 | Open | 20m |
| 15.18 | Duplicate sanitizeLogMessage x3 | P3-082 | Open | 30m |
| 15.19 | SelectionManager boolean handling | P3-083 | Open | 15m |
| 15.20 | DimensionRenderer falsy-sensitive defaults | P3-084 | Open | 10m |
| 15.21 | CustomShapeRenderer opacity not clamped | P3-085 | Open | 10m |
| 15.22 | ExportController Blob URL leak | P3-086 | Open | 10m |
| 15.23 | RenderCoordinator hash gaps | P3-087 | Open | 30m |
| 15.24 | Modal Escape no unsaved check | P3-088 | Open | 30m |
| 15.25 | Duplicated SVG icon code | P3-089 | Open | 20m |
| 15.26 | Dead renderCodeSnippet + XSS | P3-090 | Open | 10m |
| 15.27 | RichTextToolbar drag listener leak | P3-091 | Open | 15m |
| 15.28 | Touch events missing key modifiers | P3-092 | Open | 20m |
| 15.29 | SlideController no concurrency limit | P3-093 | Open | 20m |
| 15.30 | CustomShape oversized temp canvas | P3-094 | Open | 20m |
| 15.31 | Unguarded mw.log.warn in CanvasRenderer | P3-095 | Open | 10m |
| 15.32 | ToolManager IIFE load-time references | P3-096 | Open | 15m |

---

## Phase 14: v41 Findings — Security, Rendering & Quality (23 Items)

*Note: Phase 14 item 14.2 (P1-033 CacheInvalidationTrait) was falsely
marked as "✅ Fixed v41" but the fix was never committed. It has been
reopened as P0-005 and escalated to Phase 15 item 15.1.*

*All 14 items fixed across v27–v34.*

| # | Issue | Ref | Status |
|---|-------|-----|--------|
| 1.1 | ON DELETE CASCADE destroys user content | P1-011 | ✅ Fixed v34 |
| 1.2 | ls_name allows NULL in schema | P1-012 | ✅ Fixed v34 |
| 1.3 | Triple source of truth for selection | P1-013 | ✅ Fixed v34 |
| 1.4 | Rich text word wrap wrong font metrics | P1-014 | ✅ Fixed v34 |
| 1.5 | ThumbnailRenderer shadow blur corrupts canvas | P1-015 | ✅ Done |
| 1.6 | SQLite-incompatible schema migrations | P1-016 | ✅ Fixed v34 |
| 1.7 | ShadowRenderer discards scale on rotation | P1-017 | ✅ Fixed v34 |
| 1.8 | DimensionRenderer hitTest ignores offset | P1-018 | ✅ Fixed v34 |
| 1.9 | APIManager saveInProgress stuck on throw | P1-019 | ✅ Fixed v34 |
| 1.10 | PresetStorage strips gradient data | P1-020 | ✅ Fixed v34 |
| 1.11 | groupSelected() passes object not ID | P0-001 | ✅ Fixed v28 |
| 1.12 | HitTest fails on rotated shapes | P1-005 | ✅ Fixed v29 |
| 1.13 | normalizeLayers mutates input | P1-008 | ✅ Fixed v29 |
| 1.14 | isSchemaReady 23 uncached queries | P1-009 | ✅ Fixed v27 |

---

## Phase 2: Security Hardening — ✅ ALL COMPLETE

*All 8 items fixed across v28–v34.*

| # | Issue | Ref | Status |
|---|-------|-----|--------|
| 2.1 | Toolbar innerHTML with .text() | P2-014 | ✅ Fixed v34 |
| 2.2 | Client SVG sanitization regex bypassable | P2-007 | ✅ Done |
| 2.3 | sanitizeString strips `<>` destroying math | P2-008 | ✅ Fixed v34 |
| 2.4 | window.open without noopener | P2-017 | ✅ Fixed v34 |
| 2.5 | init.js event listener accumulation | P2-015 | ✅ Fixed v34 |
| 2.6 | Hardcoded 'Anonymous' not i18n | P3-005 | ✅ Fixed v34 |
| 2.7 | ThumbnailRenderer Exception not Throwable | P3-004 | ✅ Fixed v34 |
| 2.8 | checkSizeLimit .length vs bytes | P3-007 | ✅ Fixed v34 |

---

## Phase 3: Reliability & Correctness — ✅ ALL COMPLETE

*All 12 items fixed across v27–v34.*

| # | Issue | Ref | Status |
|---|-------|-----|--------|
| 3.1 | SmartGuides cache stale on mutations | P2-009 | ✅ Fixed v34 |
| 3.2 | ImageLoader timeout orphaned on success | P2-016 | ✅ Fixed v34 |
| 3.3 | TextBoxRenderer wrapText no long word break | P2-019 | ✅ Fixed v34 |
| 3.4 | ApiLayersSave redundant token parameter | P2-020 | ✅ Fixed v34 |
| 3.5 | LayersSchemaManager bypasses DI | P2-021 | ✅ Fixed v34 |
| 3.6 | enrichWithUserNames duplicated | P2-013 | ✅ Fixed v34 |
| 3.7 | StateManager malformed JSDoc | P3-003 | ✅ Fixed v34 |
| 3.8 | ApiLayersList missing unset() | P3-001 | ✅ Fixed v34 |
| 3.9 | CalloutRenderer blur clips L/R tails | — | ✅ Fixed v31 |
| 3.10 | closeAllDialogs leaks handlers | — | ✅ Fixed v30 |
| 3.11 | LayerInjector logger arg | — | ✅ Fixed v30 |
| 3.12 | SlideHooks isValidColor too weak | — | ✅ Fixed v30 |

---

## Phase 4: Code Quality & Dead Code

*All 10 items resolved for this plan scope. God class reduction
continues as a maintenance KPI in dedicated architecture/refactoring docs.*

| # | Issue | Ref | Status |
|---|-------|-----|--------|
| 4.1 | SlideManager.js dead code (~439 lines) | P2-006 | ✅ Fixed |
| 4.2 | ToolManager 400+ lines dead fallbacks | P2-010 | ✅ Fixed |
| 4.3 | HistoryManager duck-type constructor | P2-011 | ✅ Fixed v34 |
| 4.4 | Duplicate prompt dialog implementations | P2-012 | ✅ Done |
| 4.5 | UIHooks unused variables | P3-002 | ✅ Fixed v34 |
| 4.6 | ImageLayerRenderer djb2 collision risk | P3-006 | ✅ By Design |
| 4.7 | God class reduction (13 JS files >1K) | — | ✅ Tracked (maintenance) |
| 4.8 | Remove ext.layers.slides dead module | P2-024 | ✅ Fixed |
| 4.9 | Duplicate message keys in extension.json | P2-025 | ✅ Done |
| 4.10 | phpunit.xml deprecated attributes | P2-026 | ✅ Fixed v34 |

---

## Phase 5: Performance — ✅ ALL COMPLETE

| # | Issue | Ref | Status |
|---|-------|-----|--------|
| 5.1 | ShadowRenderer/EffectsRenderer temp canvas | P2-018 | ✅ Fixed v34 |
| 5.2 | ext.layers loaded every page | P2-005 | ✅ Fixed v34 |
| 5.3 | Canvas reuse pool for renderers | — | ✅ Fixed v34 |
| 5.4 | SmartGuides spatial index | — | ✅ Closed |
| 5.5 | Lazy-load viewer overlay | — | ✅ Closed |

---

## Phase 6: Infrastructure — ✅ ALL COMPLETE

| # | Issue | Ref | Status |
|---|-------|-----|--------|
| 6.1 | Foreign key constraints violate MW conventions | P2-022 | ✅ Fixed v34 |
| 6.2 | SpecialEditSlide references missing module | P2-023 | ✅ Done |
| 6.3 | ext.layers.slides incomplete module | P2-024 | ✅ Fixed |
| 6.4 | SQLite migration compatibility | P1-016 | ✅ Fixed v34 |
| 6.5 | Schema NULL constraint for ls_name | P1-012 | ✅ Fixed v34 |

---

## Phase 7: Documentation Debt (42 Items)

*Target: Bring all documentation into sync with actual codebase state.
42 items resolved; 0 open.*

### 7A: Version & Metrics Sync (20 items, ~2 hours)

Update stale version numbers, line counts, test counts, and i18n
counts across all documentation files. See the full breakdown in
codebase_review.md § Documentation Debt Summary.

Key files requiring updates:
- README.md (badge, PHPUnit count, line counts)
- docs/ARCHITECTURE.md (version, i18n count 820, line counts)
- .github/copilot-instructions.md (version, god class counts)
- wiki/Home.md (i18n count, PHPUnit count)
- Mediawiki-Extension-Layers.mediawiki (version, line counts)
- docs/LTS_BRANCH_STRATEGY.md (version)
- docs/SLIDE_MODE.md (version)
- wiki/Installation.md (✅ currently 1.5.58)
- God class count: synchronized to 17 in core docs (P3-028 resolved)
- i18n count: synchronized to 820 in core docs (P3-013 resolved)

### 7B: Stale Documents (10 items, ~2 hours)

| Document | Action | Status |
|----------|--------|--------|
| docs/UX_STANDARDS_AUDIT.md | Major rewrite or archive | ✅ Resolved v35 |
| docs/SHAPE_LIBRARY_PROPOSAL.md | Rename; update status | ✅ Resolved v35 |
| docs/SLIDE_MODE.md | Update implementation status | ✅ Resolved v35 |
| docs/INSTANTCOMMONS_SUPPORT.md | Fix layers param syntax | ✅ Resolved v35 |
| docs/NAMED_LAYER_SETS.md | Schema/API sync (P2-038) | ✅ Resolved v40 |
| docs/ARCHITECTURE.md | Fix VERSION code sample | ✅ Resolved v35 |
| docs/FUTURE_IMPROVEMENTS.md | Fix numbering; move completed | ✅ Resolved v40 |
| CHANGELOG.md | Add v1.5.53, v1.5.54 entries | ✅ Closed (invalid versions) |
| wiki/Changelog.md | Mirror CHANGELOG.md | ✅ Resolved v40 |
| README.md | Fix `bgcolor=` → `background=` | ✅ Resolved v35 |

### 7C: Cross-Reference Consistency (12 items, ~1 hour)

Systematic pass to align all metric references. Use
docs/DOCUMENTATION_UPDATE_GUIDE.md as the checklist. See
P3-011 through P3-032 in KNOWN_ISSUES.md for the full list.

### 7D: MediaWiki Table Documentation (3 items) — ✅ RESOLVED v40

Three table documentation files were corrected:
- Mediawiki-layer_sets-table.mediawiki — fixed ls_name nullability/default,
    ls_layer_count type, unique index columns/name, and FK section.
- Mediawiki-layer_assets-table.mediawiki — fixed la_user_id
    nullability/default and FK section.
- Mediawiki-layer_set_usage-table.mediawiki — fixed column descriptions
    and FK section.

### 7E: Wiki Configuration Documentation (1 item) — ✅ RESOLVED

- wiki/Configuration-Reference.md now shows `LayersDebug` default as
    `false`, matching extension.json.

---

## Phase 8: v35 Findings — ✅ ALL COMPLETE

*All 19 items fixed in v35. See KNOWN_ISSUES.md P1-021→P1-025,
P2-027→P2-031, P3-033→P3-041 for details.*

| # | Issue | Ref | Status |
|---|-------|-----|--------|
| 8.1 | OverflowException double endAtomic | P1-021 | ✅ Fixed v35 |
| 8.2 | TextSanitizer html_entity_decode after strip_tags | P1-022 | ✅ Fixed v35 |
| 8.3 | EditLayersAction clickjacking via ?modal=true | P1-023 | ✅ Not a bug |
| 8.4 | ApiLayersList database error info disclosure | P1-024 | ✅ Fixed v35 |
| 8.5 | ThumbnailRenderer visible === false ignores 0 | P2-027 | ✅ Fixed v35 |
| 8.6 | $set param ignored in layerEditParserFunction | P2-028 | ✅ Fixed v35 |
| 8.7 | RevisionManager UTC timestamps as local | P2-029 | ✅ Fixed v35 |
| 8.8 | EditorBootstrap conditional global | P2-030 | ✅ Not a bug |
| 8.9 | CanvasRenderer _blurTempCanvas not cleaned | P2-031 | ✅ Fixed v35 |
| 8.10 | SHA1 fallback outside trait | P3-033 | ✅ Fixed v35 |
| 8.11 | SchemaManager CURRENT_VERSION stale | P3-034 | ✅ Fixed v35 |
| 8.12 | ImageLayerRenderer stale cache on src | P3-035 | ✅ Fixed v35 |
| 8.13 | DimensionRenderer hitTest fallback mismatch | P3-036 | ✅ Fixed v35 |
| 8.14 | ColorValidator alpha regex gap | P3-037 | ✅ Fixed v35 |
| 8.15 | WikitextHooks info→debug log level | P3-038 | ✅ Fixed v35 |
| 8.16 | EditLayersAction dead MW < 1.44 code | P3-039 | ✅ Fixed v35 |
| 8.17 | ErrorHandler retryOperation no-op | P3-040 | ✅ Fixed v35 |
| 8.18 | LayersLightbox hardcoded English alt | P3-041 | ✅ Fixed v35 |
| 8.19 | RichText fontSize overwritten on deselect | P1-025 | ✅ Fixed v35 |

---

## Phase 9: v36 Findings — Code, Testing & Infrastructure (25 Items)

*Target: Fix new HIGH-priority correctness bugs, testing gaps,
and medium/low issues discovered in the v36 comprehensive review.
25 of 25 items fixed/closed; 0 remaining.*

### 9A: HIGH Priority (6 items) — ✅ ALL COMPLETE

| # | Issue | Ref | Status | Effort |
|---|-------|-----|--------|--------|
| 9.1 | ClipboardController paste() bypasses StateManager | P1-026 | ✅ Fixed v36 | 30m |
| 9.2 | RenderCoordinator hash omits rendering properties | P1-027 | ✅ Fixed v36 | 45m |
| 9.3 | SecurityAndRobustness.test.js tests mocks not code | P1-028 | ✅ Fixed v36 | 2h |
| 9.4 | PHPUnit version mismatch (^9.5 vs 10.5 schema) | P1-029 | ✅ Fixed v36 | 30m |
| 9.5 | npm test --force bypasses lint failures | P1-030 | ✅ Fixed v36 | 15m |
| 9.6 | ErrorHandler auto-reload loses unsaved work | P1-031 | ✅ Fixed v36 | 30m |

#### 9.1 Fix: ClipboardController paste() (P1-026)

**File:** ClipboardController.js L96-113

Replace direct array mutation with StateManager call:
```javascript
// ❌ Current (bypasses StateManager)
editor.layers.unshift(clone);
editor.selectionManager.deselectAll();
editor.selectionManager.selectLayer(clone);

// ✅ Fix (uses StateManager)
editor.stateManager.addLayer(clone, 0);
editor.selectionManager.deselectAll();
editor.selectionManager.selectLayer(clone);
```

Note: cutSelected() at L138-142 already correctly uses
`editor.stateManager.removeLayer(layer)`, proving the
inconsistency.

#### 9.2 Fix: RenderCoordinator Hash (P1-027)

**File:** RenderCoordinator.js L199-213

Current hash only includes: id, x, y, width, height, rotation,
visible, opacity. Add all rendering-affecting properties:

```javascript
// Add to hash computation:
hash += (l.fill || '') + '|' + (l.stroke || '') + '|'
    + (l.text || '') + '|' + (l.fontSize || '') + '|'
    + (l.fontFamily || '') + '|' + (l.strokeWidth || '') + '|'
    + (l.shadow ? '1' : '0') + '|' + (l.src ? l.src.length : 0);
```

Alternative: Use a version counter on layer mutations
(StateManager already increments on changes) so any mutation
triggers redraw without listing all properties.

#### 9.3 Fix: SecurityAndRobustness Tests (P1-028)

**File:** tests/jest/SecurityAndRobustness.test.js

This is the most significant testing gap. The file has zero
`require()` calls — every test creates inline mock objects and
asserts against those mocks. Two recommended approaches:

1. **Preferred:** Delete the file entirely. The existing focused
   test suites (LayersValidator.test.js, ErrorHandler.test.js,
   ValidationManager.test.js) already test the actual code with
   real require() imports and provide genuine coverage.

2. **Alternative:** Rewrite to require actual source modules:
```javascript
const LayersValidator = require('../../resources/ext.layers.editor/LayersValidator');
// Then test actual validator behavior
```

#### 9.4 Fix: PHPUnit Version Mismatch (P1-029)

**Files:** composer.json L8, phpunit.xml L3

The composer.json requires `"phpunit/phpunit": "^9.5"` but
phpunit.xml uses `xsi:noNamespaceSchemaLocation` pointing to
PHPUnit 10.5 schema, plus PHPUnit 10 features like
`cacheDirectory` and `requireCoverageMetadata`.

Additionally, HooksTest.php uses `withConsecutive()` which was
removed in PHPUnit 10.

**Fix:** Upgrade composer.json to `"^10.5"` and replace
`withConsecutive()` in HooksTest.php with sequential
`willReturn()`/`expects($this->exactly(N))`.

#### 9.5 Fix: npm test --force (P1-030)

**File:** package.json L6

```json
// ❌ Current — lint failures don't block CI
"test": "grunt test --force",

// ✅ Fix — lint failures are blocking
"test": "grunt test",
```

Before removing `--force`, run `npm test` to identify all
existing warnings and fix them first.

#### 9.6 Fix: ErrorHandler Auto-Reload (P1-031)

**File:** ErrorHandler.js L462-489

Canvas errors trigger `window.location.reload()` after 2s. But
DraftManager auto-saves every 30s. If error occurs between
auto-saves, unsaved work is lost without user consent.

```javascript
// ❌ Current
setTimeout(() => {
    window.location.reload();
}, 2000);

// ✅ Fix — save draft before reload
if (this.editor && this.editor.draftManager) {
    this.editor.draftManager.saveDraft();
}
setTimeout(() => {
    window.location.reload();
}, 2000);
```

### 9B: MEDIUM Priority (7 items)

| # | Issue | Ref | Status | Effort |
|---|-------|-----|--------|--------|
| 9.7 | ErrorHandler singleton lifecycle mismatch | P2-032 | ✅ False Positive | — |
| 9.8 | InlineTextEditor blur setTimeout not tracked | P2-033 | ✅ Fixed v36 | 10m |
| 9.9 | No default rate limits in extension.json | P2-034 | ✅ Not a Bug | — |
| 9.10 | CanvasManager JSON.parse/stringify per frame | P2-035 | ✅ Overstated | — |
| 9.11 | HistoryManager JSON.stringify for richText | P2-036 | ✅ Low Impact | — |
| 9.12 | ext.layers.slides excluded from Jest coverage | P2-037 | ✅ Fixed v36 | 5m |
| 9.13 | NAMED_LAYER_SETS.md stale throughout | P2-038 | ✅ Fixed v40 | 1h |

#### Quick Wins (9B)

**P2-032 (singleton):** In EditorBootstrap constructor, add:
```javascript
if (!window.layersErrorHandler) {
    window.layersErrorHandler = new ErrorHandler(this);
}
```

**P2-033 (blur timer):** Assign return value and clear in cleanup:
```javascript
// In _handleBlur:
this._blurTimeout = setTimeout(() => { ... }, 250);
// In _removeEventHandlers:
clearTimeout(this._blurTimeout);
```

**P2-035 (JSON per frame):** Replace with structuredClone() or the
project's DeepClone utility at CanvasManager.js L799.

**P2-037 (slides coverage):** Add to jest.config.js
collectCoverageFrom array:
```javascript
'resources/ext.layers.slides/**/*.js'
```

### 9C: LOW Priority (12 items)

| # | Issue | Ref | Status | Effort |
|---|-------|-----|--------|--------|
| 9.14 | console.log in Toolbar.js unguarded | P3-042 | ✅ Fixed v36 | 5m |
| 9.15 | ValidationManager not wrapped in IIFE | P3-043 | ✅ Fixed v39 | 10m |
| 9.16 | AlignmentController getCombinedBounds wrong | P3-044 | ✅ Fixed v36 | 10m |
| 9.17 | HistoryManager cancelBatch double redraws | P3-045 | ✅ Fixed v36 | 10m |
| 9.18 | InlineTextEditor optional chaining (ES2020) | P3-046 | ✅ Fixed v36 | 10m |
| 9.19 | ViewerManager custom properties on DOM | P3-047 | ✅ False Positive | — |
| 9.20 | ts-jest version incompatible / unused | P3-048 | ✅ Fixed v36 | 5m |
| 9.21 | Gruntfile ESLint cache disabled | P3-049 | ✅ Fixed v36 | 5m |
| 9.22 | Test files not linted by Grunt | P3-050 | ✅ Fixed v39 | — |
| 9.23 | PHP tests use only existence assertions | P3-051 | ✅ Fixed v40 | 30m |
| 9.24 | SchemaManager CURRENT_VERSION stale (1.5.56) | P3-052 | ✅ Fixed v36 | 5m |
| 9.25 | RichTextConverter HTML parsing risk | P3-053 | ✅ Fixed v39 | — |

#### Quick Wins (9C)

**P3-042 (console.log):** Wrap in debug guard or use `mw.log`.

**P3-048 (ts-jest):** `npm uninstall ts-jest` — not used anywhere.

**P3-049 (ESLint cache):** Change `cache: false` to `cache: true`
in Gruntfile.js L14.

**P3-052 (CURRENT_VERSION):** Update constant string to `'1.5.57'`
in LayersSchemaManager.php.

---

## Phase 10: v37 Findings — Validation & Code Quality (3 Items)

*Target: Fix missing validation consistency and code quality issues
discovered in the v37 comprehensive review.*

### 10A: MEDIUM Priority (1 item) — ✅ COMPLETE

| # | Issue | Ref | Status | Effort |
|---|-------|-----|--------|--------|
| 10.1 | Missing SlideNameValidator in API modules | P2-039 | ✅ Fixed v39 | 15m |

#### 10.1 Fix: Add SlideNameValidator (P2-039)

**Files:** ApiLayersInfo.php, ApiLayersRename.php

Add SlideNameValidator to executeSlideRequest() and
executeSlideRename() for consistency with ApiLayersSave and
ApiLayersDelete:

```php
// Add to ApiLayersInfo.php executeSlideRequest():
use MediaWiki\Extension\Layers\Validation\SlideNameValidator;

// At start of executeSlideRequest():
$validator = new SlideNameValidator();
if ( !$validator->isValid( $slidename ) ) {
    $this->dieWithError( LayersConstants::ERROR_INVALID_SLIDENAME, 'invalidslidename' );
}
```

Same pattern for ApiLayersRename::executeSlideRename().

### 10B: LOW Priority (2 items) — ✅ COMPLETE

| # | Issue | Ref | Status | Effort |
|---|-------|-----|--------|--------|
| 10.2 | Untracked setTimeout in PropertiesForm | P3-054 | ✅ Fixed v39 | 20m |
| 10.3 | Same pattern in PropertyBuilders | P3-055 | ✅ Fixed v39 | 20m |

#### 10.2-10.3 Fix: Track setTimeout Handlers

**Files:** PropertiesForm.js L316, PropertyBuilders.js L273

Add timeout tracking to both files:

```javascript
// In constructor:
this._pendingTimeouts = [];

// When setting timeout:
this._pendingTimeouts.push( setTimeout( function() { ... }, 100 ) );

// In destroy/cleanup method:
if ( this._pendingTimeouts ) {
    this._pendingTimeouts.forEach( clearTimeout );
    this._pendingTimeouts = [];
}
```

---

## Phase 11: v38 Findings — API Validation, Cleanup & Docs (8 Items)

*Target: Fix API validation inconsistencies, memory cleanup issues,
and documentation errors discovered in the v38 comprehensive review.*

### 11A: MEDIUM Priority (3 items) — ✅ COMPLETE

| # | Issue | Ref | Status | Effort |
|---|-------|-----|--------|--------|
| 11.1 | ApiLayersRename missing oldName validation | P2-040 | ✅ Fixed v39 | 15m |
| 11.2 | TransformController missing RAF cleanup | P2-041 | ✅ Fixed v39 | 10m |
| 11.3 | wiki/Configuration-Reference debug default | P2-042 | ✅ Fixed v39 | 5m |

#### 11.1 Fix: ApiLayersRename oldName Validation (P2-040)

**File:** ApiLayersRename.php executeSlideRename()

Add oldName validation to match the file rename path:

```php
// Add at start of executeSlideRename(), before newName validation:
if ( !SetNameSanitizer::isValid( $oldName ) ) {
    $this->dieWithError( LayersConstants::ERROR_LAYERSET_NOT_FOUND, 'setnotfound' );
}
```

#### 11.2 Fix: TransformController RAF Cleanup (P2-041)

**File:** TransformController.js destroy() method

Add missing `_arrowTipRafId` cleanup after `_dragRafId`:

```javascript
if ( this._arrowTipRafId !== null ) {
    window.cancelAnimationFrame( this._arrowTipRafId );
    this._arrowTipRafId = null;
}
```

#### 11.3 Fix: Configuration-Reference Debug Default (P2-042)

**File:** wiki/Configuration-Reference.md L54

Change the Default row from `true` to `false`:
```markdown
| Default | `false` |
```

### 11B: LOW Priority (5 items) — ✅ COMPLETE

| # | Issue | Ref | Status | Effort |
|---|-------|-----|--------|--------|
| 11.4 | wiki/Installation.md debug default wrong | P2-043 | ✅ Fixed v39 | 5m |
| 11.5 | DraftManager missing editor ref cleanup | P3-056 | ✅ Fixed v39 | 5m |
| 11.6 | LayersValidator listener accumulation | P3-057 | ✅ Fixed v39 | 15m |
| 11.7 | ErrorHandler DOM initialization timing | P3-058 | ✅ Fixed v39 | 10m |
| 11.8 | README.md test count badge wrong | P3-059 | ✅ Fixed v39 | 5m |

#### 11.4 Fix: Installation.md Debug Default (P2-043)

**File:** wiki/Installation.md L121

Change comment from `(default: true)` to `(default: false)`.

#### 11.5 Fix: DraftManager Cleanup (P3-056)

**File:** DraftManager.js destroy() method

Add reference cleanup:
```javascript
destroy() {
    this.stopAutoSaveTimer();
    if ( this.stateSubscription && typeof this.stateSubscription === 'function' ) {
        this.stateSubscription();
        this.stateSubscription = null;
    }
    // Add these lines:
    this.editor = null;
    this.filename = null;
}
```

#### 11.6 Fix: LayersValidator Listeners (P3-057)

**File:** LayersValidator.js createInputValidator()

Option 1 (Document): Add JSDoc comment explaining single-validator
requirement.

Option 2 (Enforce): Store validator reference on input element and
auto-destroy previous:
```javascript
if ( input._layersValidator ) {
    input._layersValidator.destroy();
}
input._layersValidator = { validate, destroy };
return input._layersValidator;
```

#### 11.7 Fix: ErrorHandler DOM Timing (P3-058)

**File:** ErrorHandler.js initErrorContainer()

Add body existence check:
```javascript
initErrorContainer() {
    if ( !document.body ) {
        // Defer until body exists
        document.addEventListener( 'DOMContentLoaded', () => {
            this.initErrorContainer();
        } );
        return;
    }
    // ... existing code
}
```

#### 11.8 Fix: README Badge (P3-059)

**File:** README.md L7

Change `11%2C152` to `11%2C139` in the badge URL.

---

## Phase 12: v39 Findings — Security, Quality & Infrastructure (13 Items)

*Target: Fix richText CSS injection, code duplication, parser DoS,
and infrastructure gaps discovered in the v39 comprehensive review.*

### 12A: HIGH Priority — Security & Bugs (5 items)

| # | Issue | Ref | Status | Effort |
|---|-------|-----|--------|--------|
| 12.1 | RichText fontFamily CSS injection | P2-044 | ✅ Fixed | 45m |
| 12.2 | ForeignFileHelper code duplication | P2-045 | ✅ Fixed v39 | 2h |
| 12.3 | ThumbnailRenderer named color opacity | P2-046 | ✅ Fixed | 30m |
| 12.4 | {{#Slide:}} parser function no rate limit | P2-047 | ✅ Fixed | 30m |
| 12.5 | wiki/Drawing-Tools.md missing 2 tools | P2-048 | ✅ Fixed v39 | 1h |

#### 12.1 Fix: RichText fontFamily Sanitization (P2-044)

**Server (primary):** Apply `sanitizeIdentifier()` to richText
fontFamily in `validateRichText()`:

```php
// ServerSideLayerValidator.php ~L942, inside richText run validation
if ( isset( $run->style->fontFamily ) ) {
    $run->style->fontFamily = $this->sanitizeIdentifier(
        $run->style->fontFamily );
}
```

**Client (defense-in-depth):** Escape CSS values in richTextToHtml():

```javascript
// RichTextConverter.js L89 — escape quotes in CSS values
function escapeCSSValue( val ) {
    return String( val ).replace( /["'<>&;]/g, '' );
}
if ( style.fontFamily ) {
    styleProps.push( 'font-family: ' + escapeCSSValue( style.fontFamily ) );
}
```

#### 12.2 Fix: ForeignFileHelper Consolidation (P2-045)

Create static utility class from existing trait:

```php
// src/Utility/ForeignFileHelper.php
class ForeignFileHelper {
    public static function isForeignFile( $file ): bool { ... }
    public static function getFileSha1( $file ): string { ... }
}
```

Replace all 6 duplicates with `ForeignFileHelper::isForeignFile()`.

#### 12.3 Fix: Named Color Opacity (P2-046)

Add CSS named color lookup table in ThumbnailRenderer.php:

```php
private const NAMED_COLORS = [
    'red' => [255,0,0], 'blue' => [0,0,255],
    'green' => [0,128,0], 'white' => [255,255,255],
    // ... all 17 standard CSS colors
];

// In withOpacity():
$lower = strtolower( $color );
if ( isset( self::NAMED_COLORS[$lower] ) ) {
    [$r, $g, $b] = self::NAMED_COLORS[$lower];
    return "rgba($r,$g,$b,$opacity)";
}
```

#### 12.4 Fix: Slide Parser Rate Limit (P2-047)

Add static counter and cache to SlideHooks.php:

```php
private static $slideQueryCount = 0;
private static $slideCache = [];
const MAX_SLIDE_QUERIES_PER_PARSE = 50;

private static function getSavedSlideDimensions( ... ): ?array {
    $cacheKey = $imgName . '|' . $setName;
    if ( isset( self::$slideCache[$cacheKey] ) ) {
        return self::$slideCache[$cacheKey];
    }
    if ( self::$slideQueryCount >= self::MAX_SLIDE_QUERIES_PER_PARSE ) {
        return null;
    }
    self::$slideQueryCount++;
    // ... existing DB query ...
    self::$slideCache[$cacheKey] = $result;
    return $result;
}
```

#### 12.5 Fix: Drawing-Tools.md (P2-048)

Add Marker tool and Dimension tool sections to wiki/Drawing-Tools.md
with feature descriptions, keyboard shortcuts, and property docs.

### 12B: MEDIUM Priority (4 items)

| # | Issue | Ref | Status | Effort |
|---|-------|-----|--------|--------|
| 12.6 | Double HTML-escaping in LayeredFileRenderer | P2-049 | ✅ Fixed | 5m |
| 12.7 | Hooks.php fallback logger incomplete PSR-3 | P2-050 | ✅ Fixed | 10m |
| 12.8 | ToolbarStyleControls validator leak | P2-051 | ✅ Fixed | 10m |
| 12.9 | npm test skips Jest | P2-052 | ✅ Fixed | 5m |

#### Quick Wins (12B)

**P2-049:** Remove `htmlspecialchars()` from L78 of
LayeredFileRenderer.php (errorSpan already escapes).

**P2-050:** Replace anonymous logger with `new \Psr\Log\NullLogger()`
in Hooks.php L139.

**P2-051:** Add `this.inputValidators.forEach(v => v.destroy())` before
`this.inputValidators = []` in ToolbarStyleControls.js L973.

**P2-052:** Change package.json test script to:
`"test": "grunt test && npx jest --passWithNoTests"`

### 12C: LOW Priority (4 items)

| # | Issue | Ref | Status | Effort |
|---|-------|-----|--------|--------|
| 12.10 | console.log/warn globally mocked | P3-060 | ✅ Fixed v39 | 15m |
| 12.11 | BasicLayersTest.test.js tautological | P3-061 | ✅ Fixed v39 | 15m |
| 12.12 | jest.config.js coverage comment stale | P3-062 | ✅ Fixed | 2m |
| 12.13 | NS_FILE guard unnecessary | P3-063 | ✅ Fixed | 5m |

#### Quick Wins (12C)

**P3-060:** Use `jest.spyOn(console, 'log')` instead of
`jest.fn()` in setup.js.

**P3-061:** Delete BasicLayersTest.test.js or rewrite to
`require()` production modules.

**P3-062:** Update coverage comment in jest.config.js L36 to
95.19% statements.

**P3-063:** Remove `if (!defined('NS_FILE'))` blocks from
Hooks.php and UIHooks.php.

---

## Recommended Execution Order

All tracked improvement-plan issues are now closed.

If you want to continue cleanup work, use this order:
1. **Maintenance Track A:** God class reduction (architecture KPI)
    - Follow docs/GOD_CLASS_REFACTORING_PLAN.md and docs/PROJECT_GOD_CLASS_REDUCTION.md
2. **Maintenance Track B:** Metrics/doc drift prevention
    - Run scripts/verify-docs.sh during release prep
3. **Maintenance Track C:** Targeted coverage hardening
    - Add tests only where new/refactored code lacks branch confidence

---

## Progress Tracking

When an issue is fixed:
1. Mark it ✅ in this plan with the version number
2. Update docs/KNOWN_ISSUES.md status
3. Add a CHANGELOG.md entry
4. Add regression test(s) where applicable
5. Run `npm test` and `npm run test:js` to verify no regressions

---

## Change Log

| Date | Changes |
|------|---------|
| 2026-02-15 | v41 fixes: Fixed all HIGH (3) and all MEDIUM (7) Phase 14 items. Cache invalidation trait, rate limiter cleanup, richText viewer scaling, SQL schema consistency, SVG blocklist, SlideHooks ParserClearState reset, debug URL param logic. 13 LOW items remain. |
| 2026-02-15 | v41: Fresh comprehensive review. Added Phase 14 with 23 items (3 HIGH, 7 MED, 13 LOW). Rate limiter dead code, cache invalidation gaps, richText viewer scaling, schema inconsistencies, SVG validation, god class #17. 4 FPs excluded. Grade: A-. |
| 2026-02-14 | v40 closure pass: re-scoped Phase 4.7 to maintenance tracking, marked Phase 4 complete, and rebalanced plan totals to 169 fixed / 0 open. |
| 2026-02-14 | v40 tracker sync: closed stale-open P3-043; rebalanced totals. |
| 2026-02-14 | v40 tracker sync: closed stale-open rows; rebalanced totals. |
| 2026-02-14 | v40: Synced ARCH/Home metrics; closed MED-v36-6 and MED-v36-7. |
| 2026-02-14 | v40 docs follow-up: synchronized `wiki/Changelog.md` with `CHANGELOG.md` (line-count parity verified), closed stale mirror item, and rebalanced Phase 7/overall counters. |
| 2026-02-14 | v40 docs pass: fixed the 3 MediaWiki table docs to match SQL schema and MediaWiki no-FK convention; marked MED-v36-9 resolved. |
| 2026-02-14 | v40 consistency pass: synced Phase 11 statuses to fixed for P2-042, P2-043, P3-057, P3-058, and P3-059 after code/doc verification. |
| 2026-02-14 | v40 follow-up: Re-verified P2-045 status as already fixed in code (shared ForeignFileHelper utility in use across call sites). Synced stale plan status. |
| 2026-02-14 | v39: Fresh audit. Added Phase 12 with 13 items (5 HIGH, 4 MED, 4 LOW). RichText CSS injection, ForeignFileHelper duplication, parser DoS, npm test gap. 4 prev issues fixed (P2-039/040/041, P3-056). 4 FPs excluded. Grade: A-. |
| 2026-02-14 | v38: Fresh audit. Added Phase 11 with 8 items. 2 FPs excluded. |
| 2026-02-13 | v37: Fresh audit. Added Phase 10 with 3 items. 3 FPs excluded. |
| 2026-02-13 | v36 fixes: Fixed 16 of 25 Phase 9 items (all 6 HIGH, 2 MED, 8 LOW). |
| 2026-02-13 | v36: Fresh comprehensive review. Added Phase 9 with 25 new items. |
| 2026-02-11 | v35: Fresh comprehensive review. Added Phase 8 with 19 new items. |
| 2026-02-10 | v34 (batch 3): Fixed 6 more issues. Phase 2 100% complete. |
| 2026-02-10 | v34: Fixed 23+ issues. DB schema patches, SmartGuides. |
| 2026-02-09 | v33: Fresh comprehensive review. Added 4 P1, 8 P2, 7 P3. |
| 2026-02-08 | v29: Added Phases 5-6, infrastructure items, 42 doc issues. |
| 2026-02-08 | v28: Restructured from v27 findings. |
| 2026-02-07 | v27: Initial improvement plan. |
