# Layers Extension — Improvement Plan

**Last updated:** March 14, 2026 — v1.5.62 (v54 audit, 8 code fixes applied)

This plan now distinguishes between the **verified current backlog** and the
historical phase log retained below. All v49 issues were resolved in v1.5.60.
All v50 issues were resolved in v1.5.61. All v51 issues were resolved in
v1.5.62. All v52 items were fixed during the v52 audit session.
All v53 documentation items were fixed during the v53 audit session.
P3-145 (SpecialSlides.js zero test coverage) resolved — tests now exist.
v54 audit found 26 new items; **8 code fixes applied** (commit 0cba25e2),
1 reclassified as false positive, 1 deferred. **14 documentation drift items
fixed.** 2 items remain open (2 low code deferrals).
Use the section below as the authoritative current backlog.

---

## Verified Current Backlog (Authoritative as of March 14, 2026 — v1.5.62)

| Area | Verified Open Items | Est. Effort |
|------|---------------------|-------------|
| Security | ~~1~~ 0 (P1-057 FIXED) | — |
| PHP Medium | ~~2~~ 0 (P2-124, P2-125 FIXED) | — |
| JS Medium | ~~2~~ 0 (P2-126, P2-127 FIXED) | — |
| PHP Low | 2 (P3-146, P3-147 deferred) | Medium (schema/data migration) |
| JS Low | ~~3~~ 0 (P3-150/151/152 FIXED) | — |
| Documentation | ~~14~~ 0 (D-054-01 thru D-054-14 ALL FIXED) | — |
| **Total** | **2** | |

### Current Priorities (v54 — 16 Open)

| # | Issue | Ref | Priority | Status |
|---|-------|-----|----------|--------|
| 26.01 | IDOR: `id:` prefix fetches any layer set without file check | P1-057 | **HIGH** | ✅ Fixed |
| 26.02 | enrichRowsWithUserNames queries user table directly | P2-124 | MED | ✅ Fixed |
| 26.03 | EditLayersAction set name regex rejects Unicode/spaces | P2-125 | MED | ✅ Fixed |
| 26.04 | Arrow key conflict: simultaneous nudge + pan | P2-126 | MED | ✅ Fixed |
| 26.05 | TextRenderer double shadow on stroke+fill (non-spread) | P2-127 | MED | ✅ Fixed |
| 26.06 | layer_set_usage table dead/unimplemented | P3-146 | Low | 🔲 Deferred |
| 26.07 | buildImageNameLookup redundant SQL variants | P3-147 | Low | 🔲 Deferred |
| 26.08 | LayerValidatorInterface unused in DI | P3-148 | Low | 🔲 Deferred |
| 26.09 | ThumbnailRenderer no own color validation | P3-149 | Low | ❌ False positive |
| 26.10 | ShadowRenderer._tempCanvas grows unboundedly | P3-150 | Low | ✅ Fixed |
| 26.11 | ImageLayerRenderer closures hold ref after destroy | P3-151 | Low | ✅ Fixed |
| 26.12 | EffectsRenderer division by zero in blur fill | P3-152 | Low | ✅ Fixed |
| 26.13 | JS file/line count stale across docs | D-054-01 | Low | ✅ Fixed |
| 26.14 | Test count stale (11,474 → 11,494) | D-054-02 | Low | ✅ Fixed |
| 26.15 | PHP line count stale | D-054-03 | Low | ✅ Fixed |
| 26.16 | God class count stale (23 → 26) | D-054-04 | Low | ✅ Fixed |
| 26.17 | CONTRIBUTING.md grossly stale metrics | D-054-05 | Low | ✅ Fixed |
| 26.18 | ARCHITECTURE.md stale version and metrics | D-054-06 | Low | ✅ Fixed |
| 26.19 | Mediawiki-Extension-Layers.mediawiki multiple issues | D-054-07 | Low | ✅ Fixed |
| 26.20 | LTS_BRANCH_STRATEGY.md stale throughout | D-054-08 | Low | ✅ Fixed |
| 26.21 | SLIDE_MODE_ISSUES.md extremely stale test count | D-054-09 | Low | ✅ Fixed |
| 26.22 | Testing-Guide.md wrong coverage | D-054-10 | Low | ✅ Fixed |
| 26.23 | Architecture-Overview.md stale metrics | D-054-11 | Low | ✅ Fixed |
| 26.24 | Frontend-Architecture.md stale metrics | D-054-12 | Low | ✅ Fixed |
| 26.25 | Home.md stale "What's New" section | D-054-13 | Low | ✅ Fixed |
| 26.26 | Installation.md stale branch versions | D-054-14 | Low | ✅ Fixed |

### v54 Notes

- v53 verification pass: all 4 v53 doc fixes confirmed. P3-145 **resolved**
  (tests now exist at `tests/jest/SpecialSlides.test.js`).
- Full codebase audit (all 41 PHP files, all 156 JS modules, all .md/.mediawiki):
  **1 security HIGH (IDOR), 4 medium bugs, 7 low code issues, 14 doc items.**
- 7 false positives eliminated during verification (boolean normalization,
  XSS in HelpDialog, SVG injection, ClipboardController, EffectsRenderer,
  WikitextHooks, ThumbnailRenderer cache key).
- **8 code fixes applied** (commit 0cba25e2): P1-057, P2-124–P2-127,
  P3-150–P3-152. P3-149 reclassified as false positive.
  P3-146/P3-147/P3-148 deferred (schema/data migration needed or low value).
- Grade restored from A- to **A** after IDOR fix.
- Remaining 2 items: 2 low code deferrals (P3-146, P3-147).

### Current Priorities (v53 — All Fixed/Resolved)

| # | Issue | Ref | Priority | Status |
|---|-------|-----|----------|--------|
| 25.01 | Coverage 92.35% overstated → correct to 91.32% | D-053-01 | Low | ✅ Fixed |
| 25.02 | CHANGELOG.md + wiki/Changelog.md test count 11,450 → 11,474 | D-053-02 | Low | ✅ Fixed |
| 25.03 | codebase_review.md grade section test count 11,450 → 11,474 | D-053-03 | Low | ✅ Fixed |
| 25.04 | i18n count inconsistency (784/778/780) → corrected to 780 | D-053-04 | Low | ✅ Fixed |
| 25.05 | SpecialSlides.js has zero test coverage | P3-145 | Low | ✅ Resolved |

### v53 Notes

