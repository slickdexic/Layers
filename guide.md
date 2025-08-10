# Layers MediaWiki Extension (Developer Specification)

## Overview

The **Layers** extension is a full-featured **non-destructive image editor** integrated into MediaWiki. It allows wiki users to create and manage **annotation layers** on top of images without altering the original files. All edits are stored as separate vector-based layers, enabling advanced image markup directly on wiki pages. Key goals of the extension include:

* **Non-Destructive Editing:** The original image (base layer) is never modified. All annotations (shapes, text, highlights, etc.) are stored as overlay layers (vector graphics) that can be toggled or removed independently. This preserves original file integrity while enabling rich annotations.
* **Professional-Grade Tools:** The editor provides an interface and features modeled after industry-standard image editors (e.g. Photoshop, Inkscape, Figma). Users have access to a wide range of drawing tools, layer effects, and editing controls comparable to professional desktop software.
* **Seamless Wiki Integration:** Layers integrates with MediaWiki’s UI and parser. An **“Edit Layers”** tab is added to file pages for launching the editor, and wiki pages can embed images with selected annotation layers via wikitext. All data is stored in MediaWiki’s database, and rendered thumbnails with annotations are served through the normal image pipeline.
* **Use Cases:** Typical use cases include adding callouts to diagrams, highlighting regions in photographs, redacting sensitive information by blurring parts of an image, translating labels on maps, or collaboratively annotating images for documentation. The system is designed to handle everything from simple highlights to complex multi-layer technical drawings.

By storing overlays as SVG-like data, annotations remain **scalable** and high-quality at any zoom level. The extension emphasizes a **layer-based editing paradigm**: each annotation resides on its own layer (much like Photoshop), with order and visibility controls. This document describes the expected **features, behaviors, and design** of the Layers extension in detail, serving as a development guide for achieving a robust, professional image editing experience within MediaWiki.

## Editor User Interface

The Layers editor is a single-page web application (loaded when a user clicks "Edit Layers" on a file page) that provides a familiar multi-pane layout similar to other graphic editors. The interface is composed of several panels and toolbars:

### Panel Layout and Behavior

The editor window is divided into functional areas (panels), as shown below:

```
+---------------------------------------------------------------------------------------+
|        [Tools]       | [Zoom 10–1600% Fit] [Undo/Redo] [Grid/Rulers] | [Save] [Close] |
+------------+--------------------------------------------------------------------------+
| Layers     |                                                                          |
|            |                                                                          |
|            |                                                                          |
|            |                                                                          |
|            |                                                                          |
+------------+                         Canvas (Image + Overlays)                        |
|   Layer    |                       Pan/Zoom | Guides | Snapping                       |
| Properties |                                                                          |
|            |                                                                          |
|            |                                                                          |
|            |                                                                          |
|            |                                                                          |
|            |                                                                          |
|            |                                                                          |
|            +--------------------------------------------------------------------------+
|            |                   Status Bar: cursor (x,y), selection W×H, zoom %, hints |
+------------+--------------------------------------------------------------------------+
```

* **Top Toolbar:** Stretches across the top, containing tool buttons, quick style controls, zoom controls, and action buttons.
* **Layers Panel (Sidebar):** Docked on the left side (can be alternatively on right if desired by configuration). It displays the list of layers (each annotation or group) in the image. This panel can be vertically scrolled if layers exceed the view and can be resized horizontally by dragging its edge. It includes controls for layer visibility (eye icon), locking, and ordering.
* **Canvas Area:** The central workspace where the image and overlays are displayed. This area is the HTML5 canvas (or SVG) where users draw and manipulate annotations. It is bounded by the image’s dimensions. The canvas supports panning and zooming, and can display helpers like grids, rulers, and guides.
* **Properties Panel (Inspector):** Docked along the left and below the layers panel, it shows detailed properties for the currently selected object or layer. It can be toggled or collapsed. The panel may be organized into tabs or sections (e.g. Appearance, Text, Effects) to group properties. Users can adjust numeric values via input fields or sliders, pick colors, toggle effect checkboxes, etc. The panel updates contextually based on selection (showing object-specific fields or layer-level settings).

All panels are designed to be **adjustable**: the Layers panel and Properties panel can be resized or collapsed to maximize canvas space. The layout is responsive; for smaller screens, panels might stack or become overlay tabs. The overall look and feel uses MediaWiki’s UI framework (OOUI) for consistent styling, with custom CSS for a modern editor appearance. The interface supports common window behaviors like dragging panel dividers, scrolling panels, and focusing/highlighting the active tool or selection.

### Toolbars and Tool Interaction

The **Top Toolbar** is divided into sections logically grouping controls:

1. **Tool Selection:** A set of icon buttons for each drawing or editing tool (e.g. pointer, text, shapes, etc.). Only one tool can be active at a time. Selecting a tool changes the mouse cursor and the editor’s mode to that tool’s operation. Tools have keyboard shortcuts (hovering over the icon shows the key). For example, pressing **V** switches to the Pointer tool, **T** to Text, **R** to Rectangle, etc.. Tools remain active until another tool is selected, allowing consecutive uses.
2. **Style Controls:** Contextual controls for the currently active tool or selected object’s styling. For example, when a shape tool is active or a shape is selected, the toolbar shows fill and stroke color pickers, stroke width input, and perhaps specific options (e.g. corner radius for rectangles). These allow quick adjustments without opening the full Properties panel. Changes here apply to the selection immediately, or set defaults for new shapes drawn.
3. **Effects & Layer Settings:** Controls for common layer-level settings such as overall opacity slider, blend mode dropdown, and toggle buttons for effects (e.g. a "Shadow" toggle to apply a drop shadow, "Glow" toggle, etc.). If an object is selected, these may apply to that object; if no object or a whole layer is selected, they apply to the active layer as a whole.
4. **View / Zoom:** Buttons for zooming in/out, a percentage display or fit-to-screen button, and toggles for visual guides (e.g. a **Grid toggle** to show/hide the alignment grid, or a **Rulers toggle** to show rulers along the edges). Also, a hand tool or simply the spacebar+drag shortcut for panning.
5. **Actions:** Buttons for common actions like **Undo**, **Redo**, **Save**, **Cancel**, **Delete** (delete selection), and **Duplicate** (clone selection or layer). Many of these have keyboard shortcuts (e.g. Ctrl+Z/Y for undo/redo, Delete key to remove an object, Ctrl+S to save, Ctrl+D to duplicate). The Save/Cancel actions finalize or abort the editing session.

**Toolbar Customization:** The toolbar is designed to be extensible. New tools can be added as needed (via extension updates) without overhauling the UI. The ordering and grouping of tools follow industry conventions (e.g., selection tools first, then drawing tools, then view controls, etc.), but a developer or site admin could potentially configure to hide certain tools or add custom ones. The toolbar uses icon buttons (SVG icons for clarity on all DPI screens). In future, user preferences might allow customizing which tools are visible or setting default tool behavior, but by default all available tools are shown.

**Tool Interaction Logic:** When a tool is selected, the cursor changes to reflect that tool (e.g. crosshair for shape-drawing tools, text cursor for text tool, etc.). The editor listens for mouse/keyboard events on the canvas to handle the tool operations:

* **Drawing Tools:** Typically use click-and-drag to create a shape. For example, with the Rectangle tool active, the user presses down at one corner and drags to the opposite corner, releasing to finalize the rectangle. During the drag, a live preview of the shape is shown (e.g. an outline of the rectangle) to guide the user. Many tools support modifier keys during interaction: e.g. holding **Shift** while dragging a rectangle constrains it to a square; holding Shift with the Line tool constrains angles (like 0°, 45°, 90° increments); holding **Alt** (Option) might draw shapes from the center outward instead of corner-to-corner.
* **Selection/Editing Tools:** The Pointer (selection) tool allows clicking an existing object on the canvas to select it. Once selected, the object’s **bounding box** with handles appears, allowing transform operations (move, resize, rotate). The user can drag the object to move it; drag corner handles to scale (hold Shift to maintain aspect ratio); or rotate via a rotation handle that appears near the bounding box. The pointer tool also allows multi-select (by Shift+Clicking additional objects or using the Marquee tool). When multiple objects are selected, they can be moved or transformed together. A selected object can often be double-clicked for direct editing (e.g. double-click text to switch to text edit mode).
* **Snapping:** As objects are moved or created, the editor provides visual guide lines and snapping cues. Objects snap to **grid lines**, to **guides** the user has placed, and to key positions of other objects (e.g. aligning centers or edges). Snapping can be toggled on/off (via a toolbar button or a Ctrl key override). This helps align annotations precisely, mimicking the smart guide behavior of tools like Figma.
* **Keyboard Modifiers:** Common modifiers influence tool behavior globally. For example, holding **Shift** often constrains proportions or adds to selection; **Ctrl** (Cmd on Mac) can be used with the selection tool to deep-select an object within a group or to temporarily toggle add/subtract selection mode; **Alt** often clones an object when dragging (e.g. Alt+Drag on an object could duplicate it). The exact behaviors follow standard design tool conventions so that experienced users feel at home.

Overall, the UI is designed for efficiency: most actions have keyboard shortcuts, dragging operations provide real-time feedback (with tooltips or measurements where relevant), and right-click context menus may be provided for operations like “Delete” or “Bring to Front/Back” on selected objects. The interface strives to remain intuitive for new users while packing powerful options for advanced users.

### Layer Management Interface

The **Layers Panel** (typically on the left side) manages the stacking order and organization of all annotation layers. Each layer in this context corresponds to an individual drawn object or a grouped set of objects. The base image itself is treated as a locked background layer (often listed as **Layer 0** or "Background") which cannot be edited or reordered. Above the base image, each new annotation (text box, shape, etc.) resides on its own layer by default, similar to how Photoshop or Inkscape handle separate objects.

Key features and behavior of the layers panel:

* **Layer List:** Displays a list item for each layer, with the topmost layer in the list rendering above those below. Each entry shows a **layer name** and icons for visibility and locking. By default, new layers get a generic name (e.g. "Rectangle 1", "Text 1") or an auto-incremental ID. Users can **rename layers** to something meaningful (by double-clicking the name in the list or via a context menu).
* **Visibility Toggle:** Clicking the eye icon on a layer hides or shows that layer’s content on the canvas. Hidden layers are not included in the saved output or rendered image. The base image layer can also be toggled (though typically it stays visible; turning it off would show a transparent canvas, which might be useful in some editing scenarios).
* **Locking:** Clicking the lock icon prevents any modification to that layer’s objects. A locked layer cannot be selected on the canvas or edited until unlocked. This is useful to avoid accidentally moving the base image or finalized annotations.
* **Reordering Layers:** Layers can be dragged up or down in the list to change stacking order. A drag-and-drop operation on the list will reposition the layer, updating the canvas immediately to reflect the new order. The panel may highlight drop positions and automatically scroll if dragging near panel edges for a smooth reordering experience.
* **Grouping:** Multiple layers can be **grouped** into a folder (layer group). The UI indicates groups with an indented list or expandable tree structure. Users might select several layers and choose “Group” (via right-click menu or a toolbar action). A group can be named and behaves like a single layer for locking, visibility, and moving (all child layers move together). Groups enable complex annotations to be managed as a unit. They can also have their own group-level effects (e.g. a whole group could be given a common opacity or shadow).
* **Layer Thumbnails:** Each layer entry can display a small thumbnail preview of its content. For example, a tiny icon of the shape or text gives a visual hint. This helps identify layers at a glance. Thumbnails update dynamically as the layer content changes.
* **Context Menu and Actions:** Right-clicking a layer (or clicking a "..." menu button if provided) opens actions: **Delete Layer**, **Duplicate Layer**, **Merge Down** (if merging raster content or flattening groups, if supported), **Bring Forward/Send Backward** (to change order one step), **Group** / **Ungroup**, etc. Delete removes the layer (with confirmation or undo available). Duplicate makes a copy of the layer’s object (assigning a new ID and placing it above).
* **Layer Properties:** Selecting a layer in the list (as opposed to selecting an object on the canvas) could allow editing layer-level properties in the Properties panel. For example, clicking on a layer (rather than the canvas) might select the whole layer (especially if it’s a group layer). The Properties panel then might show fields like the layer’s name, overall layer opacity, and any effects at the layer level (described in the Styling section below).

The layers panel always shows a special entry for the base image (often labeled something like **"\[Base Image]" or the file name, with an indicator like (Locked)**). This base layer (Layer 0) is read-only and sits at the bottom. Above it, up to a certain maximum (e.g. 255 layers was an initial design target, but effectively it can be higher if needed), new layers can be added. Deleting a layer removes that annotation but does not affect others. Each layer has a unique identifier internally, which is used for persistence and for referencing in wikitext (see Wikitext Embedding). The ordering and IDs remain consistent so that if a layer is referenced for display, it will refer to the same content even if other layers are added or removed.

