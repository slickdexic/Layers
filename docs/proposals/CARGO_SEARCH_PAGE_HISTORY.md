# Page-owned history, searchable content, and Cargo integration

Status: proposed architecture, September 6, 2026. The original investigation made no feature or configuration changes. Implementation now starts with an internal MCR persistence proof; see [the implementation contract](../PAGE_OWNED_HISTORY_IMPLEMENTATION.md). Public page-owned history remains unavailable.

## Recommendation

The agreed priority order is **revision history, MediaWiki search, then Cargo query/filter support**. Images, PDFs and standalone slides are equal participants in one content model. Slides are a general-purpose canvas. Presentations, diagrams, educational material and SOPs are examples, alongside image and PDF annotations; no single example defines the model.

Build **page-owned publishing** first, with real MediaWiki revisions. Next make its text searchable. Then publish annotation text into a rebuildable Cargo table so it can be queried, filtered and joined to other business data. Reading a Cargo field into a textbox remains useful, but is a subsequent capability rather than the primary Cargo deliverable.

For a corporate deployment, page-owned publishing must be enforced for controlled pages. Legacy shared sets may remain available elsewhere, but an unaudited live reference must not silently enter a controlled page. Implementation must reject or require adoption/pinning of that reference through every supported publishing path. A browser control alone cannot enforce this.

For corporate documents, default to **saved values**: the diagram, its text, and the Cargo values displayed inside it belong to a particular page revision. A user can refresh linked values and publish the differences as a new revision. Unrecorded live updates would undermine the requested history guarantee.

## What exists today

