# Page ownership and ordinary editing implementation plan

September 23, 2026. **Approved direction; implementation pending.** This plan extends the existing native revision storage. It does not claim that ordinary embedded drawings already participate in owner-page history. Layers is a MediaWiki extension; Docker is only the existing testing environment.

## Current author entry — September 26, 2026

Already page-owned slides in the scoped pilot now have visible page-level edit links on an ordinary current-page view. The accompanying notice says that changes are saved in page history. Links are built from authorized direct saved bindings and carry exact source/revision parameters; clicking always rechecks them. The page-level list deliberately avoids guessing a mapping between parser-generated overlays and source occurrences. Repeated references to one drawing share an entry. Historical URLs and read-only accounts have no edit list.

The original-wiki browser test clicks this control, changes the drawing and verifies the resulting native revision. It restores its automated fixture after testing. Shared drawings still need explicit adoption, and image/PDF editing is not opened by this change. The following earlier delivery breakdown remains useful context; its bound-editor route and existing-bound-slide entry are now implemented.

## Next lead deliverable after J71 — September 25, 2026

Internal preparation and atomic publication now pass competing-adoption regression tests. This does not yet expose a supported ordinary-page ownership action. The next deliverable is the request-to-service connection, not another standalone test helper.

1. **Bound editor entry:** accept an explicit owner PageID, current base revision and selected direct occurrence. Resolve the current native owner and actor rights, read that exact main content, scan the occurrence and obtain its binding from server-read source. Require binding PageID to match the native owner and its surface to exist in that revision. A valid-looking browser token alone is insufficient. Refuse historical editing, stale bases, cross-owner bindings, template-generated ambiguity and unavailable rendering; never fall back to a shared save. Keep current pilot scope/lifecycle protections until their replacements are tested.
2. **Adoption confirmation and write:** identify the exact immutable legacy row and occurrence for explicit confirmation. The write receives selection identity and base revision, not authoritative caller-provided snapshot or rewritten main text. Re-run authorization and server preparation at dispatch, then pass only that trusted result to atomic publication. Do not reuse an old prepared main document with a newer base. Return the committed page/surface/revision only after success. A lost response requires deliberate exact-history reconciliation; no automatic duplicate adoption or retry.
3. **Unlock UI work only on a working contract:** provide J64 with callbacks, allowed states, fixed user messages and rejection behavior once the above path is implemented and tested. J65 then exercises ordinary overlay → explicit ownership → edit/save → owner history, including preservation of the shared original and other consumers. Image annotations and pinned historical media remain part of the acceptance target; a slide-only route is an intermediate delivery.

The server-derived PageID recently added to the existing pilot editor protects publication identity. It is not proof that a selected embedding is owned by the page. Draft identity migration, media delivery and production lifecycle policy remain lead responsibilities; no junior should infer those designs from the test utilities.

## Outcome and acceptance target

On the original localhost:8080 wiki, an author explicitly makes the annotations on File:ImageTest02.jpg embedded in DeleteMe004 owned by DeleteMe004. Editing through that page's ordinary overlay and saving creates a native DeleteMe004 revision. Viewing the previous revision displays the previous annotations against the recorded media version. The same source file on another page remains unchanged. Use separate native test pages for automation; do not overwrite the user's drawing to manufacture a passing demonstration.

This is the first vertical acceptance target, followed by the same workflow for general-purpose slides and PDF annotations. The slide-only demonstration is infrastructure evidence, not completion. Searchable textbox/callout data follows history, then Cargo text integration.

## Decisions

| Concern | Decision |
| --- | --- |
| Ownership | Use the native owning page identity, backed by its wiki-local PageID. Titles and display names are not durable identity. |
| Drawing identity | Reuse the document's stable surface ID for an independently edited canvas. Identity is owner page plus surface ID. Do not introduce a duplicate generic set ID for one canvas. |
| PDF collection | Preserve distinct stable surface IDs and explicit PDF page numbers. Lead must define grouping of a multipage legacy set before conversion; never collapse pages into one canvas. |
| Names | Labels are editable and need not be unique. A PageID-prefixed name is neither ownership nor authorization. |
| Persistence | Keep the complete drawing snapshot in the owner's normal, non-derived Layers revision slot. Database lookup indexes, if needed, are rebuildable projections, never the authoritative drawing. |
| Binding | Persist the embedding-to-surface reference with page content. Adoption commits this main-content change and the Layers snapshot in one native revision. |
| Shared sets | Explicit adoption copies a chosen immutable legacy revision. The shared original and its other consumers remain unchanged. The adopted embedding stops following shared saves. |
| Editing | Resolve and authorize the saved binding server-side. Save through the native page publication service using an explicit base revision. No fallback to legacy save on failure. |
| History | Rendering uses the requested owner revision, its binding and exact source version. No fallback to current annotations or current upload. |
| Opt-in | Explicit page ownership first; no mass migration or silent ownership change. New wiki-wide defaults require a later decision. |

