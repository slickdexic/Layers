# Layers v1.8rc1 release notes

Published November 7, 2026 locally / November 8 UTC. The immutable release is
[v1.8rc1](https://github.com/slickdexic/Layers/releases/tag/v1.8rc1); later main
documentation/editor-help updates are Unreleased.

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
