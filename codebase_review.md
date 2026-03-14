# Layers MediaWiki Extension — Codebase Review

**Review Date:** March 14, 2026 (v54 audit)
**Previous Review:** March 12, 2026 (v53 audit)
**Version:** 1.5.62
**Reviewer:** GitHub Copilot (Claude Opus 4.6)

---

## Scope & Verification

- **Branch Reviewed:** `main`
- **Verification Method:** Direct source inspection with multi-pass
    verification; all findings individually confirmed against actual code
    before inclusion. Known false-positive patterns from prior reviews
    were checked and excluded. 7 subagent-reported issues were eliminated
    as false positives during this v54 round (see Verified Non-Issues).
- **Coverage:** 91.32% statements, 81.69% branches, 90.62% functions,
    91.39% lines (verified March 14, 2026 — HEAD 92fc3979)
- **JS source files:** 156 in `resources/` excluding `resources/dist` (~113,390 lines)
- **PHP production files:** 41 in `src/` (~15,236 lines)
- **Jest test suites:** 168
- **Jest test cases:** 11,494 (`npx jest --no-coverage --silent` — verified March 14, 2026 — HEAD 92fc3979)
- **PHPUnit test files:** 31 in `tests/phpunit`
- **i18n message keys:** 780 in `i18n/en.json`, 780 in `i18n/qqq.json` (layers- prefix; 835 total keys each)
- **API Modules:** 5 (`layersinfo`, `layerssave`, `layersdelete`,
  `layersrename`, `layerslist`)
- **Files >1,000 lines:** 26 total (5 generated JS data, 19 hand-written JS, 2 PHP)

---

## Executive Summary

This v54 audit performed a comprehensive review of all PHP (`src/`) and
JavaScript (`resources/`) source files plus all documentation, markdown,
and mediawiki files. The review was conducted with a high false-positive
threshold — all findings were verified against literal source code before
inclusion. Seven subagent-reported issues were eliminated as false positives.

The v54 review found **1 HIGH security issue, 4 MEDIUM bugs, 5 LOW
issues, and 14 documentation inaccuracies** — 24 new verified items total.
The most critical finding is an **Insecure Direct Object Reference (IDOR)**
in three PHP files where the `layers=id:123` wikitext parameter fetches
layer sets by numeric ID without verifying file ownership, potentially
leaking annotation data cross-file (OWASP A01:2021). Other findings include
a **simultaneous nudge+pan arrow key conflict** (both CanvasEvents and
EventManager fire), a **double shadow rendering bug** in TextRenderer
(non-spread path), a **set name validation inconsistency** (API allows
Unicode but URL routing rejects it), and a direct `user` table query
bypassing MediaWiki's `UserFactory` abstraction.

The **SpecialSlides.js zero-coverage issue** (P3-145 from v53) is now
**resolved** — tests exist at `tests/jest/SpecialSlides.test.js`.

Metrics have drifted significantly since v53: JS file count changed from
143 to 156 (+13 files, including new ShapeLibrary data variants), JS lines
from ~99,730 to ~113,390, and test count from 11,474 to 11,494 (+20 tests).
The god class count increased from 23 to 26 (3 new generated data files).
**Documentation metric drift** remains the most persistent quality issue
— at least 11 satellite documents contain stale test counts, coverage
numbers, or version references.

All v49–v53 bugs remain confirmed as fixed. The codebase retains strong
architecture, comprehensive test coverage (91.32%), and robust security
controls. Grade maintained at **A-** (downgraded from A due to the IDOR
finding and persistent documentation drift).

---

## Confirmed Findings (v52 — March 11, 2026) — All 4 Fixed in v1.5.62

### v51 Verification Summary

Both v51 issues verified as fixed in v1.5.62. No regressions found.

| ID | Status | Notes |
|----|--------|-------|
| P3-143 | ✅ Fixed v1.5.62 | `applyPasteOffset()` now offsets `ax/ay`, `cx/cy`, `bx/by` for angle dimension layers |
| P3-144 | ✅ Fixed v1.5.62 | `_angleDimensionPhase` initialized to `0` in `DrawingController` constructor |

---

### New Findings (v52) — Scope: Full codebase verification audit

**Audit scope:** All 41 PHP source files (`src/`), all major JS modules
(`resources/ext.layers*`), all documentation. Main branch, commit
`e29f5df9` (tag `v1.5.62`).

**Result:** No new security vulnerabilities, functional bugs, or logic
errors found. Two documentation inaccuracies and one code style issue
were identified and corrected.

### Low

#### Code Style — 1 item

