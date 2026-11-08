# Release guide

Updated November 8, 2026. The published testing candidate is **v1.8rc1**,
manifest **1.8.0-rc.1**, at `cfdf8f2bd31b1d9616871e769317b52c64aba0bd`.
The tag and downloadable archive are immutable. Later documentation/help fixes
on main are Unreleased until another candidate is explicitly published.
A documentation refresh is not a new version release.

## Before tagging

- Choose the target branch and verify its supported MediaWiki/PHP requirements.
- Review the current findings and unresolved security/data-loss issues. Decide and document scope; test counts alone are not release approval.
- Run `npm test`, `npm run test:php`, `npm run test:phpunit`, and `npm run check:docs` from a clean checkout with installed development dependencies.
- Run relevant live-wiki/E2E scenarios against dedicated test content, including images, standalone slides and PDFs. Record skipped coverage and environment limits.
- Verify backups/migration instructions and export-cache compatibility notes.
- For security changes, backport to the supported LTS branch or record the explicit decision in improvement_plan.md. Verify that branch independently.

## Version and documentation

Use `extension.json` as the version authority. Review `scripts/update-version.js` before using it; it may update multiple files. Move the relevant Unreleased notes into a dated version section. Update current landing/install/MediaWiki pages and regenerate the exact wiki Changelog mirror.

Do not rewrite dated audit headers or historical changelog entries to carry the new version. Follow [the documentation guide](DOCUMENTATION_UPDATE_GUIDE.md) and review every generated change.

## Publication

Commit and push the tested release state. Create a tag/release only when requested or authorized for that release. Publish wiki source pages through the separate wiki repository, preserving remote-only content, then verify its HEAD and source parity. Mediawiki.org source files require a separate on-site publishing action; repository edits do not update that site automatically.

After publication, record the branch/tag, commit, checks and known limitations. Avoid statements such as complete audit compliance, identical exports or all features supported unless the corresponding acceptance tests and implementation establish them.