- v52 verification pass: all 4 v52 issues confirmed fixed. No regressions.
- Full codebase audit (all 41 PHP files + all major JS modules + docs): **no
  new security vulnerabilities, functional bugs, or logic errors found.**
- 4 documentation inaccuracies found and fixed (coverage overstated, stale
  test counts, i18n count triple inconsistency).
- 1 testing gap found: SpecialSlides.js 0% coverage (open).
- Coverage corrected from claimed 92.35% to actual measured 91.32%.

| # | Issue | Ref | Priority | Status |
|---|-------|-----|----------|--------|
| 24.01 | APIManager.js missing blank line between methods | CODE-052-01 | Low | ✅ Fixed |
| 24.02 | README.md test count 11,445 → 11,450 | D-052-01 | Low | ✅ Fixed |
| 24.03 | codebase_review.md test count 11,445 → 11,450 | D-052-02 | Low | ✅ Fixed |
| 24.04 | codebase_review.md i18n key count 832 → 784 | D-052-03 | Low | ✅ Fixed |

### v52 Notes

- v51 verification pass: both v51 issues confirmed fixed in v1.5.62.
- Full codebase audit (all 41 PHP files + major JS modules): **no new
  security vulnerabilities, functional bugs, or logic errors found.**
- 4 new items found: 1 code style, 3 documentation inaccuracies.
- All 4 fixed same session.

### Current Priorities (v51 — All Fixed in v1.5.62)

| # | Issue | Ref | Priority | Status |
|---|-------|-----|----------|--------|
| 23.01 | ClipboardController paste offset skips angle dim anchors | P3-143 | Low | ✅ Fixed v1.5.62 |
| 23.02 | DrawingController._angleDimensionPhase uninitialized | P3-144 | Low | ✅ Fixed v1.5.62 |

### v51 Notes

- v50 verification pass: all 7 v50 issues confirmed fixed in v1.5.61.
- **2 new items found**: both LOW (canvas clip offset, constructor init).
- **Both fixed in v1.5.62.**
|---|-------|-----|----------|--------|
| 22.01 | SpecialSlides canDelete checks 'delete' not 'layers-admin' | P1-056 | HIGH | ✅ Fixed v1.5.61 |
| 22.02 | Smart guides broken for path layers (incomplete P1-053 fix) | P2-122 | MED | ✅ Fixed v1.5.61 |
| 22.03 | ApiLayersInfo uses deprecated getDBLoadBalancer() API | P2-123 | MED | ✅ Fixed v1.5.61 |
| 22.04 | ARCHITECTURE.md stale coverage 92.19% / 11,421 tests | D-050-01 | Low | ✅ Fixed v1.5.61 |
| 22.05 | CHANGELOG.md v1.5.60 claims wrong coverage 92.19% | D-050-02 | Low | ✅ Fixed v1.5.61 |
| 22.06 | wiki/Changelog.md same stale coverage as D-050-02 | D-050-03 | Low | ✅ Fixed v1.5.61 |
| 22.07 | README.md god-class count contradiction (22 vs 23) | D-050-04 | Low | ✅ Fixed v1.5.61 |

### v50 Notes

- v49 verification pass: all 54 v49 issues confirmed fixed in v1.5.59/v1.5.60.
- **P1-053 partially fixed**: path type still returns `{x:0,y:0}` in
  `_getRefPoint()`. Re-tracked as P2-122.
- **7 new items found**: 1 HIGH, 2 MEDIUM, 4 documentation LOW.
- **All 7 fixed in v1.5.61.**

### v49 Items (All Fixed in v1.5.59/v1.5.60)

| # | Issue | Ref | Status |
|---|-------|-----|--------|
| 21.01 | LayersApiHelperTrait admin check uses page-delete right | P1-045 | ✅ Fixed |
| 21.02 | SpecialSlides.php DB before permission check | P1-046 | ✅ Fixed |
| 21.03 | SpecialEditSlide.php DB before permission check | P1-047 | ✅ Fixed |
| 21.04 | APIManager cache exception hangs Promise forever | P1-048 | ✅ Fixed |
| 21.05 | APIManager .catch() drops jQuery `result` (4 sites) | P1-049 | ✅ Fixed |
| 21.06 | HistoryManager lastSaveHistoryIndex not decremented | P1-050 | ✅ Fixed |
| 21.07 | EditorBootstrap duplicate editors in production | P1-051 | ✅ Fixed |
| 21.08 | ValidationManager wrong bounds vs. server | P1-052 | ✅ Fixed |
| 21.09 | Smart guides non-functional for line/arrow/path/dim | P1-053 | ✅ Fixed (path type → P2-122, v1.5.61) |
| 21.10 | ZoomPanController fitToWindow null parentNode | P1-054 | ✅ Fixed |
| 21.11 | ZoomPanController zoomToFitLayers null parentNode | P1-055 | ✅ Fixed |
| 21.12 | TextSanitizer zero-width space corrupts user text | P2-104 | ✅ Fixed |
| 21.13 | blend property bypasses enum validation | P2-105 | ✅ Fixed |
| 21.14 | usleep() blocking in DB retry loop | P2-106 | ✅ Fixed |
| 21.15 | N+1 user lookup in ApiLayersInfo | P2-107 | ✅ Fixed |
| 21.16 | Cache invalidation errors silently suppressed | P2-108 | ✅ Fixed |
| 21.17 | wfLogWarning() deprecated in RateLimiter | P2-109 | ✅ Fixed |
| 21.18 | ApiLayersRename wrong error code for invalid format | P2-110 | ✅ Fixed |
| 21.19 | parseMWTimestamp fallback uses local timezone | P2-111 | ✅ Fixed |
| 21.20 | RevisionManager mutates currentSetName before load | P2-112 | ✅ Fixed |
| 21.21 | DraftManager auto-save bypasses isRecoveryMode | P2-113 | ✅ Fixed |
| 21.22 | APIManager hardcodes layer limit 100 | P2-114 | ✅ Fixed |
| 21.23 | EventManager nudge bypasses StateManager | P2-115 | ✅ Fixed |
| 21.24 | DraftManager storage key collision | P2-116 | ✅ Fixed |
| 21.25 | CanvasManager emitTransforming RAF post-destroy | P2-117 | ✅ Fixed |
| 21.26 | ZoomPanController animationFrameId stale on complete | P2-118 | ✅ Fixed |
| 21.27 | SelectionRenderer AngleDimensionRenderer per-frame alloc | P2-119 | ✅ Fixed |
| 21.28 | TransformController _arrowTipRafId missing from ctor | P2-120 | ✅ Fixed |
| 21.29 | TransformController text-drag state vars uninitialized | P2-121 | ✅ Fixed |
| 21.30 | Documentation: README/CHANGELOG wrong coverage % | D-049 | ✅ Fixed |
| 21.31 | Documentation: ARCHITECTURE.md god class table gaps | D-049 | ✅ Fixed |
| 19.7 | Missing tests for ViewerIcons module | P3-127 | ✅ Fixed |
| 19.8 | Stale secondary docs cleanup | P2-098 | ✅ Fixed |

