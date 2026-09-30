# Upgrading to drawings in page history

[Charter](PROJECT_CHARTER.md) criterion OPS-1. This guide takes a wiki from Layers 1.5.x, where annotations are shared layer sets stored beside the file, to drawings that belong to pages and live in their revision history (decisions D1 to D3 in the charter). Layers is a MediaWiki extension; everything here uses MediaWiki's own updater and maintenance scripts.

## What changes

- **Before the migration** a wiki behaves as in 1.5.x. Shared sets and slides can be edited, and `layerset=<name>` and `{{#Slide:<name>}}` show them. Pages in `$wgLayersPageDrawingNamespaces` (by default the content namespaces and `File:`) can also have drawings of their own.
- **The migration** copies every shared set and slide into page history, as ordinary bot edits: a file's current sets become drawings of its `File:` page, every page that shows a set or slide gets its own copy, and a shared slide that no page shows gets a page `Slide:<name>`. It only reads the `layer_sets` table and never changes it.
- **After the migration** a bare `layerset=<name>` or `{{#Slide:<name>}}` means the page's own drawing of that name, and `layerset=on` (or a gallery image without a name) means the page's only drawing of that file. Shared sets and slides are read-only; their old revisions stay viewable. The File page lists its own drawings, and the old editor links lead to them. `meta=siteinfo` reports `layerspagehistorymigrated: true`.

## 1. Back up

Back up the database, the upload directory and `LocalSettings.php`, and record the Layers commit you are running. The migration can be undone (step 6), but a backup is the only way back from anything else.

## 2. Update the code and the database

From the MediaWiki `extensions/Layers` directory, update the checkout, then from the MediaWiki root run the updater:

```sh
git pull --ff-only
php maintenance/run.php update
```

Drawings are stored in a revision slot named `layers` with the content model `layers-document`; MediaWiki registers both the first time they are used, so the updater has nothing to add for them.

Check `$wgLayersPageDrawingNamespaces` in the [configuration reference](../wiki/Configuration-Reference.md). A page outside those namespaces that shows shared sets is listed by the migration as `namespace-not-enabled` and keeps showing nothing of them afterwards.

## 3. Refresh links

The migration finds sets shown through templates and galleries in each page's `layers-shown-sets` page property. Pages last parsed by an older Layers have no record of their galleries, and some have none at all, so refresh them and let the job queue finish:

```sh
php maintenance/run.php refreshLinks
php maintenance/run.php runJobs
```

Pages that show sets directly in their text are found from the text itself.

## 4. Dry run

From the MediaWiki root:

```sh
php extensions/Layers/maintenance/migrateLayersToPageHistory.php
```

Nothing is written. The script lists what each step would do, one line per page: `add drawing` and `copy` lines for new drawings, `point embeds at its own drawings` where it rewrites a page's embeds to name its copies, and `not moved` or `not copied` lines with a reason. Read the reasons before committing:

| Reason | Meaning |
| --- | --- |
| `earlier-file-version` | The set was saved on an older version of the file. Legacy embeds did not show it either. |
| `missing-file`, `foreign-file` | The file no longer exists, or comes from another wiki (for example InstantCommons). |
| `namespace-not-enabled` | The page is outside `$wgLayersPageDrawingNamespaces`. |
| `image-too-large`, `document-limits` | The file or the page's drawings exceed the limits of a page drawing. |
| `would-lose-data`, `unconvertible`, `not-renderable` | The set holds data a page drawing cannot keep exactly. |
| `pinned-revision` | The embed names a set revision by ID (`layersetid=`). |
| `no-current-set` | The embed names a set the current file version does not have, so it showed nothing. |
| `invalid-slide-name` | The legacy parser refused the slide name, so the page showed an error. |
| `file-not-migrated` | Step 1 did not move the file's set, so there is nothing to copy. |
| `template-latest-set` | A template or gallery shows the file's latest set, and the page has other drawings of that file, so no name would find it. |
| `template-name-taken` | A template shows a slide whose name the page already uses for another drawing. |
| `unscannable-text`, `embed-not-rewritable` | The page's text uses syntax the embed rewriter does not change safely. The page is left as it is. |
| `title-taken` | A page `Slide:<name>` already exists for a slide that no page shows. |

To try one piece first, add `--file=<name>` (without `File:`), `--page=<title>` or `--slide=<name>`, with or without `--commit`. A scoped run never records the migration as complete.

## 5. Migrate

```sh
php extensions/Layers/maintenance/migrateLayersToPageHistory.php --commit
```

The edits are made by the system account "Layers migration", which the script adds to the `bot` group, or by the account named with `--user=`. They are marked as bot edits and tagged `layers-migration`, so they can be filtered in recent changes and page histories.

If any edit fails, the script says so and does not record completion; run it again. A rerun continues where the last one stopped, because moved drawings are recognised by their IDs, and reports nothing left to do once everything is moved. When an unscoped run finishes without a failed edit it records completion in `updatelog` (`layers-page-history-migration`) and purges every page that showed shared sets, so no cached page shows them afterwards.

A new wiki with no shared sets can run the same command once: it moves nothing and records completion, so bare names mean page drawings from the start.

## 6. The way back

```sh
php extensions/Layers/maintenance/migrateLayersToPageHistory.php --undo
php extensions/Layers/maintenance/migrateLayersToPageHistory.php --undo --commit
```

The first command lists, the second makes, one bot edit per page that puts the page back as it was before the migration's edits, tagged `layers-migration-undo`. Pages the migration created are deleted. A page someone has edited since is listed as `edited-since-migration` and left alone; restore it from its history if needed. An unscoped undo removes the completion record and purges the same pages, so bare names mean shared sets again and they can be edited. With `--file`, `--page` or `--slide`, undo works on that one page. A page that was put back can be migrated again.

## After the migration

- Search indexes page drawings with their page. `maintenance/reindexPageDrawings.php` reindexes existing pages if the search index was built before this version of Layers.
- Category pages and special pages show gallery images without drawings, because no page owns them there.
- To show one page's drawing on another page, embed it there as `layerset=<page ID>:<name>` (or `{{#Slide:<page ID>:<name>}}`) and follow the "Copy" link: the copy becomes a drawing of that page. The File page's section gives the page ID.
- The legacy tables stay. They are only read, for old revisions and for undo.
