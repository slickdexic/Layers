# Layers 1.8.0 release notes

## Published v1.8 — November 23, 2026

[Layers 1.8](https://github.com/slickdexic/Layers/releases/tag/v1.8) is the
stable page-ownership and native revision-history release. The extension
reports 1.8.0. The public archive and checksum matched the qualified commit
0c2c6b0e920c3a558a538552530cf2ba16275f73.
[Acceptance record](RELEASE_1_8_ACCEPTANCE.md)

### What’s new

- **Page-owned layer sets.** Images, standalone slides and whole PDFs save
  layer sets to the owning page's MediaWiki revisions. Page history supports
  reviewing changes, opening a prior layer set with its recorded source
  version and restoring it. Copies and imports are independent of their
  source, including when two pages use the same layer-set name.
- **Whole-PDF editing and restore.** Edit a PDF's internal pages in one layer
  set, save them together, and download or print the annotated document.
  **Restore this version** restores the full historical PDF layer set,
  including page members previously removed by rollback.
- **Safer Save and draft recovery.** Rejected or uncertain Saves leave work
  available for recovery. **Check saved page** helps resolve an uncertain
  outcome. The draft recovery dialog offers **Continue draft**, **Discard
  draft and open saved version**, and **Cancel**. A confirmed discard keeps
  the reviewed backup until the saved editor opens successfully.
- **Editor controls.** Folder transforms operate on nested members together.
  Gradient controls include radial radius and centre settings, and plain Text
  layers support linear gradients. **Layer actions** offers **Move up** and
  **Move down** for a selected layer or folder among its siblings, with
  Undo/Redo. Tablet editing supports two-finger pan and pinch.
- **Keyboard and visual access.** Viewer and picker dialogs keep keyboard
  focus inside the dialog and return it to the control that opened it.
  Shape Library categories open from the keyboard. Compact editor and
  recovery layouts scroll to keep actions reachable, and active toolbar
  labels have improved dark-mode contrast. PDF page turns retain focus on
  the navigation controls and announce the new page number.

[Complete change history](../CHANGELOG.md)

### Install and upgrade

Requires **MediaWiki 1.44 or newer** with the PHP and database versions
supported by the installed core. PDF editing and viewing use MediaWiki's PDF
Handler and its normal prerequisites. Use the versioned extension archive and
verify it against the release's SHA-256 checksum. The archive includes runtime
assets and license notices. [Release guide](RELEASE_GUIDE.md)

Keep the wiki closed to ordinary readers and editors during the upgrade,
including access to search pages and APIs. An edit-only freeze leaves the
search indexes readable. Back up the database, uploads and configuration with
their matching software, and rehearse on a copy of the wiki.

1. Drain requests and jobs using the old extension code. Install Layers
   and run MediaWiki's schema updater.
2. Refresh links and process discovery jobs. Review the Layers migration
   dry run, then complete the unscoped migration.
3. Clean the search index after migration. Verify successful completion,
   retained layer sets and source versions, search results and native page
   history before reopening access.

Retain the legacy rows for recovery. After migration, MediaWiki search uses
current readable page revisions for layer text. A fresh wiki also needs the
empty migration completion step. Keep reader access restricted during any
rollback until the restored software, data and index have been verified
together. [Upgrade procedure](UPGRADING.md) · [Approved search boundary](RELEASE_1_8_MIGRATED_SEARCH_BOUNDARY.md)

### Qualification and known limits

- **Native and browser coverage.** The application candidate was tested on
  MediaWiki **1.44.6** and **1.45.3**. The full upgrade rehearsal starts at
  Layers **1.5.95** on **MediaWiki 1.44.6 / MySQL**. Rehearse the actual wiki
  before using an earlier Layers version or another database. [Acceptance record](RELEASE_1_8_ACCEPTANCE.md) · [Upgrade coverage](UPGRADE_PATH_ACCEPTANCE.md)
- **PC accessibility.** The recorded manual check used Windows Narrator and
  Edge with Vector 2022. The spoken PDF page-turn retest passed on 1.45.3.
  Installed 1.44.6 checks verified the repaired PDF focus and status in the
  browser. The newer Layer actions, compact layout and contrast checks are
  browser evidence. Wider WCAG and screen-reader coverage remains open.
  [Manual walkthrough and retest](PC_EDITOR_ACCESSIBILITY_BEHAVIOUR_BRIEF.md#manual-screen-reader-results--november-22-2026)
- **Mobile and Print.** The owner confirmed normal editing, multi-page PDF
  Save and Download, rollback, restoration and printing on the maintained
  1.45.3 wiki. Touch emulation qualifies the tested editor gestures. The
  owner accepts the reported tablet and phone usability limits as nonblocking
  for the PC-focused release. Physical-device recheck remains follow-up.
  [Owner and device evidence](RELEASE_1_8_ACCEPTANCE.md#owner-tablet-result-and-release-disposition--november-20-2026)
- **Performance.** The owner accepts USB-backed development wiki timings as
  nonblocking for 1.8. The **300 ms** image-load-to-layer-paint target still
  applies to the production-settings, local-disk reference installation,
  where it remains unverified. Other workflow budgets retain their recorded
  scope. [Performance evidence](PAGE_HISTORY_PERFORMANCE.md)

## Published v1.8rc2 — November 22, 2026

The second public testing candidate reports **1.8.0-rc.2** and points to
`8c27833d41d8c127ccdc8ed2df4fd8d4a6f35703`. It contains the qualified
folder-transform, draft recovery, Save/Close, gradient, whole-PDF restoration,
viewport and initial PC accessibility work. Its tagged archive remains the
November 22 testing package. [v1.8rc2](https://github.com/slickdexic/Layers/releases/tag/v1.8rc2)

## Published v1.8rc1

Published November 7, 2026 locally / November 8 UTC. The immutable release is
[v1.8rc1](https://github.com/slickdexic/Layers/releases/tag/v1.8rc1).

This is the first public **Layers 1.8 release candidate**, intended for testing. The extension reports **1.8.0-rc.1**. It includes the fixes qualified in the internal rc.3 build; internal candidate numbers were not earlier public releases.

### What is included

- Page-owned layer sets for images, slides and whole PDFs, with native MediaWiki revision history, restore/Undo and independent copies.
- Draft recovery and conflict handling that preserve unsaved work.
- Search cleanup that removes obsolete legacy terms after migration while preserving ordinary page text and current page-owned layer text.
- Correct automatic search indexing on both MediaWiki 1.44 and 1.45.
- Import guidance explaining eligible sources, independent copying, Append/Replace, Undo and Save.

### Installation and upgrades

Requires **MediaWiki 1.44 or newer** and the PHP/database versions required by that core. PDF annotation requires the normal MediaWiki PDF-handler dependencies. Docker is not a runtime dependency.

Download **Layers-v1.8rc1.tar.gz** and verify it against **SHA256SUMS**. The package includes runtime assets and license notices; it excludes private settings, wiki data, uploads, logs, Git history and development dependencies.

**Before reopening an upgraded wiki to readers:** back up and rehearse, restrict reader/editor access, drain old-code work, complete the reviewed layer-set migration, then successfully clean the search index and verify the results. An edit-only freeze is insufficient. Retained legacy records remain recovery data. Follow the [upgrade guide](https://github.com/slickdexic/Layers/blob/v1.8rc1/docs/UPGRADING.md).

### Verification and known limits

The affected search/migration group passes on native MediaWiki 1.44.6 (59 tests / 531 assertions) and 1.45.3 (59 / 543). The public candidate preserves that tested application behavior; only release identification and delivery documentation changed. The [acceptance ledger](https://github.com/slickdexic/Layers/blob/v1.8rc1/docs/RELEASE_1_8_ACCEPTANCE.md) records the broader scoped evidence and retained failures. All hosted checks passed for release commit `cfdf8f2bd31b1d9616871e769317b52c64aba0bd`: [CI](https://github.com/slickdexic/Layers/actions/runs/42446168558), [native MediaWiki tests](https://github.com/slickdexic/Layers/actions/runs/42446168520), [browser tests](https://github.com/slickdexic/Layers/actions/runs/42446168517), and [lint/style checks](https://github.com/slickdexic/Layers/actions/runs/42446168555).

The owner reports fast normal loading and no remaining observation of earlier performance problems. Forced reload is also slow on pages without Layers. A retained image-to-layer paint sample measured 312.4 ms against the 300 ms target; reference-condition, physical-device, accessibility and Print acceptance remain disclosed for final 1.8. Publicly served unmigrated legacy search and arbitrary external search backends are not certified by this candidate.

Please test using the [candidate checklist](https://github.com/slickdexic/Layers/blob/v1.8rc1/docs/V1_8_CANDIDATE_TESTING.md) and report the page/media type, browser/device, reproduction steps and whether Save completed. Do not include credentials or private content in reports.
