# Layers MediaWiki Extension — Codebase Review

**Review Date:** March 10, 2026 (v50 audit)
**Previous Review:** March 10, 2026 (v49 audit)
**Version:** 1.5.61
**Reviewer:** GitHub Copilot (Claude Sonnet 4.6)

---

## Scope & Verification

- **Branch Reviewed:** `main`
- **Verification Method:** Direct source inspection with multi-pass
    verification; all findings individually confirmed against actual code
    before inclusion. Known false-positive patterns from prior reviews
    were checked and excluded. 5 subagent-reported issues were eliminated
    as false positives during this v49 round (see Verified Non-Issues).
- **Coverage:** 91.32% statements, 81.69% branches, 90.62% functions,
    91.39% lines (verified March 10, 2026 — commit 4f315a5f)
- **JS source files:** 143 in `resources/` excluding `resources/dist` (~99,730 lines)
- **PHP production files:** 41 in `src/` (~15,197 lines)
- **Jest test suites:** 168
- **Jest test cases:** 11,445 (`npm run test:js` — verified March 10, 2026)
- **PHPUnit test files:** 31 in `tests/phpunit`
- **i18n message keys:** 832 in `i18n/en.json`, 832 in `i18n/qqq.json`
- **API Modules:** 5 (`layersinfo`, `layerssave`, `layersdelete`,
  `layersrename`, `layerslist`)
- **Files >1,000 lines:** 23 total (2 generated JS, 19 hand-written JS, 2 PHP)

---

## Executive Summary

This v49 audit performed a full-codebase review of all PHP (`src/`) and
JavaScript (`resources/`) source files plus all documentation. The review
was conducted with a high false-positive threshold — all findings were
verified against literal source code before inclusion.

The v49 review found **54 new verified issues**: 11 HIGH, 18 MEDIUM,
15 LOW, and 10 documentation issues. These are distributed across PHP
backend, JavaScript editor core, canvas/rendering modules, and documentation.
Unlike prior reviews, none of the new HIGH findings have been fixed yet —
they are all open as of March 10, 2026.

Notable new findings include a **privilege escalation risk** (wiki page-deletion
right used as Layers admin gate), **information disclosure** in two special
pages (DB queries run before permission checks), a **permanently-hanging Promise**
when cached revision data is corrupt, **wrong validation bounds** in
ValidationManager (more restrictive than the server), and **smart guides
completely non-functional** for line/arrow/path/dimension layer types.

All v48 bugs have been confirmed as fixed. The codebase retains strong
architecture and comprehensive test coverage, but this audit reveals a
cluster of correctness bugs in the JS layer that did not exist in earlier
versions, introduced during the large v42–v46 feature additions. The
documentation drift problem (incorrect metrics in README, CHANGELOG, and
ARCHITECTURE.md) continues despite partial fixes in prior reviews.

---

## Confirmed Findings (v50 — March 10, 2026) — All 7 Fixed in v1.5.61

### v49 Verification Summary

All 53 of 54 v49 issues verified as fixed (v1.5.59/v1.5.60). P1-053 is
partially fixed; remaining path-type issue re-tracked as P2-122 below.

| ID | Status | Notes |
|----|--------|-------|
| P1-045 | ✅ Fixed v1.5.59 | `layers-admin` right added; `LayersApiHelperTrait.php` L106 corrected |
| P1-046 | ✅ Fixed v1.5.59 | Permission check moved before DB query in SpecialSlides |
| P1-047 | ✅ Fixed v1.5.59 | Permission check moved before DB query in SpecialEditSlide |
| P1-048 | ✅ Fixed v1.5.59 | `return;` moved inside `try` block; Promise now resolves/rejects |
| P1-049 | ✅ Fixed v1.5.59 | 4 sites converted to `.then(success, failure)` pattern |
| P1-050 | ✅ Fixed v1.5.59 | `lastSaveHistoryIndex` decremented correctly on history trim |
| P1-051 | ✅ Fixed v1.5.59 | `EditorBootstrap` no longer creates duplicate editors |
| P1-052 | ✅ Fixed v1.5.59 | `ValidationManager` bounds now match server (`fontSize < 1`, `strokeWidth > 100`) |
| P1-053 | ✅ Fixed v1.5.61 | path type fixed (P2-122); all types now fully working |
| P1-054 | ✅ Fixed v1.5.59 | `canvas.parentNode` null-checked in `fitToWindow()` |
| P1-055 | ✅ Fixed v1.5.59 | Same null-check applied in `zoomToFitLayers()` |
| P2-104 | ✅ Fixed v1.5.59 | Zero-width space no longer injected in `TextSanitizer` |
| P2-105 | ✅ Fixed v1.5.59 | `blend` property now validated against enum in `ServerSideLayerValidator` |
| P2-106 | ✅ Fixed v1.5.59 | `usleep()` reduced to 10ms/20ms |
| P2-107 | ✅ Fixed v1.5.59 | N+1 replaced with batch SQL — but introduced deprecated API (see P2-123) |
| P2-108 | ✅ Fixed v1.5.59 | `CacheInvalidationTrait` now logs warning on cache failure |
| P2-109 | ✅ Fixed v1.5.59 | `wfLogWarning()` replaced with `LoggerFactory` in `RateLimiter` |
| P2-110 | ✅ Fixed v1.5.59 | `ApiLayersRename` returns `ERROR_INVALID_SETNAME` for bad format |
| P2-111 | ✅ Fixed v1.5.59 | `parseMWTimestamp` fallback uses `Date.UTC(...)` |
| P2-112 | ✅ Fixed v1.5.59 | `currentSetName` set only after successful load |
| P2-113 | ✅ Fixed v1.5.59 | Auto-save interval now checks `isRecoveryMode` |
| P2-114 | ✅ Fixed v1.5.59 | APIManager reads `wgLayersMaxLayerCount` instead of hardcoded 100 |
| P2-115 | ✅ Fixed v1.5.59 | `nudgeSelectedLayers` uses `stateManager.updateLayer()` |
| P2-116 | ✅ Fixed v1.5.59 | Draft storage key uses hash to prevent collision |
| P2-117 | ✅ Fixed v1.5.59 | `emitTransforming()` RAF ID stored and cancelled on destroy |
| P2-118 | ✅ Fixed v1.5.59 | `animationFrameId` nulled on animation completion |
| P2-119 | ✅ Fixed v1.5.59 | `AngleDimensionRenderer` cached as singleton in `SelectionRenderer` |
| P2-120 | ✅ Fixed v1.5.59 | `_arrowTipRafId` initialized to `null` in constructor |
| P2-121 | ✅ Fixed v1.5.59 | Text-drag state variables initialized in constructor |
| P3-128 | ✅ Fixed v1.5.60 | i18n message used instead of raw filename in error span |
| P3-129 | ✅ Fixed v1.5.60 | `requiresUnblock()` returns `true` |
| P3-130 | ✅ Fixed v1.5.60 | `returnTo` validation uses `isValid()` + namespace allowlist |
| P3-131 | ✅ Fixed v1.5.60 | `sanitizeText()` and `sanitizeRichTextRun()` use `mb_strlen()` |
| P3-132 | ✅ Fixed v1.5.60 | `ApiLayersList` uses shared `RateLimiter::checkRateLimit()` |
| P3-133 | ✅ Fixed v1.5.60 | `LayersSchemaManager` uses typed exception instead of string parsing |
| P3-134 | ✅ Fixed v1.5.60 | i18n key used for 'Edit Layers' link text |
| P3-135 | ✅ Fixed v1.5.60 | Dead `=== false` comparison removed from `ThumbnailProcessor` |
| P3-136 | ✅ Fixed v1.5.60 | `mw.notify()` wrapped in `typeof mw !== 'undefined'` guard |
| P3-137 | ✅ Fixed v1.5.60 | `namedSets.push()` replaced with spread: `[...namedSets, {...}]` |
| P3-138 | ✅ Fixed v1.5.60 | Single spinner ownership established |
| P3-139 | ✅ Fixed v1.5.60 | Double `redraw()` in `handleImageLoaded()` removed |
| P3-140 | ✅ Fixed v1.5.60 | Dead `updateLayerPosition()` delegated or removed |
| P3-141 | ✅ Fixed v1.5.60 | `getLayerAtPoint()` fallback loop direction corrected |
| P3-142 | ✅ Fixed v1.5.60 | ESLint `no-unused-vars: off` scoped to individual files |
| D-049-01 through D-049-10 | ✅ Fixed v1.5.60 | Documentation metrics synchronized |

---

### New Findings (v50) — All Fixed in v1.5.61

### High

#### PHP — 1 item

**P1-056 · SpecialSlides.php `$canDelete` Uses Page-Deletion Right Instead of `layers-admin`**
- **File:** `src/SpecialPages/SpecialSlides.php` L80
- **Code:** `$canDelete = $permissionManager->userHasRight( $user, 'delete' );`
- **Impact:** The `$canDelete` flag is passed as `wgLayersSlidesConfig.canDelete`
    to the `SpecialSlides.js` frontend (L85), where it controls visibility of
    the delete-slide button (L185). Because it checks the wiki page-deletion
    right instead of `layers-admin`:
    1. Any user who can delete wiki pages (sysops) sees the delete button
       but could also already delete via the `layers-admin` API path —
       so this is not an exploitation path, just a wrong-gate dependency.
    2. A dedicated `layers-admin` user **without** the page-deletion right
       cannot see the delete button in the UI, even though the API would
       accept their deletion request. Legitimate layer admins are
       denied the delete UI.
    Security note: the `layersdelete` API is correctly gated by `layers-admin`
    (in `LayersApiHelperTrait.php`, fixed in P1-045). This is a **UI-only
    authorization inconsistency**, not an API bypass.
- **Fix:** `$canDelete = $permissionManager->userHasRight( $user, 'layers-admin' );`
- **Root cause:** P1-045 fixed `LayersApiHelperTrait.php` but missed this
    call in `SpecialSlides.php`. The bug was introduced simultaneously.
- **Status:** ✅ **Fixed** (v1.5.61)

### Medium

#### Canvas — 1 item

**P2-122 · Smart Guides Broken for `path` Layer Type — Incomplete P1-053 Fix**
- **File:** `resources/ext.layers.editor/canvas/TransformController.js`
    L498–520, function `_getRefPoint()`
- **Code:**
    ```javascript
    const _getRefPoint = ( state ) => {
        const t = state.type;
        if ( t === 'line' || t === 'arrow' || t === 'dimension' ) { ... }
        if ( t === 'angleDimension' ) { ... }
        return { x: state.x || 0, y: state.y || 0 };  // ← path falls here
    };
    ```
- **Impact:** `path` layers store geometry as `points: [{x,y}, ...]` with
    no top-level `.x` or `.y`. The fallthrough branch returns `{x:0, y:0}`
    for path layers, making snap calculations use the canvas origin as the
    reference. Smart guides fire but snap to globally wrong positions —
    effectively non-functional for freeform path layers.
    P1-053's original title listed "Line, Arrow, **Path**, Dimension" but
    the `path` case was not added to the fix.
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
- **Status:** ✅ **Fixed** (v1.5.61)

#### PHP — 1 item

**P2-123 · `ApiLayersInfo.enrichRowsWithUserNames()` Uses Deprecated `ILoadBalancer` API**
- **File:** `src/Api/ApiLayersInfo.php` L524–526
- **Code:**
    ```php
    $dbr = MediaWikiServices::getInstance()
        ->getDBLoadBalancer()
        ->getConnection( DB_REPLICA );
    ```
- **Context:** This code was introduced by the P2-107 fix (batch user
    lookup). The same class already has a `getDb()` method at L642 that
    correctly uses `getConnectionProvider()->getReplicaDatabase()` — the
    modern MW 1.39+ API.
- **Impact:** `ILoadBalancer::getConnection()` is deprecated since MW 1.39
    and will be removed in a future version. When removed, this will cause
    a fatal error on every call to `layersinfo` that has revision history
    with non-zero user IDs. Other files in the extension use the modern API;
    this is an inconsistency introduced during the P2-107 fix.
- **Fix:** Replace L524–526 with `$dbr = $this->getDb();`
- **Status:** ✅ **Fixed** (v1.5.61)

### Low

#### Documentation — 4 items

**D-050-01 · `docs/ARCHITECTURE.md` Stale Coverage and Test Metrics**
- **File:** `docs/ARCHITECTURE.md` L34–35, L148
- **Issues:**
  - L34: `92.19% statements, 82.15% branches` → should be `91.32%, 81.69%`
  - L35: `11,421 tests (167 suites)` → should be `11,445 (168 suites)`
  - L148: `95.19% coverage` → completely outdated (ancient value from before v40)
- **Fix:** Update all three lines to current verified values.

**D-050-02 · `CHANGELOG.md` v1.5.60 Documentation Section Claims Wrong Coverage**
- **File:** `CHANGELOG.md`, v1.5.60 Documentation section
- **Issue:** States coverage metrics were updated to `92.19%` — but the
    actual coverage at the v1.5.60 commit is `91.32%` (commit `4f315a5f`).
- **Fix:** Update CHANGELOG v1.5.60 entry to reflect `91.32%`.

**D-050-03 · `wiki/Changelog.md` Same Stale Coverage Value as D-050-02**
- **File:** `wiki/Changelog.md`, v1.5.60 entry
- **Issue:** Mirrors the `CHANGELOG.md` v1.5.60 Documentation section
    with the same incorrect `92.19%` value.
- **Fix:** Sync with corrected CHANGELOG.md after D-050-02 is fixed.

**D-050-04 · `README.md` Internal God-Class Count Contradiction**
- **File:** `README.md` L317, L353, L384
- **Issues:**
  - L317: "22 god classes" — incorrect (correct value is 23)
  - L353: "17 files" with a Feb 17, 2026 date note — stale (correct is
    19 hand-written JS + 2 PHP = 21 excluding 2 generated)
  - L384 (metrics table): correctly says `23` — creates an internal
    contradiction with L317
- **Fix:** Update L317 and L353 to say 23 and 21 hand-written respectively.
- **Status:** ✅ **Fixed** (v1.5.61)

---

## v49 Confirmed Open Findings (Historical Reference — March 10, 2026)

All items below were open as of the v49 audit and have since been fixed.
See KNOWN_ISSUES.md for the canonical tracking record.

### High

#### PHP — 3 items

**P1-045 · LayersApiHelperTrait `isAllowed('delete')` Privilege Confusion**
- **File:** `src/Api/Traits/LayersApiHelperTrait.php` L106
- **Code:** `$isAdmin = $user->isAllowed( 'delete' );`
- **Impact:** The `'delete'` right in MediaWiki controls wiki **page deletion**,
    not layer administration. Any user with page-deletion rights (typically
    `sysop`) becomes an unrestricted Layers admin, able to delete or rename
    any user's layer sets. Conversely, a dedicated layers admin who does not
    have page-deletion rights cannot moderate layer content. The two domains
    are completely unrelated.
- **Fix:** Introduce a `layers-admin` right in `extension.json` (default
    `sysop`) and check that instead:
    `$isAdmin = $user->isAllowed( 'layers-admin' );`

**P1-046 · SpecialSlides.php DB Query Before Permission Check**
- **File:** `src/SpecialPages/SpecialSlides.php` L172 (DB query), L179 (permission check)
- **Impact:** `getLayerSetByName()` is called on line 172 before
    `userHasRight( $user, 'editlayers' )` is checked on line 179.
    Unauthorized users can probe slide existence by observing which error
    message they receive. Different code paths (does-not-exist vs. no-permission)
    produce distinct responses, allowing enumeration of slide names via
    timing or error message differences.
