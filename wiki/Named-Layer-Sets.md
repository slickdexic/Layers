# Named layer sets

Reviewed October 24, 2026 against the page-owned candidate. Tagged 1.5.95 uses
older shared storage. Follow [the upgrade instructions](https://github.com/slickdexic/Layers/blob/codex/l01-publication-admission/docs/UPGRADING.md)
before relying on post-migration behavior. Milestone 1 acceptance remains open.

## Ownership and names

A layer set belongs to **one wiki page and one file or slide**. Its name alone
is not its identity. Two pages may each have a set named `ABC` for the same file;
editing one does not change the other. Two different files on one page may also
each have an independent set named `ABC`.

A PDF has one visible layer-set name across its pages. For example, `001` on
`Manual.pdf` remains `001` on pages 1 through 99. The PDF page number selects an
internal member; it does not add a suffix to the name shown to the user.

```wikitext
[[File:Diagram.png|thumb|400px|layerset=ABC|Labels for this page]]
[[File:Other.png|thumb|400px|layerset=ABC|An independent layer set]]
[[File:Manual.pdf|page=1|400px|layerset=001]]
[[File:Manual.pdf|page=2|400px|layerset=001]]
```

Write the name only. Do not put owner page IDs or internal member identifiers in
wikitext. Importing from another page creates local work; it does not share future
edits between source and destination.

## Create, edit and select

1. Save the image, PDF or slide embed on its owning page.
2. Use its **Edit layers** overlay, available on hover, focus or tap when the
   user may edit. **View full size** opens the viewer.
3. Edit and **Save**, then reopen the same embed on the owning page to check it.

An eligible missing named set can open empty for an authorized editor. It must
not display a different saved set as a substitute. Readers gain no editing
rights from a missing set or a visible embed.

Use an explicit name to select a particular set. After migration completion,
`layerset=on` selects `Default`; it does not mean the most recently saved set.
`layerset=off` and `layerset=none` suppress layers. A name that is also a display
command can use a literal-name selector, such as `layerset=name:on` for a set
named `on`. Prefer descriptive names that avoid that ambiguity.

## Naming rules

Page-owned names allow up to 255 Unicode characters after trimming and
collapsing whitespace, subject also to the snapshot label limit of 512 UTF-8
bytes. Spaces, dots, parentheses, hyphens and underscores are
allowed. Control characters and `| [ ] { } < > :` are not.

Names compare without case differences; runs of spaces and underscores compare
alike. `Safety Labels`, `safety_labels` and `SAFETY LABELS` identify the same name
within one owner/file scope. Stored spelling remains the display label. Do not
use capitalization alone to create variants.

| Example | Valid page-owned name? |
| --- | --- |
| `001` | Yes; numeric names are names, not row IDs. |
| `Safety Labels` | Yes. |
| `Tutorial (EN)` | Yes. |
| `version 2.0` | Yes. |
| `Chapter:One` | No; contains a colon. |
| `Labels` followed by a vertical bar | No; contains an option separator. |

Migration may allocate a numbered name to avoid a collision in the same scope.
This is different from numbering individual PDF pages. Check the completed
migration report and saved page before changing existing embeds.

## Native Save and history

Save publishes the owner's complete layer snapshot as one native page revision,
preserving unrelated sets, including every member of an edited PDF set. It is
not a series of independent legacy page saves.

Use the **owning page's history** for earlier saved content and the available
comparison/restoration workflows. Local draft recovery is separate: restoring
a draft does not create a page revision until Save succeeds.

Renaming or removing a page-owned set changes the current snapshot. Earlier
readable native revisions retain their content. Legacy warnings that deletion
permanently removes all set revisions do not describe native history. Ordinary
revision visibility, suppression and restoration rules still apply. Refused or
stale Saves must preserve unsaved work.

## Permissions and limits

Editing requires read/edit authority on the **owning page**, `editlayers`,
readable sources and fresh revision/source checks. File-page edit permission
alone does not authorize another page's sets. See [[Permissions|Permissions]].

Native document limits are 2 MiB serialized content, 100 members, 100 layers per
member and 1,000 total layers. PDF members count toward these limits while
sharing one visible name. Legacy `LayersMaxNamedSets` and
`LayersMaxRevisionsPerSet` settings do not raise native schema limits or prune
native history. See [[Configuration Reference|Configuration-Reference]].

## Older shared sets and APIs

Before completion, shared sets use Layers-specific storage and retained
revisions. Their selection, stricter naming, creator-based rename/delete and
configured retention differ from the native model. Legacy shared `on` selection
uses recency, and legacy deletion can remove retained revisions.

After completion, those shared sets remain read-only. Do not use `layerssave`,
`layersrename` or `layersdelete` to update page-owned sets. Use the owner-page
editor; integrations must follow the [API guide](https://github.com/slickdexic/Layers/blob/codex/l01-publication-admission/docs/PAGE_OWNED_API_GUIDE.md).

## See also

- [[Wikitext Syntax|Wikitext-Syntax]]
- [[Slide Mode|Slide-Mode]]
- [[Quick Start|Quick-Start-Guide]]
- [Upgrade and recovery](https://github.com/slickdexic/Layers/blob/codex/l01-publication-admission/docs/UPGRADING.md)
