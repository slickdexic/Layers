# J113I — Read-only PDF metadata caller audit

**Date:** October 4, 2026. **Advances:** HIST-4/HIST-8, DATA-1 and SRCH-1.
**Status:** returned and reviewed; lead corrections below supersede conflicting
audit statements. No metadata producer is activated by this packet.

JE2, audit the integration points for the accepted, inactive J113G foundation.
Read `AGENTS.md`, the charter's “Read this first”, the active queue and the
J113G/J113H packets. Return a concrete caller and regression map for lead
implementation. Do not activate the foundation or implement another helper.

## Purpose and frozen boundary

Shown-set metadata currently omits PDF pages. J113G can retain an internal
page selector while preserving old triples. Existing production callers still
emit those triples. Before activation, the lead must coordinate native effective
page extraction, template/gallery metadata, migration deduplication and search
without duplicated text. Your audit resolves the implementation map and gaps;
it does not reopen the approved owner/file/name identity or PDF naming model.

All PDF members of a layer set share one name. Page numbers select internal
members. Stored metadata is not authorization, a source-version pin or proof
that historical payloads are unchanged. Preserve existing show/hide intent,
entry points, literal names and selection behavior. J111 rendering/export and
the broader copy/reconciliation implementation remain outside this assignment.

## Allowed scope and starting paths

Append your report to this packet only. Read production, tests and native core
source as needed. Starting paths are:

- `src/Hooks/WikitextHooks.php`: direct/template note sites and `noteGallerySet()`.
- `src/Hooks/SlideHooks.php`: unchanged slide metadata.
- `src/Search/ShownLayerSets.php`: accepted representation and accessor.
- `src/Search/DrawingSearchText.php` and `DrawingSearchHooks.php`: consumers
  and reindex lookup through the unchanged fragment prefix.
- `src/Migration/PageCopyMigration.php`: direct/property shown keys, source
  page selection and property fallback.
- `src/Revision/PageOwnedPilot.php`, `PdfPageRoutingTest.php`,
  `PageCopyMigrationPdfPageTest.php` and existing gallery/search tests: native
  effective-page adapter and available regression fixtures.
  Trace the existing `PageOwnedBindingOptions::sourcePage()` adapter too;
  do not propose a second raw-options parser.

Do not edit source/tests, other packets, shared fixtures or configuration.
Do not run tests, mutations, Docker commands, browsers or wiki/migration
commands. Read-only Git inspection is allowed; no index/ref/configuration
change, commit or push. These limits let your audit run during JE1's control
window without changing or verifying its temporary baseline.

## Required report

1. List every metadata producer/consumer with verified paths and line numbers,
   exact tuple assumptions and the native page value available at each site.
   Trace direct embeds, template expansion, ordinary galleries and helper/Cargo
   gallery paths. Identify paths that still cannot prove an effective page;
   do not invent a fallback or silently assume a requested page was rendered.
2. Map direct/property deduplication and the selected source page in migration.
   Include one file/set shown on two PDF pages, repeated same-page embeds,
   direct plus property evidence, old triples, missing/invalid selected pages
   and independently named files/slides. Specify the existing behavior that
   each proposed regression must preserve and the wrong payload it would catch.
3. Trace search when the same file/set gains multiple page tuples. The current
   collector retrieves all shared-set pages for each kind/name/selector tuple;
   describe how activation would repeat that retrieval. Preserve the existing
   search text scope and permissions: do not propose narrowing it to only the
   selected page. Identify the exact regression needed to prove no duplicate
   text while retaining all previously indexed content and reindex lookup.
   Quantify the 50-stored-tuple limit: many pages of one PDF can consume entries
   that previously represented other files/sets. Include a counterexample with
   another previously indexed file/set; deduplicating text alone does not prove
   that producer truncation preserves it. Report this activation concern without
   changing G's frozen foundation or prescribing a new public behavior.
4. Record show/hide/latest/specific-name behavior, missing named sets and
   explicit ID references at producer sites. Distinguish existing triple
   compatibility from new page metadata; do not infer new Default behavior.
5. Give a bounded production-file list, existing test locations, missing
   counterexamples and a serial verification sequence for lead implementation.
   Report any concrete conflict or unresolved choice separately with evidence.
   Do not treat a report as permission for content reconciliation or activation.

Run only documentation and diff checks for your packet. Append exact inspected
paths, findings, proposed counterexamples, limitations and check results, then
return for lead review. This audit completes no charter criterion or migration.


## JE2 Audit Report: PDF Metadata Integration & Caller Map

