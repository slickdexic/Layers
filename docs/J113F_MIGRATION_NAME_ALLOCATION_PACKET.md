# J113F — Pure whole-layer-set migration name allocation

**Date:** October 4, 2026. **Advances:** HIST-4/HIST-8/HIST-9 and DATA-1.
**Status:** ready for the owner to dispatch; not implemented or accepted.

Junior engineer, implement this bounded helper and return it for lead review.
Read the charter's “Read this first”, `AGENTS.md` and the active handoff queue
before starting. Preserve the accepted J112/J113 work and unrelated changes.
Use “layer” and “layer set” in anything a person reads.

## Purpose and integration boundary

The migration's first pass still allocates names per stored PDF page; the copy
pass also allocates per stored surface. The approved identity is the owning
wiki page, canonical file and layer-set name. PDF page numbers identify internal
members; all members receive one name. Equal names on different files or on a
standalone slide are valid and do not conflict.

Implement a pure allocation component that the lead can integrate into both
migration passes. Do not activate it, change migration callers or repair existing
names. The lead retains source grouping, exact-revision selection, stable IDs,
resume/partial-import handling, source provenance, publication and undo. This
packet introduces no new source-version policy or runtime dependency.

## Allowed files

- New `src/Migration/MigrationNameAllocator.php`.
- New `tests/phpunit/unit/Migration/MigrationNameAllocatorTest.php`.
- Append your implementation/evidence report to this packet.

Do not change any other file. If a demonstrated defect requires broader scope,
report the exact failing case and return it to the lead. No production caller,
API, translation, UI, configuration, fixture or migration command is in scope.
Do not make ordinary wiki writes, commit or push.

## Frozen helper contract

Use namespace `MediaWiki\Extension\Layers\Migration`, a final class and this
public method:

```php
public static function allocate( array $existingSurfaces, array $newGroups ): array
```

`$existingSurfaces` is the destination's already-decoded, validated `stdClass[]`
snapshot. Its historic duplicate names may reserve a name more than once; do
not reject, rename, merge, repair or mutate that snapshot. Do not revalidate
geometry or source-version pins. Each incoming group has this exact structure:

```text
{ key: nonempty string, wanted: string, members: nonempty stdClass[] }
```

Return an ordered list, one entry per incoming group, in input group order:

```text
{ key: original string, name: allocated string }
```

Return no replacement surfaces. Never modify input objects or arrays. Use the
existing `DrawingName::normalize()`, `DrawingName::unused()` and
`LayerSetIdentity::scope()` rules; do not implement another naming scheme.
An empty `$newGroups` request returns `[]` with the destination unchanged.
An empty `$newGroups` request returns `[]` with the destination unchanged.

1. Validate every incoming group before allocation. Reject an empty/duplicate
   key, invalid wanted name, empty group, invalid member topology or identity
   with `InvalidArgumentException`. Do not fall back to an ID-derived name.
2. Each member is a `stdClass` with a nonempty string `id`, kind `image`, `pdf`
   or `slide`, and a string `label` exactly equal to the group's literal
   `wanted`. A file member has a `stdClass` source with a nonempty string canonical
   `fileTitle` supplied by the caller and an integer page greater than zero.
   Image pages must be 1. A slide has no `source` property. Do not perform I/O to
   canonicalize titles or resolve media.
3. Every member of a group has the same kind and file/slide scope. A PDF group
   may contain several distinct internal pages; repeated page numbers are
   refused. An image or slide group contains exactly one member. Reject
   duplicate member IDs anywhere in the request, and IDs already present in
   the destination. This is allocation for wholly new groups, not resume.
4. Normalize `wanted` once, allocate once in that group's scope and reserve the
   resulting name before processing the next incoming group in the same
   scope. Existing PDF pages reserve their shared name; they do not each consume
   another suffix. Names on other files or on slides do not reserve a file name.
5. Member order does not affect a group's name. Incoming group order determines
   the order in which actual collisions are allocated. Do not sort groups or
   merge them because names normalize to the same comparison key.
6. Preserve legitimate literal names such as `Notes (page 2)`. Do not strip a
   suffix, infer a former name or fold historic split sets into a new group.

The caller will group converted source records by exact canonical file and
**exact literal source name** at an admitted revision. For first-pass migration,
this is the retained legacy row's name; for copying it is the selected current
source group's stored name, not a reconstructed original legacy name.
Distinct raw names that
normalize alike remain distinct incoming groups and receive distinct names
when they share a file. `key` is an opaque caller identifier, not a layer-set
identity, provenance proof or author-facing name. It remains a string in the
ordered result, including when it resembles a number.

Existing same-name members never authorize joining an incoming group. For
example, if the destination already has PDF page 7 named `ABC 2`, an incoming
new page-3 group wanting `ABC 2` receives `ABC 2 2`; it does not become another
page of that existing set. The lead must separately decide whether an import
is an exact rerun, an incomplete import or a new group before calling this
helper. Retained-row IDs alone do not prove an untouched payload.

## Required regression evidence

Write tests that exercise the returned names and compare complete input bytes
before and after successful and refused requests. Use deterministic snapshot
serialization and include layer properties/source pins in preservation cases.

- One PDF group containing pages 1 and 3 receives `ABC` once. Reverse the member
  order and require the same allocation and unchanged input bytes.
- Existing `ABC` on another file and an `ABC` slide do not conflict. Existing
  `ABC` on the same canonical file forces one `ABC 2` for the incoming group.
- Existing same-file `ABC 2` on page 7 and a new page-3 group wanting `ABC 2`
  produce `ABC 2 2`, proving that allocation does not append to an existing set.
- Two distinct incoming groups on the same file wanting equivalent names
  reserve sequentially. Include case/underscore/space equivalence and distinct
  literal source names. Equivalent names on different files both remain free.
- `Notes (page 2)` remains literal. Multi-byte names at the existing 255-character
  boundary use the established truncation/suffix behavior and remain valid.
- Refuse mixed files, mixed kinds, repeated PDF pages, image page 2, empty or
  duplicate group keys, invalid names, duplicate incoming IDs and an ID already
  in the destination. Preserve input bytes in every refusal case.
- Preserve numeric-looking opaque group keys as strings in the ordered result.
  Preserve historic destination duplicates without synthesizing changes.

## Negative controls and verification

Demonstrate all three controls against focused tests, one at a time:

1. Temporarily flatten reserved names across all file/slide scopes. The
   different-file/slide test must fail.
2. Temporarily allocate and reserve separately for each PDF member, returning
   the last member's allocation for that group. The two-page `ABC` test must
   observe `ABC 2` and fail. Do not alter assertions to manufacture a failure.
3. Temporarily omit reservation of the first incoming group's allocation. The
   second colliding-group test must fail.

Record commands and observed failures. Restore the exact implementation bytes
after each control and rerun the affected filter successfully before proceeding.
Run the focused unit class, then the full standalone suite, changed-file PHP
style, PHP references, parallel-list/atomicity checks, documentation and
`git diff --check`. Follow existing PHPUnit/unit conventions and bootstrap;
do not modify shared bootstrap or Composer configuration. Docker/native/browser
execution is not required for this pure inactive component. Lead integration
will require native migration/resume/undo coverage before activating callers.

## Return report

Append changed paths, the implemented contract, exact commands/results, all
three control failures and restoration fingerprints, and remaining limitations.
State explicitly that no production callers were activated, no stored records
were renamed/merged and no wiki writes, commit or push occurred. Return for lead
review; do not claim J113, migration or any charter criterion complete.