### v48 Notes

- Full re-audit of `main` branch; all findings individually verified.
- **3 new bugs found:** 1 HIGH (P1-044, CanvasManager division by zero),
  2 MEDIUM (P2-102 angle dimension, P2-103 arrow tip RAF guards).
- **16 false positives eliminated** during v48 verification rounds.
- God class count corrected from 21 → 23 (3 files newly tracked:
  AngleDimensionRenderer 1,067, CanvasEvents 1,033, CalloutRenderer 1,000).
- PHP lines updated from ~15,161 → ~15,187.
- `npm test` passed with **167 suites / 11,421 tests**.
- i18n key count confirmed at **832** (KNOWN_ISSUES P3-126 fix note, CHANGELOG [Unreleased], and all other sources agree; prior v48 note of 831 was in error).
- All v47 open items carried forward and re-verified as still present.

---

## Phase 22: v50 Findings — Security, Logic & Documentation (7 Items) — ALL FIXED

*All 7 items found in the March 10, 2026 v50 audit were resolved in v1.5.61.*

### PHP HIGH (1 item)

| # | Issue | Ref | Status | Effort |
|---|-------|-----|--------|--------|
| 22.01 | SpecialSlides canDelete checks 'delete' not 'layers-admin' | P1-056 | Fixed v1.5.61 | – |

**22.01 (`SpecialSlides.php` L80):** `$canDelete` is set via
`$permissionManager->userHasRight( $user, 'delete' )`. It should use
`'layers-admin'` (consistent with `LayersApiHelperTrait.php` and the
`ApiLayersDelete` server-side check). Impact: regular editors who only
have `editlayers` cannot see the delete button even when they own the
set; wiki admins with `delete` but not `layers-admin` can see it when
they shouldn't. Fix: change L80 to
`$permissionManager->userHasRight( $user, 'layers-admin' )`.

### Canvas MEDIUM (1 item)

| # | Issue | Ref | Status | Effort |
|---|-------|-----|--------|--------|
| 22.02 | Smart guides broken for path layers | P2-122 | Fixed v1.5.61 | – |

**22.02 (`TransformController.js` `_getRefPoint()`):** The incomplete
P1-053 fix handles `line`, `arrow`, `dimension`, and `angleDimension`
types but not `path`. Path layers store geometry as
`state.points: [{x,y}...]` with no top-level `x`/`y`, so the fallback
`{ x: state.x || 0, y: state.y || 0 }` always returns `{x:0, y:0}`.
Smart guides / snap alignment are therefore non-functional for any path
layer. Fix: add a `path` branch in `_getRefPoint()` that derives `x`/`y`
from `Math.min(...state.points.map(p => p.x))` and
`Math.min(...state.points.map(p => p.y))`, mirroring how other
point-array types are handled.

### PHP MEDIUM (1 item)

| # | Issue | Ref | Status | Effort |
|---|-------|-----|--------|--------|
| 22.03 | ApiLayersInfo uses deprecated getDBLoadBalancer() | P2-123 | Fixed v1.5.61 | – |

**22.03 (`ApiLayersInfo.php` `enrichRowsWithUserNames()` L524–526):**
The P2-107 fix introduced a new `enrichRowsWithUserNames()` method that
calls `MediaWikiServices::getInstance()->getDBLoadBalancer()->getConnection(DB_REPLICA)`.
Both `getDBLoadBalancer()` and `getConnection()` are deprecated in MW
1.44+ (replaced by `getConnectionProvider()->getReplicaDatabase()`). The
class already has a correct `getDb()` helper at L642 that uses the new
API. Fix: replace the inline `MediaWikiServices` call with
`$dbr = $this->getDb();`.

### Documentation LOW (4 items)

| # | Issue | Ref | Status | Effort |
|---|-------|-----|--------|--------|
| 22.04 | ARCHITECTURE.md stale metrics | D-050-01 | Fixed v1.5.61 | – |
| 22.05 | CHANGELOG.md v1.5.60 wrong coverage% | D-050-02 | Fixed v1.5.61 | – |
| 22.06 | wiki/Changelog.md same wrong coverage% | D-050-03 | Fixed v1.5.61 | – |
| 22.07 | README.md god class count contradiction | D-050-04 | Fixed v1.5.61 | – |

**22.04:** `docs/ARCHITECTURE.md` L34–35 says "92.19% statement coverage"
and "11,421 tests in 167 suites"; actual is 91.32%, 11,445 tests, 168
suites. L148 shows stale "95.19%" in a separate table.

**22.05:** `CHANGELOG.md` under `[1.5.60]` states "92.19% statement
coverage". Actual: 91.32%.

**22.06:** `wiki/Changelog.md` under `[1.5.60]` contains the same stale
92.19% figure.

**22.07:** `README.md` L317 says "22 files exceed 1,000 lines"; L384 in
the same file correctly says 23. The section at L317 was not updated when
`CalloutRenderer.js` was added to the god class list.

---

## Phase 21: v49 Findings — Security, Logic & Quality (54 Items) — ALL FIXED

*All 54 items found in the March 10, 2026 v49 audit were resolved in
v1.5.59/v1.5.60. P1-053 was partially fixed (path type remains broken,
re-tracked as P2-122 above).*

### PHP HIGH (3 items)

| # | Issue | Ref | Status | Effort |
|---|-------|-----|--------|--------|
| 21.01 | LayersApiHelperTrait admin check uses page-delete right | P1-045 | Fixed v1.5.60 | – |
| 21.02 | SpecialSlides.php DB query before permission check | P1-046 | Fixed v1.5.60 | – |
| 21.03 | SpecialEditSlide.php DB query before permission check | P1-047 | Fixed v1.5.60 | – |