**Auditor:** Junior Engineer 2 (JE2)
**Date:** October 4, 2026
**Advances:** HIST-4/HIST-8, DATA-1 and SRCH-1
**Status:** Complete read-only audit for lead review; conducted during JE1 native test window.
**Inspected Paths:**
- `src/Search/ShownLayerSets.php`
- `src/Hooks/WikitextHooks.php`
- `src/Hooks/SlideHooks.php`
- `src/Search/DrawingSearchText.php`
- `src/Search/DrawingSearchHooks.php`
- `src/Database/LayersDatabase.php`
- `src/Migration/PageCopyMigration.php`
- `src/Revision/PageOwnedPilot.php`
- `src/Revision/PageOwnedBindingOptions.php`
- `src/Hooks/BoundFileHooks.php`
- `src/Hooks/BoundSlideHooks.php`
- `src/Cargo/CargoLayersGalleryFormat.php`
- `tests/phpunit/unit/Search/ShownLayerSetsTest.php`
- `tests/phpunit/core/DrawingSearchTest.php`
- `tests/phpunit/core/PdfPageRoutingTest.php`
- `tests/phpunit/core/PageCopyMigrationPdfPageTest.php`

---

### Section 1: Metadata Producers and Consumers Map

| Role | Component & Method | File & Exact Line Numbers | Current Tuple Emitted / Consumed | Available Native Page at Call Site | Effective Page Extraction & Provenance Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Producer** | `WikitextHooks::onParserBeforeInternalParse` | `src/Hooks/WikitextHooks.php:1296–1297` | Emits 3-tuple `['file', $filename, $shownSet]` | None available at parse stage (pre-render wikitext scan) | **Cannot prove effective page.** Regex match (`$fileLayersPattern`, line 1213) scans raw wikitext `layerset=` only. No `MediaTransformOutput` exists. Wikitext option parsing requires localized `img_page` magic words (`page`, `seite`, `page 2`), integer validation, and PDF multipage clamping (`min($page, $file->pageCount())`). None of these are accessible during early parse. |
| **Producer** | `WikitextHooks::onThumbnailBeforeProduceHTML` -> `noteGallerySet` | `src/Hooks/WikitextHooks.php:672–673` (call site), `685–698` (definition) | Emits 3-tuple `['file', $filename, $set]` | Available via `$thumbnail` (`MediaTransformOutput`) | **Effective page available but ignored.** `$thumbnail` is passed to `onThumbnailBeforeProduceHTML`. `self::sourcePage($thumbnail)` (line 1085) extracts `max(1, (int)($params['page'] ?? 1))` from transform parameters or description link query. However, `noteGallerySet()` does not receive or forward `$thumbnail`/`$page`, calling `ShownLayerSets::note()` with default `$page = 1`. |
| **Producer** | `SlideHooks::renderSlide` | `src/Hooks/SlideHooks.php:195` | Emits 3-tuple `['slide', $slideName, $layerSetName]` | N/A (Slides have no page dimension) | **Fully compliant.** Slides have no multipage structure; slide page is invariant (`1`). `ShownLayerSets::note` rejects any slide page $\neq 1$ with `InvalidArgumentException`. Unchanged. |
| **Consumer** | `DrawingSearchHooks::onSearchDataForIndex2` | `src/Search/DrawingSearchHooks.php:35–36` | Decodes page property via `ShownLayerSets::decode` | Consumes 3-tuples or 4-tuples | Passes decoded entries into `DrawingSearchText::get()`. |
| **Consumer** | `DrawingSearchHooks::onLinksUpdateComplete` | `src/Search/DrawingSearchHooks.php:54` | Decodes page property via `ShownLayerSets::decode` | Consumes 3-tuples or 4-tuples | Passes decoded entries into `DrawingSearchText::update()`. |
| **Consumer** | `DrawingSearchHooks::onShowSearchHit` | `src/Search/DrawingSearchHooks.php:66` | Triggers property read in `DrawingSearchText::get()` | Consumes 3-tuples or 4-tuples | Generates highlighted search snippet from indexed text. |
| **Consumer** | `DrawingSearchText::get` | `src/Search/DrawingSearchText.php:80–87` | Unpacks 3-tuple: `[ $kind, $name, $setName ]` | Ignores 4th element (`$page`) | **Vulnerable to repeated whole-set retrieval.** Calls `LayersDatabase::getSetForSearch` once per tuple. Because `getSetForSearch` retrieves all pages of the layer set, multiple page tuples for the same file/set repeat retrieval and duplicate search text. |
| **Consumer** | `DrawingSearchText::updatePagesShowing` | `src/Search/DrawingSearchText.php:138–150` | Matches `pp_value` via `ShownLayerSets::fragment($kind, $name)` | N/A (fragment prefix match) | **Fully compliant.** `ShownLayerSets::fragment('file', 'Doc.pdf')` yields `["file","Doc.pdf",`. Matches both 3-tuples and 4-tuples in `pp_value`. Reverse reindexing lookup works seamlessly. |
| **Consumer** | `PageCopyMigration::plan` (direct embed tracking) | `src/Migration/PageCopyMigration.php:153` | Generates `$direct[self::shownKey(...)]` | Scans raw embed options | **Omits page.** `shownKey()` (line 444) hashes only `kind`, `name`, `set`. Direct embed on page 1 collides with property entry on page 2. |
| **Consumer** | `PageCopyMigration::plan` (property loop) | `src/Migration/PageCopyMigration.php:176–196` | Unpacks 3-tuple: `[ $kind, $name, $set ]` | Hardcodes `$page = 1` | **Drops page 2+.** Ignores 4th tuple element; hardcodes page 1 in `$this->fileSource()` call (line 187); drops subsequent pages via `$copies` collision (line 195). |

