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