- **Fix:** Move the permission check to before the DB query (before line 172).

**P1-047 · SpecialEditSlide.php DB Query Before Permission Check**
- **File:** `src/SpecialPages/SpecialEditSlide.php`
- **Impact:** Same pattern as P1-046 — slide record fetched from DB before
    edit permission is verified. Same information-disclosure consequence.
- **Fix:** Same as P1-046 — reorder the permission check to precede any
    database query.

#### JavaScript — 5 items

**P1-048 · APIManager Cache Exception Leaves Promise Permanently Pending**
- **File:** `resources/ext.layers.editor/APIManager.js` L617–636
    (`loadRevisionById`, cache-hit path)
- **Code:**
    ```javascript
    try {
        const result = this._processRevisionData( cachedData, true );
        resolve( result );
    } catch ( error ) {
        this.responseCache.delete( cacheKey );
    }
    return;   // ← executes even after the catch
    ```
- **Impact:** When `_processRevisionData` throws on corrupt cached data,
    the cache entry is deleted but `return` still exits the Promise
    constructor. The Promise is left in perpetually-pending state —
    no error is surfaced, no retry fires, and the editor silently freezes
    on revision load.
- **Fix:** Move `return;` inside the `try` block (before `resolve`), so the
    catch falls through to the API fetch below.

**P1-049 · APIManager `.catch()` Always Receives Undefined `result` — 4 Sites**
- **File:** `resources/ext.layers.editor/APIManager.js` L315, L640, L815, L975
- **Code:** `} ).catch( ( code, result ) => {`
- **Impact:** In jQuery ≥ 3.0, `.then()` → `.catch()` chains lose all
    arguments after the first on rejection (documented jQuery behavior).
    `result` is always `undefined` at all four call sites. Consequences:
    abort detection (`result.textStatus === 'abort'`) never fires — aborted
    requests during rapid revision switching produce spurious error notifications;
    retry logic (`isRetryableError`) classifies every failure as retryable
    (including `permissiondenied`), causing 3 wasted retries before the real
    error is shown; error detail (`result.error.info`) is always lost.
- **Fix:** Replace `.then( success ).catch( failure )` with
    `.then( success, failure )` to preserve both jQuery deferred rejection
    arguments. Or use `.done( success ).fail( failure )` throughout.

**P1-050 · HistoryManager `lastSaveHistoryIndex` Not Decremented on History Trim**
- **File:** `resources/ext.layers.editor/HistoryManager.js` L128–136
    (`saveState`)
- **Code:**
    ```javascript
    this.history.push( state );
    if ( this.history.length > this.maxHistorySteps ) {
        this.history.shift();   // shifts all indices by -1
    }
    this.historyIndex = this.history.length - 1;  // corrected
    // lastSaveHistoryIndex is NOT adjusted
    ```
- **Impact:** After reaching history capacity, `lastSaveHistoryIndex`
    exceeds `history.length - 1`. `history[lastSaveHistoryIndex]` is
    `undefined`. `hasUnsavedChanges()` falls back to comparing against
    `history[0]` (initial load state) instead of the actual last-saved
    state. The "unsaved changes" indicator becomes permanently incorrect
    once the history is full. The fast-path short-circuit is also disabled
    permanently, forcing a deep `layersEqual` scan on every dirty check.
- **Fix:** After `history.shift()`, add:
    `if ( this.lastSaveHistoryIndex > 0 ) { this.lastSaveHistoryIndex--; }`

**P1-051 · EditorBootstrap Creates Duplicate Editor Instances in Production**
- **File:** `resources/ext.layers.editor/editor/EditorBootstrap.js` L442–443
- **Code:** `if ( window.mw && window.mw.config.get( 'debug' ) ) { window.layersEditorInstance = editor; }`
- **Impact:** The duplicate-prevention guard is `if ( window.layersEditorInstance ) return`.
    In production (non-debug mode), `autoBootstrap` never registers the
    new editor in that global. When `areEditorDependenciesReady()` returns
    false, the hook listener defers via 100ms `setTimeout` and returns without
    creating an editor. `autoBootstrap` sees `window.layersEditorInstance === null`,
    creates an editor but does NOT register it. When the timeout fires, the
    hook listener also sees `null` and creates a second editor. Two editors
    share the same container in production.
- **Fix:** Always set `window.layersEditorInstance = editor` after creating,
    regardless of debug mode. Move the assignment outside the debug guard.

**P1-052 · ValidationManager Bounds Stricter Than Server — Valid Data Rejected**
- **File:** `resources/ext.layers.editor/ValidationManager.js` L240, L246
- **Code:**
    ```javascript
    // L240: rejects fontSize < 8 (server allows 1)
    if ( layer.fontSize && ( ... layer.fontSize < 8 || layer.fontSize > 1000 ) )
    // L246: rejects strokeWidth > 50 (server allows 100)
    if ( layer.strokeWidth && ( ... layer.strokeWidth > 50 ) )
    ```
- **Impact:** `LayersValidator` and the server both allow `fontSize` down to
    1 and `strokeWidth` up to 100. `ValidationManager` rejects font sizes 1–7
    and stroke widths 51–100 as invalid before the save reaches the server.
    On wikis that use small font sizes or thick strokes (accessible design,
    infographics), these values are blocked client-side with no clear validation
    message.
- **Fix:** Align `ValidationManager` bounds with the server:
    `fontSize < 1`, `strokeWidth > 100`.

#### Canvas — 3 items

**P1-053 · Smart Guides Non-Functional for Line, Arrow, Path, and Dimension Layers**
- **File:** `resources/ext.layers.editor/canvas/TransformController.js` L486–505
- **Code:**
    ```javascript
    const proposedX = ( originalState.x || 0 ) + deltaX;
    const proposedY = ( originalState.y || 0 ) + deltaY;
    ```
- **Impact:** Line, arrow, path, dimension, and angleDimension layers use
    `x1/y1/x2/y2` or a `points` array — they have no `.x`/`.y` properties.
    `originalState.x` is `undefined`, coercing to `0`. The snap calculation
    receives `proposedX = deltaX` (~10px) instead of the layer's actual
    position (~200px). All snap targets are hundreds of pixels away from
    the proposed position, so `findNearestSnap` never fires. Smart guides
    appear enabled in the UI but are completely inert for these layer types.
- **Fix:** For geometric layers without `.x`/`.y`, derive the reference
    point from `getLayerBounds()` before computing the proposed position,
    then back-calculate the adjusted delta using the bounds-based reference.

**P1-054 · ZoomPanController `fitToWindow()` Null Dereference on `canvas.parentNode`**
- **File:** `resources/ext.layers.editor/canvas/ZoomPanController.js` L232–234
- **Code:**
    ```javascript
    const container = canvas.parentNode;
    const containerWidth = container.clientWidth - 40;  // ← throws if parentNode is null
    ```
- **Impact:** If `fitToWindow()` is called while the canvas is detached
    from the DOM (during editor teardown, in test environments, or during
    transition animations), `canvas.parentNode` is `null` and
    `container.clientWidth` throws `TypeError`. Prior guards check for
    `!canvas` but not for `!canvas.parentNode`.
- **Fix:** Add `if ( !container ) { return; }` after line 232.

**P1-055 · ZoomPanController `zoomToFitLayers()` Same Null Dereference**
- **File:** `resources/ext.layers.editor/canvas/ZoomPanController.js` L295–296
- **Code:** `const container = this.manager.canvas.parentNode;`
    followed immediately by `container.clientWidth`
- **Impact:** Identical issue to P1-054 in the `zoomToFitLayers` path.
- **Fix:** Same — add `if ( !container ) { return; }` guard.

---

### Medium

#### PHP — 7 items

**P2-104 · TextSanitizer Zero-Width Space Injection Corrupts User Text**
- **File:** `src/Validation/TextSanitizer.php` L180–197
- **Code:** Inserts `\u200B` (invisible zero-width space) before `(` in
    patterns like `alert(`, `confirm(`, `eval(`, etc.
- **Impact:** User annotations containing JavaScript-keyword-like text
    (code examples, tutorials, documentation labels) are silently mutated
    with an invisible character. `"Use alert() to notify users"` is stored
    as `"Use alert\u200B() to notify users"`. The stored data differs from
    what the user typed, the mutation is invisible in rendered output, and
    it is non-reversible upon retrieval. The mitigation is also unnecessary:
    Canvas `fillText()` cannot execute JavaScript; `removeDangerousProtocols()`
    already strips `javascript:` URIs; and the server never executes stored
    text as code.
- **Fix:** Remove the zero-width space injection block entirely. The
    existing `removeEventHandlers()` and `removeDangerousProtocols()`
    methods provide sufficient protection for the actual threat model
    (no XSS from canvas text).

**P2-105 · `blend` Property Bypasses Enum Validation in ServerSideLayerValidator**
- **File:** `src/Validation/ServerSideLayerValidator.php` L419–425, L544–555
- **Code:** `'blend' => 'string'` in `ALLOWED_PROPERTIES`; `'blend'` not
    listed in the enum-constrained properties checked against `VALUE_CONSTRAINTS`.
- **Impact:** The `blend` property (alias for `blendMode`) is validated only
    as an arbitrary string (max 1000 chars), not constrained to the valid
    Canvas `globalCompositeOperation` values. Any string passes validation
    and is then copied to `blendMode` without re-validation. Invalid blend
    mode strings are silently stored to the DB and passed to the Canvas API,
    which falls back to `source-over` with no error.
- **Fix:** Add `'blend'` to the enum-constrained list using `blendMode`'s
    `VALUE_CONSTRAINTS` for lookups.

**P2-106 · `usleep()` Blocking in DB Retry Loop — Up to 300ms Added to HTTP Request**
- **File:** `src/Database/LayersDatabase.php` L134–135
- **Code:** `usleep( $retryCount * 100000 );  // 100ms, 200ms per retry`
- **Impact:** On transaction conflicts (concurrent saves), the retry loop
    calls `usleep()` with up to 300ms total sleep inside a synchronous
    PHP-FPM worker. On wikis with concurrent editors, this cascades:
    multiple in-flight requests sleeping together can exhaust PHP-FPM
    worker pools and database connection pools under load.
- **Fix:** Reduce to 10ms/20ms, or avoid sleeping entirely since the DB
    transaction isolation already handles the conflict.

**P2-107 · N+1 User Lookup in `ApiLayersInfo.enrichWithUserNames()`**
- **File:** `src/Api/ApiLayersInfo.php` L522–528
- **Code:**
    ```php
    foreach ( $userIds as $userId ) {
        $user = $userFactory->newFromId( $userId );
        if ( $user ) { $users[$userId] = $user->getName(); }
    }
    ```
- **Impact:** Despite the `// Batch load users using UserFactory` comment,
    `UserFactory::newFromId()` creates a lazy `User` whose name is fetched
    via an individual DB query when `getName()` is called. For a layer set
    history page with 50 revisions by 15 distinct users, this executes
    15 sequential DB queries.
- **Fix:** Replace with a single `SELECT user_id, user_name FROM user WHERE
    user_id IN (...)` query via the connection provider's replica database.

**P2-108 · Cache Invalidation Errors Silently Suppressed**
- **File:** `src/Api/Traits/CacheInvalidationTrait.php` L55–58
- **Code:**
    ```php
    } catch ( \Throwable $e ) {
        // Cache invalidation is best-effort; don't fail the save
    }
    ```
- **Impact:** Any exception during cache purging (infrastructure failure,
    misconfiguration, CDN errors) is completely swallowed with no log entry.
    On high-traffic wikis, stale cached content can persist indefinitely
    with no operator visibility. The "best-effort" architecture is reasonable;
    the silent suppression is not.
- **Fix:** Add a warning log entry:
    `$this->getLogger()->warning( 'Cache invalidation failed', [ 'exception' => $e ] );`

**P2-109 · `wfLogWarning()` Deprecated API in RateLimiter**
- **File:** `src/Security/RateLimiter.php` L99–100
- **Code:** `if ( function_exists( 'wfLogWarning' ) ) { wfLogWarning( ... ); }`
- **Impact:** `wfLogWarning()` is deprecated in MediaWiki and may be removed
    in a future version. The `function_exists` guard prevents a fatal error
    but causes silent loss of rate limit logging when the function is removed —
    a security monitoring regression. All other code in the extension uses
    `LoggerFactory::getInstance('Layers')->warning(...)` consistently.
- **Fix:** Replace with `$this->getLogger()->warning( 'Layers rate limit: {action}...', [...] );`
    and remove the `function_exists` guard.

**P2-110 · `ApiLayersRename` Returns Wrong Error Code for Invalid Name Format**
- **File:** `src/Api/ApiLayersRename.php`
- **Impact:** When the `oldname` parameter fails format validation
    (invalid characters), the API returns `ERROR_LAYERSET_NOT_FOUND`
    ("Layer set not found"). The actual problem is a structurally invalid
    input name, not a missing set. API consumers receive a "not found"
    response when the correct behavior would distinguish "bad input" from
    "not found," breaking client-side retry/create logic.
- **Fix:** Return `ERROR_INVALID_SETNAME` for format-validation failures.

#### JavaScript — 6 items

**P2-111 · `parseMWTimestamp` Fallback Creates Date in Local Timezone, Not UTC**
- **File:** `resources/ext.layers.editor/LayersEditor.js` L1042–1047
- **Code:**
    `return new Date( year, month, day, hour, minute, second );  // LOCAL timezone`
    — the `revisionManager` delegate path (primary) correctly uses `Date.UTC(...)`.
- **Impact:** When `revisionManager` is null (early initialization or an
    error loading the module), the fallback creates timestamps in the user's
    local timezone. For UTC+8 users, timestamps appear 8 hours ahead of the
    actual revision time in the revision history display.
- **Fix:** `return new Date( Date.UTC( year, month, day, hour, minute, second ) );`

**P2-112 · `RevisionManager.loadLayerSetByName` Mutates `currentSetName` Before Load Succeeds**
- **File:** `resources/ext.layers.editor/editor/RevisionManager.js` L316 (before), L319 (after)
- **Code:**
    ```javascript
    this.stateManager.set( 'currentSetName', setName );   // Line 316 — optimistic
    await this.apiManager.loadLayersBySetName( setName ); // Line 319 — may fail
    ```
- **Impact:** If `loadLayersBySetName` rejects (network error, set not
    found), `currentSetName` has already been set to the failed target.
    The error handler logs and notifies the user but never reverts
    `currentSetName`. Subsequent saves write to the non-existent named set.
- **Fix:** Move `stateManager.set( 'currentSetName', setName )` to after
    the `await` call (inside the success path only).

**P2-113 · DraftManager `setInterval` Callback Bypasses `isRecoveryMode` Check**
- **File:** `resources/ext.layers.editor/DraftManager.js` L140–143
- **Code:**
    ```javascript
    this.autoSaveTimer = setInterval( () => {
        if ( this.editor.isDirty && this.editor.isDirty() ) {
            this.saveDraft();   // No isRecoveryMode check
        }
    }, AUTO_SAVE_INTERVAL_MS );
    ```
    The `scheduleAutoSave` path (L115) correctly gates on `isRecoveryMode`,
    but the `setInterval` callback does not.