The owner is obtained from MediaWiki page/revision records, not an editable owner field in the drawing JSON. A browser-supplied PageID is a lookup request, never authority. A PageID is local to a wiki; imports must remap it. Move continuity is required, but current title-scoped pilot guards deliberately reject moves. Those guards must be replaced under tested native lifecycle rules, not simply removed.

## Author-facing contract

Use the concept **Make annotations owned by this page**, and show **Owned by <page title> — saves appear in page history** after adoption. Shared mode must remain visibly distinguishable. `ownership=page` is the preferred proposed syntax; it is NOT implemented syntax and must not appear in installation examples as usable yet. Lead will freeze the actual parameters and grammar after reviewing all image/PDF/slide parser paths.

A binding must survive reordering and page moves. The same binding may be embedded twice on its owner page, deliberately sharing one drawing. A separate drawing gets a new surface ID even if its label and source match. A PDF page reference must be explicit. Do not use occurrence number, array position, DOM ID, file name or label as persistent identity.

For initial release, adopt only directly authored embeddings whose source location can be resolved unambiguously. Template-generated embeddings and transclusions must explain that ownership needs to be set on the defining page; never infer a new owner from the viewing page or rewrite template source heuristically. Cross-page reuse of page-owned drawings must be revision-pinned or explicitly copied; live references cannot promise unchanged consumer-page history. This feature is gated until that contract is implemented.

New pages must be saved before adoption in the first delivery, so a native PageID exists. Copying source wikitext must not confer editing authority over another page's drawings; mismatched bindings reject with an actionable copy/adopt path. Deletion/recreation at the same title must not inherit ownership accidentally.

## Adoption transaction and races — lead-owned

1. Resolve the existing native owner, actor authority, selected embedding, explicit base page revision and selected legacy set/revision. Check page edit/Layers rights, protection, blocks and source visibility.
2. Capture an immutable legacy snapshot and exact media version. If the selected revision is unavailable, reject; do not silently substitute latest. Confirm dimensions, PDF page mapping and every drawing property can be represented and rendered without loss.
3. Prepare a new server-generated surface identity and a targeted binding edit. Preserve unrelated wikitext, slots, surfaces and shared rows. Reject ambiguous embeddings instead of guessing or rewriting with an unrestricted regex.
4. Build and validate the full owner snapshot. Commit binding and snapshot together through the native publication/admission path with both client-base and commit-time conflict protection.
5. Return the committed owner/surface/revision only after success. On conflict preserve the user's work. A lost response enters uncertain outcome; deliberate read/reconciliation identifies the committed binding rather than blindly creating another copy.
6. Repeated adoption of an already bound embedding returns or opens its existing authorized binding. Parallel adoption cannot create two successful bindings from one base. Distinct embeddings may intentionally receive independent copies.

No empty audit-only revision plus mutable legacy data. Legacy mutations may continue on the shared original, but must never change the adopted copy. Unsupported groups/effects/resource layers or inaccessible media must reject adoption with a useful explanation, never sanitize away content. Backfilling pre-adoption history is out of scope; earlier legacy page versions cannot be advertised as newly immutable.

## Implementation sequence and ownership

| Order | Owner | Deliverable and exit gate |
| --- | --- | --- |
| 1 | Junior J62 — ready | Build synthetic legacy conversion fixtures and a loss/compatibility matrix against the mapped entry points. No production changes. Deliver the evidence specified in the handoff plan. |
| 2 | Lead B01 | Freeze binding grammar, PDF collection representation and PageID route/service contract from J62 evidence. Audit title-scoped pilot, API, draft keys, permission checks and lifecycle guards. Define compatibility for existing pilot revisions/drafts before changes. |
| 3 | Lead B02 | Implement identity resolution and atomic explicit adoption. Test stale bases, duplicate requests, permission denial, unchanged shared original and all-or-nothing binding/snapshot publication through native MediaWiki. |
| 4 | Junior J63 — ordered-option adapter ready | Implement the pure ordered-option adapter against the frozen B01 grammar. Public parser wiring, permissions and save architecture remain lead-owned. |
| 5 | Lead B03 | Connect ordinary editor entry/save and historical inline rendering, first for the reported image case. Integrate exact source delivery and cache variation by revision; prevent modal/file-global fallback. |
| 6 | Junior J64 — blocked on B03 | Implement approved ownership/adoption labels, confirmation/error presentation and accessible controls, using lead-provided callbacks and state transitions. |
| 7 | Lead B04 | Complete slide and PDF parity, page moves and copy/delete/restore/import behavior. Preserve native admission protection; unsupported administrative paths must remain explicitly guarded. |
| 8 | Junior J65 — blocked on working flows | Extend real-browser acceptance for ordinary image, slide and PDF workflows, move continuity and cross-page independence using dedicated pages on the original wiki. |
| 9 | Lead release gate | Review junior changes, run native/browser regression, verify manual reproduction, document supported limits and select a clean MediaWiki-native commit scope. Only then announce commit/push readiness. |

