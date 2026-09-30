# Layers project charter

**Adopted:** September 27, 2026. The project owner settled decisions D1–D5 the same day.
**Applies to:** all lead and junior work on `main`.
**Finish line:** Layers 2.0 (the current version is 1.5.95 plus later fixes on `main`).

## 1. Why this charter exists

Layers has grown quickly, and each piece of work has been reasonable on its own. This charter fixes the destination: what 2.0 contains, what it leaves out, and how we prove we have arrived.

- Every lead deliverable and junior packet names the criterion it advances, for example "advances HIST-3". Work that advances none of them waits, or the charter changes first.
- Only the project owner changes scope. New ideas go to section 8 until the owner accepts them.
- The **Baseline** columns record the state on September 27, 2026. Update them at each milestone and date the update. Current evidence lives in [current status](CURRENT_STATUS.md); the ordered work queue lives in the [handoff plan](IMPLEMENTATION_HANDOFF_PLAN.md).

## 2. Vision

Layers makes images, PDFs and slides first-class wiki content. Anyone who may edit a page can draw on it in a fast, modern editor. Every change is an ordinary page revision, with history, diffs and restore. Search finds the words in drawings, and Cargo can query them and feed them. Nothing Layers adds weakens the wiki's security or speed.

## 3. The finish line

Layers 2.0 ships when all of the following are true on a standard MediaWiki install, each backed by evidence:

1. **History:** every Layers edit, whether on an image, a PDF page or a slide, is a native revision of a wiki page. It shows in history, diffs, watchlists and recent changes, and it can be restored. This is on by default. (HIST)
2. **Search:** MediaWiki search finds pages and files by the words in their drawings. (SRCH)
3. **Cargo:** Cargo can query drawing text, and page data can fill drawing text. (CARGO)
4. **Features:** the editor has the feature set in 5.5, including links from layers. (FEAT)
5. **Content types:** images, PDFs and slides each pass the whole journey in 5.6. (TYPES)
6. **Security:** a full security review of the release candidate leaves no open high or critical finding. (SEC)
7. **Speed:** the performance budgets in 5.3 are met on the reference install. (PERF)
8. **Interface:** the UI passes the design and accessibility criteria in 5.4. (UI)
9. **Data:** no known data-loss defect is open. (DATA)
10. **Upgrade:** an existing 1.5.x wiki upgrades with its drawings intact. (OPS)
11. **Sign-off:** all automated gates are green, and the project owner has completed the acceptance scenarios in section 7 on their own wiki.

**Victory is declared by the project owner after item 11, not by passing tests alone.**

## 4. Constraints

These hold for every piece of work and are not traded against features.

- **MediaWiki-native.** Only supported extension mechanisms. No Docker, containers, workers, host supervisors, PowerShell or .NET as runtime, dependency or optional backend ([AGENTS.md](../AGENTS.md)). Docker is only our test environment.
- **Platform.** The MediaWiki versions declared in `extension.json` (currently 1.44 and later, tested on 1.45), using the wiki's own database search. Cargo is optional. `REL1_43` receives security and data-integrity fixes only.
- **One write path per kind of data.** History reads the exact revision asked for and never substitutes the latest content.
- **Caching stays on.** Drawings never disable the parser cache or page caching.
- **User content is never silently changed.** Validation refuses content rather than repairing it, and the refusal says what failed.
- **Everything the user sees is translatable.** No raw message keys, `$1` placeholders or English-only strings.

## 5. Pillars and exit criteria

Every criterion is required for 2.0. Status values: **Met** (done and verified), **Partial** (some of it done or not yet verified), **Open** (not started).

### 5.1 Secure (SEC)

