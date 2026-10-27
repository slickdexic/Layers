# Bounded release review follow-up

October 27, 2026. Advances Milestone 1 / TYPES / DATA / SEC.

An external code review prompted three bounded corrections. Broader cleanup and
later Cargo milestones remain separate from the independent 1.8 release.

## Corrected boundaries

- **Legacy PDF geometry:** attribute injection and direct-JSON image-link
  injection now pass the selected PDF page to dimension lookup. A portrait
  second page no longer receives the landscape first page's canvas dimensions.
  Stored selection, layer-set name and page-owned source identity do not change.
  The existing database image-link path already passed the page correctly.
- **Clone fallback:** when native cloning is unavailable or refuses a value,
  the manual fallback tracks visited objects. Circular objects/arrays no longer
  exhaust the stack; references within the copied graph remain independent of
  the original. Sparse arrays and prototype-named own data stay intact. Ordinary
  native/JSON clone paths remain unchanged. This does not make circular values
  valid saved layer-set JSON.
- **Legacy navigation permission:** the owner-approved [brief](LEGACY_DEBUG_NAVIGATION_PERMISSION_BEHAVIOUR_BRIEF.md)
  makes missing `editlayers` permission refuse the legacy File-page tab and debug
  action even in debug mode. Authorized navigation remains; completed migration
  continues to retire both entries. This corrects navigation visibility, not a
  demonstrated backend authorization bypass.

Regression checks demonstrate the original failures and exercise corrected
dimensions, fallback graph independence and permission refusal. Host unit tests
do not establish native parser, browser or supported-version acceptance. The
installed compatibility wiki remains on its explicitly recorded candidate until
a reviewed rebuild; working-folder edits apply to the primary development lane.

## Suggestions requiring care

- The editor's raw source bundle has only 31 bytes of headroom at this checkpoint.
  Shape-library data is already separate/lazy and emoji data is sharded. Measure
  the actual editor contributors before another split; raw size is not the
  compressed transfer size or proof of reader startup cost.
- Routine parser logging deserves explicit debug gating. Changing a call from
  info to debug alone does not guarantee silence with a configured debug channel.
  Keep error/security diagnostics and existing log bytes; no logging change is
  included here.
- Import's repeated source/target checks protect against callback and concurrent
  state changes. Do not delete them on the assumption that one PHP request is a
  database snapshot. Any replacement needs equivalent refusal evidence.
- Typed JSON decoding distinguishes objects from arrays before the existing
  associative validators run. Removing that distinction can turn malformed
  requests into clears. Copying also preserves empty-object identity.
- Namespace-free Cargo display fields merit a contract check in milestones 3/4;
  they alone do not prove Cargo's native page ownership overwrites other pages.
- Conditional PDF-header refusal is an explicit, tested private/no-store policy.
  No browser reload failure was demonstrated by the review. Keep that question
  separate from a security vulnerability or proven release defect.
- Shallow cloning of a freshly decoded private object does not establish an
  escaping alias bug without a nested mutation. Occurrence counters need a
  failing native journey before another parser rewrite. Do not remove messages
  based only on static searches that miss computed keys.

Registration/style cleanup, dense-guard refactoring and spelling preferences do
not block 1.8 without a demonstrated defect. Existing [performance failures](PAGE_HISTORY_PERFORMANCE.md)
and the [release acceptance ledger](RELEASE_1_8_ACCEPTANCE.md) remain authoritative;
this review neither waives them nor establishes a completed release.
