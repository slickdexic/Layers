# Native Import into a missing layer set

This inactive service advances milestone 1: page ownership, native revision
history, independent Import and preservation of existing work. It implements
the native read and first-Save boundary for a still-missing image/slide layer
set on an existing owning page. Existing APIs, services, callers and UI remain
unchanged. Registration and editor integration are still required.

`PageWorkingCopyImportCreationService::read()` receives the current owner/base,
internal target identity, exact literal embed byte offset/text, one exact
source descriptor and the requesting native authority. The source descriptor
contains `sourcePageId`, `sourceRevisionId` and `sourceSurfaceId`. These internal
identities never become author syntax. The source must be on another owner,
readable at the selected revision, and match the target kind and normalized
layer-set name. Image sources must refer to the same file; their version may
differ from the newly admitted target's native pin.

The result has three explicit fields:

- `creation`: the unchanged missing-target admission, with the genuine stored
  base bundle or absent-slot null separate from the virtual empty member.
- `source`: the current canonical native owner and exact revision/member.
- `sourceBundle`: the complete unchanged native read bundle, including siblings
  and source availability metadata. Only the selected source is requested.

Native preparation and source reads repeat and compare complete captures.
Current target authorization is checked again after source work. Results are
detached JSON data, never capabilities or reusable authorization grants.

`publish()` accepts a complete snapshot and up to 32 exact source claims for
the same newly admitted target. Identical claims are deduplicated. The proposal
may change that new member's canvas, layers and reading order while preserving
its admitted identity/name/metadata/image pin and every stored sibling/root
field. It does not admit unrelated edits or a simultaneous main-text rewrite.
Native source citations precede the optional editor note; oversized summaries
refuse rather than truncate provenance.

One cancelable native transaction spans publication and the final source
checks. After core preparation, missing-target admission and exact source
reads repeat before admission. After Save, the target now exists: the existing
stored-member read boundary verifies the committed snapshot, native owner and
unchanged source captures. Late source refusal rolls the transaction back.
First Save creates one owning-page revision; it does not change source pages
or the saved embed. Publication results are not automatically retried.

This scope excludes new wiki pages, PDF Import, nested/expanded embeds, target
rename during first Save, endpoint/client transport and editor/history/draft
integration. Native CLI tests establish the service boundary, not HTTP,
browser, mobile, MediaWiki 1.44 or owner acceptance. Milestone 1 remains open.
