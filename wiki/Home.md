# Layers

Layers adds editable annotations to **images and PDF pages** and creates **standalone slides**. Use it for diagrams, visual instructions, labels and markup without changing uploaded originals.

| Reference | Value |
| --- | --- |
| **Version (main)** | 1.5.95 |
| **Release Date** | September 2, 2026 |

The manifest still matches that release; documentation reviewed September 6, 2026. The main branch contains fixes after that tag. See [[Changelog]] and [[Current Status]].

## Choose a starting point

- [[Installation]] — install, upgrade and choose a compatible branch.
- [[Quick Start Guide]] — annotate an image, create a slide, or mark up a PDF.
- [[Slide Mode]] — standalone content, including visual SOPs.
- [[Drawing Tools]] and [[Keyboard Shortcuts]] — editor reference.
- [[Wikitext Syntax]] and [[Named Layer Sets]] — choose the content shown on a page.
- [[Configuration Reference]] and [[Permissions]] — administration.
- [[Troubleshooting]] and [[FAQ]] — common problems.
- [[API Reference]], [[Architecture Overview]], [[Frontend Architecture]], [[Contributing Guide]] and [[Testing Guide]] — development.

## Understand the current boundaries

Layers revisions are kept in its own database, normally up to 50 per set/document page. They do **not** provide reliable revisions of the article displaying the content. Text inside canvas annotations is not explicitly indexed by MediaWiki search. Cargo integration currently selects sets in galleries; annotation tables and field bindings are planned.

The next priorities are **revision history → MediaWiki search → Cargo queries/filtering**, with slide-based SOPs as a primary use case. Read [[Current Status]] before relying on Layers for controlled documents.

## Quick examples

```wikitext
[[File:Diagram.png|600px|layerset=on]]
{{#Slide: SafetyProcedure | canvas=1200x800 | size=800x600}}
[[File:Manual.pdf|page=2|600px|layerset=on]]
```

Create/save the content before embedding it. `layerset=on` selects the current set, while a name selects that exact set. `noedit` hides a slide edit button; authorization is controlled by permissions.

[Repository](https://github.com/slickdexic/Layers) · [Current findings](https://github.com/slickdexic/Layers/blob/main/codebase_review.md) · [Technical documentation](https://github.com/slickdexic/Layers/blob/main/docs/README.md)