**Cloning and Base Clones:** The system supports cloning layers, including cloning the base image as a new layer. For instance, a user could duplicate the base image layer (creating a static copy of the image on a new layer) to apply effects to it (like an overlay or a filtered version for comparison). Such cloned layers are marked as clones in their properties. A clone of the base retains a reference to the original image content but can be manipulated (e.g. given transparency or masked) as an overlay.

The Layer Management interface thus provides a clear overview of all annotation elements and their hierarchy. It encourages an organized workflow: e.g., a user might create separate layers for “Labels”, “Highlights”, and “Callouts”, group them, and toggle each category as needed.

### Properties and Style Editor

The **Properties Panel** (Inspector) shows detailed properties for whatever is currently selected – either an individual object (shape, text, etc.) or an entire layer (layer-level settings if a layer/group is selected). This panel is dynamic and context-sensitive:

* If a **shape object** is selected on the canvas (e.g. a rectangle), the panel will display that object’s properties: its position (X,Y coordinates), size (width/height), rotation angle, and appearance settings (stroke color/width, fill color, opacity, etc.). Properties might be grouped into collapsible sections like **Position & Size**, **Appearance (Stroke/Fill)**, **Effects**, and tool-specific properties (e.g. corner radius for a rectangle).
* If a **text object** is selected, the panel will include text-specific settings: text content (or a link to edit the text if not directly in the panel), font family dropdown (populated with allowed fonts), font size, font style (bold/italic/underline), text alignment, line spacing, and text color (fill) and outline (stroke) options. It would also have general position/size (for the text box) and rotation if applicable.
* If **multiple objects** are selected, the panel may either be disabled (showing a message "Multiple objects selected" if combined editing isn’t supported) or show only common properties that can be edited together (e.g. you could change the fill color for all selected shapes at once). Unique per-object fields would be hidden in that case.
* If a **layer (group) is selected** in the layer panel, the inspector might show layer-level properties: layer name (editable text field), overall layer opacity (slider), layer blend mode (dropdown), and toggles/controls for any layer-level effects (like a checkbox to enable a drop shadow on the entire layer group, or a color picker for an outer glow on the layer). If the layer is a group, it might also show the number of objects in it and allow ungroup/regroup actions.

**Field Types and Controls:** The properties panel uses appropriate input controls for each property:

* Numeric values (like stroke width, font size, opacity percentages) are shown with either spinbox inputs or sliders for easy adjustment. For example, opacity might be a slider 0–100%, stroke width a number field (with up/down arrows).
* Colors are shown with a color well; clicking it opens a color picker dialog (allowing choosing hex/RGB values, with transparency slider if applicable). There might be two color wells if an object has both stroke and fill color.
* Dropdowns are used for discrete options like **Font Family** (populated from `$wgLayersDefaultFonts` config list), **Blend Mode** (list of modes like Normal, Multiply, Screen, etc.), **Stroke Style** (solid, dashed, dotted), **Arrowhead Style**, etc.
* Checkboxes or toggles control boolean properties like **Visible/Hidden** (though visibility is usually toggled via the eye icon, the panel might mirror that), **Locked** (again usually via icon), **Maintain aspect ratio** (if relevant for resizing, e.g. an option on an image layer clone), or toggling an effect on/off.
* Special controls: Some tools have more complex property inputs. For example, the **Polygon tool** might have a numeric stepper for number of sides. A **Gradient fill** option would present a mini gradient editor (showing gradient stops, colors, and maybe a button to edit gradient in a pop-up). If an object has a **drop shadow**, the panel might show a sub-section with controls for shadow color, blur radius, offset X, offset Y, etc. (with those fields only visible if the effect is enabled).

The Properties panel updates live: adjusting a slider or field immediately updates the selected object on the canvas (providing real-time preview). If multiple objects are selected, changing a value will apply to all selected. The panel is also where exact values can be set for precision – e.g., a user can type an exact width/height in pixels for a rectangle, or an exact rotation angle (rather than eyeball it with handles).

In addition, the properties panel can include an **object actions** section for certain types: e.g., for a text object, buttons like "Edit Text" (which would activate in-canvas text editing if not already in edit mode); for a callout, maybe an option to attach the pointer to a different position or flip the callout orientation; for an image layer clone, an option to replace the image source (if that was allowed).

Finally, the properties inspector plays a role in showing **Wikitext code snippets** for layers if applicable. In the editor, there may be a section that shows how to reference the current layer selection in wikitext (for example, showing the `layers=` parameter needed to display only certain layers). This is primarily a user-facing hint, but as a developer, note that the inspector has this additional utility of bridging the editor state with wikitext output.

### Canvas and Viewport Behavior

The **Canvas** is the live editing area where the background image and overlay layers are drawn. The canvas behavior and viewport controls are crucial for a smooth editing experience:

* **Panning & Zooming:** Users can zoom in and out of the image to work on details or get an overview. Zoom can be controlled via keyboard (Ctrl++ to zoom in, Ctrl+- to zoom out, Ctrl+0 to reset to 100%), via the toolbar zoom buttons or dropdown (common zoom levels like 25%, 50%, 100%, 200%, Fit to Window), or by using the mouse scroll wheel (often Ctrl/Cmd + wheel to zoom). Panning is done by clicking and dragging with the middle mouse button or by holding the spacebar (which temporarily switches the cursor to a hand grab tool) and dragging. The canvas can typically be panned beyond the image edges to allow working near the borders comfortably (empty gray area around canvas when zoomed in, similar to most editors).
* **Canvas Size & Boundaries:** The canvas coordinate system is based on the image’s native resolution. The background image sits at coordinates (0,0) in the canvas. Annotations can technically extend beyond the image boundaries, but any content outside the image will not appear in the final rendered thumbnail (it may be clipped). The UI may visually gray out areas beyond the image edges or simply constrain drawing tools to start within the image. Scrolling/panning beyond the image is limited to a certain margin.
* **Grid and Snapping:** A configurable **grid overlay** can be shown on the canvas for alignment. The grid might default to a certain spacing (e.g. 10px or 50px increments) and can be toggled on the top toolbar. When enabled, objects will snap to the grid lines (their positions and sometimes their sizes will align to the nearest grid points when moving or resizing). Grid snapping can be turned off temporarily by holding a key (e.g. Ctrl) during the drag. The grid settings (spacing, subdivisions) may be fixed or adjustable via config/UI in the future.
* **Rulers and Guides:** The editor can display rulers along the top and left edges of the canvas (with tick marks in pixels). From these rulers, users can **drag out guide lines** (horizontal or vertical) onto the canvas. Guides are straight lines that float over the canvas at a specific X or Y coordinate. They are used to align objects. Objects will snap to guides similarly to the grid. Guides can be moved by dragging them or removed by dragging them off the canvas. A future enhancement could allow guide positions to be entered numerically or to have multiple guides. Guides are not persisted in the final saved data (they are an editor convenience only).
* **Smart Guides (Object Snapping):** In addition to grid/guides, the canvas provides dynamic guides when moving objects relative to others. As a user drags an object, the system detects alignment with other objects’ edges or centers. When alignment is near, a line appears indicating alignment (e.g. center of object aligned with center of another) and the drag will snap to that position. This makes it easy to align text labels or shapes relative to each other. Snapping can also work for equal spacing suggestions (like if three objects, the gap can snap equal).
* **Selection Outline and Handles:** When objects are selected, the canvas draws visual handles and outlines. A single selected object shows a bounding box with eight handles (corners + mid-sides) for scaling, and typically a rotate handle (e.g. a curved arrow icon slightly outside the top-center of the box). If multiple objects are selected, one combined bounding box encompassing all is shown, with handles to transform them as a group. The canvas also might highlight objects on hover (e.g. hovering over an object with the pointer tool could display a light outline to indicate which would be selected on click).
* **Dragging and Feedback:** When dragging to create a shape or dragging objects, the canvas shows real-time feedback. For instance, drawing a rectangle shows the outline while dragging; moving an object shows a ghost outline or the object itself moving. Some editors also show a small tooltip with coordinates or size during drag – e.g., “W: 150px, H: 80px” next to a shape being drawn, or “X: 200, Y: 100” when moving. This spec encourages including such feedback for precision.
* **Canvas Overlay Indicators:** The canvas can display additional overlays such as:

  * **Current Mouse Coordinates** (perhaps in a status bar or small overlay) to assist in precise placement.
  * **Selection Info**: number of items selected or the dimensions of the selection.
  * **Out of bounds warning**: if an object is partially outside the image area, an indicator could note that (though this might be unnecessary if clipping is understood).
  * **Loading State**: when the editor first loads or if heavy operations (like applying a filter) happen, a semi-transparent overlay with a loading spinner might cover the canvas.

Performance-wise, the canvas must handle potentially dozens of vector shapes without lag. Zoom and pan should be smooth, and interactions like dragging should be responsive. The implementation uses an HTML5 Canvas 2D context for rendering the image and vector shapes on top (the shapes are drawn via Canvas API in edit mode). In the future, an SVG-based rendering could be considered for sharper output, but canvas is typically used for live editing responsiveness.

In summary, the canvas behaves similarly to the artboard in other graphic editors: it provides a controlled, navigable view of the image and layers, with support for precision (zoom, guides, snapping) and ease of editing (real-time feedback and intuitive gestures).

## Drawing and Annotation Tools

The extension offers a wide array of **drawing and annotation tools** to create various types of markup. This section enumerates each tool, describing its purpose, usage interaction, customization options, output format, and any constraints/behaviors. All tools produce vector-based output (stored as SVG-like definitions) and can be adjusted or removed independently. The tools can be categorized into **Selection/Editing tools** and **Drawing/Annotation tools**, but for clarity each is detailed individually below.

### Pointer (Selection) Tool

**Purpose:** The Pointer tool (often the default tool, shortcut **V**) is used for selecting, moving, and transforming existing annotations. It does not create new graphics, but allows the user to interact with objects already on the canvas.

**Interaction:** Click on any visible object on the canvas to select it. The selected object gets a bounding box with handles. Drag the object to move it. Drag a corner or side handle to resize (with proportional scaling if Shift is held). Rotate the object by dragging a rotation handle (if provided) or by a modifier (e.g. Ctrl+drag on a corner could rotate instead of scale, depending on implementation). To select multiple objects, Shift+Click additional ones, or drag a Marquee (selection box) around them. The Pointer tool also supports **Ctrl+C/Ctrl+V** for copy-paste of objects, **Delete** for removal, and **Ctrl+D** for duplicate (which creates a copy of the selected object immediately, offset slightly).

**UI Feedback:** When hovering over an object, the cursor may change (e.g. to a move icon when over a fill area, or to a rotate icon near a rotate handle). When dragging an object, a faint outline of its original position may remain until drop, and snap guides appear if alignment with others is detected. The status bar (if present) might show the current coordinates while moving.

**Customization & Options:** The pointer tool itself has no style options (it doesn’t draw new shapes). However, it may have settings like “constrain movement to axis” (activated by holding Shift to restrict movement purely horizontal/vertical) or toggling whether scaling a text box also scales the text or just the box (some systems allow scaling font size vs. resizing container). These behaviors are mostly built-in conventions rather than user-set options. No unique output model (since it doesn’t produce new SVG content).

**Special Features:**

* The pointer tool is context-aware. For example, double-clicking a text object with the pointer could automatically switch to text editing mode (placing cursor in text). Double-clicking a grouped object might “enter” the group for editing individual members.
* It respects layer locking: clicking a locked layer’s object will not select it (it will select underlying if any, or nothing).
* Drag-and-select: Instead of switching to the Marquee tool explicitly, some editors allow dragging with the pointer on an empty canvas area to create a selection rectangle. In this spec, we have a separate Marquee tool, but a similar gesture might be recognized by the pointer tool as well for convenience.

### Marquee Selection Tool

**Purpose:** The Marquee (Selection Box) tool lets the user select multiple objects by drawing a rectangular selection region. This is especially useful when you want to select many objects at once or a group of objects without individually clicking each.

**Interaction:** Activate the Marquee tool (shortcut could be **M** or another key). Click and drag on the canvas to draw a rectangular selection area. Any selectable objects that fall within this area will become selected when the drag is completed. By default, the marquee might select objects that are fully enclosed by the rectangle. The tool options can allow different modes: e.g., **Contain vs. Intersect** selection.

* *Contain mode*: only objects entirely inside the selection rectangle get selected.
* *Intersect mode*: any object that the rectangle touches (even partially) gets selected.

