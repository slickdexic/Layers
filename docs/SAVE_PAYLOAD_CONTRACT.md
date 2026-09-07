# Save payload contract and implementation record

Date: September 6, 2026. Work item: R6.08. Status: implemented; validation results below. No schema migration or new release version.

## Purpose and boundary

Malformed requests must not create an empty annotation revision. The former decoder initialized an empty layer list and let scalar JSON fall through to validation as a deliberate clear. Associative JSON decoding also loses the distinction between an empty object and an empty array.

This contract applies to the shared `layerssave` path for images, PDF pages, `slidename` requests and the `filename=Slide:...` compatibility route. It changes container validation, not page ownership, revision publishing, concurrency or multi-page transaction behavior.

## Accepted input

The required `data` parameter is a JSON string in one of two forms:

```json
[{"id":"label","type":"text","text":"Example","x":10,"y":20}]
```

```json
{"layers":[{"id":"label","type":"text","text":"Example","x":10,"y":20}],"backgroundVisible":true,"backgroundOpacity":1}
```

The outer list, or the envelope's `layers` member, must be a JSON array whose elements are JSON objects. Individual objects still pass through the existing property/type sanitizer and layer validator. Recognizing an object as a container does not establish that its properties are valid.

Both `[]` and `{"layers":[]}` remain valid deliberate clears. This is necessary for removing all annotations from a set. Existing background/canvas metadata processing remains unchanged; this patch does not introduce strict typing for all metadata or reject unknown envelope properties.

## Rejected input and error behavior

| Input | Response |
| --- | --- |
| Malformed JSON or excessive decode nesting | Existing `invalidjson` error |
| `null`, booleans, numbers or strings | `validationfailed` |
| `{}` or an envelope without `layers` | `validationfailed` |
| `layers` is null, scalar or an object, including `{}` | `validationfailed` |
| Numeric-key JSON object pretending to be a list | `validationfailed` |
| A layer entry is null, scalar or array | `validationfailed` |
| Request exceeds configured byte limit | Existing `datatoolarge` check runs before decoding |

Authorization and schema checks retain their existing ordering. For these rejected containers, no `saveLayerSet` call, success result or save-rate-limit operation is reached. No stored revision or published content is changed by the rejected request. Clients must not retry malformed input as an empty list; preserve local work and correct the request.

## Implementation decisions

`ApiLayersSave::parseSavePayload()` first decodes with JSON objects preserved, validates the outer container and element shapes, then decodes into the associative representation required by existing validators. The typed tree is released before the second decode. This intentionally adds a second bounded decoding pass for valid requests, avoiding an unrelated rewrite of nested-property handling. No performance improvement is claimed; the existing byte/depth bounds remain in effect.

Both file and slide saves call this through `validateAndParseLayers()`. The existing `getLayersDatabase()` service accessor is used so execution tests can observe the database boundary without substituting the validation implementation.

## Acceptance evidence

- 28 decoder cases exercise the actual private production method: malformed containers, syntax errors, explicit clears, legacy object lists and envelope metadata preservation.
- 88 execution cases send the malformed containers through `execute()` for image, PDF page 2, standalone slide and Slide-prefixed filename routes. They assert the error and that database writes, success results and save rate limiting are never reached.
- Targeted result: 116 tests, 403 assertions passed.
- Full standalone PHPUnit suite: 802 tests, 1,878 assertions, one existing skipped test. No coverage driver was available.
- `npm test` passed: 180 suites / 14,310 JavaScript tests and repository guards. PHP lint/style/MinusX and documentation/version checks passed. No browser, real-database or MediaWiki-core integration result is implied by the standalone harness.

The accepted-payload tests prove decoder preservation. They do not claim a new end-to-end successful-save test against a running wiki. Existing downstream validation remains a separate responsibility.

## Compatibility and rollout

No valid documented payload format is removed. Clients that previously sent `{}`, scalars, object maps or non-object layer entries must send a proper list/envelope. Deliberate clears must be explicit. Deploy with the normal extension code update; no database updater is needed specifically for this change.

If an integration fails, inspect its payload shape without logging confidential annotation content and correct the client. Reverting the code reopens the silent-clear behavior; do not add a permissive fallback that restores it. LTS backports require separate verification.

## Follow-up, not completed here

Continue with remaining save/draft inconsistencies and export integrity, then page-owned atomic revision publishing. Separately assess strict metadata typing, dimension consistency and duplicate JSON-member handling. A valid empty list is still a destructive user edit and needs the larger conflict/revision safeguards; this patch only prevents malformed data from masquerading as that edit.
