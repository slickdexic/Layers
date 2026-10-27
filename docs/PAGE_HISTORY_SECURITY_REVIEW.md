# Page-history release security review

**Review checkpoint:** October 26, 2026. Opened at `57daa35` and reconciled with
the subsequent accepted changes below. The independent 1.8 source/evidence
security review is complete within the recorded scope, including the corrected
literal-text renderer. This advances SEC-2, SEC-3, SEC-4, SEC-6 and SEC-7 for
Milestone 1; it does not qualify later 2.0 features or declare the release accepted.
The [release ledger](RELEASE_1_8_ACCEPTANCE.md) remains authoritative.

**Current dependency result:** the compatible toolchain update below brings
the full locked npm audit to zero known vulnerabilities, with shipped runtime
assets unchanged. The locked PHP dependency audit also reports no advisories
or abandoned packages. Recheck both at the final release cut.

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

## Registered request and native revision review

The current-candidate source review covers **23 registered action APIs**, plus
two exact-PDF REST paths with GET/HEAD registrations. All **167 PHP/backend
source files** in scope match the published candidate after normalizing source
line endings. Registration contracts and service wiring match the qualified
final-owner-admission baseline. This is a source/evidence review, not a new
execution of every endpoint or every retained test.

The backend changes since that baseline are accounted for: the four Import
information-budget corrections above and the two
[post-migration reference-output callers](PILOT_DATA_REVIEW.md). The manifest's
other changes add the approved viewer controls. The ordinary publisher's
source/owner authorization ordering and native admission implementation remain
unchanged by the reference-output correction.

| Boundary | Reviewed behavior and evidence |
| --- | --- |
| Request methods and CSRF | All nine write-capable action routes advertise POST and required CSRF tokens through native parameter metadata on both maintained versions. Fresh anonymous HTTP checks refuse a token supplied through GET, POST without a token and POST with an invalid token for every route: **54 refusals**, plus two metadata queries. |
| Owning page and revision reads | `PageHistoryAccess` binds the exact revision to its owner, checks native text visibility, including current-record bitfields, and returns a generic unavailable result. Import/editor identity resolution also requires the current base and original owner ID. Existing HTTP role/visibility results and native read/proof suites remain applicable. |
| Publication authorization | The public boundaries require the layer-edit right and save quota. Native publication preflights page read/edit rights, validates sources, repeats changed-source checks after preparation/caller callbacks, then finalizes owner identity and secure write authorization. Retained late-revocation/move controls qualify that ordering. |
| Atomicity and revision admission | `PageRevisionWriter` captures the native parent before mutation; core checks it at commit. Admission binds actor, owner, parent, slot/model and exact prepared content through a consumed request-local scope. Foreign-slot models, unauthorized replacement and slot removal are refused; inherited unchanged content and unrelated slots remain preservable. |
| First Save, Import and recovery | Source descriptors are exact owner/revision/member associations, not bearer permission. Creation and whole-PDF services revalidate them and target identity before the native publisher; protected content is not replaced through a latest-page fallback. The recorded API/proof, stale-save, recovery and lost-reply results retain their stated scope. |
| Legacy writes and history merge | Save/delete/rename keep their native token/right/limit checks and refuse shared-set mutation after migration completion. The merge adapter delegates core permissions, parameters and token handling while the page-owned merge factory enforces its admission restriction. |

The nine transport-tested routes are ordinary page publication, missing-PDF
publication, image/slide Import creation publication, whole-PDF Import
publication, legacy save/delete/rename, legacy PDF export and native history
merge. All eighteen metadata records confirm the expected registered classes.
The refusals are native API errors in HTTP 200 responses, not successful writes:
`mustpostparams`, missing `token`, and `badtoken`, respectively.

Only deliberately invalid probe values, absent tokens and invalid tokens were
submitted. No session, credentials, valid write token, uploaded file or
publishable layer payload was used. These checks establish the transport
boundary; they do not exercise an authorized Save or independently prove all
downstream role checks. Three modified evidence copies are rejected on replay:
missing request, changed refusal and removed CSRF requirement. They are evidence
controls, not runtime mutations. Original observer failures are retained; repairs
handle native raw-error arrays and the specific GET-token refusal code, without
changing production or maintained tests.

The retained 117-case admission result and the subsequent combined native
qualifications are reused within their original limits. The Import follow-up
combines its unchanged cases and corrected fixture replays; it is not a new
all-green full run. No native CLI suite, ordinary content edit, pilot repair,
configuration change or source rebuild accompanies this review. No new blocker
was demonstrated in this authorization/request/admission scope.

## Literal text and remaining application boundaries

The server thumbnail/PDF renderer passed authored text directly to ImageMagick
annotation arguments. A bounded native pixel comparison demonstrated that
`%[fx:6*7]` painted exactly as `42`, rather than the text the editor entered.
This establishes unintended renderer-expression interpretation; it does not
establish private-file disclosure or remote code execution.

All six text-producing paths now escape percent signs at the annotation
boundary: text, text box, marker, callout, dimension and angle dimension. The
existing leading-`@` guard remains. Stored text is unchanged. Ordinary percentage
text retains identical pixels. A shared rendering-cache version changes both
thumbnail and PDF-export keys so new requests do not reuse old interpreted-text
artifacts; retained files follow their normal cache lifecycle.

