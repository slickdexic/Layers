# Layers for MediaWiki

**Layers is a MediaWiki extension, not a Docker-based application. Docker is only used for our development/test environment. Layers features must not require or provide Docker workers, host supervisors, PowerShell or .NET backends.**

[![CI](https://github.com/slickdexic/Layers/actions/workflows/ci.yml/badge.svg)](https://github.com/slickdexic/Layers/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-GPL--2.0--or--later-blue)](COPYING)

Add layers to **images and PDF pages**, or build **standalone slides** without a background file. In the page-history candidate, a layer set belongs to its wiki page and file or slide. Saving creates a native revision of the owning page; uploaded originals remain separate.

> **Version:** 1.5.95 (September 2, 2026) — latest tagged release; manifest remains at this version.

**Release scope updated: October 25, 2026.** The page-history candidate targets an independent **Layers 1.8** release (working version). Later search, Cargo and layer-link milestones continue toward 2.0. Version/tag assignment follows release acceptance. See the [Milestone 1 release checklist](docs/MILESTONE_1_RELEASE_CHECKLIST.md) and choose a reviewed commit with passing CI. Requirements: MediaWiki >=1.44 and the PHP/database versions required by your MediaWiki release. Use a currently supported core release.

> **Upgrade prerequisite:** Page-owned embed selection starts after the documented migration records completion, including on a fresh wiki with no legacy layer sets. Until then, legacy lookup remains active. Follow the [upgrade guide](docs/UPGRADING.md); do not delete retained legacy data or change completion records manually.

## Start here

| Task | Documentation |
| --- | --- |
| Install or upgrade | [Installation](wiki/Installation.md) |
| Make your first layer set or slide | [Quick start](wiki/Quick-Start-Guide.md) |
| Review candidate readiness | [Release checklist](docs/MILESTONE_1_RELEASE_CHECKLIST.md) · [Release preparation](docs/RELEASE_PREPARATION.md) |
| Embed content | [Wikitext syntax](wiki/Wikitext-Syntax.md) |
| Configure limits and permissions | [Configuration](wiki/Configuration-Reference.md) · [Permissions](wiki/Permissions.md) |
| Resolve a problem | [Troubleshooting](wiki/Troubleshooting.md) · [Known issues](docs/KNOWN_ISSUES.md) |
| Integrate or contribute | [API](wiki/API-Reference.md) · [Contributing](CONTRIBUTING.md) · [Documentation index](docs/README.md) |
| Browse online | [GitHub wiki](https://github.com/slickdexic/Layers/wiki) |

## Content types

| Type | Edit | Embed |
| --- | --- | --- |
| Image | Use **Edit layers** on the embed in its owning page | `[[File:Diagram.png|600px|layerset=annotations]]` |
| PDF | Use the owning page's **Edit layers** overlay; navigate PDF pages inside the editor | `[[File:Manual.pdf|page=2|600px|layerset=annotations]]` |
| Standalone slide | Save the embed on its owning page, then use **Edit layers** | `{{#Slide: SafetyProcedure | size=800x600}}` |

These examples describe the candidate after migration completion. Create or save the named layer set through its overlay. `layerset=on` selects Default; explicit names select that owner's set for the file. `layerset=none` or `off` hides layers. The older `layers=` spelling remains supported. Equal names on different owners or files are independent. Every page of one PDF layer set keeps the same visible name.

For slides, `canvas=1200x800` specifies creation dimensions and `size=800x600` controls display size. `noedit` hides an edit button; it does not revoke editing permission.

PDFs require working MediaWiki PDF thumbnails, normally through PdfHandler and its dependencies. Standalone slides do not require PdfHandler. Imported images within slides still depend on their saved assets.

## Editor and viewer

- Text, rich textboxes, callouts, shapes, arrows, freehand drawing, markers and dimensions.
- Imported images, the built-in shape library and emoji picker.
- Selection, resizing, rotation, alignment, grouping, style presets and undo/redo.
- Named layer sets stored in native owner-page revisions after migration, with history, diffs and restoration. Legacy table retention settings do not prune native page history.
- Inline overlays and a full-size viewer with Print and Download. Images/slides offer PNG first and an explicit PDF option; PDFs download as PDF only. Exports include saved layers.

See [Drawing tools](wiki/Drawing-Tools.md), [Keyboard shortcuts](wiki/Keyboard-Shortcuts.md) and [Slide mode](wiki/Slide-Mode.md).

PDF page turns preserve pending work. The page-owned Save publishes the complete owner snapshot in one native page revision, including the PDF's members. A refusal keeps work unsaved; review recovery or conflict choices before continuing. Browser/device qualification and owner acceptance are tracked separately in the release checklist.

## Installation summary

From the wiki's `extensions` directory:

```sh
git clone https://github.com/slickdexic/Layers.git
git -C Layers checkout --detach REVIEWED_COMMIT_OR_TAG
```

Replace `REVIEWED_COMMIT_OR_TAG` with the release or candidate selected for
deployment. Check CI for that exact commit; the manifest version and a badge for
another branch do not identify the tested candidate.

In `LocalSettings.php`:

```php
wfLoadExtension( 'Layers' );
```

From the MediaWiki root:

```sh
php maintenance/run.php update
```

The updater creates/migrates `layer_sets`. Do not manually create tables from a documentation sample. Back up the database and uploads before upgrading. No Node/Composer developer toolchain is required just to load the committed extension assets. To move shared layer sets and slides into page history, follow the [upgrade guide](docs/UPGRADING.md).

`REL1_43` is the separate branch for MediaWiki 1.43; consult its own changelog and verify security backports. `REL1_39` is unmaintained. Do not treat a branch name as evidence of parity with `main`.

## Cargo today and the roadmap

Cargo galleries can select named layer sets from a `layerset` query field:

```wikitext
{{#cargo_query:tables=Equipment|fields=Image,layerset|format=gallery}}
```

This example assumes your Cargo table defines those fields. It does not expose layer text as Cargo rows or link textbox contents to Cargo values.

The delivery order is **page ownership/history**, **MediaWiki text search**, **Cargo readiness**, **Cargo integration**, then **links from layer objects on wiki pages**. Later milestones do not delay the first. Existing Cargo gallery selection is preserved; broader Cargo and search acceptance is separate from the page-history candidate.

## Validation and security

Use CI for the exact candidate commit and the [release checklist](docs/MILESTONE_1_RELEASE_CHECKLIST.md). The [HTTP checkpoint](docs/MILESTONE_1_HTTP_PRIVACY_ACCEPTANCE.md) and [server performance measurements](docs/PAGE_HISTORY_PERFORMANCE.md) record their tested scope. Passing tests do not replace the project owner's acceptance.

Read [Security guidance](SECURITY.md) for private reporting, permissions, export storage and dependency checks. [The codebase review](codebase_review.md) tracks both fixes and open findings.

## License

GPL-2.0-or-later. See [COPYING](COPYING) and [third-party licenses](THIRD_PARTY_LICENSES.md).
