# Testing guide

Run checks from the extension root. Install development dependencies with `npm ci` and `composer install`. Use the PHP runtime supported by your MediaWiki checkout. Do not assume a local unit-test pass exercises a running wiki.

| Command | Scope |
| --- | --- |
| `npm test` | JavaScript tests, Grunt lint/style/i18n, and repository guards |
| `npm run test:php` | PHP syntax, code style and file-mode checks |
| `npm run test:phpunit` | Standalone PHPUnit suite configured by `phpunit.xml` |
| `npm run test:coverage` | JavaScript coverage run; report its date/commit |
| `npm run test:e2e` | Playwright tests against the configured wiki |
| `npm run check:docs` | Documentation links, mirrors and current reference checks |

For a targeted regression: `npx jest tests/jest/LayersLightbox.test.js --runInBand`.

Playwright's default server is `http://localhost:8080`; override `MW_SERVER` for a dedicated test wiki. Read the test fixtures and authentication requirements before running E2E: tests may create or change wiki content. Do not point an automated write suite at a production wiki. Install the browser runtime required by the checked-in Playwright dependency.

## Meaningful regression coverage

Exercise production behavior, including negative cases. An assertion that only runs if an optional button exists does not prove the button exists or works. Avoid testing a copied validator in place of the API method.

Cover images, standalone slides and PDF pages. For asynchronous viewers/editors, test stale successes and failures, both image-load orders, page changes, close/reopen and retained unsaved work. Permission tests should cover ordinary page rights and Layers ownership separately.

Database doubles establish call scope; they do not establish live transaction/concurrency behavior. Native revision-history, search and Cargo integration must eventually have real-wiki acceptance tests before being advertised.

## Core-backed revision tests

The internal page-history persistence proof has a separate suite using MediaWiki's real integration harness and isolated test tables. It does not run under the extension's standalone stub bootstrap. Use a disposable development wiki with core test dependencies and set `MW_INSTALL_PATH`:

```sh
MW_INSTALL_PATH=/path/to/mediawiki php vendor/bin/phpunit -c tests/phpunit/core.xml
```

See the [implementation contract](https://github.com/slickdexic/Layers/blob/main/docs/PAGE_OWNED_HISTORY_IMPLEMENTATION.md) for setup, optional test-helper autoloading and limits. On MediaWiki 1.45.3/PHP 8.3.31 the combined suite through the H3d request boundary passed 96 tests / 244 assertions on September 10, 2026. It covers internal persistence, strict custom-model validation, owner authorization, historical snapshot access and source validation. Source tests combine controlled file doubles with a real temporary image upload/replacement and archived-version lookup. H3c adds integrated slide publication, final permission rechecks and competing-edit rejection without changing the winning revision. H3d adds 21 tests through core's internal API dispatcher for POST/token/input/rate checks, successful saves and safe errors; it does not test actual HTTP transport. Hidden-revision fixtures use isolated database flags; the full suppression lifecycle, real PDF handler behavior, HTTP/browser behavior, alternate-path admission and visual rendering remain unverified. See the contract for exact coverage and limits.

## Dated checkpoints

September 6, 2026, commit `a3b20963`: 180 JavaScript suites / 14,310 tests; 686 PHPUnit tests / 1,475 assertions with one skipped. PHP QA passed with two pre-existing duplicate test-stub warnings. Coverage was not remeasured. See [[Current Status]] for limitations and browser-probe scope.

The R6.08 follow-up expanded the standalone PHP suite to 802 tests / 1,878 assertions, with one existing skip. H2 subsequently expanded it to 868 tests / 1,952 assertions, with the same existing skip. Core-backed results above are a separate suite.
