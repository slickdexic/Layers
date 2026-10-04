# J113F — Pure whole-layer-set migration name allocation

**Date:** October 4, 2026. **Advances:** HIST-4/HIST-8/HIST-9 and DATA-1.
**Status:** pure helper accepted by the lead October 4; first-pass integration
is tracked separately in J113H. The junior return below was inactive.

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

## Junior implementation report — October 4, 2026

**Role:** Junior engineer. **Status:** implemented and verified; pure component inactive; returned for lead review.
**Advances:** HIST-4/HIST-8/HIST-9 and DATA-1.

### 1. Changed paths

- `src/Migration/MigrationNameAllocator.php` (new helper)
- `tests/phpunit/unit/Migration/MigrationNameAllocatorTest.php` (new unit regression suite)
- `docs/J113F_MIGRATION_NAME_ALLOCATION_PACKET.md` (this report appended)

No other files were created or modified.

### 2. Implemented contract

Implemented `MediaWiki\Extension\Layers\Migration\MigrationNameAllocator::allocate( array $existingSurfaces, array $newGroups ): array` matching the frozen specification:
- Pure helper that allocates one name for an entire incoming PDF layer set within its file scope.
- Accepts already-decoded `stdClass[]` destination snapshot without mutation or revalidation.
- Performs destination preflight to record existing surface IDs and taken names per scope.
- Validates all incoming groups and members before performing any allocation, rejecting with `InvalidArgumentException` on:
  - Missing, empty, or duplicate group keys;
  - Missing or non-string `wanted`, or invalid `wanted` according to `DrawingName::normalize()`;
  - Empty or non-array `members`;
  - Non-`stdClass` members, missing or non-string/empty member IDs;
  - Duplicate member IDs anywhere in the incoming request or already present in destination;
  - Invalid member kinds (must be `image`, `pdf`, or `slide`);
  - Member labels not equal to literal group `wanted`;
  - Image or slide groups with member counts other than 1;
  - Slide members containing a `source` property;
  - File members missing a `stdClass` source or nonempty string canonical `fileTitle`;
  - File members with invalid source pages (image page != 1, PDF page <= 0 or non-integer);
  - PDF groups with repeated page numbers;
  - Mixed kinds or mixed file scopes within a single group.
- Preserves input objects and arrays completely: never modifies incoming groups, members, or destination surfaces.
- Scopes names using `LayerSetIdentity::scope()`, ensuring equal names on different canonical files or standalone slides do not conflict.
- Allocates one name per group via `DrawingName::unused()` and reserves that allocated name within its scope before processing subsequent groups.
- Preserves numeric-looking opaque group keys (such as `'0'`, `'007'`, `'123'`) as strings in the ordered result list.
- An empty `$newGroups` request returns `[]`.

### 3. Verification and gate results

- **Focused unit class:**
  `php vendor/bin/phpunit --configuration phpunit.xml tests/phpunit/unit/Migration/MigrationNameAllocatorTest.php`
  `OK (27 tests, 91 assertions)`
- **Full standalone suite:**
  `php vendor/bin/phpunit --configuration phpunit.xml --testsuite Unit`
  `OK, but incomplete, skipped, or risky tests! Tests: 1513, Assertions: 3753, Skipped: 1`
  (Baseline 1,486 tests / 3,662 assertions / 1 skip + 27 new tests / 91 assertions = 1,513 / 3,753 / 1 skip).
- **Changed-file PHPCS:**
  `php vendor/bin/phpcs -sp --cache --runtime-set ignore_warnings_on_exit 1 src/Migration/MigrationNameAllocator.php tests/phpunit/unit/Migration/MigrationNameAllocatorTest.php`
  `.. 2 / 2 (100%) - OK (0 errors, 0 warnings)`
- **Parallel lint:**
  `php -d error_reporting=8191 vendor/bin/parallel-lint src/Migration/MigrationNameAllocator.php tests/phpunit/unit/Migration/MigrationNameAllocatorTest.php`
  `Checked 2 files in 0.1 seconds - No syntax error found`
- **Minus-X whitespace check:**
  `php vendor/bin/minus-x check src/Migration && php vendor/bin/minus-x check tests/phpunit/unit/Migration`
  `All good!`
- **PHP references gate:**
  `node scripts/check-php-class-refs.js`
  `PHP class references OK (127 files, 127 extension classes).`
- **Parallel lists check:**
  `node scripts/check-parallel-lists.js`
  `Parallel lists agree (boolean properties, layer types, page-owned renderable types).`
- **Atomicity check:**
  `node scripts/check-atomicity.js`
  `Atomic section usage OK.`
- **Documentation check:**
  `node scripts/verify-docs.js`
  `Documentation checks passed: 87 maintained/policy documents, 53 historical records; mirrors, references and MediaWiki source checks agree.`
- **Git diff whitespace check:**
  `git diff --check`
  Clean (exit code 0).

### 4. Negative controls

All three negative controls were demonstrated against focused tests, observed to fail as specified, and restored:

1. **Control 1: Flatten reserved names across all file/slide scopes**
   - Mutation: Temporarily flattened destination preflight and group allocation scopes into a single global key `__FLATTENED_SCOPE__`.
   - Command: `php vendor/bin/phpunit --configuration phpunit.xml --filter testExistingNameOnDifferentFileAndSlideDoNotConflictWhileSameFileCollides tests/phpunit/unit/Migration/MigrationNameAllocatorTest.php`
   - Observed failure:
     ```text
     1) MediaWiki\Extension\Layers\Tests\Unit\Migration\MigrationNameAllocatorTest::testExistingNameOnDifferentFileAndSlideDoNotConflictWhileSameFileCollides
     Failed asserting that two arrays are identical.
     --- Expected
     +++ Actual
     @@ @@
      Array &0 (
          0 => Array &1 (
              'key' => 'g-target'
     -        'name' => 'ABC'
     +        'name' => 'ABC 2'
          )
      )
     ```
   - Restoration: Restored `LayerSetIdentity::scope()`. File SHA256 verified identical: `2BBFEE098592F58F2F497EA4B7BE0A29D7A5CA3EC6220EE86426ABA91FE4D71D`.
   - Rerun filter: `OK (1 test, 4 assertions)`.

2. **Control 2: Allocate and reserve separately for each PDF member, returning last member's allocation**
   - Mutation: Retained group members in validated group data and looped over each member, allocating and reserving for each member and returning the final allocation.
   - Command: `php vendor/bin/phpunit --configuration phpunit.xml --filter testOnePdfGroupWithMultiplePagesReceivesNameOnceAndPreservesInputBytes tests/phpunit/unit/Migration/MigrationNameAllocatorTest.php`
   - Observed failure:
     ```text
     1) MediaWiki\Extension\Layers\Tests\Unit\Migration\MigrationNameAllocatorTest::testOnePdfGroupWithMultiplePagesReceivesNameOnceAndPreservesInputBytes
     Failed asserting that two arrays are identical.
     --- Expected
     +++ Actual
     @@ @@
      Array &0 (
          0 => Array &1 (
              'key' => 'g-pdf'
     -        'name' => 'ABC'
     +        'name' => 'ABC 2'
          )
      )
     ```
   - Restoration: Restored single allocation per group. File SHA256 verified identical: `2BBFEE098592F58F2F497EA4B7BE0A29D7A5CA3EC6220EE86426ABA91FE4D71D`.
   - Rerun filter: `OK (1 test, 5 assertions)`.

3. **Control 3: Omit reservation of first incoming group's allocation**
   - Mutation: Temporarily skipped `$takenByScope[$scope][] = $allocated` for the first group (`$isFirstGroup = true`).
   - Command: `php vendor/bin/phpunit --configuration phpunit.xml --filter testTwoIncomingGroupsOnSameFileWithEquivalentNamesReserveSequentially tests/phpunit/unit/Migration/MigrationNameAllocatorTest.php`
   - Observed failure:
     ```text
     1) MediaWiki\Extension\Layers\Tests\Unit\Migration\MigrationNameAllocatorTest::testTwoIncomingGroupsOnSameFileWithEquivalentNamesReserveSequentially
     Failed asserting that two arrays are identical.
     --- Expected
     +++ Actual
     @@ @@
          )
          1 => Array &2 (
              'key' => 'k2'
     -        'name' => 'pump_LABELS 2'
     +        'name' => 'pump_LABELS'
          )
          2 => Array &3 (
              'key' => 'k3'
     -        'name' => 'Pump labels 3'
     +        'name' => 'Pump labels 2'
          )
     ```
   - Restoration: Restored unconditional per-group reservation. File SHA256 verified identical: `2BBFEE098592F58F2F497EA4B7BE0A29D7A5CA3EC6220EE86426ABA91FE4D71D`.
   - Rerun filter: `OK (1 test, 3 assertions)`.

### 5. Explicit declarations and remaining limitations

- No production callers were activated.
- No stored records were renamed or merged.
- No changes to UI, translations, API routes, configurations, or fixtures.
- No ordinary wiki writes, commit, or push occurred.
- Component is inactive pending lead integration into migration passes. Source grouping, exact-revision selection, stable IDs, resume/partial-import handling, source provenance, publication, and undo remain with the lead.
- This implementation does not claim J113, migration, or any charter criterion complete. Returned for lead review.

## Lead acceptance — October 4, 2026

Accepted against the frozen pure-helper contract after source/test review and
a delegated read-only review. No actionable defect was found. Fresh full
standalone **1,513 tests / 3,753 assertions / one existing skip** and four-file
PHP style checks pass. The current raw helper SHA-256 matches the junior's
recorded restoration value. All three control runs remain attributed to the
junior; the lead did not repeat them or infer unobserved historical evidence.

The return activated no caller. The subsequent lead-owned J113H first-pass
integration is separate work; copying, provenance, partial imports and undo
remain caller responsibilities. This is component acceptance, not complete
migration or HIST-4/HIST-8/HIST-9/DATA-1 acceptance.
