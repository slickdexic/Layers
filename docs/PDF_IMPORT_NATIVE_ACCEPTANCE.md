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
first-Save handoff and whole-group Undo/Redo. The following native continuation
now qualifies those two boundaries.

The actual missing-target editor completed first Save and its in-place saved
handoff, then completed a second Save without reopening. Each Save created
exactly one owner-page revision with both PDF members and their reading order.
Whole-group Undo/Redo and page turns remained available. A genuine concurrent
owner edit then made Save refuse; the visible local text, active page and Undo/
Redo availability remained exact, and no duplicate revision was created.

A second native journey exercised a disjoint concurrent change to the unrelated
slide. Check saved page reconciled that change while retaining local PDF work.
A fresh editor explicitly restored the persisted whole-PDF draft at the group
Undo boundary. Redo restored both imported pages and the later local edit;
explicit Save created one revision while retaining the concurrent slide, main
text and source owner. Close returned to the owning page; its overlay reopened
both saved members. The final viewer Download contained both backgrounds and
saved layer text, independently rendered and inspected at landscape and portrait
aspect ratios.

These journeys found two existing refresh gaps. The handoff and fresh saved
startup now populate the existing PDF page inventory from the exact saved
file/layer-set group. Completed saved Import, group history and draft recovery
release their busy state before refreshing the existing Undo/Redo buttons. The
commits and synchronous re-entry guards remain intact. The inventory and button
regressions fail before these corrections; all 712 affected client tests across
12 suites pass afterward. Native recovery exposes usable Redo immediately, and
fresh reopen reports both pages with layers. No controls or wording changed.

Check saved page also refused an overlapping history case and preserved local
work. This is refusal evidence, not a claim that every conflict can be merged.
The native run used the owner's bounded shared-log exception: the acquired
prefix stayed exact, and separately retained appended records identified only
the ordinary wiki. Unexpected/test-wiki records still stop testing. Ordinary
wiki tables and installed media remained exact.

The test environment initially lacked Ghostscript and Poppler utilities required
by its native PDF handler. Restoring those standard development-environment
dependencies and refreshing only the fresh test PDF's metadata allowed native
admission. This introduces no Layers runtime service or configuration change.

A subsequent desktop browser journey qualifies a lost or unreadable successful
Save reply. A fresh test-only HTTP route let the real native publisher commit,
then suppressed only that request's success body. The exact target, base revision
and embed were selected in advance; request data and source references were
claimed and hash-bound before native dispatch. The complete committed response
was retained privately before the browser received an empty HTTP 200 body.
Validation refusals, other requests and Check responses were unaffected. This
tests lost-success-reply handling; it does not simulate a physical connection
failure or change the extension's transport.

The server created exactly one owner revision with both imported PDF pages,
their reading order and source attribution. The editor retained its uncertain
working state. A newer local edit was then made through the existing Text field.
One explicit Check confirmed the same revision using the exact retained request,
without another publication. Saved ownership and the page inventory appeared;
the newer edit remained local and dirty. Actual Undo returned to the confirmed
saved content, whole-group Undo removed both imported members, and Redo restored
the Import and the later edit across page turns. The source owner, main text and
unrelated slide remained exact. No runtime or maintained test change was needed.

The private fault recipe passed ten selection, success/refusal and durable-write
checks. Actual native logging witnesses were verified for the relevant API
traffic. Ordinary wiki table bytes, installed media, prior fixture rows/files,
protected source and private Git state remained exact. The source commit's
existing green CI is retained; unchanged full suites were not repeated locally.

This checkpoint does not qualify the entire release. Mobile, MediaWiki 1.44,
upgrade, combined security/performance
checks and owner acceptance remain part of the existing release checklist.
Private fixtures, screenshots, wiki data and environment credentials are excluded
from publication.

A 390 × 844 viewport check now passes whole-PDF Import, group Undo/Redo, both
page turns, first Save, owning-page return and overlay reopen. A distinct saved
text edit also creates one additional owner revision and survives reopen. Both
PDF members, exact source pins, main text and unrelated layer sets are retained.
This is a narrow browser-layout check, not physical touch-device acceptance.

Immediate property Save exposed a pending Undo checkpoint: live text could be
newer than its debounced history entry, so strict publication refused locally.
Save now settles that existing checkpoint before publication. A related inline
text regression showed the checkpoint was recorded before the completed edit;
it now records the final text and restored visibility. Both regressions fail
before their respective corrections. All 907 affected cases pass, including
server-refusal preservation, complete sibling data and inline Undo behavior.
The property correction also passes actual native immediate Save and reopen.
Combined inline text and formatting create one completed Undo checkpoint. No
publication guard, user control or wording was removed or relaxed.

Narrow-layout acceptance remains open: the saved header overlaps at 390 pixels,
and the existing layer-panel layout leaves a 20-pixel-wide canvas. A bounded
header/workspace arrangement proposal awaits the owner's approval under the
charter. The runtime layout is unchanged. MediaWiki 1.44, upgrade, combined
security/privacy/performance qualification and owner acceptance remain open.