**CODE-052-01 · `APIManager.js` Missing Blank Line Between Methods**
- **File:** `resources/ext.layers.editor/APIManager.js` L412
- **Code:** `}	extractLayerSetData( layerSet ) {`
    (closing brace and next method declaration on same line, separated only
    by a tab character — the result of a prior merge that omitted the blank
    line separator)
- **Impact:** Cosmetic; no functional effect. IDE navigation and diff
    readability are slightly impaired.
- **Fix:** Added blank line between `processLayersData()` closing brace and
    `extractLayerSetData()` opening.
- **Status:** ✅ **Fixed** (this session)

#### Documentation — 3 items

**D-052-01 · `README.md` Test Count 11,445 → 11,450**
- **Files:** `README.md` (badge URL, metrics table, health table)
- **Issue:** `README.md` claimed 11,445 tests. Running `npm run test:js`
    against commit `e29f5df9` produced `11450 passed, 11450 total` in
    168 suites. The discrepancy is explained by 5 regression tests added
    in v1.5.61 (2 for P2-122, 3 for P3-144) that post-dated the v50
    documentation update.
- **Fix:** Updated all three locations in `README.md`.
- **Verified by:** `npx jest --passWithNoTests --no-coverage --silent`
- **Status:** ✅ **Fixed** (this session)

**D-052-02 · `codebase_review.md` Test Count 11,445 → 11,450**
- **File:** `codebase_review.md` (Scope header, Current Metrics table)
- **Issue:** Same stale value as D-052-01 — the Scope header and the
    Current Metrics table both stated 11,445.
- **Fix:** Updated both occurrences in this file.
- **Status:** ✅ **Fixed** (this session)

**D-052-03 · `codebase_review.md` i18n Key Count 832 → 784**
- **File:** `codebase_review.md` (Scope header, Current Metrics table)
- **Issue:** The Scope header stated `832 in i18n/en.json, 832 in
    i18n/qqq.json`. Running `grep -E '"layers-[^"]+":' i18n/en.json |
    wc -l` returns **784**. This value was also verified against the
    historically-referenced commit `4f315a5f` via `git show` — it was
    784 at that commit too, meaning the "832" claim was never accurate
    and was not introduced by a recent commit. The figure appears to have
    been generated by an automated analysis tool that used a looser
    counting pattern (e.g., including comment keys, partial matches, or
    malformed entries).
- **Fix:** Updated both occurrences in this file to 784.
- **Note:** The count discrepancy has no functional impact — all 784
    keys exist in both `en.json` and `qqq.json` with matching content.
    There are no missing documentation keys.
- **Status:** ✅ **Fixed** (this session)

---

## Confirmed Findings (v54 — March 14, 2026) — 24 New Issues Found

### v53 Verification Summary

All v53 items verified. P3-145 (SpecialSlides.js zero test coverage) is
now **resolved** — test file exists at `tests/jest/SpecialSlides.test.js`
with substantial coverage of `SlidesManager` and `CreateSlideDialog`.

| ID | Status | Notes |
|----|--------|-------|
| D-053-01 | ✅ Fixed v1.5.62 | Coverage correctly shows 91.32% |
| D-053-02 | ✅ Fixed v1.5.62 | CHANGELOG shows 11,474 tests |
| D-053-03 | ✅ Fixed v1.5.62 | Grade section test count corrected |
| D-053-04 | ✅ Fixed v1.5.62 | i18n count corrected to 780 |
| P3-145 | ✅ **Resolved** | Test file now exists — no longer zero coverage |

---

### New Findings (v54) — 24 Items

**Audit scope:** All 41 PHP source files (`src/`), all 156 JS modules
(`resources/ext.layers*`), all documentation and mediawiki files.
Main branch, HEAD `92fc3979`.

**Methodology:** Multi-pass review with 5 specialized subagent sweeps
(PHP backend, JS editor core, JS shared/renderers, documentation/config,
targeted verification). 7 false positives eliminated during verification
(see Verified Non-Issues section).

### High — Security

#### P1-057 · IDOR: `layers=id:NNN` Fetches Any Layer Set Without File Ownership Check

- **Files:**
    - `src/Hooks/Processors/LayerInjector.php` L135–137
    - `src/Hooks/Processors/ImageLinkProcessor.php` L429–431
    - `src/Hooks/Processors/LayeredFileRenderer.php` L210–215
- **Code:** All three files parse `layers=id:NNN` from wikitext and call
    `$db->getLayerSet( (int)$id )` without verifying the returned set
    belongs to the current file:
    ```php
    // LayerInjector.php L135-137
    if ( strpos( $layersParam, 'id:' ) === 0 ) {
        $layerSetId = (int)substr( $layersParam, 3 );
        $layerSet = $db->getLayerSet( $layerSetId );
    }
    ```
    `getLayerSet()` in `LayersDatabase.php` queries only by `ls_id` with
    no filename/sha1 filter. The result does contain `imgName` but none of
    the three callers verify it matches `$file->getName()`.
