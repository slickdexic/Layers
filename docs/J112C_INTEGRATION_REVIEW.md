# J112C — Lead integration review

**Updated October 3, 2026. Advances HIST-4, HIST-7 and TYPES-4, preserving DATA-1/DATA-3.** Lead implementation and J112C2's bounded technical acceptance are complete after review corrections. The [acceptance packet](J112C2_INTEGRATED_ACCEPTANCE_PACKET.md#final-lead-verification-and-owner-review) records the strengthened browser pass and fresh screens. Owner screen approval, J113's migration/naming transition and J111's viewer remain open. The owner retains architecture and larger behavior decisions.

**Later owner terminology finding, October 3:** the lead incorrectly deferred the already approved layer-set wording. [That correction is now implemented](J112C2_INTEGRATED_ACCEPTANCE_PACKET.md#owner-wording-correction--october-3-2026), with both copy screens and the editor header corrected. Full JavaScript/static **15,190 / 208 suites**, affected native **61 / 538**, and serial browser **2 tests / 19 fresh screenshots** pass. Exact owner restorations **2834/2835** and unchanged isolation **230/2740** are independently read back. The current gallery is `tmp/J112C2-owner-review-corrected.html`; earlier 18-screen evidence below is historical. Owner approval is still pending.

## J112C2 lead acceptance — October 3, 2026

Review exposed a pre-existing text-editing defect: Font Size applied unrelated tool defaults, turning supported colored text black. Delegated corrections make `CanvasManager` apply only requested fields and keep `StyleController` from inventing absent font properties. Five new integration cases failed before the fix and pass afterward. A separate delegated correction restricts cleanup receipts to the two authorized owners and validates baseline/history/current state before writes; 26 validator cases pass. These changes preserve existing behavior and add no control, wording, schema or migration.

Full `npm test` passes **15,190 tests / 208 suites**, including lint/static/budget gates. The strengthened browser minimum passes **2 tests in 3.1 minutes / 18 screenshots**. Selected and saved PDF layers preserve every unrelated property; rename/copy and both draft recoveries succeed; stale save retains local work. An independent reviewer audited the final evidence without finding a remaining bounded blocker. Authorized readback verifies all 15 scenario revisions and exact restorations at destination **2819** and source **2820**, with isolation **230/2740 unchanged**. The junior's focused native **98 / 790** and client **142 / 2 suites** are retained as their runs; no PHP changed in this correction, and the full-suite table below remains the October 2 evidence.

The local owner gallery is `tmp/J112C2-owner-review.html`; screen approval is still required by the charter. Broader native/client-only scenarios, permission-denial and legacy-draft browser cases are not claimed as newly exercised. No ordinary content/configuration/migration changes, commit or push.

## Integrated behavior

`LayerSetIdentity` compares file-or-slide scope, normalized set name and, when selecting an internal surface, PDF page. File titles retain canonical case. `DrawingName` validates changed surfaces within that scope. Equal names on unrelated files/slides are accepted; duplicate internal pages and inconsistent display names inside one PDF set are refused.

`LayerSetRename` derives rename requests from stable IDs in the exact base. It expands a request to every retained page of that original set, follows original identities during swaps, preserves removed pages, and refuses conflicting destinations or implicit merges of distinct existing sets. Publication rebuilds and validates expanded canonical content before computing changed IDs and checking every affected source. The accepted C1 rewriter is now wired into the same native revision. Failure to perform a required rewrite aborts publication; the API maps that refusal to its existing invalid-request response. Non-wikitext owners retain supported slot-only edits because they cannot contain named wikitext embeds. Authorization, exact-base conflicts, edit filters and admission remain in the existing native write path.

Creation opens an unannotated PDF page empty under its existing set name and pin, with native page-option interpretation. It refuses inconsistent existing pins when preparing a new page instead of guessing a file version. Existing annotated pages remain accessible. Copy gathers all stored pages of the selected set from one authorized source revision, allocates one scoped destination label, and preserves content/pins with new IDs. Adoption prepares its final scoped name before rewriting the embed; publication verifies that name without independently changing it.

The editor uses the same file/slide scope, submits whole-PDF renames and retains that intent through deliberate conflict recovery while preserving newer sibling content. New surfaces and draft scopes distinguish target kind, file and internal page. Persisted surface IDs are never regenerated. Legacy draft aliases are read-only and available only where the exact saved source proves one original target; file upload timestamps must strictly predate the base revision, and old/new page interpretation must agree. Old ambiguous records remain untouched and are not applied to an arbitrary target. Recovery uses the existing explicit chooser and confirmation, writing under the current scope and an independent writer ID.

## Review findings addressed

- A server-expanded rename must reach source validation and admission as the expanded canonical snapshot, including every changed sibling ID.
- Editor save/reconcile must retain the complete group rename; a confirmed rename followed by another set reusing the old name must leave that new set alone.
- Adding an unsaved PDF page during a remote set rename/source change must retain the draft and require reconciliation, not create an unintended old-name set.
- Expanding a valid near-limit input can exceed the document-size cap; it must return the existing invalid-snapshot refusal before source work.
- Old file and slide drafts could share an ID. All new target kinds need scoped IDs; a legacy alias requires unique target proof, including strict timestamp ordering for files.

One delegated engineer authored native publication tests and draft-controller recovery, then independently reviewed the integration. Two other engineers supplied the creation/copy/adoption audit and most of the PHP/client implementation but hit their usage limit before returning final implementation reports. The lead inspected and completed their working-tree changes, added real-upload/API coverage and corrected the findings above. No independent final acceptance of the whole feature is claimed.

## Verification record — October 2, 2026

The lead's first publication group passed **33 tests / 121 assertions**. The broader existing entry-point group found one obsolete test expecting a missing PDF page to be unavailable; it now verifies an empty correct-page surface with the same set name, without substituting another page. Real-upload fixture corrections supplied mandatory canvas fields, used a non-ambiguous legacy selector and a genuinely different replacement PDF; these were test-fixture defects, not waived production assertions. The real-PDF creation/copy/adoption/API group then passed **8 tests / 72 assertions** before the final timestamp case was added.

The first full native run completed 500 tests with one fixture error: the near-limit test exceeded the ordinary text field's byte bound before publication could exercise expansion. The delegated test author corrected it using separately bounded ASCII text/name fields, then proved the base (2,096,128 bytes) and submitted input (2,096,380 bytes) valid; whole-set expansion reaches 2,121,328 bytes and is refused. The final native run below includes that corrected assertion and the additional unique-slide recovery case. No production assertion was waived.

| Final gate | Result |
| --- | --- |
| Full standalone PHPUnit, PHP 8.4.11 | **1,458 tests / 3,456 assertions / 1 skip**, no failures/errors |
| Full native PHPUnit, MediaWiki 1.45.3 / PHP 8.3.31 | **501 tests / 4,140 assertions / 1 skip**, no failures/errors |
| Full `npm test` | **15,159 tests across 206 suites**; Grunt lint, static consistency, compatibility and bundle-budget checks pass |
| Changed PHP style | All changed/new PHP files pass; final new-ID unit assertion also passes its focused rerun |
| PHP references, parallel lists and atomicity | Pass; 124 extension classes/files checked |
| Documentation and diff | Pass; 79 maintained/policy documents and 53 historical records, mirrors synchronized |
| Browser acceptance / owner screen review | Not run at this checkpoint; see October 3 C2 acceptance above. Owner approval remains pending. |

Native suites used the existing development container and isolated test tables, serially. No ordinary wiki content, configuration or browser writes ran alongside them. Local ignored logs: `tmp/j112c-standalone-final.log`, `tmp/j112c-native-final.log`, `tmp/j112c-npm-test.log`. These automated results do not constitute whole-feature browser or owner acceptance.

## Remaining boundary

**C2 follow-up, October 2:** accepted the junior's added exact-preview whole-PDF native case after review. Lead verification of that case, a new empty-baseline restoration/stale-cleanup case and the existing slot-removal/admission guard passed **3 tests / 52 assertions**. Provisioned only `Layers_browser_scoped_source` (page 272/revision 2742) through normal publication, then verified readable baseline and unchanged destination/isolation owners. Strengthened read-only preflight passed **1 / 0 skips**. The packet records the new cleanup contract and separate fixture-write evidence; the full-suite figures above remain their earlier dated results. Browser scenarios/screenshots had not run at that checkpoint; their October 3 result is above.

This integration does not finish HIST-4/HIST-7 or Layers 2.0. The current copy catalog still offers its existing per-surface entries; choosing either page now copies the complete set. No protected entry point was removed. J113 retains migration reconciliation, Default/show-intent semantics and author-facing bare-name output. J111 retains restored overlays and full-size viewer work. Mixed historical file pins and ambiguous legacy drafts are preserved, with the limits above; no guessed repair or migration write was made. Existing translated wording is unchanged. No commit or push.
