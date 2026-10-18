# Whole-PDF Import preparation

This unregistered component advances milestone 1, HIST-4, DATA-1 and SEC-2.
`PageOwnedWholePdfImportSource` connects the qualified native read client to
the detached whole-PDF planner. It has no editor callers and does not change
existing Import controls, session state, Undo, drafts or publication.

## Inputs and complete live work

Construct the component with a native API transport providing `post()`.
`prepare()` accepts exactly these fields:

- `identity`: the six native request fields documented in
  [the read transport](WHOLE_PDF_IMPORT_TRANSPORT.md).
- `baseSnapshot`: the complete saved document at the target base revision.
- `targetSnapshot`: the complete current document, including unsaved work on
  offscreen pages, other files, slides and layer sets.
- `mode`: `empty`, `append`, `replace` or `cancel`.
- `maxLayers` and `allocateId`: the planner's existing per-page limit and fresh
  layer-ID allocator.
- `assertCurrent`: a synchronous participant guard that returns `undefined`
  when all captured editor/session/history/selection work remains current and
  throws otherwise. Async guards and truthy success values are refused.

Cancel returns null without reading payload, contacting the API or invoking
the guard or allocator. Other inputs are captured and detached before the
first asynchronous read. Accessors in request data are refused without calling
them. The caller must capture the complete live participants, not only visible
layers or a dirty flag. Allocators must not modify live work.

The exact native stored target snapshot must match `baseSnapshot`. Selected
live target members must retain the stored group's membership, identity,
label and file pins. Their unsaved layers, canvas values and unknown finite
metadata are retained in planning. The planner always receives the live
document; the stored target bundle never replaces it. Other files, slides and
layer sets remain part of that complete document.

Source and target may pin different versions of the same file. Imports map
internal PDF page numbers within the one visible layer-set name, retain the
target pins and dimensions, and never scale imported coordinates. Missing
members are supplied only by native admission. There is no file-title, owner,
page-number or shared-name fallback.

## Private handles and fresh checks

Preparation returns a frozen opaque handle owned by that component instance.
`inspect(handle)` returns a detached complete candidate, per-page imported IDs,
source/target descriptors, different-version notice flag and target native
geometry/rendition/admission data. It is a preview, not application authority.
`getReadEvidence(handle)` returns detached exact request and read-result data
for future application and provenance integration; it defines no publication
claim format.

The synchronous guard is repeated around each asynchronous read, each
allocator call and inspection. Captured transport and dependency methods must
remain unchanged. `revalidate(handle)` makes a fresh native request and
compares the complete read result, including source and target content, pins,
membership, geometry, renditions and admissions. Denial, drift, disposal,
release or changed live work refuses the complete operation. A successful
revalidation issues no commit token and does not replace the application's
final participant checks.

`release(handle)` cleans up even after current-work refusal. `dispose()`
invalidates every handle and pending read. Failed operations do not mutate the
input snapshots, editor, history or drafts. Errors expose only
`layers-working-copy-import-unavailable`.

## Integration limits

A live group containing additional unsaved PDF members is refused. Such a
member may already contain work where the server prepared an empty admission;
it must never be replaced or silently removed. Editor integration must prove
its session-held native admission, reuse that live member and omit only its
redundant empty admission before this case can be supported.

Wholly missing target layer sets, editor/ResourceLoader registration, atomic
session/display/Undo/draft application and whole-group provenance through
ordinary owning-page Save remain separate work. Native/browser, supported
version, mobile and owner acceptance remain open. This checkpoint does not
complete milestone 1.
