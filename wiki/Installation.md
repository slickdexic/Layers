# Installation and upgrades

Documentation for manifest version **1.5.95**, with subsequent fixes on `main` (September 6, 2026). Check [[Current Status]] before selecting a tag or branch.

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
```

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

## Verify

1. Confirm Layers appears in `Special:Version`.
2. With an authorized account, open a File page and select Edit Layers. Save a small annotation and view it in an article.
3. Create a standalone slide through `Special:Slides` and embed it with `{{#Slide: InstallationTest}}`.
4. If using PDFs, verify multiple document pages and their saved annotations.
5. Test an unauthorized account and any local protection rules.

A visible editor tab alone does not verify database writes or permissions.

## Upgrade

Back up the database, uploads and configuration. Record the current branch/commit and review its changelog. With a clean checkout on the selected branch:

```sh
git pull --ff-only
```

Run the MediaWiki updater again, refresh browser assets, then repeat the save/view checks. Avoid forcing a pull over local modifications. If the schema has changed, rolling code back alone may not be sufficient; restore from a compatible backup when necessary.

The post-1.5.95 fixes bind server export cache files to their source title and preserve creator identity. Regenerate old cached exports. Legacy sets with missing historical creator evidence require `layers-admin` for delete/rename. No schema migration was introduced by those particular fixes.

## Optional setup

See [[Configuration Reference]] for actual defaults and limits, and [[Permissions]] for group configuration. Keep the export cache outside the document root. Enable same-origin framing only if using the editor modal and your core/proxy policy requires it.

Before using slide-based SOPs, read [[Current Status]]: article revision capture and annotation full-text search remain planned features.