- **Impact:** An attacker can craft wikitext like
    `[[File:Innocent.jpg|layers=id:456]]` to render layer data belonging
    to a different (possibly private) image. The layer data (text, shapes,
    embedded base64 images) would be visible on the rendered page.
    This is OWASP A01:2021 (Broken Access Control / IDOR).
- **Contrast:** The `name:` prefix variant is safe — `getLayerSetByName()`
    correctly scopes by both filename and SHA1.
- **Fix:** After fetching by ID, verify file ownership:
    ```php
    $layerSet = $db->getLayerSet( $layerSetId );
    if ( $layerSet && $layerSet['imgName'] !== $file->getName() ) {
        $layerSet = null;
    }
    ```
    Alternatively, remove the undocumented `id:` feature entirely (it is
    not mentioned in `docs/WIKITEXT_USAGE.md` or any user documentation).
- **Status:** 🔲 **Open**

### Medium — PHP

#### P2-124 · `enrichRowsWithUserNames()` Queries `user` Table Directly

- **File:** `src/Api/ApiLayersInfo.php` L501–520
- **Code:**
    ```php
    $dbr = $this->getDB();
    $res = $dbr->select(
        'user',
        [ 'user_id', 'user_name' ],
        [ 'user_id' => $userIds ],
        __METHOD__
    );
    ```
- **Impact:** Bypasses MediaWiki's `UserFactory`/`ActorStore` abstraction.
    The `user` table is an implementation detail — MediaWiki is migrating
    user identity to the `actor` table. Also bypasses user visibility
    restrictions (e.g., suppressed users). The DB connection pattern itself
    is modern (`getConnectionProvider()`) — only the query target is wrong.
- **Fix:** Use `UserFactory::newFromId()` in a batch loop, or use
    `ActorStore` for batch user name lookup.
- **Status:** 🔲 **Open**

#### P2-125 · `EditLayersAction` Set Name Validation Rejects Unicode/Spaces

- **File:** `src/Action/EditLayersAction.php` L83
- **Code:**
    ```php
    if ( $initialSetName !== '' && !preg_match( '/^[a-zA-Z0-9_-]+$/', $initialSetName ) ) {
        $initialSetName = '';
    }
    ```
- **Impact:** `SetNameSanitizer::isValid()` allows Unicode letters
    (`\p{L}`), Unicode numbers (`\p{N}`), and spaces. The API
    (`ApiLayersSave`/`ApiLayersRename`) uses `SetNameSanitizer`. But
    `EditLayersAction` uses a hardcoded ASCII-only regex. A set named
    `"anatomía labels"` can be created via API but navigating to
    `?setname=anatomía%20labels` silently resets to the default set.
- **Fix:** Replace the hardcoded regex with `SetNameSanitizer::isValid()`.
- **Status:** 🔲 **Open**

### Medium — JavaScript

#### P2-126 · Arrow Key Conflict: Simultaneous Nudge + Pan

- **File:** `resources/ext.layers.editor/CanvasEvents.js` L592–618
    and `resources/ext.layers.editor/EventManager.js` L86–170
- **Code:** Both modules register `document` `keydown` listeners for
    arrow keys. `EventManager.handleArrowKeyNudge()` nudges selected
    layers and calls `e.preventDefault()` at L170. `CanvasEvents` arrow
    handler at L592 always pans the canvas (`panY += 20`) and also calls
    `e.preventDefault()`.
- **Impact:** When layers are selected, pressing an arrow key:
    1. `EventManager` nudges layers by 1px
    2. `CanvasEvents` also fires and pans by 20px
    `preventDefault()` only prevents browser default behavior, not other
    `addEventListener` listeners. `CanvasEvents` doesn't check
    `e.defaultPrevented` before panning.
- **Fix:** Add `if ( e.defaultPrevented ) return;` at the top of the
    `CanvasEvents` arrow key handler, or check whether layers are
    selected before panning.
- **Status:** 🔲 **Open**

#### P2-127 · TextRenderer Double Shadow on Stroke+Fill (Non-Spread Path)

- **File:** `resources/ext.layers.shared/TextRenderer.js` L256–278
- **Code:** When shadow is enabled with `spread === 0`:
    1. L256: `applyShadow(layer, shadowScale)` — shadow active on ctx
    2. L261–270: `strokeText(text, x, y)` — shadow #1 rendered
    3. L273–274: `clearShadow()` only called if `spread > 0` — shadow
       NOT cleared when `spread === 0`
    4. L278: `fillText(text, x, y)` — shadow #2 rendered
