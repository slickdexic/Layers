# Upgrade-path acceptance

**October 26, 2026. Advances Milestone 1 / OPS-1 / HIST-8 / DATA-1.**
The [upgrade guide](UPGRADING.md) is the operator procedure; this document records
what has actually been tested, without assigning support to untested paths.

## Qualified starting point

**Layers 1.5.95 is the fully tested starting release** for the 1.8 candidate.
The retained native MySQL / MediaWiki 1.44.6 rehearsal installed that released
version, created legacy image/slide/PDF content, backed it up, deployed the
candidate, ran the native updater and link/job refresh, then migrated into page
history. It checked full payloads, source versions, geometry, bare references,
independent owners, completion, post-upgrade PDF Save/reopen and safe reruns
before and after a newer edit. Unsafe template intent refused completion.

Later source comparisons and the [current native command check](UPGRADING.md#current-candidate-migration-check--october-25-2026)
preserve that evidence's scope. The final publication-admission changes have
their separate native checkpoint. The
[application recovery check](INTENDED_WIKI_RECOVERY_CHECKPOINT.md#application-level-restore--october-26-2026)
also verifies restored data can be read by MediaWiki with matching captured code
and native dependencies. These are distinct upgrade and recovery results.

No version-number gate requires 1.5.95. Earlier direct upgrades may work, but a
supported minimum must be backed by complete migration evidence, not just
successful ALTER statements. Do not invent a mandatory intermediate release or
claim the full earlier-release route has passed from the tests below.

## New native historical-schema tests

The maintained MediaWiki 1.44.6 / MySQL environment ran the production Layers
schema hook through the public native installer/updater engine on a guarded
temporary table prefix. No installed wiki tables were substituted or reset,
and no new wiki, database clone, container or port was created.

| Released layout | First native update | Second update | Content-migration completion |
| --- | --- | --- | --- |
| 0.8.2 | Passed; legacy payload exact, missing page defaults to 1, NULL name backfilled | Passed; complete resulting row exact | Not set |
| 1.0.0 | Passed; same preservation checks | Passed; resulting row exact | Not set |
| 1.3.0 | Passed; same preservation checks | Passed; resulting row exact | Not set |
| 1.5.0 | Passed; same preservation checks | Passed; resulting row exact | Not set |
| 1.5.95 | Passed; payload, explicit name, user and revision retained | Passed; resulting row exact | Not set |

The first four released table files have identical bytes. Testing five tags
does not represent five distinct schema formats; the matrix covers two released
layouts and representative retained data. It does not run every earlier editor,
payload variant, database engine or complete history migration.

All 23 installed table/absence witnesses remained exact after the tests and
every temporary table was removed. Initial helper bootstrap/private-API/hook
setup refusals were retained; the final run uses the public updater entry point
with a separate hook registry. No production defect or runtime patch was needed.

This directly demonstrates why `mw-config` is insufficient on its own: the
extension schema updates preserve/prepare the legacy rows, while the global
Layers content-migration completion record stays absent. The web updater and
CLI updater use the native schema-hook mechanism; the actual web wizard UI was
not automated by this test. The full qualified upgrade used CLI maintenance.

## Before calling an upgrade complete

Run the complete [operator checklist](UPGRADING.md#4-validate-before-reopening-editing),
including migration dry-run review, unscoped commit, boolean completion using
API `formatversion=2`, source retention, owner isolation, whole-PDF members,
native Save/return/reopen, history and output, permission checks and safe rerun.
Keep editing frozen until those checks pass. Undo is a separately reviewed
operation; it does not replace the full matching backup or permit overwriting
newer edits.

The manifest/version tag is finalized at release cut. The supported starting
point and tested database/version scope remain explicit in the 1.8 release
ledger. A new installation does not need an old Layers release, but still runs
the updater and unscoped migration completion with no legacy content to copy.
