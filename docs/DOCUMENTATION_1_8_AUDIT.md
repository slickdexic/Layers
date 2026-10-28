# Layers 1.8 documentation audit

This review advances OPS-1 and OPS-2 for the independent page-history release.
It does not declare the release accepted or publish documentation externally.

## Coverage and findings

- The repository documentation checker validates local links, wiki links,
  required configuration and API references, mirrors and MediaWiki source
  checks. The working checkout reports 402 maintained/policy documents and
  53 historical records. This is structural validation, not a line-by-line
  semantic review of every historical packet.
- All 22 maintained GitHub wiki page names were compared with the published
  GitHub wiki. There were no remote-only or local-only page names; 14 published
  pages differed from the public page-history candidate at the time of review.
  The published wiki describes the older 1.5.95/shared-storage workflow; it
  must not be replaced with candidate guidance and presented as a released 1.8
  until the release is accepted. Reconcile remote changes again before publishing.
- The three `.mediawiki` files are publication sources. The candidate sources
  describe native ownership, the legacy table and the upgrade boundary; editing
  them does not publish them to mediawiki.org. The published Extension:Layers
  page still describes the older shared-storage workflow. Publication and
  verification of the correct external pages are separate release work.
- The extension infobox source matches all 27 registered hooks and 27 manifest
  configuration settings. The version check matches the current 1.5.95 manifest.
  Its previously unrecognized wiki Home version/date and Installation patterns
  were corrected, so those pages are checked rather than silently skipped.
- The active architecture guides incorrectly described native history as a
  proposal and whole-PDF Save as sequential. They now distinguish native
  complete-snapshot publication from the retained legacy path. The alignment,
  frontend and slide implementation guidance was corrected accordingly. The
  named-set and Wikitext design references now label their older shared-storage
  examples and point to the current page-owned guides.
- The installation guide and MediaWiki publication sources now identify 1.8 as
  the unaccepted target, distinguish the fully rehearsed 1.5.95 starting point
  from a technical minimum, and require the separate content migration after
  the schema updater. The owner-page and single PDF layer-set name rules remain.

## Before the release

Finish the remaining semantic review of maintained guides and examples against
the final release candidate, rerun the documentation and version checks after
the version cut, and verify each public destination after its authorized update.
Review generated source/download links and translations without replacing remote
edits or exposing private data. The [release ledger](RELEASE_1_8_ACCEPTANCE.md)
remains authoritative for other acceptance work.