The new regressions reproduce twelve literal-text failures before correction.
The corrected full standalone suite passes **1,630 tests / 4,051 assertions**,
with one existing skip. A copied original renderer fails thirteen companion
cases, including stale-cache reuse; production and existing tests are not
mutated for that control. Six actual production argument paths also pass native
pixel comparisons against evaluated-expression controls. These are tiny
synthetic renders, with no private input file or wiki edit. The initial observer
format/bootstrap failures are retained; no source or permission bypass qualifies
the successful checks. Existing client/native authorization evidence is reused
because those sources are unchanged.

| Review area | Current-candidate result and limits |
| --- | --- |
| Content and stored-data integrity | The bounded schema rejects duplicate JSON members, non-finite numbers, unsupported structure, invalid references and lossy sanitization before publication. Historical structural reads remain separate from strict new writes. Existing schema, preservation and API-proof tests cover those contracts. |
| Output and script injection | Page-owned controls and recovery previews use text nodes; rich-text HTML escapes authored text and filters interpolated style values. Canvas text remains data. Native JSON configuration transport and text-slot diffs supply context-appropriate encoding. Image data allows bounded raster data URLs with matching signatures, excluding SVG; SVG path commands use a character/count whitelist. Stored raw SVG fallback is not server-rasterized. Existing validation/rendering tests and the literal-text correction above cover the reviewed paths. |
| Resource bounds | Snapshots have byte, depth, surface and layer limits; styles, text, paths and inline images have their existing bounds. Private raster admission limits source metadata to 64 MiB / 40 million pixels and output to 4096 pixels per side / 8 MiB, with full generated-image decoding. Native shell/media-handler execution retains core resource limits and existing quotas. These limits are not a proof against every decoder defect or a concurrent load benchmark. |
| External I/O and command execution | Page-owned source lookup uses the local repository and exact title/timestamp/hash/page, not a caller-supplied download URL. Shell arguments carry bounded validated data; executable/converter configuration is operator-controlled. The legacy SVG converter template is trusted configuration with escaped temporary paths. Native MediaWiki media-handler requirements remain; no worker/backend architecture is introduced. |
| Capture, caches and privacy | Exact PDF capture hashes the same private handle later delivered, repeats admission and releases owned resources on refusal/close. PDF routes keep private no-store responses. Export delivery rechecks the source title and uses private staging; legacy public thumbnail storage remains subject to core upload-access configuration. The retained HTTP visibility/lifecycle checks and local checkout guard supply their recorded protection. |
| Configuration, authentication and logging | Authentication, CSRF and permissions remain native. Private wiki operators must protect uploads and keep settings/logs/captures outside public paths. Error logs can contain diagnostic paths and authored text; they require operator access control and are not a public export or a redacted data format. Responses use the documented generic failures. The review changes no site settings, log permissions or user data. |
| Dependencies and software/data integrity | Full locked npm audit is zero at the recorded toolchain checkpoint; the fresh locked Composer audit has no advisories or abandoned packages. The first local Composer attempt failed certificate validation; the successful process uses Windows-trusted public roots with TLS verification enabled, then removes its temporary bundle. No dependency install/update or persistent trust change occurs. Shipped asset hashes/notices, exact source delivery and native revision admission retain their own tests. |

This completes the source-led engineering review of the relevant 1.8 application
boundaries, using current source, the new correction and retained qualified
tests. No unresolved high/critical finding or demonstrated data-loss defect was
identified in that scope. This is not an independent penetration test, proof
against unknown flaws, qualification of every server configuration or acceptance
of later search/Cargo/link features. Performance/device/owner gates remain in
the release ledger; missing evidence is not automatically a vulnerability.

## Deployment boundary and release-cut recheck

### Shared development-checkout privacy

Harmless static-file canaries at a root log path and a documentation path
returned HTTP 200 without a wiki login. This established a development-server
boundary problem; no real private artifact was requested or disclosure of real
private contents claimed. Git exclusions and wiki authentication alone do not
protect files served directly by the web server.

The [development checkout guard](DEVELOPMENT_ENVIRONMENTS.md#private-working-material-and-http-access)
now refuses non-runtime checkout paths while retaining public runtime and
synthetic-image assets. The same rules first passed on an isolated flat-file
fixture, then were installed atomically without replacing an existing file.
All 32 checks passed across ports 8080 and 8082: before/after canaries, five
public asset classes and five denied private-path classes. No real log, settings,
private document or wiki content was downloaded. Markers were removed afterward.
Eight additional raw HTTP requests using plain and encoded traversal forms
were also refused without returning the generated marker.

The installed root guard and Git exclude entry are local development
configuration. The generic example is public; it is not auto-installed or a new
extension/server requirement. Existing private artifact permissions, historical
bytes and wiki settings remain unchanged. Clean release packaging and operator
storage outside web roots remain required; this does not qualify every possible
server alias or replace application authorization checks.

### Final release actions

Retained [HTTP privacy and native admission evidence](MILESTONE_1_HTTP_PRIVACY_ACCEPTANCE.md)
covers roles, visibility transitions, private exact-source delivery, source
revocation and final owner checks. Those results remain within their recorded
scope; an API counter test does not replace them.

The registered request/access-control, native admission and remaining application
boundaries are reviewed above. Recheck dependency advisories and source/artifact
consistency at the release cut; reopen affected checks if the candidate changes.
Classify actual findings and retest corrections. New search,
Cargo and layer-object-link features remain later milestones. Preserve the
security of existing functionality while reviewing this release's changes.

No ordinary wiki content, pilot names, historical snapshots, wiki permissions or
wiki settings are changed by this review. The [pilot-data comparison](PILOT_DATA_REVIEW.md)
is separate and authorizes no reconciliation. Release version/tag and owner
acceptance remain pending.
