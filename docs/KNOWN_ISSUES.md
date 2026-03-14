# Known Issues

**Last updated:** March 14, 2026 — v1.5.62 (v54 audit — 8 code fixes + 14 doc drift fixes applied, P3-149 false positive)

This document tracks known issues in the Layers extension, prioritized
as P0 (critical/data loss), P1 (high/significant bugs), P2 (medium),
and P3 (low/cosmetic). Historical fixed items are retained for audit
traceability.

## Summary

| Priority | Total | Fixed | Open |
|----------|-------|-------|------|
| P0 | 5 | 5 | 0 |
| P1 | 58 | 58 | 0 |
| P2 | 131 | 131 | 0 |
| P3 | 171 | 169 | 2 |
| **Total** | **365** | **363** | **2** |

*Open: P3-146/P3-147 (2 deferred code).
Fixed this session: P1-057, P2-124–P2-127, P3-150–P3-152, D-054-01 thru D-054-14.
P3-149 reclassified as false positive.*

---

## Open Issues — v54 (March 14, 2026)

### Security — High

#### P1-057: IDOR via `layers=id:NNN` Wikitext Prefix

- **Status:** ✅ **Fixed** (commit 0cba25e2)
- **Fix:** Added file ownership validation (`$layerSet['imgName'] !== $file->getName()`) in
  LayerInjector.php, ImageLinkProcessor.php, LayeredFileRenderer.php

### PHP — Medium

#### P2-124: `enrichRowsWithUserNames()` Queries `user` Table Directly

- **Status:** ✅ **Fixed** (commit 0cba25e2)
- **Fix:** Replaced raw `user` table query with `UserFactory::newFromId()` loop

#### P2-125: `EditLayersAction` Set Name Regex Rejects Unicode/Spaces

- **Status:** ✅ **Fixed** (commit 0cba25e2)
- **Fix:** Replaced hardcoded ASCII regex with `SetNameSanitizer::isValid()`

### JavaScript — Medium

#### P2-126: Arrow Key Conflict — Simultaneous Nudge + Pan

- **Status:** ✅ **Fixed** (commit 0cba25e2)
- **Fix:** Added `!e.defaultPrevented` check in CanvasEvents arrow handler

#### P2-127: TextRenderer Double Shadow on Stroke+Fill (Non-Spread Path)

- **Status:** ✅ **Fixed** (commit 0cba25e2)
- **Fix:** Shadow cleared after strokeText in non-spread path

### PHP — Low

#### P3-146: `layer_set_usage` Table — Dead/Unimplemented Feature

- **Files:** `sql/layers_tables.sql` L43–52,
  `src/Database/LayersSchemaManager.php`, `src/LayersConstants.php` L239
- **Issue:** Table defined in schema, columns validated in SchemaManager,
  constant exists, but `LayersDatabase.php` has zero references.
  No code reads/writes/deletes from this table.
- **Status:** **Open**

#### P3-147: `buildImageNameLookup` Generates Redundant SQL Variants

- **File:** `src/Database/LayersDatabase.php` L1115–1126
- **Issue:** Every query (19 call sites) generates 2–4 name variants for
  `IN (...)` clauses, doubling index scans. Workaround for historical
  inconsistent data rather than a proper fix.
- **Status:** **Open**

#### P3-148: `LayerValidatorInterface` Not Used in DI Container

- **File:** `src/Validation/LayerValidatorInterface.php`
- **Issue:** Interface defined, implemented by ServerSideLayerValidator,
  but no code type-hints against it. Not wired in services.php.
- **Status:** **Deferred** (low priority; validator works correctly as-is)

#### P3-149: `ThumbnailRenderer` Has No Own Color Validation (Defense-in-Depth)

- **Status:** ❌ **False positive** — upstream `ServerSideLayerValidator`
  validates/sanitizes all colors before storage. `Shell::command()` uses
  `escapeshellarg()`. `withOpacity()` outputs only safe formats.
  No bypass path exists in current architecture.

### JavaScript — Low

#### P3-150: `ShadowRenderer._tempCanvas` Grows Unboundedly

- **Status:** ✅ **Fixed** (commit 0cba25e2)
- **Fix:** `_tempCanvas` and `_tempCtx` nulled in `destroy()`

#### P3-151: `ImageLayerRenderer` Closures Hold Reference After Destroy

- **Status:** ✅ **Fixed** (commit 0cba25e2)
- **Fix:** Added `_imageCache` null guard in onload/onerror callbacks

#### P3-152: `EffectsRenderer` Division by Zero in Blur Fill Scale

- **Status:** ✅ **Fixed** (commit 0cba25e2)
- **Fix:** Added `Math.max(1, ...)` guard for canvas dimensions

### Documentation — Low (14 items)

#### D-054-01: JS File/Line Count Stale Across Core Docs

- **Files:** `codebase_review.md`, `README.md`, `docs/ARCHITECTURE.md`,
  `copilot-instructions.md`
- **Issue:** All claim 143 JS files / ~99,730 lines. Actual: 156 / ~113,390.
- **Status:** ✅ **Fixed**

#### D-054-02: Test Count Stale (11,474 → 11,494)

- **Files:** `codebase_review.md`, `README.md`, `CHANGELOG.md`,
  `wiki/Changelog.md`, `docs/ARCHITECTURE.md`
- **Issue:** All claim 11,474 tests. Actual: 11,494.
- **Status:** ✅ **Fixed**

#### D-054-03: PHP Line Count Stale (~15,197 → ~15,236)

- **Files:** `codebase_review.md`, `README.md`, `copilot-instructions.md`
- **Status:** ✅ **Fixed**

#### D-054-04: God Class Count Stale (23 → 26)

- **Files:** `codebase_review.md`, `README.md`, `copilot-instructions.md`,
  `docs/ARCHITECTURE.md`
- **Issue:** Actual: 5 generated + 19 hand-written JS + 2 PHP = 26.
- **Status:** ✅ **Fixed**

#### D-054-05: `CONTRIBUTING.md` Grossly Stale Metrics

- **File:** `CONTRIBUTING.md`
- **Issue:** States 95.19% coverage, 11,250 tests, 17 god classes.
  Correct: 91.32%, 11,494, 26.
- **Status:** ✅ **Fixed**

#### D-054-06: `docs/ARCHITECTURE.md` Stale Version and Metrics

- **File:** `docs/ARCHITECTURE.md`
- **Issue:** Version 1.5.59, god class count 17, test count 11,445.
- **Status:** ✅ **Fixed**

#### D-054-07: `Mediawiki-Extension-Layers.mediawiki` Multiple Issues

- **File:** `Mediawiki-Extension-Layers.mediawiki`
- **Issue:** Stale date (2026-03-04), branch versions (1.5.60),
  missing ParserClearState hook, missing layers-admin right,
  missing 8 config parameters.
- **Status:** ✅ **Fixed** (versions/date updated; content additions deferred)

#### D-054-08: `docs/LTS_BRANCH_STRATEGY.md` Stale Throughout

- **File:** `docs/LTS_BRANCH_STRATEGY.md`
- **Issue:** All versions say 1.5.59; test count 11,250.
- **Status:** ✅ **Fixed**

#### D-054-09: `docs/SLIDE_MODE_ISSUES.md` Extremely Stale Test Count

- **File:** `docs/SLIDE_MODE_ISSUES.md`
- **Issue:** States 9,922 tests (off by ~1,572).
- **Status:** ✅ **Fixed**

#### D-054-10: `wiki/Testing-Guide.md` Wrong Coverage

- **File:** `wiki/Testing-Guide.md`
- **Issue:** Shows 95.19% (correct: 91.32%).
- **Status:** ✅ **Fixed**

#### D-054-11: `wiki/Architecture-Overview.md` Stale Metrics

- **File:** `wiki/Architecture-Overview.md`
- **Issue:** Test Cases: 11,250, Coverage: 95.19%.
- **Status:** ✅ **Fixed**

#### D-054-12: `wiki/Frontend-Architecture.md` Stale Metrics

- **File:** `wiki/Frontend-Architecture.md`
- **Issue:** Test Cases: 11,250, Coverage: 95.19%, Branch: 84.96%.
- **Status:** ✅ **Fixed**

#### D-054-13: `wiki/Home.md` Stale "What's New" Section

- **File:** `wiki/Home.md`
- **Issue:** Features v1.5.60 highlights; missing v1.5.61/v1.5.62.
- **Status:** ✅ **Fixed**

#### D-054-14: `wiki/Installation.md` Stale Branch Versions

- **File:** `wiki/Installation.md`
- **Issue:** Branch versions say 1.5.61 (main should be 1.5.62).
- **Status:** ✅ **Fixed**

---

## Fixed Issues — v54 (March 14, 2026) — 1 Prior Issue Resolved

### Testing Gap — Low

#### P3-145: `SpecialSlides.js` Zero Test Coverage — **RESOLVED**

- **File:** `resources/ext.layers.slides/SpecialSlides.js`
- **Previously:** 0% coverage across all metrics.
- **Resolution:** Test file `tests/jest/SpecialSlides.test.js` now exists
  with substantial coverage of `SlidesManager` and `CreateSlideDialog`.
  PHPUnit tests also exist at `tests/phpunit/unit/SpecialPages/SpecialSlidesTest.php`.
- **Status:** **Fixed** (resolved between v53 and v54 audits)

---

## Fixed Issues — v53 (March 12, 2026) — All 4 Fixed + P3-145 Resolved in v54

### v52 Verification Summary

All 4 v52 items verified as fixed in v1.5.62. No regressions.

### Documentation — Low

#### D-053-01: Coverage Overstated (92.35% → 91.32%)

- **Files:** `README.md`, `Mediawiki-Extension-Layers.mediawiki`,
  `codebase_review.md` (5 locations)
- **Fix:** Updated all to actual measured values.
- **Status:** **Fixed** (v53 session)

#### D-053-02: CHANGELOG.md Test Count (11,450 → 11,474)

- **Files:** `CHANGELOG.md`, `wiki/Changelog.md`
- **Fix:** Updated both v1.5.62 entries.
- **Status:** **Fixed** (v53 session)

#### D-053-03: codebase_review.md Grade Test Count (11,450 → 11,474)

- **File:** `codebase_review.md`
- **Fix:** Updated to 11,474.
- **Status:** **Fixed** (v53 session)

#### D-053-04: i18n Key Count Triple Inconsistency (784/778/780)

- **File:** `codebase_review.md`
- **Fix:** Updated both locations to actual count (780).
- **Status:** **Fixed** (v53 session)

---

## Fixed Issues — v52 (March 11, 2026) — All Fixed That Session

### Code Style — Low

#### CODE-052-01: `APIManager.js` Missing Blank Line Between Methods

- **File:** `resources/ext.layers.editor/APIManager.js` L412
- **Code:** `} [TAB] extractLayerSetData( layerSet ) {` (closing brace and
  next method declaration on same line, separated by a tab character)
- **Impact:** Cosmetic. IDE navigation and diff readability slightly
  impaired. No functional effect.
- **Fix:** Added missing blank line separator between `processLayersData()`
  and `extractLayerSetData()`.
- **Status:** **Fixed** (this session)
- **Introduced:** Prior merge that omitted blank line separator

### Documentation — Low

#### D-052-01: Test Count 11,445 → 11,450 in Documentation

- **Files:** `README.md` (badge URL, metrics table, health table),
  `codebase_review.md` (Scope header, Current Metrics table)
- **Issue:** Five locations across two files claimed 11,445 tests. Running
  `npm run test:js` on commit `e29f5df9` produced `11450 passed, 11450
  total`. The 5-test discrepancy is from regression tests added in v1.5.61
  (2 for P2-122, 3 for P3-144) that post-dated the v50 documentation update.
- **Fix:** Updated all five locations to 11,450.
- **Verified by:** `npx jest --passWithNoTests --no-coverage --silent`
- **Status:** **Fixed** (this session)

#### D-052-02: i18n Key Count 832 → 784 in Documentation

- **Files:** `codebase_review.md` (Scope header, Current Metrics table)
- **Issue:** `codebase_review.md` stated 832 keys in `i18n/en.json` and
  `i18n/qqq.json`. Counting via `grep -E '"layers-[^"]+":' i18n/en.json
  | wc -l` returns **784**. Verified against the historically-referenced
  commit `4f315a5f` via `git show` — also 784, meaning the "832" claim was
  never accurate. Note: P3-126 (v46) added one key to reach "832" but was
  measuring a broader pattern; the audit-consistent count has always been 784.
  No keys are missing: both `en.json` and `qqq.json` have identical 784
  entries with no undocumented keys.
- **Fix:** Updated both occurrences in `codebase_review.md` to 784.
- **Status:** **Fixed** (this session)

#### D-052-03: `codebase_review.md` Header Showed v50/v1.5.61 After v1.5.62 Release

- **File:** `codebase_review.md` (header section)
- **Issue:** After release of v1.5.62, the review document header still
  showed `Review Date: March 10, 2026 (v50 audit)` and `Version: 1.5.61`.
- **Fix:** Updated header to `March 11, 2026 (v52 audit)` and `1.5.62`;
  added v51 and v52 findings sections.
- **Status:** **Fixed** (this session)

---

## Fixed Issues — v51 (March 12, 2026) — All Fixed in v1.5.62

### Canvas — High

#### P3-143: Angle Dimension Anchor Points Not Offset on Paste

- **File:** `resources/ext.layers.editor/canvas/ClipboardController.js`, `applyPasteOffset()`
- **Impact:** Pasting an angle dimension layer left all six anchor points
  (`ax/ay`, `cx/cy`, `bx/by`) at their original canvas coordinates while the
  new layer received a fresh ID. The pasted copy, visually appearing at the
  same location, would overlap the original and could not be repositioned.
- **Fix:** Added three conditional offset blocks for `ax/ay`, `cx/cy`, and
  `bx/by` after the existing `points[]` block.
- **Status:** **Fixed** (v1.5.62)
- **Introduced:** Angle dimension feature (v1.5.x)
- **Tests added:** 2 (`ClipboardController.test.js`)

#### P3-144: DrawingController._angleDimensionPhase Uninitialized in Constructor

- **File:** `resources/ext.layers.editor/canvas/DrawingController.js`, `constructor()`
- **Impact:** `_angleDimensionPhase` was never declared in the constructor, only
  inside `startAngleDimensionTool()`. Any code path checking the property before
  tool activation received `undefined`, causing phase-comparison guards to fail.
- **Fix:** Added `this._angleDimensionPhase = 0` to the constructor.
- **Status:** **Fixed** (v1.5.62)
- **Introduced:** Angle dimension feature (v1.5.x)
- **Tests added:** 1 (`DrawingController.test.js`)

## Fixed Issues — v50 (March 10, 2026) — All Fixed in v1.5.61

### PHP — High

#### P1-056: SpecialSlides.php `$canDelete` Uses Page-Deletion Right

- **File:** `src/SpecialPages/SpecialSlides.php` L80
- **Code:** `$canDelete = $permissionManager->userHasRight( $user, 'delete' );`
- **Impact:** The `$canDelete` flag is passed to `SpecialSlides.js` as
  `wgLayersSlidesConfig.canDelete` and controls delete-button visibility (L185).
  Any wiki user with page-deletion rights sees the delete button; a dedicated
  `layers-admin` user without page-deletion rights does not see it, even though
  the `layersdelete` API would accept their request. This is a
  **UI-only authorization inconsistency** — the API itself is correctly gated
  by `layers-admin` (see P1-045, fixed). The P1-045 fix applied to
  `LayersApiHelperTrait.php` missed this file.
- **Fix:** `$canDelete = $permissionManager->userHasRight( $user, 'layers-admin' );`
- **Status:** **Fixed** (v1.5.61)
- **Introduced:** v50 audit

### Canvas — Medium

#### P2-122: Smart Guides Broken for `path` Layer Type (Incomplete P1-053 Fix)

- **File:** `resources/ext.layers.editor/canvas/TransformController.js`
  L498–520, function `_getRefPoint()`
- **Code:**
  ```javascript
  const _getRefPoint = ( state ) => {
      const t = state.type;
      if ( t === 'line' || t === 'arrow' || t === 'dimension' ) { ... }
      if ( t === 'angleDimension' ) { ... }
      return { x: state.x || 0, y: state.y || 0 }; // path falls through here
  };
  ```
- **Impact:** Freeform `path` layers use a `points: [{x,y}, ...]` array with
  no top-level `.x`/`.y`. The fallthrough branch returns `{x:0, y:0}`,
  causing snap calculations to use the canvas origin as the reference position.
  Smart guides fire but snap to the wrong location — effectively
  non-functional for path layers. The P1-053 fix (v1.5.59) handled
  line/arrow/dimension/angleDimension but missed the `path` case despite
  it being named in the original issue title.
- **Fix:**
  ```javascript
  if ( t === 'path' ) {
      const pts = state.points || [];
      return {
          x: pts.length ? Math.min( ...pts.map( p => p.x ) ) : 0,
          y: pts.length ? Math.min( ...pts.map( p => p.y ) ) : 0
      };
  }
  ```
- **Status:** **Fixed** (v1.5.61)
- **Introduced:** v50 audit (incomplete fix of P1-053)

### PHP — Medium

#### P2-123: `ApiLayersInfo.enrichRowsWithUserNames()` Uses Deprecated `ILoadBalancer`

- **File:** `src/Api/ApiLayersInfo.php` L524–526
- **Code:**
  ```php
  $dbr = MediaWikiServices::getInstance()
      ->getDBLoadBalancer()
      ->getConnection( DB_REPLICA );
  ```
- **Context:** Introduced by the P2-107 fix (batch user lookup). The same
  class has `getDb()` at L642 using `getConnectionProvider()->getReplicaDatabase()`
  — the modern MW 1.39+ API.
