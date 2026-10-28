# Layers 1.8 / Milestone 1 release preparation

This is delivery work for the existing charter, advancing OPS-1, OPS-2 and
OPS-3. It adds no feature or runtime dependency. The
[release checklist](MILESTONE_1_RELEASE_CHECKLIST.md) remains the acceptance
boundary. Under the October 25 owner amendment, page ownership/history ships
independently, with **1.8** as the working version. Use the
[acceptance ledger](RELEASE_1_8_ACCEPTANCE.md) for the remaining checks; later
search, Cargo and link milestones do not delay this release.

## Code and workspace cleanup

- Keep generated test reports, coverage, caches, logs and temporary output out
  of published source. The generated `test-results/.last-run.json` is removed
  from the public tree; future test reports are ignored.
- Bound Jest project discovery to maintained tests and shipped resources.
  Preserve test patterns, assertions and coverage settings, and compare the
  complete suite list with the preceding run. Temporary evidence must not make
  ordinary test discovery scan copied repositories.
- Include the [portable native regression package](NATIVE_REGRESSION_TESTING.md)
  and its maintained helper/media fixtures; native coverage is separate from CI.
- Run `npm run check:assets` on the final artifact; preserve the
  [asset inventory and individual notices](SHIPPED_ASSET_AUDIT.md) on updates.
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
| Upgrade and recovery | Follow [UPGRADING.md](UPGRADING.md): exact versions, consistent backup, rehearsal, update/discovery, dry run, unscoped completion, verification, safe rerun and rollback. The retained migration rehearsal covers 1.5.95/MySQL on MediaWiki 1.44.6. The [intended-wiki recovery checkpoint](INTENDED_WIKI_RECOVERY_CHECKPOINT.md#application-level-restore--october-26-2026) also qualifies application startup and representative native/HTTP image, slide and PDF reads with restored data on 1.45.3. It uses reconstructed test settings, not the site's private configuration; preserve that limit and reconcile sources with the final artifact. |
| APIs, permissions and author syntax | The [native API guide](PAGE_OWNED_API_GUIDE.md), API entry/reference, permissions, named sets, embed syntax and slide workflow now distinguish native ownership from legacy shared storage, including Default selection, PDF naming, history and caching. Source/schema and maintained regressions were checked; no runtime behavior changed. |
| Settings and user help | Configuration defaults/callers, native versus legacy bounds, FAQ, troubleshooting and the wiki home now follow the owner-page workflow. Guidance preserves uncertain Saves/drafts and distinguishes physical-device/Print acceptance. Candidate wiki-to-repository links use full source URLs. |
| MediaWiki publication sources | All three source documents now describe native ownership/history, atomic PDF Save, overlays, upgrade completion and the required milestone order. The extension page checks manifest metadata/settings; the table page is explicitly legacy storage. Updating these files does not publish to mediawiki.org. |
| Specialized/developer examples | Review remaining specialized examples against the final candidate when they affect release instructions. Preserve dated records and qualify deployment claims; the primary guides and publication sources are refreshed. |
| Status and known issues | Public status and known limits now summarize the existing release matrix, current integrated behavior and remaining qualifications. Prior public records remain in Git history; private investigation prefixes remain exact and local. |
| Published documentation | Repository/wiki sources and the three MediaWiki source documents are refreshed. Separate GitHub-wiki/mediawiki.org publication and remote verification remain release actions; this source update performs neither. |
| Release notes and version | Describe the final accepted behavior, supported versions, measured limits and migration requirements. Assign the release version/tag only at the agreed acceptance checkpoint. |

## Reviewed candidate archive — October 27, 2026

The public snapshot at `ff57fa0ece2d9275deb9ef7f70b877c17c63dc44` has a
verified clean archive containing 2,859 regular files under `Layers/`:

```sh
git archive --format=tar --prefix=Layers/ --output=Layers-candidate-ff57fa0.tar ff57fa0ece2d9275deb9ef7f70b877c17c63dc44
```

Archive size: **74,905,600 bytes**. SHA-256:

```text
43f4c93559af2ba18266348f6ff08b469a0889ed3d7bf85fbd9ab6d97005ebf9
```

The extracted files match the public Git blobs. Non-guide files match the
installed, tested candidate; the asset guard verifies all 225 registered file
references and retained fonts, shapes, emoji, notices and pdf.js files. The
26 migration, schema, maintenance and native composition sources in the retained
application-recovery snapshot remain exact in the checkout and equivalent in
the archive after Git's line-ending normalization. This carries forward the
documented upgrade/recovery scope; it is not another fresh upgrade rehearsal.

This is a source snapshot, **not the versioned 1.8 release**. Its manifest still
says 1.5.95, as required before the release cut. The archive comes from the
reviewed public commit, never private working HEAD. A later inspection found
that the commit also contains historical `docs/acceptance` archives, including
test screenshots and logs. The earlier statement that the snapshot contained no
captures or logs was incorrect. The presence of those test artifacts does not by
itself establish that they contain private information, but they must be excluded
from the release package. They were already tracked in public Git history; a
package exclusion alone cannot remove that history. Local privacy guards remain
development setup, not files to copy into the release.

The four tracked ZIPs contain 104 entries in total. A limited text scan found no
matches for common credential labels or Windows user paths; one screenshot
reviewed depicts a synthetic test fixture. This is not a complete review of the
images or a guarantee that every historical artifact is free of private data.

At the final version/tag cut, build from that exact accepted public commit with
the historical evidence excluded, verify the package's contents and documentation
links as well as its runtime assets, publish its new checksum, and reconcile any
changed sources. A plain `git archive` is insufficient while those artifacts
remain tracked. This dated snapshot and its checksum do not
automatically qualify a later artifact. Remaining performance, manual/device,
owner and release actions stay in the [acceptance ledger](RELEASE_1_8_ACCEPTANCE.md).

## Before the milestone commit/tag

1. Finish the existing native/browser, security/data and performance matrix.
2. Verify the outgoing source tree excludes private data and generated reports
   while retaining every required runtime asset and license.
3. Complete the documentation review above and rehearse the upgrade/recovery
   instructions on the intended wiki copy.
4. Run required gates on the exact reviewed commit and record its CI result.
5. Have the project owner complete acceptance on the intended wiki. Only the
   owner declares Milestone 1 accepted and its independent release ready.
   Confirm the final 1.8 version/tag at that cut; the complete 2.0 sign-off
   remains separate.
