# Layers 1.8 release acceptance

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
| Viewer, Download and Print | **Recorded passes:** inspected exports, exact historical-source viewing, and [complete 1.44 PDF Download/native Print preparation](MEDIAWIKI_144_NATIVE_ACCEPTANCE.md#complete-pdf-download-and-native-print-preparation--october-25-2026). Both pages retain saved layers; Print and Download composites match byte for byte. | Obtain the applicable manual Print/export owner acceptance. The headless check does not qualify the operating-system dialog, physical pagination or paper output. Retain earlier observer failures without repeating that stalled loop. |
| Supported UI, touch and accessibility | **Partial:** [phone-viewer panning](PHONE_VIEWER_ACCEPTANCE.md#approved-correction-and-bounded-verification), the owner-approved [bounded toolbar](VIEWER_TOOLBAR_LAYOUT_ACCEPTANCE.md) and [revision-check bar](REVISION_CHECK_BAR.md) pass their recorded browser scopes. The bar retains its action and fits image/slide/PDF editors in tested light/dark desktop, tablet and narrow layouts. | Finish remaining tablet-touch editing, physical-device and manual accessibility acceptance. Browser emulation is not physical-device sign-off. Phone editing is not required. |
| Security, privacy and data integrity | **Recorded engineering review:** [HTTP roles/visibility/lifecycle and native Save admission](MILESTONE_1_HTTP_PRIVACY_ACCEPTANCE.md); the [candidate review](PAGE_HISTORY_SECURITY_REVIEW.md) now covers request/access/admission, validation/output, bounds, I/O, configuration/logging and dependencies. Import quotas, renderer text interpretation and SVG resource lookup are corrected; locked npm and PHP audits are clear at this checkpoint. | Reconcile final source/artifact consistency and recheck dated dependency results at the release cut. Reopen affected checks after changes and fix/retest release-blocking findings. No open high/critical finding or known data-loss defect may ship; this is not independent penetration-test or owner acceptance. |
| Performance | **Recorded installed-desktop passes / reader misses retained:** [asset and editor-entry checks](PAGE_HISTORY_PERFORMANCE.md#installed-asset-and-editor-entry-checks--october-27-2026) measure 102,129 gzip bytes of Layers modules, none on the plain page, and all fifteen warm image/slide/PDF editor openings at 800–930 ms, below three seconds. The latest [installed 1.44 reader recheck](PAGE_HISTORY_PERFORMANCE.md#installed-144-candidate-recheck--large-image-correction) measured 295.1–335.4 ms; three of five visits exceeded the 300 ms target. Earlier observations and withdrawn experiments remain retained. | Investigate the reader misses and applicable cold-server/reference-device/media checks without changing controls or weakening read admission. These are representative desktop observations, not physical-device or blanket PDF acceptance. Source/assets are local; retained private data/configuration storage and reference hardware remain explicit limits. Keep environment costs distinct from product defects and obtain owner disposition of unproved limits. |
| Package and documentation | **Recorded candidate package pass / final cut pending:** the independently verified `5d13e58` archive contains 2,903 exact public files and is installed on the 1.44 wiki. Primary guides, upgrade instructions and [draft release notes](RELEASE_NOTES_1_8.md) are refreshed. | Regenerate and verify the exact versioned release artifact after acceptance and version/tag assignment. Keep the [native regression package](NATIVE_REGRESSION_TESTING.md) and [asset/notice inventory](SHIPPED_ASSET_AUDIT.md) intact. The candidate still reports manifest 1.5.95; it is not a released 1.8 build. Private captures, credentials, configuration and database exports stay local. |
| Owner acceptance | **Pending.** | Complete the Milestone 1 portions of charter scenarios S1–S7 on the intended wiki. Search, Cargo and new link portions belong to their later milestones. Record acceptance of the release scope and remaining disclosed limits. |
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
