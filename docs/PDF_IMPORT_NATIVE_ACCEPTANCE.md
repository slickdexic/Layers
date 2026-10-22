# PDF Import: native acceptance checkpoint

**October 22, 2026. Advances Milestone 1, HIST-4, DATA-1 and UI-10.**

The desktop acceptance run used an isolated MediaWiki 1.45.3 wiki, its native
page-revision writer and PDF handler, and the actual editor and viewer controls.
The source and destination owned independent layer sets named `ABC`. The source
used an earlier version of the same two-page PDF; the destination used the current
version. The pages had different portrait and landscape dimensions. An unrelated
slide with the same layer-set name was retained on the destination.

The following passed:

- The approved catalog imported both PDF members, with the existing different-file-version notice.
- One Undo removed both imported members' layers; Redo restored them.
- First Save created exactly one native owner-page revision with source-page and revision attribution.
- The page's main text, unrelated slide and source owner's complete snapshot remained exact.
- Close returned to the owning page. Its overlay reopened the saved PDF with the imported layers.
- Native history and diff showed the layer-slot change and source attribution.
- The viewer's Download delivered both pages. Independent PDF inspection and rendered-page review confirmed both backgrounds, aspect ratios and imported layers.

The run found a toolbar defect: after turning a page, Undo and Redo were refreshed
while the completed turn was still marked busy. The history guard therefore
disabled controls that should have remained available. Releasing the completed
operation before the refresh corrects this. The same ordering applies when draft
restoration ends. Four toolbar-state regressions failed before the respective
corrections; all 865 affected creation, publication, recovery and startup tests
pass afterward. A fresh native run confirmed that Redo stays reachable after
turning the page. Recovery-button availability is qualified by the client tests;
its final native replay remains open.

A fresh editor also restored the persisted complete Import after explicit
confirmation and saved it in one attributed owner-page revision. This run exposed
an incomplete in-place handoff: the following Save remained on the creation route
and refused locally before publication. Local work and the committed revision
were preserved. The native stale-Save test therefore remains unqualified; the
handoff must be corrected before claiming the complete Save/recovery journey.

The subsequent native trace identified the handoff refusal in Import-history
conversion. Native PDF surfaces carry `readingOrder`; comparing the blank
before-Import order with the saved imported order as immutable surface metadata
rejected a valid history checkpoint. The correction treats reading order as
working content alongside layers, preserving its value or absence in each
checkpoint. Source identity, ownership, geometry and fresh authorization checks
remain enforced. Both native-shaped regressions fail with the previous helper;
all 100 directly affected client tests pass with the correction, including
first-Save handoff and whole-group Undo/Redo. The consecutive-Save native replay
and genuine stale-Save acceptance remain open; these client results do not
replace them.

The test environment initially lacked Ghostscript and Poppler utilities required
by its native PDF handler. Restoring those standard development-environment
dependencies and refreshing only the fresh test PDF's metadata allowed native
admission. This introduces no Layers runtime service or configuration change.

This checkpoint does not qualify the entire release. Complete native draft and
conflict journeys, mobile, MediaWiki 1.44, upgrade, combined security/performance
checks and owner acceptance remain part of the existing release checklist.
Private fixtures, screenshots, wiki data and environment credentials are excluded
from publication.