#### Paths Still Unable to Prove an Effective Page
1. **Direct and Transcluded Wikitext File Embeds (`onParserBeforeInternalParse`):**
   - The regex scanner at line 1213 runs before core's media transform pipeline. It cannot access `LocalFile` properties or `MediaTransformOutput`.
   - Resolving native page from wikitext requires core's `MagicWordFactory` for `img_page` (accounting for aliases such as `seite`, syntax like `page 2` vs `page=2`), validation of positive integer syntax, and clamping against the file's native page count (`$file->pageCount()`).
   - If an embed specifies an invalid page (e.g. `page=0`, `page=-1`, `page=foo`) or an out-of-range page (e.g. `page=10` on a 2-page document), MediaWiki core renders fallback page 1 or clamps to page 2. Wikitext regex matching without file context cannot prove which page core actually renders.
2. **Pre-parse Native Gallery Hint Registration (`preprocessGalleryBlock`, lines 1414–1459):**
   - In native `<gallery>` blocks, `preprocessGalleryBlock` regex-scans image lines for `layerset=`, strips the parameter, and calls `registerGalleryHint($filename, $setname)`.
   - `$galleryHints` is a flat associative array keyed solely by `$filename` (`self::$galleryHints[$filename]`). It contains zero page discrimination.
   - If a gallery embeds multiple pages of the same PDF file with different layer sets (e.g. `File:Doc.pdf|page=1|layerset=SetA` and `File:Doc.pdf|page=2|layerset=SetB`), the second line overwrites the first hint in `$galleryHints[$filename]`.
3. **Cargo Galleries and Custom Helper Galleries Without Transform Outputs:**
   - In `CargoLayersGalleryFormat::preRegisterLayerHints` (lines 60–100), hints are registered from tabular query rows via `registerGalleryHint($filename, $setname)`.
   - If a Cargo query specifies a PDF file across multiple rows or without an explicit transform generating `$thumbnail`, `onThumbnailBeforeProduceHTML` cannot inspect transform parameters and falls back to page 1.
4. **Suppressed or Broken Transforms:**
   - When file transformation fails or thumbnail generation is bypassed, no valid `MediaTransformOutput` with description link or transform parameters is generated. No effective page can be proven.

---

### Section 2: Migration Deduplication and Selected Source Page

#### Current Flaws in `PageCopyMigration.php`
1. **`shownKey` Missing Page Selector (lines 444–448):**
   ```php
   private static function shownKey( string $kind, string $name, ?string $selector ): string {
       $name = str_replace( ' ', '_', preg_replace( '/^File:/', '', trim( $name ) ) );
       $set = $selector === null || SetNameResolver::isShowIntent( $selector ) ? '' : trim( $selector );
       return $kind . "\n" . $name . "\n" . $set;
   }
   ```
   `shownKey` concatenates only `$kind`, `$name`, and `$set`. It contains no page discriminator.
2. **Direct vs. Property Collision (lines 153 & 180):**
   - If a wiki page has a direct embed: `[[File:Doc.pdf|page=1|layerset=Notes]]`, line 153 registers `$direct["file\nDoc.pdf\nNotes"] = true`.
   - If the page also has a property entry for page 2: `["file", "Doc.pdf", "Notes", 2]`, line 180 computes `self::shownKey('file', 'Doc.pdf', 'Notes')`.
   - `isset($direct["file\nDoc.pdf\nNotes"])` evaluates to `true`.
   - **Result:** The property entry for page 2 is skipped on line 182 with the comment `// The page's own text shows it; that embed was handled above.` Page 2 layer set is silently omitted from migration.