The blocked packets are future boundaries, not permission to invent APIs or begin work. Lead must publish each concrete interface and scoped packet before release to a junior. J62 is useful preparation alongside B01; it must not grow into another standalone test framework.

## Required acceptance evidence

- Image: existing annotations survive adoption; ordinary overlay Save creates one owner revision with actor and summary. A previous owner revision keeps its annotations and recorded image version.
- Isolation: another page using the original shared image/set is unchanged. Two same-label drawings on one page do not collide; two embeds of the same binding intentionally agree.
- Slide: same path for a general-purpose canvas, with no invented file dependency.
- PDF: select, edit and revisit page two without scale drift; retain untouched pages, source version and page numbers through save and old-revision viewing.
- Move: owner identity and ordinary overlay remain valid at the new title, with history intact. Stale browser sessions and cached old-title output must neither save to a recreated title nor bypass authority checks.
- Conflict/recovery: simultaneous main-text changes, annotation saves and adoption attempts preserve winners and drafts. Lost adoption/save responses produce no blind retry or duplicate binding.
- Lifecycle: copied wikitext, templates, deletion/recreation, restore, import and suppressed/missing source revisions cannot reassign ownership or reveal unavailable data. Document any guarded operation before enabling adoption.
- Rendering: action=history links and ordinary oldid page rendering agree on the exact snapshot. Parser caches never substitute latest content; permissions are rechecked at delivery.
- Integrity: no silent layer/property loss; unsupported content is explained before adoption. Historical content never depends on mutable shared rows.

Manual acceptance is on the original wiki with the user's normal login. Automated fixtures are separate pages on that wiki or native integration-test tables. No replacement manual wiki, container service or host worker is part of this plan.

## Completion and follow-on work

History delivery is not complete when another special-page demo passes. It is complete for a supported surface kind when the ordinary embedding/adoption/edit/save/old-revision workflow and the identity/lifecycle gates above pass, with explicit limits for anything still unsupported. Commit checkpoints may be smaller but must describe those limits accurately.

Search and Cargo consume committed owner snapshots using stable owner/surface identity and revision IDs. They are rebuildable downstream projections; neither is permitted to become a second writable authority. Their detailed implementation remains deferred until this ordinary history workflow is accepted.

## Verified code integration map

The planning review found the following existing seams; these are evidence of current code, not completed ownership integration:

- Image/PDF parameters and output: `src/Hooks/Processors/ImageLinkProcessor.php` (`processImageLink`, `applyLayersLink`), `src/Hooks/Processors/ThumbnailProcessor.php`, `src/Hooks/Processors/LayersParamExtractor.php`, and `src/Hooks/WikitextHooks.php`.
- Browser entry: `resources/ext.layers/viewer/ViewerOverlay.js` (`_buildEditUrl`, `_handleEditClick`) and `resources/ext.layers.modal/LayersEditorModal.js` construct file-based legacy URLs. Both primary and fallback paths must carry the validated binding.
- Native legacy file entry: `src/Action/EditLayersAction.php::show`. Slide counterparts: `src/Hooks/SlideHooks.php`, `resources/ext.layers/viewer/SlideController.js`, `src/SpecialPages/SpecialEditSlide.php`.
- Save routing: `resources/ext.layers.editor/APIManager.js` selects the page-owned bridge only from trusted pageOwned configuration. Legacy `src/Api/ApiLayersSave.php` writes shared sets; purging embedding pages does not create their revisions.
- Atomic foundation: `src/Revision/PagePublicationService.php::publish` and `PageRevisionWriter` already support a complete snapshot plus main wikitext. Extend this path instead of creating an independent publication mechanism.
- Exact reads and assets: `PageHistoryAccess::read` checks revision PageID; `SourceVersionResolver::resolve` checks the exact source version/page. Reuse those boundaries.
- Identity transition: `PageOwnedPilot`, public read/publish scope, lifecycle/import/merge guards and client drafts all need coordinated review. `PageOwnedPilotLifecycleHooks::onMovePageIsValidMove` presently vetoes scoped moves, while `PageOwnedPilot::prepareEditor` rejects non-slide surfaces.

