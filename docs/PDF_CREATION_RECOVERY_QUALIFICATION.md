# Native PDF creation recovery qualification

This checkpoint advances milestone 1: page-owned layer sets and native page
history (HIST-4, HIST-1, DATA-1 and UI-10). Existing recovery controls, wording,
explicit confirmation, backups, source checks and publication guards stay intact.

## Correction

Initial draft review finishes before the creation integration exposes its
unsaved-page state. The editor now refreshes its existing page controls after
initialization completes. Restored work immediately shows the unsaved-page
marker; no further edit or page turn is needed. This changes presentation only.

## Native verification

On an isolated MediaWiki 1.45 wiki, native Text edits created distinct layers on
both pages of a PDF under one visible layer-set name. A fresh editor offered the
real local draft. Keep drafts unchanged preserved that backup and refused Save.
Another fresh editor offered it again; explicit Restore recovered both pages
and their independent Undo/Redo histories.

One Save then created one owning-page revision containing both PDF members.
Main text, an unrelated slide with the same layer-set name, source-version pins
and each page's geometry remained exact. Close returned to the owning page, and
reopening showed both saved PDF pages. A separate fresh recovery verified the
corrected unsaved-page marker before any subsequent edit or navigation.

A genuine competing owner revision caused fresh validation to refuse first
Save before publication. Owner history remained unchanged. The active page's
native layer export remained byte-exact, and Undo/Redo still worked. Explicit
Check and navigation to the other page also refused the changed owner. This
proves safe refusal; it does not qualify continued editing across that conflict
or exercise a publisher's conflict response.

## Client verification

The regression uses actual draft review and toolbar presentation. It fails with
the original integration and passes with the correction. The existing test
contents are preserved; the new case is appended. A copied-source control repeats
the same failure and passes after exact restoration. Affected suites, seven
unchanged safety probes, the full client suite and required static checks pass.

## Remaining acceptance

This is a bounded desktop recovery and stale-refusal checkpoint. It does not
simulate a browser process crash. Post-conflict offscreen-page traversal,
creation overlays/viewer, whole-PDF Import, toolbar layout, supported-version
and mobile qualification, and owner acceptance remain open. The existing desktop
Save button can extend beyond the viewport; the native journey used its keyboard
shortcut. Milestone 1 remains incomplete.
