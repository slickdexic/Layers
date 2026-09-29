# Current status and limitations

## Every drawing save has a summary — September 29, 2026

Part of [charter](../docs/PROJECT_CHARTER.md) criterion HIST-1. The page-owned editor's header has a **Summary** field; the next save publishes it as the page revision's summary and then clears it. When it is left empty, the server writes one in the wiki's content language naming each drawing added, edited, renamed or removed, for example "Renamed drawing “Welcome Slide” to “Renamed probe”". Before this, the editor's Save button published with an empty summary. The `layerspublish` summary is now limited to 500 characters (the page history's own limit) rather than 500 bytes.

Code: `Revision/DrawingAutoSummary.php` (new), `PagePublicationService::publish()`, `PageOwnedSummaryField.js` (new), `APIManager.saveLayers()`; the header styles moved to `PageOwnedHeaderControls.css`.

Fresh verification: unit tests for which changes are named (a rename and an edit of the same drawing give both; key order is not an edit); a native test publishes with an empty, blank and written summary and with a text-only change; Jest for the field and for a save that publishes, clears, or on failure keeps the summary. `page-owned-rename.spec.js` now saves through the Save button with a typed summary and passed. Full native configuration **412 tests passed, 1 skipped**; standalone PHPUnit **1,312**; Jest **15,065**; PHP style clean.

## Rename accepted in the browser; corrected benchmark — September 29, 2026

- **Renaming (HIST-7):** a browser check (J87) confirms that a refused name changes and publishes nothing, that a saved rename keeps the drawing's ID and rewrites the page's embeds and edit link in the same revision, and that a draft keeps a name not yet saved.
- **Benchmark (PERF-0):** typing is now timed to the paint that shows the character; the worst of 20 characters is 17 ms (PERF-4, before the screen refresh). A drawing appears 0.6 s after its image with a warm cache and 8.3 s cold (PERF-2, not met); most of the warm time is the drawing's own fetch, which starts only after the viewer module has loaded. Resizing and panning are not measured yet.
- **Known gap (HIST-1):** the editor's Save button publishes with an empty summary; there is no summary field yet.

Results: `tests/perf/results/2026-09-29-0141-test-wiki.json`.

## Drawings can be renamed in the editor — September 29, 2026

Fifth step of [charter](../docs/PROJECT_CHARTER.md) decision D1 (HIST-7). The page-owned editor's header shows the drawing's name with a **Rename** button. A new name is checked in the browser by the server's rules (1 to 255 characters, none of `| [ ] { } < > :`, and not the name of another drawing on the page, ignoring case, spacing and underscores) and becomes one of the unsaved edits: the local draft keeps it, a revision check keeps it, and the next save publishes it and rewrites the page's embeds that name the drawing. The server still makes the final check.

Code: `PageOwnedNameControl.js` (new), `rename()` in `PageOwnedEditorSession`, `PageOwnedEditorBridge` and `PageOwnedDraftLifecycle`; drafts now store the name.

Fresh verification: new Jest cases for the name rules, reconciliation with a rename, drafts with and without a name, the control, and an editor save that publishes the new name; Jest **15,061**. On the test wiki the editor shows "Drawing: Welcome Slide" with the button, and a refused name gives its message; that check found that a message with literal brackets and braces is not parsed in the browser, so the list of forbidden characters is now passed as a parameter. Full browser acceptance is J87.

## First performance baseline — September 29, 2026

The corrected benchmark (J85) gives the first figures for the [charter](../docs/PROJECT_CHARTER.md)'s performance criteria, measured on the test wiki, whose shared-folder mount makes every server call slow:

- **Met:** a page with drawings loads 83 KB (gzip) of Layers code and a page without drawings none (PERF-1); the editor is ready 1.5 s after pressing Edit with a warm cache (PERF-3); dragging in a 100-layer drawing runs at 60 frames per second (PERF-4, dragging); a page with 20 drawings has no long task (PERF-6).
- **Not met:** saving a 100-layer drawing takes 1.5 s and opening an old revision 2.9 s, both timed in the browser (PERF-5); every edit stores the whole drawing again, a 200 KB image included (PERF-7).
- **Not yet measured correctly:** how soon a drawing appears after its image (PERF-2), and typing delay (PERF-4). J86 corrects both.

Results: `tests/perf/results/2026-09-29-test-wiki.json`.

## Accessibility checks in the browser, four fixes; first benchmark — September 28, 2026

- **Accessibility (UI-3):** `tests/e2e/accessibility.spec.js` runs axe-core (WCAG 2.2 A and AA) on seven Layers screens in Vector 2022 light and dark. Four problems it found are fixed: the page's "Edit page drawing" and adoption links are at least 24 px high; the divider between the layer list and the properties panel has a name and value and can be resized with the arrow keys; the screen-reader announcer no longer sits inside the layer listbox; and the fill type select is named by its label. One remains: layer rows are listbox options that contain buttons, which needs the grid pattern in the design pass. The spec tracks it and fails on anything else.
- **Benchmark (PERF-0):** `npm run bench` measures PERF-1 to PERF-7 on the test wiki. Its first results show that a page without drawings loads no Layers code and the editor is ready 1.7 s after pressing Edit, and they confirm that **PERF-7 is not met**: every edit of a drawing stores the whole drawing again, a 200 KB image layer included. Four measurements are being corrected before the other figures count (J85).

Code: `LayerPanel.js` (divider, announcer), `ui/GradientEditor.js`, `viewer/PageDrawingControls.less`.

Fresh verification: the accessibility spec passed in Chromium with the one tracked violation; new Jest cases for the divider's value and keyboard resizing, the announcer's place, and the labelled select; Jest **15,031**.

## Renaming a drawing keeps its embeds working — September 28, 2026

Fourth step of [charter](../docs/PROJECT_CHARTER.md) decision D1 (HIST-7). When a publication changes a drawing's name, the page's direct embeds that name it (`layerset=<pageId>:<old>`, `{{#Slide:<pageId>:<old>}}`) are rewritten to the new name in the same revision, whether or not the save sends page text. Changes of case, spacing or underscores need no rewrite, since names that differ only in those are the same name. Two drawings can swap names in one save. Embeds of other pages, in templates or in `layersbinding=` form are left as they are.

Bare names (`layerset=<name>`) keep meaning the shared set until the migration, which changes their meaning once (see the [binding plan](../docs/PAGE_OWNED_BINDING_PLAN.md)). The editor has no rename control yet.

Code: `DirectEmbeddingRewriter::renameReferences()`, `PagePublicationService::withRenamedEmbeds()`, `PageHistoryAccess::getStoredMainText()`.

Fresh verification: a unit test rewrites only this page's named embeds (slide and file, with spacing kept) and swaps two names; a native publication test renames a drawing without sending text, then changes only its case, then renames it while sending text. Full native configuration **411 tests passed, 1 skipped**; standalone PHPUnit **1,308**; PHP style clean.

## Adoption writes named embeds; fields name drawings too — September 28, 2026

Third step of [charter](../docs/PROJECT_CHARTER.md) decision D1. Making a shared drawing owned by the page now rewrites the embed to name the new drawing, instead of writing `layersbinding=`:

- `{{#Slide:WelcomePresentation|layerset=default|width=400}}` becomes `{{#Slide:228:WelcomePresentation|width=400}}`: a slide drawing is named after the slide, and the set selector goes.
- `[[File:Pump.png|120px|layerset=labels|Caption]]` becomes `[[File:Pump.png|120px|layerset=228:labels|Caption]]`: an image or PDF drawing is named after its set.
- The name is chosen from the page's current drawings when the adoption is prepared, so a second drawing with a taken name becomes "WelcomePresentation 2" in both the embed and the drawing. Existing `layersbinding=` embeds keep working.
- `{{#layers_fields:}}` accepts the same form for page drawings, `{{#layers_fields: 228:Pump labels | pressure = 12 }}`, next to drawing IDs, `File:` and `Slide:` names.

Code: `DirectEmbeddingRewriter::rewrite()` now takes the page ID and name; `DirectAdoptionPreparationService::nameDrawing()`; `DrawingFields::parserFunction()`; `PageOwnedBinding::resolveNamed()` accepts any kind for fields. The adoption, file-adoption and journey browser specs read the named embed; after the change they passed in Chromium (4 specs, including the journey through slide, image and PDF page two adoption).

Fresh verification: rewriter tests (unit and native) cover the slide target, a PDF with its page, set-selector removal, and refused names; adoption-flow tests expect the named forms and "WelcomePresentation 2"; a native fields test names a drawing by page ID and name and refuses an unknown name and another page's ID. Full native configuration **410 tests passed, 1 skipped**; standalone PHPUnit **1,307**; PHP style clean.

## Embeds can name a page's drawing — September 28, 2026

Second step of [charter](../docs/PROJECT_CHARTER.md) decision D1. A page can show one of its own drawings by name and page ID: `[[File:Pump.png|layerset=228:Pump labels]]` for an image or PDF drawing, `{{#Slide:228:Overview}}` for a slide. Legacy set and slide names cannot contain `:`, so these never mean a shared set.

- **What shows:** the page's one drawing with that name (ignoring case, spacing and underscores), of the embed's kind and, for files, on the embed's file. An unknown name, another page's ID, or a name two older drawings share shows the plain image (or, for a slide, the slide error) and never shared data. Pages show the drawing exactly as with `layersbinding=`: the page output carries only its identity.
- **Editing:** the page's edit links and the editor route open named embeds, and a named embed is never offered for adoption.
- **Not yet:** the editor still writes `layersbinding=` when it adopts; a bare `layerset=name` still means the shared set; renames do not yet rewrite embeds; copying from another page is not built. See the [binding plan](../docs/PAGE_OWNED_BINDING_PLAN.md).
- Code: `PageOwnedBinding::parseNamed()` and `resolveNamed()`, `PageOwnedBindingOptions::named()`, `BoundSlideHooks::named()`, `BoundFileHooks::resolveNamed()`, the file scan in `WikitextHooks`, `SlideHooks` and `PageOwnedPilot`.

Fresh verification: new standalone `NamedDrawingReferenceTest` (3 tests) and native tests for a named file embed and a named slide (shown, edit link and editor route open the right drawing, refused forms show nothing, output varies by revision). Full native configuration **409 tests passed, 1 skipped**; standalone PHPUnit **1,307**; PHP style clean.

## Drawings need a unique name on their page — September 27, 2026

First step of [charter](../docs/PROJECT_CHARTER.md) decision D1, under which a drawing belongs to its page and is identified by the page plus its name. Publishing a new or changed page-owned drawing now requires a name that is unique on the page and can be written into an embed: 1 to 255 characters, no spaces at either end or in a row, and none of `| [ ] { } < > :`. Names that differ only in case, spacing or underscores count as the same. A refused save says which name and why. Drawings that are not changed are not rechecked, and adopting a second drawing with a name already on the page adds the first free number ("default 2").

Code: `Revision\DrawingName`, called from `PagePublicationService::publish()` and `PageOwnedAdoptionService`; messages `layers-invalid-snapshot-name` and `-name-taken`. The contract for the remaining steps (named embeds, renames, copying from another page) is in the [binding plan](../docs/PAGE_OWNED_BINDING_PLAN.md).

Fresh verification: new standalone `DrawingNameTest` (4 tests) and a native publication test refusing a case variant, an underscore variant, `|` and a page-ID prefix, then accepting "Ideas 2"; the adoption test now expects "Welcome Slide 2" for the second of two same-named adoptions. Full native configuration **407 tests passed, 1 skipped**; standalone PHPUnit **1,304**; Jest **15,029**; PHP style clean.

## Search verified in a browser — September 27, 2026

J80 checked in Chromium, on the test wiki's database search, that `Special:Search` finds a page by words that exist only in a shared layer set or slide it shows, with the drawing text as a highlighted snippet, and that the file's `File:` page is found by its set's text. Saving a new revision of the set, deleting the slide, restoring the page and deleting the set each changed the results by the next page load, without editing the page. No product code changed.

- **Finding files:** `Special:Search` looks only in the main namespace unless the reader chooses more. A file's page is found by its layer text only when the File namespace is searched (for example the **Multimedia** or **Everything** profile, or `ns6=1`). This is core behaviour.

## A refused page-owned save reaches the server — September 27, 2026

The page-owned editor ran the editor's own checks before saving, so a value the server would refuse, such as a stroke width of 150, never reached page history. Instead the editor showed "⧼layers-save-validation-error⧽: Layer 1: Stroke width must be between $1 and $2", which names neither the layer nor the property. J79 found this in Chromium.

- **Page-owned saves** now go straight to the server, whose refusal names the layer and property ("The layer "Warning box" has a "strokeWidth" value that cannot be stored. Your changes were not saved."). The server's rules are the only ones for page history.
- **Ordinary saves** of shared layer sets keep the editor's checks, and the message is now complete: "Layer validation failed: Layer 1: Stroke width must be between 0 and 100". The message key was missing, and the limits in the validator's range, type and count messages were never filled in.
- **One notice per failure:** a failed ordinary save no longer adds a second notice with the raw server text, "Validation failed" or "Data too large", or the English "Save failed: validation error. Check browser console (F12) for details." Failures `APIManager` has already shown are rejected with `reported: true`, and the editor adds nothing.
- **Checker:** `verify-i18n-wiring.js` did not see `window.layersMessages.get(` calls, which is how the missing key passed every gate. It sees them now and found no other missing key.

Fresh verification: J79's spec `page-owned-refusal-message.spec.js`, corrected so the first Save must reach the server, **1 passed** (47 s); with client validation put back for page-owned saves it fails waiting for the request. A one-off Chromium check of the ordinary file editor showed exactly one notice, "Layer validation failed: Layer 1: Stroke width must be between 0 and 100", and no save request. Jest **15,029** (a page-owned save skips the client validator, a reported failure is not repeated, a range message names its limits).

## Shared layer sets and slides show values from the page too — September 26, 2026

`{{#layers_fields:}}` worked only for page-owned drawings, which need the page history pilot. The first parameter may now also name a file, `{{#layers_fields: File:Pump.png | pressure = … }}`, for every shared layer set of that file the page shows, or a slide, `{{#layers_fields: Slide:Line_overview | … }}`. So Cargo data can appear in annotations on any wiki.

- **Where values show:** in the page's image viewer and slide viewer, and in the full-size view with its print and download, which use the same values. As before, the editor, the history viewer, search, Cargo rows, and now server-rendered thumbnails and PDF exports show the tokens.
- **Keys:** `File:` names are normalized like titles (`File:pump diagram.png` and `Image:Pump_diagram.png` are the same file); slide names follow the slide name rules. Anything else that is not a drawing ID shows the error, whose text now lists the three forms.
- Code: the token filling moved to `ext.layers.shared/DrawingFields.js` (`window.Layers.DrawingFields`), used by the page-owned bootstrap, `ViewerManager.initializeViewer()`, `SlideController` and `LayersLightbox`; `Hooks\DrawingFields::drawingKey()` names the drawing on the server.

Fresh verification: native `DrawingFieldsTest` (10 tests) adds file keys from two spellings and a slide key, and errors for a non-file page and an empty slide name. Jest covers the shared helper, a file's values in `initializeViewer()`, a slide's values on first draw and redraw, and the full-size view (not refilled for slides). A second Chromium test in `page-owned-fields.spec.js` saves a shared set on a file and a slide, each with a literal row and a token row, embeds both with `{{#layers_fields:}}` values and checks that each viewer draws the two rows identically; with token filling disabled both browser tests fail. Full native configuration **406 tests passed, 1 skipped**; Jest **15,026**, standalone PHPUnit **1,300**.

## Pages are found by the drawings they show — September 26, 2026

The previous change made a file's layer sets searchable, but only on the file's own `File:` page. Readers search for the article, and an article that shows an annotated diagram with `[[File:Diagram.png|layerset=labels]]` or a slide with `{{#Slide:Name}}` was still not found by the words drawn on it. It now is.

- **What is indexed:** with a page's own text, the text of each shared layer set and slide it shows: the latest revision of the named set, or for `layerset=on` and a slide without `layerset=` whichever set was saved most recently, every PDF page included. Visible text, text box and callout layers count, as elsewhere. Embeds that come from templates count too. Page-owned drawings and file pages are indexed as before.
- **How:** parsing records the shared sets a page shows in a page property, `layers-shown-sets` (sorted, so it does not depend on parse order; at most 50). The page is reindexed when it is edited, when its links are refreshed (for example after a template it uses changes), and when one of the sets it shows is saved, deleted or renamed, which is not an edit of the page: then every page listing that file or slide (up to 500 at once) is reindexed.
- **Existing pages:** run core's `refreshLinks.php` once so each page records the sets it shows; each refresh also reindexes the page. `reindexPageDrawings.php` then covers pages that already recorded them, for example after `rebuildtextindex.php`.
- **Not covered:** images in `<gallery>` blocks and Cargo galleries, sets referenced by ID (`layerset=id:…`), and pages beyond the first 500 when a widely shown set changes (they follow at their next edit or links refresh).
- Code: `Search\ShownLayerSets` (recorded by `WikitextHooks::onInternalParseBeforeLinks()` and `SlideHooks`), `DrawingSearchText::get()`, `updatePagesShowing()` (called through `CacheInvalidationTrait`, including the slide save, delete and rename paths), and `DrawingSearchHooks::onLinksUpdateComplete()`. The page property is read straight from the database, because `PageProps` caches values within a request.

Fresh verification: new native tests show an article is found by the words of the set it embeds and not by another set's; a new set revision reindexes it without an edit; `layerset=on` follows the most recently saved set; a template change reaches the page through its links refresh (with the links-update reindex disabled this fails); removing the embed removes the words; a page showing a slide follows the slide's saves; the maintenance script indexes pages that recorded sets while indexing was off; and the property is the same whatever the order of embeds, skipping `layerset=off`. The first version read the property through `PageProps`, whose request cache returned the old list after an edit; the direct read fixed that. Full native configuration **403 tests passed, 1 skipped**; Jest **15,020**, standalone PHPUnit **1,300**. On the local wiki, after `refreshLinks.php` for one page that embeds `ImageTest02.jpg` sets 005, 101 and Test_Gradient, a search for "Highlight", a word only in set 005, lists that page.

## Drawings can show values from the page, including Cargo data — September 26, 2026

A page-owned drawing can now show values that its page supplies. Type `{{name}}` in a text, text box or callout layer, and give the value on the owner page with `{{#layers_fields: drawing ID | name = value }}`. The value is ordinary wikitext, so it can come from a `#cargo_query`, a template, Semantic MediaWiki or any parser function. This is the first form of Cargo field bindings: a label on a pump diagram can show the pump's pressure from a Cargo table.

- **How values flow:** the parser function expands each value, turns it into plain text (links keep their text, formatting and tags are dropped, 1,000 characters at most) and stores it in the page output as `wgLayersDrawingFields`, as a set of drawing, name and value entries, which core requires so that page output does not depend on parse order. The drawing ID is the last part of `layersbinding=`. A name given two different values is left unfilled. When the page shows the drawing, the viewer replaces each `{{name}}` it has a value for; unknown names stay as typed. Values update whenever the page is rendered again, like a query in the page text, and never change the drawing, its history or its search text.
- **Where values show:** only where the page shows the drawing, on the current page and on old revisions. The editor, the history viewer, diffs, search and `{{#layers_cargo_store:}}` see the tokens. In rich text each formatted run is filled on its own, so formatting must cover a whole token.
- **Errors:** a malformed call shows a short error in its place (`layers-fields-invalid-drawing`, `layers-fields-invalid-field`, `layers-fields-too-many`); at most 100 fields per drawing and 50 drawings per page.
- **Not covered:** shared (legacy) layer sets on files, and values bound per layer rather than by token.
- Code: `Hooks\DrawingFields` (registered in `WikitextHooks::onParserFirstCallInit()`, magic word `layers_fields`), `PageOwnedRevisionBootstrap.withFields()`. Usage is in [wikitext usage](https://github.com/slickdexic/Layers/blob/main/docs/WIKITEXT_USAGE.md).

Fresh verification: native `DrawingFieldsTest` (7 tests) turns bold text, a template with a link, tags and an entity into plain-text entries, keeps one entry per call, and shows the right error for a missing or binding-style ID, a field without a value, a bad name and 101 fields. Jest checks that tokens in text and rich-text runs are filled only for their drawing, that unknown names and non-text values stay as typed, that the stored bundle is untouched, and that conflicting or malformed entries are left out. The first version stored one map with `setJsConfigVar()`, which core refuses when a second call changes it; values are now order-independent entries. A new Chromium check, `page-owned-fields.spec.js`, seeds a drawing with a literal "Pressure 12 bar" row and a "Pressure {{pressure}}" row, gives `pressure = 12 [[bar]]` on the page, and checks that the page draws both rows identically while the history viewer shows the token: passed (44 s). Full native configuration **399 tests passed, 1 skipped**; Jest **15,020**.

## Anonymous readers' drawings can be cached — September 26, 2026

Page HTML holds only drawing identities, and each page view fetches its drawings from `layersread` (`binding=`). That response was never cacheable, so on a public wiki every anonymous page view with page-owned drawings reached PHP, and a CDN could not help. This was an open item since lead B04.

- **What is cached:** an anonymous reader's binding read of a page's **current** revision may now be kept by the browser and the CDN for `$wgLayersBindingReadMaxAge` seconds (default 300; 0 turns it off). Every anonymous reader has the same rights, and the current revision cannot be hidden while it is current. The module sets the age itself, so the `maxage`/`smaxage` a client sends do not apply.
- **What is never cached publicly:** logged-in readers and anonymous readers with a session (MediaWiki marks those responses private), reads of older revisions (they can be hidden later), full `layersread` snapshot reads used by history and the editor, errors, and any response on a wiki where not everyone may read.
- **Limit:** after a page is deleted, or a revision that has just stopped being current is hidden, a cached copy can be served for up to the configured age. Lower the setting if that matters more than load.
- Code: `ApiLayersRead` (constructor argument `bindingMaxAge`, from `PageOwnedPilot::newReadApi()`); setting in `extension.json`.

Fresh verification: a new `ApiLayersReadTest` case reads as an anonymous user. The current revision is `anon-public-user-private` with a 300-second age, although the request asks for 3600; the same revision once superseded is private; a setting of 0 keeps the new current revision private. A cached lookup had made the superseded revision look current within one process, so the check reads the primary database. On the local wiki an anonymous binding read of the owner's current revision returns `Cache-Control: max-age=300, s-maxage=300, public` with `Vary: Accept-Encoding,Treat-as-Untrusted,Cookie`; an older revision, and the same request with a session cookie, return private. Full native configuration **392 tests passed, 1 skipped**; Jest **15,018**, standalone PHPUnit **1,300**. One serial Chromium run of the twelve earlier page-owned specs on this code passed 17 of 22 tests: the journey spec ran past its 180-second limit on the slow Windows-mounted test wiki, its interrupted cleanup left the automation owner changed, and the four specs after it stopped under the ten-minute rule. The lead restored the owner, the isolation page and the journey's test sets, doubled the specs' own limits (they are ceilings, not waits), and reran those five with the new fields spec: **6 passed** (the journey spec took 3.2 minutes).

## A file's layer sets are searchable — September 26, 2026

Search found words in page-owned drawings only. Layer sets saved on files, which is what every wiki without the page-history pilot uses, were not indexed at all, so a search for a label drawn on a diagram found nothing. A file's `File:` page is now found by the text of its layer sets.

- **What is indexed:** with the file page's own text, the text of the visible text, text box and callout layers in the latest revision of each of the file's layer sets. Every PDF page is included, and so are sets saved on an earlier version of the file, which an embed that names them still shows. Hidden layers are not indexed. Page-owned drawings are indexed as before.
- **When:** saving, deleting or renaming a set reindexes the file page at once; editing the file page keeps the set text. For files that had sets before this change, run `php maintenance/run.php extensions/Layers/maintenance/reindexPageDrawings.php` once (it now covers files as well as page-owned drawings), and again after core's `rebuildtextindex.php`.
- **Not covered:** a result for a file page shows no snippet from its layer text, because core renders file results with a thumbnail and does not run the `ShowSearchHit` hook for them. Pages that only embed the file are not found by its layer text; the file page is, and lists them under "File usage". Slides are not indexed. Search engines that build documents from page data, such as CirrusSearch, receive the text as `auxiliary_text`, still untested on a real CirrusSearch install.
- Code: `DrawingSearchText` (service `LayersDrawingSearchText`) is now the one source of drawing words for search. The ingress and search hooks, renamed `DrawingSearchIngress` and `DrawingSearchHooks`, are registered on every wiki, not only with the pilot. Set changes reindex through `CacheInvalidationTrait`, which every set write path already calls. Reads are bounded to 200 sets and 16 MB of stored data per file.

Fresh verification: new native tests upload a file, save two sets through `layerssave` and check that the file page is found by both, not by a hidden layer, that a new set revision replaces its words, that a later page edit keeps them, that renaming keeps and deleting removes them, that the maintenance script indexes sets saved while indexing was off, and that search documents carry the text. With the ingress disabled, the page-owned and file tests fail. Full native configuration **391 tests passed, 1 skipped**; Jest **15,018**, standalone PHPUnit **1,300**. On the local wiki the script indexed 6 pages, and database search for words found only in file sets ("Arrows", "textbox", "CCL") now lists those files.

## Refused page-owned saves name the layer — September 26, 2026

When page history refused a drawing because the server would have dropped or changed a value, the editor said only "Publication failed: layers-invalid-snapshot". Finding the cause took a developer and the browser console; every packet from J76 to J78 hit this. The message now names the layer and, where it can, the property, for example: *The layer "Warning box" has a "strokeWidth" value that cannot be stored. Your changes were not saved.*

- **Server:** `DocumentSchema` finds the first layer that would not be stored as sent, and the first property the validator would drop or rewrite (`LossyLayerException`). `layerspublish` still returns the code `layers-invalid-snapshot`, now with `layers-invalid-snapshot-property` or `layers-invalid-snapshot-layer` as its text. The layer is named by its name, or its ID if it has none, cut to 80 characters; a property name is reported only if it is a plain identifier. A limit over the whole drawing keeps the generic message.
- **Editor:** `PageOwnedPublishClient` now keeps `mw.Api`'s error details, which adopting its promise used to drop, and shows the server's text for this one code only, up to 300 characters. Every other error keeps its fixed message, so no other server text reaches the page.

Fresh verification: `DocumentSchemaTest` names the layer and property for a dropped key on a named layer and a rewritten colour on an unnamed one, and the layer alone for a refused layer; a native `ApiLayersPublishTest` case checks the error code and message for an out-of-range stroke width; two client tests check the reason is shown from a two-argument `mw.Api` rejection and is not shown when too long or for another code.

## Properties panel values save as set — September 26, 2026

A new check drives every control of the properties panel, for every layer type, to its lowest and its highest choice, and the server must store the result unchanged. It found five places where the panel offered a value that the server dropped or rewrote. Page history then refused the drawing, and ordinary saves silently lost the value.

- **Marker value:** the field accepts labels such as "1A" or "2.1", and both renderers draw them, but the validator kept only numbers. The field always sends text, so page history refused even "2". A marker value is now a number or a label of up to 16 characters, and the field stops at 16.
- **Stroke width:** the panel allowed up to 200, while the server, the toolbar and the client validator allow 100. It now stops at 100. A text layer's text stroke width allowed 200 (the server allows 50 and text boxes 20) and now stops at 20.
- **Text shadow:** turning it on wrote the default colour as `rgba(0,0,0,0.5)`, which the server respaces. It is now written the way the server stores it.
- **Radial gradients:** the gradient editor wrote an `undefined` angle, so no drawing with a radial gradient could be saved in page history. Unset gradient fields are now omitted.
- **Exports:** server-rendered thumbnails and PDFs drew "letter circled" markers as numbers, because the renderer checked a style name the editor never writes.

Fresh verification: `PropertiesPanelValues.test.js` produces `properties-panel-document-v1.json`, which `DocumentSchemaTest` publishes; new validator tests for marker values and an export test for the letter style. Jest **15,016**, standalone PHPUnit **1,297**, full native configuration **387 tests passed, 1 skipped**. The J78 browser run drives the panel on a seeded drawing (see the review ledger); with it, one serial Chromium run of all twelve page-owned specs passed (**22 passed**).

## Arrows and cleared properties no longer block page-owned saves — September 26, 2026

The J77 browser run found that no page-owned drawing containing an arrow could be saved: the arrow tool stored three options (head type, head scale and tail width) as `undefined` when the toolbar had not set them, and the editor refuses to send a drawing that is not plain JSON. It failed before any request with only "Invalid editor snapshot". The same happens whenever a control clears a property by setting it to `null` or `undefined`; switching a gradient fill back to solid did this, and the server then refused the drawing because it never stores such values.

- The arrow tool sets those options only when the toolbar has them.
- `PageOwnedEditorBridge` publishes any layer property the editor holds as `null` or `undefined` as absent, which matches what the server stores. Drafts are saved the same way. Everything else must still pass validation unchanged.
- The editor-output check (`EditorCreatedLayers.test.js`) had missed this because `toEqual` ignores `undefined` keys. It now compares strictly and also runs the client's snapshot check.

Fresh verification: the J77 spec, which draws every remaining tool through the editor, formats text box runs, types a tolerance, saves, checks the page, viewer and diff, and saves a colour change, passes with no workaround. One serial Chromium run of all eleven page-owned specs passed (**21 passed**). Jest **15,015** (a new bridge test publishes a cleared `gradient` and an `undefined` option as absent; the editor-output check now fails on an `undefined` key), standalone PHPUnit **1,295**.

## Drawings made in the page-owned editor save as drawn — September 26, 2026

Page history stores exactly what the editor sends and refuses a drawing the server would change. Several editor defaults did not survive the server's checks. The J76 browser run could not save any drawing containing a marker or a layer set to a blend mode, and a new unit check found the same for dimensions, angle dimensions, and text boxes or callouts left empty. Each failed with only "layers-invalid-snapshot". Everything the drawing tools make now saves unchanged.

- **Server:** the marker's font size adjustment is stored (−10 to 20) instead of dropped. Font family lists keep their commas: `Arial, sans-serif`, the editor's default for every text tool, used to be saved as the non-existent font `Arial sans-serif`. An empty `text` is valid on text boxes, callouts and dimensions; text layers still need text. Ordinary (shared) saves benefit too: they silently lost the adjustment and broke the font list, and server-rendered thumbnails now honour the adjustment. Sets saved before this keep what was stored.
- **Editor:** the properties panel sets `blendMode` instead of the retired `blend` alias, and loading no longer recreates `blend`. The editor canvas now draws a stored `blendMode`; before, a page-owned drawing's blend mode was invisible while editing. Dimension and angle dimension tools store tolerances only when set, as the strings the user typed, instead of numeric zeros.
- **Recovery prompt:** reopening the editor after a save offered the save's own backup for recovery, because stored drawings have sorted keys and the comparison did not ignore order. Keeping the draft then blocked saving. The comparison now ignores key order, so an unchanged backup is not offered.
- **Regression check:** `tests/jest/EditorCreatedLayers.test.js` draws every drawing tool through the real canvas code with the editor's defaults and must equal `tests/fixtures/revisions/editor-created-document-v1.json`; `DocumentSchemaTest` publishes that fixture and fails if the server would change it. After an intended change to a tool's output, regenerate the fixture with `LAYERS_UPDATE_FIXTURES=1` and run both.

Fresh verification: the J76 spec, which creates a marker, Shape Library shape, emoji, imported image, folder and multiply blend through the editor, hides the folder and restores the first version, passes with no workaround. One serial Chromium run of all ten page-owned specs (20 tests) passed 13; three failed and four were skipped after a failure in the same file. Two failures came from the automation owner's lost baseline drawing, which the Cargo and workflow specs expect (see the review ledger), and one from a rendering check that could stop waiting before its SVG shape had decoded, because white also has full blue. With the baseline restored and that wait corrected, those three spec files passed (**11 passed**), so all 20 pass. Jest **15,014**, standalone PHPUnit **1,295**, full native configuration **386 tests passed, 1 skipped** (one bound-file test that reused an upload name across tests could collide on same-second archive names; each test now uploads its own file).

## Search results show the matching drawing text — September 26, 2026

When a page was found only through words in its drawings, `Special:Search` showed a snippet of unrelated page text with nothing highlighted, so readers could not tell why the page matched. Such a result now shows the drawing text around the match, highlighted like a page-text match. Results that matched the page text keep core's snippet.

- Code: `PageOwnedSearchHooks::onShowSearchHit()` (`ShowSearchHit`, registered with the pilot hooks). It uses the same visible drawing text as the index, only for the page's current revision, never for hidden revision content or pages outside the pilot. Core's result list has already checked the reader may read the page, and core's highlighter escapes the text.
- This covers database search, which is what the hook receives search terms from. CirrusSearch builds its own snippets from `auxiliary_text`.

Fresh verification: new `PageOwnedSearchTest` case checks the highlighted, escaped drawing snippet, that a page-text match, missing terms and an absent term leave core's extract alone, and that nothing changes outside the pilot. Search and registration tests pass (**23 tests**). On the local wiki, a search for "Visual ideas", which appears only in the pilot pages' drawings, now lists both pages with those words highlighted.

## Whole namespaces can take part in page history — September 26, 2026

The pilot could only be switched on for pages listed one by one, by exact title, in `$wgLayersPageOwnedPilotOwners`. That made it impractical beyond a few test pages. `$wgLayersPageOwnedPilotNamespaces` now enrolls every page of the given namespaces as well, for example `[ NS_MAIN ]`.

- **What enrollment does:** it only decides where ownership may start, so editors of an enrolled page see adoption offers for its shared slides and file drawings. A page that owns no drawings otherwise behaves like any other page, and a page that owns drawings keeps them wherever it is moved. Every guard (save admission, import, merge, undelete) is keyed to owned drawings, not to enrollment, so enrolling a namespace refuses nothing new.
- **Switching off:** with both lists empty the pilot is not installed and nothing takes part, as before. Do not empty both while page-owned drawings exist.
- Code: `PageOwnedScope` (namespaces validated as non-negative integers), `PageOwnedPilot`, service wiring and `PageOwnedPilotRegistration`.

Fresh verification: a new registration test enrolls only the main namespace and checks that the slot role and guards are installed, that a new main-namespace page can publish while a Project page is refused, that a talk page is not enrolled, and that invalid namespace settings are rejected. Full native configuration **385 tests passed, 1 skipped**.

## Page history draws every layer type — September 26, 2026

Page-owned drawings can now contain everything the editor makes: imported images, Shape Library shapes and emoji, numbered markers and layer folders. Before, the page-history painter could not draw these, so the page-owned editor hid their tools, and saving or adopting a drawing that used them was refused. Many real drawings could therefore not be moved into page history at all.

- **Drawing:** the painter used for page-owned drawings everywhere (on pages, in history, diffs and the viewer) draws image, custom shape and marker layers with the same shared renderers as the ordinary viewer, and repaints the snapshot whenever an image or SVG shape finishes decoding. Folders draw nothing themselves; their members draw by their own visibility, as in the editor, which hides members when a folder is hidden.
- **Blend modes fixed:** this painter silently ignored layer blend modes (multiply, screen and so on), so page-owned drawings could look different from the editor. They now apply per layer, as in the ordinary viewer.
- **Editor and adoption:** the page-owned editor offers the marker tool, Shape Library, emoji picker and image import again, and publication and adoption accept these layers. `PageOwnedRenderCapability::LAYER_TYPES` now lists every type the validator accepts. The gate stays, so a layer type added later is refused until page history can draw it.
- **Unchanged:** the glow effect is drawn only inside the editor, as it already was for the ordinary viewer.

Fresh verification: Jest **15,010** (the painter draws image, shape and marker layers, skips folders but draws their members, repaints on each decode and not after disposal, and applies a blend mode to that layer only; the toolbar offers the same tools in both modes). A new Chromium check paints a real image layer, an SVG shape, a marker, a folder member and a multiply blend, and checks exact pixels. Native tests that relied on these layers being refused now prove the opposite: a marker saves on a page with bound slides and reaches the reader bundle, a legacy drawing with a folder and a marker prepares for adoption with membership intact, slide and file adoption confirmations are offered for marker drawings, and an unknown legacy layer type is still refused at conversion. Full native configuration **384 tests passed, 1 skipped**. One serial Chromium run of all nine page-owned specs passed 18 of 19. The one failure was the J64 adoption spec, which expected a marker drawing to be refused; it now expects the confirmation form and passes. The two refusal messages no longer name specific layer types, since none of today's types is refused.

## Page-owned drawing text can be stored in Cargo — September 26, 2026

A page's own drawings can now be stored as Cargo rows, so their text can be queried with `#cargo_query` like any other Cargo data. This was the next priority after page history and search.

- **How:** a template declares a table with some or all of the fields `surface_id`, `surface_label`, `surface_kind`, `source_file`, `source_page` and `drawing_text`, and calls `{{#layers_cargo_store:}}` (or `{{#layers_cargo_store:_table=Name}}`). Put the template on the owner page. The function shows nothing on the page.
- **When rows change:** the rows are passed to Cargo's own `#cargo_store`, so Cargo writes and replaces them on every save of the page (drawing-only saves included, because Cargo reparses the page after each save) and rebuilds them on "recreate data". Layers adds no write path of its own. Cargo's reparse carries no revision ID, which the parser treats as a preview, so only while Cargo is storing does the function read the page's current revision; any other parse without a revision ID stores nothing.
- **What is stored:** one row per drawing of the page's current revision: its ID, label and kind (`slide`, `image` or `pdf`), the pinned file and PDF page for image and PDF drawings, and the text of its visible text, text box and callout layers, one per line. Every field is passed, blank ones empty, so Cargo never fills them from the template's own arguments. Nothing is stored outside the pilot, for a page that owns no drawings, or for a revision whose content is hidden. Shared (legacy) layer sets are not covered, and there are still no field bindings (drawing elements that show Cargo values).
- Code: `PageOwnedCargoStore`, registered in `WikitextHooks::onParserFirstCallInit()` only when Cargo is installed; text extraction shared with search (`PageDrawingSearchText::layerText()`). Usage is in [wikitext usage](https://github.com/slickdexic/Layers/blob/main/docs/WIKITEXT_USAGE.md).

Fresh verification: new `PageOwnedCargoStoreTest` checks the rows for two revisions (multi-line text containing `=`), the exact `#cargo_store` arguments with and without `_table`, that the page shows nothing, that rows built the way Cargo reparses after a save (its origin set, no revision ID) describe the revision just saved while an ordinary parse without a revision ID projects nothing, and that nothing is projected when the pilot is off, the owner list is empty, or another page is parsed. Full native configuration **384 tests passed, 1 skipped**; search tests still pass after the shared extraction change. Storing into a real Cargo table on the test wiki is J75.

## Text in page-owned drawings is searchable — September 26, 2026

The wiki's own search now finds a page by the words in its page-owned drawings, which was the next priority after page history.

- **What is indexed:** for a page whose current revision owns drawings, its text together with each drawing's label and the text of its visible text, text box and callout layers (rich-text runs included). Hidden layers are not indexed. Only the current revision is indexed, as for page text.
- **How:** core indexes only the main slot, and only when it changes. `PageOwnedSearchIngress` listens to the same domain event after core's own search ingress and rewrites the page's entry with page text plus drawing text (`PageDrawingSearchIndex`, `PageDrawingSearchText`). It runs when the page text or the drawings change, on moves and on reconciliation, so drawing-only saves reindex too and old drawing words drop out.
- **Existing pages:** run `php maintenance/run.php extensions/Layers/maintenance/reindexPageDrawings.php` once, and again after core's `rebuildtextindex.php`, which indexes page text only. It was run on the local test wiki and indexed 2 pages.
- **CirrusSearch and similar engines:** engines that build documents from content handler data get the same drawing text in `auxiliary_text` through `SearchDataForIndex2` (`PageOwnedSearchHooks`). This is unit-tested; CirrusSearch itself is not installed on the test wiki.
- **Limits:** result snippets come from page text, so a match found only in a drawing shows no highlighted snippet. Shared (legacy) layer sets on files are not indexed.

Fresh verification: new `PageOwnedSearchTest` runs against the database search engine rather than the test dummy. It checks that drawing words and page words are found, that a drawing-only change replaces the old drawing words, that a later text-only edit keeps the drawing words (so this ingress's update is the one that stays), that the maintenance script indexes drawings saved while indexing was off, and what text is extracted (rich text, hidden layers, unreadable content). Full native configuration **380 tests passed, 1 skipped** (including J74 work in progress); standalone PHPUnit **1,294**; `npm test` passes; PHP style 0 errors. On the local wiki, a search for a word that appears only in the pilot pages' drawings now lists both pilot pages.

## Diff pages show changed drawings side by side — September 26, 2026

A diff between two revisions of a page that owns drawings now starts with a **Drawing changes** section: each drawing that was added, removed or changed, drawn at the older revision on the left and the newer on the right. Unchanged drawings are left out, and text-only edits show no section. Before, the only comparison was the pretty-printed JSON diff below it, which stays.

- **Privacy and caching:** the section carries only identities (binding and revision). The reader's browser fetches each side through `layersread` with its own session, exactly like drawings on the page. If either revision's drawings are hidden from the reader, nothing is compared.
- **History links for every kind:** page-history rows linked only slide drawings to the viewer; image and PDF drawings, which the viewer has shown since this morning, are now linked too.
- Code: `PageDrawingDiff` (via `PageOwnedPilot::getDrawingChanges()`), `PageOwnedDiffHooks` (`DifferenceEngineShowDiff`), `loadComparison()` in the history bootstrap, styles in `ext.layers.pageControls.styles`.

Fresh verification: new `PageOwnedDiffHooksTest` (changed drawing shown at both revisions and unchanged ones left out, text-only edit shows nothing, removed and added drawings, hidden drawings, pilot disabled) and a history-listing assertion for image and PDF surfaces; two new Jest cases for the comparison loader (each side read at its own revision, a reply for another revision never fills a side, failed reads stay unavailable). Full native configuration **376 tests passed, 1 skipped** (including J74 work in progress); Jest **15,021**; `npm test` passes; PHP style 0 errors. In a logged-in Chromium check (read-only), a real diff of the automation owner showed a slide, a photo and PDF page two on the left, each marked removed on the right.

## Earlier drawing versions can be restored from the viewer — September 26, 2026

Editors viewing an earlier version of a page-owned drawing on `Special:ViewLayersPage` now get a **Restore this version** button below it.

- **What it does:** publishes one new page revision in which that drawing is replaced by the version being viewed. The page text and the page's other drawings stay as they are now, unlike rollback, which reverts the whole page. The edit summary names the drawing and the revision it came from, and the revision is tagged `layers-page-drawing`.
- **When it is offered:** only to users who may edit the page and have `editlayers`, only for an earlier revision, and only when the drawing still exists and differs from its current version. Readers see the viewer exactly as before.
- **Safety:** the form carries the current revision it was shown against. If the page changed meanwhile, or the form is submitted twice, nothing is saved and a message says so. The copied drawing goes through normal publication, so it must still pass current validation and renderability; the save rate limit applies.
- Code: `PageSurfaceRestore` (via `PageOwnedPilot::newSurfaceRestore()`) and `SpecialViewLayersPage`.

Fresh verification: new `PageSurfaceRestoreTest` covers the offer (not for the current version, a missing drawing or a reader), a restore that changes only that drawing, the tag and summary, a stale form, and the viewer's GET, POST, redirect and repeated submission. Full native configuration **372 tests passed, 1 skipped** (including J74 work in progress); `npm test` passes; PHP style 0 errors. A logged-in Chromium screenshot of an old automation-owner revision shows the viewer with the explanation and button below the drawing (read-only check, nothing submitted).

## Rollback restores page-owned drawings — September 26, 2026

Native rollback now works on pages that own drawings. Before, rolling back an edit that changed a drawing failed with "Direct or unauthorized changes to the Layers revision slot are not permitted", so vandalised drawings could not be reverted from page history.

- **Rule:** outside publication, a save may set the drawing slot only to the exact drawings of an earlier revision of the same page (`PageDrawingRevert`). That content passed publication when it was first saved. The earlier revision must not have its content hidden by revision deletion, and the user needs `editlayers` as well as core's rollback rights.
- **Still refused:** copying another page's drawings in (even through `PageUpdater::inheritSlot`), restoring hidden drawings, any new drawing content, and removing the slot. Rolling back to a revision from before the page owned drawings therefore still fails; the page keeps its drawings.

Fresh verification: `PageOwnedRollbackTest` now covers rollback of a drawing change (the previous drawings and text become current), a main-text-only rollback, refusal without `editlayers`, refusal to remove the slot, and refusals for another page's drawings and for hidden drawings. The shared test harness installs the same revert rule as production. Full native configuration **369 tests passed, 1 skipped** (including J74 work in progress); PHP style 0 errors.

## Page-owned drawings follow their page through moves and restores — September 26, 2026

The pilot's lifecycle guards now follow what a page owns rather than its title (lead B04).

- **One scope rule:** `PageOwnedScope` decides which pages take part. A page takes part if its current revision carries the drawing slot, which only publication can write, or if its title is enrolled in `$wgLayersPageOwnedPilotOwners`. The publish and read APIs, parser bindings, editor, viewer, adoption and every guard use it; the separate title comparisons are gone. With no enrolled titles the pilot is not installed and nothing takes part.
- **Moves:** allowed, with no Layers guard. The page keeps its PageID, history, drawings and bindings under the new title, and the editor, viewer and adoption work there. The redirect left at the old title is a different page: it cannot show the drawings, and a session opened before the move cannot save onto it. Removing a title from the list now stops only new ownership.
- **Delete and restore:** deletion is unchanged. Revisions with drawings are restored only onto their own page: no page may exist at the title, and every restored revision with drawings must come from one deleted page whose ID is still free, so MediaWiki restores that same ID. Otherwise Special:Undelete refuses with a clear message (`layers-restore-drawings-denied`) and restores nothing. Restoring anything onto a page that owns drawings is refused the same way, because a restored revision could replace its current drawings. Ordinary restores are unchanged.
- **Import and merge:** still refused wherever drawings are involved. No revision may import the drawing slot or model, a page that owns drawings takes no imports, and history cannot be merged into or out of a page that owns drawings. An enrolled title that owns nothing imports and merges normally.
- **Drafts** stay keyed by title and base revision. A base revision belongs to exactly one page and every move creates a new revision, so a draft from before a move is treated like any draft whose base was superseded, and is never offered on another page.

Fresh verification: the rewritten `PageOwnedPilotLifecycleTest` (9 tests) covers a move (binding parse, bound read, editor bootstrap and publication under the new title; the old-title redirect cannot claim the binding; a pre-move session cannot save there), ordinary moves onto and off enrolled titles, exact restore of all or selected revisions with the same PageID, and refusals for a recreated title, for two deleted pages at one title (followed by an exact restore of the right one), and for restoring onto a page that owns drawings. Importer, merge, merge API and installed-registration tests now make the protected side own drawings. Full native configuration **366 tests passed, 1 skipped** (this count includes J74 work in progress); standalone PHPUnit **1,294 tests**; `npm test` passes; PHP style 0 errors. No browser run: the automation owner is in use for J65, and a real move is queued as J65b.

**Not yet:** browser acceptance of a real move (J65b), and a public cache policy for anonymous binding reads. Earlier entries below are historical.

## Shared file drawings can be adopted into page history — September 26, 2026

On a pilot owner page, a legacy file drawing shown with an explicit set (`[[File:X|layerset=name]]`, optionally `page=N`) can now be made owned by the page, as shared slides already could.

- **Offer:** the "Drawings on this page" box lists the file ("Make “X” owned by this page") for editors of the current revision. The offer names the exact legacy row shown now: the set saved for the current file version and that PDF page. A file embed without `layerset=` is not offered, because it shows no specific set.
- **Pinned version:** each offer carries the file version it was shown on (`filets`, the upload timestamp). The confirmation page says the drawing stays on that version and that later uploads will not change it. If the file was re-uploaded since, the confirmation is refused and nothing is saved, because adopting onto the older version would silently change the page's image; unknown or malformed versions are refused the same way.
- **Result:** one page revision (tagged `layers-page-drawing`) whose text replaces `layerset=…` with `layersbinding=…` in place, keeping every other option, and whose drawing is an image or PDF surface with the file's (or that PDF page's) own geometry. The page then shows its own copy through the bound-file path; the shared set is unchanged.
- **Wording:** the notice now reads "Some drawings on this page are shared…" instead of naming slides.
- Groups, markers, imported images and library shapes still refuse adoption, exactly as for slides.

Fresh verification: new native cases in `PageOwnedAdoptionFlowTest` cover the file offer and page link, the confirmation (intro, version note, hidden `filets`), adoption pinned to the current PNG, adoption of page two of a real multi-page PDF with page two's portrait geometry and rendition, and refusals for unrenderable content, a confirmation opened before a re-upload (the old version still exists and matches the saved set, but the page no longer shows it), and unknown or malformed versions. Full native configuration **362 tests passed, 1 skipped**; standalone PHPUnit **1,294 tests, 1 skipped**; `npm test` passes; PHP style 0 errors. New Chromium spec `page-owned-file-adoption.spec.js` saves its own legacy set on an existing wiki image, embeds it on the automation owner, adopts it through the page link and confirmation, checks the rewritten text, the pinned surface and the pixels, refuses a second confirmation, then restores the owner and deletes its set. All **15 page-owned Chromium tests passed**; the adoption and bound-file specs were rerun after the final version check.

**Not yet:** lifecycle guards keyed to PageID rather than titles (so moves keep drawings), and a public cache policy for anonymous binding reads. J65 is released for everything else. Earlier entries below are historical.

## Image and PDF drawings editable in page history — September 26, 2026

Page-owned image and PDF surfaces can now be edited, not only viewed.

- **Entry:** the page's "Drawings on this page" box now lists bound file embeds too ("Edit page drawing: <file>"). A slide embed opens only slide surfaces and a file embed only image/PDF surfaces, both in the list and when the editor route checks the exact source.
- **Editor:** `prepareEditor()` opens an image/PDF surface in the ordinary image mode with the pinned rendition as `imageUrl` and the surface canvas as `baseWidth`/`baseHeight`, so layer coordinates stay in the source page's space even when the rendition is narrower. The canvas size, background colour and source are never changed by the editor; only layers and the background image's visibility and opacity are saved.
- **Exactness:** in page-owned mode the background loader tries only that rendition. Before, a failed load fell back to the page's image, `Special:Redirect/file` (the latest version) or a placeholder. A failed background now keeps the layers' coordinate space instead of resetting to 800×600 (this also fixes legacy images whose base size is known).

Fresh verification: native tests cover the image-mode bootstrap, the edit list and the bound-editor route, including refusal of a slide embed bound to an image surface. Full native configuration **358 tests passed, 1 skipped**; standalone PHPUnit **1,294 tests, 1 skipped**; Jest **15,019 tests**; `npm test` passes; PHP style 0 errors. Chromium: the bound-file spec now opens the drawing from the page's edit link, checks image mode, canvas size and the exact background, moves the layer, saves once, and checks the new revision kept the canvas and source. All **14 page-owned Chromium tests passed**, slide editing included.

**Not yet:** adoption of shared drawings on file embeds, title-keyed lifecycle guards, and an anonymous cache policy. Earlier entries below are historical.

## Bound file embeds show page-owned drawings — September 26, 2026

`[[File:X|…|layersbinding=v1:<pageId>:<surfaceId>]]` on a pilot owner page now shows that page's drawing over the exact file version it was made on.

- **Parsing:** `WikitextHooks` queues `layersbinding=` per file occurrence in render order, exactly like `layerset=`, and strips it so it never becomes caption or alt text. `BoundFileHooks` admits it with the same checks as bound slides (pilot scope, known revision, matching PageID, `VARY_REVISION`; shared code in `BoundSlideHooks::register()`). Core renders the image as usual; an admitted embed only gains `layers-bound-file`, `data-layers-binding` and `data-layers-revision`. A refused binding (wrong page, malformed, outside the pilot) shows the plain image and never a shared or latest drawing.
- **Page view:** the history module requests the binding through `layersread`, then replaces the image inside its file link with a canvas at the same display width that draws the pinned rendition and the layers. The canvas is labelled with the image's alt text. If the reader may not see the drawing, the plain image stays. Slide hosts only accept slide surfaces and image hosts only image/PDF surfaces.
- **Styles:** the historical view stylesheet was never shipped; `ext.layers.history` now loads it (block canvas, theme-aware status colour).
- Edit links are still offered only for slides; the page-owned editor does not support image/PDF surfaces yet.

Fresh verification: new native `BoundFileHooksTest` (marked image, stripped option, exact revision, drawing and rendition served; wrong-page, malformed, empty and out-of-scope bindings show the plain image). Full native configuration **357 tests passed, 1 skipped**; Jest **15,013 tests**; `npm test` passes; PHP style 0 errors. New Chromium spec binds an existing wiki image on the automation owner, checks the canvas replaces the image in its link at 300 px, the layer and the photo pixels, then restores the owner. All **14 page-owned Chromium tests passed** after the change.

**Not yet:** the page-owned editor for image/PDF surfaces and adoption of file embeds. Earlier entries below are historical.

## Image and PDF drawings viewable in history — September 26, 2026

Page-owned image and PDF surfaces can now be viewed at any revision, drawn over the exact file version they were made on.

- **Delivery decision:** the source is MediaWiki's own rendition of the pinned version (`File::transform()` on the resolved current or archived file, at most 2048 px wide), returned only inside `layersread`'s private response after the reader is authorized for the revision and that file version. Core already serves every file version to anyone who can read the File page, so Layers never exposes more than core does; on private wikis the URL is core's protected one (for example `img_auth.php`). Hidden, deleted or mismatched versions yield no rendition. This replaces the private-renderer plan, whose unsolved resource budgets had led to the abandoned supervisor work; see the [delivery decision](../docs/PAGE_OWNED_ASSET_DELIVERY_DESIGN.md).
- **Viewer:** `Special:ViewLayersPage` shows image and PDF surfaces: the historical renderer loads the rendition, scales it to the surface canvas, applies the background visibility and opacity, and draws the layers on top. It loads only http(s) URLs, draws nothing until the image has decoded, and shows the usual failure message if it cannot load.
- **Read bundles:** `layersread owner+revid` adds `sourceRenditions`; bound entries and `prepareViewer()` carry `source`. Details in the [read contract](../docs/PAGE_OWNED_READ_CONTRACT.md).

Fresh verification: new native `SourceRenditionsTest` (archived PNG and archived PDF page 2 after replacement, hidden version, pilot viewer); the pilot viewer test now expects image surfaces to be viewable and refused only for readers who cannot read the file. Full native configuration **354 tests passed, 1 skipped**; standalone PHPUnit **1,294 tests, 1 skipped**; Jest **15,010 tests**; `npm test` and every gate pass; PHP style 0 errors. Chromium: the rendering spec now paints a real same-origin image under a layer and hides it with the background (**4/4 passed**).

**Not yet:** bound file embeds on page views (`[[File:…|layersbinding=…]]`), the page-owned editor for image/PDF surfaces, and adoption of file embeds. Title-keyed lifecycle guards and an anonymous cache policy also remain. Earlier entries below are historical.

## Adoption presentation reviewed (J64) — September 26, 2026

The shared-slide adoption UI from the entry below was reworked and then reviewed by junior packet J64 (accepted with lead corrections).

- **Page controls:** edit and adoption links sit in one labelled box, "Drawings on this page", with a real heading for screen-reader navigation. The box uses a new style-only module, `ext.layers.pageControls.styles`, built from Codex design tokens, so it follows the skin and Vector 2022 night mode. The shared-slide notice now says why adoption matters: changes to shared drawings are not in page history.
- **Confirmation page:** retitled "Make a shared drawing owned by a page"; it names the page, set and revision. It uses a Codex form with a Cancel back to the page and sends logged-out visitors to log in.
- **Refusals:** every refusal now appears as a styled error box. Before this, the message box styles were never loaded, so errors looked like plain text. Each box says nothing was saved and links back to the page when the page can be named. Wording is clearer for the repeat case ("The drawing may already be owned by the page") and the unrenderable case ("It stays shared and keeps working as before").

Fresh verification: full native configuration **350 tests / 2,795 assertions passed, 1 skipped**; standalone PHPUnit **1,294 tests, 1 skipped**; Jest **199 suites / 14,993 tests**; `npm test` and every repository gate pass; PHP style 0 errors (2 old stub warnings). All **12 page-owned Chromium tests passed**, including J64's presentation spec, which now requires WCAG AA contrast for the controls in Vector 2022 day and night and a real colour change between them. Screenshots were checked in legacy Vector and Vector 2022 day and night.

**Still open, lead-owned:** image/PDF pinned delivery (file adoption and J65 wait on it), lifecycle guards keyed to titles rather than PageID, and a public cache policy for anonymous binding reads. Earlier entries below are historical.

## Shared slides can be adopted into page history — September 26, 2026

Editors can now make a shared (legacy) slide owned by the page it appears on, so its later changes are recorded in that page's history. Scope is the existing pilot: configured owner pages, text/vector slides only.

- **Offer:** on a pilot owner page, an editor of the current revision sees "Make “<slide>” owned by this page" under the page for each direct, unbound slide embed in the page source. The list is built per request from the exact displayed revision; parser output only records that a shared slide was rendered. Readers, anonymous users, `oldid`/`diff` views and template-generated slides get nothing.
- **Confirm:** the link opens `Special:AdoptLayersDrawing` (unlisted, `noindex`). GET runs every adoption check without writing and names the exact saved set and revision that will be copied. Only a POST with the user's edit token adopts, under the `editlayers-save` limit. Success redirects to the page; the new revision carries the binding, the copied drawing and the `layers-page-drawing` tag. The shared original and other pages using it are not changed.
- **Refusals:** a stale confirmation (the page changed, or the same confirmation is submitted twice) is refused with an explanation and never retried. Drawings with groups, markers, imported images or library shapes are refused before the form is shown. Malformed requests get one generic message.
- **Slides without `layerset=`** are adopted from the set they display now (the most recent save). Files still require an explicit selector.
- **Fixed while testing:** `layersinfo` returned `name: null` for a slide opened without a set name or by revision ID, and gave that revision ID the wrong history list. "Most recent set" is now deterministic when two saves share a timestamp second (`ls_id` breaks the tie).

Fresh verification: full native configuration (`tests/phpunit/core.xml`) **350 tests / 2,779 assertions passed, 1 skipped**, including the new `PageOwnedAdoptionFlowTest` (candidates, preview without writes, GET/POST/token/repeat, unrenderable and malformed requests, page-view gating) and `ApiLayersInfoSlideNameTest`. Standalone PHPUnit **1,294 tests, 1 skipped**; Jest **199 suites / 14,993 tests**; `npm test` and every repository gate pass; PHP style 0 errors (2 old stub warnings). All **11 page-owned Chromium acceptance tests passed** on the original wiki, including the new adoption spec, which creates a shared slide, adopts it through the real link and form, checks history and the unchanged original, and restores the automation owner with an exact-base publication.

**Still open, lead-owned:** image/PDF pinned delivery (file adoption stays unavailable until then), lifecycle guards keyed to titles rather than PageID, and a public cache policy for anonymous binding reads. Earlier entries below are historical.

## Page views cacheable, edits tagged and filtered — September 26, 2026

Second lead round on the page-owned history pilot, in the working tree and not yet committed.

- **Cacheable pages:** page HTML with bound slides now carries binding identities only. The viewer fetches each reader's drawings with `layersread` `binding=` (private, exact revision, up to 50 per request; unavailable bindings are omitted rather than distinguished). Pages are no longer marked `no-store`, and page views no longer read the primary database for drawings. Edit links for current-revision editors are still added per request and never enter parser output.
- **Native change tag:** every page-owned save carries the software-defined `layers-page-drawing` tag, so Layers edits can be filtered in Recent Changes, watchlists and history. `layers-data-change` is now declared as software-defined too.
- **Edit filters:** any page-text change published with a drawing (`layerspublish maintext`, adoption's binding edit) runs `EditFilterMergedContent`, so AbuseFilter, SpamBlacklist and ConfirmEdit apply as they do in EditPage. Rejections return `layers-edit-filtered`.
- **Smaller ordinary editor:** page-owned editor code (about 64 KB) moved to `ext.layers.editor.pageOwned`, loaded only by the page-owned route and on demand by EditorBootstrap. `ext.layers.editor` is at 97% of its budget (was 100%); the legacy editor was smoke-checked in Chromium with all tools and no page errors.
- API help messages now exist for `layersread` and `layerspublish pageid`.

Fresh verification: native page-owned group **302 tests / 2,159 assertions passed**; standalone PHPUnit **1,293 tests, 1 skipped**; Jest **199 suites / 14,993 tests**; every repository gate and Grunt lint/banana pass; PHP style 0 errors (2 old stub warnings). All **10 page-owned Chromium acceptance tests passed** on the original wiki after the change, including history, conflict, recovery, false-boolean round-trip and lost-response reconciliation.

**Still open, lead-owned:** image/PDF pinned delivery, lifecycle guards keyed to titles rather than PageID, the adoption HTTP boundary and its UI (J64/J65), and a public cache policy for anonymous binding reads. Earlier entries below are historical.

## Lead review remediation — September 26, 2026

A full review of the page-owned history work found defects that every gate had passed. They are fixed in the working tree; nothing is committed yet.

- **Parser cache:** bound slides now mark parser output `VARY_REVISION`. Save-time and edit-stash renders have no revision ID, so without the flag core could keep their unavailable placeholder as the cached page after an ordinary text edit.
- **Unviewable saves refused:** `PageOwnedRenderCapability` is the single list of layer types the historical renderer draws. Publication refuses new or changed surfaces containing anything else (`layers-content-not-renderable`), adoption uses the same list, and `check-parallel-lists.js` keeps the PHP and JS copies equal. The page-owned editor hides the marker tool, image import, shape library and emoji picker. Groups can still be made in the editor; the server refuses them with a localized message.
- **Ordinary pages are eligible:** the source scanner refused the whole page for any `<br>`, `<div>`, `<references />`, external link or bracket in prose, which removed every edit link and made adoption impossible. It now follows preprocessor rules: ordinary HTML and single brackets are text, bodies of the wiki's registered extension tags and `<includeonly>` are skipped, and `<noinclude>`/`<onlyinclude>` markers are transparent.
- **History stays readable:** stored revisions are read with structural validation only (`DocumentSchema::decodeStored`). Tightening layer validation later can no longer make old revisions unreadable; saving still applies current rules.
- **One missing file hides only its drawing:** selected-surface reads resolve only that surface's source, and publication rechecks sources and renderability only for surfaces the save adds or changes. An identical republish is a no-op. The full `layersread` API still resolves every source.
- **Fewer reads per view:** all bound slides of a displayed revision are authorized with one snapshot read, the page edit list reads once instead of once per binding, and history rows no longer look up files.
- **Readable diffs:** Layers slot diffs pretty-print the snapshot, so an edit shows the changed properties instead of one very long line.
- **Content model always registered:** `layers-document` is now in the manifest's `ContentHandlers` (never usable as main page content), so stored revisions still load if the pilot owner list changes. The writable slot role, admission hook and lifecycle guards remain scoped to configured owners.
- **Test isolation:** `LayersDocumentContentTest` and `PageRevisionWriterTest` no longer collide with the host wiki's installed pilot (19 errors before). Abandoned, untracked RenderJob/container prototypes were moved out of the working tree to a sibling `Layers-abandoned-render-prototypes` folder with their original paths.

Fresh verification: native page-owned group **300 tests / 2,144 assertions passed** (27 classes; previously 297 tests with 19 errors); standalone PHPUnit **1,293 tests, 1 skipped**; Jest **199 suites / 14,990 tests**; every repository gate passes; PHP style is back to 0 errors and the 2 old stub warnings. The live test wiki still serves pilot pages. Browser acceptance was not rerun.

**Still open at this checkpoint** (resolved in the entry above): `maintext` bypassed `EditFilterMergedContent`, bound pages disabled caching and read the primary database, and `ext.layers.editor` was at 100% of its budget. Image/PDF delivery, title-keyed lifecycle guards and adoption's HTTP boundary remain. Earlier entries below are historical.

## Confirmed adoption composition implemented; J74 ready — September 26, 2026

Lead added PageOwnedPilot::adoptDirectEmbedding(pageId, baseRevisionId, start, expected, legacyRevisionId, fileTimestamp, authority, summary). This internal write composition accepts only selection identity. It checks pilot enablement, login, basic bounds, native owner/base/edit authority and configured scope before obtaining legacy data. It then prepares the exact saved source occurrence and exact immutable legacy row once, retains the resulting document/main server-side, and publishes through the pilot's existing admission-aware publisher. It returns only confirmed page/revision/surface/binding identity. No client-prepared snapshot/main/surface is accepted and there is no automatic retry. Existing slide-only rendering and image/PDF delivery gates remain in force.

Fresh native pilot/preparation/adoption regression: **46 tests / 490 assertions passed**. The new test verifies one native revision, exact binding rewrite, drawing values/types including false/zero, immutable pre-adoption main content, no prior Layers slot, exact legacy lookup once and no latest lookup, and stale-repeat rejection without another revision. Changed PHP style passed. An independent read-only architectural review confirmed use of the existing publisher/admission context and identified the native service injection seam for junior tests.

**J74 is ready** for bounded denial/race tests. Lead next implements explicit confirmation and the HTTP write boundary: POST-only, native CSRF, editlayers-save limiter, fixed error messages and deliberate reconciliation after an unknown outcome. This method is not exposed by an API or button yet. J64/J65 remain blocked until those UI callbacks exist. Layers is a MediaWiki extension; Docker remains only its test environment. Earlier entries below are historical.

## Visible page-owned editing controls verified — September 26, 2026

Lead added a page-level edit list for authorized current-page readers with edit/editlayers permission. Each entry is derived from a direct saved slide binding in the exact displayed/current main revision, and opens the validated bound-editor tuple route. The list is generated per request outside shared parser output; it does not attach guessed source offsets to rendered overlays. Repeated references to one surface are deduplicated. Malformed/unbound/template-contained candidates do not become links. Historical oldid/diff views, stale revisions, disabled scope and readers lacking editing rights receive no controls. A localized notice explains that these drawings save to page history. No new manifest registration or runtime dependencies were added.

Fresh verification: **34 native tests / 519 assertions passed**; **2 Chromium browser tests passed (1.3 minutes)** on the original localhost:8080 wiki. The editor browser test now navigates the ordinary owner page, inspects and clicks its visible link, edits through the UI, saves once and verifies native history and old snapshot preservation. Existing inline historical rendering remains green. Changed PHP/JS style, i18n validation and documentation checks passed; i18n wiring retains its pre-existing unused-message warnings. Browser cleanup restores the dedicated automation owner, so this run does not provision a permanent new manual demonstration page.

**Next lead milestone: explicit adoption of shared drawings.** Existing page-owned slide editing now has an ordinary page entry, but legacy shared edits are not automatically recorded in owner history. J64 ownership/adoption controls and J65 full adoption acceptance remain blocked on that implementation. Exact image/PDF source delivery remains required; this is not a complete image/PDF history release. No new junior packet is queued for this lead integration step. Docker is only the test environment. Earlier entries below are historical.

## J73 accepted with lead corrections — September 26, 2026

Lead strengthened the browser acceptance rather than relying on its reported counts. It now proves the selected layer moved, the published layers equal the edited state, the full main text is unchanged, and native revision order is exactly the new save followed by the seeded base. Save completion is awaited before leaving the editor. The uncertain-publication flag remains set until a valid success/revision is confirmed and captured for cleanup. Seed/restoration POSTs include expected PageID; existing exact-base CAS and intervening-edit protection remain. Added explicit HTTP 200/no-redirect and unloaded editor-module checks on denial. The live response has Cache-Control: no-store but no Pragma header; corrected the earlier report rather than requiring a redundant header.

Fresh corrected verification on the original localhost:8080 wiki: **2 Chromium tests passed (1.1 minutes)**, including existing inline/historical behavior and the new exact-source route save/rejection workflow. Changed-file ESLint and diff whitespace checks passed. Cleanup restored only the dedicated automation owner's prior main text/snapshot through another native revision, preserving all history. No production, manifest, configuration or manual test-page changes.

**Next work is lead-owned; no new junior packet is queued.** Connect a visible ordinary-page editing control to the validated route with correct current/historical and permission behavior, then finish explicit shared-to-page adoption. Do not infer a source occurrence from rendered DOM order or supply links that guess template provenance. J64/J65 remain blocked until working callbacks are supplied. Image/PDF pinned delivery and ordinary-image acceptance remain unfinished; search and Cargo follow history. Docker remains only the test environment. Earlier entries below are historical.

## J72 accepted; exact-source editor route connected — September 25, 2026

Reviewed J72's native rejection coverage and added PageID/revision upper-bound cases. Lead connected the existing Special:EditLayersPage route to prepareBoundEditor using the complete tuple pageid, revid, start, expected. Numeric parameters require canonical bounded decimal strings; start may be zero. Bound requests cannot use revid=current, mix owner/surface selectors, or fall back to the older route when malformed. The service still verifies exact authorized current source, saved binding, pilot scope and selected slide surface. Existing no-store/noindex and safe error handling remain in place; no manifest or configuration changes.

Fresh corrected native pilot/route regression: **32 tests / 489 assertions passed**. Includes actual route-to-service bootstrap equality, no-write invariants, numeric/source/permission rejection and malformed bound-request isolation. Changed PHP style and diff whitespace checks passed. This is a callable route, not yet an ordinary overlay or adoption button. No real wiki pages were modified by native tests; Docker is only the test environment.

**J73 is ready** for original-wiki browser acceptance of the new route. Lead retains author-facing inline ownership/edit controls, explicit adoption and pinned image/PDF delivery. The reviewed checkpoint through 5c7063f5 is already on GitHub's development branch. Search and Cargo follow history; earlier entries below are historical.

## Lead bound-editor admission implemented; J72 ready — September 25, 2026

Added PageOwnedPilot::prepareBoundEditor(pageId, revisionId, start, expected, authority), an internal admission method for a selected direct embedding. It resolves native identity/edit rights, requires current explicit revision and retained pilot scope, reads authorized main content, locates exact UTF-8 byte offset and complete source bytes through DirectEmbeddingRewriter, and extracts the binding from those server-read options. Binding owner must match native PageID; existing editor preparation confirms the surface, current revision and server-derived identity. Fixed rejection is layers-editor-unavailable without chained diagnostics. No public route or browser control calls this method yet; file-backed editing remains closed. Existing editor APIs and defaults are unchanged.

Fresh native pilot/editor-route regression: **28 tests / 347 assertions passed**. New integration coverage verifies Unicode offset success, server-derived surface identity, stale-base/wrong-offset/forged-source rejection and unchanged page content/revision. Changed PHP style passed. J71 corrections were saved in local checkpoint **2a6b8c8a**; no push.

**Junior J72 is ready** for bounded rejection coverage of this concrete interface. Lead retains ordinary route/overlay connection, explicit adoption confirmation, and pinned image/PDF delivery. This is progress toward owner-page history, not completion of ordinary editing. Search and Cargo follow history. Docker remains only the test environment; earlier entries below are historical.

## J71 accepted with corrections; next work is lead-owned — September 25, 2026

Lead reviewed the competing adoption test and added direct native revision-row counts before preparation, after each publication and after stale rejection. Latest-revision checks alone did not prove no extra revision was inserted. Replaced substring location with DirectEmbeddingRewriter scanning of the committed main content, selecting the sole remaining unbound occurrence. Added full snapshot equality after the rejected attempt. Existing Unicode preservation, exact immutable legacy-row selection, distinct server IDs and historical-content checks remain intact.

Fresh corrected native regression: **21 tests / 164 assertions passed** (PHPUnit 9.6.36, PHP 8.3.31); changed-file PHP style passed. These are internal service composition tests using isolated native tables, not public adoption/browser acceptance. No production, configuration, manifest or real wiki content changes. Docker is only the test runner.

**No new junior packet is queued.** The next necessary work is lead-owned ordinary-entry integration: authorize a selected binding against exact page source, connect an explicit adoption confirmation to native atomic publication, and supply real ownership-control callbacks. J64/J65 remain blocked until those interfaces work. Pinned image/PDF delivery remains a required part of the ordinary-image acceptance target; the slide pilot must not be presented as completion. Search and Cargo follow page history. Earlier queue/checkpoint entries below are historical.

## J70 accepted with corrections; J71 ready — September 25, 2026

Lead reviewed J70 and corrected two acceptance gaps. Counting responses inside waitForResponse could only count the first matching response; persistent request listeners now verify the normal and boolean workflows make one editor publication through completion. The existing failure cleanup could modify a newer unrelated revision; it now requires the exact last confirmed revision and original PageID, refuses uncertain outcomes, and uses native CAS with expected PageID. It preserves revisions rather than deleting history. The browser target is explicitly restricted to the original loopback wiki on port 8080 with no alternate path or embedded credentials. Replaced an unbounded interception Promise with a bounded wait.

Fresh corrected Chromium verification on the original wiki: **5 workflows passed (2.3 minutes)**, covering draft recovery, two-editor conflict, normal save/history, false booleans and lost-response reconciliation. Server-derived PageID matches the bootstrap and inspected editor requests. Changed-file ESLint and diff whitespace checks passed. No production, manifest, configuration or user test-page changes. This evidence verifies the scoped slide editor; ordinary legacy image/PDF edits still do not automatically create owner-page revisions.

**J71 is ready:** competing prepared adoption tests using existing native service interfaces. Lead retains the ordinary-page adoption/confirmation and bound editor routes plus pinned image/PDF delivery. J64/J65 remain blocked. History remains first priority, then searchable textbox/callout content, then Cargo. Docker remains only the test environment. Earlier entries below are historical evidence.

## J69 accepted; server PageID retained through editor saves — September 25, 2026

Lead reviewed J69 and connected the native editor bootstrap to publication: PageOwnedPilot derives pageId from the validated current revision, checks its owner identity, and PageOwnedEditorSession validates and captures it once. APIManager already passes that configuration to the session. Every save retains the expected PageID, including after reconciliation; changing caller configuration cannot retarget it. Older internal callers omitting pageId remain compatible. Draft envelopes and read contracts are unchanged. J69 validation returns a rejected Promise before transport; it does not throw synchronously.

Fresh lead verification: publisher/session/APIManager tests **3 suites / 150 tests passed**; native pilot/editor route/publication API tests **55 tests / 414 assertions passed**; changed JavaScript and PHP style passed. Browser verification of this new wiring is assigned to J70, not claimed complete. This is an owner-identity safeguard, not proof of a selected embedding or completed ordinary-page adoption. Image/PDF delivery, ownership controls, search and Cargo remain unfinished. Docker is only the test environment.

**Next handoff: J70**, original-wiki browser verification of server-derived PageID on editor saves. Lead retains ordinary binding/adoption entry points; J64/J65 remain blocked. Prior checkpoints below are historical.

## J68 accepted; expected owner identity reaches publication API — September 25, 2026

Lead reviewed J68's native move/delete/recreate tests. Added explicit proof that the old title is an existing redirect, and gave the replacement page visibly distinct drawing text so an old-content fallback cannot pass. Internal PageID-bound reads survive unscoped native moves, reject redirect/foreign/recreated owners and retain archive records; read-only permission and denied-reader cases passed. These tests do not remove scoped pilot lifecycle guards or establish public move support. Fresh lifecycle/read regression: **33 tests / 143 assertions**.

Lead added optional `pageid` to the scoped `layerspublish` API (integer 1–2147483647). It carries expected owner identity into PagePublicationService's existing preflight and prepared-update checks. Wrong identity maps to fixed `layers-invalid-publication-request`; bound creation is rejected. Existing callers omitting pageid remain compatible. This is not surface-binding proof and the editor/session does not yet send it. Native tests cover successful publication/no-op, foreign PageID rejection without mutation, rejected creation and range errors before publication. Combined publication/API/read/lifecycle regression: **79 tests / 276 assertions passed**. Changed PHP style passed.

**Junior J69 is ready** in the handoff plan: add strict optional pageId capture/validation/transport to PageOwnedPublishClient with focused tests. Lead retains server-derived bootstrap identity, session/save wiring and explicit adoption. J64/J65 remain blocked. A small follow-up development commit preserves this review/API step; no release or remote push is implied. Docker remains only the test host; user wiki content and configuration are unchanged.

## Recovery checkpoint preparation and next handoff — September 25, 2026

A development checkpoint now captures the accumulated MediaWiki-native history pilot, scoped read/edit/view routes, inline bound-slide display, adoption preparation, regression tests and documentation through J67. This is not a completed adoption release: ordinary image/PDF ownership, bound editor entry/save, lifecycle integration, search and Cargo remain unfinished. Existing defaults remain disabled/empty-scope.

Selected scope: tracked changes and necessary native untracked files. Abandoned RenderJob/container-supervisor implementations, their execution fixtures/scripts/tests and generated Python caches stay outside the checkpoint and remain untouched locally. No selected executable code references those excluded prototypes. Historical documentation mentioning abandoned work remains explicitly historical. Credential-pattern checks on selected files found no matches; temporary credentials/data and ignored test outputs are excluded.

Fresh validation: **198 JavaScript suites / 14,964 tests passed**; native history/admission/API/parser/identity regressions **193 tests / 1,069 assertions passed**. PHP syntax passed (205 working-tree PHP files). The unqualified PHP style command also scanned ignored tmp scripts and failed there; rerunning with tmp/temp excluded produced no errors (two existing duplicate test-stub class warnings). Documentation, PHP references, MediaWiki compatibility and tracked diff whitespace checks passed. J67's corrected original-wiki browser test passed in the preceding review. This record does not claim every native test or release gate passed.

**Junior J68 is ready** for native PageID-bound read tests across unscoped moves and delete/recreate, with a bounded packet in the handoff plan. Lead retains bound editor/adoption integration and production lifecycle decisions. Do not bypass current pilot guards. No public release or remote push is implied by the recovery checkpoint. Docker remains only the test host.

## J67 accepted with lead corrections; registration isolation repaired — September 25, 2026

Lead reviewed the browser spec and corrected a destructive cleanup race: it previously fetched any latest revision and restored the original content over it. Cleanup now requires the exact last revision confirmed as published by this run and the original PageID; an intervening edit or uncertain publication outcome stops restoration. Restoration uses native CAS and no retry. Cleanup errors now fail the test rather than merely logging, and verification reads the exact restored revision. Console/page errors are reported as fixed redacted categories throughout the run. The target is restricted to the original loopback wiki on port 8080, with normalized root URLs.

Strengthened historical/current/reload assertions with actual canvas dimensions and red/blue pixel samples, beyond configuration inspection. Fresh corrected browser acceptance passed on the original wiki: **1 Chromium test (43.9s; 46.2s including runner)**. An earlier run after the cleanup correction also passed. Both restored only the dedicated automated owner's original main text/snapshot through new revisions; all history was retained. No manual owner, Main Page, media or wiki configuration changed.

Lead repaired PageOwnedPilotRegistrationTest using the native scoped ExtensionRegistry test override and a fresh test service container: automatic Layers service-hook installation is excluded only in that fixture, then each test explicitly invokes the real registration once with its own scope. This replaces neither runtime guards nor assertions. The override is restored in teardown. Registration alone passed **16 tests / 93 assertions**; combined registration, inline hook, binding read, native slide parser and pilot passed **47 tests / 422 assertions**. PHP style and browser ESLint passed. The prior registration verification blocker is resolved.

**Next remains lead-owned:** bound editor entry/save and explicit adoption controls, followed by pinned image/PDF delivery and ordinary overlay acceptance. J67 is accepted with corrections; J64/J65 remain blocked until their concrete interfaces are supplied. Read-only inline slides now have original-wiki browser evidence; this is not completed ordinary adoption/editing or commit/push readiness. Docker remains only the test host. No commit/push or production changes in this review turn.

## Inline bound-slide display implemented; browser gate pending — September 25, 2026

Lead connected native SlideHooks to the ordered binding adapter. In the existing enabled/scoped pilot, valid bindings produce identity-only placeholders with the exact native parser revision (including core's explicit revision-record callback path). Preview/no-revision, foreign PageID, disabled/out-of-scope and malformed/conflicting bindings fail closed. Shared legacy slides continue through the original path.

BoundSlideHooks runs on OutputPageParserOutput and requires its cached parser revision to equal the displayed OutputPage revision. It reads through prepareBoundViewer with the actual reader Authority and PageID-checked exact read service. Authorized drawing bundles are added only to the current response's JS configuration; the shared ParserOutput retains no drawing data. Bound responses disable client/CDN caching. The existing history bootstrap now mounts each matching inline host independently; mismatched/denied hosts keep the unavailable placeholder. This is read-only and still limited to slides; no adoption UI or legacy save fallback was added.

Fresh verification: **31 native tests / 329 assertions** for bound output, binding reads, direct slide parsing and pilot; **128 JS tests** for bootstrap/view/renderer; **120 PHP unit tests / 228 assertions** for SlideHooks/binding options. Native coverage drives addParserOutput, checks no-store response headers, exact old drawing after a later save, disabled/denied output, mismatched display revision and absence of drawing data from serialized parser cache. Style, class references (95 classes) and compatibility checks passed.

**Unresolved verification:** PageOwnedPilotRegistrationTest independently fails in the currently configured test runner (duplicate native Layers slot installation and an already-defined content model when testing an empty scope). Do not report the registration suite or all checks as passing; lead must isolate its bootstrap from the original wiki's installed pilot without changing user configuration. No browser acceptance is claimed yet.

**Junior J67 is ready** in the handoff plan for real original-wiki inline binding acceptance. J64/J65 remain blocked on ordinary adoption/editor interfaces. Lead retains those interfaces, pinned image/PDF delivery, visual parity and the registration-test isolation fix. No user content/configuration, manifest, commit or push changed. Docker is only the test host.

## Exact bound-surface read implemented — September 25, 2026

Lead added `PageReadService::readBoundSurface(owner, revisionId, binding, authority)`. It requires a canonical binding whose PageID matches the displayed owner, selects only the requested surface from that exact revision, and reuses native revision visibility/source authorization. Missing, foreign, malformed and denied bindings return the same fixed unavailable error without diagnostic chaining. The binding PageID also reaches PageHistoryAccess, where it is checked against the same owner identity used for the revision comparison, rather than relying solely on an earlier title preflight.

Native tests publish successive drawings, read the older drawing after a later edit and removal, reject missing/foreign surfaces and revisions, deny unauthorized readers and hidden revision text, and check mismatched expected PageID. A pre-existing test setup unconditionally redefined the registered Layers slot; lead corrected it to define only when absent. Fresh combined read/history/parser/preparation regression: **62 tests / 301 assertions passed**. Changed PHP style passed.

**Still internal:** this method registers no route, changes no parser output and grants no new access. Its owner/revision must come from trusted native displayed-page context; it is not proof that a binding appeared in that revision's main text. Output is authority-specific and must not enter a shared parser cache. The parser continues to refuse reserved bindings until lead completes the displayed-revision transport and view mounting. J66 remains accepted; J64/J65 remain blocked. No ordinary overlay testing readiness or commit/push; no user wiki content/configuration changes. Docker remains only the test host.

## J66 accepted with corrections; reserved slide binding refusal — September 25, 2026

Lead reviewed and reran the real-parser suite. Replaced attribute-order-dependent HTML regular expressions with DOM/XPath inspection. Accepted its native slide identity/case, duplicate-selector, name-override, Unicode occurrence and template/comment/nowiki evidence. The suite still does not prove general wikitext correspondence or binding rendering.

Lead also corrected a production fallback: SlideHooks previously ignored `layersbinding` and could display the latest shared drawing instead of the bound snapshot. It now refuses the reserved option, including bare, empty, malformed, mixed-case, duplicate and mixed legacy-selector forms, before legacy drawing lookup/output. The existing localized slide error is shown without reflecting the binding. This deliberate refusal will be replaced only by revision-pinned, permission-safe binding rendering; it is not implementation of that rendering.

Fresh verification: **23 native tests / 185 assertions** across DirectSlideSelection, DirectEmbeddingRewriter and LegacyAdoptionPreparationService; **246 unit tests / 440 assertions** across SlideHooks, selection, rewriting and binding. Changed PHP style passed. The native group includes the shared harness test.

**Next is lead-owned:** implement the bound-slide display route with an exact owner revision and PageID agreement, then connect ordinary editing to that identity. No latest/shared fallback, no private snapshot in a public parser cache, and no save through legacy APIs. Pinned image/PDF delivery remains required for those surfaces. J64/J65 remain blocked; J66 is accepted, with no new junior packet until the next interface is concrete. Ordinary page-history testing and commit/push are not ready. Docker is only the test host; no user wiki content/configuration changed.

## Adoption capability gate and atomic composition — September 25, 2026

Lead added a known-capability check to direct adoption preparation: only the historical viewer's current ungrouped text/vector slide types can produce an adoptable proposal. Image/PDF sources and resource-backed/custom/group/marker layers remain blocked at this boundary, including hidden unsupported content; lower-level lossless conversion remains available. This is not proof of visual parity for every font/effect, nor public adoption registration.

Local source review found that native SlideHooks lets a later `name=` option override the first positional name. The matching helper now rejects that option (including bare, empty and mixed-case forms), preventing selection of the wrong slide. The attempted delegated audit stopped at an agent usage limit; no completed independent audit is claimed this turn.

Native integration now composes exact source preparation with atomic publication: only the selected repeated occurrence changes, main and Layers slots share the same new revision, actor/PageID/parent are correct, and the old main text and absence of a prior Layers slot remain intact. Hidden-group rejection leaves the page unchanged. Fresh checks passed **89 native tests / 460 assertions** and **187 unit tests / 347 assertions**; changed PHP style passed.

**Junior J66 is ready:** native slide-parser correspondence tests with concrete accepted/override/duplicate/template cases, defined in the handoff plan. Lead retains rendering fidelity, pinned image/PDF delivery, binding consumption and public adoption wiring. J64/J65 stay blocked. Ordinary overlay testing and commit/push readiness are still not claimed. No wiki content/configuration or runtime registration changed. Docker remains only the test host.

## Exact embedding and legacy selection preparation — September 25, 2026

Delegated `DirectEmbeddingSelection` implementation reviewed and accepted: exact file/slide identity, concrete set name and selected PDF page must match the server-read legacy row. Ambiguous generic selectors, duplicate selectors, legacy row-ID options, file case/short-ID ambiguities and slide canvas/background overrides reject. This conservative gate does not infer the latest legacy revision; the eventual adoption UI must explicitly confirm the selected immutable row.

Lead composed `DirectAdoptionPreparationService`: reads authorized base-revision wikitext, verifies the complete selected source span, prepares the exact legacy drawing, matches its identity, and rewrites only that span with the server-generated binding. The proposal stays server-only; preparation creates no revision. Native tests preserve Unicode byte offsets, distinguish repeated identical embeds, retain unrelated page bytes, and reject source/set/page/offset/nesting mismatches without changing the page.

Fresh verification: **183 unit tests / 343 assertions** across selection, rewriting and binding; **86 native tests / 438 assertions** across preparation, media resolution, adoption, publication, PageID preflight, API and admission. These are focused regressions, not browser acceptance.

**Next lead gate:** prove correspondence with native parsed embeds and admit only drawings the page-owned renderer/editor can faithfully handle, then compose preparation with atomic publication behind the adoption workflow. J64/J65 remain blocked until their runtime interfaces exist. Ordinary image/PDF/slide ownership is not publicly wired; user testing and commit/push readiness are not claimed. Search and Cargo follow the completed page-history workflow. Docker remains only the test host; no original-wiki content/configuration was changed.

## Direct source rewrite implemented and independently reviewed — September 25, 2026

Lead implemented internal DirectEmbeddingRewriter for a conservative raw-wikitext subset. It records complete top-level literal file/slide spans with UTF-8 byte offsets and ordered raw options, distinguishes repeated identical embeds, excludes nested/template/comment/opaque-tag content, and requires exact original bytes and start position before replacement. It replaces one legacy selector with a canonical binding (or appends one if absent), retaining all other bytes. Duplicate selectors, already-bound targets, control bytes, malformed nesting and unsupported source structures reject.

Delegated adversarial review found an opaque-tag name-prefix defect (nowiki-x/ref:custom recognized as approved tags). Lead tightened the delimiter and added regressions, plus mixed nesting, quoted slashes and comment-contained closers. Fresh combined source-rewriter/binding verification passed **123 unit tests / 283 assertions**. Native namespace/filename normalization passed **2 tests / 6 assertions** including the harness check. Changed PHP style, references (92 classes) and compatibility checks pass.

**Explicit initial limits:** selected captions/options must be literal without nested markup. Unknown HTML containers and single-bracket/external-link syntax cause whole-page refusal; opaque tag support is allowlisted. This is conservative manipulation, not full MediaWiki parsing or evidence that every scanner candidate corresponds to the native rendered embed. Native Title normalization is supplied by a trusted caller; owner/source permissions remain separate. No parser hooks/public routes changed.

**Next remains lead-owned:** tie exact source span and normalized target/PDF page/set to the exact legacy revision, prepare the bound main text from the authorized base, and invoke atomic adoption only after rendering gates. J64/J65 remain blocked; delegated review in this turn is complete. No ordinary page-history testing readiness or commit/push is claimed. No user wiki data/configuration changed. Docker remains only the test host.

## Exact source preparation reviewed and verified — September 25, 2026

Resumed and reviewed the interrupted delegated LegacyMediaResolver work. Corrected its PNG fixture expectation from 200x100 to the documented 1x1 and added integrated image-preparation coverage. The resolver now supplies exact authorized source metadata and selected-page dimensions through the existing SourceVersionResolver; it checks MIME, refuses invalid/oversized geometry, never scales coordinates and never derives upload time from the annotation timestamp. Native tests resolve archived PDF page two after a replacement upload and reject hash/time/page/MIME/permission mismatches with fixed errors.

Lead connected LegacyAdoptionPreparationService: authorize owner PageID/base before reading any legacy row, read only the explicit legacy revision ID, resolve media where applicable, generate a new surface ID, perform strict conversion and recheck owner/base after potentially slow storage/media work. Slides require no file. It returns a server-prepared proposal, never saves, and must not trust a proposal returned through the browser. A missing/pruned revision cannot fall back to latest.

Fresh combined native regression passed **80 tests / 407 assertions** across media resolution, preparation, atomic adoption, publication, PageID preflight, API publication and admission. Tests include exact image preparation, unchanged owner revision during preparation, denial before legacy lookup, missing exact revision and intervening main-text conflict. Changed PHP style, references (91 classes) and compatibility checks passed. No browser acceptance is claimed here.

The delegated source-span audit found no existing raw-source walker suitable for adoption: current image handling uses expanded text/occurrence queues and slide arguments lose duplicate/source-span information. **Next lead task is the conservative direct-embedding source scanner/rewrite**, preserving exact bytes and rejecting ambiguous/template-generated targets. Public exposure also remains gated on rendering support and ordinary editor integration. J64/J65 remain blocked. No user wiki content/configuration, runtime registration, commit or push changed. Docker is only the test host; the original wiki remains the manual testing environment.

## Exact legacy capture and structural conversion implemented — September 24, 2026

Lead delegated a read-only storage/geometry audit and a bounded exact-row reader, then reviewed the implementation. LayersDatabase::getLayerSetForAdoption now reads the selected row ID from the primary database without cache/latest fallback, retains raw JSON bytes and includes filename/hash/MIME/page/revision metadata. Missing, non-string and oversized rows reject. This is an internal data primitive with no authority of its own; callers must authorize owner/source before use or exposure.

Lead implemented LegacySurfaceConverter against that raw-record contract. It checks exact envelope fields and metadata consistency, rejects duplicate JSON keys, copies layer values without sanitizing them, preserves set name as label, emits no invented reading order, and strictly validates the one-surface output. Slides retain stored dimensions/background. Images/PDFs require independently supplied exact source metadata and page geometry matching the row's filename/hash/page; file-version timestamp never comes from annotation save time. Oversized canvases and lossy/unknown data reject without scaling or stripping.

Fresh verification: **81 tests / 240 assertions** across database and converter suites, including all eight J62 stored rows, source mismatches, false/zero data, duplicate JSON keys, byte limits, selected PDF pages and oversized slides. Changed PHP style, references (89 classes) and compatibility checks passed. These are unit/structural tests; no new native/browser acceptance is claimed in this checkpoint.

**Next is lead-owned:** authorize and resolve the exact media version/geometry, prepare syntax-aware direct-embedding edits, and connect the reader/converter to the atomic adoption transaction with rendering gates. Converter success is not permission to adopt unrenderable groups/resources or media. Image/PDF white-background composition still requires visual parity. J64/J65 remain blocked; bounded delegated work in this turn is complete. No public registration, user-page/configuration changes or commit/push. Original-wiki manual testing and Docker-only-as-test-host rules remain unchanged.

## Atomic prepared-surface adoption connected — September 24, 2026

Lead added internal PageOwnedAdoptionService::publishPreparedSurface, connecting PageID edit preflight to expected-PageID publication. It reads the authoritative base revision, requires visible wikitext main content, loads the existing Layers snapshot from that revision (or starts an empty document before first adoption), validates exactly one proposed surface, rejects duplicate identity, appends without replacing existing surfaces, validates aggregate limits, and publishes the snapshot and prepared main text together. It never accepts replacement copies of existing surfaces from the caller.

Fresh native regression passed **71 tests / 337 assertions** across adoption, publication, identity, API publication and admission. Tests verify first/second appends, unchanged older snapshots and retained drawing data, actor/page/parent identity, and rejection of duplicate IDs, empty additions, stale bases and unresolved image sources without changing either slot. Changed PHP style, references (88 classes) and compatibility checks pass.

**Boundary:** this is an internal transaction component for trusted server-prepared data, not the complete legacy adoption workflow. It does not yet resolve a legacy row, prove an embedding source span, generate a surface ID, or enforce rendering availability. A future caller must perform those checks before invoking it; raw client main text is not proof of a valid binding. No public registration or user-page changes occurred. Ordinary image/PDF adoption remains unavailable.

**Next lead work:** immutable legacy selection/conversion and syntax-aware direct-embedding edits, followed by pinned source delivery and ordinary editor wiring. J64/J65 remain blocked until real integration callbacks exist. No commit/push or new manual-testing invitation. Docker remains solely the test environment.

## Expected PageID enforced by publication — September 24, 2026

Lead extended PagePublicationService::publish with an optional final expectedPageId argument for the upcoming binding-based workflow. When supplied, it requires an existing positive supported-range owner and nonzero base revision; checks current title identity before source work and after source preparation; then checks both the current title and the actual prepared page's ID/namespace/key before granting publication admission. Native revision compare-and-swap, authority checks and atomic main/Layers slot saving remain intact. Existing title-based callers remain compatible and do not yet supply this new argument; this is not public PageID routing or completed adoption.

Fresh native regression passed **65 tests / 311 assertions** across publication, identity preflight, API publication and admission. Added tests cover bound two-slot publication/no-op, wrong identity rejection before source work, forbidden bound-page creation, a real move during source preparation preserving the moved page and old-title redirect, and an injected mismatched prepared page that never reaches the commit callback. Changed PHP style, references (87 classes) and compatibility checks pass.

**Next remains lead-owned:** connect identity resolution and this mandatory expected ID in the adoption service, implement exact direct-embedding source edits, and deliver pinned image/PDF sources before exposing adoption. Do not remove lifecycle guards or expose an unrenderable snapshot. J64/J65 remain blocked. Ordinary embedded Layers saves still do not create owner-page history; there is no new user testing invitation or commit/push readiness. No wiki configuration, user content, manifest or runtime routing was changed. Docker remains only the test environment.

## J63 accepted with correction; PageID edit preflight verified — September 24, 2026

Lead reviewed J63 and corrected default PHP trim accepting NUL/vertical-tab bytes around binding values. Option whitespace is now explicitly space, tab, CR, LF and form feed; canonical values still use the strict binding parser. Three malformed-value cases were added. Fresh combined binding verification passed **92 tests / 198 assertions**; changed PHP style passed.

Lead added internal PageOwnedIdentityResolver::resolveForEdit. It resolves the current native title from PageID using primary reads, checks original-actor edit/read/Layers authority, checks base-revision ownership and text visibility, and rejects stale bases. It supports pre-adoption pages without a Layers slot. Native verification passed **5 tests / 10 assertions**, including native move continuity, old-title redirect isolation, foreign revision rejection, ordinary-text edit conflicts and missing Layers permission (the runner includes its shared harness check).

This is preflight, not a commit lock or a public route. Publication must repeat PageID identity and authority checks against the actual prepared page, and retain the native compare-and-swap check. Title-based pilot guards remain in place; this does not enable moves for scoped pilot pages. No ordinary image/PDF history workflow is ready yet.

**Next is lead-owned:** carry expected PageID through publication and its prepared-update admission checks, then connect syntax-aware binding adoption and exact source delivery. J64/J65 stay blocked; no extra junior test packet is issued. No runtime registration/configuration or user-page edits, commits or pushes occurred. Docker remains only the test environment.

## B01 binding boundary implemented; J63 ready — September 24, 2026

Lead froze an internal separate layersbinding value, v1:<pageId>:<surfaceId>, and implemented PageOwnedBinding::parse. It preserves case-sensitive drawing identity and rejects malformed/coerced/oversized input with fixed errors. Parsing proves syntax only, never page existence or authority. It is not registered or connected to ordinary embeds yet. The binding plan now specifies native revision context, PageID route/draft migration, move/copy behavior and the requirement to replace title-based guards together.

Fresh verification: **31 tests / 63 assertions** passed for the binding boundary; changed PHP style, class references (85 extension classes) and compatibility checks passed. No browser/runtime change is claimed. Existing image/PDF/slide editing still needs adoption and ordinary-path integration.

**Junior J63 is ready** for the ordered-option adapter using the frozen value parser; the exact interface, conflict rules, allowed files and tests are at the top of the [handoff plan](../docs/IMPLEMENTATION_HANDOFF_PLAN.md). Lead retains native parser/source-span integration, PageID authority/lifecycle and atomic adoption. J64/J65 remain blocked. No commit/push occurred. Docker is only the test host; manual acceptance remains on the original wiki.

## J62 reviewed; adoption rules clarified — September 24, 2026

J62 is accepted with lead corrections. Corrected stored byte counts in eight fixture rows, removed invented readingOrder values, and clarified labels/defaults, legacy user identity, media timestamps and current adoption authorship. The matrix now requires rejection of unsupported content rather than silent stripping or publication without historical rendering. Six candidate snapshots passed fresh DocumentSchema validation; source/candidate layer arrays and repeated payloads were checked for equality. This is structural fixture evidence, not a working adoption feature.

Lead B01 now specifies selected-page PDF adoption: copy only the explicitly selected page/set revision into a new surface while preserving the owner's complete existing document. Other PDF pages remain untouched. Default labels preserve set names unless explicitly changed; ownership uses PageID plus stable surface ID, never legacy ownerId. See the [binding plan](../docs/PAGE_OWNED_BINDING_PLAN.md) for the decisions and remaining integration work.

**Next work is lead-owned:** freeze binding grammar, the PageID route/draft/lifecycle transition, and atomic adoption. J63–J65 remain blocked on those concrete interfaces; no extra test-only junior packet is queued. Ordinary image/PDF/slide adoption is not yet available. The original wiki remains the manual test environment, Docker is only its host, and no commit/push occurred.

## Current direction: ordinary page-owned drawings — September 23, 2026

**User acceptance exposed the missing integration:** editing File:ImageTest02.jpg on DeleteMe004 still uses shared Layers storage and creates no DeleteMe004 revision. The slide pilot is not completion of the requested feature. The approved next milestone is explicit PageID-backed ownership, safe adoption of existing annotations and the normal embedding/edit/save/old-revision workflow for images, PDFs and general-purpose slides.

The [page ownership implementation plan](../docs/PAGE_OWNED_BINDING_PLAN.md) defines identity, atomic adoption, move/copy behavior, source pinning, implementation order and acceptance gates. Ownership uses native PageID plus stable surface identity; names are labels. Adoption copies an exact shared revision and commits the embedding binding and complete snapshot in one native page revision. Existing shared sets are preserved. Proposed ownership=page syntax is not implemented or available for use yet.

**Junior J62 is ready** for synthetic conversion fixtures and a loss/compatibility matrix. Lead B01/B02 retain the binding contract, title-to-PageID transition and atomic adoption. J63–J65 are explicitly blocked until their lead interfaces exist; see the handoff plan. Current title-scoped move guards and slide-only editor admission must be addressed, not bypassed. No ordinary image/PDF history readiness or commit/push readiness is claimed. The original wiki remains the manual testing environment. History first, searchable text second, Cargo third.

## Original wiki browser acceptance passed; J61 accepted — September 23, 2026

The original wiki at http://localhost:8080/index.php is the working-copy testing environment. Following the user's clarification, the bounded original-wiki setup was approved and completed. LocalSettings was backed up; existing owner scope was preserved while adding Layers_history_test for manual testing and Layers_browser_acceptance for automation. An ordinary non-administrator QA account supports automated checks; the user continues with their usual account. Existing Main Page/content were preserved. The canonical server address was corrected from an old LAN address to localhost:8080. Docker is only the test host, never an extension runtime requirement.

**Ready for limited page-history testing:** open [Layers history test](http://localhost:8080/index.php?title=Layers_history_test), sign in normally, and select Open the current drawing. This native page uses revid=current, so it follows new saves without copying revision numbers. Editing still receives a concrete base revision; stale numeric entry and conflicting saves remain protected. Native login, the landing-page/editor link, upload form, actual PNG upload and image delivery passed on the original wiki. Automated tests use a separate owner and do not advance the manual drawing.

Original-wiki acceptance exposed a timing bug: the wikipage.content cleanup hook destroyed editors on Special:EditLayersPage and Special:EditSlide because it recognized only action=editlayers. EditorBootstrap now recognizes both canonical special-page names. Two regression cases cover those routes; ordinary navigation cleanup remains intact.

**J61 accepted with corrections.** The blocked-repeat-Save check now waits for completion of that specific real save call, avoiding an assertion against already-idle state. The test also verifies exactly two publication requests after the later deliberate save. Fresh original-wiki Chromium acceptance passed all **5 workflow tests**: local recovery, two-editor conflict, native save/history navigation, false-value round-trip, and committed publication with lost response followed by deliberate reconciliation and another save. Full JavaScript verification passed **198 suites / 14,963 tests**; focused bootstrap coverage passed **71 tests**. Native current-entry/pilot verification passed **27 tests / 335 assertions**. Changed-code style, PHP references and compatibility checks passed. Previous disposable-wiki counts are historical evidence, not the basis of this invitation.

This is the configured slide/text/vector history pilot. Ordinary newly embedded slides and image/PDF annotations are not automatically page-owned; adoption/binding, broader historical rendering and source delivery remain unfinished. Searchable text follows history, then Cargo text integration. Slides remain general-purpose.

**Next work stays lead-owned:** review the staging boundary for the accumulated MediaWiki-native changes, exclude abandoned container prototypes, and complete the supported-renderer/legacy-editor acceptance needed for a commit checkpoint. No commit or push has occurred; commit/push readiness is not yet claimed. No new junior packet is queued merely to add more tests. Earlier setup blockers and alternate-wiki testing instructions below are superseded historical checkpoints.

## Original-wiki setup awaiting explicit configuration approval — September 23, 2026

The existing Docker test host is running again. Fresh native verification passed **27 tests / 335 assertions** across SpecialEditLayersPageTest and PageOwnedPilotTest, including stable revid=current entry across new saves, stale numeric denial and denied editing permission. Changed PHP/JS style, class-reference and MediaWiki compatibility checks also passed in this continuation. J61's specific-click completion observation is corrected; its browser rerun on the original wiki is pending setup.

A concrete original-wiki setup is prepared: enable the default-off pilot only for Layers_history_test (manual testing) and Layers_browser_acceptance (automation), preserving any retained owner keys; back up LocalSettings before appending the bounded settings; create an ordinary, non-administrator QA account for browser verification. No new wiki, wrapper routing or alternate credentials for the user's account are proposed. A native wiki page will link to revid=current and its own history. Existing Main Page/content are not to be replaced.

Automatic approval review rejected executing the setup because it changes persistent original-wiki configuration and creates an account without specific approval for those side effects. No part of the rejected setup command ran. An explicit approval question was sent to the user; dependent configuration/account work must wait. Do not bypass that rejection. Original-wiki user testing and commit/push remain not ready. The previous retired alternate-wiki invitation stays retired.

## Original test wiki only; J61 reviewed and stable entry awaiting native verification — September 23, 2026

The user withdrew the second wiki as a manual acceptance environment. All earlier testing invitations and tmp/ testing links are superseded. Manual readiness must be demonstrated on the original http://localhost:8080/index.php wiki, with its normal login, uploads and existing content. Do not create another manual test wiki or ask the user to enter revision numbers. Preserve the existing temporary wiki's user-created content; no deletion is authorized or performed here.

Lead reviewed J61's real-server commit/aborted browser response, uncertain state, explicit reconciliation and subsequent save. Corrected the blocked-second-Save assertion: it now observes completion of that specific real editor.save call, rather than relying on flags already idle before the click. Added an exact total of two publication requests after the second deliberate edit/save. Junior's five-test results remain reported evidence from the old disposable fixture, not original-wiki acceptance or a fresh lead rerun.

Lead implemented explicit revid=current on Special:EditLayersPage. It resolves the current revision after owner scope/login/edit checks, then delegates to the existing exact prepareEditor admission/source authorization and emits a concrete revision ID for editing and conflict checks. Numeric stale links continue to reject; historical viewer/read APIs are unchanged. Added a native regression covering one stable entry across two publications, continued stale-numeric rejection, and missing edit permission. This is an implementation awaiting native verification, not a testing invitation. It does not implement automatic ownership/adoption of ordinary embedded slides or image/PDF source delivery.

Fresh checks: changed PHP style and changed browser-test ESLint pass. Native integration/browser tests could not run: the existing Docker daemon is stopped (dockerDesktopLinuxEngine pipe unavailable). No new service, container or runtime dependency was introduced. The original wiki has not yet been configured or seeded for this pilot. User testing and commit/push are NOT ready.

Next lead steps, in order: start/inspect the existing test environment; run native current-entry and J61 browser verification; configure bounded test owners on the original wiki while preserving existing settings/content; supply native stable entry links and verify login/upload/editor/save/history there. Automated tests must target a different owner from manual tests. No additional junior feature packet is assigned while these integration gates remain. History remains first, search second, Cargo third.

## Manual testing entry stabilized and uploads enabled — September 21, 2026

The user's second failed editor attempt exposed that automated tests were advancing the same page referenced by manual testing links (revision 26, then 37, then 52). The repeated generic denial was not acceptable testing UX. Created a separate Layers_manual_acceptance owner in the disposable wiki; automated tests retain Layers_browser_acceptance. An ignored local testing.html launcher checks the existing login, discovers the manual page's current revision on each click and then opens the protected exact-revision route. It supplies persistent links to native history, upload and the user's Main Page. Production admission and stale-save rules are unchanged; this launcher is test scaffolding, not the missing production onboarding implementation.

The disposable installer also left uploads disabled. Enabled native uploads with an isolated writable images directory and script-execution denial rules. Verified in Chromium: stable button opens the separate editor, logged-out visitors receive a login instruction, Special:Upload exposes the native form, missing File:Test.jpg offers an upload link, and an actual PNG upload succeeds and is served. The user's Main Page/slide and main wiki configuration/data were preserved. The testing guide now starts with the stable page and supersedes all numbered editor URLs sent previously.

User testing remains limited to the configured slide/text/vector history pilot. Newly embedded slides and image annotations still use the existing workflow. Production current-editor navigation and adoption/binding remain rollout requirements. J61 remains the junior packet. No commit/push was performed. Docker is only the test environment.

## Test-wiki slide overlay repaired; SQLite installation fixed — September 21, 2026

User acceptance found that creating an ordinary slide on the disposable wiki and clicking its edit overlay showed a browser connection refusal. Lead reproduced an HTTP 500 database error inside the modal iframe; the error response retained X-Frame-Options DENY, explaining the misleading browser display. The address and test server were reachable.

The disposable setup loaded Layers after core installation without running the extension schema updater. Running the updater then exposed a real installation defect: LayersSchemaManager selected MySQL-only CREATE TABLE SQL for SQLite. Added the SQLite layer_sets installation schema and selected it for SQLite, preserving MySQL behavior. The existing disposable wiki was updated through native MediaWiki maintenance, preserving the user's Main Page and slide. The normal editor endpoint now returns 200 with same-origin framing. The disposable HTTP harness and local browser provisioning script now run the native updater after loading Layers.

Fresh verification: complete disposable HTTP acceptance passed, now including fresh SQLite extension installation; three HTTP helper tests and changed PHP style checks passed. This fixes a MediaWiki database installation issue, not a Docker requirement. The main wiki configuration/database were not changed.

**Pilot scope clarification:** a slide newly embedded on Main Page still uses the existing slide editor and named-set storage. It does not automatically become page-owned or record its Layers edits in Main Page revisions. Test the new page-history workflow using the preconfigured owner/editor links in ignored tmp/PAGE_HISTORY_TESTING.md. Automatic adoption/binding and integration with ordinary embedding remain explicit lead-owned rollout gaps. The testing invitation should have made this distinction clearer. J61 remains the next junior packet; no commit/push readiness is claimed.

## J60 accepted with corrections; conflict and recovery browser checks passed — September 21, 2026

Lead reviewed J60 and corrected its shared-owner test isolation and restoration. The suite now runs serially, restores visibility from the latest snapshot in teardown with its own timeout budget, and waits for the editor save lifecycle before reopening. A failed intermediate run exposed the reopen timing gap; the final four-test run passes. Cleanup preserves unrelated data and native history.

Lead also fixed an editor lifecycle defect: EditorBootstrap destroyed the live editor during cancellable beforeunload. Cleanup now runs on actual pagehide, so choosing to stay preserves the editor and unsaved drawing. A disposed editor restored from the back/forward cache reloads the same URL to reauthorize and offer local recovery. The real-browser recovery test now dismisses a native leave-page prompt, verifies the drawing survives, then confirms reload and recovery. The bootstrap unit suite passes (69 tests). This shared cleanup correction applies to ordinary editors as well as the page-owned pilot; broad legacy browser acceptance remains a separate gate.

Lead added real-browser coverage for two editors saving divergent drawings from the same base: the stale save receives layers-edit-conflict, local edits remain intact, deliberate reconciliation does not silently merge or publish, the winning revision remains current, and the original snapshot remains unchanged. A second test verifies an actual debounced local backup, reload, explicit recovery confirmation, restored drawing and zero publication/history change during recovery. Fresh verification: **all four native browser workflow tests passed** in Chromium against the isolated SQLite wiki; changed-test ESLint and documentation checks passed. The fresh full JavaScript run passed **198 suites / 14,961 tests**. PHP and the separate rendering-suite counts remain prior evidence, not new runs.

**Testing remains available** through ignored `tmp/PAGE_HISTORY_TESTING.md`; its editor revision link has been refreshed after acceptance advanced the disposable history. The main wiki is unchanged. This is the supported slide/text/vector pilot, not full image/PDF, group/resource-backed historical rendering or migration acceptance. Docker remains only the test environment.

**Next:** junior J61 tests an acknowledged-at-server save whose response is lost, followed by deliberate reconciliation. Lead retains the architectural review of that boundary, broader rendering fidelity and explicit working-tree/staging selection. Not ready to commit/push yet; no commit or push was performed. History stays first, searchable text second, Cargo text fields third. Older checkpoints below are historical and superseded by this entry.

## Browser save blocker fixed; limited pilot testing ready — September 21, 2026

Real Chromium acceptance exposed a missed integration bug: PageOwnedReadClient used the default MediaWiki API JSON format. That format encoded true as an empty string and omitted false properties, corrupting the editor snapshot and causing layers-invalid-snapshot on Save. The client now explicitly requests formatversion=2. Request assertions cover both initial and reconciliation reads; server validation remains strict.

Fresh verification: **539 tests in 15 related client suites passed**; the full JavaScript run passed **198 suites / 14,961 tests**. Changed JavaScript ESLint and documentation checks pass. Three real ResourceLoader/canvas browser checks passed (coordinates/overlap/zero opacity, visible text/textbox/callout content, and no editor module loaded by history). The new opt-in native browser workflow passed: actual keyboard edit and Save, new page revision, unchanged old snapshot, native history-link navigation and actual historical canvas. Screenshots of the editor and old-revision viewer were inspected. This covers Chromium on MediaWiki 1.45.3; it is not complete visual parity for every layer/effect or browser/lifecycle acceptance. Prior native PHP counts are unchanged, not newly rerun here.

**Ready for limited user testing:** an isolated disposable SQLite wiki is running beneath the existing localhost test server. The main wiki's configuration and data are unchanged; its pilot stays disabled. Local URLs, disposable login and instructions are in ignored `tmp/PAGE_HISTORY_TESTING.md`. Test the supported slide/text/vector workflow only. Image/PDF source delivery, groups/resource-backed historical rendering, adoption/migration, search and Cargo are still unfinished. Slides remain general-purpose; this is a staged rollout, not a change to the extension's supported content model.

**Not ready to commit/push yet.** Lead retains browser conflict/recovery/navigation acceptance, supported-renderer fidelity and an explicit staging review of the large working tree (including separation of abandoned host/container prototypes). Junior J60 below is a bounded browser regression packet. No commit/push has been performed. Docker is only the test environment; the extension has no Docker dependency.

## J59 accepted; native history navigation connected — September 21, 2026

J59 is accepted after reviewing registered-route authority forwarding, old-revision configuration, denial output, native cache headers and diagnostic shielding. Observations of unchanged revision IDs/timestamps are scoped evidence, not proof of no mutation anywhere in the database. The fresh combined result below supersedes the junior-reported aggregate for this checkout.

Lead implemented PageOwnedHistoryHooks on MediaWiki's PageHistoryLineEnding hook, installed lazily with the retained pilot scope. Each history row lists View Layers links for its slide surfaces only after an exact authorized snapshot/source read through the shared pilot. Disabled/out-of-scope or unavailable revisions expose no surface labels or links. Each URL carries the owner, that row's explicit revision ID and the literal surface ID; LinkRenderer escapes labels and encodes parameters. Existing history text/classes/attributes are preserved. Unexpected failures are logged server-side without breaking or exposing diagnostics in the history row. The viewer repeats authorization when a link is opened.

Fresh verification: **127 native tests / 838 assertions passed** across J59, the new history-hook tests and the established regression group. The disposable HTTP harness passed, now also requesting the actual native history page and verifying that its two Layers links target the two exact revisions with the correct owner/surface. New native tests check original-authority forwarding, label escaping and untouched history on unavailable data. Changed PHP style, references (84 classes), compatibility and documentation checks pass. No JavaScript changed in this checkpoint.

**Next phase is lead-owned:** browser rendering/navigation/lifecycle acceptance and supported-layer visual parity. No new junior packet is queued. The local pilot remains disabled, and user testing/commit/push readiness is not yet claimed. Groups and resource-backed layer/surface rendering still have the documented explicit failure gates. History navigation is now implemented for the current slide pilot; this does not constitute full corporate-wiki rollout or migration support. Search and Cargo follow page history. Docker remains only the test environment.

## J58 accepted; standalone historical viewer connected — September 21, 2026

J58 is accepted after review and a fresh 536-test client run. Lead connected the separate Special:ViewLayersPage and ext.layers.history module. The page uses the original request authority and prepareViewer for the explicit owner/revid/surface, with fixed denial/error output and non-cacheable/noindex responses. It emits wgLayersRevisionView and a dedicated container, never wgLayersEditorInit or the editor module. The module loads only the shared painter, snapshot-copy utility, view host, historical painter adapter and startup script; it does not load legacy viewer fallback or editable overlays. Page exit disposes rendering; back/forward cache restoration reloads the same URL to reauthorize it.

Fresh lead verification: **15 related client suites / 539 tests passed** (three new startup regressions); **PageOwnedPilotTest: 20 tests / 183 assertions passed**, including native registered historical output for a reader without edit rights. The disposable HTTP harness now verifies both authenticated and anonymous requests for the first revision after the second exists, exact surface/config identity, no-store headers and absence of editor code/config; all harness assertions passed. This is HTTP and mocked client startup evidence, not real browser drawing/visual acceptance. Changed PHP/JS lint, i18n wiring and docs checks pass; 72 existing unused-message warnings remain.

**Limits and next work:** the historical renderer still explicitly rejects groups, group membership, image/custom-shape/marker layers and unknown types. Image/PDF surfaces still need pinned source delivery. Supported text/vector snapshots now have a registered read-only route, but history-page links and actual browser visual/lifecycle acceptance are unfinished. Junior J59 verifies the viewer route's denial/cache/authority boundary. Lead owns history links and real-renderer/browser acceptance. The local pilot remains disabled; no user testing invitation or commit/push readiness is claimed. Page history remains first, text search second, Cargo third; Docker is only the test host.

## J57 accepted; historical painter adapter — September 21, 2026

J57 is accepted with one lead correction: an explicitly empty surface label is preserved; only an absent/non-string label falls back to the surface ID. Added a regression and corrected the old test name (it exercised only a missing label). The view host keeps failure output text-only, removes failed canvases, isolates the renderer's snapshot copy and disposes late resources without reviving removed views.

Lead implemented unregistered `renderPageOwnedRevision` in PageOwnedRevisionRenderer.js. It uses an injected shared LayerRenderer at zoom 1/original dimensions, reverses the stored panel order for painting, skips hidden layers, preserves explicit background false/zero/empty values, and redraws the same snapshot when fonts become ready. Cleanup is idempotent; drawing failures signal the host without raw diagnostics. Eight focused painter regressions cover ordering, coordinates/zero opacity, unsupported types, drawing/cleanup errors and font completion/disposal.

**Explicit current renderer limits:** only the listed synchronous text/vector layer types are admitted. Image/custom-shape/marker layers, groups and group membership are rejected before painting because their resource errors/group fidelity have not been integrated. These restrictions apply only to this new unregistered historical painter, not the existing Layers viewer/editor. A rejected document must show a fixed display failure, never a partial success or latest fallback. No claim of full visual parity follows from injected-painter tests.

Fresh verification: **14 page-owned-related Jest suites / 498 tests passed**; changed JavaScript ESLint and documentation parity checks pass. No PHP changed in this checkpoint; prior native evidence is unchanged, not a fresh native run. Host and painter remain unregistered; no historical page URL is exposed. Junior J58 extends painter/host failure integration tests while lead owns the standalone route/module, real-renderer parity and history navigation. User browser testing and commit/push are not ready. Priorities remain history, text search, Cargo; Docker remains a test host only.

## J56 accepted; historical-view display contract — September 21, 2026

J56 is accepted without production corrections. Lead reviewed the input/scope/visibility tests, read-only and anonymous access, original-authority spy, exact old/new canonical surfaces and whole-document source-authorization cases. A fresh run of the seven-class native regression group passed **118 tests / 615 assertions**. This is service and native request/output coverage; it is not evidence of historical canvas rendering. The HTTP result recorded in the junior report remains junior evidence for this checkpoint.

**Architectural decision:** historical viewing will use a separate read-only page and ResourceLoader module. It will not instantiate LayersEditor, APIManager, draft storage, save clients, legacy SlideController initialization or freshness/latest fallback. The route must obtain prepareViewer's exact authorized bundle and use non-cacheable output. A dedicated view host will show the owner/revision identity, accessible canvas and fixed errors; the lead-owned rendering adapter will reuse the shared layer painter and own visual parity, layer/group visibility, asynchronous resources and cleanup. No success state may show an empty canvas after a rendering failure.

Junior J57 can implement the isolated accessible view host now under the frozen contract below. Lead retains painter integration, server route, history links, browser acceptance and eventual registration. Images/PDFs remain on the same page-history architecture but need pinned source delivery before view exposure; slides remain general-purpose. No historical-view URL or browser-test invitation is available yet. The local pilot remains disabled and no commit/push was performed. Priorities remain history, text search, then Cargo.

## J55 accepted; exact historical viewer boundary — September 21, 2026

J55 is accepted with lead corrections. The HTTP harness now decodes the value immediately following wgLayersEditorInit instead of scanning forward to an arbitrary object, rejects non-object/ambiguous/malformed bootstrap values, confines requests and redirects to the exact HTTP loopback origin, and does not print rejected URLs. It re-fetches page history and both snapshots after the stale publication attempt; the pre-attempt response cannot establish that the failed write left history unchanged. Three helper regression tests cover parsing and URL/redirect boundaries.

Lead added internal `PageOwnedPilot::prepareViewer(ownerText, revisionId, surfaceId, authority)`. Unlike editor preparation it accepts an authorized historical revision and does not require login or edit rights. It uses the same owner scope, exact snapshot/visibility/source checks and literal surface selection, returning only owner, revisionId and the selected surface. It returns no editor configuration, draft identity or publication control. This initial rendering boundary admits slides; pinned asset delivery remains necessary before exposing image/PDF surfaces. It never substitutes latest content. Native verification proves an old surface retains its original text after a later revision changes it, even for a reader without edit rights.

Fresh verification: corrected disposable HTTP harness **passed**, including all seven editor GET scenarios and fresh post-conflict history/snapshot reads; **3 Python helper tests passed**; **114 native tests / 547 assertions passed** across the established seven-class regression group. Changed PHP style, Python compilation, PHP references and MediaWiki compatibility checks pass. Documentation/current-status parity checks pass. The first new historical test compared noncanonical fixture key order to canonical storage; the corrected test compares canonical snapshots with strict equality.

**Next:** junior J56 expands historical-viewer boundary rejection and read-only authority tests. Lead owns the separate read-only rendering page/module, its registration/history links and browser acceptance. The viewer boundary is internal; no historical-view URL or rendering UI exists yet. The editor route remains disabled by default, and the local pilot has not been enabled. No user browser-test invitation, commit or push is claimed. Priorities remain page history, searchable textbox/callout data, then Cargo text fields. Docker remains only the test environment.

## J54 accepted; guarded editor route registered — September 20, 2026

J54 is accepted with lead corrections. The test context now preserves the original Authority via setAuthority instead of reconstructing it from the user. A regression verifies identity forwarding for a restricted authority. Row-count checks establish unchanged totals, not an audit proving zero value mutations; earlier wording claiming the latter is corrected below.

Lead registered Special:EditLayersPage with dependency injection of LayersPageOwnedPilot and a canonical English alias. The shared pilot remains disabled by default, with an empty owner allowlist; the page is unlisted and cannot initialize an editor outside its existing permission/scope/current-revision checks. Parameters are owner, revid and surface. Registration does not create, adopt or migrate content and does not enable the pilot. The ordinary legacy editor remains unchanged.

Fresh verification: **113 native tests / 541 assertions passed**, covering J54 and the complete named six-class regression group. Changed PHP style checks pass. A real HTTP GET against localhost:8080 reached the registered route and confirmed its current denied state: status 200 with the fixed unavailable message, Cache-Control no-cache/no-store/max-age=0/must-revalidate, no wgLayersEditorInit and no editor container. This HTTP probe made no writes or setting changes. It verifies disabled-route behavior, not authenticated browser editing or historical viewing.

**Next:** junior J55 extends the existing disposable SQLite HTTP harness to verify registered enabled/denied editor requests. Lead retains the exact historical viewer and complete browser workflow. Do not invite user acceptance or commit/push yet; no historical-view URL is implemented and the local pilot has not been enabled. History remains the priority, followed by searchable textbox/callout content and Cargo text fields. Docker is only the existing test host, never a runtime dependency.

## J53 accepted; protected editor entry composition — September 20, 2026

J53 is accepted after review, with evidence wording corrected. Its database counts establish unchanged row totals, not unchanged contents of every row. The authority spy proves no authorizeRead call after denied preflight; it does not instrument every lookup. The reported 13-test regression run did not establish execution of the complete named suites. Lead ran all six named classes through core.xml: **106 tests / 375 assertions passed** before further lead changes.

Lead implemented the unregistered native `SpecialEditLayersPage` class. It accepts explicit owner/revid/surface parameters, rejects malformed/noncanonical revision IDs and unsupported subpaths, calls the shared prepareEditor boundary with the request authority, and emits the editor module/configuration only on success. Expected denial and unexpected failure return a fixed localized message; unexpected errors are logged server-side. Output disables client caching, sets CDN max-age zero and noindex/nofollow before validation. Native RequestContext/OutputPage tests cover successful bootstrap and malformed revisions with no editor configuration/module on rejection. It performs no creation, publication, automatic retries or legacy set lookup.

Fresh final verification: **107 tests / 393 assertions passed** across PageOwnedPilotTest, PagePublicationServiceTest, PageHistoryAccessTest, ApiLayersPublishTest, ApiLayersReadTest and PageOwnedPilotRegistrationTest, using the existing MediaWiki Docker test host. Changed PHP style checks, PHP-reference checks (82 classes), MediaWiki compatibility, i18n wiring and documentation checks pass. The i18n check retains 72 existing unused-message warnings. No JavaScript changed in this checkpoint.

**Current gate:** the special page is deliberately absent from SpecialPages registration and has no public URL yet. Junior J54 verifies the remaining native request/output/cache boundaries. Lead retains registration/aliases, exact historical viewing and complete browser acceptance; no browser test invitation or commit/push readiness is claimed. Page history remains first, textbox/callout search second, Cargo text support third. Docker remains a test environment only.

## J52 accepted; server editor preparation boundary — September 20, 2026

J52 is accepted after lead review and fresh verification. UIManager captures page-owned mode from configuration, skips legacy set-controller construction and set/revision header controls, retains Close, and displays the configured owner using textContent. Ordinary editors retain their existing header behavior. This is presentation isolation; it does not make the complete editor read-only.

Lead added internal `PageOwnedPilot::prepareEditor(ownerText, revisionId, surfaceId, authority)`. It requires the enabled pilot, retained owner scope, a registered request user, page read/edit/editlayers preflight and an authorized exact snapshot/source read. It rejects stale revisions instead of falling back to current content. Only an existing selected slide surface is admitted at this delivery stage; image/PDF rendering still requires pinned asset delivery. Returned initialization binds the owner, revision and literal surface, derives wiki/user draft identity server-side, disables automatic creation, and contains no snapshot or source URL. No public route or registration was added. The eventual route must use private/no-store output, handle expected denial with fixed messages, and recheck writes through the existing publisher; preparation is not write authorization.

Fresh lead verification: **22 focused editor/UIManager/page-owned suites, 1,549 tests passed**. **Native PageOwnedPilotTest: 10 tests / 38 assertions passed** on the existing MediaWiki test host. The new native scenario covers valid configuration, server identity, edit-preflight denial, disabled/empty scope, missing surface and stale-base rejection. JavaScript lint and changed PHP style checks pass; the repository PHP check passed (new warnings were subsequently corrected). Junior-reported full-suite counts are not a fresh full-suite lead run.

**Next:** junior J53 extends native editor-boundary rejection coverage without changing production behavior. Lead retains the protected browser route, historical viewer, remaining mutation/read-only restrictions and browser acceptance. No test URL is ready and no commit/push occurred. Page history remains first, search second, Cargo third. Layers has no Docker runtime dependency; Docker hosts this project's tests only.

## J51 accepted and revision control connected — September 20, 2026

J51 is accepted with a lead accessibility correction: completion of an asynchronous check must not steal focus from another control the user moved to. The original control restored focus unconditionally when it had focus at invocation. It now restores only focus lost to the document body, with a regression test for movement to another input.

Lead registered PageOwnedRevisionControl and all eight localized messages in the editor ResourceLoader module. APIManager mounts the control after exact loading and successful draft initialization in writable page-owned mode, injects the explicit checkPageOwnedRevision callback, and disposes it with the editor. Historical read-only sessions skip it. Initialization itself performs no revision check or publication. New integration tests cover mounting, the click callback, cleanup and the historical read-only exclusion.

Fresh verification: **20 focused editor/bootstrap/API/page-owned suites, 1,414 tests passed**. Changed JavaScript ESLint and i18n wiring checks pass; the i18n verifier still reports 72 existing unused-message warnings. Documentation checks and the Current-Status mirror pass. This is client integration evidence, not native-browser focus/layout or full end-to-end page-history acceptance.

**Next work:** junior J52 removes legacy set/revision header controls from page-owned mode. Lead retains the protected server editor entry point, full editing/read-only restrictions and exact historical viewer. The revision-check control is connected, but the server still does not emit a page-owned editor URL. Browser testing is not ready. Before commit/push readiness, finish that usable pilot, run native and browser acceptance, and review the large existing working tree to separate active MediaWiki work from retained abandoned prototypes. No commit or push was performed. Priorities remain page history, searchable textbox/callout data, then Cargo text support. Docker is only the test environment.

## R02 explicit revision reconciliation — September 20, 2026

The lead implemented a read-only reconciliation path through APIManager, the draft lifecycle, editor bridge and session. It persists the local draft before querying the owner's current native page revision, then reads that exact revision through layersread to check owner identity, visibility and source access. No check publishes or retries a save. A later deliberate save still uses the confirmed base revision and the server's conflict check.

Reconciliation advances the base only when the selected surface is unchanged from the previous confirmed base or already matches the local selected surface. Object property order is ignored; array order remains significant. Conflicting changes to selected-surface content or metadata remain blocked with the draft/base intact. Unrelated newer server surfaces and document fields are retained. Edits made during the read remain dirty; duplicate checks and concurrent publication are blocked. Failed discovery, denied/malformed reads and disposal cannot replace the base. Failed backup prevents discovery; failed backup after a successful check is reported separately and must not authorize navigation away.

Fresh verification: **19 focused editor/bootstrap/API/page-owned suites, 1,350 tests passed**, including 28 new reconciliation scenarios. Changed JavaScript passes ESLint. These are unit/integration tests with mocked transport; no new native PHP or browser acceptance is claimed.

**Current gate:** the callable APIManager.checkPageOwnedRevision() path exists, but its user-facing control is not mounted. The server still does not emit a page-owned editor URL; normal editing remains on the existing route. J51 is now ready for junior implementation of the isolated accessible status/check control. Lead retains runtime wiring, protected server entry, legacy/read-only controls, exact historical viewer and browser acceptance. Page history remains first, searchable textbox/callout content second, Cargo text integration third. Layers remains a MediaWiki extension; Docker is only the test environment.

## R02 recovery dialog and authorization recheck — September 20, 2026

The page-owned runtime now uses `PageOwnedRecoveryDialog` instead of window.prompt/window.confirm. Multiple records can be selected with bounded text-only previews; selecting a record is separate from restoring it. Draft markup is inserted with textContent, not HTML. Unreadable records cannot be selected for restoration, and no dialog action publishes or deletes a record. The native modal has labelled controls, cancel/Escape handling, initial focus and return-focus behavior; editor disposal cancels outstanding decisions. Missing native modal support fails closed.

After explicit recovery confirmation, the session re-reads its exact owner/revision to recheck revision visibility and source authorization before applying local data. Failure leaves recovery unapplied and automatic writes disabled. The session base is not advanced. This is a recovery-time check, not a claim of continuously enforced client-side permissions; server publication still authorizes each write.

Fresh verification: **19 focused editor/bootstrap/API/page-owned suites, 1,322 tests passed**. JavaScript lint and dialog CSS style checks pass. Five new DOM tests cover text escaping, selection, bounded previews, cancellation/focus restoration, disposal and unavailable modal support; one lifecycle test proves denied reauthorization prevents recovery. Native browser focus trapping and visual acceptance have not yet been run; DOM tests stub native dialog methods.

**Next lead work:** deliberate conflict/uncertain-result reconciliation, protected server editor entry point, legacy/read-only control restrictions and exact historical viewer, then browser acceptance. The recovery dialog is registered but the server still does not expose a page-owned editor URL. No new junior packet is ready. Page history remains the priority, followed by searchable textbox/callout content and Cargo text integration.

## R02 independent draft records — September 20, 2026

Page-owned editors now generate a fresh cryptographic 128-bit writer ID per editor instance and persist to independent localStorage records for the same wiki/user/owner/base revision/surface. IDs are not inherited from sessionStorage, so duplicating a tab does not intentionally reuse a writer. Writes update only that writer's record; no shared read/check/write index or lock is used. A restored draft is a read source only: the new editor writes to its own record. Older unpartitioned records remain available for recovery and are never overwritten by this runtime.

Recovery enumerates only records for the authorized exact scope. With multiple records the user must choose one, then confirm recovery. Cancelling selection starts neither backup writes nor publication. Selection currently uses a temporary numbered browser prompt, not the final recovery UI; it lacks useful draft previews and deliberate cleanup controls. Independent records can accumulate and consume browser storage; quota errors preserve existing records and block unbacked publication. No automatic pruning or cross-tab atomic deletion is claimed.

Fresh verification: **18 focused editor/bootstrap/API/page-owned suites, 1,316 tests passed**; ESLint clean. Seven added tests cover interleaved independent writers, restoring without changing the write destination, older-record preservation, scope isolation, safe enumeration failures and cancelled selection. These are deterministic shared-storage tests, not real multi-tab browser acceptance.

**Next lead work:** build usable recovery/reconciliation controls and permission rechecks, then the protected server editor entry point and exact historical viewer. The server still does not emit page-owned editor configuration; no browser pilot or new junior packet is ready. Page revision history remains first priority; searchable textbox/callout content and Cargo text support follow.

## R02 draft lifecycle connected — September 20, 2026

APIManager now connects `PageOwnedDraftLifecycle` after an authorized exact-revision load in explicit page-owned mode. The server configuration must supply `pageOwned.draftScope` with wiki/user identity. Historical read-only sessions skip local draft access. The editor module now loads the store/controller/lifecycle and their localized messages.

Live layer/canvas changes schedule a local backup after one second; pagehide and orderly disposal flush it. Saving persists a saving-phase record before the POST, then records the confirmed new base or conflict/uncertain outcome with the latest live edits. A failed final backup does not misreport a confirmed server write, but prevents the editor from treating navigation away as safe. Storage initialization errors show a fixed message and keep publication unavailable.

Recovery is offered only for the exact loaded owner/base/surface and requires explicit confirmation. Restored interrupted/conflicted/uncertain records block publication. Cancelling recovery preserves the stored record and blocks saving/automatic overwrites; it does not discard the record. A late recovery decision cannot revive a disposed editor. Recovery currently uses the browser confirmation dialog; dedicated accessible recovery/reconciliation controls remain unfinished.

Fresh verification: **18 focused editor/bootstrap/API/page-owned suites, 1,309 tests passed**; ESLint passes. Seven lifecycle scenarios include cancellation, corruption, delayed decisions, scheduling and backup failure after confirmed publication.

**Still not browser-ready:** no server editor entry point emits the page-owned mode yet. Lead must finish deliberate reconciliation and recovery controls, prevention of cross-tab draft overwrite, visibility/permission rechecks for recovery, legacy/read-only UI restrictions, historical viewer and browser acceptance. Local backup is best effort (browser termination before a scheduled backup can lose edits); no cross-tab atomicity is claimed. Public pilot APIs remain disabled by default. No new junior handoff is queued. Page history remains first, searchable textbox/callout data second, Cargo text integration third.

## J50 accepted; draft recovery foundation — September 20, 2026

J50 is accepted with lead corrections. The original five-key check allowed inherited identity values combined with unrelated own keys; scope getters/reflection and storage-method accessors could also expose raw exceptions. Lead now requires the exact own data properties, rejects symbol/extra/accessor keys, redacts reflection failures and captures storage methods with their receiver. Four new regressions cover these cases. Store verification now contains **66 tests**.

Lead implemented `PageOwnedDraftController` for lossless live editor capture and explicit recovery inspection after an authorized exact-revision load. Records are bound to wiki/user/owner/base revision/surface and checked again when inspected. Drawing data that is invalid for publication but still finite JSON can be retained; non-JSON edits reject rather than silently disappear. Recovery inspection never advances the base, applies data, deletes a record or retries publication. Historical read-only sessions cannot use draft capture/recovery. Saving/conflict/uncertain records are flagged as publication-blocked candidates.

The session and bridge now accept an optional `beforePublish` callback, invoked in saving phase before any POST. This lets the eventual UI durably record that an interrupted save needs reconciliation. Persistence failure aborts the POST, preserves edits/base and returns a fixed storage error. A callback does not change the publication snapshot captured at save invocation; edits made during asynchronous persistence still remain dirty after confirmation.

Fresh verification: **17 focused editor/bootstrap/API/page-owned suites, 1,302 tests passed**, with ESLint clean. Includes nine controller scenarios and two pre-publication regressions. The junior full-suite count is reported evidence, not a fresh full-suite lead run.

**Remaining lead work:** connect draft scheduling and explicit recovery/reconciliation controls, handle quota/access failures visibly, wire the server editor entry point and historical viewer, and verify the browser workflow. The new draft controller/store are not yet ResourceLoader-wired or automatically invoked; the page-owned route still omits legacy DraftManager. No claim of automatic draft persistence or browser readiness follows from these tests. No new junior packet is queued. Page history remains first, searchable textbox/callout data second, Cargo text support third.

## R02 editor routing checkpoint — September 20, 2026

The editor ResourceLoader now includes the page-owned clients, adapter, session and bridge. EditorBootstrap forwards an explicit `pageOwned` configuration. APIManager routes that mode's load/save to the bridge, rejects legacy set/revision/buffered operations and direct legacy payload/retry calls, and skips legacy revision-list reloads. LayersEditor bypasses legacy normalization/recovery, avoids auto-creating legacy sets or blanking data after a failed exact read, and does not put page revision IDs into `currentLayerSetId`. A save with newer dirty/invalid edits does not authorize navigation away.

Fresh verification: **15 focused editor/bootstrap/API/page-owned suites, 1,225 tests passed**; changed JavaScript ESLint and documentation checks pass. Ordinary legacy behavior remains covered. The server does not yet emit this mode, so no browser pilot is enabled. Legacy DraftManager is deliberately not constructed in page-owned mode: scoped draft persistence/recovery and user-visible conflict controls must be connected before the server entry point is exposed. Do not claim that drafts are already persisted in this mode.

**Next lead work:** own the server entry point, scoped live-editor draft serialization/recovery, read-only and legacy-control restrictions, localized error/conflict UI and exact historical viewing. J50 below is a bounded storage utility that can proceed independently. Search and Cargo follow page history.

J50 is ready for junior implementation; prior no-handoff statements below are superseded. No browser pilot is ready.

## September 20 latest checkpoint — J49 accepted; editor bridge implemented

J49 is accepted with small test corrections. The lead added a bridge from the page-owned session to the existing editor StateManager/canvas. Tests cover loading, canvas settings, publication and preservation of newer edits across successful or rejected saves. **192 tests passed across five client suites**; changed JavaScript lint and documentation checks pass.

The bridge is not yet connected to a server entry point or ResourceLoader. Normal saves remain legacy. Lead next owns visible editor routing, draft isolation, conflict handling and historical viewing. No new junior task or browser pilot is ready; earlier J49-ready statements below are superseded. History remains first priority, searchable textbox/callout data second, Cargo text integration third.

## R02 session controller checkpoint — September 20, 2026

Lead implemented `PageOwnedEditorSession` using the accepted exact reader, publisher and snapshot adapter. A session captures one owner, positive base page revision and exact surface ID. It retains the complete document, publishes once per explicit save, advances the base only on confirmation and preserves edits made while that save is pending. Conflicts and uncertain outcomes retain the draft and block further publication pending explicit reconciliation. Historical read-only mode rejects changes/publication; late results cannot revive disposed sessions.

Fresh client verification: **149 tests passed across four suites**, including 10 session scenarios. The session is not yet ResourceLoader-wired or connected to visible editor controls. Normal saves remain legacy. Draft persistence, deliberate reconciliation, server entry point, historical viewer and the bridge to StateManager/CanvasManager remain lead-owned. Initial sessions require an existing revision; new-document creation/adoption is a separate explicit workflow, not base-zero fallback.

J49 is ready for bounded session acceptance while the lead continues editor integration. Earlier no-junior-task statements below are superseded here.

## Authenticated HTTP checkpoint — September 20, 2026

Fresh retained-owner startup passed. Real authenticated HTTP acceptance in a disposable SQLite wiki passed: two Layers saves produced two core page-history revisions with correct author/summary, exact reading preserved the older snapshot, caching stayed private and a stale save added no revision. The reusable native harness is `scripts/test-page-owned-http.py`; Python/SQLite/test-server requirements apply to this harness only. Existing localhost data, accounts and configuration were untouched.

**Next is lead-owned R02 editor and historical-viewer integration.** Normal editor saves still use legacy storage; no browser editing pilot is ready and the public APIs remain disabled by default. Searchable textbox/callout content follows page history, then Cargo text support. Earlier startup/HTTP-pending checkpoints below are superseded here; broader core/database and lifecycle acceptance still remains.

## Native registration checkpoint — September 20, 2026

The extension now registers the default-off `layersread` and `layerspublish` APIs through its native registration callback and installs the MediaWikiServices bootstrap hook through the manifest. With no retained owners, no Layers content role or lifecycle wrappers are installed and core mergehistory remains unchanged. With retained owners, registration also installs the merge adapter; the service hook installs the paired guards even when publication is disabled. API name collisions reject before partial module installation.

Fresh native regression: **140 tests / 588 assertions passed** on MediaWiki 1.45.3 / PHP 8.3.31. Real localhost HTTP verifies module discovery, default-disabled reading, private zero-age read caching despite requested public cache ages, and native bad-token rejection. No page was published by these HTTP probes. Retained-owner fresh-process startup, authenticated HTTP publication/history and browser/editor integration still require acceptance; R01 is not complete.

Priority remains **page revision history, then searchable textbox/callout text, then Cargo text projection/binding**. All apply to images, PDFs and general-purpose slides. Docker is only the test host. Existing Cargo gallery formatting is not the requested annotation-text integration.

Normal editor saves still use legacy storage. Do not enable the experimental pilot as a production feature. The new `LayersPageOwnedPilotEnabled` setting defaults false; `LayersPageOwnedPilotOwners` defaults empty. Retained owner keys must not be removed while current or archived pilot revisions exist. Earlier unregistered/unchanged-manifest checkpoints below are historical, superseded by this entry.

**LAYERS IS A MEDIAWIKI EXTENSION. DOCKER IS ONLY OUR TEST ENVIRONMENT.**

Layers is not Docker-based. Docker, container workers, PowerShell, .NET and a separate host supervisor are not Layers runtime requirements or feature backends, required or optional. The extension runs within its supported MediaWiki/PHP/database environment and uses normal MediaWiki media capabilities.

## September 20 delivery checkpoint — J48 accepted with corrections

The installed bootstrap boundary tests now cover publication gates, save admission, both native import modes, merge source/destination protection and restoration, with ordinary-operation success cases. Lead strengthened validity and database invariants. Fresh native history regression: **137 tests / 576 assertions passed** on MediaWiki 1.45.3 / PHP 8.3.31; PHP style, class-reference and static compatibility checks pass.

J48 is accepted. The next deliverable is lead-owned initial registration and real HTTP verification, followed by editor/history integration. No new junior packet is queued. Registration remains test-invoked, the manifest is unchanged, normal editor saves still use legacy storage, and no browser pilot is ready. Earlier J48 assignment statements below are historical checkpoints, superseded here.

## Project goal and delivery assessment — September 19, 2026

The current goal is native page revision history for page-owned Layers content: every changed save creates an owner-page revision with actor and summary, old revisions display their saved snapshot, and conflicting or denied saves preserve unsaved work. This applies to images, PDFs and general-purpose slides. Annotation search follows that foundation, then Cargo annotation-text projection. Existing shared content will require explicit adoption; it is not automatically covered.

| Delivery area | Actual state |
| --- | --- |
| Native snapshot/revision storage, permissions and conflicts | Implemented and tested internally |
| Exact read/publish APIs and JavaScript clients | APIs registered but disabled by default; clients accepted; editor integration pending |
| Alternate write/restore paths | Save admission exists; pilot restore veto and import decorator tested through native core entry points; shared composition implemented; native bootstrap registered; retained-owner startup and remaining lifecycle acceptance unfinished |
| Editor saves, historical viewer and usable change presentation | Not integrated; normal saves still use legacy storage |
| First browser pilot | Not ready; no test URL yet |
| Image/PDF historical delivery and legacy adoption | Further integration and acceptance required before broader release |
| Native annotation search and Cargo | Planned, not implemented |

The project is still in integration preparation, not feature acceptance. Test counts establish individual behavior; they do not establish a complete user workflow. The critical path is lead-owned lifecycle protection and registration, followed by editor/history integration. J46, the editor snapshot adapter, is accepted with lead corrections; architectural and integration work remains lead-owned. Docker remains only the test host.

## Architecture correction — September 13, 2026

The lead's container-supervisor direction was a mistake and has been abandoned, not paused. J35 and all planned container dispatch/recovery milestones are cancelled. The unconnected prototype artifacts and J33–J41 test evidence are retained only as records of abandoned work. They are not a deployment plan, an optional backend or a prerequisite for page history. The manifest and registered services do not require Docker.

## September 19 current delivery checkpoint

The test installation is running again. Fresh native regression, including the bootstrap and merge guard, passes **128 tests / 512 assertions**. The earlier style failure is corrected. Shared native composition, exact revision reads/publication and the tested lifecycle guards are implemented internally; normal editor saves still do not create containing-page revisions.

**Junior J46 is accepted with corrections:** the lossless adapter covers images, PDFs and slides. Lead fixed own-JSON-key preservation, premature accessor reads and raw exception leakage. Fresh verification: **54 adapter tests / 139 combined client tests passed**, ESLint clean. This is a bounded part of R02 editor conversion, independent of public registration. Lead retains ownership of history-merge protection, complete pilot bootstrap wiring, HTTP acceptance and editor/draft/history integration. J43/J44 remain gated. J47 is accepted with lead corrections. J48 is ready for bounded bootstrap acceptance; lead retains initial registration, HTTP acceptance and editor integration.

Core inspection confirms MediaWiki 1.45's API and Special:MergeHistory both receive `MergeHistoryFactory`. A native factory decorator now rejects pilot source/destination merges before command creation, and direct core tests verify ordinary merge success. It remains test-wired only. J47 verified API dispatch and exposed an internal-error classification defect. Lead added a typed denial and API adapter, with regressions for controlled errors and no debug traces. Both remain test-wired only. The after-merge hook is too late to serve as admission. HTTP error presentation and other supported versions must be checked before enablement.

The native bootstrap now installs the model/slot, shared save and lifecycle hooks, both import wrappers and merge factory, with paired API definitions. New tests invoke it in an isolated container and publish/read a real revision without the manual component helper. The bootstrap remains test-invoked only; the manifest is unchanged. J48 will verify the remaining installed boundaries before lead startup/HTTP integration.

No browser test URL is ready. Docker is strictly our test environment; it adds no extension runtime requirement.

## September 14 integration checkpoint — shared native pilot service

`LayersPageOwnedPilot` is now registered lazily in the extension service wiring. It composes the publisher, exact reader, shared admission context, lifecycle guards and native importer wrappers from one captured configuration. A composed API test publishes two revisions and reads the first snapshot through the same service. Disabled/empty/outside scope tests cover both APIs; move and import guards remain active in the composed object when APIs are disabled. Fresh native history regression: **112 tests / 454 assertions passed**; PHP style and class/compatibility checks pass.

This advances shared service composition, not public registration. API modules, the content role and lifecycle hook installation remain test-only. The internal configuration inputs default to disabled and no owners; there is no supported administrator enablement procedure yet. History-merge protection, complete bootstrap wiring and HTTP acceptance remain lead-owned before editor integration. Normal saves still use legacy storage. J47 is accepted under the latest handoff; no browser test URL is ready.

## Current lead implementation — R01 in progress

Implemented the native `layersread` API boundary with an explicit exact revision, default-off gate, pilot owner allowlist, original-reader permission checks, private cache mode and redacted errors. It is registered only inside isolated core tests. The historical-read test retrieves an older slide's text after a different newer snapshot is saved. Previous full core result: **351 tests / 2,557 assertions / one existing skip**, no failures. PHP style and message/class-reference guards pass.

The publish boundary now also requires an explicit exact owner-key allowlist; empty, unrelated and prefix-only scopes cannot invoke publication. Fresh focused publish API verification passes **24 tests / 65 assertions**; broader native API/admission/publication/revision-writer regression passes **80 tests / 351 assertions**. The new unregistered pilot lifecycle hook blocks restoration of explicitly scoped pages through MediaWiki PageUndelete. Native full/partial restore tests verify archived revisions remain archived and unrelated pages still restore. Latest native history regression, including import: **96 tests / 405 assertions passed**. Native import admission now also has an unregistered decorator tested through both core importer modes. It rejects pilot targets and Layers roles/models before insertion while ordinary imports succeed. R01 is not complete: shared guard/API registration, remaining lifecycle cases, XML/HTTP acceptance and supported-version verification remain. The manifest is unchanged; no normal-wiki read endpoint or browser pilot is enabled. See the [read boundary](https://github.com/slickdexic/Layers/blob/main/docs/PAGE_OWNED_READ_CONTRACT.md#r01-exact-revision-api-boundary--september-13-2026).

## September 14 continuation — native move protection

The pilot lifecycle guard now rejects moves both out of and into configured pilot owner names, preserving the name-based protection scope. Ordinary moves continue normally. Real native move/restore tests pass **8 tests / 27 assertions**; PHP style passes. This is an unregistered pilot restriction, not production move support. Shared registration, remaining lifecycle paths and HTTP/editor integration are still outstanding. No new junior assignment or testing URL is available yet.


## Native rollback verification — September 14, 2026

The existing save-admission hook was verified through core `rollbackIfAllowed`, using two real authors and actual owner revisions. Rollback to a pre-adoption revision rejects slot removal; rollback to a different snapshot rejects unauthorized replacement. Both leave the current revision and main text intact and insert no revision. A main-text-only rollback with unchanged Layers content succeeds, creates a new revision and preserves the snapshot.

Fresh focused result: **4 tests / 18 assertions passed** (three rollback cases plus the test harness safeguard), PHP style clean. No runtime change was necessary. This is pilot behavior: authorized user-facing restoration of an older Layers snapshot still needs an explicit publication workflow. HTTP rollback UI, undo, merge-history and other core versions are not covered by these tests. All pilot registration remains internal; normal editor saves still use legacy storage.

## Current junior implementation — J42 and J45 accepted with corrections

Lead review corrected J45's raw-error bypass and added synchronous/asynchronous redaction regressions. The read client requires the exact requested revision and keeps the contracted snapshot/geometry envelope. Rechecked this turn: **85 combined client tests passed**, ESLint clean. No newly completed junior packet was found beyond J42/J45. The clients remain unregistered. No junior packet is queued ahead of lead-owned R01 lifecycle/registration and R02 editor/history integration; J43/J44 remain gated.

## Actual feature status

Public Layers saves still use `layer_sets`; they do not yet create revisions of the containing page. The internal page-owned revision writer and related extension code exist, but public registration, lifecycle/admission protection and editor/viewer integration remain unfinished. Native annotation search and Cargo annotation-text projection are also not yet implemented.

The active plan now starts with **lead R01: guarded MediaWiki registration, read API and lifecycle admission**, with **J42 and J45 accepted with corrections: unregistered publish and exact-revision read clients**. Lead R02 then connects the editor and exact-revision viewer for the first complete slide history path. J43/J44 are gated UI/browser follow-ups. Images and PDFs follow on the same revision model. See the [active recovery plan](https://github.com/slickdexic/Layers/blob/main/docs/IMPLEMENTATION_HANDOFF_PLAN.md#active-recovery-plan--mediawiki-native-revision-history). Native search and Cargo follow the history foundation. It covers images, PDFs and general-purpose slides. The first proposed browser pilot is page-owned slide save/history/old revision/conflict behavior, followed by images and PDFs. A test URL will be provided after the extension integration and authorization gates are met. No container-supervisor task gates this work.

The current full core run is recorded above; it is not proof that the editor/history workflow is ready. No public feature enablement or external wiki publication is claimed. The manifest remains 1.5.95. Changes are local/uncommitted.

See the [current implementation queue](https://github.com/slickdexic/Layers/blob/main/docs/IMPLEMENTATION_HANDOFF_PLAN.md) and [review history](https://github.com/slickdexic/Layers/blob/main/docs/JUNIOR_IMPLEMENTATION_REVIEW.md). Earlier entries below are historical, not current assignments or deployment requirements.

## Historical J19–J21 review (superseded by the checkpoint above)

Recovery now fails closed if shared import validation rejects data. Primary-manager set loads carry request-specific response guards, and test cleanup is limited to exact current-run identities. Manual recovery destination/undo behavior, actual API switch integration and fresh browser acceptance remain J22–J24. Earlier reported J21 browser passes predate these corrections. See the [review record](https://github.com/slickdexic/Layers/blob/main/docs/JUNIOR_IMPLEMENTATION_REVIEW.md). No merge, release or external wiki publication is claimed.

## History implementation progress

**Page-owned history is not wired into the editor or public APIs. Existing Layers saves remain on the legacy path and are not revision-compliant.** Internal progress as of September 11, 2026:

| Stage | Implemented internally |
| --- | --- |
| H1/H2 | Genuine revision persistence and a strict versioned snapshot model |
| H3a | Owner edit/create authorization and visibility-aware exact historical reads |
| H3b | Exact local source validation, including a real archived-image upload/replacement test |
| H3c | Integrated publication service with final permission rechecks, combined-slot saves and conflict handling |
| H3d | Unregistered API request boundary with POST/CSRF, input limits, rate limiting, safe errors, and L01 scoped admission enforcement |

The combined core suite passed **121 tests / 515 assertions** on MediaWiki 1.45.3 (including 18 admission tests in `PageOwnedAdmissionTest` and 7 real-asset tests in `RealAssetAdmissionTest`). Alternate-path admission is enforced via `MultiContentSaveHook` and isolated test registration; production registration, HTTP/browser acceptance, historical viewers, source retention and adoption remain pending. The experimental [API contract](https://github.com/slickdexic/Layers/blob/main/docs/PAGE_OWNED_API_CONTRACT.md) does not describe a normally available endpoint. See the [format contract](https://github.com/slickdexic/Layers/blob/main/docs/PAGE_OWNED_DOCUMENT_FORMAT.md) and [implementation contract](https://github.com/slickdexic/Layers/blob/main/docs/PAGE_OWNED_HISTORY_IMPLEMENTATION.md) for exact evidence, limits and remaining gates.

## Earlier engineer report — September 11 (qualified by the lead review above)

J17 uses canonical literal identifiers across save, info, rename and delete. J19 completed safe legacy recovery: unknown-wiki and malformed records are preserved in `localStorage`, a localized banner notice and review/export/recovery dialog are provided, original bytes are exportable as JSON before any import, and manual import marks work dirty without auto-publishing or deleting legacy data. Real runtime scope discovery standardizes on `wgWikiID` with table prefix and `wgScriptPath` disambiguation; prior review scopes remain discoverable. J20 implemented coordinated single-confirmation set switching with failure-safe state retention, monotonic request sequencing (`_switchGeneration`), and flight-time newer edits preservation. J21 completed isolated named-set browser acceptance with two consecutive clean Playwright runs (13/13 passed) against live MediaWiki 1.45.3 on `ImageTest03.png`, verifying single confirmation, dirty cancel restoration, failed load recovery, reload persistence, and failure-safe teardown leaving zero test-owned sets. The junior task queue (J19 → J20 → J21) is complete; lead-owned history work (L01) is next. See the [current review](https://github.com/slickdexic/Layers/blob/main/docs/JUNIOR_IMPLEMENTATION_REVIEW.md) and handoff plan. These are local branch findings, not a release or verified wiki publication.

## Historical junior-task review — September 10, 2026

On the local `codex/j05-exact-draft-cleanup` review branch, not yet merged to main, explicit save names remain literal (including `on`, `off` and `0`), malformed names fail before target resolution, configured seed names are respected, and new slide sets use creation rate limits. Buffered saves preserve replacement edits and compare captured drafts before cleanup. Legacy draft-key collisions and live named-set browser acceptance remain open. See the [review and evidence](https://github.com/slickdexic/Layers/blob/main/docs/JUNIOR_IMPLEMENTATION_REVIEW.md) and [next junior assignments](https://github.com/slickdexic/Layers/blob/main/docs/IMPLEMENTATION_HANDOFF_PLAN.md). These changes do not enable page-owned history.

## Supported content

Layers annotates **images**, individual **PDF pages**, and **standalone slides**. Slides do not need a background file. Text, callouts, drawing tools, named sets and the canvas viewer are shared across these uses. PDF rendering additionally depends on MediaWiki's document thumbnail support.

## Implemented versus planned

The page-owned history pilot is off by default. Rows marked *pilot* describe it only when `$wgLayersPageOwnedPilotEnabled` is set and the page is enrolled or already owns drawings; see the dated entries at the top.

| Capability | Current behavior |
| --- | --- |
| Editing and viewing | Canvas editor, named sets, inline viewer, lightbox, client-side image export and print/download workflows |
| Layer revisions | Separate Layers database revisions; default retention is 50 per named set and document page |
| Owning article history | Ordinary saves: **not implemented**; they do not create a revision of the embedding page. *Pilot:* page-owned drawings are saved as page revisions, with history, diffs, rollback and per-drawing restore |
| History tracking configuration | `LayersTrackChangesInRecentChanges` attempts unchanged-content saves; it is **not a reliable audit trail** |
| MediaWiki text search | Shared layer sets and slides: indexed with their file's `File:` page (no result snippet there) and with every page that shows them; `<gallery>` and Cargo gallery embeds are not. *Pilot:* page-owned drawing text is indexed with the page and shown in result snippets |
| Cargo | Gallery integration can choose a named layer set from query results |
| Cargo annotation rows / field bindings | *Pilot:* one row per page-owned drawing through `{{#layers_cargo_store:}}`, and `{{#layers_fields:}}` fills `{{name}}` tokens with values the page gives, such as Cargo query results, in page-owned drawings and (on any wiki) in shared layer sets and slides the page shows. Rows for shared sets: **planned** |
| Server export fidelity | Some saved properties and failure cases remain unsupported; inspect important exports |

For slide-based SOPs, do not treat shared layer sets as providing controlled-document revision history, searchable slide content, approval/sign-off or immutable records. With the pilot, page-owned drawings on images, PDFs and slides have page revisions, search and Cargo text rows; approval/sign-off and immutable records are still not provided. See the [design proposal](https://github.com/slickdexic/Layers/blob/main/docs/proposals/CARGO_SEARCH_PAGE_HISTORY.md).

## Fixes on main after 1.5.95

- File-set renaming now performs its database update.
- Deleting/renaming across PDF pages verifies ownership of every affected page.
- New revisions retain server-generated creator metadata through pruning.
- Failed buffered saves keep unsaved work open; page restores retain set/background context.
- Stale editor page responses and lightbox image callbacks no longer overwrite the current view.
- Cached server exports are bound to the source title as well as file content/key.
- Zero-opacity lightbox backgrounds remain transparent.

Old unbound export cache files are intentionally not served; regenerate the export. Legacy sets whose creator revision was already pruned and which lack creator metadata require `layers-admin` for deletion/renaming. They remain editable. No schema migration was added by these fixes.

R6.08 follow-up on September 6: strict save-container validation now rejects malformed requests before writes. Explicit empty-list clears remain supported. Standalone PHPUnit passed 802 tests / 1,878 assertions with one skipped; see the [implementation record](https://github.com/slickdexic/Layers/blob/main/docs/SAVE_PAYLOAD_CONTRACT.md). The original checkpoint results below are retained as dated evidence.

## Open findings

The [codebase review](https://github.com/slickdexic/Layers/blob/main/codebase_review.md) records the evidence and severity. Remaining findings include intent-like set names, stale draft cleanup, incomplete/error-prone exports, foreign-file cache invalidation, slide creation rate limiting, misleading substitute tests, vendored dependency auditing, default-set naming inconsistencies, and the unreliable audit option (R6.19). This list is a scope statement, not an exhaustive security certification.

## Verification snapshot

On September 6, 2026: `npm test` passed **180 suites / 14,310 JavaScript tests** and repository guards. PHP lint/style/MinusX passed; PHPUnit ran **686 tests / 1,475 assertions, one skipped**. Two existing duplicate test-stub style warnings remain. Coverage was not remeasured, so no current coverage percentage is claimed.

A controlled Chromium probe reproduced and verified the lightbox scaling fix on the local wiki. A complete browser E2E suite, live database concurrency test and LTS backport verification were not performed for this checkpoint. Test counts do not establish that every workflow is correct.

## Branches and upgrades

`main` requires MediaWiki >=1.44 according to `extension.json`; use a supported MediaWiki release and that release's PHP/database requirements. `REL1_43` is the separate 1.43 branch; do not assume every main-branch fix is already backported. `REL1_39` is unmaintained. Check the destination branch's changelog before an upgrade.

Back up the wiki database, uploads and configuration. Update the extension and run MediaWiki's database updater before use. Preserve old assets and Layers rows in backups: an article-only wikitext export is not a complete backup of annotations.
