# Frequently asked questions

Reviewed October 24, 2026 for the page-owned candidate. Tagged 1.5.95 uses the
older shared model. The manifest still reports 1.5.95; choose the reviewed commit
with passing CI. Milestone 1 acceptance remains open.

## What is Layers, and does it change uploaded originals?

Layers adds editable text, shapes and other layers over images/PDF pages and
provides standalone slides. The uploaded original is unchanged. After migration
completion, the owning page's native revisions store its complete layer snapshot
and exact source references.

## Which versions and browsers should I use?

Check [[Installation]] for the manifest compatibility floor and separate legacy
branches. The candidate's release work covers MediaWiki 1.44 and 1.45; recorded
checks do not qualify every browser/device combination. Use the PHP/database
versions required by the chosen core release and verify the
[release matrix](https://github.com/slickdexic/Layers/blob/codex/l01-publication-admission/docs/MILESTONE_1_RELEASE_CHECKLIST.md) for your deployment.
Do not mix one branch's PHP with another branch's JavaScript.

## How do I add layers to an image or PDF?

Save the embed on its owning page, use **Edit layers** on hover, focus or tap,
then Save and reopen from that page. The retired File-page tab is not the native
article editing entry point. **View full size** opens the viewer.

```wikitext
[[File:Diagram.png|thumb|400px|layerset=ABC]]
[[File:Manual.pdf|page=2|400px|layerset=001]]
```

Every PDF page in `001` shares that visible name. `page=2` selects its internal
second-page member. Do not put owner IDs or member IDs in author wikitext.

## What does layerset=on select?

After completion, it selects this owner/file's `Default` set. It does not mean
the most recently saved shared set. `off` and `none` hide layers; the older
`layers=` spelling remains supported. Names compare without case differences,
and spaces/underscores normalize alike. See [[Wikitext Syntax]].

## Can different pages or files use the same set name?

Yes. Identity includes the owning page and file/slide, not just the name. Two
pages can have independent `ABC` sets for one image. Two files on one page can
also each have an independent `ABC`. Editing one does not update the others.
See [[Named Layer Sets]].

## Can I create a slide without an uploaded image?

Yes. Save `{{#Slide: Safety overview}}` on the owning page and open its overlay.
The first argument names that page's slide. Saved native canvas/background
settings remain authoritative. Migrated shared variants can have names such as
`Safety overview (english)`; use the actual saved name. See [[Slide Mode]] for
current behavior and the separately labelled legacy options.

## How do I copy or Import layers?

Use the integrated Import workflow for admitted source layer sets. Choices from
different owners remain distinct; preview/preparation is not permanent access or
Save authority. Whole-PDF Import preserves its complete group. The result is
local work in the target, with its source attribution; future source edits do
not silently update it.

The existing editable-layer JSON import/export and image import controls remain
available for their supported formats. An imported flat image cannot preserve
separately editable objects from another application. Inspect dimensions,
positioning and layers before saving.

## How do Undo, history and recovery differ?

Undo/Redo changes the current editor session. Native owner-page history records
successful Saves; use its available viewing/comparison/restoration workflows
for earlier saved content. Local draft Review/Restore is separate and requires
explicit confirmation. Restoring a draft is not a saved page revision until
Save succeeds.

Keep the editor and drafts intact after a refusal or uncertain response. Use the
existing Check/reconciliation flow to establish the result before publishing
again. Do not clear browser storage to resolve a conflict.

## Who can edit, rename or remove sets?

Native edits require ordinary read/edit rights on the owner, `editlayers`,
readable sources and fresh revision/source checks. Blocks and protection apply.
A File page and an article using its file are different owners. `noedit`, a
hidden button or a locked layer does not replace server authorization.

Removing a native set changes the current snapshot; earlier readable native
revisions retain their saved content. The old shared creator/`layers-admin`
rename/delete rules and destructive retained-revision deletion are legacy rules.
After completion shared writes are read-only. See [[Permissions]].

Anonymous users do not receive `editlayers` by default. Granting that right
alone does not remove the other native action/account/source checks.

## Where is the data, and what are its limits?

Native layer content is in the owning page's `layers` slot, alongside its main
content in native revisions. Retained shared content remains in legacy storage;
its `layer_sets` rows are not native page revision IDs.

The native complete snapshot is capped at 2 MiB, 100 members, 100 layers per
member and 1000 total layers. Canvas dimensions are capped at 4096; strict
embedded-image data validation has its own 1 MiB limit. Legacy settings do not
raise these bounds or prune native history. See [[Configuration Reference]].

## Do thumbnails and custom fonts work?

Layers use saved coordinates and scale with the admitted image/slide rendition.
A PDF thumbnail's rounded natural dimensions do not redefine native geometry.
Custom font choices are configurable, but a name alone does not install a font;
verify availability in the browser and relevant export renderer.

## What can I Download or Print?

The full-size viewer offers **Download PNG** first and a separate **Download
PDF** for images/slides. PDFs offer **Download PDF** only. Output includes the
admitted saved layers. A failed PDF page must refuse complete assembly rather
than silently shorten the document.

The editor's existing image/JSON controls remain separate. Legacy cached server
PDF export is also a different path, not a native history export API. Inspect
critical output; a prepared Print document does not prove physical printing.

## Is offline editing or live collaboration supported?

Loading and saving require the wiki. Local drafts are recovery aids, not an
offline synchronization service. Real-time multi-user editing is outside the
current charter; stale native bases are refused and local work is preserved.

## What performance and accessibility can I expect?

Use the recorded [performance scope](https://github.com/slickdexic/Layers/blob/codex/l01-publication-admission/docs/PAGE_HISTORY_PERFORMANCE.md) and
release matrix. The 100-layer server Save benchmark does not establish total
browser/device latency. Report a representative slow case without discarding
layers. Controls, shortcuts, focus handling, ARIA support and narrow-screen
layout exist, but complete device/assistive-technology conformance is not claimed.
See [[Keyboard Shortcuts]] and [[Troubleshooting]].

## What about built-in search, Cargo and object links?

The required order is page ownership/history, built-in text search, Cargo
readiness, Cargo integration, then clickable layer-object links on wiki-page
images/slides/PDF pages. Lightbox object links are excluded. Later milestones
must not delay Milestone 1; existing code or name listing is not proof of those
milestones' acceptance.

## Where do I report a problem or request a feature?

Start with [[Troubleshooting]]. Include the exact commit, core/browser versions,
steps and relevant errors; redact tokens and private data. Search
[existing issues](https://github.com/slickdexic/Layers/issues) before opening a
[new issue](https://github.com/slickdexic/Layers/issues/new).

See [[Quick Start Guide]], [[Configuration Reference]] and the
[release checklist](https://github.com/slickdexic/Layers/blob/codex/l01-publication-admission/docs/MILESTONE_1_RELEASE_CHECKLIST.md) for current guidance.
