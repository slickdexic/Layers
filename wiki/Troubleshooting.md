# Troubleshooting

Reviewed October 24, 2026 for the page-owned candidate. Tagged 1.5.95 uses the
older shared model. Start with [[Installation]] and the
[upgrade guide](https://github.com/slickdexic/Layers/blob/codex/l01-publication-admission/docs/UPGRADING.md); Milestone 1 acceptance remains open.

## Preserve current work first

Keep the editor open after a failed or uncertain Save. Record the visible error
and request result. Preserve local drafts; do not clear browser storage, switch
accounts, reload or close the editor while unsaved work is at risk.

If a Save may have reached the server but its response was lost, use the
existing **Check** flow to establish the outcome. Do not repeat publication
blindly or treat an empty HTTP 200 body as success. Draft Restore is local until
an explicit Save succeeds. A conflict must preserve current work.

## Missing edit or viewer overlay

The old File-page **Edit Layers** tab is retired after completion. Use the
**Edit layers** or **View full size** overlay on the saved image, slide or PDF
embed, shown on hover, keyboard focus or tap.

1. Confirm the exact wiki and page. Different hosts or ports can be different
   installations with different data and extension code. Check `Special:Version`
   and the installed reviewed commit; the 1.5.95 manifest alone is insufficient.
2. Confirm Layers is loaded and the embed is saved. Check migration completion,
   including on a fresh empty wiki. Running the updater alone is not completion.
3. Check this page's embed name. After completion, `layerset=on` means
   `Default`, not another recently saved set. Equal names on another owner or
   another file are independent. `off`/`none` deliberately hide layers.
4. Check ordinary read/edit access to the **owning page**, `editlayers`, blocks,
   page protection and source visibility. File-page permission alone is not
   authority over an article's sets. Slide `noedit` suppresses the edit button.
5. Inspect failed `load.php` and API requests and their response bodies. A
   ResourceLoader error can stop initialization even when the page itself loads.
   Check that PHP and shipped assets come from one reviewed source tree.

An eligible missing named set can open empty for an authorized editor. It must
not display another stored set as a substitute. Missing/unreadable sources or
revisions can instead make the view unavailable. See [[Wikitext Syntax]],
[[Named Layer Sets]] and [[Permissions]].

## Installation or schema errors

Verify `wfLoadExtension( 'Layers' );`, the compatible MediaWiki/PHP/database
versions and the installed branch/commit. Use the native updater from the
MediaWiki root after taking the backup described in the upgrade guide:

```sh
php maintenance/run.php update
```

Do not create a sample `layer_sets` table or insert a completion record by hand.
Use the documented discovery, dry run and migration process. Existing table
prefixes and database permissions must match the wiki configuration. Layers is
a MediaWiki extension; Docker is only one development/test environment.

If a Windows `composer` command resolves to an unrelated program, check PATH
and invoke the intended PHP Composer installation directly. Development quality
commands require installed dependencies; a normal extension deployment uses the
shipped runtime assets described in [[Installation]].

## Save refused, slow or unconfirmed

Inspect the module-specific API result as well as HTTP status. Page-owned Saves
use native complete-snapshot publication, not `layerssave`. Legacy shared write
errors after completion are expected; use the owner-page overlay.

| Observation | Next check |
| --- | --- |
| Permission/visibility refusal | Current owner read/edit rights, `editlayers`, protection/blocks, exact revision and source visibility. A prior successful preview does not grant lasting access. |
| Stale revision or conflict | Preserve current work and drafts. Use the existing Check/reconciliation flow; do not replace the base with latest content without review. |
| Missing/expired token or session | Preserve work before refreshing authentication. A valid token does not bypass owner/source checks. |
| `ratelimited` or a legacy rate-limit error | Stop repeated requests and allow the configured quota to recover. Identify a request loop before changing limits. Metadata and PDF-render quotas are separate. |
| Payload/schema refusal | Check the full error and current native bounds. Unsupported fields or malformed JSON must be corrected without dropping unrelated members. |
| Lost response or empty success body | Use Check to verify what committed before any further publication. |

Native bounds are 2 MiB for the complete owner snapshot, 100 members, 100 layers
per member, 1000 total layers and 4096-pixel canvas dimensions. Strict embedded
image validation has a separate 1 MiB bound. Raising `$wgLayersMaxBytes` or a
legacy count setting does not expand the native schema. Do not split a whole-PDF
Save into independent page writes. See [[Configuration Reference]] and the
[native API guide](https://github.com/slickdexic/Layers/blob/codex/l01-publication-admission/docs/PAGE_OWNED_API_GUIDE.md).

For a slow Save, distinguish upload, API/server time, rendering and return/reopen
work. The [bounded server benchmark](https://github.com/slickdexic/Layers/blob/codex/l01-publication-admission/docs/PAGE_HISTORY_PERFORMANCE.md) records
100-layer Saves at 98–122 ms on its local fixture; it is not a promise of total
browser/device latency on every wiki. Preserve representative content when
reporting a slowdown rather than deleting layers to make the measurement pass.

## Wrong layers, PDF page or historical file

Check the owning page, set name, native revision and requested source PDF page.
Native names compare without case differences; spaces and underscores normalize
alike. A PDF uses the same visible set name on all pages, with separate internal
members. Use `page=2` to select its second page, not a renamed set.

Historical content uses its saved source version. A reupload must not silently
replace that source. A suppressed revision, deleted file/version or changed
access can make it unavailable. Do not substitute the current upload or another
stored page to hide the refusal.

A one-pixel difference in a raster thumbnail is not authority to rewrite saved
geometry. Report the supplied native dimensions, displayed rendition size and
exact occurrence. Existing layers must stay in their saved coordinate system.

If assets are stale, preserve current work before reloading. Administrators can
investigate ResourceLoader/page-cache invalidation on a safe reproduction. A
hard refresh is different from deleting local draft storage.

## PDF thumbnail, viewer and Download failures

Verify that MediaWiki itself can render the PDF's requested page. Check the
installed media handler and its rasterizer requirements, source access and
server transform errors. A failure before thumbnail creation is not evidence
that the overlay selected the wrong layer set.

Images/slides offer **Download PNG** first and a separate **Download PDF**.
PDFs offer **Download PDF** only. Print and Download use the admitted saved
layers. If an output page fails, complete PDF assembly must refuse rather than
produce a shorter document or a different source. Retain the failed action and
error when reporting it. A successful Print preparation does not prove the OS
print dialog or a physical print completed.

The legacy cached server PDF export endpoint is a different path. Its cache
must remain outside the document root and be served through its checked delivery
URL. Do not expose the directory or use a legacy export as an exact native
history export. See [[API Reference]].

## Canvas, tools, shortcuts and layout

Inspect console and failed resource responses first. Check CSP restrictions
against [the CSP guide](https://github.com/slickdexic/Layers/blob/codex/l01-publication-admission/docs/CSP_GUIDE.md) instead of disabling protections.
Check editor focus and whether a text field owns keyboard input. Preserve work
before changing browser context or trying a fresh reproduction.

Use one matched source/assets tree. The approved narrow layout wraps the
existing header controls and places the layer panel above a full-width canvas;
Save should remain reachable. Report viewport, zoom and skin if it is clipped.
Keyboard, touch and assistive-technology coverage remains scoped to the
[release matrix](https://github.com/slickdexic/Layers/blob/codex/l01-publication-admission/docs/MILESTONE_1_RELEASE_CHECKLIST.md); do not assume a
complete browser/device qualification from one passing desktop journey.

For rendering or interaction lag, record layer count/types, effects, source
sizes, viewport and timings on the actual deployment. Separate network, server
and browser work. Do not alter experimental browser settings or reduce an
editor's content as a substitute for investigating the cause.

## Diagnostics and a useful bug report

An administrator can temporarily enable `$wgLayersDebug` and inspect the
configured Layers log channel. Keep collection bounded and private, then restore
the intended logging level. Broad MediaWiki request logs can contain sensitive
data; share only the diagnostic details needed for the issue.

Include the exact reviewed Layers commit, MediaWiki/PHP version, browser/OS,
skin and viewport; the content type and embed syntax; steps, expected/actual
behavior and the relevant API/ResourceLoader error. Remove cookies, tokens,
credentials and private payloads before sharing. State whether the Save outcome
was confirmed and whether unsaved work/drafts remain in the editor.

Use [existing issues](https://github.com/slickdexic/Layers/issues) or the
[issue form](https://github.com/slickdexic/Layers/issues/new). See [[FAQ]],
[[Configuration Reference]] and the
[release checklist](https://github.com/slickdexic/Layers/blob/codex/l01-publication-admission/docs/MILESTONE_1_RELEASE_CHECKLIST.md) for current limits.
