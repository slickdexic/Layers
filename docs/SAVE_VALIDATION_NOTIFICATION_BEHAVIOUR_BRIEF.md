# Show existing Save validation errors above the editor

This correction advances Milestone 1 / DATA-1 and HIST-1. A browser probe with
a synthetic invalid layer confirmed the existing validation notification is
behind the full-screen editor; unsaved work remained open and no wiki write was
made. The probe does not establish the cause of the owner's earlier slide issue.

Proposed behavior: show the existing Save validation error above the editor,
including errors reported by the legacy validator. Preserve its text, duration,
controls, position and validation rules. Do not publish, retry, change layer
content or change other notifications’ text or timing. Since MediaWiki shares the
notification area, simultaneous notices may also be visible while a Save error
is displayed. The approved synchronous and asynchronous corrections remain.

The owner approved this correction on October 30, 2026. A real-browser synthetic validation failure confirmed visibility and retained work with no wiki write. The affected Save, validation, draft, API and history group passed 1,557 tests; exact-commit CI and installed-candidate checks remain pending.
