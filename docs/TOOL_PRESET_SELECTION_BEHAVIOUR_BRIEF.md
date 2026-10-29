# Creation tools and presets

**Status:** Approved by the project owner on October 28, 2026.
**Charter:** Milestone 1, protected Editing and Tools capabilities.

## Behavior

- Choosing a creation tool clears the current layer selection, including a
  multi-selection. Existing layers and Undo history are not changed.
- The Presets menu shows the active creation tool's presets. Choosing one
  sets the style for the next layer made with that tool and does not modify
  the layers that were previously selected.
- Selecting an existing layer with the Pointer retains the existing
  selection-based preset behavior: its matching presets can modify it.
- Existing controls, wording, shortcuts and tool capabilities remain. Pointer
  selection, layer-panel selection, multi-select, Undo and tool-specific
  defaults remain usable. Readers see no change to page content.

The owner requested this behavior after an Arrow preset unexpectedly changed a
selected text layer, and approved the proposed change in discussion. Show the
implemented editor screen before declaring this visible change complete.
