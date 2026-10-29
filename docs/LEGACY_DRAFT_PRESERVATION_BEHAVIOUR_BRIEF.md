# Legacy draft preservation: proposed behavior

This correction advances Milestone 1 / DATA-1 / DATA-3. It applies to the
existing shared-set editor before migration. Page-owned recovery remains
unchanged. The project owner approved the proposed behavior on October 29,
2026; actual-screen review and broader acceptance remain pending.

When an editor deletes every layer or changes the background on an empty set,
the existing recovery flow can offer that empty edit. Confirming Restore brings
back the empty layer list and its background settings. Keeping or cancelling
recovery does not apply the draft.

New drafts retain complete embedded-image and other image-source values. If
the browser cannot store a complete backup, the existing backup-failure
notification is shown and the previous backup remains intact. A failed write
does not remove other tabs' drafts to make room. Existing historical backups
that already lack image data still open with their existing image-loss warning;
the repair cannot reconstruct missing bytes.

The existing editor, automatic backup, recovery choices, labels, Save and Close
actions stay. No new button or wording is proposed. A clean editor does not
create an empty draft merely because it has no layers. Successful backup still
does not publish to the wiki. After implementation, show the actual recovery
flow to the owner and verify empty and image drafts, cancellation, failed writes
and other-writer preservation before marking the behavior accepted.
