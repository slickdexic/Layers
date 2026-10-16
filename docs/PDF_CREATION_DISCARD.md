# PDF creation discard

This inactive PDF-creation primitive advances milestone 1 criteria HIST-4, HIST-1, DATA-1, and UI-10.

The caller must first obtain the existing explicit Discard choice. `prepareDiscard()` is read-only and returns a private capability bound to the current lifecycle, editor work, storage writers, and exact owned records. It does not authorize closing the editor.

`commitDiscard(handle)` is synchronous and single-use. It rechecks the lifecycle witnesses and retires only the exact current-scope records owned by the active PDF-creation controller and its independent exit writer. It does not change editor work or history, source content, checkpoints, or records belonging to recovery or other writers. A stale witness, changed record, or refusal does not authorize Close.

If storage removal fails, the controller attempts to restore removed bytes only into keys that are still absent; it will not overwrite another value during rollback. A failed prepare or commit leaves the caller responsible for keeping the editor open or reporting the failure.

Dispatched or unknown publication evidence remains protected from this narrow discard operation, including after a `base-current` check. The outcome check does not prove an earlier request cannot arrive later. Such evidence requires separate resolution or retention before it can be discarded.

Existing UI, callers, bootstrap, and PHP behavior remain unchanged. Normal Close and disposal retain their existing behavior. Route wiring and native/browser acceptance remain pending.