- **Impact:** Text layers with both stroke and a non-spread shadow produce
    a visually doubled/darker shadow. The shadow is drawn once from
    `strokeText` and again from `fillText`. `TextBoxRenderer` handles this
    correctly by disabling shadow during `strokeText` and re-enabling for
    `fillText` only.
- **Fix:** Clear shadow after `strokeText` and before `fillText` when
    `spread === 0`, matching the `TextBoxRenderer` pattern:
    ```javascript
    if ( this.hasShadowEnabled( layer ) && spread <= 0 ) {
        this.clearShadow();
    }
    ```
- **Status:** 🔲 **Open**

### Low — PHP

#### P3-146 · `layer_set_usage` Table: Dead/Unimplemented Feature

- **Files:** `sql/layers_tables.sql` L43–52, `src/Database/LayersSchemaManager.php`,
    `src/LayersConstants.php` L239
- **Issue:** The `layer_set_usage` table is created in the schema, has
    column definitions validated in `LayersSchemaManager`, and has a
    constant in `LayersConstants`, but `LayersDatabase.php` contains
    **zero references** to this table. No application code inserts into,
    reads from, or deletes from it. The table exists empty on every
    installation.
- **Impact:** Database schema overhead. If usage tracking is ever
    implemented without cleanup logic, orphaned rows will accumulate
    when files are deleted (no FK CASCADE — MediaWiki convention).
- **Fix:** Either implement the planned usage tracking feature or remove
    the table definition and constants.
- **Status:** 🔲 **Open**

#### P3-147 · `buildImageNameLookup` Generates Redundant SQL Variants

- **File:** `src/Database/LayersDatabase.php` L1115–1126
- **Issue:** Every database query uses `buildImageNameLookup()` to
    generate 2–4 name variants (`My_Image.jpg`, `My Image.jpg`, etc.)
    as an `IN (...)` clause, doubling index scans. This is a workaround
    for historically inconsistent data rather than a proper fix.
    `ApiLayersSave` already normalizes via `$title->getDBkey()` on write.
- **Impact:** Performance — every query (19 call sites) does 2–4x the
    necessary index lookups.
- **Fix:** One-time migration to normalize existing `ls_img_name` data,
    then simplify to single-value lookups.
- **Status:** 🔲 **Open**

#### P3-148 · `LayerValidatorInterface` Unused in DI Container

- **File:** `src/Validation/LayerValidatorInterface.php`
- **Issue:** Interface is defined and `ServerSideLayerValidator` implements
    it, but no code type-hints against the interface. `ApiLayersSave`
    directly instantiates `new ServerSideLayerValidator()`. The interface
    is not wired in `services.php`. It's a design contract with no
    practical effect.
- **Impact:** Dead abstraction — not harmful, but adds cognitive overhead.
- **Status:** 🔲 **Open**

#### P3-149 · `ThumbnailRenderer` Has No Own Color Validation

- **File:** `src/ThumbnailRenderer.php` (defense-in-depth gap)
- **Issue:** Color values from layer data pass to `Shell::command()`
    arguments (ImageMagick) without ThumbnailRenderer performing its own
    validation. The `withOpacity()` method's fallback path (`return $color`)
    passes unrecognized formats unchanged. Currently mitigated by:
    1. `ServerSideLayerValidator.sanitizeColor()` — whitelist-based
    2. `Shell::command()` — uses `escapeshellarg()` per argument
- **Impact:** Not exploitable via the normal save path. But if layer data
    enters the system through any path bypassing `ApiLayersSave` (future
    API, migration, direct DB edit), unsanitized colors could reach IM.
- **Status:** 🔲 **Open**

### Low — JavaScript

#### P3-150 · `ShadowRenderer._tempCanvas` Grows Unboundedly

- **File:** `resources/ext.layers.shared/ShadowRenderer.js` L107–114
- **Issue:** The temporary shadow canvas grows to accommodate the largest
    shadow ever requested but never shrinks. With `MAX_CANVAS_DIM = 8192`,
    a single large spread shadow can allocate a 8192×8192 canvas (~256MB
    pixel data) that persists for the renderer's lifetime.
- **Impact:** GPU/system memory waste after transient large shadows.
- **Fix:** Add periodic shrink logic or null the canvas in `destroy()`.
- **Status:** 🔲 **Open**

#### P3-151 · `ImageLayerRenderer` Closures Hold Reference After Destroy

- **File:** `resources/ext.layers.shared/ImageLayerRenderer.js` L200–222
- **Issue:** Arrow function `onload`/`onerror` callbacks capture `this`
    (the renderer). If the renderer is destroyed while images load, the
    callbacks maintain a reference preventing GC. The `onerror` path
    accesses `this._imageCache` which is null after destroy.
