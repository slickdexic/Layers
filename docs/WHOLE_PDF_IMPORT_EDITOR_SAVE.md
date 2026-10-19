# Whole-PDF Import editor Save

This separately enabled integration advances Milestone 1 / HIST-4 / DATA-1 /
SEC-2. It connects the existing owning-page Save entry to complete-PDF Import
publication and success-only saved-base reconciliation. Production editor,
Import, picker and draft-controller callers do not enable it yet. Existing
visible controls, default Save behavior and native publication APIs remain.

## Explicit integration

Construct the real `PageOwnedWholePdfImportApplication` with the actual PDF
editor bridge and whole-PDF session binding. Enable its group history route,
then call `enablePublication()` with a real
`PageOwnedWholePdfImportPublishClient`. A private certificate connects that
application to the same bridge. A detached request, fabricated result or
replacement publisher method cannot install or confirm this route.

The existing `Bridge.save(summary, beforePublish)` entry then captures the
complete current document and retained private source citations. With citations,
it calls the native whole-PDF publication transport once. Without them, it uses
the existing ordinary publisher. The optional draft callback runs before
dispatch. Neither transport retries an uncertain result automatically.

## Confirmed Save

A successful response confirms the exact submitted snapshot and revision, not
later canvas edits. The transaction prepares and checks all session assignments,
every live Import checkpoint, source claims and page-specific history timelines
before synchronously installing the new base. Newer ordinary edits remain in
the live document and remain dirty. Group command identities, their Undo/Redo
phases, page-local edits, redo entries and the currently viewed page survive.

Only citations included in the successful request are acknowledged. Claims
retained exclusively by an undone command remain available for its future Redo
and first Save. Checkpoint guards advance together with the session base;
saved history markers describe the submitted layers rather than pending edits.

When Save first stores a previously absent PDF member, earlier checkpoints keep
that member's exact native empty state. Undo restores its empty layers and
retains its source identity; page navigation cannot substitute the newly saved
imported layers. Existing members and unrelated document metadata are preserved.

## Refusal and uncertainty

A pre-dispatch refusal sends no request. A native rejection does not acknowledge
sources, confirm a base or advance history save markers. A conflict retains the
work and enters the existing conflict state. Missing or malformed results,
unknown transport failures and local participant drift after dispatch are
uncertain; they preserve the previous base and require explicit reconciliation.
Session disposal, replaced participants or changed native admissions refuse.

This client qualification does not establish native HTTP/session headers,
browser journeys, mobile or MediaWiki 1.44 acceptance. Native publication
evidence belongs to the separate native boundary. Production activation,
approved picker/storage/recovery integration, missing target sets, upgrade and
owner acceptance remain necessary before Milestone 1 is complete.
