# Proposed server-rendered rotation correction

This correction advances Milestone 1 / TYPES-2 / DATA-1. The audit found that
the server renderer can ignore a layer's saved rotation, so a thumbnail or
legacy server-generated PDF can show a different shape from the editor.

The proposed behavior is to render saved rotation for rectangular shapes and
imported image layers in server-generated thumbnails and PDF pages, matching
their position, size and rotation in the editor, including scaled canvases.
Other layers, page selection, existing viewer and export controls remain.
Exports must continue to report the existing failure when a required render
cannot be completed; no incomplete document is substituted.

The project owner approved this behavior on October 29, 2026. Native pixel
checks now cover 0, 45 and 90 degrees, non-uniform scaling, an image partly
outside the canvas, following-layer isolation and a synthetic two-page PDF on
MediaWiki 1.44 and 1.45. A synthetic visual comparison was shown to the owner;
owner acceptance and real-media coverage remain open. Other rendering properties
require separate evidence; this brief does not claim they are fixed.
