# Gemini review: release triage

This triage advances the 1.8 data-integrity, security and upgrade gates. It
assesses selected claims from the October 28 review against the candidate; it
does not certify the rest of that review or the entire extension. The external
review itself and local test output remain outside the public source package.

| Finding | Evidence and disposition |
| --- | --- |
| Foreign fallback length | **Confirmed boundary defect:** the legacy foreign-file fallback emits 48 characters; the MySQL `layer_sets` column is `VARCHAR(32)`. A native 1.44 test using a synthetic foreign file and a temporary MySQL table in strict mode reproduced the length error. SQLite uses `TEXT`, so the review's claim of the same 32-character SQLite column is incorrect. This is a legacy shared-storage path; the native page-history schema requires a local repository and a 31-character source hash. A replacement identity must preserve access to existing rows and migration behavior; do not simply truncate or change hashes without that review. No existing data loss was demonstrated. |
| Help dialog message injection | **Claim not reproduced:** both cited templates call `getMessageEscaped`, which uses MediaWiki's escaped message or a text-node fallback. A focused test supplies markup-looking message text and verifies the overview and tips render it as text, not an image element. This result covers those message paths, not every HTML sink in the extension. |
| Literal layer text | **Confirmed validation limitation:** the review's spaced example `Condition: 0 < x and y > 10` is retained, but `a<b>c` is sanitized to `ac` and `<button>` to an empty string. Native strict document validation refuses these altered inputs as `invalid-or-lossy-layer-data`; it does not silently publish the altered snapshot. The legacy save sanitizer can alter text. A correction needs output-context and compatibility review before changing sanitization. |
| Layer links | **Later milestone, not an accepted 1.8 feature:** the owner ordered links after page ownership, search and Cargo. The required link behavior is on wiki-page images, slides and PDF pages, not in the lightbox. Stored properties or validators do not establish that milestone as complete. |
| Multiple caption links | **Reported example not reproduced:** the initialized MediaWiki 1.44 parser collector retained the complete `[[File:Pic.jpg|thumb|See [[Link1]] and [[Link2]] for details]]` occurrence and both caption links. This is a focused collector check, not an exhaustive parser or rendered-page proof. |
| Foreign thumbnail name normalization | MediaWiki 1.44's standard `File::getName()` obtains the repository name from the title's DB key, normally using underscores. The claimed space mismatch is not established for that normal path; custom repositories and actual saved data have not been exhaustively checked. |
| PDF export queries | Source inspection confirms the legacy server PDF export retrieves an existing page's row while forming the cache key and retrieves it again during rendering. Its effect has not been benchmarked; the page-owned viewer/download path is distinct. |
| PHP file-mode check | The installed `minus-x` implementation explicitly ignores `node_modules`, `vendor` and `.git`. The review's claim that it traverses `node_modules` is incorrect. |
| History reflection and bundle size | The deep working-copy history guard is conditional on the working-copy Import history mode, not automatically every ordinary edit. Its actual performance cost remains unmeasured. The editor's existing raw bundle guard is close to its configured limit; that is a real maintenance constraint, not by itself evidence of a user-visible slowdown. |
| API continuation | The source accepts continuation parameters; legacy `layerslist` returns its continuation inside the module result, and some `layersinfo` paths fetch an extra row without returning a next token. Interoperability and affected callers need a native API test before changing the existing contract. |

The remaining observations about indexes, cache scope, TypeScript, internal
class organization, unused methods, debug text, duplicate conditions, filename
comparison and lint warnings remain unqualified. Measure or reproduce each
before changing behavior or adding release scope. Do not weaken source checks,
history preservation or authorization based solely on a speculative performance
claim. Existing tests and passing CI do not remove the two confirmed issues above.
