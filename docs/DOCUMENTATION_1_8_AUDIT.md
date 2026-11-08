# Layers 1.8 documentation audit

Reviewed November 8, 2026 against published **v1.8rc1**
(`cfdf8f2bd31b1d9616871e769317b52c64aba0bd`) and this documentation/help
follow-up. Advances Milestone 1 / OPS-1–OPS-2 and HIST-4–HIST-5.

## Scope

The [complete inventory](DOCUMENTATION_INVENTORY.md) lists **260** public
Markdown/MediaWiki documents. Structural validation covers **207 maintained or
policy documents** and preserves **53 historical records**. All **22 GitHub wiki
pages**, the separate wiki publishing guide, all **three `.mediawiki` files**,
and the four built-in Help tabs are in scope. Licenses, asset attribution and
dated results are retained. Historical records are not rewritten as if their
old tests, versions or failed experiments occurred today.

This is a source-led reconciliation of current release, user, administration and
developer guidance plus a complete inventory/link/mirror pass. It is not a
claim that every sentence in every historical packet was re-executed, every
external URL fetched, or every language received a new human translation.

## Findings corrected

| Subject | Correction and source of truth |
| --- | --- |
| Release identity | v1.8rc1 is a published testing prerelease, manifest 1.8.0-rc.1. Old claims that the manifest remains 1.5.95 or the candidate has no tag are removed from current guidance. Internal rc.1–rc.3 remain dated local builds. Version/download/README/changelog links in the extension `.mediawiki` infobox now agree. |
| Search and privacy | Current page-owned layer text is included after migration and cleanup. Page-revision access governs that text; hiding a referenced file does not hide an independently readable page's saved text. Old revisions and retained legacy recovery rows do not supply obsolete terms. This follows `DrawingSearchText`, guarded indexing and the approved search boundary. |
| Upgrade access | Reader and editor restriction through migration and successful index cleanup replaces edit-only-freeze guidance. The schema updater alone is insufficient, including on a fresh empty wiki. Public unmigrated legacy mode and arbitrary backends remain outside qualification. |
| API cache policy | `ApiLayersRead` sets private cache mode and maximum age zero for every response, including anonymous bindings and failures. `LayersBindingReadMaxAge` is retained compatibility configuration; earlier public-cache descriptions/proposals are superseded. |
| Import | Image/PDF sources need the same file and matching layer-set name on another readable page; slides need the same slide name. Search uses a source page-title prefix. Whole PDFs copy by page number; empty targets import immediately, otherwise Append/Replace applies. Undo remains local; Save publishes an independent copy. |
| Built-in Help | Owner-approved text explains ownership, native Save/history, Import, recovery, images/slides/PDFs and narrow-screen layout. Pen is press-drag-release; the generated shape index contains 1,385 shapes. Import Image is documented separately. English messages, JavaScript fallbacks, translation descriptions and ResourceLoader registration agree. |
| Tool shortcuts | Source inspection found no M/G/J dispatch for Marker/Shape Library/Emoji. Guides and Help no longer promise those shortcuts; the actions remain available in the toolbar. The old Marker toolbar tooltip still advertises M; this separate runtime/UI discrepancy is recorded in Known Issues rather than silently adding a shortcut. |
| Current versus historical evidence | Current status, acceptance and handoff entry points identify published RC1 and remaining stable-release gates. Dated proposals, local failures, prior test counts, retired architecture and old assignments retain their historical scope. Current guides link to maintained main; immutable release references retain their tag/commit. |

## Verification

- The clean public-source documentation pass checks local links, wiki page
  links, Current Status/Changelog mirror parity, all manifest configuration and
  static API entries, legacy schema columns and MediaWiki markup balance.
  Scalar configuration defaults were compared with `extension.json`.
- **45 affected Help/version tests pass.** Existing escaped-message tests cover
  Help rendering; its 18 tool/action entries include Import Image. JavaScript
  lint, version consistency, i18n wiring and source-growth checks pass.
- The maintained 8080 wiki serves the new help text through ResourceLoader.
  A signed-in existing image editor was inspected in resource-debug mode:
  Overview, Tools, Shortcuts and Tips display the corrected text. At 390 × 844,
  the dialog is 337.5 pixels wide and scrolls with tabs/Close available. No Save,
  Import or content edit was performed. This is bounded visual verification,
  not physical-device or assistive-technology acceptance.
- The separate GitHub wiki was cloned before editing: all 22 published source
  pages matched RC1, with no remote-only pages. Publication uses the existing
  main-branch synchronization workflow and a subsequent content comparison;
  remote-only pages/assets must always be preserved.

The initial Help test expected 17 entries and failed after Import Image was
added; its count was corrected to 18 and the affected tests passed. Hosted CI
also caught the editor bundle at 2154.4 KB against its 2153 KB raw-source
limit. The approved Help changes add 2063 raw bytes (705 gzip bytes when that
file is compressed separately, not a network-payload measurement). The explicit
editor-only allowance is now 2155 KB; reader budgets and charter timing targets
are unchanged. Native MediaWiki and browser tests passed on the initial
documentation commit. No runtime
permission, migration, search, save or import algorithm changed in this refresh.

## Publication boundary and remaining work

The v1.8rc1 **tag and downloadable archive remain immutable**. Main and the
GitHub wiki carry this follow-up; the improved built-in Help is Unreleased and
available on the source-mounted 8080 test wiki. The installed 8082 wiki retains
the released package. A later candidate must be explicitly built and qualified
to distribute the improved Help in a new archive.

All three `.mediawiki` files are updated publication sources. This task does
**not** claim that mediawiki.org was edited. Other published versions, LTS
branches and archived release downloads retain their own version-specific docs.
Final stable 1.8 still needs the disclosed reference-performance disposition and
applicable physical-device, accessibility, Print and owner acceptance. The
missing M/G/J dispatch and stale Marker tooltip are bounded follow-up issues,
not changes to runtime architecture or reasons to revive abandoned container work.
