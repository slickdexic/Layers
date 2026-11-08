# Known limits and release acceptance

## Search in v1.8rc1

After completed migration and search cleanup, MediaWiki's normal search includes
eligible text from the current owning page's layer sets, including slides and
PDF layers. Old page revisions and retained legacy rows do not supply obsolete
terms to the current page index. Ordinary page text remains searchable.

Layer text saved in a page revision follows that page revision's permissions.
Hiding the referenced file does not hide text saved in a readable page revision.
To restrict that text, restrict the appropriate page revision as well. Media
viewing still checks the referenced source. External search backends and publicly
served unmigrated legacy mode are not certified by this candidate.

Keep readers and editors restricted through migration and successful search
cleanup; an edit-only freeze is insufficient. Use the
[upgrade guide](https://github.com/slickdexic/Layers/blob/main/docs/UPGRADING.md).

**Updated November 8, 2026.** Published testing candidate **v1.8rc1** reports
**1.8.0-rc.1**. Final stable Milestone 1 acceptance remains open. The
[1.8 acceptance ledger](RELEASE_1_8_ACCEPTANCE.md) separates its remaining checks
from the broader 2.0 roadmap. Start with
[current release status](CURRENT_STATUS.md) and the existing
[release checklist](MILESTONE_1_RELEASE_CHECKLIST.md).

## Current qualifications

| Area | Limit or unfinished acceptance |
| --- | --- |
| Tool shortcuts | Shipped handlers do not dispatch M for Marker, G for Shape Library or J for Emoji despite older help claiming them. Use toolbar controls. The Unreleased help correction removes those inaccurate claims; adding shortcuts requires a separate fix. The existing Marker toolbar tooltip still advertises M and needs the same scoped follow-up. |
| Supported versions/devices | Recorded desktop/narrow results and [six native Minerva phone-viewer checks](PHONE_VIEWER_ACCEPTANCE.md) do not cover every supported physical device or assistive technology. Tablet editing and manual acceptance remain open. |
| Phone viewer touch panning | **Corrected in bounded browser scope:** the owner-approved [accessible repair](PHONE_VIEWER_ACCEPTANCE.md#approved-correction-and-bounded-verification) passes six native image/slide/PDF light/dark cases. Finger and mouse translation, Pan buttons, keyboard/focus, PDF shortcuts and actual browser pinch pass. Physical-device and manual accessibility acceptance remain open. |
| Viewer toolbar with enlarged text | **Corrected in bounded browser scope:** the owner-approved [bounded toolbar](VIEWER_TOOLBAR_LAYOUT_ACCEPTANCE.md) preserves a normal 14px UI base and caps toolbar height at 96px or one quarter of the viewer. Native label/focus/scroll/Fit and narrow/landscape/enlarged-text checks pass. Physical-device and manual accessibility acceptance remain open. |
| Viewer/export/Print | The approved PNG/PDF choices and whole-PDF assembly have bounded checks. Reuse inspected complete artifacts in their recorded scope. Remaining 1.44/device/export combinations and OS/physical Print acceptance are not claimed. Legacy cached server export is a separate path with its own fidelity limits. |
| Security/data | HTTP, token/method, owner/source visibility, roles/protection/revocation and retained-row preservation checks are partial release evidence. The full current implementation still needs its relevant security/data review; older audits do not certify new boundaries. |
| Cache visibility | All `layersread` responses are private with maximum age zero, including anonymous bindings and failures. `LayersBindingReadMaxAge` is a retained compatibility setting. Exact PDF delivery has separate no-store checks; previously delivered bytes cannot be recalled. |
| Payload/source support | Native snapshots are bounded at 2 MiB, 100 members, 100 layers per member, 1000 total layers and 4096-pixel canvases, with strict embedded-image validation. Local exact-source availability and MediaWiki media-handler requirements still apply; unsupported sources must be refused rather than substituted. |
| Performance | The measured 100-layer server Save/history budget passes on the documented local fixture. Remaining browser-paint, device/reference-load and other charter performance combinations stay open; no blanket cold-cache claim is made. |
| Previously migrated data | The read-only [pilot review](PILOT_DATA_REVIEW.md) identifies three split-name PDF groups; all ten members match their earliest stored surfaces and strict retained-row conversion, excluding names. A reference-aware repair proposal and owner disposition remain; no automatic merge or historical rewrite is authorized. Post-migration rename/copy now request bare output for new targeted writes. |
| Packaging/recovery | The published v1.8rc1 archive and its 2,941 installed files were verified; exact-commit CI and GitHub wiki synchronization passed. Each deployment still requires its own consistent backup/recovery rehearsal. Final stable acceptance remains separate; repository `.mediawiki` sources do not prove mediawiki.org publication. |

These rows record current release requirements and explicit limits, not newly
asserted defects. Demonstrated recent corrections include touch panning, missing
slide overlays, PNG Download routing, request-limit enforcement and retention
of legacy rows after native file deletion. Their successful scoped replays do
not close unrelated acceptance combinations.

## Preserve work when a boundary refuses

A stale/uncertain Save, unavailable source, failed PDF page or rejected Import
must preserve current work. Keep drafts and use the existing Check/recovery flow
where appropriate. Do not clear storage, use another revision/file/page as a
substitute, or manually fabricate migration-completion records.

After completion, shared-set writes are read-only. Old statements that normal
page-owned Saves still use `layer_sets`, that native Import is wholly inactive,
or that the File-page tab is required are historical. Use the
[native API guide](PAGE_OWNED_API_GUIDE.md) and current user guides.

## Later milestones

Current page-owned text search is included in v1.8rc1 after migration and
cleanup. Broader search acceptance, Cargo readiness, Cargo integration and
on-page layer-object links remain in the charter order. Lightbox object links are excluded.
Their remaining work must not delay Milestone 1. Existing code, a slide-name
filter or a source catalog does not prove any later milestone accepted.

## Historical investigations

The [previous public issue record](https://github.com/slickdexic/Layers/blob/2493998a9dad7f36182c0e1d88cef689b2694429/docs/KNOWN_ISSUES.md)
remains in Git history with its original findings, dates and limitations. It is
not today's activation guide. Private investigation history and retained failed
runs remain local and are preserved. No production cleanup or wiki repair is
implied by this documentation refresh.
