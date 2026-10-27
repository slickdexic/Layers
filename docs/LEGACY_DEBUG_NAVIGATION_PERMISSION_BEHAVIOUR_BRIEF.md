# Legacy debug navigation permission correction

Approved October 27, 2026. Advances Milestone 1 / SEC-1 / UI-10.
Project owner: “Approve the bounded correction”. Verification is recorded
separately; approval alone does not establish native/browser acceptance.

## Existing defect

Before page-history migration completes, a File page can show its legacy
**Edit layers** tab and **Edit Layers (DEBUG)** action to a user without the
`editlayers` right when Layers debug mode is enabled. Debug configuration can
enable this without a request parameter. The server's editor/save authorization
is separate; this finding demonstrates incorrect navigation visibility, not a
demonstrated unauthorized read or write.

## Proposed behaviour

- A user without `editlayers` sees neither legacy entry, including in debug mode
  and when permission lookup fails. The rest of the page/navigation stays.
- A user with `editlayers` keeps the existing legacy tab and debug action before
  migration. Existing entry wording, URLs and placement stay.
- After migration completes, both legacy File-page entries remain retired for
  everyone. Editing continues through the owning page's existing overlays.
- No wording, page content, overlay, viewer, API, account right or saved data
  changes. Debugging can record the refusal but cannot change admission.

## Verification and review

Check authorized and unauthorized users, debug enabled/disabled and explicit
request overrides, permission-lookup failure, both navigation hooks and completed
migration. Compare the complete pre-existing navigation arrays on refusal.
Show the recorded navigation outcomes before accepting the correction.

The charter's “Read this first”, Rule 1 requires prior approval before changing
an entry point users can see. This brief limits that approval to the two
incorrectly exposed legacy entries; it does not authorize broader UI cleanup.
