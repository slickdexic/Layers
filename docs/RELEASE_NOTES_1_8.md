# Layers 1.8 release notes — draft

**Status:** preparation draft, not a published release. Final version/tag,
remaining release checks and project-owner acceptance are pending. The
[release ledger](RELEASE_1_8_ACCEPTANCE.md) is authoritative.

## Page ownership and native history

Layer sets belong to the wiki page that uses them. Saving a change creates a
native revision of that owning page, with its editor, summary and history.
Historical viewing, layer diffs and selective restoration use the saved
snapshot and its recorded source version.

Names are scoped to the owning page and file or slide. Two files can both have
a layer set named `ABC`. One PDF layer set keeps that same name across its
pages; selecting a PDF page does not create a differently named layer set.
Authors use `layerset=ABC` and `{{#Slide:ABC}}`, without typing owner IDs.

## Editing, Import and viewing

- Edit layers and View full size overlays remain the page entry points for
  images, slides and PDF pages. Saving or closing returns to the owning page.
- Copy and Import create an independent local branch. The first Save records
  source attribution; it does not create a live link to another page's layers.
  Whole-PDF Import and Undo/Redo preserve all imported members.
- Local draft recovery, stale-Save refusal and explicit reconciliation preserve
  current work. Restoring a local draft is distinct from saving a page revision.
- Images and slides offer Download PNG first, plus Download PDF. PDFs offer
  Download PDF only. Exports include saved layers; historical viewing retains
  the recorded file version.
- The full-size viewer retains Zoom, Fit, PDF navigation, Print and Download.
  Enlarged media supports touch/button/keyboard panning. Its toolbar remains
  bounded so controls do not consume the media area.

Existing editor tools and styling capabilities are retained. New search, Cargo
readiness/integration and layer-object links belong to later milestones; they
are not prerequisites for this page-history release.

## Upgrade requirements

Read the [complete upgrade guide](UPGRADING.md) before deployment.

- Use the MediaWiki 1.44+ build and that core release's PHP/database requirements.
  Docker is development infrastructure, not an extension dependency.
- The fully tested full-upgrade starting release is **Layers 1.5.95**. Older
  schema checks are narrower evidence, not complete older-release migrations.
- Preserve and verify the site's database, retained uploads, private settings
  and matching software. Deploy one coherent reviewed extension package.
- Run the schema updater through `mw-config` or CLI, refresh links/process jobs,
  review the Layers migration dry run, then commit the unscoped migration.
  `mw-config` alone does not finish the content migration.
- Verify completion and content/history/editing/output before reopening editing.
  Retained legacy rows and uploaded versions are recovery data, not cleanup
  targets. Completed migration makes the old shared sets read-only.

## Evidence and disclosed limits

The [candidate security review](PAGE_HISTORY_SECURITY_REVIEW.md) records the
corrected Import/recovery request-budget bypass, the documentation-tool security
patch and remaining review limits. It does not declare the release accepted.

The [upgrade matrix](UPGRADE_PATH_ACCEPTANCE.md),
[native acceptance](MEDIAWIKI_144_NATIVE_ACCEPTANCE.md),
[whole-PDF Import evidence](PDF_IMPORT_NATIVE_ACCEPTANCE.md) and
[recovery checkpoint](INTENDED_WIKI_RECOVERY_CHECKPOINT.md) distinguish recorded
passes from missing version/device combinations. Scoped tests do not establish
every browser, physical device, assistive technology or database upgrade.

Earlier pre-release pilot data is separate from a fresh 1.5.95 upgrade. The
[read-only review](PILOT_DATA_REVIEW.md) identifies retained split-name PDF groups
requiring owner disposition; no automatic historical repair is included.
Manual Print/device/accessibility, remaining performance/security checks and
owner sign-off stay explicit in the release ledger. These draft notes do not
declare those checks accepted or authorize a release tag.