- **Impact:** Minor memory leak; potential null reference on error path.
- **Fix:** Add `if ( this._destroyed ) return;` guard at top of callbacks.
- **Status:** 🔲 **Open**

#### P3-152 · `EffectsRenderer` Division by Zero in Blur Fill Scale

- **File:** `resources/ext.layers.shared/EffectsRenderer.js` L303–310
- **Issue:** `mapCanvasW` and `mapCanvasH` can be 0 if canvas exists but
    has width 0 (not yet sized) and `baseWidth` is also 0, producing
    `Infinity` scale factors via `imgW / mapCanvasW`.
- **Impact:** Blur fill would render incorrectly on an unsized canvas.
- **Fix:** `mapCanvasW = Math.max( 1, this.baseWidth || canvasW );`
- **Status:** 🔲 **Open**

### Documentation — 14 Items

#### D-054-01 · Metrics Drift: JS File/Line Count (all core docs)

- **Files:** `codebase_review.md`, `README.md`, `docs/ARCHITECTURE.md`,
    `copilot-instructions.md`
- **Issue:** All claim 143 JS files / ~99,730 lines. Actual: 156 files /
    ~113,390 lines. The increase is from new ShapeLibrary data variants
    (`ShapeLibraryData.original.js`, `.iec60417.js`, `.iso7000.js`) and
    other additions.
- **Status:** 🔲 **Open**

#### D-054-02 · Metrics Drift: Test Count (11,474 → 11,494)

- **Files:** `codebase_review.md`, `README.md`, `CHANGELOG.md`,
    `wiki/Changelog.md`, `docs/ARCHITECTURE.md`
- **Issue:** All claim 11,474 tests. Actual: 11,494 (20 new tests since
    last documented baseline, including SpecialSlides.test.js).
- **Status:** 🔲 **Open**

#### D-054-03 · Metrics Drift: PHP Line Count (~15,197 → ~15,236)

- **Files:** `codebase_review.md`, `README.md`, `copilot-instructions.md`
- **Issue:** Minor drift in PHP line count.
- **Status:** 🔲 **Open**

#### D-054-04 · Metrics Drift: God Class Count (23 → 26)

- **Files:** `codebase_review.md`, `README.md`, `copilot-instructions.md`,
    `docs/ARCHITECTURE.md`
- **Issue:** All claim 23 god classes (2 generated, 19 JS, 2 PHP). Actual:
    26 total (5 generated JS data files, 19 hand-written JS, 2 PHP).
    New generated files: `ShapeLibraryData.original.js` (11,293),
    `ShapeLibraryData.iec60417.js` (5,905), `ShapeLibraryData.iso7000.js`
    (1,609). `ShapeLibraryData.js` shrank from 11,293 to 1,643.
    `TransformController.js` grew from ~1,146 to 1,189.
    `CalloutRenderer.js` is exactly at 1,000 (borderline).
- **Status:** 🔲 **Open**

#### D-054-05 · `CONTRIBUTING.md` Grossly Stale Metrics

- **File:** `CONTRIBUTING.md` L24, L28
- **Issue:** States `"95.19% coverage, 11,250 tests"` and `"17 god classes"`.
    Correct: 91.32%, 11,494, 26. This file gives contributors their first
    impression of the project — having metrics wrong by ~1,000 tests and
    4% coverage damages credibility.
- **Status:** 🔲 **Open**

#### D-054-06 · `docs/ARCHITECTURE.md` Stale Version and Metrics

- **File:** `docs/ARCHITECTURE.md` L4, L27–47, L100
- **Issue:** Version `1.5.59` (correct: 1.5.62). God class header says 17
    (correct: 26). Statistics table shows stale JS/PHP lines, test count
    (11,445), and i18n count (832).
- **Status:** 🔲 **Open**

#### D-054-07 · `Mediawiki-Extension-Layers.mediawiki` Multiple Issues

- **File:** `Mediawiki-Extension-Layers.mediawiki`
- **Issues:**
    1. Update date `2026-03-04` (should be `2026-03-12`)
    2. Install table shows `1.5.60` for all branches (main should be 1.5.62)
    3. Missing `ParserClearState` hook (14th hook not listed)
    4. Missing `layers-admin` right (only lists 2 of 3 rights)
    5. Missing 8 config parameters (all Slide Mode + MaxComplexity + DefaultFonts)
- **Status:** 🔲 **Open**

#### D-054-08 · `docs/LTS_BRANCH_STRATEGY.md` Stale Throughout

