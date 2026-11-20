# Gradient sizing and radial centre controls

**Status:** Approved and implemented, November 19, 2026; bounded 8080 verification passed.
**Advances:** FEAT-2 (gradient fills), FEAT-3d (export fidelity) and OPS-4 (browser verification).

## Problem and evidence

Plain Text radial gradients use the smaller measured text dimension for their
circular radius. A long line is wide but only one letter high, so the colour
transition stays in a small central area at Radius 100%. It grows with font size,
but not with line width. A current-renderer browser sample measured a text extent
of 464 by 44 pixels and a radius of only 44 pixels at 100%.

Linear gradients also use an angle-independent diagonal. On that same text, a
vertical transition spans 466 pixels instead of the 44-pixel text height, leaving
nearly the entire visible text at one middle colour.

## Owner proposal and recommended definitions

The owner proposed Radius 0–200% of the maximum envelope distance (diagonal),
with X/Y centre positioning anywhere inside the object's envelope. This is a
design revision that was subsequently approved. Approved definitions:

- Let `D = sqrt(width² + height²)` be the full corner-to-corner diagonal of the
  object's local, unrotated envelope. Circular radius is `D × percentage / 100`.
  This reference stays fixed when the centre moves. For centred gradients, 50%
  reaches every corner; 100% extends beyond the envelope. With the centre at a
  corner, 100% reaches the opposite corner. At 200%, radius is twice `D`.
- Define 0% as a solid fill using the outermost colour stop. It must remain zero
  through control rebuilds, Undo/Redo, recovery and Save/reopen.
- Keep the label **Radius**, expand its existing range to **0–200%**, and allow
  precise numeric entry alongside the slider. Keep the current 70% UI default.
- Add **Center X** and **Center Y**, visible for radial gradients. Each uses a
  slider and numeric percentage: X 0% is the left edge and 100% the right edge;
  Y 0% is the top edge and 100% the bottom edge. Defaults are 50%, 50%. These are
  positions within the envelope rather than signed offsets from its centre.
- Reuse stored `centerX`/`centerY` values in 0–1 and `radius` in 0–2. Server
  validation already supports these ranges. No new storage field is required.

## Approved reader/editor behaviour and scope

- Use the same radial sizing and centre controls for every layer type
  that already supports radial gradient fills, so their percentages have one
  meaning. This broadens the earlier plain-Text-only proposal.
- Retain the proposed plain Text linear correction: fit the transition to the
  text at its angle using the projection of its measured bounds. Other layer
  types' linear sizing is outside this proposal.
- Recalculate from the current local envelope on every render. Move, resize,
  zoom, alignment and rotation carry the gradient with its object. Text glyphs
  and selection geometry stay the same.
- Use the same rendering in the editor, owning page, full-size viewer and
  exports. Existing saved radial gradients would render using the revised
  diagonal meaning, including in old revisions; affected plain Text linear
  gradients would also change. No stored numeric values are rewritten.
- Keep existing controls, presets, colour stops, defaults, actions and wording;
  the visible additions are Center X/Center Y and the expanded Radius range.
  Nothing is removed. Preset changes retain their current behaviour, including
  their defined gradient parameters.

The November 18 current/proposed comparison illustrates the diagnosed sizing
defects and the earlier half-diagonal recommendation. It is not a preview of
the revised full-diagonal 100% definition. The full-diagonal definition above
supersedes that earlier mock-up.

## Verification before completion

Compare real pixels for short/long text and other radial-gradient layer types,
font-size/envelope changes, 0/50/100/150/200% radius, middle/edge/corner centres,
horizontal/vertical/diagonal Text linear angles, alignment, rotation and zoom.
Exercise the actual 8080 controls, resize, Undo/Redo, draft recovery, Save/reopen,
viewer and PNG export on dedicated fixtures. Confirm exact stored parameters
and unchanged unrelated data/other-layer linear rendering. Inspect desktop and
narrow layouts and show the editor screen to the owner. Keep the existing strict
publication and recovery checks.

## Decision

The owner approved the revised proposal: “I agree with this proposal. Please
implement it.” Approval was November 19, 2026, including the full-diagonal
reference, 0–200% range and centre controls. This supplies Rule 1's required
approval for the visible rendering and control changes above.

## Implementation and bounded verification

The shared renderer uses the full diagonal for all existing radial-gradient
consumers. Explicit zero creates uniform outer-stop paint, including alpha;
omitted radius follows the visible 70% default. Plain Text opts into projected
linear endpoints; other linear consumers retain their existing sizing. The
sliders and numeric fields keep zero/edge/fractional values through rebuilds,
history, local recovery and strict native Save without adding storage fields.

Real-canvas regressions verify colours at known positions, short/long text and
font sizes, off-centre/zero/200% radius, alignment, rotation and zoom. The 8080
editor journey types decimal percentages, uses Undo/Redo and recovery, saves
and reopens zero, and records exact 200% and edge-centre values. It also holds a
committed Save response while editing again: later work stays dirty and has
actual Undo/Redo before an explicit second Save. The old history timer failed
the deterministic native-session regression; its corrected scheduling retains
publication/reconciliation guards and coalesces later property edits.

Dedicated 8080 Text, rectangle and arrow checks retain parameters through an
actual Text handle resize (72 to 78 pixels), Save and viewer/export. The inline
page and downloaded 800×600 PNG match pixel-for-pixel. Desktop, dark and
390-pixel control layouts are inspected, with the new inputs fitting their rows.
Fixtures are restored. These are bounded desktop/browser checks, not physical
touch or complete release qualification. The actual editor screens are supplied
for owner review; hosted exact-commit results accompany the checkpoint.
