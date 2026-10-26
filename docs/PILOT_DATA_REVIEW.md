# Earlier pilot data and current writer output

**October 26, 2026. Advances Milestone 1 / HIST-4 / HIST-8 / HIST-9 / DATA-1.**
This separates a read-only review of existing pre-release data from a correction
to newly written references. It is not a reconciliation command or permission
to rewrite earlier revisions.

## Read-only inventory

The intended wiki has 28 current page-owned snapshots containing 69 surfaces:
21 ordinary-page owners and seven File-page owners. All 28 snapshots were
readable by the production content class. The existing retained-file audit
matched metadata for 45 file/PDF surfaces; 24 slides are outside that audit's
file-only scope.

The literal direct-reference scanner found 50 owner-qualified references,
four bare-name/Default references and six native-control or unselected file
occurrences. No admitted reference selected a foreign owner. This scanner
deliberately excludes nested/dynamic syntax and opaque tags; it is not an
exhaustive template/gallery audit.

Three retained legacy groups have multiple current names, including page
suffixes introduced by older pilot migration code. Across the 11 currently
named PDF groups there were no repeated member-page numbers or mixed source
pins. Those latter checks do not prove that the split legacy groups have the
required whole-PDF identity: separate names can hide that relationship.

All eight observed persistent-table witnesses remained exact. No content,
name, binding, source pin or historical revision was changed. Shared-log bytes
were preserved under the existing approved immutable-prefix/ordinary-append
policy.

## Current writer correction

Separate native regressions demonstrated that, after migration completion,
scoped rename and direct whole-PDF copy still introduced owner IDs into newly
written wikitext. These are current output defects, not inferred defects from
the presence of older references.

The two callers now select the existing bare-name output mode after migration
completion. Before completion they retain the existing explicit-owner form,
when bare names still have legacy shared-set meaning. Input selection, scoped
identity, publication admission, source checks, copy attribution and group
preservation stay in place. Only targeted references are rewritten by the
existing scanner; unrelated text and old revisions remain exact.

Both regressions fail on the previous code and pass after correction. They
cover file-scoped whole-PDF rename alongside another file/slide of the same
name, mixed bare/older input, complete two-page copy, retained source content
and historical main text. The older native rename expectation now requires the
approved bare output. Existing pre-migration expectations stay explicit.

## Data disposition remains separate

The retained-file audit does **not** compare layer payloads or establish that
the current names/content were never edited. Its three split-name findings
must not trigger an automatic merge, rename or selection of another PDF page.

A separate read-only comparison covered all ten members of those three groups.
Their current complete surface values match their earliest stored occurrences.
Strict conversion of each exact retained legacy row also matches the current
kind, canvas, layers and source fields, excluding the deliberately different
current name. Each recorded source version resolves with its exact timestamp,
hash and native page geometry. This establishes current equality for these ten
members; it does not prove that no intermediate edit ever occurred, or qualify
other legacy payloads.

No repair was performed. A proposed current-page change must still enumerate
the affected references (including any template/gallery use), prove a complete
publication through normal admission, revalidate the exact base and obtain
owner approval. Historical snapshots stay preserved. Matching payloads alone
do not authorize a merge or automatic renaming.

The fresh 1.5.95 upgrade path and these older pilot records are different
starting states. A successful fresh migration does not silently repair an
already migrated pilot database. The [release ledger](RELEASE_1_8_ACCEPTANCE.md)
retains the need for owner disposition of the identified older data.
