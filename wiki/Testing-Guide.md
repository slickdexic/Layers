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

Playwright's default server is `http://localhost:8080`; override `MW_SERVER` for a dedicated test wiki. Read the test fixtures and authentication requirements before running E2E: tests may create or change wiki content. Do not point an automated write suite at a production SOP wiki. Install the browser runtime required by the checked-in Playwright dependency.

## Meaningful regression coverage

Exercise production behavior, including negative cases. An assertion that only runs if an optional button exists does not prove the button exists or works. Avoid testing a copied validator in place of the API method.

Cover images, standalone slides and PDF pages. For asynchronous viewers/editors, test stale successes and failures, both image-load orders, page changes, close/reopen and retained unsaved work. Permission tests should cover ordinary page rights and Layers ownership separately.

Database doubles establish call scope; they do not establish live transaction/concurrency behavior. Native revision-history, search and Cargo integration must eventually have real-wiki acceptance tests before being advertised.

## Current checkpoint

September 6, 2026, commit `a3b20963`: 180 JavaScript suites / 14,310 tests; 686 PHPUnit tests / 1,475 assertions with one skipped. PHP QA passed with two pre-existing duplicate test-stub warnings. Coverage was not remeasured. See [[Current Status]] for limitations and browser-probe scope.
