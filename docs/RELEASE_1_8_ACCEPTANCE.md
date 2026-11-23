# Layers 1.8 release acceptance

## Published v1.8 — November 23, 2026

Advances Milestone 1, DATA-1 and OPS-3. The owner directed publication of
stable v1.8 after reviewing the release recommendation. GitHub published
[Layers 1.8](https://github.com/slickdexic/Layers/releases/tag/v1.8) on
November 23, 2026, at 17:07 UTC. Tag v1.8 resolves to
0c2c6b0e920c3a558a538552530cf2ba16275f73, manifest 1.8.0.

The published extension archive and checksum matched the verified local
files after a fresh public download. The archive SHA-256 is
afe946f3fb8085471705cfec329f5220f938047bcd1dc5b1dd68f373f18747a9.
All 2,975 files matched the tagged Git blobs and modes in the package
qualification. The exact package ran on the maintained MediaWiki 1.44.6
wiki and preserved its saved content and uploads.

[CI](https://github.com/slickdexic/Layers/actions/runs/45220154765) passed
19,293 JavaScript tests and 1,716 standalone PHP tests with one skip.
[Native MediaWiki](https://github.com/slickdexic/Layers/actions/runs/45220155639)
passed 258 tests. [Browser tests](https://github.com/slickdexic/Layers/actions/runs/45220154834)
passed 18 smoke tests, 23 editor tests with one skip, and four native
editor accessibility tests. [Release-triggered wiki sync](https://github.com/slickdexic/Layers/actions/runs/45224102947)
passed, and all 22 managed pages matched the tagged source after that run.

The release decision uses the combined evidence from a fresh 1.5.95
migration on MediaWiki 1.44.6/MySQL and a recovery exercise of the already
migrated intended wiki on MediaWiki 1.45.3. The three older pilot PDF groups
retain their existing names. The 300 ms reference installation target
remains unverified under the owner's earlier performance disposition.

## Stable 1.8.0 preparation — November 23, 2026

Advances Milestone 1, UI-3, UI-6, DATA-1 and OPS-3. The preparation branch
carries application candidate `8a962fe0` with stable version metadata and
release documentation. Published RC2 remains the preceding public checkpoint.
Exact-commit CI and installed-package verification remain pending at this
preparation checkpoint.

The preceding application archive passed all 19,293 Jest tests across 340
suites, code-growth and ResourceLoader bundle limits, and shipped asset checks.
Four installed Chromium cases passed on MediaWiki 1.44.6 and the working wiki
replayed the affected keyboard, contrast and folder workflows on 1.45.3.
**Layer actions** offers same-parent reordering with a click, tap or keyboard.
The browser replay verified focus, status, Undo/Redo, locked descendants and
menu bounds at 400% zoom. The recorded Windows Narrator/Edge PC walkthrough
includes the successful PDF paging speech pass on 1.45.3.

### Evidence for the intended-wiki decision

- Review the retained 1.5.95/MySQL migration rehearsal on 1.44.6 alongside
  the 1.45.3 restoration of the already-migrated intended wiki. The restore
  preserved native and HTTP reads for images, slides and PDFs, 66 persistent
  table witnesses and 7,832 uploads. Compare the final package to the rehearsed
  migration and recovery code. The owner records S7 acceptance or authorizes
  a fresh rehearsal from an appropriate pre-migration copy.
- Retain the three pilot PDF groups with their current names while the owner
  decides their disposition. The ten affected members matched preserved
  payloads and source versions apart from names. A later repair requires a
  review of exact references and separately approved native publication.
- Use the remaining [Milestone 1 owner scenarios](PROJECT_CHARTER.md#7-acceptance-scenarios-for-the-project-owner)
  to close uncovered ownership, history, isolation, recovery and permissions
  workflows before final sign-off.
- Keep reader and editor access restricted through successful migration,
  search cleanup and verification during any upgrade. The tested upgrade
  starting path and rollback procedure are in the [upgrade guide](UPGRADING.md).

The reported USB timings and mobile usability issues retain their owner-approved
release dispositions. The 300 ms reference-install result remains unverified.
The intended-wiki decision and stable publication are separate from artifact
preparation.

## Layer actions and dark toolbar labels — November 23, 2026

Advances UI-3, UI-6 and OPS-3. The approved **Layer actions** button sits
beside **Add folder**. Its menu opens by click, tap, Enter or Space.
**Move up** and **Move down** change the selected layer's position among
its siblings. Folders move with their contents. Successful moves retain
selection, focus the moved row and announce the existing status. A selection
hidden by the layer filter keeps focus on the opener. Boundary positions,
locked layers, folders with locked descendants, the background and multiple
selections are protected. Undo and Redo use the existing layer history.

The Rectangle, Arrow and Text toolbar labels now use the existing secondary
text color in both explicit dark mode and automatic dark mode. On 8080,
the three Playwright cases passed, including nine day, night and automatic
dark tool-state contrast checks. The menu was exercised with mouse,
keyboard and an emulated touch tap at 320 × 256 CSS pixels. Escape, focus,
the move announcements, Undo/Redo and the saved revision and slot hashes
passed.

Local candidate `8a962fe0adc4040f9c01a430c5013b6a990bedfb` retains the RC2
manifest version for qualification. The 2,975-file archive matches its
Git blobs and executable modes. Its SHA-256 is
`b7488a608230052ec70d9affceaa992659f02bc3289edf23b4f63c547e7a363c`.
Sharing the toolbar and Help SVG wrappers preserves all 50 generated icon
strings byte for byte. The editor module uses 2,250,427 of 2,251,776 allowed
raw bytes. Handwritten JavaScript totals 116,500 lines against the unchanged
116,500-line limit. The exact archive passed the full JavaScript gate with
340 Jest suites, 19,293 tests, 94.17% statement coverage, and all configured
bundle and shipped asset checks.

The installed 8082 package matched all 2,975 file hashes and executable
modes. Four Playwright cases passed using the retained slide fixture,
including the new actions, both contrast cases and recovery after a failed
destination. On both maintained wikis, a browser-only folder test verified
sibling boundaries, membership, a locked descendant, one-step Undo/Redo,
row focus and menu bounds at actual 400% browser zoom. The Playwright touch
case used emulation.

The 8082 pre- and post-install records matched for fifteen content tables,
three uploads and all other services. Harmless requests under `tmp/`,
`acceptance/` and `.git/` returned HTTP 403. The candidate remains local.
Click-only moves between folders and broader WCAG qualification remain open.

## Approved keyboard disclosure and compact layouts — November 23, 2026

Advances UI-3, UI-6, UI-10 and OPS-3. The owner replied “I trust your
recommendations. Please take these items” to the recommendation to repair
Shape Library keyboard access and the editor and recovery layouts.

- **Shape Library.** **ISO 7010 Safety Signs** is a keyboard-focusable disclosure.
  Enter, Space and a pointer click toggle the same category. The expanded state
  is exposed, focus stays on the heading, and Escape returns to the picker
  button. Category names, order, search and shapes are retained.
- **Editor.** The compact editor scrolls its existing controls and workspace.
  Tab reaches **Save**, **Add folder** and the other tested controls. Focused controls
  scroll back into view when the viewport shrinks. Controls suppressed by the
  selected tool are skipped by keyboard navigation.
- **Recovery.** In a short viewport, one scroll area contains the heading,
  review and existing choices. Focus remains exposed when the viewport shrinks
  and when Escape returns from discard confirmation. The 8080 regression
  retained the same draft bytes through a simulated HTTP 503 and removed only
  the reviewed local draft after a successful reopen. Saved revision and slot
  hashes matched.

On MediaWiki 1.45.3, all three Playwright accessibility and recovery cases
passed, including both desktop themes. A separate Chromium replay at actual
200% and 400% browser zoom (640 × 512 and 320 × 256 CSS pixels) exercised
keyboard focus, Save, the layer panel and recovery on the slide fixture.
PDF focus and status also passed. In the exact candidate archive, all nine
focused Jest suites passed (819 tests).

Local candidate `6a1f0bb95ffc6515ab21d0b73dbde0b2bac2d349` is installed on
the maintained MediaWiki 1.44.6 wiki. The 2,975 extension files match the
archive and Git blobs by digest and mode. The archive SHA-256 is
`9c29b0806b5e024d0ed56e093263bb04b136f280b4bcac9e092660444070e048`.
The installed browser replay passed the Shape Library disclosure, the PDF
page-turn status and focus checks, and the editor and recovery keyboard tests
at actual 200% and 400% zoom. All 41 focus stops in the compact slide editor
remained visible when focused. The PDF editor with Rectangle selected exposed
all 45 compact focus stops, including its active style controls. **Home**
scrolled to the recovery heading, and Tab exposed all choices and both
discard-confirmation buttons. Escape preserved the existing draft bytes.

Fifteen content tables, nine pages, sixteen revisions and three uploads
matched the pre-install receipt. The other four services retained their
container identities, images and start times. Harmless HTTP marker requests
under `tmp/`, `acceptance/` and `.git/` returned 403.

The follow-up reproduced dark-mode toolbar contrast and verified the existing
layer reordering entry points. Independent text resizing and broader UI-3
qualification remain open.
[Findings and behavior brief](#toolbar-contrast-and-layer-actions--behavior-brief)

### Toolbar contrast and layer actions — behavior brief

Owner approved November 23, 2026 (“I approve”). Advances UI-3 and UI-6. The editor uses the same
saved layer sets and publishes layer order through the normal **Save** path.
Readers see the order recorded in the revision they are viewing.

**Toolbar labels.** On the installed 1.44.6 wiki in Vector 2022 and the 1.45.3
working wiki in Vector, axe measured 3.22:1 for **Stroke Color**, **Fill Color**,
**Stroke Width** and **Font Size** in the Rectangle, Arrow and Text tool states.
This reproduces in explicit night mode and automatic mode with a dark system
preference. Day mode measures 5.74:1. Use the existing secondary text color
for these toolbar labels in both dark modes. That color measures 6.14:1 against
the current toolbar background. Keep the label text, layout, controls and
system high-contrast palette. Verify contrast with the controls displayed for
each tool. [WCAG 2.2 Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)

**Layer actions.** Add a compact button next to **Add folder** in the Layers
panel, named **Layer actions**. With one layer or folder selected, a click,
tap, Enter or Space opens its menu. The first two entries are **Move up** and
**Move down**, followed by the existing layer actions in their current order.
The menu stays inside the viewport and scrolls if needed. Escape closes it
and returns focus to its opener. All existing panel controls remain reachable
in the compact layout. Keep the existing right-click and keyboard controls.

Each move places the selected layer one position higher or lower among its
siblings in the current folder or at the top level. A folder moves with its
contents. First and last positions disable the corresponding command. The
background, locked layers, folders containing locked layers and multiple
selections cannot use the new move commands. The panel keeps the selection,
moves focus to the reordered row and announces the existing move status.
One Undo reverses the move and Redo reapplies it. Dragging and keyboard
shortcuts retain their present folder and lock behavior.

On 8082, Arrow Down on the layer handle moved a layer one row, retained
focus and was reversed by Undo. The saved revision and slot hashes matched.
Right-click on the same row opened no Layers menu. The normal ResourceLoader
editor registers the listener only in the fallback row handler. The visible
button gives desktop and touch users a direct route. This change covers
ordering within a folder or at the top level. Click-only transfers between
folders remain open. Qualify ordinary rows, folders, locked and boundary
cases, Undo/Redo, keyboard focus, narrow zoom, and a touch tap.
[WCAG 2.2 Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html)

## Installed PDF repair and accessibility audit — November 23, 2026

Advances UI-3, UI-6, UI-10 and OPS-3. Local candidate
`ae910d71c2ddf10be27861a0c216a7c9046fccc1` adds the approved PDF toolbar repair
and focused regression to published RC2 (`8c27833d`). The 2,975 extension files
match the Git blobs and installed 8082 bytes and permissions. The archive's
SHA-256 is
`93b26dfd5a173cc18304861e731bb0655489aa060fcf5ee731a8254b2fce1862`.
All 535 tests in the three focused Jest suites passed from the archive.

In Chromium on the installed MediaWiki 1.44.6 candidate at port 8082 and the
MediaWiki 1.45.3 working wiki at port 8080, Enter moved PDF focus to the
available direction at each boundary. The status region changed once per
turn, to **Page 2 / 2** and then **Page 1 / 2**. Saved revision IDs and slot
hashes matched. Actual speech passed in Windows Narrator with Edge on 8080.
The 8082 speech rerun could not complete because Edge could not be activated
for Narrator input.

The 8082 install and replay preserved the digests of fifteen content tables,
nine pages, sixteen revisions and three uploads. The 8082 service retained
its environment, mounts and port bindings. The 8080 and 8081 web services
and both database services retained their container identities, image IDs and
start times. Harmless HTTP marker requests returned 403 under `tmp/`,
`acceptance/` and `.git/`.

| Workflow | Result on both maintained wikis | WCAG 2.2 criterion assessed |
| --- | --- | --- |
| Shape Library category browsing | Pointer clicks collapse and expand **ISO 7010 Safety Signs**. The category heading does not receive Tab focus and exposes no disclosure role or state. | 2.1.1 Keyboard, 4.1.2 Name, Role, Value |
| Slide editor at a narrow viewport | At 320 × 256 CSS pixels, focus reached **Save Changes**, **Add folder** and other controls outside the visible viewport. At 640 × 512, the hit-test also flagged the color and stroke-width controls for investigation. | 1.4.10 Reflow, 2.4.11 Focus Not Obscured (Minimum) |
| Draft recovery at a narrow viewport | At 320 × 256, the choices left a 20-pixel-tall review area and **Cancel** was offscreen on one Tab stop. The discard confirmation buttons remained reachable. Escape returned to the choices and the local draft bytes matched. | 1.4.10 Reflow, 2.4.11 Focus Not Obscured (Minimum) |
| Full-size viewer | After zooming in, **Pan down** moved the media with a click. All 12 controls in the Tab cycle were exposed at both sizes. Escape returned focus to **View full size**. Tested an image on 8082 and a PDF on 8080. | 2.4.11 Focus Not Obscured (Minimum), 2.5.7 Dragging Movements |
| Layer reordering | The source exposes drag-and-drop and keyboard reordering. The inspected layer row and context menu expose no single-pointer reorder command. | 2.5.7 Dragging Movements |

Viewport tests used fixed CSS-pixel dimensions in Chromium. Browser zoom,
text resize and the remaining complete user journeys require separate checks.
The editor canvas and viewer assign some Ctrl/Command zoom shortcuts to media
zoom. Test browser zoom from the browser menu and with focus in those widgets.
Existing numeric transform properties give a pointer alternative to dragging
for supported layer transforms. The Rectangle source requires a minimum size
from the gesture, and the live probe produced no layer with either input.
An observed creation path and a keyboard equivalent still need verification.
The applicable assessment sources are
[Keyboard](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html),
[Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html),
[Focus Not Obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html)
and [Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html).

### Proposed behavior for owner review

The owner approved the first two repairs, whose results are recorded above.
Layer reordering remains a proposal.

- **Shape Library (UI-3).** Make **ISO 7010 Safety Signs** a keyboard-focusable
  disclosure with visible focus and an announced expanded or collapsed state.
  Enter, Space and pointer click toggle the same list. Focus stays on the
  heading while toggling. Keep the current heading text, search, category
  order and shape choices. No removal or new wording is proposed.
- **Editor and recovery at high zoom or in small windows (UI-3, UI-6, UI-10).**
  Keep the editor's actions and panel controls reachable by scrolling, and
  bring the whole focused control into view. When the recovery dialog cannot
  fit its heading, review and actions, allow the whole dialog to scroll so
  all three remain reachable. Keep the desktop arrangement at roomier sizes.
  Keep the existing action names and order, discard confirmation, Escape
  behavior and draft retention. No control or wording would be removed.
- **Layer reordering (UI-3, UI-6).** Add **Move up** and **Move down** to the
  existing layer context menu. Each moves the selected layer one step using
  the same folder and ordering rules as the current keyboard action. Keep
  drag-and-drop and the keyboard shortcuts. Keep focus on the moved layer
  after the menu closes.

These are scoped findings for the 1.8 release. Full UI-3 conformance, the
remaining screen-reader combinations and stable release sign-off remain open.

## Installed 1.44.6 candidate — November 22, 2026

Candidate `ee6759ed` advances HIST-4, DATA-1, UI-3 and OPS-3. It includes
application `3251c1a1` and a test-only follow-up for native recovery-dialog
shortcuts. The qualification archive contains 2,975 regular files. Each file
matches its Git blob, and installed file hashes and permissions match the
archive. Its SHA-256 is
`39de38ac90948bc0ce941146e5bab5aa917c04fe39fc7708c307839a4eccb0cb`.

The extracted archive passed all 340 JavaScript suites and 19,289 tests.
Packaged assets, source growth, bundle size, lint and style checks passed.
ESLint reported six warnings in existing code and tests.

The maintained 8082 wiki used its existing core, accounts, uploads and database.
Its HTTP guard returned 403 for harmless marker paths under all three protected
directories. The two other version wikis and both database services retained
their original container identities, image IDs and start times.

Twelve Chromium checks passed. Vector 2022 covered an image, a slide and a
saved PDF. Vector also covered the image. Each ran light and dark keyboard
checks and a confirmed discard with an injected HTTP 503. The backup remained
byte-for-byte intact after the failed navigation, and a healthy reopen removed
the reviewed backup. The fixture's saved revision and slot hashes stayed
identical. The private test harness pinned the existing wiki, account, page,
revision and surfaces while retaining the candidate's browser assertions.

All fifteen content-table checks, nine pages, sixteen revisions and three
uploads matched the pre-install record after the final replay. Manual
screen-reader acceptance remains open. USB-backed timings are nonblocking
for stable 1.8, and the 300 ms reference-install target remains unverified.

## Stable 1.8 reader performance decision — November 21, 2026

The owner accepts the USB-backed development wiki timings as nonblocking for
stable 1.8. The 300 ms image-load-to-layer-paint target applies on the reference
install. Reference performance remains unverified until measured there. The
installed 1.44.6 run on `69f0d828` retained two misses in five measured visits.
Cold-server and media coverage retain their recorded limits. The other
performance budgets continue to apply to their respective workflows.
[PERF-2 evidence](PAGE_HISTORY_PERFORMANCE.md)

## PC accessibility follow-up — November 21, 2026

Engineering ran a [keyboard-only check](PC_EDITOR_ACCESSIBILITY_BEHAVIOUR_BRIEF.md#agent-keyboard-only-check-on-the-maintained-wiki--november-21-2026)
on 8080. Reader entry, viewer focus, Help and layer visibility Undo/Redo passed.
Both pickers pass keyboard replay in the light and dark 8080 slide editor.
On a slide, image and saved PDF, the reviewed backup survives a failed
navigation and is removed after the saved editor opens successfully.
[Recovery verification](KEEP_DRAFTS_EDITING_BEHAVIOUR_BRIEF.md#failed-destination-after-confirmed-discard--november-21-2026)
The November 22 installed replay is recorded above. Manual screen-reader acceptance remains open.

The owner reports keyboard-only/screen-reader testing **not yet performed**.
This is an open acceptance check, not a waiver or a failed owner test. A read-only
native Chromium inspection on the maintained 8080 wiki finds that Tab reaches
the wiki's navigation/search jump links underneath the editor. Axe also reports
serious nested-control violations on an ordinary layer row and the Canvas row;
the listbox issue is already recorded in the charter's UI-3 baseline. All 100
recorded Tab presses leave layer data and saved revision/slots unchanged, with
no page/request errors. Automated inspection does not establish a manual
screen-reader pass. The bounded [PC accessibility brief](PC_EDITOR_ACCESSIBILITY_BEHAVIOUR_BRIEF.md)
was approved: “Approve the PC accessibility brief”. Additional baseline
dark-theme image/slide/PDF editor audits reproduce the layer-role issue and find
2.71:1 PDF page-counter contrast. The brief also proposes theme-aware counter
colours. Six light/dark image/slide/PDF viewer checks report no axe violations,
retain forward/reverse Tab within the viewer and return to the opener on Escape.
All nine additional cases preserve saved content and have no page/request errors.
Their first observer waited for a hidden overlay action before focusing its
host; the corrected observer passes without changing product behavior. Retain
that failure separately; these results do not qualify manual screen-reader use.
The implemented repair now passes eight native editor cases across image/slide/
PDF, both themes and both Vector skins. Keyboard traversal, Help/colour-picker
focus and Escape, layer controls, actual edits/Undo/Redo, Canvas activation and
counter contrast pass with saved content unchanged. Cancel/Discard and reopen
also pass. The old dark colour deliberately fails the contrast observer; desktop
viewport navigation retains its native pass. The brief records retained failures,
the 337-suite / 19,254-test full local run and final 17-suite / 1,116-test replay.
This advances UI-3 in the verified scope, without a manual screen-reader pass.
Application `64e03968` passes all three exact-code CI workflows, including
340 JavaScript suites / 19,279 tests. Its 2,974-file qualification package
matches Git and installed 1.44.6 hashes/modes. Four installed image-editor
theme/skin cases pass with exact reader pixels, focus/dialog handling, rename
cancellation and axe. All fifteen content-table witnesses, nine pages, sixteen
revisions and three uploads remain unchanged; no other service/configuration is
changed. The brief links the exact-code gates and records their limits.
Final release acceptance remains open.

## Owner tablet result and release disposition — November 20, 2026

The owner tested Chrome on a Galaxy Tab S4 in landscape. Editing is challenging:
the image opens far to the right with excessive space beside the properties
panel, zoom does not centre in the usable workspace, button zoom is the only
usable method, and touch panning feels impractical. This is an observed mobile
usability defect, not a tablet pass. The exact page/media and browser viewport
are not yet identified.

The owner states that PC usability remains the focus and these tablet/phone
usability limits are **not a release disqualifier**. This closes their release
blocking status in that accepted scope; it does not close UI-6/UI-8 or waive PC
accessibility, security, data integrity and performance. The
[editor viewport/touch brief](EDITOR_VIEWPORT_TOUCH_BEHAVIOUR_BRIEF.md) was approved:
“Approve the follow-up brief”. Its implemented repair passes eight 8080 browser
cases across image, slide and both PDF orientations, with saved revisions/content
unchanged. Real touch input covers pan/pinch and subsequent one-finger editing
with Undo/Redo; desktop wheel/Space-drag and resize anchoring also pass. Initial
geometry regressions fail against the prior code. Source quality/asset and size
guards pass; the brief records the retained full-Jest result and corrected fixture
replay. This is bounded emulation/native evidence, with owner device recheck and
final artifact qualification separate. Physical phone results are not claimed.

The reviewed `69f0d828` package is also installed on 1.44.6: all 2,968 files and
executable modes match, its desktop/tablet navigation checks pass, and all fifteen
original content-table witnesses/uploads remain unchanged. No other service is
changed. Exact-code CI passes all three workflows, including 338 suites / 19,263
JavaScript tests. Additional 8080 checks cover cancellation of a live layer-drag
preview and panning from blank portrait-PDF workspace without history/content
changes. These qualify the repair's recorded scope; owner device recheck remains
follow-up under the explicit nonblocking disposition.

## Owner confirmation and device testing — November 20, 2026

After the complete-PDF restore repair, the owner confirms that restoration works
well and performance feels good on the maintained 8080 wiki. The owner also
reports that printing works. This advances HIST-3/HIST-4, TYPES-4, UI-10 and PERF
within those reported journeys; it does not waive the reference performance
budgets or establish screen-reader and physical-device acceptance.

The owner approved private-LAN access to the existing primary wiki for phone and
tablet testing. Both localhost and the LAN origin pass reader/editor checks;
seven checked owning pages retain their exact revisions and slot hashes. This
is development-environment configuration, not an extension runtime requirement.
Physical phone/tablet and keyboard/screen-reader results remain pending.

## Installed successor compatibility — November 20, 2026

The clean reviewed application package at `1335bf0e` is installed on the existing
MediaWiki 1.44.6 compatibility wiki. All 2,964 files and executable modes match
the archive, with the existing private-path HTTP guard preserved. The native
release selection passes **258 tests / 2,126 assertions** on PHP 8.3.33 / MySQL.
Its original nine pages, sixteen revisions, fifteen table witnesses and retained
upload checksums are unchanged; teardown leaves zero isolated test tables.
Service mounts, ports, environment and restart policy are preserved, and the
primary and other version/database services are unchanged by this installation.

The first native invocation omitted the documented MySQL normal-test-table flag
and completed 258 tests / 1,576 assertions with 32 errors from core's temporary
table reopening limitation. The corrected command uses `PHPUNIT_USE_NORMAL_TABLES=1`
and the standard teardown extension; no runtime correction or weakened assertion
was used. A read-only browser check confirms the saved reader pixel and a ready
editor with no console errors. Its first observer looked for the original image
after the viewer replaced it; selecting the rendered host completes the check.
These results advance HIST, DATA and OPS-2/OPS-3 in this recorded compatibility
scope, without claiming full physical-device or final release acceptance.

## Reader budget remains open — November 20, 2026

The unchanged benchmark records five installed-1.44 observations of 315.1–328.8 ms
against the 300 ms target. Primary-1.45 fresh-browser observations take 8.7–9.5 s
with object caching disabled and source on the shared development mount. A plain
page without Layers module/read requests also spends 6.0 s in MediaWiki startup.
The [complete performance record](PAGE_HISTORY_PERFORMANCE.md) retains all
samples, earlier failed observers and reference limitations. Identity, pixel and
request/error checks pass; performance assertions fail. Positive owner feedback
does not erase these measurements. Reference qualification/disposition remains a
release gate; no cache setting, runtime behavior or threshold is changed here.

## Owner editing and whole-PDF restore checkpoint — November 19, 2026

The owner approved the gradient presentation and reports no further issues in
basic editor testing. Multi-page PDF editing, Save, annotated Download, history
viewing and native rollback also pass in the owner's reported 8080 testing.
These are scoped owner observations, not final stable-release acceptance.

That testing exposed a missing Restore action after rollback removed newly
annotated PDF members. The owner approved the
[complete-set restore correction](PDF_HISTORY_RESTORE_BEHAVIOUR_BRIEF.md).
The native planner/form selection passes 14 tests / 131 assertions; five
regressions fail against the prior planner. A permanent isolated 8080 browser
journey restores all members in exactly one revision, preserves later unrelated
work, reopens the viewer and downloads a byte-identical annotated PDF. It also
checks redundant/anonymous actions and restores its exact fixture baseline.
The owner's page is inspected read-only; its rollback remains current and the
historical Restore action is now present. Exact-commit hosted results accompany
the implementation checkpoint; the remaining release gates below stay open.

## Published v1.8rc1 checkpoint — November 8, 2026

The owner-authorized testing prerelease [v1.8rc1](https://github.com/slickdexic/Layers/releases/tag/v1.8rc1)
was published from `cfdf8f2bd31b1d9616871e769317b52c64aba0bd` (manifest
`1.8.0-rc.1`). Publication was November 7 locally / November 8 UTC.
[CI](https://github.com/slickdexic/Layers/actions/runs/42446168558),
[native MediaWiki](https://github.com/slickdexic/Layers/actions/runs/42446168520),
[browser tests](https://github.com/slickdexic/Layers/actions/runs/42446168517),
[lint/style](https://github.com/slickdexic/Layers/actions/runs/42446168555) and
[release wiki sync](https://github.com/slickdexic/Layers/actions/runs/42446565479)
passed. The downloaded package and checksum were verified; the maintained 1.44.6
wiki runs its 2,941 verified files with content/uploads preserved.

Migration and search cleanup must finish before readers regain access.
The 59-test search/migration group passed on 1.44.6 and 1.45.3. Public unmigrated
legacy operation and arbitrary search backends are outside qualification.
Final stable acceptance still includes reference performance disposition and
applicable physical-device, accessibility and Print checks. RC publication does
not waive those checks. Later main documentation/help corrections are Unreleased.

**Reading the dated records below:** internal rc.1–rc.3 labels were local test
builds. Statements that publication, exact-release CI or installed rc.3
replacement were pending describe those earlier checkpoints and are superseded
by this result. Their failures, test scopes and limits remain evidence.

## Owner performance feedback — November 7, 2026

The owner reports fast normal page loads, no remaining observation of the earlier
performance problems, and slow Ctrl-Shift-R loads on both Layers pages and plain
pages such as the main page. Record normal-use responsiveness as satisfactory
in this reported scope. The report does not specify the exact port/artifact,
browser/device or timings; it is not a blanket performance-budget waiver.

The forced-reload symptom is not established as Layers-specific. Keep it separate
from the retained rc.1 PERF-2 miss (312.4 ms after image load versus 300 ms,
fresh browser cache/warm server). Remaining work is bounded baseline attribution
and reference-measurement disposition, not an assumed continuing editor slowdown.
See [performance evidence](PAGE_HISTORY_PERFORMANCE.md) and the current audit.

## Installed rc.3 result — November 7, 2026

`de7fce5a1cf049c143f883a8705f565bdd47aa85` is installed on the maintained
1.44.6 wiki at 8082. The search/migration selection passes **59 tests / 531
assertions**; matching affected source passes **59 / 543** on 1.45.3. All 2,939
packaged hashes match the installed image. PHP style, version consistency,
compatibility/class-reference/registration checks, Import JS/CSS lint and its
18 affected UI tests pass. Earlier broader rc.1 results are retained for
unchanged source; this is not a new full-suite or browser-publication claim.

Eight content-table witnesses, all nine pages/sixteen revisions and all uploads
remain unchanged; test teardown leaves zero test tables. Service mounts, ports,
environment and restart policy match the original installation. A harmless
canary gets HTTP 403 and is removed; the separate editor and page-owned editor
ResourceLoader modules serve rc.3 and the approved Import guidance. An initial
probe looked for guidance in the base editor module; the correct separate module
passes. No runtime correction was needed for that probe.

Download SHA-256: `6d49ccb42bbb7e8108875522c736077bbaf744c01bf0811009a21e79198b8917`.
Local evidence: `F:/Docker/mediawiki/testing/mw144/exports/v1.8.0-rc.3-build/`.
The [approved migrated boundary](RELEASE_1_8_MIGRATED_SEARCH_BOUNDARY.md) and
mandatory upgrade cleanup apply. The original search blocker has a qualified
repair within this tested native-database scope. Public legacy operation,
other backends and a live-site cutover are not certified. Performance/manual/
owner acceptance and exact-commit hosted CI still prevent a final release.
No public push or production tag was made.

## 1.44 search compatibility correction — November 7, 2026

Rc.2 (`1f2eba885494be2cbc3be7dddba2a3aa3269deca`) failed its installed 1.44
search selection: 59 tests / 283 assertions, 10 errors and 15 failures. The
search ingress required a listener interface/event introduced after 1.44;
automatic layer-text indexing was not dispatched there. Public-search tests
also inherited the private test wiki's read denial. No failure is waived.

Rc.3 registers both core revision-event names with one guarded indexing path,
without requiring the version-specific listener interface. The affected tests
explicitly configure their public-read scenario; the private-read denial case
remains. The corrected 1.45 selection passes 59 tests / 543 assertions; PHP
style passes. Rc.3 installed 1.44 qualification is recorded in its build receipt
after installation. No live wiki permissions were changed by test setup.

## Post-migration search correction — November 7, 2026

Local source now stops legacy recovery rows supplying post-migration search and
cleans stale entries even after all Layers associations disappear. Two native
regressions failed before correction. The final affected 1.45 selection passes
59 tests / 544 assertions, including native search page/API results and counts,
rerun safety, recovery preservation, source suppression/restoration and cleanup
failure handling. PHP style passes. Upload fixture isolation failures encountered
in two older tests were corrected with the existing temporary repository helper.

**Installed-candidate privacy acceptance remains open.** The owner approved the
[migrated-only release boundary](RELEASE_1_8_MIGRATED_SEARCH_BOUNDARY.md);
unmigrated legacy search retains its known gap. The upgrade runbook and additional
PDF/slide/stale-property/delayed-write checks are complete. Installed 1.44
qualification and exact artifact identity are still required.
No ordinary wiki content, live index cleanup or installed rc.1 package changed.

## Testing candidate delivered — November 7, 2026

The owner requested lead takeover and delivery of a testing candidate.
**1.8.0-rc.1 is installed on the maintained MediaWiki 1.44.6 wiki at port 8082.**
Source commit `fadc14d05dd026379684bd369e34ac057410ae5e`, local branch
`codex/v1.8.0-rc.1`, is based on public `5d13e58` using an explicit selection
and separate index. The active working branch/index and unrelated work remain
intact. No public push, final tag or production release was performed.

The tar package contains 2,936 files, each verified in the built and installed
image. Tar SHA-256: `525129af30df04a0c92402f985580b66f100855df150ae127d170b059dfc7428`.
The local build receipt also records the compressed-download checksum. Existing
mounts, ports, environment and restart policy were compared before/after;
the combined Compose override keeps the installed-image arrangement. No other
version service was replaced. All eight witnessed main/file page revision IDs
and hashes remain unchanged; native teardown left zero `unittest_` tables.

| Check | Fresh result | Boundary |
| --- | --- | --- |
| JavaScript and coverage | 19,097 tests, 328 suites pass; statements 94.44%, branches 87.74%, functions 95.26%, lines 95.45% | Selected candidate runtime/test bytes match the tested working files. |
| Standalone PHP | 1,712 tests / 4,238 assertions; one existing skip | Separate from native core integration. |
| 1.45 native selection | 232 tests / 1,836 assertions pass | Maintained 1.45.3 / PHP 8.3.31, temporary test tables. |
| Installed 1.44 native selection | 232 tests / 1,818 assertions pass | Actual installed candidate, 1.44.6 / PHP 8.3.33. Default temporary tables hit MySQL UNION errors; documented normal `unittest_` tables passed after core isolation was verified. |
| Affected search/link native checks | 44 tests / 371 assertions pass on 1.45 | Not full legacy confidentiality qualification or a 1.44 search-suite pass. |
| Installed browser checks | Both images, slide and PDF page 2/2 render in ready full-size viewers; image/PDF/slide editors load saved layers; no page errors | Authenticated read-only checks, no Save; screenshots and result JSON outside the repository. Initial probes captured loading states and were corrected to wait for actual content. |
| Reader paint benchmark | Fails the 300 ms gate: sample 4 was 312.4 ms | Existing authenticated, fresh-browser/warm-server benchmark on the installed 1.44 lane; no retry to hide the miss. Full production reference acceptance remains open. |
| Release/static/dependency checks | 11 release tests, two growth-guard tests, 44 changed PHP files' style, version/docs, bundles, assets and class references pass; production npm audit reports zero vulnerabilities | Loopback fixture access and Node system CA configuration resolved environment failures without weakening verification. Hosted exact-commit CI remains open. |

Use [candidate testing](V1_8_CANDIDATE_TESTING.md). This delivers the requested
testing candidate; it does not complete the production gate. Legacy stale-search
privacy, broader permission/backend/upgrade cleanup, the measured performance
miss and manual/device/owner acceptance remain open. Keep test content
non-sensitive. Changes after this freeze require a new candidate identity.

---

**Owner scope decision: October 25, 2026.** Page ownership and native revision
history will ship independently, with **1.8** as the working version. The
[charter's independent release gate](PROJECT_CHARTER.md#32-independent-page-history-release)
is authoritative. Final version/tag assignment follows acceptance; the manifest
remains unchanged by this document.

**November 6 lead closeout review:** Use the
[release critical path](RELEASE_1_8_CRITICAL_PATH.md) for remaining assignments.
The owner's page-revision access clarification means source-suppressed text in
an independently readable Layers slot is not itself confidential page data.
The owner **approved option A on November 6** in the
[search decision brief](RELEASE_1_8_SEARCH_DECISION.md). Page-owned search follows
page/revision access; its former file-source discovery requirement is superseded.
Legacy shared rows and restricted owning pages retain independent privacy
qualification. R1a–R1c in the critical path specify the remaining tests.
No release gate is waived, no search feature is paused and no runtime changes
are made by this review. Native CI selection now includes 18 files; its reported
232 / 1,836 pass is on 1.45, with exact-public-candidate 1.44 verification pending.

**November 6 approved-A verification:** a fresh, separate
`PageOwnedSearchPolicyTest` run on maintained 1.45.3 / PHP 8.3.31 passes
**3 tests / 65 assertions** (including core teardown). Active list/generator
search retains page-owned terms through archived-image suppression/restoration;
the image resolver refuses the suppressed source. Native old-page-revision
suppression protects anonymous slot reads, authorized review remains available,
obsolete terms are absent from current search, and both API search modes refuse
a reader without wiki read permission. Default temporary `unittest_` tables and
temporary fixture media were used; ordinary wiki content/settings and runtime
code were unchanged. This count is not added to the earlier CI selection count.
R1 remains open for PDF, Special:Search, page-specific permissions, owner
deletion/restore, active legacy confidentiality and installed 1.44. See the
critical path for the exact remaining assignments and initial fixture failures.

**November 5 audit follow-up (historical; page-owned search policy amended above):** Release qualification remains open for the
search/source visibility investigation, exact-candidate native and browser
coverage, common reader latency and final artifact identity. A local native
probe confirms that after suppressing a synthetic image and running the Layers
deletion hook, search still matches its layer-text marker and regenerates a
snippet. This does not demonstrate a disclosure of real private data. The
then-approved visibility policy required source-dependent index invalidation;
that requirement now applies to legacy shared sets, not readable page-owned
text. The PR growth check has a locally verified repair,
but its exact-candidate and remote workflow checks remain pending. See the
[handoff](IMPLEMENTATION_HANDOFF_PLAN.md#updated-audit-follow-up--november-5-2026)
and [growth policy](CODE_GROWTH_POLICY.md).

The maintenance search reindexer also has a local, native-tested correction for
stale terms when a still-associated page has an empty layer-text projection.
Discovery of pages that lost all associations and bounded-memory qualification
remain open; no ordinary wiki reindex was run.

**November 4 candidate:** Public commit `18f0ed7` adds coverage enforcement,
reader-module size budgets, an inline-control permission regression and
current activation comments. Local full coverage passed 19,087 tests; exact
candidate [full CI](https://github.com/slickdexic/Layers/actions/runs/41954669366),
[native CI](https://github.com/slickdexic/Layers/actions/runs/41954669232) and
[browser CI](https://github.com/slickdexic/Layers/actions/runs/41954669209)
passed. The 1.44 installation then used `1181894`; the later update is below.
No release or final-candidate acceptance is implied.

**Reader check follow-up:** Public candidate `1b84ac0` adds the reader API
suite to native CI; its 1.44 run passed 141 tests / 1,073 assertions, and its
full and browser CI also passed. The later
candidate `1b44dca` also guards the reader's transitive Layers dependencies.
Its four focused guard tests and copied-source failure controls passed locally;
its [full CI](https://github.com/slickdexic/Layers/actions/runs/41959960070),
[native CI](https://github.com/slickdexic/Layers/actions/runs/41959960056) and
[browser CI](https://github.com/slickdexic/Layers/actions/runs/41959960061)
passed.

**PDF group calculation:** Candidate `6339130` avoids re-encoding unrelated
layer payloads when identifying a PDF group. The local 1.45 affected native
suite passed 87 tests / 724 assertions, and 11 identity cases passed before and
after the change. Synthetic timing shows less calculation work, not a measured
page-load improvement. The expanded [1.44 native CI](https://github.com/slickdexic/Layers/actions/runs/41961943078)
passed 207 tests / 1,706 assertions; [full CI](https://github.com/slickdexic/Layers/actions/runs/41961943125)
and [browser CI](https://github.com/slickdexic/Layers/actions/runs/41961943131)
also passed. The verified 2,902-file candidate was installed on the existing 1.44
test wiki, with the same service configuration and other services unchanged.
Read-only browser checks opened and closed an image, slide and PDF page 2 at the
expected identities with no owner-content changes. This is not full acceptance.

**Changed layer sets in history:** Owner-approved candidate `5d13e58` limits
history View links to sets added or changed in each revision, grouping PDF
pages by their file and layer-set identity. The affected 1.45 native history
suite passed 13 tests / 47 assertions; the 1.44 native CI passed 220 tests /
1,753 assertions. Exact-candidate [full CI](https://github.com/slickdexic/Layers/actions/runs/41964224556),
[native CI](https://github.com/slickdexic/Layers/actions/runs/41964224555) and
[browser CI](https://github.com/slickdexic/Layers/actions/runs/41964224548)
passed. On 8080, the owner's example revision now shows only `View Layers: 005`.
The verified 2,903-file candidate is installed on the existing 1.44 wiki; a
read-only history comparison passed for both revisions of its test page. An
initial browser observer incorrectly counted nested revision links as rows; the
corrected row-only check passed. No wiki content was changed by these checks.
The owner subsequently confirmed the changed-set history presentation and one
Undo/restore journey on 8080. This is one owner-tested journey, not complete
Milestone 1 acceptance.

This is the release closeout ledger, consolidating existing requirements and
retained evidence. It introduces no new feature or quality target. Runtime
baseline: reviewed code at `b04679d`, with passing exact-commit CI. The
[page-history evidence map](PAGE_HISTORY_RELEASE_EVIDENCE.md) records the exact
backend/editor reuse boundary from `62f7ba1`; later viewer changes have their own
acceptance. The current candidate also includes the
[post-migration rename/copy output correction](PILOT_DATA_REVIEW.md), qualified
separately from that dated byte-comparison baseline. Documentation commits may
follow without invalidating unchanged runtime evidence.

**Recorded pass** means the linked journey passed in its recorded environment,
not every possible version/device combination. **Partial** means some required
evidence is present. **Pending** means a release action or owner decision remains.
Missing evidence alone does not establish a production defect. Reuse accepted
results; run only missing or affected checks and keep original failures.

**Current candidate update:** Public commit `ab76060` passed exact-commit CI
after the approved revision-check bar. The subsequently approved quiet slide
loading change is published as `04665a3` with [passing exact-commit CI](https://github.com/slickdexic/Layers/actions/runs/40613892452). On the 1.45 test page, delayed loading,
successful rendering, a failed read and disabled JavaScript were checked in a
browser. The full client suite passed 19,028 tests in 319 suites; standalone
PHP passed 1,675 tests with one existing skip. A native 1.44 parser run using
the changed source passed 5 tests and 77 assertions in isolated test tables.
At that checkpoint the installed 1.44 candidate had not yet been updated; the
later installed-candidate result is recorded below.

**Save notification follow-up:** The owner approved making the existing synchronous, asynchronous and validation Save errors visible above the editor without retrying or losing work. Affected Save, validation, draft, API and history tests passed 1,557 cases. Read-only synthetic browser checks confirmed each notification is visible and work is retained. The earlier intermittent slide report remains unexplained. Public candidate `0af5550` passed [full CI](https://github.com/slickdexic/Layers/actions/runs/40976599621), [browser CI](https://github.com/slickdexic/Layers/actions/runs/40976599790) and [expanded 1.44 native CI](https://github.com/slickdexic/Layers/actions/runs/40976599884) with 120 tests / 1,000 assertions. Public candidate `1181894` includes the validation visibility correction. Its [1.44 native CI](https://github.com/slickdexic/Layers/actions/runs/41008034304), [browser CI](https://github.com/slickdexic/Layers/actions/runs/41008034438) and [full CI](https://github.com/slickdexic/Layers/actions/runs/41008034382) passed. All 2,900 public package files were verified in the prepared test image, which was installed on the existing 1.44 wiki with its service configuration and other services unchanged. Read-only browser checks opened and closed an image, slide and PDF page 2 at the expected owner, revision and layer identities; owner content stayed exact. A synthetic validation failure in the installed editor displayed the message above the editor and retained work, with no wiki writes. This is bounded desktop verification, not full release acceptance.

**Installed 1.44 candidate:** `29afad087d95fb2fd5509aa823c0c5a44147c403` passed [full CI](https://github.com/slickdexic/Layers/actions/runs/40972936151), [native 1.44 CI](https://github.com/slickdexic/Layers/actions/runs/40972936149) and [browser CI](https://github.com/slickdexic/Layers/actions/runs/40972936139). Native CI passed 86 tests / 400 assertions with no skips. Its 2,895 public files were verified in the package and test image; the existing 1.44 wiki on 8082 then ran that image with unchanged service configuration and the other test services unchanged. A direct installed-renderer CLI probe was refused by the existing isolated-wiki settings guard; no bypass was attempted. The independent 1.45 native group and 1.44 CI cover the correction. A read-only installed 1.44 browser check opened one image, slide and PDF editor at their expected owner, revision and saved layers; the PDF selected page 2, all three closed back to the owner, and the witnessed pages stayed exact. This is one desktop opening per type, not comprehensive device acceptance. The owner confirmed the synthetic grayscale comparison; broader release acceptance remains pending.

**Grayscale PDF export correction:** The owner approved preserving imported-image color over a grayscale base in server PDF output. Three synthetic cases failed before the local fix and passed after it; the affected 1.45 rendering/privacy group passed 37 tests / 260 assertions, including grayscale and color backgrounds, opacity, large rotation and PDF conversion. Exact-commit CI and installation passed; the owner confirmed the synthetic grayscale comparison. Broader release acceptance remains pending.

**Large rotated image follow-up:** A synthetic 10,000 × 10,000 rotated image failed with the 1.45 test wiki's conversion limits. Public candidate `58827e3ff355296cf69d6a0a24461d8c3ff8606e` renders oversized rotated layers into the visible viewport; the affected 1.45 renderer/privacy group passed 32 tests / 227 assertions, and the unrotated RGB probe passed. Its [full CI](https://github.com/slickdexic/Layers/actions/runs/40971152333), [native 1.44](https://github.com/slickdexic/Layers/actions/runs/40971152083), and [browser CI](https://github.com/slickdexic/Layers/actions/runs/40971152140) passed. The verified 2,894-file candidate was installed on the existing 1.44 wiki at that checkpoint. Its read-only reader recheck preserved identity and pixels but missed the 300 ms target in three of five samples; other installed-candidate and owner acceptance remain pending.

**Earlier verified candidate:** Public commit `bc971cfc018b0fe619610d196e05facf506b19b5` passed [full CI](https://github.com/slickdexic/Layers/actions/runs/40941897001), [native 1.44 tests](https://github.com/slickdexic/Layers/actions/runs/40941896936) and [browser CI](https://github.com/slickdexic/Layers/actions/runs/40941896995). The 1.45 native renderer/privacy group passed 26 tests / 195 assertions, including the rotated-shadow correction. Its 2,894-file public archive matches the commit. The 1.44 wiki still has the earlier installed build; the new candidate is not a released 1.8 package.

**Previous October 29 candidate:** Public commit `43d10d7691ea487f18055f9b1f1174af67a86c12` passed [full CI](https://github.com/slickdexic/Layers/actions/runs/40922719436), [native 1.44 tests](https://github.com/slickdexic/Layers/actions/runs/40922719502) and the repaired [browser workflow](https://github.com/slickdexic/Layers/actions/runs/40922719429). The complete client suite passed 19,080 tests. The package was verified against all 2,894 committed files. It includes the approved legacy recovery and server rotation corrections; real pre-migration editor and owner acceptance remain open. The later installed-candidate update is recorded above. The subsequent rotated-shadow correction is recorded above. The candidate is not a 1.8 release.

**Earlier installed candidate:** Public commit `0fd1a2466c618504ed8eda0577c6715b4fa05a53`
passed both [main CI](https://github.com/slickdexic/Layers/actions/runs/40809337232)
and [native 1.44 SQLite CI](https://github.com/slickdexic/Layers/actions/runs/40809337201).
The main run passed 19,067 client tests and 1,697 standalone PHP tests with one
existing skip; the native job passed 47 tests / 132 assertions. An independently
verified 2,883-file package from that commit was installed on the maintained
1.44 test wiki and has since been replaced; the version is still the pre-release manifest version, not 1.8.

**Package correction:** The earlier candidate archive included tracked historical
test-evidence ZIPs with screenshots and logs. The earlier claim that the archive
contained no captures or logs was wrong. Their presence does not establish that
they contain private information; review their public-history exposure and exclude
them from the release package. The current public candidate tree removes those
files while their local copies and public Git history remain. Verify final source
archives as well as the custom package. See [release preparation](RELEASE_PREPARATION.md).

**New review findings:** A strict MySQL temporary-table test confirms that the
legacy foreign-file fallback exceeds its 32-character storage column. A local
schema correction passed a focused native MySQL test. On the maintained 1.44
wiki, a read-only schema check subsequently found `VARBINARY(32)`, which the
first correction failed to recognize. The corrected updater preserves the
existing `VARBINARY` or `VARCHAR` type while widening it; both cases pass on
native temporary tables, and the binary case failed before the fix. The actual
wiki updater ran successfully twice on the maintained 1.44 / MySQL test wiki,
widening the actual column to `VARBINARY(48)`. Hashes for 24 content tables
remained unchanged, and no-Save image, slide and PDF editor journeys passed
afterward. This is an already-migrated test wiki, not a fresh migration or
cross-version qualification. The editor
can alter some literal layer text before publication; native strict validation
also refuses other text that server sanitization would change. An approved local
literal-text correction has passed focused editor, publication and export tests;
its broader compatibility, output-context and screen acceptance remain open.
See [Gemini review triage](GEMINI_REVIEW_TRIAGE.md).

**Affected native checks, October 28:** On MediaWiki 1.44, the combined
publication, migration and identifier-upgrade slice ran 80 tests / 812
assertions with one historical-reader error. That error reproduced with the
installed baseline: the test assumed anonymous read access without enabling it.
The corrected fixture explicitly enables anonymous reading for that case and
passes its isolated replay (1 test / 12 assertions). The full combined slice
subsequently passed 80 tests / 819 assertions on 1.44 / MySQL using the
installed candidate, the corrected test fixture and the selected current
reader, validator and schema-manager files preloaded. A first follow-up ran
all 80 tests but had three errors because its temporary test directory lacked
adoption fixtures; after adding those public fixtures, the full rerun passed.
This is not a final installed-release artifact or full updater qualification.
Separately, the native
literal-text publication/history test passes (2 tests / 7 assertions); legacy
conversion and affected standalone PHP tests pass (193 tests / 447 assertions).
These results do not establish full updater, browser or owner acceptance.

**Owner-reported slide Save failure:** On the 1.45 test wiki the owner added
arrows to a slide; the Save button appeared unresponsive and the work remained
unsaved. After reopening, Ctrl+S and the on-screen Save button each saved an
arrow in a new revision. The initial failure is not yet explained and remains
open. In a separate
1.44 browser session, the same saved slide snapshot and an added arrow reached
an intercepted Save request. Nearly full browser storage also reproduced a
pre-request refusal with draft-storage notifications, but has not been shown
to be the cause in the owner's session. Do not declare release acceptance on
the strength of the later successful attempt alone.

**Large-image Save failure and candidate correction:** A later owner test
confirmed that an image's Undo backup exceeded browser storage quota. The
candidate losslessly compacts repeated data only when a normal draft write is
refused for quota, leaving existing records intact. A synthetic browser test
reproduced the refusal and exercised the in-session correction without wiki
writes; the owner then applied it to the open editor and confirmed Save. A
read-only check verified the resulting page revision contains the changed layer
set. Full client tests passed 19,050 tests; broader browser/recovery acceptance
and the earlier intermittent slide failure remain open.

**Large-draft recovery follow-up:** A fresh client-side store and controller,
with a new writer identity, discover and decode the previous session's compact
backup without changing any stored records. An isolated browser check on the
installed 1.44 candidate simulated a quota refusal, wrote a compact draft with
two image layers, and restored both in a second editor session. Undo and Redo
recovered the expected one- and two-image states. Publication requests were
blocked and the saved revision remained unchanged. This is a simulated quota
refusal in a fresh browser context, not an operating-system restart or a claim
about every browser's actual storage limit.

**Text selection correction:** The owner reported and approved correcting a
plain-text selection box that wrapped its measurement while rendering one
line. The affected layer's browser measurement now matches the rendered width;
the editor view, including rotation, was shown and the owner confirmed it
looked good. The full client suite passed 19,052 tests in 325 suites. This
does not qualify the remaining release gates.

**Reader efficiency correction:** Selected file sources are now resolved in one
snapshot pass, with per-surface authorization and failure isolation retained.
Affected 1.44 native reader and source-refusal tests passed 31 tests / 187
assertions; standalone PHP passed 1,697 tests / 4,217 assertions with one skip.
This is a bounded reduction in repeated work; representative timing and the
remaining reader performance checks are still open.

**Native CI candidate:** A new workflow provisions MediaWiki 1.44 and a
disposable SQLite wiki to run selected native history-access, publication and
batched-read tests. Its exact test selection passed locally on 1.44 / MySQL:
47 tests / 132 assertions, with the current reader files preloaded into the
installed test candidate. The later `0fd1a246` candidate passed the same
selection on GitHub's MediaWiki 1.44 / SQLite workflow, as linked above.

**Shipped dependency check:** A synthetic local advisory now verifies that the
real production `npm audit` command rejects a high-severity finding for the
shipped PDF library, while a clean response passes. All eight release-package
tests and the 225-reference shipped-asset check pass. A fresh production audit
found zero vulnerabilities after using the system certificate store; its first
attempt failed certificate verification. Recheck at the release cut.

**Concurrent PDF cache check:** Two independent PHP processes exercised the
actual cache publication helper against the same temporary target. Controlled
overlapping partial renders stayed private; a failed render did not replace a
completed result, and overlapping successes exposed only completed test bytes.
Both checks passed on Windows and in the existing 1.44 Linux test environment;
the ten release-package tests passed on Windows. This does not establish
real-converter concurrency stress, full PDF validity or browser export
acceptance.

**Creation tool presets:** The owner approved clearing the previous selection
when choosing a creation tool. A 1.44 test-editor session using the current
toolbar source selected an Arrow preset after a text selection; the text and
existing Undo history stayed unchanged, and a new arrow used the selected
non-default preset. The new arrow remained selected for editing. Owner screen
review and final-artifact/browser qualification remain open. Keyboard selection
of Rectangle also cleared a multi-selection in that test session. The full
client suite passed 19,067 tests across 325 suites; the editor bundle remains
within its existing size limit.

**Earlier public candidate reconciliation:** The public branch and the remote both
pointed to `4122f6d8` at that check. A preliminary comparison of 41 selected
audit/editor source and test files against that branch found 21 changed, 18
new and two unchanged files. It compares actual working-file Git hashes, not
the private checkout's index: some files present and Git-blob-equivalent to the
public branch appear as deletions in an ordinary cross-branch working-tree
diff. This is a scoped inventory, not a complete publication list or privacy
review. Final dependency, documentation, artifact and exact-commit checks remain.

| Check | Current evidence/state | Work before the 1.8 release |
| --- | --- | --- |
| Page ownership, native Save/history/diff/restore and owner isolation | **Recorded passes:** [1.44 native journeys](MEDIAWIKI_144_NATIVE_ACCEPTANCE.md), [whole-PDF Import](PDF_IMPORT_NATIVE_ACCEPTANCE.md) and retained image/slide journeys. The [candidate evidence map](PAGE_HISTORY_RELEASE_EVIDENCE.md) ties retained results to current source: four existing ordinary edits on 1.45 match recent changes/contributions; eight migration revisions on 1.44 match those feeds, with six watchlist matches. | Complete remaining intended-wiki HIST scenarios and applicable notification acceptance. The watchlist check covers migration revisions; Echo is absent on that wiki and no notification delivery is claimed. Close only missing or affected checks. |
| Import, first-Save attribution, recovery and refusal preservation | **Recorded passes:** whole-PDF Import/Undo/Redo, saved handoff, complete recovery, stale Save, reconciliation and lost-success-reply handling. | Reuse the recorded desktop and narrow-layout results; reconcile only missing supported-version/device combinations. |
| Upgrade and recovery | **Recorded passes:** [1.5.95/MySQL rehearsal and current-candidate migration check](UPGRADING.md#current-candidate-migration-check--october-25-2026), fresh 1.44 installation, and [intended-wiki data/application read restoration](INTENDED_WIKI_RECOVERY_CHECKPOINT.md#application-level-restore--october-26-2026) on 1.45.3. Restored native/HTTP image, slide and PDF reads pass with all 66 persistent-table witnesses and 7,832 retained uploads unchanged. Temporary services were removed. Migration sources match the retained fresh rehearsal; the current rerun adds zero revisions. | Reconcile the retained upgrade/recovery with the final release artifact and review earlier pilot data without relabeling or repair. Operators still preserve their own matching private configuration/software before cutover; reconstructed test settings do not constitute that backup. A new fresh database transition or exhaustive restored-site/browser check was not claimed. |
| Viewer, Download and Print | **Recorded passes:** owner testing passes multi-page PDF Save, annotated Download and printing on 8080. Inspected exports, exact historical-source viewing, and [complete 1.44 PDF Download/native Print preparation](MEDIAWIKI_144_NATIVE_ACCEPTANCE.md#complete-pdf-download-and-native-print-preparation--october-25-2026) retain their bounded evidence. Both pages retain saved layers; Print and Download composites match byte for byte. | Owner printing passes in the reported scope; physical paper/pagination and every device/export combination are not independently claimed. Retain earlier observer failures without repeating that stalled loop. |
| Supported UI, touch and accessibility | **Bounded passes / accepted mobile limit:** existing viewer/bar evidence is retained. The approved [viewport/touch repair](EDITOR_VIEWPORT_TOUCH_BEHAVIOUR_BRIEF.md) passes eight 8080 image/slide/PDF journeys, two navigation-boundary checks and installed-1.44 desktop/tablet checks. The owner accepts reported mobile usability limitations as nonblocking for PC-focused 1.8. | Finish manual PC accessibility acceptance. Retain physical-device recheck and mobile usability work as follow-up; emulation is not hardware sign-off. Phone editing is not required. |
| Security, privacy and data integrity | **Recorded engineering review:** [HTTP roles/visibility/lifecycle and native Save admission](MILESTONE_1_HTTP_PRIVACY_ACCEPTANCE.md); the [successor review](PAGE_HISTORY_SECURITY_REVIEW.md) reconciles subsequent gradient, recovery/Save and PDF restore changes. Composer and production npm audits are clear; 16 moderate development-tool package entries remain documented. No open high/critical finding is identified in the reviewed scope. | Recheck dated dependency results and final source/artifact consistency at the cut. Reopen affected checks after changes and fix/retest release-blocking findings. No open high/critical finding or known data-loss defect may ship; this is not independent penetration-test or owner acceptance. |
| Performance | **Recorded passes / reader misses retained:** existing server Save/history, asset and editor-entry observations remain valid in their recorded scopes, and owner feedback is positive. The [successor reader checks](PAGE_HISTORY_PERFORMANCE.md) record 315.1–328.8 ms on installed 1.44 against 300 ms. Primary shared-mount/cache-disabled fresh-browser visits take 8.7–9.5 s; its plain page also spends 6.0 s in startup without Layers requests. | Qualify/dispose of reference-device, cold-server and applicable media limits without changing the target or weakening admission. Different fixtures and development configurations do not establish controlled attribution. Retain every timing and obtain owner disposition of unproved limits. |
| Package and documentation | **Recorded candidate package pass / final cut pending:** the independently verified `1335bf0e` archive contains 2,964 exact public files and is installed on 1.44, with 258 native tests / 2,126 assertions and original data intact. Primary guides, upgrade instructions and [release notes](RELEASE_NOTES_1_8.md) distinguish the working successor from immutable RC1. | Regenerate and verify the exact versioned release artifact after acceptance and version/tag assignment. Keep the [native regression package](NATIVE_REGRESSION_TESTING.md) and [asset/notice inventory](SHIPPED_ASSET_AUDIT.md) intact. Manifest remains 1.8.0-rc.1; no stable release is declared. Private captures, credentials, configuration and database exports stay local. |
| Owner acceptance | **Partial:** normal editing, gradients, multi-page PDF Save/Download, rollback/complete restoration, printing and good responsiveness are confirmed on 8080. Mobile usability limits are explicitly nonblocking for the PC-focused release. | Finish manual PC accessibility and remaining Milestone 1 scenarios on the intended wiki, then record final release-scope acceptance. Retain mobile device recheck as follow-up. Search, Cargo and new links retain their later milestones. |
| Final release cut | **Pending.** | Freeze the reviewed artifact, run required gates and exact-commit CI, confirm version/tag with the owner and publish the independent release. Preserve a consistent upgrade/rollback reference. |

The October 27 [server/filesystem investigation](PAGE_HISTORY_PERFORMANCE.md#server-and-linked-filesystem-investigation--october-27-2026)
rules out a full web OPcache for the measured requests and demonstrates a large
general-debug-logging cost for API reads. Identical-file comparisons also measure
substantial linked-path I/O overhead. Script responses remain slow with general
logging off; neither the USB device alone nor an extension regression is thereby
established as the remaining cause. Original test settings were restored exactly.
These diagnostic results do not establish a 300 ms pass or qualify reference
hardware. The charter already excludes shared mounts from its reference install;
the development result alone must not be described as a proven reference-install
release blocker. Keep environment costs distinct from product defects.

## Scope control

The [read-only pilot review](PILOT_DATA_REVIEW.md) covers 28 current owners and
identifies three retained groups with split PDF names. Their disposition needs
a reference-aware repair proposal and owner review; no automatic rename,
merge or historical rewrite has been performed. This is separate from the
current writer correction and the qualified fresh upgrade path.

The pilot review's separate ten-member comparison now establishes equality to
earliest saved surfaces and strict retained-row conversion, with exact source
versions available. A reference-aware repair proposal and owner disposition
remain. The [candidate security review](PAGE_HISTORY_SECURITY_REVIEW.md) records
the demonstrated Import information-quota correction and compatible
development-tool security updates. The full locked npm audit now has zero
known vulnerabilities; the broader application review remains explicit rather
than being marked complete by the earlier HTTP checks or a dependency scan.

Harmless HTTP canaries also exposed the shared checkout's raw log/document
paths. A local [development HTTP guard](DEVELOPMENT_ENVIRONMENTS.md#private-working-material-and-http-access)
now denies those working paths while preserving required assets on both
supported-version ports. No real private artifact was requested or moved.
This is development-server protection, separate from the extension's API
authorization and the clean release package.

The [registered request and revision review](PAGE_HISTORY_SECURITY_REVIEW.md#registered-request-and-native-revision-review)
now accounts for all 23 action APIs and both exact-PDF REST paths. Native metadata
and 54 fresh HTTP refusals verify the nine write routes' method/token boundary
on both maintained versions. Current backend sources match the published
candidate; existing authority, visibility and final-admission evidence is reused
within its recorded scope. No new blocker was demonstrated in that partition.
The subsequent content/output and resource/external-I/O/configuration/logging
pass completes the relevant source-led application review. It corrects literal
text interpretation in server-generated thumbnails/PDFs and versions their
cache keys. The final 1,655-test standalone run passes with one existing skip; six text
argument paths pass native pixel checks. SVG file/relative references refuse
before conversion, while fragment controls and existing renderable library
shapes remain supported. The twelve pre-existing native XML failures are recorded. No unresolved high/critical finding or
demonstrated data-loss defect was identified in the reviewed scope. Final
artifact/dependency reconciliation and owner release acceptance remain.

The [upgrade-path acceptance matrix](UPGRADE_PATH_ACCEPTANCE.md) identifies
1.5.95 as the fully tested starting release. Older released schemas pass native
update/rerun checks, but their full application migrations are not thereby
qualified. `mw-config` or CLI `update` handles schema only; link/job refresh and
the separately reviewed Layers migration remain required.

Milestones 2–5 remain ordered: built-in text search, Cargo readiness, Cargo
integration, then on-page layer-object links. Broader 2.0 improvements outside
Milestone 1 remain later roadmap work. They do not block this independent release;
preservation and security of existing shipped functionality still apply.

Bulk private-evidence archival and unused-code cleanup are separate reviewable
tasks. Keeping the release package free of private/generated material is a release
gate; deleting all local working evidence is not. Preserve recoverable evidence
before any later cleanup.

Only the project owner declares Milestone 1 accepted. This ledger does not claim
that 1.8 is released or that the broader Layers 2.0 finish line has been met.