3. **Property Loop Discards Page 4-Tuple and Hardcodes Page 1 (lines 176–196):**
   - Line 176: `foreach ( $shown as [ $kind, $name, $set ] )` unpacks only 3 items, discarding any 4th tuple element (`$page`).
   - Line 187: `$this->fileSource( 'File:' . $name, $set === '' ? 'on' : $set, 1, $authority, $reason )` passes hardcoded `1` as the `$page` argument.
   - If property contains entries for page 1 and page 2 of `Doc.pdf` with set `Notes`:
     - Iteration 1 (`page 1`): calls `fileSource(..., page: 1)`. Adds `$copies['row:101'] = $source`.
     - Iteration 2 (`page 2`): calls `fileSource(..., page: 1)`. Returns `$source` for row 101.
     - Line 195: `if ( isset( $copies[$source['key']] ) ) continue;` detects `'row:101'` and skips.
     - **Result:** Page 2 is completely lost.

#### Migration Scenarios & Required Regressions

| Scenario | Existing Behavior | Expected Migrated Behavior | Wrong Payload Caught by Proposed Regression |
| :--- | :--- | :--- | :--- |
| **One file/set shown on two PDF pages (via property / gallery)** | Discards page 2 due to hardcoded page 1 in `fileSource` and `$copies` key collision on row ID of page 1. | Migrates both page 1 and page 2 as distinct surfaces with labels preserving the layer set. | Catches silent dropping of page 2+ layer sets when a document is shown across multiple gallery thumbnails. |
| **Repeated same-page embeds (e.g. two embeds of page 2)** | Both resolve to row ID of page 2; first sets `$copies['row:102']`, second matches `isset($copies)`; rewrites both wikitext positions to same surface name. | Must be preserved exactly. Single surface created; all embeds pointing to that page/set rewritten to match. | Catches duplicate surface creation for identical file/page/set combinations. |
| **Direct embed on page 1 + Property entry on page 2** | `shownKey` collides without page dimension; line 180 skips property entry for page 2. | Direct embed migrates page 1; property entry migrates page 2. Both surfaces created and labeled. | Catches false-positive direct deduplication suppressing gallery/template layer sets on other pages. |
| **Old unannotated triples (`['file', 'Doc.pdf', 'Notes']`)** | Processed as page 1. | Decoded via `ShownLayerSets::sourcePage($entry)` as page 1. Migrates page 1 layer set. | Catches migration failure or crash on pre-existing 3-tuple property entries. |
| **Missing or invalid selected page (e.g. `page=99` on 2-page PDF)** | `fileSource()` fails to find row; records in `$plan['notMoved']` with reason `'no-current-set'`. | Must be preserved exactly. Returns null source; records `'no-current-set'` in plan without throwing. | Catches attempt to copy non-existent page rows or unhandled null dereferences. |
| **Independently named files and slides** | Slide prefixes (`slide:`) and separate namespace handling keep rows distinct in `$copies`. | Distinct files and slides migrate independently without label or row collisions. | Catches accidental namespace or key collisions between slide names and file titles. |

---

### Section 3: Search Preservation & The 50-Entry Limit Counterexample

#### Whole-Set Retrieval Duplication in `DrawingSearchText`
In `src/Search/DrawingSearchText.php:80–87`:
```php
foreach ( $shown ?? $this->shown( $page, $fromPrimary ) as [ $kind, $name, $setName ] ) {
    $slide = $kind === ShownLayerSets::SLIDE;
    foreach ( $this->db->getSetForSearch( $slide ? LayersConstants::SLIDE_PREFIX . $name : $name, $setName,
        $slide, $fromPrimary ) as $set
    ) {
        $parts[] = PageDrawingSearchText::layerText( $set );
    }
}
```
In `src/Database/LayersDatabase.php:1521–1524`:
```php
$ids = $db->newSelectQueryBuilder()->select( 'MAX(ls_id)' )->from( 'layer_sets' )
    ->where( $where + [ 'ls_name' => $setName ] )->groupBy( 'ls_page' )->limit( self::MAX_SEARCH_SETS )
    ->caller( __METHOD__ )->fetchFieldValues();
return $this->decodeSetsForSearch( $db, $ids );
```

1. **Retrieval Scope Invariant:**
   `LayersDatabase::getSetForSearch()` selects `MAX(ls_id)` grouped by `ls_page` for the entire named layer set. It retrieves **all member pages** belonging to that layer set on that file.
2. **Repetition Mechanism Upon Activation:**
   If a page has metadata tuples for multiple pages of the same file and set (e.g. `['file', 'Doc.pdf', 'Notes']` and `['file', 'Doc.pdf', 'Notes', 2]`), `DrawingSearchText::get()` iterates twice:
   - Iteration 1 calls `getSetForSearch('Doc.pdf', 'Notes')` $\rightarrow$ returns all pages of `Notes` (e.g. page 1 and page 2). Their text is extracted into `$parts`.
   - Iteration 2 calls `getSetForSearch('Doc.pdf', 'Notes')` $\rightarrow$ returns all pages of `Notes` AGAIN. Their text is extracted into `$parts` AGAIN.
   - Result: All text across all pages of `Notes` is duplicated in the page's search document (`auxiliary_text`), inflating search term weights and snippet extracts.