## B01 decisions after J62 review — September 24, 2026

J62 is accepted with lead corrections as structural fixture evidence. The review found incorrect stored byte counts in all eight example rows, confused legacy author/time with new revision metadata, an invented reading-order default and an unsafe suggestion to publish schema-valid but unrenderable content. Those points are corrected in the fixture matrix. Six candidate snapshots pass fresh schema validation; this is not adoption or rendering acceptance.

The following decisions now constrain B01/B02:

1. **PDF scope:** initial adoption copies only the explicitly selected PDF page and named-set revision. It appends one surface to the complete existing owner snapshot, preserving all other surfaces. It does not adopt every page, replace the owner document or infer grouping from names. A later explicit multi-page adoption can publish several selected surfaces atomically. PDF navigation must indicate pages with no owned binding and never silently edit a shared page through the owned session.
2. **Labels and reading order:** default label comes from the selected shared set name; an explicit user label may override it, including an empty label. Do not invent readingOrder from paint order. Preserve existing explicit readingOrder where available and valid.
3. **Provenance:** the adopting actor and current publication time belong to the new native revision. Legacy ownerId is the set creator's user ID, never PageID. Legacy ls_timestamp is annotation time, never the media version timestamp. Resolve the exact media version separately; ambiguous or unavailable versions reject adoption. Do not add provenance fields to version-one JSON without an explicit schema decision.
4. **Loss and availability:** schema-valid groups/resources still cannot be adopted through an unavailable historical renderer. Unknown properties, dimension limits and unsupported effects block the operation; neither stripping nor downscaling is an acceptable silent conversion. Alias normalization requires a dedicated semantic-preservation rule before use.
5. **Binding identity:** owner PageID plus stable surface ID remains authoritative within this wiki. Repeated references intentionally reuse that pair; separate adoption creates a new surface ID. Labels, source filenames, PDF page numbers and legacy user IDs cannot substitute for this identity.

Remaining lead B01 work: freeze exact parser syntax and targeted source-editing rules after inspecting the parser paths; define PageID route/client/draft compatibility and lifecycle scope transition. J63 stays blocked until those interfaces exist. The current title-scoped pilot must not be represented as already move-safe. B02's adoption API and transaction implementation have not yet been delivered.

## B01 binding grammar and integration contract — September 24, 2026

The internal binding value is now frozen as `v1:<pageId>:<surfaceId>`, carried by a separate `layersbinding` option for both file embeds and #Slide. Example future syntax: `[[File:Diagram.png|layersbinding=v1:123:Drawing_A|page=1]]` and `{{#Slide:Example|layersbinding=v1:123:Drawing_A}}`. These examples are NOT enabled wiki syntax yet. Explicit adoption generates the option; ownership=page remains a UI intent, not an alternative stored identity or a parser-side write trigger.

`PageOwnedBinding::parse` implements only the value boundary. It accepts canonical ASCII decimal PageIDs 1..2147483647 (the current pilot range), followed by a case-sensitive 1..64 character surface ID using ASCII letters, digits, underscores or hyphens. It rejects whitespace, coercion, encoding tricks, extra fields and oversized values with a fixed error. Larger native PageIDs are an explicit unsupported range pending a coordinated API/client change, not evidence they cannot exist. Values must not pass through the legacy lowercase normalizer. No public wiring or permissions are implemented by this class.

Option names are ASCII case-insensitive and allow surrounding option whitespace. The adapter may trim the value once at the wikitext-option boundary; persisted/API values stay canonical. A single binding option is allowed; duplicates reject even when equal. Binding plus any legacy selection option (layerset, layers, layer, layersetid) rejects instead of selecting precedence. Presentation options such as layerslink, page, dimensions and caption remain separate. Absence means legacy mode; presence with invalid data means an owned-binding error, NEVER legacy fallback.

A binding contains no revision: the server obtains the requested page revision from native parser context (including oldid), and verifies it belongs to the bound PageID before looking up the literal surface ID. Current editing resolves latest by PageID, rechecks rights and emits a concrete base revision. File/PDF metadata must agree with the bound surface; do not trust caller filename/page to select another surface. No cross-page live lookup or template ownership inference in the initial release.

Parser integration must carry explicit identity in structured metadata through thumbnail, overlay, lightbox and modal paths. Existing filename occurrence queues are not authoritative. The legacy parser can discard duplicate options and collapse repeated file occurrences: new handling must inspect ordered raw options before that loss. The source-editing implementation must locate one direct embedding in the explicit base text through a syntax-aware path, validate the exact original span and publish only a targeted replacement. If a template expansion or ambiguous source span prevents this, refuse adoption with an explanation. A broad text regex is not an acceptable substitute.

