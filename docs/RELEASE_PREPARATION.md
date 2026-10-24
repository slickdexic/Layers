# Milestone 1 release preparation

This is delivery work for the existing charter, advancing OPS-1, OPS-2 and
OPS-3. It adds no feature or runtime dependency. The
[release checklist](MILESTONE_1_RELEASE_CHECKLIST.md) remains the acceptance
boundary; later search, Cargo and link milestones do not delay page ownership.

## Code and workspace cleanup

- Keep generated test reports, coverage, caches, logs and temporary output out
  of published source. The generated `test-results/.last-run.json` is removed
  from the public tree; future test reports are ignored.
- Bound Jest project discovery to maintained tests and shipped resources.
  Preserve test patterns, assertions and coverage settings, and compare the
  complete suite list with the preceding run. Temporary evidence must not make
  ordinary test discovery scan copied repositories.
- Preserve maintained test fixtures, committed runtime assets, fonts, licenses
  and vendored PDF support. A generated file can still be a required asset;
  classify it through its callers before removing it.
- Inventory local acceptance evidence separately. Archive it with a verified
  manifest and a recovery location before removing working copies. Keep data,
  credentials, logs, database exports, private PDFs and local Git ancestry local.
  Do not erase retained failures or rebaseline them to make cleanup pass.
- Review unused production helpers only after checking registration and callers.
  Removing a supported control, entry point or behavior still needs the owner's
  prior approval under the charter. Historical prototypes do not authorize a
  replacement runtime architecture.

The public report removal does not delete the private working copy. Bulk local
evidence archival and unused-code removal remain separate reviewable steps.

## Documentation review

| Area | Release requirement and current scope |
| --- | --- |
| Primary entry guides | README, installation, quick start and configuration introductions now describe owner-page overlays, migration completion, shared PDF naming and native atomic publication. They distinguish the candidate from the old tagged release. |
| Upgrade and recovery | Follow [UPGRADING.md](UPGRADING.md): exact versions, consistent backup, rehearsal, update/discovery, dry run, unscoped completion, verification, safe rerun and rollback. The retained rehearsal covers 1.5.95/MySQL on MediaWiki 1.44.6; other combinations require their own checks. |
| APIs, permissions and author syntax | The [native API guide](PAGE_OWNED_API_GUIDE.md), API entry/reference, permissions, named sets, embed syntax and slide workflow now distinguish native ownership from legacy shared storage, including Default selection, PDF naming, history and caching. Source/schema and maintained regressions were checked; no runtime behavior changed. |
| Settings and user help | Configuration defaults/callers, native versus legacy bounds, FAQ, troubleshooting and the wiki home now follow the owner-page workflow. Guidance preserves uncertain Saves/drafts and distinguishes physical-device/Print acceptance. Candidate wiki-to-repository links use full source URLs. |
| MediaWiki publication sources | All three source documents now describe native ownership/history, atomic PDF Save, overlays, upgrade completion and the required milestone order. The extension page checks manifest metadata/settings; the table page is explicitly legacy storage. Updating these files does not publish to mediawiki.org. |
| Specialized/developer examples | Review remaining specialized examples against the final candidate when they affect release instructions. Preserve dated records and qualify deployment claims; the primary guides and publication sources are refreshed. |
| Status and known issues | Public status and known limits now summarize the existing release matrix, current integrated behavior and remaining qualifications. Prior public records remain in Git history; private investigation prefixes remain exact and local. |
| Published documentation | Repository/wiki sources and the three MediaWiki source documents are refreshed. Separate GitHub-wiki/mediawiki.org publication and remote verification remain release actions; this source update performs neither. |
| Release notes and version | Describe the final accepted behavior, supported versions, measured limits and migration requirements. Assign the release version/tag only at the agreed acceptance checkpoint. |

## Before the milestone commit/tag

1. Finish the existing native/browser, security/data and performance matrix.
2. Verify the outgoing source tree excludes private data and generated reports
   while retaining every required runtime asset and license.
3. Complete the documentation review above and rehearse the upgrade/recovery
   instructions on the intended wiki copy.
4. Run required gates on the exact reviewed commit and record its CI result.
5. Have the project owner complete acceptance on the intended wiki. Only the
   owner declares the milestone accepted and Layers 2.0 ready.