**21.01:** Introduce `layers-admin` right in `extension.json`. Replace
`$user->isAllowed('delete')` with `$user->isAllowed('layers-admin')` in
`LayersApiHelperTrait.php` L106.

**21.02:** Move `$user->authorizeAction('read')` / `userHasRight()` check
above the `getLayerSetByName()` DB call in `SpecialSlides.php`.

**21.03:** Same reordering fix in `SpecialEditSlide.php`.

### JavaScript HIGH (5 items)

| # | Issue | Ref | Status | Effort |
|---|-------|-----|--------|--------|
| 21.04 | APIManager cache exception hangs Promise | P1-048 | Fixed v1.5.60 | – |
| 21.05 | APIManager .catch() drops jQuery result (4 sites) | P1-049 | Fixed v1.5.60 | – |
| 21.06 | HistoryManager lastSaveHistoryIndex not decremented | P1-050 | Fixed v1.5.60 | – |
| 21.07 | EditorBootstrap duplicate editors in production | P1-051 | Fixed v1.5.60 | – |
| 21.08 | ValidationManager wrong bounds vs. server | P1-052 | Fixed v1.5.60 | – |

**21.04:** Move `return;` inside the `try` block in `APIManager.js`
`loadRevisionById` cache-hit path so the catch falls through to the
network fetch.

**21.05:** Change `.then(s).catch(f)` to `.then(s, f)` at all four
call sites (L315, L640, L815, L975) to preserve jQuery deferred rejection
args.

**21.06:** After `history.shift()` in `HistoryManager.saveState()`, add:
`if (this.lastSaveHistoryIndex > 0) { this.lastSaveHistoryIndex--; }
else { this.lastSaveHistoryIndex = -1; }`

**21.07:** Move `window.layersEditorInstance = editor` in
`EditorBootstrap.js` outside the `if (debug)` guard so all code paths
register the instance.

**21.08:** In `ValidationManager.js` L240: `fontSize < 1`.
L246: `strokeWidth > 100`.

### Canvas HIGH (3 items)

| # | Issue | Ref | Status | Effort |
|---|-------|-----|--------|--------|
| 21.09 | Smart guides non-functional for line/arrow/path/dim | P1-053 | Partial v1.5.59 (path → P2-122) | – |
| 21.10 | ZoomPanController fitToWindow null parentNode | P1-054 | Fixed v1.5.60 | – |
| 21.11 | ZoomPanController zoomToFitLayers null parentNode | P1-055 | Fixed v1.5.60 | – |

**21.09:** In `TransformController.js` `_applySmartGuideDrag()`, derive
reference position from `getLayerBounds()` for layer types that lack
`.x`/`.y` (line, arrow, path, dimension, angleDimension, marker).

**21.10/11:** Add `if (!container) { return; }` null guards at L232 and
L295 in `ZoomPanController.js`.

### PHP MEDIUM (7 items)

| # | Issue | Ref | Status | Effort |
|---|-------|-----|--------|--------|
| 21.12 | TextSanitizer zero-width space injection | P2-104 | Fixed v1.5.60 | – |
| 21.13 | blend property bypasses enum validation | P2-105 | Fixed v1.5.60 | – |
| 21.14 | usleep() blocking in DB retry loop | P2-106 | Fixed v1.5.60 | – |
| 21.15 | N+1 user lookup in ApiLayersInfo | P2-107 | Fixed v1.5.60 | – |
| 21.16 | Cache invalidation errors silently suppressed | P2-108 | Fixed v1.5.60 | – |
| 21.17 | wfLogWarning() deprecated in RateLimiter | P2-109 | Fixed v1.5.60 | – |
| 21.18 | ApiLayersRename wrong error code for format failure | P2-110 | Fixed v1.5.60 | – |

### JavaScript MEDIUM (6 items)

| # | Issue | Ref | Status | Effort |
|---|-------|-----|--------|--------|
| 21.19 | parseMWTimestamp fallback uses local timezone | P2-111 | Fixed v1.5.60 | – |
| 21.20 | RevisionManager mutates currentSetName before load | P2-112 | Fixed v1.5.60 | – |
| 21.21 | DraftManager auto-save bypasses isRecoveryMode | P2-113 | Fixed v1.5.60 | – |
| 21.22 | APIManager hardcodes layer limit to 100 | P2-114 | Fixed v1.5.60 | – |
| 21.23 | EventManager nudge bypasses StateManager | P2-115 | Fixed v1.5.60 | – |
| 21.24 | DraftManager storage key collision | P2-116 | Fixed v1.5.60 | – |

### Canvas MEDIUM (5 items)

| # | Issue | Ref | Status | Effort |
|---|-------|-----|--------|--------|
| 21.25 | CanvasManager emitTransforming RAF post-destroy | P2-117 | Fixed v1.5.60 | – |
| 21.26 | ZoomPanController animationFrameId stale on complete | P2-118 | Fixed v1.5.60 | – |
| 21.27 | SelectionRenderer AngleDimensionRenderer per-frame | P2-119 | Fixed v1.5.60 | – |
| 21.28 | TransformController _arrowTipRafId missing from ctor | P2-120 | Fixed v1.5.60 | – |
| 21.29 | TransformController text-drag state vars uninitialized | P2-121 | Fixed v1.5.60 | – |

### Documentation (10 items)

| # | Issue | Ref | Status | Effort |
|---|-------|-----|--------|--------|
| 21.30 | README.md coverage badge 95.19% → 92.19% | D-049-01/02 | Fixed v1.5.60 | – |
| 21.31 | CHANGELOG.md [1.5.59] wrong coverage/test/god counts | D-049-03 | Fixed v1.5.60 | – |
| 21.32 | ARCHITECTURE.md god class table missing 6 entries | D-049-04/05 | Fixed v1.5.60 | – |
| 21.33 | ARCHITECTURE.md still shows 95.19% coverage | D-049-06 | Fixed v1.5.60 | – |
| 21.34 | LayersGuide.mediawiki incorrectly deprecates layerslink= | D-049-07 | Fixed v1.5.60 | – |
| 21.35 | DEVELOPER_ONBOARDING.md TransformController size wrong | D-049-08 | Fixed v1.5.60 | – |
| 21.36 | RELEASE_GUIDE.md contradicts CHANGELOG tense | D-049-09 | Fixed v1.5.60 | – |
| 21.37 | DOCUMENTATION_UPDATE_GUIDE.md 11 vs 12 files | D-049-10 | Fixed v1.5.60 | – |
| 21.38 | copilot-instructions.md god class count 22→23 | — | Fixed v1.5.60 | – |
| 21.39 | copilot-instructions.md JS god class count 18→19 | — | Fixed v1.5.60 | – |