- **Impact:** While the recovery confirmation dialog is shown, if the
    auto-save interval fires the editor is dirty, `saveDraft()` runs and
    can overwrite the draft with pre-recovery data or partially-initialized
    state.
- **Fix:** Add `if ( this.isRecoveryMode ) { return; }` inside the interval
    callback, mirroring the `scheduleAutoSave` guard.

**P2-114 · APIManager Hardcodes Layer Limit to 100, Ignores `wgLayersMaxLayerCount`**
- **File:** `resources/ext.layers.editor/APIManager.js` L898
- **Code:** `const validationResult = validator.validateLayers( layers, 100 );`
- **Impact:** On wikis configured with `$wgLayersMaxLayerCount` ≠ 100, the
    client validation disagrees with the server. With limit = 50, layers
    51–100 are allowed client-side but rejected server-side with a confusing
    server error. With limit = 150, layers 101–150 are blocked client-side
    with a "too many layers" message even though the server would accept them.
- **Fix:** `const maxLayers = ( mw.config.get( 'wgLayersMaxLayerCount' ) ) || 100;`

**P2-115 · EventManager `nudgeSelectedLayers` Directly Mutates Layer State**
- **File:** `resources/ext.layers.editor/EventManager.js` L203–204
- **Code:**
    ```javascript
    layer.x = ( layer.x || 0 ) + dx;   // Direct mutation of state object
    layer.y = ( layer.y || 0 ) + dy;
    ```
- **Impact:** `getSelectedLayers()` returns references to actual objects
    in `StateManager.state.layers`. Mutating them in-place bypasses
    `stateManager.set('layers', ...)`: `_layersVersion` is not incremented
    (SmartGuidesController snap cache goes stale), and layer-change
    subscribers (DraftManager, LayerPanel coordinate display) are not
    notified. `historyManager.saveState('nudge')` is called afterward and
    does capture the correct final position — but the notification window
    between mutation and save is skipped.
- **Fix:** Use `stateManager.updateLayer( layer.id, { x: ..., y: ... } )`
    for each nudged layer, which goes through the proper notification path.

**P2-116 · DraftManager Storage Key Collision Between Files With Spaces vs Underscores**
- **File:** `resources/ext.layers.editor/DraftManager.js` (constructor)
- **Code:** `this.storageKey = STORAGE_KEY_PREFIX + this.filename.replace( /[^a-zA-Z0-9_.-]/g, '_' );`
- **Impact:** `File:My Budget.jpg` and `File:My_Budget.jpg` are distinct
    MediaWiki files (different SHA1, different history) but both normalize
    to `File_My_Budget_jpg`, producing the same localStorage key. Opening
    either file in the editor reads the other's draft. On shared computers
    this causes draft cross-contamination.
- **Fix:** Append a short hash of the raw (pre-normalization) filename to
    ensure uniqueness.

#### Canvas — 5 items

**P2-117 · `CanvasManager.emitTransforming()` RAF Return Value Discarded — Fires Post-Destroy**
- **File:** `resources/ext.layers.editor/CanvasManager.js` L843
- **Code:**
    ```javascript
    this.transformEventScheduled = true;
    window.requestAnimationFrame( () => {   // ← return value discarded
        this.transformEventScheduled = false;
        ...dispatch CustomEvent...
    } );
    ```
    All other RAF callbacks in the codebase (`_dragRafId`, `_resizeRafId`,
    `_rotationRafId`) store and cancel their IDs in `destroy()`.
- **Impact:** The RAF always fires one frame after it is scheduled, even if
    the editor is destroyed during a drag operation. The callback dispatches
    a `layers:transforming` event using potentially stale or null data.
- **Fix:** Store the RAF ID and cancel it in `destroy()`, matching the
    pattern used by TransformController's other RAF animations.

**P2-118 · `ZoomPanController.animationFrameId` Not Nulled When Animation Completes**
- **File:** `resources/ext.layers.editor/canvas/ZoomPanController.js` L215–218
- **Code:** Completion branch:
    ```javascript
    this.isAnimatingZoom = false;
    this.setZoomDirect( this.zoomAnimationTargetZoom );
    // ← animationFrameId still holds the old numeric ID
    ```
- **Impact:** After a completed animation, `animationFrameId` remains truthy.
    Every subsequent `smoothZoomTo()` call starts by cancelling the stale
    ID via `cancelAnimationFrame( lastId )`. This is harmless in isolation
    but is semantically wrong and would cause issues in any code that
    guards on `if (this.animationFrameId)` to detect "animation in progress."
- **Fix:** Add `this.animationFrameId = null;` in the completion branch.

**P2-119 · `SelectionRenderer` Allocates New `AngleDimensionRenderer` on Every Render Frame**
- **File:** `resources/ext.layers.editor/canvas/SelectionRenderer.js` L598
- **Code:**
    ```javascript
    const tempRenderer = new AngleDimensionRenderer( null );
    const angles = tempRenderer.calculateAngles( layer );
    ```
    Called on every `mousemove` while an angleDimension layer is selected.
- **Impact:** ~60 heap allocations per second during drag. `HitTestController`
    solves the identical problem with a cached lazy instance; `SelectionRenderer`
    does not.
- **Fix:** Add a `_cachedAngleRenderer` property (initialized `null` in
    constructor) and lazily create it on first use, mirroring `HitTestController`.

**P2-120 · `TransformController._arrowTipRafId` Absent from Constructor**
- **File:** `resources/ext.layers.editor/canvas/TransformController.js`
    (constructor, `destroy()` L1105)
- **Code:** `destroy()` checks `if ( this._arrowTipRafId !== null )` but the
    property is never initialized in the constructor. Before the first arrow-tip
    drag, `this._arrowTipRafId` is `undefined`.
- **Impact:** The guard `undefined !== null` evaluates to `true`, causing
    `cancelAnimationFrame(undefined)` to be called on every `destroy()`
    invocation before any arrow drag. Unlike `_resizeRafId`, `_dragRafId`,
    and `_rotationRafId` which are correctly initialized to `null`.
- **Fix:** Add `this._arrowTipRafId = null;` to the constructor.

**P2-121 · `TransformController` Text-Drag State Variables Uninitialized**
- **File:** `resources/ext.layers.editor/canvas/TransformController.js` (constructor)
- **Missing init:** `isAngleDimensionTextDragging`, `isDimensionTextDragging`,
    `angleDimTextLayerId`, `dimensionTextLayerId`, `_pendingDragLayerId`
- **Impact:** These are first assigned at drag-start time. Code elsewhere
    guards on their truthiness. While `undefined` is falsy and works correctly
    for boolean guards today, it creates fragility: `destroy()` sets
    `_pendingDragLayerId = null` even though it was never declared, and the
    `_arrowTipRafId !== null` bug (P2-120) shows what happens when null-vs-
    undefined is confused in this same file.
- **Fix:** Initialize all five to their respective null/false defaults in
    the constructor.

---

### Low

#### PHP — 8 items

**P3-128 · `layeredFileRenderer.errorSpan` Echoes User-Supplied Filename**
- **File:** `src/Hooks/Processors/LayeredFileRenderer.php` L79
- **Code:** `return $this->errorSpan( 'File not found: ' . $filename );`
- **Note:** The `errorSpan()` method correctly calls `htmlspecialchars()`,
    so **there is no XSS risk**. However, the user-supplied filename is
    echoed into the rendered page output visible to other users.
- **Fix:** Use a generic i18n error message: `$this->msg( 'layers-file-not-found' )->text()`

**P3-129 · `EditLayersAction::requiresUnblock()` Returns `false`**
- **File:** `src/Action/EditLayersAction.php`
- **Impact:** Blocked users can load the full editor UI, including layer
    data fetched via `layersinfo`, before receiving a rejection only at save
    time. MediaWiki's "you are blocked" interstitial page is bypassed.
- **Fix:** Return `true` unless there is a documented reason why blocked users
    need editor access.

**P3-130 · `returnTo` Only Accepted for Existing Pages**
- **File:** `src/Action/EditLayersAction.php` L85–90
- **Code:** `if ( $returnTitle && $returnTitle->isKnown() ) {`
- **Impact:** If the editor is opened from a not-yet-saved page, the
    `returnTo` parameter is silently dropped and the user has no path back.
- **Fix:** Use `isValid()` plus a namespace allowlist instead of `isKnown()`.

**P3-131 · `TextSanitizer` Uses `strlen()` Not `mb_strlen()` for Length Check**
- **File:** `src/Validation/TextSanitizer.php`
- **Code:** `if ( strlen( $text ) > self::MAX_TEXT_LENGTH ) {`
- **Impact:** For CJK or emoji-heavy text, UTF-8 multi-byte characters
    count more than one byte each. A 400-character Japanese annotation
    uses ~1,200 bytes and may be incorrectly rejected.
- **Fix:** `if ( mb_strlen( $text, 'UTF-8' ) > self::MAX_TEXT_CHAR_LENGTH ) {`

**P3-132 · `ApiLayersList` Bypasses Shared `RateLimiter` Class**
- **File:** `src/Api/ApiLayersList.php`
- **Code:** Direct `$user->pingLimiter( 'editlayers-list' );` call instead
    of using `RateLimiter::checkRateLimit()`.
- **Impact:** Future rate-limiter enhancements (logging, overrides, metrics)
    won't apply to list requests. Inconsistency with every other API module.
- **Fix:** Use `RateLimiter::checkRateLimit()` via the shared trait.

**P3-133 · `LayersSchemaManager` Brittle Error Message String Parsing**
- **File:** `src/Database/LayersSchemaManager.php`
- **Code:** `preg_match( '/^Error (\d+):/', $message, $matches )`
- **Impact:** MySQL 5.x, MySQL 8.x, and MariaDB format error messages
    differently. Future DB versions could break duplicate-constraint
    detection, causing schema migration patches to be applied twice.
- **Fix:** Catch specific typed RDBMS exceptions rather than parsing
    error message strings. Use `IF NOT EXISTS` DDL where supported.

**P3-134 · Hardcoded English String `'Edit Layers'` in `Hooks.php`**
- **File:** `src/Hooks.php`
- **Code:** `$linkText = 'Edit Layers'; return "[$editUrl $linkText]";`
- **Impact:** Non-English wikis display an English link text.
    Contradicts the extension's own i18n system.
- **Fix:** `$linkText = wfMessage( 'layers-edit-link-text' )->text();`
    — add key to `i18n/en.json` and `i18n/qqq.json`.

**P3-135 · `ThumbnailProcessor` Dead Boolean Comparison on `?string` Type**
- **File:** `src/Hooks/Processors/ThumbnailProcessor.php` L110
- **Code:** `if ( $layersFlag === 'off' || ... || $layersFlag === false ) {`
- **Impact:** `$layersFlag` is `?string`; with `declare(strict_types=1)`,
    `$layersFlag === false` can never be true (string vs boolean). The
    boolean branch of the condition is unreachable dead code.
- **Fix:** Remove `|| $layersFlag === false` from the condition.

#### JavaScript — 3 items

**P3-136 · APIManager `mw.notify()` Called Without `typeof mw` Guard**
- **File:** `resources/ext.layers.editor/APIManager.js` L592
- **Code:** `mw.notify( this.getMessage( ... ), { type: 'success' } );`
- **Impact:** All other `mw.*` calls in the file are guarded. This bare
    call will throw `ReferenceError` in Jest tests or if the module loads
    before MediaWiki is initialized.
- **Fix:** Wrap with `if ( typeof mw !== 'undefined' ) { ... }`

**P3-137 · RevisionManager `namedSets.push()` Mutates StateManager Array Before `set()`**
- **File:** `resources/ext.layers.editor/editor/RevisionManager.js` L412–419
- **Code:**
    ```javascript
    const namedSets = this.stateManager.get( 'namedSets' ) || [];
    namedSets.push( { name: trimmedName, ... } );    // ← in-place mutation
    this.stateManager.set( 'namedSets', namedSets ); // same reference
    ```
- **Impact:** State subscribers using `(newValue, oldValue)` arguments to
    detect changes receive the same reference for both. Diff-based
    optimizations in `SetSelectorController` or `LayerPanel` may not
    detect the change. If an exception occurs between `push()` and `set()`,
    `state.namedSets` already contains the new item with no notification.
- **Fix:** `this.stateManager.set( 'namedSets', [ ...namedSets, { name: trimmedName, ... } ] );`

**P3-138 · Double `showSpinner` / Double `hideSpinner` on Every Save**
- **File:** `resources/ext.layers.editor/LayersEditor.js` +
    `resources/ext.layers.editor/APIManager.js`
- **Impact:** `LayersEditor.save()` calls `showSpinner()` then
    `this.apiManager.saveLayers()` which calls `showSpinner()` internally.
    On error, `performSaveWithRetry` calls `hideSpinner()` and
    `LayersEditor.save()`'s `.catch()` calls `hideSpinner()` a second time.
    Double-hide can leave spinner UI in an undefined state depending on
    whether the implementation counts references.
- **Fix:** Establish single ownership — either `LayersEditor.save()` or
    `saveLayers()` manages the spinner lifecycle, not both.

#### Canvas — 3 items

**P3-139 · CanvasManager `handleImageLoaded()` Renders Canvas Twice**
- **File:** `resources/ext.layers.editor/CanvasManager.js` L590–592
- **Code:**
    ```javascript
    this.redraw();                                    // Full render #1
    if ( this.editor && this.editor.layers ) {
        this.renderLayers( this.editor.layers );      // Full render #2 (same result)
    }
    ```
    `renderLayers` delegates to `redraw`, so two full canvas renders occur.
- **Impact:** Doubles the render cost at the most expensive moment
    (first image paint), causing unnecessary frame budget consumption
    on complex layer sets.
- **Fix:** Remove the first `this.redraw()` call entirely.

**P3-140 · CanvasManager Legacy `updateLayerPosition()` Is Dead/Incomplete Code**
- **File:** `resources/ext.layers.editor/CanvasManager.js`
- **Impact:** `CanvasManager.updateLayerPosition()` handles only 7 of
    ~15 layer types and is never called — `TransformController.handleDrag()`
    uses its own complete version. Being public on the facade object, it
    is a trap for future callers that would get silent no-ops for
    arrow/line/path/dimension/textbox/image/marker layers.
- **Fix:** Either delegate to `this.transformController.updateLayerPosition()`
    or delete the method.

**P3-141 · SelectionManager Fallback `getLayerAtPoint()` Iterates in Wrong Order**
- **File:** `resources/ext.layers.editor/SelectionManager.js` L783–800
- **Impact:** The fallback (used in tests or when `canvasManager` is
    unavailable) iterates `length - 1 → 0`, returning the bottom-most
    visual layer instead of the top-most. `CanvasRenderer` renders
    `length - 1 → 0` meaning index 0 is the topmost layer. `HitTestController`
    correctly iterates `0 → N` with an explanatory comment; this fallback
    does the opposite.
- **Fix:** Change the loop direction to `0 → N` with a matching comment.

---

### Documentation Issues (v49)