3. **Preservation of Search Scope (No Narrowing):**
   - The packet strictly requires: *“Preserve the existing search text scope and permissions: do not propose narrowing it to only the selected page.”*
   - Narrowing `getSetForSearch()` to only the single selected page would silently drop searchable text from other member pages of the shown layer set that were previously indexed.
   - **Required Solution & Regression:**
     - In `DrawingSearchText::get()`, the set of `(kind, name, setName)` queries must be deduplicated across `$shown` entries prior to calling `getSetForSearch()`.
     - Exact regression: Verify that indexing a page with multiple page tuples for the same file and layer set (e.g. `[['file', 'Doc.pdf', 'Notes'], ['file', 'Doc.pdf', 'Notes', 2]]`) yields identical search text to an indexing with a single tuple `[['file', 'Doc.pdf', 'Notes']]`, containing exactly one instance of each layer's text.
4. **Reindex Lookup Preservation:**
   - In `DrawingSearchText::updatePagesShowing` (lines 138–150), reverse lookup queries `page_props` using `ShownLayerSets::fragment($kind, $name)`.
   - `fragment('file', 'Doc.pdf')` produces `["file","Doc.pdf",`.
   - In the database, stored entries are formatted as:
     - Page 1 / triple: `["file","Doc.pdf","Notes"]`
     - Page 2 / quadruple: `["file","Doc.pdf","Notes",2]`
   - Both start with `["file","Doc.pdf",`. The SQL expression `pp_value LIKE '%["file","Doc.pdf",%'` matches both representations without modification.

#### Quantification of the 50-Stored-Tuple Limit & Crowding-Out Counterexample
In `ShownLayerSets.php:19`:
```php
private const MAX_ENTRIES = 50;
...
$output->setUnsortedPageProperty( self::PROPERTY,
    '[' . implode( ',', array_slice( $keys, 0, self::MAX_ENTRIES ) ) . ']' );
```

- **Historical Behavior (Prior to J113G):**
  Embeds of multiple pages of the same file and layer set collapsed into a single tuple `['file', 'Doc.pdf', 'Notes']`. That document consumed exactly **1** slot out of the 50-entry budget, leaving 49 slots available for other files and slides on the page.
- **Page-Aware Behavior (J113G Foundation):**
  Each distinct page number creates an independent tuple (`['file', 'Doc.pdf', 'Notes', 2]`, `..., 3]`, etc.). A multi-page document can consume dozens of slots.
- **Crowding-Out Counterexample:**
  Consider a wiki page `Flight_Manual_Review` containing:
  1. A 50-page PDF document gallery: `File:AircraftManual.pdf` with `layerset=Inspection` across pages 1 through 50.
  2. An image embed: `[[File:HydraulicSchematic.png|layerset=PressureReadings]]`.
  3. A standalone slide embed: `{{#Slide:SafetyChecklist|layerset=Approved}}`.

  - **Under Historical Triple Metadata:**
    - `AircraftManual.pdf` produces 1 entry: `["file","AircraftManual.pdf","Inspection"]`
    - `HydraulicSchematic.png` produces 1 entry: `["file","HydraulicSchematic.png","PressureReadings"]`
    - `SafetyChecklist` produces 1 entry: `["slide","SafetyChecklist","Approved"]`
    - Total entries: 3. All 3 are stored in `page_props`, indexed in search, tracked for reverse reindexing, and migrated by `PageCopyMigration`.
  - **Under Page-Aware Metadata:**
    - `AircraftManual.pdf` produces 50 distinct entries:
      `["file","AircraftManual.pdf","Inspection"]` (page 1)
      `["file","AircraftManual.pdf","Inspection",2]`
      ...
      `["file","AircraftManual.pdf","Inspection",50]`
    - `HydraulicSchematic.png` produces:
      `["file","HydraulicSchematic.png","PressureReadings"]`
    - `SafetyChecklist` produces:
      `["slide","SafetyChecklist","Approved"]`
    - `ShownLayerSets::note()` sorts the encoded JSON strings lexicographically (`sort($keys)`) before truncating with `array_slice($keys, 0, 50)`.
    - Alphabetically, all 50 `AircraftManual.pdf` keys sort before `HydraulicSchematic.png` and `SafetyChecklist`.
    - The first 50 slots are completely filled by `AircraftManual.pdf`.
    - `HydraulicSchematic.png` (entry 51) and `SafetyChecklist` (entry 52) are **truncated and dropped**.
  - **Consequences of Crowding-Out:**
    1. **Search Indexing:** Neither `HydraulicSchematic.png` nor `SafetyChecklist` text is indexed for `Flight_Manual_Review`. Readers searching for terms in `PressureReadings` or `Approved` checklist layers will not find the page.
    2. **Reverse Reindexing:** Future updates to `HydraulicSchematic.png` or `SafetyChecklist` layer sets will query `page_props` via `updatePagesShowing()`. Because their fragments are absent from `pp_value`, `Flight_Manual_Review` will not be reindexed.
    3. **Migration Omission:** In `PageCopyMigration::plan()`, `$shown` entries for `HydraulicSchematic.png` and `SafetyChecklist` will not exist in `pp_value`. If embedded via templates or galleries, they will be silently skipped during migration.
  - **Activation Note:** Deduplicating search queries at read time does not prevent budget exhaustion at write time. Producer truncation behavior must be evaluated by the lead before activating multi-page metadata.