### LOW items (15 items)

P3-128 through P3-141 (see KNOWN_ISSUES.md for details). Estimated
5-8h total.

---

## Phase 20: v48 Findings — New Bugs (3 Items)

*Target: fix 1 HIGH coordinate conversion bug, 2 MEDIUM tool/RAF
consistency bugs identified in the March 9, 2026 v48 audit.*

### HIGH (1 item — ~~fixed~~)

| # | Issue | Ref | Status | Effort |
|---|-------|-----|--------|--------|
| 20.1 | ~~CanvasManager.getMousePointFromClient() divides by zero~~ | P1-044 | ~~Fixed~~ | — |

**20.1:** ✅ Fixed. Added ternary zero guards in `CanvasManager.js`
L1721-1722. Regression test added.

### MEDIUM (2 items — ~~fixed~~)

| # | Issue | Ref | Status | Effort |
|---|-------|-----|--------|--------|
| 20.2 | ~~DrawingController angle dimension phase on tool switch~~ | P2-102 | ~~Fixed~~ | — |
| 20.3 | ~~TransformController arrow tip RAF destruction guards~~ | P2-103 | ~~Fixed~~ | — |

**20.2:** ✅ Fixed. Added cleanup in `CanvasManager.setTool()` that
calls `drawingController.cancelAngleDimension()` when switching away
from `angleDimension`. Regression tests added.

**20.3:** ✅ Fixed. Added destruction guard matching the pattern used
by all other RAF callbacks in the same file. Regression tests added.

---

## Phase 19: v47 Findings — Bugs, Backend & Documentation (9 Items)

*Target: fix 2 HIGH-priority silent failures, 3 MEDIUM backend/viewer
bugs, and address documentation accuracy and test coverage gaps.*

### HIGH (2 items — ~~fixed~~)

| # | Issue | Ref | Status | Effort |
|---|-------|-----|--------|--------|
| 19.1 | ~~EventManager nudge `snapshot()` → `saveState()`~~ | P1-041 | ~~Fixed~~ | — |
| 19.2 | ~~DraftManager draft recovery loses image layers~~ | P1-042b | ~~Fixed~~ | — |

**19.1:** ✅ Fixed. Changed `snapshot('nudge')` to `saveState('nudge')`
in `EventManager.js` L210-211. Regression test updated.

**19.2:** ✅ Fixed. Added `_srcStripped` detection in `recoverDraft()`,
cleanup of internal flags, and `mw.notify` warning with `autoHide: false`.
New i18n key `layers-draft-images-lost` with PLURAL support. Regression
tests added.

### MEDIUM (3 items — ~~fixed~~)

| # | Issue | Ref | Status | Effort |
|---|-------|-----|--------|--------|
| 19.3 | ~~LayersViewer blend mode + hidden background~~ | P2-099 | ~~Fixed~~ | — |
| 19.4 | ~~ApiLayersDelete 0-row concurrent delete race~~ | P2-100 | ~~Fixed~~ | — |
| 19.5 | ~~pruneOldRevisions called outside transaction~~ | P2-101 | ~~Fixed~~ | — |

**19.3:** ✅ Fixed. Changed from `fillRect('#ffffff')` to `clearRect()`
when background is hidden in LayersViewer. Tests updated.

**19.4:** ✅ Fixed. Added `$rowsDeleted === 0` check with warning log
in ApiLayersDelete.php. Returns success since end state is correct.

**19.5:** ✅ Fixed. Moved `pruneOldRevisions()` inside the atomic
transaction (before `endAtomic`) in LayersDatabase.php.

### LOW (4 items)

| # | Issue | Ref | Status | Effort |
|---|-------|-----|--------|--------|
| 19.6 | ~~i18n count now 832~~ | P3-126 | ~~Fixed~~ | — |
| 19.7 | Missing test files for 3 modules | P3-127 | Open | 2-3h |
| 19.8 | Clean remaining stale docs | P2-098 | Open | 1-2h |
| 19.9 | Normalize PHP line endings | P3-125 | Open | 1-2h |

**19.7 Fix:** Create test files:
- `tests/jest/LogSanitizer.test.js`
- `tests/jest/GroupHierarchyHelper.test.js`
- `tests/jest/ViewerIcons.test.js` (low priority — static data)

### Reclassified Items (from Phase 15)

| # | Issue | Old Status | New Status | Reason |
|---|-------|------------|------------|--------|
| 15.17 | StyleController triple-apply (P3-081) | Open | ✅ False Positive | Properties applied once; preceding checks are guards |
| 15.19 | SelectionManager boolean handling (P3-083) | Open | ✅ False Positive | Both paths handle integer 0 correctly |
| 15.23 | RenderCoordinator hash gaps (P3-087) | Open | ✅ Already Fixed | Fixed v45.8 per P3-109 |
| 15.25 | Duplicated SVG icon code (P3-089) | Open | ✅ Already Fixed | Fixed v45.9 per P3-107 |

---

## Historical Phase Log

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
| 14.2 | Missing cache invalidation after delete/rename | P1-033 | ✅ Fixed v41 | 1h |
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

*Target: resolve rendering inconsistencies, implement missing UX features, and address code quality issues found in the v42 comprehensive fresh audit.*

### CRITICAL (0 items)

| # | Issue | Ref | Status | Effort |
|---|-------|-----|--------|--------|
| 15.1 | ~~CacheInvalidationTrait.php missing~~ | P0-005 | ✅ False Positive | 0h |

**15.1 Fix:** Verified that `src/Api/Traits/CacheInvalidationTrait.php` exists and is intact. No action needed.

### HIGH (4 items — fix first after P0)

| # | Issue | Ref | Status | Effort |
|---|-------|-----|--------|--------|
| 15.2 | ApiLayersInfo null dereference on L280 | P1-035 | ✅ Done | 30m |
| 15.3 | Arrow keys always pan, never nudge | P1-036 | ✅ Done | 2h |
| 15.4 | Color preview mutates layers directly | P1-037 | ✅ Fixed v45.4 | 1.5h |
| 15.5 | ThumbnailRenderer font not in whitelist | P1-038 | ✅ Done | 45m |