### PageID transition and lifecycle requirements

New page-owned route/bootstrap/read/publish requests must carry ownerPageId and an explicit base/revision as appropriate. The server resolves current native identity from PageID, verifies every revision belongs to it, and checks it again at publication against the native page selected by the writer. A moved page must not be retargeted to a replacement page at the old title. Titles are current display/routing information only. Existing title-based pilot routes stay isolated compatibility paths until their native guards can be replaced together; no silently mixed authority rules.

Draft keys require a new version keyed by wiki/user/PageID/base revision/surface. Do not rename existing title-keyed drafts in place. Offer explicit recovery only after proving their base revision belongs to that PageID and applying the current snapshot checks; preserve unresolved old drafts. This needs lead implementation before enabling moves.

A move follows PageID without rewriting the stored token. Copying wikitext to a different PageID fails the binding-owner check; copying drawings is a separate explicit adoption action. Deletion/recreation cannot inherit the token. Restore/import/merge and archived revision identity remain guarded until native tests prove their remapping and admission behavior. Do not remove the existing move veto merely because the value parser is complete.

J63 may now implement the bounded ordered-option adapter described in the handoff plan. Lead retains parser hook wiring, exact source-span editing, PageID authorization/lifecycle changes, atomic adoption and runtime exposure.

## PageID preflight implementation checkpoint — September 24, 2026

J63 is accepted with explicit whitespace trimming (space/tab/CR/LF/form feed, never NUL or vertical tab). The combined value/option suite passes 92 tests / 198 assertions. The adapter remains internal, not connected to parser hooks.

PageOwnedIdentityResolver now takes TitleFactory, RevisionLookup and PageHistoryAccess and exposes resolveForEdit(int pageId, int baseRevisionId, Authority): Title. It requires positive supported-range IDs, looks up by native ID with READ_LATEST, verifies the returned identity, checks the original actor's editing authority, checks the exact base belongs to that owner and is text-visible, then requires it to be current. Unavailable/wrong-owner/denied data share layers-owner-unavailable; an authorized outdated base returns layers-edit-conflict. No Layers slot is required, so it can prepare adoption of existing ordinary pages.

Native tests exercise a real unscoped MediaWiki page move and its separately identified old-title redirect, foreign base rejection, stale base after main-text editing and missing editlayers permission. This does not remove the scoped pilot's lifecycle veto. Fresh native run: 5 tests / 10 assertions including the shared harness check. The next lead change must carry expected PageID into publication and validate it on the prepared page before admission/commit. This helper alone is not move-safe publication and must not be exposed as that feature.

## B02 publication identity guard — September 24, 2026

PagePublicationService::publish now accepts `?int $expectedPageId = null` after the optional main content. Future adoption/binding-based callers MUST pass the page ID obtained and checked by PageOwnedIdentityResolver; null remains only for existing title-based compatibility/creation paths. The new guard disallows bound creation (base zero), validates the supported ID range, checks current owner identity before and after source preparation, and validates the actual prepared page's ID, namespace and key against the expected owner before opening admission. Final authority and native conflict checks remain required and unchanged. A move during preparation fails safely rather than retrying against a redirect or another title.

Fresh native regression: 65 tests / 311 assertions across PagePublicationServiceTest, PageOwnedIdentityResolverTest, ApiLayersPublishTest and PageOwnedAdmissionTest, including the shared harness check. The injected prepared-page mismatch verifies the commit callback is not reached; it is a fault-injection test, separate from the real native move test. Existing public routes do not yet pass expectedPageId. No move-safe end-to-end publication or completed adoption is claimed until PageID routing, draft migration and lifecycle integration are connected.

## B02 atomic append service — September 24, 2026

PageOwnedAdoptionService::publishPreparedSurface(pageId, baseRevisionId, authority, singleSurfaceDocument, boundMain, summary) now composes the resolver and guarded publisher. The input document must contain exactly one already prepared surface; all existing surfaces come from the authorized base revision, never a client replacement document. Native content access is rechecked, non-wikitext owners reject, duplicate IDs reject, the combined document is revalidated, and publisher receives both main content and the mandatory expected PageID. Repeated/stale requests do not automatically retry or allocate another identity.

This is a trusted internal transaction seam, not an adoption API. The future orchestrator must resolve the immutable legacy selection and media, verify lossless editor/historical rendering support, generate the ID, and prepare the exact direct-embedding replacement against the same base. This method does not verify the semantics of supplied boundMain and must never be exposed directly to raw requests. It is intentionally unregistered while those gates remain absent. No claims about working image/PDF rendering follow from structural acceptance.