The user can toggle this mode via a setting or by a modifier key (for instance, hold Alt to toggle between contain/intersect). Additionally, holding Shift while using the marquee could **add** to the existing selection (so you can draw multiple disjoint selection boxes to accumulate selected objects), and holding Ctrl (or Alt, depending on OS conventions) could **subtract** those within the new marquee from an existing selection.

**UI Feedback:** As you drag the marquee, a semi-transparent rectangle is shown. After releasing, the selected objects’ bounding boxes appear (if the pointer tool becomes active or if marquee stays active it might just highlight them). The number of objects selected might be indicated somewhere (e.g., in status text "5 objects selected").

**Customization Options:** The Marquee tool might have a few settings in the toolbar or properties panel:

* Selection mode (contain/intersect as described).
* Perhaps a toggle for “add to selection” or “subtract from selection” mode so the user can lock that behavior without holding keys (this is more advanced; typically keys suffice).
* No styling options since it doesn’t create a persistent graphic (the marquee rectangle is just a UI element, not saved).

**Output Model:** This tool does not produce any output SVG element – it purely affects selection state.

**Constraints:** The marquee selection operates only within the canvas; dragging outside might auto-scroll the canvas if needed to expand the selection. It will not select the base image itself (the base layer is not considered a selectable object by design, as it’s read-only). Also, if layers are locked, their objects won’t be selected even if inside the area.

### Text Tool

**Purpose:** The Text tool allows adding textual annotations to the image. This could be labels, titles, descriptions, or any multi-line text, supporting various fonts and styles.

**Interaction:** Select the Text tool (shortcut **T**). **Inserting text:** either *click* on the canvas where you want to start a text caption, or *click-and-drag* to draw a text box of a specific width. After releasing (or immediately upon click), a text insertion point appears and the user can type the text. If a text box was dragged, the text will wrap within that width; if just clicked, the text box will expand as you type (or may break to new lines only at line breaks). While typing, the text appears in a semi-live editable state (possibly with a blinking cursor). Exiting text edit mode (by clicking outside or pressing Escape/Enter depending on UI) will finalize the text object. The pointer tool can then be used to move/resize the text box or edit again (double-click to edit text).

**UI Affordances:** While editing text, the Properties panel or a floating text toolbar may appear, showing text formatting options (font, size, alignment, etc.). The user can highlight a subset of text and change its style if inline styling is supported (e.g. making one word bold). However, many image editors treat each text object as uniformly styled; advanced ones might allow rich text. For simplicity, assume uniform style per text object (no per-character styling, except basic bold/italic via separate toggles that apply to the whole object). The text box can be resized (when not in typing mode) to change word wrap. A small handle might appear on the text box specifically to adjust text rotation as well.

**Customization Options:** Text objects support extensive properties, including:

* **Font Family:** Choose from a list of fonts configured for the editor (e.g., Arial, Roboto, Noto Sans, Times New Roman, Courier New by default). These are web fonts or system fonts available to the wiki; the extension can be configured to allow additional fonts.
* **Font Size:** Typically in pixels (or points) ranging, for example, from 8px up to 72px or higher. Default could be 16px.
* **Font Style/Weight:** Bold, Italic toggles (underline might be considered via text-decoration if needed).
* **Text Color (Fill):** The fill color of the text characters. Usually a color picker for this. Opacity of the text fill can also be set (to make semitransparent text).
* **Stroke (Outline):** An optional outline around the text glyphs. Properties: stroke color, stroke width (e.g. to create outlined text). Useful for ensuring text is visible on various backgrounds.
* **Text Alignment:** If the text box has multiple lines or a defined width, alignment (left, center, right, justify) can be set.
* **Line Height (Line Spacing):** The vertical spacing between lines, e.g. 1.2 (120% of font size) default, adjustable for formatting.
* **Background and Padding:** (Potential feature) In some editors you can set a background color for the text box or padding. This extension primarily treats text as transparent by default, but as an enhancement, a semi-transparent background rectangle could be enabled behind text for legibility.
* **Rotation:** As with any object, text can be rotated. Rotation can be done via the selection handles or a numeric input for angle.

**SVG Output Model:** Each text object is stored as vector text. Likely it will be represented as an `<text>` element in SVG, with attributes for position (x,y), font family, size, fill, etc. If multiline, either the extension uses `<tspan>` elements for each line or just uses newline characters within the text element (SVG supports rendering text with embedded newlines if set properly). The text may also have an outline (SVG `<text>` with stroke properties) if a stroke is specified. If certain effects like drop shadow are applied to text, it could be represented with an SVG filter or by duplicating the text element with offset and blur.

**Constraints:** Very long text is allowed, but extremely large text blocks might affect rendering performance or overflow the image. The extension might impose a limit on text length or total characters for sanity (not explicitly, but as a developer, keep in mind the JSON size limit per layer set). Font choices are limited to those configured (\$wgLayersDefaultFonts) to ensure the wiki can render them (either via web fonts or known system fonts). If a user tries to input characters not supported by the chosen font, fallback fonts might be used (e.g. since Noto Sans is included for wide Unicode coverage).

### Rectangle Tool

**Purpose:** Draw rectangular shapes, which can be used for framing, highlighting areas, or general annotations (boxes).

**Interaction:** Select the Rectangle tool (shortcut **R**). Click on the canvas at one corner of the desired rectangle, drag to the opposite corner, and release. A rectangle shape is created. Hold **Shift** while dragging to constrain to a square (equal width and height). The rectangle can subsequently be moved or resized with the pointer tool.

**Customization Options:** Rectangles share common shape styling options and have a couple of specific parameters:

* **Stroke:** The rectangle’s outline can be customized. Properties include stroke color, stroke width, and stroke style (solid or dashed/dotted patterns). For dashed lines, a dash pattern (e.g. "5,5") can be specified for custom dash lengths. Stroke opacity can be set independently of fill.
* **Fill:** The interior can be filled with a color or left transparent. Fill color can be any hex color or “none” for no fill. Fill opacity can be adjusted. Optionally, gradient fills are supported: the rectangle can have a linear or radial gradient fill. In the case of gradients, the UI would allow choosing gradient type and editing color stops (positions and colors). By default, fill is usually a solid color.
* **Corners:** Rectangles can have rounded corners. A **corner radius** property defines how rounded the corners are (in px). It could be a single value applied to all corners (common case) or separate per-corner (though UI likely just one value). E.g., 0px is a sharp corner, and higher values produce more circular corners (with some maximum like 50px or half the rectangle’s smaller dimension). Additionally, a **corner style** could be offered (e.g., rounded vs. chamfered cut corners), but typically rounded (beveled) is the main option.
* **Effects:** The rectangle can have effects like **Drop Shadow** enabled. Shadow properties include shadow color, offset X and Y (which can be positive or negative to cast shadow in different directions), blur radius, spread (if implemented; spread can enlarge the shadow), and opacity. An **Outer Glow** could be treated as just a drop shadow with offset 0 or as a separate effect with similar parameters (color and size).
* **Blend Mode:** Though generally set per layer, an individual shape might have a blend mode too if the renderer supports it (e.g., making the rectangle multiply or screen blend with the image). However, if per-object blend mode is not easily done in canvas, this might be limited to layer-level in implementation.

**SVG Output Model:** A rectangle becomes an SVG `<rect>` element with attributes x, y, width, height. Rounded corners are represented by `rx` and `ry` attributes (for horizontal and vertical corner radius – usually set equal for uniform rounding). Stroke attributes define the outline, and fill the interior. If dashed lines are used, the `stroke-dasharray` attribute will be set with the pattern. Drop shadows or glows would be implemented via an SVG filter (like a `<filter>` with feDropShadow) referenced by the rect’s `filter` attribute, or handled at render time by the server (e.g., rasterizing with shadow).

**Constraints:** Width and height can range from 1px up to the image dimensions (or slightly beyond if drawing out of bounds). Stroke width has an upper bound (e.g. 0 to 20px was used in development defaults). Corner radius cannot exceed half the rectangle’s smallest side (to avoid weird overlaps). The UI might enforce a max or simply visually cap it. Gradients if used should be defined with at least two color stops. If the rectangle is too small to show a visible fill (like a 1x1 pixel box), it still exists but might be hard to interact with – the pointer tool uses hit-testing on stroke/fill area to allow selecting such small objects (or user can select via layers panel).

### Ellipse Tool

**Purpose:** Draw ellipses or circles to highlight round areas or encircle features.

**Interaction:** Select the Ellipse tool (which may also cover circles, often shortcut **E** or **O** depending on naming). Click and drag from one corner of the bounding box to the opposite corner to create an ellipse inscribed in that rectangle. Hold **Shift** while dragging to constrain to a circle (equal radii). Release to create the shape.

**Customization Options:** Ellipses have many of the same style properties as rectangles:

* **Stroke:** Color, width, style (solid/dash), opacity (same options as rectangle).
* **Fill:** Color (or none), opacity, and support for gradients (radial gradient is particularly relevant for ellipses).
* **Dimensions:** In the data model, one could define ellipse by `rx` (radius X) and `ry` (radius Y) or by width/height. For UI, width and height of the bounding box are shown. There is no separate corner radius concept (since ellipse is inherently curved).
* **Effects:** Drop shadow, glow, etc. can be applied just like for rectangles.
* Ellipses likely do not have additional unique parameters beyond what rectangles have, except of course their geometry is round. (Some systems might allow an ellipse arc or pie wedge but that’s out of scope – this tool creates full ellipses only.)

**SVG Output Model:** An ellipse is represented with an SVG `<ellipse cx="" cy="" rx="" ry="">` element (center coordinates and radii). Alternatively, a circle (special case) uses `<circle cx cy r>`. The tool likely uses one element type for both: if the radii are equal, it’s effectively a circle. The stroke and fill properties map to the same SVG attributes.

**Constraints:** The smallest ellipse might be a few pixels across. If one radius is much larger than the other, it’s just a very elongated ellipse (fine). The tool shouldn’t produce zero radii (if user clicks without dragging, possibly no shape is created or a minimal default sized dot appears). As with rectangles, stroke width is limited to a reasonable range, etc. Holding Shift ensures rx = ry for a perfect circle. The aspect ratio can be freely chosen otherwise.

### Polygon Tool

**Purpose:** Draw regular polygons (multi-sided shapes with equal sides/angles by default) or star-like shapes. This can be used for pointing out areas with a polygonal outline or creating star annotations if star mode is enabled.

**Interaction:** Select the Polygon tool. By default, it might create, say, a hexagon or pentagon. Click and drag on canvas: the initial click sets the center of the polygon, and dragging outwards sets the radius (distance from center to vertices). Alternatively, the user might drag a bounding box as with rectangle, but typically for regular polygons, a center-out drag is intuitive – this extension could interpret a drag as center to a vertex. Upon release, a polygon with a default number of sides (e.g. 5) is drawn. After creation, the polygon can be rotated to any orientation (either automatically by dragging, or by using the rotate handles afterwards).

**Customization Options:** Polygons have these specific parameters in addition to standard stroke/fill:

* **Number of Sides (`sides`):** The count of polygon sides (minimum 3 for a triangle, up to perhaps 12 or 20 sides). The extension might allow a generous range (3–20 as default). This can be set before creation (via a dropdown or input in the toolbar) or after (in the properties panel, changing this could redraw the shape to new geometry).
* **Star Mode:** A boolean option to toggle star vs regular polygon. If star mode is off (false), the shape is a regular convex polygon. If on (true), the polygon is drawn as a star (concave) by connecting every other vertex. Essentially, star mode uses the same number of points but uses an inner radius to pull vertices inward.
* **Inner Radius (for star):** If star mode is enabled, an **inner radius** or ratio parameter appears. This defines how deep the star’s indentations are. It can be expressed as a ratio relative to the outer radius (e.g. 0.5 means inner points are at half the radius of outer points). Typical useful range is 0.1 (very spiky star) to 0.9 (almost flat, nearly polygon).
* **Rotation:** Polygons can have an initial rotation (orientation) set. The user can rotate the shape after drawing with the pointer tool, but in properties one might input a rotation angle to exactly position it. Some editors allow specifying the polygon start angle so one vertex is exactly up, etc.
* **Stroke/Fill:** Same as other shapes (color, width, pattern, gradient fill, etc.). A star/polygon’s fill can also be gradient or solid, and stroke dashed etc., no difference in styling options.
* **Effects:** Shadows, glows applicable like others.