- **File:** `docs/LTS_BRANCH_STRATEGY.md` L19–21, L29, L88–90
- **Issue:** All version references say `1.5.59`; test count says `11,250`.
- **Status:** 🔲 **Open**

#### D-054-09 · `docs/SLIDE_MODE_ISSUES.md` Extremely Stale Test Count

- **File:** `docs/SLIDE_MODE_ISSUES.md` L193
- **Issue:** States `"All 9,922 tests pass"` — off by ~1,572 tests.
- **Status:** 🔲 **Open**

#### D-054-10 · `wiki/Testing-Guide.md` Wrong Coverage

- **File:** `wiki/Testing-Guide.md` L13
- **Issue:** Shows `95.19%` coverage (correct: 91.32%).
- **Status:** 🔲 **Open**

#### D-054-11 · `wiki/Architecture-Overview.md` Stale Metrics

- **File:** `wiki/Architecture-Overview.md` L315–316
- **Issue:** Test Cases: `11,250`, Coverage: `95.19%`.
- **Status:** 🔲 **Open**

#### D-054-12 · `wiki/Frontend-Architecture.md` Stale Metrics

- **File:** `wiki/Frontend-Architecture.md` L415–417
- **Issue:** Test Cases: `11,250`, stmt coverage `95.19%`, branch `84.96%`.
- **Status:** 🔲 **Open**

#### D-054-13 · `wiki/Home.md` Stale "What's New" Section

- **File:** `wiki/Home.md` L23
- **Issue:** Features v1.5.60 highlights — does not mention v1.5.61/v1.5.62.
- **Status:** 🔲 **Open**

#### D-054-14 · `wiki/Installation.md` Stale Branch Versions

- **File:** `wiki/Installation.md` L21–23
- **Issue:** Branch version table says `1.5.61` for all (main should be 1.5.62).
- **Status:** 🔲 **Open**

---

## v54 Verified Non-Issues (False Positives Eliminated)

The following were reported by automated subagent analysis during this v54
review but verified as non-issues:

- **Boolean `visible !== false` bug (12+ files):** Subagent reported that
    integer `0` from the API would bypass `!== false` checks. **FALSE
    POSITIVE** — `LayerDataNormalizer.normalizeLayer()` converts all boolean
    properties (including `visible`) from integers to proper JS booleans
    before any rendering code executes. Both editor (via `APIManager.
    processRawLayers()`) and viewer (via `LayersViewer` constructor)
    normalize data. All 25+ occurrences of `visible !== false` execute on
    already-normalized booleans.

- **XSS in `HelpDialog.js` innerHTML (6 usages):** Subagent flagged
    `innerHTML` with interpolated `msg()` values. **FALSE POSITIVE** —
    `getMessage()` calls `mw.message(key).text()` which returns
    HTML-escaped plain text. All i18n messages are developer-controlled
    (extension code, not user-editable). No user data reaches `innerHTML`.

- **SVG injection in `ShapeLibraryPanel.js` / `EmojiPickerPanel.js`:**
    Subagent flagged `preview.innerHTML = svgContent`. **FALSE POSITIVE** —
    SVG data comes from `ShapeLibraryData.js` (build-time generated from
    curated icon sets) and `emoji-bundle.json` (bundled at build time).
    No user input reaches these paths at runtime.

- **`ClipboardController.cutSelected()` bypasses StateManager:** Subagent
    flagged reading `editor.layers` directly. **FALSE POSITIVE** — the
    read is just accessing the current array. The write correctly goes
    through `stateManager.set('layers', remaining)`.

- **`EffectsRenderer._blurFillCanvas` stale pixels:** Subagent reported
    ghosting when canvas reused at same size. **FALSE POSITIVE** — the
    white `fillRect()` immediately after canvas allocation overwrites all
    content before any image data is drawn.

- **`WikitextHooks` `REQUEST_TIME_FLOAT` reset detection:** Subagent
    claimed this could fail in CLI/maintenance contexts. **FALSE POSITIVE**
    — the design correctly handles PHP-FPM `max_requests > 1` recycling,
    and an explicit `resetPageLayersFlag()` exists for programmatic resets.

- **ThumbnailRenderer cache key missing layer data hash:** Subagent
    claimed stale thumbnails when data changes. **FALSE POSITIVE** —
    `$params` includes the full `layerData` array and
    `md5(json_encode($params))` captures it. Different content = different
    cache key.

---

## Confirmed Findings (v51 — March 10, 2026) — All 2 Fixed in v1.5.62

### v50 Verification Summary

All 7 v50 issues verified as fixed in v1.5.61. No regressions found.

