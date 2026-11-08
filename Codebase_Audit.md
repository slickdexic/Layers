# Codebase audit and remediation roadmap

## Public release-candidate authorization — November 7, 2026

The owner requested commit/push and release as **v1.8rc1**. This is the first
public prerelease, using the qualified internal rc.3 runtime with manifest
**1.8.0-rc.1**. Earlier local rc.1–rc.3 artifacts remain historical evidence.
The approved migration/search-cleanup requirement remains mandatory. The owner
reports satisfactory normal-use performance; remaining numeric/reference and
manual/device/Print qualifications stay disclosed for final 1.8 acceptance.
This advances Milestone 1 / OPS-1–OPS-3. Publication requires the reviewed clean
tree and its exact-commit CI; unrelated private work is not part of the release.

## Owner performance observation — November 7, 2026

The owner reports that normal page loads are fast and the previous performance
problems are no longer apparent. Ctrl-Shift-R remains slow, but also on pages
without layers, including the main page. This is positive owner evidence for
normal-use responsiveness (Milestone 1 / PERF / OPS-1). The specific port,
browser, pages and timings were not supplied with this observation; do not
attribute it to an exact installed artifact or every device/workflow.

The shared forced-reload symptom suggests a wiki/resource-loading or environment
cost, but does not identify its cause or prove Layers adds no overhead. It must
not be described as a reproduced Layers-specific delay. Further optimization
needs a matched plain-page/layer-page comparison with cache conditions recorded.
Distinguish total page load from PERF-2's image-loaded-to-layer-painted interval.
The retained rc.1 sample of 312.4 ms against 300 ms concerns that latter interval
with a fresh browser cache and warm server, not overall page load.

**Current assessment:** ordinary-use performance is satisfactory in the owner's
reported testing; the earlier visible problems are not currently reported.
Retain the numeric miss and reference-condition limits as a bounded measurement/
acceptance item. This feedback is not an instruction to change the 300 ms target
or a blanket waiver of unmeasured workflows. It does not justify an open-ended
performance rewrite or delaying release for an unproven Layers-specific cause.

## Search repair qualified on the installed candidate — November 7, 2026

**Layers 1.8.0-rc.3 is installed on port 8082**, source
`de7fce5a1cf049c143f883a8705f565bdd47aa85`, local branch `codex/v1.8.0-rc.3`.
The affected native search/migration group passes **59 tests / 531 assertions
on installed MediaWiki 1.44.6**, and **59 tests / 543 assertions on 1.45.3**.
All 2,939 packaged file hashes match the installed image. Eight content-table
witnesses, nine pages, sixteen revisions and all upload-file hashes are unchanged;
no `unittest_` tables remain. Service settings and the HTTP-denial guard remain.
The installed editor resources serve rc.3 and approved Import guidance.

Installed rc.2 testing uncovered an additional real defect: its search ingress
required the 1.45 revision event/interface, so native 1.44 saves did not reliably
index layer text. Rc.3 registers both version-specific event names with the same
guarded handler. Public-search tests now explicitly set public-read permissions;
private-read denial coverage remains. Rc.2's 10 errors / 15 failures are retained,
not counted as a pass. No live wiki permissions were changed for these tests.

The lead investigation found and corrected two reproducible post-migration
defects. Search continued reading retained legacy rows after D3 completion,
resurrecting text removed from the current owning page. The cleanup command
also missed stale entries once their Layers associations disappeared. Search
now uses only current page-owned layer text after completion; cleanup visits
every current page in bounded batches, preserving ordinary page text and
recovery records. It refuses disabled search updates and propagates write
failures instead of reporting success. This advances Milestone 1 / HIST-4,
HIST-8–HIST-9, SEC-2, SEC-6 and OPS-1–OPS-3.

Both new defect regressions failed before correction. PHP style passes. Coverage includes
Special:Search, list/generator API results and counts, cleanup reruns, unchanged
page revisions, retained recovery rows and approved page-owned search during
source suppression/restoration without refresh jobs. Two existing upload tests
initially failed because their fixtures targeted the installed repository; their
helper now uses the established isolated temporary repository. No installed
uploads or ordinary wiki content were changed.

**This is a working post-migration correction, not a fix for publicly served
unmigrated legacy mode.** The [approved boundary](docs/RELEASE_1_8_MIGRATED_SEARCH_BOUNDARY.md)
requires migration and search cleanup before readers regain access, with old
code work drained. The owner approved this boundary on November 7. The upgrade
guide now describes reader restriction, cleanup, failed-run recovery and rollback.
Additional PDF-member, slide, stale-property and delayed-write cases pass. The
8082 test service was briefly recreated for the reviewed candidates. No live
migration, content edit or installed-wiki index cleanup was performed; cleanup
qualification used native isolated fixtures. Port 8080 retains core 1.45.3 and
uses the updated working source; 8081 was not changed.

The reported retained-legacy-index defect now has a tested solution for the
approved migrated path. Deployment must still follow the runbook before
reopening. Public legacy mode and arbitrary search backends are not certified.
The remaining release work is performance disposition, applicable manual/device
and owner acceptance, and hosted CI/publication for the selected final artifact.
The broader rc.1 passes remain usable for unchanged files; no full rc.3 suite or
new browser publication journey is claimed. No public push or final tag was made.