| ID | Criterion | Baseline |
| --- | --- | --- |
| SEC-1 | Every write needs a CSRF token, the `editlayers` right and ordinary edit permission on the page that owns the drawing. Protection, cascading protection and blocks apply. | Met |
| SEC-2 | Every read rechecks read permission. Hidden or suppressed revisions and deleted files never leak through Layers APIs, thumbnails, exports, search or Cargo. | Partial: APIs and exports are checked; search and Cargo with revision deletion are untested |
| SEC-3 | All user content (text, colours, URLs, SVG, images) is validated on the server against a whitelist. No stored script injection through any viewer, export or special page. | Met for today's fields; links (FEAT-8) need URL validation |
| SEC-4 | Every write or expensive action has a rate limit that ships with defaults. | Met (`check:ratelimits`) |
| SEC-5 | Links from layers obey `$wgUrlProtocols` and `$wgNoFollowLinks`, and pass through spam blacklist and abuse filter checks. | Open |
| SEC-6 | A full review of the 2.0 candidate (OWASP Top 10 plus MediaWiki-specific risks) leaves no open high or critical finding, and every fix is retested. | Open: the last full audit (June 2025) predates page history |
| SEC-7 | Shipped assets, including vendored pdf.js, are checked for known vulnerabilities. | Partial |

### 5.2 Trustworthy data (DATA)

| ID | Criterion | Baseline |
| --- | --- | --- |
| DATA-1 | A save either succeeds completely or changes nothing, and no layer or property is lost silently. | Met for page history; ordinary saves validate first |
| DATA-2 | When two people edit at once, the second is told, keeps their work, and can compare before choosing. | Partial: conflicts are detected and work is kept; there is no comparison view |
| DATA-3 | Unsaved work survives a crash, a closed tab or an expired session, and a lost response never creates a duplicate. | Met for page history |
| DATA-4 | Deleting, undeleting, moving, protecting and revision-deleting pages and files work as they do for text, and nothing reappears or is lost. | Partial: moves, undelete and rollback done; revision deletion untested end to end |
| DATA-5 | Drawings are included in ordinary database backups and XML exports. XML import either works or refuses with a clear message. | Partial: XML export includes drawings; import is refused |

### 5.3 Fast (PERF)

