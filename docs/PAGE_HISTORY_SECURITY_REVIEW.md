# Page-history release security review

**Candidate baseline:** `57daa35`, October 26, 2026. This review advances the
independent 1.8 release's SEC-4, SEC-6 and SEC-7 gates. The review is in progress;
the findings below do not declare the full release security gate complete.
The [release ledger](RELEASE_1_8_ACCEPTANCE.md) remains authoritative.

**Current dependency result:** the compatible toolchain update below brings
the full locked npm audit to zero known vulnerabilities, with shipped runtime
assets unchanged. The wider application security review is still in progress.

## Confirmed Import request-budget bypass

Four registered routes omitted the existing native information-budget check:

- `layersworkingcopyimportread`
- `layersworkingcopyimportcreationread`
- `layersworkingcopyimportcreationrebase`
- `layersworkingcopyimportcreationdraftrebase`

Their underlying services revalidate owner/source access and exact historical
associations, but do not spend an external request budget. A caller could repeat
these reads and association proofs after exhausting `editlayers-info`.

Native API regressions reproduced four exhausted-budget successes and four
successful reads that failed to spend the budget. The correction checks the
existing information budget before invoking the service. Requests below the
limit retain their payload and private-cache policy; exhausting the separate
render budget does not block these information requests. Refusal uses the
existing `ratelimited` API error. No new setting, bucket or interface is added.

All 13 focused native tests / 49 assertions pass after correction; the previous
code fails eight assertions. These use real native counters and mock only the
downstream work, proving that refusal precedes source work. They do not claim a
concurrent HTTP load test or final browser acceptance. Existing authorization,
source selection, publication and recovery logic are unchanged.

The affected ten-class run completed 169 cases / 2,749 assertions, retaining
one error and four failures in two older fixtures. The private-wiki authority
mock omitted core's global read check; a registration assertion also omitted
the previously accepted `exacttext` parameter. Both causes reproduce with
copied pre-correction APIs, whose source binding was verified. Fixture-only
corrections preserve the original authority's global rights and explicitly
check `exacttext`'s boolean/default contract. Both complete corrected classes
pass **21 tests / 636 assertions**. Qualification combines these replays with
the unchanged classes, rather than claiming another full-suite run.

## Shipped library and development dependencies

The pinned, shipped `pdfjs-dist` version remains **4.10.38**. Its exact-version
[upstream advisory query](https://api.github.com/advisories?ecosystem=npm&affects=pdfjs-dist%404.10.38&per_page=100)
returned no published affected-version matches on this date. The package guard
still verifies the API bundle, worker, license and version. `isEvalSupported`
remains false. This is a dated advisory/integrity check, not proof against
unknown vulnerabilities or an instruction to rebuild the PDF bundle.

The full npm audit also covers tools excluded by a runtime-only audit. It
reported Handlebars 4.7.9, used by the documentation generator, with critical
[AST type-confusion](https://github.com/advisories/GHSA-8r5x-fm3f-whwj) and
[own-property-check bypass](https://github.com/advisories/GHSA-p8wg-vrv2-v86f)
advisories. The lockfile now selects the compatible **4.7.10** patch. Only that
package entry changes; the dependency manifest, shipped assets and bundled
runtime remain unchanged. Installation disabled package lifecycle scripts,
and the patched template compiler passes a trusted-template smoke check.

The audit after that isolated Handlebars patch reported **zero critical** advisories and **21 remaining
development-tool warnings**: 17 high, three moderate and one low. They remain
visible for reachability/remediation assessment at that checkpoint. They were
not automatically classified as wiki-server vulnerabilities or discarded because
the packages are marked development-only. The isolated Handlebars correction
did not close that assessment or the entire security review; the follow-up below
resolves the remaining dependency warnings.

### Compatible development-tool updates

The follow-up updates now resolve all 21 remaining warnings. The full locked
npm graph, including development dependencies, reports **zero vulnerabilities**
on October 26, 2026. This is a dated registry result, not a guarantee against
unknown issues or completion of the broader application security review.

Only Grunt's direct declaration changes, from **1.6.1 to 1.6.3**. Other direct
ranges stay unchanged. Compatible transitive updates cover Babel, glob/brace
parsing, CSS/Markdown tooling, utility and WebSocket dependencies. The final
`brace-expansion` 2.1.7 selection satisfies its existing `^2.0.2` parent range;
no forced upgrade or override is used. Fifty-five lock entries change, including
root metadata; all 54 changed dependency entries are development-only.

The already patched Handlebars 4.7.10 and pinned pdf.js 4.10.38 entries remain
exact. No PHP, browser source, artwork, font or PDF bundle is rebuilt or changed.
Installation disables lifecycle scripts. Changed package engine declarations
support the recorded CI Node 20.20.2. The client/static checks and exact-commit
CI qualify the updated development tools; unchanged native PHP/browser evidence
is reused within its original scope.

Local lint discovery previously walked private historical artifacts before
applying file exclusions and stopped on a protected path. Grunt now passes
private/generated-directory exclusions to its glob before traversal, retaining
the original source patterns and rules. A comparison against the complete public
tree verifies identical coverage: 587 JavaScript files and 14 stylesheets.
Protected artifact permissions and contents remain unchanged. This is a
development-check repair, not a change to served content or runtime behavior.

With the updated tools, the complete local client/static command passes:
**18,987 tests / 316 suites**, lint/style/i18n, compatibility, class references,
parallel/atomicity/rate/state checks, bundle budgets and shipped asset checks.
The earlier local failures are retained: private-path traversal, then Jest's
restricted-process workspace resolution. The successful run uses normal host
path access and the maintained command; no force flag, rule suppression or
artifact-permission change is used.

## Review boundary and remaining work

Retained [HTTP privacy and native admission evidence](MILESTONE_1_HTTP_PRIVACY_ACCEPTANCE.md)
covers roles, visibility transitions, private exact-source delivery, source
revocation and final owner checks. Those results remain within their recorded
scope; an API counter test does not replace them.

Complete the release-candidate review of access control, content/output
validation, native revision/admission integrity, resource bounds, configuration,
logging, dependencies and external I/O. Classify actual findings and retest
corrections; missing evidence alone is not a production defect. New search,
Cargo and layer-object-link features remain later milestones. Preserve the
security of existing functionality while reviewing this release's changes.

No ordinary wiki content, pilot names, historical snapshots, permissions or
configuration are changed by this review. The [pilot-data comparison](PILOT_DATA_REVIEW.md)
is separate and authorizes no reconciliation. Release version/tag and owner
acceptance remain pending.
