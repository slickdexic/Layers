# Save/Close regression repair — November 18, 2026

Advances HIST-4, DATA-1 and PERF-3. Existing controls, wording, recovery decisions
and publication/reconciliation safeguards remain.

## Report and reproduced cause

After Discard and open saved, the owner edited an arrow, saved, then chose Close.
Close offered Save/Discard and another Save reported
`layers-editor-session-unavailable`. The first Save reached MediaWiki: owning
page DeleteMe004 advanced from revision 2863 to 2899. The owner's page and open
browser were read only during diagnosis.

On a dedicated 8080 fixture, holding the response after the native publication
committed reproduced the exact sequence and error. Close inspected dirty state
before the active Save completed; its dialog dispatched a competing Save that
the lifecycle correctly refused. Previous browser helpers waited for publication
and backup completion before clicking Close, so they missed the real sequence.

## Repair

The editor shares one pending document Save across toolbar, keyboard and Close,
including buffered pages and final durable-backup handling. Close waits for it
and proceeds only on success. Refusal, uncertain publication, failed backup or
newer edits preserve the open editor. An explicit later Save can run normally.

Recovery captures loaded-editor history/selection witnesses before awaiting a
decision, but reconstructs the selected old timeline only after Continue.
Discard/Cancel avoid preparing unused checkpoints. Late content, history,
selection and recovery-method changes still refuse restoration. Source-backup
revalidation and renewed native authorization remain in place.

## Verification

On the maintained MediaWiki 1.45.3 wiki at 8080, the permanent browser test
discards a draft, creates an arrow, holds a committed Save response, clicks Save
again and Close immediately, then releases the response. It verifies one
publication, no false dialog or console rejection, normal return to the owner,
and the exact saved layers. The existing complete gradient/recovery/Undo/Redo/
Save/reopen journey also passes. Dedicated fixture content is restored exactly.

Focused tests cover failed/uncertain publication, failed backup, newer edits,
repeat Close, deferred preparation and late recovery-participant changes. Lint,
style, message, source-budget and bundle checks pass. Hosted exact-commit
results are recorded with the implementation checkpoint.

## Startup measurement remains separate

A fresh browser on the shared-mount 8080 development wiki needed about 13 seconds
from navigation to ready editing. The startup response took 5.55 seconds and the
combined editor response 4.83 seconds. An immediate reload needed about 6.7
seconds, including a 4.46-second editor response. These are diagnostic samples,
not a reference-device benchmark or a claim that editor startup is qualified.

With source held unchanged, three consecutive normal openings from the owning
page's Edit layers overlay took 6.64, 2.02 and 2.00 seconds. The first fetched a
different combined module response; the next two reused HTTP-cached assets and
transferred no editor bundle. Native revision loading took about 0.61 seconds.
Core's module store declines individual implementations larger than 100 kB;
the ordinary HTTP cache remains effective. No request routing or cache clearing
was used in this diagnostic. The warm samples meet the three-second target in
this bounded case, while first-use asset delivery remains substantially slower.

The current development wiki disables the main object cache. No settings,
services, accounts, owning-page content or cache limits were changed to improve
the measurement. The unused recovery preparation is removed, but this does not
resolve first-use ResourceLoader delay. Broader PERF-3 and overall release
acceptance remain open; testing stays on the owner's primary 8080 lane.