Measured on a **reference install**: production settings (object cache on, ResourceLoader minification), files on local disk (not the test environment's shared mount), a mid-range laptop and Chromium. The numbers are provisional until PERF-0 records a baseline; after that, only the owner changes them.

| ID | Criterion | Baseline |
| --- | --- | --- |
| PERF-0 | A scripted, repeatable benchmark in the repository measures PERF-1 to PERF-7 and runs before each milestone. | Met (September 29): `npm run bench` measures PERF-1 to PERF-7 from a known baseline, reports cold and warm separately and writes a results file per run (J83, corrected by J85, J86, J88 and the lead) |
| PERF-1 | A page with drawings gets at most 150 KB (gzip) of Layers code and styles; a page without drawings gets none. Nothing Layers adds blocks rendering. | Met on the test wiki (September 29): 83 KB gzip of Layers modules on a page with drawings, none on a page without; the viewer also loads on every `File:` page |
| PERF-2 | A drawing appears within 300 ms after its image has loaded. | Not met on the test wiki (September 29): 0.6 s to 3.1 s warm, 8.1 s cold; the drawing's own fetch takes 0.55 s and starts only after the viewer module has loaded; what makes some warm runs slow is not known yet |
| PERF-3 | The editor is usable within 3 s of pressing Edit, with a warm cache. | Met on the test wiki (September 29): 1.6 s warm, 5.3 s cold |
| PERF-4 | With 100 layers, dragging, resizing and panning run at 50 frames per second or more, and each typed character appears within 50 ms. | Met on the test wiki (September 29): dragging, resizing and panning at 60 frames per second; a typed character is painted within 17 ms at worst (headless Chromium, before the screen refresh) |
| PERF-5 | Saving a 100-layer drawing takes at most 1 s on the server, and so does viewing an old revision. | Not met on the test wiki (September 29): saving 1.6 s; opening an old revision 1.0 s warm, 3.2 s cold; both timed in the browser |
| PERF-6 | On a page with 20 drawings, drawings that are off screen are deferred, and no Layers task blocks the browser for more than 200 ms. | Met on the test wiki (September 29): viewers start lazily, and no long task after 20 drawings were painted |
| PERF-7 | A small edit to a drawing that contains images does not copy the image data into the new revision (see FEAT-3c). | Not met (measured September 28 and 29): each edit stores the whole drawing again; the drawing slot is 200 KB in both revisions |

### 5.4 Modern, consistent, accessible UI (UI)

| ID | Criterion | Baseline |
| --- | --- | --- |
| UI-1 | One visual language across editor, viewer, overlays, dialogs and special pages, built on MediaWiki's Codex design tokens (colour, spacing, type, corner radius) and icons. OOUI is used only where Codex has no equivalent. | Partial: OOUI with Layers' own styles |
| UI-2 | Light and dark themes in Vector 2022; works in legacy Vector; the viewer works in the mobile skin (Minerva). | Partial: Vector 2022 dark mode done; Minerva untested |
| UI-3 | Layers' own UI meets WCAG 2.2 AA: keyboard operable, visible focus, 4.5:1 text contrast, and names for screen readers. Checked by automated accessibility checks in browser tests and one manual screen-reader pass. | Partial: axe checks run on seven screens in light and dark (J84); four violation kinds fixed; layer rows still nest buttons in listbox options |
| UI-4 | Readers who cannot see a drawing can get its text in reading order. | Open |
| UI-5 | Right-to-left interface languages lay out correctly. | Open |
| UI-6 | The editor follows common drawing-app conventions (tool placement, shortcuts, properties that fit the selection), checked against the [UX audit](UX_STANDARDS_AUDIT.md). | Partial: the colour picker is the known gap; in the page-owned editor Escape with the pointer tool closes the editor instead of deselecting, and its return target is the file page, not the page that owns the drawing (J97 findings, September 30) |
| UI-7 | Every error says what failed and what to do next. | Partial: J79 found a raw key and unfilled limits, now fixed; no systematic review yet |
| UI-8 | Tablets can edit by touch (select, move, resize, draw, type), and phones can view. | Partial: basic touch works |
| UI-9 | The owner signs off a screenshot set of every screen, in light and dark. | Open |

### 5.5 Feature-complete editor (FEAT)

| ID | Criterion | Baseline |
| --- | --- | --- |
| FEAT-1 | Drawing tools: the 17 current tools, the Shape Library (1,385 shapes) and emoji (2,817). | Met |
| FEAT-2 | Styling: solid, gradient and blur fills, strokes, opacity, shadows, blend modes and rich text. | Met |
| FEAT-3a | Layers move between drawings: export and import a whole drawing or a selection as JSON. | Partial: whole drawings only |
| FEAT-3b | Images can be added from a file, by drag and drop, and by pasting. | Partial: file picker only |
| FEAT-3c | A file already on the wiki can be inserted as an image layer by reference. It is tracked in the file's usage and is not copied into every revision. | Open |
| FEAT-3d | Export PNG and JPEG, and print or save as PDF with annotations, for images, PDFs and slides. The output matches the viewer. | Partial: export exists; fidelity gaps are listed in [known issues](KNOWN_ISSUES.md) |
| FEAT-4 | Undo and redo of at least 50 steps, covering every editing action, including property changes, grouping and reordering. | Met (50 steps); coverage of every action is unverified |
| FEAT-5 | Copy, cut, paste and duplicate within a drawing, between drawings and pages, and paste text and images from other applications. | Partial: within one editor session only |
| FEAT-6 | Selecting and arranging: multi-select, folders, align and distribute, smart guides, snapping, lock and hide, and layer order. | Met |
| FEAT-7 | Several named drawings per page, including several for one file. | Met |
| FEAT-8 | **Links from layers.** Any shape, text or image layer can link to a wiki page (optionally a section) or an external URL. Readers follow it by click or keyboard, and hovering shows the target. Internal links count in "What links here", and links to missing pages show as missing. External links appear in `Special:LinkSearch`. Link changes show in diffs, and exported PDFs keep the links clickable. | Open |
| FEAT-9 | Page values fill `{{name}}` tokens in drawings (`{{#layers_fields:}}`). | Met |

### 5.6 Images, PDFs and slides (TYPES)

| ID | Criterion | Baseline |
| --- | --- | --- |
| TYPES-1 | Images: JPEG, PNG, GIF, WebP and SVG (TIFF as far as the wiki can render it). Annotations stay aligned at every size and stay tied to the file version they were drawn on after a re-upload. | Partial: JPEG and PNG tested; GIF, WebP and SVG untested; TIFF partial |
| TYPES-2 | PDFs: each page is annotated separately; old revisions show the PDF version the page was drawn on; the whole annotated document can be printed or exported. | Partial: a PDF page can get its own drawing, which paints over that page and is absent from earlier revisions (browser acceptance J98); new PDF versions and export are unverified |
| TYPES-3 | Slides: standalone canvases with configurable size and background, several per page, with a full-size view, and copyable to other pages. | Partial: a page can copy another page's slide from an embed (September 29) or from the editor's list (September 30, native tests; browser acceptance J100 queued) |
| TYPES-4 | Each type passes the whole journey in browser acceptance tests: create, save, history, diff, restore, search, Cargo, export, and copy to another page. | Partial: the journey specs cover create, save, history, diff, restore, search (J98) and copy to another page; Cargo and export are not covered |

### 5.7 Page history (HIST)

| ID | Criterion | Baseline |
| --- | --- | --- |
| HIST-1 | Every save of any drawing creates exactly one native revision of the page that owns it, with user, summary and the `layers-page-drawing` tag. No Layers write bypasses page revisions. | Met once the migration is recorded (September 30): shared sets and slides are then read-only (`layers-shared-sets-migrated`), so every Layers write is a page revision with the editor's summary or an automatic one (J89). Before the migration shared sets still save outside history; the [upgrade guide](UPGRADING.md) ends that window |
| HIST-2 | History, old revisions, visual diffs, restoring one drawing, rollback and undo all work. Watchlists, recent changes, notifications and contributions show drawing edits. | Partial (September 30): history, old revisions, visual diffs, restore and rollback are built; recent changes, contributions, the watchlist and history list every drawing edit with its summary and the `layers-page-drawing` tag (API probe on the test wiki). Core's undo restores only the page text and did nothing for a drawing edit, so on an edit that changed drawings the history now offers "undo drawing: <name>", which opens the earlier version for an editor to restore. Notifications are unverified; browser acceptance is J101 |
| HIST-3 | On by default: no pilot setting or owner list is needed (D2). | Met (September 29): `$wgLayersPageDrawingNamespaces` defaults to the content namespaces and `File:`; the pilot settings are retired (browser acceptance J92) |
| HIST-4 | Every drawing belongs to one page and has a name that is unique on that page. Its full identity is the page's ID plus the name (D1). A page shows only its own drawings. A bare `layerset=name` means this page's drawing, so it starts empty on a page that has none. | Partial: new and changed drawings need a unique name (September 27); embeds, fields and adoption use page ID plus name (September 28); an embed naming a drawing the page lacks offers to create it, and the first save adds it (September 29; browser acceptance J90); bare names mean the page's own drawing once the migration is recorded (September 29) |
| HIST-5 | Another page's drawing can be **copied** into a new drawing of this page, a new branch (D1). The copy's first revision records where it came from, and it never follows the original. Nothing is shared live between pages. Copying wikitext never gives edit rights over another page's drawing. | Partial: a drawing can be copied from an embed that names it (September 29; browser acceptance J91) and, since September 30, picked from the editor's list of other pages' drawings, as a new drawing whose revision names the source page and revision (native tests; browser acceptance J100 queued). Not built: copying a selection of layers |
| HIST-6 | Old revisions of a page show every drawing as it was then. | Met for page-owned drawings |
| HIST-7 | Renaming a drawing updates this page's embeds in the same revision. | Met on the test wiki (September 29): the editor's Rename control publishes a new name with the next save, which rewrites the page's direct embeds in the same revision (browser acceptance J87) |
| HIST-8 | Existing drawings move into page history (D3). The migration has a dry run, can be resumed and undone, loses nothing, and pages look the same afterwards. | Met on the test wiki (September 30): steps 1 to 3, dry run, resume and undo (J95); bare names mean the page's own drawings and shared sets are read-only afterwards; galleries follow the same rules (browser-checked in J98); the legacy editor links lead to page drawings; the test wiki was migrated, undone and migrated twice from the upgrade guide (J99). Left: the owner's own wiki (S7) |

### 5.8 Search (SRCH)

| ID | Criterion | Baseline |
| --- | --- | --- |
| SRCH-1 | Database search finds a page by the text of its drawings, and a `File:` page by the text of its own drawings. Results show the drawing text as the snippet. | Met (J80); after the migration a word in a page's own drawing is found about 2 seconds after the save and gone about 2 seconds after the restore (browser acceptance J98). `File:` results have no snippet, a core limit |
| SRCH-2 | The index follows every change (save, delete, rename, restore, revision deletion, page deletion) without manual steps, and a maintenance script rebuilds everything. | Partial: revision deletion and suppression untested |
| SRCH-3 | Link text and link targets from layers are searchable. | Open (needs FEAT-8) |

### 5.9 Cargo (CARGO)

| ID | Criterion | Baseline |
| --- | --- | --- |
| CARGO-1 | `{{#layers_cargo_store:}}` stores one row per text layer for every drawing the page owns: page, revision, drawing, kind, layer, type, text and link target. | Partial: page-owned drawings are stored; no link column |
| CARGO-2 | Page values, including Cargo query results, fill drawing text in every viewer. | Met |
| CARGO-3 | Cargo's own tools rebuild the rows, and an old revision is never filled with today's query results. | Partial |
| CARGO-4 | Everything else works without Cargo installed. | Met |

### 5.10 Operable and maintainable (OPS)

| ID | Criterion | Baseline |
| --- | --- | --- |
| OPS-1 | Install and upgrade from 1.5.x with `update.php` and documented maintenance scripts. The migration has a dry run and a way back. | Partial: [upgrade guide](UPGRADING.md) written (September 29) and rehearsed on the test wiki (September 30: undo, refresh, migrate again, undo and migrate a second time); not yet followed on a copy of a 1.5.x wiki |
| OPS-2 | Every setting and API is documented, examples are checked against real behaviour, and [known issues](KNOWN_ISSUES.md) is current. | Partial: known issues was last updated September 11 |
| OPS-3 | All automated gates are green: `npm test`, PHP style, standalone and native PHPUnit, and the full browser suite, with statement coverage of at least 90%. | Partial: JavaScript statement coverage 94.95%, branches 86.45% (September 30, 15,072 tests); PHP coverage cannot be measured here (no coverage driver); the full browser suite has not been run in one pass since the migration |
| OPS-4 | Every criterion in this charter has an automated test, and every user-facing one also has a browser acceptance spec. | Partial |

## 6. Decisions

### D1 — Every drawing belongs to a page (decided September 27, 2026)

Proposed by the project owner; refinements (a)–(d) are the lead's.

- A drawing is created on a page and belongs to it, and its edits are revisions of that page. Its name is unique on that page, and its full identity is the page's ID plus the name. A file's own `File:` page can own drawings like any other page.
- A page shows only its own drawings. `layerset=name` means this page's drawing called *name*. If the page has none, it starts empty, even when another page has a drawing with the same name.
- To reuse another page's drawing, the author picks it from the editor's list of drawings, where drawings from other pages are shown with their page. The editor offers to **copy it to this page**: the layers become a new drawing of this page, a new branch. Its first revision says where it was copied from, and it never follows the original again.
- **No read-only or live sharing between pages.** A page that showed another page's drawing would change when the other page is edited, with nothing in its own history. Page history must account for every change to what a page shows, so reuse is by copying only.
- **(a)** The editor writes the page ID into the embed (for example `layerset=228:anatomy`), so nobody needs to know or type page IDs. A bare name typed by hand still means this page's drawing. The exact syntax is settled in the design.
- **(b)** If wikitext is copied to another page, an embed that names the original page shows nothing there and never gives edit rights over the original drawing. Because the embed says where the drawing came from, the editor offers to copy it.
- **(c)** Internally each drawing also keeps a permanent ID, so history, search and Cargo do not depend on names.
- **(d)** Renaming a drawing updates this page's embeds in the same revision.

Why: every edit must be in the history of the page it changes, and one storage model means search, Cargo, links and security are built once. It matches the existing page-owned design, where identity is the page ID plus a drawing ID and never a title, so much of it is already built.

### D2 — Page history is on by default (decided September 27, 2026)

Layers changes must show in page history for revision tracking in production, so this is the default behaviour. Every content page and every `File:` page can own drawings without configuration, and the pilot settings are retired. An administrator can limit which namespaces may have drawings.

### D3 — Existing drawings move into page history once (lead decision)

Today's drawings are stored outside page history: *shared sets* attached to a file, and standalone *slides*. Upgrading to 2.0 moves them into page history with a maintenance script:

1. Each file's shared sets become drawings of that file's `File:` page, under the same names, so every set keeps a home. Their current versions become one new revision of the `File:` page. Earlier versions stay viewable, read-only.
2. Each page that shows one of these sets gets its own copy in one edit, and its embed then names that copy, so the page looks exactly as before. The copy's revision says it came from the `File:` page's drawing. An embed that asked for "the latest set" (`layerset=on`) gets the set that was latest at the time of migration.
3. Each standalone slide becomes a drawing of the page that shows it. If several pages show it, each gets its own copy. If none does, the script creates a page for it.
4. The script lists every change in a dry run first, can be resumed after an interruption, marks its edits as bot edits with a clear summary, and leaves the old tables untouched, so the migration can be undone.

Afterwards the copies change independently: an image annotated once and shown on five pages becomes five drawings, each edited on its own page and recorded in that page's history. This is the intended result of D1.

### D4 — A modern, native look (lead decision)

Codex is MediaWiki's current design system: the buttons, dialogs, colours and icons of today's Wikipedia. Layers mostly uses the older toolkit (OOUI) with styles of its own, so parts of it look like older MediaWiki. Layers moves to Codex's colours, spacing, type and icons screen by screen, starting with dialogs and panels. There is no rewrite, and the drawing canvas is not affected. Dark mode and every skin follow automatically.

### D5 — Order of work (lead decision)

- **Lead:** D1, D2 and D3 (history for everything), then links from layers, then images by reference and clipboard, then the design pass and performance fixes, then documentation and the security review.
- **Juniors, alongside:** browser acceptance of each lead step, the performance benchmark (PERF-0) early so that later fixes have a baseline, and automated accessibility checks in browser tests (UI-3).
- The security review is last, on the release candidate, followed by the owner's acceptance.

### Standing decisions

- **D6:** the supported backends are MediaWiki's database search and Cargo 3.x. CirrusSearch is best-effort.
- **D7:** page history came first, then search, then Cargo. Done.

## 7. Acceptance scenarios for the project owner

The owner runs these on their own wiki with a normal login, after all automated gates pass.

| ID | Scenario |
| --- | --- |
| S1 | **Annotated photo.** Upload a photo and annotate it with arrows and a callout that links to another page. Save, look at history and the diff, restore the earlier version, find the callout text with search, and list it with a Cargo query. |
| S2 | **PDF.** Annotate page 2 of a multi-page PDF. Upload a new version of the PDF and check that the old revision still shows the old page. Export the annotated PDF and compare it with the viewer. |
| S3 | **Slides.** Create three slides with text, a wiki image and shapes. Open the full-size view, copy one slide to another page and change the copy, and find each slide by its text. |
| S4 | **Reusing a drawing.** On page A, draw on a file and save. On page B, write the same name: B's drawing is empty. From B's drawing list, copy A's drawing, change the copy and save. Check that A is unchanged, that B's history records the copy and where it came from, and that editing A later does not change B. |
| S5 | **Interruptions.** Close the tab mid-edit and recover the work. Edit the same drawing in two browsers, and check that neither person's work is lost. |
| S6 | **Permissions.** A reader cannot edit. A protected page's drawing cannot be edited without the right. A blocked user is refused. A revision-deleted drawing is hidden everywhere, search included. |
| S7 | **Upgrade.** A copy of the owner's wiki upgrades from 1.5.x and keeps every drawing, and its old versions stay viewable. |

## 8. Not in 2.0

Worth doing later, but none of these holds up the finish line:

- Live co-editing, comments anchored to layers, and review or approval workflows.
- Slide decks with thumbnails, reordering and presentation playback.
- Structured annotation roles and authoring checks ([roadmap](../improvement_plan.md) section 5).
- Templates, stamps and calibrated measurement tools beyond today's tools.
- Editing on phones (phones can view).
- SVG export and portable packages that include assets.
- CirrusSearch verification, unless the owner's wiki adopts it.
- XML import of pages with drawings (2.0 refuses it clearly).
- Feature parity on `REL1_43`.

## 9. How we would lose our way

- Building something that no criterion here asks for.
- Adding a second write path, or a "temporary" fallback to the latest data.
- Declaring work done because tests pass. In J79, every gate was green while users saw a raw message key; browser and owner checks are part of done.
- Counting lines, tests or large files instead of meeting criteria.
- Rewriting dated records to make them look current.

## 10. Remaining work, in order (September 27, 2026)

**Estimate.** About 48 lead deliverables remain, each the size of one reviewed commit such as those of September 26, plus 12–15 junior packets alongside. The count per item is in brackets. Over September 25–27 the lead landed about ten such deliverables per full working day; the remaining items are larger (migration, links, the design pass) and the browser suite is slow, so plan on five to ten a day. That is roughly one to two weeks of full-time work before the owner's acceptance, most likely nearer two. Re-estimate at each milestone.

1. [6] **Drawings belong to pages:** unique names, page IDs in embeds, copying from another page, and renames that update embeds (HIST-4 to HIST-7, D1).
2. [3] **On by default** (HIST-3, D2).
3. [5] **Migration** of shared sets and slides (HIST-8, D3), with the upgrade guide (OPS-1).
4. [2] **History checks:** watchlist, recent changes and undo; diffs and restore in the browser (J81) (HIST-2).
5. [5] **Links from layers**, with their security, search and Cargo parts (FEAT-8, SEC-5, SRCH-3, CARGO-1).
6. [5] **Images and clipboard:** wiki files by reference, drag and drop, pasting, and copying between drawings (FEAT-3a, FEAT-3b, FEAT-3c, FEAT-5, PERF-7).
7. [7] **Design pass:** Codex, right-to-left languages, the mobile viewer and the reader text view (UI-1, UI-2, UI-4 to UI-9, D4).
8. [4] **Performance fixes** against the PERF-0 baseline (PERF-1 to PERF-7).
9. [5] **Conflict comparison, exports and revision deletion** (DATA-2, DATA-4, DATA-5, FEAT-3d, TYPES-2).
10. [4] **Documentation refresh** (OPS-2), then the **security review and asset audit** (SEC-6, SEC-7).
11. [2] **Owner acceptance** (section 7), then release 2.0.

Alongside, juniors: the performance benchmark (PERF-0), automated accessibility checks (UI-3) and browser acceptance of each step (OPS-4, TYPES-4).

## 11. Progress review — September 30, 2026

Reviewed by the lead against section 10, with fresh evidence: 204 Jest suites (15,072 tests, 94.95% statements), 437 native tests, 1,314 standalone tests, and browser acceptance specs J87 to J99 on the test wiki.

| Item | State |
| --- | --- |
| 1. Drawings belong to pages | Built, including the editor's list of other pages' drawings and its copy action (September 30, after this review). Left: its browser acceptance (J100) |
| 2. On by default | Done (HIST-3) |
| 3. Migration and upgrade guide | Done on the test wiki (HIST-8, OPS-1). Left: the owner's wiki (S7) |
| 4. History checks | Done except notifications and browser acceptance (J101): recent changes, contributions and watchlist verified, and undo of a drawing edit fixed (September 30, after this review) |
| 5. Links from layers | Designed in one piece (September 30, [LINKS_FROM_LAYERS_DESIGN.md](LINKS_FROM_LAYERS_DESIGN.md)), not built. The largest unbuilt feature (FEAT-8, SEC-5, SRCH-3, CARGO-1) |
| 6. Images and clipboard | Not started (FEAT-3a to FEAT-3c, FEAT-5, PERF-7) |
| 7. Design pass | Not started (D4, UI-1, UI-2, UI-4 to UI-9) |
| 8. Performance fixes | Not started. PERF-2, PERF-5 and PERF-7 are not met |
| 9. Conflict comparison, exports, revision deletion | Not started (DATA-2, DATA-4, DATA-5, FEAT-3d, TYPES-2) |
| 10. Documentation and security review | Not started. [Known issues](KNOWN_ISSUES.md) still dates from September 11 and contradicts the code on search and Cargo |
| 11. Owner acceptance | Not started |

**Are we on track?** Yes on scope, behind on pace.

- **Scope.** Every piece of work since September 27 advanced a criterion: the migration and its guide (HIST-8, OPS-1), the change of bare names and galleries (HIST-4, HIST-8), the legacy entry points (HIST-8, UI-7) and the browser specs J93 to J99 (OPS-4, TYPES-4, FEAT-1, FEAT-4, FEAT-6). Nothing was built that the charter does not ask for.
- **Pace.** Items 1 to 3 (14 of the 48 deliverables) took about four days, roughly four a day against the five to ten planned, because the migration needed four rounds of review and a rehearsal on the test wiki. At that rate the remaining 34 take about nine working days. The estimate of one to two weeks still holds, nearer two.
- **Stale rows fixed today:** HIST-1, HIST-8, TYPES-2, TYPES-4, SRCH-1, UI-6 and OPS-3 (above). The coverage figure was from September 2.

**Risks, in order of size**

1. **Scenario S4 cannot be run** until the editor's drawing list and copy action exist. It is the next deliverable.
2. **Links (FEAT-8)** touch validation, link tables, search, Cargo, diffs and PDF export in one feature. Design it in one piece before building.
3. **Images by reference (FEAT-3c, PERF-7)** need a storage decision first: the drawing slot repeats 200 KB of image data on every save, which no amount of tuning fixes.
4. **The escaped-defect pattern from J79 and J97**: a green gate that tested nothing. Two J97 tests and one J98 check passed while asserting nothing. Review of every new spec for discriminating assertions stays part of done.
5. **New attack surface since the last audit** (Adopt and Copy special pages, the migration script, the File page drawing entry points). Each has tests; SEC-6 still covers them last, on the release candidate.

**For the owner**

- **Legacy code.** The shared-set editor, the slide special pages and the old save APIs stay in the tree for the upgrade window, and refuse writes once the migration is recorded. Delete them in 2.0, or keep them for one more release? The charter does not say.
- **S7 needs a copy of your real wiki.** Until we have one, the upgrade has only been rehearsed on the test wiki.
