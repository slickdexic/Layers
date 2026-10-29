# Proposed legacy recovery dismissal behavior

This correction advances Milestone 1 / DATA-3. The existing legacy recovery
dialog offers Recover and Discard. Currently dismissing the dialog can be
treated like Discard and delete the backup, even though the user did not choose
Discard explicitly.

Keep the existing wording and actions. **Recover** restores the chosen backup;
**Discard** removes that chosen backup as it does today. Closing the dialog or
pressing Escape without choosing either action keeps the backup and does not
restore it. The user's current editor state stays unchanged. Do not delete
other drafts. This proposal does not change the page-owned recovery dialog.

The project owner approved this behavior on October 29, 2026. A browser check
using the MediaWiki dialog and synthetic legacy state exercised Escape, explicit
Discard and Restore without wiki writes. Focused tests also verify a backup
replaced by another tab while the dialog is open is not discarded or silently
restored. The synthetic capture did not establish a visible dialog screenshot;
a real pre-migration editor journey and owner screen review remain open.
