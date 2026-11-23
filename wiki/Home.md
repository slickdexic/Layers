# Layers

Layers is a MediaWiki extension for editable layers on images, PDF pages and
standalone slides. It preserves uploaded originals. Docker is only a
possible development/test environment, not a runtime requirement.

Layers 1.8 brings native page history, safer draft recovery and keyboard
access improvements to page-owned layer sets. Tagged 1.5.95 uses legacy
shared storage. Follow [[Installation]] and the
[upgrade procedure](https://github.com/slickdexic/Layers/blob/v1.8/docs/UPGRADING.md),
including migration and search cleanup before reopening readers.
See the [v1.8 release notes](https://github.com/slickdexic/Layers/releases/tag/v1.8)
and [GitHub Releases](https://github.com/slickdexic/Layers/releases).

| Current manifest and tagged baseline | Value |
| --- | --- |
| **Manifest version** | 1.8.0 |
| **Release date for this version** | November 23, 2026 |

## What Layers 1.8 does

A layer set belongs to one page and one file/slide. Save captures the complete
owner snapshot in one native page revision. Equal names on different owners or
files remain independent. A PDF keeps one visible set name across all its pages;
the PDF page number selects an internal member.

Use **Edit layers** and **View full size** on hover, focus or tap. Edit returns
to the owning page. Native history belongs to that owner. Ordinary embeds add
no owner/revision caption or automatic layer-set list above the content.
Images/slides offer PNG first and a separate PDF Download; PDFs offer PDF only.

## Start here

- [[Installation]] and the [upgrade guide](https://github.com/slickdexic/Layers/blob/v1.8/docs/UPGRADING.md): exact versions,
  backup, rehearsal, updater, discovery, dry run, completion and recovery.
- [[Quick Start Guide]], [[Slide Mode]], [[Drawing Tools]] and
  [[Keyboard Shortcuts]]: edit and use the existing tools.
- [[Wikitext Syntax]] and [[Named Layer Sets]]: choose this page's content.
- [[Configuration Reference]] and [[Permissions]]: administer Layers.
- [[Troubleshooting]] and [[FAQ]]: diagnose failures while preserving work.
- [Current release checklist](https://github.com/slickdexic/Layers/blob/v1.8/docs/MILESTONE_1_RELEASE_CHECKLIST.md),
  [[Current Status]] and [known limits](https://github.com/slickdexic/Layers/blob/v1.8/docs/KNOWN_ISSUES.md): qualified scopes
  and remaining acceptance. Old dated reports retain their historical scope.
- [[API Reference]] and the [native API guide](https://github.com/slickdexic/Layers/blob/v1.8/docs/PAGE_OWNED_API_GUIDE.md):
  current developer contracts and clearly labelled legacy APIs.

## Embed examples

Save these on the page that will own the layers, then use its overlay:

```wikitext
[[File:Diagram.png|thumb|400px|layerset=ABC]]
{{#Slide: Safety overview}}
[[File:Manual.pdf|page=2|400px|layerset=001]]
```

After completion, `layerset=on` selects `Default`. `off`/`none` hide layers.
Use the name only; never add native owner IDs or internal binding tokens to
author wikitext. Slide `noedit` hides the edit overlay without changing rights.

## Delivery order

Milestone 1 is page ownership/native history with existing capabilities intact.
Stable acceptance remains open. Page-owned text search is included after migration. Broader search
acceptance, Cargo readiness, Cargo integration and on-page object links remain
in the charter order. Those later milestones do not hold up page ownership, and object links
will not be active in the lightbox.

[Repository](https://github.com/slickdexic/Layers) ·
[Technical documentation](https://github.com/slickdexic/Layers/blob/v1.8/docs/README.md) ·
[Release preparation](https://github.com/slickdexic/Layers/blob/v1.8/docs/RELEASE_PREPARATION.md)
