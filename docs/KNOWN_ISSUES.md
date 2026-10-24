# Known limits and release acceptance

**Reviewed October 24, 2026.** The page-owned candidate is integrated, while
Milestone 1 acceptance remains open. The manifest's 1.5.95 value does not
identify a tagged Layers 2.0 release. Start with
[current release status](CURRENT_STATUS.md) and the existing
[release checklist](MILESTONE_1_RELEASE_CHECKLIST.md).

## Current qualifications

| Area | Limit or unfinished acceptance |
| --- | --- |
| Supported versions/devices | Recorded native desktop 1.44.6/1.45.3 and narrow-layout results do not cover every supported browser, physical touch device, keyboard or assistive-technology combination. Close the unproved matrix combinations. |
| Viewer/export/Print | The approved PNG/PDF choices and whole-PDF assembly have bounded checks. Reuse inspected complete artifacts in their recorded scope. Remaining 1.44/device/export combinations and OS/physical Print acceptance are not claimed. Legacy cached server export is a separate path with its own fidelity limits. |
| Security/data | HTTP, token/method, owner/source visibility, roles/protection/revocation and retained-row preservation checks are partial release evidence. The full current implementation still needs its relevant security/data review; older audits do not certify new boundaries. |
| Cache visibility | Anonymous current-binding reads may remain publicly cached for up to `LayersBindingReadMaxAge` (default 300 seconds). Historical/control/viewer/editor reads and exact PDF delivery use stricter policies. A stale public binding response is not lasting source-delivery authority. |
| Payload/source support | Native snapshots are bounded at 2 MiB, 100 members, 100 layers per member, 1000 total layers and 4096-pixel canvases, with strict embedded-image validation. Local exact-source availability and MediaWiki media-handler requirements still apply; unsupported sources must be refused rather than substituted. |
| Performance | The measured 100-layer server Save/history budget passes on the documented local fixture. Remaining browser-paint, device/reference-load and other charter performance combinations stay open; no blanket cold-cache claim is made. |
| Previously migrated data | Fresh/replayed upgrades preserve their recorded source and owner data. Existing earlier migrations can require a separate naming/source reconciliation audit. Do not automatically relabel historical snapshots or claim that a fresh migration repairs all earlier data. |
| Packaging/recovery | Verify which maintained native regressions and required fixtures/assets are shipped; local-only evidence is not automatically in public source or CI. Intended-wiki backup/recovery rehearsal, external documentation publication and final release/tag acceptance remain open. |

These are existing release requirements and explicit limits, not a list of newly
asserted production defects. Demonstrated recent corrections include missing
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

Built-in text search follows page ownership, then Cargo readiness, Cargo
integration and on-page layer-object links. Lightbox object links are excluded.
Their remaining work must not delay Milestone 1. Existing code, a slide-name
filter or a source catalog does not prove any later milestone accepted.

## Historical investigations

The [previous public issue record](https://github.com/slickdexic/Layers/blob/2493998a9dad7f36182c0e1d88cef689b2694429/docs/KNOWN_ISSUES.md)
remains in Git history with its original findings, dates and limitations. It is
not today's activation guide. Private investigation history and retained failed
runs remain local and are preserved. No production cleanup or wiki repair is
implied by this documentation refresh.
