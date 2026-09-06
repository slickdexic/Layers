# Layers for MediaWiki

[![CI](https://github.com/slickdexic/Layers/actions/workflows/ci.yml/badge.svg)](https://github.com/slickdexic/Layers/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-GPL--2.0--or--later-blue)](COPYING)

Create annotations on **images and PDF pages**, or build **standalone slides** without a background file. Layers stores drawing data separately from uploaded files and displays it with a canvas viewer.

> **Version:** 1.5.95 (September 2, 2026) — latest tagged release; manifest remains at this version.

**Documentation updated: September 6, 2026.** `main` includes subsequent fixes; see [Unreleased changes](CHANGELOG.md#unreleased). Requirements: MediaWiki >=1.44 and the PHP/database versions required by your MediaWiki release. Use a currently supported core release.

> **Current limitation:** Layers' own revision list is not the owning article's page history. Annotation full-text search and Cargo annotation tables are also not implemented. For SOPs or controlled documents, read [Current status and limitations](docs/CURRENT_STATUS.md) before deployment.

## Start here

| Task | Documentation |
| --- | --- |
| Install or upgrade | [Installation](wiki/Installation.md) |
| Make your first annotation or slide | [Quick start](wiki/Quick-Start-Guide.md) |
| Embed content | [Wikitext syntax](wiki/Wikitext-Syntax.md) |
| Configure limits and permissions | [Configuration](wiki/Configuration-Reference.md) · [Permissions](wiki/Permissions.md) |
| Resolve a problem | [Troubleshooting](wiki/Troubleshooting.md) · [Known issues](docs/KNOWN_ISSUES.md) |
| Integrate or contribute | [API](wiki/API-Reference.md) · [Contributing](CONTRIBUTING.md) · [Documentation index](docs/README.md) |
| Browse online | [GitHub wiki](https://github.com/slickdexic/Layers/wiki) |

## Content types

| Type | Edit | Embed |
| --- | --- | --- |
| Image | Open its File page and choose Edit Layers | `[[File:Diagram.png|600px|layerset=annotations]]` |
| PDF | Open its File page, choose Edit Layers and select a document page | `[[File:Manual.pdf|page=2|600px|layerset=annotations]]` |
| Standalone slide | Open `Special:EditSlide/SafetyProcedure` or create through `Special:Slides` | `{{#Slide: SafetyProcedure | size=800x600 | layerset=annotations}}` |

Create/save the named set used in each example. `layerset=on` selects the current set; `layerset=default` requests the set literally named `default`. `layerset=none` disables annotations. The older `layers=` spelling remains supported. Prefer descriptive set names over values that resemble on/off flags.

For slides, `canvas=1200x800` specifies creation dimensions and `size=800x600` controls display size. `noedit` hides an edit button; it does not revoke editing permission.

PDFs require working MediaWiki PDF thumbnails, normally through PdfHandler and its dependencies. Standalone slides do not require PdfHandler. Imported images within slides still depend on their saved assets.

## Editor and viewer

- Text, rich textboxes, callouts, shapes, arrows, freehand drawing, markers and dimensions.
- Imported images, the built-in shape library and emoji picker.
- Selection, resizing, rotation, alignment, grouping, style presets and undo/redo.
- Named sets with separate Layers revisions; default retention is 50 revisions per set/document page.
- Inline and lightbox viewing, plus client-side export/print workflows. Server PDF export has known fidelity limitations.

See [Drawing tools](wiki/Drawing-Tools.md), [Keyboard shortcuts](wiki/Keyboard-Shortcuts.md) and [Slide mode](wiki/Slide-Mode.md).

When navigating a PDF, edited pages are buffered in memory. Save writes changed pages individually; this is **not an atomic document transaction**. Failed pages remain unsaved. Do not close the browser until saving succeeds. Review recovered drafts before applying them.

## Installation summary

From the wiki's `extensions` directory:

```sh
git clone https://github.com/slickdexic/Layers.git
```

In `LocalSettings.php`:

```php
wfLoadExtension( 'Layers' );
```

From the MediaWiki root:

```sh
php maintenance/run.php update
```

The updater creates/migrates `layer_sets`. Do not manually create tables from a documentation sample. Back up the database and uploads before upgrading. No Node/Composer developer toolchain is required just to load the committed extension assets.

`REL1_43` is the separate branch for MediaWiki 1.43; consult its own changelog and verify security backports. `REL1_39` is unmaintained. Do not treat a branch name as evidence of parity with `main`.

## Cargo today and the roadmap

Cargo galleries can select named layer sets from a `layerset` query field:

```wikitext
{{#cargo_query:tables=Equipment|fields=Image,layerset|format=gallery}}
```

This example assumes your Cargo table defines those fields. It does not expose annotation text as Cargo rows or link textbox contents to Cargo values.

The agreed next priorities are **page-owned revision history**, **MediaWiki search for annotation/slide text**, and **Cargo query/filter support**. See the [proposal](docs/proposals/CARGO_SEARCH_PAGE_HISTORY.md); these are not released features.

## Validation and security

The September 6 checkpoint passed 180 JavaScript suites / 14,310 tests, PHP QA, and 686 PHPUnit tests (one skipped). Coverage was not remeasured. See [the verification scope](docs/CURRENT_STATUS.md) rather than treating test counts as a guarantee of correctness.

Read [Security guidance](SECURITY.md) for private reporting, permissions, export storage and dependency checks. [The codebase review](codebase_review.md) tracks both fixes and open findings.

## License

GPL-2.0-or-later. See [COPYING](COPYING) and [third-party licenses](THIRD_PARTY_LICENSES.md).