**SVG Output Model:** A polygon or star will likely be represented as an SVG `<polygon points="...">` element, listing all the vertices coordinates. For a star, those coordinates zigzag in and out between outer and inner radius. Alternatively, it could be a `<path>` but polygon is straightforward for regular shapes. The number of points in the SVG corresponds to the number of sides or twice that if a star (though you can also do a star as a single polygon with twice as many points alternating between outer and inner radius). The extension likely recomputes the polygon points dynamically if sides or inner radius changes.

**Constraints:** Minimum 3 sides. The UI might restrict extremely high counts to maintain performance and simplicity (20 sides as given, which is plenty for a circle-like shape). The inner radius ratio for stars is between 0 and 1 – too extreme values are clamped (0 or 1 would degenerate the shape). If star mode is off, inner radius is not used. If star mode is on and inner radius is not set by user, a reasonable default like 0.5 could be used. Polygons, when resized non-uniformly (if a user stretches a polygon’s bounding box using selection handles without holding shift), would technically distort the shape (making it not equiangular). The extension might choose to maintain aspect ratio during transform to keep it a true regular polygon, or it may allow non-uniform scaling (which yields an ellipse-like distortion). For now, assume uniform scaling by default unless user explicitly wants to distort it (this detail can be left to implementation).

### Star Tool

**Purpose:** The Star tool is essentially a specialized polygon tool for star shapes. Depending on UI design, it might just be a preset of the Polygon tool with star mode on. However, given it was listed separately, we treat it as a separate tool button for user convenience to create stars (five-point star by default, for example).

**Interaction:** Similar to the polygon tool, click-and-drag from center outwards to create a star. By default, perhaps a 5-point star. Drag sets outer radius. Some implementations fix the initial orientation so that one point is facing up or to the right.

**Customization Options:** Stars share most options with polygons:

* **Points:** Number of points on the star (3 to 20). Default 5 (classic star).
* **Outer Radius & Inner Radius:** Instead of using a boolean, the star tool inherently deals with two radii. Dragging defines the outer radius; the **Inner Radius** ratio or value can be adjusted afterwards (or possibly via a modifier key during drag – e.g., dragging at a certain angle could adjust inner radius, but that’s probably too tricky). The inner radius ratio (0.1–0.9) determines the depth of the star’s valleys.
* **Rotation:** Allows spinning the star to the desired orientation (some stars are prettier rotated a bit so a point is up). Numeric input or free rotate is available.
* **Stroke/Fill:** Same styling as other shapes (color, gradient, pattern, etc. for fill; outline options for stroke).
* **Effects:** Drop shadow, etc. as usual.

Under the hood, the star tool likely just sets the polygon tool’s starMode = true. But from the user perspective, it's distinct.

**SVG Output Model:** Also an `<polygon>` element with twice as many points as the star has points (each actual "point" of the star has an outer and inner vertex in the polygon sequence). Or a `<path>` that draws the star. But polygon is fine since it's a closed shape.

**Constraints:** At least 3 points (which yields a sort of triangle star, basically just a triangle because inner radius would make another triangle overlapping). Maximum around 20 points; beyond that, stars become almost circle-like with many spines and are likely unnecessary. Inner radius ratio must be less than outer radius (expressed as a fraction of it). If a user were to set inner radius too high (like 0.95+) the star looks nearly like a polygon; too low (0.0 or 0.1) the star is very spiky. The UI might set some sensible default like 0.5. Also, a star with 4 points would essentially be like a plus shape or something overlapping oddly (so typically stars are used with odd number of points for symmetry, but even works too, just creates symmetric patterns).

### Line Tool

**Purpose:** Draw straight line segments. Useful for underlining, strikethrough markings, connecting two points without arrowheads, or simple diagrams.

**Interaction:** Select the Line tool (shortcut **L**). Click at the start point of the line, drag to the end point, and release. A straight line is drawn between the start and end coordinates. Hold **Shift** to constrain the line angle to multiples of 45° (horizontal, vertical, diagonal) for perfectly straight or 45° lines.

**Customization Options:** Lines primarily have stroke-related options (since a line by definition has no area to fill):

* **Stroke Color:** Any color for the line.
* **Stroke Width:** Thickness of the line (e.g., 1px up to 20px or more).
* **Stroke Style:** Solid, dashed, dotted, dash-dot (a repeating pattern of dash and dot). If dashed, the dash pattern can be customized as with other shapes (stroke-dasharray).
* **Line Cap:** The style of the line’s end caps – butt (straight edge), round (semicircular end), square (like butt but extended a bit). Typically set to round for nice appearance, but configurable.
* **Line Orientation/Length:** These are determined by the drawn positions, but the properties panel might show the start and end coordinates or the overall length and angle for reference.
* **Effects:** A line can have a drop shadow (appearing as a shadow line parallel to it), though this is less common. Outer glow could surround it. These effects are available but not often used for simple lines.
* There is no fill property for lines (except if someone gave it thickness enough it’s basically a rectangle, but then it’s still stroke actually).

**SVG Output Model:** A line can be an SVG `<line x1="" y1="" x2="" y2="">` element for simplicity, with stroke properties. Or it could be a `<path>` with an `M` and `L` command. Using `<line>` is straightforward. Caps and dash patterns are handled by attributes (`stroke-linecap`, `stroke-dasharray`).

**Constraints:** A line can be as short as a single point (start and end at same place, which would effectively be a point mark – probably not intended, but if it happens, it might render nothing or a dot if round cap and >0 width). There's likely no explicit min length, but extremely short lines might be hard to select. The tool might ignore a click without drag (0-length) and not create a layer in that case. Stroke width is limited by similar global constraints (like max 20 or 50 px). If the user wants an arrow, they should use the Arrow tool instead; the line tool is explicitly without arrowheads.

### Arrow Tool

**Purpose:** Draw arrows for annotations, either single-headed, double-headed, or line-only. Arrows are crucial for pointing to parts of an image or connecting labels to features.

**Interaction:** Select the Arrow tool (shortcut perhaps **A**). Click at the starting point (tail of the arrow), drag to the end point (head of the arrow), release to create. By default, a single-headed arrow might be created (tail at start, head at end). If dragging backwards (leftwards/upwards), it doesn't matter; the arrow direction is from the first click to release point. Hold **Shift** to constrain angle as with line tool. After creation, the arrow’s line can be moved or endpoints adjusted if an edit mode for lines is supported (some editors allow dragging the end of a line to reposition after creation).

**Customization Options:** Arrows have a combination of line styling and head styling:

* **Arrow Type:** Choose between **single arrow** (head at end point only), **double arrow** (heads at both start and end), or **no head** (which effectively makes it a plain line – this might be redundant with the line tool, but "line-only" could be included for completeness). If a double-headed arrow, both ends use the selected head style.
* **Head Style:** The shape of the arrowhead. Options might include triangle (classic arrow), open triangle (just an outline, though not mentioned, likely not needed), **circle** (dot at end), **diamond**, **square**, or other pointer styles. Triangle is default. These could be implemented as different vector shapes at the ends.
* **Head Size:** The size of the arrowhead (e.g. base width and length). A single numeric value could control overall scale of the head, e.g. 5px to 50px length for the arrowhead triangle. If head width ratio is separate, see next.
* **Head Width (Head aspect):** A ratio controlling the arrowhead’s base width relative to its length. For example, 0.5 means a narrow, long arrowhead; 2.0 means a wide, short arrowhead. This allows tweaking the shape of the head to user preference (some prefer big broad arrowheads, others slim). This might be presented as discrete presets or a slider from, say, 0.5 to 3.0.
* **Line (Shaft) Style:** The arrow’s shaft is essentially a line, so it has **stroke color**, **stroke width**, **stroke style** (solid, dash, dot). For dashed arrows, typically the dashes don’t extend into the head, just on the line portion. The stroke color usually also applies to the arrowhead fill (arrowheads are usually filled with the same color as the line for a solid look).
* **Line Arrow Join:** Not specifically listed, but implicitly: how the arrowhead joins the line. Usually, the arrowhead is drawn such that its base sits at the end of the line. In some implementations, the line might stop where the arrowhead begins, to avoid the line protruding. This is handled behind the scenes, but important for rendering (not a user setting).
* **Effects:** Arrows can have shadows or glows too (like a line with a shadow plus the head shape with shadow).

**SVG Output Model:** An arrow could be represented in a couple ways:

* As a single `<path>` that includes the arrowhead (for example, drawing a triangle at the end). This is more complex to manage sizing.
* More straightforward: represent it as a **group**: one SVG `<line>` (for the shaft) and one or two `<polygon>` elements for the arrowhead(s). The polygon for a triangular head would have three points (triangle) oriented correctly. Circle head could be a small `<circle>` at the end coordinate. Diamond and square can be polygons rotated appropriately.
* Alternatively, use SVG marker elements: SVG has a `<marker>` concept that can automatically draw arrowheads on lines. The extension might use this for simplicity, defining an SVG marker for the chosen head style and applying it to the line’s `marker-end` and/or `marker-start`. This would elegantly handle attaching arrowheads. But not sure if all style options (size, shape) easily map unless creating marker defs on the fly.

The likely approach is group elements in JSON and composition on render.

**Constraints:** Arrow length can be very short but then arrowhead might overlap the tail. If the line is shorter than the arrowhead length, the head shapes might render beyond the start. Possibly enforce a minimum length relative to head size or just allow and let it look as it will. Head size has min and max (5px to 50px typical). Arrow shaft thickness should probably be smaller than head size for aesthetics; no hard rule but if a user makes a very thick line and small head, it might look odd (not technically prevented though). The UI might ensure the arrowhead color = line color (or provide separate color options, but typically unified). If separate arrow color is needed, it’s an extra parameter (not mentioned, so assume one color). Double-headed arrows use same style both ends (no independent settings per end). Also, dashed/dotted arrows: the arrowhead is still solid shape; the line portion can be dashed, but usually arrowheads are not dashed (makes no sense). Implementation will likely just draw the line dashes and then draw an arrowhead polygon.

### Highlighter Tool

**Purpose:** Create a highlight overlay on the image – typically a translucent colored rectangle to call attention to an area, similar to using a highlighter pen on text. Often used with a semi-transparent yellow or other bright color to *highlight* part of an image without obscuring it.

**Interaction:** Select the Highlighter tool (no standard letter, maybe **H**). Use it similar to the rectangle tool: click at one corner of the area to highlight, drag to the opposite corner, release to create a rectangle. By default it will appear as a semi-transparent yellow box. This could be used, for example, to highlight a paragraph in a screenshot or a region of interest in a photo.

**Customization Options:** Highlighter is essentially a specialized rectangle with preset styling, but the user can adjust:

