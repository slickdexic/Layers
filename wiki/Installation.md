# Installation and upgrades

**Layers is a MediaWiki extension, not a Docker-based application. Docker is only used for our development/test environment. Layers features must not require or provide Docker workers, host supervisors, PowerShell or .NET backends.**

Updated October 24, 2026 for the page-history candidate. The manifest still says **1.5.95**; this does not make the candidate a tagged Layers 2.0 release. Select a reviewed commit with passing CI and check the [release checklist](https://github.com/slickdexic/Layers/blob/codex/l01-publication-admission/docs/MILESTONE_1_RELEASE_CHECKLIST.md).

## Requirements and branches

| Wiki | Layers branch | Manifest version | Notes |
| --- | --- | --- | --- |
| 1.44+ | **`main`** | 1.5.95 | Manifest compatibility floor; use a currently supported MediaWiki release |
| MediaWiki 1.43 | `REL1_43` | Check branch manifest | Separate branch; verify required fixes in its changelog |
| MediaWiki 1.39–1.42 | `REL1_39` | Check branch manifest | Unmaintained; upgrade core rather than choosing it for a new deployment |

Use the PHP and database versions required by your chosen MediaWiki release. The extension's compatibility floor is not an endorsement of an end-of-life core version. See [MediaWiki requirements](https://www.mediawiki.org/wiki/Manual:Installation_requirements) and [supported downloads](https://www.mediawiki.org/wiki/Download).

Use a current browser with JavaScript and canvas support. Images must already render through the wiki. PDF annotation additionally needs PDF thumbnails (normally PdfHandler and its rasterizer dependencies); standalone slides do not need PDF support.

## Install

From the MediaWiki `extensions` directory:

```sh
git clone https://github.com/slickdexic/Layers.git
git -C Layers checkout --detach REVIEWED_COMMIT_OR_TAG
```

Replace `REVIEWED_COMMIT_OR_TAG` with the reviewed release/candidate and verify
its exact-commit CI result. A default-branch clone or the unchanged manifest
version does not by itself identify the page-history candidate.

For an existing compatible 1.43 wiki, select the separate `REL1_43` branch. Do not copy main's JavaScript onto a different branch's PHP files.

Add to `LocalSettings.php`:

```php
wfLoadExtension( 'Layers' );
```

From the MediaWiki root, run:

```sh
php maintenance/run.php update
```

This creates/migrates **`layer_sets`**. Use the updater rather than executing an example SQL table manually. The repository includes runtime assets; Node.js, npm and Composer are needed for development checks, not the normal extension installation.

## Complete page-history setup

The updater creates database structures; it does not complete the legacy-to-page
migration. Follow the [upgrade guide](https://github.com/slickdexic/Layers/blob/codex/l01-publication-admission/docs/UPGRADING.md) to refresh discovery,
review the dry run and apply the unscoped migration. A fresh wiki with no legacy
sets also needs the empty migration to record completion. Verify
`layerspagehistorymigrated: true` through siteinfo before testing page-owned embeds.

## Verify

1. Confirm Layers appears in `Special:Version`.
2. Follow the [[quick start|Quick-Start-Guide]]: place a named image embed on an owning page, use its Edit layers overlay, Save, return and reopen. Confirm that page's history contains the change.
3. Add `{{#Slide: InstallationTest}}` to an owning page and create its layers through the overlay. Check history and reopen.
4. If using PDFs, verify multiple pages under the same layer-set name, Save/reopen, historical viewing and complete Download.
5. Test an unauthorized account and any local protection rules.

An editor opening alone does not verify publication, revision history or permissions.

## Upgrade

Back up the database, uploads and configuration. Record the current branch/commit
and review the target's changelog. From a clean Layers checkout:

```sh
git fetch --tags origin
git checkout --detach REVIEWED_COMMIT_OR_TAG
```

Run the MediaWiki updater again, then repeat the save/view checks. To move shared layer sets and slides into page history, follow the [upgrade guide](https://github.com/slickdexic/Layers/blob/codex/l01-publication-admission/docs/UPGRADING.md): refresh links, dry-run the migration, commit it, and undo it if needed. Avoid forcing a pull over local modifications. If the schema has changed, rolling code back alone may not be sufficient; restore from a compatible backup when necessary.

The post-1.5.95 fixes bind server export cache files to their source title and preserve creator identity. Regenerate old cached exports. Legacy sets with missing historical creator evidence require `layers-admin` for delete/rename. No schema migration was introduced by those particular fixes.

## Optional setup

See [[Configuration Reference]] for actual defaults and limits, and [[Permissions]] for group configuration. Keep the export cache outside the document root. Enable same-origin framing only if using the editor modal and your core/proxy policy requires it.

Before production use, complete the release checklist and owner acceptance.
Page-history, search and Cargo are separate milestones; this guide does not
claim acceptance of later search/Cargo functionality.