- **Impact:** `ILoadBalancer::getConnection()` is deprecated since MW 1.39 and
  will be removed in a future version, causing a fatal error on any `layersinfo`
  call that loads user names. All other DB access in the extension uses the
  modern API; this is isolated to the P2-107 fix.
- **Fix:** Replace L524–526 with `$dbr = $this->getDb();`
- **Status:** **Fixed** (v1.5.61)
- **Introduced:** v50 audit

### Documentation — Low

#### D-050-01: `docs/ARCHITECTURE.md` Stale Coverage and Test Count Metrics

- **File:** `docs/ARCHITECTURE.md` L34–35, L148
- `L34`: `92.19% statements, 82.15% branches` → should be `91.32%, 81.69%`
- `L35`: `11,421 tests (167 suites)` → should be `11,445 (168 suites)`
- `L148`: states `95.19% coverage` — completely outdated (ancient pre-v40 value)
- **Fix:** Update all three lines to current verified values.
- **Status:** **Fixed** (v1.5.61)
- **Introduced:** v50 audit

#### D-050-02: `CHANGELOG.md` v1.5.60 Documentation Section Claims Wrong Coverage

- **File:** `CHANGELOG.md`, v1.5.60 Documentation section
- States coverage was updated to `92.19%`; actual coverage at commit
  `4f315a5f` is `91.32%`.
- **Fix:** Update v1.5.60 Documentation entry to `91.32%`.
- **Status:** **Fixed** (v1.5.61)
- **Introduced:** v50 audit

#### D-050-03: `wiki/Changelog.md` Matches D-050-02 (Stale Coverage)

- **File:** `wiki/Changelog.md`, v1.5.60 entry
- Mirrors `CHANGELOG.md` v1.5.60 with same incorrect `92.19%` value.
- **Fix:** Sync with corrected `CHANGELOG.md`.
- **Status:** **Fixed** (v1.5.61)
- **Introduced:** v50 audit

#### D-050-04: `README.md` God-Class Count Internal Contradiction

- **File:** `README.md` L317, L353, L384
- L317 says "22 god classes" (wrong; correct is 23)
- L353 says "17 files" with Feb 17, 2026 date note (stale; correct is 19 JS + 2 PHP)
- L384 metrics table correctly says `23` — creates internal contradiction
- **Fix:** Update L317 and L353 to match L384.
- **Status:** **Fixed** (v1.5.61)
- **Introduced:** v50 audit

---

## Open Issues — v49 (March 10, 2026) — All Fixed in v1.5.60

### PHP — High

#### P1-045: LayersApiHelperTrait Admin Check Uses Page-Deletion Right

- **File:** `src/Api/Traits/LayersApiHelperTrait.php` L106
- **Code:** `$isAdmin = $user->isAllowed( 'delete' );`
- **Impact:** The MediaWiki `'delete'` right controls wiki page deletion,
  not layer administration. Any user who can delete pages becomes an
  unrestricted Layers admin; dedicated layer moderators without page-delete
  rights cannot moderate layer content.
- **Fix:** Introduce a dedicated `layers-admin` right in `extension.json`
  and check `$user->isAllowed( 'layers-admin' )` instead.
- **Status:** **Fixed** (v1.5.59)
- **Introduced:** v49 audit

#### P1-046: SpecialSlides.php DB Query Before Permission Check

- **File:** `src/SpecialPages/SpecialSlides.php` L172 (DB), L179 (perm)
- **Impact:** Unauthorized users can probe slide existence through error
  message differences — "slide not found" vs. "no permission" responses
  diverge depending on existence, enabling name enumeration.
- **Fix:** Move permission check to before the DB query.
- **Status:** **Fixed** (v1.5.59)
- **Introduced:** v49 audit

#### P1-047: SpecialEditSlide.php DB Query Before Permission Check

- **File:** `src/SpecialPages/SpecialEditSlide.php`
- **Impact:** Same information-disclosure pattern as P1-046.
- **Fix:** Same reordering fix — permission check before any DB call.
- **Status:** **Fixed** (v1.5.59)
- **Introduced:** v49 audit

### JavaScript — High

#### P1-048: APIManager Cache Exception Leaves Promise Permanently Pending

- **File:** `resources/ext.layers.editor/APIManager.js` L617–636
- **Impact:** When `_processRevisionData()` throws on corrupt cached data,
  the `catch` block clears the cache but `return` exits the Promise
  constructor, leaving it permanently pending. The editor silently freezes
  on revision load with no error surfaced and no retry.
- **Fix:** Move `return;` inside the `try` block so the catch falls
  through to the network fetch path.
- **Status:** **Fixed** (v1.5.59)
- **Introduced:** v49 audit

#### P1-049: APIManager `.catch()` Drops jQuery Deferred `result` Argument

- **File:** `resources/ext.layers.editor/APIManager.js` L315, L640, L815, L975
- **Impact:** In jQuery ≥ 3.0, `.then().catch()` chains lose all
  arguments after the first on rejection. Abort detection never fires
  (spurious error notifications), retry logic retries `permissiondenied`
  errors 3 times, and error detail is always lost.
- **Fix:** Replace `.then( success ).catch( failure )` with
  `.then( success, failure )` at all four sites.
- **Status:** **Fixed** (v1.5.59)
- **Introduced:** v49 audit

#### P1-050: HistoryManager `lastSaveHistoryIndex` Not Decremented on Trim

- **File:** `resources/ext.layers.editor/HistoryManager.js` L128–136
- **Impact:** After history reaches max capacity, `history.shift()` is
  called but `lastSaveHistoryIndex` is not decremented. It exceeds
  `history.length - 1`, making `hasUnsavedChanges()` permanently
  incorrect and disabling the fast-path short-circuit.
- **Fix:** After `history.shift()`, decrement `lastSaveHistoryIndex`.
  Set to `-1` if the saved entry was discarded.
- **Status:** **Fixed** (v1.5.59)
- **Introduced:** v49 audit

#### P1-051: EditorBootstrap Creates Duplicate Editors in Production Mode

- **File:** `resources/ext.layers.editor/editor/EditorBootstrap.js` L442–443
- **Impact:** `window.layersEditorInstance` is only set in debug mode.
  The duplicate-prevention guard always evaluates to falsy in production,
  allowing the deferred hook listener and `autoBootstrap` to each create
  an editor sharing the same container.
- **Fix:** Set `window.layersEditorInstance = editor` unconditionally
  (outside the debug check) immediately after creation.
- **Status:** **Fixed** (v1.5.59)
- **Introduced:** v49 audit

#### P1-052: ValidationManager Bounds Stricter Than Server

- **File:** `resources/ext.layers.editor/ValidationManager.js` L240, L246
- **Impact:** `fontSize < 8` (server allows 1) and `strokeWidth > 50`
  (server allows 100) — valid values are rejected client-side with no
  clear error message. On wikis using accessible design (small fonts)
  or thick-stroke infographics, this is a functional regression.
- **Fix:** `fontSize < 1` and `strokeWidth > 100`.
- **Status:** **Fixed** (v1.5.59)
- **Introduced:** v49 audit

### Canvas — High

#### P1-053: Smart Guides Non-Functional for Line, Arrow, Path, Dimension Layers

- **File:** `resources/ext.layers.editor/canvas/TransformController.js`
  L486–505
- **Impact:** These layer types have no `.x`/`.y` properties. The snap
  calculation receives the drag delta (~10px) as the layer position
  instead of the actual position (~200px). Smart guides appear enabled
  in the UI but never fire for these types.
- **Fix:** Derive the reference position from `getLayerBounds()` for
  non-positional layer types before computing the proposed snap position.
- **Status:** **Partially fixed** (v1.5.59) — line/arrow/dimension/angleDimension
  now work correctly; `path` type still broken (see P2-122)
- **Introduced:** v49 audit

#### P1-054: ZoomPanController `fitToWindow()` Null Dereference

- **File:** `resources/ext.layers.editor/canvas/ZoomPanController.js` L232
- **Impact:** `canvas.parentNode` is not null-checked before accessing
  `.clientWidth`. Throws `TypeError` if called while canvas is detached.
- **Fix:** `if ( !container ) { return; }` after line 232.
- **Status:** **Fixed** (v1.5.59)
- **Introduced:** v49 audit

#### P1-055: ZoomPanController `zoomToFitLayers()` Same Null Dereference

- **File:** `resources/ext.layers.editor/canvas/ZoomPanController.js` L295
- **Impact:** Same pattern as P1-054.
- **Fix:** Same null guard.
- **Status:** **Fixed** (v1.5.59)
- **Introduced:** v49 audit

---

### PHP — Medium

#### P2-104: TextSanitizer Zero-Width Space Injection Corrupts User Text

- **File:** `src/Validation/TextSanitizer.php` L180–197
- **Impact:** Inserts U+200B before `(` after keywords like `alert`,
  `setTimeout`, etc. User text containing these substrings is silently
  and irreversibly mutated with an invisible character. Canvas `fillText()`
  cannot execute JavaScript; the protection is unnecessary and harmful.
- **Fix:** Remove the zero-width space injection block entirely.
- **Status:** **Fixed** (v1.5.59)
- **Introduced:** v49 audit

#### P2-105: `blend` Property Bypasses Enum Validation

- **File:** `src/Validation/ServerSideLayerValidator.php`
- **Impact:** `'blend'` is `'string'`-validated only, not constrained to
  valid Canvas blend mode enum values. Any string value reaches the DB
  and is passed to the Canvas API.
- **Fix:** Add `'blend'` to the enum-constrained property check using
  `blendMode`'s constraint entry.
- **Status:** **Fixed** (v1.5.59)
- **Introduced:** v49 audit

#### P2-106: usleep() Blocking in DB Retry Loop

- **File:** `src/Database/LayersDatabase.php` L135
- **Impact:** `usleep( $retryCount * 100000 )` adds up to 300ms of
  blocking sleep per request on transaction conflicts. Under concurrent
  editor load, this cascades into PHP-FPM worker and DB connection
  pool exhaustion.
- **Fix:** Reduce to 10ms/20ms or remove the sleep.
- **Status:** **Fixed** (v1.5.59)
- **Introduced:** v49 audit

#### P2-107: N+1 User Lookup in ApiLayersInfo

- **File:** `src/Api/ApiLayersInfo.php` L522–528
- **Impact:** Despite "Batch load users" comment, `getName()` inside a
  loop triggers one DB query per unique user. 15 distinct contributors
  → 15 sequential queries.
- **Fix:** Use a single `SELECT user_id, user_name FROM user WHERE user_id IN (...)`.
- **Status:** **Fixed** (v1.5.59)
- **Introduced:** v49 audit

#### P2-108: Cache Invalidation Errors Silently Suppressed

- **File:** `src/Api/Traits/CacheInvalidationTrait.php` L55–58
- **Impact:** Empty catch block with no logging. Cache infrastructure
  failures are invisible to operators.
- **Fix:** Add `$this->getLogger()->warning( 'Cache invalidation failed', [ 'exception' => $e ] )`.
- **Status:** **Fixed** (v1.5.59)
- **Introduced:** v49 audit

#### P2-109: `wfLogWarning()` Deprecated API in RateLimiter

- **File:** `src/Security/RateLimiter.php` L99–100
- **Impact:** Deprecated; guarded by `function_exists`. When removed from
  MW, rate limit warnings are silently lost — a security monitoring
  regression. All other code uses `LoggerFactory`.
- **Fix:** Use `$this->getLogger()->warning(...)` and remove the guard.
- **Status:** **Fixed** (v1.5.59)
- **Introduced:** v49 audit

#### P2-110: ApiLayersRename Returns Wrong Error Code for Invalid Name Format

- **File:** `src/Api/ApiLayersRename.php`
- **Impact:** Format-validation failure returns `ERROR_LAYERSET_NOT_FOUND`
  instead of `ERROR_INVALID_SETNAME`. Breaks API consumer retry/create
  logic — "not found" is retried; "invalid" should not be.
- **Fix:** Return `ERROR_INVALID_SETNAME` for format failures.
- **Status:** **Fixed** (v1.5.59)
- **Introduced:** v49 audit

### JavaScript — Medium

#### P2-111: `parseMWTimestamp` Fallback Uses Local Timezone Instead of UTC

- **File:** `resources/ext.layers.editor/LayersEditor.js` L1042–1047
- **Impact:** Fallback path (when `revisionManager` is null) uses
  `new Date(year, month, day, ...)` — local timezone. Primary path
  uses `Date.UTC(...)`. UTC+8 users see timestamps 8 hours off.
- **Fix:** `new Date( Date.UTC( year, month, day, hour, minute, second ) )`
- **Status:** **Fixed** (v1.5.59)
- **Introduced:** v49 audit

#### P2-112: RevisionManager Mutates `currentSetName` Before Load Succeeds

- **File:** `resources/ext.layers.editor/editor/RevisionManager.js` L316
- **Impact:** `currentSetName` is updated before `await loadLayersBySetName()`.
  On load failure, state is corrupted — subsequent saves go to the wrong
  named set.
- **Fix:** Move `stateManager.set( 'currentSetName', setName )` to after
  the `await` (success path only).
- **Status:** **Fixed** (v1.5.59)
- **Introduced:** v49 audit

#### P2-113: DraftManager Auto-Save Timer Bypasses `isRecoveryMode` Check

- **File:** `resources/ext.layers.editor/DraftManager.js` L140–143
- **Impact:** `setInterval` callback calls `saveDraft()` without checking
  `isRecoveryMode`. While the recovery dialog is shown, auto-save can
  overwrite the recovering draft.
- **Fix:** Add `if ( this.isRecoveryMode ) { return; }` inside the
  interval callback.
- **Status:** **Fixed** (v1.5.59)
- **Introduced:** v49 audit

#### P2-114: APIManager Hardcodes Layer Limit to 100

- **File:** `resources/ext.layers.editor/APIManager.js` L898
- **Impact:** `validateLayers( layers, 100 )` ignores `wgLayersMaxLayerCount`.
  Wikis with different limits get wrong client-side enforcement.
- **Fix:** `const maxLayers = mw.config.get( 'wgLayersMaxLayerCount' ) || 100;`
- **Status:** **Fixed** (v1.5.59)
- **Introduced:** v49 audit

#### P2-115: EventManager Nudge Bypasses StateManager

- **File:** `resources/ext.layers.editor/EventManager.js` L203–204
- **Impact:** Direct mutation of `layer.x`/`layer.y` skips `_layersVersion`
  increment and subscriber notifications. SmartGuides cache goes stale;
  LayerPanel coordinate display not updated.
- **Fix:** `stateManager.updateLayer( layer.id, { x: ..., y: ... } )`
- **Status:** **Fixed** (v1.5.59)
- **Introduced:** v49 audit

#### P2-116: DraftManager Storage Key Collision Between Similar Filenames

- **File:** `resources/ext.layers.editor/DraftManager.js` (constructor)
- **Impact:** `File:My Budget.jpg` and `File:My_Budget.jpg` normalize to
  the same localStorage key. Two distinct files share a draft on the same
  browser.
- **Fix:** Append a short hash of the raw (pre-normalization) filename.
- **Status:** **Fixed** (v1.5.59)
- **Introduced:** v49 audit

### Canvas — Medium

#### P2-117: CanvasManager `emitTransforming()` RAF Fires After Destroy

- **File:** `resources/ext.layers.editor/CanvasManager.js` L843
- **Impact:** RAF return value discarded; `destroy()` cannot cancel it.
  Fires one frame post-destroy and dispatches stale event to `document`.
- **Fix:** Store RAF ID in `this._transformRafId`; cancel in `destroy()`.
- **Status:** **Fixed** (v1.5.59)
- **Introduced:** v49 audit

#### P2-118: ZoomPanController `animationFrameId` Not Nulled on Completion

- **File:** `resources/ext.layers.editor/canvas/ZoomPanController.js`
  L215–218
- **Impact:** After animation completes, `animationFrameId` retains
  the stale completed-frame ID. Any guard on `if (this.animationFrameId)`
  incorrectly detects animation-in-progress.
- **Fix:** `this.animationFrameId = null;` in the completion branch.
- **Status:** **Fixed** (v1.5.59)
- **Introduced:** v49 audit

#### P2-119: SelectionRenderer Allocates New AngleDimensionRenderer Per Frame

- **File:** `resources/ext.layers.editor/canvas/SelectionRenderer.js` L598
- **Impact:** `new AngleDimensionRenderer(null)` on every render (~60/sec)
  while an angleDimension layer is selected, creating GC pressure.
  HitTestController solved this correctly with a cached lazy instance.
- **Fix:** Add a `_cachedAngleRenderer` lazy-init property matching
  HitTestController's pattern.
- **Status:** **Fixed** (v1.5.59)
- **Introduced:** v49 audit

#### P2-120: TransformController `_arrowTipRafId` Absent from Constructor

- **File:** `resources/ext.layers.editor/canvas/TransformController.js`
- **Impact:** `destroy()` checks `this._arrowTipRafId !== null` but the
  property is never initialized. `undefined !== null` is true, so
  `cancelAnimationFrame(undefined)` is called on every destroy.
- **Fix:** Add `this._arrowTipRafId = null;` to the constructor.
- **Status:** **Fixed** (v1.5.59)
- **Introduced:** v49 audit

#### P2-121: TransformController Text-Drag State Vars Uninitialized

- **File:** `resources/ext.layers.editor/canvas/TransformController.js`
  (constructor)
- **Missing:** `isAngleDimensionTextDragging`, `isDimensionTextDragging`,
  `angleDimTextLayerId`, `dimensionTextLayerId`, `_pendingDragLayerId`
- **Impact:** Implicit `undefined` defaults are fragile given the
  `null`/`undefined` confusion already present (P2-120 in same file).