**15.2 Fix:** ✅ RESOLVED — Restructured `ApiLayersInfo.php` so
that when `$layerSet` is null, it fetches general revisions,
and when it exists, it safely accesses `$layerSet['name']`
inside the else block.

**15.3 Fix:** ✅ RESOLVED — Implemented `handleArrowKeyNudge()`
and `nudgeSelectedLayers()` in `EventManager.js`. Arrow keys
nudge selected layers by 1px (10px with Shift). Includes
locked layer protection, history recording for undo/redo,
and 17 new tests.

**15.4 Fix (✅ Done v45.4):** `applyColorPreview()` now saves per-layer
original colors in `_previewOriginalColors` Map on first call. New
`cancelColorPreview()` method restores each layer individually.
`onColorCancel` callback wired to all 4 color control creation sites
(factory stroke/fill, fallback stroke/fill). Map cleared on commit.

**15.5 Fix:** ✅ RESOLVED — In `ThumbnailRenderer`, before passing fontFamily
to ImageMagick, validate against `$wgLayersDefaultFonts`. If not
in list, fall back to 'DejaVu-Sans'. Added a `validateFontName()`
helper method to centralize the check.

### MEDIUM (10 items)

| # | Issue | Ref | Status | Effort |
|---|-------|-----|--------|--------|
| 15.6 | ~~Double render on undo/redo~~ | P2-074 | ✅ False Positive | 0m |
| 15.7 | CustomShape shadow ignores rotation | P2-075 | ✅ Fixed v45.6 | 1h |
| 15.8 | TextBox stroke bleeds into text (thumb) | P2-076 | ✅ Fixed v44 | 15m |
| 15.9 | Ellipse missing shadow (thumb) | P2-077 | ✅ Fixed v44 | 30m |
| 15.10 | AlignmentController missing dim/marker | P2-078 | ✅ Fixed v44 | 1h |
| 15.11 | ~~Clipboard paste offset on local coords~~ | P2-079 | ✅ False Positive | 0m |
| 15.12 | parseMWTimestamp uses local time | P2-080 | ✅ Done | 10m |
| 15.13 | Callout blur bounds ignore dragged tail | P2-081 | ✅ Fixed v45.6 | 30m |
| 15.14 | ~~Font shorthand order in InlineTextEditor~~ | P2-082 | ✅ False Positive | 0m |
| 15.15 | Hardcoded English in ToolbarKeyboard | P2-083 | ✅ Done | 45m |

**15.6 Note (v43):** ✅ FALSE POSITIVE — Verified that handleUndo/handleRedo were already fixed. They delegate to editor.undo()/redo() only. Comments in code explicitly state rendering is handled by HistoryManager.restoreState(). The v42 reviewer described behavior that did not exist in the source.

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

**15.11 Note (v43):** ✅ FALSE POSITIVE — Verified the code at L254-256 explicitly does NOT apply PASTE_OFFSET to tailTipX/tailTipY. A comment explains: "tailTipX/tailTipY are LOCAL coordinates relative to callout center." The v42 reviewer described code behavior that does not exist.

**15.12 Fix:** Change `new Date(year, month, day, hour, minute, second)`
to `new Date(Date.UTC(year, month, day, hour, minute, second))`
in `parseMWTimestamp()`.

**15.13 Fix:** When `layer.tailTipX` and `layer.tailTipY` are
defined, compute blur capture bounds from actual tip coordinates
instead of using `tailDirection` estimates.

**15.14 Note (v43):** ✅ FALSE POSITIVE — Verified the font string at L809-813 IS in correct CSS order (fontStyle before fontWeight). The v42 reviewer described the order backwards; no fix was needed or applied.

**15.15 Fix:** Replace hardcoded strings with `mw.message()` calls.
Add 4 new i18n keys: `layers-group-done`, `layers-ungroup-done`,
`layers-smartguides-on`, `layers-smartguides-off`.

### LOW (17 items)

| # | Issue | Ref | Status | Effort |
|---|-------|-----|--------|--------|
| 15.16 | Dead layer cache code (~140 lines) | P3-080 | ✅ Fixed v45.4 | 15m |
| 15.17 | StyleController triple-apply | P3-081 | ✅ False Positive (v47) | 0m |
| 15.18 | Duplicate sanitizeLogMessage x3 | P3-082 | Open | 30m |
| 15.19 | SelectionManager boolean handling | P3-083 | ✅ False Positive (v47) | 0m |
| 15.20 | DimensionRenderer falsy-sensitive defaults | P3-084 | ✅ Fixed v45.4 | 10m |
| 15.21 | CustomShapeRenderer opacity not clamped | P3-085 | ✅ Fixed v45.4 | 10m |
| 15.22 | ExportController Blob URL leak | P3-086 | ✅ Fixed v45.4 | 10m |
| 15.23 | RenderCoordinator hash gaps | P3-087 | ✅ Already Fixed (v45.8) | 0m |
| 15.24 | Modal Escape no unsaved check | P3-088 | Open | 30m |
| 15.25 | Duplicated SVG icon code | P3-089 | ✅ Already Fixed (v45.9) | 0m |
| 15.26 | Dead renderCodeSnippet + XSS | P3-090 | ✅ Fixed v45.2 | 10m |
| 15.27 | RichTextToolbar drag listener leak | P3-091 | Open | 15m |
| 15.28 | Touch events missing key modifiers | P3-092 | Open | 20m |
| 15.29 | SlideController no concurrency limit | P3-093 | Open | 20m |
| 15.30 | CustomShape oversized temp canvas | P3-094 | Open | 20m |
| 15.31 | Unguarded mw.log.warn in CanvasRenderer | P3-095 | Open | 10m |
| 15.32 | ~~ToolManager IIFE load-time references~~ | P3-096 | ✅ False Positive | 0m |

**15.16 Fix (✅ Done v45.4):** Removed ~150 lines of dead code from
CanvasRenderer: 3 constructor properties, 5 methods
(`_computeLayerHash`, `_hashString`, `_getCachedLayer`,
`_setCachedLayer`, `invalidateLayerCache`), destroy() cleanup.
Also removed 7 dead tests from CanvasRenderer.test.js.

**15.20 Fix (✅ Done v45.4):** Changed 7 numeric properties in
`_createFromOptions()` from `||` to `!== undefined ? ... : DEFAULTS`:
strokeWidth, extensionLength, extensionGap, arrowSize, tickSize, scale.

