# Layers 1.8: approved page-owned search policy

November 6, 2026. **Option A approved by the project owner.** Advances HIST-3,
SEC-2/SEC-6 and OPS-2. This amends the November 5 search policy for page-owned
layer text only. Legacy shared-set privacy requirements remain in force.

## Recommendation

Proceed with **A: page-owned search follows page-revision access**, consistent with
the November 6 ownership clarification. Preserve existing search, all editing
and viewing entry points, and native page history. Separately qualify legacy
shared-set privacy; this recommendation does not waive an actual disclosure of
restricted data or declare the release ready.

The unselected alternative was **B: retain the stricter source-dependent discovery
policy**. Its design comparison is retained below as historical rationale,
not an implementation assignment. No file-search pause is authorized.

## Why there is a decision

The owner confirmed that a readable page revision and its Layers slot remain
readable when a referenced file version is suppressed. To restrict the saved
page text, an operator must restrict that page revision separately. Native API
experiments establish this for current and older synthetic page revisions.

The November 5 search brief required that same readable page text to
stop producing search matches/snippets whenever its file source is unavailable.
This is an additional **discovery rule**, not the confidentiality rule for the
saved page revision. Both requirements can coexist, but they require different
authorization decisions and substantial search integration.

The distinction does not automatically extend to legacy shared sets. Retained
legacy data may not have an independently readable owning page revision. Its
privacy must be checked separately before any release-risk conclusion.

## A — page-owned search follows page-revision access (approved)

**Reader:** current page-owned layer text follows the same owning-page/revision
access rules as ordinary page content. If an image/PDF version is suppressed,
search can still find its layer text while the owning page revision remains
readable. The viewer continues to refuse the suppressed media. Restricting the
page/revision must remove disallowed text from search through the supported
search visibility lifecycle; stale restricted page text is not permitted.

**Editor:** Save, history, restore, source pins, Import, drafts, overlays and
permissions are unchanged. No file version is substituted. No search feature
is disabled, and no page revision or retained migration row is removed.

**What changes:** the unimplemented November 5 source-dependent discovery rule
is withdrawn **only for page-owned layer text**. Existing active page-owned
projection already largely follows this model; it still needs page/revision
privacy verification. Legacy shared-set privacy is not relaxed. Existing safe
maintenance, link-validation, batching and reader-reuse repairs stay.

**Exact documentation wording:** “Layer text saved in a page revision follows
that page revision's permissions. Hiding the referenced file does not hide
text saved in a readable page revision. To restrict that text, restrict the
appropriate page revision as well.” No interface labels or controls change.

**Completion:** native tests prove current/old page-revision access and search
visibility for anonymous, permitted and denied readers; source media remains
refused; legacy disclosure is independently assessed and repaired if confirmed.
Update the charter clarification, search brief, audit and release ledger together.
This is not permission to skip the release's other security or acceptance gates.

## B — retain source-dependent search discovery (not selected)

**Historical alternative:** retain the original November 5 source-dependent
discovery rule. Readable page history remains independent; search hides only the affected
file-associated terms, preserving ordinary page, slide and permitted-file matches.
No temporary file-search pause or whole-page removal is authorized.

**Required engineering:** use one lead-owned vertical implementation covering
index projection, invalidation and the query/result boundary. Existing scans
and projections are reusable components. A deferred hook alone does not meet
the stale-result requirement; a snippet filter alone does not protect matches,
counts or API continuation. Rejecting every result with an unavailable source
would also remove permitted matches on the same page and is not equivalent.

First prove one supported database-search path on the maintained 1.45 wiki,
then qualify the corresponding 1.44 candidate. Preserve existing integrations;
any unsupported-backend behavior needs explicit disposition, not an invented
claim of universal support. Do not patch MediaWiki core or add a runtime worker.

**Completion:** the vertical slice must pass Special:Search and list/generator
API searches before and after deferred updates, including denied-only terms,
ordinary-page/slide/other-file terms, phrases/Boolean and mixed-field queries,
pagination/counts, suppression/restoration, exact archived versions and late
visibility changes. Include upgrade removal of stale old projections. Only
after this integrated proof should the remaining backends/scaling work be assigned.

## Approval record and implementation boundary

The charter's “Read this first”, rule 1 says: **“Before building anything that
changes what people see or click, write a one-page behaviour brief … Nothing is
built until the owner has approved it.”** The owner approved A on November 6:
“I think that you would recommend A. I will trust you wisdom. If you feel A is
the right path forward, let's go with A.” The lead recommends A and proceeds
under that authorization; no further policy approval is pending.

The charter, active visibility brief, audit, handoff and release ledger now
record A. Inspection of `DrawingSearchText::get()` confirms that the active
page-owned projection checks revision text visibility and pilot scope, and
does not consult file-source availability. This is code evidence, not proof
of every reader/search boundary. R1 in the critical path specifies the remaining
native acceptance work. A subsequent focused 1.45 native run passed 3 tests /
65 assertions; its coverage and outstanding gaps are recorded there. No runtime
behavior, interface or installed candidate changed. Native writes were limited
to isolated test tables and temporary fixture media. Inactive source-filtering
experiments remain preserved; do not activate them for page-owned search.
