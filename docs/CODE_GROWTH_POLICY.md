# JavaScript growth check

Advances Milestone 1 / OPS-3 and OPS-4. Run `npm run check:code-growth` before
submitting a candidate; the pull-request workflow runs the same command and
`node --test scripts/tests/check-code-growth.test.js`.

The previous 110,000-line cap included generated shape and emoji data and was
already exceeded by the existing candidate. Its individual-file ceilings also
predated accepted functionality. This made the pull-request check reject the
existing code without identifying new growth.

The November 5, 2026 working-source baseline has 114,442 handwritten JavaScript
lines, excluding 15,911 generated shape/emoji data lines and distribution files.
The new total ceiling is 115,000 lines: 558 lines of headroom, under 0.5% of the
baseline. Existing handwritten files over 1,000 lines are capped at their
measured line counts in `scripts/code-growth-baseline.json`; other files may not
exceed 1,000 lines. A future baseline change needs explicit review and a reason,
not an automatic refresh. These limits control source growth; they do not
replace the separate transferred-bundle or performance budgets.

The recorded baseline describes the working source reviewed on November 5. It
must be checked against the exact public release candidate before the workflow
can qualify that candidate. A successful local check is not remote CI evidence.

## November 8 folder-transform allowance

Explicit source review for the owner-approved FEAT-6/FEAT-4/UI-6 feature permits
115,500 handwritten lines (500 above the prior ceiling). The implementation
keeps its geometry and gesture transaction in two separate editor-only modules.
Small delegation changes increase the existing TransformController, CanvasEvents
and CanvasRenderer ceilings; SelectionRenderer's folder frame is explicitly
allowed just above 1,000 lines. This is a bounded feature allowance, not a refresh
of unrelated file limits. The editor raw-source bundle allowance increases by
30 KB to 2,185 KB; reader/shared limits and charter timing targets are unchanged.
Verification must include ResourceLoader's compressed output: source lint alone
did not catch its handling of an optional-chain callback in CanvasRenderer.

November 9 bounded follow-up review permits six additional CanvasEvents lines
for completing folder touch gestures before double-tap handling and four
LayersEditor lines to map a storage refusal to its existing localized message.
Other file limits and the total/bundle allowances stay unchanged.

## November 11 durable-draft fallback review

The owner approved the IndexedDB fallback and exact warning on November 10
(DATA-1, DATA-3, HIST-4, UI-7). Review keeps the transactional database adapter
and dual-store facade separate from the existing lifecycle modules. Their
commit/readback, writer isolation, recovery and rollback paths need explicit
code; neither a synchronous storage substitution nor fire-and-forget writes
meet the approved behavior.

The reviewed change permits 116,000 handwritten lines, 500 above the folder
ceiling, with measured source near 115,840. APIManager gains three lines net for
the shared database/store factory and warning dispatch; LayersEditor gains six
net for the approved warning and awaited Close completion. Their ceilings become
2,074 and 2,604; other existing per-file ceilings stay unchanged.

The base editor measures 2,186.1 KB; its limit rises by 2 KB to 2,187 KB for that
integration. Most fallback code belongs to `ext.layers.editor.pageOwned`, which
previously had no explicit bundle budget. Add a 920 KB limit for its measured
approximately 915 KB total, including its existing 49 files. This closes a
coverage gap in the size check rather than treating the module as free growth.
Reader/shared limits and charter timing targets remain unchanged. Exact-candidate
ResourceLoader/browser and performance qualification still apply.

## November 18 gradient regression repair

FEAT-4, HIST-4 and DATA-1 require the existing gradient controls, glyph painting
and native Save to work together. The shared LayerRenderer ceiling increases
from 1,003 to 1,006 lines for three lines connecting its existing gradient
renderer to plain text. All other file ceilings, the 116,000-line total and
bundle budgets remain unchanged.

## November 18 approved recovery choices

The owner approved Continue draft, confirmed Discard draft and open saved
version, and Cancel returning to the page. HIST-4, DATA-1, DATA-3 and UI-7
require exact selected-backup deletion, rollback on storage failure, native
saved-editor preflight and a fresh editing session. Review permits a bounded
500-line total increase to 116,500 and two APIManager wiring lines to 2,076.
The implementation measures approximately 116,161 handwritten lines. The
page-owned editor budget increases by 15 KB to 935 KB for measured 929.9 KB.
The same acceptance journey identified server-canonicalized gradient key order
after Save. Four PropertiesForm lines compare values independently of object key
order; its bounded ceiling becomes 1,024. Other per-file, base-editor,
reader/shared and timing budgets stay unchanged.

## November 18 Save/Close timing repair

HIST-4 and DATA-1 require Close to await the existing publication and its final
backup instead of offering a conflicting second Save. LayersEditor adds 12 net
lines for a shared pending Save and its Close continuation; its ceiling becomes
2,616 and the base-editor bundle allowance increases by 1 KB to 2,188 KB.
Recovery now captures the loaded editor's witnesses before the decision and
rebuilds the selected old timeline only after Continue. Its small bridge witness
fits the existing page-owned budget. Total source, reader and timing ceilings
are unchanged.

## November 19 approved gradient envelope controls

The owner approved the full-diagonal radial basis, 0–200% radius and Center X/Y
sliders with numeric percentages. FEAT-2 and FEAT-3d require shared rendering,
including zero-radius paint and plain Text linear projection. The editor bundle
allowance increases by 2 KB to 2,190 KB for the compact shared percentage-control
builder, labels and layout, plus property-history settlement after an active
Save. The native regression reproduced an uncaught history refusal when that
timer fired during publication. Eleven editor lines defer/coalesce the history
step until the same Save settles, retain newer edits and keep uncertain bases
held; its bounded ceiling becomes 2,627. Total handwritten source and
shared/reader ceilings stay unchanged; shared rendering fits its existing budget.