---

### Section 4: Producer Syntax & Selection Behavior

1. **Show Intent vs. Hide Intent:**
   - In `WikitextHooks::onParserBeforeInternalParse` (lines 1289–1291), normalized values `'off'`, `'none'`, `'false'` indicate hide intent and bypass `ShownLayerSets::note()`.
   - Normalized values `'on'`, `'true'`, `'all'` indicate show intent for the latest set.
   - In `WikitextHooks::noteGallerySet` (line 690), `SetNameResolver::isHideIntent($setName)` explicitly skips recording.
2. **Latest Set (`layerset=on` or empty string):**
   - In `WikitextHooks.php:1297` and `697`, `SetNameResolver::isSpecificName($set) ? $set : ''` normalizes generic show intent to `''`.
   - In `ShownLayerSets`, empty string `''` represents "whichever layer set was saved most recently".
   - For galleries, `noteGallerySet` requires `$attribs['data-layer-data']` or `$attribs['data-layers-large']` before noting an unpinned/latest set, ensuring empty/unlayered images do not pollute page properties.
3. **Specific Named Sets (`layerset=Notes` or `layerset=name:Notes`):**
   - The prefix `name:` is stripped via `preg_replace('/^name:/', '', $layersValue)`.
   - A named layer set is noted even if the set does not currently exist on the target file (preserving search index intent and migration copy planning).
4. **Explicit ID References (`id:...`, `layersetid=...`, `<pageId>:<name>`):**
   - In `WikitextHooks.php:1270`, `<pageId>:<name>` identifies a page-owned layer set, which is routed to `$namedMap` and never noted in `ShownLayerSets`.
   - In `WikitextHooks.php:1294`, `strpos($layersValue, 'id:') === 0` skips `ShownLayerSets::note()`. Explicit database row IDs pin specific historical revisions and are never recorded as dynamic shared sets.
   - In `WikitextHooks.php:690`, `str_starts_with($setName, 'id:')` returns early without recording.
   - In `PageCopyMigration.php:154`, `layersetid` options are rejected from migration planning with reason `'pinned-revision'`.
5. **Triple Compatibility & No Default Inference:**
   - When no `layerset=` or `layers=` parameter is present on an embed, no entry is recorded in `ShownLayerSets`.
   - Default embeds continue to represent unlayered files unless explicit layer syntax or gallery hints are present.
   - Existing 3-tuples stored in `page_props` continue to decode as page 1 via `ShownLayerSets::sourcePage()`, ensuring full backwards compatibility.

---

### Section 5: Lead Implementation Roadmap

#### Bounded Production-File List for Activation
1. `src/Search/ShownLayerSets.php` (Foundation frozen in J113G; no further changes required).
2. `src/Hooks/WikitextHooks.php`:
   - Line 672 / 685: Update `noteGallerySet` to accept `$thumbnail` or `$page`, propagating `self::sourcePage($thumbnail)` into `ShownLayerSets::note()`.
   - Line 1414 (`preprocessGalleryBlock`): Assess gallery hint page association if multi-page galleries require per-page hints.
3. `src/Search/DrawingSearchText.php`:
   - Line 80: Deduplicate `($kind, $name, $setName)` tuples before calling `LayersDatabase::getSetForSearch()`, preventing duplicated search text.
4. `src/Migration/PageCopyMigration.php`:
   - Lines 444–448: Update `shownKey()` to incorporate the page selector (`$page = 1` for slide; `$page >= 1` for file).
   - Lines 176–196: Update `$shown` iteration to unpack the 4th tuple element (`$entry[3] ?? 1` via `ShownLayerSets::sourcePage($entry)`), and forward the extracted `$page` to `fileSource()`.

