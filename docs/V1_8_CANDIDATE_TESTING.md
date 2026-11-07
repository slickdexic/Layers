# Layers 1.8.0-rc.2 testing candidate

Cut November 7, 2026 at the project owner's request. Advances Milestone 1,
HIST-1–HIST-4, DATA-1–DATA-4 and OPS-1–OPS-3. This is a concrete testing
candidate, not a declaration that the production release gate has passed.

## What to test

Use the maintained MediaWiki 1.44 wiki at `http://localhost:8082` for the installed
candidate. Port 8080 follows ongoing development; 8081 retains its older build.
The package's version is `1.8.0-rc.2`. The accompanying build receipt identifies
the exact source commit, archive hash and verified installed files.

Use synthetic or non-sensitive content for candidate testing. Existing test
content/accounts are retained. No wiki migration,
test-data replacement or core upgrade is part of this candidate installation.

1. **Images:** open an owning page, choose Edit layers, change a layer and Save.
   Reopen it, check native page history/diff, view the earlier revision and Undo.
   Confirm the page text and unrelated layer sets remain intact.
2. **Slides:** create/edit a slide, Save, reopen from its page overlay and use
   the full-size viewer. Exercise Undo/Redo, Download PNG/PDF and Print preparation.
3. **Whole PDFs:** edit two internal pages in one named layer set, Save once,
   reopen both and export the complete annotated PDF. Check page navigation,
   selected-page alignment and the old saved source after a file reupload.
4. **Recovery/conflicts:** in two tabs, save in one then try to save stale work
   in the other. The refusal must preserve work. Exercise the existing Check
   saved page and draft recovery actions; check that no duplicate revision appears.
5. **Access and devices:** confirm anonymous readers get View but no unauthorized
   Edit action. Try keyboard navigation, a phone viewer and tablet editing in
   light/dark themes. Record physical Print and screen-reader results separately.

For each failure record the candidate version, page URL, browser/device,
reproduction steps, expected/actual result and whether Save completed. Do not
include credentials or private content in bug reports.

## Known limitations and production blockers

- **Migration and search cleanup are required before reopening.** Under the
  [approved boundary](RELEASE_1_8_MIGRATED_SEARCH_BOUNDARY.md), retained legacy
  rows no longer supply post-migration search. The cleanup scans all current
  pages, including those with lost Layers associations. Publicly served
  unmigrated legacy mode still has its known stale-result privacy gap and is
  outside v1.8 qualification. Follow the upgrade guide's reader-access restriction,
  completion check, cleanup and verification sequence.
- **Page-owned policy A applies.** Readable page-owned layer text remains
  searchable after its referenced file is hidden. Restrict the page revision
  itself to restrict that text. Media delivery still refuses unavailable sources.
- Reference reader latency, full physical-device/keyboard/screen-reader and
  owner acceptance remain open. Automated tests do not substitute for those checks.
- Final exact-candidate hosted CI and broader backend qualification are separate
  from local candidate testing. No production tag or GitHub release is implied.

## Package and installation

The source package is extension-only, rooted at `Layers/`; private settings,
credentials, wiki content, uploads, caches, logs, Git history and local acceptance
artifacts are excluded. Composer/npm development dependencies are not bundled.
Runtime assets and their license notices remain included.

For another test installation, back up the wiki and follow [UPGRADING.md](UPGRADING.md)
and [installation](../wiki/Installation.md). Existing pre-page-ownership wikis
require the documented migration process, including discovery/dry run and
completion checks. Do not delete retained legacy rows or edit completion flags.
Use the native PHP/database/media-handler requirements of MediaWiki 1.44+.

For the maintained 8082 lane, rollback changes only the extension image to the
prior reviewed candidate using the existing combined Compose configuration.
Retain the same database/uploads and never point 8082 at the development mount.
Application rollback does not undo user edits or replace the need for backups.

See [release acceptance](RELEASE_1_8_ACCEPTANCE.md) for the production gate and
the local build receipt for actual checks on this candidate.