**15.21 Fix (✅ Done v45.4):** Added `Math.max( 0, Math.min( 1, ... ) )`
clamping to `getOpacity()` return value, matching all other renderers.

**15.22 Fix (✅ Done v45.4):** Wrapped blob download link
creation/click/removal in `try/finally` to ensure
`URL.revokeObjectURL(url)` always executes.

---

## Phase 16: v43 Verification — UX Gaps, Docs & False Positive Cleanup (3 Items)

*Target: address the nudge UX failure discovered in v43 and correct
documentation inconsistencies. The 4 false positives corrected in
this cycle are noted in Phase 15.*

### MEDIUM (1 item)

| # | Issue | Ref | Status | Effort |
|---|-------|-----|--------|--------|
| 16.1 | Nudge broken for dimension/line/arrow layers | P2-084 | ✅ Fixed v44 | 45m |

**16.1 Fix:** In `EventManager.nudgeSelectedLayers()`, add a branch
for endpoint-based layers:

```javascript
if ( [ 'dimension', 'line', 'arrow' ].includes( layer.type ) ) {
    layer.x1 = ( layer.x1 || 0 ) + deltaX;
    layer.y1 = ( layer.y1 || 0 ) + deltaY;
    layer.x2 = ( layer.x2 || 0 ) + deltaX;
    layer.y2 = ( layer.y2 || 0 ) + deltaY;
} else {
    layer.x = ( layer.x || 0 ) + deltaX;
    layer.y = ( layer.y || 0 ) + deltaY;
}
```

Add tests: nudging a dimension layer updates x1/y1/x2/y2; nudging
an arrow layer updates x1/y1/x2/y2; nudging a rect layer updates x/y.

### LOW (2 items)

| # | Issue | Ref | Status | Effort |
|---|-------|-----|--------|--------|
| 16.2 | Stale test count across all docs | P3-097 | ✅ Fixed v44 | 15m |
| 16.3 | CHANGELOG missing versions + date anomaly | P3-098 | Open | 30m |

**16.2 Fix (✅ Done v44):** Updated all documentation files to "11,258 tests in 163 suites":
- README.md, wiki/Home.md, wiki/Frontend-Architecture.md, .github/copilot-instructions.md, codebase_review.md

**16.3 Fix:**
- Add missing CHANGELOG entries for v1.5.37, v1.5.53, v1.5.54
  (check git log for notable changes in those releases)
- Fix v1.5.55 date from `2025-07-23` to the correct 2026 date
  (check git commit timestamp for v1.5.55 tag)
- Mirror any changes to wiki/Changelog.md

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

## Phase 17: v45 Findings — Security, State Management & Quality (27 Items)

*Target: fix the clickjacking critical, close the 4 HIGH state-management
and security issues, then address the remaining MEDIUM and LOW items
found in the v45 fresh audit.*

### CRITICAL (1 item)

| # | Issue | Ref | Status | Effort |
|---|-------|-----|--------|--------|
| 17.1 | Clickjacking: `?modal=1` disables frame protection | P0-006 | ✅ Fixed v45 | 1h |

**17.1 Fix (✅ Done v45):** In `EditLayersAction.php` and `SpecialEditSlide.php`,
suppressed MediaWiki's default DENY via `setPreventClickjacking(false)`, then
set `X-Frame-Options: SAMEORIGIN` header. Same-wiki iframes allowed; cross-origin
embedding blocked.

### HIGH (4 items)

| # | Issue | Ref | Status | Effort |
|---|-------|-----|--------|--------|
| 17.2 | Manual HTML in LayeredThumbnail bypasses escaping | P1-039 | ✅ Fixed v45 | 2h |
| 17.3 | ~~InlineTextEditor innerHTML trusts richTextToHtml~~ | P1-040 | ✅ False Positive | 0h |
| 17.4 | ~~EventManager nudge mutates state bypassing StateManager~~ | P1-041 | ✅ False Positive | 0h |
| 17.5 | LayerPanel stale originalName after rename | P1-042 | ✅ Fixed v45 | 30m |

**17.2 Fix (✅ Done v45):** Replaced raw string concatenation in
`LayeredThumbnail.php` with `Html::element('img', ...)` and
`Html::rawElement('div', ...)`. Added `use MediaWiki\Html\Html`.
(Reclassified from HIGH to MEDIUM — original escaping was correct.)

**17.3 Note (✅ FALSE POSITIVE):** `richTextToHtml()` uses DOM-based
`div.textContent=...; return div.innerHTML` escaping and `escapeCSSValue()`
strips dangerous chars. Both methods are correctly implemented.

**17.4 Note (✅ FALSE POSITIVE):** Direct layer mutation + history snapshot
is the established pattern throughout the codebase. Verified:
`TransformController.updateLayerPosition()` at L556-562 uses the same pattern.

**17.5 Fix (✅ Done v45):** Added `nameElement.dataset.originalName = nameElement.textContent`
inside the `_hasEditListeners` early-return branch so Escape reverts to
the current name, not the first-ever name. Regression test added.

### MEDIUM (8 items)

| # | Issue | Ref | Status | Effort |
|---|-------|-----|--------|--------|
| 17.6 | SVG data URI in image layers bypasses validation | P2-085 | ✅ Fixed v45.2 | 2h |
| 17.7 | Failed images stored in cache as broken | P2-086 | ✅ Fixed v45 | 30m |
| 17.8 | Blur texture canvas reallocated every frame | P2-087 | ✅ Fixed v45.2 | 1h |
| 17.9 | N+1 query in UIHooks user name enrichment | P2-088 | ✅ Fixed v45.5 | 1h |
| 17.10 | TextSanitizer keyword defense-in-depth gap | P2-089 | ✅ Fixed v45.3 | 1h |
| 17.11 | WikitextHooks static state bleed in PHP-FPM | P2-090 | ✅ Fixed v45.5 | 1h |
| 17.12 | Duplicate getLayerBounds implementations | P2-091 | ✅ Fixed v45.5 | 45m |
| 17.13 | DrawingController ellipse validation OR vs AND | P2-092 | ✅ Fixed v45 | 15m |

**17.6 Fix (✅ Done v45.2):** Updated `DANGEROUS_URL_RE` to use negative
lookahead allowing only safe image types (png/jpeg/gif/webp). Blocks
`data:image/svg+xml` and all other dangerous `data:` URIs. 2 regression tests added.

**17.7 Fix (✅ Done v45):** Added `this._imageCache.delete(cacheKey)` in
`onerror` handler so failed images are evicted and retried. Regression test added.

