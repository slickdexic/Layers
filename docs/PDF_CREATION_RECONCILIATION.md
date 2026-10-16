# PDF creation Save reconciliation

This work advances milestone 1 and HIST-4, HIST-1, DATA-1 and UI-10. It defines a guarded way to inspect and apply the result of a first Save while creating PDF layer sets. The controller and host methods remain inactive: no UI caller or lifecycle wiring is connected, and browser and owner acceptance remain open.

## What reconciliation checks

Reconciliation reads the current owner page and revision, its main text and embedding, and the complete Layers snapshot through the existing native creation or saved-PDF read paths. It repeats the relevant reads before preparing a transition. An outcome object alone grants no authority; the host prepares an opaque, single-use transition tied to the current transaction and live editor state.

The result has one of three meanings:

- `base-current`: the original base revision and selected embedding are still current, and the layer set is still missing. This is true only at inspection time. A delayed earlier POST may still arrive afterward. A later Save must be an explicit user action and still uses the native expected-base revision check.
- `payload-current`: the current direct successor contains the exact immutable snapshot sent by the inspected attempt, with the original main text intact. This describes current content; it does not prove that this client request created the revision.
- `changed`: neither safe state was proved. The work remains held for separate review.

Reconciliation never retries publication. It does not merge changed content or overwrite the current page.

## Drafts, backups and history

The controller opts into attempt retention with `retainPublicationAttempt: true`; the host can capture a version-2 envelope with `captureDraftEnvelope({ publicationAttempt: true })`. Default controller behavior and version-1 envelopes remain unchanged. The attempt’s immutable sent snapshot stays separate from any newer draft edits.

Applying reconciliation requires a fresh, distinct checkpoint `DraftStore` using the same storage and an independent writer ID. The exact pre-check backup is retained there while live state, history, hold state, writer ownership and both backup copies are rechecked before commit. A failed check leaves the transition unapplied and keeps the backup.

Restore revalidates sent-only pages and pages retained only in Undo history, as well as the current draft pages. When `payload-current` is proved, history marks only states matching the sent snapshot as saved; newer edits and other Undo branches remain available and dirty. The existing saved-session handoff performs fresh native admission afterward.

For compatibility, a restored version-1 or version-2 envelope with `publicationBlocked: true` is treated as a review or ambiguous hold. Those formats cannot prove why the hold was set, so reconciliation must refuse to clear it. A normal uncertain version-2 envelope with `publicationBlocked: false` can be inspected after explicit Restore, subject to fresh native checks.

## Remaining qualification

The methods are not connected to a visible control, autosave, pagehide, Save/Close or owning-page return. UI behavior, lifecycle wiring, actual HTTP privacy and errors, and browser qualification for creation, first Save, return, reopen, Undo, recovery, stale refusal and exports remain open. Existing editor tools, saved PDF flows, viewer, Print and annotated Download stay in place.
