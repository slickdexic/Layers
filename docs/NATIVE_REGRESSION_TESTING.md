# Native page-history regression tests

These tests advance the independent page-history release's OPS-2/OPS-3 gate.
They use MediaWiki's integration harness, real revision storage and native media
handlers. They are separate from the extension's standalone PHPUnit suite.
The [release acceptance ledger](RELEASE_1_8_ACCEPTANCE.md) remains authoritative;
passing this suite does not qualify HTTP, browser or owner acceptance.

## Prepare a disposable wiki

- Install a supported MediaWiki checkout with its integration-test development
  dependencies, and load Layers in that wiki's settings. Install the extension's
  development dependencies too. Match PHP to that MediaWiki version.
- Use a separate database and a database account restricted to that database.
  Do not grant the test account access to an ordinary or production wiki.
  Allow the native test harness to manage its isolated test tables.
- Give this wiki dedicated writable upload, archive/deleted-file, temporary,
  session and cache directories. Its repository/backend configuration must point
  only to those directories. Some tests upload, replace, suppress or temporarily
  remove fixture media; they must never use an installed wiki's repository.
- Route MediaWiki and Layers logs to this wiki's own directory, including both
  `Layers` and `layers` debug groups. Check loaded settings and directory ownership
  before running tests; a separate database alone does not isolate files or logs.
- Enable the native image and PDF handlers used by the release. PDF tests require
  the handler's normal PDF metadata/rendering programs and image support. Use the
  same handler requirements as a supported MediaWiki deployment.

Docker is one possible development environment, not an extension dependency.
Do not copy private credentials, database exports or local acceptance captures
into the repository to reproduce a test.

## Run from the Layers checkout

Set `MW_INSTALL_PATH` to the disposable MediaWiki checkout and `MW_CONFIG_FILE`
to its dedicated settings file. For example, in a POSIX shell:

```sh
MW_INSTALL_PATH=/path/to/test-mediawiki \
MW_CONFIG_FILE=/path/to/test-settings/LocalSettings.php \
php vendor/bin/phpunit --do-not-cache-result -c tests/phpunit/core.xml
```

Use a PHPUnit version compatible with that checkout. The core bootstrap refuses
to run without MediaWiki's integration bootstrap. Do not run `core.xml` through
the standalone stub bootstrap, disable native validation, or point these commands
at production settings. Avoid concurrent runs sharing a test database/repository.

For the release-package regression slice:

```sh
MW_INSTALL_PATH=/path/to/test-mediawiki \
MW_CONFIG_FILE=/path/to/test-settings/LocalSettings.php \
php vendor/bin/phpunit --do-not-cache-result -c tests/phpunit/core.xml \
  --filter '(GalleryLayerSetOccurrenceTest|PageCopyPublicationGuardTest|PageViewerReadServiceTest|PinnedPdfDeliveryBoundaryTest|PinnedPdfHandlerTest|PinnedPdfPrivacyHooksTest|PinnedPdfRegistrationTest|PinnedPdfSourceTest|ShownPdfMetadataProducerTest|SpecialEditLayersPageImageTest|ViewerPinnedRenditionTest|ApiLayersReadTest|MigrationUndoTest)'
```

The stream and thumbnail-selection unit tests run separately without a wiki:

```sh
php vendor/bin/phpunit --do-not-cache-result -c phpunit.xml \
  --filter '(PinnedPdfStreamTest|ThumbnailProcessorTest)'
```

## What the package slice covers

| Tests | Boundary |
| --- | --- |
| `PageCopyPublicationGuardTest` | Native preparation/save hooks, source permission/visibility changes, competing edits and refusal preservation during migration/copy. |
| `PageViewerReadServiceTest`, `ViewerPinnedRenditionTest` | Exact saved file version, grouped PDF members, dimensions and unavailable-source refusal. |
| `PinnedPdfSourceTest`, `PinnedPdfDeliveryBoundaryTest`, `PinnedPdfStreamTest` | Private capture, original bytes after reupload, fresh authorization, resource cleanup and same-handle delivery. |
| `PinnedPdfHandlerTest`, `PinnedPdfPrivacyHooksTest`, `PinnedPdfRegistrationTest` | Native endpoint registration, request/response objects, privacy scope and refusal contracts. |
| `GalleryLayerSetOccurrenceTest`, `ShownPdfMetadataProducerTest` | Native occurrence association, linked captions, PDF page selection and existing hint/metadata behavior. Cargo characterization does not qualify the future Cargo milestone. |
| `SpecialEditLayersPageImageTest` | Owning-page editor return and native image Save preservation. |
| `ApiLayersReadTest`, `MigrationUndoTest` | Viewer/control privacy, current authorization, hidden historical reads and migration undo with native deferred updates. |
| `ThumbnailProcessorTest` | Effective native PDF page selection and transform-parameter precedence. |

Relative helper and media dependencies are maintained under `tests/phpunit/core`
and `tests/fixtures/assets`. The slice needs no private PDF or task directory.
Existing optional evidence-output variables may write extra captures when an
explicit dedicated directory is supplied; they are not required for assertions.

Record the exact source commit, MediaWiki/PHP versions, selected classes, result
counts and fixture isolation with each run. A native response-object pass does
not establish final web-server headers, physical Print behavior, a concurrency
stress test or every supported MediaWiki/device combination. The repository's
current CI runs standalone PHPUnit; native results must be recorded separately.

## Recorded package qualification — October 25, 2026

On published runtime baseline `5d8f162`, 201 native cases / 3360 assertions
across thirteen classes completed with zero failures and two optional Cargo
skips on MediaWiki 1.44.6 / PHP 8.3.33. Stream unit tests passed 9 / 45; thumbnail
unit tests passed 40 / 76. Native counts combine the unaffected first-run
classes with the corrected gallery and additional API/undo run; this was not a
repeat of the entire slice.

The original first run retained one gallery fixture failure: a directly
constructed LocalRepo owns a different WAN cache from the service cache. The
fixture now clears its own cache; all assertions remain. The complete original
JUnit was recovered after the command observer timed out, without repeating that
batch. The follow-up command exited successfully. Cargo was not installed, so
its two conditional cases remain unqualified.

This is the bounded package slice, not the complete native suite, a second
MediaWiki-version qualification or actual HTTP/browser acceptance. Shipped
fixture/helper dependencies were checked. Application runtime was unchanged.