**17.8 Fix (✅ Done v45.2):** Added size guard (`if width !== reqW || height !== reqH`)
before setting `_blurFillCanvas` dimensions, matching sibling `_blurCanvas` pattern.

**17.9 Fix:** Batch the per-layer DB queries in `LayersDatabase`;
use a single SELECT with `WHERE id IN (...)`.

**17.10 Fix (✅ Done v45.3):** Expanded `$jsKeywords` from 6 to 12 entries,
adding `Function`, `constructor`, `fetch`, `XMLHttpRequest`, `importScripts`,
`document.write`. Zero-width space injection now covers modern attack vectors.

**17.11 Fix:** Move static state in `SlideHooks.php` and
`SlideController.js` to instance properties or request-scoped
containers.

**17.12 Fix:** Consolidate duplicate `getSelectionBounds()` and
`calculateBounds()` into a single shared utility.

**17.13 Fix (✅ Done v45):** Changed `||` to `&&` so both radii must
meet `MIN_SHAPE_SIZE`, consistent with rectangle validation. Test updated.

### LOW (14 items)

| # | Issue | Ref | Status | Effort |
|---|-------|-----|--------|--------|
| 17.14 | call_user_func indirection in PHP modules | P3-099 | ✅ Fixed v45.3 | 30m |
| 17.15 | Image src validation missing protocol check | P3-100 | Open | 15m |
| 17.16 | Duplicated icon SVG strings across modules | P3-101 | Open | 1h |
| 17.17 | ThumbnailRenderer serialize() for cache key | P3-102 | ✅ Fixed v45.3 | 30m |
| 17.18 | RenderCoordinator hash collision on layers | P3-103 | Open | 30m |
| 17.19 | SmartGuides sort mutates input array | P3-104 | ✅ Fixed v45.2 | 10m |
| 17.20 | HitTestController allocations in hot loop | P3-105 | ✅ Fixed v45.2 | 30m |
| 17.21 | backgroundVisible normalization scattered | P3-106 | ✅ Fixed v45.3 | 15m |
| 17.22 | LightboxController lazy-init race window | P3-107 | Open | 30m |
| 17.23 | JSON clone used in hot render paths | P3-108 | Open | 1h |
| 17.24 | Dead saveToHistory call in SelectionManager | P3-109 | Open | 10m |
| 17.25 | renderCodeSnippet HTML injection surface | P3-110 | ✅ Fixed v45.2 | 30m |
| 17.26 | Lightbox close/open animation race | P3-111 | ✅ Fixed v45.3 | 30m |
| 17.27 | PropertyBuilders line count off by 333 | P3-112 | Open | 10m |

**17.14 Fix (✅ Done v45.3):** Replaced 10 `call_user_func`/`class_exists`
indirection patterns in 4 PHP files (Hooks, LayeredThumbnail,
ThumbnailRenderer, LayersFileTransform) with direct calls to
`LoggerFactory::getInstance()`, `Shell::command()`, and
`MediaWikiServices::getInstance()`.

**17.17 Fix (✅ Done v45.3):** Changed `serialize($params)` to
`json_encode($params)` in ThumbnailRenderer cache key generation.
Deterministic output, no PHP object injection risk.

**17.21 Fix (✅ Done v45.3):** Extracted
`LayerDataNormalizer.normalizeBackgroundVisible()` and replaced 7
inline normalization blocks across ViewerManager (3), FreshnessChecker (1),
ApiFallback (1), SlideController (2). Single source of truth for
`false/0/'0'/'false'` sentinel handling.

**17.26 Fix (✅ Done v45.3):** `open()` in LayersLightbox now cancels
any pending `closeTimeoutId` before creating a new overlay, and checks
for stale overlay DOM nodes regardless of `isOpen` state.

---

## Recommended Execution Order

Phase 17 items should be addressed in this order:

1. **CRITICAL first:** 17.1 (clickjacking) — security release blocker
2. **HIGH security:** 17.2 (manual HTML), 17.3 (innerHTML trust)
3. **HIGH state bugs:** 17.4 (nudge mutation), 17.5 (stale rename)
4. **MEDIUM security:** 17.6 (SVG data URI)
5. **MEDIUM perf/quality:** 17.7-17.13 in any order
6. **LOW items:** 17.14-17.27 as time permits

Ongoing maintenance tracks:
- **Track A:** God class reduction — follow docs/GOD_CLASS_REFACTORING_PLAN.md
- **Track B:** Metrics/doc drift prevention — run scripts/verify-docs.sh
- **Track C:** Targeted coverage hardening for new/refactored code

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
| 2026-03-04 | v45.6 batch 6: 3 P2 fixes (P2-081 callout blur bounds, P2-083 i18n shortcut descriptions, P2-075 shadow rotation decomposition). All P2 items now resolved. Totals: 262/228/34. |
| 2026-03-04 | v45.5 batch 5: 3 P2 fixes (P2-088 N+1 batch query, P2-090 request-boundary state reset, P2-091 getLayerBounds delegation). Totals: 254/208/46. |
| 2026-03-04 | v45.4 batch 4: 5 fixes (P1-037 color preview cancel, P3-080 dead cache code, P3-084 DimensionRenderer defaults, P3-085 opacity clamp, P3-086 blob URL leak). Totals: 254/205/49. |
| 2026-03-04 | v45.3 batch 3: 5 fixes (P2-089 keywords, P3-099 call_user_func, P3-102 serialize, P3-106 bgVisible, P3-111 lightbox race). Totals: 254/200/54. |
| 2026-03-04 | v45.2 batch 2: 6 fixes (P2-085, P2-087, P3-103, P3-104, P3-105, P3-108, P3-110, P3-112). |
| 2026-03-04 | v45 fixes: 5 items fixed (P0-006, P1-039, P1-042, P2-086, P2-092), 2 FPs (P1-040, P1-041). Totals: 254/195/59. |
| 2026-03-04 | v45 fresh audit: 27 new findings added as Phase 17. Fixed v44 items: 15.8/15.9/15.10 and 16.1. |
| 2026-02-17 | v43 verification audit: corrected 4 Phase 15 false positives (P2-074, P2-079, P2-082, P3-096); added Phase 16 with 3 new items (P2-084 nudge, P3-097 stale docs, P3-098 CHANGELOG); updated Phase Summary totals to 227/183/44. |
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