Fresh combined native evidence: 71 tests / 337 assertions, with successful multi-surface preservation and atomic binding-text publication plus unchanged slots on duplicate, empty, stale and source failures. The examples use prepared slide snapshots; a synthetic image example verifies source rejection, not image rendering. Next lead deliverable is legacy capture/conversion and source-edit preparation; junior UI/browser packets remain blocked.

## B02 exact-row and conversion boundary — September 24, 2026

The legacy API/getLayerSet transport is not the adoption source: it omits hash/MIME and decodes JSON into arrays, and layersinfo additionally changes boolean representation and supplies current-file dimensions. The new internal getLayerSetForAdoption(id) selects one primary row without cache/fallback and returns id/imgName/userId/timestamp/revision/name/page/sha1/mime/json. Raw duplicate keys and bytes are deliberately retained for strict validation, not normalized by storage access. A missing/pruned selected row must fail; never choose latest.

LegacySurfaceConverter::convert(record, surfaceId, media=null) yields a canonical one-surface version-one document. The media argument is a trusted server-prepared array containing source (the five source fields), width and height for the selected exact file page. The converter cross-checks filename/hash/page with the row and validates output; it does not fetch files or authorize the metadata. Slides require application/x-layers-slide, Slide: identity, slide SHA sentinel, page one and stored slide geometry. It accepts the complete current writer envelope only; older/malformed envelopes missing required fields fail rather than receiving guessed defaults. Metadata is recognized explicitly, while unfamiliar envelope/layer fields reject.

Default labels preserve the shared set name; later explicit label editing is separate. No readingOrder is generated. Source time is independent of annotation time. Image/PDF canvas backgroundColor uses the documented white legacy-underlay proposal; actual source/background/opacity composition must pass visual parity before adoption. Schema-valid groups/resources may be converted structurally but remain blocked at the future user-facing admission gate until their editor/historical renderer is supported.

The delegated reader implementation and lead converter passed 81 unit tests / 240 assertions, including eight fixture rows. No direct API, migration or runtime service wiring was added. Remaining orchestrator work: authorize exact selection/source, obtain native exact page geometry, build a verified binding replacement, check rendering availability, then invoke the existing atomic append with the original PageID/base/authority. Do not use these helpers as a public adoption endpoint on their own.

## B02 exact-media and preparation composition — September 25, 2026

LegacyMediaResolver::resolve(record, explicitFileTimestamp, authority) reuses SourceVersionResolver with a minimal internal source-validation document, then checks exact MIME and reads unscaled native geometry for the selected page. It returns only the source descriptor and dimensions, not a File object, URL or backend path. The 1x1 validation canvas is a schema carrier, not the returned media geometry. Media geometry must fit the document profile; no guessing or resizing is permitted. Exact upload time is required independently of layer-save time.

LegacyAdoptionPreparationService::prepare(pageId, baseRevisionId, legacyRevisionId, fileTimestamp, authority) requires original owner authorization before reading the exact primary row. Slides require null fileTimestamp; media requires an explicit timestamp. It generates a surface_ plus 128-bit random hexadecimal ID, converts using exact metadata and rechecks owner/base after preparation. The result carries pageId/baseRevisionId/legacyRevisionId/surfaceId/binding/document. This is an internal server proposal, not a signed authorization token and not safe to accept back from a client. There is no publication, automatic retry or binding-text change at this stage. The final orchestrator must retain server-controlled data and apply rendering/source-span gates before atomic append.

Fresh combined native verification: 80 tests / 407 assertions. The interrupted delegated PNG test used wrong dimensions; lead corrected against the real fixture and added integrated image preparation. Archived PDF page-two lookup after actual replacement is verified. No ordinary editor or browser flow is enabled by this work.

### Source-span implementation decision from delegated audit

There is no existing FileLinkWalker in Layers. WikitextHooks::onInternalParseBeforeLinks sees expanded text and associates filename occurrence queues; SlideHooks::parseArguments expands values and collapses duplicates. Neither can authorize an original-source replacement. Native classic preprocessor trees lack public original byte offsets; bundled Parsoid tokenization needs a real environment adapter that Layers does not yet have.

Initial lead implementation will support a conservative direct-source subset: balanced raw direct File/Image links and literal #Slide invocations in the explicit base revision, recording byte start/length/original text and ordered top-level option spans. Skip comments, literal/extension-tag bodies and non-Slide templates; reject dynamic/nested or malformed selected constructs rather than guess. Verify literal file targets through native Title namespace normalization. Selection is base revision plus exact span and original bytes, never filename occurrence. Preserve captions/presentation and all surrounding bytes; replace only the selected legacy selector options with the canonical binding. Validate the resulting option list using PageOwnedBindingOptions, then rely on native publication's base conflict guard. Full MediaWiki grammar support is not claimed; broader complex-source support needs a native parser adapter rather than unbounded custom parsing.

