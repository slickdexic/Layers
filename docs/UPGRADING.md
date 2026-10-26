# Upgrading layer sets to page revision history

This guide covers the independent page-history release, working target
**Layers 1.8**, and advances [Milestone 1 and OPS-1](PROJECT_CHARTER.md).
The [release acceptance ledger](RELEASE_1_8_ACCEPTANCE.md) tracks the remaining
qualification. Layers uses MediaWiki's extension, database and maintenance
mechanisms; Docker is not a deployment requirement.

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

## Starting version and prerequisites

**The fully tested starting release is Layers 1.5.95.** The documented full
upgrade path is **1.5.95 → the 1.8 candidate**, on MediaWiki 1.44.6 / MySQL.
This is the qualified starting point, not a runtime version gate or proof that
earlier releases cannot upgrade directly. Do not describe it as a technical
minimum enforced by the extension.

The native schema updater also passes isolated tests using released layouts
from **0.8.2, 1.0.0, 1.3.0 and 1.5.0**. Those tests preserve a representative
legacy payload and pass reruns; they are not complete old-release-to-1.8
application migrations. For an earlier installation, rehearse its actual data
on a copy before choosing a direct or staged route. An intermediate 1.5.95 hop
is not established as technically necessary, and a blind staged upgrade is not
a substitute for that rehearsal. See [test coverage](UPGRADE_PATH_ACCEPTANCE.md).

A new installation needs no previous Layers version. It still runs the updater
and the unscoped migration completion step below, even when there is no legacy
data to copy. The 1.8 manifest/version tag is assigned at release cut; current
acceptance uses exact Git candidates rather than the provisional version label.

| Requirement | What to prepare |
| --- | --- |
| MediaWiki | **1.44 or newer**, with the PHP/database versions supported by that core release. The separate Layers builds for older MediaWiki are not this candidate. Upgrade core separately if needed, following its supported upgrade path. |
| Layers package | One reviewed candidate containing matching PHP, JavaScript, registration, translations and committed assets. Runtime installation does not require Node.js or the extension's development-only Composer packages. |
| Maintenance access | PHP command-line access, or a hosting operator who can run the maintenance steps. The browser updater alone cannot perform the Layers content migration. |
| Database access | Normal MediaWiki schema-update privileges for the updater, and normal page-publication access for migration. Do not use a SELECT-only recovery-test account for an upgrade. |
| Media | Existing uploads and retained file versions; normal image/PDF handlers and their configured programs. PDF sites need MediaWiki's PDF Handler and its native prerequisites. |
| Writable storage | The web-server user's normal upload/thumbnail, cache and temporary storage. Private source capture and regenerated media must work; preserve existing access controls. |
| Configuration | Keep `wfLoadExtension( 'Layers' );`, review enabled owner namespaces, and preserve site-specific rights/settings. No new Docker, worker, Node.js or host service is required. |
| Recovery | A verified consistent database/upload/configuration backup and matching old code/software, retained through acceptance. GitHub preserves extension code; it does not preserve a wiki's database, uploaded versions or private settings. |

The full upgrade rehearsal currently qualifies MySQL. Do not infer a complete
MariaDB or SQLite upgrade from schema-unit coverage or a fresh SQLite install.
Retain each database's actual rehearsal result with the site's upgrade record.

## Is `mw-config` enough?

**No.** `/mw-config/index.php` is MediaWiki's browser **schema updater**. Its
command-line alternative is `php maintenance/run.php update`; use either route
for schema updates, not both as a mandatory sequence. Both use extension schema
hooks. See MediaWiki's [updater instructions](https://www.mediawiki.org/wiki/Manual:Update.php).

Layers then requires separate **link discovery and page-history migration**:

1. Refresh links and process jobs while legacy shared-set discovery is active.
2. Run the Layers migration without `--commit`, inspect its plan and refusals.
3. Run the reviewed unscoped migration with `--commit`.
4. Verify completion, retained content and native editing/history before
   reopening editing.

Neither the schema updater nor `refreshLinks`/`runJobs` records Layers migration
completion. There is no documented browser-only replacement for this content
migration; ask the hosting operator to run it if shell access is unavailable.
Do not insert the completion record by hand.

## 1. Prepare and rehearse

Use a copy of the actual wiki first. The retained upgrade rehearsal covers
Layers 1.5.95 on MySQL and native MediaWiki 1.44.6; it does not establish every
1.5.x/database combination. The candidate requires MediaWiki 1.44 or newer,
with that core release's PHP/database requirements. A separate older-core
branch is not interchangeable with this candidate.

A separate [intended-wiki recovery checkpoint](INTENDED_WIKI_RECOVERY_CHECKPOINT.md)
restored persistent data, retained uploads and matching captured Layers files on
MediaWiki 1.45.3 / MySQL 8.4.6. Its October 26 application follow-up also passes
native startup, representative image/slide/PDF reads and exact HTTP source
delivery, with persistent data unchanged. It uses reconstructed test settings;
it does not archive a site's private configuration or replace the complete
backup and rehearsal below. The source was already migrated, so a fresh legacy
transition is covered by the separate retained 1.5.95 rehearsal.

Before cutover:

1. Record the exact old and candidate Layers commits, MediaWiki/PHP/database
   versions, enabled owner namespaces and media-handler requirements.
2. Take a consistent database, uploads and configuration backup, and verify that
   you can restore it with the matching old code. Include retained legacy tables
   and uploaded file versions; XML export alone is not the complete rollback.
3. Rehearse the commands below on the copy. Review counts, refusals, native
   history and complete image/slide/PDF contents before proceeding on the wiki.
4. Schedule an edit freeze for cutover using normal site procedures. The
   migration account/process must still be allowed to publish page revisions.
   Keep editors from continuing with a pre-cutover session.