| ID | Status | Notes |
|----|--------|-------|
| P1-056 | ✅ Fixed v1.5.61 | `SpecialSlides.php` now checks `'layers-admin'` right |
| P2-122 | ✅ Fixed v1.5.61 | `path` type handled in `_getRefPoint()` via `Math.min(points)` |
| P2-123 | ✅ Fixed v1.5.61 | `enrichRowsWithUserNames()` uses `$this->getDb()` |
| D-050-01 | ✅ Fixed v1.5.61 | `ARCHITECTURE.md` test/coverage metrics corrected |
| D-050-02 | ✅ Fixed v1.5.61 | `CHANGELOG.md` v1.5.60 coverage corrected to 91.32% |
| D-050-03 | ✅ Fixed v1.5.61 | `wiki/Changelog.md` synced with CHANGELOG.md |
| D-050-04 | ✅ Fixed v1.5.61 | `README.md` god-class count L317/L353 corrected |

---

### New Findings (v51) — All Fixed in v1.5.62

### Low

#### JavaScript — 2 items

**P3-143 · `ClipboardController.applyPasteOffset()` Skips Angle Dimension Anchor Points**
- **File:** `resources/ext.layers.editor/canvas/ClipboardController.js`
- **Code:** `applyPasteOffset()` applied `PASTE_OFFSET` to `x/y`,
    `x1/y1/x2/y2`, and `points[]` coordinate sets but had no branch for
    the `ax/ay` (arm1 endpoint), `cx/cy` (vertex), and `bx/by` (arm2
    endpoint) fields used exclusively by `angleDimension` layers.
- **Impact:** Pasting an angle dimension layer left all six anchor points
    at the original canvas coordinates (while the pasted layer received a
    new ID), causing the pasted copy to render at the wrong position —
    visually identical to the original but not offset.
- **Fix:** Added three conditional offset blocks for `ax/ay`, `cx/cy`,
    and `bx/by` after the existing `points` block.
- **Status:** ✅ **Fixed** (v1.5.62)

**P3-144 · `DrawingController._angleDimensionPhase` Not Initialized in Constructor**
- **File:** `resources/ext.layers.editor/canvas/DrawingController.js`
- **Code:** `_angleDimensionPhase` was assigned inside
    `startAngleDimensionTool()` but never declared in the constructor.
    Any code path checking the property before tool activation received
    `undefined` rather than `0`.
- **Impact:** Phase-comparison guards (`_angleDimensionPhase === 0`, etc.)
    behaved incorrectly before the first `startAngleDimensionTool()` call,
    potentially skipping phase transitions or misidentifying the current
    drawing phase.
- **Fix:** Added `this._angleDimensionPhase = 0` to the constructor.
- **Status:** ✅ **Fixed** (v1.5.62)

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

## Current Metrics (Verified March 14, 2026 — v54 audit)

| Metric | Verified Current Value |
|--------|------------------------|
| Extension version | 1.5.62 |
| MediaWiki requirement | >= 1.44.0 |
| PHP requirement | 8.1+ |
| JS source files (excluding `resources/dist`) | 156 |
| JS source lines (excluding `resources/dist`) | ~113,390 |
| PHP production files (`src/`) | 41 |
| PHP production lines (`src/`) | ~15,236 |
| Jest test suites | 168 |
| Jest tests | 11,494 |
| Statement coverage | 91.32% |
| Branch coverage | 81.69% |
| i18n keys (`en.json`, `qqq.json`) | 780 |
| Files > 1,000 lines | 26 total |
| ESLint disable comments | 18 (all legitimate) |

## God Class Status (26 files >= 1,000 lines — Verified March 14, 2026)

### Generated Data (Exempt — 5 files)

| File | Lines | Notes |
|------|-------|-------|
| ShapeLibraryData.original.js | 11,293 | Icon set: original |
| ShapeLibraryData.iec60417.js | 5,905 | Icon set: IEC 60417 |
| EmojiLibraryIndex.js | 3,055 | Emoji search index |
| ShapeLibraryData.js | 1,643 | Combined registry |
| ShapeLibraryData.iso7000.js | 1,609 | Icon set: ISO 7000 |

### Hand-Written JavaScript (19 files)

| File | Lines | Change from v53 |
|------|-------|-----------------|
| LayerPanel.js | 2,165 | — |
| CanvasManager.js | 2,104 | — |
| Toolbar.js | 1,933 | — |
| InlineTextEditor.js | 1,848 | — |
| PropertyBuilders.js | 1,826 | — |
| LayersEditor.js | 1,803 | — |
| APIManager.js | 1,593 | — |
| SelectionManager.js | 1,419 | — |
| ViewerManager.js | 1,266 | — |
| CanvasRenderer.js | 1,256 | — |
| TransformController.js | 1,189 | ↑43 |
| ToolbarStyleControls.js | 1,139 | — |
| SlideController.js | 1,126 | — |
| TextBoxRenderer.js | 1,120 | — |
| ResizeCalculator.js | 1,070 | — |
| AngleDimensionRenderer.js | 1,067 | — |
| DrawingController.js | 1,053 | — |
| CanvasEvents.js | 1,033 | — |
| CalloutRenderer.js | 1,000 | — |