Tests must cover repeated identical embeds, localized namespace aliases, comments/nowiki/tag bodies, templates/dynamic names, malformed delimiters, UTF-8 byte offsets, different PDF pages/set names, stale/mismatched spans and unchanged surrounding text. The scanner is not implemented at this checkpoint; J64/J65 remain blocked until it and rendering/editor callbacks exist.

## B02 direct-source rewrite checkpoint — September 25, 2026

DirectEmbeddingRewriter now provides scan(text, trustedResolveFile) and rewrite(text, byteStart, exactOriginalEmbedding, canonicalBinding, trustedResolveFile). The native resolver must return canonical File: DB-key text using Title rules, excluding fragments/interwiki/non-file targets; tests verify native File/Image normalization. The scanner records kind, normalized target, raw ordered options, complete raw span, byte start and length. It does not generate or authorize legacy source selections. Rewrite rescans the whole source and requires the exact complete candidate before replacing one selector (or adding the binding), rejects multiple legacy selectors/already-bound targets, and validates final options through PageOwnedBindingOptions.

Supported subset: literal top-level file links and #Slide, with plain option/caption content. Balanced templates/parameters and nested constructs are skipped as candidates. Comments and allowlisted opaque bodies (nowiki/pre/source/syntaxhighlight/math/ref/gallery) are skipped with quote-aware opening tags; nested same-tag/unknown containers reject. HTML containers outside that list and single-bracket/external-link syntax cause whole-page rejection, as do malformed delimiters and unsupported control bytes. These intentionally narrow rules must be shown as unsupported-source errors, never bypassed by a fallback regex. This is not a general parser or a full native parser-equivalence guarantee.

An independent delegated review caught tag-name prefix matching; corrected delimiters ensure nowiki-x/ref:custom reject. Combined unit evidence: 123 tests / 283 assertions for source rewriting and bindings. Native Title normalization: 2 tests / 6 assertions including the shared harness. Byte-exact preservation, repeated-identical selection, Unicode offsets, template/tag exclusions, malformed source and stale/partial selections are covered.

Remaining before runtime use: validate raw candidate against native rendering/selection, resolve literal PDF page and set semantics against the exact legacy row, retain authorized base content server-side, verify the generated binding's PageID/surface matches the preparation, and feed rewritten main content to atomic append. Source rendering/editor gates and lifecycle protections remain mandatory. No new public adoption endpoint is installed.

## Exact embedding and legacy selection preparation — September 25, 2026

Delegated `DirectEmbeddingSelection` implementation reviewed and accepted: exact file/slide identity, concrete set name and selected PDF page must match the server-read legacy row. Ambiguous generic selectors, duplicate selectors, legacy row-ID options, file case/short-ID ambiguities and slide canvas/background overrides reject. This conservative gate does not infer the latest legacy revision; the eventual adoption UI must explicitly confirm the selected immutable row.

Lead composed `DirectAdoptionPreparationService`: reads authorized base-revision wikitext, verifies the complete selected source span, prepares the exact legacy drawing, matches its identity, and rewrites only that span with the server-generated binding. The proposal stays server-only; preparation creates no revision. Native tests preserve Unicode byte offsets, distinguish repeated identical embeds, retain unrelated page bytes, and reject source/set/page/offset/nesting mismatches without changing the page.

Fresh verification: **183 unit tests / 343 assertions** across selection, rewriting and binding; **86 native tests / 438 assertions** across preparation, media resolution, adoption, publication, PageID preflight, API and admission. These are focused regressions, not browser acceptance.

**Next lead gate:** prove correspondence with native parsed embeds and admit only drawings the page-owned renderer/editor can faithfully handle, then compose preparation with atomic publication behind the adoption workflow. J64/J65 remain blocked until their runtime interfaces exist. Ordinary image/PDF/slide ownership is not publicly wired; user testing and commit/push readiness are not claimed. Search and Cargo follow the completed page-history workflow. Docker remains only the test host; no original-wiki content/configuration was changed.


## Adoption capability gate and atomic composition — September 25, 2026

Lead added a known-capability check to direct adoption preparation: only the historical viewer's current ungrouped text/vector slide types can produce an adoptable proposal. Image/PDF sources and resource-backed/custom/group/marker layers remain blocked at this boundary, including hidden unsupported content; lower-level lossless conversion remains available. This is not proof of visual parity for every font/effect, nor public adoption registration.

