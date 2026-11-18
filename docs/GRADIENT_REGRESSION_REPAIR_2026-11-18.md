# Gradient regression repair — November 18, 2026

Advances FEAT-4 (existing editing tools), HIST-4 (native page Save) and DATA-1
(preservation). The owner found these failures during basic testing on the
maintained MediaWiki 1.45.3 wiki at port 8080. Earlier passing suites and release
readiness statements missed this behavior.

## Causes and repairs

- PropertiesForm compared gradient object identity to decide whether controls
  were current. Normal history capture cloned unchanged data, disabling later
  events. Compare the captured values while retaining detached-control, changed
  gradient and editor-session guards.
- Plain TextRenderer painted only solid fills. Connect the shared gradient
  renderer and apply its paint to glyphs using their text bounds, including
  alignment and rotation. Existing solid fill, stroke and shadow paths remain.
- Server validation normalized valid CSS colour spellings and changed angle
  360 to zero. Strict native publication correctly refused the changed payload.
  Preserve valid spellings and inclusive 0–360 angles, retaining validation and
  refusal of unsafe or lossy data.

## Verification and the testing gap

The old form integration test substituted an identity sanitizer and a history
stub. It never replaced the layer with an equal copy. Text-rendering tests never
asked for gradients. Validator checks did not exercise these safe values through
the strict DocumentSchema round trip. Passing counts therefore did not prove the
reported actions worked.

The focused regressions now use the real client validator, replace unchanged
layer values between edits, inspect glyph paint for linear/radial gradients,
and round-trip safe CSS spellings and angle 360 through DocumentSchema. The
arrow and schema regressions failed against the prior runtime.

The actual 8080 editor has been exercised with repeated presets without
reselection, colour/angle/radius changes, linear/radial and solid switching,
plain-text pixel changes, Undo/Redo, native Save and exact Close/reopen. Saved
page text and other layer sets were preserved. These checks used synthetic
fixtures and the dedicated ordinary test account.

The permanent browser regression in `tests/e2e/editor.spec.js` covers arrow and
text creation, repeated presets separated by normal history capture, changed
painted output, angle/radius edits, Save, native readback and Close/reopen. It
uses the existing disposable CI fixture and restoration safeguards. Local
rehearsal uses a separate synthetic fixture on the maintained 8080 wiki.
That complete browser test passes locally against MediaWiki 1.45.3. Focused
JavaScript and PHP regressions, changed-file lint/style, documentation, source
growth and bundle-budget checks also pass. Hosted exact-commit CI is recorded
separately after push.

This bounded repair does not qualify every editor tool or declare v1.8 ready for
release. Port 8080 is the owner's primary latest-source testing environment;
8082 verifies the separately packaged 1.44 compatibility candidate.

## Solid Color follow-up

The owner next found Save refused after an existing radial-gradient arrow was
changed to Solid Color. The UI deliberately emits `gradient: null`. The server's
optional-property check skipped null, and DocumentSchema correctly refused the
lost property. Client LayersValidator also incorrectly rejected null, despite
the editor using it to clear a gradient. The exact native API refusal was
reproduced on the dedicated 8080 fixture without changing its stored revision.

Both validators now accept explicit null as no gradient. The server preserves
the marker exactly; it does not silently remove the property, rewrite the fill
or accept malformed non-null gradient definitions. No UI action or wording
changes. This advances FEAT-4, HIST-4 and DATA-1.

The previous browser journey saved active gradients but did not Save after
clearing them. The existing client test even expected null to fail. That
expectation is corrected, and the new native schema tests fail against the
previous server. The permanent browser journey now creates arrow and text
gradients, clears both, uses Undo/Redo, recovers their unsaved solid-fill draft,
saves, checks exact native layers, closes and reopens, and repeats an immediate
gradient-to-solid Save. It passes on 8080 and restores its dedicated fixture.

A separate actual-browser replay opened the old editor, reproduced the failure,
kept that tab open across the server update and successfully retried Save without
reloading. Exact native readback retains null and the original solid fill, and
Close returns normally. The user's page and browser are not fixtures. Focused
JavaScript, PHP schema/validator, lint/style and source/bundle checks pass.
Exact-commit hosted native publication and other CI results accompany the
implementation checkpoint; broader release acceptance remains open.
