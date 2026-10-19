# Whole-PDF Import local drafts

This integration advances Milestone 1 / HIST-4 / DATA-1 / UI-10 / SEC-2. The
existing draft controller, local store and lifecycle can retain a complete
whole-PDF Import record and restore it through the qualified application. The
integration is explicit; production Import, picker and recovery callers do not
enable it yet. Existing image/slide and legacy PDF draft behavior remains.

## Enable the complete record

After enabling the actual whole-PDF application and its group history, call
`PageOwnedDraftController.enableWholePdfDrafts(application)` for that same
bridge. Configure the qualified publication route before using Save. Construct
the existing `PageOwnedDraftLifecycle` with this controller and the existing
recovery UI callbacks. No new dialog, control, wording or storage backend is
introduced.

The existing `persist()` entry writes its standard version-1 scoped envelope
with a distinct `wholePdfImportDraft` field. The complete inert record retains
the saved base, active and offscreen layers, native origins, source citations,
page histories, group checkpoints, command phases and retired refusal barriers.
It is never passed through legacy `pdfDraft` / `pdfHistory` recovery. Legacy
records remain discoverable and retain their original recovery route. Mixed or
malformed complete records refuse without deleting or sanitizing the backup.

Read-only capture supports ready, saving, conflict and uncertain states. It
does not relax the existing ready-only application or publication guards.
Pending Save capture requires the actual installed publication route and busy
session association. A normally trimmed, unreachable command is stored as its
surviving refusal barriers; capture does not mutate its private checkpoints or
the pending publication.

## Save and independent backups

The existing lifecycle's pre-dispatch callback durably writes a saving-phase
record. Storage failure refuses dispatch. Its final flush records the confirmed
new base after success, or complete newer work plus the conflict/uncertain hold
after failure. A confirmed Save never clears the prior backup before a durable
replacement exists. The existing store keeps separate writer partitions and
retirement rules: selecting another editor's recovery record does not transfer
ownership of that record.

## Explicit recovery

Inspection copies and validates an exact-base record. It grants no application
authority. The existing Review/Restore and cancellation controls remain. Restore
uses the application's native target/source/origin revalidation and complete
session/editor/history commit. Changed live work, a changed selected backup,
replaced participants or methods, denied source access and disposal refuse.
Cancellation preserves current work and every backup under the existing
publication hold.

An uncertain or saving-phase backup remains blocked after explicit restoration.
The hold is installed synchronously with restored session/history state before
editor observers run. This prevents an observer from treating recovered work as
ready to publish. Recovery does not retry a Save or confirm an uncertain result.

## Remaining acceptance

This qualifies component storage and lifecycle integration, with production
callers inactive. Complete PDF source catalog/picker composition, supported
reconciliation, missing target sets, native HTTP/browser Save and recovery,
MediaWiki 1.44/mobile, upgrade and owner acceptance remain separate work. Draft
discovery remains scoped to the loaded exact revision; older-revision backups
are preserved without a new earlier-PDF recovery claim. This checkpoint does not
complete Milestone 1.