Local source review found that native SlideHooks lets a later `name=` option override the first positional name. The matching helper now rejects that option (including bare, empty and mixed-case forms), preventing selection of the wrong slide. The attempted delegated audit stopped at an agent usage limit; no completed independent audit is claimed this turn.

Native integration now composes exact source preparation with atomic publication: only the selected repeated occurrence changes, main and Layers slots share the same new revision, actor/PageID/parent are correct, and the old main text and absence of a prior Layers slot remain intact. Hidden-group rejection leaves the page unchanged. Fresh checks passed **89 native tests / 460 assertions** and **187 unit tests / 347 assertions**; changed PHP style passed.

**Junior J66 is ready:** native slide-parser correspondence tests with concrete accepted/override/duplicate/template cases, defined in the handoff plan. Lead retains rendering fidelity, pinned image/PDF delivery, binding consumption and public adoption wiring. J64/J65 stay blocked. Ordinary overlay testing and commit/push readiness are still not claimed. No wiki content/configuration or runtime registration changed. Docker remains only the test host.


## J66 accepted with corrections; reserved slide binding refusal — September 25, 2026

Lead reviewed and reran the real-parser suite. Replaced attribute-order-dependent HTML regular expressions with DOM/XPath inspection. Accepted its native slide identity/case, duplicate-selector, name-override, Unicode occurrence and template/comment/nowiki evidence. The suite still does not prove general wikitext correspondence or binding rendering.

Lead also corrected a production fallback: SlideHooks previously ignored `layersbinding` and could display the latest shared drawing instead of the bound snapshot. It now refuses the reserved option, including bare, empty, malformed, mixed-case, duplicate and mixed legacy-selector forms, before legacy drawing lookup/output. The existing localized slide error is shown without reflecting the binding. This deliberate refusal will be replaced only by revision-pinned, permission-safe binding rendering; it is not implementation of that rendering.

Fresh verification: **23 native tests / 185 assertions** across DirectSlideSelection, DirectEmbeddingRewriter and LegacyAdoptionPreparationService; **246 unit tests / 440 assertions** across SlideHooks, selection, rewriting and binding. Changed PHP style passed. The native group includes the shared harness test.

**Next is lead-owned:** implement the bound-slide display route with an exact owner revision and PageID agreement, then connect ordinary editing to that identity. No latest/shared fallback, no private snapshot in a public parser cache, and no save through legacy APIs. Pinned image/PDF delivery remains required for those surfaces. J64/J65 remain blocked; J66 is accepted, with no new junior packet until the next interface is concrete. Ordinary page-history testing and commit/push are not ready. Docker is only the test host; no user wiki content/configuration changed.


## Inline bound-slide display implemented; browser gate pending — September 25, 2026

Lead connected native SlideHooks to the ordered binding adapter. In the existing enabled/scoped pilot, valid bindings produce identity-only placeholders with the exact native parser revision (including core's explicit revision-record callback path). Preview/no-revision, foreign PageID, disabled/out-of-scope and malformed/conflicting bindings fail closed. Shared legacy slides continue through the original path.

BoundSlideHooks runs on OutputPageParserOutput and requires its cached parser revision to equal the displayed OutputPage revision. It reads through prepareBoundViewer with the actual reader Authority and PageID-checked exact read service. Authorized drawing bundles are added only to the current response's JS configuration; the shared ParserOutput retains no drawing data. Bound responses disable client/CDN caching. The existing history bootstrap now mounts each matching inline host independently; mismatched/denied hosts keep the unavailable placeholder. This is read-only and still limited to slides; no adoption UI or legacy save fallback was added.

Fresh verification: **31 native tests / 329 assertions** for bound output, binding reads, direct slide parsing and pilot; **128 JS tests** for bootstrap/view/renderer; **120 PHP unit tests / 228 assertions** for SlideHooks/binding options. Native coverage drives addParserOutput, checks no-store response headers, exact old drawing after a later save, disabled/denied output, mismatched display revision and absence of drawing data from serialized parser cache. Style, class references (95 classes) and compatibility checks passed.

**Unresolved verification:** PageOwnedPilotRegistrationTest independently fails in the currently configured test runner (duplicate native Layers slot installation and an already-defined content model when testing an empty scope). Do not report the registration suite or all checks as passing; lead must isolate its bootstrap from the original wiki's installed pilot without changing user configuration. No browser acceptance is claimed yet.

**Junior J67 is ready** in the handoff plan for real original-wiki inline binding acceptance. J64/J65 remain blocked on ordinary adoption/editor interfaces. Lead retains those interfaces, pinned image/PDF delivery, visual parity and the registration-test isolation fix. No user content/configuration, manifest, commit or push changed. Docker is only the test host.
