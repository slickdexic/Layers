# Intended-wiki data recovery checkpoint

Recorded October 25, 2026; advances Milestone 1 / OPS-1 / DATA-1. This is a
bounded data-recovery result, separate from the retained Layers 1.5.95 upgrade
rehearsal on MediaWiki 1.44.6. Follow the full [upgrade guide](UPGRADING.md)
before deploying the independent page-history release.

## Recorded result

The intended local wiki's persistent database and retained uploads were copied
without changing its content or configuration. The source ran MediaWiki 1.45.3
and MySQL 8.4.6. Recovery used the same database-engine image in a separate local
test server with no network access or exposed ports. Live database credentials
stayed inside the source database container; none were exported into the backup.
Docker served only as the test environment, not an extension dependency.

- All captured persistent tables matched stable source row counts and complete
  typed-byte digests after restoration. Native history/content and retained
  legacy Layers data were included without rewriting historical snapshots.
- Table/column definitions were retained. Regenerable object, localization and
  query-cache contents were omitted; their restored table definitions remained.
- The native MyISAM search index was included and matched independently. A
  transactional dump alone was not treated as proof of its consistency.
- Retained uploads, including available archived/deleted versions, matched the
  source byte for byte. Regenerable thumbnails were excluded.
- Deliberate changes to one restored content row and one restored upload were
  detected. Replaying the same backup restored the complete persistent-table
  witnesses and all captured upload bytes exactly.
- The actual mounted Layers runtime, schema, translations and root registration
  files were preserved separately and verified byte for byte. The core image
  identity and environment changes were recorded privately. The test server was
  stopped after verification; backups and failed setup attempts were retained.

The source's before/after witnesses agreed; no live edit freeze was imposed for
this rehearsal. A changing source would have refused these checks. Production
cutover still needs the site's consistent-backup and edit-freeze procedures.

## Scope of the initial checkpoint

This source already had the native migration-completion record. It did not
provide a new unmigrated 1.5.x transition. Its local working code is not assumed
to be the exact published release candidate. Earlier migration evidence remains
separate and valid in its recorded scope.

Configuration was not copied in this checkpoint. Database/upload recovery alone
was not application-startup evidence; the follow-up below now checks that read
path with reconstructed test settings and available matching dependencies.
Neither result replaces a site's complete configuration/software recovery plan.
Do not deploy or overwrite a live wiki based solely on a data-restore result.

Private database exports, upload inventories, configuration material and evidence
stay local and outside published source. No release version/tag, runtime behavior,
wiki content or configuration changed. The
[1.8 acceptance ledger](RELEASE_1_8_ACCEPTANCE.md) retains the remaining release
and owner-acceptance requirements.

## Application-level restore — October 26, 2026

**Recorded pass: native application startup and restored-content reads.**
This advances Milestone 1 / OPS-1 / DATA-1. The owner approved one temporary
offline rehearsal, separate from the three maintained version wikis. No host
web/database port was exposed. The original backup, retained uploads and
captured Layers code were mounted read-only; main settings and credentials
were not copied. No new source dump or production rollback was performed.

The rehearsal restored the verified backup into the recorded MySQL 8.4.6 image
and started the recorded MediaWiki 1.45.3 core image with PHP 8.3.31. It used
the 1,944 captured Layers files, the available installed extension code and
new test-only settings/credentials. The enabled skins/extensions loaded.
Standard Ghostscript/Poppler prerequisites were reproduced from installed
program files, with media libraries isolated from the core application.

The following passed:

- All **71 table definitions / 452 columns** match the captured schema. All
  **66 persistent-table witnesses**, including the native search index, match
  both before and after application/HTTP reads.
- All **7,832 retained uploads**, captured Layers files and original database
  backup remain byte-exact. Source pins resolve through the native repository.
- Native revision storage loads representative image, slide and PDF layer
  snapshots as the production content class. The parser emits their exact
  page-owned bindings, and the native full-size read service prepares them.
- Actual internal HTTP returns site information, those three historical page
  revisions and matching complete main/layers slot bytes. Image source delivery
  and the complete 11-page PDF delivery match the retained source bytes exactly.
- The application database account has SELECT-only access; an attempted UPDATE
  against a no-row target is refused by database permission checks. No edit,
  migration, cleanup or data repair was used to obtain a pass.
- Original media stays read-only. Regenerated thumbnails, temporary files and
  logs use separate disposable storage. Global wiki read-only mode was removed
  only in this test configuration because it also forbids thumbnail generation;
  database privileges and read-only source mounts continued to protect content.

The first prerequisite transfer damaged only the disposable application and
was discarded with it. A clean rebuild used isolated media-library paths.
Earlier setup/read failures remain recorded privately; no extension defect or
runtime repair was established. This demonstrated why the core image identity
alone does not capture installed media programs or repository/cache settings.

After verification, both temporary services, their internal network, disposable
database volume and test-credential files were removed. All three maintained
wikis remained running without a restart. Original backups and private evidence
were preserved. No private data or settings are included in the extension.

This closes the application-startup/read gap of the initial checkpoint within
the recorded scope. It is not a backup of site-specific configuration, an
exhaustive check of every restored page/extension, a fresh unmigrated upgrade,
editor/device acceptance or a live cutover. Before deployment, operators still
retain their own matching settings, installed software and consistent backup.
Final-artifact reconciliation, earlier pilot-data review and owner release
acceptance remain in the [1.8 ledger](RELEASE_1_8_ACCEPTANCE.md).