See [KNOWN_ISSUES.md docs section](#doc-issues) for full tracking. Summary:

| # | File | Issue |
|---|------|-------|
| D-049-01 | `README.md` | Coverage badge shows `95.19%` (correct: `92.19%`) |
| D-049-02 | `README.md` | Statistics table also shows `95.19%` |
| D-049-03 | `CHANGELOG.md [1.5.59]` | Technical Details: wrong coverage (`95.19%`), wrong test count (`11,258`), wrong god class count (`17`) |
| D-049-04 | `docs/ARCHITECTURE.md` | God class table: 13 JS hand-written listed, 19 exist (6 missing entirely: TransformController, ResizeCalculator, AngleDimensionRenderer, DrawingController, CanvasEvents, CalloutRenderer) |
| D-049-05 | `docs/ARCHITECTURE.md` | Near-threshold table misclassifies 3 god-class files (TransformController, ResizeCalculator, CalloutRenderer) |
| D-049-06 | `docs/ARCHITECTURE.md` | Coverage note still states `95.19%` |
| D-049-07 | `LayersGuide.mediawiki` | Says `layerslink=` is "a deprecated feature" — directly contradicts README.md and WIKITEXT_USAGE.md which actively document it |
| D-049-08 | `docs/DEVELOPER_ONBOARDING.md` | TransformController listed as ~990 lines (it's ~1,149 — a god class) |
| D-049-09 | `docs/RELEASE_GUIDE.md` | Instructs "Use present tense ('Add' not 'Added')" but every CHANGELOG entry uses past tense |
| D-049-10 | `docs/DOCUMENTATION_UPDATE_GUIDE.md` | Internal contradiction: calls it "the '11 Files' rule" then references "12 files" in the Common Mistakes table |

---

## v49 Verified Non-Issues (False Positives Eliminated)

The following were reported by automated analysis during this v49 review
but verified as non-issues:

- **TextSanitizer `errorSpan` XSS:** `errorSpan()` at L269 calls
    `htmlspecialchars( $message )`. The HTML is properly escaped. Downgraded
    to LOW info-disclosure only.
- **Hooks.php `layerListParserFunction` wikitext injection:** SetNameSanitizer
    restricts names to `[a-zA-Z0-9\-_]` which cannot form valid wikitext
    syntax. Not currently exploitable. Retained as defense-in-depth note only.
- **RateLimiter `isComplexityAllowed` group children not counted:** Groups in
    this extension are always stored flat — group layers reference children by
    ID in a sibling `childIds` field; children are separate entries in the
    top-level `$layers` array. The child complexity IS counted via their own
    array entries. FALSE POSITIVE.
- **`parseMWTimestamp` BUG-5 (subagent misidentification):** The subagent
    described a separate fallback block. Actual code confirmed: the fallback
    at L1042–1047 IS the only non-delegate path and DOES use the local-timezone
    `new Date(year,month,day,...)` constructor. CONFIRMED as P2-111.
- **RevisionManager `loadLayerSetByName` success-case `currentSetName` mutation:**
    The code at L316 precedes the `await` at L319 — this order IS wrong. CONFIRMED as P2-112.

---

## Current Metrics (Verified March 10, 2026 — v50 audit)

| Metric | Verified Current Value |
|--------|------------------------|
| Extension version | 1.5.61 |
| MediaWiki requirement | >= 1.44.0 |
| PHP requirement | 8.1+ |
| JS source files (excluding `resources/dist`) | 143 |
| JS source lines (excluding `resources/dist`) | ~99,730 |
| PHP production files (`src/`) | 41 |
| PHP production lines (`src/`) | ~15,197 |
| Jest test suites | 168 |
| Jest tests | 11,445 |
| Statement coverage | 91.32% |
| Branch coverage | 81.69% |
| i18n keys (`en.json`, `qqq.json`) | 832 |
| Files > 1,000 lines | 23 total |

## God Class Status (23 files >= 1,000 lines — Verified March 9, 2026)

### Generated Data (Exempt — 2 files)

| File | Lines |
|------|-------|
| ShapeLibraryData.js | 11,293 |
| EmojiLibraryIndex.js | 3,055 |

### Hand-Written JavaScript (19 files)

| File | Lines | Change from v47 |
|------|-------|-----------------|
| LayerPanel.js | 2,165 | ↓30 |
| CanvasManager.js | 2,104 | — |
| Toolbar.js | 1,933 | ↑14 |
| InlineTextEditor.js | 1,848 | — |
| PropertyBuilders.js | 1,826 | — |
| LayersEditor.js | 1,803 | ↑13 |
| APIManager.js | 1,593 | — |
| SelectionManager.js | 1,419 | — |
| ViewerManager.js | 1,266 | ↓54 |
| CanvasRenderer.js | 1,256 | ↓158 |
| TransformController.js | 1,146 | — |
| ToolbarStyleControls.js | 1,139 | ↑66 |
| SlideController.js | 1,126 | ↓44 |
| TextBoxRenderer.js | 1,120 | — |
| ResizeCalculator.js | 1,070 | — |
| AngleDimensionRenderer.js | 1,067 | **NEW** |
| DrawingController.js | 1,053 | — |
| CanvasEvents.js | 1,033 | **NEW** |
| CalloutRenderer.js | 1,000 | **NEW** |

### PHP (2 files)

| File | Lines | Change from v47 |
|------|-------|-----------------|
| ServerSideLayerValidator.php | 1,431 | ↑6 |
| LayersDatabase.php | 1,370 | ↑1 |

### Near-Threshold (900–999 lines — 5 files)

| File | Lines |
|------|-------|
| LayerRenderer.js | 999 |
| PropertiesForm.js | 995 |
| GroupManager.js | 987 |
| LayersValidator.js | 956 |
| ArrowRenderer.js | 932 |

## Issue Summary (v50 — March 10, 2026)

| Category | Critical | High | Medium | Low | Notes |
|----------|----------|------|--------|-----|-------|
| PHP bugs | 0 | ~~1~~ 0 | ~~1~~ 0 | 0 | All fixed v1.5.61 |
| Canvas bugs | 0 | 0 | ~~1~~ 0 | 0 | All fixed v1.5.61 |
| Documentation | 0 | 0 | 0 | ~~4~~ 0 | All fixed v1.5.61 |
| **Total open** | **0** | **0** | **0** | **0** | **All 7 v50 items fixed in v1.5.61** |

## v49 Issue Summary (March 10, 2026 — superseded by v50)

| Category | Critical | High | Medium | Low | Notes |
|----------|----------|------|--------|-----|-------|
| PHP bugs | 0 | ~~3~~ 0 | ~~7~~ 0 | ~~8~~ 0 | All fixed v1.5.59/v1.5.60 |
| JS bugs | 0 | ~~5~~ 0 | ~~6~~ 0 | ~~3~~ 0 | All fixed v1.5.59/v1.5.60 |
| Canvas bugs | 0 | ~~3~~ 0 | ~~5~~ 0 | ~~3~~ 0 | All fixed v1.5.59/v1.5.60 |
| Documentation | 0 | 0 | ~~10~~ 0 | 0 | All fixed v1.5.60 |
| Code quality | 0 | 0 | 0 | ~~1~~ 0 | Fixed v1.5.60 |
| **Total open** | **0** | **0** | **0** | **0** | **All 54 items closed** |

## Overall Grade: A

The codebase has strong architecture, comprehensive test coverage (91.32%
statements, 11,445 tests in 168 suites), 100% ES6 class migration, and
no critical security vulnerabilities. All v49 bugs were confirmed fixed.
Security controls pass: CSRF protection, SQL injection prevention,
rate limiting, input validation/sanitization, and SVG sanitization.

The v50 review found 7 new items: 1 HIGH (UI authorization inconsistency
in SpecialSlides), 2 MEDIUM (smart guides path type incomplete, deprecated
DB API from P2-107 fix), and 4 LOW (documentation metrics). All 7 were
fixed in v1.5.61. Grade: **A**.

---

## v47 Findings (March 10, 2026)

### v47 Confirmed Open Findings

#### High

1. **EventManager nudge calls non-existent `snapshot()` on HistoryManager**
     - **File:** `resources/ext.layers.editor/EventManager.js` L210-211
     - **Verification:** `HistoryManager.js` has no `snapshot()` method —
         only `saveState()`, `getLayersSnapshot()`, and `batchStartSnapshot`.
         The `typeof` guard at L210 prevents a crash, but `snapshot()` is
         never a function, so the call is silently skipped every time.
     - **Impact:** Arrow-key nudge operations have **no undo/redo history**.
         Users cannot undo nudge movements. This was introduced when nudge
         was implemented (v42, HIGH-v42-2) — the feature works visually but
         the history recording was never functional.
     - **Recommended Fix:** Change `this.editor.historyManager.snapshot( 'nudge' )`
         to `this.editor.historyManager.saveState( 'nudge' )`.

2. **DraftManager silently loses image layer data on draft recovery**
     - **File:** `resources/ext.layers.editor/DraftManager.js` L193-199, L318-365
     - **Verification:** `saveDraft()` strips `src` from image layers >1KB
         and sets `_srcStripped = true` (L198). `recoverDraft()` at L318-365
         directly applies `draft.layers` to the editor without checking
         `_srcStripped` — confirmed by searching for `_srcStripped` in the
         entire file (only 1 occurrence, at L198).
     - **Impact:** When recovering from a draft, all image layers appear as
         broken/empty images with no user-visible warning. The image data is
         permanently lost from the draft. Users may not realize their images
         are gone until they try to save.
     - **Recommended Fix:** In `recoverDraft()`, check each layer for
         `_srcStripped === true` and either (a) warn the user that image
         layers could not be recovered, or (b) attempt to reload images
         from the last saved revision.

3. **~~Font names with spaces corrupted on save~~ (FIXED)**
     - **File:** `src/Validation/TextSanitizer.php`,
         `src/Validation/ServerSideLayerValidator.php`
     - **Verification:** `sanitizeIdentifier()` regex `/[^a-zA-Z0-9_.-]/`
         strips spaces from fontFamily values. "Times New Roman" becomes
         "TimesNewRoman", which browsers cannot match, falling back to
         Arial. Reproduced on MW 1.44 — fonts display correctly in editor
         but revert after save/reload round-trip.
     - **Impact:** All multi-word font names silently corrupted on every
         save. Affected both top-level and richText fontFamily properties.
     - **Fix applied:** Added `sanitizeFontFamily()` method allowing spaces.
         Updated `ServerSideLayerValidator` to use it for both top-level
         and richText fontFamily. PHPUnit test added with 10 assertions.
     - **Status:** Fixed (March 10, 2026)

### Medium

1. **LayersViewer blend mode + hidden background renders white rectangle**
     - **File:** `resources/ext.layers/LayersViewer.js` L450-464
     - **Verification:** When `backgroundVisible` is false and layers use
         blend modes, `drawBackgroundOnCanvas()` fills the canvas with
         `#ffffff` (for blend compositing) then `return`s immediately.
         The white fill is painted but the actual image is never drawn.
     - **Impact:** Viewers see a white rectangle beneath blend-mode layers
         instead of transparency or the underlying page content.
     - **Recommended Fix:** When background is hidden, either skip the
         white fill entirely (accepting that blend modes won't composite
         as expected), or use `clearRect` for transparent canvas.

2. **ApiLayersDelete does not handle 0-row delete (concurrent request race)**
     - **File:** `src/Api/ApiLayersDelete.php` L174
     - **Verification:** Code checks `$rowsDeleted === null` for error
         (L174) but treats `$rowsDeleted === 0` as success. If two
         concurrent delete requests race, the second gets 0 rows deleted
         but returns `success: 1, revisionsDeleted: 0`.
     - **Impact:** Misleading API response. The client believes the delete
         succeeded when the set was actually already deleted. Low severity
         in practice since the end state is correct (set is gone).
     - **Recommended Fix:** Add `$rowsDeleted === 0` check with a distinct
         warning or `'layers-already-deleted'` response.

3. **LayersDatabase pruneOldRevisions called outside transaction**
     - **File:** `src/Database/LayersDatabase.php` L227-232
     - **Verification:** `$dbw->endAtomic(__METHOD__)` at L227, then
         `$this->pruneOldRevisions(...)` at L232. If pruning fails (DB
         timeout, connection drop), the save is already committed and the
         revision count can exceed `$wgLayersMaxRevisionsPerSet`.
     - **Impact:** Revision count can grow unbounded if pruning
         consistently fails. Low probability but could cause gradual
         storage bloat.
     - **Recommended Fix:** Move `pruneOldRevisions()` inside the
         atomic section (before `endAtomic`), or add a separate cleanup
         job/maintenance script that enforces the limit.

4. ~~**Documentation metrics drift (extends P2-098)**~~ — ✅ Fixed (v49).
     - **i18n key count:** Verified 832 keys in both `en.json` and
         `qqq.json` (via Node.js JSON parse, excluding `@metadata`). Docs
         are correct at 832.
     - **`.github/copilot-instructions.md`:** Updated god class count to
         22 (2 generated, 18 JS, 2 PHP), line counts to ~99,730 JS /
         ~15,197 PHP.
     - **`CHANGELOG.md` v1.5.59 entry:** ✅ Fixed — Updated to "11,258 tests".
     - **`README.md`:** ✅ Fixed — Updated line counts, god class count,
         and ES6 class count.
     - All doc files now synchronized to verified March 9, 2026 metrics.

### Low

1. ~~**`npm run test:php` PHPCS errors**~~ — Fixed (P3-125).
     All 33 errors and 13 warnings resolved. PHPCS now clean.

2. ~~**Missing test coverage for 3 modules**~~ — Fixed (P3-127).
     - `LogSanitizer.js` — ✅ 26 tests added
     - `GroupHierarchyHelper.js` — ✅ 52 tests added
     - `ViewerIcons.js` — no test file (low — static data)

## Verified Non-Issues / Reclassifications (v47)

The following items were reported by subagent analysis but verified as
**not real issues** during manual inspection:

- **RateLimiter image dimension validation:** Fallback logic is correct;
    default dimensions are applied when values are missing.
- **TextSanitizer event handler regex vulnerability:** Text is rendered
    on canvas, never injected into HTML DOM. No XSS vector.
- **ThumbnailRenderer ltrim('@') ImageMagick injection:** `Shell::command()`
    escapes each argument. `ltrim('@')` is defense-in-depth, not the
    primary protection.
- **UIHooks htmlspecialchars without ENT_QUOTES:** All calls are in text
    content contexts, not attribute contexts.
- **SpecialEditSlide backgroundColor XSS:** Value is validated before use
    and `addJsConfigVars` JSON-encodes.
- **ApiLayersInfo null check on $file:** PHP short-circuit evaluation
    prevents the null dereference.
- **DeepClone circular reference bug:** Layer objects are JSON-serializable
    by design and never contain circular references.
- **DeepClone richText shallow clone:** `deepClone()` recurses into arrays
    and objects; richText IS deep-cloned.
- **GradientRenderer NaN offset:** `stop.offset || 0` converts NaN to 0
    via JavaScript falsy coercion.
- **InlineTextEditor selectionchange listener leak:** Listener is properly
    removed in `destroy()` and `finishEditing()`.
- **RichTextConverter innerHTML XSS:** Uses DOM-based `textContent` →
    `innerHTML` escaping (browser-native, safe).
- **HistoryManager batch mode race condition:** JavaScript is
    single-threaded; no race possible.
- **APIManager cache poisoning:** Data passes through normalization chain
    before use.
- **GroupManager folder validation missing:** "Already in folder" check
    exists at line 396.
- **EventManager direct mutation race condition:** Single-threaded JS;
    direct mutation is the established architectural pattern.

## Items Reclassified from improvement_plan.md

The following items still marked `Open` in `improvement_plan.md` have been
verified as false positives or already fixed:

- **15.17 (StyleController triple-apply, P3-081):** VERIFIED FALSE — properties
    are applied exactly once; the `Object.keys` loop IS the application, the
    preceding individual checks are early-return guards for specific defaults.
- **15.19 (SelectionManager boolean handling, P3-083):** VERIFIED FALSE — both
    `selectAll()` and `selectLayer()` handle integer 0 consistently via the
    `visible !== false && visible !== 0` pattern.
- **15.23 (RenderCoordinator hash gaps, P3-087):** Already fixed per P3-109
    in KNOWN_ISSUES (Fixed v45.8).
- **15.25 (Duplicated SVG icon code, P3-089):** Already fixed per P3-107
    in KNOWN_ISSUES (Fixed v45.9).

## Fixed In v46 Round (March 9, 2026)

- `src/ThumbnailRenderer.php` now renders polygon and star shadows in
    server thumbnails, matching the editor/viewer path.
- `resources/ext.layers.shared/CustomShapeRenderer.js` now sizes the
    spread-shadow temp canvas from the actual draw bounds instead of using
    the previous large fixed offset allocation.
- `docs/RELEASE_GUIDE.md` now uses the current `main` branch template
    requirements: MediaWiki 1.44+ and PHP 8.1+.
- `composer.json` and `package.json` now run `parallel-lint` with
    deprecation notices suppressed, eliminating the PHP 8.4 vendor warning
    from the contributor test path.
- `tests/phpunit/unit/ThumbnailRendererTest.php` was made self-contained
    for the standalone extension PHPUnit bootstrap used in this repo, and
    now covers polygon/star shadow generation.

## v47 Metrics (March 10, 2026 — superseded by v48)

| Metric | v47 Value |
|--------|-----------|
| PHP production lines (`src/`) | ~15,161 |
| Files > 1,000 lines | 21 total |

## v47 Issue Summary (March 10, 2026 — superseded by v48)

| Category | Critical | High | Medium | Low | Notes |
|----------|----------|------|--------|-----|-------|
| Bugs | 0 | 2 (+1 fixed) | 3 | 0 | Nudge history, draft image loss, ~~font save~~, viewer blend, delete race, prune scope |
| **Total open** | **0** | **2** | **4** | **2** | **8 verified open items (1 fixed same session)** |

---

## Historical v45 Detail

---

## Confirmed False Positives (v24–v42)

| Report | Claimed Issue | Why It's False |
|--------|---------------|----------------|
| v43 | Double render on undo/redo (P2-074) | handleUndo/handleRedo delegate to editor.undo()/redo() only; code comments explicitly state renderLayers/markDirty are handled by restoreState() |
| v43 | ClipboardController applies paste offset to local coordinates (P2-079) | Code never applies PASTE_OFFSET to tailTipX/tailTipY; deliberate comment at L254–256 explains why |
| v43 | CSS font shorthand order wrong in InlineTextEditor (P2-082) | L809-813 IS in correct order: fontStyle then fontWeight then fontSize; v42 reviewer described it backwards |
| v43 | ToolManager IIFE load-time risk (P3-096) | extension.json script array lists ToolRegistry, ToolStyles, ShapeFactory, TextToolHandler, PathToolHandler all before ToolManager; execution order guaranteed |
| v42 | SmartGuidesController rightSnap guard no-op | While \|a-b\| === \|b-a\| makes the outer guard always true, the inner comparisons still produce correct snap behavior |
| v42 | DrawingController ellipse finalization uses stale center | Preview and finalize produce identical math results; fragile but correct |
| v42 | $fileName undefined in catch block | Actually uses `$requestedFilename` which IS defined; checked ApiLayersSave L382 |
| v42 | BoundsCalculator misidentifies layer type | getRectangularBounds checks for width/height, ellipses don't have these; types don't collide |
| v42 | ContextMenuController hover listener leak | Menu DOM is recreated each show, old DOM gets GC'd with listeners |
| v42 | ImportExportManager prototype pollution | `JSON.parse` produces plain objects; `__proto__` on parsed object is an own property that doesn't affect prototype chain |
| v41 | isComplexityAllowed() broken | LayersMaxComplexity IS registered in extension.json |
| v41 | Viewport culling wrong property names | getLayerBounds returns {left, top, right, bottom} correctly |
| v39 | ClipboardController paste() saveState before mutation breaks undo | saveState() BEFORE mutation is the correct undo pattern |
| v39 | htmlToRichText innerHTML XSS risk | Detached element (never in DOM); source is user's own contentEditable content |
| v39 | document.execCommand deprecation risk | Only practical way for contentEditable; all browsers support it |
| v39 | HistoryManager getMemoryUsage() performance hazard | Only called on-demand/debug |
| v38 | innerHTML for SVG icons is XSS | Hardcoded trusted strings, not user data |
| v38 | StateManager.saveToHistory() dead code | Intentionally disabled for consistency |
| v37 | ColorPickerDialog JSON.parse missing try-catch | getSavedColors() HAS try-catch |
| v37 | PresetStorage JSON.parse missing try-catch | load() HAS try-catch |
| v37 | RichTextConverter innerHTML XSS risk | escapeHtml() used; styles are CSS-only |
| v36 | DraftManager missing QuotaExceededError catch | saveDraft() wrapped in try/catch |
| v35 | isLayerInViewport uses wrong property names | getLayerBounds returns correct props |
| v35 | HistoryManager shallow snapshot | Uses DeepClone.cloneLayersEfficient() |
| v35 | ApiLayersSave rate limit after validation | Intentional — invalid data shouldn't consume tokens |
| v33 | NamespaceHelper null caching prevents late-load | Intentional: Map.has() for cached null |
| v33 | EditLayersAction getImageBaseUrl() unused | Called at L164 |
| v33 | Map mutation during iteration | ES6 permits deletion during Map.keys() |
| v29 | AlignmentController missing dimension/marker | Partially valid — default x/y case works for basic positioning but misses endpoint/arrow coords; RECLASSIFIED as real issue MED-v42-5 |
| v28 | PolygonStarRenderer missing from setContext() | ShapeRenderer cascades to it |
| v28 | Non-atomic batch deletion N undo entries | StateManager.saveToHistory() is a no-op |
| v28 | ThumbnailRenderer font not re-validated | sanitizeIdentifier() strips at save |
| v28 | WikitextHooks static state fragile | resetPageLayersFlag() called per page |
| v28 | CSP uses raw header() | Prefers addExtraHeader(); raw is guarded |
| v28 | ShapeRenderer.drawRectangle missing scaling | CSS transform handles scaling |
| v27 | IM color injection via ThumbnailRenderer | Shell::command escapes each arg |
| v27 | CSP header injection | $fileUrl from File::getUrl() |
| v27 | Retry on all errors in DB save | Only isDuplicateKeyError() retried |
| v27 | isLayerEffectivelyLocked stale layers | Getter delegates to StateManager |
| v27 | StateManager.set() locking inconsistency | Correct lock pattern |
| v24 | TypeScript compilation failure | Pure JS project |
| v24 | Event Binding Loss | Verified working correctly |

---

## NEW Issues — v42

### CRITICAL (New in v42)

#### ~~CRITICAL-v42-1: CacheInvalidationTrait.php Missing — All Write APIs Broken~~ ✅ FALSE POSITIVE

**Status:** ✅ FALSE POSITIVE (Trait exists on disk)
**Severity:** CRITICAL (Show-stopping — PHP fatal error)
**Files:** src/Api/ApiLayersSave.php L9+L67, src/Api/ApiLayersDelete.php L8+L40, src/Api/ApiLayersRename.php L8+L41, src/Api/Traits/CacheInvalidationTrait.php

**Issue:** Previous review incorrectly claimed that `src/Api/Traits/CacheInvalidationTrait.php` was missing. The file exists and is intact.

**Resolution:** ✅ FALSE POSITIVE — Verified that `src/Api/Traits/CacheInvalidationTrait.php` exists and is 2088 bytes.

---

### HIGH (New in v42)

#### ~~HIGH-v42-1: ApiLayersInfo Null Dereference on Line 280~~ ✅ RESOLVED

**Status:** ✅ RESOLVED
**Severity:** HIGH (Bug — PHP warning/TypeError)
**File:** src/Api/ApiLayersInfo.php L280

**Issue:** When no layers exist for an image (`$layerSet` is null from line 252 branch), the code at line 280 attempts `$layerSet['name']` on a null value. In PHP 8+, accessing an array index on null triggers a TypeError.

```php
// Line 249: sets $result with layerset => null when !$layerSet
if ( !$layerSet ) {
    $result = [ 'layerset' => null, 'message' => ... ];
} else {
    $result = ['layerset' => $layerSet];
}

// Line 280: BUG — $layerSet may be null here
$currentSetName = $layerSet['name'] ?? $layerSet['setName'] ?? null;
```

**Recommended Fix:** Wrap the revision-fetching block (lines 280-310) in `if ( $layerSet ) { ... }`.

**Resolution:** ✅ FIXED — Restructured the code so that when `$layerSet` is null, the code uses a general revision fetch, and when `$layerSet` exists, it accesses `$layerSet['name']` safely inside the else block.

---

#### ~~HIGH-v42-2: Arrow Keys Always Pan, Never Nudge Selected Layers~~ ✅ RESOLVED

**Status:** ✅ RESOLVED
**Severity:** HIGH (Broken feature — expected UX missing)
**File:** resources/ext.layers.editor/EventManager.js

**Issue:** Arrow keys unconditionally pan the canvas. There is no check for whether layers are selected, and EventManager has no nudge handler. Every drawing/annotation tool (Figma, Photoshop, Illustrator, etc.) uses arrow keys to nudge selected objects by 1px (or 10px with Shift). The current behavior makes precise keyboard positioning impossible.

**Resolution:** ✅ FIXED — Implemented `handleArrowKeyNudge()` and `nudgeSelectedLayers()` methods in EventManager.js:
- Arrow keys (← → ↑ ↓) nudge selected layers by 1px
- Shift + Arrow keys nudge by 10px
- Locked layers are protected from nudging
- Proper history snapshots recorded for undo/redo
- Status bar updates for single layer selections
- 17 new tests added to EventManager.test.js

---

#### HIGH-v42-3: Color Preview Mutates Layers Without StateManager

**Status:** Open
**Severity:** HIGH (Bug — breaks undo/redo)
**File:** resources/ext.layers.editor/ToolbarStyleControls.js L522-563

**Issue:** `applyColorPreview()` directly writes to layer objects (`layer.fill = color`, `layer.stroke = color`) without going through StateManager. This means:
- Changes are not tracked by HistoryManager (no undo/redo)
- If the user cancels the color picker, the layer retains the preview color with no rollback mechanism
- StateManager subscribers are not notified

Similar issues exist in `FolderOperationsController.toggleLayerVisibility` and `StyleController.applyToLayer`.

**Recommended Fix:** Store original colors before preview, restore on cancel, commit via StateManager on confirm.

---

#### ~~HIGH-v42-4: ThumbnailRenderer Font Name Not Validated Against Whitelist~~ ✅ RESOLVED

**Status:** ✅ RESOLVED
**Severity:** HIGH (Security — defense-in-depth gap)
**File:** src/ThumbnailRenderer.php (buildTextArguments, buildTextBoxArguments)

**Issue:** Font names from layer data are passed directly to ImageMagick's `-font` flag. While `sanitizeIdentifier()` strips to `[a-zA-Z0-9_.-]` at save time, ThumbnailRenderer performs no secondary validation against the configured `$wgLayersDefaultFonts` whitelist. If data bypasses the validator (e.g., direct DB manipulation, or a bug in sanitization), an arbitrary font path could reach ImageMagick.

**Recommended Fix:** Validate `$layer['fontFamily']` against the configured fonts whitelist in ThumbnailRenderer before passing to ImageMagick. Fall back to 'DejaVu-Sans' if not in whitelist.

**Resolution:** ✅ FIXED — Added validation against `$wgLayersDefaultFonts` in `ThumbnailRenderer.php`.

---

### MEDIUM (New in v42)

#### MED-v42-1: Double Render on Every Undo/Redo Operation

**Status:** ✅ RESOLVED
**Severity:** MEDIUM (Performance bug)
**Files:** resources/ext.layers.editor/EventManager.js L140-165, resources/ext.layers.editor/HistoryManager.js L307-322

**Issue:** `EventManager.handleUndo()` and `handleRedo()` called `editor.renderLayers()` and `editor.markDirty()` after undo/redo succeeds. But `HistoryManager.restoreState()` (called by `editor.undo()`) already calls `canvasMgr.renderLayers(restored)` (line 309) and `editor.markDirty()` (line 322). Every undo/redo triggered two full canvas renders and two dirty marks.

**Resolution:** Removed redundant `renderLayers()` and `markDirty()` calls from EventManager's `handleUndo()` and `handleRedo()`. The methods now just call `editor.undo()` and `editor.redo()` respectively, letting HistoryManager.restoreState() handle rendering. Updated 6 related tests to verify the new behavior.

---

#### MED-v42-2: CustomShapeRenderer Spread Shadow Ignores Rotation/Scale

**Status:** Open
**Severity:** MEDIUM (Rendering bug)
**File:** resources/ext.layers.shared/CustomShapeRenderer.js

**Issue:** `drawSpreadShadowForImage()` only copies translation (e, f) from the transform matrix, discarding rotation and scale:

```javascript
if ( currentTransform ) {
    tempCtx.setTransform( 1, 0, 0, 1, currentTransform.e, currentTransform.f );
}
```

ShadowRenderer was fixed to properly decompose transforms, but this fix was never ported to CustomShapeRenderer.

**Recommended Fix:** Use the same rotation decomposition approach as ShadowRenderer.drawSpreadShadow, or delegate to ShadowRenderer directly.

---

#### ~~MED-v42-3: ThumbnailRenderer TextBox Stroke Bleeds Into Text~~ ✅ RESOLVED

**Status:** ✅ RESOLVED (Fixed March 4, 2026 — P2-076)
**Severity:** MEDIUM (Rendering bug — server-side)
**File:** src/ThumbnailRenderer.php (buildTextBoxArguments)

**Issue:** After drawing the rectangle with `-stroke` and `-strokewidth`, the text annotate inherits these settings. Text renders with the rectangle's stroke color/width applied as an outline.

**Recommended Fix:** Insert `'-stroke', 'none', '-strokewidth', '0'` before the text `-annotate` arguments.

---

#### ~~MED-v42-4: ThumbnailRenderer Missing Ellipse Shadow Support~~ ✅ RESOLVED

**Status:** ✅ RESOLVED (Fixed March 4, 2026 — P2-077)
**Severity:** MEDIUM (Rendering inconsistency — server-side)
**File:** src/ThumbnailRenderer.php (buildEllipseArguments)

**Issue:** `buildEllipseArguments()` is the only shape handler that doesn't implement shadow rendering. All others (rectangle, circle, text, textbox, polygon, star) support shadows.

**Recommended Fix:** Add the standard shadow pattern from `buildCircleArguments()`.

---

#### ~~MED-v42-5: AlignmentController Missing Dimension/Marker Types~~ ✅ RESOLVED

**Status:** ✅ RESOLVED (Fixed March 4, 2026 — P2-078)
**Severity:** MEDIUM (Bug — alignment broken for 2 layer types)
**File:** resources/ext.layers.editor/canvas/AlignmentController.js

**Issue:** `moveLayer()` has no case for `dimension` layers (which use x1/y1/x2/y2 endpoints) or marker layers with arrows (arrowX/arrowY). Dimension layers fall through to the default case which moves `layer.x` — but dimensions don't use x/y for positioning. When aligning dimension layers, endpoints don't move correctly.

Similarly, `getLayerBounds()` has no case for dimension layers, producing incorrect bounds for alignment calculations.

Note: This was previously dismissed as a false positive in v29 ("Default case sets x/y which both use"). However, dimension layers use x1/y1/x2/y2 for their endpoints, NOT x/y. The v29 dismissal was incorrect. Reclassified as a real issue.

**Recommended Fix:** Add dimension case: move x1/y1 and x2/y2 by delta. Add marker arrow case: also move arrowX/arrowY.

---

#### MED-v42-6: ClipboardController Paste Offset on Local Coordinates

**Status:** ✅ FALSE POSITIVE (Code was already correct)
**Severity:** MEDIUM (Bug — pasted callouts have displaced tails)
**File:** resources/ext.layers.editor/canvas/ClipboardController.js L253-257

**Claimed Issue:** `applyPasteOffset()` allegedly added `PASTE_OFFSET` (20px) to `tailTipX` and `tailTipY`, displacing the tail by 20px relative to the callout body.

**v43 Verification:** The code at L254-256 explicitly does NOT apply PASTE_OFFSET to tailTipX/tailTipY, with a deliberate comment: "tailTipX/tailTipY are LOCAL coordinates relative to callout center. They move with the callout when layer.x/y change, so we should NOT offset them." The v42 reviewer incorrectly described code behavior that did not exist in the source.

---

#### MED-v42-7: parseMWTimestamp Uses Local Time Instead of UTC

**Status:** ✅ RESOLVED
**Severity:** MEDIUM (Bug — timestamps display wrong for non-UTC users)
**File:** resources/ext.layers.editor/LayerSetManager.js L119-138

**Issue:** MediaWiki timestamps are UTC, but `new Date(year, month, day, hour, minute, second)` created a local-time Date object. Revision timestamps displayed offset by the user's timezone from the correct time.

**Resolution:** Changed to `new Date(Date.UTC(year, month, day, hour, minute, second))` so timestamps are correctly interpreted as UTC. Updated tests to use `getUTC*()` methods to verify behavior.

---

#### MED-v42-8: CalloutRenderer Blur Bounds Ignore Dragged Tail

**Status:** Open
**Severity:** MEDIUM (Rendering bug)
**File:** resources/ext.layers.shared/CalloutRenderer.js

**Issue:** When a callout has `fill='blur'` and uses a draggable tail, the blur capture bounds use the `tailDirection` property rather than the actual `tailTipX`/`tailTipY` position. The blur effect gets clipped when the tail is dragged to a different side than tailDirection indicates.

**Recommended Fix:** When tailTipX/tailTipY are set, compute bounds from actual tip coordinates.

---

#### MED-v42-9: CSS Font Shorthand Order Wrong in InlineTextEditor

**Status:** ✅ FALSE POSITIVE (Code was already correct)
**Severity:** MEDIUM (Bug — text measurement may be inaccurate)
**File:** resources/ext.layers.editor/canvas/InlineTextEditor.js L809-813

**Claimed Issue:** Canvas font string was allegedly constructed with fontWeight before fontStyle, violating CSS spec.

**v43 Verification:** The code at L809-813 IS in the correct CSS order:
```javascript
ctx.font = ( layer.fontStyle || 'normal' ) + ' ' + ( layer.fontWeight || 'normal' ) + ' ' + ...
```
fontStyle appears before fontWeight, which is precisely what CSS spec requires. The v42 reviewer described the order backwards.

---

#### MED-v42-10: Hardcoded English in ToolbarKeyboard.js

**Status:** ✅ RESOLVED
**Severity:** MEDIUM (i18n violation)
**File:** resources/ext.layers.editor/ToolbarKeyboard.js

**Issue:** User-visible strings "Layers grouped", "Layers ungrouped", "Smart Guides: On", "Smart Guides: Off" were hardcoded English instead of `mw.message()` calls.

**Resolution:** Added 4 new i18n messages (layers-group-success, layers-ungroup-success, layers-smart-guides-on, layers-smart-guides-off) and updated ToolbarKeyboard.js to use mw.message() with English fallbacks for non-MediaWiki environments.

---

### LOW (New in v42)

#### LOW-v42-1: ~140 Lines Dead Layer Cache Code in CanvasRenderer

**Status:** Open
**Severity:** LOW (Dead code)
**File:** resources/ext.layers.editor/CanvasRenderer.js

**Issue:** `layerCache`, `_getCachedLayer`, `_setCachedLayer`, `invalidateLayerCache`, `layerCacheMaxSize`, `layerCacheEnabled` are defined but never called from the rendering pipeline.

---

#### LOW-v42-2: StyleController.updateStyleOptions Triple-Applies Properties

**Status:** Open
**Severity:** LOW (Redundant code)
**File:** resources/ext.layers.editor/StyleController.js L85-144

**Issue:** First checks individual properties (lines 95-120), then Object.keys forEach overwrites ALL (line 123), then checks shadow properties again (lines 131-143). Three redundant passes.

---

#### LOW-v42-3: Duplicate sanitizeLogMessage in 3 Files

**Status:** Open
**Severity:** LOW (Code duplication)
**Files:** LayersEditor.js, APIErrorHandler.js, ValidationManager.js

**Recommended Fix:** Extract to a shared utility module.

---

#### LOW-v42-4: SelectionManager Boolean Handling Inconsistency

**Status:** Open
**Severity:** LOW (Potential bug)
**File:** resources/ext.layers.editor/SelectionManager.js

**Issue:** `selectAll()` correctly handles API boolean serialization (`visible !== false && visible !== 0`), but the `selectLayer()` fallback path only checks `layer.locked !== true && layer.visible !== false`, missing the integer 0 and 1 cases.

---

#### LOW-v42-5: DimensionRenderer createDimensionLayer Uses || for Falsy Defaults

**Status:** ✅ RESOLVED
**Severity:** LOW (Bug for edge cases)
**File:** resources/ext.layers.shared/DimensionRenderer.js

**Issue:** Properties like `extensionGap` use `||` which rejects legitimate `0` values. The same file uses `!== undefined` correctly for `precision` and `toleranceValue`, showing the inconsistency.

**Resolution:** Changed 7 numeric properties in `_createFromOptions()` from `||` to `!== undefined ? options.prop : DEFAULTS.prop`.

---

#### LOW-v42-6: CustomShapeRenderer Opacity Not Clamped

**Status:** ✅ RESOLVED
**Severity:** LOW (Inconsistency)
**File:** resources/ext.layers.shared/CustomShapeRenderer.js

**Issue:** `getOpacity()` returns `specific * overall` without clamping. All other renderers use `clampOpacity()` from MathUtils.

**Resolution:** Added `Math.max( 0, Math.min( 1, ... ) )` clamping to `getOpacity()` return value.

---

#### LOW-v42-7: ExportController Blob URL Leak on Error

**Status:** ✅ RESOLVED
**Severity:** LOW (Resource leak)
**File:** resources/ext.layers.editor/ExportController.js

**Issue:** If `document.body.removeChild(a)` throws, `URL.revokeObjectURL(url)` is skipped. Should use try/finally.

**Resolution:** Wrapped download link creation/click/removal in `try/finally` to ensure `URL.revokeObjectURL(url)` always executes.

---

#### LOW-v42-8: RenderCoordinator Hash Misses Visual Properties

**Status:** Open
**Severity:** LOW (Optimization bug — missed redraws)
**File:** resources/ext.layers.editor/canvas/RenderCoordinator.js

**Issue:** Layer hash misses radiusX/Y, controlX/Y, tailTipX/Y, cornerRadius, lineHeight, color, arrowhead/style/size, gradient stop changes, and shadow offset/spread properties.

---

#### LOW-v42-9: Escape Closes Modal Without Unsaved Changes Check

**Status:** Open
**Severity:** LOW (UX issue)
**File:** resources/ext.layers.modal/LayersEditorModal.js

**Issue:** Pressing Escape immediately closes the modal iframe without checking for unsaved changes via the postMessage channel.

---

#### LOW-v42-10: Duplicated SVG Icon Code

**Status:** Open
**Severity:** LOW (Code duplication)
**Files:** ViewerManager.js, SlideController.js

**Issue:** Both contain identical `_createPencilIcon()` and `_createExpandIcon()` SVG generation methods. Should use the existing IconFactory.js.

---

#### LOW-v42-11: Dead Code renderCodeSnippet with Embedded XSS

**Status:** Open
**Severity:** LOW (Dead code + latent security)
**File:** resources/ext.layers.editor/LayerPanel.js L2161

**Issue:** `renderCodeSnippet()` is never called (zero call sites) but contains unescaped `filename` interpolated into raw HTML. Should be removed or fixed before any caller is added.

---

#### LOW-v42-12: RichTextToolbar Potential Drag Listener Leak

**Status:** Open
**Severity:** LOW (Resource leak)
**File:** resources/ext.layers.editor/canvas/RichTextToolbar.js

**Issue:** Document-level mousemove/mouseup handlers added during drag are not cleaned up in destroy() if destroyed mid-drag.

---

#### LOW-v42-13: Touch Events Missing Key Modifier Properties

**Status:** Open
**Severity:** LOW (Functionality gap)
**File:** resources/ext.layers.editor/CanvasEvents.js L600-614

**Issue:** Synthetic mouse events from touch lack ctrlKey, metaKey, shiftKey, and target. Multi-select via touch impossible.

---

#### LOW-v42-14: SlideController.refreshAllSlides No Concurrency Limit

**Status:** Open
**Severity:** LOW (Performance/server load)
**File:** resources/ext.layers.slides/SlideController.js

**Issue:** Uses bare Promise.all() without concurrency limiting. ViewerManager has a proper `_processWithConcurrency()` (5 parallel).

---

#### LOW-v42-15: CustomShapeRenderer Creates Oversized Temp Canvas Each Call

**Status:** Open
**Severity:** LOW (Performance — GC pressure)
**File:** resources/ext.layers.shared/CustomShapeRenderer.js

**Issue:** Creates a new canvas 5000+ pixels wider than needed per call, with no reuse or size limit. ShadowRenderer has both.

---

#### LOW-v42-16: Unguarded mw.log.warn in CanvasRenderer

**Status:** Open
**Severity:** LOW (Test environment crash)
**File:** resources/ext.layers.editor/CanvasRenderer.js

**Issue:** Uses `mw.log.warn(...)` without `typeof mw !== 'undefined'` guard. Throws ReferenceError in Jest test environment.

---

#### LOW-v42-17: ToolManager Resolves Module References at IIFE Load Time

**Status:** ✅ FALSE POSITIVE (Load order is guaranteed by extension.json)
**Severity:** LOW (Fragile loading)
**File:** resources/ext.layers.editor/ToolManager.js

**Claimed Issue:** `const ToolRegistry = window.ToolRegistry` etc. allegedly resolved at IIFE execution time, risking undefined references if dependencies load late.

**v43 Verification:** `extension.json` lines 345-350 list scripts in this exact order within the same ResourceLoader module: ToolRegistry → ToolStyles → ShapeFactory → TextToolHandler → PathToolHandler → **ToolManager**. ResourceLoader concatenates files in array order, guaranteeing all dependencies execute before ToolManager. No lazy resolution is needed.

---

---

## NEW Issues — v43

### MEDIUM (New in v43)

#### ~~MED-v43-1: Nudge Broken for Dimension, Line, and Arrow Layers~~ ✅ RESOLVED

**Status:** ✅ RESOLVED (Fixed March 4, 2026 — P2-084)
**Severity:** MEDIUM (Broken feature — arrow-key nudge silently fails for 3 layer types)
**File:** resources/ext.layers.editor/EventManager.js L193-199

**Issue:** `nudgeSelectedLayers()` only updates `layer.x` and `layer.y`. Dimension, plain line, and arrow layers are positioned via `x1/y1/x2/y2` endpoint coordinates (not `x/y`). When a user selects these types and presses an arrow key, the `layer.x`/`layer.y` properties receive the nudge delta, but visual position does not change — those properties are ignored by the renderer for these types.

```javascript
// EventManager.js L193-199 — only updates x/y
layer.x = ( layer.x || 0 ) + deltaX;
layer.y = ( layer.y || 0 ) + deltaY;
```

**Recommended Fix:**
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

---

### LOW (New in v43)

#### LOW-v43-1: Stale Test Count in Documentation

**Status:** ✅ Fixed (March 4, 2026)
**Severity:** LOW (Documentation inaccuracy)
**Files:** README.md, wiki/Home.md, codebase_review.md, .github/copilot-instructions.md, CHANGELOG.md

**Issue:** Multiple documents cited "11,148 tests in 162 suites" (from February 15, 2026 docs). Updated to **11,258 tests in 163 suites** (verified March 9, 2026).

---

#### LOW-v43-2: CHANGELOG Missing Versions and Date Anomaly

**Status:** Open
**Severity:** LOW (Documentation gap)
**File:** CHANGELOG.md

**Issue:** Three version entries are missing from CHANGELOG.md: 1.5.37, 1.5.53, and 1.5.54 have no entries despite being referenced in commit history. Additionally, the v1.5.55 entry is dated 2025-07-23, which is chronologically out of order among entries from 2026 (the dates above and below it are in January 2026). This likely indicates a copy-paste date error.

---

---

## NEW Issues — v45 (Fresh Audit — March 4, 2026)

### CRITICAL (New in v45)

#### ~~CRITICAL-v45-1: Clickjacking Bypass via `?modal=1` — No Origin Validation~~ ✅ RESOLVED

**Status:** ✅ Fixed (v45 fixes batch)
**Severity:** CRITICAL (Security — iframe clickjacking)
**Files:** src/Action/EditLayersAction.php L105-117, src/SpecialPages/SpecialEditSlide.php L91-102

**Issue:** When `?modal=1` is passed as a query parameter, clickjacking protection (X-Frame-Options) was completely removed with no origin validation.

**Resolution:** Both files now suppress MediaWiki's default DENY header and explicitly set `X-Frame-Options: SAMEORIGIN`, allowing same-origin framing (for the modal editor) while blocking cross-origin embedding. The fix uses `header_remove('X-Frame-Options')` followed by `header('X-Frame-Options: SAMEORIGIN')` to ensure only SAMEORIGIN is sent.

---

### HIGH (New in v45)

#### ~~HIGH-v45-1: Manual HTML Construction Bypasses MediaWiki Html Class~~ ✅ RESOLVED (LayeredThumbnail.php)

**Status:** ✅ Partially Fixed (v45 fixes batch) — LayeredThumbnail.php fixed; UIHooks.php still open
**Severity:** MEDIUM (reclassified — original `htmlspecialchars(ENT_QUOTES)` escaping was correct; this is code quality, not security)
**Files:** ~~src/LayeredThumbnail.php L103-117~~, src/Hooks/UIHooks.php L324-397

**Issue:** LayeredThumbnail.php built `<img>` tags via raw string concatenation with `htmlspecialchars()` instead of MediaWiki's `Html::element()`.

**Resolution (LayeredThumbnail.php):** Refactored to use `Html::element('img', $attribs)` and `Html::rawElement('div', [...], $html)` with proper `use MediaWiki\Html\Html` import. UIHooks.php still uses manual HTML construction — lower priority since escaping is correct.

---

#### ~~HIGH-v45-2: InlineTextEditor innerHTML Trusts External richText Data~~ ✅ FALSE POSITIVE

**Status:** ✅ False Positive (verified v45 fixes batch)
**Severity:** Was HIGH — reclassified to LOW (informational)
**File:** resources/ext.layers.editor/canvas/InlineTextEditor.js L548, resources/ext.layers.editor/canvas/RichTextConverter.js

**Original Concern:** `contentWrapper.innerHTML = RichTextConverter.richTextToHtml(layer.richText)` trusts external data.

**Why It's a False Positive:** Verified that `RichTextConverter.richTextToHtml()` correctly sanitizes all inputs:
1. `escapeHtml()` uses DOM-based escaping: `div.textContent = text; return div.innerHTML` — this is the gold-standard browser-native approach, not regex-based.
2. `escapeCSSValue()` strips all dangerous characters `["'<>&;{}\\]` from CSS property values.
3. Only whitelisted CSS properties are applied (fontWeight, fontStyle, fontSize, fontFamily, color, textDecoration, backgroundColor, textStrokeColor, textStrokeWidth).
4. Text content is always set via `textContent` (not innerHTML) before being read back as escaped HTML.

The defense-in-depth recommendation to use programmatic DOM construction remains valid as an aspirational improvement but is not a security issue.

---

#### ~~HIGH-v45-3: Nudge and Selection Operations Bypass StateManager~~ ✅ FALSE POSITIVE

**Status:** ✅ False Positive (verified v45 fixes batch)
**Severity:** Was HIGH — reclassified as NOT A BUG
**Files:** resources/ext.layers.editor/EventManager.js L196-206, resources/ext.layers.editor/canvas/TransformController.js L556-562

**Original Concern:** Nudge and selection operations directly mutate layer objects without notifying StateManager.

**Why It's a False Positive:** Verified that **direct layer mutation is the established and correct pattern** throughout the entire codebase. `TransformController.updateLayerPosition()` at L556-562 uses the identical pattern: `layer.x = originalState.x + deltaX`. All mutation paths follow the same contract:
1. Mutate layer properties directly
2. Call `historyManager.snapshot()` to record the change
3. Call `markDirty()` / `renderLayers()` to trigger UI updates

StateManager is used for editor-level state (tool selection, zoom, etc.), NOT for layer data mutations. DraftManager detects changes via `markDirty()` callbacks, not StateManager subscriptions. This is a deliberate architectural decision, not a bug.

---

#### ~~HIGH-v45-4: LayerPanel editLayerName Stale originalName~~ ✅ RESOLVED

**Status:** ✅ Fixed (v45 fixes batch)
**Severity:** HIGH (Bug — spurious undo entries, missed reverts)
**File:** resources/ext.layers.editor/LayerPanel.js L1922-1931

**Issue:** `_hasEditListeners` guard caused early return on subsequent edits, so `dataset.originalName` was never refreshed.

**Resolution:** Added `nameElement.dataset.originalName = nameElement.textContent` inside the `_hasEditListeners` early-return branch, ensuring subsequent edits always start with the current name as the revert target. Regression test added in LayerPanel.test.js.

---

### MEDIUM (New in v45)

#### MED-v45-1: SVG Data URI Not Blocked in Client Validator

**Status:** Open
**Severity:** MEDIUM (Security — defense-in-depth)
**File:** resources/ext.layers.editor/ValidationManager.js L91

**Issue:** Dangerous URI regex only blocked `data:text/html`. A `data:image/svg+xml,<svg onload="alert(1)">` passed validation.

**Resolution:** ✅ Fixed — Updated `DANGEROUS_URL_RE` to block all `data:` URIs except safe image types (`data:image/(png|jpeg|gif|webp)`). Regression tests added in ValidationManager.test.js.

---

#### ~~MED-v45-2: Failed Images Persist in ImageLayerRenderer LRU Cache~~ ✅ RESOLVED

**Status:** ✅ Fixed (v45 fixes batch)
**Severity:** MEDIUM (Bug — permanent cache pollution)
**File:** resources/ext.layers.shared/ImageLayerRenderer.js L221-225

**Issue:** `img.onerror` logged a warning but did not remove the cache entry.

**Resolution:** Added `this._imageCache.delete(cacheKey)` in the `onerror` handler so failed images are evicted from cache and retried on next render. Regression test added in ImageLayerRenderer.test.js.

---

#### ~~MED-v45-3: EffectsRenderer _blurFillCanvas Texture Reallocation~~ ✅ RESOLVED

**Status:** ✅ Fixed (v45 fixes batch 2)
**Severity:** MEDIUM (Performance — GPU churn)
**File:** resources/ext.layers.shared/EffectsRenderer.js L290-296

**Issue:** `_blurFillCanvas` dimensions were set unconditionally every invocation.

**Resolution:** Added size guard (`if width !== reqW || height !== reqH`) matching the pattern used by sibling `_blurCanvas`. Canvas dimensions are only reset when they actually change.

---

#### MED-v45-4: UIHooks N+1 User Queries

**Status:** ✅ RESOLVED
**Severity:** MEDIUM (Performance — database)
**File:** src/Hooks/UIHooks.php L282-310

**Issue:** `enrichNamedSetsWithUserNames()` makes N individual `UserFactory::newFromId()` calls. For 15 named sets (the maximum), up to 15 DB queries. MediaWiki provides `UserArray::newFromIDs()` for batch loading.

**Resolution:** Replaced per-user loop with single `UserArray::newFromIDs()` batch query.

---

#### ~~MED-v45-5: TextSanitizer Zero-Width-Space Defense Incomplete~~ ✅ RESOLVED

**Status:** ✅ Fixed (v45 fixes batch 3)
**Severity:** MEDIUM (Security — defense-in-depth)
**File:** src/Validation/TextSanitizer.php L159-168

**Issue:** Keyword list for zero-width space injection omitted `Function`, `constructor`, `fetch`, `XMLHttpRequest`, `importScripts`, and `document.write`.

**Resolution:** Expanded `$jsKeywords` from 6 to 12 entries. All modern attack vectors now covered.

---

#### MED-v45-6: WikitextHooks Static State May Bleed Between Requests

**Status:** ✅ RESOLVED
**Severity:** MEDIUM (Bug — potential in long-running PHP)
**File:** src/Hooks/WikitextHooks.php L149-163

**Issue:** Six static properties persist for PHP process lifetime. In PHP-FPM with `max_requests > 1`, state from one request could bleed into the next. `resetPageLayersFlag()` only resets via `ParserBeforeInternalParse` hook — job runners and API calls that bypass the parser would not trigger the reset.

**Resolution:** Added `ensureRequestStateReset()` using `REQUEST_TIME_FLOAT` for request-boundary detection. Called at start of `onParserBeforeInternalParse()`. Only resets per-page state; stateless processor singletons preserved.

---

#### MED-v45-7: Duplicate getLayerBounds Implementations

**Status:** ✅ RESOLVED
**Severity:** MEDIUM (Code quality — divergence risk)
**Files:** resources/ext.layers.editor/CanvasManager.js L1081-1145, resources/ext.layers.editor/CanvasRenderer.js L1296-1325

**Issue:** Both classes implement nearly identical `getLayerBounds()` and `_getRawLayerBounds()` with different fallback logic. Changes to one may not be reflected in the other.

**Resolution:** CanvasRenderer.getLayerBounds() now delegates to CanvasManager.getLayerBounds() when available. Local `_getRawLayerBounds()` retained as init-time fallback only.

---

#### ~~MED-v45-8: Ellipse Validation Uses OR Instead of AND~~ ✅ RESOLVED

**Status:** ✅ Fixed (v45 fixes batch)
**Severity:** MEDIUM (Logic error)
**File:** resources/ext.layers.editor/canvas/DrawingController.js L936-937

**Issue:** Used `||` instead of `&&`, allowing degenerate ellipses.

**Resolution:** Changed `||` to `&&` to match rectangle validation pattern. Test updated in DrawingController.test.js to verify both radii must meet minimum size.

---

### LOW (New in v45)

#### ~~LOW-v45-1: `call_user_func` Indirection for Guaranteed MW Classes~~ ✅ RESOLVED

**Status:** ✅ Fixed (v45 fixes batch 3)
**Severity:** LOW (Code quality)
**Files:** src/Hooks.php, src/LayeredThumbnail.php, src/ThumbnailRenderer.php, src/LayersFileTransform.php

**Issue:** 10 instances of `\call_user_func` with `class_exists`/`is_callable` guards for guaranteed MW classes.

**Resolution:** Replaced all 10 patterns with direct calls to `LoggerFactory::getInstance()`, `Shell::command()`, and `MediaWikiServices::getInstance()`.

---

#### LOW-v45-2: ThumbnailRenderer Shadow Code Duplication

**Status:** Open
**Severity:** LOW (Code quality)
**File:** src/ThumbnailRenderer.php L283-560

**Issue:** Shadow rendering block (~10 lines) is copy-pasted across 5 shape handlers. Polygon and star shapes lack shadow support entirely.

---

#### LOW-v45-3: ThumbnailRenderer Named Color Table Duplicates ColorValidator

**Status:** Open
**Severity:** LOW (Code quality — divergence risk)
**File:** src/ThumbnailRenderer.php L683-730

**Issue:** `withOpacity()` has hardcoded map of 35 CSS colors. `ColorValidator` also validates named colors. If lists drift, colors validate on save but render incorrectly in thumbnails.

---

#### ~~LOW-v45-4: serialize($params) for Thumbnail Cache Key~~ ✅ RESOLVED

**Status:** ✅ Fixed (v45 fixes batch 3)
**Severity:** LOW (Performance)
**File:** src/ThumbnailRenderer.php L99

**Issue:** `serialize($params)` on potentially 2MB+ params before `md5()`. `json_encode()` is faster.

**Resolution:** Changed `serialize($params)` to `json_encode($params)`. Deterministic output, no PHP object injection risk.

---

#### ~~LOW-v45-5: SmartGuidesController excludeIds.sort() Mutates Caller Array~~ ✅ RESOLVED

**Status:** ✅ Fixed (v45 fixes batch 2)
**Severity:** LOW (Bug — side effect)
**File:** resources/ext.layers.editor/canvas/SmartGuidesController.js L370

**Issue:** `excludeIds.sort().join(',')` sorted caller's array in-place.

**Resolution:** Changed to `[ ...excludeIds ].sort().join(',')` to create a copy before sorting. Regression test added in SmartGuidesController.test.js.

---

#### LOW-v45-6: Toolbar Shape/Emoji Buttons Bypass EventTracker

**Status:** Open
**Severity:** LOW (Memory leak potential)
**File:** resources/ext.layers.editor/Toolbar.js L774, L845

**Issue:** `createShapeLibraryButton()` and `createEmojiPickerButton()` use raw `addEventListener` instead of EventTracker-based `addListener()`. Not cleaned up by `destroy()`.

---

#### LOW-v45-7: DeepClone Shallow Clone Fallback Silently Degrades

**Status:** Open
**Severity:** LOW (Code quality — silent failure)
**File:** resources/ext.layers.shared/DeepClone.js L51-58

**Issue:** When both `structuredClone` and `JSON.parse` fail, fallback is `obj.slice()` / `{ ...obj }` — a shallow clone. Nested objects share references.

---

#### ~~LOW-v45-8: Duplicated backgroundVisible Normalization (5+ locations)~~ ✅ RESOLVED

**Status:** ✅ Fixed (v45 fixes batch 3)
**Severity:** LOW (Code quality — DRY violation)
**Files:** ViewerManager.js (×3), FreshnessChecker.js, ApiFallback.js, SlideController.js (×2)

**Issue:** Pattern `bgVal !== false && bgVal !== 0 && bgVal !== '0' && bgVal !== 'false'` repeated across 7 locations.

**Resolution:** Extracted `LayerDataNormalizer.normalizeBackgroundVisible(val)` and replaced all 7 inline normalization blocks. Single source of truth for background visibility sentinel handling.

---

#### LOW-v45-9: Duplicated SVG Icon Code in Viewer Modules

**Status:** Open
**Severity:** LOW (Code quality — DRY violation)
**Files:** resources/ext.layers/viewer/ViewerManager.js, resources/ext.layers/viewer/ViewerOverlay.js

**Issue:** Identical `_createPencilIcon()` and `_createExpandIcon()` SVG generation methods in both files. Should use existing `IconFactory.js`.

---

#### ~~LOW-v45-10: HitTestController Instantiates Renderer Per mousemove~~ ✅ RESOLVED

**Status:** ✅ Fixed (v45 fixes batch 2)
**Severity:** LOW (Performance — GC pressure)
**File:** resources/ext.layers.editor/canvas/HitTestController.js ~L470

**Issue:** `new AngleDimensionRenderer(null)` was created on every `isPointNearAngleDimension()` call.

**Resolution:** Cached as `this._cachedAngleRenderer` singleton, created on first use and nulled in `destroy()`.

---

#### LOW-v45-11: RenderCoordinator Hash Incomplete (~20 Properties Missing)

**Status:** Open (supersedes LOW-v42-8)
**Severity:** LOW (Optimization bug — missed redraws)
**File:** resources/ext.layers.editor/canvas/RenderCoordinator.js L196-244

**Issue:** `_computeLayersHash()` omits ~20 rendering-affecting properties including `color`, `radiusX`/`radiusY`, `shadowColor`, `shadowOffsetX/Y`, `shadowSpread`, `glow`, `textStrokeColor`/`Width`, `textShadow*`, `verticalAlign`, `lineHeight`, `padding`, `cornerRadius`, `arrowhead`/`arrowStyle`/`arrowSize`, callout tail coordinates, and angle dimension coordinates.

---

#### ~~LOW-v45-12: ViewerManager Creates Multiple mw.Api() Instances~~ ✅ RESOLVED

**Status:** ✅ Fixed (v45 fixes batch 2)
**Severity:** LOW (Performance — trivial waste)
**File:** resources/ext.layers/viewer/ViewerManager.js

**Issue:** Three methods each created `new mw.Api()` independently.

**Resolution:** Added `_getApi()` helper that lazily creates and caches a single `this._api` instance. All three call sites updated to use `this._getApi()`.

---

#### ~~LOW-v45-13: Lightbox close() Animation Timeout Race With open()~~ ✅ RESOLVED

**Status:** ✅ Fixed (v45 fixes batch 3)
**Severity:** LOW (Bug — race condition)
**File:** resources/ext.layers/viewer/LayersLightbox.js L102-105

**Issue:** Rapid close(animated)-then-open() within 300ms could cause old close timeout to fire during new overlay's lifetime.

**Resolution:** `open()` now cancels any pending `closeTimeoutId` before creating a new overlay, and checks for stale overlay DOM nodes regardless of `isOpen` state.

---

#### ~~LOW-v45-14: Dead renderCodeSnippet Contains Unescaped HTML (Latent XSS)~~ ✅ RESOLVED

**Status:** ✅ Fixed (v45 fixes batch 2)
**Severity:** LOW (Dead code + latent security)
**File:** resources/ext.layers.editor/LayerPanel.js

**Issue:** `renderCodeSnippet()` had zero call sites but contained unescaped `filename` in raw HTML.

**Resolution:** Removed the dead method entirely. Tests for it were also removed (10 tests across 2 files).

---

### Previously Open Items from v41 (Status Update)

| v41 ID | Issue | v42 Status |
|--------|-------|------------|
| P3-067 | ~200 lines duplicated in ApiLayersSave | Open |
| P3-068 | ToolbarStyleControls god class (1,006 lines) | Open |
| P3-069 | drawRoundedRectPath duplicated in 3 files | Open |
| P3-070 | duplicateSelected duplicated in 2 files | Open |
| P3-071 | GradientRenderer namespace inconsistency | Open |
| P3-072 | RenderCoordinator hash misses deep changes | Superseded by LOW-v42-8 |
| P3-073 | Inconsistent service resolution pattern | Open |
| P3-074 | Response format inconsistency across APIs | Open |
| P3-075 | Missing CommonJS export in LayerDefaults.js | Open |
| P3-076 | Hard-coded English strings in UI | Superseded by MED-v42-10 |
| P3-077 | Font size validation type check gap | Open |
| P3-078 | getNamedSetOwner reads replica DB | Open |
| P3-079 | ValidationResult mixed error structure | Open |

---

## Documentation Accuracy Issues (v42 + v45)

### Critical Inaccuracies Found

| Document | Issue | Severity | Status |
|----------|-------|----------|--------|
| .github/copilot-instructions.md | God class count says 17 (actual: 20) | High — misleads AI agents | Open |
| .github/copilot-instructions.md | PropertyBuilders listed at ~1,493 (actual: 1,826) | High — 333 lines off | Open |
| .github/copilot-instructions.md | TransformController listed at ~990 (actual: 1,146) — not listed as god class | High | Open |
| .github/copilot-instructions.md | ResizeCalculator listed at ~966 (actual: 1,070) — not listed as god class | High | Open |
| .github/copilot-instructions.md | DrawingController listed at ~826 (actual: 1,053) — not listed as god class | High | Open |
| .github/copilot-instructions.md | CanvasManager listed at ~2,037 (actual: 2,104) | Medium | Open |
| .github/copilot-instructions.md | InlineTextEditor listed at ~1,833 (actual: 1,848) | Low | Open |
| .github/copilot-instructions.md | Toolbar listed at ~1,910 (actual: 1,919) | Low | Open |
| .github/copilot-instructions.md | ToolbarStyleControls listed at ~1,073 (actual: 1,073) | — | Correct |
| .github/copilot-instructions.md | Says 140 JS files (actual: 141) | Low | Open |
| .github/copilot-instructions.md | Says ~97,072 lines JS (actual: ~99,661) | Medium | Open |
| .github/copilot-instructions.md | Says 40 PHP files (actual: 41) | Low | Open |
| .github/copilot-instructions.md | Says ~14,991 lines PHP (actual: ~15,106) | Low | Open |
| .github/copilot-instructions.md | ToolManager listed at ~1,214 (v42) | ✅ Fixed | Fixed |
| .github/copilot-instructions.md | TextBoxRenderer listed at ~996 (v42) | ✅ Fixed | Fixed |
| .github/copilot-instructions.md | EmojiLibraryIndex path wrong (v42) | ✅ Fixed | Fixed |
| Mediawiki-Extension-Layers.mediawiki | Says "15 drawing tools" (actual: 17) | Medium | Open |
| Mediawiki-Extension-Layers.mediawiki | Missing Image tool from tools list | Medium | Open |
| docs/DEVELOPER_ONBOARDING.md | ToolManager.js at ~1,214 lines (actual: 799) | Medium | Open |
| docs/SLIDES_REQUIREMENTS.md | Claims "Planning Phase" for shipped feature | Low | Open |

---

## Security Controls Status (v45 — Verified)

| Control | Status | Notes |
|---------|--------|-------|
| CSRF Protection | ✅ PASS | All writes require tokens |
| SQL Injection | ✅ PASS | Parameterized queries |
| Rate Limiting | ✅ PASS | Properly delegates to $wgRateLimits |
| Input Validation | ✅ PASS | 110+ property whitelist, numeric constraints |
| RichText Font Sanitization | ✅ PASS | Fixed v39 |
| Authorization | ✅ PASS | All APIs check rights |
| Boolean Normalization | ✅ PASS | API serialization robust |
| IM Font Validation | ✅ PASS | Whitelist check added v44 |
| CSP Header | ✅ PASS | addExtraHeader() pattern |
| Font Sanitization | ✅ PASS | sanitizeIdentifier() at save time |
| SVG Sanitization | ✅ PASS | embed/object/iframe/applet added v41 |
| Client-Side SVG | ✅ PASS | DOMParser sanitizer |
| User Deletion | ✅ PASS | ON DELETE SET NULL |
| Cache Invalidation | ✅ PASS | CacheInvalidationTrait.php exists and is intact |
| window.open | ✅ PASS | noopener,noreferrer |
| TextSanitizer XSS | ✅ PASS | Second strip_tags after decode |
| Info Disclosure | ✅ PASS | Generic error + server logging |
| Transaction Safety | ✅ PASS | OverflowException re-thrown |
| Build Pipeline | ✅ PASS | npm test runs lint + Jest |
| **Clickjacking (iframe)** | **✅ PASS** | **Fixed: SAMEORIGIN header in modal mode (was CRITICAL-v45-1)** |
| **SVG Data URI** | **⚠️ GAP** | **Client validator blocks data:text/html but not data:image/svg+xml (MED-v45-1)** |
| **innerHTML Trust** | **✅ PASS** | **False positive: RichTextConverter uses DOM-based escaping (was HIGH-v45-2)** |
| **Manual HTML** | **✅ PASS** | **Fixed: LayeredThumbnail.php uses Html::element() (was HIGH-v45-1); UIHooks.php still manual but escaping correct** |

---

## God Class Status (20 files >= 1,000 lines)

### Generated Data (Exempt — 2 files)

| File | Lines |
|------|-------|
| ShapeLibraryData.js | 11,293 |
| EmojiLibraryIndex.js | 3,055 |

### Hand-Written JavaScript (16 files)

| File | Lines | Change from v43 |
|------|-------|-----------------|
| LayerPanel.js | 2,195 | — |
| CanvasManager.js | 2,104 | ↑ from 2,037 |
| Toolbar.js | 1,919 | ↑ from 1,910 |
| InlineTextEditor.js | 1,848 | ↑ from 1,832 |
| PropertyBuilders.js | 1,826 | ↑ from 1,493 (v43 count was wrong) |
| LayersEditor.js | 1,790 | — |
| APIManager.js | 1,593 | — |
| SelectionManager.js | 1,418 | — |
| CanvasRenderer.js | 1,414 | ↑ from 1,390 |
| ViewerManager.js | 1,320 | — |
| SlideController.js | 1,170 | — |
| TransformController.js | 1,146 | **NEW** (was 990 in v43 docs) |
| TextBoxRenderer.js | 1,120 | — |
| ToolbarStyleControls.js | 1,073 | ↑ from 1,006 |
| ResizeCalculator.js | 1,070 | **NEW** (was 966 in v43 docs) |
| DrawingController.js | 1,053 | **NEW** (not previously tracked) |

### PHP (2 files)

| File | Lines | Change from v43 |
|------|-------|-----------------|
| ServerSideLayerValidator.php | 1,425 | ↑ from 1,406 |
| LayersDatabase.php | 1,369 | — |

### Near-Threshold (900–999 lines — 7 files)

| File | Lines | Change from v43 |
|------|-------|-----------------|
| LayerRenderer.js | 999 | ↑ from 973 |
| PropertiesForm.js | 995 | ↑ from 991 |
| GroupManager.js | 987 | — |
| CalloutRenderer.js | 969 | — |
| LayersValidator.js | 956 | ↑ from 935 |
| ArrowRenderer.js | 932 | ↓ from 974 |
| DimensionRenderer.js | 927 | New entry |

**Note:** TransformController (1,146), ResizeCalculator (1,070), and DrawingController (1,053) were previously documented as sub-1,000 lines. Verified line counts via `wc -l` on March 4, 2026. PropertyBuilders was documented at 1,493 but actual count is 1,826 — it was never removed from the god class table because it was underreported, not because it shrank. The v43 documentation of "13 hand-written JS god classes" was inaccurate; the correct count is 16.

---

## Conclusion

The Layers extension has a **strong foundation** with excellent test coverage (92.19% statement, 82.15% branch), modern ES6 architecture (100% class migration), comprehensive server-side validation, and proper CSRF/SQL injection protection. 205 bugs have been found and fixed across v22–v45 review cycles.

**The v45 fresh audit** uncovered 1 critical security issue (clickjacking bypass), 4 high-severity issues (manual HTML, innerHTML trust, state mutation bypass, stale originalName), 8 medium issues (SVG data URI, cache pollution, GPU churn, N+1 queries, TextSanitizer gaps, static state bleed, duplicate bounds, ellipse validation), and 14+ low issues (code quality, duplication, performance micro-optimizations). The god class count was corrected from 17 to 20.

**v45 Fixes Applied — Batch 1 (5 code fixes, 2 false positives reclassified):**
- ✅ CRITICAL-v45-1 (Clickjacking) — Fixed: SAMEORIGIN header in both PHP files
- ✅ HIGH-v45-1 (Manual HTML) — Fixed: LayeredThumbnail.php now uses Html::element()
- ✅ HIGH-v45-2 (innerHTML Trust) — False Positive: RichTextConverter uses DOM-based escaping
- ✅ HIGH-v45-3 (State Mutation) — False Positive: Direct mutation is the established architecture
- ✅ HIGH-v45-4 (Stale originalName) — Fixed: dataset.originalName refreshed on re-edit
- ✅ MED-v45-2 (Cache Pollution) — Fixed: Failed images evicted from cache
- ✅ MED-v45-8 (Ellipse Validation) — Fixed: OR→AND

**v45 Fixes Applied — Batch 2 (6 code fixes):**
- ✅ MED-v45-1 (SVG Data URI) — Fixed: DANGEROUS_URL_RE now blocks all data: except safe image types
- ✅ MED-v45-3 (Blur Texture) — Fixed: Size guard prevents unnecessary GPU texture reallocation
- ✅ LOW-v45-5 (Sort Mutation) — Fixed: `[...excludeIds].sort()` prevents caller array mutation
- ✅ LOW-v45-10 (HitTest GC) — Fixed: AngleDimensionRenderer cached as singleton
- ✅ LOW-v45-12 (API Instances) — Fixed: ViewerManager reuses single mw.Api() via `_getApi()`
- ✅ LOW-v45-14 (Dead Code) — Fixed: Removed dead renderCodeSnippet with unescaped HTML

Open items as of v45.6 (post-batch 6):
- 0 CRITICAL
- 2 HIGH: Color preview (v42), UIHooks manual HTML (remainder of HIGH-v45-1)
- 2 MEDIUM: CHANGELOG gaps (v43), TextSanitizer
- 26+ LOW: Duplication, resource leaks, call_user_func, shadow duplication, color table drift, EventTracker bypass, shallow clone, bgVisible DRY, icon duplication, hash completeness, lightbox race, etc.

**All P2 issues now resolved.** The **most actionable remaining improvements** are:
1. Replace manual HTML with `Html::element()` / `Html::rawElement()` in UIHooks.php
2. Update documentation metrics (god class count, line counts, test counts)
3. Extract `isFalsyBackground(value)` to LayerDataNormalizer (DRY)

**Overall Grade: A** — Excellent core with strong testing (11,421 tests, 92.19% coverage), modern architecture, and thorough security controls. All critical and high-severity security issues resolved. All P2 items resolved. The remaining open items are predominantly code quality (P3) improvements and documentation accuracy.

---

## Change History

| Version | Date | Grade | Changes |
|---------|------|-------|------|
| v50 | 2026-03-10 | A | Verification audit of v49 fixes; 53/54 v49 fixed, 1 partial (P1-053 path type → P2-122). 7 new items: 1H (P1-056 SpecialSlides wrong right), 2M (P2-122 path smart guides, P2-123 deprecated DB API), 4L (D-050-01–04 docs). |
| v49 | 2026-03-10 | B+ | Full re-audit; 54 new items (11H, 18M, 15L, 10 docs); all opened; privilege escalation via wrong permission right; documentation drift; smart guides broken for 4 types. |
| v48 | 2026-03-09 | B+ | Full re-audit; 1 new HIGH (CanvasManager division by zero), 2 new MEDIUM (angle dimension phase, arrow RAF guards); god class recount 21→23; 16 false positives eliminated; metrics verified. |
| v47 | 2026-03-10 | B+ | Fresh audit; 2H (nudge history, draft image loss), 3M (viewer blend, delete race, prune scope), 1 fixed same-session (font sanitizer). |
| v45.6 | 2026-03-04 | A | Batch 6: Last 3 P2s fixed (P2-081 callout blur, P2-083 i18n shortcuts, P2-075 shadow rotation). All P2 items now resolved; 34 P3 remain. |
| v45.2 | 2026-03-04 | A | Batch 2 fixes: 6 more (SVG URI, blur texture, sort mutation, hit test singleton, API reuse, dead code removal); 11 total fixed from v45 |
| v45.1 | 2026-03-04 | A | Post-fix update; 5 fixed (clickjacking, manual HTML, stale name, cache, ellipse); 2 FPs (innerHTML, state mutation); grade A-→A |
| v45 | 2026-03-04 | A- | Fresh audit; 1C, 4H, 8M, 14+L new; god class count corrected 17→20; 3 files crossed threshold; PropertyBuilders +333 lines undercounted |
| v44 | 2026-03-04 | A | 5 bugs fixed (P2-076/077/078/084 + RichText font cap); docs synced to v1.5.59 |
| v43 | 2026-02-17 | A- | Verification audit; 4 v42 FPs corrected; 1M+2L new; nudge, docs |
| v42 | 2026-02-15 | A- | Fresh audit; 4H, 10M, 17L new; CacheInvalidationTrait.php false positive. |
| v41 | 2026-02-15 | A- | Fresh audit; 3H, 7M, 13L; 10 items fixed. |
| v40 | 2026-02-14 | A- | Verification addendum; 5 items fixed. |
| v39 | 2026-02-14 | A- | Fresh audit; 1H security, 4H bugs, 5M, 4L; all fixed. |
| v38 | 2026-02-14 | A | Fresh audit; 2M, 4L new; 2 FPs. |
| v37 | 2026-02-13 | A | Fresh audit; 1M, 2L new; 3 FPs. |
| v36 | 2026-02-13 | A | Fresh audit + fixes; 6H fixed; 13M; 20L. |
| v35 | 2026-02-11 | A | Fresh audit; 4H, 5M, 9L; all 18 fixed. |
| v33 | 2026-02-09 | B | Fresh audit; 4H, 8M, 7L new. |
| v29 | 2026-02-08 | B | Full audit; 4H, 10M, 8L new. |
| v28 | 2026-02-08 | B | Full audit; 1C, 10H, 9M, 6L. |
| v27 | 2026-02-07 | B | 3C (fixed), 15H, 20M, 17L. |
| v25 | 2026-02-07 | B+ | 2C (fixed), 8H, 9M, 11L. |
| v22 | 2026-02-05 | B+ | Initial comprehensive review. |
