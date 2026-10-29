# Undo behavior after legacy draft recovery

This correction advances Milestone 1 / DATA-3. The legacy editor creates its
initial Undo state before the asynchronous recovery choice. Restoring a draft
currently replaces the editor state without adding a corresponding Undo state.

After a confirmed Restore, record the restored state in the existing Undo
history. Undo then returns to the state immediately before Restore, and Redo
returns to the restored layers and background. Dismissing or discarding a draft
does not add a history entry. Existing Undo/Redo buttons and shortcuts, recovery
wording and page-owned history remain unchanged.

The charter's “Read this first”, Rule 1 requires owner approval before this
visible behavior changes. The owner approved undoable Restore on October 29,
2026. Restore does not delete the recovered backup; normal automatic backup
can subsequently update it, and successful Save or explicit Discard can clear it.
Verify both empty and image drafts, Undo and Redo, and
failure/cancellation preservation before acceptance.