Do not run cleanup of legacy rows, upload archives, private PDF sources or local
drafts as part of the upgrade. Migration retains data deliberately.

## 2. Back up and update

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

Deploy matching PHP, JavaScript and committed assets from that one candidate.
Follow the site's normal opcode/ResourceLoader cache deployment procedure;
do not mix an older branch's PHP with newer client files. No new Docker, Node.js
or host-service runtime is required.

From the MediaWiki root, as the web server user, run the preferred schema route:

```sh
php maintenance/run.php update
```

Alternatively, run the browser updater at `/mw-config/index.php`, using the
site's upgrade key if requested. Complete its database-update step and retain
the result. Keep the existing private configuration; do not replace it with a
fresh-install settings file. The web wizard itself is separate from Layers'
content migration. The tested full Layers rehearsal used the CLI route; the
new historical-schema tests exercise the native updater engine, not the wizard UI.

After **either** schema-update route, continue from the MediaWiki root:

```sh
php maintenance/run.php refreshLinks
php maintenance/run.php runJobs
```

Keep uploads, thumbnails, cache and temporary directories writable by that user.
Images and PDFs retain their existing media-handler prerequisites. Refresh links
**before** migration completion, while discovery still records shared sets shown
through templates and galleries.

The updater may add/backfill legacy fields, normalize legacy file-name keys,
replace indexes and remove the unused `layer_assets`/`layer_set_usage`
bookkeeping tables. It does not delete uploaded media or migrate layer sets
into page revisions. Do not perform these SQL changes manually. Keep the backup
because expected legacy metadata normalization can change stored key fields even
when payload bytes are preserved.

## 3. Review and apply

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

For example, read this API URL on the wiki, authenticating if it is private:

```text
api.php?action=query&meta=siteinfo&siprop=general&format=json&formatversion=2
```

Check `query.general.layerspagehistorymigrated` is the boolean `true`. The
updater alone and scoped migration runs do not set this global completion flag.
A fresh installation with no legacy sets also runs the dry run and unscoped
`--commit` once; that records completion without adding content revisions.
Do not insert the completion record manually to skip a refused migration.

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
If the process is interrupted, retain its output and run the same reviewed plan
again. Already completed, unchanged copies are recognized. Investigate edited
targets or new refusals rather than forcing them through.

## 4. Validate before reopening editing

| Check | Expected result |
| --- | --- |
| Migration output and completion | No unexplained refusal; unscoped completion is true. |
| Original sources | Retained legacy rows, uploads and older file versions remain available. |
| Owner identity | Equal names on different pages/files are independent. One PDF's pages share one visible layer-set name. |
| Main text and stored content | Expected references, complete layers, PDF siblings, source pins and geometry are preserved. No owner ID is introduced into author-facing references. |
| Editing | An authorized test Save creates one native owner-page revision; return, overlay reopen and draft/conflict behavior work. |
| History and output | Old-version viewing uses the old saved layers/source. Image/slide PNG and PDF, and complete PDF Download/Print preparation, include their layers. |
| Permissions | Read/edit denial, protection and visibility rules still apply. |
| Rerun | Unchanged completed copies add no duplicate content revision. |

Retain the command output, exact candidate commit and before/after checks with
the backup. Resume editing only after the site's acceptance checks pass.
Completion of migration is not a declaration that the release candidate has
passed all device, performance, security or owner acceptance.

## 5. Recovery

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

If a full rollback is needed, preserve any newer work first, stop editing and
restore the consistent backup with its matching code/configuration/uploads.
Rolling back only the extension files does not reverse migrated page revisions
or database changes. Rehearse recovery on the copy before using it on the wiki.

Search, Cargo and layer-object links remain later milestones. If separately
validating an existing search index, the native `reindexPageDrawings.php`
maintenance script is available; those checks do not gate this ownership upgrade.

## Current-candidate migration check — October 25, 2026

This advances Milestone 1 / HIST-8 / HIST-9 / DATA-1 / OPS-1. The maintained
MediaWiki 1.44.6 / MySQL wiki directly mounted the reviewed `0220126` checkout.
The native migration command, page-copy migration component, pilot factory and
four associated regression files exactly match the final retained 1.5.95
upgrade rehearsal. That rehearsal's bare-name output, whole-PDF preservation,
template refusal and newer-edit/rerun results remain applicable within their
recorded scope. Later publication admission changes have the separate
[117-case native checkpoint](MILESTONE_1_HTTP_PRIVACY_ACCEPTANCE.md).

The current native command was exercised on the existing migrated synthetic
fixture, without resetting its database or installing another wiki:

- Dry run retained all 23 table/absence witnesses exactly.
- One unscoped `--commit` rerun added **zero revisions**; all 16 existing
  revisions, stored content, legacy rows, file records, activity and watchlist
  witnesses remained exact. Only `page_touched` changed during the expected
  native page-cache purge; other page fields were preserved.
- All 25 installed upload files, including existing generated files, remained
  byte-identical. No upload or configuration was replaced.
- A following `--undo` **dry run** left every witnessed table and page row exact.
  No undo, deletion or restore was applied. Completion stayed true.

This closes the current-command rerun and rollback-planning check. It does not
claim a second fresh 1.5.x upgrade or a complete application restore. Existing
owner-qualified fixture revisions were preserved, not rewritten to make a new
bare-output result. The [application read-restoration follow-up](INTENDED_WIKI_RECOVERY_CHECKPOINT.md#application-level-restore--october-26-2026)
now passes in its recorded scope; site-specific configuration preservation,
final-artifact reconciliation and pilot-data review remain. Main-wiki configuration was not copied;
no additional wiki, container, database clone or port was created.