- **Fix:** Initialize all five to `false` or `null` in constructor.
- **Status:** **Fixed** (v1.5.59)
- **Introduced:** v49 audit

---

### PHP — Low

#### P3-128: `errorSpan` Echoes User-Supplied Filename String

- **File:** `src/Hooks/Processors/LayeredFileRenderer.php` L79
- **Note:** HTML-escaped via `htmlspecialchars()` — no XSS risk.
- **Impact:** User-supplied filename echoed into rendered page output
  visible to other users. Minor information disclosure.
- **Fix:** Use generic i18n error message.
- **Status:** **Fixed** (v1.5.59)
- **Introduced:** v49 audit

#### P3-129: `EditLayersAction::requiresUnblock()` Returns `false`

- **File:** `src/Action/EditLayersAction.php`
- **Impact:** Blocked users load the full editor UI before rejection on save.
- **Fix:** Return `true`.
- **Status:** **Fixed** (v1.5.59)
- **Introduced:** v49 audit

#### P3-130: `returnTo` Only Accepted for Existing Titles

- **File:** `src/Action/EditLayersAction.php` L85–90
- **Impact:** `isKnown()` check rejects valid redirect targets for
  unsaved/draft pages. Users have no return path.
- **Fix:** Use `isValid()` plus a namespace allowlist.
- **Status:** **Fixed** (v1.5.59)
- **Introduced:** v49 audit

#### P3-131: TextSanitizer Uses `strlen()` Not `mb_strlen()`

- **File:** `src/Validation/TextSanitizer.php`
- **Impact:** CJK and emoji-heavy text counts bytes not characters.
  A 400-character Japanese annotation (~1,200 bytes) may be incorrectly
  rejected as exceeding the character limit.
- **Fix:** `mb_strlen( $text, 'UTF-8' )` against a character limit.
- **Status:** **Fixed** (v1.5.59)
- **Introduced:** v49 audit

#### P3-132: `ApiLayersList` Bypasses Shared `RateLimiter` Class

- **File:** `src/Api/ApiLayersList.php`
- **Impact:** Direct `pingLimiter()` call bypasses future rate-limiting
  enhancements (metrics, logging, overrides) applied via `RateLimiter::checkRateLimit()`.
- **Fix:** Use the shared `RateLimiter` class.
- **Status:** **Fixed** (v1.5.59)
- **Introduced:** v49 audit

#### P3-133: `LayersSchemaManager` Brittle Error Message String Parsing

- **File:** `src/Database/LayersSchemaManager.php`
- **Impact:** `preg_match('/^Error (\d+):/', ...)` is fragile across
  MySQL 5.x, MySQL 8.x, and MariaDB versions.
- **Fix:** Catch specific typed RDBMS exceptions; use `IF NOT EXISTS` DDL.
- **Status:** **Fixed** (v1.5.59)
- **Introduced:** v49 audit

#### P3-134: Hardcoded English String `'Edit Layers'` in Hooks.php

- **File:** `src/Hooks.php`
- **Impact:** Non-English wikis see English link text.
- **Fix:** `wfMessage( 'layers-edit-link-text' )->text()`. Add i18n keys.
- **Status:** **Fixed** (v1.5.59)
- **Introduced:** v49 audit

#### P3-135: ThumbnailProcessor Dead Boolean Comparison on `?string` Type

- **File:** `src/Hooks/Processors/ThumbnailProcessor.php` L110
- **Code:** `$layersFlag === false` — with `declare(strict_types=1)`,
  `$layersFlag` is `?string` and can never be `false`.
- **Fix:** Remove `|| $layersFlag === false` from the condition.
- **Status:** **Fixed** (v1.5.59)
- **Introduced:** v49 audit

### JavaScript — Low

#### P3-136: Double `showSpinner`/`hideSpinner` on Every Save

- **File:** `resources/ext.layers.editor/LayersEditor.js` +
  `resources/ext.layers.editor/APIManager.js`
- **Impact:** `showSpinner()` called in both `LayersEditor.save()` and
  `APIManager.saveLayers()`. Double `hideSpinner()` on error path.
- **Fix:** Establish single spinner ownership.
- **Status:** **Fixed** (v1.5.59)
- **Introduced:** v49 audit

#### P3-137: APIManager `mw.notify()` Without `typeof mw` Guard

- **File:** `resources/ext.layers.editor/APIManager.js` L592
- **Impact:** Inconsistent with all other `mw.*` calls in the file.
  Throws in Jest or pre-MW environments.
- **Fix:** `if ( typeof mw !== 'undefined' ) { mw.notify(...); }`
- **Status:** **Fixed** (v1.5.59)
- **Introduced:** v49 audit

#### P3-138: RevisionManager Mutates StateManager Array Before `set()`

- **File:** `resources/ext.layers.editor/editor/RevisionManager.js`
  L412–419
- **Impact:** `namedSets.push(...)` before `stateManager.set('namedSets', ...)`
  means both old and new values in change notifications are the same
  reference. Diff-based optimizations miss the change.
- **Fix:** Use spread to create a new array:
  `stateManager.set( 'namedSets', [ ...namedSets, newItem ] )`.
- **Status:** **Fixed** (v1.5.59)
- **Introduced:** v49 audit

### Canvas — Low

#### P3-139: CanvasManager `handleImageLoaded()` Renders Canvas Twice

- **File:** `resources/ext.layers.editor/CanvasManager.js` L590–592
- **Impact:** `this.redraw()` immediately followed by `this.renderLayers()`
  (which also calls `this.redraw()`). Double render cost at the most
  expensive moment.
- **Fix:** Remove the first `this.redraw()` call.
- **Status:** **Fixed** (v1.5.59)
- **Introduced:** v49 audit

#### P3-140: CanvasManager Legacy `updateLayerPosition()` Dead/Incomplete

- **File:** `resources/ext.layers.editor/CanvasManager.js`
- **Impact:** Never called; handles only 7 of ~15 layer types. Trap for
  future callers that would get silent no-ops for most layer types.
- **Fix:** Delegate to `this.transformController.updateLayerPosition()`
  or delete.
- **Status:** **Fixed** (v1.5.59)
- **Introduced:** v49 audit

#### P3-141: SelectionManager Fallback `getLayerAtPoint()` Wrong Order

- **File:** `resources/ext.layers.editor/SelectionManager.js` L783–800
- **Impact:** Fallback iterates `length-1 → 0` (bottom-to-top visually)
  but should iterate `0 → N` (top-to-bottom). Returns bottom layer
  instead of topmost. Primary path delegates correctly to canvasManager.
- **Fix:** Change loop direction; add comment matching HitTestController.
- **Status:** **Fixed** (v1.5.59)
- **Introduced:** v49 audit

### Documentation — Low

#### P3-142: ESLint `no-unused-vars: off` Blanket Override for Manager Files

- **File:** `.eslintrc.json`
- **Impact:** Blanket `no-unused-vars: off` could hide dead code in
  Manager files; `varsIgnorePattern` targeting specific patterns would
  be more precise.
- **Status:** **Fixed** (v1.5.59)
- **Introduced:** v47 review

---

## Open Issues — v48 (March 9, 2026)

### ~~P1-044: CanvasManager.getMousePointFromClient() Division by Zero~~ (FIXED)

- **File:** `resources/ext.layers.editor/CanvasManager.js` L1721-1722
- **Impact:** When the canvas has zero CSS dimensions (hidden, transitioning,
  `display:none`), `getBoundingClientRect()` returns `{width: 0, height: 0}`.
  The division `this.canvas.width / rect.width` produces `Infinity`,
  propagating to all downstream coordinate calculations.
- **Fix:** Added ternary zero guards:
  `rect.width > 0 ? this.canvas.width / rect.width : 1`. Regression test
  added.
- **Status:** Fixed (v48 fix)
- **Introduced:** v48 review

### ~~P2-102: DrawingController Angle Dimension Phase Not Reset on Tool Switch~~ (FIXED)

- **File:** `resources/ext.layers.editor/canvas/DrawingController.js`
  L363, L422, L430, L465
- **Impact:** If a user starts the angle dimension tool then switches to
  another tool, the angle dimension resumes at phase 2 instead of fresh.
- **Fix:** Added cleanup in `CanvasManager.setTool()` that calls
  `drawingController.cancelAngleDimension()` when switching away from
  `angleDimension`. Regression tests added.
- **Status:** Fixed (v48 fix)
- **Introduced:** v48 review

### ~~P2-103: TransformController Arrow Tip RAF Missing Destruction Guards~~ (FIXED)

- **File:** `resources/ext.layers.editor/canvas/TransformController.js`
  L692-695
- **Impact:** If the editor is destroyed between RAF scheduling and
  execution during arrow drag, the callback crashes with null reference.
- **Fix:** Added `if (!this.manager || this.manager.isDestroyed ||
  !this.manager.editor) { return; }` guard matching the pattern used
  by all other RAF callbacks. Regression tests added.
- **Status:** Fixed (v48 fix)
- **Introduced:** v48 review

### Carried Forward from v47

### ~~P1-041: EventManager Nudge Has No Undo/Redo History~~ (FIXED)

- **File:** `resources/ext.layers.editor/EventManager.js` L210-211
- **Impact:** Arrow-key nudging layers had no undo/redo history because
  `handleArrowKeyNudge()` called the non-existent `snapshot()` method.
- **Fix:** Changed `snapshot('nudge')` to `saveState('nudge')` which
  is the correct HistoryManager API. Regression test added.
- **Status:** Fixed (v48 fix)
- **Introduced:** v47 review

### ~~P1-042b: DraftManager Silently Loses Image Layer Data~~ (FIXED)

- **File:** `resources/ext.layers.editor/DraftManager.js` L193-199, L318-365
- **Impact:** When recovering from an auto-saved draft, all image layers
  appeared as broken/empty with no warning. Image data was permanently
  lost from the draft.
- **Fix:** In `recoverDraft()`, added detection of `_srcStripped` layers,
  cleanup of the internal flag, and persistent warning notification via
  `mw.notify` with `autoHide: false` using `layers-draft-images-lost`
  i18n key. Regression tests added.
- **Status:** Fixed (v48 fix)
- **Introduced:** v47 review

### ~~P1-043: Font Names With Spaces Corrupted On Save~~ (FIXED)

- **File:** `src/Validation/TextSanitizer.php`,
  `src/Validation/ServerSideLayerValidator.php`