#### Existing Test Locations
- **Unit Foundation:** `tests/phpunit/unit/Search/ShownLayerSetsTest.php` (covers representation, page 1 normalization, 50-entry limit, decode validation, sourcePage accessor).
- **Core Search:** `tests/phpunit/core/DrawingSearchTest.php` (covers search indexing, auxiliary text, snippets, reindexing).
- **Core Page Routing:** `tests/phpunit/core/PdfPageRoutingTest.php` (covers wikitext/gallery PDF page routing, thumbnail page extraction).
- **Core Migration:** `tests/phpunit/core/PageCopyMigrationPdfPageTest.php` (covers migration planning and commit with native PDF pages).

#### Missing Counterexamples to Add During Activation
1. **Search Duplication Counterexample:**
   A test in `DrawingSearchTest.php` providing `ShownLayerSets` page property with multiple pages of the same file/set (`[['file', 'Doc.pdf', 'SetA'], ['file', 'Doc.pdf', 'SetA', 2]]`) and asserting that `auxiliary_text` contains each layer text exactly once.
2. **Search 50-Entry Crowding-Out Counterexample:**
   A test proving that when a 50-page PDF document saturates `ShownLayerSets`, secondary files/slides are excluded from search and migration.
3. **Migration Gallery Multi-Page Counterexample:**
   A test in `PageCopyMigrationPdfPageTest.php` with a page containing a gallery showing page 1 and page 2 of a PDF with the same layer set name, proving that both pages are migrated to distinct page-owned surfaces.
4. **Migration Direct + Property Page Disambiguation Counterexample:**
   A test where wikitext directly embeds page 1, and property contains page 2; proving that page 2 is not falsely discarded by direct deduplication.

#### Serial Verification Sequence for Lead Implementation
1. **Stage 1 (Search Collector Deduplication):**
   Implement query deduplication in `DrawingSearchText::get()`. Verify via unit/core search tests that search text is identical whether 1 or $N$ page tuples are supplied.
2. **Stage 2 (Migration Deduplication & Page Forwarding):**
   Update `shownKey()` and property loop in `PageCopyMigration.php`. Verify via `PageCopyMigrationPdfPageTest.php` that multi-page gallery sets migrate both pages and rewrite accurately.
3. **Stage 3 (Gallery Producer Page Propagation):**
   Update `WikitextHooks::noteGallerySet()` to pass `self::sourcePage($thumbnail)`. Verify via `PdfPageRoutingTest.php` that gallery rendering records the correct page 4-tuple.
4. **Stage 4 (Regression & Shared Invariant Gates):**
   Execute full test suite (`phpunit --testsuite unit`, `phpunit --testsuite core`), ensuring all historical triple tests and slide tests pass without regression.

#### Concrete Conflicts and Unresolved Choices
- **Pre-parse gallery hint overwrite:** `preprocessGalleryBlock` strips `layerset=` from `<gallery>` lines and stores hints in `$galleryHints[$filename]`. For multi-page PDFs with different sets per page within one `<gallery>` block, a flat filename key cannot preserve per-page hints. The lead must decide whether gallery hints require page-keyed storage `[$filename][$page]` or if gallery embeds must rely on standard thumbnail processing.
- **50-entry property limit policy:** The lead must determine whether `MAX_ENTRIES = 50` remains a hard cap across all tuples, or if PDF page tuples should share a collapsed file budget entry, or whether documentation should formalize the 50-tuple boundary.

---

### Audit Limitations and Verification Results

- **Limitations:** This audit was strictly read-only and performed during JE1's native test window. No production code or test files were modified. No runtime tests, mutations, Docker commands, or wiki operations were executed.
- **Documentation Verification:**
  - Command: `node scripts/verify-docs.js`
  - Output: `Documentation checks passed: 91 maintained/policy documents, 53 historical records; mirrors, references and MediaWiki source checks agree.`
- **Diff Verification:**
  - Command: `git diff --check docs/J113I_PDF_METADATA_CALLER_AUDIT_PACKET.md`
  - Output: Clean (0 whitespace/formatting errors).

## Lead review and factual corrections — October 4, 2026

The returned audit identifies useful integration hazards: repeated whole-set
search queries, property migration discarding the fourth page field, page-blind
direct/property deduplication, filename-keyed gallery hint overwrite and the
50-stored-tuple crowding counterexample. Those findings are accepted as a
bounded regression map. The report is not accepted wholesale as an activation
specification. A delegated read-only code review found the corrections below;
the lead verified the relevant routing tests and search reader. This appendix
supersedes conflicting statements above without changing the historical report.

