# Native PDF creation interaction qualification

This checkpoint advances milestone 1: page-owned layer sets and native page
history (HIST-4, HIST-1, DATA-1 and UI-10). It preserves the existing tools,
controls, wording, strict ownership guards and scoped activation requirements.

## Corrections

The Text tool opens a modal during pointer-down. Its release event can reach
the modal instead of the canvas. The canvas now releases its gesture flag when
Text opens that modal. Mouse-up also releases the canvas flag before selection
and transform completion callbacks. Real active operations still refuse capture.
Pen, Marker, ordinary shape completion and multi-click angle dimensions retain
their existing completion rules.

PDF page-turn and recovery presentation now run after the guarded model commit
and capture. The page navigator can read the completed state through the same
strict host guard used by editing and draft capture.

First-Save handoff accepts an optional synchronous saved-owner installation
callback. The native integration installs its saved bridge and identity after
the atomic ownership transfer, before presentation reads that identity. The
default handoff remains immediate. Installation refusal preserves known saved
work, blocks further publication and releases creation subscriptions; it does
not repeat Save. Background stages and state patches remain within their
original lifetime.

## Verification

- 26 new regression cases; 920 focused cases across ten suites.
- 17801 full-client tests across 263 suites.
- Seven unchanged safety probes and five isolated failure controls with exact
  restored-source replays. Existing test bodies remain unchanged.
- Source lint, compatibility, references, state-key, parallel-list, atomicity,
  bundle-size, interface-message, documentation and whitespace checks.

In a fresh, isolated MediaWiki 1.45 installation, the native Text tool created
distinct layers on both pages of a two-page PDF. Page traversal retained each
page's work and Undo/Redo. One keyboard Save created one owning-page revision
containing both PDF members under the same visible layer-set name. Main text,
the unrelated same-named slide, source identities and canvas geometry remained
unchanged. Close returned to the owning page; reopening showed both saved pages.
Private wiki data, installed uploads, shared logs and earlier evidence remained
local and protected.

## Remaining acceptance

The complete recovery and genuine stale-save browser journeys remain open.
Creation overlays/viewer, whole-PDF Import, supported-version qualification,
mobile layout and owner acceptance remain separate work. In the tested desktop
layout, the toolbar Save button extends beyond the viewport; this run used its
existing keyboard shortcut. The layout gap is not qualified or hidden by this
checkpoint. Milestone 1 is incomplete.