- The local API reports MediaWiki **1.45.3** and Cargo **3.8.5**. Layers declares MediaWiki >=1.44. No CirrusSearch extension was listed by the local siteinfo response; the configured search implementation still needs verification before choosing an adapter.
- `src/Hooks/CargoHooks.php` and `src/Cargo/CargoLayersGalleryFormat.php` already integrate with Cargo galleries. They select named layer sets from query results. They do not bind individual annotation text to fields.
- `src/Database/LayersDatabase.php` stores revisions by file name/hash, set name, and PDF page number. **`ls_page` means a page within a PDF, not a MediaWiki article ID.** Existing sets are not owned by the article embedding them, and older revisions can be pruned.
- `src/Api/ApiLayersSave.php` saves this separate data and invalidates file/backlink caches. Cache invalidation is not a content revision or a complete search indexing contract.
- `src/Api/Traits/AuditTrailTrait.php` optionally re-saves unchanged main-slot content. The existing revision proposal overstates this as a completed audit feature: ordinary null edits do not create page-history or Recent Changes entries. It is also best-effort after the layer save and targets the File page, not its embedding article. [MediaWiki's null-edit documentation](https://www.mediawiki.org/wiki/Help:Dummy_edit#Null_edit)
- Text and rich-text runs are already stored in structured layer data, including standalone slides, so text extraction does not require OCR.
- `src/Hooks/SlideHooks.php` resolves named slides through the separate Layers store. The `Slide:` prefix used in that store is not proof that a slide has a corresponding real wiki page revision. Standalone slides need an explicit owning page just as image annotations do.

These are source/API observations. No live content was edited, no Cargo data was rebuilt, and no proof-of-concept migration was performed.

## 1. Page ownership and durable revisions

### The content model

Use MediaWiki's Multi-Content Revisions (MCR): retain normal article wikitext in `main`, and register a `layers` slot with a validated Layers content model. MediaWiki supports updating individual slots or multiple slots in a single page revision. Its documentation also makes clear that an extension must supply its own editing interface. [MCR documentation](https://www.mediawiki.org/wiki/Multi-Content_Revisions)

Proposed slot contents:

| Item | Purpose |
| --- | --- |
| Schema version | Allows controlled upgrades of saved data |
| Stable document/set identifiers | Renaming a display label does not break embeds |
| Surface kind: image, PDF page or standalone slide | Keeps source-specific behavior explicit |
| Source file identity and exact file version, where applicable | Image/PDF annotations stay aligned with the original upload; slides need no dummy file |
| Stable surface ID, dimensions and order; PDF page number where applicable | Identifies slides/sheets and preserves geometry and author-defined reading order |
| Layers, ordering, backgrounds and styles | Reconstructs the saved annotation state |
| Cargo binding definitions and resolved values | Preserves both provenance and displayed text |
| Rendering/schema version where necessary | Supports future compatibility decisions |

The owning wiki page supplies the page identity; do not trust a client-provided owner field. A page may own several images, slides or PDF sheets, including mixed content. Prefer one slot containing their manifest over registering a new slot role for every diagram. Keep bulky reusable assets out of repeated JSON where possible, with immutable, retained references.

For slide-based SOPs, the SOP article itself owns the slide content. It may contain little prose beyond its title and slide placements, but is still a real, editable, searchable wiki page with history. A standalone slide created outside an article must obtain an explicit owner page before publication; the slide browser/editor is an interface to that content, not an alternative revision store. Select the page title explicitly rather than inferring it from a global slide name. A new page and its initial Layers slot must be created in one revision.

The MediaWiki revision is authoritative. Existing Layers tables may become rebuildable lookup indexes for this mode; they must not be a second mutable authority. Do not point historical revisions at legacy rows that pruning can delete. Content-addressed external blobs are a possible later optimization only with reliable retention, backups and suppression controls.

### The save contract

1. The editor opens a specific owner page revision and document identifier.
2. It submits the changed document with its base revision, edit summary and CSRF token.
3. The server checks the current user's normal page editing authority, protection/block restrictions, Layers rights and source-file access. Validate every layer and binding server-side.
4. Resolve any explicitly refreshed Cargo values, validate the complete change, and write the slot through the normal page revision pipeline (`PageUpdater`), preserving untouched slots. Use conflict detection; begin by rejecting stale bases rather than silently merging geometry.
5. Report success only after the revision is committed. Rebuildable indexes, cache invalidation and search work follow via retryable updates. A failed revision write must leave the old published diagram intact.

One explicit **Save** should commit all edited surfaces in that owner-page editing session together, whether they are SOP slides, image annotations or PDF pages. The current separate buffered-page saves are not adequate for this guarantee. Identical content can remain a no-op; changing text, geometry, background, binding, set name, slide order, or removing a set is a real change. Do not automatically mark every annotation edit minor.

The publication invariant is: **no new published Layers state becomes visible unless the owning page revision containing that state has committed**. An audit event written after a separate layer-table update does not satisfy this. Block all legacy save/delete/rename routes from mutating adopted content. Readers must resolve authoritative revision content even when derived caches, search or Cargo are temporarily unavailable. A failed secondary-index update is retried and reported operationally; it must never redirect readers to an uncommitted or newer mutable copy.

Page history would show, for example, “Updated Plant layout: changed pressure limit and moved two callouts.” Provide a structured diff listing added/removed layers and old/new text, plus a visual comparison. Raw JSON diffing alone is not a satisfactory corporate user experience.

### What binding or locking means

Ownership is an authority boundary, not a permanent exclusive editor lock. The page's edit permissions control changes. Optimistic conflict detection prevents lost edits; advisory “someone else is editing” warnings can come later.

An annotation document owned by `Plant A/Operating procedure` cannot be changed through the legacy global file-set API. Another article can either make its own copy or reference a **specific owner revision**. A reference to the owner's latest revision is convenient for shared dashboards, but it cannot promise that the consumer article's own history records every visual change. For controlled documents, use copies or pinned references; changing the pin creates a consumer-page revision.

Bind lookup tables to stable page IDs, with normal page-move handling. Page deletion/undeletion, revision hiding/suppression, rollback, undo, XML export/import and permission changes need explicit integration tests. MCR supplies storage facilities, not a guarantee that every Layers viewer/API/export path already respects them.

### Historical rendering

Every route—inline display, lightbox, editor, print and PDF download—must receive the owner revision and load that snapshot. Viewing `oldid` must never fall back silently to the latest layer set or current Cargo query.

For images and PDFs, pin the background upload version too. For standalone slides, retain canvas settings and any embedded image assets without inventing a parent file. A file hash alone is not a retrieval/retention policy: retain the relevant archived upload or other immutable asset reference. If a source has been deleted or access revoked, show an unavailable-source state rather than substituting the newest file. Never bypass revision suppression to reconstruct an old diagram.

This preserves saved content; identical pixels across future browser/font/renderer changes are a stronger archival requirement. If required, retain versioned fonts/assets and a generated archival PDF alongside the structured record.

## Ordinary MediaWiki search — priority 2

Textboxes/callouts are searchable in principle because their text is already structured data. Build a shared extractor that follows rendered rich-text ordering, preserves words and Unicode, and includes only the published, searchable annotation text. Include PDF page/set labels as context. Keep unsaved drafts and suppressed revisions out of the index; ordinary search should target current published content, not every historical value.

The owning article should be the search hit, with a transcript entry linking to the corresponding image, slide or PDF sheet and layer. A **Layers content** transcript also makes the text copyable and accessible without relying on canvas interaction. A slide-only SOP must be discoverable by words that occur only inside its slides, with useful snippets and a link that opens/highlights the matching slide. Search extraction must preserve defined slide/reading order; layer stacking order alone is not necessarily reading order.

Do not assume that a canvas, hidden HTML, a new JSON slot, or `SearchDataForIndex2` alone guarantees database-backed search support. Search backends take different indexing paths: the documented MediaWiki 1.45 maintenance updater explicitly passes the main-slot content to `SearchUpdate`. [Core updater source](https://doc.wikimedia.org/mediawiki-core/1.45.0-rc.0/php/updateSearchIndex_8php_source.html)

Two practical implementation routes:

1. **Conservative initial route:** generate a clearly marked, safely escaped annotation transcript in the main wikitext, and commit it atomically with the Layers slot. Store the actual text, not only a parser-function invocation. The transcript is a derived representation, regenerated by Layers; edits to its managed region need conflict detection and a documented repair policy. This uses the existing article search path, improves accessibility, and makes a conventional text diff useful. It adds managed text to article source, so test source editing, VisualEditor, undo and region deletion.
2. **Cleaner source, more integration work:** keep the transcript as generated output and implement explicit index augmentation for each supported backend. Investigate the current `SearchDataForIndex2`/content-handler path for supported engines, with a distinct strategy for core database search and its full rebuild path. Do not mark this supported until ordinary search, snippets, reindexing and deletion tests pass. The older `SearchDataForIndex` hook is deprecated. [MediaWiki hook migration history](https://gerrit.wikimedia.org/r/plugins/gitiles/mediawiki/core/%2B/0d1bc5760e53eb88078db0f45e32d13134c46b26/HISTORY)

I recommend route 1 for the first controlled-document release unless a short integration prototype proves route 2 reliable on the installed backend. Neither route requires Cargo. Database search still has its normal tokenization, minimum-word-length and stop-word limitations; exact equipment codes and multilingual text must be tested. File-namespace results also depend on namespace search settings, another reason to index the owning article.

Existing shared sets need an explicit search ownership policy. Indexing every set on every page that happens to embed its file could duplicate irrelevant or inappropriate text. Begin with adopted page-owned documents; offer selected legacy sets on their File pages later.

## Cargo query/filter support — priority 3

The first Cargo integration should make **Layers content available to Cargo**, independently of whether the text was typed or obtained from an external field. Generate one row per published text-bearing annotation in a dedicated, configurable table, provisionally `LayersAnnotations`.

| Proposed field | Meaning |
| --- | --- |
| OwnerPage / OwnerPageID | SOP or other owning wiki page; use the page ID for stable local joins |
| OwnerRevisionID | Exact published revision from which the row was extracted |
| DocumentID / SurfaceID / LayerID | Stable identity across renames and geometry changes |
| SurfaceKind | `slide`, `image` or `pdf` |
| SurfaceOrder / PDFPage | SOP order; source PDF page only when applicable |
| SetName / LayerType | Labels and annotation type for filtering |
| Text | Plain text in displayed rich-text order |
| Target | Link to the owner page and annotation |

This enables a Cargo table of all SOP instructions mentioning lockout, filtering annotations to standalone slides, or joining an SOP page to equipment/process metadata. Expose a complete joined transcript separately if page-level queries prove useful. Arbitrary annotation text is not automatically a structured equipment identifier; precise business joins may need explicit metadata later.

The table is a **derived index of current published content**, not the revision authority. An idempotent worker replaces all rows for an owner from its latest eligible revision; an older queued job must not overwrite a newer projection. Publish rows transactionally where supported, with a generation marker if needed to prevent readers seeing a half-updated SOP. Rebuild from revision content after Cargo table recreation. Handle removal, page deletion/undeletion, rollback, suppression and source permission changes. Indexing delay must be visible to operators and bounded by retries; a Cargo outage must not lose the authoritative revision.

Cargo's installed page-save path deletes and recreates page-derived data. This integration needs a dedicated projection adapter and rebuild lifecycle, rather than uncoordinated inserts that Cargo may subsequently remove. Standard Cargo query/table/drilldown behavior must be proven against the installed version. Do not expose draft, hidden or suppressed annotation text, and do not assume Cargo query results enforce the owner page's read restrictions. Start with an explicit allowed publication audience/table policy.

## Optional subsequent capability: Cargo-linked textboxes and callouts

### First release: read-only, one field per binding

Offer an editor control: **Text source → Typed text / Cargo field**. For a Cargo field, select an allowed table, source page/record, field, and optional prefix/suffix or simple formatter. Example: an equipment callout reads the `MaximumPressure` field for asset `P-101` and displays “Maximum pressure: 120 kPa”. Existing text layout and callout styling still apply.

Persist a structured binding, not user-written SQL. An illustrative descriptor is:

```json
{
  "provider": "cargo",
  "table": "Equipment",
  "sourcePageId": 421,
  "recordKey": { "field": "AssetID", "value": "P-101" },
  "field": "MaximumPressure",
  "mode": "snapshot",
  "format": { "prefix": "Maximum pressure: ", "suffix": " kPa" },
  "resolvedValue": "120"
}
```

Names and IDs above are examples, not a proposed change to the local Cargo schema. Resolve values on the server; never accept a client-supplied `resolvedValue` as verified Cargo data.

Cargo stores data derived from pages/templates. `_pageID` identifies the source page, while a page can produce multiple records. Use a declared unique business key when needed, and do not use Cargo's internal `_ID` as a durable identity: the installed store path allocates row IDs and the save hook deletes and recreates page data. [Cargo storage model](https://www.mediawiki.org/wiki/Extension:Cargo/Storing_data)

Require exactly one match for the initial scalar feature. Distinguish zero matches, duplicate matches, null and empty text. A missing/renamed field or removed table should produce an actionable binding warning; a published snapshot remains readable. Lists, joins, aggregates and expressions can follow after explicit semantics are defined.

### Security and consistency

- Allowlist tables and fields. Validate identifiers against Cargo schema and quote filter values with database APIs; do not expose arbitrary `where`, joins, SQL functions, URLs or executable expressions through the layer JSON.
- Apply page/record visibility policy as well as Cargo query rights. In the installed `CargoQueryAPI`, query permission is checked globally; do not assume that a successful query establishes per-source-page access.
- Treat copying a value into a snapshot as publishing it to the owning page's audience. For the first release, limit bindings to sources approved for that audience. A private value embedded in publicly readable revision content cannot be made safe merely by checking permission during preview.
- Use the same resolved text in canvas rendering, accessible transcript, searching and exports. Escape text for each output context. Apply length limits and show overflow before publishing; never silently truncate important values.
- Batch/cache lookups and retain a dependency index from source records to owner documents. Account for Cargo table rebuilds, source moves/deletions and schema changes. Avoid one SQL query per layer on every page view.

Record capture time and provenance. A current source revision ID is not automatically proof that an asynchronously rebuilt Cargo row came from that revision. Only label provenance as verified when consistency has been checked; otherwise label it as the observed value/capture time. This matters for audit claims.

### Snapshot versus live

| Mode | Source value changes | Historical view |
| --- | --- | --- |
| Saved snapshot — recommended for controlled pages | Editor sees an available update; Refresh and Save creates a new owner-page revision | Uses the saved value |
| Live display — optional later | Re-resolves with dependency invalidation and bounded cache lifetime | Must still use a stored snapshot; current live state is explicitly outside the “every change recorded” guarantee |
| Automatic tracked refresh — later | A service account publishes changed resolved values as ordinary page revisions | Uses the saved value from each revision |

Automatic tracked refresh requires an attributed actor, policy/approval rules, conflict handling, loop prevention, batching and failed-job recovery. Cargo and Layers saves are not inherently one cross-page or cross-database transaction. Do not promise instantaneous propagation.

Do not implement two-way writes initially. Directly updating Cargo tables would bypass their page/template source and could be overwritten on rebuild. A future “Edit source” action should change the authoritative source page through its normal editing workflow. In the reverse direction, exporting annotation text as a dedicated Cargo projection is feasible, but is a separate optional reporting feature.

## 4. Delivery plan and acceptance gates

| Phase | Deliverable | Required proof |
| --- | --- | --- |
| 0: revision integration prototype | Slide-owned SOP plus an annotated image and a PDF sheet, each with two revisions | A genuine new `rev_id` with unchanged prose; history entry; oldid restores old content for all three; failed save changes none of the published state |
| 1: durable page-owned mode | MCR content model, save/read APIs, explicit owner context, atomic multi-surface save, snapshot-aware render/export and diffs | Stale saves rejected; no legacy mutation bypass; archived assets retained; permissions, undo/rollback and deletion paths verified; live shared dependencies cannot bypass controlled-page history |
| 2: MediaWiki search | Shared text extractor/transcript, index updates and rebuild support | A slide-only SOP is found by words appearing only on its slides; add/change/remove text updates results and snippets; no draft/suppressed text leaks; all source types have working result links |
| 3: Cargo projection | Queryable/filterable annotation rows and rebuildable revision-aware indexing | Standard Cargo query/table returns slide/image/PDF text; stale jobs cannot overwrite newer rows; removal and rebuild work; unauthorized text stays out |
| 4: optional extensions | Cargo field bindings, tracked automatic refresh, approval integration and live dashboards | No update loops, unauthorized publication or revision drift; explicit operational policies |

Finish the history acceptance gates before treating search or Cargo as the next release priority. A pure read-only search experiment may inform the content schema, but should not displace revision work. This is a substantive feature project, not a small hook addition. Estimate implementation time after phase 0 exposes the integration costs; the current evidence does not support a precise schedule.

## 5. Adoption and outstanding decisions

Adopt legacy sets by an explicit import/copy into a chosen owner page, preserving available source IDs and attribution. Default to leaving the shared original intact. Do not bulk rebind existing embeds or fabricate historical wiki edits. Previously pruned layer revisions cannot be reconstructed.

Recommended starting policy: one authoritative owner per Layers document; snapshot values; pinned sharing; page permissions; a searchable transcript; and Cargo projections of published text. Pilot on a slide-based SOP, an annotated image and a PDF sheet. Migration should inventory every live Layers embed on controlled pages, including template/Cargo-generated embeds, and report unresolved dependencies before declaring a page covered. Do not imply that enabling a configuration flag automatically gives existing pages historical protection.

Before production rollout, confirm the desired owner-page conventions, allowed Cargo tables and unique record keys, search backend, access-control extensions, retention requirements, and whether “every change” means every published save or also continuous recording of draft actions. This proposal assumes every published save; draft autosaves remain private work in progress. Approval/sign-off, tamper-evident records and external backups are additional requirements, not guarantees supplied by ordinary page history.
