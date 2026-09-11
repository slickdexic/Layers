# Known issues — Layers 1.5.95 and subsequent main fixes

Updated September 11, 2026. This is the current operational summary; dated reviews remain historical evidence. Review-branch corrections below are on the local review branch and are not yet merged to main.

See [Current status](CURRENT_STATUS.md) for tested revisions, upgrade notes and capability boundaries, and [the R6 review](../codebase_review.md) for reproduction evidence.

| Area | Open issue / operational guidance |
| --- | --- |
| Corporate history (R6.19) | The optional null-edit audit path does not supply reliable page revisions. Do not claim controlled-document compliance |
| Search | Text inside slides/images/PDF annotations is not explicitly indexed by MediaWiki; name filters are different |
| Cargo | Current support selects gallery layer sets; annotation tables and linked fields are proposals |
| Set naming | R6.09/R6.17 save targeting and configured seeds corrected. J17 now validates canonical names across save/info/rename/delete on the review branch |
| Drafts (R6.10) | Unambiguous versioned injective draft keys (v2) implemented in J16 with safe legacy migration, user/wiki sweep scoping, and quota protection. Foreground save lifecycle audit documented for L01/J08 |
| Exports (R6.11–12) | Failed pages/overlays may be omitted; server rendering does not reproduce all background, rich-text and rotation settings. Compare exported output with the viewer |
| Foreign files (R6.13) | A missing local File page can prevent backlink cache purges; refresh affected pages if overlays remain stale |
| Slide rate limiting (R6.14) | Corrected on review branch: new slides/named slide sets use the creation bucket; existing updates retain save limits |
| Test quality (R6.15) | J18 reports browser passes; premature dirty reset was removed during review. Failure-safe switching and isolated reruns remain J20/J21 |
| Dependencies (R6.16) | A production-only dependency audit omits the vendored pdf.js dependency; check shipped assets as well |

## Recently fixed

R6.01–R6.08 and the lightbox race R6.18 are fixed on `main` after the 1.5.95 tag. See [Unreleased changes](../CHANGELOG.md#unreleased). Failed buffered saves retain work; returning to a page restores its set/background; replaced images and stale requests cannot attach to the new lightbox view. Legacy pruned ownership and old export-cache compatibility restrictions are intentional; see [Current status](CURRENT_STATUS.md).

R6.08 now rejects malformed JSON containers before writes while preserving explicit empty-list clears. See [save payload contract](SAVE_PAYLOAD_CONTRACT.md) for compatibility and test limits.

## Reporting

For a normal bug, include branch/commit, MediaWiki/PHP/browser versions, image/PDF/slide type, minimal markup, expected/actual behavior and sanitized console/API errors. Use private reporting for security issues as described in [SECURITY.md](../SECURITY.md). Do not include confidential SOP content, tokens or database dumps in public issues.

See the [junior implementation review](JUNIOR_IMPLEMENTATION_REVIEW.md) for corrections, verification and remaining limits.

Latest J19–J21 review corrected import-validation bypass and stale set responses. Recovery destination/undo behavior and real API/browser acceptance remain J22–J24; see [the review record](JUNIOR_IMPLEMENTATION_REVIEW.md). Earlier task references above are historical checkpoints.
