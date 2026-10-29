# October 28 codebase audit: action and verification

This review advances the 1.8 data-integrity, security and operational criteria.
The external audit remains local. These results describe the working candidate,
not a published release.

| Finding | Current disposition |
| --- | --- |
| A01: legacy text loss | Candidate correction makes invalid text a Save error instead of a warning that drops the property. A native legacy slide API test verifies safe text persists and unsafe text is refused without changing saved rows. Image and broader release qualification remain to be checked. |
| A02: draft accumulation | The owner approved [bounded retention](DRAFT_RETENTION_BEHAVIOUR_BRIEF.md). The candidate retires an owned prior-base record only after confirmed Save and verified replacement; focused tests cover quota, failed writes, uncertain outcomes, newer edits, recovery sources and other writers. A later owner test exposed a separate large-image quota failure: the candidate now losslessly compacts repeated data only after quota refusal, without removing other drafts. The owner confirmed the previously blocked Save succeeded, and the new page revision was verified. A fresh draft store and controller with a different writer ID also discover and inspect the compact backup with identical content and no storage changes; this is a client integration test, not a browser-restart or Restore acceptance. Broader browser and owner screen acceptance remain open. Older editor code cannot recover compact drafts; see the upgrade guide. |
| A03: cached binding visibility | Candidate makes binding reads private and zero-age, including requests with a positive legacy setting. A native anonymous API test and a read-only 1.45 HTTP check passed. CDN/intermediary and complete release acceptance remain to be checked. |
| A04: incomplete PDF export | The owner approved the [correction](PDF_EXPORT_COMPLETENESS_BEHAVIOUR_BRIEF.md). The candidate refuses failed pages, failed compositing and reported dropped layers. Export-specific fresh renders avoid losing dropped-layer evidence to a thumbnail-cache hit. Focused tests and a real-renderer native test pass. A native API test refuses a failed middle page and exports and reuses a three-page PDF; an independent PDF inspection confirms the page count. Full real-media and browser acceptance remain open. |
| A05: partial cached PDFs | Candidate writes to a unique temporary file, checks PDF boundaries and publishes only after conversion succeeds. The cache key excludes old artifacts. Unit tests cover failed, incomplete and interleaved writes; a native 1.44 test generated a PDF through the real converter. Two independent PHP processes also verify overlapping success and failure using controlled test output: partial output is not exposed, and a failed render cannot replace a completed result. This is not a real-converter concurrency stress test; end-to-end export acceptance remains open. |
| A06: literal and multilingual text | Candidate preserves safe equations, joined emoji and multibyte text within the existing character limit; unsafe text is refused. Focused validator and native legacy Save checks pass. Browser acceptance remains open. |
| A07: repeated read work | The candidate skips file-source resolution for slides and resolves selected file sources together, decoding the authorized snapshot once for source resolution instead of once per selected file. Checks and failure isolation remain per surface. A native mixed image/PDF test verifies an unavailable PDF does not suppress the available image, and the affected native reader/refusal suites pass 31 tests / 187 assertions. The existing PDF page limit is also checked before the set-name scan. Edit-link preparation, affected export verification and representative performance measurements remain open; no end-to-end timing improvement is claimed. |
| A08: shipped PDF dependency audit | `pdfjs-dist` is classified as a production dependency so the existing blocking production audit covers it. A local synthetic registry test runs npm's real production-audit command: a clean response passes and a high-severity PDF-library advisory fails. The release package checks and shipped asset verifier pass. A fresh production audit reported zero vulnerabilities using trusted system certificates; the first attempt failed to verify the local certificate chain. A fresh locked Composer audit found no advisory or abandoned packages using trusted system certificates. Exact-commit hosted CI remains pending. |
| A09: native tests outside CI | The native workflow installs MediaWiki 1.44 on a disposable SQLite wiki and runs a selected page-history suite on pushes and pull requests. It passed on [candidate commit 0fd1a24](https://github.com/slickdexic/Layers/actions/runs/40809337201): 47 tests / 132 assertions. The same selection passed locally on 1.44 / MySQL. The broader native suite and additional MediaWiki versions remain separate. |
| A10: low-severity development advisory | A fresh full npm audit reports five low-severity dependency entries from the development-only `deepmerge` advisory; zero moderate, high or critical. No production reachability is established. Continue monitoring and recheck at release; do not apply the suggested breaking Jest downgrade. |

No conclusion here replaces owner acceptance or the remaining gates in the
[release ledger](RELEASE_1_8_ACCEPTANCE.md).

Final standalone PHP verification passed 1,697 tests and 4,217 assertions with
one existing skip. Documentation, bundle-size, asset, PHP-reference, parallel
list and atomicity checks passed. The project lint and translation checks
passed with six existing JavaScript warnings. The native results above use the
1.44 test environment and isolated test data, not an installed release build.
After the batch-read correction, the standalone run again passed 1,697 tests /
4,217 assertions with one skip under normal temporary-file access. A first run
in the restricted filesystem had three PDF cache temporary-file failures; the
same four cache tests and the full suite passed outside that restriction.
