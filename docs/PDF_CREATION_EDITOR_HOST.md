# Missing PDF layer-set editor host

`PageOwnedPdfCreationHost` is an explicit, unregistered editor connection for a
whole PDF layer set that does not yet exist on the owning page. It advances
milestone 1 / HIST-4, HIST-1, DATA-1 and UI-10. Existing editor, overlay and saved
PDF session callers remain unchanged. This component alone does not enable PDF
creation or complete milestone 1.

The host owns a `PageOwnedPdfCreationTransaction`, using native preparation plus
injected fresh-read and publication transports. It never inserts a pretend stored
anchor into a saved session. The actual absent slot or complete stored base,
including unrelated surfaces and unknown fields, stays in the creation envelope.
All internal PDF pages retain one visible layer-set name.

## Loading and page changes

Construct the host only after the existing editor's state, canvas and history
managers are ready, with no current layers, dirty work or populated history. Call
`load()` to start directly on the native requested page; it may differ from the
embedding's initial page. `turn(page)` changes internal PDF pages. Both return a
promise resolving to `true` only after a successful page change and refresh.

Each operation freshly revalidates the requested page through the transaction,
stages and decodes its exact background, and prepares the target history and
selection reset privately. Complete state/history observations, dependency method
checks, source identity, editor participants, URL, selection, dimensions and
operation generation are checked after both awaits and immediately before commit.
Late edits, replaced or destroyed participants, active gestures, locks, batches,
overlapping navigation, decoding failure and timeout refuse before changing the
visible editor or active model page. Staged resources and model handles are released.
Native canvas geometry remains distinct from rounded image rendition dimensions.

The model, state, history, page and selection data commit without awaits or
notifications between them. Rendering, state notifications, history controls and
URL updates then run synchronously. Edits made by notifications are captured as
newer work. An unexpected exception after commit is distinct from a precommit
refusal: `false` and `getStatus().needsRefresh === true` report it, the committed
and offscreen work remain available, and further page changes are refused. The
caller must preserve drafts and reopen through fresh admission rather than retry
silently. This component does not provide that final UI/recovery integration.

## Undo, draft material and disposal

Each visited page retains its complete history steps, index, descriptions,
timestamps and Redo branch. All creation timelines have a saved marker of `-1`;
visiting a page never marks it saved. Undo to an empty optional page removes that
member from the prospective snapshot but retains its Redo history. The empty
initial anchor remains eligible for explicit first Save. The whole creation stays
dirty before first Save, including when all current layers are empty.

`capture()`, `getLiveState()`, `getDraft()` and `getStatus()` expose validated
isolated work, including newer edits while a first Save is pending or confirmed.
`captureDraftHistory()` returns an isolated companion with the
complete creation identity, count, active page and per-page source/ID/timeline,
including a stable empty initial anchor if it has not been visited.
`captureDraftEnvelope()` adds publication phase, holds and any confirmed receipt.
The explicit recovery and first-Save methods and unregistered draft controller
are described in [drafts and first Save](PDF_CREATION_DRAFTS_AND_SAVE.md).
`invalidate()` cancels pending navigation. `dispose()` also unsubscribes only the
host's own listeners and disposes its transaction, leaving editor work untouched.

## Integration still required

The host and its ResourceLoader/bootstrap/editor callers remain inactive. Scoped
local drafts, explicit same-base recovery through the existing dialog and the
first-Save client boundary are implemented. Fresh native saved-session handoff,
confirmed/uncertain reconciliation and native proof for earlier creation recovery
remain separate work. Do not expose creation overlays while those paths are incomplete.
Existing sparse saved PDF sets continue through the saved-group path.

Final HTTP privacy/errors, native/browser first Save and owning-page return,
reopen, viewer/export, mobile, MediaWiki 1.44, owner acceptance and large real-PDF
timing remain unqualified. A mocked 99-page source proves requested-page work is
bounded; it is not a real-document performance measurement. Native raw-source
admission still excludes nested linked captions. No rendering occurrence is
substituted as saved-source edit authority.