### PHP (2 files)

| File | Lines | Change from v53 |
|------|-------|-----------------|
| ServerSideLayerValidator.php | 1,431 | — |
| LayersDatabase.php | 1,372 | ↑2 |

### Near-Threshold (900–999 lines — 6 files)

| File | Lines |
|------|-------|
| LayerRenderer.js | 999 |
| PropertiesForm.js | 995 |
| GroupManager.js | 987 |
| ShapeRenderer.js | 959 |
| LayersValidator.js | 956 |
| ArrowRenderer.js | 932 |

## Issue Summary (v54 — March 14, 2026)

| Category | Critical | High | Medium | Low | Notes |
|----------|----------|------|--------|-----|-------|
| Security | 0 | 1 | 0 | 0 | P1-057: IDOR via `id:` prefix |
| PHP bugs | 0 | 0 | 2 | 3 | P2-124/P2-125 + P3-146/P3-147/P3-148 |
| JS bugs | 0 | 0 | 2 | 3 | P2-126/P2-127 + P3-150/P3-151/P3-152 |
| PHP defense-in-depth | 0 | 0 | 0 | 1 | P3-149: ThumbnailRenderer color gap |
| Documentation | 0 | 0 | 0 | 14 | D-054-01 through D-054-14 |
| **Total open** | **0** | **1** | **4** | **21** | **26 open items** |

*P3-145 (SpecialSlides.js test coverage) resolved — tests now exist.*

## Issue Summary (v53 — March 12, 2026 — superseded by v54)

| Category | Critical | High | Medium | Low | Notes |
|----------|----------|------|--------|-----|-------|
| Documentation | 0 | 0 | 0 | ~~4~~ 0 | 4 doc inaccuracies fixed this session |
| Testing gap | 0 | 0 | 0 | ~~1~~ 0 | P3-145: now resolved (tests exist) |
| **Total open** | **0** | **0** | **0** | **0** | **All v53 items resolved** |

## Issue Summary (v52 — March 11, 2026 — superseded by v53)

| Category | Critical | High | Medium | Low | Notes |
|----------|----------|------|--------|-----|-------|
| Code style | 0 | 0 | 0 | ~~1~~ 0 | Fixed this session (APIManager blank line) |
| Documentation | 0 | 0 | 0 | ~~3~~ 0 | Fixed this session (test count, i18n count) |
| **Total open** | **0** | **0** | **0** | **0** | **All 4 v52 items fixed** |

## Issue Summary (v51 — March 10, 2026 — superseded by v52)

| Category | Critical | High | Medium | Low | Notes |
|----------|----------|------|--------|-----|-------|
| JavaScript bugs | 0 | 0 | 0 | ~~2~~ 0 | All fixed v1.5.62 |
| **Total open** | **0** | **0** | **0** | **0** | **All 2 v51 items fixed in v1.5.62** |

## Issue Summary (v50 — March 10, 2026 — superseded by v51)

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

## Overall Grade: A-

The codebase maintains strong architecture, comprehensive test coverage
(91.32% statements, 11,494 tests in 168 suites), 100% ES6 class migration,
and robust security controls (CSRF, rate limiting, input validation). All
v49–v53 bugs confirmed fixed (339 total historical issues resolved).

The v54 review (HEAD `92fc3979`, v1.5.62) found **1 security HIGH** (IDOR
via undocumented `id:` wikitext prefix allowing cross-file layer set
access), **4 medium** (arrow key conflict, double shadow rendering,
set name validation mismatch, direct user table query), **7 low** code
issues, and **14 documentation metric drift items**.

Grade reduced from A to **A-** due to the IDOR finding. The vulnerability
is narrow (requires attacker knowing numeric IDs + wikitext editing access)
but represents a genuine access control gap. The 14 documentation items
reflect metric drift across many files — not harmful, but reducing
consistency. Once P1-057 is fixed, the grade should return to A.

---

## Historical Findings Archive

Findings from **v47 (March 10, 2026) and earlier** (v22 through v47) have been
archived to keep this document focused on recent audits.

See [docs/archive/codebase_review_v47_and_earlier.md](docs/archive/codebase_review_v47_and_earlier.md)
for the complete historical record.
