# GitHub wiki source and publishing

This directory contains source pages for [the Layers GitHub wiki](https://github.com/slickdexic/Layers/wiki). This README is a maintainer guide and is excluded from publication.

## Synchronization

1. Clone `https://github.com/slickdexic/Layers.wiki.git` into a separate directory.
2. Fetch the wiki's current branch and reconcile any edits made directly on GitHub.
3. Copy the Markdown pages from this directory except README.md. Preserve remote-only pages/assets; handle intentional removals explicitly.
4. Stage changed/new pages, review the diff, commit, and push the wiki's actual current branch. Do not assume its branch name.
5. Verify remote HEAD and compare published page contents with this source.

GitHub's wiki is a separate repository: pushing main does not by itself prove wiki publication. The workflow in `.github/workflows/wiki-sync.yml` attempts publication; credentials and workflow status must be checked. Do not erase the remote wiki to make copying simpler.

## Mirrors and links

`Changelog.md` exactly mirrors the root CHANGELOG.md. `Current-Status.md` exactly mirrors docs/CURRENT_STATUS.md; their links use full repository URLs so both render correctly. `_Sidebar.md` indexes reader-facing pages.

Use `[[Page Name]]` for wiki navigation and standard Markdown for external links. When linking from a wiki page to repository files, use full GitHub URLs rather than `../docs/...`, which resolves inside the separate wiki repository.

Run `npm run check:docs` from the extension root before publishing. Historical audits live in the main repository, not copied into the wiki navigation. See [the repository maintenance guide](https://github.com/slickdexic/Layers/blob/main/docs/DOCUMENTATION_UPDATE_GUIDE.md).
