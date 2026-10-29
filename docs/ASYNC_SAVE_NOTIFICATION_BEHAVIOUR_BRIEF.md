# Show existing asynchronous Save errors above the editor

This correction advances Milestone 1 / DATA-1 and HIST-1. A real-browser probe
with a synthetic rejected Save shows that MediaWiki creates the existing error
notification, but the full-screen editor covers it. Work remains in the editor.
The probe does not establish the cause of the owner's earlier slide report.

Proposed behavior: when the editor reports an asynchronous Save error through
its existing notification, show that same notification above the editor. Its
text, type, duration, controls and position remain unchanged. Previously
reported errors remain handled by their existing reporting path; no retry,
new wording, publication or changes to authorization, drafts, conflict handling
or the Save button are introduced. The synchronous failure correction already
approved separately is retained.

The owner approved this correction on October 29, 2026. A real-browser synthetic rejection confirmed the notice is visible, work is retained and no wiki writes occur. The affected editor/API/draft/history group passed 1,194 tests. The notification area is shared, so simultaneous notices can also be visible while a Save error is shown; their text and timing are unchanged. Exact-commit CI and owner screen review remain pending.
