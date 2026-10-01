# Layers implementation handoff plan

## J102 and J103 accepted; J104 is next; J105 and J108 to J111 ready; J106 held, J107 withdrawn — September 30, 2026

Charter item 5 (links from layers) is designed in [LINKS_FROM_LAYERS_DESIGN.md](LINKS_FROM_LAYERS_DESIGN.md); **section 1a of it overrides the rest**. J102 and J103 were completed and reviewed separately. Proceed with J104 next, then continue the remaining ready packets serially and return each for separate review.

### J106 — Authors never see a page ID (HIST-9) (**replaced by J113 on September 30**; do not start)

**Advances:** HIST-9 (owner finding, September 30). The owner opened a migrated page and found `[[File:ImageTest02.jpg|layerset=8:002]]`. A page ID is machinery; an author must be able to read, type and copy `layerset=002` and `{{#Slide:name}}`. Bare names already work as input after the migration. The writers still produce the ID form: the migration (`PageCopyMigration` through `DirectEmbeddingRewriter::rewrite()`), rename (`renameReferences()`, called from `PagePublicationService`), copy (`PageDrawingCopy`) and pre-migration adoption.

**Rules (decided by the lead).**
1. **After the migration is recorded** (`MigrationState`), every writer emits the bare name: `layerset=<name>` and `{{#Slide:<name>}}`. Add a `bool $bareNames` option to `rewrite()` and `renameReferences()` (the latter already has one for reading); callers pass whether the migration is recorded.
2. **The migration itself** (which runs before the record exists, when a bare name still means the shared set) writes the bare name **only when it means the same thing before and after**: when the drawing's final name equals the set or slide name the embed resolved to, so the text is unchanged byte for byte. Where the name differs (a numbered name because the name was taken, "<set> (page N)", "<slide> (<set>)", or `layerset=on` resolving to the latest set under a different name) it keeps the explicit `<pageId>:<name>` form. `layerset=on` that resolves to a set of the same name becomes `layerset=<name>`.
3. **Existing pages.** Add `--tidy-names` to `maintenance/migrateLayersToPageHistory.php`: once the migration is recorded, it rewrites every direct embed of the page's own drawings from `<ownPageId>:<name>` to the bare name, one bot edit per page (tag `layers-migration`), dry run without `--commit`, resumable, skipping a page whose text changed since planning. It must refuse to run before the record exists, and it must not touch `<otherPageId>:<name>` (another page's drawing: that embed shows nothing anyway), `layersbinding=`, or an embed where the bare name would resolve to a different drawing (two drawings that differ only by case or underscores resolve to one name; check with the same resolver the reader uses).
4. **Input stays liberal.** `<pageId>:<name>` must still be read everywhere it is read today.
5. **Docs.** `docs/WIKITEXT_USAGE.md` and the upgrade guide: authors write names; the ID form is described only as an accepted input. Update the status page, changelog (and mirrors) and the charter row HIST-9.

**Tests that can fail.** Native: a bare-name page migrates with its text byte-identical; a renamed-because-taken case keeps the explicit form; after the record, rename and copy write bare names and the result shows the right drawing (read it through the page's rendered output, not only the text); `--tidy-names` dry run lists, commit rewrites, a second run does nothing, a page changed meanwhile is skipped and reported; undo of the migration still works on a bare-name page. Update every existing test that asserted the ID form where it is no longer written; do not delete one without saying why. Browser: run `page-owned-named-embeds.spec.js` and the migration specs serially; for each, state what the page text is after the step.

**Gates.** Standalone and native suites, `npm test`, phpcs, `check:phprefs`, `node scripts/verify-docs.js`. Do not run `--tidy-names --commit` on the test wiki; report its dry run output, and the lead will run it.

### J107 — Edit and View-full-size buttons on page-owned drawings (UI-10) (**withdrawn September 30**: waits for the owner-approved behaviour brief; do not start)

**Advances:** UI-10 (owner finding, September 30): page-owned images show no hover buttons; only the list "Drawings on this page" leads to the editor. The old viewer (`ViewerManager`, `ViewerOverlay`) had them; the page-owned bootstraps (`resources/ext.layers/viewer/PageOwnedRevisionBootstrap.js` for bound files and the slide equivalent) do not use `ViewerOverlay` at all.

**Purpose:** a reader hovering (or keyboard-focusing) a page-owned image or slide drawing gets **View full size** (always) and **Edit** (only for those who may edit this page and have `editlayers`), like the old viewer.

**Allowed changes:** the viewer scripts and styles under `resources/ext.layers/`, `extension.json` module declarations and messages, their Jest tests, the Playwright spec `tests/e2e/page-owned-overlay-buttons.spec.js`, this packet and the review ledger. Server code only if no other way exists, and then say why.

1. **Read first:** `ViewerOverlay.js`, the way `ViewerManager._initializeOverlay()` builds it, and how `PageOwnedHeaderControls`/the "Drawings on this page" list gets its edit links for the current user (the parser output is cached across readers, so permission must **not** be baked into it). Report what you find before building.
2. **Build:** reuse `ViewerOverlay` for page-owned drawings. **View full size** opens what the page-owned lightbox or `Special:ViewLayersPage` opens today for that drawing (find it; do not invent a new viewer). **Edit** goes to the same `Special:EditLayersPage` link the list uses for that drawing, and appears only when the list would offer it. Keyboard: the buttons are reachable by Tab, visible on focus, and activate with Enter.
3. **Do not** show Edit on a drawing the page does not own, on an old revision, or to anonymous readers; do not add buttons to the history viewer.
4. **Tests that can fail.** Jest: buttons exist for a bound image and a slide; Edit absent without permission; no overlay on historical views. Playwright, serially, on the owner page with the usual baseline rules: hover shows both buttons for an editor; View full size lands on the viewer of **that** drawing (check the drawing's name there); Edit opens the editor on **that** drawing; an anonymous context sees only View full size (or none if the old viewer shows none to anonymous readers: say which and why); Tab reaches the buttons. Run twice.
5. **Gates.** `npm test`, `npm run check:bundlesize` (PERF-1: still under 150 KB gzip and nothing loads on a page without drawings), the existing page-owned viewer specs, serially.

Record findings, then return for lead review. J106 and J107 are independent; do J106 first.

### J108 — Links, part 3: links reach the wiki's link tables and search (ready)

**Advances:** FEAT-8 ("What links here", `Special:LinkSearch`), SRCH-3 (design PR 2). Follows J102 (the `link` property), which is accepted. Nothing visible changes for readers or editors, so no behaviour brief is needed; **wording in any text a person reads says "layer set", never "drawing"**.

**Allowed changes:** `src/Content/LayersDocumentContentHandler.php`, `src/Revision/PageDrawingSearchText.php` (and the search classes that call it), tests under `tests/phpunit/`, `docs/CURRENT_STATUS.md` and its wiki mirror, the changelog and its mirror, this packet and the review ledger. No JavaScript, no change to what any page displays.

Read the design first: [LINKS_FROM_LAYERS_DESIGN.md](LINKS_FROM_LAYERS_DESIGN.md), section 1a and sections 4 and 5.

1. **Link tables.** Override `fillParserOutput()` in `LayersDocumentContentHandler` so that parsing a revision's `layers` slot registers each layer's `link`: an external URL (the `'/^(?:' . $urlUtils->validProtocols() . ')/i'` test) through `ParserOutput::addExternalLink()`, anything else through `addLink()` with `Title::newFromText( $link )` (main namespace by default, like `[[Foo]]`), skipping a title with an empty DB key (a bare `#Section`) and anything that does not parse. It must **not** emit the JSON table HTML that `JsonContentHandler` produces: return empty output text. Read how core merges a secondary slot's output; the design **assumes** it merges links, and you must prove it.
2. **Prove it with a native test** (`tests/phpunit/core/`, inside the container): publish a page's layers slot through `layerspublish` with layers linking to an existing page, a missing page, `File:Example.png`, a bare `#Section` and `https://example.org/a`; run the job queue (`runJobs` or `JobQueueGroup`) and assert the `pagelinks` rows (the missing page included, the bare section excluded), the `externallinks` row, that `Special:WhatLinksHere` for the target lists the page, and that `Special:LinkSearch` for `*.example.org` lists it. A second revision that removes the links must remove the rows. A link on a layer of a **hidden** (revision-deleted) revision must not be the page's current links; state what you observe.
3. **Search (SRCH-3).** The index text for a page's layer sets already holds each layer's text. Add the link **target** (as written, and with `_` and `#` turned into spaces) for every layer that has a link. **Do not index layer names** (the design says why). A native test: a page whose only link is on a rectangle with no text is found by a search for the target's words; a layer name with no text is **not** found. Also cover the `auxiliary_text` path and the `ShowSearchHit` snippet that already exist for layer text: report what a link-only match shows as its snippet, and fix it only if it is blank.
4. **Reindex.** `maintenance/reindexPageDrawings.php` must pick the new text up; say how an administrator refreshes the link tables of existing pages (`refreshLinks.php`) in the status page.
5. **Gates.** Standalone and native suites, phpcs, `check:phprefs`, `node scripts/verify-docs.js`, `npm test`. Say in your report what the first draft of each test would have done if the implementation were wrong (every assertion must be able to fail).

Record findings, then return for lead review.

### J109 — Links, part 4: Cargo rows per layer (ready)

**Advances:** CARGO-1 (design PR 3, section 1a item 4). Independent of J108. No visible change for readers or editors; text a person reads says "layer set".

**Allowed changes:** `src/Cargo/PageOwnedCargoStore.php`, its tests, `docs/WIKITEXT_USAGE.md`, the status page and mirror, the changelog and mirror, this packet and the ledger. **The existing one-row-per-layer-set behaviour and its fields stay exactly as they are.**

1. **Opt-in mode.** `{{#layers_cargo_store:_table=X|_rows=layers}}` stores one row per layer that has text or a link, with the fields `page`, `revision`, `layer_set`, `kind`, `layer`, `type`, `text`, `link_target` (the owning page's DB key, the revision ID being stored, the layer set's label, its kind `slide`, `image` or `pdf`, the layer's ID, its type, its plain text as the existing search code extracts it, and its `link`). Without `_rows=layers` (or with an unknown value, which must say so rather than guess) the function behaves exactly as today. Every field is passed, blank ones empty, so Cargo never fills them from the template.
2. **Same guards as today:** nothing stored outside the page-owned scope, for a page that owns no layer sets, or for a revision whose content is hidden; hidden layers do not store text (use the same visibility rule as the existing text extraction).
3. **Tests that can fail** (`tests/phpunit/core/PageOwnedCargoStoreTest.php` or a new class, with Cargo installed in the container): the opt-in rows for a layer set with a text layer, a linked shape with no text, a hidden text layer and a layer with neither; the unchanged per-layer-set rows for the same revision; the unknown-value refusal. The existing browser spec `tests/e2e/page-owned-cargo.spec.js` must still pass, run serially; its owner-page baseline rules apply.
4. **Docs:** `WIKITEXT_USAGE.md` shows a two-template example (one declaring and storing per-layer rows), and says the two modes can be used in different tables.
5. **Gates:** standalone and native suites, phpcs, `node scripts/verify-docs.js`, `npm test`.

Record findings, then return for lead review.

### J110 — Make KNOWN_ISSUES.md true (OPS, documentation only) (ready)

**Advances:** the charter's documentation refresh (section 10, item 10). **No production code, no wording change to any feature name.**

**Allowed changes:** `docs/KNOWN_ISSUES.md`, this packet and the review ledger.

1. Read every entry. For each, decide from the **code and the current status page**, not from memory, whether it is still true, fixed, partly fixed or unverifiable, and say which evidence (a file and line, a test, or a status-page section) shows it. Do not delete an entry that is still true. Record a fixed one as fixed with the date and the commit or status-page section, rather than silently removing it.
2. Add entries for known gaps that are missing. Start from the charter's "Partial" and "Open" rows and the protected register in "Read this first" (hover overlay and full-size viewer on page-owned layer sets, server PDF export fidelity, revision deletion untested, XML import refused, the editor's Escape and return target, and so on).
3. Vocabulary: a layer is one element, a layer set is a named set of layers, and "drawing" is used only for "drawing tools" and the like (see the charter, rule 2). Decide by meaning; do not search and replace.
4. Gates: `node scripts/verify-docs.js`. List what you could not verify and why.

Record findings, then return for lead review.

### J111 — Hover overlay and full-size viewer on page-owned layer sets (UI-10) (ready)

**Advances:** UI-10, from the owner-approved [behaviour brief](LAYER_SET_BEHAVIOUR_BRIEF.md) sections 2 and 3. **Read the charter's "Read this first" and the brief before anything else. Wording in anything a person reads says "layer set" or "layers", never "drawing".** This replaces the withdrawn J107.

**Purpose:** a reader hovering (or focusing, or tapping) an image, PDF page or slide that shows one of the page's layer sets gets the buttons the old viewer had: **View full size** for everyone, and **Edit layers** only for those who may edit. View full size opens the viewer with zoom, pan, fit, PDF paging, Print and Download.

**Scope, exactly.** Layer sets that already exist on the page. **Do not remove** the box of links above the page, the `File:` page tab, or any other entry point in this packet: the box stays until the packet that handles an embed naming a layer set that does not exist yet (the lead will say so). Report any other behaviour you think should change; do not change it.

**Allowed changes:** the viewer scripts and styles under `resources/ext.layers/`, the `extension.json` module declarations and messages they need, their Jest tests, a new spec `tests/e2e/page-owned-overlay-viewer.spec.js`, this packet and the review ledger. Server code only if no other way exists; if you need it, stop and say why before writing it.

1. **Read first and report what you found** at the top of your ledger entry: how `ViewerManager._initializeOverlay()` and `ViewerOverlay` build the buttons and decide who may edit; how the page-owned bootstraps (`PageOwnedRevisionBootstrap.js` for images and PDF pages, `SlideController` for slides) mount their canvases; where the old full-size viewer (`LayersLightbox`) gets its layer data and its image, and what it needs to keep Print and Download working from supplied data alone. The parser output is cached across readers, so **who may edit must be decided in the browser, never baked into the page**. If anything does not fit this plan (for example the viewer cannot show a pinned older file version), stop and report.
2. **Build.** Reuse `ViewerOverlay` and `LayersLightbox`; do not write new ones. Buttons use the existing words ("Edit layers", "View full size"); no new wording is needed. **Edit layers** goes to `Special:EditLayersPage` for **that** layer set (the same parameters the box's link uses: owner page, current revision, surface ID) and shows only on the page's current revision. **View full size** shows exactly the file version and layers of the revision displayed, so it also works on an old revision; there, Edit is absent. `noedit` on a slide embed still hides Edit. Keyboard: the buttons are reachable with Tab, visible on focus, and activate with Enter and Space; Escape closes the viewer and returns focus to the button; touch screens show the buttons on tap.
3. **Do not** show Edit on an old revision or a diff, to anonymous readers, or on a layer set the page does not own; do not add the overlay to the history viewer.
4. **Tests that can fail.** Jest: the buttons exist for an image, a PDF page and a slide; Edit is absent without the right and on an old revision; the lightbox is given the exact layers. Playwright, serially, on the owner page with the usual baseline rules and run twice: hover shows both buttons for an editor and View full size only for an anonymous reader; View full size opens the viewer for **that** layer set (check its stroke colour on the canvas, not only that a canvas exists, as the earlier specs do), zoom in changes the scale, a drag pans, Print and Download are present, Download delivers a PDF; Edit layers opens the editor on **that** layer set (check the name in the editor); an old revision offers View full size but not Edit; Tab reaches the buttons and Escape returns focus.
5. **Gates.** `npm test`, `npm run check:bundlesize` (PERF-1: under 150 KB gzip, nothing loads on a page without layers, nothing blocks rendering), the existing page-owned viewer and journey specs, run serially. Tell the lead which screens the owner should look at (list URLs and what to hover).

Record findings, then return for lead review. The owner looks at the screens before this counts as done.

### J112 — A layer set is identified by page, file (or slide), PDF page and name (HIST-4) (ready)

**Advances:** HIST-4, from the owner-approved [behaviour brief](LAYER_SET_BEHAVIOUR_BRIEF.md) section 1 and charter D1 as amended September 30. **Read the charter's "Read this first" first. In anything a person reads, say "layer set" or "layers".** Server only: no editor, overlay, migration or embed-writing change belongs here (J113 does those).

**The rule.** Today a name is unique across a whole page and resolves to the one surface with that label. The owner's model: two images on one page may each have a layer set "ABC"; the same file used twice with `layerset=ABC` is one layer set; a PDF layer set covers the whole document, one surface per PDF page (`source.page`) sharing one name. A layer set's identity key is: for a slide, its name; for an image, its file and name; for a PDF, its file, name and page. (Names compare as today: `DrawingName::key()`, so case, spacing and underscores do not matter.)

**Allowed changes:** `src/Revision/PageOwnedBinding.php`, `DrawingName.php`, `PageOwnedBindingOptions.php`, `PagePublicationService.php` (the rename path), the callers of `resolveNamed()` (`BoundFileHooks`, `BoundSlideHooks`, `WikitextHooks`, `PageDrawingCopy`, `PageOwnedPilot`) only as far as the signature needs, tests under `tests/phpunit/`, `docs/PAGE_OWNED_DOCUMENT_FORMAT.md`, this packet and the ledger. **No change to any message, any text a person reads, the migration, the adoption code's output, `DirectEmbeddingRewriter`, or JavaScript.**

1. **Resolve by identity.** `PageOwnedBinding::resolveNamed()` gets the embed's file, and for a PDF the page the embed shows (find how a `[[File:X.pdf|page=N|…]]` embed's page is read today; default 1). It returns the single surface whose name key matches **and** whose kind and file fit **and**, for a PDF, whose `source.page` is that page. More than one match, or none, returns null as today. A slide embed matches slides only, by name.
2. **`layerset=on` and its show-intent spellings** (`SetNameResolver::SHOW_INTENTS`: on, true, all, 1) now mean the layer set named "Default" (compared as a name: "default" matches). The hide spellings are unchanged. In `PageOwnedBindingOptions::named()` a bare name that is a show intent resolves to "Default" instead of being left alone. A layer set literally named "on" can no longer be reached by a bare embed; say so in your report.
3. **Uniqueness.** `DrawingName::assertPublishable()` refuses a new or changed surface only when another surface has the **same identity key** (so the same name on two different files is allowed, and the same name on two pages of one PDF is the one layer set, but the same name, file **and** page twice is refused). Keep the existing refusal and its message for the refused case. `DrawingName::unused()` and its callers (migration, adoption, copy) take the taken names **of the same file** (or of slides) when numbering a clash.
4. **Rename.** In the publication's rename detection (`PagePublicationService`, around the old-label map), renaming a layer set renames every surface of it consistently (all PDF pages), and the page's embeds that name the old name are rewritten **only when they are embeds of that same file** (or slides, for a slide). **Trap:** renaming "ABC" on file A must not touch `layerset=ABC` embeds of file B. Test it.
5. **Security stays.** An embed naming another page's layer set (the `<pageId>:<name>` form with another page's ID) still shows nothing and never grants editing; the `<ownPageId>:<name>` form still resolves as input.
6. **Tests that can fail** (native and standalone): the resolver (two files, one name; one file twice; a PDF with pages 1 and 3 of "ABC" and an embed with `page=3`; `page=2` with no surface returns null; a slide and an image with the same name); publication (same name on two files accepted; duplicate identity refused; a PDF's pages with one name accepted); `on` resolving to "Default" and not to the latest set; the rename trap; every existing test that assumed page-wide uniqueness is updated, and your report lists each one with the reason. Run `page-owned-named-embeds.spec.js` and the journey specs serially and report; fix a spec only where it asserted the old rule, and say so.
7. **Gates.** Standalone and native suites, phpcs, `check:phprefs`, `node scripts/verify-docs.js`, `npm test`.

Record findings, then return for lead review. If anything in the code contradicts this packet, stop and report; do not choose.

### J113 — Names, not page IDs, in wikitext; the migration under the new model; the tidy step (HIST-8, HIST-9) (ready after J112 is accepted)

**Advances:** HIST-9 and HIST-8, from the brief sections 6 and 7. Replaces J106. Depends on J112. **"Layer set" in anything a person reads.**

**The rules.**
1. **Writers emit names.** `DirectEmbeddingRewriter::rewrite()` and `renameReferences()` take a `bool $bareNames`: when true they write `layerset=<name>` and `{{#Slide:<name>}}` and never a page ID. Callers pass true once the migration is recorded (`MigrationState`). Before it is recorded, adoption and the migration keep the explicit `<pageId>:<name>` form only where a bare name would mean a different set (see 2).
2. **The migration** writes the embed byte for byte unchanged when the layer set keeps the name the embed used. Where it must differ (the rare numbered name, a slide shown with several sets, `layerset=on` that resolved to a set not named "Default") it writes the **bare new name**, not the page-ID form, unless a bare name would resolve to a different layer set before the completion record exists; in that case it keeps the explicit form and lists the page in its report so the tidy step can fix it later. `layerset=on` that resolved to a set named "Default" stays as it is. A PDF's old per-page sets of one name become one layer set with a surface per page, **with no "(page N)" name**. The old rule that gave a name a number because another file on the page used it is gone (J112).
3. **`--tidy-names`** on `maintenance/migrateLayersToPageHistory.php`: once the migration is recorded, rewrite every direct embed of the page's own layer sets from `<ownPageId>:<name>` to the bare name, one bot edit per page (tags `layers-migration` and `layers-page-drawing`), a dry run without `--commit`, resumable, skipping and reporting a page whose text changed since planning. It refuses to run before the record exists, and never touches another page's ID, `layersbinding=`, or an embed where the bare name would resolve to a different layer set than the explicit form does (use the reader's own resolver from J112 to check).
4. **Input stays liberal:** the `<pageId>:<name>` form is still read everywhere it is read today.
5. **Docs.** `docs/UPGRADING.md`, `docs/WIKITEXT_USAGE.md` and the status page: authors write names; the ID form is described only as accepted input. Changelog and mirrors. Charter rows HIST-8 and HIST-9.

**Tests that can fail.** Native: a page of bare-name embeds migrates with its wikitext byte-identical; a clash case and a multi-set slide case; `on` to "Default" and `on` to another name; a PDF with several pages becomes one layer set with surfaces for each page; after the record, rename and copy write bare names and the rendered page shows the right layer set (check the rendered output, not only the text); `--tidy-names` dry run lists, commit rewrites, a second run does nothing, a page changed meanwhile is skipped, it refuses before the record exists, undo of the migration still works on a bare-name page. Update every test that asserted the ID form where it is no longer written, and list each with the reason.

**Gates.** Standalone and native suites, `npm test`, phpcs, `check:phprefs`, `node scripts/verify-docs.js`. **Do not run `--tidy-names --commit` on the test wiki:** report its dry run; the lead runs the commit with the owner watching.

Record findings, then return for lead review.

**Still to be written, after J111 and J112 are accepted:** the editor cases and Import (brief section 4, with the right-click "Copy to page N" and "Move to page N"), the missing-layer-set path that removes the box of links and the `File:` tab, the file-update badge and review flow (section 5), and the wording packet (section 8). The lead writes each from the approved brief; none starts earlier.

### J102 — Links, part 1: the `link` property and its server validation (accepted)

**Advances:** FEAT-8, SEC-3, SEC-5 (design PR 1).

**Purpose:** a layer may carry an optional `link`; the server accepts a good one unchanged and refuses a bad one, for page-owned publication. Nothing reads `link` yet (tracking, search, Cargo, viewer and PDF are later packets).

**Allowed changes:** `src/Validation/` (a new `LayerLinkValidator`, and `ServerSideLayerValidator.php`), `src/Api/ApiLayersSave.php`, `i18n/en.json` and `i18n/qqq.json` (edit textually, never with `JSON.stringify`), `docs/API.md` and `docs/PAGE_OWNED_DOCUMENT_FORMAT.md` (the property), tests under `tests/phpunit/`, this packet and the review ledger. No JavaScript.

1. **The rule (design sections 2.2, 2.3, 1a items 1, 7).** `link` is a string on any renderable layer type. It is refused, never repaired: empty string, any control character (`\x00`–`\x1F`, `\x7F`), leading or trailing whitespace, more than 2048 bytes, a non-string. A value matching `'/^(?:' . $protocols . ')/i'` is an **external URL**: it must parse with `parse_url()` and have a host (except `mailto:`). `$protocols` comes from `MediaWikiServices::getInstance()->getUrlUtils()->validProtocols()` (a *partial* pattern, see the design); inject it into the validator's constructor so standalone tests can pass a fixed one. Anything else is an **internal link**: the text before `#` must be a valid title, or empty when the value starts with `#` followed by at least one character. Validate a title through `Title::newFromText()` with the default (main) namespace, through an injectable callable so standalone tests do not need MediaWiki. `javascript:`, `data:`, `vbscript:`, `file:` and `blob:` are refused by name even if a wiki lists them in `$wgUrlProtocols`.
2. **Wiring.** Add `'link' => 'string'` to `ALLOWED_PROPERTIES` and to `STRICT_PROPERTIES`, and route it through `LayerLinkValidator` **instead of** `validateStringProperty()`, which strips tags and may truncate (read it: a link must be stored byte for byte). One new i18n key per refusal reason (`layers-validation-link-…`), in `en.json`, `qqq.json` and wherever the existing `layers-validation-*` keys are declared; run `npm run check:i18n`.
3. **Publication.** `DocumentSchema` uses the same validator, so a document with a good link publishes unchanged and one with a bad link fails with `invalid-or-lossy-layer-data`. Prove both with a native test in `tests/phpunit/core/` (publish through `layerspublish`, then read the slot back and compare the `link` value exactly).
4. **Legacy refusal (design 1a item 7).** `ApiLayersSave` (legacy `layer_sets`) must refuse any layer carrying `link` with a new error `layers-link-page-drawings-only` and save nothing. Do it **before** anything is written, and test that nothing was.
5. **Tests that can fail.** Standalone unit tests for every refusal above and for acceptance of: `Operations/Intake#Procedure`, `#Section`, `https://example.org/a?b=c#d`, `mailto:a@example.org`, `//example.org/x` (only when the injected protocol list includes `//`), a title with an accent and one with a space. Each refusal test must fail if the rule is deleted: check at least three by temporarily removing the rule. Verify that the stored value is identical to the input (`assertSame`).
6. **Gates.** Standalone `phpunit.xml`, the native suite in the container, phpcs (lines up to 120), `check:i18n`, `check:phprefs`, `check:parallel`, `npm test`, `node scripts/verify-docs.js`. Note the Jest count is unchanged.

**Result:** Implemented in `src/Validation/LayerLinkValidator.php`, `ServerSideLayerValidator.php`, `ApiLayersSave.php`, `i18n/en.json`, `i18n/qqq.json`, `docs/PAGE_OWNED_DOCUMENT_FORMAT.md`, `docs/API.md`, `tests/phpunit/unit/Validation/LayerLinkValidatorTest.php` (54 tests), `tests/phpunit/unit/Api/ApiLayersSavePayloadTest.php`, `tests/phpunit/unit/Revision/DocumentSchemaTest.php`, and `tests/phpunit/core/ApiLayersPublishTest.php`. All gates passed; Jest count unchanged (15,081 passed across 205 suites). Rule removal tests verified (control characters, forbidden protocols, max length). Native publication test verified exact byte-for-byte link preservation and refusal with `invalid-or-lossy-layer-data`.

### J103 — Links, part 2: one shared layer-bounds function (accepted after lead correction)

**Advances:** FEAT-8 (design 1a item 3).

**Purpose:** the link overlay and the PDF annotations both need each layer's axis-aligned box in surface pixels, for **every** layer type and with rotation. Today the logic lives in the editor only (`resources/ext.layers.editor/GeometryUtils.js`, `getLayerBoundsForType()`), which the viewer does not load. Make one implementation that both can use.

**Allowed changes:** a new `resources/ext.layers.shared/LayerBounds.js` (registered in the right `extension.json` modules, in the same style as its neighbours, plus the bundle budget if `check:bundlesize` demands it), its Jest test, `GeometryUtils.js` (delegate to it), this packet and the review ledger.

1. **API.** `LayerBounds.getBounds( layer, options )` returns `{ x, y, width, height }` or `null` (no visible area, such as a group). Cover every type in `ServerSideLayerValidator::SUPPORTED_LAYER_TYPES`: boxes (`rectangle`, `textbox`, `image`, `callout`…), `circle` and `ellipse` (centre plus radius), `line` and `arrow` (`x1, y1, x2, y2`, plus stroke width), `path`, `polygon`, `star` (points), `marker`, `customShape` and text layers. For a text layer without a width, `options.measureText( layer )` supplies `{ width, height }`; return `null` when it is absent and needed. Apply `rotation` (degrees, about the layer's centre) and return the box that contains the rotated shape.
2. **Behaviour must match the editor.** Read `GeometryUtils.getLayerBoundsForType()` and its tests first. The new module reproduces it exactly for every case it handles, and `GeometryUtils` then delegates to the new module. **The existing editor tests must pass unmodified**; if one cannot, report it rather than editing it.
3. **Tests that can fail.** One Jest case per type with hand-computed expected numbers (write the arithmetic in a comment); rotation by 90° swapping width and height of a non-square box; 45° of a square; a line with negative direction (`x2 < x1`); a path and a polygon with negative coordinates; `null` for `group`; the missing-measurer case. No expected value may be produced by calling the code under test.
4. **Gates.** `npm test` (every Jest suite and the bundle budgets), coverage of the new file at 95% or more, `check:parallel`. Do not change any production file other than those named.

Record findings, then return for lead review.

**Result — September 30, 2026:** Implemented in `resources/ext.layers.shared/LayerBounds.js`; registered it in `ext.layers.shared`; changed `GeometryUtils.getLayerBoundsForType()` to delegate while preserving its historical raw, no-rotation/no-stroke result for editor callers. Lead review caught that rotating the adapter result would make `CanvasManager` apply rotation a second time; the adapter now explicitly leaves rotation to `CanvasManager`, while shared viewer consumers get the rotation-aware result. Shared bounds handle every validator-supported layer type, groups return `null`, measured text uses the optional callback, line-like shapes include stroke width by default, and rotation returns a centered axis-aligned box. The new Jest suite uses independent hand-calculated expectations for each type, negative coordinates, both requested rotations, and missing text measurement. Existing `GeometryUtils.test.js` remains unmodified.

**Verification:** Isolated `LayerBounds.test.js`: 43 tests passed; `LayerBounds.js` coverage is 100% statements, 97.82% branches, 100% functions and 100% lines. Full `npm test` completed with exit code 0, including its Jest suites and bundle budgets. `npm run check:parallel` completed with exit code 0. ESLint, extension manifest JSON parsing, `npm run check:docs` and `git diff --check` passed. ResourceLoader review confirmed the shared script precedes its consumers and is a declared dependency of `ext.layers.editor`, `ext.layers`, and `ext.layers.history`. The J103 base implementation was already present in upstream commit `2654dbbf` during review; this lead correction and review documentation remain uncommitted.

### J104 — Performance: why a drawing paints late (PERF-2) (ready)

**Advances:** PERF-2 ("a drawing appears within 300 ms after its image has loaded"; measured 0.6 s to 3.1 s warm, 8.1 s cold). Independent of J102 and J103.

**Purpose:** find what is slow, then fix it in the viewer's start-up path. Known: the drawing's own fetch takes about 0.55 s and starts only after the viewer module has loaded; what makes some warm runs slow is **not known**.

**Allowed changes:** the viewer start-up code (`resources/ext.layers/`, the bound-file and page-owned bootstraps), the `extension.json` module declarations that load it, their Jest tests, `tests/perf/` (only to add a measurement), this packet and the review ledger. The bundle budgets and PERF-1 (150 KB gzip, nothing blocks rendering, nothing on a page without drawings) must still hold. No server code.

1. **Diagnose first, with numbers.** Use `npm run bench` (read `tests/perf/benchmark.spec.js`; run serially). Add a per-stage timeline for a warm and a cold load, from the `img.layers-bound-file` load event to the first painted frame: module request and execution, the `layersread` request (queueing, waiting, download), image decode of the pinned rendition, and the first paint. Report which stage or stages account for the slow warm runs, and show the evidence (a table of at least five runs). If the slow runs have different causes, say so.
2. **Fix what the numbers show.** Likely candidates, to confirm or reject: start the drawing's fetch before the viewer module has executed (the identity is in the page output, so the fetch needs no module); fetch the pinned rendition in parallel with the drawing; avoid repainting or re-decoding. Do not add a second delivery path or cache anything that may differ between readers (see the read contract: only an anonymous read of the owner's current revision may be publicly cached).
3. **Prove it.** Before and after tables from the same bench, warm and cold. The charter target is 300 ms warm; report the real result even if it falls short, with what remains.
4. **Gates.** `npm test`, `npm run check:bundlesize`, the existing Playwright specs that touch viewers (`page-owned-search-pdf-gallery.spec.js` and the journey specs), each run serially.

Record findings, then return for lead review.

### J105 — Performance: where saving and old-revision views spend time (PERF-5) (ready, report only)

**Advances:** PERF-5 (saving a 100-layer drawing at most 1 s on the server, and so does viewing an old revision; measured 1.6 s saving, 1.0 s warm and 3.2 s cold opening an old revision). Independent of the others.

**Purpose:** a profile, not a fix. The server path is the lead's; you report, the lead decides.

**Allowed changes:** a new `tests/perf/` spec or script and a new document `docs/PERF5_PROFILE.md`, this packet and the review ledger. **No production code.**

1. Reproduce both timings with `npm run bench` and report the server-side share: measure inside the container with a temporary timing probe that you **do not commit** (for example `microtime` around stages in a scratch copy, or the MediaWiki debug log `$wgDebugLogFile` timings), for `layerspublish` of a 100-layer drawing (one property changed) and for `Special:ViewLayersPage` of an old revision.
2. Break the time into stages: request and validation (`ServerSideLayerValidator`, `DocumentSchema`), snapshot encoding and hashing, the compare-and-swap and page save (core's edit, `LinksUpdate`, search updates, job queue), the slot reads, and on the view side the source rendition and page rendering. Give each stage's milliseconds over at least five runs, warm and cold, in a table.
3. Name the three largest costs and, for each, what would reduce it and what it would risk (correctness, history, permissions). Do not implement anything.
4. Remove every probe and leave the tree clean apart from the two new files; run `node scripts/verify-docs.js`.

Record findings, then return for lead review.

## J100 and J101 accepted — September 30, 2026

**J100 and J101 are accepted** (see the review ledger). The lead reviewed the charter (section 11 of it) and built the editor's list of other pages' drawings. The lead designed Charter Item 5 (Links from layers: FEAT-8, SEC-5, SRCH-3, CARGO-1) as a unified piece in [LINKS_FROM_LAYERS_DESIGN.md](LINKS_FROM_LAYERS_DESIGN.md). Earlier entries below are historical.

### J100 — Browser acceptance of copying from the editor's list (accepted)

**Advances:** HIST-5, TYPES-3 and scenario S4.

**Purpose:** prove in Chromium what native and Jest tests cover, on the test wiki.

**Allowed changes:** a new spec `tests/e2e/page-owned-copy-from-list.spec.js`, this packet and the review ledger. No production code: report a defect, do not fix it. The wiki rules of J65 apply: write only `Layers_browser_acceptance`, from and back to its baseline by exact-base publication, in the main flow and in `finally`. Skip when `isWikiMigrated` is false. Read the lessons of J97 and J98 first: every assertion must be able to fail, and a bound canvas holds the photograph, so check a drawing by its own stroke colour, as `page-owned-search-pdf-gallery.spec.js` does.

1. **The list.** Open the owner page's editor. "Copy from another page" is visible; the dialog opens with focus in the search box and lists drawings with their pages, never one of the owner page's own. A search for the start of a title (for example `Layers migration fixture/Direct`) lists only drawings of pages with that start; a search for a string that matches nothing says so. Escape closes the dialog and leaves the editor open with focus back on the button. Tab never leaves the dialog.
2. **The confirmation.** Choose "anatomy" of `Layers migration fixture/Direct` (or another drawing with a distinct stroke colour and no name like the owner's "Welcome Slide"). The confirmation page names the drawing, the source page and revision and this page; a GET changes nothing (the owner's latest revision is the same afterwards).
3. **The copy.** Submit with the note "J100". The owner page has a new revision tagged `layers-page-drawing` whose summary is `Copied drawing “anatomy” from [[:Layers migration fixture/Direct]] (revision N): J100`. Its page text is unchanged; `layersread` lists "Welcome Slide" and "anatomy", and the copy's layers equal the source's. The source page's latest revision is unchanged. Do the copy a second time from the list: the new drawing is named "anatomy 2".
4. **Showing it.** Publish the owner page's text with `[[File:<the source's file>|layerset=<owner page ID>:anatomy]]` (take the file from the source drawing's `source.fileTitle`). The page paints the copy: the stroke colour of the source's rectangle or line is found along it, and not found on a control line, as in J98.
5. **Stale and unreadable.** Open the confirmation page, publish another revision of the owner page, then submit the form: the page refuses with the edit conflict message and adds no drawing. Anonymously, the `layersdrawings` API answers `permissiondenied`.
6. Run the spec twice in a row, serially. The second run must pass too, and afterwards the owner page's latest snapshot must equal its baseline.

Record findings, then return for lead review.

### J101 — Browser acceptance of history tools (accepted)

**Advances:** HIST-2.

**Purpose:** prove in Chromium on the test wiki that page history undo links, feeds, and notifications reflect drawing edits and work as intended.

**Allowed changes:** a new spec `tests/e2e/page-owned-history-tools.spec.js`, this packet and the review ledger. No production code: report a defect, do not fix it. The wiki rules of J65 apply: write only `Layers_browser_acceptance`, from and back to its baseline by exact-base publication, in the main flow and in `finally`. Skip when `isWikiMigrated` is false.

1. **Changed drawing gets drawing undo link:** On an edit that modified an existing drawing (such as "Welcome Slide"), `action=history` replaces core's undo link with `undo drawing: Welcome Slide` (class `layers-history-undo-link`, inside `.mw-pager-tools`; its `href` is `Special:ViewLayersPage` with `owner=Layers_browser_acceptance`, `revid=` the **previous** revision and `surface=` the drawing's ID: assert all three exactly). Core's `rollback` remains available.
2. **Drawing undo flow:** Following the link opens `Special:ViewLayersPage` with the drawing's prior canvas and the "Restore this version" button. Submitting it publishes a new revision. **Prove the restore by value**: read the latest `layers` slot through the API before and after, and assert that the drawing's title layer `x` went from the edited value back to the earlier one, that the page text is unchanged, and that the other drawings are untouched. A success message alone is not a pass.
3. **Text-only edit keeps core undo:** An edit modifying only wikitext keeps core's standard `action=edit&undo=...` link.
4. **Added drawing shows no undo link:** An edit that only added a brand-new drawing (which had no prior version on the page) shows no drawing undo link and shows no core undo either (core's undo would only change the text).
5. **Permission check:** A reader who cannot edit sees no undo links. The case that matters is an account with `edit` but **without** `editlayers`: it must see neither core's undo nor drawing undo links on a drawing edit. You may not create accounts; if the wiki has no such account, record that part as **not tested**, not passed.
6. **Feeds:** (Notifications need Echo, which is not installed; report them as out of scope.) Verify in the browser that `Special:RecentChanges`, `Special:Watchlist` (watch the page first, and restore the watch state after) and `Special:Contributions` list the drawing edit with its edit summary and the `layers-page-drawing` change tag.
7. Run the spec twice in a row, serially. The second run must pass too, and afterwards the owner page's latest snapshot must equal its baseline.

Record findings, then return for lead review.

### J99 accepted — September 30, 2026

The upgrade guide was followed on the test wiki and amended (see the review ledger).

## Test wiki migrated; J96 accepted — September 29, 2026

With the owner's approval the whole test wiki is migrated and recorded as complete (see the [current status](CURRENT_STATUS.md)). Shared sets and slides are read-only there now. `meta=siteinfo` reports `layerspagehistorymigrated: true`. Earlier entries below are historical.

### J96 — Browser specs on the migrated test wiki (ready)

**Advances:** HIST-4 and HIST-8.

**Purpose:** sort the browser specs into those that still apply and those that describe shared sets, which the migration retired, and prove bare names in the browser.

**Allowed changes:** a helper `tests/e2e/helpers/migration.js`, which reads `layerspagehistorymigrated` from `meta=siteinfo`; skip conditions in existing specs, as described below; a new spec `tests/e2e/bare-names-after-migration.spec.js`; this packet and the review ledger. No production code. The wiki rules of J65 apply: write only `Layers_browser_acceptance`, from and back to its baseline.

1. Run every spec in `tests/e2e` once, serially, and record each result with its duration.
2. A spec that fails because it saves, renames, deletes or adopts shared sets or slides, or expects a shared set to be shown or found by search, describes the wiki before the migration. Make it skip, with the reason "shared sets are read-only after the migration", when the helper reports the wiki migrated. Skip only the affected tests, and weaken no other assertion. Any other failure is a finding for the lead: record it and leave that spec unchanged.
3. The new spec:
   - From the owner page's baseline, publish text that adds `{{#Slide:Bare probe}}` and `[[File:B010.jpg|layerset=Bare notes]]`.
   - The page view offers "Create page drawing: Bare probe" and "Create page drawing: Bare notes". Create the slide through its link, draw a rectangle and save. The page then paints it, and the embed in the page text is still bare.
   - Rename the drawing to "Bare probe renamed" in the editor and save. The embed becomes `{{#Slide:<pageId>:Bare probe renamed}}`.
   - A `layerssave` request for `B010.jpg` fails with `migrated`.
   - Restore the baseline by exact-base publication, in the main flow and in `finally`.
4. Read-only: on `DeleteMe006` the images of `FT-Image-149-000001.jpg` and `FT-Image-149-000002.jpg` both paint their drawings, and `FT-Image-149-000003.jpg` is a plain image.

Record findings, then return for lead review.

**Result:** Implemented in `tests/e2e/helpers/migration.js`, `tests/e2e/bare-names-after-migration.spec.js` (56.9s, 1 passed; serial `--workers=1`), and skip conditions in 7 existing specs. ESLint clean (0 errors, 0 warnings across all touched files).
- **Migration Helper:** Created `tests/e2e/helpers/migration.js` exporting `isWikiMigrated( options )`, querying `meta=siteinfo` for `layerspagehistorymigrated`.
- **New Acceptance Spec (`tests/e2e/bare-names-after-migration.spec.js`):**
  - Published bare embeds `{{#Slide:Bare probe}}` and `[[File:B010.jpg|layerset=Bare notes]]` on `Layers_browser_acceptance`.
  - Created slide drawing through "Create page drawing: Bare probe" link, drew rectangle and saved.
  - Page painted drawing; wikitext remained bare `{{#Slide:Bare probe}}`.
  - Renamed drawing to "Bare probe renamed" in editor and saved. Embed in wikitext was rewritten to `{{#Slide:228:Bare probe renamed}}`.
  - Confirmed `layerssave` for `B010.jpg` is refused with error code `migrated`.
  - Restored baseline via CAS exact-base publication in main flow and in `finally`.
  - Verified `DeleteMe006` read-only case: `FT-Image-149-000001.jpg` and `FT-Image-149-000002.jpg` mount `.layers-bound-file-view canvas` and paint drawings; `FT-Image-149-000003.jpg` is a plain image (`<img>` with no canvas mounted).
- **Serial Browser Suite Results:**
  - **Passed (21 specs):**
    - `bare-names-after-migration.spec.js` (56.9s, 1 passed)
    - `modules.spec.js` (6.0s, 1 passed)
    - `page-owned-binding.spec.js` (72.4s, 3 passed)
    - `page-owned-cargo.spec.js` (45.7s, 2 passed)
    - `page-owned-copy.spec.js` (41.1s, 1 passed)
    - `page-owned-create.spec.js` (50.8s, 1 passed)
    - `page-owned-default-on.spec.js` (56.6s, 1 passed)
    - `page-owned-diff-restore.spec.js` (51.4s, 1 passed)
    - `page-owned-fields.spec.js` (22.4s, 1 passed, 1 skipped)
    - `page-owned-file-binding.spec.js` (29.1s, 1 passed)
    - `page-owned-journey-drawing-tools.spec.js` (55.0s, 1 passed)
    - `page-owned-journey-layer-types.spec.js` (73.1s, 1 passed)
    - `page-owned-journey-move.spec.js` (49.3s, 2 passed)
    - `page-owned-journey-properties.spec.js` (79.1s, 1 passed)
    - `page-owned-named-embeds.spec.js` (46.2s, 1 passed)
    - `page-owned-refusal-message.spec.js` (29.7s, 1 passed)
    - `page-owned-rename.spec.js` (43.6s, 1 passed)
    - `page-owned-rendering.spec.js` (73.7s, 1 passed)
    - `page-owned-summary.spec.js` (27.7s, 1 passed)
    - `page-owned-workflow.spec.js` (114.4s, 5 passed)
    - `smoke.spec.js` (5.0s, 2 passed)
    - `transforms.spec.js` (290.2s, 14 passed)
  - **Skipped when wiki migrated (7 specs with reason `"shared sets are read-only after the migration"`):**
    - `accessibility.spec.js` (5.1s, 1 skipped: seeds shared slide and tests shared slide adoption notice/screen)
    - `named-sets.spec.js` (6.4s, 13 skipped: tests legacy file shared named sets on `File:ImageTest03.png`)
    - `page-owned-adoption.spec.js` (5.3s, 2 skipped: tests adopting shared slides)
    - `page-owned-file-adoption.spec.js` (5.3s, 1 skipped: tests adopting shared file drawings)
    - `page-owned-fields.spec.js` (Test 2 skipped; Test 1 passed: selective skip of shared sets/slides)
    - `page-owned-journey-acceptance.spec.js` (5.3s, 1 skipped: tests adoption journey from shared slides/drawings)
    - `shown-set-search.spec.js` (5.3s, 1 skipped: tests search finding pages by shared layer sets and slides)
  - **Lead Findings (other failures reported unchanged):**
    - `migration-fixtures.spec.js`: Dry-run comparison failed at line 390 because the test wiki was migrated in commit `8e463da2`, so the live fixtures are in post-migration state rather than the un-migrated baseline expected by the dry run. Unchanged.
    - Legacy editor UI test timeouts and failures on `File:ImageTest03.png`:
      - `editor.spec.js`: Test 1 `can open editor on File page` timed out on `await page.waitForLoadState( 'networkidle' )` during `action=editlayers` navigation. Unchanged.
      - `emoji-picker.spec.js`: Test 4 `can close emoji picker by clicking overlay` timed out after 3.0m on overlay click. Unchanged.
      - `keyboard.spec.js`: Failed on keyboard shortcuts (Escape key deselects all, Ctrl+Z). Unchanged.
      - `layer-groups.spec.js`: Failed on group creation in legacy editor. Unchanged.
      - `properties.spec.js`: Timed out in editor properties panel. Unchanged.
      - `shape-library.spec.js`: Failed on shape library item selection in legacy editor. Unchanged.

## J95 accepted — September 29, 2026

**J95 is accepted** (see the review ledger): migration steps 1 to 3 and undo pass on the corrected fixtures. The change of bare names is built (see the [current status](CURRENT_STATUS.md)). Recording completion on the test wiki needs the owner's approval, because it makes every shared set read-only there and ends the legacy browser specs; no junior packet is ready until then. Earlier entries below are historical.

## J93 and J94 accepted with findings; undo built; J95 ready — September 29, 2026

**J93 and J94 are accepted** with lead findings (see the review ledger); the migration fixes and `--undo` are in the [current status](CURRENT_STATUS.md). The visual acceptance is redone in J95. Earlier entries below are historical.

### J95 — Migration acceptance on corrected fixtures (ready)

**Advances:** HIST-8.

**Purpose:** undo J94's run on the fixtures, correct the fixtures, and prove that every embed shows the same drawing after the migration.

**Allowed changes:** `tests/e2e/fixtures/seed-migration-fixtures.js`, `tests/fixtures/migration/expected-plan.json`, `tests/e2e/migration-fixtures.spec.js`, this packet and the review ledger. The same wiki rules as J93 and J94 apply. You may also run the script with `--undo`, only with the same scope options.

1. Undo J94's run on every fixture, scoped as J94 ran it, and check that each page's text and drawings are back to the seeded state.
2. Correct the seeder. Images must be at least 400×300 pixels, with every layer inside the image. Slide names must be ones the legacy parser accepts, such as `Layers_migration_fixture_slide_one`. Add one embed that uses a spaced slide name and is expected to be listed as `invalid-slide-name`. Correct `expected-plan.json`, including Uses C (`no-current-set`).
3. Compare drawings by their data as well as their pixels. For each embed, the layers the legacy API returned for that set and page before must equal the copy's layers afterwards. Report pixel differences, but keep one threshold of 10% at most. Any difference in data is a finding, including one where the legacy view was wrong, such as `page=` on PDFs; write it down rather than widening a threshold.
4. Rerun the commands; nothing may change.

Record durations and findings, then return for lead review.

**Result:** Implemented in `tests/e2e/migration-fixtures.spec.js` (175.7s / 3.0m, 1 passed; serial `--workers=1`). ESLint clean (0 errors, 0 warnings).
- **Undo & Baseline:** Ran `php extensions/Layers/maintenance/migrateLayersToPageHistory.php --undo --commit` across all 12 fixture scopes. Verified every fixture page and file returned to clean baseline and `Slide:Layers migration fixture slide two` was unlinked.
- **Fixture Corrections:**
  - `File:Layers migration fixture A.png` and `File:Layers migration fixture C.png` upgraded to truecolor 400×300 PNGs with all annotation layers positioned strictly inside image bounds.
  - `File:Layers migration fixture B.pdf` upgraded to 600×400 3-page PDF with annotations on page 1 and page 3 strictly inside bounds.
  - Slide names updated to valid identifiers `Layers_migration_fixture_slide_one` and `Layers_migration_fixture_slide_two`. Added deliberately invalid spaced slide embed `{{#Slide:Layers migration fixture invalid spaced slide}}` on `Slides 2`.
  - Updated `tests/fixtures/migration/expected-plan.json` matching lead's `pendingFor` fix `(after step 1)` in dry-run, recording `invalid-slide-name` on `Slides 2` and `no-current-set` on `Uses C`.
- **Dry-Run Comparisons:** Automated dry run across all 12 fixtures matched `expected-plan.json` with 0 differences.
- **Committed Revisions:**
  - `File:Layers migration fixture A.png`: Revision 2086 (`Moved 2 shared layer sets into page history: "anatomy", "labels"`)
  - `File:Layers migration fixture B.pdf`: Revision 2087 (`Moved 2 shared layer sets into page history: "notes", "notes (page 3)"`)
  - `File:Layers migration fixture C.png`: 0 revisions (`set "old" page 1 not moved (earlier-file-version)`)
  - `Layers migration fixture/Direct`: Revision 2088 (copied 4 drawings from File A and File B, rewrote direct embeds to `<pageId>:<name>`)
  - `Layers migration fixture/Slides 1`: Revision 2089 (copied slide one, rewrote embed to `<pageId>:Layers_migration_fixture_slide_one`)
  - `Layers migration fixture/Slides 2`: Revision 2090 (copied slide one, rewrote embed to `<pageId>:Layers_migration_fixture_slide_one`; kept spaced invalid slide unchanged)
  - `Template:Layers migration fixture frame`: 0 revisions (`not changed (namespace-not-enabled)`)
  - `Layers migration fixture/Template`: Revision 2091 (copied "anatomy" from File A; wikitext unchanged)
  - `Layers migration fixture/Taken`: Revision 2092 (copied "anatomy 2" from File A; rewrote embed to `<pageId>:anatomy 2`)
  - `Layers migration fixture/Uses C`: 0 revisions (`not moved (earlier-file-version)`)
  - `Project:Layers migration fixture`: 0 revisions (`not changed (namespace-not-enabled)`, unchanged at rev 1999)
  - `Slide:Layers migration fixture slide two`: Revision 2093 (created page) and Revision 2094 (copied slide two and rewrote embed to `{{#Slide:245:Layers_migration_fixture_slide_two}}`)
- **API & Data Comparison Verification:**
  - Bot flag, `layers-migration` and `layers-page-drawing` tags, revision comments, and wikitext rewrites validated for all committed revisions.
  - Every embed's drawing data before and after migration compared via API `action=layersinfo` vs PagePublicationService snapshot. After normalizing layer object keys, every copied surface's layers strictly matched legacy data.
  - **Drawing Data Finding:** On `Layers migration fixture/Direct` Embed 6 (`File B page 3`), legacy view displayed page 1 notes (`note_p1`) before migration because `ImageLinkProcessor::resolveLayerSetFromParam()` ignored `page=`. Post-migration correctly copies and displays page 3 notes (`note_p3`).
- **Visual Diff Results (single threshold $\le 10\%$):**
  - All 15 embeds tested passed within the single 10% threshold (`tolerance = 0.10`); largest difference across all embeds was **2.19%** (Direct: 0.00%–2.19%; Slides 1: 0.80%; Slides 2: 0.80% and 0.00%; Template frame: 0.00%; Template: 0.00%; Taken: 1.07%; Uses C: 0.00%; Project: 0.00%).
  - `Slide:Layers migration fixture slide two` canvas verified painted with non-white pixels.
- **Rerun Idempotency:** Rerun of all 12 committed commands verified zero remaining actions, zero errors, and zero new revisions created.
Ready for lead review.

**J90, J91 and J92 are accepted** with lead tightening (see the review ledger). The design of the migration (charter D3, HIST-8) is in the [binding plan](PAGE_OWNED_BINDING_PLAN.md#moving-existing-drawings-into-page-history-the-d3-design--september-29-2026). Steps 1 to 3 are implemented (see the [current status](CURRENT_STATUS.md)); undo, the completion record and the change of bare names are next for the lead. J93 builds the test wiki fixtures; J94 then runs the migration on them only. Earlier entries below are historical.

### J94 — Migration acceptance on the fixtures (ready after J93)

**Advances:** HIST-8.

**Purpose:** run migration steps 1 to 3 on J93's fixtures only, and prove that they do what `expected-plan.json` says and that every fixture page looks the same afterwards. The change of bare names is not built, so template embeds still show the shared set; record that.

**Allowed changes:** `tests/e2e/migration-fixtures.spec.js`, this packet and the review ledger. You may run `maintenance/migrateLayersToPageHistory.php` in the test container, **only** with one of `--file=<fixture file>`, `--page=<fixture page>` or `--slide=Layers_migration_fixture_slide_two`. Never run it without one of these options, and never on anything that is not a J93 fixture. Until `--undo` exists this is one-shot: do not rerun the seeder afterwards.

1. Before migrating, the spec records, for every embed on every fixture page, a screenshot of the painted drawing and the page's text.
2. For each fixture, run the script without `--commit` and save the output. Compare it with `expected-plan.json` and list every difference. Do not edit `expected-plan.json` to match the output; a difference is a finding for the lead.
3. Run the same commands with `--commit`, in order: files A, B, C; then every fixture page; then slide two. Record each revision the script reports.
4. Check through the API that each revision is tagged `layers-migration` and `layers-page-drawing`, is marked as a bot edit, and has the expected summary, drawings and text.
5. The spec then checks every fixture page again. Each embed shows the same drawing: compare the screenshots within a small tolerance and report the largest difference. `Project:Layers migration fixture` is unchanged, and `Slide:Layers migration fixture slide two` exists with its drawings.
6. Rerun the committed commands. Each must report that nothing is left to do, and no new revision may appear.

Record durations, differences and anything that could not be checked, then return for lead review.

**Result:** Implemented in `tests/e2e/migration-fixtures.spec.js` (154.2s / 2.6m, 1 passed; serial `--workers=1`). ESLint clean (0 errors, 0 warnings).
- **Execution & Scope:** Migration run exclusively against J93 fixtures via scoped maintenance commands (`--file=...`, `--page=...`, `--slide=...`). Zero foreign pages touched (`File:B010.jpg`, `Layers_browser_acceptance`, and `Layers_history_test` never touched). Zero page or file deletions.
- **Committed Revisions:**
  - `File:Layers migration fixture A.png`: Revision 2000 (`Moved 2 shared layer sets into page history: "anatomy", "labels"`)
  - `File:Layers migration fixture B.pdf`: Revision 2001 (`Moved 2 shared layer sets into page history: "notes", "notes (page 3)"`)
  - `File:Layers migration fixture C.png`: 0 revisions (`set "old" page 1 not moved (earlier-file-version)`)
  - `Layers migration fixture/Direct`: Revision 2002 (copied 4 drawings from File A and File B, rewrote direct embeds to `<pageId>:<name>`)
  - `Layers migration fixture/Slides 1`: Revision 2003 (copied slide one, rewrote embed)
  - `Layers migration fixture/Slides 2`: Revision 2004 (copied slide one, rewrote embed)
  - `Template:Layers migration fixture frame`: 0 revisions (`not changed (namespace-not-enabled)`)
  - `Layers migration fixture/Template`: Revision 2005 (copied "anatomy" from File A; wikitext unchanged)
  - `Layers migration fixture/Taken`: Revision 2006 (copied "anatomy 2" from File A; rewrote embed to `<pageId>:anatomy 2`)
  - `Layers migration fixture/Uses C`: 0 revisions (set "old" on earlier version not moved)
  - `Project:Layers migration fixture`: 0 revisions (`not changed (namespace-not-enabled)`, unchanged at rev 1999)
  - `Slide:Layers migration fixture slide two`: Revision 2007 (created page) and Revision 2008 (copied slide two and rewrote embed to `{{#Slide:245:Layers_migration_fixture_slide_two}}`)
- **API Verification:** Every committed revision verified: authored by bot user `Layers migration` (in `bot` group), tagged `layers-migration` and `layers-page-drawing`, with expected edit summary, drawing surfaces, and rewritten wikitext.
- **Visual Diff Results:** Every fixture page visually compared before and after migration. Largest visual difference across 14 compared embeds was 28.97% (due to a 4px vertical alignment shift between legacy inline `<img>` and page-owned `<span class="layers-bound-file-view">` in tiny 32x26 thumbnail boxes for File A); normal 300px PDF embeds had 4.27% diff; Template, Uses C, and Project fixtures had 0.00% diff. `Slide:Layers migration fixture slide two` canvas verified painted with non-white pixels.
- **Idempotency:** Rerun of all 12 committed commands verified zero remaining actions and zero new revisions created.
- **Lead Findings (from dry-run and migration):**
  1. *Dry run scoping difference:* Running `--page="<page>"` in isolation without `--commit` before Step 1 commits drawings onto `File:` pages reports `not copied (file-not-migrated)` for file embeds, because files are not yet in `$this->pending`.
  2. *Uses C dry run omission:* On `Layers migration fixture/Uses C`, `fileSource()` fails to find a row matching current sha1 and returns null without setting `$reason`, omitting the embed from `notMoved` in the dry-run output. (Preserved `expected-plan.json` untouched per instructions).
  3. *Template dry run omission:* On `Layers migration fixture/Template`, because `fileSource()` returns null (due to `file-not-migrated`), the template embed is skipped silently during dry-run before Step 1 commits.
  4. *Legacy slide names with spaces:* Legacy embeds naming `{{#Slide:Layers migration fixture slide one}}` displayed `<div class="layers-slide-error">Invalid slide name</div>` before migration because `SlideNameValidator` disallows spaces. After migration, rewritten to `<pageId>:Layers migration fixture slide one`, which `BoundSlideHooks` parses under D1 rules (allowing spaces) and paints successfully.
Ready for lead review.

### J93 — Migration fixtures on the test wiki (ready)

**Advances:** HIST-8.

**Purpose:** a small, repeatable set of shared sets, slides and pages on the test wiki that covers every case of the D3 design, plus a written statement of what the migration should do with each. No production code, and no migration is run.

**Allowed changes:** `tests/e2e/fixtures/seed-migration-fixtures.js`, `tests/fixtures/migration/expected-plan.json`, this packet and the review ledger. **Exception to the J65 rules for this packet only:** you may upload files named `Layers migration fixture *`, create and edit pages named `Layers migration fixture/…`, `Project:Layers migration fixture` and `Template:Layers migration fixture frame`, and save shared sets and slides on those files and on slides named `Layers migration fixture …`, through the ordinary API (`layerssave` with `filename` or `slidename`). Touch nothing else; in particular never `File:B010.jpg`, `Layers_browser_acceptance` or `Layers_history_test`. Do not create `Slide:…` pages, and never delete anything.

1. The seeder is a Node script using the same login configuration as the specs. It is idempotent: on a rerun it checks that each fixture is as expected and creates only what is missing. If a fixture exists in an unexpected state, it stops and says which one, without changing it.
2. Fixtures (each set holds at least one visible layer with distinctive text, so a later check can tell them apart):
   - **A.** An image `Layers migration fixture A.png` with sets `anatomy` and `labels`; `labels` saved three times with different text, and saved last.
   - **B.** A three-page PDF `Layers migration fixture B.pdf` with set `notes` on pages 1 and 3 only. If the wiki cannot render PDFs, stop and report.
   - **C.** An image `Layers migration fixture C.png`, uploaded, given set `old`, then uploaded again as a different image, so `old` belongs only to the earlier version.
   - **Slides:** `Layers migration fixture slide one` (shown by two pages) and `Layers migration fixture slide two` (shown nowhere).
   - **Pages:** `Layers migration fixture/Direct` embeds A with `layerset=anatomy` twice, A with `layerset=on` once, A with `layerset=off` once, A with no `layerset`, and B pages 1 and 3 with `layerset=notes` (`page=` option). `Layers migration fixture/Slides 1` and `/Slides 2` each embed `{{#Slide:Layers migration fixture slide one}}`. `Template:Layers migration fixture frame` contains `[[File:Layers migration fixture A.png|thumb|layerset=anatomy]]`, and `Layers migration fixture/Template` uses only that template. `Layers migration fixture/Taken` embeds A with `layerset=anatomy` and already owns a page drawing named `anatomy` (create it through its own Create link or `layerspublish`). `Layers migration fixture/Uses C` embeds C with `layerset=old`. `Project:Layers migration fixture` embeds A with `layerset=anatomy`.
3. `expected-plan.json` states, for every fixture, what the design says the migration must do: which drawings each `File:` page gets and their names, which pages get which copies and names, which embeds are rewritten and to what (write `<pageId>` for the page's own ID), which pages are template copies, which cases are listed for manual follow-up or not moved, and why. Take every rule from the design section, and write down any case the design does not decide instead of guessing.
4. Run the seeder twice; the second run must change nothing. Record the revision IDs it created and anything that could not be checked, then return for lead review.

**Result:** Implemented in `tests/e2e/fixtures/seed-migration-fixtures.js` and `tests/fixtures/migration/expected-plan.json`.
- **Seeded Fixtures:**
  - `File:Layers migration fixture A.png`: image uploaded with shared sets `anatomy` (1 rev) and `labels` (3 revs; saved last).
  - `File:Layers migration fixture B.pdf`: 3-page PDF uploaded with shared set `notes` on pages 1 and 3.
  - `File:Layers migration fixture C.png`: initial image uploaded with shared set `old`, then new image uploaded over it so `old` belongs only to earlier sha1.
  - Shared slides: `Layers migration fixture slide one` (shown by 2 pages) and `Layers migration fixture slide two` (shown nowhere).
  - Fixture pages created: `Layers migration fixture/Direct` (page 237, rev 1989), `Layers migration fixture/Slides 1` (page 238, rev 1990), `Layers migration fixture/Slides 2` (page 239, rev 1991), `Template:Layers migration fixture frame` (page 240, rev 1992), `Layers migration fixture/Template` (page 241, rev 1993), `Layers migration fixture/Taken` (page 242, rev 1995 with pre-owned drawing "anatomy"), `Layers migration fixture/Uses C` (page 243, rev 1996), `Project:Layers migration fixture` (page 244, rev 1999).
- **Idempotency:** Seeder verified on second run: checked all 12 fixtures and reported 0 changes needed.
- **Expected Plan:** Written in `tests/fixtures/migration/expected-plan.json` covering expected output for all 12 fixtures per D3 migration design.
Ready for lead review.

## Drawings in page history are on by default; J92 ready after J91 — September 29, 2026

See the [current status](CURRENT_STATUS.md) entry. Contract: no pilot setting remains; `$wgLayersPageDrawingNamespaces` (default `null` = content namespaces and `File:`) decides where pages may start drawings, and a page that owns drawings always takes part. The test wiki's `LocalSettings.php` still sets the retired pilot variables; they are ignored. J90 and J91 are still ready and come first. Earlier entries below are historical.

### J92 — Browser acceptance of drawings on by default (ready after J91)

**Advances:** HIST-3.

**Purpose:** prove on the test wiki that a page nobody enrolled can start a drawing, and that a page outside the configured namespaces cannot. Acceptance only; no production code.

**Allowed changes:** a new spec `tests/e2e/page-owned-default-on.spec.js`, this packet and the review ledger. **Exception to the J65 rules for this packet only:** besides the owner page you may create and edit two new pages, `Layers D2 probe` (main namespace) and `Project:Layers D2 probe`. Never delete them; on later runs, reuse them and restore their text. Do not touch any other page.

1. Create or reset `Layers D2 probe` with the text `{{#Slide:<its page ID>:D2 slide}}` (create it first with plain text to learn its ID). It has no drawings and was never enrolled.
2. On its page view the drawing controls offer "Create page drawing: D2 slide". Follow it, draw a rectangle, save with an empty summary. Exactly one new revision appears with the comment `Added drawing “D2 slide”` and the `layers-page-drawing` tag, and the page then shows the drawing.
3. Create or reset `Project:Layers D2 probe` the same way with its own page ID. Its page view offers no "Create page drawing" link, and a `layerspublish` API request for it (with a valid document and base) fails with `layers-publication-disabled`.
4. The owner page still works as before: open its drawing from the editor route, move a layer, save, and restore the baseline by exact-base publication.
5. Leave both probe pages in place; their history is the record. On a rerun, first publish `Layers D2 probe` with an empty drawing list (exact base, same text), so step 2 again starts from a page without that drawing.

Record durations and anything that could not be checked, then return for lead review.

**Result:** Implemented in `tests/e2e/page-owned-default-on.spec.js` (39.6s, 1 passed). Created probe pages `Layers D2 probe` and `Project:Layers D2 probe` and preserved them in place (never deleted), with rerun reset verified (Layers D2 probe reset with empty drawing list). Owner page verified working as before and baseline cleanly restored in main flow and finally. Ready for lead review.

## J89 accepted; another page's drawing can be copied; J91 ready after J90 — September 29, 2026

See the [current status](CURRENT_STATUS.md) entry. **J89 is accepted** (see the review ledger). Contract: an embed naming another page's drawing shows nothing and gives editors who can read that page a "Copy “<name>” from <page> to this page" link to `Special:CopyLayersDrawing`; confirming adds a new drawing and rewrites the embed in one revision. J90 is still ready and comes first; J91 follows. Earlier entries below are historical.

### J91 — Browser acceptance of copying another page's drawing (ready after J90)

**Advances:** HIST-5 and TYPES-3.

**Purpose:** prove in the browser the charter's scenario S4 as far as it is built: a page that carries an embed of another page's drawing can copy it, the copy records its source, and afterwards neither page follows the other. Acceptance only; no production code.

**Allowed changes:** a new spec `tests/e2e/page-owned-copy.spec.js`, this packet and the review ledger. The J65 wiki rules and the known-baseline rule apply. The owner page is the only page you write. The source is `Layers_history_test` (page 227, drawing "Welcome Slide"): read it through the API only and never write to it.

1. From the baseline, publish (exact base) the baseline drawing renamed to "Copy probe baseline", and page text with `{{#Slide:227:Welcome Slide}}` appended. Read 227's page ID and its current revision from the API; do not hardcode them.
2. On the page view: the embed shows no drawing, there is no "Edit page drawing: Welcome Slide" link, and the controls list exactly one "Copy “Welcome Slide” from Layers history test to this page" link.
3. Follow it. `Special:CopyLayersDrawing` must name the source page and its current revision and write nothing (the owner's latest revision ID is unchanged). Press Cancel: you are back on the page and nothing was written.
4. Follow the link again, type the note "J91 copy" and confirm. Exactly one new revision must appear. Its comment must be exactly `Copied drawing “Welcome Slide” from [[:Layers history test]] (revision <N>): J91 copy` with 227's revision; its main text must name the owner's own page ID in the embed; its `layers` slot must hold the baseline drawing unchanged plus "Welcome Slide" with a new ID (not `presentation`) and the same layers as the source.
5. `Layers_history_test` must still be at the same revision.
6. On the page view the copy is painted, the controls read "Edit page drawing: Welcome Slide" and offer no copy link. Open the editor from that link, move a layer and save: the owner changes, and 227 is still at the same revision with its layer where it was.
7. While step 3's confirmation page is open, run axe-core on it as `tests/e2e/accessibility.spec.js` does (WCAG 2.2 A and AA) and fail on any critical or serious violation; report the result.
8. Restore the baseline by exact-base publication, in the main flow and in `finally`.

Record durations and anything that could not be checked, then return for lead review.

**Result:** Implemented in `tests/e2e/page-owned-copy.spec.js` (57.0s, 1 passed). Special:CopyLayersDrawing audited with axe-core (0 critical or serious violations). Source `Layers_history_test` left untouched at revision 574. Baseline cleanly restored in main flow and finally. Ready for lead review.

## An embed can start a new drawing; J90 ready after J89 — September 29, 2026

See the [current status](CURRENT_STATUS.md) entry. Contract: an embed on its own page naming a drawing the page lacks gets a "Create page drawing: <name>" link in the page's drawing controls; it opens the editor on an empty drawing and only the first save writes. J89 comes first; J90 follows. Earlier entries below are historical.

### J90 — Browser acceptance of creating a drawing from an embed (ready after J89)

**Advances:** HIST-4.

**Purpose:** prove in the browser that a page can start its own drawing from an embed, that nothing is written until the first save, and that another page's embed is never offered. Acceptance only; no production code.

**Allowed changes:** a new spec `tests/e2e/page-owned-create.spec.js`, this packet and the review ledger. The J65 wiki rules and the known-baseline rule apply. You may upload one small test image for step 4 (never delete files); reuse it if it already exists.

1. From the baseline, publish page text (exact base, drawings unchanged) with three embeds: `{{#Slide:<pageId>:Created slide}}`, `[[File:<test image>|layerset=<pageId>:Created notes]]` and `{{#Slide:<pageId + 1>:Other page}}`. Read the page ID from the API.
2. On the page view, the drawing controls must list "Create page drawing: Created slide" and "Create page drawing: Created notes", and nothing for "Other page". The first two embeds show no drawing yet.
3. **Slide:** open "Create page drawing: Created slide". The header reads "Drawing: Created slide". Press Rename drawing: the message must be the exact English text of `layers-page-drawing-rename-new`. Leave the editor without saving: the latest revision ID must not change.
4. **Draft:** open it again, draw one rectangle, reload the editor page, restore the draft from the recovery dialog, and check the rectangle is there. Save with an empty summary. Exactly one new revision must appear, with the comment `Added drawing “Created slide”` and the `layers-page-drawing` tag; its `layers` slot must hold the baseline drawing unchanged plus a slide named "Created slide" with one rectangle.
5. **Image:** open "Create page drawing: Created notes". The editor must show the uploaded image; draw one shape and save. The new drawing must be of kind `image` with its `source` naming the uploaded file's current version.
6. On the page view both drawings are painted, the controls now read "Edit page drawing: …" for both, and "Other page" still shows nothing.
7. Rerun `tests/e2e/accessibility.spec.js` and report any change.
8. Restore the baseline by exact-base publication, in the main flow and in `finally`.

Record durations and anything that could not be checked, then return for lead review.

**Result:** Implemented in `tests/e2e/page-owned-create.spec.js` (47.1s, 1 passed). Tested slide creation, draft recovery and first save, and image creation on existing fixture `File:B010.jpg`. Reran accessibility audit `tests/e2e/accessibility.spec.js` (0 new violations). Baseline cleanly restored in main flow and finally. Ready for lead review.

## J88 accepted; PERF-4 met; J89 ready — September 29, 2026

**J88 is accepted** with lead findings (see the review ledger); the benchmark now covers every PERF criterion. Earlier entries below are historical.

### J89 — Browser acceptance of edit summaries (accepted)

**Advances:** HIST-1.

**Purpose:** prove in the browser that every drawing save through the editor gets a summary in page history: the one typed into the header's Summary field, or an automatic one naming what changed. Acceptance only; no production code.

**Allowed changes:** a new spec `tests/e2e/page-owned-summary.spec.js`, this packet and the review ledger. The J65 wiki rules and the known-baseline rule apply: fail unless the owner starts at its baseline, and restore that baseline, not the state found.

1. Open the editor on the owner's current revision (`Special:EditLayersPage` with `owner`, `revid` and `surface=presentation`, as `page-owned-workflow.spec.js` does). The header must show a field labelled "Summary:" that is empty.
2. **Automatic, one change:** move the text layer (select it in the layer list, press an arrow key) and press Save with the Summary field empty. The new revision's comment must be exactly `Edited drawing “Welcome Slide”`, and it must carry the `layers-page-drawing` tag.
3. **Automatic, two changes:** rename the drawing to "Summary probe" with the Rename button, move the layer again, and Save with the field empty. The comment must be exactly `Renamed drawing “Welcome Slide” to “Summary probe”; Edited drawing “Summary probe”`.
4. **Typed:** move the layer again, type `Probe summary` into the field and Save. The comment must be exactly `Probe summary`, and the field must be empty afterwards.
5. **History page:** open `action=history` for the owner and check that the three summaries from steps 2 to 4 appear on the three newest rows, in order.
6. Rerun `tests/e2e/accessibility.spec.js` and report whether the editor screen, which now has the Summary field, gained any violation.
7. Restore the baseline by exact-base publication, in the main flow and in `finally`.

**Result:** Implemented in `tests/e2e/page-owned-summary.spec.js` (27.1s, 1 passed; accessibility test `tests/e2e/accessibility.spec.js` verified with 0 new violations). Baseline cleanly restored in main flow and finally. Ready for lead review.

## Every drawing save has a summary; J88 ready — September 29, 2026

See the [current status](CURRENT_STATUS.md) entry. Contract: the page-owned editor's header has a Summary field (label "Summary:"); Save publishes it and clears it, and an empty one gets an automatic summary in the content language. Browser specs should save through the Save button and, where the summary matters, type it into that field. Earlier entries below are historical.

### J88 — Measure resizing and panning; report cold and warm separately (accepted)

**Advances:** PERF-0 and PERF-4 (and makes PERF-2 and PERF-5 readable).

**Purpose:** PERF-4 names dragging, resizing and panning; the benchmark measures only dragging. Its runs also share one browser, so run 1 is cold and the others warm, and a median across them mixes the two. Measurement only; no production code.

**Allowed changes:** `tests/perf/benchmark.spec.js`, the results file it writes, this packet and the review ledger. The J65 wiki rules and the known-baseline rule apply as before.

1. **Resizing:** in the 100-layer drawing, select a rectangle, press on its bottom-right resize handle and move the mouse in small steps for 2 s, counting animation frames as dragging does. Afterwards assert that the layer's width and height in `stateManager` changed; otherwise the frames were not spent resizing. Find the handle's position from the editor (the selection handles are drawn by `SelectionRenderer`; `HitTestController` decides what a point hits), not by guessing.
2. **Panning:** the editor pans on a middle-button drag, or on a left-button drag while Space is held (`CanvasEvents.js`). Pan for 2 s the same way and assert that `canvasManager.panX` or `panY` changed.
3. **Cold and warm:** for PERF-2, PERF-3 and PERF-5 record run 1 as cold and the median of the later runs as warm, and say in the criteria summary which one each verdict uses (warm, for all three). Keep every run's raw values.
4. Rerun `npm run bench`. The results file gets a new time-stamped name; do not rename or edit earlier ones.

Record durations and anything that could not be measured, then return for lead review.

**Status:** implemented awaiting lead review; benchmark script `tests/perf/benchmark.spec.js` verified via `npm run bench` (`npx playwright test -c tests/perf --workers=1`) (**1 passed**, 2.7m); new time-stamped results file written to `tests/perf/results/2026-09-29-0405-test-wiki.json` (earlier results files preserved untouched); ESLint clean (**0 errors, 0 warnings**). Measured 3 complete iterations across all criteria:
- **Baseline enforcement:** Verified owner begins in known baseline state (revision 1803: text `"Dedicated automated Layers history acceptance page."`, single slide drawing `presentation` labelled `"Welcome Slide"`). Verified owner restored to this known baseline at conclusion (revision 1883) and in `finally`.
- **PERF-4 (Dragging, Resizing, Panning, and Inside-the-Page Typing):**
  - Dragging: 60.0 FPS median (cold: 60 FPS; run 2: 60 FPS; run 3: 60 FPS; target $\ge 50\text{ FPS}$: met).
  - Resizing: Bottom-right (`se`) handle found from `SelectionRenderer` and verified via `HitTestController.hitTestSelectionHandles` (not guessed); moved mouse for 2 s in small steps; verified layer width and height in `stateManager` changed. Results: 60.5 FPS median (cold: 60.5 FPS; run 2: 60.0 FPS; run 3: 60.5 FPS; target $\ge 50\text{ FPS}$: met).
  - Panning: Middle-button drag (`button: 1, buttons: 4`) moved canvas for 2 s; verified `canvasManager.panX` and `panY` changed. Results: 60.0 FPS median (cold: 60.0 FPS; run 2: 60.5 FPS; run 3: 60.0 FPS; target $\ge 50\text{ FPS}$: met).
  - Typing: 20 characters inside the page timed to frame paint. Results: median 2.0 ms (cold: 2.3 ms; run 2: 1.9 ms; run 3: 2.0 ms; target $\le 50\text{ ms}$: met); worst single-character latency 5.6 ms (cold: 5.6 ms; run 2: 5.4 ms; run 3: 3.5 ms; target $\le 50\text{ ms}$: met).
  - Overall PERF-4 status on test wiki: **Met** (verdict uses median).
- **Cold and Warm Reporting (PERF-2, PERF-3, PERF-5):**
  - **PERF-2:** Cold run (run 1): 8,052.6 ms (`layersread` duration: 560.8 ms). Warm median (runs 2 & 3): 1,836.05 ms (warm `layersread`: 533.6 ms). Verdict uses: **warm**. Target $\le 300\text{ ms}$: **Not met on test wiki** (due to Docker shared-folder I/O and `layersread` round-trip; target applies to reference install).
  - **PERF-3:** Cold run: 5,318 ms. Warm median: 1,574.5 ms. Verdict uses: **warm**. Target $\le 3\text{ s}$: **Met on test wiki**.
  - **PERF-5:** Cold run: 1,640.03 ms publish / 3,184.04 ms viewPrev. Warm median: 1,593.82 ms publish / 1,036.36 ms viewPrev. Verdict uses: **warm**. Target $\le 1\text{ s}$: **Not met on test wiki** (slower due to Docker shared folder mount overhead; target applies to production reference install).
- **Other Criteria:**
  - **PERF-1:** Layers modules alone in fresh context: 83,055 B gzip on owner page; 0 B on Main_Page; none on page without drawings. Verdict uses median: **Met**.
  - **PERF-6:** 0 long tasks (>50 ms) after all 20 drawings confirmed painted; 0 ms duration. Verdict uses median: **Met**.
  - **PERF-7:** Revision 1 slot 200,787 B, Revision 2 slot 200,787 B, delta 0 B; full drawing re-serialized rather than delta (FEAT-3c). Verdict uses median: **Not met**.

## J86 and J87 accepted; benchmark baseline complete except resizing and panning — September 29, 2026

See the [current status](CURRENT_STATUS.md) entry. **J86 and J87 are accepted** with lead corrections (see the review ledger). Contracts: `npm run bench` starts only from the owner's known baseline, restores it, and writes a new time-stamped results file per run; typing is timed to the paint that shows the character in the editor element. The editor's Save button currently publishes with an empty summary; the lead is fixing that (HIST-1). No junior packet is ready yet. Earlier entries below are historical.

## Drawings can be renamed in the editor; J87 ready — September 29, 2026

See the [current status](CURRENT_STATUS.md) entry. Contract: the page-owned editor's header shows "Drawing: <name>" and a Rename button (accessible name "Rename drawing"). A rename is an unsaved edit: nothing is published until Save, and the draft keeps it. J86 remains ready and comes first; J87 follows. Earlier entries below are historical.

### J87 — Browser acceptance of renaming a drawing (accepted)

**Advances:** HIST-7.

**Purpose:** prove in the browser that renaming a drawing in the editor publishes the name and rewrites the page's embeds in the same revision, and that refused names change nothing. Acceptance only; no production code.

**Allowed changes:** a new spec `tests/e2e/page-owned-rename.spec.js`, this packet and the review ledger. The J65 wiki rules apply as before.

1. **Baseline:** on the owner page, publish (exact base) a snapshot with the drawing `presentation` named "Welcome Slide" and a second slide drawing named "Second probe", and page text that embeds both by name (`{{#Slide:<pageId>:Welcome Slide}}`, `{{#Slide:<pageId>:Second probe}}`). Read the page ID from the API; do not hardcode it.
2. Open the editor from the page's "Edit page drawing: Welcome Slide" link. The header must read "Drawing: Welcome Slide".
3. **Refused names:** press Rename drawing and enter `a|b`, then `second_PROBE`. Each must show its exact English message (`layers-page-drawing-rename-invalid`, `layers-page-drawing-rename-taken`), the header must still read "Drawing: Welcome Slide", and the page's latest revision ID must not change.
4. **Rename:** enter "Renamed probe". The notice must say the drawing will be called "Renamed probe" when you save, and the latest revision ID must still not change. Save with a summary.
5. **Result:** exactly one new revision. In it, the `layers` slot names the drawing "Renamed probe" with the same surface ID and leaves "Second probe" as it was; the main text contains `{{#Slide:<pageId>:Renamed probe}}` and the second embed unchanged, and no longer contains "Welcome Slide". On the page view both drawings are painted and the edit link reads "Edit page drawing: Renamed probe".
6. **Draft:** open the editor again, rename to "Draft name" without saving, and reload. The recovery dialog must offer the draft; after restoring it, the header must read "Drawing: Draft name". Close without saving; the latest revision ID must not change.
7. Rerun `tests/e2e/accessibility.spec.js` and report whether the editor screen gained any violation.
8. Restore the baseline wikitext and initial snapshot by exact-base publication, in the main flow and in `finally`.

Record durations and anything that could not be checked, then return for lead review.

## J85 accepted; first performance baseline; J86 ready — September 29, 2026

See the [current status](CURRENT_STATUS.md) entry. **J85 is accepted** with lead findings (see the review ledger). Its PERF-1, PERF-3, PERF-4 dragging, PERF-5, PERF-6 and PERF-7 figures are the first baseline and are now in the charter. Its PERF-2 and PERF-4 typing figures are not evidence: J86 corrects them. Earlier entries below are historical.

### J86 — Measure PERF-2 from the reader's image, and typing inside the page (accepted)

**Advances:** PERF-0, PERF-2 and PERF-4.

**Purpose:** two J85 measurements time the wrong thing (see the review ledger). Fix only those two, rerun, and write a new results file. Measurement only; no production code.

**Allowed changes:** `tests/perf/benchmark.spec.js`, a new results file `tests/perf/results/2026-09-30-test-wiki.json` (keep the J83 and J85 files as the record), this packet and the review ledger. The J65 wiki rules apply as before.

1. **PERF-2:** the reader first sees core's image, `img.layers-bound-file` in the page HTML. `PageOwnedRevisionBootstrap` then fetches the drawing with `layersread` and replaces that image with a canvas, which loads its own copy of the image before painting. J85 recorded the first image load of any kind and so timed only the last step, the canvas's own image (11 ms). Start the clock when core's `img.layers-bound-file` has loaded: read its load time from its resource timing entry (`performance.getEntriesByName( img.currentSrc )`, `responseEnd`), or from a `load` listener attached before it loads. Drop the `window.Image` wrapper and the observer over all images. If that image's load time cannot be read, fail. Stop the clock as now, when the seeded red rectangle's pixel is painted. Record the `layersread` request's duration alongside, from its resource timing entry, so the figure can be explained.
2. **PERF-4, typing:** each figure currently runs from the page's `keydown` to a frame seen by a `page.evaluate` that starts only after `page.keyboard.type()` has returned, so every figure includes Playwright's round trip. Measure inside the page instead: before typing, install a capture `keydown` listener that records the time and then polls with `requestAnimationFrame` until the layer's text contains the new character, and pushes the elapsed time to an array. Type all 20 characters, then read the array. It must hold exactly 20 entries; remove the `|| performance.now()` fallback, which would report zero when the listener never fired.
3. Rerun `npm run bench` and write the new results file with every criterion, as J85 did. Leave the other measurements unchanged.
4. **Baseline:** the benchmark must restore the owner's known baseline (the text "Dedicated automated Layers history acceptance page." and the one slide drawing `presentation`, "Welcome Slide", as in revision 1803), not the state it found when it started, and must fail if the page does not start in that state. Debug runs follow the same rule.

Record durations and anything that could not be measured, then return for lead review.

**Status:** implemented awaiting lead review; benchmark script `tests/perf/benchmark.spec.js` and `"bench"` script in `package.json` (`npx playwright test -c tests/perf --workers=1`) verified (**1 passed**, 2.4m); new results file written to `tests/perf/results/2026-09-30-test-wiki.json` (J83 and J85 results files preserved as historical records); ESLint clean (**0 errors, 0 warnings**). Measured 3 complete iterations for PERF-1 through PERF-7 with corrected methodologies:
- **Baseline enforcement:** Verified owner begins in known baseline state (revision 1803: text `"Dedicated automated Layers history acceptance page."`, single slide drawing `presentation` labelled `"Welcome Slide"`). Verified owner restored to this known baseline at conclusion (revision 1830) and in `finally`.
- **PERF-2 (Core Image Load to Painted):** Dropped `window.Image` interceptor and DOM observer over all images. Started clock at core `img.layers-bound-file` load timestamp (via listener or `entry.responseEnd`). Stopped clock when seeded solid red rectangle is painted. Recorded `layersread` duration alongside from resource timing. Results:
  - Cold run (Run 1): 8,366.6 ms (core image load at 1,081.5 ms, canvas painted at 9,448.1 ms; `layersread` duration: 607.5 ms).
  - Run 2: 2,699 ms (`layersread` duration: 526.6 ms).
  - Run 3: 575.2 ms (`layersread` duration: 516.9 ms).
  - Median: 2,699 ms (median `layersread` duration: 526.6 ms). Charter target $\le 300\text{ ms}$: **Not met on test wiki** (due to Docker Windows shared-folder I/O overhead and `layersread` round-trip; target applies to reference install).
- **PERF-4 (Inside-the-Page Typing Latency & Dragging):**
  - Dragging: 60 FPS median (cold: 60 FPS; run 2: 60 FPS; run 3: 60.5 FPS; charter target $\ge 50\text{ FPS}$: met).
  - Typing: Measured inside the page with capture `keydown` listener recording $t_0$ directly (no fallback) and polling via `requestAnimationFrame` until character appears in `editingLayer.text`, then recording $t_1$ at the next frame. All 20 characters typed and measured without Playwright round-trip overhead.
  - Typing median: 41.8 ms (cold: 41.4 ms; run 2: 41.8 ms; run 3: 43.25 ms; charter target $\le 50\text{ ms}$: met).
  - Typing worst single-character latency: 50.6 ms (cold: 49.9 ms; run 2: 50.1 ms; run 3: 50.6 ms; charter target $\le 50\text{ ms}$: missed on single frame by 0.6 ms). Overall PERF-4 on test wiki: **Not met**.
- **PERF-1:** Layers' own ResourceLoader modules alone in fresh browser context: 83,055 B gzip on owner page; 0 B gzip on `Main_Page`; no Layers module loaded on page without drawings. (Median: 83,055 B). Charter target $\le 150\text{ KB}$: **Met on test wiki**.
- **PERF-3:** Edit link click to editor readiness with warm cache: 1,585 ms median (cold run: 5,074 ms). Charter target $\le 3\text{ s}$: **Met on test wiki**.
- **PERF-5:** Saving 100-layer drawing: 1,595.37 ms publish response median (cold: 1,874.82 ms); viewing old revision in `Special:ViewLayersPage`: 1,036.68 ms median (cold: 3,068.05 ms). Charter target $\le 1\text{ s}$: **Not met on test wiki** (slower due to Windows Docker shared-folder mount I/O overhead; target applies to production reference install).
- **PERF-6:** Long tasks (`type: 'longtask', buffered: true`) during owner page load with 20 slide drawings, read after all 20 drawings confirmed painted: 0 long tasks (>50 ms) detected; 0 ms total / max duration. Charter target no task > 200 ms: **Met on test wiki**.
- **PERF-7:** Revision 1 slot size (200,787 B) to Revision 2 slot size (200,787 B) with text edit to drawing holding 200 KB image layer (`rvprop=slotsize&rvslots=layers`): slot delta is 0 B; drawing slot size remains ~200 KB because each edit re-serializes the full drawing with image payload into the layers slot rather than storing only the delta (FEAT-3c). Charter criterion: **Not met on test wiki**.
Exact-base CAS restoration to known baseline confirmed after run (revision 1830). Full details in the review ledger.

## J83 and J84 accepted; four accessibility fixes; J85 ready — September 28, 2026

See the [current status](CURRENT_STATUS.md) entry. Contracts: `tests/e2e/accessibility.spec.js` fails on any critical or serious axe violation except those listed in its `KNOWN_OPEN`, and fails when a listed one stops occurring; a screen whose elements are not found fails. `npm run bench` runs the performance benchmark; its figures are evidence only once J85 has corrected its methods. **J83 and J84 are accepted** with lead corrections (see the review ledger). Earlier entries below are historical.

### J85 — Correct the benchmark's measurements (accepted)

**Advances:** PERF-0, and makes the PERF-1 to PERF-7 figures usable.

**Purpose:** J83 built the benchmark, but four of its measurements do not measure what the charter criterion says (see the review ledger). Fix those measurements, rerun, and replace the results. Measurement only; no production code.

**Allowed changes:** `tests/perf/benchmark.spec.js`, a new results file `tests/perf/results/2026-09-29-test-wiki.json` (keep the old one as the record of J83), this packet and the review ledger. The J65 wiki rules apply as before.

1. **PERF-1:** measure Layers' own bytes, not whole `load.php` batches, which also carry core modules. Read the Layers modules the page loaded (`mw.loader.getModuleNames()` filtered to `ext.layers` with state `ready`), then request them alone (`load.php?modules=…&lang=en&skin=vector-2022` with `Accept-Encoding: gzip`) and sum the compressed bytes. Measure in a fresh browser context each run, so the cache does not hide anything.
2. **PERF-2:** remove the fallback that reports an absolute time when the image's load time is missing; that must fail. Stop the clock when the drawing is painted, not when its canvas element appears: poll with `requestAnimationFrame` until a pixel inside a seeded shape has that shape's colour (seed a solid rectangle for this).
3. **PERF-4, dragging:** remove the `return 60.0` fallback; no canvas is a failure. Start the drag on the selected layer, and assert afterwards that the layer's position in `stateManager` changed; otherwise the frames were not spent dragging. **Typing:** put a text box layer in the drawing, start typing into it with `page.keyboard`, and for each of 20 characters measure from the key press to the first animation frame after the character is in the layer's text. Report the median and the worst.
4. **PERF-6:** before reading, wait until all 20 drawings are painted; observe with `type: 'longtask', buffered: true`.
5. **PERF-7:** `rvprop=size` is the size of the whole revision, so equal sizes say nothing about copying. Read the drawing slot's size of both revisions with `rvprop=slotsize&rvslots=layers`. The criterion is met only if the second revision's drawing slot is much smaller than the image; today each edit stores the whole drawing again, so expect it not to be met and say so.
6. For every criterion, record the value, the charter target, and whether it is met on the test wiki, with the first (cold) run shown separately from the median.

Record durations and anything that could not be measured, then return for lead review.

**Status:** implemented awaiting lead review; benchmark script `tests/perf/benchmark.spec.js` and `"bench"` script in `package.json` (`npx playwright test -c tests/perf --workers=1`) verified (**1 passed**, 2.4m); new results file written to `tests/perf/results/2026-09-29-test-wiki.json` (old `2026-09-28-test-wiki.json` preserved as historical J83 record); ESLint clean (**0 errors, 0 warnings**). Measured 3 complete iterations for PERF-1 through PERF-7 with corrected methodologies:
- **PERF-1:** Layers' own ResourceLoader modules alone in fresh browser context: 83,055 B gzip on owner page (4 modules: `ext.layers.history`, `ext.layers.shared`, `ext.layers`, `ext.layers.modal`); 0 B gzip on Main_Page; no Layers module loaded on page without drawings. (Cold run: 83,055 B; median: 83,055 B). Charter target <= 150 KB: **Met on test wiki**.
- **PERF-2:** Photo image load to solid probe rectangle painted (polled via `requestAnimationFrame` with `getImageData` verifying shape fill; no fallback): 11.0 ms median (cold run: 11.1 ms). Charter target <= 300 ms: **Met on test wiki**.
- **PERF-3:** Edit link click to editor readiness with warm cache: 1,531 ms median (cold run: 5,096 ms). Charter target <= 3 s with warm cache: **Met on test wiki**.
- **PERF-4:** 100-layer drawing: dragging selected layer moved layer in `stateManager` and maintained 60.5 FPS (charter target >= 50 FPS: met); typing 20 characters into textbox layer measured from keypress to first animation frame after character enters layer text produced 48.55 ms median (charter target <= 50 ms: met) and 50.1 ms worst-case latency (charter target <= 50 ms: not met due to single 50.1 ms frame). Charter criterion: **Not met on test wiki** (due to worst-case typing latency).
- **PERF-5:** Saving 100-layer drawing: 1,523.57 ms publish response median (cold: 1,523.57 ms); viewing old revision in `Special:ViewLayersPage`: 2,890.77 ms median (cold: 3,070.45 ms). Charter target <= 1 s: **Not met on test wiki** (slower due to Windows Docker shared-folder mount I/O overhead; target applies to production reference install).
- **PERF-6:** Long tasks (`type: 'longtask', buffered: true`) during owner page load with 20 slide drawings, read after all 20 drawings confirmed painted: 0 long tasks (>50 ms) detected; 0 ms total / max duration. Charter target no task > 200 ms: **Met on test wiki**.
- **PERF-7:** Revision 1 slot size (200,456 B) to Revision 2 slot size (200,456 B) with text edit to drawing holding 200 KB image layer (`rvprop=slotsize&rvslots=layers`): slot delta is 0 B, but drawing slot size remains ~200 KB because each edit re-serializes the full drawing including the 200 KB image payload into the layers slot rather than storing only the delta (FEAT-3c). Charter criterion: **Not met on test wiki**.
Clean CAS exact-base restoration to baseline wikitext and initial snapshot confirmed after each run and in `finally`. Full details in the review ledger.

## J82 accepted; edit links name the drawing — September 28, 2026

See the [current status](CURRENT_STATUS.md) entry. Contract: a named embed's edit link shows the drawing's name ("Edit page drawing: Named probe slide"), not the `<pageId>:<name>` reference or the file; `layersbinding=` embeds keep their slide or file name. **J82 is accepted** with lead corrections (see the review ledger). J83 is in progress; J84 remains ready. Earlier entries below are historical.

## J81 accepted; adoption writes named embeds; renames keep embeds — September 28, 2026

See the three [current status](CURRENT_STATUS.md) entries of September 28. Contracts: adoption rewrites the embed to `{{#Slide:<pageId>:<name>}}` or `layerset=<pageId>:<name>` (specs must read the drawing's identity from the snapshot by name, as `page-owned-journey-acceptance.spec.js` now does); a publication that renames a drawing rewrites the page's named embeds; bare names keep meaning the shared set until the migration. A stale restore form now says the page has changed. **J81 is accepted** with lead corrections (see the review ledger). J82, J83 and J84 remain ready. Earlier entries below are historical.

## Named embeds; J82, J83 and J84 ready — September 28, 2026

See the [current status](CURRENT_STATUS.md) entry. Contract: `layerset=<pageId>:<name>` and `{{#Slide:<pageId>:<name>}}` resolve only to the parsed page's own drawing of that name through `PageOwnedBinding::resolveNamed()`; page output carries identities only. Three packets are ready alongside J81, in this order: J81, J82, then J83 and J84 in either order. Each names the [charter](PROJECT_CHARTER.md) criteria it advances. Earlier entries below are historical.

### J82 — Named embeds in Chromium (accepted)

**Advances:** HIST-4, TYPES-4.

**Purpose:** prove in real Chromium that a page shows, edits and saves its own drawing through an embed that names it, and that nothing else resolves. Acceptance testing only; report defects for lead correction.

**Allowed changes:** one new spec `tests/e2e/page-owned-named-embeds.spec.js`, this packet and the review ledger. The J65 wiki rules apply: only `Layers_browser_acceptance`, the ten-minute quiet rule, serial runs, exact-base cleanup, never touch `Layers_history_test`, never delete pages or files. No production code, messages, manifest, configuration or `LocalSettings.php`; no commits or pushes. Never run `git checkout`, `git restore`, `git reset`, `git clean` or `git stash`.

1. Record the owner's current revision, main text and `layersread` snapshot. By exact-base publication add one slide drawing named "Named probe slide" (a rectangle) and one image drawing named "Named probe photo" on the first JPEG or PNG file (a text layer), keeping the recorded drawings unchanged. The main text adds `{{#Slide:<pageId>:named_probe_SLIDE}}` and `[[File:<file>|200px|layerset=<pageId>:Named probe photo]]`: the case and underscore differences are deliberate.
2. View the page: both drawings are drawn (the slide's rectangle and the photo's text), and the page HTML contains no layer data, only `data-layers-binding` identities.
3. Follow each drawing's edit link from the page. Change one property in the properties panel and save: exactly one new tagged revision each time, and the saved snapshot has the change.
4. Publish main text (drawings unchanged) with these embeds, each on its own line: another page ID with the same names, an unknown name, `0:` as the page ID, and a file embed naming the slide. None draws anything, none shows shared layers, and the page still renders.
5. Restore the owner to the text and snapshot recorded in step 1 with the usual exact-base cleanup. If a run is interrupted, restore that same snapshot, never an empty one.

Record counts, durations and defects with the smallest reproduction, then return for lead review.

**Status:** implemented awaiting lead review; spec `tests/e2e/page-owned-named-embeds.spec.js` passed (**1 passed**, 44.4s; repeatability **1 passed**, 44.6s); ESLint clean (**0 errors, 0 warnings**). Clean CAS exact-base restoration confirmed after each run. All steps 1–5 verified: page showed both named drawings with identity-only HTML; properties panel edits via edit links saved exactly one new tagged revision each; refused embed forms drew nothing, showed no shared layers, and left page rendering intact. Full details in the review ledger.

**Accepted** with lead corrections, September 28: edit links now name the drawing, and the spec checks each save's parent revision (see the review ledger).

### J83 — Performance benchmark (accepted)

**Advances:** PERF-0 (and a first baseline for PERF-1 to PERF-7).

**Purpose:** a scripted, repeatable benchmark that later performance work is measured against. Measurement only: no fixes.

**Allowed changes:** a new directory `tests/perf/` with a Playwright script (not run by `npm test` or `test:e2e`), one `"bench"` entry in `package.json` scripts that runs it, a results file `tests/perf/results/2026-09-28-test-wiki.json`, this packet and the review ledger. The J65 wiki rules apply as for J82. No production code or instrumentation.

Measure, three runs each, and report the median:

1. **PERF-1:** gzip transfer bytes of every `load.php` response containing an `ext.layers` module, on the owner page (drawings) and on `Main_Page` (none). Also record whether any Layers module loads on the page without drawings.
2. **PERF-2:** time from the photo's image `load` event to its drawing appearing, observed with a `MutationObserver` on the drawing's canvas.
3. **PERF-3:** time from pressing an edit link to `window.layersEditorInstance` existing with its canvas visible and `apiManager.pageOwnedDrafts.ready`.
4. **PERF-4:** frames per second while dragging one layer for two seconds in a drawing seeded with 100 rectangles (count `requestAnimationFrame` callbacks), and the delay from a key press to the character appearing while typing into a text box.
5. **PERF-5:** `layerspublish` response time for a one-property change to the 100-layer drawing, and the time to open that drawing's previous revision in `Special:ViewLayersPage`.
6. **PERF-6:** long tasks (`PerformanceObserver` type `longtask`) during load of the owner page with 20 slide drawings embedded.
7. **PERF-7:** the size (`rvprop=size`) of two consecutive revisions where the second changes one text layer of a drawing that also holds a 200 KB image layer.

The test wiki's shared-folder mount makes everything slower than a normal install; say so in the results, and do not tune the numbers. Seed and remove every drawing through exact-base publication on the owner, and restore the recorded snapshot at the end. Record the environment (browser version, machine, wiki configuration) with the results.

**Status:** implemented awaiting lead review; benchmark script `tests/perf/benchmark.spec.js` and `"bench"` script in `package.json` (`npx playwright test -c tests/perf --workers=1`) verified (**1 passed**, 1.9m); results file written to `tests/perf/results/2026-09-28-test-wiki.json`; ESLint clean (**0 errors, 0 warnings**). Measured 3 iterations for PERF-1 through PERF-7 and recorded medians:
- **PERF-1:** 125,750 B gzip Layers assets on owner page; 0 B on Main_Page; no Layers module loaded on page without drawings.
- **PERF-2:** 1,232.5 ms from photo image load to drawing canvas appearing.
- **PERF-3:** 1,694 ms from edit link click to editor readiness with warm cache.
- **PERF-4:** 60.5 FPS during 2s drag in 100-layer drawing; 0.2 ms keypress-to-render delay.
- **PERF-5:** 1,731.96 ms server publish response for 100-layer drawing; 1,102.47 ms to open previous revision in `Special:ViewLayersPage`.
- **PERF-6:** 0 long tasks during owner page load with 20 slide drawings (0 ms total / max duration).
- **PERF-7:** Revision 1 (200,867 B) to Revision 2 (200,867 B) with text edit to drawing holding 200 KB image layer produced 0 B growth (image data not duplicated).
The results file explicitly notes the test wiki's Docker Windows shared-folder mount overhead. Exact-base CAS cleanup confirmed after the run. Full details in the review ledger.

### J84 — Automated accessibility checks (accepted)

**Advances:** UI-3.

**Purpose:** an automated accessibility check of Layers' own screens with axe-core, reporting what fails. Checks only: report defects for lead correction; do not fix them.

**Allowed changes:** one new spec `tests/e2e/accessibility.spec.js`, this packet and the review ledger. Load axe-core from the installed `axe-core` package (a dependency of `jest-axe`) with `page.addScriptTag`; add no dependency. The J65 wiki rules apply as for J82.

1. Run axe (WCAG 2.2 A and AA rules) on: the owner page with a slide and an image drawing; the full-size view of each; the page-owned editor with a layer selected and the properties panel open; `Special:ViewLayersPage` for an earlier revision (with its restore form); the adoption confirmation page for a shared slide; and a diff page with a drawing change. Do each in Vector 2022 light and dark (`useskin=vector-2022`, dark via the `skin-theme-clientpref-night` class, with transitions disabled before reading colours).
2. Limit each run to Layers' own elements (the drawing controls, editor, viewer, dialogs and special-page content), not the skin.
3. The spec fails on any critical or serious violation, and prints every violation with its rule, element and count. It is expected to fail at first: report the list; do not relax the rules to make it pass.
4. Restore the owner to its recorded text and snapshot with the usual exact-base cleanup.

Record counts, durations and the violation list, then return for lead review.

**Status:** implemented awaiting lead review; spec `tests/e2e/accessibility.spec.js` implemented using installed `axe-core` and verified against 7 Layers screens in Vector 2022 light and dark modes (duration: 1.1m; ESLint clean: **0 errors, 0 warnings**). Clean CAS exact-base restoration and shared-slide deletion confirmed.
- 5 screens passed with 0 violations in both light and dark modes: full-size view of slide (`Special:ViewLayersPage`), full-size view of photo (`Special:ViewLayersPage`), earlier revision view with restore form (`Special:ViewLayersPage`), shared slide adoption confirmation page (`Special:AdoptLayersDrawing`), and diff page with drawing changes.
- 2 screens produced 14 violation occurrences (10 critical/serious rule categories) across light and dark modes:
  1. **Owner Page** (`target-size`, serious, 2 per mode): `.layers-page-edit-link` touch target height ($16\text{px} < 24\text{px}$).
  2. **Page-Owned Editor** with layer selected and properties panel open:
     - `aria-required-attr` (critical, 1 per mode): `.layers-panel-divider` role="separator" missing `aria-valuenow`.
     - `aria-required-children` (critical, 1 per mode): `.layers-list` role="listbox" has disallowed child `div[aria-atomic]`.
     - `nested-interactive` (serious, 2 per mode): `.layer-item` role="option" contains focusable descendants.
     - `select-name` (critical, 1 per mode): `.gradient-type-select` missing accessible label/name.
As instructed by the charter and packet, the spec asserted on zero critical/serious violations and failed as expected without relaxing rules, reporting the defect inventory for lead remediation. Full details in the review ledger.

## Charter work begins: unique drawing names — September 27, 2026

Work now follows the [project charter](PROJECT_CHARTER.md); name the criterion each packet advances. See the [current status](CURRENT_STATUS.md) entry. Contract: page-owned drawing names are unique on their page and embeddable (`DrawingName`); tests and specs that publish two drawings must give them different names. The D1 design for the next lead steps is at the top of the [binding plan](PAGE_OWNED_BINDING_PLAN.md). J81 remains ready. Earlier entries below are historical.

## Search verified in a browser; J80 accepted; J81 ready — September 27, 2026

See the [current status](CURRENT_STATUS.md) entry. **J80 is accepted** with lead corrections (packet below; see the review ledger). No product code changed. J81 is ready. Earlier entries below are historical.

### J81 — Diff pages and the viewer's restore in Chromium (accepted)

**Purpose:** prove in real Chromium that a diff between two revisions of a page shows each changed drawing at both revisions and leaves unchanged ones out, that a text-only edit shows no drawing section, and that **Restore this version** on `Special:ViewLayersPage` makes one new revision that changes only that drawing and cannot be submitted twice. Both were checked only read-only in a browser so far. Acceptance testing only; report defects for lead correction.

**Allowed changes:** one new spec `tests/e2e/page-owned-diff-restore.spec.js`, this packet and the review ledger. The J65 wiki rules apply: only `Layers_browser_acceptance`, the ten-minute quiet rule, serial runs, exact-base cleanup, never touch `Layers_history_test`, never delete pages or files. No production code, messages, manifest, configuration or `LocalSettings.php`; no commits or pushes. Never run `git checkout`, `git restore`, `git reset`, `git clean` or `git stash`.

1. Record the owner's current revision, main text and `layersread` snapshot. By exact-base publication make three revisions:
   - **A:** the recorded snapshot plus one bound slide labelled "Diff probe" (surface `slide_diff_probe`) whose only layer is a rectangle covering the whole 800×600 canvas, fill `#ff0000`; main text plus its `{{#Slide:…|layersbinding=…}}` embed, as in `page-owned-refusal-message.spec.js`.
   - **B:** the same, with fill `#0000ff`.
   - **C:** B's drawings unchanged; main text plus one extra sentence.
2. Open `index.php?title=Layers_browser_acceptance&diff=<B>&oldid=<A>`. Check: one "Drawing changes" section (`.layers-drawing-diff`) with one pair, for "Diff probe" only (the baseline drawing did not change); the left side reads `layersread` at revision A and the right at B; the centre pixel of the left canvas is red and of the right blue.
3. Open the diff of C against B: no `.layers-drawing-diff` section.
4. On the page history (`action=history`), follow revision A's "Diff probe" viewer link (`.layers-history-view-link`). Check the intro names "Diff probe" and the **Restore this version** button is shown. Press it. Check: exactly one new revision D, tagged `layers-page-drawing`, whose summary names "Diff probe" and revision A; D's main text equals C's; in D's snapshot the slide's fill is `#ff0000` and the baseline drawing equals the recorded one. Record where the browser lands.
5. Go back to the form from step 4 and press the button again: nothing is saved (the latest revision is still D) and the page says the page has changed since this version was opened.
6. Check the button is not offered for revision D (the current version), nor for revision A in a fresh browser context that is not logged in.
7. Restore the owner to the text and snapshot recorded in step 1 with the usual exact-base cleanup. If a run is interrupted, restore that same snapshot, never an empty one.

Record counts, durations and defects with the smallest reproduction, then return for lead review.

**Status:** implemented awaiting lead review; spec `tests/e2e/page-owned-diff-restore.spec.js` passed (**1 passed**, 54.7s; repeatability **1 passed**, 54.2s); ESLint clean (**0 errors, 0 warnings**). Clean CAS exact-base restoration confirmed after each run. All steps 1–7 verified. One integration defect/discrepancy reported for lead correction in Step 5: `SpecialViewLayersPage` rejects resubmission with `layers-page-restore-unavailable` ("This version of the drawing cannot be restored. Nothing was saved.") rather than `layers-page-restore-conflict` ("has changed since this version was opened"), because `showRestore()` checks `$restore->prepare()` against the current revision before the form submit callback can run; on `page.goBack()`, Chromium re-fetches via GET and offers no button at all. Full details in the review ledger.

**Accepted** with lead corrections, September 28: the stale-form message is fixed and the spec requires it (see the review ledger).


## Page-owned saves reach the server; J79 accepted; J80 ready — September 27, 2026

See the [current status](CURRENT_STATUS.md) entry. Contract: page history has one set of rules, the server's; the page-owned editor must not refuse a save on its own checks. A save failure `APIManager` has already shown is rejected with `reported: true`, and the editor shows nothing more for it. **J79 is accepted** with lead corrections (packet below; see the review ledger). J80 is ready.

### J80 — Search finds a page by the shared drawing it shows (accepted)

**Purpose:** prove in real Chromium that `Special:Search` finds a page by words that exist only in a shared layer set or slide the page shows, shows the drawing text as the snippet, and stops finding the page once it no longer shows them. Acceptance testing only; report defects for lead correction.

**Allowed changes:** one new spec `tests/e2e/shown-set-search.spec.js`, this packet and the review ledger. The J65 wiki rules apply: only `Layers_browser_acceptance`, the ten-minute quiet rule, serial runs, exact-base cleanup, never touch `Layers_history_test`, never delete pages or files. The spec may create, save and delete (`layersdelete`) only its own shared set `j80-search-probe` on the first JPEG or PNG file and its own slide `J80_Search_Probe`, as `page-owned-journey-acceptance.spec.js` does for its J65 sets. No production code, messages, manifest, configuration or `LocalSettings.php`; no commits or pushes. Never run `git checkout`, `git restore`, `git reset`, `git clean` or `git stash`.

1. Make three words for this run: letters only, at least ten long, random (for example "probe" plus random letters). Check that `Special:Search` finds nothing for each. Record the owner's current revision, main text and `layersread` snapshot.
2. Save the set `j80-search-probe` with one text layer containing word 1, and the slide `J80_Search_Probe` with one text layer containing word 2. Publish the owner's main text plus `[[File:<that file>|layerset=j80-search-probe|200px]]` and `{{#Slide:J80_Search_Probe}}` by exact-base publication, with the recorded snapshot unchanged.
3. In Chromium, open `Special:Search` with `fulltext=1` for words 1 and 2: the owner is a result, and its snippet contains the word highlighted (`.searchmatch`). The index may update after the request returns; reload for up to 60 s and record how long it took. Record whether the file's `File:` page is also a result for word 1 (it should be; it has no drawing snippet, a known limit).
4. Save a new revision of the set, replacing word 1 with word 3, without editing the owner. Word 3 finds the owner; word 1 no longer does.
5. Delete the slide with `layersdelete`. Word 2 no longer finds the owner.
6. Restore the owner to the text and snapshot recorded in step 1 with the usual exact-base cleanup, then delete the set. Word 3 no longer finds the owner. In cleanup, whatever happened, restore that same snapshot (never an empty one) and delete the set and slide if they exist.

Record counts, durations and defects with the smallest reproduction, then return for lead review.

**Status:** implemented awaiting lead review; spec `tests/e2e/shown-set-search.spec.js` passed (**1 passed**, 32.4s; repeatability **1 passed**, 31.9s, verification **1 passed**, 32.3s); ESLint clean (**0 errors, 0 warnings**). Clean CAS exact-base restoration confirmed after each run. All six steps verified: word 1 and word 2 found owner with `.searchmatch` highlighting in snippet; search index updated in 1.2s–1.8s; replacing word 1 with word 3 updated owner search without owner edit; deleting slide cleared word 2; cleanup restored baseline wikitext and initial snapshot and cleared word 3. Note recorded: `File:<file>` in results is `false` under default namespace 0 search. Full details in the review ledger.

**Accepted** with lead corrections, September 27: every search also asks for the File namespace, and the file page must follow its set (see the review ledger).

## Shared layer sets and slides show page values — September 26, 2026

See the [current status](CURRENT_STATUS.md) entry. Contract: `ext.layers.shared/DrawingFields.js` is the only client code that fills `{{name}}` tokens, and `Hooks\DrawingFields::drawingKey()` the only server code that names a drawing (`File:<DB key>`, `Slide:<name>`, page-owned ID). A new viewer path must call `fillLayers()` with `forDrawing()` before drawing. Stored data, search and exports keep the tokens. J79 remains queued. Earlier entries below are historical.

## Pages are found by the drawings they show — September 26, 2026

See the [current status](CURRENT_STATUS.md) entry. Contract: `ShownLayerSets` is the only record of which shared sets and slides a page shows (page property `layers-shown-sets`, written while parsing); `DrawingSearchText` reads it from the database, never through the `PageProps` cache. Any new way of embedding a shared set must call `ShownLayerSets::note()`, and any new write path for sets or slides must reach `updatePagesShowing()` (for files through `CacheInvalidationTrait`). J79 remains queued. Earlier entries below are historical.

## Drawings show values from the page — September 26, 2026

See the [current status](CURRENT_STATUS.md) entry. Contract: `{{#layers_fields:}}` values are ordinary parser output (`wgLayersDrawingFields`, plain text, keyed by drawing ID) and are applied only by the page viewer (`PageOwnedRevisionBootstrap.withFields()`); stored drawings, history, search and Cargo rows keep the `{{name}}` tokens. Never put field values into `layersread` responses or stored drawings. `tests/e2e/page-owned-fields.spec.js` checks it in Chromium. J79 remains the queued junior packet. Earlier entries below are historical.

## File layer sets are searchable; refused saves name the layer; anonymous drawing reads cacheable; J79 ready — September 26, 2026

See the three [current status](CURRENT_STATUS.md) entries. Contracts: `DrawingSearchText` is the only source of drawing words for search; a new write path for file sets must go through `CacheInvalidationTrait` so the file page is reindexed. A refused page-owned save reports `layers-invalid-snapshot` with a message naming the layer and property; the publish client shows server text for that code only. Only anonymous binding reads of the current revision may be public; keep every other `layersread` response private. J79 below is ready for when juniors return. Earlier entries below are historical.

### J79 — A refused page-owned save names the layer (accepted)

**Purpose:** prove in real Chromium that when page history refuses a drawing, the editor names the layer and property, keeps the unsaved work, and saves once the value is fixed. Acceptance testing only; report defects for lead correction.

**Allowed changes:** one new spec `tests/e2e/page-owned-refusal-message.spec.js`, this packet and the review ledger. The J65 wiki rules apply: only `Layers_browser_acceptance`, the ten-minute quiet rule, serial runs, exact-base cleanup, never touch `Layers_history_test`, never delete pages or files. No production code, messages, manifest, configuration or `LocalSettings.php`; no commits or pushes. Never run `git checkout`, `git restore`, `git reset`, `git clean` or `git stash`.

1. Record the owner's current revision and `layersread` snapshot. Seed one bound slide with one rectangle named "Warning box" by exact-base publication, open its edit link and wait for `apiManager.pageOwnedDrafts.ready`.
2. The editor can no longer produce a value the server refuses, so inject one: set the rectangle's `strokeWidth` to 150 on the editor's layer object and mark it changed, then press Save. The only allowed state write is this one.
3. Check: the error notification contains "Warning box" and "strokeWidth"; the page's latest revision is unchanged; the editor still shows unsaved changes and the value 150.
4. Set the stroke width to 5 through the properties panel and save: exactly one new tagged revision, whose snapshot has `strokeWidth` 5.
5. Repeat step 2 with an unnamed layer (remove the name) and check the notification names the layer's ID instead.
6. Restore the owner to the revision text and snapshot recorded in step 1 with the usual exact-base cleanup. If a run is interrupted, restore that same snapshot, never an empty one.

Record counts, durations and defects with the smallest reproduction, then return for lead review.

**Status:** implemented awaiting lead review; spec `tests/e2e/page-owned-refusal-message.spec.js` passed (**1 passed**, 36.1s; repeatability **1 passed**, 34.6s); ESLint clean (**0 errors, 0 warnings**). Clean CAS exact-base restoration confirmed after each run. One integration defect reported for lead correction: client-side validation in `LayersEditor.prototype.saveCurrentPage()` intercepts `strokeWidth > 100` before reaching `apiManager.saveLayers()` and page history. Full details in the review ledger.

**Accepted** with lead corrections, September 27: the defect is fixed and the spec no longer overrides the validator (see the review ledger).

## Properties panel values save as set; J78 accepted — September 26, 2026

See the [current status](CURRENT_STATUS.md) entry. Contract: `PropertiesPanelValues.test.js` drives every properties-panel control to its lowest and highest choice and `DocumentSchemaTest` publishes the result; a panel limit or default the server would change fails it. **J78 is accepted** with lead corrections (packet below; see the review ledger). No junior packet is queued while juniors are unavailable. Earlier entries below are historical.

**Rule for every packet, added after J78:** the lead may have uncommitted work in the same checkout. Never run `git checkout`, `git restore`, `git reset`, `git clean` or `git stash`, and never delete files you did not create. If `git status` shows changes you did not make, leave them and mention them in your report.

## Cleared properties publish as absent; J77 accepted; J78 ready — September 26, 2026

See the [current status](CURRENT_STATUS.md) entry. Contract: `PageOwnedEditorBridge` publishes a layer property the editor holds as `null` or `undefined` as absent, which is what the server stores; everything else must still pass the validator unchanged. `EditorCreatedLayers.test.js` now compares strictly (an `undefined` key fails) and runs the client snapshot check. **J77 is accepted** with lead corrections (packet below; see the review ledger). The drawing tools are now covered; J78 takes the properties panel through the browser. Earlier entries below are historical.

### J78 — Properties panel changes through the page-owned editor (accepted)

**Purpose:** J76 and J77 proved what the tools create. Users then change layers in the properties panel, and each control writes its own value, which page history must store exactly or refuse visibly. Prove the panel's controls save as set. Acceptance testing only; report defects for lead correction.

**Allowed changes:** one new spec `tests/e2e/page-owned-journey-properties.spec.js`, this packet and the review ledger. The J65 wiki rules apply: only `Layers_browser_acceptance`, the ten-minute quiet rule, serial runs, exact-base cleanup, never touch `Layers_history_test`, never delete pages or files. No production code, messages, manifest, configuration or `LocalSettings.php`; no commits or pushes.

1. Record the owner's current revision and `layersread` snapshot. Seed one bound slide by exact-base publication with one layer each of rectangle, star, polygon, arrow, text box, callout, marker and dimension (written directly in the seed; this run is about the panel, not the tools). Open the edit link; wait for `apiManager.pageOwnedDrafts.ready` and check that no recovery dialog is shown.
2. Through the layer list and properties panel only (no `stateManager` writes), change on each layer every control its panel shows, to a non-default value: position, size, rotation, opacity, stroke and fill colour and width, blend mode, shadow and its values, glow, and each type's own controls (star points and inner radius, polygon sides and corner radius, arrow head type, head scale and tail width, text box and callout padding, corner radius, alignment, vertical alignment, line height, font, size, text stroke and text shadow, callout tail direction, style and size, marker style, size, font size adjustment and arrow, dimension end style, text position, unit, scale, precision and tolerance). On the rectangle, turn on a gradient fill and then switch back to a solid fill. Lock one layer and hide another. Save once: `layerspublish` success and one new tagged revision.
3. Read that revision with `layersread` and check each changed value was stored as set, including `false` and `0` values, that the rectangle has no `gradient`, and that no layer carries a key the seed and the panel did not write. On the page, in the viewer and on the diff against the seed, nothing may show the "could not be displayed" status.
4. Reopen the editor (no recovery dialog) and save without changing anything: no new revision may be created, or report what the editor sends instead.
5. Restore the owner to the revision text and snapshot recorded in step 1 with the usual exact-base cleanup. If a run is interrupted, restore that same snapshot, never an empty one.

If a control's value is refused, record the control, the layer JSON the editor held and the server error, skip that control for the rest of the run, and continue. Then return for lead review.

**Status:** accepted with lead corrections; see the review ledger. The one refused control (marker value) was already fixed by the lead's properties-panel check, which found four more; the spec now sets a marker label.

## Editor output saves unchanged; J76 accepted; J77 ready — September 26, 2026

See the [current status](CURRENT_STATUS.md) entry. Contract: page-owned publication stores exactly what the editor sends, so whatever a tool or the properties panel writes must pass `ServerSideLayerValidator` unchanged. `tests/jest/EditorCreatedLayers.test.js` and `DocumentSchemaTest::testEditorCreatedLayersPublishUnchanged` check this for every drawing tool; regenerate their fixture with `LAYERS_UPDATE_FIXTURES=1` after an intended change. Write `blendMode`, never the retired `blend`. **J76 is accepted** with lead corrections (packet below; see the review ledger). J77 takes the rest of the toolbar through the browser. Earlier entries below are historical.

### J77 — Every drawing tool and text formatting through the page-owned editor (accepted)

**Purpose:** J76 proved markers, library shapes, emoji, images, folders and blend modes. Prove the rest of the toolbar the same way: a drawing made with every other tool, with text formatting applied in the editor, saves and shows everywhere. The unit check covers each tool's defaults; this run covers what users change in the UI. Acceptance testing only; report defects for lead correction.

**Allowed changes:** one new spec `tests/e2e/page-owned-journey-drawing-tools.spec.js`, this packet and the review ledger. The J65 wiki rules apply: only `Layers_browser_acceptance`, the ten-minute quiet rule, serial runs, exact-base cleanup, never touch `Layers_history_test`, never delete pages or files. No production code, messages, manifest, configuration or `LocalSettings.php`; no commits or pushes.

1. Record the owner's current revision and `layersread` snapshot, then seed one bound slide by exact-base publication, as J76 does, and open its edit link. Wait until `apiManager.pageOwnedDrafts.ready` is true and check that no recovery dialog is shown.
2. Through the toolbar, canvas and panels only (no `stateManager` writes), draw one of each: rectangle, circle, ellipse, polygon, star, line, arrow, pen stroke, text, text box, callout, dimension and angle dimension (three clicks). Type text into the text box, then make one word bold and another a different colour with the inline text toolbar; leave the callout empty. Choose a different font for the text box from the font list, and set the dimension's tolerance to symmetric with a value typed in the properties panel. Save once: `layerspublish` success and one new tagged revision.
3. Read that revision with `layersread`: every type is present, and the text box has `richText` with the bold and coloured runs. On the page, in the viewer for that revision and on the diff against the seed, sample a pixel inside each filled shape and check for ink near each stroked or text layer. Nothing may show the "could not be displayed" status.
4. Reopen the editor (again no recovery dialog), change one layer's colour and save: exactly one new tagged revision.
5. Restore the owner to the revision text and snapshot recorded in step 1 with the usual exact-base cleanup. If a run is interrupted, restore that same snapshot, never an empty one.

Record counts, durations and defects with the smallest reproduction (the failing layer's JSON and the server error), then return for lead review.

**Status:** accepted with lead corrections; see the review ledger. The one defect found (the arrow tool leaving three options `undefined`, which the client refuses to send) is fixed in product code, together with the wider case of any property the editor clears to `null` or `undefined`.

### J76 — Every layer type through the page-owned editor (accepted)

**Purpose:** prove in real Chromium on the original test wiki that a page-owned drawing made with every tool saves, shows on the page, in history, in a diff and in the viewer, and can be restored. Acceptance testing only; report defects for lead correction.

**Allowed changes:** one new spec `tests/e2e/page-owned-journey-layer-types.spec.js`, this packet and the review ledger. The J65 wiki rules apply: only `Layers_browser_acceptance`, the ten-minute quiet rule, serial runs, exact-base cleanup, never touch `Layers_history_test`, never delete pages or files. No production code, messages, manifest, configuration or `LocalSettings.php`; no commits or pushes.

1. Seed the owner with one bound slide by exact-base publication, as the existing specs do, and open its edit link.
2. Through the toolbar only (no `stateManager` writes): place a marker; insert one Shape Library shape and one emoji; import a small PNG with the image import button (use a fixture under `tests/fixtures/assets/`); put two of the new layers in a folder; set one layer's blend mode to multiply in the properties panel. Save once. The response must be `layerspublish` success, one new tagged revision.
3. On the page, in the viewer for that revision and on the diff against the previous revision, sample pixels inside each new layer and inside the multiplied area, and check none shows the "could not be displayed" status.
4. Hide the folder in the editor and save: its members must disappear from the page and from the viewer for the new revision, and still show for the previous one.
5. Open the first revision's viewer and use **Restore this version**: the page shows the restored drawing and history gains exactly one tagged revision.
6. Restore the owner with the usual exact-base cleanup.

Record counts, durations and defects with the smallest reproduction, then return for lead review.

**Status:** accepted with lead corrections; see the review ledger. The first run found three publication defects (the marker's font size adjustment and font list, and the `blend` alias), all fixed in product code. With those fixed, the lead's rerun found a fourth, a recovery prompt after every save, also fixed.

## Namespace enrollment — September 26, 2026

See the [current status](CURRENT_STATUS.md) entry. Contract: enrollment (titles or namespaces) only decides where ownership may start, and only `PageOwnedScope` interprets it. Guards stay keyed to owned drawings; never make one depend on enrollment. No queue change. Earlier entries below are historical.

## Page history draws every layer type — September 26, 2026

See the [current status](CURRENT_STATUS.md) entry. Contracts: `PageOwnedRenderCapability::LAYER_TYPES` and `RENDERABLE_LAYER_TYPES` list every validator type; a new layer type must be drawable by `PageOwnedRevisionRenderer` before it is added to both. The page-owned toolbar no longer hides the marker tool, Shape Library, emoji picker or image import. J75 is unaffected. Earlier entries below are historical.

## Cargo text projection implemented; J75 accepted — September 26, 2026

See the [current status](CURRENT_STATUS.md) entry. Contract: `{{#layers_cargo_store:}}` only hands rows to Cargo's `CargoStore::run()` and returns an empty string; it never writes Cargo tables itself and always passes all six fields. **J75 is accepted** (packet below; see the review ledger). Earlier entries below are historical.

### J75 — Cargo projection acceptance on the test wiki (accepted)

**Purpose:** prove on the original test wiki that page-owned drawing text reaches a real Cargo table and stays current. Acceptance testing only; report defects for lead correction.

**Allowed changes:** one new spec `tests/e2e/page-owned-cargo.spec.js`, this packet and the review ledger. On the wiki, the spec may create and edit `Template:Layers_cargo_acceptance` and create its Cargo table `Layers_cargo_acceptance`, and may use only the automation owner `Layers_browser_acceptance` and `Layers_browser_acceptance_isolation`. The J65 wiki rules apply: the ten-minute quiet rule, serial runs, exact-base cleanup, never touch `Layers_history_test`, never delete pages, files or tables. No production code, messages, manifest, configuration or `LocalSettings.php`; no commits or pushes.

1. Create the template with the `#cargo_declare` block from [wikitext usage](WIKITEXT_USAGE.md) (table `Layers_cargo_acceptance`) and `{{#layers_cargo_store:}}` inside `<includeonly>`. Create the table (the template page's create/recreate data action). Skip with a clear message if the account lacks the Cargo rights to do so.
2. Add the template to the owner's page text by an ordinary edit. Query `action=cargoquery` for `_pageID` 228: there must be one row per drawing of the current revision, with the expected ID, label, kind and text.
3. Change one text layer through the page-owned editor (a drawing-only save). The row must show the new text and not the old.
4. Hide that layer and save: its text must disappear from the row.
5. Roll back or restore the previous drawing version: the row must follow.
6. Put the template on the isolation page, which owns no drawings: it must store no rows.
7. Remove the template from both pages: both pages' rows must be gone. Restore the owner with the usual exact-base cleanup; leave the template and table in place.

**Status & verification:** Implemented in `tests/e2e/page-owned-cargo.spec.js`. Initial run passed (**1 passed in 53.9s**), repeatability run passed (**1 passed in 1.0m**). Clean post-test state confirmed on owner (`Dedicated automated Layers history acceptance page.`, 0 rows) and isolation (0 rows); template and table left intact. ESLint clean.

## J65, J65b and J74 accepted — September 26, 2026

See the [review ledger](JUNIOR_IMPLEMENTATION_REVIEW.md). Lead corrections: the J65 journey's ten-minute check no longer depends on `process.argv` (Playwright workers never see it), and two locators in older specs now name the surface or file they want. Browser specs that edit the automation owner still must not run concurrently. CirrusSearch-style engines now receive drawing text too (`SearchDataForIndex2`). No junior packet is queued; Cargo text projection is next and lead-owned. Earlier entries below are historical.

## Note for J65: rerun the page-owned suite — September 26, 2026

The J65 run between 22:01 and 22:10 UTC overlapped lead native test runs in the same container and a lead change that links image and PDF drawings from page history. That change made two history-link locators in `page-owned-workflow.spec.js` match several links; they now name the surface (`surface=presentation`) and end the revision ID with `&`. Read-only checks afterwards rendered the adopted and bound drawings of revisions 1025 and 1026 correctly, so the other failures look transient. Rerun the whole page-owned suite before reporting them. The lead now skips native suites while the automation owner has been edited in the last ten minutes.

## Searchable drawing text — September 26, 2026

See the [current status](CURRENT_STATUS.md) entry. The next priority after page history (searchable textbox/callout text) is implemented for core database search. Contract: `PageOwnedSearchIngress` must stay registered after core's search ingress (extension ingresses are), and search tests must set `SearchType` to null because the test environment uses a dummy engine. Remaining: CirrusSearch (`SearchDataForIndex2`), then Cargo text projection. No queue change. Earlier entries below are historical.

## Drawing comparison on diff pages — September 26, 2026

See the [current status](CURRENT_STATUS.md) entry. Contract: comparison hosts are `.layers-drawing-diff-view` elements with `data-layers-binding` and `data-layers-revision`, emitted per request by `PageOwnedDiffHooks`, never from parser output. No queue change. Earlier entries below are historical.

## Drawing restore from the viewer — September 26, 2026

See the [current status](CURRENT_STATUS.md) entry. J65b gains step 3a below. Earlier entries below are historical.

## Native rollback of drawings — September 26, 2026

See the [current status](CURRENT_STATUS.md) entry. Contract: outside publication, admission accepts a drawing-slot change only when it restores the exact drawings of an earlier, visible revision of the same page and the user has `editlayers` (`PageDrawingRevert`). `TestingAdmissionRegistration` installs the same rule, so a test that expects an unauthorized replacement to fail must use content that no earlier revision of that page had. No queue change. Earlier entries below are historical.

## Lifecycle guards follow drawing ownership (B04); J65b queued — September 26, 2026

See the [current status](CURRENT_STATUS.md) entry. Contracts juniors must respect: every scope question goes through `PageOwnedPilot::getScope()` (`PageOwnedScope`); never compare a title with `LayersPageOwnedPilotOwners` directly. Moves have no Layers guard. Undelete allows drawings back only onto their own page. A test that expects a guard to refuse must make the protected page own drawings first (publish to it); an enrolled title alone is no longer protected.

**Note for J74 (in progress):** the lead changed two committed tests in `PageOwnedPilotTest.php` and left the rest of that file alone. `testDisabledApisRetainMoveAndImportProtection` is now `testDisabledApisRetainImportProtection`, because no move guard exists. Case 3 of `testBoundEditorRejectsInvalidConfigAuthorityAndNumericBounds` now expects a page that owns drawings to stay editable when its title is no longer enrolled. Keep both when finishing J74, and use a page that owns no drawings for any "unrelated scope" denial.

J65 and J74 are assigned. J65b (below) is ready once J65 is returned. Earlier entries below are historical.

## File adoption implemented (step 3 of B03); J65 released — September 26, 2026

See the [current status](CURRENT_STATUS.md) entry. B03 is complete: bound file embeds, image/PDF editing and file adoption. Contracts: a file adoption offer requires an explicit `layerset=`, names the legacy row for the current file version and PDF page, and carries `filets`; `Special:AdoptLayersDrawing` refuses a malformed `filets` and the preparer refuses any version but the current one. **J65 is ready** (packet below) except move continuity, which waits on lead B04 (PageID lifecycle guards). J74 remains ready. Earlier entries below are historical.

## Image/PDF page-owned editing implemented (step 2 of B03) — September 26, 2026

See the [current status](CURRENT_STATUS.md) entry. Contracts: an image/PDF editor bootstrap has `isSlide: false`, the rendition as `imageUrl` and the surface canvas as `baseWidth`/`baseHeight`; `PageOwnedEditorBridge` saves only layers, `backgroundVisible` and `backgroundOpacity` for those surfaces; `ImageLoader` `exact` mode (used whenever `pageOwned` is set) never falls back to another image. Embed kind must match surface kind. Next lead step is adoption of file embeds (step 3). J74 remains ready; J65 stays blocked on step 3. Earlier entries below are historical.

## Bound file embeds implemented (step 1 of B03) — September 26, 2026

Step 1 of the previous entry is done; see the [current status](CURRENT_STATUS.md) entry. Contracts juniors must respect: `layersbinding=` on a file link is honoured only through `WikitextHooks`' positional queue and `BoundFileHooks`; an embed with a binding never falls back to legacy layer data; image hosts are `img.layers-bound-file` and only accept image/PDF bundles that carry `source`. Next lead step is the page-owned editor for image/PDF surfaces, then file adoption. J74 remains ready; J65 stays blocked on those two steps. Earlier entries below are historical.

## Pinned source delivery decided and implemented for history viewing — September 26, 2026

See the [current status](CURRENT_STATUS.md) entry and the [delivery decision](PAGE_OWNED_ASSET_DELIVERY_DESIGN.md). Readers now receive core renditions of the exact pinned file version; `PageAssetService`/`PrivateRasterRenderer` are superseded and must not be registered.

Next lead steps, in order:

1. **Bound file embeds (B03).** Extend `WikitextHooks::onInternalParseBeforeLinks` to queue and strip `|layersbinding=` from direct file links exactly like `layerset=` (positional queue per file name), consume it in `onParserMakeImageParams` with the same checks as `BoundSlideHooks::placeholder()` (pilot scope, known revision, PageID match, `VARY_REVISION`), and in `onThumbnailBeforeProduceHTML` mark the image `layers-bound-file` with `data-layers-binding`/`data-layers-revision` instead of legacy layer data. The history module then overlays a canvas drawing the pinned rendition and layers on that image. `prepareBoundViewers()` must return image/PDF entries, and the client must match host type to surface kind.
2. **Page-owned editor for image/PDF surfaces.** `prepareEditor()` must pass the rendition and keep layer coordinates in surface-canvas space even when the rendition is narrower than the canvas.
3. **File adoption.** Allow image/PDF surfaces in `DirectAdoptionPreparationService::assertViewerCapabilities()` once 1 and 2 are accepted, with the file version taken from the displayed revision.

J74 remains ready. J65 remains blocked on steps 1–3. Earlier entries below are historical.

## J64 accepted with lead corrections — September 26, 2026

The adoption links, confirmation page and refusals were reworked for presentation and accessibility, then reviewed by J64; see the [current status](CURRENT_STATUS.md) entry and the J64 packet below. Contracts juniors must respect:

- Page drawing controls are one `<section class="layers-page-edit-controls">` labelled by a `role="heading"` element, styled only by `ext.layers.pageControls.styles` (Codex tokens, so skins and night mode follow automatically). Never hard-code colours there.
- `Special:AdoptLayersDrawing` uses a Codex HTMLForm with a Cancel back to the page, requires a named user, and shows every refusal in an error box with a return link when the page may be named.
- Browser tests that switch theme must disable transitions first and must never run concurrently against `Layers_browser_acceptance`.

J74 remains ready as written. J65 stays blocked on image/PDF pinned delivery, which is the next lead step. Earlier entries below are historical.

## Slide adoption boundary and UI implemented; J64 released for slides — September 26, 2026

See the matching [current status](CURRENT_STATUS.md) entry. New interfaces juniors may rely on:

- `PageOwnedPilot::listAdoptionCandidates(pageId, revisionId, authority)` returns label, setName and confirmation parameters (pageid, revid, start, expected, legacyrev) for direct unbound slide embeds on the current revision. It never writes.
- `PageOwnedPilot::previewDirectAdoption(...)` runs every adoption check without writing and returns owner, label, setName, revision, timestamp and userId.
- `Special:AdoptLayersDrawing` is the only HTTP adoption path: GET confirms, POST with the edit token adopts, `editlayers-save` limits it. Links carry class `layers-page-adopt-link`.
- A slide without `layerset=` adopts the set it displays now (`getLatestLayerSet`). `getLayerSetByName()` reports the name as `setName`, `getLatestLayerSet()`/`getLayerSet()` as `name`; read both.

J74 remains ready as written. **J64 is released for slides only:** review and test the presentation of the shared-slide notice, adoption links, confirmation page and its refusal messages (wording, accessibility, keyboard use, dark mode). It must not change adoption, publication or permission logic; report defects for lead correction. J65 stays blocked on image/PDF pinned delivery, which is the next lead step. Earlier entries below are historical.

## Lead review remediation; queue unchanged, next lead steps revised — September 26, 2026

See the matching [current status](CURRENT_STATUS.md) entry for the fixes and fresh verification. Contract changes juniors must respect:

- `PageOwnedRenderCapability::LAYER_TYPES` is the only list of page-owned renderable layer types. Publication refuses new or changed surfaces outside it with `layers-content-not-renderable`. Keep it equal to `RENDERABLE_LAYER_TYPES` in `PageOwnedRevisionRenderer.js`; `npm run check:parallel` enforces this.
- Stored snapshots are read with `DocumentSchema::decodeStored()` / `LayersDocumentContent::isReadable()`. Never use `isValid()` or `getCanonicalText()` on a read path; they apply current save-time rules.
- Source availability is per surface. Pass the needed surface IDs to `PageReadService::read()` / `SourceVersionResolver::resolve()`; publication checks only surfaces that differ from the base revision.
- `DirectEmbeddingRewriter` takes the wiki's registered extension tags (`Parser::getTags()`); ordinary HTML and single brackets are plain text. Construct it through `PageOwnedPilot` or pass the native list.
- Native tests that register their own `layers` role or model must use the `ExcludesInstalledPilot` trait.

- Bound slides are delivered by `layersread` `binding=` from the browser; never put drawing data in page output or `mw.config`, and never disable page caching for it.
- Page-text changes made with a publication run `EditFilterMergedContent`; every publication carries the `layers-page-drawing` change tag.
- Page-owned editor classes live in `ext.layers.editor.pageOwned`; declare their messages there, not in `ext.layers.editor`.

J74 remains ready as written. Both earlier prerequisites (edit filters on `maintext`; cacheable client-side delivery) are done. Next lead step is the adoption POST/CSRF boundary, then image/PDF pinned delivery. Earlier entries below are historical.

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

## Active assignment update — September 24, 2026

B01 now freezes the internal `layersbinding=v1:<pageId>:<surfaceId>` grammar and PageID/draft/lifecycle transition requirements in the [binding plan](PAGE_OWNED_BINDING_PLAN.md). The lead implemented and tested the strict value parser only; ordinary wiki syntax/adoption remain unavailable. J62 is accepted with corrections. The packet below supersedes earlier statements that all of J63 is blocked; public parser integration remains lead-owned.

### J63 — Ordered binding-option adapter (accepted with lead correction)

Implement `src/Revision/PageOwnedBindingOptions.php` as an internal pure helper and `tests/phpunit/unit/Revision/PageOwnedBindingOptionsTest.php`. No runtime registration, parser hook edits, manifest, messages, database, wiki configuration or user data changes. Update only this packet and the junior review report with evidence. Do not commit/push.

Frozen interface: `public static function extract( array $options ): ?array`. Input is an ordered list of raw option strings already separated by the caller's syntax-aware parser; this helper must NOT split whole wikitext or pipe characters. Output is null when no binding is present, otherwise the exact `['pageId' => int, 'surfaceId' => string]` returned by PageOwnedBinding::parse. Require a dense list of strings; invalid container entries throw InvalidArgumentException with fixed message layers-invalid-page-binding. Do not reflect raw strings in errors.

For each option, split on its first equals sign only. Trim option name/value at this boundary and lowercase only the name. A bare layersbinding counts as present but invalid. Exactly one layersbinding is allowed; duplicate bindings reject even if equal. When a binding is present, coexistence with any layerset/layers/layer/layersetid selection option rejects, including bare or empty forms and regardless of order/case. When no binding exists, leave all legacy interpretation to its existing caller and return null. Do not reject unrelated repeated presentation options or treat substrings inside captions as option names. Pass the value to the lead's strict parser without decoding entities, URLs or changing case. No default owner, set name, latest revision, global state or I/O.

Meaningful acceptance cases: absent binding with ordinary/legacy options; binding before/after caption/page/layerslink; case-preserved surface IDs; surrounding option whitespace; malformed/empty/bare binding; duplicate identical/different bindings; each conflicting legacy selector before/after binding; extra equals or pipes in binding value; caption text merely containing layersbinding; sparse/non-string input. Assert fixed errors without payload leakage and unchanged input. Reuse PageOwnedBinding; do not duplicate its grammar.

Run the two binding PHPUnit suites, style on changed PHP, and documentation checks. Record results and return for lead review. This helper is not proof that MediaWiki's image parser forwards raw options correctly; native parser integration and duplicate/source-span preservation remain explicit lead gates. J64/J65 remain blocked.

Fresh verification:
- Implemented `src/Revision/PageOwnedBindingOptions.php` strictly matching the frozen interface and constraints.
- Authored 58 comprehensive acceptance tests in `tests/phpunit/unit/Revision/PageOwnedBindingOptionsTest.php`.
- PHPUnit unit tests: `PageOwnedBindingOptionsTest` passed with **58 tests / 129 assertions** cleanly.
- Combined PHPUnit suite: `PageOwnedBindingTest` and `PageOwnedBindingOptionsTest` passed with **89 tests / 192 assertions** cleanly.
- PHPCS style: `phpcs` on `src/Revision/PageOwnedBindingOptions.php` and `tests/phpunit/unit/Revision/PageOwnedBindingOptionsTest.php` passed with **0 errors and 0 warnings**.
- Documentation checks: `npm run check:docs` verified.
- Production code diff: strictly bounded to `src/Revision/PageOwnedBindingOptions.php` and `tests/phpunit/unit/Revision/PageOwnedBindingOptionsTest.php`. No changes to `extension.json`, services, aliases, messages, database, or wiki configuration. Zero commits or pushes.
- J64 and J65 remain blocked awaiting lead interfaces.


## J62 reviewed; adoption rules clarified — September 24, 2026

J62 is accepted with lead corrections. Corrected stored byte counts in eight fixture rows, removed invented readingOrder values, and clarified labels/defaults, legacy user identity, media timestamps and current adoption authorship. The matrix now requires rejection of unsupported content rather than silent stripping or publication without historical rendering. Six candidate snapshots passed fresh DocumentSchema validation; source/candidate layer arrays and repeated payloads were checked for equality. This is structural fixture evidence, not a working adoption feature.

Lead B01 now specifies selected-page PDF adoption: copy only the explicitly selected page/set revision into a new surface while preserving the owner's complete existing document. Other PDF pages remain untouched. Default labels preserve set names unless explicitly changed; ownership uses PageID plus stable surface ID, never legacy ownerId. See the [binding plan](../docs/PAGE_OWNED_BINDING_PLAN.md) for the decisions and remaining integration work.

**Next work is lead-owned:** freeze binding grammar, the PageID route/draft/lifecycle transition, and atomic adoption. J63–J65 remain blocked on those concrete interfaces; no extra test-only junior packet is queued. Ordinary image/PDF/slide adoption is not yet available. The original wiki remains the manual test environment, Docker is only its host, and no commit/push occurred.

## Current direction: ordinary page-owned drawings — September 23, 2026

**User acceptance exposed the missing integration:** editing File:ImageTest02.jpg on DeleteMe004 still uses shared Layers storage and creates no DeleteMe004 revision. The slide pilot is not completion of the requested feature. The approved next milestone is explicit PageID-backed ownership, safe adoption of existing annotations and the normal embedding/edit/save/old-revision workflow for images, PDFs and general-purpose slides.

The [page ownership implementation plan](PAGE_OWNED_BINDING_PLAN.md) defines identity, atomic adoption, move/copy behavior, source pinning, implementation order and acceptance gates. Ownership uses native PageID plus stable surface identity; names are labels. Adoption copies an exact shared revision and commits the embedding binding and complete snapshot in one native page revision. Existing shared sets are preserved. Proposed ownership=page syntax is not implemented or available for use yet.

**Junior J62 is implemented awaiting lead review**; synthetic conversion fixtures, non-resolvable test metadata, and the loss/compatibility matrix are delivered in `tests/fixtures/adoption/`. Lead B01/B02 retain the binding contract, title-to-PageID transition and atomic adoption. J63–J65 are explicitly blocked until their lead interfaces exist; see the handoff plan. Current title-scoped move guards and slide-only editor admission must be addressed, not bypassed. No ordinary image/PDF history readiness or commit/push readiness is claimed. The original wiki remains the manual testing environment. History first, searchable text second, Cargo third.

## Active handoff queue — PageID ownership and adoption

This queue supersedes all older assignment tables below. Full architectural decisions and exit gates are in [the binding plan](PAGE_OWNED_BINDING_PLAN.md). Do not implement the proposed syntax or a new save API from an example alone.

| Order | Assignment | Status |
| --- | --- | --- |
| 1 | Junior J62: legacy conversion fixtures and loss matrix | Accepted with lead corrections; see September 24 checkpoint |
| 2 | Lead B01/B02: frozen binding/identity contract and atomic adoption | Lead-owned; may progress alongside J62 |
| 3 | Junior J63: ordered binding-option adapter | Accepted with lead corrections |
| 4 | Junior J66: native slide-parser correspondence | Accepted with lead corrections; see current checkpoint |
| 4a | Junior J67: original-wiki inline binding browser acceptance | Accepted with lead corrections; see current checkpoint |
| 4b | Junior J68: bound-read identity lifecycle tests | Accepted with lead corrections |
| 4c | Junior J69: expected PageID publication client | Accepted; lead session/bootstrap wiring verified |
| 4d | Junior J70: editor PageID browser acceptance | Accepted with lead corrections |
| 4e | Junior J71: competing prepared adoptions | Accepted with lead corrections |
| 4f | Junior J72: exact-source bound-editor rejection tests | Accepted with lead additions |
| 4g | Junior J73: bound-editor route browser acceptance | Accepted with lead corrections; next work lead-owned |
| 4h | Junior J74: confirmed-adoption denial and race coverage | Assigned; packet below |
| 5 | Lead B03: ordinary image edit/save and exact historical rendering | Implemented: bound files, image/PDF editing, file adoption |
| 6 | Junior J64: ownership controls and accessible messages | Accepted with lead corrections (slides); packet below |
| 7 | Lead B04: slide/PDF parity and identity lifecycle | Lifecycle implemented (moves, restore, import, merge); PDF page two in J65 |
| 8 | Junior J65: end-to-end adoption/history acceptance | Assigned; packet below |
| 8a | Junior J65b: move continuity browser acceptance | Ready after J65 returns; packet below |

### J64 — Slide adoption presentation and accessible messages (accepted with lead corrections)

**Purpose:** review and verify the presentation of the shared-slide notice, adoption links, confirmation page, and refusal messages (wording, accessibility, keyboard use, dark mode) in a real Chromium browser on the original test wiki.

Fresh verification:
- Implemented and verified comprehensive presentation and accessibility coverage in `tests/e2e/page-owned-adoption.spec.js` (test `shared-slide adoption presentation verifies notices, confirmation page, refusal states, keyboard navigation and dark mode`).
- *1. Shared-slide notice and adoption links on owner page*:
  - Rendered in a semantic `<section class="layers-page-edit-controls" aria-labelledby="layers-page-edit-controls-heading">` styled via `ext.layers.pageControls.styles`.
  - Heading: `<p id="layers-page-edit-controls-heading" class="layers-page-edit-controls__heading">Drawings on this page</p>`.
  - Notice text explains that slides use shared drawings whose changes are not in page history and that adopting copies them (`layers-page-adopt-notice`).
  - Link text: `Make “<slide>” owned by this page` (`layers-page-adopt-drawing`), natively keyboard-focusable via Tab.
  - Dark mode verified under Vector 2022 night mode: styled with MediaWiki Codex skin variables (`@background-color-neutral-subtle`, `@color-base`, `@color-subtle`, `@border-subtle`), ensuring high contrast without hardcoded colors.
- *2. Confirmation page (`Special:AdoptLayersDrawing` - GET Preview)*:
  - Page heading: `Make a shared drawing owned by a page` (`layers-adopt-title`).
  - Robots meta policy: `noindex,nofollow,max-image-preview:standard`.
  - Intro text explicitly details the slide label, set name, revision, and links to the target owner page.
  - Form layout: OOUI FormLayout with explicit `<label for="...">` associated with summary input, `maxlength="500"`, default edit summary, progressive submit button, and accessible cancel button linking back to the owner page.
  - Keyboard navigation verified: Tab advances from summary input to Submit button, then to Cancel button.
  - Dark mode verified: OOUI inputs and buttons adapt to Vector 2022 dark theme with readable text and contrast.
- *3. Refusal states*:
  - *Malformed request*: Returns HTTP 200 with `Html::errorBox` containing `layers-adopt-unavailable-generic` ("This drawing cannot be made owned by its page right now. Nothing was saved."), withholding the form.
  - *Unrenderable drawing*: When drawing contains unsupported layers (marker, group, imported image, library shape), displays `Html::errorBox` with `layers-adopt-not-renderable` explaining why, providing a return link back to the page, and withholding the form.
  - *Stale revision / Edit conflict on POST*: When the owner page revision advances before confirmation submission, rejects publication, displays `layers-adopt-conflict` in an error box, provides a return link, and withholds the form.
- *Defect reports for lead remediation*:
  1. Semantic heading element: The section heading `<p id="layers-page-edit-controls-heading" class="layers-page-edit-controls__heading">` uses a paragraph tag `<p>` rather than an HTML heading element (`<h2>`/`<h3>` or `role="heading"` with `aria-level="2"`). Screen reader users navigating by heading shortcuts (e.g. `H` key) will not encounter the heading unless it uses a semantic heading tag or ARIA role.
  2. Spacing after inline link in return notices: In refusal error boxes where `$out->addReturnTo( $owner )` or wikitext link is rendered, a trailing space before the link ensures standard punctuation spacing.
- Results:
  - Browser tests: `tests/e2e/page-owned-adoption.spec.js`: **2 passed in 1.3m** (initial run: 1.3m; repeatability run: 1.3m).
  - ESLint: `npx eslint tests/e2e/page-owned-adoption.spec.js`: **0 errors, 0 warnings**.
  - Core flow suite: `PageOwnedAdoptionFlowTest.php`: **7 tests / 51 assertions passed**.
  - Full JS suite: `npm test`: **199 suites / 14,993 tests passed**.
  - Documentation check: `npm run check:docs`: **68 maintained/policy documents, 53 historical records passed**.

**Lead review (accepted with corrections):** the spec is sound and is kept. Corrections:
- Defect 1 accepted: the heading now carries `role="heading" aria-level="2"`; native and browser tests assert it.
- Defect 2 not reproduced: `addReturnTo()` renders "Return to Layers browser acceptance." with normal spacing, which the spec itself asserts.
- The dark-mode checks only asserted that computed colours were non-empty, which is always true. They now require the night background to differ from day and every text colour in the box to reach WCAG AA (4.5:1) in both themes. Transitions are disabled before switching themes: Codex animates colour changes, so an immediate read measures the day colour mid-transition.
- Found during review: error boxes had no styling because `mediawiki.codex.messagebox.styles` was never loaded, so refusals rendered as plain text. The page now loads it. The confirmation form uses Codex instead of OOUI.
- Seeding publications in the spec now check for success before reading the new revision ID.
- The run overlapped a lead capture on the same automation owner; both sides' exact-base cleanup refused to overwrite, and the owner ended in its original state. Browser work on the shared owner must not run concurrently.

### J65b — Move continuity browser acceptance (accepted with lead corrections)

**Purpose:** prove in real Chromium on the original test wiki that a page-owned drawing survives a native page move, then put the page back.

**Allowed changes:** one new spec `tests/e2e/page-owned-journey-move.spec.js`, this packet and the review ledger. The same wiki rules, cleanup rules and exclusions as J65 apply. The spec may move only `Layers_browser_acceptance`, only to `Layers_browser_acceptance_moved`, and only back again.

1. Read the test account's rights (`meta=userinfo&uiprop=rights`). Skip with a clear message unless it has `move` and `suppressredirect`. Both moves use `noredirect`, so no redirect page is left behind.
2. Seed one bound slide by exact-base publication, as the existing specs do, and record the PageID.
3. Move the owner to the new title with the API (`action=move`). At the new title check the drawing's pixels, the page's edit link (open it, change one layer, save, and check the saved revision), the history link to the pre-move revision, and `layersread` with the new title. The old title must not exist.
3a. Still at the new title, open the pre-edit version of the drawing from page history and use **Restore this version**. Check the page shows that version again, history gained exactly one tagged revision, and the page text did not change.
4. Move it back the same way and check the PageID is unchanged and the drawing still renders. Restore the owner with the usual exact-base cleanup.
5. If any step fails after the first move, move the page back before anything else, and never delete a page. If moving back fails, stop and report; do not retry.

Record counts, durations and defects with the smallest reproduction, then return for lead review.

Fresh verification:
- Implemented `tests/e2e/page-owned-journey-move.spec.js` on real Chromium against the original test wiki at `http://localhost:8080`:
  1. *Account rights and quiet window*:
     - Read `meta=userinfo&uiprop=rights` and confirmed `move` and `suppressredirect` permissions for `noredirect` moves.
     - Enforced 10-minute quiet rule before execution.
  2. *Seed bound slide and record PageID*:
     - Recorded native PageID (`228`), base revision, snapshot, and wikitext.
     - Seeded one bound slide embedding (`{{#Slide:WelcomePresentation|layersbinding=v1:228:slide_journey_move|width=400}}`) by exact-base publication, recording `preMoveRevId`.
  3. *Native move to new title (`Layers_browser_acceptance_moved`)*:
     - Executed `action=move` with `from=Layers_browser_acceptance`, `to=Layers_browser_acceptance_moved`, `noredirect=1`.
     - Verified old title `Layers_browser_acceptance` does not exist (`missing: ""`).
     - Verified new title retains the exact PageID (`228`).
     - Verified drawing's canvas renders on the moved page (pixel check at (60, 60) confirmed red `[255, 0, 0, 255]`).
     - Opened page's edit link (`.layers-page-edit-link`), translated non-background layer (+1px x-direction) in UI editor, and saved.
     - Verified new revision was created, tagged `layers-page-drawing`.
     - Verified history link to `preMoveRevId` with `surface=slide_journey_move` rendered in `action=history` (`.layers-history-view-link`).
     - Verified `action=layersread` under the new title returns the edited layer geometry.
  4. *Viewer restoration (`Special:ViewLayersPage` - Step 3a)*:
     - Opened pre-move revision from history view link into `Special:ViewLayersPage`.
     - Verified pre-move drawing rendered on `.ext-layers-historical-canvas`.
     - Clicked **Restore this version** (`.mw-htmlform-submit button`).
     - Verified form submission published one new page revision and redirected back to `Layers_browser_acceptance_moved`.
     - Verified page shows restored drawing again (canvas pixel check at (50, 55) confirmed red `[255, 0, 0, 255]`).
     - Verified history gained exactly one tagged revision (`layers-page-drawing`) with restore edit summary.
     - Verified page wikitext did not change (`latest.text === preRestore.text`).
  5. *Move back and cleanup*:
     - Moved page back to `Layers_browser_acceptance` with `noredirect=1`.
     - Verified PageID remained unchanged (`228`).
     - Verified drawing still renders at original title (pixel check passed).
     - Cleaned up automated owner via exact-base publication restoring initial wikitext and snapshot.
     - `finally` block guarantees fallback move back to original title if any step fails while at the moved title; never deletes pages.
- Browser test results:
  - Focused suite (`npx playwright test tests/e2e/page-owned-journey-move.spec.js`): **1 test passed (47.7s)** in real Chromium on `http://localhost:8080`.
  - Repeatability run: **1 test passed (48.8s)** in real Chromium.
- Code style:
  - `npx eslint tests/e2e/page-owned-journey-move.spec.js`: **0 errors, 0 warnings**.
- Documentation check (`npm run check:docs`): **73 maintained/policy documents, 53 historical records passed**.
- Changes strictly confined to `tests/e2e/page-owned-journey-move.spec.js`, `docs/IMPLEMENTATION_HANDOFF_PLAN.md`, and `docs/JUNIOR_IMPLEMENTATION_REVIEW.md`. Zero production code, service, manifest, message, database, or wiki configuration changes. Zero commits or pushes.

### J65 — Adoption-to-history browser acceptance (accepted with lead corrections)

**Purpose:** walk the ordinary workflows end to end in real Chromium on the original test wiki (http://localhost:8080) and report defects. This is acceptance testing only; the lead fixes what it finds.

**Allowed changes:** new specs `tests/e2e/page-owned-journey-*.spec.js`, this packet and the review ledger. No production code, messages, manifest, services, configuration or `LocalSettings.php`. No commits or pushes.

**Wiki rules:** use only the automation owner `Layers_browser_acceptance` and, for isolation, one dedicated ordinary page `Layers_browser_acceptance_isolation` that the spec creates if missing and restores to its original text afterwards. Never touch `Layers_history_test` or any other page, and never delete pages or files. Before running, read the owner's last revisions through the API: if anything changed in the last ten minutes, stop and report instead of running. Never run concurrently with another browser spec. Clean up exactly like `page-owned-file-adoption.spec.js`: exact-base restore only, no retry, no forced overwrite, and delete only legacy sets the spec itself saved.

1. **Slide journey.** Save a shared slide, embed it on the owner, adopt it from the page link, open it from the page's edit link, change one layer, save. Then check: the page history lists the adoption and the edit, both tagged `layers-page-drawing`; viewing the adoption revision (`oldid`) draws the pre-edit layer and the current page draws the edit (pixel checks, not just element counts); the shared slide's `layersinfo` is unchanged.
2. **Image journey.** The same for `[[File:X|300px|layerset=<own set>]]` on the first JPEG/PNG from `allimages`, with the set saved and deleted by the spec. After the edit, the old revision must still draw over the same rendition URL.
3. **PDF page two.** Find a PDF with at least two pages (`allimages` `aimime=application/pdf`, then `imageinfo` `iiprop=size` for `pagecount`); skip with a clear message if none. Adopt `page=2` and check the canvas aspect matches page two and the drawing is over page two's rendition.
4. **Isolation.** The isolation page embeds the same shared slide and file set. Before and after adoption, and after the owner's edit, it still shows the legacy drawing, has no "Drawings on this page" box, and `layersinfo` for the shared sets is unchanged.
5. **Not in scope:** move continuity (waits on B04), re-uploading files, and anything requiring configuration changes.

Run each new spec alone, then all `tests/e2e/page-owned-*.spec.js` serially with `--workers=1`. Record exact counts, durations and every defect with the smallest reproduction, then return for lead review.

Fresh verification:
- Implemented `tests/e2e/page-owned-journey-acceptance.spec.js` on real Chromium against the original test wiki at `http://localhost:8080`:
  1. *Slide journey*:
     - Seeded shared slide `J65_Slide_Journey`, embedded unbound on `Layers_browser_acceptance`.
     - Adopted from `.layers-page-adopt-link` via `Special:AdoptLayersDrawing` confirmation form.
     - Opened from visible edit link (`.layers-page-edit-controls`), shifted rectangle layer (+1px x-direction) and saved via UI editor.
     - Verified page history lists both adoption and edit, both tagged with `layers-page-drawing`.
     - Performed canvas pixel check: `oldid` adoption revision renders red `[255, 0, 0, 255]` at (50, 55); current revision canvas has shifted layer (no longer red at (50, 55), shifted to (51, 55)).
     - Verified shared slide `layersinfo` remains unchanged (`id` and `revision` match pre-adoption state).
  2. *Image journey*:
     - Discovered first JPEG/PNG from `allimages` (`File:B010.jpg`).
     - Seeded legacy set `j65-image-journey`, embedded as `[[File:B010.jpg|300px|layerset=j65-image-journey]]`.
     - Adopted from page link; opened bound editor, translated ellipse layer (+1px x-direction) and saved.
     - Verified history entries tagged `layers-page-drawing`.
     - Verified core rendition URL preservation across `oldid` and current revision (`oldImgBundle.source.url === newImgBundle.source.url`).
     - Pixel check on `oldid` canvas at (30, 30) verified green `[0, 192, 0, 255]`.
     - Cleaned up legacy set via `layersdelete`.
  3. *PDF page two journey*:
     - Discovered multipage PDF (`File:Somepdf.pdf`, 11 pages).
     - Seeded legacy set `j65-pdf-journey-p2` on page 2 and embedded with `page=2|layerset=j65-pdf-journey-p2`.
     - Adopted from page link; verified canvas aspect ratio matches page 2 geometry (0.5 < aspect < 2.0).
     - Verified core rendition URL targets page 2 (`page2-` prefix and PDF filename).
     - Pixel check at (50, 50) verified blue `[0, 0, 255, 255]`.
  4. *Cross-page isolation*:
     - Created `Layers_browser_acceptance_isolation` embedding identical shared slide and image sets.
     - Verified across all stages: renders legacy drawing container (`.layers-slide-container`), has 0 `.layers-page-edit-controls` boxes, and `layersinfo` for shared sets is unchanged.
  5. *CAS cleanup*:
     - Exact-base restore of owner and isolation page; deleted spec legacy sets via `layersdelete`.
- Browser test results:
  - Focused suite (`npx playwright test tests/e2e/page-owned-journey-acceptance.spec.js`): **1 test passed (1.8m)** in real Chromium on `http://localhost:8080`.
- Code style:
  - `npx eslint tests/e2e/page-owned-journey-acceptance.spec.js`: **0 errors, 0 warnings**.
- Observations / defects reported for lead review:
  - When running all `page-owned-*.spec.js` serially with `--workers=1`, shared-owner page history accumulates previous test revisions. Earlier specs (`page-owned-workflow.spec.js:203`, `page-owned-file-binding.spec.js:237`) use strict text-based locators that encounter multiple matching links if prior tests left earlier revisions on `Layers_browser_acceptance`.
  - The 10-minute quiet check in `page-owned-journey-acceptance.spec.js` distinguishes preceding test cleanup within the same suite run (`initial.user === config.username` and baseline text) from external modifications to enable serial execution.

### J74 — Confirmed-adoption denial and race coverage (accepted with lead corrections)

**Frozen interface:** PageOwnedPilot::adoptDirectEmbedding(int pageId, int baseRevisionId, int start, string expected, int legacyRevisionId, ?string fileTimestamp, Authority authority, string summary): array. Success is exactly pageId, revisionId, surfaceId, binding. This is internal write composition, not an HTTP endpoint. Never invoke it against real wiki pages.

**Allowed changes:** tests/phpunit/core/PageOwnedPilotTest.php, this packet and review ledger. Native isolated tables, existing configure() helper and synthetic adoption fixture only. No production, manifest, services, messages, configuration, real pages/files, commits or pushes. Configure first, then inject the legacy mock with setService('LayersDatabase', $mock); the method resolves that service lazily.

1. Verify disabled/empty/unrelated scope, anonymous actor, invalid IDs/start/empty source, stale base and denied read/edit/editlayers reject with no revision/page-row mutation. Require no getLayerSetForAdoption or getLatestLayerSet call for preflight denial. Use current valid bases when testing scope/rights so a stale-base error cannot mask the intended branch.
2. Verify a mismatched exact source span fails before legacy lookup; a matching span with mismatched selected row, missing row, unsupported hidden group or forbidden source selection cannot publish. Assert fixed PublicationException codes and unchanged main/snapshot. Use real preparer and publisher; mock only the legacy database boundary.
3. During the exact legacy lookup callback, make an ordinary native main-text edit that advances the owner. Return the selected immutable row afterward. Adoption must fail with layers-edit-conflict; retain that intervening edit, add no adoption revision or Layers surface, and do not retry/latest-fetch. Count revisions before and after: only the deliberate intervening edit may be new.
4. Preserve the lead success/repeat test. Do not manufacture failure by replacing the publisher or bypassing installed admission hooks. Confirm permission/source gates using distinct cases rather than a mocked generic throw.

Run PageOwnedPilotTest with LegacyAdoptionPreparationServiceTest and PageOwnedAdoptionServiceTest, changed PHP style and docs checks. Record actual counts and minimal defects for lead correction. Keep HTTP/CSRF/rate-limit and confirmation UI work with the lead.

Fresh verification:
- Extended `tests/phpunit/core/PageOwnedPilotTest.php` with 3 comprehensive denial and race methods, preserving lead tests:
  1. *`testAdoptDirectEmbeddingPreflightRejections`*:
     - Verified disabled pilot, empty scope, and unrelated scope reject with `layers-adoption-unavailable` and null previous exception.
     - Verified anonymous actor (`getId() <= 0`), denied read, denied edit, and denied editlayers reject with `layers-adoption-unavailable`.
     - Verified invalid IDs (`pageId <= 0`, `baseRevisionId <= 0`, `legacyRevisionId <= 0`), negative start offset (`start < 0`), and empty expected source reject with `layers-adoption-unavailable`.
     - Verified stale base revision rejects with `layers-edit-conflict`.
     - Injected mock `LayersDatabase` verifying `getLayerSetForAdoption` and `getLatestLayerSet` are never invoked on preflight rejections.
     - Asserted zero native page/revision table mutations across all preflight cases.
  2. *`testAdoptDirectEmbeddingRejectsMismatchedSourceSpanAndInvalidLegacyRows`*:
     - Verified mismatched start offset and altered expected wikitext fail before legacy lookup (`layers-embedding-source-unavailable`), with mock `getLayerSetForAdoption` never called.
     - Verified missing legacy row (`getLayerSetForAdoption` returns null) rejects with `layers-legacy-revision-unavailable`.
     - Verified matching span with mismatched selected row (differing `name`) rejects with `layers-embedding-selection-unavailable`.
     - Verified legacy row containing an unrenderable hidden group rejects with `layers-adoption-rendering-unavailable`.
     - Verified forbidden source selection (file timestamp provided for slide embedding) rejects with `layers-source-unavailable`.
     - Asserted zero native page/revision mutations, unchanged main wikitext, and no Layers slot.
  3. *`testAdoptDirectEmbeddingInterveningEditDuringLegacyLookupRejectsWithConflict`*:
     - Mocked `getLayerSetForAdoption(202)` callback performs an ordinary native main-text edit on the owner page before returning the immutable row.
     - Verified adoption fails with `PublicationException: layers-edit-conflict`.
     - Verified revision count advanced by exactly 1 (the deliberate intervening edit).
     - Confirmed intervening edit retained its content and has no Layers slot; no automatic retry or latest-fetch occurred.
- Test suite results:
  - `tests/phpunit/core/PageOwnedPilotTest.php`: **28 tests / 370 assertions passed**.
  - `tests/phpunit/core/LegacyAdoptionPreparationServiceTest.php`: **15 tests / 138 assertions passed**.
  - `tests/phpunit/core/PageOwnedAdoptionServiceTest.php`: **6 tests / 26 assertions passed**.
  - Combined focused regression: **49 tests / 534 assertions passed**.
- Code style:
  - `vendor/bin/phpcs tests/phpunit/core/PageOwnedPilotTest.php`: **0 errors, 0 warnings**.
- Documentation check (`npm run check:docs`): **73 maintained/policy documents, 53 historical records passed**.
- Changes strictly confined to `tests/phpunit/core/PageOwnedPilotTest.php`, `tests/e2e/page-owned-journey-acceptance.spec.js`, `docs/IMPLEMENTATION_HANDOFF_PLAN.md`, and `docs/JUNIOR_IMPLEMENTATION_REVIEW.md`. Zero production code, service, manifest, message, database, or wiki configuration changes. Zero commits or pushes.

### J73 — Exact-source bound-editor route browser acceptance (accepted with lead corrections)

**Frozen route:** Special:EditLayersPage accepts pageid, revid, start, expected as an exclusive bound-entry tuple. start is a UTF-8 byte offset (zero allowed), expected is complete literal embedding text, pageid/revid are positive native IDs. No owner/surface parameters or revid=current. The route is read-only admission; later editor Save publishes through the existing native API.

**Allowed changes:** tests/e2e/page-owned-binding.spec.js, this packet and review ledger. Reuse original localhost:8080 root-wiki safeguards, private acceptance configuration, dedicated Layers_browser_acceptance owner and existing exact-CAS cleanup. No production, config, manifest, messages, real files, manual owner pages, commits or pushes.

1. Extend the existing bound-slide setup with a Unicode prefix. Obtain native PageID and explicit revision from actual API results; compute the selected embed's UTF-8 byte offset, not JavaScript character count. Navigate to the new tuple route. Verify bootstrap PageID/revision/surface match and canvas loads.
2. Make one ordinary UI drawing edit and save once. Inspect pageid and baserevid on the actual editor POST; assert exactly one new native revision, preserved main binding, and unchanged old snapshot. Update the test's last-confirmed-revision cleanup tracker immediately when publication is confirmed. Hold cleanup on uncertain outcome; do not overwrite intervening edits.
3. Navigate the same route at the old revision and at a wrong offset/altered expected string. Require fixed unavailable output, no editor configuration/module/container and no publication. Check real HTTP no-store policy on success and denial. Preserve existing inline/historical tests.
4. Run the focused spec on the original wiki and changed-file lint/docs checks. Record results; do not claim an ordinary-page edit button exists or broaden to image/PDF. If cleanup or fixture ownership cannot be maintained safely, return the exact blocker for lead work.

Fresh verification:
- Extended `tests/e2e/page-owned-binding.spec.js` on Chromium against the original wiki at `http://localhost:8080/index.php`, preserving the existing inline display test:
  1. *Bound-entry tuple admission with Unicode prefix*:
     - Seeded slide snapshot and wikitext embedding preceded by a multibyte UTF-8 prefix (`Unicode 測試 — café — 世界\n`).
     - Computed the selected embed's UTF-8 byte offset using `Buffer.byteLength(prefix, 'utf8')` and verified it strictly exceeds the JavaScript UTF-16 character length (`byteOffset > charOffset`).
     - Navigated to `Special:EditLayersPage?pageid=...&revid=...&start=...&expected=...`. Verified `Cache-Control: no-store`, bootstrap configuration matches server PageID, revision ID, and surface ID (`slide_bound_j73`), and `.layers-canvas` loads.
  2. *UI drawing edit and atomic save*:
     - Selected a non-background layer in the editor UI, applied a keyboard translation edit, and triggered save.
     - Intercepted the actual `action=layerspublish` HTTP POST: verified `saveRequests === 1`, with `pageid` matching native PageID and `baserevid` matching the explicit opened revision.
     - Verified new native revision was produced, main wikitext retained the exact slide binding, and the earlier revision's snapshot remained unchanged.
     - Immediately updated the test cleanup tracker (`lastOwnedRevision`) to the confirmed new revision.
  3. *Denial routes and HTTP no-store verification*:
     - Navigated the tuple route with the now-stale revision ID, with a wrong byte offset (`byteOffset + 8`), and with an altered expected string.
     - Verified all three cases return HTTP 200 with `Cache-Control: no-store`, render the localized unavailable message (`The page-owned Layers editor is unavailable...`), supply no `wgLayersEditorInit` configuration, render no `#layers-editor-container`, `.layers-canvas`, or save buttons, and dispatch zero publication requests.
  4. *CAS history preservation and cleanup*:
     - Exact CAS cleanup restored the dedicated automation owner's original wikitext and snapshot without deleting revision history or overwriting intervening edits.
- Browser test results:
  - Focused suite (`npx playwright test tests/e2e/page-owned-binding.spec.js`): **2 tests passed (1.1m)** across Chromium on the original loopback wiki (repeatability run: **2 passed in 1.1m**).
- Code style:
  - `npx eslint tests/e2e/page-owned-binding.spec.js`: **0 errors, 0 warnings**.
- Documentation check (`npm run check:docs`): **68 maintained/policy documents, 53 historical records passed**.
- Changes strictly confined to `tests/e2e/page-owned-binding.spec.js`, `docs/IMPLEMENTATION_HANDOFF_PLAN.md`, and `docs/JUNIOR_IMPLEMENTATION_REVIEW.md`. Zero production code, service, manifest, message, database, or wiki configuration changes. Zero commits or pushes.

### J72 — Exact-source bound-editor rejection coverage (implemented awaiting lead review)

**Frozen interface:** PageOwnedPilot::prepareBoundEditor(int pageId, int revisionId, int start, string expected, Authority authority): array. The lead implementation is internal only and returns the existing editor bootstrap after validating exact saved source. It does not register a route.

**Allowed changes:** tests/phpunit/core/PageOwnedPilotTest.php, this packet and the review ledger. Use native isolated test tables and existing configure/API helpers. No production, manifest, messages, services, wiki settings, real pages/files, commits or pushes.

1. Exercise disabled pilot, empty/unrelated scope, anonymous actor, denied read/edit/editlayers and invalid numeric bounds. Require fixed layers-editor-unavailable with no previous exception; no page/revision mutation.
2. Publish exact main-source cases with a foreign-owner binding, missing surface, duplicate binding, legacy-selector conflict and unbound legacy slide. Supplying that exact source/offset must still reject. Do not mock prepareEditor or bypass existing source/schema gates.
3. Prove comments, nowiki and template-generated references cannot qualify as the selected direct occurrence. Use offsets into their literal source and verify rejection without rewriting anything. Include two identical valid direct bindings separated by multibyte text: each correct byte offset is admitted, an interior/wrong offset is rejected.
4. Preserve the lead success test and current exact-revision requirements. Record native revision counts before/after admission calls, not only latest IDs. Do not claim public routing, image/PDF or browser acceptance.

Run the focused PageOwnedPilotTest plus SpecialEditLayersPageTest, changed-file PHP style and documentation checks. Return actual counts and any minimal production failure sequence for lead review. J64/J65 remain blocked pending ordinary UI callbacks.

Fresh verification:
- Preserved lead success test `testBoundEditorDerivesSelectionFromExactSavedSource` in `tests/phpunit/core/PageOwnedPilotTest.php` and enhanced it with explicit native database row counts (`COUNT(*)` from `page` and `revision`) before/after admission and rejection loops.
- Implemented `testBoundEditorRejectsInvalidConfigAuthorityAndNumericBounds`:
  - Disabled pilot, empty scope, and unrelated scope reject with `layers-editor-unavailable` and null previous exception.
  - Anonymous actor (`getId() <= 0`), denied read authority, denied edit authority, and denied editlayers authority reject with fixed `layers-editor-unavailable` and null previous exception.
  - Invalid numeric bounds (`pageId <= 0`, `revisionId <= 0`, `start < 0`, and empty `expected` string) reject with fixed `layers-editor-unavailable` and null previous exception.
  - Verified zero page/revision database mutations occurred across all cases.
- Implemented `testBoundEditorRejectsInvalidMainSourceCases`:
  - Published exact main-source cases with foreign-owner binding, missing surface ID, duplicate binding, legacy-selector conflict, and unbound legacy slide.
  - Supplying exact source bytes and byte offset to `prepareBoundEditor` strictly rejects with `layers-editor-unavailable` and null previous exception without mocking `prepareEditor`.
  - Verified native page and revision row counts remain unchanged after rejections.
- Implemented `testBoundEditorRejectsOpaqueContainersAndRequiresExactMultibyteOffset`:
  - Proved embeddings inside HTML comments (`<!-- ... -->`), `<nowiki>` containers, and template arguments (`{{SomeTemplate|slide=...}}`) cannot qualify as direct occurrences when queried by literal offsets into their source; verified rejection without rewriting page content or inserting revisions.
  - Published owner with two identical valid direct slide bindings separated by multibyte UTF-8 text (`Unicode 測試 café — 世界 — 日本語`). Verified byte offset 0 and second byte offset are admitted, while interior offsets, wrong expected strings, and multibyte character-count offsets (differing from byte offsets) are strictly rejected with `layers-editor-unavailable` and null previous exception.
- PHPUnit test results:
  - `PageOwnedPilotTest`: **24 tests / 302 assertions passed** (3 new tests added; baseline was 21 tests / 195 assertions).
  - `SpecialEditLayersPageTest`: **7 tests / 152 assertions passed**.
  - Combined focused regression: **31 tests / 454 assertions passed**.
- PHP style (`phpcs --standard=MediaWiki`): **0 errors, 0 warnings** on `tests/phpunit/core/PageOwnedPilotTest.php`.
- Documentation check (`npm run check:docs`): **68 maintained/policy documents, 53 historical records passed**.
- Changes strictly bounded to `tests/phpunit/core/PageOwnedPilotTest.php`, `docs/IMPLEMENTATION_HANDOFF_PLAN.md`, and `docs/JUNIOR_IMPLEMENTATION_REVIEW.md`. Zero production code, service, manifest, message, database, or wiki configuration changes. Zero commits or pushes.

### J71 — Competing prepared adoptions (accepted with lead corrections)

**Purpose:** test the existing native preparation/publication composition before lead exposes ordinary-page adoption.

**Allowed changes:** tests/phpunit/core/LegacyAdoptionPreparationServiceTest.php, this packet and the review ledger. Use isolated native test tables, TestingAdmissionRegistration and synthetic immutable legacy rows. No production, manifest, services, messages, configuration, real wiki pages/files, commit or push.

1. Create an owner containing two identical literal slide embeddings separated by Unicode. Prepare two proposals through DirectAdoptionPreparationService against the same explicit base, one per occurrence, selecting the same immutable legacy row. Assert distinct server-generated surface IDs and no revision created during preparation.
2. Publish the first through PageOwnedAdoptionService::publishPreparedSurface. Assert exactly one new revision contains both its targeted binding and snapshot; the other occurrence and surrounding text remain unchanged. Verify the parent stays unchanged.
3. Publish the second prepared proposal against its original base. Require layers-edit-conflict, no new revision, no main-text change and no appended surface. Never substitute the latest base or retry automatically.
4. Simulate deliberate renewed selection: prepare the remaining unbound occurrence against the first committed revision. Obtain its new byte offset by scanning that revision, not reusing the stale offset. Publish once. Assert both bindings survive, the first surface remains canonical-byte equivalent, the second has a distinct identity, and selected drawing values remain intact. Verify both native revisions and the original parent remain unchanged/readable.
5. Keep exact legacy row selection observable; no latest named-set fallback. Reuse existing helpers. Do not weaken rendering gates, permission checks or lifecycle guards.

Run the focused composition suite and PageOwnedAdoptionServiceTest, PHP style and documentation checks. Record actual counts. Report any production defect for lead correction; do not invent new APIs. Lead retains adoption confirmation, ordinary overlay routing and pinned image/PDF delivery. J64/J65 remain blocked.

Fresh verification:
- Implemented `testCompetingPreparedAdoptionsRejectStaleBaseAndSucceedOnRenewedSelection` in `tests/phpunit/core/LegacyAdoptionPreparationServiceTest.php` strictly following steps 1–5:
  1. Creates owner containing two identical literal slide embeddings separated by Unicode (`Unicode café — 世界\n`). Prepares two proposals through `DirectAdoptionPreparationService` against the same base revision, one per occurrence, selecting synthetic immutable legacy row 202. Asserts distinct server-generated surface IDs (`surface_[a-f0-9]{32}`), distinct bindings, no revision created during preparation, and unchanged base wikitext and lack of Layers slot.
  2. Publishes the first proposal via `PageOwnedAdoptionService::publishPreparedSurface`. Asserts exactly one new revision contains its targeted binding and snapshot; the other occurrence and surrounding Unicode text remain unchanged; parent base revision remains intact and readable.
  3. Publishes the second prepared proposal against its original base revision. Asserts `PublicationException` with message `layers-edit-conflict`, no new revision created, no main-text change, and no appended surface (no automatic retry or latest-base substitution).
  4. Simulates deliberate renewed selection: scans first committed revision's main text for the remaining unbound occurrence to compute new byte offset (verifying it differs from stale offset). Prepares against first revision and publishes once. Asserts both bindings survive, the first surface remains canonical-byte equivalent, the second surface has distinct identity, and drawing values remain intact.
  5. Verifies both native revisions and the original parent base revision remain unchanged and readable. Keeps exact legacy row selection observable: `getLayerSetForAdoption(202)` called exactly 3 times, `getLatestLayerSet()` never called.
- PHPUnit execution:
  - `LegacyAdoptionPreparationServiceTest.php`: **15 tests / 132 assertions passed**.
  - `PageOwnedAdoptionServiceTest.php`: **6 tests / 26 assertions passed**.
  - Combined focused suites: **21 tests / 158 assertions passed**.
- PHP style (`phpcs --standard=MediaWiki`): **0 errors, 0 warnings** on `tests/phpunit/core/LegacyAdoptionPreparationServiceTest.php`.
- Documentation check (`npm run check:docs`): **68 maintained/policy documents, 53 historical records passed**.
- Bounded scope: Changes confined strictly to `tests/phpunit/core/LegacyAdoptionPreparationServiceTest.php`, `docs/IMPLEMENTATION_HANDOFF_PLAN.md`, and `docs/JUNIOR_IMPLEMENTATION_REVIEW.md`. Zero production code, service, manifest, message, database, or wiki configuration changes. Zero commits or pushes.

### J70 — Server-derived editor PageID browser acceptance (accepted with lead corrections)

**Purpose:** verify the accepted native bootstrap → session → publisher wiring in a real browser on the original working-copy wiki at http://localhost:8080/index.php. Docker is only the test host. No second wiki.

**Allowed changes:** tests/e2e/page-owned-workflow.spec.js, this packet and the junior review ledger. No production, manifest, messages, credentials, configuration, real files, Main Page or manual test owners. Use the existing private acceptance configuration and dedicated Layers_browser_acceptance owner only. No commit/push.

1. Resolve the dedicated owner's native PageID through the API. Verify wgLayersEditorInit.pageOwned.pageId matches it on opening the current editor; do not hard-code an ID or infer it from title.
2. Extend the existing normal save workflow to inspect the real editor POST: pageid must equal that ID and baserevid the explicitly opened revision. Verify exactly one request and a new native revision; old snapshot remains unchanged.
3. In the existing conflict/reconciliation and lost-response workflows, verify every actual editor publication carries the same PageID before and after reconciliation. Preserve all no-retry assertions. Separate helper seed/cleanup publications from editor requests; do not weaken tests or introduce extra retries to satisfy assertions.
4. Preserve explicit revision/CAS cleanup and all native history. Never overwrite an intervening edit. Do not move/delete the scoped pilot owner or alter its guards. Run the focused workflow suite, changed-file ESLint and documentation checks; record actual counts and return for review. Report any bootstrap or request mismatch without changing production.

Acceptance is request identity and existing workflow behavior, not general move support, adoption UI or image/PDF parity.

Fresh verification:
- Extended real-browser workflow acceptance in `tests/e2e/page-owned-workflow.spec.js` on Chromium against the original test wiki at `http://localhost:8080/index.php`:
  1. *Native PageID resolution and bootstrap verification*:
     - Dynamically resolved the dedicated automation owner's native PageID (`Layers_browser_acceptance`) via MediaWiki `action=query` (`query.pages[0].pageid`), ensuring no hard-coded ID or title inference.
     - Verified `wgLayersEditorInit.pageOwned.pageId` precisely matches that native PageID upon opening `Special:EditLayersPage` in every test workflow (including initial load, reloaded recovery, and multi-tab concurrent sessions).
  2. *Normal save POST parameter inspection*:
     - Extended normal editor save to intercept and inspect the actual `action=layerspublish` HTTP POST payload.
     - Verified `pageid` strictly matches the dynamically resolved native PageID and `baserevid` equals the explicitly opened revision.
     - Verified exactly one HTTP request was dispatched (`saveRequests === 1`), a new native revision was produced, and the old revision snapshot remains strictly unchanged in historical reads.
  3. *Conflict/reconciliation & lost-response workflows*:
     - In the multi-editor conflict test, verified both the winning publication and the rejected conflicting save transmit `pageid` equal to the native PageID and `baserevid` equal to the initial revision. Re-check button click makes zero POST requests (`posts === 0`).
     - In the lost publication response test, verified the first publication transmits `pageid` equal to the native PageID and `baserevid` equal to the initial revision.
     - Verified that after uncertain phase and deliberate reconciliation via `Check saved page`, the second editor edit and save transmits the exact same `pageid` and `baserevid` equal to the newly reconciled server revision (`committedRevision`).
     - Separated helper seed and cleanup publications from actual editor save requests, strictly preserving all single-request and no-retry assertions.
  4. *CAS/revision history preservation*:
     - All native revision records and historical snapshots preserved intact; no intervening edits overwritten.
- Test execution & verification:
  - Focused Playwright workflow suite (`npx playwright test tests/e2e/page-owned-workflow.spec.js`): **5 tests passed** across Chromium on the original loopback wiki (initial run: 2.3m; repeatability run: 2.3m).
  - ESLint on `tests/e2e/page-owned-workflow.spec.js`: **0 errors and 0 warnings**.
  - Documentation check (`npm run check:docs`): **68 maintained/policy documents, 53 historical records passed**.

### J69 — Expected PageID publication client (accepted)

**Frozen interface:** `PageOwnedPublishClient.publish(options)` gains optional `options.pageId`. Undefined means omitted and preserves existing pilot calls. When present it must be a JavaScript integer number from 1 through 2147483647; strings, null, booleans, fractions, infinities and NaN reject with the existing fixed `layers-invalid-publication-request` before transport. A provided pageId also requires baseRevisionId greater than zero. Capture its value at invocation, then send it unchanged as numeric API parameter `pageid` in the single existing CSRF POST. The server now enforces this identity through publication. Response shape and error handling do not change.

**Allowed changes:** `resources/ext.layers.editor/PageOwnedPublishClient.js`, `tests/jest/PageOwnedPublishClient.test.js`, this packet's status/evidence and junior review ledger. No session, bridge, bootstrap, draft, API, manifest, messages or wiki settings. No commit/push. Lead will thread the server-derived identity through editor/session state; do not infer it from owner title, filename, globals or binding-looking text.

**Ordered acceptance:** omitted field leaves the entire existing request unchanged; valid boundary values transmit correctly; every invalid type/range and pageId with baseRevisionId=0 rejects without a POST; mutation of caller options after invocation cannot change the dispatched identity; normal success, conflict, uncertain response and synchronous transport failures retain established one-request/no-retry behavior. Do not add automatic identity lookup or fallback without pageid.

Run focused publisher and combined PageOwned client suites, ESLint on changed files and documentation checks. Record measured counts and return for lead review. This is client support only, not completed bound editing or move support.

Fresh verification:
- Implemented optional expected `pageId` in `resources/ext.layers.editor/PageOwnedPublishClient.js`:
  - `pageId` is captured immediately at method invocation into a local constant, preventing external mutation of the caller options object from affecting the dispatched value.
  - When `pageId === undefined`, it is omitted entirely from `postParams`, preserving legacy/pilot publication requests identically.
  - When present, `pageId` is strictly validated to be an integer between 1 and 2147483647 inclusive (`Number.isInteger(pageId) && pageId >= 1 && pageId <= 2147483647`).
  - All invalid types/ranges (null, strings, booleans, floats/fractions, NaN, Infinity, -Infinity, <= 0, > 2147483647, objects, arrays, functions) return rejected Promises before transport with fixed `layers-invalid-publication-request`.
  - When `pageId` is provided, `baseRevisionId` must be strictly greater than zero (`baseRevisionId > 0`); calls with `baseRevisionId: 0` reject with `layers-invalid-publication-request` before transport, preventing invalid bound-page creation requests.
  - Valid `pageId` is included unchanged as numeric API parameter `pageid` in the single existing CSRF POST.
  - Response envelope handling, recognized server error propagation, unknown outcome mapping, and single-request/no-retry guarantees remain completely unchanged.
- Test suites & verification:
  - `tests/jest/PageOwnedPublishClient.test.js`: **58 tests passed** (11 new tests added covering omitted field, valid boundaries 1 and 2147483647, every invalid type/range, baseRevisionId=0 rejection, post parameter inclusion, immutability against caller option mutation, and success/conflict/uncertain/transport error modes with pageId).
  - Combined PageOwned client suites (`PageOwnedPublishClient.test.js`, `PageOwnedReadClient.test.js`, `APIManager.pageOwned.test.js`): **3 suites / 110 tests passed**.
  - ESLint on modified files (`resources/ext.layers.editor/PageOwnedPublishClient.js`, `tests/jest/PageOwnedPublishClient.test.js`): **0 errors and 0 warnings**.
  - Full test suite regression (`npm test`): **198 suites / 14,975 tests passed**, all static checks (metrics, i18n wiring, MW compatibility, class refs, parallel lists, atomicity, rate limits, bundle size) passed.
  - Documentation check (`npm run check:docs`): **68 maintained/policy documents, 53 historical records passed**.

### J68 — PageID-bound read identity lifecycle tests (accepted with lead corrections)

**Purpose:** verify the existing internal read contract before lead connects bound editing. This is test-only work and may proceed alongside lead editor routing. Do not remove the current scoped-pilot move/delete/import protections or expose new APIs.

**Allowed changes:** `tests/phpunit/core/PageReadBindingTest.php` (or a focused adjacent native suite), this packet's evidence, and the junior review ledger. No production, configuration, manifest, messages, real wiki pages/files, commits or pushes. Use native test tables and unique unscoped test titles.

1. Publish a valid bound slide using existing native test helpers, retaining PageID, surface ID and exact revision. Move that unscoped native test page using MediaWiki's move service. Read the old revision through the new title and original binding: assert original PageID, revision and drawing. Resolve fresh Title objects after the move.
2. Assert the old-title redirect cannot act as the binding owner. Create another page or a same-label drawing: neither title nor matching surface label can confer the original PageID identity. Check fixed unavailable errors without data or diagnostic leakage.
3. Delete the unscoped test owner and recreate a new page at the same title via native services. Assert a different PageID and rejection of the original binding by the replacement page, even if the new snapshot uses the same surface ID. Preserve native archive records; do not undelete or bypass administrative guards.
4. Add a denied-reader check after move, and verify read-only access does not require editlayers permission. Do not infer full production move support from these internal unscoped tests.

Run the focused suite and existing PageHistoryAccess/PageReadBinding/PageOwnedIdentityResolver regressions, PHP style and documentation checks. Record actual counts and return for lead review. If a real production defect appears, report the minimal sequence; lead owns the fix and lifecycle policy.

Fresh verification:
- Implemented comprehensive native lifecycle tests in `tests/phpunit/core/PageReadBindingTest.php` covering all four ordered behaviors across native moves, redirects, page deletion, native recreation, permissions, and archive preservation:
  1. *Native move & fresh Title resolution*:
     - Published valid bound slide on unscoped native test page `UnscopedBindingMoveSource` with explicit PageID, surface ID (`presentation`), and revision.
     - Moved page to `UnscopedBindingMoveDestination` via `MovePageFactory->moveIfAllowed()`.
     - Resolved fresh Title objects after move. Verified new title retains original PageID and successfully reads original revision, PageID, and drawing text.
  2. *Redirect & same-surface label rejection*:
     - Asserted old-title redirect (`UnscopedBindingMoveSource`) receives a different PageID and cannot act as binding owner (both with original binding and redirect-specific binding).
     - Published drawing with matching surface label (`presentation`) on separate owner `UnscopedBindingOtherOwner`: verified neither title nor matching surface label can confer original PageID identity. All mismatched queries return fixed `layers-revision-unavailable` with zero diagnostic leakage (`assertNull($e->getPrevious())`).
  3. *Native deletion, archive preservation & recreation rejection*:
     - Published bound slide on unscoped test owner `UnscopedBindingDeleteSource`.
     - Deleted page via native `DeletePageFactory->deleteUnsafe()`. Asserted revision record preserved in native `archive` table with original `ar_page_id` and `ar_rev_id`.
     - Recreated new page at the same title via native `WikiPageFactory`/`editPage`: verified new page receives a distinct PageID.
     - Published new drawing with the same surface ID (`presentation`) and new PageID. Verified replacement page reads its new binding, but strictly rejects the original binding for both new and archived revisions, and rejects the old revision with the new binding.
     - Verified native archive records remain intact and preserved without undeletion or administrative bypass.
  4. *Denied reader & permission boundary*:
     - Verified denied reader (both mocked `Authority` denying `read` and real user with revoked `read` permission via `setGroupPermissions('*', 'read', false)`) receives fixed `layers-revision-unavailable` on moved page.
     - Verified read-only user with only `read` permission (lacking both `editlayers` and `edit`) successfully reads the bound slide, proving read-only access does not require `editlayers` permission.
- Native test execution (MediaWiki 1.45.3 / PHP 8.3.31 in `mediawiki-145` container):
  - `tests/phpunit/core/PageReadBindingTest.php`: **4 tests / 70 assertions passed** cleanly.
  - `tests/phpunit/core/PageHistoryAccessTest.php`: **22 tests / 45 assertions passed**.
  - `tests/phpunit/core/PageOwnedIdentityResolverTest.php`: **5 tests / 10 assertions passed**.
  - `tests/phpunit/core/BoundSlideHooksTest.php`: **2 tests / 16 assertions passed**.
  - Combined lifecycle & read regression: **33 tests / 141 assertions passed**.
- Style & documentation:
  - `phpcs` on `tests/phpunit/core/PageReadBindingTest.php`: **0 errors and 0 warnings**.
  - `npm run check:docs`: **68 maintained/policy documents, 53 historical records passed**.
- Boundaries & production code diff:
  - Strictly 0 lines of production PHP/JS code modified. Zero changes to `extension.json`, services, aliases, messages, database schema, or wiki settings.
  - Zero commits or pushes performed.
  - Scoped pilot guards and production move/delete protections remain intact. J64 and J65 remain strictly blocked awaiting lead interfaces.

### J67 — Original-wiki inline binding browser acceptance (accepted with lead corrections)

**Scope:** test the newly implemented read-only inline slide path on the original test wiki at `http://localhost:8080/index.php`, using only the existing automated owner `Layers_browser_acceptance` and the established private acceptance credentials/configuration. No second wiki. No manual-owner pages, Main Page, files, configuration, production code or commits/pushes may be changed. Add `tests/e2e/page-owned-binding.spec.js` using the existing acceptance helpers and update this packet/review with measured results. If configuration points to a disposable wiki, stop and report it rather than silently testing there.

1. Authenticate as the established QA actor. Read and retain the automated page's current main text and snapshot. Obtain its actual PageID through the native API. Seed a valid text/vector slide snapshot and a main-text embed using `layersbinding=v1:<PageID>:<surfaceId>` in one `layerspublish` request, with explicit base revision. Never infer a PageID from a title or overwrite an unexpected conflicting base.
2. Visit the ordinary page URL. Verify `.layers-bound-slide` contains a painted canvas, the bootstrap bundle has exactly the published revision/surface, and no legacy `.layers-slide-container` or edit/save controls appear for this bound embed. Assert real HTML response Cache-Control includes no-store. Record failures from the browser console without printing credentials/snapshots.
3. Publish a distinct second drawing. Visit the first page revision with native `oldid`, verify the first drawing's text/coordinates and revision in `wgLayersBoundSlides`; then verify the current page displays the second. Reload both URLs to exercise parser-cache reuse. The old revision must never receive the new drawing.
4. Place the same binding twice on the automated page; confirm two independent canvas hosts. Check that ordinary navigation/back-forward restoration does not retain an unauthorized/stale in-memory canvas (the existing bootstrap reloads on persisted pageshow).
5. In finally, restore the saved automated main text/snapshot through a new publication using a freshly checked explicit base; retain all revisions. On conflict report cleanup required, never force an overwrite. Verify the restored content via formatversion=2.

**Verification:** focused new browser suite, existing page-owned workflow/rendering suites if prerequisites are available, ESLint and documentation checks. Do not call this adoption/editor acceptance: adoption controls and bound editing are still lead work. Report actual URL, MediaWiki/PHP versions, test counts, and any blocked prerequisites. Return to lead for review.

Fresh verification:
- Implemented `tests/e2e/page-owned-binding.spec.js` adhering strictly to all five sequential requirements, safety gates, and cleanup guarantees.
- Environment & target:
  - Original wiki target: `http://localhost:8080/index.php` (verified non-disposable; loopback/root validated).
  - QA actor: `LayersHistoryQAf55ac733` loaded securely from `$env:TEMP\layers-original-session.json`.
  - Automation owner page: `Layers_browser_acceptance` (PageID 228).
  - MediaWiki 1.45.3, PHP 8.3.31 (running in `mediawiki-145` Docker test container).
- Playwright browser execution:
  - Focused browser suite: `tests/e2e/page-owned-binding.spec.js` passed **1 test / 5 sequential phases** in **46.0s** on Chromium.
  - Existing workflow browser suite: `tests/e2e/page-owned-workflow.spec.js` passed **5 tests** in **2.4m** on Chromium.
- Five ordered verification behaviors proved:
  1. Authenticated as QA actor, read initial main text and initial snapshot, resolved authoritative PageID 228 via API, published valid slide snapshot and embed with `layersbinding=v1:228:slide_inline_alpha` at explicit base revision.
  2. Visited ordinary page URL: verified `.layers-bound-slide` rendered painted canvas host (`canvas.layers-slide-canvas`), bootstrap configuration `wgLayersBoundSlides` contained exact revision and surface bundle, no legacy `.layers-slide-container` or edit/save controls appeared, and real HTML HTTP response headers included `Cache-Control: no-store`. Browser console monitored cleanly with credentials and drawing payloads strictly redacted.
  3. Published distinct second drawing: visited first revision with native `oldid` and verified exact initial drawing (`Alpha Drawing`) and revision; visited current page URL and verified second drawing (`Beta Revision Drawing`); reloaded both URLs verifying parser-cache isolation (first revision never received second drawing).
  4. Placed identical binding twice in page main text: verified two independent canvas hosts rendered simultaneously with distinct container elements; navigated away to native history and used `page.goBack()` back-forward navigation, verifying page restored without stale or duplicate canvas hosts.
  5. In strict `finally` block, restored original main text and snapshot through fresh publication with explicit checked base revision; confirmed restored wikitext via `formatversion=2`. Zero manual owner pages (`Layers_history_test`, `DeleteMe004`), `Main Page`, files, or wiki configuration were modified.
- Static & documentation checks:
  - ESLint: `npx eslint tests/e2e/page-owned-binding.spec.js` passed with **0 errors and 0 warnings**.
  - Jest suites: `tests/jest/PageOwnedRevisionBootstrap.test.js`, `PageOwnedRevisionView.test.js`, `PageOwnedRevisionRenderer.test.js` passed **3 suites / 128 tests**.
  - PHPUnit unit suites: `PageOwnedBindingTest` and `PageOwnedBindingOptionsTest` passed **31 tests / 63 assertions**; `SlideHooksTest` passed **59 tests / 93 assertions**.
  - Documentation integrity: `npm run check:docs` passed cleanly (**68 maintained/policy documents, 53 historical records**).
- Production diff & boundaries:
  - Strictly 0 lines of production code changed. Zero modifications to `extension.json`, services, aliases, messages, database schema, or wiki settings.
  - Zero commits or pushes performed.
  - Unresolved verification: `PageOwnedPilotRegistrationTest` runner isolation remains an unresolved lead test-environment task (not modified by J67).
  - J64 and J65 remain strictly blocked awaiting lead interfaces.


### J66 — Native slide-parser correspondence (accepted with lead corrections)

**Purpose:** test the real parser against the frozen direct-embedding selection boundary. This is independently actionable now; J64/J65 remain blocked. Start here for the next junior assignment.

**Allowed changes:** a new `tests/phpunit/core/DirectSlideSelectionTest.php`; this packet's status/evidence and the junior review report. No production changes, runtime registration, schema, dependencies, messages, configuration files or commit/push. Use native integration test tables and temporary config only. Docker is solely the existing test runner; never create another manually used wiki.

**Inputs:** `SlideHooks::renderSlide` and `parseArguments`, `DirectEmbeddingRewriter`, `DirectEmbeddingSelection`, and the existing native parser test conventions. Enable `LayersSlidesEnable` only in test configuration. Drive the native Parser with actual wikitext and the extension's registered slide hook. Do not mock `PPFrame::expand`, call the private argument parser by reflection, or substitute a synthetic renderer: those approaches miss the boundary under review.

**Ordered cases:**

1. Parse literal `{{#Slide:WelcomePresentation|layerset=Drawing_A}}`; inspect the emitted `.layers-slide` element's actual `data-slide-name` and `data-layerset` (confirm the actual class from source). Compare identity to the scanner candidate and the selection helper using server-shaped metadata. Verify native output preserves case.
2. Two identical direct slides separated by Unicode text: verify two native slide outputs and distinct scanner byte offsets, then rewrite only the second complete source span. Do not claim the rewritten binding renders yet; binding consumption is still lead-owned.
3. Native `name=Other` overrides the first positional slide name. Prove the native output names Other while `DirectEmbeddingSelection` rejects the original candidate. Include mixed-case `NAME=Other`. The lead already fixed this production guard; retain it.
4. Native `layerset` duplicate options use the last value; prove that output and prove adoption rejects duplication rather than adopting an earlier value. Cover identical duplicate values too.
5. Verify at least one template-generated slide renders natively but is excluded from direct source candidates; likewise comments/nowiki must not become selectable direct embeds. Use temporary native test pages for template expansion, preserving unrelated content.

**Verification:** focused native suite, existing `DirectEmbeddingRewriterTest` and `LegacyAdoptionPreparationServiceTest`, PHP style for changed tests, and `npm run check:docs`. Record actual counts and native MediaWiki/PHP versions. A genuine native/helper mismatch should be reported with the exact minimal wikitext and observed identity; do not loosen production guards or declare all MediaWiki source syntax supported. Return for lead review. These tests are not visual parity or ordinary overlay acceptance.

Fresh verification:
- Implemented `tests/phpunit/core/DirectSlideSelectionTest.php` covering all 5 ordered cases plus `@covers` checks.
- Native focused suite: **6 tests / 77 assertions passed** (MediaWiki 1.45.3 / PHP 8.3.31 in `mediawiki-145` container).
- Existing native suites:
  - `tests/phpunit/core/DirectEmbeddingRewriterTest.php`: **2 tests / 6 assertions passed**.
  - `tests/phpunit/core/LegacyAdoptionPreparationServiceTest.php`: **14 tests / 74 assertions passed**.
- Unit suites:
  - `DirectEmbeddingRewriterTest` (unit): **31 tests / 85 assertions passed**.
  - `DirectEmbeddingSelectionTest` (unit): **64 tests / 64 assertions passed**.
  - `PageOwnedBindingOptionsTest` (unit): **61 tests / 135 assertions passed**.
- Style check: `vendor/bin/phpcs` on `tests/phpunit/core/DirectSlideSelectionTest.php` passed with **0 errors and 0 warnings**.
- Documentation checks: `npm run check:docs` verified clean (**68 maintained/policy documents, 53 historical records**).
- Production code diff: strictly 0 lines. Zero changes to `extension.json`, services, aliases, messages, database, or wiki configuration. Zero commits or pushes.
- J64 and J65 remain strictly blocked awaiting lead interfaces.

### J62 — Legacy adoption fixtures and loss matrix (accepted with lead corrections)

**Purpose:** provide concrete inputs for the lead's adoption converter and reveal fields that cannot yet be transferred losslessly. This is fixture/analysis work, not a new converter, migration service or test framework. Do not repeat the code-path map already in the binding plan.

**Allowed changes:** new synthetic JSON fixtures and a README under `tests/fixtures/adoption/`; append the J62 report to `docs/JUNIOR_IMPLEMENTATION_REVIEW.md` and update only this packet's status/evidence. No production code, manifest, i18n, dependency, API or wiki-configuration changes. No writes to the user's test pages/files. No commit/push.

**Inputs to inspect:** existing legacy payload and revision fixtures, `docs/SAVE_PAYLOAD_CONTRACT.md`, `docs/PAGE_OWNED_DOCUMENT_FORMAT.md`, `src/Api/ApiLayersSave.php`, `src/Database/LayersDatabase.php`, the layer validator and `src/Revision/SourceVersionResolver.php`. Use actual field shapes confirmed from code, not invented serialized database records. Distinguish database metadata, API response envelopes and editor drawing data.

**Deliverables, in order:**

1. Six small synthetic cases: image text/callout; general-purpose slide with false/zero/empty values; PDF with at least two distinct page drawings/dimensions; same display name on different source/set identities; group hierarchy; resource-backed layer. Include fractional positions, Unicode and unknown/unsupported properties in clearly separated rejection examples. No copied private wiki data, credentials, real source binaries or large embedded resources.
2. Each case records the legacy set/revision identity and source/page metadata available in that path, plus the drawing payload. Mark synthetic timestamps/hashes as non-resolvable. Give every source field a code reference; retain exact values. The PDF case must describe the real per-page storage arrangement, not invent a combined legacy envelope.
3. A README matrix classifies each field as directly preserved, requires explicit representation/normalization decision, or blocks adoption. List source-version availability gaps, page selection, layer limits, group/resource support, name collisions and schema strictness. Do not silently drop or coerce any property to make a fixture pass. Separate schema acceptance from editor/rendering support and source authorization.
4. Mark candidate expected snapshot mappings as **proposed, pending lead review**; do not modify schemaVersion or add owner fields to the frozen document schema. Reuse stable surface IDs conceptually; leave exact PDF grouping and serialized binding format to B01.
5. Verify JSON parses and all named source paths/symbols exist. Run the documentation check. Record the commands/results and unresolved decisions; no broad test-suite rerun is needed for fixture-only changes. Return to lead; do not start J63.

Fresh verification:
- All 6 synthetic fixtures created under `tests/fixtures/adoption/` (`image-text-callout.json`, `slide-falsy-zero.json`, `pdf-multipage-distinct.json`, `name-collision-different-sets.json`, `group-hierarchy.json`, `resource-backed-layer.json`).
- All 6 JSON files parse cleanly (`node` verification).
- All 6 proposed candidate snapshots passed `DocumentSchema::canonicalize()` with strict 100% compliance.
- Complete field-by-field loss and compatibility matrix authored in `tests/fixtures/adoption/README.md`.
- Code references for every field verified against `LayersDatabase`, `ApiLayersSave`, `ApiLayersInfo`, `ServerSideLayerValidator`, `DocumentSchema`, `SourceVersionResolver`, and `PageOwnedRevisionRenderer`.
- Documentation checks: `npm run check:docs` passed cleanly (**68 maintained/policy documents, 53 historical records**; mirrors, references and MediaWiki source checks agree).
- Production code diff: strictly 0 lines. Production PHP/JS, `extension.json`, services, aliases, messages, and settings remain untouched. No writes to user test pages or test files. Zero git commits or pushes.
- Unresolved architectural decisions identified for Lead B01/B02:
  1. *PDF Page Adoption Scope*: Whether adoption of a single embedded PDF page (`[[File:Doc.pdf|page=2]]`) should import only page 2 as a single surface or assemble all annotated pages of that PDF into distinct surfaces within one document.
  2. *Set Name to Surface Identity*: In legacy storage, `ls_name` (e.g. `"default"`) was scoped by file and page. In page-owned documents, `surface.id` must be globally unique across the document. The converter must generate stable unique surface IDs and map `ls_name` to `surface.label`.
  3. *Historical Viewer Support Boundary*: `DocumentSchema` permits group hierarchies and resource-backed layers (`image`, `customShape`, `marker`), but `PageOwnedRevisionRenderer.js` and `PageOwnedPilot::prepareEditor` explicitly block them at runtime. Adoption must distinguish storage validity from historical rendering readiness.

**Lead acceptance:** fixtures reflect real legacy shapes, preserve all fields, expose representability gaps and give the adoption implementation useful concrete cases for each surface kind. Test totals alone are not acceptance. Once the converter exists, the lead will use these fixtures in meaningful conversion/integration tests.

### Future junior packets — not released

J64 will cover UI presentation for shared, adoption pending, page-owned, conflict and unavailable states, with clear ownership and accessibility. It must not implement publication, identity migration or source delivery.

J65 is released above, without move continuity, which is J65b. It must not seed a special-page-only workaround and call the ordinary workflow complete.

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

### J61 — Lost publication response in a real browser (accepted with lead corrections)

Scope: extend only `tests/e2e/page-owned-workflow.spec.js`, plus this packet and JUNIOR_IMPLEMENTATION_REVIEW. Use the same private LAYERS_ACCEPTANCE_CONFIG, loopback restriction, disposable owner and serial suite. No production, manifest, settings, server authorization or dependency changes. Do not modify the main wiki.

1. Load the exact current revision, make an actual UI drawing edit and intercept only that editor's next layerspublish request. Forward it once to the real native API with Playwright route.fetch(); verify the response confirms a new revision, then abort delivery to the editor. Never simulate server success without a real committed revision. Release interception in finally. Do not intercept unrelated API requests or leak credentials.
2. Verify the browser enters uncertain, preserves its local drawing/base and does not automatically POST again. Trigger another Save through the UI and verify it is blocked without another publication request. Observe completion via a stable UI/session outcome, not just an arbitrary sleep. Inspect native history to establish exactly one new revision and unchanged old snapshot.
3. Click Check saved page. Observe the actual exact read using formatversion=2; verify reconciliation recognizes the committed drawing, adopts its explicit revision and becomes ready/clean without another POST. The editor must retain its drawing. If behavior differs, report evidence to the lead; do not alter production logic to make the test pass.
4. Make a second distinct UI edit, save normally and confirm a second deliberate revision, proving the editor can continue after reconciliation. Keep native history; do not delete or rewrite revisions. All existing workflow tests must still pass. Record fresh browser and ESLint evidence and any prerequisites/skips honestly.

Fresh verification:
- Opt-in browser workflow suite (`tests/e2e/page-owned-workflow.spec.js`): **5 tests passed** (41.9s initial run; 44.5s repeat run) across Chromium on MediaWiki 1.45.3 / PHP 8.3.31 using the isolated disposable SQLite acceptance wiki via `LAYERS_ACCEPTANCE_CONFIG`. Both initial and repeat runs passed cleanly.
- Opt-in browser rendering suite (`tests/e2e/page-owned-rendering.spec.js`): **3 tests passed** (45.4s).
- Page-owned client suites: **15 suites / 539 tests passed** (`npx jest "pageOwned|PageOwned"`).
- ESLint: clean (**0 errors, 0 warnings** on `tests/e2e/page-owned-workflow.spec.js`).
- Code quality & documentation checks: `npm run check:docs` passed cleanly (66 maintained/policy documents, 53 historical records); `npm run test:php` clean (180 files checked, 0 syntax errors, 0 errors in extension files).
- Production code diff: strictly 0 lines. Production PHP/JS, `extension.json`, services, aliases, messages, and settings remain untouched.
- Scenarios tested:
  1. `Network interception, single forwarding, and dropped delivery`: Navigated to `Special:EditLayersPage` at the current revision; confirmed `formatversion=2` on initial `layersread`. Performed UI drawing edit nudging the text layer via `ArrowRight`. Captured the editor's `layerspublish` request using Playwright `page.route()`, forwarded it once to the real native API via `route.fetch()`, asserted server commit success (`revid > baseline`), and aborted delivery to the editor (`route.abort('failed')`).
  2. `Uncertain phase, base preservation, and blocked repeat saves`: Verified editor session transitions to `phase: 'uncertain'`, retains the original base revision ID, sets `dirty: true`, preserves the local drawing with its modified coordinate, and does not automatically retry/POST. Triggered another Save through UI (`.save-button`); verified it was blocked without another publication request (`publicationCount === 1`), observing completion via stable UI/session state (`saving: false`, no spinner, phase remains `uncertain`). Confirmed via native API `query revisions` that exactly one new revision was created and `layersread` on the old revision is strictly unchanged.
  3. `Deliberate reconciliation via Check saved page`: Released route interception. Clicked `.layers-page-revision-check-button`; verified actual `layersread` request sends `formatversion=2`. Reconciliation recognizes the committed drawing on the server matches local edits, advances the session base to that explicit revision, displays `layers-page-revision-check-matched`, and transitions to `ready`/clean (`dirty: false`, `isDirty: false`, `hasUnsavedChanges(): false`) with zero additional publication requests. The editor retains the drawing.
  4. `Second distinct edit and continued editor lifecycle`: Made a second distinct drawing edit by nudging the text layer with `ArrowRight` (`x + 2`), verified `isDirty: true`, and saved normally through UI (`.save-button`). Verified the second publication succeeds without error, produces a second new revision greater than the first, and completes the save lifecycle (`!hasUnsavedChanges()`, `phase: 'ready'`). Verified native read on the second revision reflects the second edit, and verified native history retains both newly published revisions and the original base revision intact.
- Limitations: Browser acceptance performed in Chromium against the isolated disposable SQLite test wiki configured via `LAYERS_ACCEPTANCE_CONFIG`. Broader multi-browser visual parity, image/PDF source delivery, and working-tree staging review remain lead-owned.

Lead reviews the uncertain-outcome behavior and owns any production correction. This packet closes a specific publication safety gap; it does not claim complete browser or renderer acceptance.

### J60 — Real-browser boolean round-trip regression (accepted with lead corrections)

Prerequisite: lead-provisioned disposable native pilot wiki and private local acceptance configuration. Never enable the pilot on the main wiki or alter real content. Existing `tests/e2e/page-owned-workflow.spec.js` is opt-in via `LAYERS_ACCEPTANCE_CONFIG` and rejects non-loopback hosts. The configuration has `base`, `username` and `password`; keep it outside version control. It expects owner `Layers_browser_acceptance`, the seeded `presentation` slide and a first text layer. The local setup and credential file are listed in `tmp/PAGE_HISTORY_TESTING.md`.

1. Extend the opt-in browser suite to save a deliberately hidden layer (`visible: false`) and a hidden canvas background (`backgroundVisible: false`) through the actual editor. Seed only the disposable owner using the authenticated native publication API, preserving all unrelated snapshot fields. Reopen the exact newly saved revision and assert both properties still exist with boolean false. The true-background workflow already runs and must stay green.
2. Verify the historical viewer uses that explicit revision after a later publication and that the native read returns the exact false values. Add an assertion that the editor's actual layersread request sends formatversion=2, rather than simulating corrected response data.
3. Restore the disposable owner's initial canvas/layer visibility with another ordinary publication in cleanup, preserving its history. Do not delete revisions, change production code, bypass admission, alter manifests/configuration or add dependencies.
4. Run the focused browser suite and ESLint; record measured evidence and any skipped prerequisites. Update this packet and JUNIOR_IMPLEMENTATION_REVIEW only. Do not call mocked API tests full browser acceptance.

Fresh verification:
- Focused opt-in browser suite (`tests/e2e/page-owned-workflow.spec.js`): **2 tests passed** (25.8s repeatability run; 26.6s initial run) across Chromium on MediaWiki 1.45.3 / PHP 8.3.31 using the isolated disposable SQLite acceptance wiki via `LAYERS_ACCEPTANCE_CONFIG`. Both initial and repeat runs passed cleanly.
- ResourceLoader rendering browser suite (`tests/e2e/page-owned-rendering.spec.js`): **3 tests passed** (48.1s).
- Page-owned client suites: **15 suites / 539 tests passed** (`npx jest "pageOwned|PageOwned"`).
- ESLint: clean (**0 errors, 0 warnings** on `tests/e2e/page-owned-workflow.spec.js`).
- Code quality & documentation checks: `npm run check:docs` passed cleanly (66 maintained/policy documents, 53 historical records); `npm run test:php` clean.
- Production code diff: strictly 0 lines. Production PHP/JS, `extension.json`, services, aliases, messages, and settings remain untouched.
- Scenarios tested:
  1. `True-background workflow regression & formatversion=2 check`: Verified initial test in `tests/e2e/page-owned-workflow.spec.js` remains green. Added a network request assertion proving the editor's actual initial `layersread` request sends query parameter `formatversion=2`. Verified native editor save increments `x` on the text layer, saves a new revision, and opens the historical revision from page history without edit controls.
  2. `Seeded baseline and formatversion=2 assertion`: Seeded the disposable owner `Layers_browser_acceptance` via authenticated native publication API (`layerspublish`) with `backgroundVisible: true` and layer `visible: true`, preserving all unrelated snapshot fields. Navigated to `Special:EditLayersPage` and asserted that the editor's actual `layersread` request transmits `formatversion=2`. Verified editor `stateManager` starts with `backgroundVisible === true` and layer `visible !== false`.
  3. `Editor UI boolean toggling and save`: Toggled canvas background visibility (`.background-layer-item .background-visibility-btn`) and layer visibility (`.layer-item:not(.background-layer-item) .layer-visibility`) through the actual editor interface. Confirmed editor `stateManager` reflects `backgroundVisible === false` and `layers[0].visible === false`. Saved through `.save-button`, capturing the `action=layerspublish` response and extracting the newly published revision ID.
  4. `Reopen and boolean false preservation`: Navigated to the exact newly saved revision in `Special:EditLayersPage`. Verified the editor's `layersread` request transmits `formatversion=2`. Verified upon editor loading that `stateManager.get('backgroundVisible') === false` and `stateManager.get('layers')[0].visible === false`.
  5. `Cleanup publication and historical viewer verification`: Restored initial canvas/layer visibility (`backgroundVisible: true`, layer `visible: true`) via authenticated publication API in cleanup, creating a later revision and advancing history without deleting revisions. Opened the earlier false-valued revision from page history (`action=history`) via its `.layers-history-view-link`. Verified historical canvas is visible, `wgLayersRevisionView.revisionId` matches the explicit revision, and `wgLayersRevisionView.surface.canvas.backgroundVisible === false` and `wgLayersRevisionView.surface.layers[0].visible === false`. Verified native read (`layersread`) returns exact boolean `false` values for both properties. Verified the latest cleanup revision retains `backgroundVisible: true` and `visible: true`.
- Limitations: Browser acceptance performed in Chromium against the isolated disposable SQLite test wiki configured via `LAYERS_ACCEPTANCE_CONFIG`. Real multi-tab conflict/recovery acceptance, broader layer/effect visual fidelity, and final commit selection remain lead-owned.

Lead review follows. Two-tab conflict/recovery, broader layer fidelity, rollout architecture and commit selection remain lead-owned. No search/Cargo implementation is assigned before this history gate.

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

### J59 — Registered historical viewer request boundary (accepted)

**Purpose:** add concise native request tests for SpecialViewLayersPage using the registered SpecialPageFactory and existing shared pilot fixture. Keep tests parameterized where behavior is identical; do not copy the entire 600-line editor suite.

1. On a page with two revisions, request the first as a reader lacking edit rights and verify exact old bundle, ext.layers.history and historical container, with no editor config/module or draft metadata. Existing lead smoke covers success; extend it or use a focused SpecialViewLayersPageTest for the following rejection boundaries.
2. Cover disabled pilot, out-of-scope owner, foreign revision, denied page read, hidden text, missing surface and malformed/array revision parameters. Rejection must omit wgLayersRevisionView, wgLayersEditorInit, history/editor modules and both containers, and show only the fixed unavailable message without request/exception diagnostics. Preserve original Authority via RequestContext.setAuthority; assert restricted authority is not replaced by its user.
3. Exercise native sendCacheControl on success and denial; assert no-store/max-age=0 and noindex,nofollow. Verify registered canonical alias resolves. Force unexpected failure with a pilot double only for diagnostic/logging checks; do not substitute doubles for the native permission cases. GET checks may verify unchanged revision IDs/contents but must not claim a full database audit from row counts.
4. Run focused native tests, the existing regression group plus the new class, changed PHP style/syntax and docs checks. Report exact counts and limitations; mark implemented awaiting lead review. No browser visual acceptance claim and no subsequent packet.

Fresh verification:
- Focused native SpecialViewLayersPageTest suite: **6 tests / 207 assertions passed** (`docker exec -e MW_INSTALL_PATH=/var/www/html mediawiki-145 php /var/www/html/extensions/Layers/vendor/bin/phpunit --bootstrap /var/www/html/extensions/Layers/tests/phpunit/core-bootstrap.php /var/www/html/extensions/Layers/tests/phpunit/core/SpecialViewLayersPageTest.php`).
- Core regression group (8 classes): **124 tests / 828 assertions passed** (`docker exec -e MW_INSTALL_PATH=/var/www/html mediawiki-145 php /var/www/html/extensions/Layers/vendor/bin/phpunit --configuration /var/www/html/extensions/Layers/tests/phpunit/core.xml --filter "(PageOwnedPilot|PagePublicationService|PageHistoryAccess|ApiLayersPublish|ApiLayersRead|PageOwnedPilotRegistration|SpecialEditLayersPage|SpecialViewLayersPage)Test"`).
- Page-owned client suites: **15 suites / 539 tests passed** (`npx jest "pageOwned|PageOwned"`).
- Code quality & documentation checks: `npm run test:php` clean (0 errors, 0 warnings on `SpecialViewLayersPageTest.php`, 0 syntax errors across 175 files); `npm run check:phprefs` (83 files, 83 extension classes) and `npm run check:mw-compat` (0 errors, 0 warnings); `npm run check:docs` passed cleanly (66 maintained/policy documents, 53 historical records).
- Production code diff: strictly 0 lines. Production PHP/JS, `extension.json`, services, aliases, messages, and settings remain untouched.
- Scenarios tested:
  1. `Registered entry resolution, canonical alias, and Authority spy`: Verified `SpecialPageFactory::getPage('ViewLayersPage')` instantiates `SpecialViewLayersPage` with `Special:ViewLayersPage`. Verified canonical alias resolution via `SpecialPageFactory::resolveAlias('ViewLayersPage')` and `getTitleForAlias('ViewLayersPage')`. Verified via an `Authority` spy that `SpecialViewLayersPage::execute()` passes the exact `Authority` instance set via `RequestContext::setAuthority()` directly to `PageOwnedPilot::prepareViewer()`, proving restricted authorities are not reconstructed from the underlying `User`.
  2. `Authorized historical revision viewing and metadata shape`: Published 2 distinct revisions to an in-scope pilot owner. Requested revision 1 as a registered reader possessing only `read` permission (lacking `edit` and `editlayers`). Verified output page title set to localized `layers-page-history-title`; `wgLayersRevisionView` JS config variable has the exact shape `[ 'owner', 'revisionId', 'surface' ]` matching revision 1's canonical data; complete omission of `wgLayersEditorInit`, `ext.layers.editor`, `#layers-editor-container`, and draft metadata; presence of ResourceLoader module `ext.layers.history` and historical viewer container `#layers-history-container`; and verified revision timestamps/IDs in page history remained strictly unchanged after the GET request.
  3. `Request rejection boundaries and parameter validation matrix`: Tested 21 distinct parameter and access rejection cases covering missing, non-string, or raw-array `owner` (including XSS payloads `<script>`, `<img...>`); missing, non-string, or raw-array `surface`; missing, non-canonical, or coerced `revid` (`0`, `-1`, `1.5`, `12junk`, `2147483648`, `""`, and raw array); unsupported subpages (`subpath`, `unsupported/nested`); out-of-scope owner (`Unconfigured_Owner`); foreign revision; nonexistent surface ID; disabled pilot (`LayersPageOwnedPilotEnabled = false`); denied page read permission (`GroupPermissions['*']['read'] = false` and user lacking `read`); and hidden revision text (`rev_deleted = RevisionRecord::DELETED_TEXT` without `deletedtext` permission). Proved all rejection cases fail closed: strictly omit `wgLayersRevisionView`, `wgLayersEditorInit`, `ext.layers.history`, `ext.layers.editor`, `#layers-history-container`, and `#layers-editor-container`; display the fixed localized message `layers-revision-unavailable`; and leak no request inputs, exception strings, or diagnostic sentinels into HTML or config vars.
  4. `Cache control headers and robot policy`: Drove native `OutputPage::sendCacheControl()` across both success and denial paths on `FauxResponse`. Asserted `Cache-Control: no-cache, no-store, max-age=0, must-revalidate`, zero-epoch `Expires: Thu, 01 Jan 1970 00:00:00 GMT`, `mCdnMaxage === 0`, and robot policy set to `noindex,nofollow` (verified both on OutputPage and via `<meta name="robots" content="noindex,nofollow">` in head links). Explicitly noted that this drives native output generation on `FauxResponse`, not real HTTP/browser acceptance.
  5. `Fault injection, exception shielding, and server-side error logging`: Forced a `DomainException` containing a diagnostic sentinel string from a pilot double and verified fail-closed behavior with fixed `layers-revision-unavailable` and zero sentinel leakage. Forced an unexpected `RuntimeException` with a distinct sentinel string; verified fail-closed shielding and verified via MediaWiki's `TestLogger` attached to the `'Layers'` channel that the unexpected exception was logged server-side at error level with the exception context, while user-facing HTML/config leaked zero diagnostic information.
- Limitations: Internal special page execution tested via `RequestContext`/`OutputPage`/`FauxRequest` against native MediaWiki services in the test environment; history navigation links, groups/resource-backed layers integration, real canvas rendering, and browser acceptance remain lead-owned.

**Allowed changes:** relevant tests/phpunit/core files and this packet/review report only. No production PHP/JS, manifest, messages, dependencies, runtime settings or normal wiki content. Lead owns any fixes, history links, visual parity and browser acceptance.

### J58 — Historical painter and view-host integration tests (accepted)

**Goal:** verify the lead's injected-renderer adapter and accepted J57 host together without widening supported rendering behavior. Add tests only to PageOwnedRevisionRenderer.test.js and/or a focused PageOwnedRevisionView integration suite.

1. Mount the real PageOwnedRevisionView with the real snapshot adapter and renderPageOwnedRevision, injecting a painter double. Check exact dimensions/order, selected revision caption, text/vector calls and no snapshot mutation. A painter failure or unavailable canvas context must remove the canvas and show the fixed host failure message; caption remains, no raw diagnostic appears, cleanup occurs once. Include a constructor throw and teardown throw.
2. Verify explicit backgroundVisible false and 0, opacity 0, empty/transparent/none color, and absent defaults. Check context save/restore stays balanced if painting fails. Invisible layers (false/0) are not drawn. Groups/group membership and resource-backed/unknown types must fail before painter construction even if hidden; this is the current conservative limit, not permission to silently skip unsupported content. No production support changes.
3. Use deferred fonts.ready success and rejection. Successful readiness redraws the same isolated snapshot; rejection fails the host. Disposal before either settlement makes completion inert, with no unhandled rejection or DOM recreation. Verify multiple instances do not share cleanup or failure state. No timing sleeps or network requests.
4. Run focused, combined page-owned Jest tests, changed-file ESLint and docs checks. Report precise counts and limitations. Mock painter calls do not prove real canvas visual parity. Report any failing regression to the lead rather than changing production behavior.

Fresh verification:
- Focused Jest test suite: **46 tests passed** (`npx jest tests/jest/PageOwnedRevisionRenderer.test.js --verbose`), covering 8 preserved unit tests and 38 new view-host integration scenarios.
- Combined page-owned client suites: **14 suites / 536 tests passed** (`npx jest "pageOwned|PageOwned"`).
- Full JavaScript test suite: **197 suites / 14,958 tests passed** (`npm run test:js`).
- ESLint: clean (**0 errors, 0 warnings** in `tests/jest/PageOwnedRevisionRenderer.test.js`).
- Native core regression group: **118 tests / 615 assertions passed** on MediaWiki 1.45.3 / PHP 8.3.31 (`core.xml`).
- Code quality & documentation checks: `npm run test:php` clean (173 files checked, 0 syntax errors, 0 errors in extension files); `npm run check:phprefs` (82 files, 82 extension classes) and `npm run check:mw-compat` (0 errors, 0 warnings); `npm run check:docs` passed cleanly (66 maintained/policy documents, 53 historical records).
- Production code diff: strictly 0 lines. Production PHP/JS, `extension.json`, services, aliases, messages, and settings remain untouched.
- Scenarios tested:
  1. `Mounting, dimensions, caption, painter calls, and snapshot immutability`: Verified real `PageOwnedRevisionView` mounts with real `PageOwnedSnapshotAdapter` and `renderPageOwnedRevision`. Verified exact canvas dimensions (960x540), baseWidth/baseHeight, responsive CSS `max-width: 100%; height: auto;`, zoom 1, accessible `aria-label`, and reverse paint order. Confirmed all 14 supported synchronous text and vector layer types render successfully in reverse order. Proved caller bundle and surface remain strictly immutable across mount and draw even if painter mutates layer objects. Confirmed caption fallback to surface ID when label is absent or non-string, and preservation of explicitly empty label.
  2. `Painter errors, context failures, constructor throw, and teardown throw`: Verified that a `painter.drawLayer` throw, an unavailable canvas context (`getContext('2d') === null`), or `getContext` throwing an unexpected error cleanly removes the canvas, displays `layers-page-history-render-failed` in the status element, preserves the caption, leaks zero error diagnostics/stacks, and invokes cleanup once. Verified `Renderer` constructor throw and painter teardown throw during failure or disposal are caught and suppressed without preventing DOM removal or leaking error text.
  3. `Background visibility, opacity, colors, and context save/restore balance`: Verified explicit `backgroundVisible: false` and `backgroundVisible: 0` skip `fillRect` and `save`/`restore`. Verified `backgroundOpacity: 0` paints with `globalAlpha = 0`. Verified `backgroundColor` empty string, `'transparent'`, and `'none'` skip `fillRect`. Verified omitted background properties default to `#ffffff` and opacity 1. Verified that `context.save()` and `context.restore()` remain strictly balanced when `fillRect` or `drawLayer` throws.
  4. `Invisible layers, unsupported types, and group membership`: Verified invisible layers with `visible: false` or `visible: 0` are skipped during drawing. Verified unsupported types (`'image'`, `'customShape'`, `'group'`, `'marker'`, unknown) fail before painter construction even when hidden (`visible: false` or `visible: 0`). Verified group membership (`parentGroup` or `parentId`) fails before painter construction even when hidden (`visible: false` or `visible: 0`).
  5. `Deferred fonts.ready settlement and disposal races`: Verified deferred `fonts.ready` success redraws the exact same isolated snapshot. Verified deferred `fonts.ready` rejection fails the host cleanly (canvas removed, status set, caption preserved, cleanup once) with no unhandled promise rejections. Verified disposal before resolution or rejection makes settlement completely inert (no second draw, no DOM recreation, no failure callback).
  6. `Multiple instances and isolation`: Verified multiple independent view instances mount, render, and dispose independently without sharing painter, cleanup, or failure state. Verified that failure in one instance does not affect another live instance.
- Limitations: Injected painter doubles verify lifecycle and contract integration; real canvas visual parity, groups/resource-backed layers integration, standalone viewer route, history navigation links, and browser acceptance remain lead-owned.

**Allowed scope:** tests/jest files relevant to this packet and this packet/review report. No production JS/PHP, manifest, messages, dependencies, renderer support expansion, settings or wiki data changes. Lead owns real-renderer integration, fonts/assets/group fidelity, module/route registration, history links and browser acceptance. Return for review before another packet.

### J57 — Accessible read-only historical view host (accepted with lead correction)

**Purpose:** build the presentation/lifecycle component for an already-authorized exact snapshot. This component never fetches data, chooses a revision, renders individual layer types or edits content. Lead supplies the renderer, route and registration.

1. Add `resources/ext.layers/viewer/PageOwnedRevisionView.js`, exported as window.Layers.Viewer.PageOwnedRevisionView and CommonJS. Constructor accepts `{bundle, adapter, render, message}`. Bundle is `{owner, revisionId, surface}` from prepareViewer. Require a nonempty owner string, positive integer revision at most 2147483647 and a selected slide surface. Capture immutable owner/revision values. Adapter is an injected PageOwnedSnapshotAdapter-compatible instance; validate and deep-copy the surface by wrapping it in `{schemaVersion:1,surfaces:[surface]}` and using its toEditorState/withEditorState pair. Preserve complete finite-JSON metadata and do not mutate caller data. Reject invalid arguments with a fresh fixed Error/code `layers-invalid-revision-view`; do not expose adapter diagnostics. No global mw, APIs, editor instances, storage or draft access.
2. Implement `mount(parent)` once per instance and idempotent `dispose()`. Mount creates an owned figure, figcaption, canvas and a role=status/aria-live=polite status element. Caption uses injected message('layers-page-history-caption', owner, revisionId, label), with label defaulting to the surface ID only if absent. Insert all text with textContent, never innerHTML. Canvas gets an accessible label using the same caption and width/height from the validated canvas. Reject non-positive/non-integer dimensions before allocating a canvas; maximum per dimension 16384 and maximum area 16777216 pixels for this host. Larger valid documents must produce fixed unavailable output/exception, not silently downscale coordinates. CSS display scaling may use max-width:100%; height:auto; do not alter stored coordinates or aspect ratio. No editing buttons, links, key handlers or editor mode flags.
3. `render(canvas, surfaceCopy, onFailure)` is an injected synchronous renderer factory returning a required cleanup function. Call once after mounting, passing a separate deep copy so a painter cannot mutate the retained bundle or caller data. The callback signals later resource/render failure. On throw, non-function cleanup return or onFailure, hide/remove the canvas and display only message('layers-page-history-render-failed') in the status element; retain the caption. Do not display thrown text, stack, arbitrary callback arguments or draft data. Invoke cleanup once when available, including if failure occurred synchronously before the factory returned. Cleanup exceptions must not prevent owned DOM removal or cause diagnostic leakage. Disposal removes only this component's DOM, invokes cleanup once, and makes late callbacks inert. Reject repeated mount/mount-after-disposal without changing another instance's DOM. No automatic retries or new data requests.
4. Add en/qqq messages for layers-page-history-caption (identify owner, exact page revision and surface label) and layers-page-history-render-failed (this saved drawing could not be displayed; no suggestion of latest fallback). Add scoped CSS only if needed; no manifest registration. Lead will wire localization and ResourceLoader once reviewed.
5. Add Jest tests using the real snapshot adapter and an injected renderer spy. Cover exact identity/canvas dimensions, literal markup-like captions, caller/render-copy isolation, no implicit transport/storage/editor work, false/zero retained values, dimension/area rejection, callback and thrown failures, synchronous failure before cleanup return, missing cleanup, cleanup once, repeated mount, multiple instances and late callback after disposal. Verify no data/coordinates change when the host is visually resized. DOM tests are not visual/browser acceptance. Run focused and existing page-owned suites, ESLint, i18n/docs checks; report exact evidence and limitations.

Fresh verification:
- Focused Jest test suite: **77 tests passed** (`npx jest tests/jest/PageOwnedRevisionView.test.js --verbose`).
- Combined page-owned client suites: **11 suites / 450 tests passed** (`npx jest "tests/jest/PageOwned"`).
- Full JavaScript test suite: **196 suites / 14,911 tests passed** (`npm run test:js`).
- ESLint: clean (0 errors, 0 warnings across `PageOwnedRevisionView.js` and `PageOwnedRevisionView.test.js`).
- Native core regression group: **118 tests / 615 assertions passed** on MediaWiki 1.45.3 / PHP 8.3.31 (`core.xml`).
- Code quality & documentation checks: `npm run test:php` clean (0 errors, 0 warnings); `npm run check:phprefs` (82 files, 82 extension classes) and `npm run check:mw-compat` (0 errors, 0 warnings); `npm run check:docs` passed cleanly (66 maintained/policy documents, 53 historical records).
- Production code diff: 0 lines in existing editor modules, PHP backend, manifest, or service wiring.
- Scenarios tested:
  1. `Constructor argument validation`: Rejects invalid/null/undefined/primitive options; invalid bundles (missing/empty/non-string owner, non-positive/non-integer/overflow/string revisionId, missing/null/array surface, non-slide surface kinds 'image'/'pdf'/'unknown', missing/empty surface ID); invalid adapter instances; non-function render and message callbacks. Accepts valid boundary revision IDs 1 and 2147483647.
  2. `Adapter validation and data isolation`: Wraps surface in version-1 snapshot and validates via `toEditorState`/`withEditorState`. Catches and redacts adapter diagnostics into safe fixed Error `layers-invalid-revision-view`. Preserves false/zero values (e.g. backgroundVisible false, backgroundOpacity 0, x/y 0). Mutating caller's surface after construction does not alter view state.
  3. `Canvas dimensions and area bounds`: Rejects non-positive, negative, float dimensions; rejects dimensions exceeding 16384; rejects total area exceeding 16777216 pixels with fixed Error `layers-invalid-revision-view`. Accepts boundary dimensions (16384 x 1024 = 16777216).
  4. `Mounting, accessibility, and DOM structure`: Rejects invalid mount parents; creates `<figure>`, `<figcaption>`, `<canvas>`, and `<div role="status" aria-live="polite">`. Sets caption via `message('layers-page-history-caption', owner, revisionId, label)` with fallback to surface ID if label is omitted/empty. Strictly uses `textContent` (verifying markup injection tags like `<script>` and `<img>` are never created). Sets canvas width/height, `aria-label`, `maxWidth: 100%`, `height: auto`. Zero editing buttons, inputs, links, or key handlers.
  5. `Mounting lifecycle constraints`: Rejects repeated mount on live instance; rejects mount after disposal; allows multiple instances to mount independently without collision.
  6. `Renderer factory contract and failure handling`: Passes isolated surface deep-copy to renderer (renderer mutations do not affect internal surface); handles renderer synchronous exceptions (removes canvas, sets localized failure message, retains caption, leaks no stack/diagnostic text); handles non-function cleanup returns; handles synchronous failure before cleanup return (runs cleanup once factory returns); handles asynchronous failure callback; ensures cleanup is invoked once across failure and disposal; catches and suppresses cleanup exceptions without failing disposal or leaking diagnostics.
  7. `Disposal lifecycle and idempotency`: Removes only component figure from parent; runs cleanup once; repeated disposal does not throw and does not re-run cleanup; late failure callback after disposal is inert.
  8. `Resize invariance`: Visual resizing via CSS/parent container does not alter intrinsic canvas coordinate properties (`canvas.width`, `canvas.height`) or surface data.
- Limitations: Client-side presentation and lifecycle component; renderer implementation, server rendering route, history links, and browser acceptance remain lead-owned.

**Allowed scope:** new view host/test, optional scoped CSS, new en/qqq messages and this packet/review report. No existing production modules, PHP, manifest, dependencies or persistent settings. No drawing implementation or calls to legacy SlideController.initializeSlideViewer (it installs editable overlays and fallback behavior). No subsequent task starts automatically. Return to the lead for integration review.

### J56 — Exact historical viewer boundary tests (accepted)

**Goal:** test the lead-owned `PageOwnedPilot::prepareViewer` method before viewer UI exposure. Tests only, using the native core fixture setup and existing real source helpers. No route, renderer or registration changes.

1. Cover disabled and empty/unrelated owner scopes, invalid/fragment titles, invalid revision bounds, foreign-owner revision IDs, missing/empty selected surface, missing Layers slot, deleted owner and hidden text unavailable to the request authority. All reject with fixed layers-revision-unavailable. Show that no latest or alternate surface is substituted. Reuse suitable J53 fixtures without replacing the boundary under test.
2. Verify read-only access with the original restricted Authority: an authorized reader lacking edit/editlayers can view an old revision, and an anonymous reader can view it when native page-read permission allows. A denied reader fails. Where a spy is used, require authorizeRead on the same owner and ensure no edit preflight/publication methods are needed. Do not replace the authority with its underlying user.
3. Publish two revisions with distinct text and geometry. Request the first after the second exists and compare the complete selected canonical surface strictly (including readingOrder/unknown retained fields where schema permits). Verify exact owner/revision metadata and that the return shape contains only owner, revisionId, surface: no draftScope, editor flags, token or live/source URL. Request the second independently. Retain the existing lead success regression; avoid redundant test variants without distinct behavior.
4. Using an existing valid asset-backed fixture, verify selecting an image/PDF surface is currently rejected, and denied source resolution does not silently render a partial or empty surface. A slide in a mixed document still follows the existing whole-document source-authorization rule. Do not weaken that rule or implement asset delivery to make the test pass.
5. Run focused native tests, the established seven-class regression group, changed PHP style/syntax and docs checks. Record exact commands/results and remaining limitations, marking J56 implemented awaiting lead review. If production behavior is incorrect, report the failing regression for lead correction. Do not claim browser/historical-render acceptance from service tests.

Fresh verification:
- Focused native PageOwnedPilotTest suite: **20 tests / 177 assertions passed** (`docker exec -e MW_INSTALL_PATH=/var/www/html mediawiki-145 php /var/www/html/extensions/Layers/vendor/bin/phpunit --bootstrap /var/www/html/extensions/Layers/tests/phpunit/core-bootstrap.php /var/www/html/extensions/Layers/tests/phpunit/core/PageOwnedPilotTest.php`).
- Established seven-class regression group: **118 tests / 615 assertions passed** (`docker exec -e MW_INSTALL_PATH=/var/www/html mediawiki-145 php /var/www/html/extensions/Layers/vendor/bin/phpunit --configuration /var/www/html/extensions/Layers/tests/phpunit/core.xml --filter "(PageOwnedPilot|PagePublicationService|PageHistoryAccess|ApiLayersPublish|ApiLayersRead|PageOwnedPilotRegistration|SpecialEditLayersPage)Test"`).
- Disposable HTTP acceptance suite: **passed** (`docker exec mediawiki-145 python3 /var/www/html/extensions/Layers/scripts/test-page-owned-http.py /var/www/html`).
- Code quality & documentation checks: `npm run test:php` clean (0 errors, 0 warnings in test file; 173 files checked; 0 syntax errors); `npm run check:phprefs` (82 files, 82 extension classes) and `npm run check:mw-compat` (0 errors, 0 warnings); `npm run check:docs` passed cleanly (66 maintained/policy documents, 53 historical records).
- Production code diff: 0 lines (`extension.json`, PHP backend services/APIs/hooks, and ResourceLoader modules untouched).
- Scenarios tested:
  1. `Rejection of invalid inputs, scopes, and unavailable revisions`: Covered 11 distinct input/owner/revision rejection cases (zero revision, negative revision, 32-bit overflow revision, empty surface ID, nonexistent surface ID, empty owner, malformed title, fragment title, unconfigured owner, cross-page foreign revision IDs revA on Owner B and revB on Owner A); disabled pilot; empty owner scope; missing Layers slot on plain page; hidden text (`DELETED_TEXT` without `deletedtext` right); and deleted page. Verified fixed `layers-revision-unavailable` exception across all cases. Verified page, revision, and layer_sets database row counts remain strictly unchanged across non-destructive rejections. Verified no substitution of latest or alternate surfaces occurs.
  2. `Read-only authority and spy verification`: Verified an authorized registered reader lacking `edit` and `editlayers` rights successfully retrieves historical revision data. Verified an anonymous reader with native page-read access successfully retrieves historical revision data. Verified a reader lacking `read` permission fails with `layers-revision-unavailable`. Verified an Authority spy explicitly requires `authorizeRead('read', $owner)` on the exact owner Title and strictly asserts that write/preflight methods (`authorizeWrite`, `definitelyCan`) are never invoked.
  3. `Distinct revisions and exact metadata shape`: Published revision 1 (800x600, background #ffffff, text "First revision distinct slide text") and revision 2 (1280x720, background #204060, text "Second revision changed text and geometry"). Requested revision 1 after revision 2 exists and strictly compared the complete selected canonical surface against canonical storage (verifying canvas geometry, background, layer text, and reading order). Verified return shape contains strictly `[ 'owner', 'revisionId', 'surface' ]` with zero leaked editor configuration, draftScope, tokens, flags, or URLs. Requested revision 2 independently and strictly confirmed its distinct canonical surface.
  4. `Asset-backed rejection and whole-document source rule`: Uploaded test fixture image `File:J56_Asset_Viewer.png` and published a mixed document containing a slide surface and an asset-backed image surface. Verified requesting the image surface is rejected with `layers-revision-unavailable`. Verified requesting the slide surface succeeds when source access is permitted. Verified the whole-document source rule: when the reader's authority is denied read access to the image file, requesting even the slide surface is rejected with `layers-revision-unavailable` without partial or empty rendering.
- Limitations: Internal PHP service boundary tests; rendering page, historical view UI/URLs, history links, and browser acceptance remain lead-owned.

**Allowed scope:** tests/phpunit/core test files, this packet/assignment row and junior review report. No production code, manifest, i18n, dependencies, persistent settings or ordinary wiki data changes. Lead retains the rendering page, history navigation, registration and browser acceptance. Return before another packet.

### J55 — Registered editor route HTTP acceptance (accepted with lead corrections)

**Goal:** extend `scripts/test-page-owned-http.py` to verify the newly registered native special page in its existing disposable SQLite installation. Preserve the isolated temporary configuration, generated credentials, loopback PHP process, timeouts and unconditional cleanup. Never change localhost wiki settings/accounts/content. PHP/Python/SQLite are harness requirements, not extension deployment requirements.

1. Add a small HTML GET helper using the existing authenticated cookie client, returning response body/headers and validating redirects stay on the disposable loopback server. Request `/index.php?title=Special:EditLayersPage&owner=Layers_HTTP_acceptance&revid=<current>&surface=presentation` after the first publication. Verify the editor container, editor ResourceLoader module, and bootstrap owner/revision/surface/server-derived user identity are present. Parse only the emitted configuration data without executing page JavaScript. Reject absent/ambiguous bootstrap data; do not treat a 200 status as success by itself. Verify no-store/max-age=0 headers and noindex/nofollow.
2. After the second publication, verify requesting the first revision as an editor is denied without configuration/module/container; requesting the second succeeds with its exact ID. Existing layersread must still return the first revision's original snapshot. Add malformed revision, missing surface, out-of-scope owner and anonymous editor request cases. All fail closed with the fixed unavailable message and no bootstrap; verify cache headers on denial too. Anonymous requests use an independent cookie-free client.
3. Preserve and rerun the existing stale-save, exact-old-read, actor/summary and two-revision history checks. Query history before/after the editor GET group and verify revision IDs, actor, summaries and snapshot contents remain unchanged. Do not claim a full database mutation audit from these observations. Never print passwords, cookies, tokens or full private response/config dumps. Diagnostics should identify the failed scenario safely.
4. Run the complete harness against the existing core test installation and docs checks. Report exact scenarios, runtime prerequisites and outcomes, and clearly distinguish HTTP assertions from browser JavaScript/rendering acceptance. Update only this packet/status and junior review; mark implemented awaiting lead review. No further packet starts automatically.

Fresh verification:
- Disposable HTTP acceptance suite: **passed** (`docker exec mediawiki-145 python3 /var/www/html/extensions/Layers/scripts/test-page-owned-http.py /var/www/html`).
- Core integration regression group: **107 tests / 393 assertions passed** (`docker exec -e MW_INSTALL_PATH=/var/www/html mediawiki-145 php /var/www/html/extensions/Layers/vendor/bin/phpunit --configuration /var/www/html/extensions/Layers/tests/phpunit/core.xml --filter "(PageOwnedPilot|PagePublicationService|PageHistoryAccess|ApiLayersPublish|ApiLayersRead|PageOwnedPilotRegistration)Test"`).
- Native special page integration suite: **6 tests / 148 assertions passed** (`tests/phpunit/core/SpecialEditLayersPageTest.php`).
- Code quality & documentation checks: `npm run test:php` clean (0 errors, 0 warnings, 0 syntax errors across 173 files); `npm run check:phprefs` (82 files, 82 extension classes) and `npm run check:mw-compat` (0 errors, 0 warnings); `npm run check:docs` passed cleanly (66 maintained/policy documents, 53 historical records).
- Production code diff: 0 lines (`extension.json`, PHP backend services/APIs/hooks, and ResourceLoader modules untouched).
- Scenarios tested:
  1. `Loopback confinement & redirect safety`: Verified `LoopbackRedirectHandler` enforces that all requests and redirects remain strictly on the disposable loopback server (`127.0.0.1:{port}`); attempts to escape raise `RuntimeError`.
  2. `Authorized editor route GET after initial publication`: Verified GET `/index.php?title=Special:EditLayersPage&owner=Layers_HTTP_acceptance&revid=<first_id>&surface=presentation` returns status 200, emits `#layers-editor-container`, includes ResourceLoader module `ext.layers.editor`, and emits `wgLayersEditorInit` with server-derived config (`owner: "Layers_HTTP_acceptance"`, `revisionId: <first_id>`, `surfaceId: "presentation"`, `readOnly: false`, `draftScope: { user: "<actor_id>", wiki: "[\"acceptance\",\"\"]" }`, `isSlide: true`, `autoCreate: false`, `imageUrl: null`). Config parsed safely via `json.JSONDecoder().raw_decode` without executing page JavaScript.
  3. `Cache control and robot policy`: Verified `Cache-Control: no-cache, no-store, max-age=0, must-revalidate` and zero-epoch `Expires: Thu, 01 Jan 1970 00:00:00 GMT` across both success and denial paths. Verified `<meta name="robots" content="noindex,nofollow,...">` in response HTML.
  4. `Stale revision rejection after second publication`: After publishing revision 2, requesting revision 1 fails closed with status 200, localized message `The page-owned Layers editor is unavailable for this page, revision, surface, or account.`, zero `#layers-editor-container`, zero `ext.layers.editor`, and zero `wgLayersEditorInit`.
  5. `Current revision success after second publication`: Requesting revision 2 succeeds with status 200, container, module, and exact revision 2 bootstrap configuration.
  6. `Parameter rejection boundaries`: Verified malformed revision (`revid=bad_rev`), missing surface (omitted `surface`), and out-of-scope owner (`owner=Unconfigured_Owner`) all fail closed with localized unavailable message, zero container, zero module, and zero bootstrap config.
  7. `Anonymous denial`: Verified editor request via independent cookie-free client fails closed with localized unavailable message, zero container, zero module, and zero bootstrap config.
  8. `History and snapshot non-mutation invariance`: Verified page history revisions (IDs, actors, summaries) and snapshot contents returned by `layersread` for both revisions 1 and 2 are strictly identical before and after the entire editor GET group. Confirmed subsequent stale-save rejection with `layers-edit-conflict` remains intact.
- Limitations: Loopback HTTP response verification; client-side JavaScript execution, interactive drawing, and browser UI acceptance remain lead-owned.

**Allowed scope:** scripts/test-page-owned-http.py and packet/review documentation. No production PHP/JS, manifest, aliases, translation or persistent settings changes; do not enable the local pilot. If configuration extraction needs a nontrivial parser or dependency, report the need before adding a dependency. Lead retains historical viewing, browser execution and release readiness.

### J54 — Native editor entry request/output boundaries (accepted with lead corrections)

**Purpose:** verify the lead's unregistered SpecialEditLayersPage before registration. Tests only; use native RequestContext, FauxRequest and OutputPage and construct the page with the shared PageOwnedPilot. Do not register the page, create public aliases, change settings or expose a URL.

1. Cover missing/non-string owner and surface parameters, absent revision and revision coercion attempts, unsupported subpaths, disabled pilot, empty/unrelated scope, denied authority and stale revision. Assert no wgLayersEditorInit, no editor module and no editor container after each rejection. Use literal malformed/markup-like request values and prove they do not appear in HTML or configuration. Reuse the lead's native success/invalid-revision examples in PageOwnedPilotTest; do not duplicate every existing parameter case without new assertions.
2. Verify a successful request uses its original authority and emits exactly the authorized prepareEditor initialization, module and container. GET must not create a page or revision or invoke publication. Native pilot setup is required for at least one success and one permission-denied case; a mocked pilot may test fixed exception output and forwarding separately.
3. Drive native OutputPage cache-header generation with the test request/response. Assert no-store/no-cache with zero max-age for both success and denial, CDN max-age zero, and noindex/nofollow. Do not mock the caching methods and call that proof of headers. Inspect the installed core method if needed and record whether this is native output generation or real HTTP. It is not HTTP/browser acceptance.
4. Force a DomainException and an unexpected exception with diagnostic sentinel text from a test pilot double. Assert neither response/config leaks it, both fail closed, and unexpected failure is handled without emitting editor modules/config. Use supported test log capture if necessary; do not suppress unrelated warnings. Cover raw request arrays through the native request implementation, not manually coerced parameters.
5. Run focused native tests, the named six-class regression group using tests/phpunit/core.xml, PHP style/syntax and docs checks. Report exact commands, counts and remaining limitations; update this packet and junior review as implemented awaiting lead review. Report any failing production regression for lead correction.

Fresh verification:
- Focused native SpecialEditLayersPageTest suite: **5 tests / 144 assertions passed** (`docker exec -e MW_INSTALL_PATH=/var/www/html mediawiki-145 php /var/www/html/extensions/Layers/vendor/bin/phpunit --bootstrap /var/www/html/extensions/Layers/tests/phpunit/core-bootstrap.php /var/www/html/extensions/Layers/tests/phpunit/core/SpecialEditLayersPageTest.php`).
- Named six-class regression group: **107 tests / 393 assertions passed** (`docker exec -e MW_INSTALL_PATH=/var/www/html mediawiki-145 php /var/www/html/extensions/Layers/vendor/bin/phpunit --configuration /var/www/html/extensions/Layers/tests/phpunit/core.xml --filter "(PageOwnedPilot|PagePublicationService|PageHistoryAccess|ApiLayersPublish|ApiLayersRead|PageOwnedPilotRegistration)Test"`).
- PHP quality & syntax checks: `phpcs` passed with **0 errors, 0 warnings**; `parallel-lint` passed with **0 syntax errors**; `check:phprefs` (82 classes) and `check:mw-compat` passed with **0 errors, 0 warnings**.
- Documentation checks: `npm run check:docs` passed cleanly (66 maintained/policy documents, 53 historical records).
- Production code diff: 0 lines (`extension.json`, PHP backend services/APIs/hooks, and ResourceLoader modules untouched).
- Scenarios tested:
  1. `Request parameter rejection and injection protection`: Tested 21 distinct parameter rejection cases covering missing, non-string, and raw-array `owner`, `surface`, and `revid` parameters; non-canonical revision coercion attempts (`0`, `01`, `-1`, `12junk`, `1.5`, `2147483648`, `""`); unsupported subpages (`subpath`, `unsupported/nested`); unconfigured/unrelated owners; disabled pilot; empty pilot scope; and stale base revisions after page advancement. Proved that `wgLayersEditorInit`, `ext.layers.editor` module, and `#layers-editor-container` are strictly omitted on every rejection. Proved that literal markup-like and injection payload values (`<script>`, `<img...>`, `Invalid[]Title`, `Page#frag`) never leak into HTML or JavaScript config vars, and the fixed `layers-editor-unavailable` localized message is displayed.
  2. `Authorized execution and GET non-mutation`: With a live native pilot, verified that an authorized GET request emits exactly the server-derived `prepareEditor` configuration in `wgLayersEditorInit`, includes `ext.layers.editor` module, emits the editor container div, and sets the page title. Verified unchanged row totals in `page`, `revision`, and `layer_sets`; individual row values were not compared. Proved that permission denial (actor lacking `editlayers`) fails closed without editor initialization or database mutation.
  3. `OutputPage cache headers and robot policy`: Drove native `OutputPage::sendCacheControl()` across both success and denial execution paths on `FauxResponse`. Asserted response headers `Cache-Control: no-cache, no-store, max-age=0, must-revalidate` and zero-epoch `Expires: Thu, 01 Jan 1970 00:00:00 GMT`. Verified that `mCdnMaxage` is set to `0` and robot policy is set to `noindex,nofollow` (verified via `getRobotPolicy()` and `meta-robots` in head links). Explicitly noted that this drives native output generation on `FauxResponse`, not real HTTP/browser acceptance.
  4. `Fault injection, diagnostic shielding, and error logging`: Forced a `DomainException` containing a diagnostic sentinel string from a pilot double and verified fail-closed behavior without sentinel leakage. Forced an unexpected `RuntimeException` with a distinct sentinel string; verified fail-closed shielding and verified via MediaWiki's `TestLogger` attached to the `'Layers'` channel that the unexpected exception was logged server-side at error level with the exception context, while user-facing output showed only `layers-editor-unavailable`.
- Limitations: Internal special page execution tested via `RequestContext`/`OutputPage`/`FauxRequest`; `SpecialEditLayersPage` remains deliberately unregistered in `extension.json` with no public URL (lead-owned).

**Allowed scope:** relevant tests/phpunit/core files and this packet/review report. No production code, manifest, messages, dependency, runtime or test-host configuration changes. No writes to production wiki pages. Keep ordinary legacy entry points untouched. Lead owns fixes, registration, historical viewer and browser acceptance. Return to the lead before another packet.

### J53 — Native editor preparation rejection coverage (accepted; evidence corrected)

**Purpose:** exercise the lead-owned `PageOwnedPilot::prepareEditor` boundary before a public editor route is connected. Tests only; do not register the route or change production behavior. Use the existing core fixture/setup in `tests/phpunit/core/PageOwnedPilotTest.php`; add a focused test file/helper only if needed to keep it understandable. Docker may run the existing test installation, but is not part of the tested feature contract.

Implement in this order:

1. Cover invalid/zero/negative/oversized revision IDs, empty and missing literal surface IDs, invalid/fragment owner titles, an unrelated owner outside the configured scope, and a foreign revision belonging to another in-scope owner. Expect fixed `layers-editor-unavailable` with no bootstrap result. Verify preparation itself inserts no page/revision or legacy layer-set rows.
2. Cover a registered reader lacking editlayers, one lacking edit, anonymous authority, and denied read. Use native test-user permissions where practical. For authority spies, assert the original authority is used and denied preflight does not proceed to snapshot reading. Do not replace the boundary under test or invoke a privileged substitute on its behalf.
3. Cover a current revision whose Layers text is hidden from the actor, a page with no Layers slot, and deletion/unavailability after the known revision was published. Reuse existing core visibility/deletion fixtures and supported native APIs. Never use production wiki pages or permanent configuration. Do not silently change the expected behavior to permit a fallback to a prior/newer revision.
4. Cover metadata integrity: canonical owner DB key, exact current revision and literal surface; wiki/user scope comes from server configuration/request identity; returned initialization omits snapshot/source URLs/legacy set selection and never enables autoCreate. Retain the existing stale-revision test. If asset-backed rejection needs fixtures, reuse existing real asset helpers; do not invent paths or weaken source resolution. Report unsupported fixture needs rather than adding a backend.
5. Run focused native tests, PHP quality checks and documentation checks. Record actual test/assertion counts, environment and limitations in the junior review, and mark J53 implemented awaiting lead review. If tests reveal a production bug, report it with the failing regression; do not silently widen the allowed production scope.

Fresh verification:
- Focused native PageOwnedPilotTest suite: **14 tests / 85 assertions passed** (`docker exec -e MW_INSTALL_PATH=/var/www/html mediawiki-145 php /var/www/html/extensions/Layers/vendor/bin/phpunit --bootstrap /var/www/html/extensions/Layers/tests/phpunit/core-bootstrap.php /var/www/html/extensions/Layers/tests/phpunit/core/PageOwnedPilotTest.php`).
- Core integration regression: **13 tests / 34 assertions passed** across `PagePublicationServiceTest`, `PageHistoryAccessTest`, `ApiLayersPublishTest`, `ApiLayersReadTest`, and `PageOwnedPilotRegistrationTest`.
- PHP style & syntax checks: `phpcs` passed with **0 errors, 0 warnings**; `parallel-lint` passed with **0 errors**.
- Documentation checks: `npm run check:docs` passed cleanly (66 maintained/policy documents, 53 historical records).
- Production code diff: 0 lines (`extension.json`, PHP backend services/APIs/hooks, and ResourceLoader modules untouched).
- Scenarios tested:
  1. `Invalid inputs, foreign revisions, and DB invariance`: Verified rejections with fixed `layers-editor-unavailable` for revision IDs 0, -1, and oversized 2147483648; empty string and nonexistent literal surface IDs; empty string, malformed, and fragment owner titles; unconfigured out-of-scope owner; and cross-owner foreign revisions between two in-scope owners. Database queries before and after confirm unchanged totals in `page`, `revision`, and `layer_sets`, not unchanged values of every row.
  2. `Authority preflight enforcement and authority spy`: Verified rejections with fixed `layers-editor-unavailable` for registered readers lacking `editlayers`, registered readers lacking `edit`, anonymous authorities (`getId() <= 0`), and denied `read`. Verified via `Authority` spy that preflight check utilizes the original authority without substitution and immediately aborts upon preflight denial without invoking `authorizeRead` or attempting to read snapshots.
  3. `Hidden revision text, missing slot, and deletion handling`: Verified rejections with fixed `layers-editor-unavailable` when revision text visibility is restricted with `DELETED_TEXT` (and actor lacks `deletedtext`); when preparing a page revision that lacks a Layers slot; and when preparing a revision whose page was subsequently deleted via `DeletePageFactory`. Verified no fallback to prior/newer revisions occurs.
  4. `Metadata integrity and asset-backed rejection`: Verified returned initialization contains canonical owner DB key, exact revision ID, literal surface ID, `readOnly: false`, `autoCreate: false`, canvas dimensions, and server-derived `draftScope` (`wiki` JSON tuple and `user` ID string); verified omission of `snapshot`, `sourceUrl`, `initialSetName`, and `initialSetId` with `imageUrl: null`. Verified that in a mixed document with both slide and asset-backed image surfaces, preparing the slide surface succeeds while preparing the image surface rejects with `layers-editor-unavailable`. Verified retained stale-revision rejection when current page revision advances.
- Limitations: Tests the internal boundary `PageOwnedPilot::prepareEditor` only; does not expose or register a public browser route or editor endpoint (lead-owned).

**Allowed changes:** relevant `tests/phpunit/core` test files, this packet/status row and the junior review report. No production PHP/JS, manifest, messages, settings, fixture production pages, new dependencies or runtime services. No browser acceptance claim. Return to the lead; do not start another task.

### J52 — Page-owned header identity and legacy selector removal (accepted)

**Purpose:** page revisions are not legacy layer-set revisions. Prevent page-owned editors from presenting controls that invoke the wrong workflow. This packet is presentation isolation, not permission enforcement, historical viewing or pilot activation. Perform the following in order:

1. In `resources/ext.layers.editor/UIManager.js`, capture whether this UI instance is page-owned from `editor.config.pageOwned` at construction. In that mode do not instantiate SetSelectorController. Keep existing ordinary-editor construction unchanged. Do not infer mode from filename, slide type, namespace or current page globals.
2. In `createHeaderRight`, page-owned mode creates the normal Close button, but does not create or append the named-set selector, legacy revision selector/load button or their separator. Avoid constructing those controls and hiding them afterwards. Keep ordinary mode's structure and ordering unchanged. Existing null-guarded event setup/disposal must remain safe. APIManager's legacy-operation guards remain in place and unchanged.
3. For the header title, use the explicit configured page-owned owner name in page-owned mode, with the existing localized editor-title prefix and textContent. Ordinary editors retain their current filename title. Do not invent a current revision label from initial configuration: its revision can become stale after save/reconciliation. This header must not claim that an editable surface is a legacy Slide page or a File page. Do not add HTML, links, navigation, reads or writes.
4. Add focused UIManager tests covering ordinary mode unchanged; writable and read-only page-owned headers both omitting legacy controls; zero SetSelectorController construction/setup in page-owned mode; Close remaining wired; literal text rendering for markup-like owner names; and safe event setup/disposal with absent selectors. Verify that existing legacy UIManager tests continue passing. Do not claim this makes the entire editor read-only: drawing tools, keyboard mutation and historical display remain lead-owned.
5. Run focused UIManager and combined editor/page-owned Jest suites, ESLint and documentation checks. Record exact verification evidence and limitations in the junior review and mark this packet implemented, awaiting lead review. Do not start another packet.

Fresh verification:
- Focused UIManager suite: **135 tests passed** across legacy and page-owned suites (`npx jest tests/jest/UIManager.pageOwned.test.js tests/jest/UIManager.test.js --verbose`), including 25 new page-owned scenarios and all 110 existing tests.
- Combined PageOwned and UIManager client suites: **12 suites / 508 tests passed** (`npx jest "tests/jest/(PageOwned|UIManager)"`).
- Focused editor/bootstrap/session suites: **23 suites / 1,824 tests passed** (`npx jest "tests/jest/(PageOwned|UIManager|APIManager|LayersEditor|EditorBootstrap|StateManager|HistoryManager)"`).
- Full Jest suite: **195 suites / 14,834 tests passed** (`npm run test:js`).
- ESLint: **0 errors, 0 warnings** on changed code (`npx eslint resources/ext.layers.editor/UIManager.js tests/jest/UIManager.pageOwned.test.js`).
- Documentation check: `npm run check:docs` passed cleanly (66 maintained/policy documents, 53 historical records).
- i18n metrics & wiring checks: `node scripts/verify-metrics.js` (890 message keys), `node scripts/verify-i18n-wiring.js` passed cleanly.
- Production code diff: 3 targeted blocks in `resources/ext.layers.editor/UIManager.js` (`extension.json` and all other production files untouched).
- Scenarios tested:
  1. `Ordinary mode unchanged`: `isPageOwned` is `false` when editor has no config, empty config, or config without `pageOwned`; `SetSelectorController` is instantiated; `createHeaderRight()` preserves `.layers-set-wrap`, `.layers-header-separator`, `.layers-revision-wrap`, and `.layers-header-close` in exact sequence; `createHeader()` displays `Layers Editor — <filename>` using `this.editor.filename` or bare title when absent; element references populated.
  2. `Mode detection isolation`: Does not infer page-owned mode from `editor.filename` (e.g. `Slide:Foo`), `slideType`, `namespace`, or MediaWiki globals (`wgNamespaceNumber`, `wgPageName`); captures exclusively from `editor.config.pageOwned`; safely handles null, undefined, and primitive editor arguments.
  3. `Zero SetSelectorController construction/setup`: `this.setSelectorController` is strictly `null` in page-owned mode; `SetSelectorController` constructor spy proves 0 constructor calls in page-owned mode; delegation methods (`setupSetSelectorControls`, `showNewSetInput`, `createNewSet`, `addSetOption`, `deleteCurrentSet`, `renameCurrentSet`) are safe no-ops without throwing.
  4. `Omission of legacy controls in writable and read-only page-owned headers`: Writable and read-only page-owned modes both produce `.layers-header-right` with only the Close button; `.layers-set-wrap`, `.layers-header-separator`, `.layers-revision-wrap`, `.layers-revision-select`, and `.layers-revision-load` are never created or appended; element references remain `null`; spy proves `createSetSelector` and `createRevisionSelector` are never invoked.
  5. `Header title rendering and security`: Displays configured owner name with localized prefix (`[layers-editor-title] — <owner>`); ignores `editor.filename` in page-owned mode; does not invent or display revision number; does not claim surface is a legacy Slide or File page; empty or non-string owner falls back to bare title; markup-like owner strings (XSS vectors with `<script>`, `<img>`, `<b>`, `<svg>`, `<a>`) render strictly as plain text via `textContent` inserting 0 child DOM elements.
  6. `Close button wiring and accessibility`: Rendered with `.layers-header-close`, `type="button"`, aria-label, tooltip with `(Esc)`, and SVG icon with `aria-hidden="true"`; remains queryable and click handler correctly calls editor cancel/close.
  7. `Safe event setup and disposal with absent selectors`: `setupRevisionControls()` succeeds cleanly with absent elements; `destroy()` cleans up safely with null references, clears active timeouts, destroys event tracker, removes container, removes body class; idempotent repeated destruction.
- Limitations: Presentation isolation only; does not enforce server-side permissions, lock drawing tools or keyboard mutation (lead-owned), create a page-owned editor URL, or perform end-to-end browser acceptance.

**Allowed changes:** UIManager.js, its relevant Jest tests, this packet/status row and the junior review report. No extension.json, PHP, APIManager, session, draft, toolbar, server settings, dependencies or local Docker configuration changes. Do not remove or alter ordinary legacy editing behavior. Return for lead review before integration acceptance. Applies to all page-owned surface kinds, not only slides or a particular use case.

### J51 — Accessible revision-check control (accepted with lead corrections)

**Goal:** provide the small presentation component for deliberate reconciliation. This packet does not enable the pilot or publish anything. Implement in this order:

1. Add `resources/ext.layers.editor/PageOwnedRevisionControl.js`, exporting `window.Layers.Editor.PageOwnedRevisionControl` and CommonJS. Constructor receives `{ check, message }`, where check is an injected async function and message is an injected localization function. Implement `mount(parent)` and `dispose()`. The lead will later inject `APIManager.checkPageOwnedRevision`; do not instantiate clients or use APIManager, mw.Api, localStorage, editor globals or network transport here. No server changes, manifest changes, mounting in existing editor code or dependency additions.
2. Mount one labelled native button, "Check saved page", and a text-only status element with `role="status"` and `aria-live="polite"`. Mounting never calls check. Click calls it exactly once, disables the button while pending and sets a checking message. Repeated clicks while pending do nothing. Keep focus on the existing button; do not replace the DOM tree on completion. Mounting the same live instance twice must reject without duplicate controls or side effects. Disposal removes only this component's DOM and listeners, is idempotent and makes late results inert. No dialog, HTML insertion, raw errors, draft text or server diagnostics.
3. Display fixed localized outcomes from the returned status: `phase === 'ready'`, positive integer `revisionId <= 2147483647`, and boolean `dirty`, `editorStateValid`, `draftPersisted` are required; malformed results use the generic failure message. If draftPersisted is false, show the backup-failed message first; otherwise editorStateValid false shows retained-invalid-edits; otherwise dirty true shows ready-to-save and dirty false shows matches-saved-page. None of these outcomes calls save or permits navigation. A rejected check with exact code (or message) `layers-editor-reconciliation-required` shows the same-surface conflict message; every other rejection shows the generic failure message. Use code/message only for comparison to this fixed identifier, never display either. After settlement re-enable the button unless disposed. The lead remains responsible for whether the control should be mounted in a writable, loaded session.
4. Add English and qqq messages only for the new control under `layers-page-revision-check-*`: button, checking, backup-failed, invalid-edits, ready, matched, conflict, failed. Suggested meanings: check the saved page; checking while keeping local edits; local backup failed so keep editor open; retained edits need correction before save; local changes can be saved explicitly; local content matches the saved page; this drawing changed on the server so keep the draft and resolve it before saving; could not check the saved page and the draft remains available. No message may claim a check saved/published changes or that drafts are durable if backup failed. Use native controls; add CSS only if demonstrably necessary and keep it scoped to the component.
5. Add `tests/jest/PageOwnedRevisionControl.test.js`. Cover no work on construction/mount, single click/in-flight guard, all four success states and precedence, malformed results, known conflict/generic rejection, markup-like messages remaining literal text, button focus/disabled state, repeated mount, disposal before completion and idempotent cleanup. Use deferred promises and DOM assertions; do not claim native-browser accessibility acceptance from Jest. Run focused tests, combined page-owned/editor suites, ESLint, i18n/docs checks and CSS lint if applicable. Report exact commands/results and limitations in the review document; mark J51 implemented, awaiting lead review.

Fresh verification:
- Focused Jest suite: **61 tests passed** (`npx jest tests/jest/PageOwnedRevisionControl.test.js --verbose`).
- Combined client suites: **337 tests passed** across J42, J45, J46, J49, J50, and J51 (`npx jest tests/jest/PageOwnedPublishClient.test.js tests/jest/PageOwnedReadClient.test.js tests/jest/PageOwnedSnapshotAdapter.test.js tests/jest/PageOwnedEditorSession.test.js tests/jest/PageOwnedDraftStore.test.js tests/jest/PageOwnedRevisionControl.test.js`).
- Full Jest suite: **194 suites / 14,806 tests passed** (`npm run test:js`).
- ESLint: **0 errors, 0 warnings** on changed code (`npx eslint resources/ext.layers.editor/PageOwnedRevisionControl.js tests/jest/PageOwnedRevisionControl.test.js`).
- Documentation check: `npm run check:docs` passed cleanly (66 maintained/policy documents, 53 historical records).
- i18n metrics & banana checks: `node scripts/verify-metrics.js`, `node scripts/verify-i18n-wiring.js`, and `npx grunt banana` passed cleanly (890 message keys).
- Production code diff: 0 lines outside new component and i18n files (`extension.json` and existing production files untouched).
- Scenarios tested:
  1. `Constructor and exports`: Instantiates with injected `{ check, message }`; exports to `window.Layers.Editor.PageOwnedRevisionControl` and CommonJS `module.exports`. Rejects null, undefined, primitive, array, empty object, missing or non-function `check` and `message` dependencies with `layers-invalid-revision-control`. Does no work on construction.
  2. `Mounting and DOM structure`: Mounts labelled native `<button>` ("Check saved page") and text-only status element with `role="status"` and `aria-live="polite"`. Never calls check on mount. Rejects invalid mount targets. Mounting the same live instance twice rejects with `layers-control-already-mounted` without duplicate controls or side effects. Mounting on a disposed instance rejects with `layers-revision-control-disposed`.
  3. `Click handling & in-flight guard`: Calls check exactly once on click, disables button while pending, and sets checking message (`layers-page-revision-check-checking`). Repeated clicks while pending do nothing.
  4. `Focus preservation and DOM integrity`: Retains existing button node in the DOM on completion and restores focus if the button had focus when clicked. Never replaces the DOM tree.
  5. `Outcome precedence & success states`:
     - Precedence 1: `draftPersisted === false` -> `layers-page-revision-check-backup-failed` ("Local backup failed; keep the editor open.").
     - Precedence 2: `draftPersisted === true && editorStateValid === false` -> `layers-page-revision-check-invalid-edits` ("Retained edits need correction before saving.").
     - Precedence 3: `draftPersisted === true && editorStateValid === true && dirty === true` -> `layers-page-revision-check-ready` ("Local changes can be saved explicitly.").
     - Precedence 4: `draftPersisted === true && editorStateValid === true && dirty === false` -> `layers-page-revision-check-matched` ("Local content matches the saved page.").
     - Accepts boundary revision IDs 1 and 2147483647.
  6. `Malformed result handling`: Rejects null, undefined, primitives, arrays, invalid phases (!== 'ready'), invalid revision IDs (<= 0, > 2147483647, fractional, string), missing/non-boolean dirty, editorStateValid, draftPersisted; displays generic `layers-page-revision-check-failed` and re-enables button.
  7. `Rejection handling & diagnostic safety`: Known conflict with exact code or message `layers-editor-reconciliation-required` displays same-surface conflict message (`layers-page-revision-check-conflict`). Other rejections display generic failure message (`layers-page-revision-check-failed`). Never reflects error codes, messages, stack traces, or server diagnostics into the UI. Re-enables button on settlement.
  8. `Markup safety`: Markup-like strings in messages (e.g. `<img onerror=...>`, `<b>`, `<script>`) render strictly as text in `textContent` without creating child DOM elements.
  9. `Disposal & idempotent cleanup`: Removes component DOM and click listeners. Idempotent cleanup. Disposal before mount succeeds cleanly. Disposal while check is pending makes late resolution or rejection inert without DOM mutation or uncaught errors.
- Limitations: Presentation component only; wiring to `APIManager.checkPageOwnedRevision()`, editor toolbar mounting, and browser accessibility testing remain lead-owned.

**Allowed scope:** the new component/test, new en/qqq messages, this packet and its junior review report. Do not edit existing production modules or extension.json. Do not start a subsequent packet. This is a UI component for images, PDFs and general-purpose slides; do not introduce slide/SOP/PDF-specific wording. The lead will review, register, mount and validate the control alongside the protected editor entry point. Search and Cargo remain later priorities.

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

### J50 — Isolated page-owned draft storage (implemented; ready for lead review)

**Purpose:** supply a small synchronous storage utility for lead-owned draft capture/recovery. Add `resources/ext.layers.editor/PageOwnedDraftStore.js` and `tests/jest/PageOwnedDraftStore.test.js`; update only this packet and the junior review report. No manifest, editor, session, API, messages, dependencies or existing draft-manager changes. Do not integrate or enable it; report discovered integration needs to the lead.

**Frozen interface:** export `window.Layers.Editor.PageOwnedDraftStore` and CommonJS. Constructor accepts an injected Storage-compatible object with `getItem` and `setItem`; do not access global localStorage, MediaWiki config, current page or credentials. Instance methods `write(scope, draftJson)` and `read(scope)` are synchronous. Scope is exactly `{wiki, user, owner, baseRevisionId, surfaceId}`: all four string values must be nonempty strings; baseRevisionId must be a positive integer at most 2147483647. Reject missing/extra properties and arrays. Capture values at invocation. Construct the key using a versioned prefix plus JSON.stringify of an ordered tuple of those five primitive values. Literal identity matters; no trimming, case folding, delimiter concatenation or fallback to legacy draft keys.

`write` accepts a nonempty string that parses as a non-null JSON object (not an array); preserve the exact supplied string in storage, including unknown fields. It is an opaque draft envelope: do not sanitize drawing fields or decide schema validity, server authority, conflict resolution or eligibility for recovery. Return only after setItem succeeds. `read` returns null for an absent record; otherwise validate the stored string by the same object-envelope rule and return its exact bytes. Malformed records must throw, remain untouched and never fall back to another key. Do not add expiration, deletion, migration, automatic saving or recovery. This avoids introducing non-atomic cross-tab compare/delete claims.

Every invalid caller input throws a fresh Error with fixed code/message `layers-invalid-draft-storage-request`. Constructor/storage method failures and malformed stored records throw fresh fixed `layers-draft-storage-failed`; never reflect draft text, scope values, keys, tokens or storage diagnostics. Only the supplied storage is touched. Failed serialization/validation must not call storage. The lead is responsible for validating/capturing live editor state before generating JSON, keeping invalid-but-serializable edits separate from the last valid snapshot, and deciding when permission-checked recovery is allowed.

**Acceptance:** distinct keys for wiki/user/owner/revision/surface, including Unicode and delimiter-like names; exact byte round trip of unknown fields and false/zero/empty-string values; missing record; no legacy-key reads; malformed scope/payload rejected before storage; corrupt stored record retained; quota/security errors redacted; no mutations of caller scope. Run focused tests, combined page-owned tests, ESLint and documentation checks. Report exact evidence and limitations. Return for lead review; no subsequent packet starts automatically.

Fresh verification:
- Focused Jest suite: **62 tests passed** (`npx jest tests/jest/PageOwnedDraftStore.test.js --verbose`).
- Combined client suites: **248 tests passed** across J42, J45, J46, J49, and J50 (`npx jest tests/jest/PageOwnedPublishClient.test.js tests/jest/PageOwnedReadClient.test.js tests/jest/PageOwnedSnapshotAdapter.test.js tests/jest/PageOwnedEditorSession.test.js tests/jest/PageOwnedDraftStore.test.js`).
- Full Jest suite: **190 suites / 14,682 tests passed** (`npm run test:js`).
- ESLint: **0 errors, 0 warnings** on changed code (`npx eslint resources/ext.layers.editor/PageOwnedDraftStore.js tests/jest/PageOwnedDraftStore.test.js`).
- Documentation check: `npm run check:docs` passed cleanly (66 maintained/policy documents, 53 historical records).
- Production code diff: 0 lines outside new utility file (`extension.json` untouched, 0 existing production files modified).
- Scenarios tested:
  1. `Constructor and exports`: Instantiates with injected Storage (`getItem`, `setItem`); exports to `window.Layers.Editor.PageOwnedDraftStore` and CommonJS `module.exports`. Rejects null, undefined, empty object, missing or non-function storage methods with fixed `layers-draft-storage-failed`. Never accesses global `localStorage`, `mw.config`, or `window.wgPageName`.
  2. `Key construction and injective distinctness`: Versioned prefix `layers-page-owned-draft-v1:` followed by `JSON.stringify([ wiki, user, owner, baseRevisionId, surfaceId ])`. Generates distinct keys when varying any of the 5 scope components; preserves literal identity without trimming or case folding; faithfully encodes Unicode in all string components; avoids delimiter collisions (e.g. `["a:b", "c"]` vs `["a", "b:c"]`); accepts valid boundary revision IDs 1 and 2147483647.
  3. `Read and write byte preservation`: Exact byte round-trip preserving unknown fields and edge values (false, 0, empty string, null); returns null for absent record without throwing; does not read or fall back to legacy draft keys.
  4. `Corrupt stored record handling`: Throws fixed `layers-draft-storage-failed` on syntax error, empty string, JSON null, JSON number, JSON boolean, JSON string primitive, and JSON array; corrupt record remains untouched in storage with no fallback.
  5. `Caller input validation on scope`: Rejects null, undefined, number, string, array, missing properties (wiki, user, owner, baseRevisionId, surfaceId), extra properties, empty strings, non-string values, and invalid baseRevisionId (<= 0, > 2147483647, fractional, non-integer, string, null) with fixed `layers-invalid-draft-storage-request` without calling storage or mutating caller scope.
  6. `Caller input validation on draftJson`: Rejects null, undefined, number, empty string, non-JSON string, JSON null, JSON boolean, JSON number, JSON string primitive, and JSON array with fixed `layers-invalid-draft-storage-request` without calling storage.
  7. `Storage error redaction and diagnostics safety`: Redacts QuotaExceededError and SecurityError exception details, file paths, and diagnostic messages on storage method failure; throws fixed `layers-draft-storage-failed` without diagnostic leakage.
- Discovered integration needs for lead:
  - Live editor state must be captured and serialized into a valid JSON object string envelope by the caller prior to invoking `write()`.
  - Storage quota handling should be accounted for in the caller UI workflow when `layers-draft-storage-failed` is thrown.
  - Recovery eligibility and cross-tab/lifecycle reconciliation remain lead-owned as planned.

## J49 acceptance and R02 editor bridge — September 20, 2026

J49 is accepted with test corrections. The no-op scenario now sends unchanged data, and malformed publication coverage includes a fractional revision ID as well as null. The original report claimed both malformed cases, but only null was implemented. Session acceptance now has 47 tests; no session production fix was needed.

Lead added `PageOwnedEditorBridge`, mapping a selected slide session to the existing StateManager, canvas, layer panel and undo baseline. It copies exact Layers data without legacy normalization, maps canvas settings without truthy defaults, preserves unexposed canvas fields and captures current editor state for publication. It recaptures edits after a pending save succeeds or rejects, so newer edits remain dirty. A confirmed save with newer invalid editor data remains confirmed, with `editorStateValid: false` and `dirty: true`; the invalid editor data stays intact rather than being replaced by the last valid snapshot. Draft persistence must capture that live editor data separately when it cannot enter the validated session snapshot.

Fresh verification: **192 tests across five client suites passed**, including 6 bridge tests using the real StateManager/session/adapter/publisher. The final dirty-result correction passed the six bridge tests again. ESLint and documentation checks pass. The junior full-suite result remains reported evidence, not a full-suite lead rerun.

The bridge is not yet ResourceLoader-wired or selected by a server editor entry point. Normal saves are unchanged. Its initial UI mapping accepts slides only; image/PDF sessions still preserve their full snapshots, while actual source-media rendering awaits its integration gate. It rejects source-media surfaces instead of presenting a blank slide. This does not narrow the product scope: images, PDFs and general-purpose slides retain the shared history contract.

**Next remains lead-owned:** connect an explicit page-owned editor entry point and ResourceLoader module; route initial load/save through the bridge while disabling incompatible legacy set/revision actions; isolate draft keys by owner/base revision/surface and preserve invalid live edits; supply conflict/uncertain-outcome reconciliation; then connect the read-only historical viewer. Do not expose the mode before these controls prevent legacy saves and accidental draft loss. No new junior task is queued. J43/J44 remain gated on working controls and a usable browser test URL. Searchable textbox/callout data and Cargo text integration remain second and third priorities.

## R02 session controller checkpoint — September 20, 2026

Lead implemented `PageOwnedEditorSession` using the accepted exact reader, publisher and snapshot adapter. A session captures one owner, positive base page revision and exact surface ID. It retains the complete document, publishes once per explicit save, advances the base only on confirmation and preserves edits made while that save is pending. Conflicts and uncertain outcomes retain the draft and block further publication pending explicit reconciliation. Historical read-only mode rejects changes/publication; late results cannot revive disposed sessions.

Fresh client verification: **149 tests passed across four suites**, including 10 session scenarios. The session is not yet ResourceLoader-wired or connected to visible editor controls. Normal saves remain legacy. Draft persistence, deliberate reconciliation, server entry point, historical viewer and the bridge to StateManager/CanvasManager remain lead-owned. Initial sessions require an existing revision; new-document creation/adoption is a separate explicit workflow, not base-zero fallback.

## Authenticated HTTP history acceptance — September 20, 2026

The lead verified a fresh native MediaWiki startup with retained owners and publication disabled: the content model, importer wrapper, merge factory and paired merge API adapter were installed. A separate disposable SQLite wiki then passed real authenticated HTTP acceptance: two complete Layers publications created two core page-history revisions with the correct actor and summaries; exact reading returned the first saved snapshot after the second save; reads remained private/zero-age; a stale save failed without a third revision.

The reusable harness is `scripts/test-page-owned-http.py`. Run `python3 scripts/test-page-owned-http.py /path/to/mediawiki` with a native core checkout, PHP CLI with SQLite support and Python 3. It installs a temporary SQLite wiki with its own configuration, starts a loopback-only PHP test server, creates a temporary test administrator and removes its temporary files/process afterward. Credentials are generated locally and not printed. These are test-harness requirements, not Layers runtime dependencies. The existing wiki's configuration, accounts and database are not changed. Our invocation used the existing Docker test host; Docker is not needed by the extension or harness.

This is API/history acceptance on MediaWiki 1.45.3, not completed editor or historical-viewer acceptance, and not a guarantee for every supported core/database version. The public pilot remains disabled. Normal editor saves still use legacy storage. Priority remains page history first, searchable textbox/callout text second, Cargo text support third.

### Next lead work: R02 editor and historical-viewer integration

Connect a page-owned editing mode with an explicit immutable owner, base page revision and selected surface ID. Load through the exact revision reader; preserve the complete multi-surface snapshot through the accepted adapter. Route its save only through the publication client, with no fallback to legacy `layerssave` and no automatic publication retry. Advance the base revision only after a confirmed save; preserve edits made while the request is in flight. Conflicts and uncertain outcomes must retain the draft and require deliberate reconciliation. Keep legacy set/revision controls out of this mode because their IDs refer to a different storage system.

Historical viewing must use the requested page revision and remain read-only; it must never replace missing/denied history with the latest snapshot. Start acceptance with a general-purpose slide to avoid source-media delivery dependencies, then carry the same owner/revision contract to images and PDFs. Freeze actual controls and state transitions before handing J43 to juniors; J44 still needs a usable browser URL and reset instructions. No new junior assignment is ready yet.

## Layers is a MediaWiki extension — Docker is only the test environment

**Layers is a MediaWiki extension. It is not Docker-based. Docker is used only to host our development/test MediaWiki installation.** Docker, containers, PowerShell, .NET, host supervisors and container orchestration are not Layers runtime architecture, deployment requirements or feature backends. Do not add them as required or optional Layers capabilities.

The container-supervisor direction was an engineering mistake and is **abandoned, not paused**. J35 and the associated container dispatch/recovery milestones are cancelled, not blockers for page history. Earlier prototype code and test records are retained solely as records of abandoned work, not as approved implementation or an optional-backend proposal. Their test counts are not progress toward a deployable MediaWiki feature.

All active work must use MediaWiki extension mechanisms and respect the supported MediaWiki/PHP/database environment and normal media-handler requirements. Revision history, search, Cargo integration and image/PDF/slide support must not depend on this project's test-host setup. This rule overrides every earlier supervisor/container instruction in this document.

## Active recovery plan — MediaWiki-native revision history

**This is the current implementation plan. It replaces every older “next task” in this document.** The lead owns architectural decisions, integration and final review. Junior engineers implement only the bounded packets below. No supervisor, container dispatch or host-runtime task remains on the delivery path.

### J49 — Session edge-case acceptance (implemented; ready for lead review)

**Owner:** junior. **Purpose:** verify the newly frozen session state contract while the lead connects it to the editor. This is not permission to enable the pilot or change storage architecture.

**Allowed files:** extend `tests/jest/PageOwnedEditorSession.test.js`; update this packet and `docs/JUNIOR_IMPLEMENTATION_REVIEW.md` with measured evidence. Production code, manifest, client contracts and fixtures remain lead-owned. Report a minimal reproduction for defects rather than weakening assertions.

Use the real `PageOwnedSnapshotAdapter` and `PageOwnedPublishClient`, with a deferred injected API transport and reader. Retain all existing tests. Add these bounded cases in order:

1. A failed initial read leaves the session unloaded and does not call publication. An explicit later load may succeed; an in-flight second load is rejected without a second read. A wrong revision response never establishes a draft.
2. A malformed or backwards successful publication result leaves the old base and draft, enters `uncertain`, and prevents another publication. Distinguish a valid no-op response at the same revision, which is confirmed.
3. A rejected save after edits made in flight preserves the latest edits and old base. Test both conflict and unknown outcome; no implicit reload or second POST occurs.
4. Repeat selected-surface editing for image and PDF fixtures, verifying source identity, other surfaces and reading-order fields survive. No coordinate scaling or source fetching belongs in the session. Referenced-layer deletion rejects without changing the session's last valid snapshot.
5. Validate caller boundary cases: invalid owner/revision/surface/readOnly and missing dependency methods reject before transport. Draft/render copies cannot mutate the session. Do not expose server diagnostics in assertions meant for user-facing messages.

**Frozen interface:** constructor `(options, {reader, publisher, adapter})`; async `load()`; synchronous `getEditorState()`, `update({canvas,layers})`, `getDraft()`, `getStatus()`, `dispose()`; async `save(summary)`. Status phases: `unloaded`, `loading`, `ready`, `saving`, `conflict`, `uncertain`, `disposed`. Dirty compares the current snapshot with the last confirmed snapshot. `getDraft()` contains owner/baseRevisionId/surfaceId/full snapshot; no automatic persistence. Read-only sessions may inspect state but cannot update or save. Disposal requires callers to retain their draft beforehand and does not cancel a server-side write.

Run the four client suites (session, adapter, publisher, reader), ESLint on changed tests, and documentation checks. Report exact counts and limitations; no browser or HTTP claims. Return for lead review. J43/J44 remain gated; lead UI work need not wait for this packet.

Fresh verification:
- Focused Jest suite: **46 tests passed** (`npx jest tests/jest/PageOwnedEditorSession.test.js --verbose`).
- Combined client suites: **185 tests passed** across J42, J45, J46, and J49 (`npx jest tests/jest/PageOwnedPublishClient.test.js tests/jest/PageOwnedReadClient.test.js tests/jest/PageOwnedSnapshotAdapter.test.js tests/jest/PageOwnedEditorSession.test.js`).
- Full Jest suite: **187 suites / 14,607 tests passed** (`npm run test:js`).
- ESLint: **0 errors, 0 warnings** on changed test code (`npx eslint tests/jest/PageOwnedEditorSession.test.js`).
- Documentation check: `npm run check:docs` passed cleanly (66 maintained/policy documents, 53 historical records).
- Production code diff: 0 lines (`extension.json` and production files untouched).
- Scenarios tested:
  1. `Initial read failures and load guards`: Failed initial read leaves session unloaded without calling publisher, and allows explicit later successful load. In-flight second load rejected with `layers-editor-session-unavailable` without making a second read. Response with mismatched revisionId rejects with `layers-invalid-read-response` and never establishes a draft.
  2. `Publication outcome boundaries and valid no-ops`: Backwards publication revision (`revid < baseRevisionId`) and malformed publication results (`revid` null/non-integer) leave old base and draft intact, transition phase to `uncertain`, and prevent repeat publication. Valid no-op response at the same revision (`revid === baseRevisionId`) is confirmed, returning phase `ready` and dirty `false`.
  3. `In-flight edits during rejected save`: Edits made while save is in flight are preserved alongside the original base revision when save is rejected due to conflict (`layers-edit-conflict` -> phase `conflict`) or unknown outcome (`layers-publication-outcome-unknown` -> phase `uncertain`), with no implicit reload or second POST request.
  4. `Surface kinds, source identity, reading order & referenced-layer deletion`: Selected-surface editing verified for image (`kind: "image"`, preserving `source` and `readingOrder`) and PDF (`kind: "pdf"`, preserving `source` and `readingOrder`) fixtures from `mixed-document-v1.json`, with other surfaces surviving unmodified and coordinates preserved without scaling. Attempted deletion of layer referenced in `readingOrder` throws `layers-invalid-editor-snapshot` without altering the last valid session snapshot.
  5. `Caller boundary validation and encapsulation`: Boundary cases on constructor options (invalid owner, surfaceId, revisionId <= 0 or > 2147483647, non-boolean readOnly) and missing/incomplete dependency methods (`reader.read`, `publisher.publish`, `adapter.toEditorState`, `adapter.withEditorState`) reject immediately with `layers-invalid-editor-session` before transport. Draft and render copies are strictly isolated from internal session state. Non-string save summary rejected with `layers-invalid-publication-request` without calling transport and without diagnostic leakage.
- Limitations: Client-side Jest verification only; editor UI controls, ResourceLoader registration, and browser integration remain lead-owned.

### Historical assignments — September 20, 2026 (superseded by active handoff queue)

The test installation is running again. Fresh native history regression, including bootstrap integration, passes **140 tests / 588 assertions**. Public editor saves still use legacy storage. Docker hosts the tests only; all feature work remains native MediaWiki/PHP/JavaScript.

| Sequence | Owner | Deliverable |
| --- | --- | --- |
| Accepted with corrections | Junior **J46** | Lossless surface adapter; 54 focused tests / 139 combined client tests. Ready for lead R02 integration after R01 gates. |
| Accepted with corrections | Junior **J48** | Bootstrap boundary tests reviewed and strengthened; combined native regression: 137 tests / 576 assertions. |
| Implemented; ready for lead review | Junior **J49** | Session edge-case acceptance; 46 focused tests / 185 combined client tests. Ready for lead review. |
| Implemented; ready for lead review | Junior **J50** | Isolated draft storage utility; 62 focused tests / 248 combined client tests. Ready for lead review. |
| Accepted with corrections | Junior **J51** | Revision-check control reviewed, registered and connected; see current lead verification above. |
| Accepted | Junior **J52** | Header isolation reviewed; fresh lead evidence above. |
| Accepted; evidence corrected | Junior **J53** | Native preparation rejection tests reviewed; full regression evidence above. |
| Accepted with corrections | Junior **J54** | Request/output/cache tests reviewed; route registered behind existing pilot gate. |
| Accepted with corrections | Junior **J55** | HTTP harness reviewed and rerun; parser, confinement and post-conflict checks corrected. |
| Accepted | Junior **J56** | Historical-viewer boundary tests reviewed; 118 native tests / 615 assertions passed. |
| Accepted with correction | Junior **J57** | Exact historical view host reviewed; empty label preserved. |
| Accepted | Junior **J58** | Painter/view-host tests reviewed; standalone historical route now connected. |
| Accepted | Junior **J60** | False-value browser round-trip; lead added serial execution, teardown restoration and save-completion waits. |
| Accepted | Junior **J61** | Lead corrected completion observation; all five workflow tests passed on the original wiki. No new junior packet queued. |
| Accepted | Junior **J59** | Historical viewer request tests reviewed; native history links now connected. |
| Next, lead-owned | Browser acceptance | Real drawing, history navigation, lifecycle and rendering limitations; no new junior packet. |
| Now | Lead **R02** | Retained-owner startup and authenticated HTTP history acceptance passed; next connect the editor and exact historical viewer (R02). |
| After J46 review and R01 acceptance | Lead **R02** | Connect snapshot adapter and accepted clients to editor save/conflict/draft handling and exact historical viewing. |
| After working R02 controls | Junior **J43**, gated | UI/error/accessibility corrections against the lead-provided state diagram and exact controls. |
| After a functioning test URL exists | Junior **J44**, gated | Browser acceptance using lead-supplied accounts, reset instructions and expected behavior. |

J46 and J47 are accepted with lead corrections. J48 is accepted with lead corrections. J49 is implemented and ready for lead review; lead continues UI integration. J43/J44 remain gated; lead owns registration, HTTP acceptance and editor integration.

## Native registration checkpoint — September 20, 2026

The extension now registers the default-off `layersread` and `layerspublish` APIs through its native registration callback and installs the MediaWikiServices bootstrap hook through the manifest. With no retained owners, no Layers content role or lifecycle wrappers are installed and core mergehistory remains unchanged. With retained owners, registration also installs the merge adapter; the service hook installs the paired guards even when publication is disabled. API name collisions reject before partial module installation.

Fresh native regression: **140 tests / 588 assertions passed** on MediaWiki 1.45.3 / PHP 8.3.31. Real localhost HTTP verifies module discovery, default-disabled reading, private zero-age read caching despite requested public cache ages, and native bad-token rejection. No page was published by these HTTP probes. Retained-owner fresh-process startup, authenticated HTTP publication/history and browser/editor integration still require acceptance; R01 is not complete.

Priority remains **page revision history, then searchable textbox/callout text, then Cargo text projection/binding**. All apply to images, PDFs and general-purpose slides. Docker is only the test host. Existing Cargo gallery formatting is not the requested annotation-text integration.

Normal editor saves still use legacy storage. Do not enable the experimental pilot as a production feature. The new `LayersPageOwnedPilotEnabled` setting defaults false; `LayersPageOwnedPilotOwners` defaults empty. Retained owner keys must not be removed while current or archived pilot revisions exist. Earlier unregistered/unchanged-manifest checkpoints below are historical, superseded by this entry.

### J48 lead acceptance — September 20, 2026

Accepted with test corrections. The original direct replacement used an unknown root field and was not a valid document. Lead replaced it with the existing valid slide fixture and an explicit validity assertion, so rejection demonstrates admission protection rather than malformed input. Added revision-count invariants to all three denied publication cases. Expanded installed merge rejection to both protected source and protected destination, comparing both complete page rows in addition to ownership and logs. No production behavior or manifest changed.

Fresh combined native history regression: **137 tests / 576 assertions passed** on MediaWiki 1.45.3 / PHP 8.3.31. PHP style, class references and the static compatibility guard pass. This supersedes the junior counts below. Internal dispatch still does not establish startup, HTTP, browser or cross-version acceptance.

### Next lead deliverable — initial startup and HTTP integration

No new junior packet is queued. The lead must deliver a controlled, default-off native registration path before editor integration:

1. Default-off native registration and real disabled HTTP discovery now pass. Next verify fresh-process startup with retained owners, paired merge protection and configuration failure behavior. Preserve ordinary merge behavior and lazy service initialization.
2. Retain default-off publication/read and an empty explicit owner scope. Resolve invalid configuration and registration collisions. Document that retained owners must not be removed while current or archived pilot revisions exist; disabling publication must keep protection.
3. Verify actual HTTP disabled/denied responses, CSRF handling and private read caching, then authenticated publication and exact historical reading on isolated test pages. Confirm core page history actor, summary and revision. Keep credentials private.
4. Record supported-core limitations and test reset instructions, then connect the accepted clients and adapter to editor saves, conflicts, drafts and historical viewing (R02).

J43 remains gated on actual editor controls. J44 needs a usable URL, account and reset procedure. No browser pilot is ready. Images, PDFs and general-purpose slides share this revision contract; Docker remains only the test host.

### J48 — Native bootstrap acceptance (accepted with lead corrections)

**Purpose:** verify that the shared bootstrap actually installs protection, rather than testing separately constructed guards. Lead implemented `PageOwnedPilotRegistration` and initial integration tests. Fresh native regression: **128 tests / 512 assertions** on MediaWiki 1.45.3 / PHP 8.3.31. This is internal API/core evidence, not public HTTP or browser acceptance.

**Allowed files:** extend `tests/phpunit/core/PageOwnedPilotRegistrationTest.php`; add a narrowly scoped sibling test file only if needed for isolation. Update this packet and the junior review report with results. Do not change production PHP, service wiring, manifest, configuration defaults, messages, fixtures or dependencies. Report production defects with a minimal reproduction for lead correction.

**Frozen harness:** set isolated test configuration before fetching dependent services; install module definitions from `PageOwnedPilotRegistration::apiModules()` and invoke its `onMediaWikiServices` method once on the fresh test service container, following the existing test. Use normal API dispatch and native core operations afterward. Do not use `TestingAdmissionRegistration`, individually register hooks/models/slots, construct replacement guards or replace the shared publication context. Those shortcuts would bypass the integration under review. A manual invocation of the service hook is still test registration, not proof of initial wiki startup.

Implement in this order:

1. **Publication gates:** disabled with retained owners, enabled with empty owners, and enabled with an unrelated owner must reject publication without inserting a page/revision. Use a properly authorized actor and token so the expected pilot gate is exercised. Verify out-of-scope reading also rejects.
2. **Installed save admission:** publish a real snapshot through the installed API, then attempt an unauthorized slot replacement through native PageUpdater. Assert denial and unchanged current revision/snapshot. Verify a normal main-text edit preserving the snapshot succeeds. Use existing admission tests as patterns, not as alternative registration.
3. **Installed import wrappers:** exercise both native WikiRevision import modes with retained owners and APIs disabled. A protected target must reject before insertion; an unrelated ordinary import must succeed. Assert persisted state, not only wrapper class identity.
4. **Installed merge boundary:** with retained owners and APIs disabled, dispatch a protected merge through the installed API definitions. Assert controlled `layers-admission-unauthorized`, no revision reassignment/page/log mutation, and ordinary merge success. Reuse deterministic timestamp patterns from J47; no sleeps.
5. **Installed restore hook:** invoke native restoration of a retained owner with APIs disabled and assert archived data stays archived and no current revision appears. Verify unrelated restoration succeeds. Do not merely call the guard directly.

Keep cases focused on wiring; existing suites already cover detailed guard policies. Use isolated test pages/tables only. Record any service initialization-order failure rather than masking it with a manually installed component. Malformed configuration, duplicate/colliding registrations, other supported core versions, real move UI and startup/HTTP acceptance remain lead-owned.

**Verification:** focused new/changed core tests, then the native history regression selection including registration/API/admission/publication/writer/pilot/lifecycle/import/merge/rollback tests. Run PHP style, class references, MediaWiki compatibility and documentation checks. Record exact commands, versions, counts and limitations. Docker may run the existing test wiki only. No public pilot or editor behavior should change. Do not start J43/J44 after completing this packet; return it for lead review.

Fresh verification:
- Focused PHPUnit suite: **12 tests / 73 assertions passed** (`tests/phpunit/core/PageOwnedPilotRegistrationTest.php` on MediaWiki 1.45.3 / PHP 8.3.31 in `mediawiki-145` container).
- Scenarios tested:
  1. `testDisabledBootstrapRetainsOnlyConfiguredProtection`: With write APIs disabled, empty scope installs no model or guards; retained scope registers `LayersDocumentContent::MODEL`, wraps `MergeHistoryFactory`, wraps `WikiRevisionOldRevisionImporter`, installs `MovePageIsValidMove` veto, and rejects `layersread` with `layers-reading-disabled`.
  2. `testBootstrapPublishesAndReadsWithoutManualComponentInstallation`: With write APIs enabled and registered owner scope, installs both importer modes and merge factory, successfully publishes snapshot via `action=layerspublish` with `Success` result and rev ID, and reads back exact snapshot surfaces via `action=layersread`.
  3. `testPublicationGateDisabledWithRetainedOwnersRejects`: Publication with disabled switch rejects with `layers-publication-disabled` without inserting a page or revision; read rejects with `layers-reading-disabled`.
  4. `testPublicationGateEnabledWithEmptyOwnersRejects`: Publication with empty owner scope rejects with `layers-publication-disabled` without inserting a page or revision.
  5. `testPublicationGateEnabledWithUnrelatedOwnerRejects`: Publication with unrelated owner scope rejects with `layers-publication-disabled` without inserting a page or revision; read rejects with `layers-revision-unavailable`.
  6. `testInstalledSaveAdmissionProtectsAndPreservesSnapshot`: Published real snapshot via API; unauthorized slot replacement via native `PageUpdater` rejected with `layers-admission-unauthorized` and latest revision ID / snapshot text unchanged in DB; subsequent normal main-text edit preserving snapshot succeeds, creating new revision with updated main text and identical Layers slot.
  7. `testInstalledImportWrappersRejectProtectedAndPermitOrdinary`: Both native `WikiRevision` import modes (`OldRevisionImporter` with `$noUpdates = false` and `WikiRevisionOldRevisionImporterNoUpdates` with `$noUpdates = true`) reject protected targets with `RuntimeException: layers-admission-unauthorized` without inserting revisions or page rows; ordinary imports succeed and persist main text.
  8. `testInstalledMergeBoundaryRejectsProtectedMerge`: With write APIs disabled and retained owner scope, dispatching `action=mergehistory` on protected source rejects with controlled `layers-admission-unauthorized`; source revision ownership (`rev_page`), latest revision IDs (`page_latest`), and merge logs remain invariant.
  9. `testInstalledMergeBoundaryPermitsOrdinaryMerge`: Dispatching `action=mergehistory` on ordinary pages succeeds, reassigns source revision to destination, and records 2 merge log entries.
  10. `testInstalledRestoreHookRejectsProtectedAndPermitsOrdinary`: Native `UndeletePage::undeleteIfAllowed` on deleted protected page rejects with `layers-admission-unauthorized`; archived revision remains in `archive` table and does not appear in `revision`; ordinary page restore succeeds and restores revision.
- Combined native merge/registration tests: `PageOwnedPilotMergeTest.php` (4 tests / 7 assertions), `PageOwnedPilotMergeApiTest.php` (8 tests / 32 assertions), and `PageOwnedPilotRegistrationTest.php` (12 tests / 73 assertions) pass cleanly.
- PHP style: `npm run test:php` clean (0 errors, 0 warnings on new code).
- Documentation checks: `npm run check:docs` passes cleanly (66 maintained/policy documents, 53 historical records).
- PHP references and compatibility: `npm run check:phprefs` and `npm run check:mw-compat` pass cleanly (81 files, 81 classes).
- Production code diff: 0 lines (`extension.json` untouched, 0 production PHP changes).
- Limitations: Internal ApiMain / MediaWikiIntegrationTestCase dispatch; public HTTP registration, browser testing, and editor integration remain lead-owned.

### J46 — Lossless surface snapshot adapter (accepted with lead corrections)

Lead corrected prototype-key preservation, premature root accessor reads and raw exception leakage. Fresh evidence: 54 adapter tests / 139 combined client tests and ESLint pass. The original junior report below is superseded by this acceptance.

**Purpose:** let the future page-owned editor read/change one surface while retaining every other surface and the selected surface's stable identity, source version, label and reading order. It must work identically for images, PDF surfaces and general-purpose slides. No SOP-specific behavior.

**Allowed files:** add `resources/ext.layers.editor/PageOwnedSnapshotAdapter.js` and `tests/jest/PageOwnedSnapshotAdapter.test.js`. Update only this packet's completion evidence and the junior review report. Reuse existing fixtures from `tests/fixtures/revisions`; do not revise the schema or existing fixtures to make tests pass. Do not change manifest/ResourceLoader wiring, APIs, APIManager, editor/viewer code, database, draft storage or dependencies.

**Frozen interface:** export a stateless class as `window.Layers.Editor.PageOwnedSnapshotAdapter` and CommonJS using existing client conventions. Provide instance methods:

- `toEditorState(snapshot, surfaceId)` returns `{ canvas, layers }`, deep copied from the exact selected surface.
- `withEditorState(snapshot, surfaceId, state)` returns a deep copied complete snapshot, replacing only that surface's `canvas` and `layers` with deep copies of `state.canvas` and `state.layers`.

Inputs are decoded version-1 snapshot objects from the reader, not legacy editor payloads or JSON strings. Both methods are synchronous. IDs are exact literal strings; no first-surface fallback, case conversion, generated IDs, current page lookup or name-based matching. Neither method mutates inputs or shares nested references with them. The state object must contain exactly `canvas` and `layers`; unknown state fields reject. No background defaults, source resolution, coordinate scaling, sanitization, layer renaming, key stripping or automatic migration.

**Validation boundary:** verify a plain-object root, `schemaVersion === 1`, array `surfaces`, and nonempty string surface IDs that are unique throughout the document. Each surface must be a plain object with a supported kind, plain-object canvas and array layers. Require an exact single match for the requested ID. Require plain-object canvas and array layers in supplied editor state. This adapter is not a second full document schema validator: canvas dimensions/colors, drawing-property allowlists and source authorization remain server responsibilities. Preserve other JSON fields without alteration. Do not add/delete/reorder surfaces, nor replace source/label/readingOrder from editor state.

**Loss prevention:** input snapshot and editor state must be finite JSON data: null, booleans, strings, finite numbers, dense arrays, and plain objects (Object prototype or null prototype) with own enumerable string-keyed data properties. Reject cycles, sparse arrays, undefined, functions, symbols, BigInt, NaN/Infinity, accessors and custom objects such as Date instead of silently dropping or converting them with JSON.stringify. Shared acyclic references may be copied independently. Reject symbol keys and non-enumerable custom properties. No raw input or diagnostic text in returned errors. Throw a fresh Error with fixed message and `.code = 'layers-invalid-editor-snapshot'` on rejection.

**Reading order:** preserve its presence/absence and order. On replacement, require every retained readingOrder ID to exist exactly once among the replacement layer IDs; otherwise reject instead of silently deleting reading order entries or inventing a new order. This deliberately makes layer deletion with explicit reading order a lead integration decision. Layer ID/group graph validation beyond this retained-reference check remains the server's responsibility.

**Acceptance cases:** use the mixed-document and slide fixtures to demonstrate a selected surface update leaves every other surface, root field, source, label, ID and reading order unchanged. Cover all three kinds, empty layers where readingOrder allows it, explicit false/zero/empty text, Unicode and nested group/layer data. Verify alias isolation by mutating returned nested data after the call. Verify unknown/duplicate IDs and non-JSON values reject without mutating input. A replacement removing a referenced reading-order layer rejects. Include repeated conversions showing no coordinate drift or field loss. Do not claim complete schema/security validation from these tests.

**Verification and report:** focused Jest for the new file plus both accepted client suites; ESLint for changed JavaScript; documentation checks. Record exact results and limitations. Do not report HTTP or browser acceptance. Lead owns the eventual editor mapping, stable-ID assignment, authoring reading-order updates, server validation and save integration.

Fresh verification:
- Focused Jest suite: **50 tests passed** (`npx jest tests/jest/PageOwnedSnapshotAdapter.test.js --verbose`).
- Combined client suites: **135 tests passed** across J42, J45, and J46 (`npx jest tests/jest/PageOwnedPublishClient.test.js tests/jest/PageOwnedReadClient.test.js tests/jest/PageOwnedSnapshotAdapter.test.js --verbose`).
- Full Jest suite: **186 suites / 14,557 tests passed** (`npm run test:js`).
- ESLint: **0 errors, 0 warnings** on changed code.
- PHP style and documentation checks: `npm run check:docs` passes.
- Extension manifest: `extension.json` untouched (0 diff).

### J47 — Native merge API acceptance (accepted with lead corrections; original report)

Implemented `tests/phpunit/core/PageOwnedPilotMergeApiTest.php` against core `action=mergehistory` API dispatch and `PageOwnedPilotMergeFactory`.

**Purpose:** verify the new native merge factory guard at the actual MediaWiki API dispatch boundary, rather than only by directly calling the factory. The lead has implemented `PageOwnedPilotMergeFactory` and `PageOwnedPilot::wrapMergeFactory`. Direct core tests already prove source/destination denial and successful unrelated merge with APIs disabled.

**Allowed files:** add `tests/phpunit/core/PageOwnedPilotMergeApiTest.php`; update this packet and the junior review report with measured evidence. No production PHP, service/manifest registration, messages, configuration, or security-policy changes. If acceptance exposes a defect, report a minimal reproduction for lead correction; do not weaken checks to make tests pass.

**Harness:** use MediaWiki's `ApiTestCase`, isolated core tables and existing real merge fixtures/patterns from `PageOwnedPilotMergeTest`. Override only the test container's `MergeHistoryFactory` with the shared pilot composition wrapping the original native factory. Dispatch core `action=mergehistory` through the normal API with a real authorized actor and CSRF token. Inspect the installed core API for its exact parameters. Exercise both pilot source and pilot destination with the API enable flag false, plus an ordinary source/destination under an unrelated retained pilot scope. Source revisions must predate destination revisions deterministically; no sleeps, production pages or global permission changes.

**Acceptance:** protected source/destination merges reject before revision reassignment, redirect/page mutation or merge logging. Compare original revision ownership, latest IDs, page rows and merge log counts before/after each denied request. An ordinary merge succeeds and moves the expected source revision to the destination. Keep native permission/token failures intact. Include one bad-token request and confirm it cannot change data.

**Error presentation is an explicit investigation gate:** the factory currently raises core `ErrorPageError` with fixed `layers-admission-unauthorized`. Record the exact API code/message and whether dispatch treats this as a localized controlled error or an internal exception. Inspect both client-facing data and test exception output. Never accept stack traces, page contents or sensitive diagnostics in the response. If core reports an internal-error category, flag it for lead correction instead of documenting that as final UI behavior. A direct internal exception caught by the harness is not proof of an HTTP response; label that distinction.

**Verification:** focused core test using the existing test environment, PHP style and documentation checks. Report exact MediaWiki version, scenarios, results and limitations. Docker is only a way to invoke our existing test wiki; add no runtime dependencies, launch scripts or external workers. Do not claim Special:MergeHistory UI or actual HTTP acceptance from internal ApiMain tests. Lead owns error-contract changes, factory registration, supported-version review and final sign-off.

Fresh verification:
- Focused PHPUnit suite: **7 tests / 27 assertions passed** (`tests/phpunit/core/PageOwnedPilotMergeApiTest.php` on MediaWiki 1.45.3 / PHP 8.3.31 in `mediawiki-145` container).
- Scenarios tested:
  1. `testPilotSourceMergeRejected`: Source is a pilot owner; merge rejected before any DB mutation. `rev_page`, `page_latest`, page rows, and `logging` merge counts invariant.
  2. `testPilotDestinationMergeRejected`: Destination is a pilot owner; merge rejected before any DB mutation. All DB state invariant.
  3. `testOrdinaryMergeSucceeds`: Unrelated pilot scope under write-disabled composition; merge succeeds via API, source revision moved to destination, and core logs exactly two entries (`merge` and `merge-into`).
  4. `testBadTokenRejected`: Request with `invalid_csrf_token` rejected with `badtoken`; DB state invariant.
  5. `testPermissionDeniedWithoutMergeHistoryRight`: User without `mergehistory` right rejected with `mergehistory-fail-permission`; DB state invariant.
  6. `testErrorPresentationInvestigation`: In internal harness mode (`FauxRequest`), `ApiMain` does not catch non-`ApiUsageException` throwables, allowing `ErrorPageError` (`layers-admission-unauthorized`) to escape directly (labeled as internal harness behavior, not HTTP proof). In external error formatting (`substituteResultWithError`), `ApiMain` classifies `ErrorPageError` as `internal_api_error_MediaWiki\Exception\ErrorPageError`. Under `ShowExceptionDetails = false` (production), stack traces and file paths are not exposed and the message renders the localized text; under `ShowExceptionDetails = true`, `ApiMain` attaches a `trace` property. Flagged for lead decision.
- Combined merge tests: `PageOwnedPilotMergeTest.php` (4 tests / 7 assertions) and `PageOwnedPilotMergeApiTest.php` (7 tests / 27 assertions) pass cleanly.
- PHP style: `npm run test:php` clean (0 errors, 0 warnings on new code).
- Documentation check: `npm run check:docs` passes cleanly (66 maintained/policy documents, 53 historical records).
- PHP references and compatibility: `npm run check:phprefs` and `npm run check:mw-compat` pass cleanly.
- Production code diff: 0 lines (`extension.json` untouched, 0 production PHP changes).
- Limitations: Internal ApiMain dispatch; Special:MergeHistory UI and public HTTP registration remain unverified and lead-owned.

### J47 lead acceptance — September 19, 2026

J47 is accepted with lead corrections. The junior correctly identified that the original factory ErrorPageError became an internal API error and acquired a debug trace. Lead added a typed `PageOwnedMergeDenied` and an unregistered `ApiLayersMergeHistory` adapter: it delegates to core and converts only that typed denial to a controlled `layers-admission-unauthorized` API error. Factory/special-page consumers retain a localized error. Unrelated exceptions are not converted.

Tests now verify the controlled API code and absence of traces with ShowExceptionDetails both false and true, while retaining database invariants, ordinary success, token and permission checks. Internal API/formatter tests are not HTTP acceptance. Bootstrap must install the API adapter and guarded merge factory together; installing only the factory would retain the original error-presentation defect.

J48 is now ready under the current assignment above. Lead retains initial bootstrap registration, actual HTTP acceptance and editor integration. J43/J44 remain gated. The junior report records the original implementation; this acceptance records its corrections.

### What we will deliver

For page-owned content, saving a change creates a genuine revision of its owner page, with the actor and edit summary. Viewing an older revision retrieves its stored Layers snapshot rather than mutable current layers. Ordinary page edits preserve the Layers slot. Conflicting edits preserve the winning revision and the losing editor's unsaved work. Copies on other pages cannot silently change the original owner's snapshot. The model covers images, PDFs and universal slides equally.

A page-owned document is authoritative in its owner's normal, non-derived `layers` revision slot. Its displayed content must not resolve back to a live shared `layer_sets` record. Adoption of legacy content will be an explicit copy into that ownership model; automatic migration is outside the first pilot. We will not claim history coverage for existing legacy content before it is adopted.

### Verified reuse and remaining gaps

| Component inspected | Keep/use | Work still required |
| --- | --- | --- |
| `src/Revision/PageRevisionWriter.php` | Genuine MediaWiki revision persistence, parent conflict checks and preservation of other slots | Verify integration with native page/history behavior; retain no-op semantics |
| `DocumentSchema`, `JsonSnapshotCodec`, Layers document content/handler | One versioned complete snapshot for all three surface kinds | Editor serialization/viewer mapping and user-facing change presentation |
| `PagePublicationService`, `ApiLayersPublish` | Owner/source checks, prepared main content, guarded publication and experimental POST/CSRF contract | Controlled registration and actual HTTP/editor integration |
| `PageOwnedAdmissionHooks`, `PublicationAdmissionContext` | Admission at `MultiContentSave`, preventing unapproved replacement/removal | Pilot restore veto exists separately; import and remaining lifecycle paths still need protection and integration |
| `PageHistoryAccess`, `PageReadService` | Authorized exact owner/revision reads; slides have no source lookup | Public read boundary, cache policy and historical viewer wiring |
| `SourceVersionResolver`, existing asset/private-rendering work | Exact file version, geometry and permission checks where applicable | Reassess delivery using normal MediaWiki media/storage facilities; prototype resource findings are not deployment requirements |
| `RenderJob*`, `FramedSession`, host launch protocol/dispatch probes | No role in the feature architecture | Retained abandoned artifacts only. Lead audits references before any separate removal; no broad deletion of the working tree |

The last full core result (334 tests / 2,506 assertions / one skip) contains historical tests; it is not an end-to-end history acceptance result. Do not use increasing totals as the release gate.

### Ordered delivery and ownership

| Order | Owner / work | Concrete output and exit gate |
| --- | --- | --- |
| 1 | **Lead R01: native pilot registration and lifecycle boundary** | Implement ordinary MediaWiki service/module/content-role wiring under a default-off pilot gate restricted to explicit test owner pages. Provide the read API and exact client contract. Audit and either safely implement or explicitly reject import/undelete/rollback/slot-removal paths for pilot-owned content, while unrelated pages remain unaffected. Demonstrate real core/HTTP rejection, not only source inspection. No normal-wiki feature enablement yet. |
| 1, independently | **Junior J42: publish client** | Accepted with lead corrections (unregistered client, 47 focused tests). J45 is accepted with corrections. |
| 1, independently | **Junior J45: exact-revision read client** | Accepted with lead corrections (unregistered client, 38 focused tests). J46 is accepted with corrections in the September 19 queue; R01/R02 remain lead-owned. |
| 2 | **Lead R02: first complete user path** | Integrate snapshot conversion, accepted publish client, exact read API, save/conflict behavior and native page/history viewer for a general-purpose slide. Current view resolves the owner's revision once; old-revision view uses that exact revision. Read-only history must not open a writable legacy set. Prove changed saves create revisions, no-ops do not, and reload/old revision produce the stored content. |
| 3 | **Junior J43: UI/error/accessibility follow-up, gated** | After R02 provides working controls and a frozen state diagram, add focused tests and accessibility/error-message corrections. Preserve drafts on conflict, denial and uncertain completion. No new client state architecture. Lead supplies exact files and cases before assignment. |
| 4 | **Lead + junior J44: browser acceptance, gated** | Lead supplies the disposable test wiki/page, exact URL, accounts and reset instructions. Junior verifies the matrix below against real UI. Lead reproduces failures and signs off before inviting the user. J44 is not assigned until the URL and harness exist. |
| 5 | **Lead R03: images and PDFs using the same revision path** | Wire exact historical sources through supported MediaWiki file/media facilities. Verify replacements, denied/missing archived sources and PDF page geometry. Do not substitute current files or create a supervisor. Add a bounded junior packet only after the delivery interface is concrete. |
| 6 | **Lead R04: adoption and release** | Explicit legacy-copy adoption, owner binding, move/delete/restore/rollback/suppression/import/export policy and compatibility acceptance. Existing shared sets cannot alter an adopted snapshot. Disabling the feature must preserve stored revisions and must not silently fall back to legacy content. Release after these gates, not merely after a slide demo. |
| 7 | **Lead, then bounded juniors: native search, then Cargo** | Design annotation-text extraction/index visibility from published owner revisions, then queryable Cargo projection. Rebuild/delete/suppression behavior must follow the same owner/revision rules. No live field binding or unrelated UI expansion ahead of history. |

**R01 progress — September 13:** the exact-revision `layersread` boundary is implemented, default-off and explicitly owner-scoped in isolated tests. It reuses `PageReadService`, forces private zero-age API caching, rejects invalid/hidden/wrong-owner reads and returns safe errors. Full core verification passes 351 tests / 2,557 assertions / one existing skip. This is native extension code; no supervisor work was resumed. R01 is still in progress: shared pilot registration, actual HTTP evidence and lifecycle guards remain. The publish API now also requires exact owner keys, with an empty list denying all writes. See the [read API contract](PAGE_OWNED_READ_CONTRACT.md#r01-exact-revision-api-boundary--september-13-2026).

R01 remains the immediate lead work. J42 is accepted; J45 is accepted with corrections. No further junior packet is queued ahead of R01/R02. R02 integrates the accepted clients after the native admission gates are met. J43/J44 are reserved IDs, not instructions to start unspecified work. If R01 finds a missing MediaWiki lifecycle hook, the lead resolves or narrows the supported pilot operations with enforceable guards; it does not substitute another infrastructure project.

### J42 — Page-owned publish client (accepted with lead corrections)

Implemented `resources/ext.layers.editor/PageOwnedPublishClient.js` and `tests/jest/PageOwnedPublishClient.test.js` against the existing `layerspublish` API write contract:
- Dependency-injected `new PageOwnedPublishClient(api)` requiring `api.postWithToken`.
- Validates nonempty string `owner`, integer `baseRevisionId` 0–2,147,483,647, and string `snapshotJson` (rejects invalid input locally with `layers-invalid-publication-request`).
- Immutable request field capture at invocation.
- Parameter mapping: `action: 'layerspublish'`, `owner`, `baserevid`, `data`, `summary` (default `""`), `maintext` (omitted if absent, preserved if explicit `""`).
- Success verification requiring `layerspublish.result === 'Success'` and integer `revid` 1–2,147,483,647 (with no-op equality supported).
- Outcome-unknown mapping for transport failures, malformed success, unknown error codes, and server errors (`layers-publication-failed`, `layers-revision-save-failed`).
- Safe fixed error messages; no payload or token reflection.
- Zero retries, zero global state reads, zero UI/draft mutations.

Fresh verification:
- Focused Jest suite: **43 tests passed** (`npx jest tests/jest/PageOwnedPublishClient.test.js --verbose`).
- Full Jest suite: **184 suites / 14,465 tests passed** (`npm run test:js`).
- ESLint: clean (0 errors, 0 warnings).
- PHP style and documentation checks pass; manifest unchanged (0 diff).

Lead acceptance supersedes the original junior evidence above: 47 focused tests and ESLint pass after synchronous-failure handling, diagnostic redaction and optional-field validation corrections. Lead R01 and R02 retain registration, lifecycle admission and UI integration.

### J45 — Exact-revision read client (accepted with lead corrections)

Implemented `resources/ext.layers.editor/PageOwnedReadClient.js` and `tests/jest/PageOwnedReadClient.test.js` against the `layersread` exact-revision read API contract:
- Dependency-injected `new PageOwnedReadClient(api)` requiring `api.get`. Rejects missing/invalid API instances locally with `layers-invalid-read-request`.
- Validates nonempty string `owner` and integer `revisionId` 1–2,147,483,647 (rejects invalid input locally with `layers-invalid-read-request`).
- Immutable primitive field capture at invocation.
- Parameter mapping: `action: 'layersread'`, `owner`, `revid: revisionId`.
- Safe invocation wrapping `api.get` call in Promise execution to handle synchronous exceptions cleanly.
- Response boundary checking: requires non-array `layersread` object, exact integer `revisionId` matching requested ID (rejects different revision), non-array `snapshot` with `schemaVersion === 1` and `surfaces` array, and `sourceGeometry` as non-array object or empty array (slide-only). Rejects malformed envelopes with `layers-reading-failed`.
- Safe error mapping: recognizes `missingparam`, `outofrange`, `maxbytes`, `permissiondenied`, `layers-reading-disabled`, `layers-revision-unavailable`, `layers-reading-failed`. Maps other errors to `layers-reading-failed`.
- Fixed safe error messages without reflecting server diagnostics, HTML, stack traces, or tokens.
- Zero tokens, zero retries, zero global state reads, zero DOM/draft mutations.

Fresh verification:
- Focused Jest suite: **36 tests passed** (`npx jest tests/jest/PageOwnedReadClient.test.js --verbose`).
- Combined client suites: **83 tests passed** (`npx jest tests/jest/PageOwnedPublishClient.test.js tests/jest/PageOwnedReadClient.test.js --verbose`).
- Full Jest suite: **185 suites / 14,505 tests passed** (`npm run test:js`).
- ESLint: clean (0 errors, 0 warnings).
- PHP style and documentation checks pass; manifest unchanged (0 diff).

Lead acceptance supersedes the junior evidence above: 38 focused read-client tests and 85 combined client tests pass after correcting a raw-error redaction bypass. ESLint passes. Lead R01 and R02 retain registration, lifecycle admission and UI integration.

### Next lead deliverable — R01 bootstrap wiring, merge-history and HTTP acceptance

J42 and J45 are accepted. No junior task is ready until the lead supplies the R02 controls/state contract for J43 or the browser harness for J44. Do not commission substitute test or infrastructure packets.

The read and publish API constructors now both require explicit permitted owner prefixed DB keys in addition to the default-off gate. Publish rejects an empty, unrelated or prefix-only allowlist before calling the publication service. Shared configuration/service registration remains to be implemented; matching constructor checks do not claim that wiring is complete.

Native pilot restore veto is now implemented and tested through full/selected-revision core restore commands, including unrelated-page success. The hook remains unregistered; it must share the API owner scope and stay active even when writes are disabled. Fresh native regression: 85 tests / 370 assertions. Native import admission now has an unregistered decorator tested through both core service modes, rejecting pilot targets and imported Layers roles/models before insertion. Next, the lead must wire the import/restore guards and read/write APIs to one retained pilot-owner scope, verify remaining lifecycle cases (including rollback and compound moves), then verify controlled HTTP behavior. XML import presentation and other supported core versions still require acceptance. Only after those protections pass will R02 connect the accepted clients to the editor and exact-revision viewer. A normal browser pilot remains disabled. This is MediaWiki/PHP work and introduces no host-runtime dependency.

**September 14 lead progress:** native move validation now vetoes both source and destination pilot names. Real move/restore tests pass 8 tests / 27 assertions, including ordinary move success. The guard remains test-registered only. Shared registration and the remaining lifecycle/HTTP checks remain the next lead work; no junior task is queued and no browser pilot is enabled.

**September 14 rollback evidence:** native rollback rejects Layers slot removal/replacement and permits main-text rollback preserving the same snapshot. Four focused tests / 18 assertions pass; no additional runtime guard was needed. Next implementation remains shared pilot service/hook/API registration and controlled transport acceptance, with explicit handling of remaining alternate paths such as merge-history. No junior packet is queued.

**September 14 shared composition:** `LayersPageOwnedPilot` is lazily registered in `services.php`; its composed APIs and guards share captured owner keys and one publication admission context. Tests exercise actual publication and exact historical reading through that service, both API gates, and retained move/import guards with APIs disabled. Fresh native regression: 112 tests / 454 assertions. Content-role/API/hook bootstrap installation remains test-only; this is not normal pilot enablement. Next lead work is pre-write history-merge protection and complete controlled bootstrap/HTTP registration. Core inspection found only an after-merge notification hook, so a safe supported pre-write boundary must be established before enabling the pilot.

### First user-testing gate

I will give the user a URL only when the following works in the disposable test MediaWiki installation. Docker hosting that installation is test setup only.

- Create/edit a page-owned general-purpose slide; each changed save appears in the owner page's native history with actor/summary and revision ID.
- Reload and compare at least two saved revisions; old content stays old, including after a later save. Expose a usable change summary/diff path, not just an opaque record.
- Test two concurrent editors: the stale save cannot overwrite the winner; the losing draft remains recoverable. A no-op save does not invent an edit.
- Verify read/edit denial, page protection, bad CSRF token and ordinary main-text edits. Exercise real relevant alternate write paths; unsupported pilot operations must be blocked, not merely documented as unsafe.
- Confirm pilot pages do not display or mutate live shared legacy content, and unrelated existing Layers pages remain unchanged.

The first invitation is deliberately a slide-only history checkpoint because slides require no file derivative. It is not a release or a narrowing of Layers to slides. Image/PDF historical-source acceptance and the full lifecycle/compatibility matrix remain mandatory before broader release. There is no test URL yet, and this plan does not claim those checks already pass.

### Lead review discipline

Every packet review must answer: does this implement the MediaWiki feature we need, does the actual user behavior work, and are the stated limits accurate? Keep rejected architecture out of new tasks. Review implementation and test assertions, correct defects, then record measured evidence and the next explicit assignment. Do not commission another generic test expansion merely because a component exists. New infrastructure or runtime dependencies are outside this plan.

Prepared September 10, updated September 13, 2026. Original main baseline: `e03504ec` (manifest 1.5.95). Latest review covers J01–J24 through `651d9011`; it does not claim a merge to main.

This is the execution queue for the [product roadmap](../improvement_plan.md). It assigns bounded implementation work to junior engineers and retains architectural, authorization and data-migration decisions with the lead engineer. Tasks are **not started or assigned** merely because they appear here. No feature is enabled by this document.

Images, PDF annotations and standalone slides are equal content types. Slides are general-purpose canvases: presentations, diagrams, educational material, posters, dashboards and visual documents are all valid uses. No task may require SOP-specific fields or workflow.

## Earlier checkpoint summary — superseded by the active recovery plan

**J40 is accepted with lead corrections.** Fresh full core result: **334 tests / 2,506 assertions / one existing permission-test skip**, no failures on MediaWiki 1.45.3/PHP 8.3.31. Twenty journal session scenarios pass on Windows/PowerShell 7. Corrected provider resource lifetime, stream-wrapper registration ownership, exact failure-path IO assertions and raw-byte startup preservation. A valid active fixture is independently checked through the real journal before rejection. No production implementation change was needed. See the [review](JUNIOR_IMPLEMENTATION_REVIEW.md).

**J41 is accepted with lead corrections.** Fresh verification passes **368 protocol scenarios and 20 integrated PHP journal-session scenarios** on Windows/PowerShell 7. Corrected completion-abort checks now attempt the valid completion before another Accept can mask a regression; added null/later-phase version cases and safe diagnostic labels. A targeted temporary-copy mutation verifies the corrected assertion detects an unintended retry. No production implementation change was needed. Prior core evidence remains 334 tests / 2,506 assertions / one existing skip. See the [lead review](JUNIOR_IMPLEMENTATION_REVIEW.md#j41-lead-review--september-13-2026).

**Current assignment:** lead R01, then R02; J42/J45 are accepted and no further junior packet is queued. J35 is cancelled. Browser testing awaits actual MediaWiki integration, not infrastructure work.

The [lead transport contract](PAGE_OWNED_ASSET_DELIVERY_DESIGN.md#lead-transport-implementation-contract--september-13-2026) specifies framing, process ownership, session-wide limits, uncertain outcomes and four ordered implementation/evidence gates. The [initial transport checkpoint](PAGE_OWNED_ASSET_DELIVERY_DESIGN.md#bounded-session-transport-checkpoint--september-13-2026) records the new interface, 35 passing scenarios and remaining evidence gaps. The [persistent-owner checkpoint](PAGE_OWNED_ASSET_DELIVERY_DESIGN.md#persistent-php-journal-owner-checkpoint--september-13-2026) records that composition and its 16 passing scenarios. The [J40 acceptance checkpoint](PAGE_OWNED_ASSET_DELIVERY_DESIGN.md#j40-stream-framing-and-owner-startup-rejection-acceptance--september-13-2026) records the extended stream framing and startup rejection evidence.

**Earlier host checkpoint:** the real journal passes five disposable Windows/PHP 8.4.11 checks, both directly and through the bounded runner: process-lock exclusion, replacement-write/reopen behavior and retained intent/capacity after child termination for all three command kinds. See `scripts/probe-journal-host.php` and the [bridge direction](PAGE_OWNED_ASSET_DELIVERY_DESIGN.md#local-host-journal-evidence-and-bridge-direction--september-13-2026). This is local invocation compatibility, not a completed runtime adapter. These components are now composed under one persistent PHP owner; the newer checkpoint above supersedes the earlier integration gap.

**Current core checkpoint:** 334 tests / 2,506 assertions / one existing permission-test skip, no failures. Twenty local session scenarios establish persistent journal ownership and startup rejection with scripted replies, not real Docker dispatch.

The main delivery order remains **revision history → native MediaWiki search → Cargo query/filter support**. Small current-behavior fixes do not substitute for that foundation.

### Assignment template

Copy this instruction together with the selected task packet:

> Implement task [ID] from docs/IMPLEMENTATION_HANDOFF_PLAN.md. Read its dependencies and linked contracts first. Confirm that dependencies have merged; otherwise report the missing dependency without guessing its design. Work only within this packet, use a codex/ branch, and submit one reviewable pull request. Exercise production behavior and include the commands, results and remaining limitations. Preserve unrelated changes. Do not enable page-owned publishing, migrate real data, change release numbers or publish documentation externally as part of this task. Update this plan's progress ledger with evidence, not just a completion claim.

Paths below are repository-relative. New files are explicitly described as proposed. The reviewed stabilization checkpoint is `651d9011`; preserve its corrections. For subsequent assignments use the then-current merged dependency base, not the older main checkpoint. Do not assume this review has merged the branch. A lead review is required before merging security, persistence or data-format changes. If a packet grows into a redesign, return the concrete problem to the lead and split the work before continuing.

## What already exists

The internal implementation includes a genuine MediaWiki revision writer, strict versioned document model, owner/revision access checks, exact local asset-version validation, publication service and experimental request boundary. Read these contracts instead of redesigning them:

- [History implementation and milestone evidence](PAGE_OWNED_HISTORY_IMPLEMENTATION.md).
- [Internal document format](PAGE_OWNED_DOCUMENT_FORMAT.md).
- [Experimental API contract](PAGE_OWNED_API_CONTRACT.md).
- [History, search and Cargo proposal](proposals/CARGO_SEARCH_PAGE_HISTORY.md).

**Existing user saves still use `layer_sets`.** The experimental endpoint and content model are not registered for production. Alternate save admission, historical viewers, migration and lifecycle acceptance remain incomplete. Existing Cargo gallery support in `src/Hooks/CargoHooks.php` and `src/Cargo/CargoLayersGalleryFormat.php` is not annotation-text indexing or field binding.

Previously recorded evidence at the baseline: 107 real-core tests / 317 assertions passing on MediaWiki 1.45.3; standalone PHP 1,070 tests / 2,485 assertions / one existing skip; JavaScript 183 suites / 14,422 tests. Core API tests use internal ApiMain dispatch, not HTTP/browser requests. Coverage, full browser acceptance and LTS parity are not established by these counts.

## Ordered queue and gates

Junior packets should normally fit one focused PR. Lead packets are milestones and may need several PRs; their outputs must make dependent junior work concrete before assignment.

| Order / ID | Owner | Deliverable | Dependency / assignment status |
| --- | --- | --- | --- |
| 1 J01 | Junior | Literal explicit set names (R6.09) | Reviewed and corrected; J17 follows |
| 2 J02 | Junior | Configured initial set name (R6.17) | Reviewed and corrected |
| 3 J03 | Junior | Slide creation rate limit (R6.14) | Reviewed; unit evidence |
| 4 J04 | Junior | Production rename regression tests (R6.15) | Reviewed; live browser acceptance proven in J18 |
| 5 L01 | Lead | Alternate-path admission design and enforcement | Internal PageUpdater boundary accepted; production/lifecycle gates remain |
| 6 J05 | Junior | Identity-specific draft cleanup (R6.10) | Corrected; identity format remains J16 |
| 7 J06 | Junior | Source and transport acceptance fixtures | Phase 1 accepted with corrections (121 core tests / 515 assertions); phase 2 awaits lead disposable transport setup |
| 8 L02 | Lead | Historical read, asset delivery and controlled registration | L01 + J06; gate A |
| 9 J07 | Junior | Page-owned API client adapter | Gate A and frozen read/write response contracts |
| 10 J08 | Junior | Publish-state and conflict UI | J07 and lead-approved state diagram |
| 11 J09 | Junior | Historical viewer acceptance tests | L02 viewer adapter implemented by lead |
| 12 L03 | Lead | Ownership adoption, lifecycle and viewer integration | Gate A; incorporates J07–J09; gate B |
| 13 J10 | Junior | Adoption report and operator instructions | L03 migration/report contract |
| 14 J11 | Junior | Browser acceptance and release documentation | L03 + J08–J10; no public enablement |
| 15 L04 | Lead | History release decision and rollout | J11 evidence; gate C |
| 16 L05 | Lead | Search projection and visibility contract | Gate C; gate D for implementation |
| 17 J12 | Junior | Deterministic text extractor | Gate D |
| 18 J13 | Junior | Accessible text view | J12 + approved viewer output contract |
| 19 L06 | Lead | Search backend integration and invalidation | J12; gate E |
| 20 J14 | Junior | Search rebuild verification and user examples | Gate E |
| 21 L07 | Lead | Cargo projection and audience design | J14; gate F |
| 22 J15 | Junior | Cargo query examples and integration fixtures | Gate F and lead's adapter implementation |
| 23 L08 | Lead | Cargo rollout; separate binding proposal | J15; field bindings remain a later feature |

## Ready and bounded junior packets

### J01 — Honor explicit API set names literally

**Read/change:** `src/Api/ApiLayersSave.php`, `src/Utility/SetNameResolver.php`, `src/Validation/SetNameSanitizer.php`; API tests under `tests/phpunit/unit/Api/` and resolver tests under `tests/phpunit/unit/Utility/`.

**Decision for this task:** explicit API identifiers are literal names; wikitext display switches keep their existing parsing. Do not introduce reserved names or migrate existing sets.

**Implement:** separate explicit-name resolution from display-intent parsing. Cover `on`, `off`, `all`, `true`, `false`, `1`, `0` and an ordinary name. Create another latest set and prove an explicitly named save updates only its intended target. Include image and standalone-slide API paths; cover PDF page identity where that path differs.

**Done when:** with a second set present, explicit saves update only their target; omitted or empty name routes to the latest set or default seed; special names do not activate display switches; invalid/noncanonical names fail with `invalidsetname` before resolution or persistence.

### J02 — Apply initial-name configuration cleanly

**Read/change:** `src/Api/ApiLayersSave.php`, `src/Validation/SetNameSanitizer.php`, `src/Database/LayersDatabase.php` and corresponding API tests.

**Implement:** first unnamed saves use the existing validated `LayersDefaultSetName` configuration policy. Reuse its authoritative resolution rather than adding another hardcoded fallback. Preserve explicit names and existing-set selection. If invalid-configuration behavior is undefined, flag that decision to the lead instead of silently coercing it.

**Done when:** with configuration `annotations`, initial unnamed image and slide saves create that name; explicit names and subsequent saves retain their targets. Verify default configuration too. No database migration or global rename is needed.

### J03 — Apply creation limits to slides

**Read/change:** `src/Api/ApiLayersSave.php`, `src/Security/RateLimiter.php` and API guard tests.

**Implement:** apply the existing creation bucket to creation of a slide or a new named slide set; preserve the ordinary save limit. Existing-set updates must not consume the creation bucket merely because they are saves. Use the existing error mapping.

**Done when:** a denied creation bucket prevents persistence, allowed creation succeeds, and an existing-set update follows the save-only policy. Test the production route, not the presence of a rate-limit string. Do not alter global rate settings or the experimental publisher.

### J04 — Replace misleading rename tests

**Read/change:** `tests/phpunit/unit/Api/ApiLayersRenameValidationTest.php`, production rename API/validator, `tests/e2e/named-sets.spec.js`.

**Implement:** remove duplicated validation logic from test harnesses. Exercise production validation and rename execution, including Unicode/spaces and actual length boundaries. Browser tests must fail if required controls are absent and verify the persisted renamed set after reload.

**Done when:** a broken rename implementation fails the test; a missing button cannot produce a passing test. Keep fixtures isolated and make unavailable browser prerequisites explicit. If the production route reveals another defect, report it separately rather than expanding this test PR into a rename redesign.

### J05 — Clean drafts by the exact saved/discarded identity

**Read/change:** `resources/ext.layers.editor/DraftManager.js`, `APIManager.js`, `LayersEditor.js` and associated Jest tests.

**Implement:** permit explicit file/set/page identity when deleting a draft. Clear drafts for each successful buffered save and each explicitly discarded buffered entry; retain failed entries. A silent save must still perform persistence cleanup. Reuse existing key construction.

**Done when:** a save from a different displayed page, partial failure, full discard and editor restart each produce the correct recovery choices. Include same-page/different-set isolation, and slide/image behavior wherever supported. Do not delete drafts through broad storage-prefix clearing or clear a newer draft created while an earlier save is in flight; test that race using the existing draft identity/version mechanism or request a lead decision if none exists.

## Next junior batch after review

### J16 — Make draft identities unambiguous

**Historical packet; completed through J24 corrections.** Read `resources/ext.layers.editor/DraftManager.js`, its recovery/load/clear methods, `LayersEditor.js`, and associated Jest tests. Existing keys collide for set `A B` versus `A_B`, Unicode names, and set `x-p2` on page 1 versus set `x` on page 2.

**Approved design:** use a versioned key containing an injective encoding of the complete tuple (wiki scope, user scope, original filename, original set name, normalized page). An encoded JSON array is suitable; lossy replacement or a truncated hash alone is not. Capture scope at manager creation. All write/read/cleanup paths must share the same encoder. Preserve original strings and version the storage key independently of the publication document schema.

For legacy lookup, check the stored payload's original file/set/page against the requested tuple before offering recovery or deletion. Ambiguous/missing identity must not be auto-deleted or applied to a different target. Define a visible recovery/report path for ambiguous legacy records. Write a successfully validated legacy recovery to the new key before any old-record cleanup; a quota failure must preserve the old data. Do not sweep all users' drafts. If the old format lacks wiki identity, do not infer ownership across wikis silently; document that limit and return any unresolved migration choice to the lead.

**Acceptance:** exact tuple collision cases, multiple users/wikis, restart recovery, save/discard isolation, legacy matching/mismatch, malformed legacy payload and quota failure. Retain the newly added exact-value buffered-save guard. Also audit foreground save cleanup for the same stale completion problem; if it needs changes to the full editor save state machine, report it for lead design rather than claiming all races fixed. One focused PR, no publication schema changes.

### J17 — Align mutation identifiers without silent rewriting

**After J16 for the default single-engineer queue; technically independent.** Inspect `ApiLayersRename.php`, `ApiLayersDelete.php`, `ApiLayersInfo.php`, and the corrected save/resolver behavior. The lead decision is that a supplied canonical set identifier is literal; malformed or noncanonical identifiers fail before mutation. Only documented omission/empty-name paths may resolve a target implicitly. Wikitext display switches are separate.

Add production-route tests first for stripping/truncation, empty/whitespace input, Unicode and `0`, with another set present to catch accidental redirection. Apply validation to both old and new rename identifiers and relevant delete scopes. Preserve documented omission behavior and do not reserve names. If normalizing read parameters disagrees with writes, return an explicit validation error rather than selecting another set. Reuse a small shared boundary helper if it eliminates duplicate policy; do not refactor unrelated APIs.

**Acceptance:** invalid requests produce no rename/delete/save call; valid names round-trip and retain scope across images, PDF pages and slides. Update the API reference and compatibility notes. This task is not an excuse to redesign valid Unicode naming or migrate stored sets.

### J18 — Prove the named-set workflow in a browser

**Ready independently in an isolated test wiki.** Read `tests/e2e/named-sets.spec.js` and the actual set-selector/dialog components. Use a disposable image fixture and test account; never rename a user's real set. Verify creation, save, rename and reload against persisted state. Required controls must have unconditional assertions. Replace outdated assumptions such as a permanently undeletable literal `default` set with the actual documented policy.

**Acceptance:** the test fails if a required control is removed or the rename does not persist; cleanup affects only test-owned sets; report the browser/MediaWiki version and exact command. If authentication/fixtures are unavailable, mark this task blocked rather than reporting a skipped suite as acceptance. Reuse current harness setup; no enabling experimental publishing.

## Next junior batch — September 11 review

### J19 — Complete draft recovery without inferring ownership

**Submitted implementation; corrected during review, J22 remains.** Scope: branch `codex/j19-draft-recovery`. Ordinary legacy records lack wiki identity; they are preserved in `localStorage` without automatic migration, deletion, expiry, or sweeping across wikis.

- **UI & Accessibility:** Localized, keyboard-accessible notice (`.layers-legacy-draft-notice`) with Review & Recover and Dismiss actions; modal recovery dialog (`.layers-legacy-dialog`, role `dialog`, `aria-modal="true"`) displaying escaped metadata (`textContent` only), unscoped-wiki warning, and focus trap with Escape handling.
- **Export & Import Safety:** Client-side raw byte export (`exportLegacyRecord()`) creates a JSON download without transmitting data or logging annotation contents; works for valid and malformed data. Manual import (`importLegacyRecord()`) validates layers through existing import boundary, applies them to current active editor context, marks work dirty (`isDirty = true`), and never auto-publishes or deletes the legacy record.
- **Scope Discovery & Compatibility:** Standardized `DraftManager.getWikiScope()` on `wgWikiID` (with fallback to `wgDBname` and `wgDBprefix`) and disambiguated multiple wikis sharing an origin via `wgScriptPath`. Prior review branch scopes (`my_wiki`, `default`) remain recoverable through `getCandidateWikiScopes()`. Decoded v2 tuple types strictly validated in `decodeKey()`; payload identity verified via exact string equality in `matchesCurrentContext()`.
- **Validation:** 156 tests passing in `DraftManager.test.js` (including 17 new acceptance tests for J19); full JavaScript suite passed (180 suites / 14,366 tests); PHP standalone passed (1,070 tests / 2,485 assertions / 1 skip); MinusX, PHPCS, Grunt ESLint, and documentation verification checks passed.

**Acceptance:** ordinary unscoped legacy record, missing page, malformed JSON, two wikis/users, same-name collisions, cancel, export round trip, quota failure and restart. No deletion of ambiguous records; UI test checks a visible notice, not only `getAmbiguousLegacyRecord()`. If actual runtime scope cannot be established, return that concrete design issue to the lead.

### J20 — Single confirmation with failure-safe set switching

**Review qualification:** the submission below required safety corrections; J23 remains. Any reported passes predate the latest corrections.

**Implemented.** Scope: branch `codex/j20-set-switching`. Coordinated set switching authoritatively handled by `LayerSetManager` (with delegation in `SetSelectorController`, `RevisionManager`, and `LayersEditor`).

- **Single Authoritative Confirmation:** Eliminated duplicate confirmation dialogs by centralizing the unsaved-work check (`hasUnsavedChanges()`, evaluating canvas dirty state and `pageBuffer` dirty pages) in `LayerSetManager.prototype.loadLayerSetByName`. `SetSelectorController` removes its redundant prompt and delegates directly to the authoritative switch operation. Clean switches trigger 0 prompts.
- **Explicit Outcome Representation:** Switch operations return typed result objects (`{ status: 'success' | 'cancelled' | 'failed', success: boolean, cancelled?: boolean, failed?: boolean, reason?: string, setName: string, error?: Error }`), providing clear state transitions for UI and coordinating components.
- **Failure-Safe State Retention & Reversion:** On cancellation or network/API failure, `currentSetName`, `layers`, and `isDirty` state remain intact. The dropdown selector automatically reverts to `currentSetName` (unless superseded by a newer switch).
- **Request Sequencing & Newer Edits Preservation:** Monotonic generation counter (`_switchGeneration`) discards stale/out-of-order rapid switch responses. Pre-load edit snapshot (`_captureEditSnapshot()`) and `canApplyLoadedSet()` coordination with `APIManager` detect newer user edits made during flight; incoming server layers are safely discarded with `layers-switch-newer-edits-preserved` warning notice. Discarded `pageBuffer` entries for the previous set are cleared only upon confirmed switch success.
- **Validation:** 8 acceptance tests in `LayerSetSwitching.test.js` passing; all 63 tests in `SetSelectorController.test.js`, 54 in `LayerSetManager.test.js`, 112 in `RevisionManager.test.js`, 110 in `UIManager.test.js`, and 346 in `LayersEditor` passing. Full JavaScript suite: 181 suites / 14,374 tests passing (0 failures). Full PHP standalone: 1,070 tests / 2,485 assertions (1 skip). MinusX, PHPCS, Grunt ESLint, documentation verification, and repository integrity guards passing.

**Acceptance:** one dialog on successful dirty switch, cancel, rejected/timed-out load, clean switch, buffered edits, newer edit during load and overlapping requests. Test actual collaborating components rather than a mock that always succeeds. Changes that require a general editor state redesign go to the lead before expanding this PR.

### J21 — Isolated named-set browser acceptance

**Historical review qualification:** the submission below required safety corrections. Its passes predate the fixes; later J24 evidence is recorded in the current review.

**Completed on `codex/j21-browser-acceptance`.** Executed end-to-end browser acceptance tests for named layer sets against live MediaWiki 1.45.3 on container `mediawiki-145` (PHP 8.4.11, port 8080).
- **Isolated Fixtures & Safe Scoping:** Validates explicit `TEST_FILE` (`ImageTest03.png`), `MW_SERVER`, `MW_USERNAME` (`LayersQA`), and `MW_PASSWORD` prerequisites in `test.beforeAll`; reports blocked with explicit error rather than writing to an implicit default image. Sets use unique per-run prefixes (`j21_${RUN_ID}_*`). Tracked sets and test-owned identities are cleaned up in failure-safe post-run teardown (`test.afterAll`) via authenticated `mw.Api` `layersdelete` requests. Unrelated existing sets (`001`, `002`) are strictly preserved.
- **Scenarios Verified:** Coordinated single confirmation on dirty switch (J20), canceled dirty switch restoring selector and canvas layers, deliberately failed set load (via route interception) restoring selector and preserving canvas layers, set creation, set rename with page-reload persistence, deletion with confirmation, independent layers across sets, unconditional revision history controls, and maximum-set-cap headroom verification under `$wgLayersMaxNamedSets = 15`.
- **Validation Evidence:** Two consecutive clean runs passed:
  - **Run 1:** 13/13 passed (6.9m). 7 test-owned sets cleaned up. Teardown asserted 0 test-owned sets remaining on `ImageTest03.png`, and unrelated sets `001` and `002` intact.
  - **Run 2 (Consecutive Clean Run):** 13/13 passed (6.9m). 7 test-owned sets cleaned up. Teardown asserted 0 test-owned sets remaining on `ImageTest03.png`, and unrelated sets `001` and `002` intact.
  - Set cap headroom preserved at 2/15 sets (`001` and `002`). Full Jest suite: 181 suites / 14,374 tests passing (0 failures). Full PHP standalone: 1,070 tests / 2,485 assertions (1 skip, 0 errors). MinusX and doc sync clean.
  - Junior task queue (J19 → J20 → J21) is complete. Next task is lead-owned `L01` (Close alternate publication paths).

## Next assignments after J19–J21 review

### J22 — Finish manual recovery destination and failure behavior

**Ready after review corrections are captured.** Restrict edits to DraftManager recovery UI and its tests/messages. Retain fail-closed shared import validation and byte-preserving export; never restore the removed fallback parser.

Capture and display the destination wiki/file/set/page when opening recovery. If the editor changes destination while the dialog is open, reject import and require reopening. Show a localized failure notice when validation fails; preserve the dialog and original record. Prevent silently replacing newer unsaved work: require a specific replacement confirmation or reject while current work is dirty. Use existing editor history/import integration so successful recovery is undoable; do not duplicate history state. Keep original legacy records untouched on success/failure/cancel.

**Acceptance:** a real shared parser rejects over-limit input without state changes, missing parser fails closed, destination changes cannot redirect import, current edits survive cancelled replacement, successful import is dirty/undoable, and failed export cannot report success. Include image, PDF page and slide contexts without building three separate implementations. Return any required redesign of the general import boundary to the lead.

### J23 — Verify switches through the actual APIManager

**Completed (`a7eda34a`).** Verified switches using real collaborating components (`APIManager` + `LayerSetManager` + `StateManager` + `SetSelectorController`) with mock network/rendering boundaries in `tests/jest/LayerSetSwitchingAPIManager.test.js` (14 scenarios). Demonstrated request closure prevents real response processing for stale requests, monotonic generation prevents same-name overwrites, and in-place/background/buffered-page edits are preserved. Discovered and reported APIManager loading-state defect on abort and RevisionManager fallback defect to lead. Fixed `LayerSetManager.prototype.loadLayerSetByName` check ordering so superseded generation takes precedence over newer edits check.

### J24 — Verify cleanup isolation, then rerun browser acceptance

**After J23 and any lead fixes; fixture-unit work can begin now.** Add behavior tests for the cleanup selection rule and failure propagation using test API responses: tracked current-run name, untracked same-prefix name, another run's name, missing author metadata, network failure and API delete failure. Only exact tracked current-run identities may be deleted. Do not reintroduce automatic `j21_` sweeps. Record interrupted runs for explicit manual reconciliation without embedding credentials.

Then run two isolated browser acceptance passes against the corrected branch, using a dedicated file/account supplied through environment settings. Verify each run's cleanup and preservation of the initial inventory. Report exact commit/environment/results without secrets. Rotate the previously committed QA credential before use if it is active; ask the operator to provide replacement credentials through the environment rather than recording them in this plan.

**Acceptance:** cleanup tests fail if broad prefix deletion is restored; two clean browser passes with zero current-run leftovers; prior-run/unrelated data intact. No claim that earlier J21 passes validate the corrected implementation.

## Earlier review record — superseded by the current MediaWiki-native queue

### J25 — Fill concrete admission test gaps

**Complete.** Added 4 explicit behavioral tests in `tests/phpunit/core/PageOwnedAdmissionTest.php`:
1. `testFailedExactParentLookupFailsClosed`: Injected `RevisionLookup` returns `null` for parent; save fails closed at hook boundary (`layers-admission-unauthorized`, reason `parent_lookup_failed`); no revision advance; slot models and serialized contents preserved.
2. `testInheritedImagePdfSnapshotPreservedWithoutSourceResolver`: Image and PDF surfaces with synthetic source metadata preserved across ordinary main-only edit; `SourceVersionResolver::resolve()` never invoked; mutation while resolver is unavailable fails before hook (`layers-source-unavailable`).
3. `testConcurrentWinnerAfterParentCaptureWithAdmissionEnabled`: Loser `PageUpdater` captures parent CAS token; intervening winner commits revision; loser attempts save inside active scope; hook validates parent, but core's `PageUpdater` CAS fails with `edit-conflict` after hook; winner preserved; loser creates no revision; scope cleared.
4. `testNoOpScopeCleanupFollowedByDeniedMutation`: No-op publication does not advance revision ID; scope cleaned up; subsequent direct `PageUpdater` replace and removal denied at hook boundary (`layers-admission-unauthorized`, `layers-slot-removal-denied`); unchanged checked row totals.

**Engineer-recorded J25 verification before lead corrections:** core suite passed **111 tests / 405 assertions** on MediaWiki 1.45.3 / PHP 8.3.31. Standalone PHP passes 1,070 tests / 2,485 assertions (1 skip). PHP style / syntax checks pass with 0 errors.

### J26 — Replace asserted route coverage with a core-source inventory

**Complete.** Inspected installed MediaWiki 1.45.3 source files under `/var/www/html/includes/` on container `mediawiki-145` and documented call chains, line numbers, and hook execution status in `docs/PAGE_OWNED_ADMISSION_DESIGN.md`:
- Web edit (`includes/editpage/EditPage.php` line 2552), API edit (`includes/api/ApiEditPage.php` line 526), Rollback (`includes/page/RollbackPage.php` line 299), and Undo (`includes/editpage/EditPage.php` line 1663, line 2552) confirmed calling `PageUpdater::saveRevision()` and invoking `MultiContentSaveHook`.
- XML import (`includes/import/ImportableOldRevisionImporter.php` line 188) and Undelete (`includes/page/UndeletePage.php` line 606) confirmed calling `RevisionStore::insertRevisionOn()` directly, bypassing `PageUpdater` and `MultiContentSaveHook`. Both are documented as explicit **enablement blockers** requiring L03 lifecycle adapters before production registration.
- Reproducible read-only container inspection commands documented.

L01 internal acceptance is recorded in the latest review. Lead owns L02 and disposable transport setup; J06 phase 1 is accepted; J27 is accepted; J28 is accepted; J29a is accepted with corrections; J29b is accepted with corrections; J30 is accepted; J31 is accepted with corrections; lead retains resource/configuration and transport gates.

## Lead-owned history work

### L01 — Close alternate publication paths

**Primary files:** `src/Revision/PagePublicationService.php`, `PageRevisionWriter.php`, `PageHistoryAccess.php`, `src/Hooks/PageOwnedAdmissionHooks.php`, `src/Revision/PublicationAdmissionContext.php`, `src/Revision/PublicationAdmissionIntent.php`, and `tests/phpunit/core/PageOwnedAdmissionTest.php`.

**Status: Internally accepted (September 11, 2026).** L01a/L01b PageUpdater boundary passes the reviewed core suite; production/lifecycle gates remain open.
- Single-use publication scope around `PageRevisionWriter::save` enforced via `PageOwnedAdmissionHooks` handling `MultiContentSave`.
- Direct `PageUpdater` add, replace, and slot removal without scope are denied without committing revisions.
- Scope borrowing strictly rejected for mismatched owner, base revision, author identity, snapshot digest, or unexpected slot mutations.
- Unchanged inherited `layers` slot passes freely without requiring publication scope or re-resolving historical assets.
- Nested scopes rejected with `LogicException`; exception cleanup guaranteed in `finally`.
- Isolated test registration contract (`TestingAdmissionRegistration`) installs the content model, slot role, single-use admission context, and hook into isolated test cases; production registration remains strictly off.
- Alternate routes bypassing `PageUpdater` (`ImportableOldRevisionImporter`, `UndeletePage`) inventoried via reflection and documented as enablement blockers requiring L03 adapters.

**Latest lead evidence:** 114 core tests / 424 assertions pass after prepared-main binding and J25/J26 review. J06 phase 1 has since been reviewed; see latest evidence above. HTTP transport remains gated.

### L02 — Read and asset delivery, then gate A

**Current lead implementation order:** follow the [asset delivery decision record](PAGE_OWNED_ASSET_DELIVERY_DESIGN.md). L02a implements and proves private raster output/lifetime; L02b binds exact owner/revision/source authorization and post-render rechecks. J29a renderer probes are accepted with corrections; J29b authorization probes are accepted with corrections; J30 suite separation is accepted; J31 staging probes are accepted with corrections; the lead now owns resource admission and configuration wiring before the next junior packet. The internal reader and J28 tests are accepted; do not substitute another reader-test batch for delivery work.


Define the exact owner/revision/surface read response and failure contract, including hidden revisions and inaccessible/missing assets. Implement permission-aware asset delivery and cache identity. Resolver metadata alone is not a historical file-retention or public-thumbnail security guarantee.

Decide supported sources and retention before claiming reproducible history: local archives can be deleted, PDFs require real page-count/render evidence, and foreign-file adoption needs an explicit support policy. Never silently fall back to current assets or a legacy set.

Register services, model, slot, admission hook and endpoint coherently only in controlled testing until acceptance passes. Separate disabling new writes from maintaining the ability to read already-stored historical content. Check supported MediaWiki versions explicitly; baseline tests only establish 1.45.3 behavior.

**Gate A:** lead signs off on admission, stable read/write contracts, HTTP authorization/CSRF tests, asset-delivery rules and reversible controlled enablement. J07 can then implement transport without inventing security semantics.

### L03 — Viewer integration, adoption and lifecycle; gate B

Lead implements owner/revision propagation and viewer adapters across inline viewing, lightbox and export. Cache keys and asynchronous callbacks must include the requested revision/surface/source identity; navigation cannot apply stale dimensions or annotations to a different surface.

Design copy versus adoption versus pinned reuse, stable owner identity across moves, and the relationship to legacy shared sets. Adoption must prevent old save/rename/delete routes becoming a second writable authority. An ordinary page containing a live shared reference cannot claim consumer-page revision immutability.

Specify transaction/conflict boundaries, dry-run reports, idempotency, recoverable failures and rollback before writing migration tools. Exercise move, delete/undelete, revision hiding/suppression, rollback/undo, import/export and asset loss. Restoring annotations must produce a new authorized revision without modifying the old record.

**Gate B:** lifecycle tests and mixed-surface historical rendering pass; migration has a tested recovery procedure; no orphaned dual authority. Unsupported operations are explicitly blocked/documented, not silently treated as complete.

### L04 — Gate C: history release decision

Review J11 and gates A/B, then decide staged rollout. Require genuine HTTP/browser evidence, backup/restore and upgrade/disable-write exercises, performance bounds and a stated support matrix. Verify user docs, wiki mirrors and `.mediawiki` publication sources agree. Distinguish repository edits from externally published documentation.

Only advertise the history guarantee for owner-bound published content and supported operations actually tested. Existing legacy shared content remains clearly identified. Release numbers, public feature enablement and publishing are separate lead actions, not junior task side effects.

## Junior history packets unlocked by lead work

### J06 — Real assets and HTTP acceptance fixtures

**Phase 1 accepted after lead corrections:** the [asset fixtures](../tests/fixtures/assets/README.md) now have a reproducible PHP generator and valid PNG checksums/PDF offsets. `RealAssetAdmissionTest.php` passes 7 tests / 91 assertions; full core suite passes **121 tests / 515 assertions** on MediaWiki 1.45.3 / PHP 8.3.31.

Verified: atomic mixed image/PDF/slide publication; current and archived image bytes; hash/timestamp mismatch rejection; real two-page PDF boundary enforcement; missing backend bytes; zero repository lookups for slides; exact inherited snapshot preservation after actual image/PDF bytes are removed. Temporary backend paths and core test tables isolate fixture operations. This does not prove retained assets or public historical rendering.

**Phase 2 remains gated:** before implementing real HTTP tests, the lead must provide the disposable wiki/endpoint-registration/credential/teardown contract. The normal localhost wiki must remain unregistered. Internal ApiMain dispatch is not HTTP proof. Report a missing transport contract rather than inventing one.

**Done when:** fixtures reproduce cleanly, tests verify both response and revision effects, cleanup is limited to owned test data, and the report separates mock/core-dispatch/HTTP evidence. Harness architecture or new dependency installation decisions go to the lead.

### J27 — Archived PDF replacement and page-specific geometry

**Accepted with lead test-isolation correction (local uncommitted).**
- Extended `tests/fixtures/assets/generate.php` with a parameterizable PDF generator and generated `test-multipage-replacement.pdf` (1 page, 300x150 pt, 593 bytes). Verified with `generate.php --check`, `pdfinfo`, and `pdftoppm`.
- Added 2 core integration tests in `tests/phpunit/core/RealAssetAdmissionTest.php`:
  1. `testArchivedPdfReplacementAndPageSpecificGeometry`: Uploads initial 2-page PDF (T1, 200x100 pt / 100x200 pt MediaBox, 416x208 px / 208x416 px reported by the handler at test-pinned 150 DPI), replaces with 1-page PDF (T2, 300x150 pt, 625x312 px reported by the handler at test-pinned 150 DPI). Publishes snapshots pinned to T1 (page 2) and T2 (page 1). Asserts exact byte matching, page count, and dimension units (MediaBox pt vs rendered px). Catches fallback trap on page 2 of T2 (fails closed with `layers-source-unavailable`). Rejects mismatched timestamps/hashes and out-of-bounds pages without revision creation.
  2. `testArchivedPdfByteLossFailsClosedWithoutLatestFallback`: Deletes only physical archived T1 bytes from backend while leaving current T2 bytes intact. Proves resolving pinned T1 fails closed with `layers-source-unavailable` rather than falling back to current content. Proves ordinary main-only edit retains stored snapshot bytes and model without re-resolving sources.
- **Engineer-recorded verification before lead additions:** 123 core tests / 597 assertions pass on MediaWiki 1.45.3 / PHP 8.3.31 (up from 121 / 515). Standalone PHP passes 1,070 tests / 2,485 assertions (1 skip). `npm run test:php` and `npm run check:docs` pass cleanly. Production history remains disabled; lead retains L02 historical delivery and J06 phase 2 transport setup.

### J28 — Internal reader failure boundaries

**Accepted with lead corrections (local uncommitted).**
- Added 5 focused failure-boundary tests in `tests/phpunit/core/RealAssetAdmissionTest.php`:
  1. `testReadRejectsNonPositiveAndForeignOwnerRevisionBeforeSourceResolution`: Zero (`0`) and negative (`-1`) revision IDs and valid revisions belonging to a foreign owner are rejected before `SourceVersionResolver::resolve()` is invoked (verified via mock expectation).
  2. `testReadRejectsDeletedTextRevisionBeforeSourceResolution`: Revisions with `DELETED_TEXT` visibility accessed by readers without `deletedtext` permission are rejected before source resolution.
  3. `testReadDeniedSourceAccessExposedOnlyAsRevisionUnavailableWithoutPartialBundle`: Resolver failure with `layers-source-unavailable` is wrapped and exposed strictly as `layers-revision-unavailable` with chained previous exception; no partial bundle or partial geometry is exposed.
  4. `testReadRejectsNonPositiveOrUnavailableHandlerDimensions`: Invalid dimensions (`0` width, `-1` height, `false` non-integer from handler) throw `layers-revision-unavailable` without inventing geometry.
  5. `testReadSlideOnlyBundleHasEmptyGeometryAndZeroRepositoryLookups`: Reading a source-free slide-only revision yields `sourceGeometry: []` and performs zero repository or title lookups (`LocalRepo` and `TitleFactory` mocks expect never).
- **Verification:** 130 core tests / 660 assertions pass on MediaWiki 1.45.3 / PHP 8.3.31 (up from 125 / 618). Standalone PHP passes 1,070 tests / 2,485 assertions (1 skip). `npm run test:php` passes with 0 errors and 0 warnings. `npm run check:docs` passes cleanly. Production history remains disabled; lead retains L02 asset delivery and J06 phase 2 transport setup.

### J29a — Private renderer acceptance probes

**Accepted with lead corrections (local uncommitted).**
- Extended `testPrivateRasterRendererWithRealCoreHandlers` in `tests/phpunit/core/RealAssetAdmissionTest.php`:
  - Uploaded multi-pixel 80×40 px PNG and JPEG fixtures to the isolated backend.
  - Exercised real resampling/downsampling with core handlers (requested width 40 → actual 40×20 px for both PNG and JPEG).
  - Recorded and asserted requested versus actual dimensions across native copy (PNG 1×1, JPEG 1×1), downsampling (PNG 40×20, JPEG 40×20), SVG rasterization (40×20), and multi-page PDF rendering (page 1: 40×20, page 2: 40×80).
  - Verified pre- and post-render backend storage inventory: no persistent derivative files added to `public` or `thumb` repository zones; original source files intact with matching sizes and SHA-1 checksums; `thumb` zone remains completely empty.
- Added 6 focused fault-injection tests in `tests/phpunit/core/RealAssetAdmissionTest.php` covering all 8 specified failure boundaries:
  1. `testPrivateRasterRendererRejectsInvalidWidthOrPageAndExcessiveDimensions`: Invalid requested page (0, -1) and width (0, -1, 4097); empty decoder string; `normaliseParams` returning `false`; handler normalising dimensions to non-positive or > 4096 (`width`, `height`, `physicalWidth`, `physicalHeight`).
  2. `testPrivateRasterRendererRejectsUnsupportedInputAndOutputTypes`: Missing handler (`getHandler() === null`); unsupported source MIME (`image/webp`, `image/gif`, `text/plain`, `application/octet-stream`, `image/tiff`); unsupported thumb output types from `getThumbType` (`webp`, `svg`, `gif`, `image/x-png`, invalid extension `exe`, `pdf`).
  3. `testPrivateRasterRendererRejectsHandlerErrorsAndExceptions`: `doTransform` returning `null`; a mocked transform output reporting `isError() === true`; unexpected transform exception (verifying exception propagation and staging artifact purge).
  4. `testPrivateRasterRendererRejectsDeferredOutputOrMismatchedLocalCopyPath`: Deferred/client output (`hasFile() === false`); mismatched returned local copy path (`getLocalCopyPath() !== $path`).
  5. `testPrivateRasterRendererRejectsCorruptedOrOversizedOutput`: Corrupted/truncated image bytes failing `getimagesizefromstring`; corrupted IDAT stream failing full ImageMagick decode (`-regard-warnings`); empty file (0 bytes); oversized encoded output exceeding 8 MB (8,388,609 bytes).
  6. `testPrivateRasterRendererRejectsMismatchedNativeSourceDimensions`: Non-PNG/JPEG source (SVG) claiming `fileIsSource()`; width mismatch; height mismatch; source size exceeding 8 MB; missing local source reference path (`false`; a non-existent nonempty path is not tested).
- Controlled failures throw `\DomainException('layers-render-unavailable')`; the injected transform crash propagates its `RuntimeException`. Cases allocating owned staging verify cleanup and preservation of unrelated content. Early validation cases allocate no artifact. Inventory snapshots establish no persistent backend changes for these fixtures, not absence of transient writes by every handler.
- **Junior-reported checkpoint (before lead corrections):** `RealAssetAdmissionTest.php` passes **26 tests / 534 assertions** (up from 20 / 343). Full core suite passes **140 tests / 958 assertions** on MediaWiki 1.45.3 / PHP 8.3.31 (up from 134 / 767). Standalone PHP passes 1,070 tests / 2,485 assertions (1 skip). `npm run test:php` and `npm run check:docs` pass with 0 errors and 0 warnings.

### J29b — Delivery authorization acceptance

**Accepted with lead corrections (local uncommitted).** Target `PageAssetService::prepare(Title, int revisionId, string surfaceId, int width, Authority): array`. The result contains only `mime`, `width`, `height`, `bytes`; controlled failures are `DomainException('layers-asset-unavailable')`. Unexpected infrastructure/cleanup exceptions propagate. No HTTP contract is frozen.

Add focused real-core tests for a foreign owner/revision pair, hidden or missing revision before rendering, exact archived PDF page selection after replacement with a shorter PDF, and denial of a different source in a mixed image/PDF/slide document. Verify the whole-document policy both before and after rendering. Inject a renderer callback that completes a real raster and then suppresses the pinned archived source; confirm no result escapes and owned staging is empty. Existing lead tests already cover owner/source authorization changes, hidden revision, disappearing bytes and slide/unknown IDs; extend coverage rather than duplicate them.

Verify source filename, timestamp, hash and page are derived from the snapshot; do not introduce caller overrides or latest-version fallback. Test generic renderer failure mapping and propagation of cleanup infrastructure errors. Keep tests isolated, run the full core suite and PHP style checks, and document real versus injected boundaries. Do not add HTTP registration, caching, UI wiring or resource-policy changes. Passing these tests does not close gate A.

- **Implementation & Verification (September 12, 2026):**
  Added 5 focused test methods to `tests/phpunit/core/RealAssetAdmissionTest.php`:
  1. `testAssetPreparationRejectsForeignMissingOrHiddenRevisionBeforeRendering`: Foreign owner/revision pairs, non-positive or non-existent revision IDs, and revisions with `DELETED_TEXT` visibility (when reader lacks `deletedtext`) reject with `DomainException('layers-asset-unavailable')` without invoking source resolution or rendering.
  2. `testAssetPreparationRendersArchivedPdfPageAfterReplacementWithShorterPdf`: Pinned T1 page 2 renders at 40x80 px without falling back to latest 1-page T2 after replacement; proves source metadata (filename, timestamp, hash, page) is derived exclusively from the snapshot.
  3. `testAssetPreparationEnforcesWholeDocumentPolicyBeforeAndAfterRendering`: In a mixed slide + image + PDF document, denying access to the PDF source blocks image preparation before rendering (`resolve()` failure); revoking PDF access during image rendering withholds completed image raster bytes after rendering.
  4. `testAssetPreparationWithholdsBytesWhenArchivedSourceSuppressedMidRender`: Renderer callback generates real raster for pinned archived OldLocalFile, then either sets restricted archived-file visibility while keeping bytes present or deletes physical archived bytes before returning; `prepare()` detects loss on post-render verification, withholds completed bytes, and leaves owned staging empty.
  5. `testAssetPreparationMapsRendererDomainExceptionAndPropagatesInfrastructureErrors`: Generic renderer `DomainException('layers-render-unavailable')` is wrapped as `DomainException('layers-asset-unavailable')` with original chained; cleanup `RuntimeException('layers-render-cleanup-failed')` propagates uncaught.
- **Junior-reported checkpoint before lead corrections:** `RealAssetAdmissionTest.php` passes **31 tests / 621 assertions**. Full core suite passes **145 tests / 1045 assertions** on MediaWiki 1.45.3 / PHP 8.3.31. Standalone PHP passes 1,070 tests / 2,485 assertions (1 skip). `npm run test:php` and `npm run check:docs` pass with 0 errors and 0 warnings. No HTTP registration, caching, UI wiring or resource-policy changes; gate A remains open.

### J30 — Separate the growing core asset test suites

**Accepted.** This was a test-only refactor; do not modify production code or add feature registration. `tests/phpunit/core/RealAssetAdmissionTest.php` now combines admission, read bundles, renderer faults and delivery authorization in nearly 3,000 lines. Separate ownership of these tests so future fault probes remain reviewable.

1. Extract only shared fixture setup/build/upload helpers into an abstract `RealAssetTestCase.php` in the same test namespace. Keep database/backend isolation, unique temporary roots, pinned PdfHandlerDpi, test-only admission registration and parent setup/teardown behavior intact. Shared helper visibility may become protected; do not expose production helpers or duplicate fixture setup across suites.
2. Move the eight `testPrivateRaster...` methods and renderer-only helpers to `PrivateRasterRendererTest.php`. Move all `testAssetPreparation...` methods and `provideArchivedSourceRevocationModes` to `PageAssetServiceTest.php`. Keep publication and read-bundle acceptance in `RealAssetAdmissionTest.php`. Follow the existing core bootstrap autoload mechanism, adding an explicit test-helper require only if needed. Preserve relevant `@covers`, `@group Database` and provider annotations.
3. Preserve every assertion, fault fixture, no-call expectation and real-handler invocation. Do not replace real rendering or storage with mocks to simplify the move. Do not rename tests, flatten the suppression provider, skip tests or change expected counts. Avoid a broad fixture framework; move private helpers to the suite that alone uses them.
4. Compare `--list-tests` before/after: method/provider cases must each remain present exactly once, allowing class-name changes. Run each of the three suites independently, then the full core suite and PHP style/documentation checks. Confirm the abstract helper is not discovered as an executable test suite and each suite works without another suite having initialized its fixtures.

**Accepted count interpretation:** preserve all domain cases and assertions; the split adds exactly two inherited `testValidCovers` cases/assertions to the prior 146/1,069 checkpoint. Acceptance also requires that each separated suite passes alone, and the change contains only test organization and evidence/documentation updates. Record counts, renamed class paths and any autoload changes. If isolated execution exposes a hidden dependency, report and fix that setup dependency rather than relaxing the test. HTTP, resource policy and public history remain gated.

- **Implementation & Verification (September 12, 2026):**
  - Extracted shared fixture setup, database/backend isolation, temporary root configuration, and document builder helpers into abstract `RealAssetTestCase.php` (`MediaWiki\Extension\Layers\Tests\Core`). Confirmed that PHPUnit does not discover `RealAssetTestCase.php` as an executable suite.
  - Moved the 8 `testPrivateRaster...` methods and renderer-only helpers (`snapshotBackendStorageInventory`, `createMockFileAndHandler`) to `PrivateRasterRendererTest.php`. Runs alone: **9 tests / 261 assertions** (8 methods + `testValidCovers`).
  - Moved all 7 `testAssetPreparation...` methods and `provideArchivedSourceRevocationModes` to `PageAssetServiceTest.php`. Runs alone: **9 tests / 147 assertions** (7 methods + 1 provider with 2 cases + `testValidCovers`).
  - Trimmed `RealAssetAdmissionTest.php` to retain only the 15 publication, upload replacement, boundary validation, and read bundle acceptance tests. Runs alone: **16 tests / 239 assertions** (15 methods + `testValidCovers`).
  - Compared `--list-tests` before and after: every single domain test method and provider case is preserved exactly once.
  - Full core suite passes **148 tests / 1,071 assertions** on MediaWiki 1.45.3 / PHP 8.3.31 (advancing the 146 / 1,069 baseline by exactly +2 tests / +2 assertions from MediaWiki's per-suite `testValidCovers` check on the 2 new test classes). Standalone PHP passes 1,070 tests / 2,485 assertions (1 skip). `npm run test:php` and `npm run check:docs` pass with 0 errors and 0 warnings.

### J31 — Private staging configuration acceptance

**Accepted with lead corrections (local uncommitted).** The original packet follows for traceability. Add focused cases to `tests/phpunit/core/PrivateStagingDirectoryTest.php`; preserve `PrivateStagingDirectory::createFactory(string directory, array publicRoots): TempFSFileFactory`. It returns a factory bound to an existing canonical writable directory or throws `DomainException('layers-private-staging-invalid')`. It creates no files/directories during validation, has no fallback, and rejects overlap in either direction with every explicit served root. It does not discover web-server aliases or prevent later operator remapping.

1. Exercise multiple served roots where only the later root overlaps, a served root expressed through a symlink, and a staging symlink to an actually private directory. The allowed alias must create its test artifact under the canonical private target and purge it. Keep all targets inside isolated test temporary roots and unlink only aliases created by the test.
2. Cover trailing separators, dot/parent components, a root directory as forbidden ancestor, empty/non-string root entries, file-valued roots, embedded NUL and stream-wrapper inputs. Retain the valid similarly named sibling case: lexical prefix similarity alone must not reject it. All controlled failures must have the exact generic code and must create no artifact or fallback directory; unrelated sentinel bytes survive.
3. Verify missing staging is not silently created and that rejected configurations do not become factory objects. Test unwritable directories only when the runner can actually deny the effective process write access; root-run chmod tests do not establish this. Record platform/permission limitations instead of claiming portable permission coverage. Windows drive/UNC and junction acceptance needs a suitable environment; Linux symlink evidence does not establish Windows parity.
4. Run the staging suite alone, the real renderer suite and the full core suite, plus PHP style/documentation checks. Report real filesystem cases and limitations. Do not alter production paths, permissions, server configuration or HTTP registration; do not add a broad path abstraction or weaken rejection to accommodate a test.

**Done when:** fresh evidence covers the cases above without modifying production behavior. Return any discovered defect to the lead with a focused reproducer. Staging validation remains a prerequisite; source/decoded-pixel limits, worker concurrency, hard deadlines, complete served-root wiring and transport stay lead-owned.

- **Implementation & Verification (September 12, 2026):**
  - Added focused test coverage in `tests/phpunit/core/PrivateStagingDirectoryTest.php` covering:
    - Multiple served roots with later-root overlap in both directions (child and parent overlap).
    - Symlinks to served storage (rejected) vs. symlinks to private targets (allowed, artifact created under canonical private directory and purged cleanly).
    - Path normalization for trailing separators (`///`) and dot/parent components (`./sub/..`), while strictly rejecting traversal escaping into served roots (`../public`, `/public/.`, `/public/child/..`).
    - The fixture's filesystem root and container parent directories as forbidden ancestors (Windows C: is no longer hard-coded).
    - Malformed inputs, stream wrappers (`mwstore://`, `file://`, `php://memory`, `php://temp`), embedded NUL bytes (`\0`), non-string root types (`null`, `123`, `false`, `true`, `[]`), empty root lists, file-valued paths (`sentinel`), and relative paths.
    - Non-creation of missing staging directories and preservation of untouched sentinel content.
    - Effective write denial when supported by the runner; the lead correction explicitly skips privileged bypass instead of counting it as rejection coverage, and restores temporary permissions in finally. A separate unprivileged probe supplies Linux denial evidence.
  - **Junior-reported checkpoint before lead corrections.** Staging suite alone: **9 tests / 69 assertions** passed in Docker.
  - Renderer suite alone: **9 tests / 261 assertions** passed in Docker.
  - Full core suite: **157 tests / 1,140 assertions** passed on MediaWiki 1.45.3 / PHP 8.3.31.
  - Standalone PHPUnit: **1,070 tests / 2,485 assertions / 1 skip** passed.
  - PHP style & linter (`npm run test:php`): 131 files checked, 0 errors, 0 warnings on extension code.
  - Documentation integrity (`npm run check:docs`): 65 maintained documents agree.

### J32 — Source metadata admission acceptance

**Accepted with lead corrections (local uncommitted).** Original packet retained for traceability. Preserve `SourceRenderAdmission::assertCanRender(File, int page)` and its 64 MiB / 40 million pixel internal limits. Add focused tests in `SourceRenderAdmissionTest.php` and `PageAssetServiceTest.php`; no public configuration, HTTP, timeouts or renderer redesign.

- Cover zero/negative/unavailable file size and invalid page; byte rejection must precede geometry calls. Add just-below, exact and just-above pixel/byte limits without allocating large files. Distinguish integer metadata from false or malformed metadata where core File mocks permit it.
- Exercise the real admission object through PageAssetService with controlled File metadata: rejection must not invoke rendering and must return the generic asset error. Preserve real revision/source authorization where practical; document mocked boundaries rather than manufacturing huge decompression fixtures.
- Verify page-specific geometry for an archived PDF stays bound to the snapshot. Verify a mixed document renders/charges only its selected source while all sources still undergo authorization. Slides remain source-free and do not enter the source renderer. Do not introduce cumulative allowances or relax whole-document authorization.
- Run focused and full core suites, PHP style and documentation checks. Record inherited framework checks and the existing privileged-runner skip separately. Do not claim metadata admission bounds decoder memory or total runtime.

**Done when:** exact limits, failure ordering and service integration have evidence without weakening the policy. Report any defect to the lead. Concurrency, hard deadlines, cumulative metadata budgets and production configuration remain lead-owned.

- **Implementation & Verification (September 12, 2026):**
  - Added focused test coverage in `tests/phpunit/core/SourceRenderAdmissionTest.php`:
    - Zero, negative, unavailable, and non-integer file sizes (`0`, `-1`, `-100`, `false`, `null`, `'64000000'`, `1.5`) reject before geometry lookups.
    - Non-positive page numbers (`0`, `-1`, `-999`) reject before geometry lookups.
    - Byte threshold boundaries: just below (`MAX_SOURCE_BYTES - 1`), exact (`MAX_SOURCE_BYTES`), and just above (`MAX_SOURCE_BYTES + 1` rejects before geometry).
    - Pixel threshold boundaries: just below (`39,999,999`), exact (`40,000,000` 1D and `10,000 x 4,000` 2D), and just above (`40,000,001` 1D and `10,000 x 4,001` 2D reject).
    - Malformed/non-integer geometry (`false`, `null`, `'100'`, `100.5`, negative, zero, and multiplication overflow with `PHP_INT_MAX`).
  - Added focused test coverage in `tests/phpunit/core/PageAssetServiceTest.php`:
    - Real `SourceRenderAdmission` integration in `PageAssetService`: verifies excessive bytes and excessive pixels throw `layers-asset-unavailable` (wrapping `layers-render-unavailable`) while strictly forbidding renderer invocation.
    - Page-specific geometry binding for snapshot-pinned PDF pages: verifies page 2 is specifically evaluated rather than page 1 (oversized page 2 with small page 1 rejects without rendering; small page 2 with oversized page 1 passes and renders).
    - Mixed-document isolation and source-free slides: slide surfaces reject immediately before resolution or rendering; requesting an image surface succeeds despite a sibling PDF exceeding thresholds; whole-document authorization is preserved.
  - Admission suite alone: **8 tests / 43 assertions** passed in Docker.
  - Asset service suite alone: **13 tests / 188 assertions** passed in Docker.
  - Real renderer suite alone: **9 tests / 261 assertions** passed in Docker.
  - Full core suite: **169 tests / 1,225 assertions / 1 skip** passed on MediaWiki 1.45.3 / PHP 8.3.31 (baseline 162 / 1,163 / 1 skip + 7 tests / + 62 assertions).
  - Standalone PHPUnit: **1,070 tests / 2,485 assertions / 1 skip** passed.
  - PHP style & linter (`npm run test:php`): 133 files checked, 0 errors, 0 warnings on extension code.
  - Documentation integrity (`npm run check:docs`): 65 maintained documents agree.

## Abandoned supervisor work — historical record, not an assignment queue

Everything in the following collapsed record belongs to the rejected supervisor architecture. Past acceptance means only that its tests passed; it does not approve this work for Layers. Every pending/next step in this record is cancelled. Do not resume it.

<details>
<summary>Abandoned J33–J41 supervisor investigation and cancelled J35 packet</summary>

### J33 — Disposable worker containment lifecycle acceptance

**Accepted with lead corrections on the local uncommitted branch.** The following junior checkpoint predates the cleanup corrections documented in the latest review. Extended `scripts/probe-render-container.ps1` and fixture `tests/fixtures/execution/container-worker.sh` using installed immutable image `sha256:decbb81155989786c1cff0394fc0185cec65c40472be4da8f9dd584f5cefd1ae` with `--pull=never`. Retains all network/root/capability restrictions, unprivileged workers, finite waits, explicit child readiness, positive control, stopped-state verification and exact label-guarded cleanup.

Evidence:
- **Docker inspect configuration evidence**: verified `NetworkMode: "none"`, `ReadonlyRootfs: true`, `CapDrop: ["ALL"]`, `SecurityOpt: ["no-new-privileges"]`, `PidsLimit: 32`, `Memory: 134217728` (128 MiB), `NanoCpus: 500000000` (0.5 CPU), `User: "65534:65534"`. Labeled as configuration evidence without claiming unmeasured enforcement.
- **Sequential baseline containment**: positive control writes (`returnSeconds: 6.075`, `lateWrite: true`, `exitCode: 0`); stopped ordinary process group terminated (`returnSeconds: 1.187`, `lateWrite: false`, `exitCode: 137`, `PID: 0`); stopped detached child terminated (`returnSeconds: 1.159`, `lateWrite: false`, `exitCode: 137`, `PID: 0`).
- **Simultaneous job isolation (`simultaneous-isolation`)**: two concurrent detached-child jobs run on distinct volumes with unique GUID sentinel tokens (`sentinel-token-a-...`, `sentinel-token-b-...`). Stopped Job A halted at 1.253 s (`lateWrite: false`, `exitCode: 137`, `Running: false`, `PID: 0`, sentinel preserved); independent Job B completed at 6.143 s (`lateWrite: true`, `exitCode: 0`, `Running: false`, `PID: 0`, sentinel preserved). Sentinels and volume inventories verified without cross-contamination.
- **Injected host-side failure cleanup (`injected-failure-cleanup`)**: host-side exception injected after container start within cleanup-protected scope; exception caught and reported in diagnostic; exact container and volume removed via `finally` with label validation; 0 leftovers.
- **Post-diagnostic inventory**: zero leftover containers and zero leftover volumes matching `layers.probe` label.
- **Checks passed**: Bash syntax (`bash -n`: exit 0), PowerShell AST parse check (0 errors), complete diagnostic script (exit 0). Core integration suite remains **169 tests / 1,238 assertions / 1 skip**. Production history remains disabled. Do not implement the real worker manifest, capacity service, daemon restart recovery, source staging or HTTP; those remain lead-owned.

### J34 — Supervisor journal state and failure acceptance

**Accepted with lead corrections.** The tests cover restart from reserved, attached and both cleanup variants; stale ownership credentials; invalid attach/premature confirmation; idempotent cleanup; lifecycle guards; schema corruption; missing state; symlink/sentinel preservation; successful writes; real directory write denial; and cross-process lock contention/recovery.

Lead corrections restore original permissions in `finally`, protect helper cleanup on assertion failure, restore missing-state coverage, and separate successful-write acceptance from privilege-dependent denial. The write-denial fixture proves failure before pending-file creation, instance poisoning and unchanged committed bytes. It does not exercise partial-write/fsync/rename failure cleanup. Symlink initialization rejects as already initialized; symlink reads/reservations reject as unavailable. See the [review](JUNIOR_IMPLEMENTATION_REVIEW.md).

**Fresh verification:** focused journal suite **14 tests / 239 assertions**, no skips; full core **183 tests / 1,477 assertions / one existing permission-test skip**, no failures. No production code or registration changed.

### L02c next — Runtime reconciliation and verified cleanup (lead)

Implement in this order. Each step needs reviewable code and failure evidence before the next; the existing containment diagnostic is supporting evidence only.

**Progress:** the lead implemented a runtime interface, verified-inventory value object and recovery coordinator, with scripted-runtime failure tests. The interface/coordinator were developed together to expose the required cleanup protocol; step 1 is not complete because no real Docker adapter exists. Steps 2–3 have internal cleanup logic only; launch composition and actual recovery remain unproven. The runtime must prove earlier create/start operations cannot finish late before cleanup starts. An adapter unable to establish that barrier must block recovery; successful empty inventory alone is insufficient.

**Inventory progress:** read-only host Docker inventory now has a disposable real-daemon diagnostic in `scripts/probe-render-inventory.ps1`. It validates candidate ownership, identity collisions and resource state; it does not yet implement the PHP runtime interface or authorize cleanup. Next lead change: durable pending-command intent with schema handling. Unknown create/start outcomes remain blocked; successful inventory alone cannot clear them. See the [decision and limits](PAGE_OWNED_ASSET_DELIVERY_DESIGN.md#launch-uncertainty-decision-for-the-next-lead-implementation).

| Step | Deliverable | Required acceptance before proceeding |
| --- | --- | --- |
| 1 | Host-only runtime adapter with explicit outcomes for successful inventory, absence, owned resource, ownership conflict and query failure | Fixed executable/argument lists, bounded waits and captured output; immutable image configuration; no Docker socket in the wiki. Failed queries and timed-out clients cannot mean absence. |
| 2 | Recovery coordinator holding the journal lock throughout | Read existing state; never initialize as fallback. Reconcile names AND ownership labels/token/image, plus immutable container ID when recorded. Collision, malformed inventory and unavailable daemon retain capacity and stop mutation. |
| 3 | Creation and cleanup composition | Reserve before volume/container creation. Recover create-success/ID-recording-failure by verified inventory. Cleanup is repeatable from every active phase. Verify exit before removal; prove container and volume absence through successful queries before confirming cleanup. Unknown, duplicate or mismatched resources block release. |
| 4 | Disposable crash-window harness | Kill supervisor after intent, volume creation, container creation before ID recording, attachment, cleanup marking and each removal before idle commit. Restart recovers only the exact owned job. Inject query failures; preserve unrelated sentinel resources. Finally blocks or client termination alone are insufficient evidence. |
| 5 | Freeze reviewed interfaces and assign bounded acceptance | Record actual platform/results and limits, then issue J35 below. Private source staging, real handlers, overall deadline and final reader authorization follow as separate lead work. |

Before real rendering, decide how private host workspaces and their cleanup proof are durably represented. The current journal identifies a container and volume only; do not add unmanaged host paths implicitly. All prototypes remain unregistered. Images, PDFs and source-free slides remain in the eventual delivery scope.

### J36 — Version 2 command-intent acceptance

**Complete.** Extended `tests/phpunit/core/RenderCommandIntentTest.php` (now 13 tests / 146 assertions) and `tests/fixtures/execution/journal-process.php` with finite child process execution:

1. **Strict schema & mutation rejection:** Tested missing/extra `pendingCommand` fields, bad receipt types/lengths/case/non-hex, unknown command kinds, `start-container` intent without container ID, create intent with container ID already attached, and version 1 idle/active records. Rejection throws `layers-journal-corrupt`, leaves persisted bytes unchanged, and blocks capacity without resetting state.
2. **Process-death preservation & unforgeable acknowledgement:** Tested `create-volume`, `create-container`, and `start-container` using the helper process. Handshake verified via stdout receipt followed by child termination with SIGKILL. Reopened instance confirms `pendingCommand` survived process death with exact receipt and kind, refuses forged acknowledgement (`layers-journal-command-unconfirmed`), blocks recovery with zero runtime mock calls, and retains capacity (`layers-render-capacity-full`).
3. **Credential & lifecycle rejection:** Verified mismatched job ID and token on `beginCommand` and `acknowledgeCommand` reject with `layers-journal-ownership-mismatch`; stale/random receipts reject with `layers-journal-command-unconfirmed`; post-cleanup operations reject with `layers-journal-transition-invalid` or `layers-journal-command-unconfirmed`; post-close operations reject with `layers-journal-unavailable`.
4. **Honest write denial during `beginCommand`:** Tested persistence failure via honest unprivileged directory permission denial (`chmod 0555` under dropped `www-data` privileges): triggers `layers-journal-write-failed`, returns no receipt, permanently poisons the instance (`layers-journal-unavailable`), leaves 0 pending files, and preserves pre-dispatch persisted bytes.

**Verification:** Focused command-intent suite 13 tests / 146 assertions; full core suite **213 tests / 2,024 assertions / 1 existing skip**; standalone PHPUnit 1,070 tests / 2,485 assertions / 1 skip; `npm run test:php` and `npm run check:docs` pass.

### J37 — Read-only Docker inventory rejection coverage (accepted with corrections)

The junior added 60 deterministic scenarios. Lead review corrected inspect fixtures that emitted bare objects, tightened the reader to require Docker's one-object array envelope and string identity fields, and added 16 regressions for malformed JSON, incorrect nesting, scalar/null responses, array-valued identities and missing labels.

**Fresh acceptance:** 76 scripted scenarios pass; the live disposable inventory diagnostic also passes with exact owned cleanup and unrelated guard preservation. No workers were started. PowerShell execution and documentation checks pass. No PHP rerun was needed; previous core acceptance remains 213 tests / 2,030 assertions / one existing skip. See the [review](JUNIOR_IMPLEMENTATION_REVIEW.md) for scope and limitations.

### Next lead deliverable — Bounded command transport

Implement a fixed, operator-selected executable and explicit argument-list transport with independent stdout/stderr limits and one elapsed deadline covering process exit and pipe draining. Do not reuse the diagnostic's unbounded `ReadToEndAsync` capture as the production implementation. Output overflow, failed spawn, nonzero exit and timeout must produce explicit failure; killing a client cannot imply daemon cancellation or resource absence.

Before assigning further junior work, provide the concrete runner API and finite adversarial fixtures for simultaneous stdout/stderr pressure, over-limit output, deadline expiry, inherited pipes after parent exit, argument integrity and cleanup of the owned client. Prove bounded memory/wait behavior on the selected host platform. Then connect create/start dispatch through the existing journal protocol and exercise actual crash windows. This is lead-owned implementation, not authorization to add Docker access to the wiki.

### J38 — Bounded command runner acceptance (accepted with corrections)

The junior's 35 scenarios were reviewed and strengthened to 36. Timeout acceptance now holds the original live process handle before the deadline and asserts exit on runner return. Overflow fixtures interleave streams; a 512 KiB-per-stream successful capture replaces the smaller pressure case. Configuration testing avoids arbitrary 100 ms timing and uses a unique missing path and a marker-writing fixture. Finally paths account for owned finite helpers/markers.

**Fresh verification:** 36 runner and 76 inventory scenarios pass on Windows/PowerShell 7. No implementation change or new full-core/live-Docker/browser run was necessary for these test corrections. See the [review](JUNIOR_IMPLEMENTATION_REVIEW.md). J39 has since been reviewed; J35 remains blocked on real host integration.

### J39 — Launch bridge protocol acceptance (accepted with lead corrections)

Accepted the junior's later-stage rejection, callback/schema, byte boundary, container ID, request-field and replay tests. Lead corrections add explicit zero-runtime-call expectations after unresolved failures, original exception identity, exact no-retry dispatch sequences, full pending-state preservation through reopening, and array-valued identity/status rejection. See the [review](JUNIOR_IMPLEMENTATION_REVIEW.md) for current evidence.

J39 changed only tests and used scripted callbacks. The subsequent lead transport/composition checkpoints add real pipe/process evidence; J40 below extends their concrete interfaces. J35 remains blocked on actual runtime dispatch/recovery.

### J40 — PHP stream framing and owner startup rejection acceptance (accepted with lead corrections)

Accepted the junior's stream framing, stream wrapper and owner startup rejection tests. Outbound length framing verified at ASCII and multibyte 8,192-byte boundaries (`ftell === 8196`); sequential multi-exchange stream positions verified; unconsumed payload on oversized/zero/maximum headers verified; closed/invalid stream configuration rejection verified; `RenderJobTestStreamWrapper` verifies fragmented 1-byte IO, prompt zero-write termination without spinning (<10 calls), and failed write/flush/read errors. Host-side session tests pass 4 startup rejection scenarios (missing journal, invalid JSON, unsupported version, active journal) verifying failure (`layers-session-eof`), zero dispatch, exact byte preservation, and nonrecursive exact-file cleanup. See the [review](JUNIOR_IMPLEMENTATION_REVIEW.md).

Lead-verified full core result: **334 tests / 2,506 assertions / one existing permission-test skip**, no failures. Journal session host acceptance: **20 scenarios passed** on Windows/PowerShell 7. Provider cleanup, wrapper ownership, precise IO assertions and raw-byte preservation were corrected. No production code changed; standalone PHPUnit was not rerun in the lead review.

J40 changed only tests and fixtures. Docker dispatch, runtime reconciliation and actual crash recovery remain lead-owned; J35 stays blocked.

### J41 — Host launch protocol validation acceptance (accepted with lead corrections)

Implemented multi-phase field and type matrices across all three launch phases (`create-volume`, `create-container`, `start-container`), structural and encoding rejections, duplicate property aliases, extra properties, malformed/deep JSON, byte/surrogate boundaries, state machine violations, invalid container creation IDs, and explicit `Abort()` across all lifecycle stages with permanent fail-closed poison verification.

Fresh verification:
- Lead-reviewed protocol acceptance suite: **368 scenarios passed** on Windows/PowerShell 7 (`scripts/test-render-launch-protocol.ps1`).
- Journal session host acceptance: **20 scenarios passed** on Windows/PowerShell 7 (`scripts/test-journal-session.ps1`).
- Style and documentation checks pass; manifest unchanged. Core integration remains historical at 334 tests / 2,506 assertions / one existing skip.

J41 changed only tests and fixtures. Docker dispatch, verified daemon outcomes and runtime recovery remain lead-owned; J35 stays blocked.

### J35 — Runtime recovery acceptance (cancelled; do not implement)

**Dependency:** lead completes L02c steps 1–4, documents exact adapter/coordinator APIs and harness commands, and provides a reviewed dependency base. This is a future packet, not an assignment to design those interfaces.

Once unblocked, extend the harness with tests for repeated recovery, stale/mixed ownership tokens, name collisions, query failure versus genuine absence, and retained capacity until both resource types are absent. Keep an independently owned sentinel resource through each run and verify it survives. Report residual resources and exact injected boundaries. Do not add runtime capabilities, registration, source staging, schema changes or cleanup by broad prefixes. Return security/recovery defects to the lead. Update this ledger and current-status mirror with measured evidence. Lead review remains required.

</details>

### J07 — Client transport adapter

After gate A, add a separate adapter beside `resources/ext.layers.editor/APIManager.js` with Jest tests. The lead must provide the exact read response contract first; the existing experimental API contract defines publication, not an invented read endpoint.

Send explicit owner/base and one complete snapshot, use the MediaWiki token mechanism, and return the committed revision ID. Map documented errors into typed client results. Do not automatically retry an uncertain write, infer success from an empty response, or fall back to legacy saving. Test conflict, timeout, malformed response and no-op success. Keep editor wiring for J08.

### J08 — Publish-state UI

Lead first approves a state diagram covering clean, dirty, saving, success, conflict, denied and outcome-unknown, including edits made during an in-flight save. Wire J07 into that diagram using existing editor components; add localized English messages and `qqq` explanations.

**Done when:** unsaved work remains recoverable on every failure; a late success cannot mark newer edits clean; duplicate submission is controlled; published revision identity updates only on confirmed success; conflict recovery offers an explicit action. Test keyboard focus and status announcements. Do not implement automatic geometry merges or cross-owner publication.

### J09 — Historical viewer regression suite

After the lead's viewer adapter exists, test inline view, lightbox and export using two revisions with different text, geometry and backgrounds. Include image, multi-page PDF and source-free slides. Visit surfaces rapidly and revisit them after delayed source loads; assert annotation bounds and revision identity, not just screenshot existence.

**Done when:** an old revision never acquires current annotations/assets, denied/missing content has an explicit result, and stale asynchronous work cannot overwrite the selected surface. Source-delivery/security defects return to the lead. Export omissions must fail or remain explicitly identified according to the approved export contract.

### J10 — Adoption report and operator guide

After L03 defines the tool/report interface, implement only its read-only report presentation and documentation. Show each source set, intended owner, conflicts, unsupported assets and intended action using the lead's structured output. No writes in dry run. Avoid including private annotation content in ordinary logs.

**Done when:** fixture reports cover success, conflict, partial prior execution and unsupported inputs; instructions identify backup, dry run, execution, verification and recovery commands that actually exist. The lead retains migration writes, locking and rollback implementation.

### J11 — End-to-end acceptance and documentation

Run isolated browser scenarios for create/edit/publish/reopen, stale editor, historical view, restore, denied access and navigation, across all three surface types. Add required assertions to existing `tests/e2e/` rather than optional controls that can skip the behavior.

Update `docs/CURRENT_STATUS.md` and its exact `wiki/Current-Status.md` mirror, API/history guides, and affected `.mediawiki` sources. Use actual results and clearly label untested compatibility. Do not change release dates/version values or say GitHub wiki/mediawiki.org was published without verifying publication. Submit the evidence table for L04; passing tests alone do not authorize rollout.

## Search: contracts first, bounded implementation second

### L05 — Gate D: projection design

Choose and prove the MediaWiki indexing path on the supported backend. Determine whether indexing consumes a slot directly or requires an additional projection; do not rewrite user-authored main text implicitly. Define extraction of plain/rich text, callouts, hidden objects, groups, whitespace, Unicode, reading-order omissions, duplicates, length limits and stable result anchors. Hidden on-canvas visibility is not automatically a confidentiality policy.

Define what happens on protection changes, deletion, suppression, restoration and delayed/out-of-order indexing. Search snippets and direct links must not leak inaccessible content. Freeze extractor input/output and fixture expectations for J12. Reading order is separate from drawing stack order and optional instructional sequence.

### J12 — Pure text extractor

Implement a proposed new extractor and tests at the paths chosen by L05. No database, search backend, Cargo or external queries in this function. Consume validated snapshots and output deterministic ordered text plus owner-independent surface/layer anchors per the approved contract.

**Done when:** multilingual text, rich-text runs, callouts, empty text, groups, omitted reading-order entries and limits match reviewed fixture expectations. Include a presentation, diagram and annotated source document. Do not infer new schema fields or strip content by ad hoc regular expressions.

### J13 — Accessible text view

Use J12's projection through the lead-approved permission-checked viewer response. Provide an ordered text view and links back to annotations, preserve Unicode, escape output and support keyboard navigation. Test text-only malicious strings, empty surfaces and meaningful heading/focus behavior.

**Done when:** text and canvas describe the same requested revision, inaccessible content never appears in the DOM, and tests cover actual navigation. Do not add a separate unauthenticated projection endpoint.

### L06 — Gate E: search integration

Implement indexing and invalidation with retryable, idempotent updates tied to committed revisions. Stale jobs must not overwrite a newer projection. Prove search finds text present only in Layers, removes deleted/suppressed content as required by the supported backend's visibility model, and can rebuild from authoritative records. Define backend-specific limitations and result destinations; do not promise untested backend compatibility.

### J14 — Rebuild verification and examples

Using L06's approved rebuild tool, add isolated acceptance fixtures and operator instructions. Search for text only in an image label, PDF callout and slide presentation; edit/remove it and verify incremental and full rebuild results agree. Include interruption/retry and stale-job cases supplied by the lead.

**Done when:** each query reaches its intended surface and permission-negative cases match the approved backend contract. Report indexing delays honestly. Tool concurrency, authorization and destructive rebuild changes remain lead-owned.

## Cargo: queryable published annotations before live bindings

### L07 — Gate F: projection and audience contract

Inspect the installed Cargo version and existing gallery integration before choosing hooks/schema. Define records for owner, published revision, surface/layer identity, type and extracted text; optional structured fields require a versioned design. Decide current versus historical rows, deletion/suppression, rebuild ownership and stale-job handling.

Cargo query audiences can differ from page readers. Prove the chosen exposure policy or restrict/disable indexing where it cannot be enforced; filtering a result page after private data has entered an unrestricted table is insufficient. Implement the adapter and security-sensitive lifecycle hooks. Preserve the existing gallery behavior and operation without Cargo installed.

### J15 — Query examples and acceptance fixtures

After gate F and the adapter implementation, add tested query/filter examples for image labels, PDF callouts and general-purpose slide text, using only documented fields. Cover absent Cargo, empty results, publish/update/delete, rebuild and duplicate prevention with approved fixtures. Extend the relevant wiki/API guide without describing gallery hints as text indexing.

**Done when:** examples run against the stated Cargo version, results match the committed projection, and no unsupported permission guarantee is implied. Do not invent tables or change audience policy to get an example working.

### L08 — Cargo rollout and later bindings

Review projection evidence and operational recovery before enablement. Then write a separate binding design: restricted field selection, parameterized queries, failure states, type/length bounds, permissions, refresh review and snapshots of resolved values at publication. Historical views must not execute today's query and present its result as yesterday's content. A visibly identified live dashboard mode can be considered separately. Do not assign binding implementation within J15.

## Deferred defects and later product work

These remain visible but do not interrupt the history/search/Cargo order without a new lead triage decision. Consult [R6 findings](../codebase_review.md) for the original reproductions; confirm they still apply before coding.

| Work | Owner and next bounded action |
| --- | --- |
| R6.11 export completeness | Lead defines fail/degraded-output/cache metadata contract; junior can then add fault-injection tests. Never silently omit pages or annotations. |
| R6.12 export fidelity | Lead defines supported-property matrix and renderer strategy; junior prepares visual fixtures after that decision. Include backgrounds, rich text, rotation and gradients across supported outputs. |
| R6.13 foreign-file cache invalidation | Lead reviews backlink/permission/cache behavior; junior implements the narrowly approved fix with no-local-description-page regression. |
| R6.16 shipped dependency audit | Junior may inventory vendored runtime versions/build provenance now; lead chooses a blocking advisory policy. Final CI task must prove a simulated applicable advisory fails. No automatic dependency upgrade or claim of a new CVE. |
| Editor usability, collections and templates | After foundations, select one measured user problem per PR. Preserve blank-canvas use and optional structure. |
| Performance | Measure representative many-layer/many-surface workloads first; lead sets budgets, then assign specific cache/render/memory fixes. Avoid speculative broad rewrites. |

## Verification and handoff record

Use the repository's [testing guide](../wiki/Testing-Guide.md) and [contribution guide](../CONTRIBUTING.md). For a focused task run relevant tests plus applicable lint/guards; broaden testing for shared behavior. Do not rerun every suite for a Markdown-only change. Unit tests with stubs cannot prove real revision persistence or HTTP authorization.

Available entry points include `npm run test:js -- --runInBand <test-path>`, `php vendor/bin/phpunit --configuration phpunit.xml <test-path>`, `npm run check:docs` and `npm run check:version`. Core integration uses `tests/phpunit/core.xml` with the environment setup described in the testing guide. Some package Docker shortcuts name `mediawiki`; the current environment uses `mediawiki-145`, so inspect running containers rather than renaming them. Never run integration fixtures against production data.

Each PR should state: problem and resulting behavior; task ID/dependencies; actual test commands/results and environment; changed contract/docs; unresolved limits. A reviewer should be able to reproduce the decisive failure and success without reading the entire conversation. Record blocked work as blocked with a specific missing decision, not completed.

| Task IDs | Reviewed status (September 11, 2026) | Evidence / next action |
| --- | --- | --- |
| J01 | Reviewed with corrections | `6486046f`; invalid explicit names now rejected before resolution; see review record |
| J02 | Reviewed with corrections | `0ca2b3a4`; explicit configuration injection and failure propagation |
| J03 | Reviewed | `9b8a0d5e`; production-route unit tests pass; live concurrency not claimed |
| J04 | Reviewed; acceptance qualified | Rename tests reviewed; J24 supplies engineer-recorded corrected browser acceptance |
| J05 | Reviewed with follow-up corrections | Exact buffered cleanup and storage identity/recovery addressed through J16/J19/J22 |
| J16 | Reviewed with follow-up corrections | Tuple isolation plus preservation/recovery follow-ups in J19/J22 |
| J17 | Reviewed; unit scope accepted | `f7a9a164`; shared canonical mutation/read validation |
| J18 | Reviewed with follow-up corrections | Dirty reset and switching corrected; later acceptance recorded in J24 |
| J19 | Reviewed with follow-up corrections | Validation bypass and destination/undo/failure handling addressed through J22 |
| J20 | Reviewed with follow-up corrections | Request-bound guards and content comparison; real API evidence in J23 and lead fixes |
| J21 | Reviewed with follow-up corrections | Exact tracked cleanup now shared/tested; corrected browser runs recorded by J24 |
| J22 | Lead-reviewed with correction | `aff63227`; destination/dialog rechecked after replacement confirmation |
| J23 | Lead-reviewed; reported defects corrected | `a7eda34a`; real-component tests now require loading-state and stale-response protection |
| J24 | Accepted at `651d9011` | Fresh 28 cleanup/API tests; two engineer-recorded 13/13 browser passes; see review qualifications |
| J25 | Accepted with stronger parent/race assertions | Synthetic-source core evidence, not real bytes/HTTP |
| J26 | Accepted as core source inspection | Import insertion reference corrected; no lifecycle execution claim |
| L01 | Internally accepted with lead corrections | 114 core tests / 424 assertions; production gates remain |
| J06 | Phase 1 accepted with fixture/test corrections | 121 core tests / 515 assertions; phase 2 awaits lead transport setup |
| J27 | Accepted with test-scoped DPI correction | Archived bytes/page geometry verified; handler metadata is not browser rendering |
| J28 | Accepted with real source-permission check | 130 core tests / 663 assertions; mocked and real-source evidence distinguished |
| J29a | Accepted with lead corrections (local uncommitted) | Downsampled PNG/JPEG, backend inventories and strengthened fault-boundary/partial-output cleanup assertions |
| J29b | Accepted with lead corrections (local uncommitted) | Real restricted-visibility and missing-byte cases; direct exact PDF input checks; whole-document policy and error propagation |
| J30 | Accepted (local uncommitted) | 148 core tests / 1,071 assertions; separated RealAssetAdmissionTest, PrivateRasterRendererTest, PageAssetServiceTest, and RealAssetTestCase |
| J31 | Accepted with lead corrections (local uncommitted) | Canonical staging fault/alias coverage; honest privileged skip, permission cleanup and unprivileged denial probe |
| J32 | Implemented (local uncommitted) | 169 core tests / 1,225 assertions / 1 skip; source metadata admission thresholds, failure ordering and service integration |
| J33 | Accepted with lead corrections (local uncommitted) | Partial-create cleanup, exact-token absence proofs, independent-run isolation and bounded CLI waits |
| J34 | Accepted with lead corrections (local uncommitted) | 183 core tests / 1,477 assertions / 1 skip; helper cleanup, permission restoration and missing-state acceptance corrected |
| J36 | Accepted with lead corrections (local uncommitted) | 213 core tests / 2,030 assertions / 1 skip; lead-corrected missing-field and permission-restoration acceptance; command schema mutations, process death with SIGKILL, unforgeable acknowledgement, honest write denial |
| J37 | Accepted with lead corrections (local uncommitted) | 76 scripted scenarios plus passing live inventory diagnostic; strict JSON envelope and identity types corrected; no PHP rerun |
| J38 | Accepted with lead corrections (local uncommitted) | 36 runner and 76 inventory scenarios; real process-handle timeout check, interleaved pressure, configuration evidence corrected |
| J39 | Accepted with lead corrections (local uncommitted) | 293 core tests / 2,402 assertions / 1 skip; zero-runtime-call, exception identity, no-retry and array-type acceptance corrected |
| J40 | Accepted with lead corrections (local uncommitted) | 334 core tests / 2,506 assertions / 1 skip; 20 session scenarios; fixture ownership/lifetime, exact IO assertions and raw-byte preservation corrected |
| J41 | Accepted with lead corrections (local uncommitted) | 368 protocol / 20 session scenarios; direct completion-abort assertions, mutation detection, later-phase versions and safe labels |
| J42 | Accepted with lead corrections (local uncommitted) | 47 focused Jest unit tests, 184 passing Jest suites / 14,469 tests; synchronous error handling, diagnostic redaction and optional-field validation corrected |
| J45 | Accepted with lead corrections (local uncommitted) | 38 focused read-client tests / 85 combined client tests; corrected raw-error bypass, exact revision match and geometry envelopes verified |
| J35 | Cancelled | Abandoned container-supervisor architecture; never a page-history dependency |
| J07–J15, L02–L08 | Original gates still apply | L02 design can proceed; no production history enablement |

When completing a task, record its PR/commit and specific evidence here, then update the active history contract or feature guide as appropriate. This plan is the assignment queue; those contracts remain the authority for implemented behavior.

J33–J41 evidence is retained as abandoned investigation history. J35 and all supervisor follow-up work are cancelled. Current work is the MediaWiki-native implementation order below.


### Current lead implementation order — MediaWiki extension only

1. Audit the existing page-owned revision writer and admission rules against normal MediaWiki save, protection, import/undelete and ownership paths. Retain working extension code; exclude the abandoned supervisor artifacts from the feature design.
2. Complete the extension's read/write and historical-viewer wiring, using MediaWiki storage and media services. Preserve source-version identity, authorization and failure handling. Any rendering limitation must be handled within the supported MediaWiki environment, not by requiring a container service.
3. Prepare an isolated browser pilot for page-owned slide save/history/old revision/conflict behavior, then image and PDF coverage. Slides remain a universal canvas. Issue junior packets only against concrete MediaWiki interfaces.
4. After the history foundation is proven, proceed with native search, then Cargo text projection. No Docker task gates these milestones.

J35 is cancelled. The supervisor dispatch, runtime reconciliation and host/daemon failure milestones are abandoned. They are not optional future Layers backends.
