# MediaWiki structure suite tracker

_Last updated: 2025-11-15 (UTC)_

This note logs the current status of `--testsuite structure` when executed inside the MediaWiki container. Keep it up to date each time we re-run `composer phpunit -- --testsuite structure` so that anyone can immediately see what remains before the Layers extension can be considered structure-suite clean.

## How to run the suite

```bash
cd /var/www/html
composer phpunit -- --testsuite structure
```

The deprecated `tests/phpunit/phpunit.php` entrypoint still works, but `composer phpunit` is the supported path and avoids the warning banner at the top of the log.

## Latest run summary

- Timestamp: 2025-11-15 04:28 UTC
- PHP / PHPUnit: PHP 8.1.33, PHPUnit 9.6.21
- Result: **8 errors**, **6 failures**, **8 skips** (7,914 tests total)
- Notable warnings: ResourceLoader reported page-load budgets (informational only since `bundlesize.config.json` keeps Layers within limits).

### Errors

| Test | Failure mode | Proposed remediation |
| --- | --- | --- |
| `PHPUnitConfigTest::testConfigDirectories` (`phpunit.xml.dist`) | DOMDocument cannot load `/var/www/html/phpunit.xml.dist`; the file is missing in the container. | Copy or symlink the canonical `phpunit.xml.dist` from the MediaWiki tarball/git checkout into `/var/www/html`. Running `php maintenance/generateDefaultConfig.php` will also regenerate it if you have the upstream repo checked out. |
| `SpecialPageFatalTest` (BrokenRedirects, DoubleRedirects, WantedFiles, WantedPages, BlockList, AutoblockList, Listusers) | MariaDB/MySQL throws `Error 1137: Can't reopen table` when large query pages spill temporary tables to disk. | Increase `tmp_table_size` and `max_heap_table_size` (e.g., 256M) plus set `internal_tmp_disk_storage_engine=MEMORY` or `MyISAM` in the DB container, then restart MariaDB. WMF guidance is to keep tmp tables large enough so query-heavy special pages can finish. |
| `SettingsTest::testConfigGeneration` (four data sets) | Shellbox attempts to run `/usr/bin/php`, but that path does not exist so every invocation exits 127. | Inside the web container: `sudo ln -s "$(command -v php)" /usr/bin/php` **or** set `$wgShellboxDefaultPhp=/path/to/php` in `LocalSettings.php`. After the symlink/config, rerun the suite so `GenerateConfigSchema` can finish. |

### Failures

| Test | Failure mode | Proposed remediation |
| --- | --- | --- |
| `AutoLoaderStructureTest::testAutoloadOrder` | `includes/AutoLoader.php` contains composer bootstrap classes (`ErrorHandler`, `HttpClient`, `Installer`, `NoProxyPattern`) pointing at `composer-setup.php`, so the generated file no longer matches `generateLocalAutoload.php` output. | From `/var/www/html`, run `php maintenance/generateLocalAutoload.php > autoload.php` (and commit if working on core). This strips unintended composer entries so the structure test matches the generator output. |
| `ResourcesTest::testMissingMessages` | `skins.minerva.scripts` requires message `echo-badge-count`, which is absent when Echo/Minerva message bundles are not loaded. | Install/enable Echo and Minerva messages in this test environment, or add a temporary stub message (with docs) so the structure test can resolve it. |
| `SettingsTest` entries listed in errors also show as failures because the command exit status is 127. | Addressed by the `/usr/bin/php` fix above. |

## Next verification steps

1. Restore `phpunit.xml.dist` and ensure `/usr/bin/php` resolves to the actual PHP binary.
2. Apply the MySQL temp-table settings and restart the DB container.
3. Regenerate `autoload.php` so the structure test matches `generateLocalAutoload.php` output.
4. Provide `echo-badge-count` via the Echo/Minerva bundle or a documented stub message.
5. Rerun `composer phpunit -- --testsuite structure` and update this tracker with the new results/log excerpts.

Keeping these notes in-repo lets us hand off the outstanding structure-suite work without forcing teammates to comb through prior chat logs.