* **Fill Color:** Typically a bright color (yellow default), with the expectation it’s semi-transparent. The user can choose other colors (some might use semi-transparent green or red to highlight).
* **Fill Opacity:** The transparency level of the highlight. Likely default around 30% (0.3), and allowed range maybe 10% (very faint) up to 80% (very strong but still see-through).
* **Blend Mode:** Often highlights are effective with **Multiply** blend mode (so that the color intensifies the underlying image rather than just overlaying grey). The tool might automatically use a multiply blend by default. Other modes like Screen, Overlay, Soft-Light might also be available to achieve different highlight effects (e.g. different background types might need different blending). The user can choose blend mode if they want (e.g. normal vs multiply).
* **Stroke:** Usually highlights have no border, but the tool might allow an outline if needed. Stroke color default could match fill or be none. Stroke width default 0. If drawn, it could emphasize the highlighted area border.
* No complex effects by default (no shadow on a highlight because it’s supposed to look like a marker swipe).
* The shape is always rectangular in the current concept. (Optionally one could imagine a freeform highlight marker, but that would be covered by a freehand tool possibly; here it's specifically mentioned as rectangle).

**SVG Output Model:** A highlighter shape would be an SVG `<rect>` with a semi-transparent fill. The difference from a normal rectangle is conceptual (and default styling). It might also have a blend mode applied. In pure SVG, blend modes can be done with the `mix-blend-mode` property if the output format allows it, or by adjusting opacity if using multiply (multiply at 30% is not identical to normal at 30%, but an approximation might be done by color choice). On canvas, multiply blend can be achieved by setting a globalCompositeOperation while drawing that shape. The extension likely handles highlighting by using a multiply compositing during render, which is easier on canvas. For server-side (ImageMagick), they'd multiply the pixel values.

**Constraints:** The highlight's main constraint is it should remain see-through. For usability, the UI might restrict fillOpacity to a certain range (10–80%) and maybe pop a warning if user sets 100% (which defeats the purpose of "highlight" by completely covering image). But it might not strictly enforce it. Also, highlight typically no sharp outline; if user adds stroke, that’s their choice. The default color palette might include common highlight colors (yellow, green, pink) for quick selection. Because highlights are rectangles, if the user wanted to highlight a non-rectangular region, they'd have to use multiple shapes or another tool. This tool is straightforward by design.

### Callout Tool

**Purpose:** The Callout tool creates a connected annotation consisting of a text label with an arrow or pointer, commonly used to call out a specific feature with a descriptive label. This is akin to a speech bubble or a labeled pointer box.

**Interaction:** Select the Callout tool. Creating a callout might be a two-step or combined process:

1. **Placement:** The user first clicks the point that they want to point *to* (the tip of the callout pointer). For example, click near an object in the image that you want to label.
2. **Drag:** After the initial click, dragging the mouse will stretch out an arrow leader line from that point and simultaneously define the position of the text box. One approach: as you drag, a text box is attached to the cursor and a line connects the initial click point to this text box. Release to place the text box.
3. Immediately, a text insertion cursor appears inside the text box so the user can type the label. The text entry and styling works like the Text tool.

Alternatively, the implementation could be: click and drag from where the text box should be towards the point of interest (reversing the order). Or even: drag a text box first, then connect the pointer. But the above (point then drag to place box) is intuitive – it ensures the pointer is anchored correctly.

After creation, the **callout has two parts**: the text box and the pointer line (leader). The user can move the text box independently; the pointer will stretch to remain attached to the anchor point. The anchor point might also be adjustable by dragging the tip or reassigning it.

**Customization Options:** Callouts combine text and shape styling:

* **Text Box Style:** The text box portion can be styled like a shape or text container. For instance, **Fill color** for the box background (often white or a light color for readability), **Stroke/Border** color and width (maybe a solid border around the box). Or the box might default to a semi-transparent white background with a black border, or solid white with shadow – depending on style preferences. The fill could also be set to none if one wants just text with no box, though then readability might suffer on busy images.
* **Text Style:** The text inside follows the Text tool properties (font, size, color, etc.). Typically black or dark text on light background, but user can change.
* **Pointer Line Style:** The pointer arrow/line connecting to the text box can be styled. It might have an arrowhead at the anchor point or just a line ending at the box. Possibly options:

  * **Pointer Type:** arrow, or just a line (some callouts use a plain line or a curved line; curved might be out of scope though).
  * **Pointer Arrowhead:** On/off. If on, small arrowhead at the tip (pointing to the image feature). If off, maybe a simple line or just the line connects flush to box.
  * **Pointer Color:** Usually match the box border color or the text color. Perhaps unified with the box border color to look consistent.
  * **Pointer Thickness:** Stroke width of the pointer line.
* **Box Shape:** Possibly allow the box to be not only rectangle but maybe an ellipse or cloud shape (speech bubble style). However, that might be too fancy; likely just a rectangle with maybe slightly rounded corners. The spec can allow perhaps that the callout box could have a radius setting for corners if needed.
* **Positioning:** The callout’s pointer ideally attaches to the nearest side of the box towards the anchor. E.g., if the anchor point is above and left of the box, the pointer might attach to the top-left side of the box. The extension could automatically decide attach point or allow the user to drag the box such that the pointer line bends. For simplicity, initial implementation might have the pointer always attach to the center of one side of the box. Future enhancements might allow repositioning the pointer’s attachment on the box by dragging a handle (for flexibility).
* **Effects:** The entire callout group can have effects like a drop shadow (making the label box and pointer cast one shadow). This gives a nice lifted-off-the-image look for the label box.

**SVG Output Model:** A callout can be represented as a **group** `<g>` containing:

* a `<rect>` (or `<foreignObject>` containing actual text if going fancy, but simpler: rect + separate text) for the background box,
* a `<text>` element for the label (above the rect in z-order so it's on top of background),
* and a `<path>` or `<line>` + maybe `<polygon>` (arrowhead) for the pointer. For example, pointer could be a line from the box edge to the anchor point with an arrowhead polygon at the anchor end.

Alternatively, one could draw the pointer as a polygon that extends from the box (like a speech bubble triangle) if the pointer attaches flush. But dynamic positioning is easier as separate line.

The group would be treated as one layer (so moving the layer moves both box and pointer together).

**Constraints:** The callout text length should ideally be short (a label or sentence). If it’s too long, the text box grows; multiline is possible if the user presses enter or if the box has a fixed width and text wraps. The pointer should not be too short or too long beyond reason; if the user places the box extremely far from the anchor, it's allowed but might look odd. Possibly no explicit limit. The pointer anchor ideally stays put relative to image even if the box is moved – i.e., moving the box will pivot the pointer around the anchor. Implementation wise, the anchor is a fixed point in image coordinates (or attached to some object maybe, but likely just coordinates).
The user should avoid overlapping callout boxes with other content for clarity. There's no enforced rule, but visually they'd adjust.

### Blur (Redaction) Tool

**Purpose:** The Blur tool is used to obscure parts of the image by applying a blur effect (or similar obfuscation) over a specific region. This is useful for redacting sensitive information (faces, license plates, text) in an image without permanently altering the original – the blur is an overlay layer that hides underlying details.

**Interaction:** Select the Blur tool. The usage is similar to drawing a shape: click at one corner of the area to obscure, drag to the opposite corner, release to create a **blur region**. The region might initially show as a transparent gray box or a pixelated preview indicating the area that will be blurred. On release, the underlying image portion within that region immediately appears blurred on the canvas (as if a blur filter was applied to that portion).

After creation, the blur region can be moved or resized like a shape. This will update which part of the image is being blurred in real-time.

**Customization Options:** Blur regions have some specific settings:

* **Blur Strength (Radius):** Controls how strong the blur effect is. Measured in pixels radius of Gaussian blur. For instance, options from 1px (very slight blur) up to, say, 20px or more for heavy blur. A moderate default like 5px radius might be used. The UI could present this as a slider or a few presets (light, medium, heavy blur).
* **Shape:** By default, the blur region is a rectangle. Possibly an option to toggle to an ellipse (for blurring round areas). If not explicitly in UI, one could simulate elliptical blur by using an ellipse tool with blur effect (if that is allowed in styling – see Filters in styling section). But the Blur tool itself likely just does rectangles for simplicity.
* **Pixelation (alternate mode):** Some redactions use pixelation (mosaic) instead of Gaussian blur. The tool could offer a mode switch between Gaussian blur and pixelate. For example, a checkbox "Pixelate instead of blur". If pixelate, then strength might control block size rather than radius. This is an optional extension – not mentioned explicitly, but worth considering in a full-featured editor.
* **Color/Tint:** Usually blur overlays don't add color, they just distort. But an optional slight tint might be applied to the region (like a semi-transparent black) to further obscure. Not necessary; likely no color, the blur just shows the original colors blurred.
* **Border:** Typically none; the blur region isn’t meant to be seen as a shape, just an effect. So no stroke outline (unless a developer wanted to have an outline to indicate the region in editor, but in final output you probably want no visible border). The editor might show a dashed outline just for the editor’s benefit, but that wouldn’t be rendered on final thumbnail.

**SVG/Implementation Output Model:** Blurring a portion of an image via vector/SVG is tricky because SVG would need to reference the underlying image. One approach: use an SVG `<filter>` with a feGaussianBlur on the image, but clipped to the region. Alternatively, embed the image section in a mask. However, since the extension architecture uses a combination of client canvas and server composite, it's likely implemented as follows:

* In data, a blur region could be stored as an object with type "blur" and coordinates and radius.
* On client side (in editor), the canvas drawing code detects this object and uses canvas context’s filter property (e.g. `ctx.filter = 'blur(5px)'`) to draw that portion of the image onto the canvas. Possibly by copying that image fragment and blurring it.
* On server side (for rendering), they'd use ImageMagick to take that region of the source image and blur it, then overlay.

If exporting to an SVG for any reason, one could create an SVG `<image>` tag referencing the file, and apply a clip path plus filter to it. But that may be beyond scope. Probably handled procedurally.

So in summary, think of blur tool not as a separate SVG shape but an operation: however, to maintain consistency, perhaps it is represented as a shape (rectangle) with a property "effect: blur(X)". They might even treat it like a special kind of shape that when rendered, instead of a colored fill, it draws a blurred image patch.

**Constraints:** The blur region must be within the image bounds ideally, as blurring nothing outside image has no effect (if user draws partly outside, only the intersection with image matters). The system likely clips the blur to the image area automatically. Blur radius is capped for performance (extremely large blurs are expensive). Perhaps 0–20px range is enforced in UI. Also, multiple overlapping blur regions will each blur the original image beneath them (not sequentially double-blurring – effectively each layer sees original image as base, unless stacking blur on top of blur if user does that intentionally).
One caveat: if a user blurs something, then draws a highlight on top of it, the highlight will overlay on the blurred content, which is fine. If they draw two blur regions overlapping, the area of overlap might be blurred twice if rendered sequentially (could result in extra blurry in overlap). To avoid complexity, maybe advise to use one blur per region or be aware double stacking intensifies blur. But it's an edge case.

From a user perspective, the blur tool is straightforward: draw, area gets blurred. It's an important non-destructive alternative to manually editing the image to redact info.

---

These tools collectively provide a comprehensive toolkit for annotation:
**Summary of Tools:** Pointer (select/move), Marquee (select area), Text (labels), Rectangle/Ellipse (basic shapes), Polygon/Star (custom shapes), Line (simple lines), Arrow (pointing arrows), Highlight (translucent emphasis), Callout (labels with pointers), Blur (redaction). This covers most annotation needs found in professional editors, all while storing each element as an independent, editable layer.

## Styling and Effects

A powerful styling system is at the core of the Layers extension, allowing both individual objects and whole layers to be richly formatted. This includes control over basic appearance (stroke and fill), transparency and blending, as well as more advanced effects like shadows and glows.

### Stroke and Fill Styles

Most drawing tools produce shapes or lines that have **stroke** (outline) and/or **fill** (interior) attributes. Developers should implement these consistently across tools for a unified experience:

* **Stroke (Outline):** Any shape or line can have an outline. Style properties for strokes include:

  * **Stroke Color:** The color of the outline. Can be specified in hex (`#RRGGBB`) or named color, etc. It can also be set to 'none' to have no outline at all.
  * **Stroke Width:** The thickness of the outline, in pixels. Can range from hairline (1px) up to a large value (common default max \~20px for shapes, might allow more for extreme use). A width of 0 means no visible stroke.
  * **Stroke Opacity:** The transparency of the outline, from 0% (invisible) to 100% (fully opaque). This allows making subtle outlines or layering multiple strokes.
  * **Stroke Dash Pattern:** Instead of a solid line, strokes can be dashed or dotted. We provide options like *solid* (continuous), *dashed* (repeating dash segments), *dotted* (round dots), or *dash-dot*. If a custom pattern is needed, a sequence like "5,5" (meaning 5px dash, 5px gap) can be specified. Internally this corresponds to the SVG `stroke-dasharray` property.
  * **Line Joins and Caps:** For shapes with corners (polygons, stars, rectangles), the join style (miter, round, bevel) can be set globally or left at default (miter). For open paths (like polylines or the ends of lines/arrows), the cap style (butt, round, square) is configurable. Usually default to round joins and round caps for a polished look unless a sharp corner is needed.

* **Fill (Interior):** Closed shapes (rectangle, ellipse, polygon, star, text glyphs, etc.) have an interior fill:

  * **Fill Color:** The main color filling the shape. Can be any color or 'none' for transparent (hollow) shapes. Text fill is the text color.
  * **Fill Opacity:** Transparency of the fill, independent of stroke opacity. Ranges 0–100%. E.g., a shape could have a semi-transparent fill but an opaque border.
  * **Gradient Fills:** The extension supports gradient fills for shapes. Two types are foreseen: **linear gradient** (color changes along a line) or **radial gradient** (color radiates from a center). The user can pick gradient type and define **gradient stops** (each stop has a position 0–100% and a color). For instance, a linear gradient might go from blue at 0% to green at 100%. The UI should allow adding/removing color stops and setting their colors and positions. This might be done via a mini gradient editor UI.
  * **Pattern or Image Fill:** Not explicitly mentioned, but an extension could allow patterns (like hatch lines, dots, or even image textures) as fills. This is advanced and possibly future scope. The architecture could handle it by storing a reference to a pattern image or SVG pattern definition.
  * **No Fill:** Setting fill to none leaves only the stroke visible (useful for hollow shapes like an empty box).

All these stroke/fill properties are **immediately visible** when adjusted in the editor. On the backend, they are stored as part of the object’s style properties in JSON and can be translated to SVG attributes.

### Transparency and Blend Modes

Transparency (opacity) and blend modes determine how layers and objects compositively blend with those beneath them (including the base image).

* **Object Opacity:** Each shape object can have an overall opacity in addition to the separate fill/stroke opacity. If not explicitly specified, it can be derived from fill/stroke values (for example, if both fill and stroke are 100% opaque, the object is fully opaque). Some implementations provide a single opacity for the whole object, affecting both fill and stroke together. In this extension, we primarily use fillOpacity and strokeOpacity for fine control. But for convenience, a top-level object opacity could be considered as shorthand (multiplying both).
* **Layer Opacity:** Entire layers (which might contain multiple objects if grouped) have an opacity setting. This is applied on top of the objects in that layer. For example, if a layer of several annotations is set to 50% opacity, the composite of those annotations will appear semi-transparent over the image. Layer opacity is useful to fade out a whole set of annotations at once.
* **Blend Modes:** Blend modes define how colors of one layer mix with those below. The extension supports standard blend modes commonly found in graphics software:

  * **Normal:** Default, no special blending; the top layer’s pixels overlay the bottom (respecting opacity).
  * **Multiply:** Multiplies the color channels, resulting in a darker combination. Great for realistic highlighting (e.g. yellow highlight multiply on white gives yellow, on black remains black).
  * **Screen:** The inverse of multiply, resulting in a lighter combination (useful for lightening effects).
  * **Overlay:** Combines multiply and screen depending on base color, preserving highlights and shadows of the base image, giving a contrasty overlay.
  * **Soft Light / Hard Light:** Different contrast enhancements or shading modes.
  * **Color Dodge / Burn:** Intensify brightness or darkness of base colors.
  * **Darken / Lighten:** Takes either the minimum or maximum of each color channel, effectively only painting where it's darker (or lighter).
  * **Difference / Exclusion:** Create color inversions or differences, often for special effects.

  These modes are particularly relevant if, say, you put a semi-transparent shape on top of a photo and want a certain effect. For example, a semi-transparent black shape with "Multiply" will only darken the image (like a shading), whereas with "Normal" it would just look like a gray veil.

The user can set blend mode per layer (likely in the layer’s properties). If needed, perhaps also per object, though typically UIs simplify by doing it at layer level. In an architecture where each object is a layer, object-level and layer-level blend mode are effectively the same, but if grouped objects share one layer, that layer’s blend applies to their composite.

The rendering engine must handle blend modes either via canvas API (which has globalCompositeOperation for some modes) or by a custom blend in server rendering. Some blend modes (multiply, screen, etc.) correspond to canvas composite operations or can be simulated. Others might need fallback (not all modes available in canvas, e.g. difference and exclusion might be available, but if not, then server side with ImageMagick can do all standard modes).

### Shadows and Glows

**Drop Shadow:** A very common effect, giving objects a shadow for depth. For any shape or text:

* Can be toggled on/off per object, and also available as a layer-level effect (shadow on the whole layer group).
* Properties include **Shadow Color**, **Offset X**, **Offset Y**, **Blur radius**, and **Opacity**. Optionally a **Spread** or size could be included (though in many contexts, "spread" is not directly in Canvas API, but can simulate by growing the shape).
* Example default: black shadow, offset (2px, 2px), blur 4px, opacity 50%. These make a subtle shadow. The user can increase blur for a more diffused shadow or increase offset for a more pronounced drop.
* On the canvas, drop shadows can be rendered by drawing the shape with a shadow. In SVG, an feDropShadow filter or an feGaussianBlur + offset composite can achieve similar.
* Multiple shadows (like inner shadow or more than one) are not in scope; just one shadow per object/layer.

**Outer Glow:** Similar to shadow but not offset – a halo around the object:

* This can be considered a shadow with offset 0 in all directions. We might expose it as a separate effect name "Glow" for user clarity.
* Properties: Glow color, size (blur), opacity. Typically glow is colored (e.g. a blue glow around an object).
* Use cases: highlighting an object with a neon-like outline for emphasis.
* Implementation: same as a shadow but centered. In an UI, you might have separate toggle checkboxes, but they are essentially variants of the same filter. We'll treat it separately so that an object could potentially have both a drop shadow and a glow if needed (though stacking filters complicates things; more likely, choose one or the other).
* If layer-level, an outer glow around all layer content can make a group of annotations stand out from the image.

**Inner Shadow/Glow:** Not explicitly asked for, likely beyond the immediate needs of annotation. Could be left for future extension (e.g. inner shadow to make text appear engraved).

**Stroke (Layer Effect):** A special effect mentioned is a **global stroke effect at layer level**. That means the entire collection of shapes in a layer could be outlined as one combined silhouette. For example, if you have multiple text labels on a layer and you enable a layer stroke, it might draw a stroke around each text or around the union outline of all texts? The interpretation could be either:

* Outline each constituent object (which is redundant if they already have strokes individually).
* Or a more interesting concept: treat the whole layer’s visible pixels as one shape and stroke its perimeter (like an outline around the group). That’s something done in Photoshop (called "Outer Stroke" effect on a group).
  This can be useful to create a border around a cluster of annotations or to make text more readable by outlining the whole text group.
  Given this was mentioned, we note it, but implementing it is complex. Probably simpler is the first interpretation (apply stroke settings to each object lacking one).
  However, since the spec mentions it explicitly as a layer effect, we assume the user might want a group outline. Developers might approximate this by stamping each object’s stroke, or not support it initially.

**Filters (Blur & Others):** Under effects, **filters** refer to applying image filter effects to a shape or layer. **Blur** is the primary one we already described in the tool context, but others might include:

* **Gaussian Blur:** Can be applied to any object to soften it (makes sense for maybe images or for a glow-like effect).
* **Sharpen, Brightness/Contrast adjustments:** Possibly future if needed to adjust an overlaid image or such.
* **Color Filters:** e.g. making an object grayscale or a different hue (not typical for vector shapes unless using an image).
* In annotation context, filters beyond blur are less common, so we focus on blur as an effect.

When we talk about blur as an effect distinct from the blur tool: it could mean one can take any shape, say a rectangle, and turn on a blur filter to blur whatever is beneath that shape’s area (like a mask). That is effectively the blur tool usage. So conceptually, the blur tool could simply be a rectangle shape with a "blur background" effect toggled. If designing, one might implement blur as a property of shapes: e.g., a rectangle with fill type = "blur". But from user perspective it's a separate tool to simplify usage.

**Summary**: The styling system allows layering multiple visual treatments. A single object could, for example, have a red fill at 50% opacity, a dashed black stroke, a drop shadow, and a multiply blend mode. The composite result on the image should reflect all of these.

At the **layer level**, one can adjust the entire set of objects collectively – e.g., lower the whole layer’s opacity (fading all annotations on that layer), set a blend mode (perhaps an entire annotation layer set to “multiply” so all its shapes multiply with the image, which is easier than setting each shape individually), or apply a layer drop shadow (maybe casting a shadow of the combined annotation group onto the image for a lifting effect).

From a developer standpoint, ensure that the rendering order and state resets handle these: for example, drawing with blend modes and global alpha in canvas needs careful ordering. Probably it’s simpler to pre-compose each layer group separately and then blend with background.

The **non-destructive nature** means these styles can all be toggled or changed anytime – they are stored as parameters, not baked into any raster until final composite. This flexibility is a key part of the design paradigm, akin to Photoshop layer styles.

## Wikitext Embedding

One of the core integration features of the Layers extension is the ability to display images with their annotation layers in wiki pages using standard `[[File:...]]` syntax. Editors can specify which layers to show (or hide) via a `layers` parameter in the file tag. The wiki parser and image rendering system then handle composing the base image with the selected overlay layers.

### File Syntax with `layers` Parameter

To use an image’s layers in a wiki page, the editor includes the `layers=` parameter in the File tag. Some examples of usage:

* **Show all layers:** Include all saved annotation layers on top of the image.

  ```wikitext
  [[File:ExampleImage.jpg|400px|layers=all|An image with all annotations]]
  ```

  This will render the ExampleImage.jpg at 400px width with all its annotation layers drawn on it.

* **Show no layers:** Display just the original image (no overlays). This is the default if the layers param is omitted. It can also be made explicit:

  ```wikitext
  [[File:ExampleImage.jpg|400px|layers=none|Original image]]
  ```

  or simply:

  ```wikitext
  [[File:ExampleImage.jpg|400px|Original image]]
  ```

  Using `layers=none` is equivalent to not having the parameter.

* **Show specific layers:** Selectively render only certain layers by their identifiers or names. For example:

  ```wikitext
  [[File:ExampleImage.jpg|400px|layers=label,arrow1,arrow2|Image with certain callouts]]
  ```

  In this case, only the layers with IDs or names "label", "arrow1", and "arrow2" (for instance) will be drawn on the image, and others will be hidden.

The values after `layers=` can be:

* `all` / `none` (special keywords).
* A comma-separated list of layer identifiers. **Layer identifiers** can be the unique IDs assigned to layers (which might be short hashes or numbers), or user-defined layer names if those are allowed for reference. The extension in development initially conceived layer IDs like two-digit hex (01, 02, ... FF), but later introduced longer IDs or names for robustness. In practice, the UI provides an easy way to get the correct identifiers (discussed below).
* Alternatively, advanced usage allows `id:12345` or `name:LayerName` prefixes (the extension’s parser hooks support `id:` and `name:` syntax). For example, `layers=id:42` would load the layer set with internal ID 42 (representing a specific saved state), and `layers=name:Draft` could load a layer set saved under the name "Draft".

**Obtaining Layer References:** In the Layers editor UI, when editing an image, the user can copy the appropriate `layers=` code snippet:

* The layer panel or a dedicated "Wikitext Code" section provides pre-formatted examples. If all layers are currently visible in the editor, it might suggest `layers=all`. If only certain layers are visible (others hidden), it will generate a parameter like `layers=abc1,def2` (example IDs) for those visible.
* A "Copy code" button allows the editor to copy that snippet to clipboard. They can then paste it into a wiki page.
* This ensures editors use the correct syntax and ID values without manual guesswork.

### Rendering Behavior

Under the hood, when a wiki page with an `[[File:...|layers=...]]` tag is rendered:

1. The **parser** detects the `layers=` parameter on the file tag.
2. It then queries the Layers extension to retrieve the necessary layer data for that image:

   * If `layers=all`, it fetches the latest layer set for that file.
   * If a specific list of layer IDs or a named set is given, it resolves which saved layer set and which subset to use. (Currently, the implementation allows referencing an entire saved "layer set" by name or ID. Support for selecting individual layer IDs within the set might be handled by the client-side if server doesn’t composite partially yet.)
3. The extension then ensures that when the image is transformed into a thumbnail, the overlay layers are combined:

   * For a fully implemented server-side solution, the extension will generate a composite image: it takes the base image, then draws the specified layers on top, and produces a new image (thumbnail) file for that composite. This would be done by the extension’s file transform hook using a rendering engine (likely ImageMagick or PHP’s GD). The composite thumbnail is stored in the thumbnail cache just like normal thumbs for performance.
   * If server-side rendering is not available or a partial selection of layers was requested in an unsupported way, the extension might fall back to client-side rendering: it could output the base image and overlay the vector drawing via HTML/CSS/JS on page load. (However, the goal for final product is **server-side thumbnail rendering** for all cases, so viewers do not rely on client scripts to see annotations.)
4. The resultant image (with overlays) is delivered in the page. From the wiki content perspective, it’s just an image thumbnail like any other, respecting width, thumb, frame, etc., except it includes the drawn layers.

**Caching and Updates:** The extension integrates with MediaWiki’s caching so that:

* Each unique combination of image + layers param produces a distinct cached thumbnail. For example, `File:Example.jpg|500px|layers=all` might cache as `Example.jpg+layers=all+500px.png`.
* If layer data is updated (user edits layers and saves new ones), the cached composites for that image should be invalidated. The extension will do this by tracking the image’s last annotation update timestamp. When a new request comes in, if cached thumb is older, it regenerates.
* The `layer_sets` data is versioned; the parser might include a version or set ID in the thumbnail path to automatically separate old vs new sets.

**Performance:** Showing specific layers (instead of all) could be more efficient if it means less drawing (though difference is minor). However, the documentation note suggests selecting specific layers can be more efficient than `all` because it only processes those needed. This implies server composite might filter out others or client side only draws some. In any case, the difference is usually trivial unless there are many layers.

**Fallbacks:** If for some reason the layers cannot be rendered (e.g. data missing or render error), the extension falls back to the original image (no layers) so that no broken images appear. It may also add a CSS class or data attribute for client to try drawing if server didn't.

### Configuration Parameters

The Layers extension provides several configuration variables that administrators or developers can set in `LocalSettings.php` to tune its behavior. Key configuration options include:

* **`$wgLayersEnable`** (Boolean): Master enable/disable flag for the Layers extension. If set to false, the "Edit Layers" UI and all related functionality are disabled site-wide (the `layers=` parser parameter will be ignored). Default: `true` (enabled).
* **`$wgLayersMaxBytes`** (Integer): The maximum allowed size (in bytes) of the JSON blob that stores layer data for an image. This effectively limits how complex or how many annotations can be on one image. The default is 2,097,152 bytes (2 MB). If a user tries to save layers beyond this size, the save API should reject it.
* **`$wgLayersMaxImageSize`** (Integer, pixels): The maximum pixel dimension (longest side) of the base image for which layer editing is allowed. Default might be 4096px, meaning if an image is larger than 4096px in width or height, the editor may refuse to load for performance reasons. (They might require uploading a smaller version or downscaling for editing.)
* **`$wgLayersMaxImageDimensions`** (Integer, pixels): Possibly a combined limit (like max width \* height or something). In code it's described as "Maximum width/height for layer processing" default 8192. This could mean images above 8192 in either dimension are not processed, or it might be an additional cap to \$wgLayersMaxImageSize – the exact usage might be to limit total pixel area.
* **`$wgLayersThumbnailCache`** (Boolean): Whether to cache composite thumbnails on disk. Default: `true`. If false, the extension might generate the overlay on every page view (not recommended except perhaps in development).
* **`$wgLayersImageMagickTimeout`** (Integer, seconds): Timeout for server-side ImageMagick operations. Default: 30 seconds. If generating a composite or applying filters takes longer than this, the process is killed to avoid hanging. This ensures large images or complex filters don’t stall the server indefinitely.
* **`$wgLayersDefaultFonts`** (Array of strings): The list of font families available in the text tool font dropdown. Defaults include common fonts (Arial, Roboto, Noto Sans, Times New Roman, Courier New). Admins can add custom font names here (assuming the wiki’s CSS or system has them available) to expand user choice.
* **`$wgLayersAllowAnonymousEdit`** (Boolean): (If present) Allows non-logged-in (anonymous) users to use the layers editor. By default, only registered users can edit layers (anonymous can still view them). If set to true, the extension will grant the `editlayers` right to anon users automatically. Default: not set (false).
* **Legacy/Other**: `$wgLayersUseBinaryOverlays` (Boolean) exists in extension.json for backwards compatibility, default false. This would enable an older storage method (binary files for layers) but in modern usage it remains off since JSON in DB is used. Generally should not be enabled unless dealing with legacy data.

To apply these, one sets them in LocalSettings after including the extension, for example:

```php
wfLoadExtension('Layers');
$wgLayersEnable = true;
$wgLayersMaxBytes = 4097152; // 4 MB if we want to allow larger annotations
$wgLayersAllowAnonymousEdit = false; // ensure only registered can edit
```

and so on.

### Permissions

The extension defines custom user rights to control access:

* **`editlayers`** – allows a user to launch the layer editor and save changes to image layers. By default, this is intended for all registered users and is even granted to everyone (`*`) in extension setup (meaning even anons, though the code then optionally restricts anons unless \$wgLayersAllowAnonymousEdit is true). Typically, a wiki might choose to grant `editlayers` to confirmed users or a specific group if they want to restrict who can annotate images.
* **`createlayers`** – possibly intended to control who can create new layer sets or initiate annotation on an image for the first time. The default config grants this to autoconfirmed users. The distinction between editing existing vs. creating new annotation sets might be a concept: e.g., maybe everyone can edit existing ones but only certain can start an annotation on a fresh image. In practice, the extension currently treats any edit as just an edit (creating the first layer set if none exists). This right could be used in the future to restrict layer creation on images.
* **`managelayerlibrary`** – meant for an asset library management (e.g. ability to add/remove shared assets). Granted by default only to sysops (admins). This implies normal users cannot add global assets unless given this right. (If asset library is not fully implemented, this might not have much effect yet.)

In LocalSettings, the wiki admin can override these defaults. For example:

```php
// Only logged-in users can edit layers (no anon)
$wgGroupPermissions['*']['editlayers'] = false;
$wgGroupPermissions['user']['editlayers'] = true;
```

By default, as installed, it effectively sets:

```php
$wgGroupPermissions['user']['editlayers'] = true;
$wgGroupPermissions['autoconfirmed']['createlayers'] = true;
$wgGroupPermissions['sysop']['managelayerlibrary'] = true;
```

and even `'*'['editlayers'] = true` (which is everyone including anon), though the runtime hook strips it for anon unless configured.

Other relevant permissions: since editing layers is akin to editing a page, one might consider requiring `edit` permission on the File namespace. The extension specifically uses its own `editlayers` right instead, so a user could conceivably have `editlayers` without regular `edit` (though that scenario is uncommon).

**Security**: The system checks these permissions in critical places:

* The "Edit Layers" tab only shows if the user has `editlayers`.
* The action=editlayers endpoint enforces `editlayers` or throws an error.
* API calls to save layers require the user to have `editlayers` (and probably to have edit rights on the file, but by design it's separate).
* The ability to manage asset library would be behind `managelayerlibrary` (e.g. an interface to add shared shapes, not implemented yet fully).

Admins can thus finely control who can annotate images and who can manage any shared layer assets. By default, it's open to all logged-in users to encourage contributions.

## Installation and Developer Setup

For developers or wiki admins installing the Layers extension, the process is standard for a MediaWiki extension with some additional build steps:

1. **Download the Extension:** Clone the repository into your `extensions/` folder:

   ```bash
   cd path/to/wiki/extensions
   git clone https://github.com/slickdexic/Layers.git
   ```

   (Or download and extract it such that you have an `extensions/Layers/` directory.)

2. **Composer Dependencies:** Navigate to the extension directory and install any PHP dependencies:

   ```bash
   cd Layers
   composer install
   ```

   This will set up libraries listed in `composer.json` (if any; likely for MediaWiki integration boilerplate or maybe an ImageMagick wrapper if used).

3. **Node/NPM Build (if applicable):** Install JavaScript dependencies and build tools:

   ```bash
   npm install
   ```

   The extension’s front-end code might be written in modern JS but distributed via ResourceLoader. If a build system (Webpack/Vite) is configured, this command would pull in dev dependencies like ESLint or polyfills. At minimum, it provides linting and testing tools.

4. **Enable in LocalSettings:** Edit `LocalSettings.php` to enable the extension:

   ```php
   wfLoadExtension( 'Layers' );
   // (The extension.json will handle loading everything else)
   // Optional config overrides:
   $wgLayersEnable = true;
   $wgGroupPermissions['user']['editlayers'] = true; // ensure users can edit layers
   // ... (any other $wgLayers... settings as needed)
   ```

   Ensure `$wgLayersEnable` is true (it is by default).

5. **Database Setup:** Run the MediaWiki update script to create the necessary database tables:

   ```bash
   php maintenance/update.php
   ```

   This will create tables such as `layer_sets`, `layer_assets`, `layer_set_usage` in the wiki database. The table definitions are in the extension’s SQL file. After running, verify that the tables exist.

6. **Verify Installation:** Navigate to Special\:Version on your wiki – the Layers extension should appear in the list of installed extensions if loaded correctly. Also verify that on File pages, an "Edit Layers" tab now shows (for users with permission).

**Development and Testing:**

* The extension includes some test infrastructure. You can run `npm test` to perform JavaScript linting (and any JS tests if added), and `composer test` to run PHP code style checks or PHPUnit tests.
* For interactive development, you might use your browser’s console and dev tools. The JavaScript entry point for the editor is triggered via `mw.hook('layers.editor.init')` in the UI hook. You can simulate or call those manually if needed to reinitialize.
* The code is split between `/resources/` for client-side and `/src/` for server-side. The main JS files (`CanvasManager.js`, `LayersEditor.js`, etc.) are loaded as ResourceLoader modules when action=editlayers is triggered.
* If you modify JS, you might need to run a build step or at least purge ResourceLoader cache (append `?action=purge` or use debug mode `&debug=true` to ensure your changes show up).
* Ensure ImageMagick or GD is installed on the server if you want server-side thumbnail rendering to work. The extension might call an `ImageMagick` convert command through PHP (check `ThumbnailRenderer` class usage).

## Architecture and Backend Design

The Layers extension is built with a clear separation between frontend (JavaScript editor app) and backend (PHP integration and storage), following MediaWiki’s extension patterns. Below is a technical overview:

### Frontend Architecture (Editor App)

The front-end is a single-page application that runs when a user enters the "Edit Layers" interface. It primarily consists of HTML, JavaScript, and Canvas elements running in the user's browser.

Key components:

* **Editor Container:** When the editor is launched, a `<div id="layers-editor-container">` is injected into the File page content area by the extension. The entire app’s HTML interface (toolbars, canvas, panels) is dynamically generated inside this container by the JS code.

* **Main Editor Controller (`LayersEditor.js`):** This is the central orchestrator module. It initializes the UI, handles top-level events (like clicking Save or Cancel), and mediates between other components. On load, it calls the API to fetch existing layer data for the image (via `ApiLayersInfo`) and then populates the canvas and layer panel with this data. It also handles finalizing saves (gathering the data and calling `ApiLayersSave`). It may manage the undo/redo stack at a high level (delegating actual implementation to CanvasManager).

* **Canvas Manager (`CanvasManager.js`):** The core of drawing and user interaction on the canvas. This module likely:

  * Maintains the in-memory representation of all layers and objects (e.g. an array `this.layers` each with properties and geometry).
  * Renders the canvas on each change: iterating through layers and drawing each shape onto an HTML5 Canvas element.
  * Handles mouse events on the canvas: mousedown, mousemove, mouseup for drawing shapes or selecting; implements the logic for each tool (the behavior we described for tools would largely live here).
  * Performs hit-testing (detecting which object is under a click for selection).
  * Manages drag operations, including snapping.
  * Maintains selection state, and applies transformations to shapes.
  * Implements the undo/redo system (could store snapshots of `this.layers` or incremental diffs).
  * Handles clipboard (copy/paste) by storing a copy of objects in memory (since browser clipboard for complex objects would need integration).
  * Possibly handles text editing mode (or delegates to a text subcomponent).

  `CanvasManager.js` was noted to be large and does a lot, meaning future refactoring would break it into smaller modules (state management, rendering, events, etc.).

* **Toolbar (`Toolbar.js`):** Manages the top toolbar UI. It likely creates the HTML for tool buttons and binds event handlers for tool selection. It also probably updates the UI elements (like toggling a button active, or enabling/disabling certain controls based on context). It handles inputs on the toolbar (color pickers, sliders for stroke width, etc.) and sends those changes to the CanvasManager (to update the current tool’s settings or the selected object’s style).

* **Layer Panel (`LayerPanel.js`):** Manages the side panel UI for layers. It builds the list of layer items, handles drag-and-drop reordering, visibility toggle clicks, lock toggles, and updating the list when layers are added or removed. It communicates with CanvasManager to sync selection (e.g. clicking a layer in the list might select all objects in that layer or highlight it). It also likely provides the UI for naming layers and showing that "Wikitext code" snippet area with copy button.

* **Properties Inspector (could be part of Toolbar.js or separate):** In some designs, the bottom properties panel might be managed by the main editor or a separate module. It updates form fields when selection changes and dispatches user edits (like changing a value) back to the CanvasManager to apply.

All these components use standard web tech (possibly leveraging jQuery or OOUI widgets, although the code might be custom). The extension resource file lists indicate reliance on OOUI and jQuery, so some interface elements (dialogs, buttons) might be OOUI components.

**State Management:** The editor likely holds a master JavaScript object representing the current layer set (all layers and their content). This could be an array of layer objects, where each object contains fields like:

```js
{
  "id": "abc123",  // layer unique id
  "name": "Layer 1",
  "visible": true,
  "locked": false,
  "opacity": 1.0,
  "blendMode": "normal",
  "objects": [ 
       { "type": "rectangle", "x":10,"y":20,"width":100,"height":50, "fill":"#ff0", "stroke":"#000", ...},
       { ... }
  ]
}
```

Alternatively, if each object is a layer, the structure is simpler (one array of objects where each has its own visibility, etc., with an implicit base image layer separately). The current implementation seems to treat each drawn shape as a separate "layer object" for user control.

Undo/redo might store snapshots of this structure or a stack of operations (the TODO suggests a need for structured state for ease of implementing this).

**Front-end Performance:** The canvas approach means for each frame of interaction (like dragging or moving an object), the entire canvas might be redrawn. For moderate number of objects (few hundred), this is fine. If there were thousands of objects, performance could suffer. The design assumption is that annotations remain relatively small scale (tens of objects, not thousands, in typical use). If needed, spatial indexing or selective redraw could be optimization areas.

### Backend Architecture (MediaWiki Integration)

The backend encompasses the PHP code that integrates with MediaWiki's databases, APIs, and hooks to provide the persistence and rendering for layers:

* **extension.json:** Declares the extension and integrates with MW. It registers:

  * Hooks (like `SkinTemplateNavigation` to add the tab, `UnknownAction` to handle the page action, parser hooks, image transform hooks).
  * API modules `layerssave` and `layersinfo` for handling AJAX requests from the editor.
  * ResourceLoader modules for the front-end (ext.layers and ext.layers.editor) with their scripts and style files.
  * Permissions as discussed and messages (i18n).
  * Configuration variables as discussed.

* **Database Schema:** The extension adds a few tables to store layer data:

  * **`layer_sets`**: Core table. Each row represents a set of layers (annotations) for an image. Columns likely include an ID, the image (file) identifier (maybe filename or file\_id and the file’s SHA1), the JSON blob of all layer data (`ls_json_blob`), possibly a name for the layer set, timestamp, user who saved it, etc. There could be a version number or a flag for the current set. Since the extension might allow saving multiple versions (to support history), this table can hold multiple entries per image. The `getLatestLayerSet(file)` function fetches the one marked latest (or highest id).
  * **`layer_assets`**: A table intended for reusable assets (like custom shapes or templates a user can save for reuse). Not fully fleshed out in current code – likely columns for asset name, data (perhaps JSON or SVG of the asset), user who created it, etc. The UI for it is planned (asset library panel) but not implemented yet.
  * **`layer_set_usage`**: Possibly to track usage of layer sets on pages. For example, if an image's specific layer set is embedded on a page, this table might record that relationship, maybe for cache invalidation or listing where annotations are used. The analysis said it's underutilized currently.
  * These tables are created via the schema update hook on install. They do not alter core MW tables, so it's self-contained.

* **Hooks Implementation:**

  * **UIHooks (SkinTemplateNavigation):** Adds the "Edit Layers" tab on file pages. It checks user perms and that the file exists. The tab links to `?action=editlayers` on the file.
  * **UIHooks (UnknownAction):** Catches the `action=editlayers` and replaces the normal page view with the editor interface. It verifies permission and target is a File page. Then calls `showLayersEditor()`.
  * **showLayersEditor():** Sets up the OutputPage for the editor – sets a page title like "Edit Layers: File.png", adds the required JS/CSS modules, injects the container HTML, and uses `mw.hook('layers.editor.init').fire({...})` passing the needed data (filename, image URL, container element) to initialize the JS app. It then calls `$out->setArticleBodyOnly(true)` to render just the editor (suppressing the normal skin content).
  * **Parser hook (ParserMakeImageParams):** Intercepts the file tag parsing. If `layers` param is present, it calls either `addLatestLayersToImage` or `addSpecificLayersToImage` to attach the data needed for rendering the layers onto the image output. Essentially, it stuffs the layer set data or an identifier into the image rendering pipeline by adding entries to `$params` (like `layerSetId` or raw `layerData`). This data travels with the File object into the transformation stage.
  * **FileTransform hook (onFileTransform):** This is triggered when generating a thumbnail or transformed image file. The extension checks if the 'layers' param was in effect. If yes, it calls `ThumbnailRenderer->generateLayeredThumbnail($file, $params)`. That method likely takes the base image and either:

    * If `layerData` is provided (the actual JSON of layers), uses an internal renderer (maybe using Imagick if available) to draw the vector shapes onto the image at the requested thumb size, saving the composite to a temp file. Returns the path of that composite.
    * If just a `layerSetId` is provided, it may fetch the JSON from DB then do the above.
    * If it fails or times out, it might log an error and return null. The hook then does nothing, meaning MW will just use the base image.
    * If it succeeds and returns a path, the hook adds that path to \$params (`$params['layered_thumbnail_path']`). MediaWiki then will use that path as the thumbnail image.
  * **ThumbnailBeforeProduceHTML hook:** In the current code, since server rendering might not be fully done, they use another hook to at least mark images that have layers. `onThumbnailBeforeProduceHTML` adds a CSS class and data attributes to the `<img>` HTML if `layerSetId` or `layerData` is present. This implies a client-side script (ext.layers module) could pick up and overlay the vector via the DOM. The ext.layers script likely looks for `img.layers-thumbnail` and, if found, fetches the data (either via data attributes or separate API) to draw an overlay canvas on the page. That is a fallback method to ensure layers show up even if not composited on server. The goal is to move away from this toward pure server composite in final version.

* **API Modules:**

  * **ApiLayersInfo (action=layersinfo):** This is called by the editor when it loads, to get the existing layers data for an image. The API likely takes parameters like file name (and maybe revision ID if needed) and returns the JSON blob along with maybe metadata. It uses LayersDatabase to get the latest layer set or specific one. If none exists, it may return an empty set indicating no annotations yet.
  * **ApiLayersSave (action=layerssave):** Called when the user hits "Save" in the editor. It receives the full JSON of the layer set (likely via POST, given it can be large). It then:

    * Validates the data (size against \$wgLayersMaxBytes, scans for any disallowed content).
    * Possibly sanitizes the input (ensuring no malicious SVG content or scripts can slip through via layer names or text etc.).
    * Saves it to the database: likely inserts a new row in `layer_sets` with a new ID, marks it as current. Or it might update an existing row if they decided to not keep history (but design suggests keeping history).
    * Returns a success or error. On success, it might return the new layer set ID or a revision number.
  * These APIs enforce permissions (user must have editlayers, etc.) and a CSRF token (as they are write actions). The code also likely prevents too rapid saving (maybe rate limiting in Hooks or in ApiLayersSave to avoid spam).

* **LayersDatabase class:** A PHP helper that wraps database operations. It has methods like `getLayerSetsForImage($filename, $fileSha1)` to get all sets (for possibly listing), `getLatestLayerSet($filename, $sha1)`, `saveLayerSet(...)` to insert a new set, `deleteLayerSetsForImage($filename, $sha1)` to remove all data when a file is deleted, etc. Using a dedicated class abstracts direct SQL and helps maintain consistency.

* **Security Considerations:** The backend is built with security in mind:

  * All API calls require proper edit token (preventing CSRF).
  * Input JSON is validated. The sanitization routine ensures no harmful content. For example, no `<script>` tags or event attributes in any saved SVG markup. If the extension stores just structured JSON (not raw SVG), that reduces risk; on rendering, it constructs SVG/Canvas output itself, so it can ensure only safe elements/attributes are used.
  * There might be checks on image type (only allow certain types to have layers, e.g. JPEG, PNG, not on non-visual media).
  * Rate limiting: Perhaps saving layers has a throttle (like can't save more than X times per minute per user) to avoid abuse.
  * Permission checks as described.

* **File Versioning:** If a new version of the file is uploaded, how do layers behave? The extension associates layer sets with a specific file revision (likely using the file’s SHA1 as part of key). This means if the file image changes, the old annotations might not automatically apply (since coordinates might not match if image dimensions differ). Possibly the extension treats each file version separately – you might have to create new layers for the new version. This is a design choice: It's simpler to tie to file revision to avoid misalignment. If a file is updated, previous annotation sets remain in DB keyed by old SHA1. They could be surfaced if someone views that old version. On the current version, you start fresh or copy. The UI might warn or offer to import from old if dimensions match. But not in scope now.

  * When a file is deleted, the extension cleans up all associated layer sets for all its revisions from DB.

* **Asset Library:** The mention of `managelayerlibrary` and `layer_assets` table suggests future capability where some shapes or groups can be saved globally and reused. For example, a predefined arrow style or icon that you can drag into any image. This would involve UI to browse assets (like a side panel), and API to load/save those. It's not fully implemented yet (marked medium priority in TODO). This doesn't affect core image annotation flows but is a nice extension for productivity.

### Data Flow Summary

Putting it all together, a typical user interaction flows like this:

1. **Launch Editor:** User clicks "Edit Layers" on a File page. The request goes to `index.php?title=File:Example.jpg&action=editlayers`. MediaWiki calls our UnknownAction hook, which initializes the editor page. The browser loads the HTML with the container and the JS modules.
2. **Load Existing Data:** The JS (LayersEditor) fires and calls the API `action=layersinfo&file=Example.jpg`. The PHP returns the JSON of the latest layer set for that image (or an empty structure if none). The editor then populates the internal state (if any).
3. **Editing Session:** The user draws, edits, adds layers. All changes are happening client-side, updating the JS model and re-rendering canvas. The extension might not continuously save (no mention of autosave) – it's manual save. Undo/redo is handled in JS by keeping history of states up to maybe 50 steps by default.
4. **Save:** When the user clicks "Save", the editor gathers the entire layer set data structure. This is serialized to JSON (if not already in JSON form) and sent via `action=layerssave` POST. The server receives it, validates length and content, then writes it to `layer_sets` table (new row) and perhaps marks it as current. The API responds success.

   * If the save fails (too large or DB error), an error is shown (the UI should handle error messages from the API).
5. **Return to Page:** After saving, the user typically is redirected back to viewing the File page (or it could reload with `action=purge` to show updated thumb). The extension might include logic to purge the file page or update the thumbnail. Possibly it uses a null edit or invalidation to ensure the wiki regenerates the thumbnail with layers if `layers=all` images were used somewhere. (MediaWiki’s File page might itself show a preview of the image with all layers if we want – though currently the File page probably still just shows the base image until you use layers param, but maybe an enhancement is to show an “annotated preview”).
6. **Viewing Annotated Image:** On articles or file pages where `[[File:Example.jpg|...|layers=...]]` is present, when that page is rendered, the parser and image hooks collaborate to display the composite. For example, if `layers=all`, after the save, now `getLatestLayerSet` returns the new data, and the next page view will either use server-composited thumb or client overlay to show the updated annotations.

Throughout, the system tries to **minimize impact on users not using the feature**. If `$wgLayersEnable` is false, nothing extra happens. If images have no layers, the presence of the extension shouldn't affect normal file rendering at all (the hooks check and do nothing if no layers param is used).

### Design Considerations and Future Work

**Scalability:** By storing each image's annotations as one JSON blob, the extension opts for simplicity over extreme granularity. This is efficient for moderately sized data, but if someone drew thousands of objects, that JSON could become large (hence \$wgLayersMaxBytes to cap it). In the future, chunking or tiling might be considered for huge sets, but for now this approach is fine. The stateless nature (each save writes a new blob) means you don't have to migrate complex relational data for each shape, and versioning is easy (just keep old blobs). The trade-off is you can't query or reuse individual shapes on the backend easily – but that’s not needed for current features.

**Refactoring:** The analysis identified the front-end code as an area to modernize. Plans include modularizing CanvasManager, adopting a structured state store (possibly a framework or a simpler pattern), and using ES6 classes/modules rather than one big jQuery script. This will make maintaining and extending the editor easier. For example, adding a new tool could become as simple as creating a Tool class with certain interface methods (draw, onMouseDown, etc.) and plugging it in – rather than editing a huge switch-case in CanvasManager.

**Testing:** The extension would benefit from automated tests. End-to-end tests (using something like Cypress) could automatically open the editor, simulate drawing actions, and verify that the data saved matches expectation. Unit tests on the API and data validation will ensure no regression in security. These are noted as high priority in development tasks.

**Multi-user or Collaboration:** Not explicitly covered, but an interesting challenge: if two users open layer editor on the same image concurrently, last save wins and overwrites the other. There's no locking or merging currently. In the future, some locking or at least warning (like when editing a wiki page concurrently) might be needed. Possibly treat the layer set akin to a wiki page content model in the future to leverage MW's edit conflict resolution. For now, the risk of conflict is probably low.

**Integration with VisualEditor or File Pages:** Perhaps one could initiate layer editing from within VisualEditor if an image is selected. That would require a VE plugin to launch the interface in a modal. Not currently in scope, but something to consider for a seamless user experience.

**Licensing and Export:** Since it's vector data, one might allow exporting the annotations as an external SVG or JSON for use outside the wiki. An export function was noted in TODO. This could be a button "Export Layers" that gives a .json or .svg file download. Similarly import could allow uploading a .json to apply to an image (if someone prepared annotations offline or to copy between images).

**Conclusion:** The Layers extension aims to bring an entire graphic editing environment into MediaWiki. It follows a layered, non-destructive approach familiar to designers, ensuring that wikis can have rich annotated visuals without losing original data. From the developer perspective, it combines web tech (Canvas, JS) with MediaWiki’s extensibility (hooks, API) in a clean way. By adhering to this specification, developers can implement features in a consistent, maintainable manner, ultimately delivering a robust tool to end-users.
