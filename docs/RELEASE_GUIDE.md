# Release guide

Updated November 23, 2026. [Layers 1.8](https://github.com/slickdexic/Layers/releases/tag/v1.8)
is the current stable release, manifest **1.8.0**, at
0c2c6b0e920c3a558a538552530cf2ba16275f73.
The [acceptance ledger](RELEASE_1_8_ACCEPTANCE.md) records the exact
archive verification, hosted gates and installed qualification. See the
[release notes](RELEASE_NOTES_1_8.md) for upgrade requirements and known limits.

The [RC2](https://github.com/slickdexic/Layers/releases/tag/v1.8rc2) and
[RC1](https://github.com/slickdexic/Layers/releases/tag/v1.8rc1) tags and
archives are retained as dated testing packages.

## Before tagging

- Choose the target branch and verify its supported MediaWiki/PHP requirements.
- Review the current findings and unresolved security/data-loss issues. Decide and document scope; test counts alone are not release approval.
- Run `npm test`, `npm run test:php`, `npm run test:phpunit`, and `npm run check:docs` from a clean checkout with installed development dependencies.
- Run relevant live-wiki/E2E scenarios against dedicated test content, including images, standalone slides and PDFs. Record skipped coverage and environment limits.
- Verify backups/migration instructions and export-cache compatibility notes.
- For 1.8, verify that the upgrade procedure keeps ordinary reader and editor
  access restricted through migration, search-index cleanup and verification.
  Preserve the legacy recovery rows, retained source media and a working
  rollback path. [Upgrade procedure](UPGRADING.md)
- For security changes, backport to the supported LTS branch or record the explicit decision in improvement_plan.md. Verify that branch independently.

## Version and documentation

Use `extension.json` as the version authority. Review `scripts/update-version.js` before using it; it may update multiple files. Move the relevant Unreleased notes into a dated version section. Update current landing/install/MediaWiki pages and regenerate the exact wiki Changelog mirror.

Do not rewrite dated audit headers or historical changelog entries to carry the new version. Follow [the documentation guide](DOCUMENTATION_UPDATE_GUIDE.md) and review every generated change.

## Publication

Commit and push the tested release state. Require the final hosted checks and
owner acceptance before publishing the stable release. Build and independently
verify the extension-only archive and its SHA-256 checksum from the exact
accepted commit. Create a tag and release only when authorized for that
release. [Package preparation](RELEASE_PREPARATION.md) · [Owner acceptance gates](PROJECT_CHARTER.md#32-independent-page-history-release)

Publish wiki source pages separately, preserving remote-only content and
verifying their published content. Mediawiki.org source files require a
separate on-site publishing action.

After publication, record the branch, tag, commit, checks and known
limitations. Describe qualification in the tested scope.