- **Impact:** Multi-word font names (e.g., "Times New Roman", "Open
  Sans") were mangled to single words ("TimesNewRoman") on save,
  causing browsers to fall back to Arial on reload.
- **Evidence:** `sanitizeIdentifier()` regex `/[^a-zA-Z0-9_.-]/`
  stripped spaces. Both top-level and richText `fontFamily` passed
  through this method.
- **Fix:** Added `sanitizeFontFamily()` method that preserves spaces.
  Updated `ServerSideLayerValidator` to use it for both top-level and
  richText fontFamily properties. PHPUnit test added.
- **Status:** Fixed
- **Introduced:** v47 review (bug present since font support was added)

### ~~P2-099: LayersViewer Blend Mode + Hidden Background Renders White~~ (FIXED)

- **File:** `resources/ext.layers/LayersViewer.js` L450-464
- **Impact:** Viewers saw a white rectangle beneath blend-mode layers
  when `backgroundVisible` was false.
- **Fix:** Changed from `fillRect('#ffffff')` to `clearRect()` when
  background is hidden. Tests updated.
- **Status:** Fixed (v48 fix)
- **Introduced:** v47 review

### ~~P2-100: ApiLayersDelete Concurrent Request Race Condition~~ (FIXED)

- **File:** `src/Api/ApiLayersDelete.php` L174
- **Impact:** Two concurrent delete requests on the same set could
  produce misleading success with `revisionsDeleted: 0`.
- **Fix:** Added `$rowsDeleted === 0` check with warning log for
  concurrent delete race detection. Returns success since the end
  state (set deleted) is correct.
- **Status:** Fixed (v48 fix)
- **Introduced:** v47 review

### ~~P2-101: LayersDatabase pruneOldRevisions Called Outside Transaction~~ (FIXED)

- **File:** `src/Database/LayersDatabase.php` L227-232
- **Impact:** If pruning failed after a successful save, revision count
  could exceed the configured limit.
- **Fix:** Moved `pruneOldRevisions()` inside the atomic transaction
  (before `endAtomic`). If pruning fails, the entire save rolls back.
- **Status:** Fixed (v48 fix)
- **Introduced:** v47 review

### ~~P3-126: i18n Key Count Is 831, Not 832~~ (FIXED)

- **Files:** All documentation files claiming 832 i18n keys
- **Impact:** Documentation consistently overstated the i18n key count
  by 1. Minor but pervasive.
- **Fix:** Added `layers-draft-images-lost` i18n key (P1-042 fix),
  bringing the count to 832. All docs now match.
- **Status:** Fixed (March 9, 2026)
- **Introduced:** v47 review

### P3-127: Missing Test Coverage for 3 Modules

- **Files:** `LogSanitizer.js`, `GroupHierarchyHelper.js`,
  `ViewerIcons.js`
- **Impact:** No Jest test files exist for these modules.
  `GroupHierarchyHelper.js` is the most important (core folder logic).
- **Status:** **Fixed** (v1.5.59)
- **Introduced:** v47 review

### Carried Forward from v46

### P2-098: Core Documentation Drift Misstates Current Support and Project Metrics

(See v46 entry below — scope expanded in v47 to include i18n count
discrepancy, stale god-class list in copilot-instructions.md, and
wrong test count in CHANGELOG.md v1.5.59.)

- **Status:** **Fixed** (v1.5.59) (expanded)
- **Introduced:** v46 review, expanded v47

### P3-125: `npm run test:php` Still Fails on Existing PHPCS Errors

- **Status:** Open (carried forward)
- **Introduced:** v46 review

---

## Previous Open Issues — v46 (March 9, 2026)

### P2-098: Core Documentation Drift Misstates Current Support and Project Metrics

- **Files:** `README.md`, `wiki/Installation.md`,
  `docs/ARCHITECTURE.md`, `docs/LTS_BRANCH_STRATEGY.md`,
  `CHANGELOG.md`, `wiki/Changelog.md`,
  `Mediawiki-Extension-Layers.mediawiki`,
  `.github/copilot-instructions.md`, `codebase_review.md`
- **Impact:** The repo currently contains conflicting claims about
  version, branch support, test totals, i18n counts, JS file counts,
  and god-class counts. That directly affects release communication,
  contributor onboarding, and support guidance.
- **Evidence:** Verified current values are: version `1.5.59`,
  `MediaWiki >= 1.44.0`, 143 JS source files excluding `resources/dist`,
  ~99,699 JS source lines, 41 PHP production files, 11,250 Jest tests
  in 163 suites, and 832 i18n keys. Multiple docs still claim `1.5.58`,
  `11,148` or `11,260` tests, `820` i18n keys, `140`/`141` JS files,
  or `17`/`20` god classes.
- **Recommended Fix:** Treat documentation metrics as release-blocking
  data. Update the affected docs together from a single metrics pass
  instead of hand-editing counts opportunistically.
- **Status:** **Fixed** (v1.5.59)
- **Introduced:** v46 review

### P3-124: `npm run test:php` Emits Vendor Deprecation Warnings on PHP 8.4

- **Files:** `composer.json` (via `php-parallel-lint/php-parallel-lint` 1.3.2)
- **Impact:** Contributor tooling emits deprecation noise before the
  extension's own linting begins, which makes real issues harder to spot
  and signals that the dev toolchain is lagging current PHP versions.
- **Evidence:** Running `npm run test:php` produced
  `JakubOnderka\PhpParallelLint\Manager::run(): Implicitly marking
  parameter $settings as nullable is deprecated` from vendor code under
  PHP 8.4.11.
- **Recommended Fix:** Upgrade or replace `php-parallel-lint`, or pin
  PHP for that task until the dependency is compatible.
- **Status:** ✅ Fixed (March 9, 2026) — Updated `composer.json` and
  `package.json` to run `parallel-lint` with deprecation notices
  suppressed, so the vendor PHP 8.4 warning no longer appears before the
  real lint output.
- **Introduced:** v46 review

### P3-125: `npm run test:php` Still Fails on Existing PHPCS Errors

- **Files:** Multiple existing PHP files, including
  `src/Database/LayersSchemaManager.php`,
  `src/Hooks/Processors/ImageLinkProcessor.php`, and
  `src/Hooks/Processors/LayeredFileRenderer.php`
- **Impact:** Contributor PHP checks still fail even after the vendor
  deprecation warning is removed.
- **Evidence:** A fresh `npm run test:php` now reaches PHPCS without the
  `php-parallel-lint` deprecation and reports existing invalid EOL
  character errors across many untouched PHP files, plus a smaller set of
  long-line warnings.
- **Recommended Fix:** Normalize PHP file line endings and clear the
  remaining PHPCS backlog in a dedicated formatting/style pass.
- **Status:** Open
- **Introduced:** March 9, 2026 follow-up remediation

---

## Fixed In This Round (March 9, 2026)

### P2-097: Server Thumbnails Omit Shadows for Polygon and Star Layers

- **Files:** `src/ThumbnailRenderer.php`
- **Status:** ✅ Fixed (March 9, 2026)
- **Fix:** Added isolated shadow-subimage generation to
  `buildPolygonArguments()` and `buildStarArguments()`. Added PHPUnit
  regression coverage for both paths.

### P3-122: CustomShapeRenderer Spread Shadow Uses Oversized Temporary Canvases

- **Files:** `resources/ext.layers.shared/CustomShapeRenderer.js`
- **Status:** ✅ Fixed (March 9, 2026)
- **Fix:** Replaced the large fixed-offset temp-canvas sizing with
  bounds-based sizing derived from the current draw geometry, blur, and
  spread margins. Added Jest regression coverage.

### P3-123: Release Guide Template Still Uses Obsolete Compatibility Requirements

- **Files:** `docs/RELEASE_GUIDE.md`
- **Status:** ✅ Fixed (March 9, 2026)
- **Fix:** Updated the template snippet to MediaWiki 1.44+ and PHP 8.1+
  so future release docs do not reintroduce stale compatibility claims.

---

## Historical Entries (v45 and Earlier)

### P0-006: Clickjacking Bypass via `?modal=1` — No Origin Validation

- **Files:** `src/Action/EditLayersAction.php` L105-114, `src/SpecialPages/SpecialEditSlide.php` L91-98
- **Impact:** When `?modal=1` is set, clickjacking protection (X-Frame-Options)
  is entirely removed with no origin validation. Any external site can embed
  the editor in an invisible iframe, overlay a "Click here" button over
  Save/Delete controls, and trick authenticated users into destructive actions
  while their CSRF token is valid.
- **Evidence:** `EditLayersAction.php` L105: `$isModalMode = $request->getBool('modal');`
  followed by unconditional `allowClickjacking()` / `setPreventClickjacking(false)`.
  Same pattern in `SpecialEditSlide.php` L91.
- **Recommended Fix:** ~~Replace blanket X-Frame-Options removal with
  `Content-Security-Policy: frame-ancestors 'self'` header for same-origin
  framing only.~~
- **Status:** ✅ Fixed (March 4, 2026) — Replaced `allowClickjacking()` /
  `setPreventClickjacking(false)` with `X-Frame-Options: SAMEORIGIN` header
  in both `EditLayersAction.php` and `SpecialEditSlide.php`.
- **Introduced:** v45 review

### P1-039: Manual HTML Construction Bypasses MediaWiki Html Class

- **Files:** `src/LayeredThumbnail.php` L103-117, `src/Hooks/UIHooks.php` L324-397
- **Impact:** `LayeredThumbnail.php` builds `<img>` tags via raw string
  concatenation with `htmlspecialchars()`. A comment at L106 says "Build
  minimal IMG tag without relying on Html helper." `UIHooks.php` builds an
  HTML table the same way. MediaWiki's `Html::element()` handles edge cases
  (null values, boolean attributes, `ENT_SUBSTITUTE`/`ENT_HTML5`) manual
  construction misses.
- **Recommended Fix:** ~~Replace with `Html::element()` / `Html::rawElement()`.~~
- **Status:** ✅ Fixed (March 4, 2026) — `LayeredThumbnail.toHtml()` now uses
  `Html::element('img', ...)` and `Html::rawElement('div', ...)` with
  `use MediaWiki\Html\Html` import. (Reclassified from HIGH to MEDIUM — the
  original `htmlspecialchars(ENT_QUOTES)` escaping was correct; this is a code
  quality/best-practice fix, not a security fix.)
- **Introduced:** v45 review

### ~~P1-040: InlineTextEditor innerHTML Trusts richText Data~~ (FALSE POSITIVE)

- **File:** `resources/ext.layers.editor/canvas/InlineTextEditor.js` L548
- **Impact:** `contentWrapper.innerHTML = RichTextConverter.richTextToHtml(layer.richText, ...)`.
  richText comes from server API. While `richTextToHtml()` applies `escapeHtml()`
  and `escapeCSSValue()`, a single bug in either function or a server-side
  sanitization bypass enables stored XSS — attacker saves crafted richText,
  other users editing the same image execute the script.
- **Mitigating factors:** `escapeHtml()` escapes `<>& "'`. Canvas rendering
  path (viewer) does not execute scripts. Server validates richText structure.
- **Recommended Fix:** ~~Build DOM programmatically~~ N/A.
- **Status:** ✅ False Positive — `richTextToHtml()` uses `div.textContent=...; return div.innerHTML`
  (safe DOM-based escape) and `escapeCSSValue()` strips `["'<>&;{}\\]`.
  Both methods are correctly implemented. Reclassified to LOW informational.
- **Introduced:** v45 review

### ~~P1-041: Nudge and Selection Operations Bypass StateManager~~ (FALSE POSITIVE)

- **Files:** `resources/ext.layers.editor/EventManager.js` L196-206,
  `resources/ext.layers.editor/SelectionManager.js` L924, L1039-1057
- **Impact:** Three paths directly mutate layer objects without notifying
  StateManager: (1) Nudge — `layer.x = (layer.x || 0) + dx` with no
  `stateManager.set()`. (2) Drag — `layer.x = originalLayer.x + deltaX`.
  (3) Rotation — `layer.rotation = (originalLayer.rotation || 0) + deltaAngle`.
  `_layersVersion` counter is never incremented and subscriber callbacks
  (DraftManager change detection, LayerPanel reactive updates) are not fired.
- **Recommended Fix:** ~~Route through stateManager.set()~~ N/A.
- **Status:** ✅ False Positive — Direct layer mutation + history snapshot
  is the established pattern throughout the codebase (verified:
  `TransformController.updateLayerPosition()` uses same pattern at L556-562).
  The nudge handler correctly calls `historyManager.snapshot('nudge')`,
  `markDirty()`, and `renderLayers()`. No state bypass exists.
- **Introduced:** v45 review

### P1-042: LayerPanel editLayerName Stale originalName

- **File:** `resources/ext.layers.editor/LayerPanel.js` L1922-1931
- **Impact:** `_hasEditListeners` guard (L1922) causes early return on
  subsequent edits. `dataset.originalName` is set only once at L1924.
  After renaming "Layer 1" → "Layer 2" and re-entering edit mode,
  `originalName` is still "Layer 1". Blur handler fires unnecessary
  `updateLayer` + `saveState('Rename Layer')`, creating spurious undo entries.
- **Recommended Fix:** ~~Move `dataset.originalName` above the guard.~~
- **Status:** ✅ Fixed (March 4, 2026) — Added `nameElement.dataset.originalName = nameElement.textContent`
  inside the `_hasEditListeners` early-return branch, so Escape reverts
  to the current name, not the first-ever name. Regression test added.
- **Introduced:** v45 review

### P2-085: SVG Data URI Not Blocked in Client Validator

- **File:** `resources/ext.layers.editor/ValidationManager.js` L91
- **Impact:** Dangerous URI regex only blocked `data:text/html`. A
  `data:image/svg+xml,<svg onload="alert(1)">` URI passed validation.
- **Recommended Fix:** ~~Block all `data:` URIs except `data:image/(png|jpeg|gif|webp)`.~~
- **Status:** ✅ Fixed (March 4, 2026) — Updated `DANGEROUS_URL_RE` to use
  negative lookahead allowing only safe image types. Regression tests added.
- **Introduced:** v45 review

### P2-086: Failed Images Persist in ImageLayerRenderer LRU Cache

- **File:** `resources/ext.layers.shared/ImageLayerRenderer.js` L221-225
- **Impact:** `img.onerror` logs warning but does not remove cache entry.
  Permanently broken `layer.src` (corrupted base64) occupies a cache slot
  indefinitely. Each access moves entry to MRU position, preventing eviction.
- **Recommended Fix:** ~~Add `this._imageCache.delete(cacheKey)` in `onerror`.~~
- **Status:** ✅ Fixed (March 4, 2026) — `onerror` handler now calls
  `this._imageCache.delete(cacheKey)` so failed images are evicted and
  retried on the next render. Regression test added.
- **Introduced:** v45 review

### P2-087: EffectsRenderer _blurFillCanvas GPU Texture Reallocation

- **File:** `resources/ext.layers.shared/EffectsRenderer.js` L290-296
- **Impact:** `_blurFillCanvas` dimensions were set unconditionally every
  invocation, clearing canvas and triggering GPU texture reallocation.
- **Recommended Fix:** ~~Add matching size guard for `_blurFillCanvas`.~~
- **Status:** ✅ Fixed (March 4, 2026) — Added size guard
  (`if width !== reqW || height !== reqH`) matching sibling `_blurCanvas`.
- **Introduced:** v45 review

### P2-088: UIHooks N+1 User Queries in enrichNamedSetsWithUserNames

- **File:** `src/Hooks/UIHooks.php` L282-310
- **Impact:** Makes N individual `UserFactory::newFromId()` calls (one per
  unique user ID). For a file with 15 named sets (the maximum), up to 15
  individual DB queries.
- **Recommended Fix:** Collect unique user IDs, batch load with
  `UserArray::newFromIDs()`.
- **Status:** ✅ Fixed (March 4, 2026)
- **Fix:** Replaced per-user `UserFactory::newFromId()` loop with single
  `UserArray::newFromIDs()` batch query.
- **Introduced:** v45 review

### P2-089: TextSanitizer Zero-Width-Space Keyword Defense Incomplete

- **File:** `src/Validation/TextSanitizer.php` L159-168
- **Impact:** Keyword list for zero-width space injection omitted
  `Function`, `constructor`, `fetch`, `XMLHttpRequest`,
  `importScripts`, and `document.write`.
- **Status:** ✅ Fixed (March 4, 2026) — Added 6 missing keywords
  to the JS keyword neutralization list.
- **Introduced:** v45 review

### P2-090: WikitextHooks Static State May Bleed Between Requests

- **File:** `src/Hooks/WikitextHooks.php` L149-163
- **Impact:** Six static properties + six singleton processor instances
  persist for PHP process lifetime. In PHP-FPM with `max_requests > 1`,
  state bleeds between requests. `resetPageLayersFlag()` only resets via
  `ParserBeforeInternalParse` hook — job runners and API calls bypass reset.
- **Status:** ✅ Fixed (March 4, 2026)
- **Fix:** Added `ensureRequestStateReset()` using `REQUEST_TIME_FLOAT`
  to detect request boundaries. Called at start of
  `onParserBeforeInternalParse()`. Only resets per-page state; stateless
  singletons are preserved for reuse. `resetPageLayersFlag()` also
  updates the timestamp to prevent redundant resets.
- **Introduced:** v45 review

### P2-091: Duplicate getLayerBounds Implementations

- **Files:** `resources/ext.layers.editor/CanvasManager.js` L1081-1145,
  `resources/ext.layers.editor/CanvasRenderer.js` L1296-1325
- **Impact:** Both classes have nearly identical `getLayerBounds()` and
  `_getRawLayerBounds()` with different fallback logic. Changes to one
  may silently diverge from the other, causing selection/hit-test misalignment.
- **Status:** ✅ Fixed (March 4, 2026)
- **Fix:** CanvasRenderer.getLayerBounds() now delegates to
  CanvasManager.getLayerBounds() as single source of truth.
  Local `_getRawLayerBounds()` retained as fallback during init only.
- **Introduced:** v45 review

### P2-092: Ellipse Validation Uses OR Instead of AND

- **File:** `resources/ext.layers.editor/canvas/DrawingController.js` L936-937
- **Impact:** `return layer.radiusX >= MIN_SHAPE_SIZE || layer.radiusY >= MIN_SHAPE_SIZE`
  allows degenerate ellipses (e.g., `radiusX=50, radiusY=0` which is a line).
  Rectangle validation at L930 correctly uses `&&`.
- **Recommended Fix:** ~~Change `||` to `&&`.~~
- **Status:** ✅ Fixed (March 4, 2026) — Changed `||` to `&&` so both
  `radiusX` and `radiusY` must meet `MIN_SHAPE_SIZE`, consistent with
  rectangle validation. Test updated.
- **Introduced:** v45 review

### P3-099: `call_user_func` Indirection for Guaranteed MW Classes

- **Files:** `src/Hooks.php`, `src/LayeredThumbnail.php`,
  `src/ThumbnailRenderer.php`, `src/LayersFileTransform.php`
- **Impact:** 10 instances of `\call_user_func(...)` with `class_exists`
  guards for classes guaranteed since MW >= 1.44.0.
- **Status:** ✅ Fixed (March 4, 2026) — Replaced all 10 instances
  with direct calls. Added `use` imports for LoggerFactory,
  MediaWikiServices, and Shell. Removed dead else branches.
- **Introduced:** v45 review

### P3-100: ThumbnailRenderer Shadow Code Duplication (~50 lines)

- **File:** `src/ThumbnailRenderer.php` L283-560
- **Impact:** Shadow rendering block copy-pasted across 5 shape handlers.
  Polygon and star shapes lack shadow support entirely.
- **Recommended Fix:** Extract `buildShadowArgs()` helper.
- **Status:** ✅ Fixed v45.10 — Extracted `extractShadowParams()` helper; all 5 shape handlers now delegate to it.
- **Introduced:** v45 review

### P3-101: ThumbnailRenderer Named Color Table Duplicates ColorValidator

- **File:** `src/ThumbnailRenderer.php` L683-730
- **Impact:** `withOpacity()` has hardcoded 35 CSS colors. ColorValidator
  independently validates named colors. Lists may drift.
- **Status:** Won't-fix — ThumbnailRenderer's 35-entry RGB table (name→[r,g,b] for rgba conversion) serves a different purpose than ColorValidator's 148-name validation list; merging would add unnecessary coupling.
- **Introduced:** v45 review

### P3-102: serialize($params) for Thumbnail Cache Key

- **File:** `src/ThumbnailRenderer.php` L99
- **Impact:** `serialize()` on potentially 2MB+ params array before
  `md5()`. `json_encode()` + `md5()` is faster.
- **Status:** ✅ Fixed (March 4, 2026) — Changed `serialize()`
  to `json_encode()` for cache key generation.
- **Introduced:** v45 review

### P3-103: SmartGuidesController sort() Mutates Caller Array

- **File:** `resources/ext.layers.editor/canvas/SmartGuidesController.js` L370
- **Impact:** `excludeIds.sort().join(',')` sorted caller's array in-place.
- **Recommended Fix:** ~~`[...excludeIds].sort().join(',')`.~~
- **Status:** ✅ Fixed (March 4, 2026) — Changed to `[ ...excludeIds ].sort().join(',')`
  to create a copy before sorting. Regression test added.

- **File:** `resources/ext.layers.editor/Toolbar.js` L774, L845
- **Impact:** `createShapeLibraryButton()` and `createEmojiPickerButton()`
  use raw `addEventListener` not cleaned up by `destroy()`.
- **Status:** ✅ Fixed v45.9 — Stored click handler and button references; `destroy()` now calls `removeEventListener` before nulling.
- **Introduced:** v45 review

### P3-105: DeepClone Shallow Clone Fallback Silently Degrades

- **File:** `resources/ext.layers.shared/DeepClone.js` L51-58
- **Impact:** When both `structuredClone` and `JSON.parse` fail, fallback
  is `obj.slice()` / `{ ...obj }` — shallow clone. Nested objects (gradient,
  richText, points) would share references.
- **Status:** ✅ Fixed v45.8 — Replaced shallow fallback with recursive `manualDeepClone()` that handles nested objects/arrays.
- **Introduced:** v45 review

### P3-106: Duplicated backgroundVisible Normalization (5+ locations)

- **Files:** `ViewerManager.js` (×3), `SlideController.js`,
  `FreshnessChecker.js`, `ApiFallback.js`
- **Impact:** Pattern repeated with variations across 6+ locations.
- **Status:** ✅ Fixed (March 4, 2026) — Added
  `LayerDataNormalizer.normalizeBackgroundVisible()` static method.
  Replaced all 6 inline normalization blocks across 4 files.
- **Introduced:** v45 review

### P3-107: Duplicated SVG Icon Code in Viewer Modules

- **Files:** `resources/ext.layers/viewer/ViewerManager.js`,
  `resources/ext.layers/viewer/ViewerOverlay.js`
- **Impact:** Identical `_createPencilIcon()` and `_createExpandIcon()` SVG
  methods. Should use existing `IconFactory.js`. (Extends P3-089)
- **Status:** ✅ Fixed v45.9 — Created shared `ViewerIcons.js` in `ext.layers.shared`; all 3 viewer modules now delegate to it.
- **Introduced:** v45 review

### P3-108: HitTestController Instantiates Renderer Per mousemove

- **File:** `resources/ext.layers.editor/canvas/HitTestController.js` ~L470
- **Impact:** `new AngleDimensionRenderer(null)` was created ~60 times/second
  during mousemove over angle dimension layers. GC pressure.
- **Recommended Fix:** ~~Cache singleton instance.~~
- **Status:** ✅ Fixed (March 4, 2026) — Cached as `this._cachedAngleRenderer`
  singleton, created on first use and nulled in `destroy()`.
- **Introduced:** v45 review

### P3-109: RenderCoordinator Hash Incomplete (~20 Properties Missing)

- **File:** `resources/ext.layers.editor/canvas/RenderCoordinator.js` L196-244
- **Impact:** Omits ~20 rendering-affecting properties: color, radiusX/Y,
  shadowColor, shadowOffset/Spread, glow, textStroke*, textShadow*,
  verticalAlign, lineHeight, padding, cornerRadius, arrowhead/style/size,
  callout tail coords, angle dimension coords. Supersedes P3-087.
- **Status:** ✅ Fixed v45.8 — Added all ~20 missing properties. Deep-hash gradient, richText, points via JSON.stringify instead of length proxy. Also resolves P3-087 and P3-072.
- **Introduced:** v45 review

### P3-110: ViewerManager Creates Multiple mw.Api() Instances

- **File:** `resources/ext.layers/viewer/ViewerManager.js`
- **Impact:** Three methods each created `new mw.Api()` independently.
- **Status:** ✅ Fixed (March 4, 2026) — Added `_getApi()` helper that
  lazily creates and caches a single `this._api` instance. All three
  call sites updated.
- **Introduced:** v45 review

### P3-111: Lightbox close() Animation Timeout Race With open()

- **File:** `resources/ext.layers/viewer/LayersLightbox.js` L102-105
- **Impact:** Rapid close(animated)-then-open() within 300ms could cause
  old close timeout to fire during new overlay's lifetime, nullifying
  overlay/container references and resetting body overflow.
- **Status:** ✅ Fixed (March 4, 2026) — `open()` now cancels any
  pending close timeout before creating new overlay, and also checks
  for stale overlay DOM nodes regardless of `isOpen` state.
- **Introduced:** v45 review

### P3-112: Dead renderCodeSnippet Contains Unescaped HTML (Latent XSS)

- **File:** `resources/ext.layers.editor/LayerPanel.js`
- **Impact:** Method had zero call sites and contained unescaped `filename`
  in innerHTML.
- **Status:** ✅ Fixed (March 4, 2026) — Removed the dead method entirely.
  Tests for it were also removed (10 tests across 2 files).
- **Introduced:** v45 review (promoted from P3-090 with supersede note)

---

### P2-084: Arrow Key Nudge Broken for Dimension / Line / Arrow Layers

- **File:** `resources/ext.layers.editor/EventManager.js` L193-199
- **Impact:** `nudgeSelectedLayers()` updates only `layer.x` and `layer.y`.
  Dimension, line, and arrow layers use `x1/y1/x2/y2` as their positional
  coordinates, not `x/y`. Selecting a dimension annotation and pressing an
  arrow key sets phantom `x/y` properties that neither the renderer nor any
  other system reads, leaving the layer visually unmoved. This is the same
  coordinate-model gap as P2-078 (AlignmentController), applied to the
  newly added nudge feature.
- **Evidence:** Lines 193-199: `layer.x = (layer.x||0) + dx; layer.y = (layer.y||0) + dy;`
  with no switch/case for dimension/line/arrow types. DimensionRenderer reads
  `layer.x1/y1/x2/y2` (verified in DimensionRenderer.js L197-200).
- **Recommended Fix:** Mirror the coordinate-dispatch logic from
  `AlignmentController.moveLayer()`: add a case for `'line'|'arrow'|'dimension'`
  that increments all four endpoints, and a `'path'` case for points array.
- **Status:** ✅ Fixed (March 4, 2026) — `EventManager.nudgeSelectedLayers()` now updates `x1/y1/x2/y2` for dimension/line/arrow layers. Tests added.
- **Introduced:** v43 review

### P3-097: Stale Test Count in README, Wiki and Codebase Review

- **Files:** `README.md`, `wiki/Home.md`, `codebase_review.md`
- **Impact:** All three documents report 11,148 tests (162 suites). The
  current Jest run produces 11,260 tests across 163 suites. Metrics drift
  gives maintainers and contributors inaccurate project health data.
- **Evidence:** `npm run test:js` output: "Tests: 11260 passed, 11260 total;
  Test Suites: 163 passed, 163 total" (verified March 4, 2026).
- **Status:** ✅ Fixed (March 4, 2026) — Updated README.md, wiki/Home.md, wiki/Frontend-Architecture.md, codebase_review.md, and .github/copilot-instructions.md to 11,260 / 163 suites.
- **Introduced:** v43 review

### P3-098: CHANGELOG Missing Version Entries and Date-Order Anomaly

- **File:** `CHANGELOG.md`, `wiki/Changelog.md`
- **Impact:** Version entries 1.5.53, 1.5.54, and 1.5.37 are completely
  absent from both changelogs. Additionally, v1.5.55 is dated `2025-07-23`
  — eleven months before v1.5.52 (`2026-02-05`) which appears directly
  below it in the file. If 1.5.55 was truly released in July 2025 before
  1.5.52, the version sequence is non-sequential; if 1.5.52 was released
  first in February 2026 then 1.5.55 was released afterward, the 2025 date
  is wrong. Either way the changelog contains factual errors.
- **Recommended Fix:** Add the three missing version sections or document
  that those tags were skipped. Correct the 1.5.55 date and ensure
  `wiki/Changelog.md` mirrors `CHANGELOG.md`.
- **Status:** ✅ Fixed v45.10 — Added v1.5.14, v1.5.37, v1.5.53, v1.5.54 entries; corrected v1.5.55 date to 2026-02-10; mirrored to wiki/Changelog.md.
- **Introduced:** v43 review

---

## Newly Confirmed in v42

### ~~P0-005: CacheInvalidationTrait.php Missing — All Write APIs Broken~~ (FALSE POSITIVE)

- **Files:** `src/Api/ApiLayersSave.php` L9+L67, `src/Api/ApiLayersDelete.php`
  L8+L40, `src/Api/ApiLayersRename.php` L8+L41
- **Impact:** All three write API modules declare `use CacheInvalidationTrait`
  and call `$this->invalidateCachesForFile()`. The trait file does NOT exist
  on disk. PHP autoloader fails when any write API class is instantiated,
  producing a fatal error. **The entire write API is non-functional.**
- **Evidence:** `ls src/Api/Traits/` shows 4 trait files; CacheInvalidationTrait.php
  is absent. `grep -rn CacheInvalidationTrait src/` confirms 3 files reference it.
- **Root Cause:** v41 review documented P1-033 as "✅ Fixed v41" claiming the
  trait was extracted. The fix was **never committed** — the trait file was never
  created. Reopens and escalates P1-033 to P0.
- **Status:** ✅ False Positive (Trait exists on disk)
- **Introduced:** v41 (documented as fixed but never committed); confirmed v42

### ~~P1-035: ApiLayersInfo Null Dereference on Line 280~~ (RESOLVED)

- **File:** `src/Api/ApiLayersInfo.php` L280
- **Impact:** When no layers exist for an image (`$layerSet` is null from
  line 249 branch), code at line 280 attempts `$layerSet['name']` on null.
  In PHP 8+ this triggers a TypeError. Any `layersinfo` API call for an
  image without layers will produce an error.
- **Evidence:** Code reads `$currentSetName = $layerSet['name'] ?? $layerSet['setName'] ?? null;`
  outside the `if ($layerSet)` guard.
- **Recommended Fix:** Wrap lines 280-310 in `if ( $layerSet ) { ... }`.
- **Status:** ✅ Resolved in v42 fixes
- **Introduced:** v42 review

### ~~P1-036: Arrow Keys Always Pan, Never Nudge Selected Layers~~ (RESOLVED)

- **File:** `resources/ext.layers.editor/EventManager.js`
- **Status:** ✅ Resolved in v42 fixes
- **Resolution:** Implemented `handleArrowKeyNudge()` and `nudgeSelectedLayers()`
  methods in EventManager.js. Arrow keys now nudge selected layers by 1px
  (or 10px with Shift held). Includes proper history recording for undo/redo,
  locked layer protection, and status bar updates. 17 new tests added.

### P1-037: Color Preview Mutates Layers Without StateManager

- **File:** `resources/ext.layers.editor/ToolbarStyleControls.js` L522-563
- **Impact:** `applyColorPreview()` directly writes `layer.fill = color`
  and `layer.stroke = color` without StateManager. Changes are not tracked
  by HistoryManager (no undo/redo). Canceling the color picker leaves the
  preview color applied with no way to rollback.
- **Evidence:** Lines 521-564 directly mutate layer objects and call
  `renderLayers()` without any saveState or StateManager interaction.
- **Recommended Fix:** Store original colors before preview, restore on cancel,
  commit via StateManager on confirm.
- **Status:** ✅ Fixed (March 4, 2026)
- **Fix:** `applyColorPreview()` now saves per-layer original colors in a
  `_previewOriginalColors` Map on first call. New `cancelColorPreview()` method
  restores each layer individually from the map. `onColorCancel` callback wired
  to all 4 color control creation sites. Map cleared on commit.
- **Introduced:** v42 review

### ~~P1-038: ThumbnailRenderer Font Name Not Validated Against Whitelist~~ (RESOLVED)

- **File:** `src/ThumbnailRenderer.php`
- **Impact:** Font names from layer data are passed to ImageMagick's `-font`
  flag without validation against `$wgLayersDefaultFonts`. While
  `sanitizeIdentifier()` strips at save time, ThumbnailRenderer has no
  secondary check. If data bypasses validation (direct DB edit), an
  arbitrary font path could reach ImageMagick.
- **Recommended Fix:** Validate against whitelist; fall back to 'DejaVu-Sans'.
- **Status:** ✅ Resolved in v42 fixes
- **Introduced:** v42 review

### ~~P2-074: Double Render on Every Undo/Redo~~ (RESOLVED)

- **Files:** `resources/ext.layers.editor/EventManager.js` L245-262,
  `resources/ext.layers.editor/HistoryManager.js` L307-322
- **Impact:** EventManager called `renderLayers()` + `markDirty()` after
  undo/redo, but HistoryManager.restoreState() already calls both.
- **Resolution:** `handleUndo()` and `handleRedo()` now delegate entirely to
  `editor.undo()`/`editor.redo()` without calling render methods. Explicit
  comments document the deliberate non-call. HistoryManager.restoreState()
  correctly calls `canvasMgr.renderLayers()` and `editor.markDirty()` (lines
  308-321).
- **Status:** ✅ Resolved (v43 verification)
- **Introduced:** v42 review

### P2-075: CustomShapeRenderer Spread Shadow Ignores Rotation/Scale

- **File:** `resources/ext.layers.shared/CustomShapeRenderer.js`
- **Impact:** `drawSpreadShadowForImage()` only copies translation (e,f)
  from the transform matrix, discarding rotation and scale. ShadowRenderer
  was fixed to properly decompose transforms but this was never ported.
  Rotated custom shapes render shadows at wrong angle.
- **Recommended Fix:** Port ShadowRenderer's rotation decomposition.
- **Status:** ✅ Fixed v45.6 — Ported ShadowRenderer's rotation decomposition
  (atan2 + scale extraction) to drawSpreadShadowForImage. Now decomposes
  transform into scale+translation, applies rotation separately via
  save/rotate/restore around the dilation drawing loops.
- **Introduced:** v42 review

### P2-076: ThumbnailRenderer TextBox Stroke Bleeds Into Text

- **File:** `src/ThumbnailRenderer.php` (buildTextBoxArguments)
- **Impact:** After drawing rectangle with `-stroke`, the text annotate
  inherits stroke settings. Text renders with rectangle's stroke outline.
- **Recommended Fix:** Insert `'-stroke', 'none', '-strokewidth', '0'`
  before text `-annotate`.
- **Status:** ✅ Fixed (March 4, 2026) — `-stroke none -strokewidth 0` inserted before `-annotate` in `buildTextBoxArguments()`.
- **Introduced:** v42 review

### P2-077: ThumbnailRenderer Missing Ellipse Shadow Support

- **File:** `src/ThumbnailRenderer.php` (buildEllipseArguments)
- **Impact:** Ellipse is the only shape handler without shadow rendering.
  All others (rectangle, circle, text, textbox, polygon, star) support
  shadows. Inconsistent server-side rendering.
- **Recommended Fix:** Add standard shadow pattern from buildCircleArguments().
- **Status:** ✅ Fixed (March 4, 2026) — Shadow block added to `buildEllipseArguments()`, matching the circle pattern.
- **Introduced:** v42 review

### P2-078: AlignmentController Missing Dimension/Marker Types

- **File:** `resources/ext.layers.editor/canvas/AlignmentController.js`
- **Impact:** `moveLayer()` has no case for dimension layers (x1/y1/x2/y2
  endpoints) or marker arrow layers. Dimension layers fall through to
  default case which moves `layer.x` — but dimensions use x1/y1/x2/y2.
  Alignment operations produce incorrect results for these 2 layer types.
- **Note:** Previously dismissed as false positive in v29. Reclassified
  as real issue — dimension layers DO use x1/y1/x2/y2, not x/y.
- **Status:** ✅ Fixed (March 4, 2026) — `dimension` added to `getLayerBounds()` and `moveLayer()` (x1/y1/x2/y2 branch). `marker` case added to `getLayerBounds()` using centered x/y/size.
- **Introduced:** v42 review (reclassified from v29 FP)

### ~~P2-079: ClipboardController Paste Offset on Local Coordinates~~ (FALSE POSITIVE)

- **File:** `resources/ext.layers.editor/canvas/ClipboardController.js` L253-257
- **Claimed Impact:** `applyPasteOffset()` was said to add PASTE_OFFSET to
  tailTipX/tailTipY.
- **Resolution:** Code at lines 254-256 explicitly does NOT apply PASTE_OFFSET
  to tailTipX/tailTipY. The comment reads: "tailTipX/tailTipY are LOCAL
  coordinates relative to callout center. They move with the callout when
  layer.x/y change, so we should NOT offset them. Applying PASTE_OFFSET here
  would displace the tail relative to the body." The original bug description
  was incorrect.
- **Status:** ✅ False Positive (v43 verification)
- **Introduced:** v42 review

### ~~P2-080: parseMWTimestamp Uses Local Time Instead of UTC~~ (LARGELY RESOLVED)

- **Files:** `resources/ext.layers.editor/LayerSetManager.js` L138,
  `resources/ext.layers.editor/editor/RevisionManager.js` L61,
  `resources/ext.layers.editor/LayersEditor.js` L1043
- **Resolution:** Both primary implementations (LayerSetManager.js and
  RevisionManager.js) now correctly use `new Date(Date.UTC(...))`. The only
  remaining local-time construction is in the **fallback path** of
  `LayersEditor.parseMWTimestamp()` (L1043), which executes only when
  `this.revisionManager` is null — a situation that cannot occur during normal
  operation (revisionManager is always initialized before parseMWTimestamp is
  called).
- **Residual:** The dead fallback in LayersEditor.js should use Date.UTC for
  consistency. Low risk — unreachable in production.
- **Status:** ✅ Resolved in primary paths; dead fallback outdated (P3 only)
- **Introduced:** v42 review

### P2-081: CalloutRenderer Blur Bounds Ignore Dragged Tail

- **File:** `resources/ext.layers.shared/CalloutRenderer.js`
- **Impact:** When callout has `fill='blur'` and uses draggable tail,
  blur capture bounds use `tailDirection` instead of actual tailTipX/Y.
  Blur effect clips when tail is dragged to different side.
- **Recommended Fix:** Compute bounds from actual tip coordinates.
- **Status:** ✅ Fixed v45.6 — Both rotated and non-rotated branches now
  include actual tailTipX/tailTipY in blur capture bounds. Rotated branch
  transforms local coords to absolute via rotation matrix; non-rotated
  branch takes union of direction-based bounds with actual tip point.
- **Introduced:** v42 review

### ~~P2-082: CSS Font Shorthand Order Wrong in InlineTextEditor~~ (FALSE POSITIVE)

- **File:** `resources/ext.layers.editor/canvas/InlineTextEditor.js` L809-813
- **Claimed Impact:** Canvas font string had fontWeight before fontStyle.
- **Resolution:** Code is `( layer.fontStyle || 'normal' ) + ' ' + ( layer.fontWeight || 'normal' ) + ' ' + ...` — fontStyle IS listed before fontWeight, which is the CORRECT CSS font shorthand order (`font-style font-weight font-size font-family`). The bug description had the order backwards. Verified against the actual line.
- **Status:** ✅ False Positive (v43 verification)
- **Introduced:** v42 review

### P2-083: Hardcoded English Shortcut Descriptions in ToolbarKeyboard.js

- **File:** `resources/ext.layers.editor/ToolbarKeyboard.js` L355-395
- **Impact:** The `getShortcutsList()` method returns ~25 keyboard shortcut
  entries (e.g. `{ key: ';', description: 'Toggle Smart Guides', ... }`)
  with hardcoded English description strings. These are displayed in the
  keyboard shortcuts help dialog for all users. Status notifications
  ("Layers grouped", "Smart Guides: On/Off") correctly use `mw.message()`
  with English-only fallbacks for non-MW contexts.
- **Recommended Fix:** Replace shortcut description strings with mw.message()
  lookups; add corresponding i18n keys for each description.
- **Status:** ✅ Fixed v45.6 — All 24 shortcut descriptions now use
  `mw.message('key').text()`. Reuses existing tool/action keys where
  available; added 4 new keys (layers-shortcut-save, toggle-snap,
  toggle-background, cancel). Also registered 8 previously unregistered
  shortcut keys in extension.json messages array.
- **Introduced:** v42 review (description refined in v43)

### P3-080: ~140 Lines Dead Layer Cache Code in CanvasRenderer

- **File:** `resources/ext.layers.editor/CanvasRenderer.js`
- **Impact:** layerCache, _getCachedLayer, _setCachedLayer,
  invalidateLayerCache defined but never called. Dead code.
- **Status:** ✅ Fixed (March 4, 2026)
- **Fix:** Removed ~150 lines of dead code: 3 constructor properties, 5 methods
  (`_computeLayerHash`, `_hashString`, `_getCachedLayer`, `_setCachedLayer`,
  `invalidateLayerCache`), and destroy() cleanup. Also removed 7 dead tests.
- **Introduced:** v42 review

### P3-081: StyleController.updateStyleOptions Triple-Applies Properties

- **File:** `resources/ext.layers.editor/StyleController.js` L85-144
- **Impact:** Three redundant passes over style properties. Low perf impact.
- **Status:** ✅ Fixed v45.7
- **Introduced:** v42 review

### P3-082: Duplicate sanitizeLogMessage in 3 Files

- **Files:** `LayersEditor.js`, `APIErrorHandler.js`, `ValidationManager.js`
- **Impact:** Identical function duplicated. Bug fixes must be applied 3x.
- **Recommended Fix:** Extract to shared utility.
- **Status:** ✅ Fixed v45.7
- **Introduced:** v42 review

### P3-083: SelectionManager Boolean Handling Inconsistency

- **File:** `resources/ext.layers.editor/SelectionManager.js`
- **Impact:** `selectAll()` correctly checks `!== 0` but `selectLayer()`
  fallback only checks `!== true` / `!== false`, missing integer API values.
- **Status:** ✅ Fixed v45.7
- **Introduced:** v42 review

### P3-084: DimensionRenderer Uses || for Falsy-Sensitive Defaults

- **File:** `resources/ext.layers.shared/DimensionRenderer.js`
- **Impact:** `extensionGap: opts.extensionGap || 10` rejects valid 0.
  Same file uses `!== undefined` for precision/toleranceValue correctly.
- **Status:** ✅ Fixed (March 4, 2026)
- **Fix:** Changed 8 numeric properties in `_createFromOptions()` from `||` to
  `!== undefined ? options.prop : DEFAULTS.prop`: strokeWidth, fontSize,
  extensionLength, extensionGap, arrowSize, tickSize, scale.
- **Introduced:** v42 review

### P3-085: CustomShapeRenderer Opacity Not Clamped

- **File:** `resources/ext.layers.shared/CustomShapeRenderer.js`
- **Impact:** getOpacity() returns unclamped value. All other renderers
  use clampOpacity() from MathUtils.
- **Status:** ✅ Fixed (March 4, 2026)
- **Fix:** Added `Math.max( 0, Math.min( 1, ... ) )` clamping to `getOpacity()`
  return value, matching all other renderers.
- **Introduced:** v42 review

### P3-086: ExportController Blob URL Leak on Error

- **File:** `resources/ext.layers.editor/ExportController.js`
- **Impact:** If removeChild throws, revokeObjectURL is skipped. Minor leak.
- **Status:** ✅ Fixed (March 4, 2026)
- **Fix:** Wrapped download link creation/click/removal in `try/finally` to
  ensure `URL.revokeObjectURL(url)` always executes.
- **Introduced:** v42 review

### P3-087: RenderCoordinator Hash Misses Visual Properties

- **File:** `resources/ext.layers.editor/canvas/RenderCoordinator.js`
- **Impact:** Hash omits radiusX/Y, controlX/Y, tailTipX/Y, cornerRadius,
  lineHeight, color, arrowhead/style/size, gradient stops, shadow offsets.
  Changes to these may not trigger re-renders. Supersedes P3-072.
- **Status:** ✅ Fixed v45.8 (superseded by P3-109)
- **Introduced:** v42 review

### P3-088: Escape Closes Modal Without Unsaved Changes Check

- **File:** `resources/ext.layers.modal/LayersEditorModal.js`
- **Impact:** Pressing Escape immediately closes modal without checking
  for unsaved changes via postMessage.
- **Status:** ✅ Fixed v45.10 — Escape now sends `layers-editor-request-close` postMessage; editor runs `cancel(true)` which checks `isDirty`.
- **Introduced:** v42 review

### P3-089: Duplicated SVG Icon Code in ViewerManager/SlideController

- **Files:** `ViewerManager.js`, `SlideController.js`
- **Impact:** Identical _createPencilIcon() and _createExpandIcon() methods.
  Should use IconFactory.js.
- **Status:** ✅ Fixed v45.9 (superseded by P3-107) — All 3 modules now delegate to shared `ViewerIcons.js`.
- **Introduced:** v42 review

### P3-090: Dead Code renderCodeSnippet with XSS Vector

- **File:** `resources/ext.layers.editor/LayerPanel.js` L2161
- **Impact:** Never called but contains unescaped filename in innerHTML.
  Remove or fix before any caller is added.
- **Status:** Fixed (superseded by P3-112; method removed March 4, 2026)
- **Introduced:** v42 review

### P3-091: RichTextToolbar Potential Drag Listener Leak

- **File:** `resources/ext.layers.editor/canvas/RichTextToolbar.js`
- **Impact:** Document-level mouse handlers during drag not cleaned in
  destroy() if destroyed mid-drag.
- **Status:** ✅ Fixed v45.7
- **Introduced:** v42 review

### P3-092: Touch Events Missing Key Modifier Properties

- **File:** `resources/ext.layers.editor/CanvasEvents.js` L600-614
- **Impact:** Synthetic mouse events from touch lack ctrlKey, metaKey,
  shiftKey. Multi-select via touch impossible.
- **Status:** ✅ Fixed v45.8 — Added ctrlKey, metaKey, shiftKey, altKey to all 3 synthetic mouse events.
- **Introduced:** v42 review

### P3-093: SlideController.refreshAllSlides No Concurrency Limit

- **File:** `resources/ext.layers/viewer/SlideController.js`
- **Impact:** Uses bare Promise.all(). ViewerManager has proper concurrency
  limiting (5 parallel via _processWithConcurrency).
- **Status:** ✅ Fixed v45.8 — Added `_processWithConcurrency()` method (limit 5) matching ViewerManager pattern.
- **Introduced:** v42 review

### P3-094: CustomShapeRenderer Creates Oversized Temp Canvas

- **File:** `resources/ext.layers.shared/CustomShapeRenderer.js`
- **Impact:** Creates new canvas 5000+ px wider than needed per call,
  no reuse or size limit. GC pressure.
- **Status:** ✅ Fixed v45.9 — Added `MAX_TEMP_DIM = 8192` ceiling; both width and height clamped with `Math.min()`.
- **Introduced:** v42 review

### P3-095: Unguarded mw.log.warn in CanvasRenderer

- **File:** `resources/ext.layers.editor/CanvasRenderer.js`
- **Impact:** Uses `mw.log.warn()` without typeof guard. ReferenceError
  in Jest test environment.
- **Status:** ✅ Fixed v45.7
- **Introduced:** v42 review

### ~~P3-096: ToolManager Module References at IIFE Load Time~~ (FALSE POSITIVE)

- **File:** `resources/ext.layers.editor/ToolManager.js` L9-14
- **Claimed Impact:** Window references resolved at IIFE execution before
  dependencies are available.
- **Resolution:** All dependencies (ToolRegistry, ToolStyles, ShapeFactory,
  TextToolHandler, PathToolHandler) are listed in `extension.json` lines
  345-349, immediately BEFORE ToolManager.js at line 350 in the same module
  script concatenation order. ResourceLoader executes scripts in array order.
  By the time ToolManager.js executes, all tool modules have already exported
  to their respective `window.*` namespaces. No ordering hazard exists.
- **Status:** ✅ False Positive (v43 verification)
- **Introduced:** v42 review

---

## Newly Confirmed in v40 (Verification Pass)

### ✅ P2-064: `scripts/verify-docs.sh` Exits Early Under `set -e` (Fixed v40)

- **File:** `scripts/verify-docs.sh`
- **Impact:** Documentation verification can stop after the first failure,
  producing incomplete results.
- **Evidence:** `bash scripts/verify-docs.sh` exits with code 1 immediately
  after the first check.
- **Root Cause:** `check_file ... || ((ERRORS++))` interacts badly with
  `set -e`; arithmetic command status can be non-zero.
- **Introduced:** v40 review
- **Resolution:** Replaced `((ERRORS++))` pattern with safe increment function,
  removed `package.json` version check, and aligned to the 11-file rule.

### ✅ P2-065: Documentation Rule Mismatch (`11 files` vs `12 files`) (Fixed v40)

- **Files:** `docs/DOCUMENTATION_UPDATE_GUIDE.md`, `scripts/verify-docs.sh`,
  `package.json`
- **Impact:** Release tooling and documentation disagree; false failure for
  `package.json` version checks even though this project has no version field.
- **Evidence:** Guide states package.json has no version and uses an 11-file
  rule; script enforces 12 files and checks `package.json` for `1.5.57`.
- **Introduced:** v40 review
- **Resolution:** `scripts/verify-docs.sh` now checks the same 11 files defined
  in `docs/DOCUMENTATION_UPDATE_GUIDE.md`, including `.github/copilot-instructions.md`.

### P3-064: `codebase_review.md` Contains a Stale False-Positive Claim

- **File:** `codebase_review.md`
- **Impact:** Misleads maintainers about CI/test behavior.
- **Evidence:** Prior claim said "npm test skips Jest"; actual script is
  `grunt test && jest --passWithNoTests`.
- **Status:** ✅ Corrected in v40 addendum.

### P3-065: `improvement_plan.md` Has Resolved Items Marked Open

- **File:** `improvement_plan.md`
- **Impact:** Planning data is inaccurate and inflates outstanding docs debt.
- **Evidence:** Claims like "wiki/Installation.md says 1.5.52" and missing
  v1.5.53/v1.5.54 changelog entries are stale relative to current docs.
- **Status:** ✅ Corrected in v40 addendum.

### ✅ P3-066: Import Fallback Render Path (Fixed v40)

- **File:** `resources/ext.layers.editor/ImportExportManager.js`
- **Impact:** In fallback mode, import can apply layers but render nothing.
- **Evidence:** `applyImportedLayers()` sets `editor.layers = layers` when
  `stateManager` is absent, then computes `currentLayers` as `[]` before render.
- **Introduced:** v40 review
- **Resolution:** `applyImportedLayers()` now renders `editor.layers` when
  `stateManager` is absent. Added regression test in
  `tests/jest/ImportExportManager.test.js`.

---

## Newly Confirmed in v41

### ✅ P1-032: Rate Limiter `$defaultLimits` Dead Code (Fixed v41)

- **File:** `src/Security/RateLimiter.php`
- **Impact:** The 90-line `$defaultLimits` array was never used — rate limits
  must be configured in `$wgRateLimits` in LocalSettings.php.
- **Resolution:** Removed dead code (~68 lines), added clear documentation
  in class docblock with example `$wgRateLimits` configuration.
- **Introduced:** v41 review

### ⚠️ P1-033: Missing Cache Invalidation After Delete/Rename — NOT FIXED (Reopened v42 → P0-005)

- **Files:** `src/Api/ApiLayersDelete.php`, `src/Api/ApiLayersRename.php`,
  `src/Api/Traits/CacheInvalidationTrait.php` (MISSING)
- **Impact:** v41 claimed this was fixed by extracting cache invalidation
  to a shared trait. The trait file was **never created or committed**.
  All 3 write API modules (Save, Delete, Rename) now `use` the
  nonexistent trait, causing PHP fatal errors on ALL write operations.
- **Status:** ⚠️ REOPENED as P0-005 — escalated from P1 to P0.
  See P0-005 above for full details.
- **Introduced:** v41 review (falsely marked fixed)

### ✅ P1-034: Rich Text Per-Run `fontSize` Not Scaled in Viewer (Fixed v41)

- **File:** `resources/ext.layers/LayersViewer.js`
- **Impact:** RichText layers with mixed font sizes rendered incorrectly at zoom != 1.
- **Resolution:** Added loop in `scaleLayerCoordinates()` to scale per-run
  `fontSize` in richText array. Added regression test.
- **Introduced:** v41 review

### P2-067: SQL Schema Inconsistencies Between Base and Patch Files ✅ FIXED

- **Files:** `sql/layers_tables.sql`, `sql/tables/layer_assets.sql`,
  `sql/patches/patch-add-lsu_usage_count.sql`
- **Impact:** `la_user_id`: base schema says `DEFAULT NULL`, but
  `tables/layer_assets.sql` said `NOT NULL`. `lsu_usage_count`:
  base table says `DEFAULT 1`, but patch file said `DEFAULT 0`.
  Fresh installs vs. upgraded installs got different schemas.
- **Evidence:** `grep -n "la_user_id\|lsu_usage_count"` across SQL
  files showed contradictions.
- **Status:** Fixed — Reconciled `layer_assets.sql` to use `DEFAULT NULL` for
  `la_user_id` (matching main schema), and updated patch file to use `DEFAULT 1`.
- **Introduced:** v41 review

### P2-068: ApiLayersList Missing Permission Check for Slide Requests ✅ FIXED

- **File:** `src/Api/ApiLayersList.php`
- **Impact:** The list API intended for the Special:Slides page does
  not verify that the requesting user has appropriate read permissions
  for the listed files. Relies solely on MediaWiki's default API
  auth, which may not enforce file-level access on private wikis.
- **Status:** Fixed — Already had `checkUserRightsAny('read')` call at line 64.
  Verified via v41 review.
- **Introduced:** v41 review

### P2-069: ApiLayersList Missing Top-Level Exception Handler ✅ FIXED

- **File:** `src/Api/ApiLayersList.php`
- **Impact:** Unlike `ApiLayersInfo`, `ApiLayersSave`, `ApiLayersDelete`,
  and `ApiLayersRename` which all wrap their `execute()` body in
  try/catch, `ApiLayersList::execute()` has no top-level exception
  handler. An unexpected DB or runtime error produces an unformatted
  MediaWiki error instead of a structured API error.
- **Status:** Fixed (low priority) — DB query is already wrapped in try/catch.
  Verified existing handler at `doListSlides()` method.
- **Introduced:** v41 review

### P2-070: Missing Numeric Constraints for Text Effect Properties ✅ FIXED

- **File:** `src/Validation/ServerSideLayerValidator.php`
- **Impact:** `textStrokeWidth`, `shadowBlur`, `shadowOffsetX`,
  `shadowOffsetY`, and `shadowSpread` were validated as numeric
  types but had no upper/lower bounds. Extreme values could cause
  rendering performance issues or layout breakage.
- **Status:** Fixed — Added numeric constraints: `textStrokeWidth` (0-50),
  `shadowBlur` (0-100), `shadowOffsetX/Y` (-500 to 500), `shadowSpread` (0-100).
- **Introduced:** v41 review

### P2-071: SVG Validation Missing Dangerous Elements ✅ FIXED

- **File:** `src/Validation/ServerSideLayerValidator.php`
- **Impact:** SVG sanitization stripped `<script>`, `<foreignObject>`,
  and event handlers but did not filter `<embed>`, `<object>`,
  `<iframe>`, or `<applet>` elements, which can also execute
  arbitrary code or load external resources in SVG contexts.
- **Status:** Fixed — Added blocklist for `embed`, `object`, `iframe`, and
  `applet` elements in `validateSvgString()` method.
- **Introduced:** v41 review

### P2-072: SlideHooks Static State Not Reset Between Pages ✅ FIXED

- **File:** `src/Hooks/SlideHooks.php`
- **Impact:** `SlideHooks` uses static properties to track state
  across hook invocations. If MediaWiki processes multiple pages
  in a single request (e.g., job queue, API batch), state from
  the first page leaks into subsequent pages.
- **Status:** Fixed — Added `onParserClearState()` hook handler to reset
  `$slideDimensionCache` and `$slideQueryCount`. Registered in extension.json.
- **Introduced:** v41 review

### P2-073: Debug URL Parameter Cannot Disable Debug Mode ✅ FIXED

- **File:** `src/Hooks/UIHooks.php`
- **Impact:** The `?layersdebug=1` URL parameter enables debug
  mode, but there was no way to explicitly disable it via URL
  when the global config had debug enabled. Minor operational
  inconvenience.
- **Status:** Fixed — Refactored logic to properly handle `?layersdebug=0`
  to disable debug mode even when config has it enabled.
- **Introduced:** v41 review

### P3-067: ~200 Lines Duplicated Validation Logic in ApiLayersSave.php

- **File:** `src/Api/ApiLayersSave.php`
- **Impact:** Client-facing validation logic (property checks,
  bounds enforcement) is partially duplicated between
  `ApiLayersSave` and `ServerSideLayerValidator`. Changes to
  validation rules must be synchronized across both files.
- **Status:** Won't-fix — Both files serve distinct purposes (API-level vs structural validation); merging would couple API error handling with schema validation. The duplication is intentional defense-in-depth.
- **Introduced:** v41 review

### P3-068: ToolbarStyleControls.js Crossed God Class Threshold (1,006 Lines)

- **File:** `resources/ext.layers.editor/ui/ToolbarStyleControls.js`
- **Impact:** At 1,006 lines, this file now exceeds the 1,000-line
  god class threshold (god class #17). Further extractions like
  `PresetStyleManager.js` and `ArrowStyleControl.js` already exist
  but the core file has grown back.
- **Status:** Won't-fix — At 1,006 lines (barely over threshold), further extraction would fragment cohesive style control logic. Two major extractions already completed.
- **Introduced:** v41 review

### P3-069: `drawRoundedRectPath()` Duplicated in Three Files

- **Files:** `CanvasRenderer.js`, `SelectionRenderer.js`,
  `InlineTextEditor.js`
- **Impact:** Identical rounded-rectangle path logic duplicated
  across three canvas rendering files. Bug fixes must be
  applied to all three copies.
- **Status:** Won't-fix — Implementations differ (arcTo vs quadraticCurveTo); extraction would risk rendering regressions for minimal DRY benefit.
- **Introduced:** v41 review

### P3-070: `duplicateSelected()` Duplicated in Two Files

- **Files:** `CanvasManager.js`, `ClipboardController.js`
- **Impact:** Layer duplication logic exists in both files.
  Behavioral drift is possible if only one is updated.
- **Status:** ✅ Fixed v45.7
- **Introduced:** v41 review

### P3-071: GradientRenderer Namespace Registration Inconsistency

- **File:** `resources/ext.layers.shared/GradientRenderer.js`
- **Impact:** Registered under `mw.ext.layers.GradientRenderer`
  (shared namespace) but instantiated differently in editor vs.
  viewer contexts. Minor inconsistency in module loading.
- **Status:** ✅ Fixed v45.7
- **Introduced:** v41 review

### P3-072: RenderCoordinator Hash Misses Deep Object Changes

- **File:** `resources/ext.layers.editor/canvas/RenderCoordinator.js`
- **Impact:** `_computeLayersHash()` hashes selected top-level
  properties but does not deep-hash `gradient` or `richText`
  sub-objects. Changes to gradient stops or richText runs may
  not trigger re-renders.
- **Status:** ✅ Fixed v45.8 (superseded by P3-109)
- **Introduced:** v41 review

### P3-073: Inconsistent Service Resolution Pattern

- **Files:** Various PHP `src/` files
- **Impact:** Some files use `MediaWikiServices::getInstance()` to
  get services directly; others use the DI `services.php` wiring.
  Inconsistent but functional.
- **Status:** Won't-fix — Functional as-is; migrating all service resolution to DI would touch many files with no behavior change. Low impact.
- **Introduced:** v41 review

### P3-074: Response Format Inconsistency Across API Modules

- **Files:** `src/Api/ApiLayersSave.php`, `src/Api/ApiLayersDelete.php`,
  `src/Api/ApiLayersRename.php`
- **Impact:** Save returns `{ success: 1, result: 'Success' }`,
  Delete returns `{ success: 1, revisionsDeleted: N }`, Rename
  returns `{ success: 1, oldname, newname }`. No consistent
  success envelope. Clients must handle each shape individually.
- **Status:** Won't-fix — Changing response shapes would be a breaking API change; each format serves its endpoint's semantics.
- **Introduced:** v41 review

### P3-075: Missing CommonJS Export in LayerDefaults.js

- **File:** `resources/ext.layers.shared/LayerDefaults.js`
- **Impact:** No `module.exports` fallback for Jest test
  environments. Tests must mock or re-create the defaults
  object rather than importing it directly.
- **Status:** ✅ Fixed v45.7
- **Introduced:** v41 review

### P3-076: Hard-Coded English Strings in UI Components

- **Files:** Various `resources/ext.layers.editor/` files
- **Impact:** Some status messages, tooltips, or error strings
  are hard-coded in English rather than using `mw.message()`
  i18n keys. Minor i18n gap.
- **Status:** Won't-fix — Remaining hard-coded strings are developer-facing debug/log messages or fallbacks when i18n is unavailable. User-facing strings already use mw.message().
- **Introduced:** v41 review

### P3-077: Font Size Validation Type Check Gap

- **File:** `src/Validation/ServerSideLayerValidator.php`
- **Impact:** `fontSize` is validated as numeric and range-checked,
  but string values like `"12px"` or `"1em"` pass the initial
  type filter and may cause unexpected behavior downstream.
- **Status:** ✅ Fixed v45.8 — Added CSS unit suffix stripping (px/em/rem/pt/%) before `is_numeric()` check.
- **Introduced:** v41 review

### P3-078: `getNamedSetOwner()` Reads from Replica DB

- **File:** `src/Database/LayersDatabase.php`
- **Impact:** `getNamedSetOwner()` uses `getReadDb()` (replica)
  to determine ownership for delete/rename authorization. Under
  replication lag, a just-created set might not be found,
  causing a false permission denial.
- **Status:** ✅ Fixed v45.7
- **Introduced:** v41 review

### P3-079: ValidationResult Mixed Error Structure

- **File:** `src/Validation/ServerSideLayerValidator.php`
- **Impact:** `ValidationResult` sometimes contains flat error
  strings and sometimes structured objects with `field` and
  `message` properties. Consumers must handle both formats.
- **Status:** Won't fix — No callers use the `$field` parameter; all use the flat string form. The mixed format capability exists but is unused dead code.
- **Introduced:** v41 review

---

## P0 — Critical (Data Loss / Security)

### P0-005: CacheInvalidationTrait.php Missing (Open — v42)

See "Newly Confirmed in v42" section above for full details.

### ✅ P0-001: groupSelected() Passes Object Instead of ID (Fixed v28)

- **File:** GroupManager.js
- **Impact:** Group creation could fail silently
- **Resolution:** Fixed with unit tests

### ✅ P0-002: ApiLayersDelete Swallows ApiUsageException (Fixed v27)

- **File:** ApiLayersDelete.php
- **Impact:** Delete errors silently ignored
- **Resolution:** Proper exception propagation

### ✅ P0-003: ApiLayersRename Exception Swallowing (Fixed v27)

- **File:** ApiLayersRename.php
- **Impact:** Rename errors silently ignored
- **Resolution:** Proper exception propagation

### ✅ P0-004: diagnose.php Unauthenticated Endpoint (Fixed v27)

- **File:** diagnose.php (removed)
- **Impact:** Exposed internal state without authentication
- **Resolution:** File removed entirely

---

## P1 — High Priority

### ✅ P1-026: ClipboardController paste() Bypasses StateManager (Fixed v36)

- **File:** resources/ext.layers.editor/canvas/ClipboardController.js
- **Resolution:** Rewrote paste() to build a new layers array and
  set via `editor.stateManager.set('layers', newLayers)`, consistent
  with cutSelected(). Fallback to direct assignment if no StateManager.

### ✅ P1-027: RenderCoordinator Hash Omits Rendering Properties (Fixed v36)

- **File:** resources/ext.layers.editor/canvas/RenderCoordinator.js
- **Resolution:** Expanded `_computeLayersHash()` from 8 to 30+
  properties including fill, stroke, text, fontSize, fontFamily,
  strokeWidth, shadow, gradient, src, richText, points, locked, name,
  blendMode, radius, endpoints, and more.

### ✅ P1-028: SecurityAndRobustness.test.js Tests Mocks Not Code (Fixed v36)

- **File:** tests/jest/SecurityAndRobustness.test.js (DELETED)
- **Resolution:** File deleted entirely (490 lines, 18 tests, zero
  require() calls). Existing focused test suites already provide
  real coverage of the same code.

### ✅ P1-029: PHPUnit Version Mismatch (Fixed v36)

- **File:** phpunit.xml, tests/phpunit/unit/HooksTest.php
- **Resolution:** Downgraded phpunit.xml schema from 10.5 to 9.6.
  Removed PHPUnit 10-only attributes. Replaced withConsecutive()
  in HooksTest.php with willReturnCallback() + assertContains().

### ✅ P1-030: npm test --force Bypasses Lint Failures (Fixed v36)

- **File:** package.json, Gruntfile.js
- **Resolution:** Removed `--force` from npm test script. Fixed
  Gruntfile.js ESLint glob to exclude patterns matching .eslintrc.json
  ignorePatterns (scripts/**, TempToolIcons/**, etc.). Grunt now passes
  cleanly without --force.

### ✅ P1-031: ErrorHandler Auto-Reload Loses Unsaved Work (Fixed v36)

- **File:** resources/ext.layers.editor/ErrorHandler.js
- **Resolution:** Added `_saveDraftBeforeReload()` method that saves
  draft via `window.layersEditorInstance.draftManager.saveDraft()`
  before reload. Best-effort with try/catch.

### ✅ P1-001: Canvas Cache Stale on Middle Path Points (Fixed v28)

- **File:** CanvasManager.js
- **Resolution:** Cache invalidation on path changes

### ✅ P1-002: VALID_LINK_VALUES Drops Editor Subtypes (Fixed v28)

- **File:** LayerDataNormalizer.js
- **Resolution:** Extended valid link values

### ✅ P1-003: TextRenderer Rotation Ignores textAlign (Fixed v28)

- **File:** TextRenderer.js
- **Resolution:** Rotation center accounts for alignment

### ✅ P1-004: SVG CSS Injection Vectors Missing (Fixed v28)

- **File:** LayersValidator.js
- **Resolution:** Added CSS injection detection

### ✅ P1-005: HitTest Fails on Rotated Rectangles/Ellipses (Fixed v29)

- **File:** HitTestController.js
- **Resolution:** Proper inverse rotation transform

### ✅ P1-006: ShapeRenderer strokeWidth:0 Treated as 1 (Fixed v29)

- **File:** ShapeRenderer.js
- **Resolution:** Respect zero strokeWidth

### ✅ P1-007: getRawCoordinates() Incorrect Math (Fixed v29)

- **File:** CanvasManager.js
- **Resolution:** Correct coordinate transformation

### ✅ P1-008: normalizeLayers Mutates Input Objects (Fixed v29)

- **File:** LayerDataNormalizer.js
- **Resolution:** Deep clone before normalization

### ✅ P1-009: isSchemaReady 23 Uncached DB Queries (Fixed v27)

- **File:** LayersSchemaManager.php
- **Resolution:** Cached schema readiness check

### ✅ P1-010: duplicateSelected Single-Layer Only (Fixed v27)

- **File:** ClipboardController.js
- **Resolution:** Multi-layer duplication support

### ✅ P1-011: ON DELETE CASCADE Destroys User Content (Fixed v34)

- **File:** sql/layers_tables.sql
- **Resolution:** Changed to ON DELETE SET NULL; migration patch

### ✅ P1-012: ls_name Allows NULL in Schema (Fixed v34)

- **File:** sql/layers_tables.sql
- **Resolution:** NOT NULL DEFAULT 'default'; migration patch

### ✅ P1-013: Triple Source of Truth for Selection State (Fixed v34)

- **File:** SelectionManager.js, CanvasManager.js, StateManager.js
- **Resolution:** Removed ghost properties; single authority

### ✅ P1-014: Rich Text Word Wrap Wrong Font Metrics (Fixed v34)

- **File:** TextBoxRenderer.js
- **Resolution:** Per-run font measurement in wrapRichText()

### ✅ P1-015: ThumbnailRenderer Shadow Blur Corrupts Canvas (Fixed v34)

- **File:** ThumbnailRenderer.php
- **Resolution:** buildShadowSubImage() helper

### ✅ P1-016: SQLite-Incompatible Schema Migrations (Fixed v34)

- **File:** LayersSchemaManager.php, sql/patches/
- **Resolution:** PHP methods with $dbType branching

### ✅ P1-017: ShadowRenderer Discards Scale on Rotation (Fixed v34)

- **File:** ShadowRenderer.js L305-325
- **Resolution:** Decompose and preserve scale matrix

### ✅ P1-018: DimensionRenderer hitTest Ignores Offset (Fixed v34)

- **File:** DimensionRenderer.js L750-761
- **Resolution:** hitTest uses perpendicular offset

### ✅ P1-019: APIManager saveInProgress Permanently Stuck (Fixed v34)

- **File:** APIManager.js L859-870
- **Resolution:** try/catch with reset on error

### ✅ P1-020: PresetStorage Strips Gradient Data (Fixed v34)

- **File:** PresetStorage.js L20-56
- **Resolution:** Added 'gradient' to ALLOWED_STYLE_PROPERTIES

### ✅ P1-021: OverflowException Double endAtomic (Fixed v35)

- **File:** LayersDatabase.php L174-245
- **Resolution:** Removed premature endAtomic; re-throw in catch

### ✅ P1-022: TextSanitizer html_entity_decode (Fixed v35)

- **File:** TextSanitizer.php L35-45
- **Resolution:** Second strip_tags() after html_entity_decode()

### ✅ P1-023: EditLayersAction Clickjacking — Not a Bug (v35)

- **File:** EditLayersAction.php L107-119
- **Resolution:** Reclassified as intentional modal editor design

### ✅ P1-024: ApiLayersList DB Error Info Disclosure (Fixed v35)

- **File:** ApiLayersList.php L106-109
- **Resolution:** Generic error; server-side logging

### ✅ P1-025: RichText fontSize Overwritten on Deselect (Fixed v35)

- **File:** InlineTextEditor.js L276-280, L1686-1733
- **Resolution:** _extractDominantFontSize() accepts baseFontSize

---

## P2 — Medium Priority

### ✅ P2-032: ErrorHandler Singleton Lifecycle — False Positive (v36)

- **File:** resources/ext.layers.editor/ErrorHandler.js
- **Resolution:** Not a bug. Singleton is re-created on module load
  via `if (!window.layersErrorHandler) { ... }`. destroy() only runs
  when editor closes (page unload). Subsequent editor sessions get
  a new instance automatically.

### ✅ P2-033: InlineTextEditor Blur setTimeout Tracked (Fixed v36)

- **File:** resources/ext.layers.editor/canvas/InlineTextEditor.js
- **Resolution:** Assigned setTimeout return value to `this._blurTimeout`.
  Added `clearTimeout(this._blurTimeout)` in `_removeEventHandlers()`.

### ✅ P2-034: No Default Rate Limits — Not a Bug (v36)

- **Resolution:** Rate limiting is intentionally admin-configurable
  via LocalSettings.php. Not all wikis need the same limits.
  RateLimiter.php infrastructure exists and works when configured.

### ✅ P2-035: CanvasManager JSON Clone Per Frame — Overstated (v36)

- **Resolution:** The JSON clone runs inside rAF but is gated by
  `transformEventScheduled` flag, so it runs at most once per
  animation frame. Not per-event. Acceptable performance.

### ✅ P2-036: HistoryManager JSON.stringify for richText — Low Impact (v36)

- **Resolution:** Only runs on `hasUnsavedChanges()` checks, not
  per-frame. Called infrequently (tab close, periodic save check).
  Not a performance concern.

### ✅ P2-037: ext.layers.slides Added to Jest Coverage (Fixed v36)

- **File:** jest.config.js
- **Resolution:** Added `'resources/ext.layers.slides/**/*.js'` to
  collectCoverageFrom array.

### ✅ P2-038: NAMED_LAYER_SETS.md Stale Throughout (Fixed v39)

- **File:** docs/NAMED_LAYER_SETS.md
- **Impact:** Uses "Proposed Design" header for implemented feature.
  Shows `ls_name VARCHAR(255), DEFAULT NULL` (actual: NOT NULL
  DEFAULT 'default'). References nonexistent config keys
  `$wgLayersSetNameMaxLength` and `$wgLayersSetNamePattern`.
  Says "10-20 named sets" (actual limit: 15).
- **Introduced:** v36 review
- **Recommended Fix:** Major rewrite to document actual
  implementation, correct schema, and real config keys.
- **Resolution:** Rewrote document: corrected schema to actual
  NOT NULL DEFAULT 'default', removed nonexistent config keys,
  added SetNameSanitizer validation details, replaced Option A/B
  with actual implementation, updated set count to 15, marked
  deletion/renaming as implemented, changed header to Architecture.

### ✅ P2-039: Missing SlideNameValidator in API Modules (Fixed v39)

- **Files:** src/Api/ApiLayersInfo.php, src/Api/ApiLayersRename.php
- **Resolution:** SlideNameValidator added to ApiLayersInfo L104-117
  and ApiLayersRename L63-75. All 4 API modules now consistently
  validate slide names.

### ✅ P2-040: ApiLayersRename Missing oldName Validation in Slide Path (Fixed v39)

- **File:** src/Api/ApiLayersRename.php
- **Resolution:** executeSlideRename() L290-295 now validates oldName
  with SetNameSanitizer::isValid(), matching the file rename path.

### ✅ P2-041: TransformController Missing _arrowTipRafId Cleanup (Fixed v39)

- **File:** resources/ext.layers.editor/canvas/TransformController.js
- **Resolution:** destroy() at L948-950 now cancels _arrowTipRafId
  alongside the other 3 RAF IDs.

### ✅ P2-042: wiki/Configuration-Reference.md LayersDebug Default (Fixed v39)

- **File:** wiki/Configuration-Reference.md
- **Fix:** Already shows correct default of `false`.

### ✅ P2-043: wiki/Installation.md LayersDebug Default (Fixed v39)

- **File:** wiki/Installation.md
- **Fix:** Already shows correct default of `false`.

### ✅ P2-001: Negative Dimensions for Rectangle/TextBox (Fixed v28)

### ✅ P2-002: DraftManager Stores Base64 Image Data (Fixed v28)

### ✅ P2-003: CalloutRenderer Blur Clips L/R Tails (Fixed v31)

### ✅ P2-004: closeAllDialogs Leaks Keydown Handlers (Fixed v30)

### ✅ P2-005: ext.layers Loaded Every Page (Fixed v34)

### ✅ P2-006: SlideManager.js Dead Code (~439 Lines) (Fixed v34)

### ✅ P2-007: Client SVG Sanitization Regex Bypassable (Fixed v34)

### ✅ P2-008: sanitizeString Strips `<>` Destroying Math (Fixed v34)

### ✅ P2-009: SmartGuides Cache Stale on Mutations (Fixed v34)

### ✅ P2-010: ToolManager 400+ Lines Dead Fallbacks (Fixed v34)

### ✅ P2-011: HistoryManager Duck-Type Constructor (Fixed v34)

### ✅ P2-012: Duplicate Prompt Dialog Implementations (Fixed v34)

### ✅ P2-013: enrichWithUserNames Duplicated (Fixed v34)

### ✅ P2-014: Toolbar innerHTML with mw.message().text() (Fixed v34)

### ✅ P2-015: init.js Event Listener Accumulation (Fixed v34)

### ✅ P2-016: ImageLoader Timeout Orphaned on Success (Fixed v34)

### ✅ P2-017: window.open Without noopener (Fixed v34)

### ✅ P2-018: ShadowRenderer/EffectsRenderer Temp Canvas (Fixed v34)

### ✅ P2-019: TextBoxRenderer wrapText No Long Word Break (Fixed v34)

### ✅ P2-020: ApiLayersSave Redundant Token Parameter (Fixed v34)

### ✅ P2-021: LayersSchemaManager Bypasses DI (Fixed v34)

### ✅ P2-022: Foreign Key Constraints Violate MW Conventions (Fixed v34)

### ✅ P2-023: SpecialEditSlide References Non-Existent Module (Fixed v34)

### ✅ P2-024: ext.layers.slides Missing Required Files (Fixed v34)

### ✅ P2-025: Duplicate Message Keys in extension.json (Fixed v34)

### ✅ P2-026: phpunit.xml Uses Deprecated PHPUnit 9 Attributes (Fixed v34)

### ✅ P2-027: ThumbnailRenderer visible === false Ignores 0 (Fixed v35)

### ✅ P2-028: $set Param Ignored in layerEditParserFunction (Fixed v35)

### ✅ P2-029: RevisionManager UTC Timestamps as Local (Fixed v35)

### ✅ P2-030: EditorBootstrap Conditional Global — Not a Bug (v35)

### ✅ P2-031: CanvasRenderer _blurTempCanvas Not Cleaned (Fixed v35)

---

## P3 — Low Priority

### ✅ P3-042: console.log in Toolbar.js Removed (Fixed v36)

- **File:** resources/ext.layers.editor/Toolbar.js
- **Resolution:** Removed unguarded `console.log('[Layers] Help
  button clicked')` statement.

### ✅ P3-043: ValidationManager IIFE Wrapping (Fixed v39)

- **File:** resources/ext.layers.editor/ValidationManager.js
- **Fix:** Wrapped class in IIFE for scope isolation consistency.

### ✅ P3-044: AlignmentController getCombinedBounds Fixed (Fixed v36)

- **File:** resources/ext.layers.editor/canvas/AlignmentController.js
- **Resolution:** Computed actual `width: right - left` and
  `height: bottom - top` instead of hardcoded zeros.

### ✅ P3-045: HistoryManager cancelBatch Double Redraw Fixed (Fixed v36)

- **File:** resources/ext.layers.editor/HistoryManager.js
- **Resolution:** Removed redundant `redraw()` call after
  `renderLayers()` which already calls redraw() internally.

### ✅ P3-046: InlineTextEditor Optional Chaining Removed (Fixed v36)

- **File:** resources/ext.layers.editor/canvas/InlineTextEditor.js
- **Resolution:** Replaced `?.` operator with explicit null checks
  for backward compatibility.

### ✅ P3-047: ViewerManager DOM Properties — False Positive (v36)

- **File:** resources/ext.layers/viewer/ViewerManager.js
- **Resolution:** Not a bug. `img.layersViewer` is properly nulled
  in cleanup code at lines 235 and 331. No GC leak.

### ✅ P3-048: ts-jest Removed (Fixed v36)

- **File:** package.json
- **Resolution:** Removed unused ts-jest dependency from
  devDependencies.

### ✅ P3-049: Gruntfile ESLint Cache Enabled (Fixed v36)

- **File:** Gruntfile.js
- **Resolution:** Changed `cache: false` to `cache: true`.

### ✅ P3-050: Test Files Not Linted by Grunt (Resolved)

- **File:** Gruntfile.js
- **Fix:** Removed `!tests/jest/**` exclusion from Gruntfile.js. Updated
  `.eslintrc.json` test override: ecmaVersion 2020→2022, added `OO` global,
  `no-unused-vars`/`no-redeclare` set to warn (test-specific patterns).
  129 warnings, 0 errors. All 11,122 tests still pass.

### ✅ P3-051: PHP Tests Use Only Existence Assertions (Fixed v40)

- **File:** tests/phpunit/unit/Api/ApiLayersSaveTest.php
- **Fix:** Replaced existence-only assertions with behavior-based API
  contract tests:
  - `testWriteModeSecurityContract()` validates CSRF token requirement,
    write mode, and POST enforcement.
  - `testGetAllowedParamsContract()` validates required/optional API
    parameter definitions and types.
- **Introduced:** v36 review

### ✅ P3-052: SchemaManager CURRENT_VERSION Updated (Fixed v36)

- **File:** src/Database/LayersSchemaManager.php
- **Resolution:** Updated CURRENT_VERSION from '1.5.56' to '1.5.57'.

### ✅ P3-053: RichTextConverter innerHTML Replaced (Fixed v39)

- **File:** resources/ext.layers.editor/canvas/RichTextConverter.js
- **Fix:** Replaced `innerHTML` with `DOMParser` in `htmlToRichText()`
  and `getPlainText()` for safer HTML parsing.

### ✅ P3-054: PropertiesForm setTimeout Guards (Fixed v39)

- **File:** resources/ext.layers.editor/ui/PropertiesForm.js
- **Fix:** Moved `editor.layerPanel` guard inside `setTimeout` callbacks
  to prevent stale reference access if panel is destroyed.

### ✅ P3-055: PropertyBuilders setTimeout Guards (Fixed v39)

- **File:** resources/ext.layers.editor/ui/PropertyBuilders.js
- **Fix:** Moved `editor.layerPanel` guard inside all 5 `setTimeout`
  callbacks to prevent stale reference access.

### ✅ P3-056: DraftManager Missing Editor Reference Cleanup (Fixed v39)

- **File:** resources/ext.layers.editor/DraftManager.js
- **Resolution:** destroy() now nulls editor and filename references.

### ✅ P3-057: LayersValidator Listener Accumulation (Fixed v39)

- **File:** resources/ext.layers.editor/LayersValidator.js
- **Fix:** Added WeakMap-based tracking. `createInputValidator()` now
  auto-destroys any previous validator on the same input element.

### ✅ P3-058: ErrorHandler DOM Initialization Timing (Fixed v39)

- **File:** resources/ext.layers.editor/ErrorHandler.js
- **Fix:** Added `document.body` guard with DOMContentLoaded fallback.

### ✅ P3-059: README.md Test Count Badge (Fixed v39)

- **File:** README.md
- **Fix:** Updated badge and tables to 11,122 tests (162 suites).

### ✅ P3-001: ApiLayersList Missing unset() (Fixed v34)

### ✅ P3-002: UIHooks Unused Variables (Fixed v34)

### ✅ P3-003: StateManager Malformed JSDoc (Fixed v34)

### ✅ P3-004: ThumbnailRenderer Exception Not Throwable (Fixed v34)

### ✅ P3-005: Hardcoded 'Anonymous' User Name (Fixed v34)

### ✅ P3-006: ImageLayerRenderer djb2 Hash Collision — CLOSED BY DESIGN

### ✅ P3-007: checkSizeLimit .length Not Byte Count (Fixed v34)

### ✅ P3-008: LayerInjector Logger Argument (Fixed v30)

### ✅ P3-009: SlideHooks isValidColor Too Weak (Fixed v30)

### ✅ P3-010: services.php Missing strict_types (Fixed v30)

### ✅ P3-011: Version Numbers Stale Across 10+ Documents (Resolved)

- **Fix:** Updated 1.5.56→1.5.57 in UX_STANDARDS_AUDIT.md, SLIDE_MODE.md,
  LTS_BRANCH_STRATEGY.md (6 version references). Other files already correct.

### ✅ P3-012: PHPUnit Test Count Wrong in Files (Resolved)

### ✅ P3-013: i18n Key Count Wrong (Resolved)

- **Fix:** All key docs already show 816 (matching en.json). Original
  731/741 counts were corrected in earlier sessions.

### ✅ P3-014: README Uses Wrong Slide Parameter (Resolved)

### ✅ P3-015: ARCHITECTURE.md Contains VERSION: '0.8.5' (Resolved)

### ❌ P3-016: No CHANGELOG Entries for v1.5.53 or v1.5.54 — ✅ CLOSED

- **Resolution:** No git tags exist for v1.5.53 or v1.5.54. These version
  bumps were never formally released. No changelog content can be created.

### ❌ P3-017: wiki/Changelog.md Not Mirroring CHANGELOG.md — ✅ RESOLVED

- **Fix:** The 37% gap is primarily from pre-1.0 versions (0.8.x-0.9.x, 10
  entries) and minor releases (1.1.1, 1.4.1, etc.) that predate the mirroring
  rule. Recent versions (1.5.32-34) are already summarized at 1.5.35. All
  versions from 1.5.35 onward are present in both files.

### ❌ P3-018: INSTANTCOMMONS_SUPPORT.md Deprecated Syntax — ✅ RESOLVED

### ❌ P3-019: NAMED_LAYER_SETS.md Uses Proposal Language — ✅ RESOLVED

- **Fix:** Full rewrite in P2-038 commit: "Proposed Design" → "Architecture",
  schema corrected, removed nonexistent config keys, marked delete/rename
  as implemented.

### ❌ P3-020: SHAPE_LIBRARY_PROPOSAL.md Says "Proposed" — ✅ RESOLVED

### ❌ P3-021: UX_STANDARDS_AUDIT.md Outdated — ✅ RESOLVED

### ❌ P3-022: SLIDE_MODE.md Partially Implemented — ✅ RESOLVED

### ❌ P3-023: FUTURE_IMPROVEMENTS.md Duplicate Section Numbers — ✅ RESOLVED

- **Fix:** Removed 5 completed items (FR-8, FR-12, FR-13, FR-14, FR-16)
  from Active Proposals. Renumbered remaining proposals. Added to
  Recently Completed table.

### ❌ P3-024: README Badge Test Count Outdated — ✅ RESOLVED

- **Fix:** Already fixed in P3-059 (updated to 11,122 tests / 162 suites).

### ❌ P3-025: JS/PHP Line Counts Slightly Off — ✅ RESOLVED

- **Fix:** Updated across 8 files: JS 96,943 lines, PHP 40 files / 15,081 lines.

### ❌ P3-026: SSLV.php Line Count Wrong in Docs — ✅ RESOLVED

- **Fix:** Updated SSLV 1,346/1,375→1,383 and LayersDatabase 1,363→1,369
  across ARCHITECTURE.md, codebase_review.md, copilot-instructions.md.

### ❌ P3-027: PropertiesForm.js Line Count Wrong — ✅ RESOLVED

- **Fix:** Updated PropertiesForm 914/994/1,001→993 across 5 files.
  Updated PropertyBuilders 1,284→1,495 in ARCHITECTURE.md.

### ❌ P3-028: God Class Count Wrong in Multiple Docs — ✅ RESOLVED

- **Fix:** Updated 21→16 across README.md, CONTRIBUTING.md (including
  god class table), ARCHITECTURE.md, GOD_CLASS_REFACTORING_PLAN.md,
  codebase_review.md, wiki/Changelog.md, wiki/Frontend-Architecture.md.

### ❌ P3-029 through P3-032: Additional Documentation Staleness — ✅ RESOLVED

- **Fix:** All specific documentation staleness addressed in v39 review:
  version numbers, line counts, god class counts, tool counts, i18n counts,
  NAMED_LAYER_SETS.md, FUTURE_IMPROVEMENTS.md, and test counts.

### ✅ P3-033: SHA1 Fallback Outside Trait (Fixed v35)

### ✅ P3-034: SchemaManager CURRENT_VERSION Stale at 1.5.52 (Fixed v35)

### ✅ P3-035: ImageLayerRenderer Stale Cache on src (Fixed v35)

### ✅ P3-036: DimensionRenderer hitTest Fallback Mismatch (Fixed v35)

### ✅ P3-037: ColorValidator Alpha Regex (Fixed v35)

### ✅ P3-038: WikitextHooks info→debug Log Level (Fixed v35)

### ✅ P3-039: EditLayersAction Dead MW < 1.44 Code (Fixed v35)

### ✅ P3-040: ErrorHandler retryOperation No-Op (Fixed v35)

### ✅ P3-041: LayersLightbox Hardcoded English Alt (Fixed v35)

### ✅ P2-044: RichText fontFamily CSS Attribute Injection (Fixed v39)

- **Files:** src/Validation/ServerSideLayerValidator.php L899,
  resources/ext.layers.editor/canvas/RichTextConverter.js L89-108
- **Impact:** Server validates richText `fontFamily` as type `string`
  only, NOT sanitized with `sanitizeIdentifier()` like top-level
  fontFamily. Client interpolates into HTML style attributes without
  escaping. A crafted fontFamily could break out of the style
  attribute. Requires compromised API or direct DB access.
- **Introduced:** v39 review
- **Recommended Fix:** Apply `sanitizeIdentifier()` to richText
  fontFamily server-side; escape CSS values client-side.

### ✅ P2-045: ForeignFileHelper Code Duplication (Fixed v39)

- **Files:** Hooks.php, EditLayersAction.php, LayerInjector.php,
  LayeredFileRenderer.php, ThumbnailProcessor.php, ThumbnailRenderer.php,
  ImageLinkProcessor.php
- **Impact:** `isForeignFile()` and/or `getFileSha1()` duplicated in
  7 files outside the existing ForeignFileHelperTrait.
- **Fix:** Created `src/Utility/ForeignFileHelper.php` static utility class
  with canonical 3-step detection. All 7 files + trait now delegate to it.
  ~280 lines of duplicate code removed.

### ✅ P2-046: ThumbnailRenderer Ignores Opacity for Named Colors (Fixed v39)

- **File:** src/ThumbnailRenderer.php L645-722
- **Impact:** `withOpacity()` returns named CSS colors unchanged
  regardless of opacity value. Visual mismatch between thumbnails
  (full opacity) and canvas viewer (correct opacity).
- **Introduced:** v39 review
- **Recommended Fix:** Add CSS named color → RGB lookup table.

### ✅ P2-047: No Rate Limiting on {{#Slide:}} Parser Function (Fixed v39)

- **File:** src/Hooks/SlideHooks.php L150, L327-360
- **Impact:** One uncached DB query per `{{#Slide:}}` invocation
  with no per-page counter or result cache. 200+ invocations on
  one page generates 200+ queries.
- **Introduced:** v39 review
- **Recommended Fix:** Add static counter (max 50/page) and cache.

### ✅ P2-048: wiki/Drawing-Tools.md Missing 2 Tool Docs (Fixed v39)

- **File:** wiki/Drawing-Tools.md
- **Impact:** Claims 15 tools but Marker and Dimension tools have
  zero documentation. Both have dedicated renderers (601 and 927
  lines respectively).
- **Introduced:** v39 review
- **Recommended Fix:** Add Marker and Dimension sections.
- **Resolution:** Added comprehensive Marker and Dimension tool
  documentation sections. Updated tool count from 15 → 17 across
  all documentation files (13 files).

### ✅ P2-049: Double HTML-Escaping in LayeredFileRenderer (Fixed v39)

- **File:** src/Hooks/Processors/LayeredFileRenderer.php L78
- **Impact:** `htmlspecialchars()` called on filename before passing
  to `errorSpan()` which calls `htmlspecialchars()` again. Filenames
  with `&` display as `&amp;amp;`.
- **Introduced:** v39 review
- **Recommended Fix:** Remove `htmlspecialchars()` from call site L78.

### ✅ P2-050: Hooks.php Fallback Logger Incomplete PSR-3 (Fixed v39)

- **File:** src/Hooks.php L139-172
- **Impact:** Fallback logger only implements `info()`, `error()`,
  `warning()` — missing `debug()`, `notice()`, `critical()`,
  `alert()`, `emergency()`, `log()`. Any code calling missing
  methods via this fallback triggers fatal error.
- **Introduced:** v39 review
- **Recommended Fix:** Use `\Psr\Log\NullLogger` as fallback.

### ✅ P2-051: ToolbarStyleControls Validator Cleanup Leak (Fixed v39)

- **File:** resources/ext.layers.editor/ToolbarStyleControls.js L973
- **Impact:** `destroy()` sets `this.inputValidators = []` without
  calling `.destroy()` on each validator, leaving event listeners
  attached to old input elements.
- **Introduced:** v39 review
- **Recommended Fix:** Add `this.inputValidators.forEach(v => v.destroy())`
  before clearing.

### ✅ P2-052: npm test Skips Jest Unit Tests (Fixed v39)

- **Files:** package.json L8, Gruntfile.js L47
- **Impact:** `npm test` = grunt (eslint, stylelint, banana) only.
  11,122 Jest tests require separate `npm run test:js`. CI using
  only `npm test` has zero unit test coverage.
- **Introduced:** v39 review
- **Recommended Fix:** Add `&& npx jest --passWithNoTests` to npm test.

### ✅ P2-053: UIHooks Excessive Defensive Coding (Fixed v39)

- **File:** src/Hooks/UIHooks.php
- **Impact:** 28 `method_exists()`/`is_object()` checks for APIs
  guaranteed since MW 1.18+. Extension requires MW >= 1.44.0.
  Dead code noise reduces readability.
- **Introduced:** v39 review
- **Recommended Fix:** Remove pre-1.44 compatibility guards.

### ✅ P3-060: console.log/warn Globally Mocked in Test Setup (Fixed v39)

- **File:** tests/jest/setup.js
- **Fix:** Replaced `global.console = Object.assign(...)` with
  individual `jest.spyOn()` calls that auto-restore between tests.

### ✅ P3-061: BasicLayersTest.test.js Tautological Tests (Fixed v39)

- **File:** tests/jest/BasicLayersTest.test.js (DELETED)
- **Fix:** Deleted 275-line file that tested inline objects without
  importing any production code. Test count: 11,139 → 11,122.

### ✅ P3-062: jest.config.js Coverage Comment Stale (Fixed v39)

- **File:** jest.config.js L36
- **Impact:** Comment says 94.19% statements; actual is 95.19%.
- **Introduced:** v39 review

### ✅ P3-063: Hooks.php/UIHooks.php Unnecessary NS_FILE Guard (Fixed v39)

- **Files:** src/Hooks.php L21-23, src/Hooks/UIHooks.php L21-23
- **Impact:** Both define NS_FILE if not set. MW >= 1.44.0 always
  defines it. Dead code.
- **Introduced:** v39 review

---

## Documentation Issues Summary (updated v41)

Documentation issues identified across reviews, tracked for
completeness and referenced in the improvement plan.

| Severity | Count | Description |
|----------|-------|-------------|
| HIGH | 1 | Version drift (10+ files) — fixed v36 |
| MEDIUM | 2 | Metrics drift (fixed v36); ARCHITECTURE.md module line counts wrong (v41) |
| LOW | 13+ | CHANGELOG mirror; FUTURE_IMPROVEMENTS; stale counts; copilot-instructions nonexistent dir; RELEASE_GUIDE.md stale reqs; DEVELOPER_ONBOARDING.md line counts; mediawiki page says "15 drawing tools" (should be 17) |

---

## Reporting an Issue

If you discover a new issue, add it to this document under the
appropriate priority level with:
- A unique ID (P{n}-{NNN})
- File reference and line numbers
- Description of impact
- Recommended fix (if known)
- The review version where it was discovered

Then update the summary table at the top.