| Topic | Corrected fact and supporting code |
| --- | --- |
| Direct/template producer | The method is `WikitextHooks::onInternalParseBeforeLinks()`, not `onParserBeforeInternalParse()`. Its scan follows template expansion (`WikitextHooks.php:1157–1175`). It has no completed thumbnail transform, but file/service/native option resolution is available elsewhere; lack of rendered output does not mean LocalFile properties are inaccessible. |
| Thumbnail page extraction | The existing `WikitextHooks::sourcePage()` checks `getParams()` when available, then public description-link query attributes (`:1085–1096`). Native `ThumbnailImage` has no `getParams()` in the accepted J112B evidence. Use the existing adapter, not an invented thumbnail API or a second raw-options parser. A fallback value alone does not prove rendering succeeded. |
| Native galleries | Ordinary `<gallery>` line `page=2` is supported and exercised by `PdfPageRoutingTest::testNativeGalleryUsesCorePageWithoutShiftingOrdinaryEmbeds()` and `testHintedGalleryThumbnailUsesItsActualTransformPage()`. The selected rendered page can reach the existing thumbnail hook. Filename hint overwrite is not exclusively a PDF-page issue; independently named sets of one file also need occurrence evidence. |
| Cargo galleries | Cargo constructs native gallery thumbnails. Its installed `CargoGalleryFormat.php:50–82,172–173` supplies title/caption/alt/link to `gallery->add()`; it supplies no per-row PDF page selector. The accepted Cargo routing regression verifies rendered default page 1. Repeated Cargo rows do not establish a supported page-selection syntax. |
| Malformed and out-of-range pages | `PageOwnedPilot.php:459–474,760` uses the accepted native page adapter. Valid out-of-range integers clamp to the file's page count; malformed values retain the last valid page/default. Existing native routing and copy tests prove that behavior. Do not prescribe a new out-of-range refusal or silently reinterpret requested pages. |
| Missing rows/surfaces | `PageCopyMigrationPdfPageTest.php:187,212` distinguishes `no-current-set` when the selected legacy row is absent from `file-not-migrated` when its migrated surface is absent. Failed transforms supply no successful rendered-page evidence, even though scan-time metadata may retain syntactic intent or a missing name. |
| ID mechanisms | `layerset=id:123`, `layersetid=7`, numeric owner/name references and `layersbinding` are separate paths. Exact row-ID syntax is excluded from shown metadata; numeric owner/name references follow the page-owned map. A combined `layerset=Notes|layersetid=7` still notes `Notes` in the direct scan, while migration independently refuses the pinned option. Do not describe every mechanism as one universal producer exclusion. |
| Show/hide/default | Empty `layerset=` is not the recorded generic `on` selector: the scan regex requires a nonempty value. Unhinted native/Cargo galleries outside File context already default to `on` (`WikitextHooks.php:638–640`); the report's blanket default-unlayered statement is wrong. Generic resolver synonyms include `1`/`0`, but the direct scan and gallery checks differ. Preserve existing behavior until a separately approved integration addresses it. |
| Shared search | Preserve all returned members within the existing budgets, not an unbounded all-pages guarantee. `LayersDatabase::getSetForSearch()` selects the highest-row-ID name for `''`, then the latest row ID per member page, capped at 200 sets and 16 MiB with its existing per-blob cap. Reverse reindexing remains capped at 500 destination pages per change. The shared reader has no Authority/file-read check, so this audit establishes no new confidentiality guarantee. Existing revision-deletion/core result-read boundaries remain unchanged. |

The unchanged fragment prefix remains compatible with triple/quadruple metadata.
Search query deduplication must use the exact kind/name/selector triple and keep
empty/latest separate from an explicit name, even when both return identical
text. The lead implemented that separable correction in [J113J](J113J_SHARED_SEARCH_QUERY_PACKET.md)
before any producer activation; its evidence and independent follow-up belong
to that packet.

The proposed gallery-only activation sequence is incomplete: native direct and
template producers, effective member selection, property/direct deduplication
and whole-set copy allocation require coordinated lead integration. Merely
forwarding the fourth field can create another per-member allocated name.
Deterministic IDs remain presence guards, never provenance or reconciliation
authorization. Every PDF member keeps one layer-set name within owner/file scope.

The 50-entry counterexample is an activation constraint. Search deduplication
does not repair producer truncation. Documenting a newly reduced search/migration
scope is not approval to introduce it, and G's accepted inactive status does not
prove that its representation needs no integration revision. No new public
budget policy or producer activation is selected here.

[J113K](J113K_NATIVE_PDF_METADATA_EVIDENCE_PACKET.md) delegates bounded native
producer evidence preparation to JE2. It covers actual rendering and unchanged
triple metadata, instead of treating audit examples as runtime proof. It changes
no production caller and advances HIST-4/HIST-8 and SRCH-1 preparation. Broader
integration, protected behavior and charter sign-off remain lead/owner work.
