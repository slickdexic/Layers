# PDF creation lifecycle

This lifecycle advances milestone 1 criteria HIST-4, HIST-1, DATA-1, and UI-10. It documents an inactive PDF-creation integration candidate; callers and user-facing controls are not wired by this document.

## Admission and draft ownership

The lifecycle accepts only the actual loaded `PageOwnedPdfCreationHost`, its owning editor, and the matching `PageOwnedPdfCreationDraftController` configured with `retainPublicationAttempt: true`. It also requires an independent exit `PageOwnedDraftStore` writer. The exit writer must differ from the controller's live writer, any recovery writer, and each fresh checkpoint writer used for reconciliation.

Recovery review completes before the lifecycle enables autosave. Review cancellation or refusal keeps publication blocked. Once ready, editor changes debounce persistence; snapshots retain the complete creation draft and per-page history, including finite layer data the editor does not interpret. The capture-phase `pagehide` listener preserves an independent exit copy before the bootstrap's editor-destruction listener runs.

## Explicit actions and exit

Save and publication reconciliation are explicit lifecycle calls. Neither retries Save automatically. The retained attempt records what was sent; a native outcome check does not attribute a present revision to that request. A caller may request guarded saved-session handoff after confirmed Save. Handoff returns the saved bridge, coordinator, and exit backup; it does not install them, redirect, or close the editor. The caller must install the returned saved bridge/coordinator and its lifecycle before exposing further actions.

`prepareCleanClose()` produces a single-use capability only for a clean, confirmed creation. `commitCleanClose()` revalidates its lifecycle witness and backup, then returns the owning-page target. It does not delete backups or destroy the editor; the owning caller controls both. Explicit Discard remains with the existing caller and is not granted by this clean-close capability.

Call `dispose()` before any non-`pagehide` `editor.destroy()` so the exit copy can be preserved first. A voluntary disposal failure returns false and leaves lifecycle ownership live. Terminal `pagehide` cannot guarantee a clean close: a failed exit write is reported, while the browser may still destroy the page.

## Integration status

The lifecycle remains inactive and no browser behavior has been proven. UI wiring and owner acceptance remain open, including the explicit Discard path, native integration, browser lifecycle verification, and MediaWiki 1.44 acceptance.
