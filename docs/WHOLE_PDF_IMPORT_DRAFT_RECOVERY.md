# Whole-PDF Import draft recovery

This separately invoked client boundary advances Milestone 1 / HIST-4 / DATA-1 /
SEC-2. It restores the complete selected PDF layer set into a matching current
editor session. It does not enable an editor caller, write local storage, publish
content, change the recovery dialog or complete milestone acceptance.

## Trust and identity

`PageOwnedWholePdfImportDraftPlan.prepare(record, expected)` accepts the version-1
capture described in [the capture contract](WHOLE_PDF_IMPORT_DRAFT.md). It returns
detached finite JSON. Owner, saved revision, target file/version, layer-set name,
anchor and PDF inventory must match the actual session. Other file groups and
root data must match current work. Snapshot canvas/layers remain editable data;
native temporary blanks must exactly match their recorded origins.

Serialized citations, origins, group IDs and checkpoint data grant no authority.
Preparation and final revalidation use the existing native readers. Each declared
current or active-checkpoint source citation is freshly read with its target and
source scope. The target editor read always checks current edit access, including
records with no source citations. The exact saved-base read is repeated. Missing
members require current native admission or authorized historical association
and an uncached historical read. A draft cannot establish historical association
by matching an ID alone. No self-source request is manufactured for an empty
citation list.

## Transaction API

Call `enableHistory()` explicitly before using this opt-in application:

1. `await application.prepareDraftRecovery(record, assertCurrent)` returns an
   opaque handle. It performs no live mutation or editor lock. The optional
   synchronous guard must return `undefined`; future storage integration must
   use it to witness the selected backup and writer identity.
2. `application.inspectDraftRecovery(handle)` returns a detached preview. It
   preserves the currently viewed PDF page and includes complete layer-set data,
   source references, native origins and validated history. Stored rendition or
   context URLs are not installed as navigation authority.
3. Only after explicit user confirmation, call
   `await application.commitDraftRecovery(handle)`. Fresh native authorization
   and complete live editor/session/history/selection checks precede the first
   write. It commits session, active editor state, selection, per-page timelines
   and private complete-group Undo commands synchronously, then refreshes views.
4. `application.releaseDraftRecovery(handle)` discards preparation or cleans up a
   consumed handle. Cancellation/refusal preserves current work and backups.

Edits, page changes, selection/history changes, destruction, changed participants,
changed methods, stale scope or failed native access during either await phase
refuse recovery. A refused or consumed capability cannot commit again. Refresh
failures after accepted commit are diagnostics, not a false rollback claim.

## History and provenance

Current per-page history and ordinary redo tails are retained. Active complete
Import groups receive fresh private checkpoint capabilities and fresh group IDs;
serialized IDs cannot operate another session. Both checkpoint sides retain their
own freshly authorized source references. Undo/Redo operates the whole group
through the existing explicitly enabled history route. Existing history methods
and ordinary editor callers are unchanged.

Retired groups remain checkpoint-free refusal barriers. Recovery does not infer
source identity for unreachable retired history. An active marker whose
predecessor is missing refuses. When native trimming has clamped a removed saved
index onto a validated retired entry at index zero, and that entry differs from
the actual saved page/native blank, the detached plan changes only that false
saved marker to `-1`. It retains every history entry and barrier. Other false
saved markers refuse; imported work must not be described as saved.

Complete-session dirtiness and the editor state remain authoritative. The
unchanged classic history query falls back to its first retained entry when no
saved index remains; it does not establish whether the complete PDF is saved.
Future integration must retain the complete-session dirty/Save decision.

## Qualification limits

The companion tests use actual client session/editor/history classes and mocked
native transports. No fresh HTTP, PHP/native, browser, database, configuration or
ordinary-wiki operations are claimed. Earlier native read/publication evidence
remains retained separately. Current editor controls, draft controllers/storage,
Save/reconciliation and registration do not invoke recovery. Integrating the
approved Review / explicit Restore / Keep flow, ordinary Save provenance,
missing target sets, native/browser, supported-version/mobile, upgrade and owner
acceptance remain required before Milestone 1 is complete.
