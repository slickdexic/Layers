# Page-history release evidence

**October 25, 2026. Advances Milestone 1 / HIST-1–HIST-9 / DATA-1.**
This maps retained acceptance to the independent 1.8 candidate. It does not
declare the milestone complete or add a release requirement.

## Candidate and reuse boundary

The reviewed runtime candidate is `b04679d`, with passing
[exact-commit CI](https://github.com/slickdexic/Layers/actions/runs/40255423435).
Compared with the final owner-admission baseline `62f7ba1`, every tracked byte
under `src`, `maintenance` and `sql`, and `services.php`, is unchanged.
Editor/shared JavaScript and JSON are also unchanged. Their other changes are
asset notices/licenses and one font-license comment; the font CSS directives
remain identical. Viewer changes have their own
[bounded toolbar acceptance](VIEWER_TOOLBAR_LAYOUT_ACCEPTANCE.md) and
[panning acceptance](PHONE_VIEWER_ACCEPTANCE.md).

This permits reuse of the final native publication/admission tests and recorded
editor results within their existing scope. It does not turn older browser
results into new runs against this candidate. In particular, the earlier
`27721b0` native journey baseline predates the final source/owner admission
guards and bare-name migration output. The writer, publication API, history
access, embed rewriter and copy component remain unchanged from that baseline;
the migration factory/command and publication service have changed. The later
[native admission checkpoint](MILESTONE_1_HTTP_PRIVACY_ACCEPTANCE.md) records
117 passing cases / 495 assertions for the final guard, rather than relying on
the older browser journeys to qualify that change.

## Native activity-feed readback

The maintained MediaWiki 1.44.6 / MySQL wiki served the current checkout.
Read-only native API queries matched eight existing layer revisions to their
recent-change and contributor entries. The six revisions on pages already
watched by the test account also matched the native watchlist feed. The other
two owners were not watched and were excluded from that watchlist assertion.

Revision/parent identity, owning title, actor, summary, timestamp and change tags
agree between the native revision and applicable feeds. Complete main/layers
slot contents were hashed and read back unchanged. Existing watchlist rows and
their change timestamps, and the combined owner's complete revision/slot
readback, stayed exact. No content, watchlist or configuration was written and no
new wiki was created; authentication was the only non-query API action.

These are **migration-produced revisions**, not fresh ordinary editor Saves.
The migration actor and both migration/layer tags are retained as provenance.
An offline replay independently checked the recorded data and refused four
modified copies: changed summary, missing contribution tag, missing watched
revision and changed layer-slot bytes. The unmodified replay passed again.
These controls changed only in-memory evidence copies, not runtime or wiki data.

Separately, anonymous read-only queries on the maintained MediaWiki 1.45.3 main
test wiki matched four existing non-migration layer edits to recent changes and
the editor's contributions. Each revision contains an actual layer-slot change
and preserves its parent's main text. Actor, summary, timestamp, tags and parent
identity match, and complete revision readback remains exact. These are existing
ordinary layer edits, not four newly performed Saves. No login, content write
or configuration change was needed. Main-wiki watchlist membership was not
accessed; the six watchlist matches above belong to the 1.44 migration fixture.

Echo is not installed on the checked 1.44 wiki. Notification delivery remains unproved;
neither a revision tag nor a watchlist entry demonstrates a delivered notification.

## History criteria and remaining scope

| Criterion | Retained evidence applicable to this candidate | Remaining release scope |
| --- | --- | --- |
| HIST-1: one owning-page revision per Save | [Image/slide/PDF native Saves](MEDIAWIKI_144_NATIVE_ACCEPTANCE.md), [PDF first/second Save and attribution](PDF_IMPORT_NATIVE_ACCEPTANCE.md), and final native admission cases. | Reconcile the intended-wiki owner scenarios with these recorded results; the new feed readback does not qualify an ordinary Save. |
| HIST-2: history, diff, restore and native activity | Recorded native PDF history/diff, selective historical restore, complete recovery and safe reconciliation; four ordinary-editor recent-change/contribution matches, eight migration matches and six migration watchlist matches above. | Notification delivery remains unproved. The watchlist check does not cover ordinary-editor Saves; manual owner acceptance remains. |
| HIST-3: default page ownership | [Upgrade completion and post-upgrade behavior](UPGRADING.md), without a pilot owner list. | Exact-candidate intended-wiki upgrade/application restoration remains in the release ledger. |
| HIST-4: scoped identity and preservation | Independent owners, same visible name, exact file versions, both PDF members and unrelated slide preservation in the native journeys. | Remaining supported-version/device and intended-wiki owner acceptance. |
| HIST-5: independent copy/Import and provenance | Whole-PDF Import, one group Undo/Redo, first-Save source attribution and preserved source owner. | Remaining owner acceptance; partial-selection copying is not claimed by this whole-set evidence. |
| HIST-6: historical content | Recorded historical viewing and exact-source delivery; selective restore preserves unrelated members. | Applicable manual Print acceptance and remaining owner scenarios. |
| HIST-7: scoped rename | Retained scoped atomic rename/refusal regression and browser evidence. | Current intended-wiki rename acceptance is not replaced by feed inspection. |
| HIST-8: migration and recovery | Recorded 1.5.95/MySQL transition, retained sources and newer-edit preservation; [persistent-data and application-read restoration](INTENDED_WIKI_RECOVERY_CHECKPOINT.md#application-level-restore--october-26-2026) now passes with exact retained data. The [current native rerun](UPGRADING.md#current-candidate-migration-check--october-25-2026) adds zero revisions and qualifies no-write rollback planning. | Final-artifact reconciliation and separate earlier pilot-data review. Site-specific settings/software still need operator preservation. No fresh database transition or actual undo was repeated. |
| HIST-9: bare author-facing names | The native migration command, factory/component and four associated regression files exactly match the final retained upgrade rehearsal, which qualifies bare output. The supported older owner-qualified form stays readable as input. | Intended-wiki pilot-data review and final-artifact reconciliation. The current rerun preserves existing references and is not a second fresh-output rehearsal. |

The existing combined migration fixture retains older owner-qualified embeds.
Its historical and current revisions were inspected without rewriting them.
This is evidence of the earlier migration's output, not proof that the current
command writes owner IDs and not a second fresh bare-output qualification. The
command/factory/component and four regression files have now been compared
byte for byte with the final retained upgrade rehearsal. Keep the
distinction when planning the intended-wiki upgrade; do not silently relabel
or repair retained pilot data.

The [1.8 ledger](RELEASE_1_8_ACCEPTANCE.md) remains the release gate. Reuse passed
results and run only missing or affected checks. Broader security/performance,
device/manual acceptance, final packaging and owner sign-off remain open.
