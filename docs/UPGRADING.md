# Upgrading layer sets to page revision history

This guide advances [Milestone 1 and OPS-1](PROJECT_CHARTER.md). Layers uses
MediaWiki's extension, database and maintenance mechanisms; Docker is not a
deployment requirement.

Migration copies legacy shared layer sets into their owning pages' native
`layers` revision slots. It retains the `layer_sets` rows for historical reads
and recovery. Each owner then has an independent copy. Equal names on different
files are valid. A whole PDF keeps one name across its internal pages:
`layerset=ABC` names the layer set and `page=2` selects its second PDF page.

Author-facing references contain names without owner IDs. Existing references
that already select the same local set retain their bytes. A legacy
`layerset=on` reference to a set other than Default becomes that set's name;
the Default shortcut can remain unchanged. Multiple old sets of one slide use
the approved names `<slide> (<set>)` when separate slide names are needed.

## Back up and update

Back up the database, uploads and `LocalSettings.php`. Record the old Layers
commit, MediaWiki version and database type. Retain the backups through acceptance.
The old 1.5.95 fresh table definitions use MySQL syntax; a fresh SQLite install of
that release does not establish a valid MySQL upgrade test.

Install the reviewed extension candidate through the site's normal deployment
process. Keep `wfLoadExtension( 'Layers' );` in configuration. Review
`LayersPageDrawingNamespaces` in the
[configuration reference](../wiki/Configuration-Reference.md): only enabled
owner namespaces can receive layer sets. A template need not own layer sets
for ordinary pages transcluding it to receive their own copies.

From the MediaWiki root, as the web server user, run:

```sh
php maintenance/run.php update
php maintenance/run.php refreshLinks
php maintenance/run.php runJobs
```

Keep uploads, thumbnails, cache and temporary directories writable by that user.
Images and PDFs retain their existing media-handler prerequisites. Refresh links
**before** migration completion, while discovery still records shared sets shown
through templates and galleries.

## Review and apply

```sh
php extensions/Layers/maintenance/migrateLayersToPageHistory.php
```

Without `--commit`, the command publishes nothing. Review all planned file-page
sets, copies for pages showing shared sets/slides, and pages for unembedded slides.
Do not apply a plan with unexplained missing copies or refusals. Reasons include
missing/foreign files, older file versions, unsupported content, limits, pinned
legacy revisions, unsafe source syntax, disabled namespaces and occupied titles.
Preserve the old state for review; do not discard fields or rename sets to force
the migration through.

Use `--file=<filename>` without `File:`, `--page=<wiki-page-title>` or
`--slide=<slide-name>` for a bounded inspection. Scoped runs do not record global
completion. Apply the reviewed full plan with:

```sh
php extensions/Layers/maintenance/migrateLayersToPageHistory.php --commit
```

The native account `Layers migration` makes bot edits tagged `layers-migration`;
`--user=<account>` selects another authorized actor. Failed publication or unsafe
author-facing output prevents completion. An unscoped successful run records
`layers-page-history-migration` in `updatelog` and purges discovered owner pages.
Confirm `meta=siteinfo` reports `layerspagehistorymigrated: true`.

An unchanged template's legacy show-intent must still select the same Default
layer set after completion. If its old latest set has another name, migration
refuses that group as `template-latest-set` and blocks global completion. Review
the template and use an explicit layer-set name before retrying. Stored legacy
hints combine show-intent aliases, so this check deliberately refuses ambiguous
non-Default template hints rather than changing their displayed layers.

After completion, `layerset=ABC` selects the owner's ABC for that file;
`{{#Slide:ABC}}` selects the owner's slide. The deprecated `layerset=on` selects
Default. Legacy sets become read-only. Ordinary pages use the existing Edit
layers and View full size overlays, without a list of sets or owner/revision
captions. Use the editor's Import or Copy controls to copy from another page.

Check history, complete payloads, offscreen PDF members, source versions, geometry,
page text and independent owners. Exercise overlay entry, Save, owner return and
reopen. A rerun should recognize completed copies and add no duplicate revision.
A new wiki with no legacy sets can run the same command once to record completion
without adding content revisions.

## Recovery

The original database/upload/configuration backup is the complete rollback route.
The native migration also provides a narrower undo:

```sh
php extensions/Layers/maintenance/migrateLayersToPageHistory.php --undo
php extensions/Layers/maintenance/migrateLayersToPageHistory.php --undo --commit
```

Review the first command's plan before applying it. Undo restores unedited
migration targets and removes pages created solely by migration. A target edited
since migration is refused as `edited-since-migration`; newer work remains.
Unscoped undo removes the completion record; scoped undo does not. Before
migrating again after unscoped undo, refresh links and run jobs again to restore
template/gallery discovery. Undo does not replace a backup or authorize
overwriting subsequent owner edits.

Search, Cargo and layer-object links remain later milestones. If separately
validating an existing search index, the native `reindexPageDrawings.php`
maintenance script is available; those checks do not gate this ownership upgrade.
