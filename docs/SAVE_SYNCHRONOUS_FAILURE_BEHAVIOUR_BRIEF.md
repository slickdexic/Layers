# Save error feedback for unexpected synchronous failures

This correction advances Milestone 1 / DATA-1 and HIST-1. An unexpected error
while preparing the current page for Save can escape before the existing error
handler. A synchronous error while starting the Save can also leave its spinner
visible. A synthetic probe demonstrates both paths; it does not establish the
cause of the owner's earlier intermittent slide failure.

Proposed behavior: use the existing localized Save error notification if either
failure occurs, stop any Save spinner, return an unsuccessful result to the
existing caller and keep the editor open with its current work. Do not retry or
infer whether a request reached the server. The existing Save button, labels,
normal success, draft protection, authorization and conflict handling stay
unchanged. The owner separately approved making existing asynchronous Save
errors visible as well. No new control or new wording is introduced.

The owner approved this behavior on October 29, 2026. A browser probe verified the existing notification appears above the editor, with unsaved work intact and wiki writes blocked. Two pre-fix unit tests failed, then passed; the expanded editor/API/draft/history group passed 1,194 tests. The notification area is shared, so other simultaneous notices can also be visible while a Save error is shown; their text and timing are unchanged. Exact-commit CI and owner screen review remain pending.
