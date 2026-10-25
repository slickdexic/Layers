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

## Remaining qualification

This source already had the native migration-completion record. It did not
provide a new unmigrated 1.5.x transition. Its local working code is not assumed
to be the exact published release candidate. Earlier migration evidence remains
separate and valid in its recorded scope.

Configuration was not copied in this checkpoint. Matching configuration, other
installed extensions and media-handler prerequisites still need preservation
and verification before a complete application restore/startup and exact-candidate
upgrade rehearsal can be claimed. Database/upload recovery alone is not a
complete rollback package. Do not deploy or overwrite a live wiki based solely
on this result.

Private database exports, upload inventories, configuration material and evidence
stay local and outside published source. No release version/tag, runtime behavior,
wiki content or configuration changed. The
[1.8 acceptance ledger](RELEASE_1_8_ACCEPTANCE.md) retains the remaining release
and owner-acceptance requirements.
