# Maintaining and publishing documentation

Updated September 6, 2026. Update documentation when behavior changes, even if no version tag is created. Keep historical release notes and audits dated; never replace their old numbers merely to pass a version grep.

## Sources of truth

| Subject | Source | Published references |
| --- | --- | --- |
| Version/compatibility | `extension.json`, destination branch/tag | README, wiki Installation/Home, extension `.mediawiki` page |
| Configuration and rights | `extension.json` plus enforcement code | wiki Configuration Reference/Permissions, security guide |
| API parameters | `src/Api`, deployed `action=paraminfo` | wiki API Reference; docs/API entry point |
| Schema | `sql/tables/layer_sets.sql`, migrations and database code | Mediawiki-layer_sets-table.mediawiki |
| Current capabilities and tests | Actual code and dated successful runs | docs/CURRENT_STATUS.md and its wiki mirror |
| Proposals | docs/proposals with explicit status | Roadmap links; never advertise as implemented |
| Release history | CHANGELOG.md | Exact mirror in wiki/Changelog.md |

Avoid mutable coverage badges and repeated absolute code-size statistics. Record test date/commit, failures/skips and verification limits. Do not claim fresh coverage without measuring it.

## Change checklist

1. Read the changed code and list affected user/admin/developer flows for images, slides and PDFs.
2. Update active guides, examples, known issues and source comments where they make user-facing claims.
3. Add an Unreleased changelog entry; only update the manifest/tag version as part of an actual release.
4. Reconcile all three `.mediawiki` source documents. They are publication sources, not proof that mediawiki.org has been edited.
5. Synchronize Current Status and Changelog mirrors. Run `npm run check:docs`.
6. Review security fixes against supported branches. Record the backport commit or an explicit deferral/decline; a main-only fix is not a verified LTS backport.
7. Review the diff, commit/push the repository, then publish/verify the separate GitHub wiki. Follow wiki/README.md.

## Validation

The cross-platform documentation checker verifies active local links, wiki page links, mirror parity, configuration/action coverage and MediaWiki schema references. Historical documents are inventoried but excluded from current-link enforcement because paths can legitimately refer to old checkouts. HTTP links are not all fetched by the checker; verify changed external references separately.

Documentation changes do not establish runtime correctness. Run applicable code checks when modifying behavior or tooling. API examples should be checked against the deployed branch's metadata; boolean parameters in MediaWiki's Action API are commonly presence-based, so document omission explicitly.

## Wiki ownership and publishing

`wiki/` contains the maintained source pages. `wiki/README.md` describes the publishing process and is not a reader-facing wiki page. Reconcile remote edits before overwriting a page. Preserve remote-only pages/assets; do not recursively erase the wiki to synchronize it. Newly added pages must be staged before checking whether a commit is needed.

Publishing documentation does not authorize editing SOP content, changing a wiki's configuration, running a migration, announcing a release, or publishing to mediawiki.org. Those are separate operations.
