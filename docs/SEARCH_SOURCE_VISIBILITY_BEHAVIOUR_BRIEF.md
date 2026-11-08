# Search visibility for layer text

**November 8 status:** the approved page-owned policy and migrated search
boundary are qualified in v1.8rc1. The verification-open language in the
original brief below is historical. Public legacy mode remains unqualified.
See [release acceptance](RELEASE_1_8_ACCEPTANCE.md).

Advances HIST-3, SEC-2, SEC-6 and DATA-4. **Approved November 5, 2026;
amended by owner approval of option A on November 6.** The
[decision record](RELEASE_1_8_SEARCH_DECISION.md) contains the approval and
comparison. Verification remains open; approval is not release acceptance.

## What readers see

Page-owned layer text follows its owning page/revision permissions, like other
saved page content. Search indexes the current eligible revision; old revisions
remain accessible through native history only when their permissions allow it.
Hiding, deleting or suppressing a referenced image/PDF does not by itself hide
layer text saved in an independently readable page revision or remove that
text's search matches/snippets. The viewer still refuses unavailable media;
it must not substitute a different file version.

**Exact documentation wording:** “Layer text saved in a page revision follows
that page revision's permissions. Hiding the referenced file does not hide
text saved in a readable page revision. To restrict that text, restrict the
appropriate page revision as well.”

Restricted owning pages and text-suppressed page revisions must not expose
their disallowed layer text through search results or snippets. Old revisions
must not supply obsolete terms to the current page index. Ordinary page text,
slides and independently permitted layer sets retain their search behavior.
There is no search pause and no change to interface wording, controls, Save,
history, restore, source pins, Import, drafts or overlays.

## Legacy shared sets retain their separate privacy boundary

Option A applies only to text saved in a page revision's Layers slot. It does
not turn legacy shared rows into independently readable page-owned text. For
legacy file-associated sets, the November 5 requirement remains: unavailable
sources must not expose associated layer text through search matches/snippets.
Source restoration makes eligible terms searchable again after indexing catches
up. Independently permitted page, slide and other-file terms must survive.

A shared index must use a safe public visibility boundary. Source-specific
reader restrictions cannot be bypassed by indexing terms under a privileged
actor. Exact historical sources and visibility changes matter; a newer file
cannot substitute for an unavailable historical source. Deferred reindexing
alone does not establish that stale restricted matches are prevented. Privacy
qualification must cover the active legacy path, not only inactive helpers.

## Stored data and verification

This decision removes only the earlier source-dependent discovery requirement
for page-owned text. Page revisions, layer sets, file history and retained
migration rows are preserved. It does not authorize deleting experiments or
loosening media delivery or legacy privacy checks.

Existing synthetic native evidence shows that core's revision API returns
current and old readable page-owned Layers slots after file suppression while
the Layers source resolver refuses the suppressed media. That observation is
consistent with A; it does not prove restricted-page search privacy. The earlier
test-only deferred source-filtering experiment remains historical design
evidence, not the required page-owned behavior or an activated repair.

Complete the bounded tests in R1 of the
[release critical path](RELEASE_1_8_CRITICAL_PATH.md): active page-owned search,
page/revision permission changes and a separate active legacy confidentiality
assessment. Record native API, Special:Search, backend/version and candidate
boundaries explicitly. No known high/critical confidentiality defect is waived.
