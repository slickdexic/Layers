## Modules

<dl>
<dt><a href="#module_EventTracker">EventTracker</a></dt>
<dd><p>EventTracker - Utility for tracking and cleaning up event listeners</p>
<p>This utility helps prevent memory leaks by ensuring all event listeners
are properly tracked and can be removed during cleanup.</p>
<p>Usage:
  const tracker = new EventTracker();
  tracker.add( element, &#39;click&#39;, handler );
  tracker.add( window, &#39;resize&#39;, resizeHandler );
  // Later, clean up all listeners:
  tracker.destroy();</p>
</dd>
<dt><a href="#module_GeometryUtils">GeometryUtils</a></dt>
<dd><p>GeometryUtils.js - Coordinate transformation and geometric utility functions</p>
<p>Extracted from CanvasManager.js as proof-of-concept for modular refactoring.
This module handles coordinate conversions, hit testing, and geometric calculations.</p>
<p>Part of the MediaWiki Layers extension modularization effort.
See CANVAS_MANAGER_REFACTOR_PLAN.md for the complete refactoring strategy.</p>
</dd>
<dt><a href="#module_MessageHelper">MessageHelper</a></dt>
<dd><p>MessageHelper - Centralized i18n message handling for the Layers extension</p>
<p>Provides a consistent interface for retrieving localized messages from MediaWiki&#39;s
message system with proper fallback handling.</p>
<p>Usage:
  const msg = window.LayersMessageHelper.get( &#39;layers-save-success&#39;, &#39;Saved!&#39; );
  // Or via singleton:
  const helper = window.layersMessages;
  helper.get( &#39;layers-tool-select&#39; );</p>
</dd>
<dt><a href="#module_TextUtils">TextUtils</a></dt>
<dd><p>TextUtils.js - Text measurement and sanitization utilities</p>
<p>Provides shared text handling functions used by CanvasManager and CanvasRenderer.
Consolidates duplicate implementations to ensure consistent behavior.</p>
<p>Part of the MediaWiki Layers extension modularization effort.</p>
</dd>
<dt><a href="#module_ToolbarStyleControls">ToolbarStyleControls</a></dt>
<dd><p>ToolbarStyleControls - Manages style controls UI for Layers Editor Toolbar
Handles stroke/fill colors, stroke width, font size, text effects, and arrow styles</p>
<p>Delegates to:</p>
<ul>
<li>ColorControlFactory: Color picker button creation</li>
<li>PresetStyleManager: Style preset dropdown and application</li>
</ul>
</dd>
<dt><a href="#module_ArrowRenderer">ArrowRenderer</a></dt>
<dd><p>ArrowRenderer - Specialized arrow shape rendering</p>
<p>Extracted from LayerRenderer.js to reduce file size and improve maintainability.
This module handles all arrow-related rendering including:</p>
<ul>
<li>Arrow vertex calculation (single, double, no head)</li>
<li>Arrow head types (pointed, chevron, standard)</li>
<li>Shadow rendering with spread support</li>
</ul>
</dd>
<dt><a href="#module_BoundsCalculator">BoundsCalculator</a></dt>
<dd><p>BoundsCalculator - Utility for calculating layer bounds</p>
<p>Provides centralized bounds calculation for all layer types.
Extracted from SelectionManager.getLayerBoundsCompat() to reduce code duplication
and provide a reusable utility.</p>
</dd>
<dt><a href="#module_DeepClone">DeepClone</a></dt>
<dd><p>DeepClone - Utility for deep cloning objects safely</p>
<p>Uses structuredClone when available (modern browsers), with fallback
to JSON.parse(JSON.stringify()) for older environments.</p>
<p>Benefits over JSON.parse(JSON.stringify()):</p>
<ul>
<li>Handles circular references (structuredClone)</li>
<li>Preserves undefined values in some cases</li>
<li>Better performance in modern browsers</li>
<li>Cleaner, more semantic API</li>
</ul>
</dd>
<dt><a href="#module_EffectsRenderer">EffectsRenderer</a></dt>
<dd><p>EffectsRenderer - Handles special effect layers (blur)</p>
<p>This module provides rendering for effect-type layers that apply
visual modifications to image regions rather than drawing shapes.</p>
<p>Extracted from LayerRenderer to separate concerns and reduce god class size.</p>
</dd>
<dt><a href="#module_LayerDataNormalizer">LayerDataNormalizer</a></dt>
<dd><p>LayerDataNormalizer - Shared utility for normalizing layer data</p>
<p>This module ensures consistent data types across the editor and viewer.
It handles the conversion of string/numeric representations of boolean
values to actual JavaScript booleans, which is critical for correct
rendering of boolean-dependent features like shadows and visibility.</p>
<p>Why this exists:</p>
<ul>
<li>JSON data from the server may have string representations (&quot;true&quot;, &quot;1&quot;)</li>
<li>Database storage or legacy data may use numeric values (1, 0)</li>
<li>Canvas rendering code uses strict equality checks (=== true)</li>
<li>Without normalization, features like text shadows fail to render</li>
</ul>
</dd>
<dt><a href="#module_LayerRenderer">LayerRenderer</a></dt>
<dd><p>LayerRenderer - Shared rendering engine for Layers extension</p>
<p>This module provides a unified rendering implementation used by both:</p>
<ul>
<li>LayersViewer (read-only article display)</li>
<li>CanvasRenderer/ShapeRenderer (editor)</li>
</ul>
<p>By centralizing rendering logic here, we ensure:</p>
<ol>
<li>Visual consistency between viewer and editor</li>
<li>Single source of truth for bug fixes</li>
<li>Reduced code duplication (~1,000 lines eliminated)</li>
</ol>
<p>Shadow rendering is delegated to ShadowRenderer for clean separation of concerns.</p>
</dd>
<dt><a href="#module_PolygonStarRenderer">PolygonStarRenderer</a></dt>
<dd><p>PolygonStarRenderer - Specialized polygon and star shape rendering</p>
<p>Extracted from ShapeRenderer.js to reduce file size and improve maintainability.
This module handles rendering of complex polygon shapes:</p>
<ul>
<li>Polygon (regular n-gons with optional rounded corners)</li>
<li>Star (with customizable points and valley radii)</li>
</ul>
<p>All shapes support:</p>
<ul>
<li>Fill and stroke with separate opacities</li>
<li>Shadow rendering with spread support</li>
<li>Rotation</li>
<li>Scaling</li>
<li>Rounded corners (via PolygonGeometry)</li>
</ul>
</dd>
<dt><a href="#module_ShadowRenderer">ShadowRenderer</a></dt>
<dd><p>ShadowRenderer - Shadow rendering engine for Layers extension</p>
<p>Extracted from LayerRenderer to handle all shadow-related rendering logic:</p>
<ul>
<li>Standard canvas shadows</li>
<li>Shadow spread via offscreen canvas technique</li>
<li>Rotation-aware shadow rendering</li>
</ul>
<p>This module is used by LayerRenderer for consistent shadow handling across
all shape types.</p>
</dd>
<dt><a href="#module_ShapeRenderer">ShapeRenderer</a></dt>
<dd><p>ShapeRenderer - Specialized basic shape rendering</p>
<p>Extracted from LayerRenderer.js to reduce file size and improve maintainability.
This module handles rendering of basic geometric shapes:</p>
<ul>
<li>Rectangle (with rounded corners)</li>
<li>Circle</li>
<li>Ellipse</li>
<li>Polygon (regular n-gons)</li>
<li>Star</li>
</ul>
<p>All shapes support:</p>
<ul>
<li>Fill and stroke with separate opacities</li>
<li>Shadow rendering with spread support</li>
<li>Rotation</li>
<li>Scaling</li>
</ul>
</dd>
<dt><a href="#module_TextBoxRenderer">TextBoxRenderer</a></dt>
<dd><p>TextBoxRenderer - Specialized text box rendering</p>
<p>Extracted from ShapeRenderer.js to reduce file size and improve maintainability.
This module handles rendering of text box shapes:</p>
<ul>
<li>Rectangle container with rounded corners</li>
<li>Multi-line text with word wrapping</li>
<li>Text alignment (horizontal and vertical)</li>
<li>Text stroke and shadow effects</li>
</ul>
</dd>
<dt><a href="#module_TextRenderer">TextRenderer</a></dt>
<dd><p>TextRenderer - Specialized text shape rendering</p>
<p>Extracted from LayerRenderer.js to reduce file size and improve maintainability.
This module handles all text-related rendering including:</p>
<ul>
<li>Font sizing and family</li>
<li>Text alignment</li>
<li>Text stroke (outline)</li>
<li>Shadow rendering with spread support</li>
<li>Rotation around text center</li>
</ul>
</dd>
</dl>

## Classes

<dl>
<dt><a href="#AccessibilityAnnouncer">AccessibilityAnnouncer</a></dt>
<dd></dd>
<dt><a href="#AccessibilityAnnouncer">AccessibilityAnnouncer</a></dt>
<dd><p>AccessibilityAnnouncer class</p>
</dd>
<dt><a href="#APIErrorHandler">APIErrorHandler</a></dt>
<dd></dd>
<dt><a href="#CanvasEvents">CanvasEvents</a></dt>
<dd></dd>
<dt><a href="#CanvasEvents">CanvasEvents</a></dt>
<dd></dd>
<dt><a href="#CanvasManager">CanvasManager</a></dt>
<dd><p>CanvasManager class</p>
</dd>
<dt><a href="#CanvasRenderer">CanvasRenderer</a></dt>
<dd></dd>
<dt><a href="#CanvasRenderer">CanvasRenderer</a></dt>
<dd></dd>
<dt><a href="#CanvasUtilities">CanvasUtilities</a></dt>
<dd></dd>
<dt><a href="#CanvasUtilities">CanvasUtilities</a></dt>
<dd><p>CanvasUtilities - Collection of pure static utility functions</p>
</dd>
<dt><a href="#ErrorHandler">ErrorHandler</a></dt>
<dd><p>ErrorHandler class for centralized error management</p>
</dd>
<dt><a href="#EventManager">EventManager</a></dt>
<dd><p>Event Manager for Layers Editor
Centralized event handling and management</p>
</dd>
<dt><a href="#HistoryManager">HistoryManager</a></dt>
<dd><p>HistoryManager class</p>
</dd>
<dt><a href="#ImageLoader">ImageLoader</a></dt>
<dd></dd>
<dt><a href="#ImageLoader">ImageLoader</a></dt>
<dd><p>ImageLoader class - handles background image loading with fallbacks</p>
</dd>
<dt><a href="#ImportExportManager">ImportExportManager</a></dt>
<dd></dd>
<dt><a href="#ImportExportManager">ImportExportManager</a></dt>
<dd><p>ImportExportManager class</p>
<p>Handles import/export of layer data as JSON files.</p>
</dd>
<dt><a href="#LayerPanel">LayerPanel</a></dt>
<dd><p>LayerPanel class
Manages the layer list, visibility, ordering, and layer properties</p>
</dd>
<dt><a href="#LayersEditor">LayersEditor</a></dt>
<dd><p>LayersEditor class - Main editor for MediaWiki Layers extension</p>
</dd>
<dt><a href="#LayerSetManager">LayerSetManager</a></dt>
<dd></dd>
<dt><a href="#LayerSetManager">LayerSetManager</a></dt>
<dd><p>LayerSetManager class</p>
</dd>
<dt><a href="#LayersValidator">LayersValidator</a></dt>
<dd></dd>
<dt><a href="#LayersValidator">LayersValidator</a></dt>
<dd><p>LayersValidator class
Provides validation methods and user feedback for layer data</p>
</dd>
<dt><a href="#SelectionManager">SelectionManager</a></dt>
<dd><p>SelectionManager class
Manages layer selection, manipulation, and transformation operations</p>
</dd>
<dt><a href="#StateManager">StateManager</a></dt>
<dd><p>State Manager for Layers Editor
Centralized state management with race condition prevention</p>
</dd>
<dt><a href="#StyleController">StyleController</a></dt>
<dd></dd>
<dt><a href="#StyleController">StyleController</a></dt>
<dd><p>StyleController class - manages editor style state</p>
</dd>
<dt><a href="#Toolbar">Toolbar</a></dt>
<dd></dd>
<dt><a href="#Toolbar">Toolbar</a></dt>
<dd></dd>
<dt><a href="#ToolbarKeyboard">ToolbarKeyboard</a></dt>
<dd><p>ToolbarKeyboard - Manages keyboard shortcuts for the toolbar</p>
</dd>
<dt><a href="#ToolManager">ToolManager</a></dt>
<dd><p>ToolManager class</p>
</dd>
<dt><a href="#TransformationEngine">TransformationEngine</a></dt>
<dd><p>TransformationEngine - Manages canvas transformations and viewport</p>
</dd>
<dt><a href="#ValidationManager">ValidationManager</a></dt>
<dd><p>Validation Manager for Layers Editor
Handles data validation and sanitization</p>
</dd>
<dt><a href="#PolygonGeometry">PolygonGeometry</a></dt>
<dd><p>Static utility class for polygon and star geometry calculations</p>
</dd>
</dl>

## Typedefs

<dl>
<dt><a href="#CanvasManager">CanvasManager</a> : <code>Object</code></dt>
<dd><p>Minimal typedef for CanvasManager used for JSDoc references in this file.</p>
</dd>
<dt><a href="#CanvasManager">CanvasManager</a> : <code>Object</code></dt>
<dd><p>Minimal typedef for CanvasManager used for JSDoc references in this file.</p>
</dd>
<dt><a href="#CanvasManager">CanvasManager</a> : <code>Object</code></dt>
<dd><p>Minimal typedef for CanvasManager used for JSDoc references in this file.</p>
</dd>
</dl>

<a name="module_EventTracker"></a>

## EventTracker
EventTracker - Utility for tracking and cleaning up event listenersThis utility helps prevent memory leaks by ensuring all event listenersare properly tracked and can be removed during cleanup.Usage:  const tracker = new EventTracker();  tracker.add( element, 'click', handler );  tracker.add( window, 'resize', resizeHandler );  // Later, clean up all listeners:  tracker.destroy();


* [EventTracker](#module_EventTracker)
    * [~EventTracker](#module_EventTracker..EventTracker)
        * [new EventTracker()](#new_module_EventTracker..EventTracker_new)
        * [new EventTracker([options])](#new_module_EventTracker..EventTracker_new)
        * [.add(element, type, handler, [options])](#module_EventTracker..EventTracker+add) ⇒ <code>Object</code> \| <code>null</code>
        * [.remove(entry)](#module_EventTracker..EventTracker+remove) ⇒ <code>boolean</code>
        * [.removeAllForElement(element)](#module_EventTracker..EventTracker+removeAllForElement) ⇒ <code>number</code>
        * [.removeAllOfType(type)](#module_EventTracker..EventTracker+removeAllOfType) ⇒ <code>number</code>
        * [.count()](#module_EventTracker..EventTracker+count) ⇒ <code>number</code>
        * [.hasListeners()](#module_EventTracker..EventTracker+hasListeners) ⇒ <code>boolean</code>
        * [.destroy()](#module_EventTracker..EventTracker+destroy)
    * [~EventTracker](#module_EventTracker..EventTracker)
        * [new EventTracker()](#new_module_EventTracker..EventTracker_new)
        * [new EventTracker([options])](#new_module_EventTracker..EventTracker_new)
        * [.add(element, type, handler, [options])](#module_EventTracker..EventTracker+add) ⇒ <code>Object</code> \| <code>null</code>
        * [.remove(entry)](#module_EventTracker..EventTracker+remove) ⇒ <code>boolean</code>
        * [.removeAllForElement(element)](#module_EventTracker..EventTracker+removeAllForElement) ⇒ <code>number</code>
        * [.removeAllOfType(type)](#module_EventTracker..EventTracker+removeAllOfType) ⇒ <code>number</code>
        * [.count()](#module_EventTracker..EventTracker+count) ⇒ <code>number</code>
        * [.hasListeners()](#module_EventTracker..EventTracker+hasListeners) ⇒ <code>boolean</code>
        * [.destroy()](#module_EventTracker..EventTracker+destroy)

<a name="module_EventTracker..EventTracker"></a>

### EventTracker~EventTracker
**Kind**: inner class of [<code>EventTracker</code>](#module_EventTracker)  

* [~EventTracker](#module_EventTracker..EventTracker)
    * [new EventTracker()](#new_module_EventTracker..EventTracker_new)
    * [new EventTracker([options])](#new_module_EventTracker..EventTracker_new)
    * [.add(element, type, handler, [options])](#module_EventTracker..EventTracker+add) ⇒ <code>Object</code> \| <code>null</code>
    * [.remove(entry)](#module_EventTracker..EventTracker+remove) ⇒ <code>boolean</code>
    * [.removeAllForElement(element)](#module_EventTracker..EventTracker+removeAllForElement) ⇒ <code>number</code>
    * [.removeAllOfType(type)](#module_EventTracker..EventTracker+removeAllOfType) ⇒ <code>number</code>
    * [.count()](#module_EventTracker..EventTracker+count) ⇒ <code>number</code>
    * [.hasListeners()](#module_EventTracker..EventTracker+hasListeners) ⇒ <code>boolean</code>
    * [.destroy()](#module_EventTracker..EventTracker+destroy)

<a name="new_module_EventTracker..EventTracker_new"></a>

#### new EventTracker()
EventTracker class for managing event listener lifecycle

<a name="new_module_EventTracker..EventTracker_new"></a>

#### new EventTracker([options])
Create a new EventTracker instance


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [options] | <code>Object</code> |  | Configuration options |
| [options.debug] | <code>boolean</code> | <code>false</code> | Enable debug logging |

<a name="module_EventTracker..EventTracker+add"></a>

#### eventTracker.add(element, type, handler, [options]) ⇒ <code>Object</code> \| <code>null</code>
Add an event listener and track it for later cleanup

**Kind**: instance method of [<code>EventTracker</code>](#module_EventTracker..EventTracker)  
**Returns**: <code>Object</code> \| <code>null</code> - Reference to the listener entry for manual removal  

| Param | Type | Description |
| --- | --- | --- |
| element | <code>EventTarget</code> | The element to attach the listener to |
| type | <code>string</code> | The event type (e.g., 'click', 'mousedown') |
| handler | <code>function</code> | The event handler function |
| [options] | <code>Object</code> \| <code>boolean</code> | Event listener options (passive, capture, etc.) |

<a name="module_EventTracker..EventTracker+remove"></a>

#### eventTracker.remove(entry) ⇒ <code>boolean</code>
Remove a specific tracked listener

**Kind**: instance method of [<code>EventTracker</code>](#module_EventTracker..EventTracker)  
**Returns**: <code>boolean</code> - True if the listener was found and removed  

| Param | Type | Description |
| --- | --- | --- |
| entry | <code>Object</code> | The listener entry returned by add() |

<a name="module_EventTracker..EventTracker+removeAllForElement"></a>

#### eventTracker.removeAllForElement(element) ⇒ <code>number</code>
Remove all listeners for a specific element

**Kind**: instance method of [<code>EventTracker</code>](#module_EventTracker..EventTracker)  
**Returns**: <code>number</code> - Number of listeners removed  

| Param | Type | Description |
| --- | --- | --- |
| element | <code>EventTarget</code> | The element to remove listeners from |

<a name="module_EventTracker..EventTracker+removeAllOfType"></a>

#### eventTracker.removeAllOfType(type) ⇒ <code>number</code>
Remove all listeners of a specific type

**Kind**: instance method of [<code>EventTracker</code>](#module_EventTracker..EventTracker)  
**Returns**: <code>number</code> - Number of listeners removed  

| Param | Type | Description |
| --- | --- | --- |
| type | <code>string</code> | The event type to remove |

<a name="module_EventTracker..EventTracker+count"></a>

#### eventTracker.count() ⇒ <code>number</code>
Get the count of tracked listeners

**Kind**: instance method of [<code>EventTracker</code>](#module_EventTracker..EventTracker)  
**Returns**: <code>number</code> - Number of active tracked listeners  
<a name="module_EventTracker..EventTracker+hasListeners"></a>

#### eventTracker.hasListeners() ⇒ <code>boolean</code>
Check if there are any tracked listeners

**Kind**: instance method of [<code>EventTracker</code>](#module_EventTracker..EventTracker)  
**Returns**: <code>boolean</code> - True if there are tracked listeners  
<a name="module_EventTracker..EventTracker+destroy"></a>

#### eventTracker.destroy()
Destroy all tracked listeners and clean upAfter calling destroy(), this tracker should not be used

**Kind**: instance method of [<code>EventTracker</code>](#module_EventTracker..EventTracker)  
<a name="module_EventTracker..EventTracker"></a>

### EventTracker~EventTracker
**Kind**: inner class of [<code>EventTracker</code>](#module_EventTracker)  

* [~EventTracker](#module_EventTracker..EventTracker)
    * [new EventTracker()](#new_module_EventTracker..EventTracker_new)
    * [new EventTracker([options])](#new_module_EventTracker..EventTracker_new)
    * [.add(element, type, handler, [options])](#module_EventTracker..EventTracker+add) ⇒ <code>Object</code> \| <code>null</code>
    * [.remove(entry)](#module_EventTracker..EventTracker+remove) ⇒ <code>boolean</code>
    * [.removeAllForElement(element)](#module_EventTracker..EventTracker+removeAllForElement) ⇒ <code>number</code>
    * [.removeAllOfType(type)](#module_EventTracker..EventTracker+removeAllOfType) ⇒ <code>number</code>
    * [.count()](#module_EventTracker..EventTracker+count) ⇒ <code>number</code>
    * [.hasListeners()](#module_EventTracker..EventTracker+hasListeners) ⇒ <code>boolean</code>
    * [.destroy()](#module_EventTracker..EventTracker+destroy)

<a name="new_module_EventTracker..EventTracker_new"></a>

#### new EventTracker()
EventTracker class for managing event listener lifecycle

<a name="new_module_EventTracker..EventTracker_new"></a>

#### new EventTracker([options])
Create a new EventTracker instance


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [options] | <code>Object</code> |  | Configuration options |
| [options.debug] | <code>boolean</code> | <code>false</code> | Enable debug logging |

<a name="module_EventTracker..EventTracker+add"></a>

#### eventTracker.add(element, type, handler, [options]) ⇒ <code>Object</code> \| <code>null</code>
Add an event listener and track it for later cleanup

**Kind**: instance method of [<code>EventTracker</code>](#module_EventTracker..EventTracker)  
**Returns**: <code>Object</code> \| <code>null</code> - Reference to the listener entry for manual removal  

| Param | Type | Description |
| --- | --- | --- |
| element | <code>EventTarget</code> | The element to attach the listener to |
| type | <code>string</code> | The event type (e.g., 'click', 'mousedown') |
| handler | <code>function</code> | The event handler function |
| [options] | <code>Object</code> \| <code>boolean</code> | Event listener options (passive, capture, etc.) |

<a name="module_EventTracker..EventTracker+remove"></a>

#### eventTracker.remove(entry) ⇒ <code>boolean</code>
Remove a specific tracked listener

**Kind**: instance method of [<code>EventTracker</code>](#module_EventTracker..EventTracker)  
**Returns**: <code>boolean</code> - True if the listener was found and removed  

| Param | Type | Description |
| --- | --- | --- |
| entry | <code>Object</code> | The listener entry returned by add() |

<a name="module_EventTracker..EventTracker+removeAllForElement"></a>

#### eventTracker.removeAllForElement(element) ⇒ <code>number</code>
Remove all listeners for a specific element

**Kind**: instance method of [<code>EventTracker</code>](#module_EventTracker..EventTracker)  
**Returns**: <code>number</code> - Number of listeners removed  

| Param | Type | Description |
| --- | --- | --- |
| element | <code>EventTarget</code> | The element to remove listeners from |

<a name="module_EventTracker..EventTracker+removeAllOfType"></a>

#### eventTracker.removeAllOfType(type) ⇒ <code>number</code>
Remove all listeners of a specific type

**Kind**: instance method of [<code>EventTracker</code>](#module_EventTracker..EventTracker)  
**Returns**: <code>number</code> - Number of listeners removed  

| Param | Type | Description |
| --- | --- | --- |
| type | <code>string</code> | The event type to remove |

<a name="module_EventTracker..EventTracker+count"></a>

#### eventTracker.count() ⇒ <code>number</code>
Get the count of tracked listeners

**Kind**: instance method of [<code>EventTracker</code>](#module_EventTracker..EventTracker)  
**Returns**: <code>number</code> - Number of active tracked listeners  
<a name="module_EventTracker..EventTracker+hasListeners"></a>

#### eventTracker.hasListeners() ⇒ <code>boolean</code>
Check if there are any tracked listeners

**Kind**: instance method of [<code>EventTracker</code>](#module_EventTracker..EventTracker)  
**Returns**: <code>boolean</code> - True if there are tracked listeners  
<a name="module_EventTracker..EventTracker+destroy"></a>

#### eventTracker.destroy()
Destroy all tracked listeners and clean upAfter calling destroy(), this tracker should not be used

**Kind**: instance method of [<code>EventTracker</code>](#module_EventTracker..EventTracker)  
<a name="module_GeometryUtils"></a>

## GeometryUtils
GeometryUtils.js - Coordinate transformation and geometric utility functionsExtracted from CanvasManager.js as proof-of-concept for modular refactoring.This module handles coordinate conversions, hit testing, and geometric calculations.Part of the MediaWiki Layers extension modularization effort.See CANVAS_MANAGER_REFACTOR_PLAN.md for the complete refactoring strategy.


* [GeometryUtils](#module_GeometryUtils)
    * [~GeometryUtils](#module_GeometryUtils..GeometryUtils)
        * [new GeometryUtils()](#new_module_GeometryUtils..GeometryUtils_new)
        * [.clientToCanvas(canvas, clientX, clientY, [options])](#module_GeometryUtils..GeometryUtils.clientToCanvas) ⇒ <code>Object</code>
        * [.clientToRawCanvas(canvas, clientX, clientY, panX, panY, zoom)](#module_GeometryUtils..GeometryUtils.clientToRawCanvas) ⇒ <code>Object</code>
        * [.isPointInRect(point, rect)](#module_GeometryUtils..GeometryUtils.isPointInRect) ⇒ <code>boolean</code>
        * [.isPointNearLine(point, x1, y1, x2, y2, [tolerance])](#module_GeometryUtils..GeometryUtils.isPointNearLine) ⇒ <code>boolean</code>
        * [.pointToSegmentDistance(px, py, x1, y1, x2, y2)](#module_GeometryUtils..GeometryUtils.pointToSegmentDistance) ⇒ <code>number</code>
        * [.isPointInPolygon(point, polygonPoints)](#module_GeometryUtils..GeometryUtils.isPointInPolygon) ⇒ <code>boolean</code>
        * [.distance(point1, point2)](#module_GeometryUtils..GeometryUtils.distance) ⇒ <code>number</code>
        * [.getBoundingBox(points)](#module_GeometryUtils..GeometryUtils.getBoundingBox) ⇒ <code>Object</code> \| <code>null</code>
        * [.clamp(value, min, max)](#module_GeometryUtils..GeometryUtils.clamp) ⇒ <code>number</code>
        * [.degToRad(degrees)](#module_GeometryUtils..GeometryUtils.degToRad) ⇒ <code>number</code>
        * [.radToDeg(radians)](#module_GeometryUtils..GeometryUtils.radToDeg) ⇒ <code>number</code>
        * [.getLayerBoundsForType(layer)](#module_GeometryUtils..GeometryUtils.getLayerBoundsForType) ⇒ <code>Object</code> \| <code>null</code>
        * [.computeAxisAlignedBounds(rect, rotationDegrees)](#module_GeometryUtils..GeometryUtils.computeAxisAlignedBounds) ⇒ <code>Object</code>

<a name="module_GeometryUtils..GeometryUtils"></a>

### GeometryUtils~GeometryUtils
**Kind**: inner class of [<code>GeometryUtils</code>](#module_GeometryUtils)  

* [~GeometryUtils](#module_GeometryUtils..GeometryUtils)
    * [new GeometryUtils()](#new_module_GeometryUtils..GeometryUtils_new)
    * [.clientToCanvas(canvas, clientX, clientY, [options])](#module_GeometryUtils..GeometryUtils.clientToCanvas) ⇒ <code>Object</code>
    * [.clientToRawCanvas(canvas, clientX, clientY, panX, panY, zoom)](#module_GeometryUtils..GeometryUtils.clientToRawCanvas) ⇒ <code>Object</code>
    * [.isPointInRect(point, rect)](#module_GeometryUtils..GeometryUtils.isPointInRect) ⇒ <code>boolean</code>
    * [.isPointNearLine(point, x1, y1, x2, y2, [tolerance])](#module_GeometryUtils..GeometryUtils.isPointNearLine) ⇒ <code>boolean</code>
    * [.pointToSegmentDistance(px, py, x1, y1, x2, y2)](#module_GeometryUtils..GeometryUtils.pointToSegmentDistance) ⇒ <code>number</code>
    * [.isPointInPolygon(point, polygonPoints)](#module_GeometryUtils..GeometryUtils.isPointInPolygon) ⇒ <code>boolean</code>
    * [.distance(point1, point2)](#module_GeometryUtils..GeometryUtils.distance) ⇒ <code>number</code>
    * [.getBoundingBox(points)](#module_GeometryUtils..GeometryUtils.getBoundingBox) ⇒ <code>Object</code> \| <code>null</code>
    * [.clamp(value, min, max)](#module_GeometryUtils..GeometryUtils.clamp) ⇒ <code>number</code>
    * [.degToRad(degrees)](#module_GeometryUtils..GeometryUtils.degToRad) ⇒ <code>number</code>
    * [.radToDeg(radians)](#module_GeometryUtils..GeometryUtils.radToDeg) ⇒ <code>number</code>
    * [.getLayerBoundsForType(layer)](#module_GeometryUtils..GeometryUtils.getLayerBoundsForType) ⇒ <code>Object</code> \| <code>null</code>
    * [.computeAxisAlignedBounds(rect, rotationDegrees)](#module_GeometryUtils..GeometryUtils.computeAxisAlignedBounds) ⇒ <code>Object</code>

<a name="new_module_GeometryUtils..GeometryUtils_new"></a>

#### new GeometryUtils()
Static utility class for geometric calculations

<a name="module_GeometryUtils..GeometryUtils.clientToCanvas"></a>

#### GeometryUtils.clientToCanvas(canvas, clientX, clientY, [options]) ⇒ <code>Object</code>
Convert a DOM client coordinate to canvas coordinate, robust against CSS transforms.Uses element's bounding rect to derive the pixel ratio instead of manual pan/zoom math.

**Kind**: static method of [<code>GeometryUtils</code>](#module_GeometryUtils..GeometryUtils)  
**Returns**: <code>Object</code> - Canvas coordinates  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| canvas | <code>HTMLCanvasElement</code> |  | The canvas element |
| clientX | <code>number</code> |  | Client X coordinate |
| clientY | <code>number</code> |  | Client Y coordinate |
| [options] | <code>Object</code> | <code>{}</code> | Optional parameters |
| [options.snapToGrid] | <code>boolean</code> |  | Whether to snap to grid |
| [options.gridSize] | <code>number</code> |  | Grid size for snapping |

<a name="module_GeometryUtils..GeometryUtils.clientToRawCanvas"></a>

#### GeometryUtils.clientToRawCanvas(canvas, clientX, clientY, panX, panY, zoom) ⇒ <code>Object</code>
Raw coordinate mapping without snapping, useful for precise calculations

**Kind**: static method of [<code>GeometryUtils</code>](#module_GeometryUtils..GeometryUtils)  
**Returns**: <code>Object</code> - Raw canvas coordinates  

| Param | Type | Description |
| --- | --- | --- |
| canvas | <code>HTMLCanvasElement</code> | The canvas element |
| clientX | <code>number</code> | Client X coordinate |
| clientY | <code>number</code> | Client Y coordinate |
| panX | <code>number</code> | Current pan X offset |
| panY | <code>number</code> | Current pan Y offset |
| zoom | <code>number</code> | Current zoom level |

<a name="module_GeometryUtils..GeometryUtils.isPointInRect"></a>

#### GeometryUtils.isPointInRect(point, rect) ⇒ <code>boolean</code>
Test if a point is inside a rectangle

**Kind**: static method of [<code>GeometryUtils</code>](#module_GeometryUtils..GeometryUtils)  
**Returns**: <code>boolean</code> - True if point is inside rectangle  

| Param | Type | Description |
| --- | --- | --- |
| point | <code>Object</code> | The point to test |
| rect | <code>Object</code> | The rectangle |

<a name="module_GeometryUtils..GeometryUtils.isPointNearLine"></a>

#### GeometryUtils.isPointNearLine(point, x1, y1, x2, y2, [tolerance]) ⇒ <code>boolean</code>
Test if a point is near a line segment within tolerance

**Kind**: static method of [<code>GeometryUtils</code>](#module_GeometryUtils..GeometryUtils)  
**Returns**: <code>boolean</code> - True if point is near the line  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| point | <code>Object</code> |  | The point to test |
| x1 | <code>number</code> |  | Line start X |
| y1 | <code>number</code> |  | Line start Y |
| x2 | <code>number</code> |  | Line end X |
| y2 | <code>number</code> |  | Line end Y |
| [tolerance] | <code>number</code> | <code>6</code> | Distance tolerance |

<a name="module_GeometryUtils..GeometryUtils.pointToSegmentDistance"></a>

#### GeometryUtils.pointToSegmentDistance(px, py, x1, y1, x2, y2) ⇒ <code>number</code>
Calculate the shortest distance from a point to a line segment

**Kind**: static method of [<code>GeometryUtils</code>](#module_GeometryUtils..GeometryUtils)  
**Returns**: <code>number</code> - Distance from point to line segment  

| Param | Type | Description |
| --- | --- | --- |
| px | <code>number</code> | Point X coordinate |
| py | <code>number</code> | Point Y coordinate |
| x1 | <code>number</code> | Line start X |
| y1 | <code>number</code> | Line start Y |
| x2 | <code>number</code> | Line end X |
| y2 | <code>number</code> | Line end Y |

<a name="module_GeometryUtils..GeometryUtils.isPointInPolygon"></a>

#### GeometryUtils.isPointInPolygon(point, polygonPoints) ⇒ <code>boolean</code>
Test if a point is inside a polygon using ray casting algorithm

**Kind**: static method of [<code>GeometryUtils</code>](#module_GeometryUtils..GeometryUtils)  
**Returns**: <code>boolean</code> - True if point is inside polygon  

| Param | Type | Description |
| --- | --- | --- |
| point | <code>Object</code> | The point to test |
| polygonPoints | <code>Array.&lt;{x:number, y:number}&gt;</code> | Array of polygon vertices |

<a name="module_GeometryUtils..GeometryUtils.distance"></a>

#### GeometryUtils.distance(point1, point2) ⇒ <code>number</code>
Calculate distance between two points

**Kind**: static method of [<code>GeometryUtils</code>](#module_GeometryUtils..GeometryUtils)  
**Returns**: <code>number</code> - Distance between points  

| Param | Type | Description |
| --- | --- | --- |
| point1 | <code>Object</code> | First point |
| point2 | <code>Object</code> | Second point |

<a name="module_GeometryUtils..GeometryUtils.getBoundingBox"></a>

#### GeometryUtils.getBoundingBox(points) ⇒ <code>Object</code> \| <code>null</code>
Calculate the bounding box of a set of points

**Kind**: static method of [<code>GeometryUtils</code>](#module_GeometryUtils..GeometryUtils)  
**Returns**: <code>Object</code> \| <code>null</code> - Bounding box or null  

| Param | Type | Description |
| --- | --- | --- |
| points | <code>Array.&lt;{x:number, y:number}&gt;</code> | Array of points |

<a name="module_GeometryUtils..GeometryUtils.clamp"></a>

#### GeometryUtils.clamp(value, min, max) ⇒ <code>number</code>
Clamp a number between min and max values

**Kind**: static method of [<code>GeometryUtils</code>](#module_GeometryUtils..GeometryUtils)  
**Returns**: <code>number</code> - Clamped value  

| Param | Type | Description |
| --- | --- | --- |
| value | <code>number</code> | Value to clamp |
| min | <code>number</code> | Minimum value |
| max | <code>number</code> | Maximum value |

<a name="module_GeometryUtils..GeometryUtils.degToRad"></a>

#### GeometryUtils.degToRad(degrees) ⇒ <code>number</code>
Convert degrees to radians

**Kind**: static method of [<code>GeometryUtils</code>](#module_GeometryUtils..GeometryUtils)  
**Returns**: <code>number</code> - Angle in radians  

| Param | Type | Description |
| --- | --- | --- |
| degrees | <code>number</code> | Angle in degrees |

<a name="module_GeometryUtils..GeometryUtils.radToDeg"></a>

#### GeometryUtils.radToDeg(radians) ⇒ <code>number</code>
Convert radians to degrees

**Kind**: static method of [<code>GeometryUtils</code>](#module_GeometryUtils..GeometryUtils)  
**Returns**: <code>number</code> - Angle in degrees  

| Param | Type | Description |
| --- | --- | --- |
| radians | <code>number</code> | Angle in radians |

<a name="module_GeometryUtils..GeometryUtils.getLayerBoundsForType"></a>

#### GeometryUtils.getLayerBoundsForType(layer) ⇒ <code>Object</code> \| <code>null</code>
Get raw bounds for a layer based on its type (excludes text layers - use TextUtils for those)

**Kind**: static method of [<code>GeometryUtils</code>](#module_GeometryUtils..GeometryUtils)  
**Returns**: <code>Object</code> \| <code>null</code> - Bounding box or null  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | The layer object |

<a name="module_GeometryUtils..GeometryUtils.computeAxisAlignedBounds"></a>

#### GeometryUtils.computeAxisAlignedBounds(rect, rotationDegrees) ⇒ <code>Object</code>
Compute axis-aligned bounding box for a rotated rectangle

**Kind**: static method of [<code>GeometryUtils</code>](#module_GeometryUtils..GeometryUtils)  
**Returns**: <code>Object</code> - Axis-aligned bounds  

| Param | Type | Description |
| --- | --- | --- |
| rect | <code>Object</code> | The rectangle |
| rotationDegrees | <code>number</code> | Rotation in degrees |

<a name="module_MessageHelper"></a>

## MessageHelper
MessageHelper - Centralized i18n message handling for the Layers extensionProvides a consistent interface for retrieving localized messages from MediaWiki'smessage system with proper fallback handling.Usage:  const msg = window.LayersMessageHelper.get( 'layers-save-success', 'Saved!' );  // Or via singleton:  const helper = window.layersMessages;  helper.get( 'layers-tool-select' );

**Since**: 0.9.0  

* [MessageHelper](#module_MessageHelper)
    * [~MessageHelper](#module_MessageHelper..MessageHelper)
        * [new MessageHelper()](#new_module_MessageHelper..MessageHelper_new)
        * [new MessageHelper()](#new_module_MessageHelper..MessageHelper_new)
        * [.get(key, [fallback])](#module_MessageHelper..MessageHelper+get) ⇒ <code>string</code>
        * [.getWithParams(key, ...params)](#module_MessageHelper..MessageHelper+getWithParams) ⇒ <code>string</code>
        * [.exists(key)](#module_MessageHelper..MessageHelper+exists) ⇒ <code>boolean</code>
        * [.clearCache()](#module_MessageHelper..MessageHelper+clearCache)
        * [.setCacheEnabled(enabled)](#module_MessageHelper..MessageHelper+setCacheEnabled)
    * [~MessageHelper](#module_MessageHelper..MessageHelper)
        * [new MessageHelper()](#new_module_MessageHelper..MessageHelper_new)
        * [new MessageHelper()](#new_module_MessageHelper..MessageHelper_new)
        * [.get(key, [fallback])](#module_MessageHelper..MessageHelper+get) ⇒ <code>string</code>
        * [.getWithParams(key, ...params)](#module_MessageHelper..MessageHelper+getWithParams) ⇒ <code>string</code>
        * [.exists(key)](#module_MessageHelper..MessageHelper+exists) ⇒ <code>boolean</code>
        * [.clearCache()](#module_MessageHelper..MessageHelper+clearCache)
        * [.setCacheEnabled(enabled)](#module_MessageHelper..MessageHelper+setCacheEnabled)

<a name="module_MessageHelper..MessageHelper"></a>

### MessageHelper~MessageHelper
**Kind**: inner class of [<code>MessageHelper</code>](#module_MessageHelper)  

* [~MessageHelper](#module_MessageHelper..MessageHelper)
    * [new MessageHelper()](#new_module_MessageHelper..MessageHelper_new)
    * [new MessageHelper()](#new_module_MessageHelper..MessageHelper_new)
    * [.get(key, [fallback])](#module_MessageHelper..MessageHelper+get) ⇒ <code>string</code>
    * [.getWithParams(key, ...params)](#module_MessageHelper..MessageHelper+getWithParams) ⇒ <code>string</code>
    * [.exists(key)](#module_MessageHelper..MessageHelper+exists) ⇒ <code>boolean</code>
    * [.clearCache()](#module_MessageHelper..MessageHelper+clearCache)
    * [.setCacheEnabled(enabled)](#module_MessageHelper..MessageHelper+setCacheEnabled)

<a name="new_module_MessageHelper..MessageHelper_new"></a>

#### new MessageHelper()
MessageHelper class for centralized i18n message handling

<a name="new_module_MessageHelper..MessageHelper_new"></a>

#### new MessageHelper()
Create a new MessageHelper instance

<a name="module_MessageHelper..MessageHelper+get"></a>

#### messageHelper.get(key, [fallback]) ⇒ <code>string</code>
Get a localized message with fallback supportTries the following in order:1. mw.message( key ).text() - standard MediaWiki message API2. mw.msg( key ) - legacy shorthand3. fallback parameter - provided default text

**Kind**: instance method of [<code>MessageHelper</code>](#module_MessageHelper..MessageHelper)  
**Returns**: <code>string</code> - The localized message or fallback  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| key | <code>string</code> |  | Message key (e.g., 'layers-save-success') |
| [fallback] | <code>string</code> | <code>&quot;&#x27;&#x27;&quot;</code> | Fallback text if message not found |

<a name="module_MessageHelper..MessageHelper+getWithParams"></a>

#### messageHelper.getWithParams(key, ...params) ⇒ <code>string</code>
Get a localized message with parameter substitution

**Kind**: instance method of [<code>MessageHelper</code>](#module_MessageHelper..MessageHelper)  
**Returns**: <code>string</code> - The localized message with parameters substituted  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>string</code> | Message key |
| ...params | <code>string</code> \| <code>number</code> | Parameters to substitute ($1, $2, etc.) |

<a name="module_MessageHelper..MessageHelper+exists"></a>

#### messageHelper.exists(key) ⇒ <code>boolean</code>
Check if a message key exists

**Kind**: instance method of [<code>MessageHelper</code>](#module_MessageHelper..MessageHelper)  
**Returns**: <code>boolean</code> - True if the message exists  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>string</code> | Message key to check |

<a name="module_MessageHelper..MessageHelper+clearCache"></a>

#### messageHelper.clearCache()
Clear the message cacheUseful when language settings change or for testing

**Kind**: instance method of [<code>MessageHelper</code>](#module_MessageHelper..MessageHelper)  
<a name="module_MessageHelper..MessageHelper+setCacheEnabled"></a>

#### messageHelper.setCacheEnabled(enabled)
Enable or disable caching

**Kind**: instance method of [<code>MessageHelper</code>](#module_MessageHelper..MessageHelper)  

| Param | Type | Description |
| --- | --- | --- |
| enabled | <code>boolean</code> | Whether to enable caching |

<a name="module_MessageHelper..MessageHelper"></a>

### MessageHelper~MessageHelper
**Kind**: inner class of [<code>MessageHelper</code>](#module_MessageHelper)  

* [~MessageHelper](#module_MessageHelper..MessageHelper)
    * [new MessageHelper()](#new_module_MessageHelper..MessageHelper_new)
    * [new MessageHelper()](#new_module_MessageHelper..MessageHelper_new)
    * [.get(key, [fallback])](#module_MessageHelper..MessageHelper+get) ⇒ <code>string</code>
    * [.getWithParams(key, ...params)](#module_MessageHelper..MessageHelper+getWithParams) ⇒ <code>string</code>
    * [.exists(key)](#module_MessageHelper..MessageHelper+exists) ⇒ <code>boolean</code>
    * [.clearCache()](#module_MessageHelper..MessageHelper+clearCache)
    * [.setCacheEnabled(enabled)](#module_MessageHelper..MessageHelper+setCacheEnabled)

<a name="new_module_MessageHelper..MessageHelper_new"></a>

#### new MessageHelper()
MessageHelper class for centralized i18n message handling

<a name="new_module_MessageHelper..MessageHelper_new"></a>

#### new MessageHelper()
Create a new MessageHelper instance

<a name="module_MessageHelper..MessageHelper+get"></a>

#### messageHelper.get(key, [fallback]) ⇒ <code>string</code>
Get a localized message with fallback supportTries the following in order:1. mw.message( key ).text() - standard MediaWiki message API2. mw.msg( key ) - legacy shorthand3. fallback parameter - provided default text

**Kind**: instance method of [<code>MessageHelper</code>](#module_MessageHelper..MessageHelper)  
**Returns**: <code>string</code> - The localized message or fallback  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| key | <code>string</code> |  | Message key (e.g., 'layers-save-success') |
| [fallback] | <code>string</code> | <code>&quot;&#x27;&#x27;&quot;</code> | Fallback text if message not found |

<a name="module_MessageHelper..MessageHelper+getWithParams"></a>

#### messageHelper.getWithParams(key, ...params) ⇒ <code>string</code>
Get a localized message with parameter substitution

**Kind**: instance method of [<code>MessageHelper</code>](#module_MessageHelper..MessageHelper)  
**Returns**: <code>string</code> - The localized message with parameters substituted  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>string</code> | Message key |
| ...params | <code>string</code> \| <code>number</code> | Parameters to substitute ($1, $2, etc.) |

<a name="module_MessageHelper..MessageHelper+exists"></a>

#### messageHelper.exists(key) ⇒ <code>boolean</code>
Check if a message key exists

**Kind**: instance method of [<code>MessageHelper</code>](#module_MessageHelper..MessageHelper)  
**Returns**: <code>boolean</code> - True if the message exists  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>string</code> | Message key to check |

<a name="module_MessageHelper..MessageHelper+clearCache"></a>

#### messageHelper.clearCache()
Clear the message cacheUseful when language settings change or for testing

**Kind**: instance method of [<code>MessageHelper</code>](#module_MessageHelper..MessageHelper)  
<a name="module_MessageHelper..MessageHelper+setCacheEnabled"></a>

#### messageHelper.setCacheEnabled(enabled)
Enable or disable caching

**Kind**: instance method of [<code>MessageHelper</code>](#module_MessageHelper..MessageHelper)  

| Param | Type | Description |
| --- | --- | --- |
| enabled | <code>boolean</code> | Whether to enable caching |

<a name="module_TextUtils"></a>

## TextUtils
TextUtils.js - Text measurement and sanitization utilitiesProvides shared text handling functions used by CanvasManager and CanvasRenderer.Consolidates duplicate implementations to ensure consistent behavior.Part of the MediaWiki Layers extension modularization effort.


* [TextUtils](#module_TextUtils)
    * [~TextUtils](#module_TextUtils..TextUtils)
        * [new TextUtils()](#new_module_TextUtils..TextUtils_new)
        * [.sanitizeTextContent(text)](#module_TextUtils..TextUtils.sanitizeTextContent) ⇒ <code>string</code>
        * [.wrapText(text, maxWidth, ctx)](#module_TextUtils..TextUtils.wrapText) ⇒ <code>Array.&lt;string&gt;</code>
        * [.measureTextLayer(layer, ctx, canvasWidth)](#module_TextUtils..TextUtils.measureTextLayer) ⇒ <code>Object</code> \| <code>null</code>

<a name="module_TextUtils..TextUtils"></a>

### TextUtils~TextUtils
**Kind**: inner class of [<code>TextUtils</code>](#module_TextUtils)  

* [~TextUtils](#module_TextUtils..TextUtils)
    * [new TextUtils()](#new_module_TextUtils..TextUtils_new)
    * [.sanitizeTextContent(text)](#module_TextUtils..TextUtils.sanitizeTextContent) ⇒ <code>string</code>
    * [.wrapText(text, maxWidth, ctx)](#module_TextUtils..TextUtils.wrapText) ⇒ <code>Array.&lt;string&gt;</code>
    * [.measureTextLayer(layer, ctx, canvasWidth)](#module_TextUtils..TextUtils.measureTextLayer) ⇒ <code>Object</code> \| <code>null</code>

<a name="new_module_TextUtils..TextUtils_new"></a>

#### new TextUtils()
Static utility class for text operations

<a name="module_TextUtils..TextUtils.sanitizeTextContent"></a>

#### TextUtils.sanitizeTextContent(text) ⇒ <code>string</code>
Sanitize text content by removing control characters and HTML tags

**Kind**: static method of [<code>TextUtils</code>](#module_TextUtils..TextUtils)  
**Returns**: <code>string</code> - Sanitized text  

| Param | Type | Description |
| --- | --- | --- |
| text | <code>string</code> | The text to sanitize |

<a name="module_TextUtils..TextUtils.wrapText"></a>

#### TextUtils.wrapText(text, maxWidth, ctx) ⇒ <code>Array.&lt;string&gt;</code>
Wrap text into multiple lines based on maximum width

**Kind**: static method of [<code>TextUtils</code>](#module_TextUtils..TextUtils)  
**Returns**: <code>Array.&lt;string&gt;</code> - Array of text lines  

| Param | Type | Description |
| --- | --- | --- |
| text | <code>string</code> | The text to wrap |
| maxWidth | <code>number</code> | Maximum width in pixels |
| ctx | <code>CanvasRenderingContext2D</code> | Canvas context for measuring text |

<a name="module_TextUtils..TextUtils.measureTextLayer"></a>

#### TextUtils.measureTextLayer(layer, ctx, canvasWidth) ⇒ <code>Object</code> \| <code>null</code>
Measure a text layer to get dimensions and positioning info

**Kind**: static method of [<code>TextUtils</code>](#module_TextUtils..TextUtils)  
**Returns**: <code>Object</code> \| <code>null</code> - Text metrics object or null if invalid  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | The text layer object |
| ctx | <code>CanvasRenderingContext2D</code> | Canvas context for measuring |
| canvasWidth | <code>number</code> | Canvas width for max line width calculation |

<a name="module_ToolbarStyleControls"></a>

## ToolbarStyleControls
ToolbarStyleControls - Manages style controls UI for Layers Editor ToolbarHandles stroke/fill colors, stroke width, font size, text effects, and arrow stylesDelegates to:- ColorControlFactory: Color picker button creation- PresetStyleManager: Style preset dropdown and application


* [ToolbarStyleControls](#module_ToolbarStyleControls)
    * [~ToolbarStyleControls](#module_ToolbarStyleControls..ToolbarStyleControls)
        * [new ToolbarStyleControls(config)](#new_module_ToolbarStyleControls..ToolbarStyleControls_new)
        * [.addListener(element, event, handler, [options])](#module_ToolbarStyleControls..ToolbarStyleControls+addListener)
        * [.msg(key, fallback)](#module_ToolbarStyleControls..ToolbarStyleControls+msg) ⇒ <code>string</code>
        * [.create()](#module_ToolbarStyleControls..ToolbarStyleControls+create) ⇒ <code>HTMLElement</code>
        * [.createMainStyleRow()](#module_ToolbarStyleControls..ToolbarStyleControls+createMainStyleRow) ⇒ <code>HTMLElement</code>
        * [.createColorControlFallback(options)](#module_ToolbarStyleControls..ToolbarStyleControls+createColorControlFallback) ⇒ <code>Object</code>
        * [.createStrokeWidthControl()](#module_ToolbarStyleControls..ToolbarStyleControls+createStrokeWidthControl) ⇒ <code>Object</code>
        * [.handleStrokeWidthInput(input)](#module_ToolbarStyleControls..ToolbarStyleControls+handleStrokeWidthInput)
        * [.handleStrokeWidthBlur(input)](#module_ToolbarStyleControls..ToolbarStyleControls+handleStrokeWidthBlur)
        * [.createFontSizeControl()](#module_ToolbarStyleControls..ToolbarStyleControls+createFontSizeControl) ⇒ <code>HTMLElement</code>
        * [.createTextStrokeControl()](#module_ToolbarStyleControls..ToolbarStyleControls+createTextStrokeControl) ⇒ <code>HTMLElement</code>
        * [.createShadowControl()](#module_ToolbarStyleControls..ToolbarStyleControls+createShadowControl) ⇒ <code>HTMLElement</code>
        * [.createArrowStyleControl()](#module_ToolbarStyleControls..ToolbarStyleControls+createArrowStyleControl) ⇒ <code>HTMLElement</code>
        * [.getColorPickerStrings()](#module_ToolbarStyleControls..ToolbarStyleControls+getColorPickerStrings) ⇒ <code>Object</code>
        * [.openColorPicker(anchorButton, initialValue, options)](#module_ToolbarStyleControls..ToolbarStyleControls+openColorPicker)
        * [.updateColorButtonDisplay(btn, color)](#module_ToolbarStyleControls..ToolbarStyleControls+updateColorButtonDisplay)
        * [.notifyStyleChange()](#module_ToolbarStyleControls..ToolbarStyleControls+notifyStyleChange)
        * [.getStyleOptions()](#module_ToolbarStyleControls..ToolbarStyleControls+getStyleOptions) ⇒ <code>Object</code>
        * [.updateForTool(toolId)](#module_ToolbarStyleControls..ToolbarStyleControls+updateForTool)
        * [.setStrokeColor(color)](#module_ToolbarStyleControls..ToolbarStyleControls+setStrokeColor)
        * [.setFillColor(color)](#module_ToolbarStyleControls..ToolbarStyleControls+setFillColor)
        * [.setStrokeWidth(width)](#module_ToolbarStyleControls..ToolbarStyleControls+setStrokeWidth)
        * [.setupValidation(validator)](#module_ToolbarStyleControls..ToolbarStyleControls+setupValidation)
        * [.applyPresetStyleInternal(style)](#module_ToolbarStyleControls..ToolbarStyleControls+applyPresetStyleInternal)
        * [.getCurrentStyle()](#module_ToolbarStyleControls..ToolbarStyleControls+getCurrentStyle) ⇒ <code>Object</code>
        * [.setCurrentTool(tool)](#module_ToolbarStyleControls..ToolbarStyleControls+setCurrentTool)
        * [.updateForSelection(selectedLayers)](#module_ToolbarStyleControls..ToolbarStyleControls+updateForSelection)
        * [.destroy()](#module_ToolbarStyleControls..ToolbarStyleControls+destroy)

<a name="module_ToolbarStyleControls..ToolbarStyleControls"></a>

### ToolbarStyleControls~ToolbarStyleControls
ToolbarStyleControls class

**Kind**: inner class of [<code>ToolbarStyleControls</code>](#module_ToolbarStyleControls)  

* [~ToolbarStyleControls](#module_ToolbarStyleControls..ToolbarStyleControls)
    * [new ToolbarStyleControls(config)](#new_module_ToolbarStyleControls..ToolbarStyleControls_new)
    * [.addListener(element, event, handler, [options])](#module_ToolbarStyleControls..ToolbarStyleControls+addListener)
    * [.msg(key, fallback)](#module_ToolbarStyleControls..ToolbarStyleControls+msg) ⇒ <code>string</code>
    * [.create()](#module_ToolbarStyleControls..ToolbarStyleControls+create) ⇒ <code>HTMLElement</code>
    * [.createMainStyleRow()](#module_ToolbarStyleControls..ToolbarStyleControls+createMainStyleRow) ⇒ <code>HTMLElement</code>
    * [.createColorControlFallback(options)](#module_ToolbarStyleControls..ToolbarStyleControls+createColorControlFallback) ⇒ <code>Object</code>
    * [.createStrokeWidthControl()](#module_ToolbarStyleControls..ToolbarStyleControls+createStrokeWidthControl) ⇒ <code>Object</code>
    * [.handleStrokeWidthInput(input)](#module_ToolbarStyleControls..ToolbarStyleControls+handleStrokeWidthInput)
    * [.handleStrokeWidthBlur(input)](#module_ToolbarStyleControls..ToolbarStyleControls+handleStrokeWidthBlur)
    * [.createFontSizeControl()](#module_ToolbarStyleControls..ToolbarStyleControls+createFontSizeControl) ⇒ <code>HTMLElement</code>
    * [.createTextStrokeControl()](#module_ToolbarStyleControls..ToolbarStyleControls+createTextStrokeControl) ⇒ <code>HTMLElement</code>
    * [.createShadowControl()](#module_ToolbarStyleControls..ToolbarStyleControls+createShadowControl) ⇒ <code>HTMLElement</code>
    * [.createArrowStyleControl()](#module_ToolbarStyleControls..ToolbarStyleControls+createArrowStyleControl) ⇒ <code>HTMLElement</code>
    * [.getColorPickerStrings()](#module_ToolbarStyleControls..ToolbarStyleControls+getColorPickerStrings) ⇒ <code>Object</code>
    * [.openColorPicker(anchorButton, initialValue, options)](#module_ToolbarStyleControls..ToolbarStyleControls+openColorPicker)
    * [.updateColorButtonDisplay(btn, color)](#module_ToolbarStyleControls..ToolbarStyleControls+updateColorButtonDisplay)
    * [.notifyStyleChange()](#module_ToolbarStyleControls..ToolbarStyleControls+notifyStyleChange)
    * [.getStyleOptions()](#module_ToolbarStyleControls..ToolbarStyleControls+getStyleOptions) ⇒ <code>Object</code>
    * [.updateForTool(toolId)](#module_ToolbarStyleControls..ToolbarStyleControls+updateForTool)
    * [.setStrokeColor(color)](#module_ToolbarStyleControls..ToolbarStyleControls+setStrokeColor)
    * [.setFillColor(color)](#module_ToolbarStyleControls..ToolbarStyleControls+setFillColor)
    * [.setStrokeWidth(width)](#module_ToolbarStyleControls..ToolbarStyleControls+setStrokeWidth)
    * [.setupValidation(validator)](#module_ToolbarStyleControls..ToolbarStyleControls+setupValidation)
    * [.applyPresetStyleInternal(style)](#module_ToolbarStyleControls..ToolbarStyleControls+applyPresetStyleInternal)
    * [.getCurrentStyle()](#module_ToolbarStyleControls..ToolbarStyleControls+getCurrentStyle) ⇒ <code>Object</code>
    * [.setCurrentTool(tool)](#module_ToolbarStyleControls..ToolbarStyleControls+setCurrentTool)
    * [.updateForSelection(selectedLayers)](#module_ToolbarStyleControls..ToolbarStyleControls+updateForSelection)
    * [.destroy()](#module_ToolbarStyleControls..ToolbarStyleControls+destroy)

<a name="new_module_ToolbarStyleControls..ToolbarStyleControls_new"></a>

#### new ToolbarStyleControls(config)

| Param | Type | Description |
| --- | --- | --- |
| config | <code>Object</code> | Configuration object |
| config.toolbar | <code>Object</code> | Reference to parent Toolbar instance |
| config.msg | <code>function</code> | Message lookup function for i18n |

<a name="module_ToolbarStyleControls..ToolbarStyleControls+addListener"></a>

#### toolbarStyleControls.addListener(element, event, handler, [options])
Add event listener to an element with automatic tracking

**Kind**: instance method of [<code>ToolbarStyleControls</code>](#module_ToolbarStyleControls..ToolbarStyleControls)  

| Param | Type | Description |
| --- | --- | --- |
| element | <code>Element</code> | Target element |
| event | <code>string</code> | Event type |
| handler | <code>function</code> | Event handler |
| [options] | <code>Object</code> | Event listener options |

<a name="module_ToolbarStyleControls..ToolbarStyleControls+msg"></a>

#### toolbarStyleControls.msg(key, fallback) ⇒ <code>string</code>
Get localized message

**Kind**: instance method of [<code>ToolbarStyleControls</code>](#module_ToolbarStyleControls..ToolbarStyleControls)  
**Returns**: <code>string</code> - Localized message  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>string</code> | Message key |
| fallback | <code>string</code> | Fallback text |

<a name="module_ToolbarStyleControls..ToolbarStyleControls+create"></a>

#### toolbarStyleControls.create() ⇒ <code>HTMLElement</code>
Create the style controls group

**Kind**: instance method of [<code>ToolbarStyleControls</code>](#module_ToolbarStyleControls..ToolbarStyleControls)  
**Returns**: <code>HTMLElement</code> - The style group container element  
<a name="module_ToolbarStyleControls..ToolbarStyleControls+createMainStyleRow"></a>

#### toolbarStyleControls.createMainStyleRow() ⇒ <code>HTMLElement</code>
Create the main style controls row (stroke color, fill color, stroke width)

**Kind**: instance method of [<code>ToolbarStyleControls</code>](#module_ToolbarStyleControls..ToolbarStyleControls)  
**Returns**: <code>HTMLElement</code> - The row container  
<a name="module_ToolbarStyleControls..ToolbarStyleControls+createColorControlFallback"></a>

#### toolbarStyleControls.createColorControlFallback(options) ⇒ <code>Object</code>
Fallback color control creation (when ColorControlFactory not available)

**Kind**: instance method of [<code>ToolbarStyleControls</code>](#module_ToolbarStyleControls..ToolbarStyleControls)  
**Returns**: <code>Object</code> - Object with container and button elements  

| Param | Type | Description |
| --- | --- | --- |
| options | <code>Object</code> | Control options |

<a name="module_ToolbarStyleControls..ToolbarStyleControls+createStrokeWidthControl"></a>

#### toolbarStyleControls.createStrokeWidthControl() ⇒ <code>Object</code>
Create the stroke width control

**Kind**: instance method of [<code>ToolbarStyleControls</code>](#module_ToolbarStyleControls..ToolbarStyleControls)  
**Returns**: <code>Object</code> - Object with container and input elements  
<a name="module_ToolbarStyleControls..ToolbarStyleControls+handleStrokeWidthInput"></a>

#### toolbarStyleControls.handleStrokeWidthInput(input)
Handle stroke width input changes

**Kind**: instance method of [<code>ToolbarStyleControls</code>](#module_ToolbarStyleControls..ToolbarStyleControls)  

| Param | Type | Description |
| --- | --- | --- |
| input | <code>HTMLInputElement</code> | The input element |

<a name="module_ToolbarStyleControls..ToolbarStyleControls+handleStrokeWidthBlur"></a>

#### toolbarStyleControls.handleStrokeWidthBlur(input)
Handle stroke width blur event (reset invalid values)

**Kind**: instance method of [<code>ToolbarStyleControls</code>](#module_ToolbarStyleControls..ToolbarStyleControls)  

| Param | Type | Description |
| --- | --- | --- |
| input | <code>HTMLInputElement</code> | The input element |

<a name="module_ToolbarStyleControls..ToolbarStyleControls+createFontSizeControl"></a>

#### toolbarStyleControls.createFontSizeControl() ⇒ <code>HTMLElement</code>
Create the font size control (for text tool)

**Kind**: instance method of [<code>ToolbarStyleControls</code>](#module_ToolbarStyleControls..ToolbarStyleControls)  
**Returns**: <code>HTMLElement</code> - The font size container  
<a name="module_ToolbarStyleControls..ToolbarStyleControls+createTextStrokeControl"></a>

#### toolbarStyleControls.createTextStrokeControl() ⇒ <code>HTMLElement</code>
Create the text stroke control

**Kind**: instance method of [<code>ToolbarStyleControls</code>](#module_ToolbarStyleControls..ToolbarStyleControls)  
**Returns**: <code>HTMLElement</code> - The text stroke container  
<a name="module_ToolbarStyleControls..ToolbarStyleControls+createShadowControl"></a>

#### toolbarStyleControls.createShadowControl() ⇒ <code>HTMLElement</code>
Create the shadow control

**Kind**: instance method of [<code>ToolbarStyleControls</code>](#module_ToolbarStyleControls..ToolbarStyleControls)  
**Returns**: <code>HTMLElement</code> - The shadow container  
<a name="module_ToolbarStyleControls..ToolbarStyleControls+createArrowStyleControl"></a>

#### toolbarStyleControls.createArrowStyleControl() ⇒ <code>HTMLElement</code>
Create the arrow style control

**Kind**: instance method of [<code>ToolbarStyleControls</code>](#module_ToolbarStyleControls..ToolbarStyleControls)  
**Returns**: <code>HTMLElement</code> - The arrow style container  
<a name="module_ToolbarStyleControls..ToolbarStyleControls+getColorPickerStrings"></a>

#### toolbarStyleControls.getColorPickerStrings() ⇒ <code>Object</code>
Get color picker strings for i18n

**Kind**: instance method of [<code>ToolbarStyleControls</code>](#module_ToolbarStyleControls..ToolbarStyleControls)  
**Returns**: <code>Object</code> - Color picker string map  
<a name="module_ToolbarStyleControls..ToolbarStyleControls+openColorPicker"></a>

#### toolbarStyleControls.openColorPicker(anchorButton, initialValue, options)
Open the color picker dialog

**Kind**: instance method of [<code>ToolbarStyleControls</code>](#module_ToolbarStyleControls..ToolbarStyleControls)  

| Param | Type | Description |
| --- | --- | --- |
| anchorButton | <code>HTMLElement</code> | The button that triggered the picker |
| initialValue | <code>string</code> | Current color value |
| options | <code>Object</code> | Options including onApply callback |

<a name="module_ToolbarStyleControls..ToolbarStyleControls+updateColorButtonDisplay"></a>

#### toolbarStyleControls.updateColorButtonDisplay(btn, color)
Update a color button's display

**Kind**: instance method of [<code>ToolbarStyleControls</code>](#module_ToolbarStyleControls..ToolbarStyleControls)  

| Param | Type | Description |
| --- | --- | --- |
| btn | <code>HTMLElement</code> | The button element |
| color | <code>string</code> | The color value or 'none' |

<a name="module_ToolbarStyleControls..ToolbarStyleControls+notifyStyleChange"></a>

#### toolbarStyleControls.notifyStyleChange()
Notify toolbar of style changes

**Kind**: instance method of [<code>ToolbarStyleControls</code>](#module_ToolbarStyleControls..ToolbarStyleControls)  
<a name="module_ToolbarStyleControls..ToolbarStyleControls+getStyleOptions"></a>

#### toolbarStyleControls.getStyleOptions() ⇒ <code>Object</code>
Get current style options

**Kind**: instance method of [<code>ToolbarStyleControls</code>](#module_ToolbarStyleControls..ToolbarStyleControls)  
**Returns**: <code>Object</code> - Style options object  
<a name="module_ToolbarStyleControls..ToolbarStyleControls+updateForTool"></a>

#### toolbarStyleControls.updateForTool(toolId)
Update visibility of tool-specific options

**Kind**: instance method of [<code>ToolbarStyleControls</code>](#module_ToolbarStyleControls..ToolbarStyleControls)  

| Param | Type | Description |
| --- | --- | --- |
| toolId | <code>string</code> | The currently selected tool |

<a name="module_ToolbarStyleControls..ToolbarStyleControls+setStrokeColor"></a>

#### toolbarStyleControls.setStrokeColor(color)
Set stroke color programmatically

**Kind**: instance method of [<code>ToolbarStyleControls</code>](#module_ToolbarStyleControls..ToolbarStyleControls)  

| Param | Type | Description |
| --- | --- | --- |
| color | <code>string</code> | Color value or 'none' |

<a name="module_ToolbarStyleControls..ToolbarStyleControls+setFillColor"></a>

#### toolbarStyleControls.setFillColor(color)
Set fill color programmatically

**Kind**: instance method of [<code>ToolbarStyleControls</code>](#module_ToolbarStyleControls..ToolbarStyleControls)  

| Param | Type | Description |
| --- | --- | --- |
| color | <code>string</code> | Color value or 'none' |

<a name="module_ToolbarStyleControls..ToolbarStyleControls+setStrokeWidth"></a>

#### toolbarStyleControls.setStrokeWidth(width)
Set stroke width programmatically

**Kind**: instance method of [<code>ToolbarStyleControls</code>](#module_ToolbarStyleControls..ToolbarStyleControls)  

| Param | Type | Description |
| --- | --- | --- |
| width | <code>number</code> | Stroke width in pixels |

<a name="module_ToolbarStyleControls..ToolbarStyleControls+setupValidation"></a>

#### toolbarStyleControls.setupValidation(validator)
Setup input validation (integrates with LayersValidator)

**Kind**: instance method of [<code>ToolbarStyleControls</code>](#module_ToolbarStyleControls..ToolbarStyleControls)  

| Param | Type | Description |
| --- | --- | --- |
| validator | <code>Object</code> | LayersValidator instance |

<a name="module_ToolbarStyleControls..ToolbarStyleControls+applyPresetStyleInternal"></a>

#### toolbarStyleControls.applyPresetStyleInternal(style)
Apply a preset style to the current controls (internal, called by PresetStyleManager)

**Kind**: instance method of [<code>ToolbarStyleControls</code>](#module_ToolbarStyleControls..ToolbarStyleControls)  

| Param | Type | Description |
| --- | --- | --- |
| style | <code>Object</code> | Style properties from the preset |

<a name="module_ToolbarStyleControls..ToolbarStyleControls+getCurrentStyle"></a>

#### toolbarStyleControls.getCurrentStyle() ⇒ <code>Object</code>
Get the current style from all controls

**Kind**: instance method of [<code>ToolbarStyleControls</code>](#module_ToolbarStyleControls..ToolbarStyleControls)  
**Returns**: <code>Object</code> - Current style properties  
<a name="module_ToolbarStyleControls..ToolbarStyleControls+setCurrentTool"></a>

#### toolbarStyleControls.setCurrentTool(tool)
Update preset dropdown when tool changes (delegates to PresetStyleManager)

**Kind**: instance method of [<code>ToolbarStyleControls</code>](#module_ToolbarStyleControls..ToolbarStyleControls)  

| Param | Type | Description |
| --- | --- | --- |
| tool | <code>string</code> | Current tool name |

<a name="module_ToolbarStyleControls..ToolbarStyleControls+updateForSelection"></a>

#### toolbarStyleControls.updateForSelection(selectedLayers)
Update preset dropdown when layer selection changes (delegates to PresetStyleManager)

**Kind**: instance method of [<code>ToolbarStyleControls</code>](#module_ToolbarStyleControls..ToolbarStyleControls)  

| Param | Type | Description |
| --- | --- | --- |
| selectedLayers | <code>Array</code> | Array of selected layer objects |

<a name="module_ToolbarStyleControls..ToolbarStyleControls+destroy"></a>

#### toolbarStyleControls.destroy()
Destroy and cleanup

**Kind**: instance method of [<code>ToolbarStyleControls</code>](#module_ToolbarStyleControls..ToolbarStyleControls)  
<a name="module_ArrowRenderer"></a>

## ArrowRenderer
ArrowRenderer - Specialized arrow shape renderingExtracted from LayerRenderer.js to reduce file size and improve maintainability.This module handles all arrow-related rendering including:- Arrow vertex calculation (single, double, no head)- Arrow head types (pointed, chevron, standard)- Shadow rendering with spread support

**Since**: 0.9.1  

* [ArrowRenderer](#module_ArrowRenderer)
    * [~ArrowRenderer](#module_ArrowRenderer..ArrowRenderer)
        * [new ArrowRenderer(ctx, [config])](#new_module_ArrowRenderer..ArrowRenderer_new)
        * [.setShadowRenderer(shadowRenderer)](#module_ArrowRenderer..ArrowRenderer+setShadowRenderer)
        * [.setContext(ctx)](#module_ArrowRenderer..ArrowRenderer+setContext)
        * [.clearShadow()](#module_ArrowRenderer..ArrowRenderer+clearShadow)
        * [.applyShadow(layer, scale)](#module_ArrowRenderer..ArrowRenderer+applyShadow)
        * [.hasShadowEnabled(layer)](#module_ArrowRenderer..ArrowRenderer+hasShadowEnabled) ⇒ <code>boolean</code>
        * [.getShadowSpread(layer, scale)](#module_ArrowRenderer..ArrowRenderer+getShadowSpread) ⇒ <code>number</code>
        * [.drawSpreadShadow(layer, scale, spread, drawFn, [opacity])](#module_ArrowRenderer..ArrowRenderer+drawSpreadShadow)
        * [.drawSpreadShadowStroke(layer, scale, strokeWidth, drawFn, [opacity])](#module_ArrowRenderer..ArrowRenderer+drawSpreadShadowStroke)
        * [.buildArrowVertices(x1, y1, x2, y2, angle, perpAngle, halfShaft, arrowSize, arrowStyle, headType, headScale, tailWidth)](#module_ArrowRenderer..ArrowRenderer+buildArrowVertices) ⇒ <code>Array</code>
        * [.draw(layer, [options])](#module_ArrowRenderer..ArrowRenderer+draw)
        * [.destroy()](#module_ArrowRenderer..ArrowRenderer+destroy)

<a name="module_ArrowRenderer..ArrowRenderer"></a>

### ArrowRenderer~ArrowRenderer
ArrowRenderer class - Renders arrow shapes on canvas

**Kind**: inner class of [<code>ArrowRenderer</code>](#module_ArrowRenderer)  

* [~ArrowRenderer](#module_ArrowRenderer..ArrowRenderer)
    * [new ArrowRenderer(ctx, [config])](#new_module_ArrowRenderer..ArrowRenderer_new)
    * [.setShadowRenderer(shadowRenderer)](#module_ArrowRenderer..ArrowRenderer+setShadowRenderer)
    * [.setContext(ctx)](#module_ArrowRenderer..ArrowRenderer+setContext)
    * [.clearShadow()](#module_ArrowRenderer..ArrowRenderer+clearShadow)
    * [.applyShadow(layer, scale)](#module_ArrowRenderer..ArrowRenderer+applyShadow)
    * [.hasShadowEnabled(layer)](#module_ArrowRenderer..ArrowRenderer+hasShadowEnabled) ⇒ <code>boolean</code>
    * [.getShadowSpread(layer, scale)](#module_ArrowRenderer..ArrowRenderer+getShadowSpread) ⇒ <code>number</code>
    * [.drawSpreadShadow(layer, scale, spread, drawFn, [opacity])](#module_ArrowRenderer..ArrowRenderer+drawSpreadShadow)
    * [.drawSpreadShadowStroke(layer, scale, strokeWidth, drawFn, [opacity])](#module_ArrowRenderer..ArrowRenderer+drawSpreadShadowStroke)
    * [.buildArrowVertices(x1, y1, x2, y2, angle, perpAngle, halfShaft, arrowSize, arrowStyle, headType, headScale, tailWidth)](#module_ArrowRenderer..ArrowRenderer+buildArrowVertices) ⇒ <code>Array</code>
    * [.draw(layer, [options])](#module_ArrowRenderer..ArrowRenderer+draw)
    * [.destroy()](#module_ArrowRenderer..ArrowRenderer+destroy)

<a name="new_module_ArrowRenderer..ArrowRenderer_new"></a>

#### new ArrowRenderer(ctx, [config])
Creates a new ArrowRenderer instance


| Param | Type | Description |
| --- | --- | --- |
| ctx | <code>CanvasRenderingContext2D</code> | Canvas 2D rendering context |
| [config] | <code>Object</code> | Configuration options |
| [config.shadowRenderer] | <code>Object</code> | ShadowRenderer instance for shadow operations |

<a name="module_ArrowRenderer..ArrowRenderer+setShadowRenderer"></a>

#### arrowRenderer.setShadowRenderer(shadowRenderer)
Set the shadow renderer instance

**Kind**: instance method of [<code>ArrowRenderer</code>](#module_ArrowRenderer..ArrowRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| shadowRenderer | <code>Object</code> | ShadowRenderer instance |

<a name="module_ArrowRenderer..ArrowRenderer+setContext"></a>

#### arrowRenderer.setContext(ctx)
Set the context

**Kind**: instance method of [<code>ArrowRenderer</code>](#module_ArrowRenderer..ArrowRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| ctx | <code>CanvasRenderingContext2D</code> | Canvas context |

<a name="module_ArrowRenderer..ArrowRenderer+clearShadow"></a>

#### arrowRenderer.clearShadow()
Clear shadow settings from context

**Kind**: instance method of [<code>ArrowRenderer</code>](#module_ArrowRenderer..ArrowRenderer)  
<a name="module_ArrowRenderer..ArrowRenderer+applyShadow"></a>

#### arrowRenderer.applyShadow(layer, scale)
Apply shadow settings to context

**Kind**: instance method of [<code>ArrowRenderer</code>](#module_ArrowRenderer..ArrowRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer with shadow properties |
| scale | <code>Object</code> | Scale factors |

<a name="module_ArrowRenderer..ArrowRenderer+hasShadowEnabled"></a>

#### arrowRenderer.hasShadowEnabled(layer) ⇒ <code>boolean</code>
Check if shadow is enabled on a layer

**Kind**: instance method of [<code>ArrowRenderer</code>](#module_ArrowRenderer..ArrowRenderer)  
**Returns**: <code>boolean</code> - True if shadow is enabled  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer to check |

<a name="module_ArrowRenderer..ArrowRenderer+getShadowSpread"></a>

#### arrowRenderer.getShadowSpread(layer, scale) ⇒ <code>number</code>
Get shadow spread value from layer

**Kind**: instance method of [<code>ArrowRenderer</code>](#module_ArrowRenderer..ArrowRenderer)  
**Returns**: <code>number</code> - Spread value in pixels  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer with shadow properties |
| scale | <code>Object</code> | Scale factors |

<a name="module_ArrowRenderer..ArrowRenderer+drawSpreadShadow"></a>

#### arrowRenderer.drawSpreadShadow(layer, scale, spread, drawFn, [opacity])
Draw a spread shadow using offscreen canvas

**Kind**: instance method of [<code>ArrowRenderer</code>](#module_ArrowRenderer..ArrowRenderer)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| layer | <code>Object</code> |  | Layer with shadow properties |
| scale | <code>Object</code> |  | Scale factors |
| spread | <code>number</code> |  | Spread amount |
| drawFn | <code>function</code> |  | Function to draw the path |
| [opacity] | <code>number</code> | <code>1</code> | Opacity |

<a name="module_ArrowRenderer..ArrowRenderer+drawSpreadShadowStroke"></a>

#### arrowRenderer.drawSpreadShadowStroke(layer, scale, strokeWidth, drawFn, [opacity])
Draw a spread shadow stroke

**Kind**: instance method of [<code>ArrowRenderer</code>](#module_ArrowRenderer..ArrowRenderer)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| layer | <code>Object</code> |  | Layer with shadow properties |
| scale | <code>Object</code> |  | Scale factors |
| strokeWidth | <code>number</code> |  | Stroke width |
| drawFn | <code>function</code> |  | Function to draw the path |
| [opacity] | <code>number</code> | <code>1</code> | Opacity |

<a name="module_ArrowRenderer..ArrowRenderer+buildArrowVertices"></a>

#### arrowRenderer.buildArrowVertices(x1, y1, x2, y2, angle, perpAngle, halfShaft, arrowSize, arrowStyle, headType, headScale, tailWidth) ⇒ <code>Array</code>
Build the vertices for an arrow polygon

**Kind**: instance method of [<code>ArrowRenderer</code>](#module_ArrowRenderer..ArrowRenderer)  
**Returns**: <code>Array</code> - Array of {x, y} vertex objects  

| Param | Type | Description |
| --- | --- | --- |
| x1 | <code>number</code> | Start X |
| y1 | <code>number</code> | Start Y |
| x2 | <code>number</code> | End X (tip direction) |
| y2 | <code>number</code> | End Y |
| angle | <code>number</code> | Angle of arrow direction |
| perpAngle | <code>number</code> | Perpendicular angle |
| halfShaft | <code>number</code> | Half of shaft width |
| arrowSize | <code>number</code> | Size of arrowhead |
| arrowStyle | <code>string</code> | 'single', 'double', or 'none' |
| headType | <code>string</code> | 'pointed', 'chevron', or 'standard' |
| headScale | <code>number</code> | Scale factor for arrow head size |
| tailWidth | <code>number</code> | Extra width at tail end |

<a name="module_ArrowRenderer..ArrowRenderer+draw"></a>

#### arrowRenderer.draw(layer, [options])
Draw an arrow as a closed polygon

**Kind**: instance method of [<code>ArrowRenderer</code>](#module_ArrowRenderer..ArrowRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer with arrow properties |
| [options] | <code>Object</code> | Rendering options |
| [options.scale] | <code>Object</code> | Scale factors {sx, sy, avg} |
| [options.shadowScale] | <code>Object</code> | Shadow scale factors |
| [options.scaled] | <code>boolean</code> | Whether coords are pre-scaled |

<a name="module_ArrowRenderer..ArrowRenderer+destroy"></a>

#### arrowRenderer.destroy()
Clean up resources

**Kind**: instance method of [<code>ArrowRenderer</code>](#module_ArrowRenderer..ArrowRenderer)  
<a name="module_BoundsCalculator"></a>

## BoundsCalculator
BoundsCalculator - Utility for calculating layer boundsProvides centralized bounds calculation for all layer types.Extracted from SelectionManager.getLayerBoundsCompat() to reduce code duplicationand provide a reusable utility.

**Since**: 0.9.2  

* [BoundsCalculator](#module_BoundsCalculator)
    * [~BoundsCalculator](#module_BoundsCalculator..BoundsCalculator)
        * [.getLayerBounds(layer)](#module_BoundsCalculator..BoundsCalculator.getLayerBounds) ⇒ <code>Object</code> \| <code>null</code>
        * [.getRectangularBounds(layer)](#module_BoundsCalculator..BoundsCalculator.getRectangularBounds) ⇒ <code>Object</code> \| <code>null</code>
        * [.getLineBounds(layer)](#module_BoundsCalculator..BoundsCalculator.getLineBounds) ⇒ <code>Object</code> \| <code>null</code>
        * [.getEllipseBounds(layer)](#module_BoundsCalculator..BoundsCalculator.getEllipseBounds) ⇒ <code>Object</code> \| <code>null</code>
        * [.getPolygonBounds(layer)](#module_BoundsCalculator..BoundsCalculator.getPolygonBounds) ⇒ <code>Object</code> \| <code>null</code>
        * [.getTextBounds(layer)](#module_BoundsCalculator..BoundsCalculator.getTextBounds) ⇒ <code>Object</code> \| <code>null</code>
        * [.mergeBounds(boundsArray)](#module_BoundsCalculator..BoundsCalculator.mergeBounds) ⇒ <code>Object</code> \| <code>null</code>
        * [.getMultiLayerBounds(layers)](#module_BoundsCalculator..BoundsCalculator.getMultiLayerBounds) ⇒ <code>Object</code> \| <code>null</code>
        * [.isPointInBounds(point, bounds)](#module_BoundsCalculator..BoundsCalculator.isPointInBounds) ⇒ <code>boolean</code>
        * [.boundsIntersect(bounds1, bounds2)](#module_BoundsCalculator..BoundsCalculator.boundsIntersect) ⇒ <code>boolean</code>
        * [.expandBounds(bounds, amount)](#module_BoundsCalculator..BoundsCalculator.expandBounds) ⇒ <code>Object</code> \| <code>null</code>
        * [.getBoundsCenter(bounds)](#module_BoundsCalculator..BoundsCalculator.getBoundsCenter) ⇒ <code>Object</code> \| <code>null</code>

<a name="module_BoundsCalculator..BoundsCalculator"></a>

### BoundsCalculator~BoundsCalculator
BoundsCalculator class - Static utility methods for layer bounds calculations

**Kind**: inner class of [<code>BoundsCalculator</code>](#module_BoundsCalculator)  

* [~BoundsCalculator](#module_BoundsCalculator..BoundsCalculator)
    * [.getLayerBounds(layer)](#module_BoundsCalculator..BoundsCalculator.getLayerBounds) ⇒ <code>Object</code> \| <code>null</code>
    * [.getRectangularBounds(layer)](#module_BoundsCalculator..BoundsCalculator.getRectangularBounds) ⇒ <code>Object</code> \| <code>null</code>
    * [.getLineBounds(layer)](#module_BoundsCalculator..BoundsCalculator.getLineBounds) ⇒ <code>Object</code> \| <code>null</code>
    * [.getEllipseBounds(layer)](#module_BoundsCalculator..BoundsCalculator.getEllipseBounds) ⇒ <code>Object</code> \| <code>null</code>
    * [.getPolygonBounds(layer)](#module_BoundsCalculator..BoundsCalculator.getPolygonBounds) ⇒ <code>Object</code> \| <code>null</code>
    * [.getTextBounds(layer)](#module_BoundsCalculator..BoundsCalculator.getTextBounds) ⇒ <code>Object</code> \| <code>null</code>
    * [.mergeBounds(boundsArray)](#module_BoundsCalculator..BoundsCalculator.mergeBounds) ⇒ <code>Object</code> \| <code>null</code>
    * [.getMultiLayerBounds(layers)](#module_BoundsCalculator..BoundsCalculator.getMultiLayerBounds) ⇒ <code>Object</code> \| <code>null</code>
    * [.isPointInBounds(point, bounds)](#module_BoundsCalculator..BoundsCalculator.isPointInBounds) ⇒ <code>boolean</code>
    * [.boundsIntersect(bounds1, bounds2)](#module_BoundsCalculator..BoundsCalculator.boundsIntersect) ⇒ <code>boolean</code>
    * [.expandBounds(bounds, amount)](#module_BoundsCalculator..BoundsCalculator.expandBounds) ⇒ <code>Object</code> \| <code>null</code>
    * [.getBoundsCenter(bounds)](#module_BoundsCalculator..BoundsCalculator.getBoundsCenter) ⇒ <code>Object</code> \| <code>null</code>

<a name="module_BoundsCalculator..BoundsCalculator.getLayerBounds"></a>

#### BoundsCalculator.getLayerBounds(layer) ⇒ <code>Object</code> \| <code>null</code>
Calculate bounds for any layer type

**Kind**: static method of [<code>BoundsCalculator</code>](#module_BoundsCalculator..BoundsCalculator)  
**Returns**: <code>Object</code> \| <code>null</code> - Bounds {x, y, width, height} or null  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer object |

<a name="module_BoundsCalculator..BoundsCalculator.getRectangularBounds"></a>

#### BoundsCalculator.getRectangularBounds(layer) ⇒ <code>Object</code> \| <code>null</code>
Calculate bounds for rectangular layers (rectangle, blur, etc.)

**Kind**: static method of [<code>BoundsCalculator</code>](#module_BoundsCalculator..BoundsCalculator)  
**Returns**: <code>Object</code> \| <code>null</code> - Bounds or null if not rectangular  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer with x, y, width, height properties |

<a name="module_BoundsCalculator..BoundsCalculator.getLineBounds"></a>

#### BoundsCalculator.getLineBounds(layer) ⇒ <code>Object</code> \| <code>null</code>
Calculate bounds for line/arrow layers

**Kind**: static method of [<code>BoundsCalculator</code>](#module_BoundsCalculator..BoundsCalculator)  
**Returns**: <code>Object</code> \| <code>null</code> - Bounds or null if not a line  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer with x1, y1, x2, y2 properties |

<a name="module_BoundsCalculator..BoundsCalculator.getEllipseBounds"></a>

#### BoundsCalculator.getEllipseBounds(layer) ⇒ <code>Object</code> \| <code>null</code>
Calculate bounds for ellipse/circle layers

**Kind**: static method of [<code>BoundsCalculator</code>](#module_BoundsCalculator..BoundsCalculator)  
**Returns**: <code>Object</code> \| <code>null</code> - Bounds or null if not an ellipse  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer with center x, y and radius/radiusX/radiusY |

<a name="module_BoundsCalculator..BoundsCalculator.getPolygonBounds"></a>

#### BoundsCalculator.getPolygonBounds(layer) ⇒ <code>Object</code> \| <code>null</code>
Calculate bounds for polygon/path/star layers with points array

**Kind**: static method of [<code>BoundsCalculator</code>](#module_BoundsCalculator..BoundsCalculator)  
**Returns**: <code>Object</code> \| <code>null</code> - Bounds or null if not a polygon  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer with points array |

<a name="module_BoundsCalculator..BoundsCalculator.getTextBounds"></a>

#### BoundsCalculator.getTextBounds(layer) ⇒ <code>Object</code> \| <code>null</code>
Calculate bounds for text layers

**Kind**: static method of [<code>BoundsCalculator</code>](#module_BoundsCalculator..BoundsCalculator)  
**Returns**: <code>Object</code> \| <code>null</code> - Bounds or null if not a text layer  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer with text properties |

<a name="module_BoundsCalculator..BoundsCalculator.mergeBounds"></a>

#### BoundsCalculator.mergeBounds(boundsArray) ⇒ <code>Object</code> \| <code>null</code>
Merge multiple bounds into one encompassing bounds

**Kind**: static method of [<code>BoundsCalculator</code>](#module_BoundsCalculator..BoundsCalculator)  
**Returns**: <code>Object</code> \| <code>null</code> - Combined bounds or null if empty  

| Param | Type | Description |
| --- | --- | --- |
| boundsArray | <code>Array.&lt;Object&gt;</code> | Array of bounds objects |

<a name="module_BoundsCalculator..BoundsCalculator.getMultiLayerBounds"></a>

#### BoundsCalculator.getMultiLayerBounds(layers) ⇒ <code>Object</code> \| <code>null</code>
Get bounds for multiple layers

**Kind**: static method of [<code>BoundsCalculator</code>](#module_BoundsCalculator..BoundsCalculator)  
**Returns**: <code>Object</code> \| <code>null</code> - Combined bounds or null if empty  

| Param | Type | Description |
| --- | --- | --- |
| layers | <code>Array.&lt;Object&gt;</code> | Array of layer objects |

<a name="module_BoundsCalculator..BoundsCalculator.isPointInBounds"></a>

#### BoundsCalculator.isPointInBounds(point, bounds) ⇒ <code>boolean</code>
Check if a point is inside bounds

**Kind**: static method of [<code>BoundsCalculator</code>](#module_BoundsCalculator..BoundsCalculator)  
**Returns**: <code>boolean</code> - True if point is inside bounds  

| Param | Type | Description |
| --- | --- | --- |
| point | <code>Object</code> | Point with x, y properties |
| bounds | <code>Object</code> | Bounds with x, y, width, height properties |

<a name="module_BoundsCalculator..BoundsCalculator.boundsIntersect"></a>

#### BoundsCalculator.boundsIntersect(bounds1, bounds2) ⇒ <code>boolean</code>
Check if two bounds intersect

**Kind**: static method of [<code>BoundsCalculator</code>](#module_BoundsCalculator..BoundsCalculator)  
**Returns**: <code>boolean</code> - True if bounds intersect  

| Param | Type | Description |
| --- | --- | --- |
| bounds1 | <code>Object</code> | First bounds |
| bounds2 | <code>Object</code> | Second bounds |

<a name="module_BoundsCalculator..BoundsCalculator.expandBounds"></a>

#### BoundsCalculator.expandBounds(bounds, amount) ⇒ <code>Object</code> \| <code>null</code>
Expand bounds by a given amount

**Kind**: static method of [<code>BoundsCalculator</code>](#module_BoundsCalculator..BoundsCalculator)  
**Returns**: <code>Object</code> \| <code>null</code> - Expanded bounds or null if invalid  

| Param | Type | Description |
| --- | --- | --- |
| bounds | <code>Object</code> | Bounds to expand |
| amount | <code>number</code> | Amount to expand (can be negative to shrink) |

<a name="module_BoundsCalculator..BoundsCalculator.getBoundsCenter"></a>

#### BoundsCalculator.getBoundsCenter(bounds) ⇒ <code>Object</code> \| <code>null</code>
Get the center point of bounds

**Kind**: static method of [<code>BoundsCalculator</code>](#module_BoundsCalculator..BoundsCalculator)  
**Returns**: <code>Object</code> \| <code>null</code> - Center point {x, y} or null  

| Param | Type | Description |
| --- | --- | --- |
| bounds | <code>Object</code> | Bounds object |

<a name="module_DeepClone"></a>

## DeepClone
DeepClone - Utility for deep cloning objects safelyUses structuredClone when available (modern browsers), with fallbackto JSON.parse(JSON.stringify()) for older environments.Benefits over JSON.parse(JSON.stringify()):- Handles circular references (structuredClone)- Preserves undefined values in some cases- Better performance in modern browsers- Cleaner, more semantic API

<a name="module_EffectsRenderer"></a>

## EffectsRenderer
EffectsRenderer - Handles special effect layers (blur)This module provides rendering for effect-type layers that applyvisual modifications to image regions rather than drawing shapes.Extracted from LayerRenderer to separate concerns and reduce god class size.

**Since**: 0.9.0  

* [EffectsRenderer](#module_EffectsRenderer)
    * [~EffectsRenderer](#module_EffectsRenderer..EffectsRenderer)
        * [new EffectsRenderer(ctx, [config])](#new_module_EffectsRenderer..EffectsRenderer_new)
        * [.setContext(ctx)](#module_EffectsRenderer..EffectsRenderer+setContext)
        * [.setBackgroundImage(image)](#module_EffectsRenderer..EffectsRenderer+setBackgroundImage)
        * [.setBaseDimensions(width, height)](#module_EffectsRenderer..EffectsRenderer+setBaseDimensions)
        * [.getScaleFactors()](#module_EffectsRenderer..EffectsRenderer+getScaleFactors) ⇒ <code>Object</code>
        * [.drawBlur(layer, [options])](#module_EffectsRenderer..EffectsRenderer+drawBlur)

<a name="module_EffectsRenderer..EffectsRenderer"></a>

### EffectsRenderer~EffectsRenderer
EffectsRenderer class - Renders blur effect layers

**Kind**: inner class of [<code>EffectsRenderer</code>](#module_EffectsRenderer)  

* [~EffectsRenderer](#module_EffectsRenderer..EffectsRenderer)
    * [new EffectsRenderer(ctx, [config])](#new_module_EffectsRenderer..EffectsRenderer_new)
    * [.setContext(ctx)](#module_EffectsRenderer..EffectsRenderer+setContext)
    * [.setBackgroundImage(image)](#module_EffectsRenderer..EffectsRenderer+setBackgroundImage)
    * [.setBaseDimensions(width, height)](#module_EffectsRenderer..EffectsRenderer+setBaseDimensions)
    * [.getScaleFactors()](#module_EffectsRenderer..EffectsRenderer+getScaleFactors) ⇒ <code>Object</code>
    * [.drawBlur(layer, [options])](#module_EffectsRenderer..EffectsRenderer+drawBlur)

<a name="new_module_EffectsRenderer..EffectsRenderer_new"></a>

#### new EffectsRenderer(ctx, [config])
Creates a new EffectsRenderer instance


| Param | Type | Description |
| --- | --- | --- |
| ctx | <code>CanvasRenderingContext2D</code> | Canvas 2D rendering context |
| [config] | <code>Object</code> | Configuration options |
| [config.canvas] | <code>HTMLCanvasElement</code> | Canvas element reference |
| [config.backgroundImage] | <code>HTMLImageElement</code> | Background image for blur effects |
| [config.baseWidth] | <code>number</code> | Original image width for scaling |
| [config.baseHeight] | <code>number</code> | Original image height for scaling |

<a name="module_EffectsRenderer..EffectsRenderer+setContext"></a>

#### effectsRenderer.setContext(ctx)
Set the canvas context

**Kind**: instance method of [<code>EffectsRenderer</code>](#module_EffectsRenderer..EffectsRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| ctx | <code>CanvasRenderingContext2D</code> | New context |

<a name="module_EffectsRenderer..EffectsRenderer+setBackgroundImage"></a>

#### effectsRenderer.setBackgroundImage(image)
Update the background image reference

**Kind**: instance method of [<code>EffectsRenderer</code>](#module_EffectsRenderer..EffectsRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| image | <code>HTMLImageElement</code> | Background image |

<a name="module_EffectsRenderer..EffectsRenderer+setBaseDimensions"></a>

#### effectsRenderer.setBaseDimensions(width, height)
Update base dimensions for scaling calculations

**Kind**: instance method of [<code>EffectsRenderer</code>](#module_EffectsRenderer..EffectsRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| width | <code>number</code> | Base width |
| height | <code>number</code> | Base height |

<a name="module_EffectsRenderer..EffectsRenderer+getScaleFactors"></a>

#### effectsRenderer.getScaleFactors() ⇒ <code>Object</code>
Get scale factors for coordinate transformation

**Kind**: instance method of [<code>EffectsRenderer</code>](#module_EffectsRenderer..EffectsRenderer)  
**Returns**: <code>Object</code> - Scale factors { sx, sy, avg }  
<a name="module_EffectsRenderer..EffectsRenderer+drawBlur"></a>

#### effectsRenderer.drawBlur(layer, [options])
Draw a blur effect regionBlur effects obscure portions of an image, useful forredacting sensitive information or focusing attention elsewhere.

**Kind**: instance method of [<code>EffectsRenderer</code>](#module_EffectsRenderer..EffectsRenderer)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| layer | <code>Object</code> |  | Layer with blur properties |
| [layer.x] | <code>number</code> | <code>0</code> | X position |
| [layer.y] | <code>number</code> | <code>0</code> | Y position |
| [layer.width] | <code>number</code> | <code>0</code> | Width |
| [layer.height] | <code>number</code> | <code>0</code> | Height |
| [layer.blurRadius] | <code>number</code> | <code>12</code> | Blur radius (1-64) |
| [options] | <code>Object</code> |  | Rendering options |
| [options.scaled] | <code>boolean</code> |  | Whether coordinates are pre-scaled |
| [options.imageElement] | <code>HTMLImageElement</code> |  | Image for blur source (viewer mode) |

<a name="module_LayerDataNormalizer"></a>

## LayerDataNormalizer
LayerDataNormalizer - Shared utility for normalizing layer dataThis module ensures consistent data types across the editor and viewer.It handles the conversion of string/numeric representations of booleanvalues to actual JavaScript booleans, which is critical for correctrendering of boolean-dependent features like shadows and visibility.Why this exists:- JSON data from the server may have string representations ("true", "1")- Database storage or legacy data may use numeric values (1, 0)- Canvas rendering code uses strict equality checks (=== true)- Without normalization, features like text shadows fail to render

**Since**: 1.1.2  

* [LayerDataNormalizer](#module_LayerDataNormalizer)
    * [~LayerDataNormalizer](#module_LayerDataNormalizer..LayerDataNormalizer)
        * [.normalizeLayer(layer)](#module_LayerDataNormalizer..LayerDataNormalizer.normalizeLayer) ⇒ <code>Object</code>
        * [.normalizeBooleans(layer)](#module_LayerDataNormalizer..LayerDataNormalizer.normalizeBooleans)
        * [.normalizeNumbers(layer)](#module_LayerDataNormalizer..LayerDataNormalizer.normalizeNumbers)
        * [.normalizeLayers(layers)](#module_LayerDataNormalizer..LayerDataNormalizer.normalizeLayers) ⇒ <code>Array</code>
        * [.normalizeLayerData(layerData)](#module_LayerDataNormalizer..LayerDataNormalizer.normalizeLayerData) ⇒ <code>Object</code>
        * [.getBooleanProperties()](#module_LayerDataNormalizer..LayerDataNormalizer.getBooleanProperties) ⇒ <code>Array.&lt;string&gt;</code>
        * [.getNumericProperties()](#module_LayerDataNormalizer..LayerDataNormalizer.getNumericProperties) ⇒ <code>Array.&lt;string&gt;</code>
        * [.toBoolean(val)](#module_LayerDataNormalizer..LayerDataNormalizer.toBoolean) ⇒ <code>boolean</code> \| <code>undefined</code>

<a name="module_LayerDataNormalizer..LayerDataNormalizer"></a>

### LayerDataNormalizer~LayerDataNormalizer
LayerDataNormalizer class - Provides static methods for normalizing layer data

**Kind**: inner class of [<code>LayerDataNormalizer</code>](#module_LayerDataNormalizer)  

* [~LayerDataNormalizer](#module_LayerDataNormalizer..LayerDataNormalizer)
    * [.normalizeLayer(layer)](#module_LayerDataNormalizer..LayerDataNormalizer.normalizeLayer) ⇒ <code>Object</code>
    * [.normalizeBooleans(layer)](#module_LayerDataNormalizer..LayerDataNormalizer.normalizeBooleans)
    * [.normalizeNumbers(layer)](#module_LayerDataNormalizer..LayerDataNormalizer.normalizeNumbers)
    * [.normalizeLayers(layers)](#module_LayerDataNormalizer..LayerDataNormalizer.normalizeLayers) ⇒ <code>Array</code>
    * [.normalizeLayerData(layerData)](#module_LayerDataNormalizer..LayerDataNormalizer.normalizeLayerData) ⇒ <code>Object</code>
    * [.getBooleanProperties()](#module_LayerDataNormalizer..LayerDataNormalizer.getBooleanProperties) ⇒ <code>Array.&lt;string&gt;</code>
    * [.getNumericProperties()](#module_LayerDataNormalizer..LayerDataNormalizer.getNumericProperties) ⇒ <code>Array.&lt;string&gt;</code>
    * [.toBoolean(val)](#module_LayerDataNormalizer..LayerDataNormalizer.toBoolean) ⇒ <code>boolean</code> \| <code>undefined</code>

<a name="module_LayerDataNormalizer..LayerDataNormalizer.normalizeLayer"></a>

#### LayerDataNormalizer.normalizeLayer(layer) ⇒ <code>Object</code>
Normalize a single layer's propertiesConverts string/numeric representations to proper JavaScript types.Modifies the layer object in place for performance.

**Kind**: static method of [<code>LayerDataNormalizer</code>](#module_LayerDataNormalizer..LayerDataNormalizer)  
**Returns**: <code>Object</code> - The same layer object (for chaining)  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | The layer object to normalize |

<a name="module_LayerDataNormalizer..LayerDataNormalizer.normalizeBooleans"></a>

#### LayerDataNormalizer.normalizeBooleans(layer)
Normalize boolean properties on a layer

**Kind**: static method of [<code>LayerDataNormalizer</code>](#module_LayerDataNormalizer..LayerDataNormalizer)  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | The layer object |

<a name="module_LayerDataNormalizer..LayerDataNormalizer.normalizeNumbers"></a>

#### LayerDataNormalizer.normalizeNumbers(layer)
Normalize numeric properties on a layer

**Kind**: static method of [<code>LayerDataNormalizer</code>](#module_LayerDataNormalizer..LayerDataNormalizer)  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | The layer object |

<a name="module_LayerDataNormalizer..LayerDataNormalizer.normalizeLayers"></a>

#### LayerDataNormalizer.normalizeLayers(layers) ⇒ <code>Array</code>
Normalize an array of layers

**Kind**: static method of [<code>LayerDataNormalizer</code>](#module_LayerDataNormalizer..LayerDataNormalizer)  
**Returns**: <code>Array</code> - The same array (for chaining)  

| Param | Type | Description |
| --- | --- | --- |
| layers | <code>Array</code> | Array of layer objects |

<a name="module_LayerDataNormalizer..LayerDataNormalizer.normalizeLayerData"></a>

#### LayerDataNormalizer.normalizeLayerData(layerData) ⇒ <code>Object</code>
Normalize a layer data structure (with layers array inside)Handles the common case where layer data is wrapped:{ layers: [...], baseWidth: N, baseHeight: N }

**Kind**: static method of [<code>LayerDataNormalizer</code>](#module_LayerDataNormalizer..LayerDataNormalizer)  
**Returns**: <code>Object</code> - The same object (for chaining)  

| Param | Type | Description |
| --- | --- | --- |
| layerData | <code>Object</code> | Layer data object with layers array |

<a name="module_LayerDataNormalizer..LayerDataNormalizer.getBooleanProperties"></a>

#### LayerDataNormalizer.getBooleanProperties() ⇒ <code>Array.&lt;string&gt;</code>
Get the list of boolean properties that are normalizedUseful for testing and documentation

**Kind**: static method of [<code>LayerDataNormalizer</code>](#module_LayerDataNormalizer..LayerDataNormalizer)  
**Returns**: <code>Array.&lt;string&gt;</code> - Array of property names  
<a name="module_LayerDataNormalizer..LayerDataNormalizer.getNumericProperties"></a>

#### LayerDataNormalizer.getNumericProperties() ⇒ <code>Array.&lt;string&gt;</code>
Get the list of numeric properties that are normalizedUseful for testing and documentation

**Kind**: static method of [<code>LayerDataNormalizer</code>](#module_LayerDataNormalizer..LayerDataNormalizer)  
**Returns**: <code>Array.&lt;string&gt;</code> - Array of property names  
<a name="module_LayerDataNormalizer..LayerDataNormalizer.toBoolean"></a>

#### LayerDataNormalizer.toBoolean(val) ⇒ <code>boolean</code> \| <code>undefined</code>
Convert a value to boolean using the same logic as normalizationUseful for checking values without modifying objects

**Kind**: static method of [<code>LayerDataNormalizer</code>](#module_LayerDataNormalizer..LayerDataNormalizer)  
**Returns**: <code>boolean</code> \| <code>undefined</code> - Boolean value, or undefined if not a boolean representation  

| Param | Type | Description |
| --- | --- | --- |
| val | <code>\*</code> | Value to convert |

<a name="module_LayerRenderer"></a>

## LayerRenderer
LayerRenderer - Shared rendering engine for Layers extensionThis module provides a unified rendering implementation used by both:- LayersViewer (read-only article display)- CanvasRenderer/ShapeRenderer (editor)By centralizing rendering logic here, we ensure:1. Visual consistency between viewer and editor2. Single source of truth for bug fixes3. Reduced code duplication (~1,000 lines eliminated)Shadow rendering is delegated to ShadowRenderer for clean separation of concerns.

**Since**: 0.9.0  

* [LayerRenderer](#module_LayerRenderer)
    * [~LayerRenderer](#module_LayerRenderer..LayerRenderer)
        * [new LayerRenderer(ctx, [config])](#new_module_LayerRenderer..LayerRenderer_new)
        * [.setContext(ctx)](#module_LayerRenderer..LayerRenderer+setContext)
        * [.setZoom(zoom)](#module_LayerRenderer..LayerRenderer+setZoom)
        * [.setBackgroundImage(img)](#module_LayerRenderer..LayerRenderer+setBackgroundImage)
        * [.setCanvas(canvas)](#module_LayerRenderer..LayerRenderer+setCanvas)
        * [.setBaseDimensions(width, height)](#module_LayerRenderer..LayerRenderer+setBaseDimensions)
        * [.clearShadow()](#module_LayerRenderer..LayerRenderer+clearShadow)
        * [.applyShadow()](#module_LayerRenderer..LayerRenderer+applyShadow)
        * [.getShadowSpread()](#module_LayerRenderer..LayerRenderer+getShadowSpread)
        * [.hasShadowEnabled()](#module_LayerRenderer..LayerRenderer+hasShadowEnabled)
        * [.getShadowParams()](#module_LayerRenderer..LayerRenderer+getShadowParams)
        * [.drawSpreadShadow()](#module_LayerRenderer..LayerRenderer+drawSpreadShadow)
        * [.drawSpreadShadowStroke()](#module_LayerRenderer..LayerRenderer+drawSpreadShadowStroke)
        * [.withLocalAlpha()](#module_LayerRenderer..LayerRenderer+withLocalAlpha)
        * [._prepareRenderOptions()](#module_LayerRenderer..LayerRenderer+_prepareRenderOptions)
        * [.drawRectangle()](#module_LayerRenderer..LayerRenderer+drawRectangle)
        * [.drawTextBox()](#module_LayerRenderer..LayerRenderer+drawTextBox)
        * [.drawCircle()](#module_LayerRenderer..LayerRenderer+drawCircle)
        * [.drawEllipse()](#module_LayerRenderer..LayerRenderer+drawEllipse)
        * [.drawLine()](#module_LayerRenderer..LayerRenderer+drawLine)
        * [.drawArrow()](#module_LayerRenderer..LayerRenderer+drawArrow)
        * [.drawPolygon()](#module_LayerRenderer..LayerRenderer+drawPolygon)
        * [.drawStar()](#module_LayerRenderer..LayerRenderer+drawStar)
        * [.drawPath()](#module_LayerRenderer..LayerRenderer+drawPath)
        * [.drawBlur()](#module_LayerRenderer..LayerRenderer+drawBlur)
        * [.drawImage(layer, [options])](#module_LayerRenderer..LayerRenderer+drawImage)
        * [._getImageElement(layer)](#module_LayerRenderer..LayerRenderer+_getImageElement) ⇒ <code>HTMLImageElement</code> \| <code>null</code>
        * [._drawImagePlaceholder(layer, scale)](#module_LayerRenderer..LayerRenderer+_drawImagePlaceholder)
        * [.drawText()](#module_LayerRenderer..LayerRenderer+drawText)
        * [.drawLayer(layer, [options])](#module_LayerRenderer..LayerRenderer+drawLayer)
        * [.destroy()](#module_LayerRenderer..LayerRenderer+destroy)

<a name="module_LayerRenderer..LayerRenderer"></a>

### LayerRenderer~LayerRenderer
LayerRenderer class - Renders individual layer shapes on a canvas

**Kind**: inner class of [<code>LayerRenderer</code>](#module_LayerRenderer)  

* [~LayerRenderer](#module_LayerRenderer..LayerRenderer)
    * [new LayerRenderer(ctx, [config])](#new_module_LayerRenderer..LayerRenderer_new)
    * [.setContext(ctx)](#module_LayerRenderer..LayerRenderer+setContext)
    * [.setZoom(zoom)](#module_LayerRenderer..LayerRenderer+setZoom)
    * [.setBackgroundImage(img)](#module_LayerRenderer..LayerRenderer+setBackgroundImage)
    * [.setCanvas(canvas)](#module_LayerRenderer..LayerRenderer+setCanvas)
    * [.setBaseDimensions(width, height)](#module_LayerRenderer..LayerRenderer+setBaseDimensions)
    * [.clearShadow()](#module_LayerRenderer..LayerRenderer+clearShadow)
    * [.applyShadow()](#module_LayerRenderer..LayerRenderer+applyShadow)
    * [.getShadowSpread()](#module_LayerRenderer..LayerRenderer+getShadowSpread)
    * [.hasShadowEnabled()](#module_LayerRenderer..LayerRenderer+hasShadowEnabled)
    * [.getShadowParams()](#module_LayerRenderer..LayerRenderer+getShadowParams)
    * [.drawSpreadShadow()](#module_LayerRenderer..LayerRenderer+drawSpreadShadow)
    * [.drawSpreadShadowStroke()](#module_LayerRenderer..LayerRenderer+drawSpreadShadowStroke)
    * [.withLocalAlpha()](#module_LayerRenderer..LayerRenderer+withLocalAlpha)
    * [._prepareRenderOptions()](#module_LayerRenderer..LayerRenderer+_prepareRenderOptions)
    * [.drawRectangle()](#module_LayerRenderer..LayerRenderer+drawRectangle)
    * [.drawTextBox()](#module_LayerRenderer..LayerRenderer+drawTextBox)
    * [.drawCircle()](#module_LayerRenderer..LayerRenderer+drawCircle)
    * [.drawEllipse()](#module_LayerRenderer..LayerRenderer+drawEllipse)
    * [.drawLine()](#module_LayerRenderer..LayerRenderer+drawLine)
    * [.drawArrow()](#module_LayerRenderer..LayerRenderer+drawArrow)
    * [.drawPolygon()](#module_LayerRenderer..LayerRenderer+drawPolygon)
    * [.drawStar()](#module_LayerRenderer..LayerRenderer+drawStar)
    * [.drawPath()](#module_LayerRenderer..LayerRenderer+drawPath)
    * [.drawBlur()](#module_LayerRenderer..LayerRenderer+drawBlur)
    * [.drawImage(layer, [options])](#module_LayerRenderer..LayerRenderer+drawImage)
    * [._getImageElement(layer)](#module_LayerRenderer..LayerRenderer+_getImageElement) ⇒ <code>HTMLImageElement</code> \| <code>null</code>
    * [._drawImagePlaceholder(layer, scale)](#module_LayerRenderer..LayerRenderer+_drawImagePlaceholder)
    * [.drawText()](#module_LayerRenderer..LayerRenderer+drawText)
    * [.drawLayer(layer, [options])](#module_LayerRenderer..LayerRenderer+drawLayer)
    * [.destroy()](#module_LayerRenderer..LayerRenderer+destroy)

<a name="new_module_LayerRenderer..LayerRenderer_new"></a>

#### new LayerRenderer(ctx, [config])
Creates a new LayerRenderer instance


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| ctx | <code>CanvasRenderingContext2D</code> |  | Canvas 2D rendering context |
| [config] | <code>Object</code> |  | Configuration options |
| [config.zoom] | <code>number</code> | <code>1</code> | Current zoom level (for editor) |
| [config.backgroundImage] | <code>HTMLImageElement</code> |  | Background image for blur effects |
| [config.canvas] | <code>HTMLCanvasElement</code> |  | Canvas element reference |
| [config.baseWidth] | <code>number</code> |  | Original image width for scaling (viewer mode) |
| [config.baseHeight] | <code>number</code> |  | Original image height for scaling (viewer mode) |
| [config.onImageLoad] | <code>function</code> |  | Callback when an image layer finishes loading |

<a name="module_LayerRenderer..LayerRenderer+setContext"></a>

#### layerRenderer.setContext(ctx)
Update the rendering contextUsed when rendering to a different context (e.g., export canvas)

**Kind**: instance method of [<code>LayerRenderer</code>](#module_LayerRenderer..LayerRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| ctx | <code>CanvasRenderingContext2D</code> | New rendering context |

<a name="module_LayerRenderer..LayerRenderer+setZoom"></a>

#### layerRenderer.setZoom(zoom)
Update the zoom level

**Kind**: instance method of [<code>LayerRenderer</code>](#module_LayerRenderer..LayerRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| zoom | <code>number</code> | New zoom level |

<a name="module_LayerRenderer..LayerRenderer+setBackgroundImage"></a>

#### layerRenderer.setBackgroundImage(img)
Set the background image (used for blur effects)

**Kind**: instance method of [<code>LayerRenderer</code>](#module_LayerRenderer..LayerRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| img | <code>HTMLImageElement</code> | Background image |

<a name="module_LayerRenderer..LayerRenderer+setCanvas"></a>

#### layerRenderer.setCanvas(canvas)
Set the canvas reference

**Kind**: instance method of [<code>LayerRenderer</code>](#module_LayerRenderer..LayerRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| canvas | <code>HTMLCanvasElement</code> | Canvas element |

<a name="module_LayerRenderer..LayerRenderer+setBaseDimensions"></a>

#### layerRenderer.setBaseDimensions(width, height)
Set base dimensions for scaling (viewer mode)

**Kind**: instance method of [<code>LayerRenderer</code>](#module_LayerRenderer..LayerRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| width | <code>number</code> | Original image width |
| height | <code>number</code> | Original image height |

<a name="module_LayerRenderer..LayerRenderer+clearShadow"></a>

#### layerRenderer.clearShadow()
Clear shadow settings from context

**Kind**: instance method of [<code>LayerRenderer</code>](#module_LayerRenderer..LayerRenderer)  
<a name="module_LayerRenderer..LayerRenderer+applyShadow"></a>

#### layerRenderer.applyShadow()
Apply shadow settings to context (blur and offset only, not spread)

**Kind**: instance method of [<code>LayerRenderer</code>](#module_LayerRenderer..LayerRenderer)  
<a name="module_LayerRenderer..LayerRenderer+getShadowSpread"></a>

#### layerRenderer.getShadowSpread()
Get shadow spread value from layer

**Kind**: instance method of [<code>LayerRenderer</code>](#module_LayerRenderer..LayerRenderer)  
<a name="module_LayerRenderer..LayerRenderer+hasShadowEnabled"></a>

#### layerRenderer.hasShadowEnabled()
Check if shadow is enabled on a layer

**Kind**: instance method of [<code>LayerRenderer</code>](#module_LayerRenderer..LayerRenderer)  
<a name="module_LayerRenderer..LayerRenderer+getShadowParams"></a>

#### layerRenderer.getShadowParams()
Get shadow parameters for offscreen rendering technique

**Kind**: instance method of [<code>LayerRenderer</code>](#module_LayerRenderer..LayerRenderer)  
<a name="module_LayerRenderer..LayerRenderer+drawSpreadShadow"></a>

#### layerRenderer.drawSpreadShadow()
Draw a spread shadow using offscreen canvas technique

**Kind**: instance method of [<code>LayerRenderer</code>](#module_LayerRenderer..LayerRenderer)  
<a name="module_LayerRenderer..LayerRenderer+drawSpreadShadowStroke"></a>

#### layerRenderer.drawSpreadShadowStroke()
Draw a spread shadow for stroked shapes using offscreen canvas

**Kind**: instance method of [<code>LayerRenderer</code>](#module_LayerRenderer..LayerRenderer)  
<a name="module_LayerRenderer..LayerRenderer+withLocalAlpha"></a>

#### layerRenderer.withLocalAlpha()
Execute a function with a temporary globalAlpha multiplier

**Kind**: instance method of [<code>LayerRenderer</code>](#module_LayerRenderer..LayerRenderer)  
<a name="module_LayerRenderer..LayerRenderer+_prepareRenderOptions"></a>

#### layerRenderer.\_prepareRenderOptions()
Helper to prepare options for renderer delegation

**Kind**: instance method of [<code>LayerRenderer</code>](#module_LayerRenderer..LayerRenderer)  
<a name="module_LayerRenderer..LayerRenderer+drawRectangle"></a>

#### layerRenderer.drawRectangle()
Draw a rectangle shape

**Kind**: instance method of [<code>LayerRenderer</code>](#module_LayerRenderer..LayerRenderer)  
<a name="module_LayerRenderer..LayerRenderer+drawTextBox"></a>

#### layerRenderer.drawTextBox()
Draw a text box shape (rectangle with multi-line text)

**Kind**: instance method of [<code>LayerRenderer</code>](#module_LayerRenderer..LayerRenderer)  
<a name="module_LayerRenderer..LayerRenderer+drawCircle"></a>

#### layerRenderer.drawCircle()
Draw a circle shape

**Kind**: instance method of [<code>LayerRenderer</code>](#module_LayerRenderer..LayerRenderer)  
<a name="module_LayerRenderer..LayerRenderer+drawEllipse"></a>

#### layerRenderer.drawEllipse()
Draw an ellipse shape

**Kind**: instance method of [<code>LayerRenderer</code>](#module_LayerRenderer..LayerRenderer)  
<a name="module_LayerRenderer..LayerRenderer+drawLine"></a>

#### layerRenderer.drawLine()
Draw a line shape

**Kind**: instance method of [<code>LayerRenderer</code>](#module_LayerRenderer..LayerRenderer)  
<a name="module_LayerRenderer..LayerRenderer+drawArrow"></a>

#### layerRenderer.drawArrow()
Draw an arrow as a closed polygon

**Kind**: instance method of [<code>LayerRenderer</code>](#module_LayerRenderer..LayerRenderer)  
<a name="module_LayerRenderer..LayerRenderer+drawPolygon"></a>

#### layerRenderer.drawPolygon()
Draw a polygon shape

**Kind**: instance method of [<code>LayerRenderer</code>](#module_LayerRenderer..LayerRenderer)  
<a name="module_LayerRenderer..LayerRenderer+drawStar"></a>

#### layerRenderer.drawStar()
Draw a star shape

**Kind**: instance method of [<code>LayerRenderer</code>](#module_LayerRenderer..LayerRenderer)  
<a name="module_LayerRenderer..LayerRenderer+drawPath"></a>

#### layerRenderer.drawPath()
Draw a freehand path

**Kind**: instance method of [<code>LayerRenderer</code>](#module_LayerRenderer..LayerRenderer)  
<a name="module_LayerRenderer..LayerRenderer+drawBlur"></a>

#### layerRenderer.drawBlur()
Draw a blur effect region

**Kind**: instance method of [<code>LayerRenderer</code>](#module_LayerRenderer..LayerRenderer)  
<a name="module_LayerRenderer..LayerRenderer+drawImage"></a>

#### layerRenderer.drawImage(layer, [options])
Draw an image layer

**Kind**: instance method of [<code>LayerRenderer</code>](#module_LayerRenderer..LayerRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Image layer with src, x, y, width, height properties |
| [options] | <code>Object</code> | Rendering options |

<a name="module_LayerRenderer..LayerRenderer+_getImageElement"></a>

#### layerRenderer.\_getImageElement(layer) ⇒ <code>HTMLImageElement</code> \| <code>null</code>
Get or create cached image element for a layer

**Kind**: instance method of [<code>LayerRenderer</code>](#module_LayerRenderer..LayerRenderer)  
**Returns**: <code>HTMLImageElement</code> \| <code>null</code> - - Image element or null if not available  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Image layer |

<a name="module_LayerRenderer..LayerRenderer+_drawImagePlaceholder"></a>

#### layerRenderer.\_drawImagePlaceholder(layer, scale)
Draw a placeholder while image is loading

**Kind**: instance method of [<code>LayerRenderer</code>](#module_LayerRenderer..LayerRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Image layer |
| scale | <code>Object</code> | Scale factors |

<a name="module_LayerRenderer..LayerRenderer+drawText"></a>

#### layerRenderer.drawText()
Draw a text layer

**Kind**: instance method of [<code>LayerRenderer</code>](#module_LayerRenderer..LayerRenderer)  
<a name="module_LayerRenderer..LayerRenderer+drawLayer"></a>

#### layerRenderer.drawLayer(layer, [options])
Draw a layer by type (dispatcher method)

**Kind**: instance method of [<code>LayerRenderer</code>](#module_LayerRenderer..LayerRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer to draw |
| [options] | <code>Object</code> | Rendering options |

<a name="module_LayerRenderer..LayerRenderer+destroy"></a>

#### layerRenderer.destroy()
Clean up resources

**Kind**: instance method of [<code>LayerRenderer</code>](#module_LayerRenderer..LayerRenderer)  
<a name="module_PolygonStarRenderer"></a>

## PolygonStarRenderer
PolygonStarRenderer - Specialized polygon and star shape renderingExtracted from ShapeRenderer.js to reduce file size and improve maintainability.This module handles rendering of complex polygon shapes:- Polygon (regular n-gons with optional rounded corners)- Star (with customizable points and valley radii)All shapes support:- Fill and stroke with separate opacities- Shadow rendering with spread support- Rotation- Scaling- Rounded corners (via PolygonGeometry)

**Since**: 1.1.7  

* [PolygonStarRenderer](#module_PolygonStarRenderer)
    * [~PolygonStarRenderer](#module_PolygonStarRenderer..PolygonStarRenderer)
        * [new PolygonStarRenderer(ctx, [config])](#new_module_PolygonStarRenderer..PolygonStarRenderer_new)
        * [.setShapeRenderer(shapeRenderer)](#module_PolygonStarRenderer..PolygonStarRenderer+setShapeRenderer)
        * [.setContext(ctx)](#module_PolygonStarRenderer..PolygonStarRenderer+setContext)
        * [.clearShadow()](#module_PolygonStarRenderer..PolygonStarRenderer+clearShadow)
        * [.hasShadowEnabled(layer)](#module_PolygonStarRenderer..PolygonStarRenderer+hasShadowEnabled) ⇒ <code>boolean</code>
        * [.getShadowSpread(layer, scale)](#module_PolygonStarRenderer..PolygonStarRenderer+getShadowSpread) ⇒ <code>number</code>
        * [.drawSpreadShadow(layer, scale, spread, drawPathFn, opacity)](#module_PolygonStarRenderer..PolygonStarRenderer+drawSpreadShadow)
        * [.drawSpreadShadowStroke(layer, scale, strokeWidth, drawPathFn, opacity)](#module_PolygonStarRenderer..PolygonStarRenderer+drawSpreadShadowStroke)
        * [.drawRoundedPolygonPath(vertices, cornerRadius)](#module_PolygonStarRenderer..PolygonStarRenderer+drawRoundedPolygonPath)
        * [.drawRoundedStarPath(vertices, pointRadius, valleyRadius)](#module_PolygonStarRenderer..PolygonStarRenderer+drawRoundedStarPath)
        * [.drawPolygon(layer, [options])](#module_PolygonStarRenderer..PolygonStarRenderer+drawPolygon)
        * [.drawStar(layer, [options])](#module_PolygonStarRenderer..PolygonStarRenderer+drawStar)
        * [.destroy()](#module_PolygonStarRenderer..PolygonStarRenderer+destroy)

<a name="module_PolygonStarRenderer..PolygonStarRenderer"></a>

### PolygonStarRenderer~PolygonStarRenderer
PolygonStarRenderer class - Renders polygon and star shapes on canvas

**Kind**: inner class of [<code>PolygonStarRenderer</code>](#module_PolygonStarRenderer)  

* [~PolygonStarRenderer](#module_PolygonStarRenderer..PolygonStarRenderer)
    * [new PolygonStarRenderer(ctx, [config])](#new_module_PolygonStarRenderer..PolygonStarRenderer_new)
    * [.setShapeRenderer(shapeRenderer)](#module_PolygonStarRenderer..PolygonStarRenderer+setShapeRenderer)
    * [.setContext(ctx)](#module_PolygonStarRenderer..PolygonStarRenderer+setContext)
    * [.clearShadow()](#module_PolygonStarRenderer..PolygonStarRenderer+clearShadow)
    * [.hasShadowEnabled(layer)](#module_PolygonStarRenderer..PolygonStarRenderer+hasShadowEnabled) ⇒ <code>boolean</code>
    * [.getShadowSpread(layer, scale)](#module_PolygonStarRenderer..PolygonStarRenderer+getShadowSpread) ⇒ <code>number</code>
    * [.drawSpreadShadow(layer, scale, spread, drawPathFn, opacity)](#module_PolygonStarRenderer..PolygonStarRenderer+drawSpreadShadow)
    * [.drawSpreadShadowStroke(layer, scale, strokeWidth, drawPathFn, opacity)](#module_PolygonStarRenderer..PolygonStarRenderer+drawSpreadShadowStroke)
    * [.drawRoundedPolygonPath(vertices, cornerRadius)](#module_PolygonStarRenderer..PolygonStarRenderer+drawRoundedPolygonPath)
    * [.drawRoundedStarPath(vertices, pointRadius, valleyRadius)](#module_PolygonStarRenderer..PolygonStarRenderer+drawRoundedStarPath)
    * [.drawPolygon(layer, [options])](#module_PolygonStarRenderer..PolygonStarRenderer+drawPolygon)
    * [.drawStar(layer, [options])](#module_PolygonStarRenderer..PolygonStarRenderer+drawStar)
    * [.destroy()](#module_PolygonStarRenderer..PolygonStarRenderer+destroy)

<a name="new_module_PolygonStarRenderer..PolygonStarRenderer_new"></a>

#### new PolygonStarRenderer(ctx, [config])
Creates a new PolygonStarRenderer instance


| Param | Type | Description |
| --- | --- | --- |
| ctx | <code>CanvasRenderingContext2D</code> | Canvas 2D rendering context |
| [config] | <code>Object</code> | Configuration options |
| [config.shapeRenderer] | <code>Object</code> | Parent ShapeRenderer for shadow methods |

<a name="module_PolygonStarRenderer..PolygonStarRenderer+setShapeRenderer"></a>

#### polygonStarRenderer.setShapeRenderer(shapeRenderer)
Set the parent shape renderer for shadow delegation

**Kind**: instance method of [<code>PolygonStarRenderer</code>](#module_PolygonStarRenderer..PolygonStarRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| shapeRenderer | <code>Object</code> | ShapeRenderer instance |

<a name="module_PolygonStarRenderer..PolygonStarRenderer+setContext"></a>

#### polygonStarRenderer.setContext(ctx)
Set the context

**Kind**: instance method of [<code>PolygonStarRenderer</code>](#module_PolygonStarRenderer..PolygonStarRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| ctx | <code>CanvasRenderingContext2D</code> | Canvas context |

<a name="module_PolygonStarRenderer..PolygonStarRenderer+clearShadow"></a>

#### polygonStarRenderer.clearShadow()
Clear shadow settings from context

**Kind**: instance method of [<code>PolygonStarRenderer</code>](#module_PolygonStarRenderer..PolygonStarRenderer)  
<a name="module_PolygonStarRenderer..PolygonStarRenderer+hasShadowEnabled"></a>

#### polygonStarRenderer.hasShadowEnabled(layer) ⇒ <code>boolean</code>
Check if layer has shadow enabled

**Kind**: instance method of [<code>PolygonStarRenderer</code>](#module_PolygonStarRenderer..PolygonStarRenderer)  
**Returns**: <code>boolean</code> - True if shadow is enabled  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer to check |

<a name="module_PolygonStarRenderer..PolygonStarRenderer+getShadowSpread"></a>

#### polygonStarRenderer.getShadowSpread(layer, scale) ⇒ <code>number</code>
Get shadow spread value

**Kind**: instance method of [<code>PolygonStarRenderer</code>](#module_PolygonStarRenderer..PolygonStarRenderer)  
**Returns**: <code>number</code> - Shadow spread value  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer with shadow properties |
| scale | <code>Object</code> | Scale factors |

<a name="module_PolygonStarRenderer..PolygonStarRenderer+drawSpreadShadow"></a>

#### polygonStarRenderer.drawSpreadShadow(layer, scale, spread, drawPathFn, opacity)
Draw shadow with spread effect for fills

**Kind**: instance method of [<code>PolygonStarRenderer</code>](#module_PolygonStarRenderer..PolygonStarRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer with shadow properties |
| scale | <code>Object</code> | Scale factors |
| spread | <code>number</code> | Spread amount |
| drawPathFn | <code>function</code> | Function to draw the path |
| opacity | <code>number</code> | Opacity value |

<a name="module_PolygonStarRenderer..PolygonStarRenderer+drawSpreadShadowStroke"></a>

#### polygonStarRenderer.drawSpreadShadowStroke(layer, scale, strokeWidth, drawPathFn, opacity)
Draw shadow with spread effect for strokes

**Kind**: instance method of [<code>PolygonStarRenderer</code>](#module_PolygonStarRenderer..PolygonStarRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer with shadow properties |
| scale | <code>Object</code> | Scale factors |
| strokeWidth | <code>number</code> | Expanded stroke width |
| drawPathFn | <code>function</code> | Function to draw the path |
| opacity | <code>number</code> | Opacity value |

<a name="module_PolygonStarRenderer..PolygonStarRenderer+drawRoundedPolygonPath"></a>

#### polygonStarRenderer.drawRoundedPolygonPath(vertices, cornerRadius)
Draw a rounded polygon path on the contextUses arcTo for smooth rounded corners at each vertex.

**Kind**: instance method of [<code>PolygonStarRenderer</code>](#module_PolygonStarRenderer..PolygonStarRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| vertices | <code>Array.&lt;{x: number, y: number}&gt;</code> | Array of vertex points |
| cornerRadius | <code>number</code> | Radius for rounded corners |

<a name="module_PolygonStarRenderer..PolygonStarRenderer+drawRoundedStarPath"></a>

#### polygonStarRenderer.drawRoundedStarPath(vertices, pointRadius, valleyRadius)
Draw a rounded star path on the context with different radii for points and valleys

**Kind**: instance method of [<code>PolygonStarRenderer</code>](#module_PolygonStarRenderer..PolygonStarRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| vertices | <code>Array.&lt;{x: number, y: number}&gt;</code> | Array of vertex points (alternating outer/inner) |
| pointRadius | <code>number</code> | Radius for outer point corners |
| valleyRadius | <code>number</code> | Radius for inner valley corners |

<a name="module_PolygonStarRenderer..PolygonStarRenderer+drawPolygon"></a>

#### polygonStarRenderer.drawPolygon(layer, [options])
Draw a regular polygon shape

**Kind**: instance method of [<code>PolygonStarRenderer</code>](#module_PolygonStarRenderer..PolygonStarRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer with polygon properties (sides, x, y, radius, cornerRadius) |
| [options] | <code>Object</code> | Rendering options |
| [options.scale] | <code>Object</code> | Scale factors {sx, sy, avg} |
| [options.shadowScale] | <code>Object</code> | Shadow scale factors |
| [options.scaled] | <code>boolean</code> | Whether coords are pre-scaled |

<a name="module_PolygonStarRenderer..PolygonStarRenderer+drawStar"></a>

#### polygonStarRenderer.drawStar(layer, [options])
Draw a star shape

**Kind**: instance method of [<code>PolygonStarRenderer</code>](#module_PolygonStarRenderer..PolygonStarRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer with star properties (points, x, y, outerRadius, innerRadius, pointRadius, valleyRadius) |
| [options] | <code>Object</code> | Rendering options |
| [options.scale] | <code>Object</code> | Scale factors {sx, sy, avg} |
| [options.shadowScale] | <code>Object</code> | Shadow scale factors |
| [options.scaled] | <code>boolean</code> | Whether coords are pre-scaled |

<a name="module_PolygonStarRenderer..PolygonStarRenderer+destroy"></a>

#### polygonStarRenderer.destroy()
Clean up resources

**Kind**: instance method of [<code>PolygonStarRenderer</code>](#module_PolygonStarRenderer..PolygonStarRenderer)  
<a name="module_ShadowRenderer"></a>

## ShadowRenderer
ShadowRenderer - Shadow rendering engine for Layers extensionExtracted from LayerRenderer to handle all shadow-related rendering logic:- Standard canvas shadows- Shadow spread via offscreen canvas technique- Rotation-aware shadow renderingThis module is used by LayerRenderer for consistent shadow handling acrossall shape types.

**Since**: 0.9.1  

* [ShadowRenderer](#module_ShadowRenderer)
    * [~ShadowRenderer](#module_ShadowRenderer..ShadowRenderer)
        * [new ShadowRenderer(ctx, [config])](#new_module_ShadowRenderer..ShadowRenderer_new)
        * [.setCanvas(canvas)](#module_ShadowRenderer..ShadowRenderer+setCanvas)
        * [.setContext(ctx)](#module_ShadowRenderer..ShadowRenderer+setContext)
        * [.clearShadow()](#module_ShadowRenderer..ShadowRenderer+clearShadow)
        * [.applyShadow(layer, scale)](#module_ShadowRenderer..ShadowRenderer+applyShadow)
        * [.hasShadowEnabled(layer)](#module_ShadowRenderer..ShadowRenderer+hasShadowEnabled) ⇒ <code>boolean</code>
        * [.getShadowSpread(layer, scale)](#module_ShadowRenderer..ShadowRenderer+getShadowSpread) ⇒ <code>number</code>
        * [.getShadowParams(layer, scale)](#module_ShadowRenderer..ShadowRenderer+getShadowParams) ⇒ <code>Object</code>
        * [.drawSpreadShadow(layer, scale, spread, drawExpandedPathFn, [opacity])](#module_ShadowRenderer..ShadowRenderer+drawSpreadShadow)
        * [.drawSpreadShadowStroke(layer, scale, strokeWidth, drawPathFn, [opacity])](#module_ShadowRenderer..ShadowRenderer+drawSpreadShadowStroke)
        * [.withLocalAlpha(alpha, drawFn)](#module_ShadowRenderer..ShadowRenderer+withLocalAlpha)
        * [.destroy()](#module_ShadowRenderer..ShadowRenderer+destroy)

<a name="module_ShadowRenderer..ShadowRenderer"></a>

### ShadowRenderer~ShadowRenderer
ShadowRenderer class - Handles shadow rendering for layer shapes

**Kind**: inner class of [<code>ShadowRenderer</code>](#module_ShadowRenderer)  

* [~ShadowRenderer](#module_ShadowRenderer..ShadowRenderer)
    * [new ShadowRenderer(ctx, [config])](#new_module_ShadowRenderer..ShadowRenderer_new)
    * [.setCanvas(canvas)](#module_ShadowRenderer..ShadowRenderer+setCanvas)
    * [.setContext(ctx)](#module_ShadowRenderer..ShadowRenderer+setContext)
    * [.clearShadow()](#module_ShadowRenderer..ShadowRenderer+clearShadow)
    * [.applyShadow(layer, scale)](#module_ShadowRenderer..ShadowRenderer+applyShadow)
    * [.hasShadowEnabled(layer)](#module_ShadowRenderer..ShadowRenderer+hasShadowEnabled) ⇒ <code>boolean</code>
    * [.getShadowSpread(layer, scale)](#module_ShadowRenderer..ShadowRenderer+getShadowSpread) ⇒ <code>number</code>
    * [.getShadowParams(layer, scale)](#module_ShadowRenderer..ShadowRenderer+getShadowParams) ⇒ <code>Object</code>
    * [.drawSpreadShadow(layer, scale, spread, drawExpandedPathFn, [opacity])](#module_ShadowRenderer..ShadowRenderer+drawSpreadShadow)
    * [.drawSpreadShadowStroke(layer, scale, strokeWidth, drawPathFn, [opacity])](#module_ShadowRenderer..ShadowRenderer+drawSpreadShadowStroke)
    * [.withLocalAlpha(alpha, drawFn)](#module_ShadowRenderer..ShadowRenderer+withLocalAlpha)
    * [.destroy()](#module_ShadowRenderer..ShadowRenderer+destroy)

<a name="new_module_ShadowRenderer..ShadowRenderer_new"></a>

#### new ShadowRenderer(ctx, [config])
Creates a new ShadowRenderer instance


| Param | Type | Description |
| --- | --- | --- |
| ctx | <code>CanvasRenderingContext2D</code> | Canvas 2D rendering context |
| [config] | <code>Object</code> | Configuration options |
| [config.canvas] | <code>HTMLCanvasElement</code> | Canvas element reference |

<a name="module_ShadowRenderer..ShadowRenderer+setCanvas"></a>

#### shadowRenderer.setCanvas(canvas)
Set the canvas reference

**Kind**: instance method of [<code>ShadowRenderer</code>](#module_ShadowRenderer..ShadowRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| canvas | <code>HTMLCanvasElement</code> | Canvas element |

<a name="module_ShadowRenderer..ShadowRenderer+setContext"></a>

#### shadowRenderer.setContext(ctx)
Update the context reference

**Kind**: instance method of [<code>ShadowRenderer</code>](#module_ShadowRenderer..ShadowRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| ctx | <code>CanvasRenderingContext2D</code> | New context |

<a name="module_ShadowRenderer..ShadowRenderer+clearShadow"></a>

#### shadowRenderer.clearShadow()
Clear shadow settings from context

**Kind**: instance method of [<code>ShadowRenderer</code>](#module_ShadowRenderer..ShadowRenderer)  
<a name="module_ShadowRenderer..ShadowRenderer+applyShadow"></a>

#### shadowRenderer.applyShadow(layer, scale)
Apply shadow settings to context (blur and offset only, not spread)

**Kind**: instance method of [<code>ShadowRenderer</code>](#module_ShadowRenderer..ShadowRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer with shadow properties |
| scale | <code>Object</code> | Scale factors {sx, sy, avg} |

<a name="module_ShadowRenderer..ShadowRenderer+hasShadowEnabled"></a>

#### shadowRenderer.hasShadowEnabled(layer) ⇒ <code>boolean</code>
Check if shadow is enabled on a layer

**Kind**: instance method of [<code>ShadowRenderer</code>](#module_ShadowRenderer..ShadowRenderer)  
**Returns**: <code>boolean</code> - True if shadow is enabled  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer to check |

<a name="module_ShadowRenderer..ShadowRenderer+getShadowSpread"></a>

#### shadowRenderer.getShadowSpread(layer, scale) ⇒ <code>number</code>
Get shadow spread value from layer

**Kind**: instance method of [<code>ShadowRenderer</code>](#module_ShadowRenderer..ShadowRenderer)  
**Returns**: <code>number</code> - Spread value in pixels (scaled)  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer with shadow properties |
| scale | <code>Object</code> | Scale factors |

<a name="module_ShadowRenderer..ShadowRenderer+getShadowParams"></a>

#### shadowRenderer.getShadowParams(layer, scale) ⇒ <code>Object</code>
Get shadow parameters for offscreen rendering technique

**Kind**: instance method of [<code>ShadowRenderer</code>](#module_ShadowRenderer..ShadowRenderer)  
**Returns**: <code>Object</code> - Shadow parameters {offsetX, offsetY, blur, color, offscreenOffset}  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer with shadow properties |
| scale | <code>Object</code> | Scale factors |

<a name="module_ShadowRenderer..ShadowRenderer+drawSpreadShadow"></a>

#### shadowRenderer.drawSpreadShadow(layer, scale, spread, drawExpandedPathFn, [opacity])
Draw a spread shadow using offscreen canvas technique.This renders ONLY the shadow (not the shape) with the spread expansion.The technique: We need to draw an expanded shape to cast a larger shadow, then removethe shape while keeping the shadow. The challenge is that when we erase the shape,we might also erase part of the shadow that overlaps with it.Solution: Draw the shape offset horizontally by a large amount (FAR_OFFSET), thenadjust the shadow offset to compensate. This puts the shadow at the correct positionwhile keeping the shape far away, so erasing the shape doesn't affect the shadow.

**Kind**: instance method of [<code>ShadowRenderer</code>](#module_ShadowRenderer..ShadowRenderer)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| layer | <code>Object</code> |  | Layer with shadow properties |
| scale | <code>Object</code> |  | Scale factors |
| spread | <code>number</code> |  | Spread amount in pixels (already scaled) |
| drawExpandedPathFn | <code>function</code> |  | Function(ctx) that creates the expanded path on the provided context |
| [opacity] | <code>number</code> | <code>1</code> | Opacity to apply to the shadow (0-1) |

<a name="module_ShadowRenderer..ShadowRenderer+drawSpreadShadowStroke"></a>

#### shadowRenderer.drawSpreadShadowStroke(layer, scale, strokeWidth, drawPathFn, [opacity])
Draw a spread shadow for stroked shapes (lines, paths) using offscreen canvas.Similar to drawSpreadShadow but uses stroke() instead of fill().Uses the same FAR_OFFSET technique to separate the stroke from its shadow.

**Kind**: instance method of [<code>ShadowRenderer</code>](#module_ShadowRenderer..ShadowRenderer)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| layer | <code>Object</code> |  | Layer with shadow properties |
| scale | <code>Object</code> |  | Scale factors |
| strokeWidth | <code>number</code> |  | The expanded stroke width to use |
| drawPathFn | <code>function</code> |  | Function(ctx) that creates the path on the provided context |
| [opacity] | <code>number</code> | <code>1</code> | Opacity to apply to the shadow (0-1) |

<a name="module_ShadowRenderer..ShadowRenderer+withLocalAlpha"></a>

#### shadowRenderer.withLocalAlpha(alpha, drawFn)
Execute a function with a temporary globalAlpha multiplier

**Kind**: instance method of [<code>ShadowRenderer</code>](#module_ShadowRenderer..ShadowRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| alpha | <code>number</code> \| <code>undefined</code> | Opacity multiplier (0-1) |
| drawFn | <code>function</code> | Drawing function to execute |

<a name="module_ShadowRenderer..ShadowRenderer+destroy"></a>

#### shadowRenderer.destroy()
Clean up resources

**Kind**: instance method of [<code>ShadowRenderer</code>](#module_ShadowRenderer..ShadowRenderer)  
<a name="module_ShapeRenderer"></a>

## ShapeRenderer
ShapeRenderer - Specialized basic shape renderingExtracted from LayerRenderer.js to reduce file size and improve maintainability.This module handles rendering of basic geometric shapes:- Rectangle (with rounded corners)- Circle- Ellipse- Polygon (regular n-gons)- StarAll shapes support:- Fill and stroke with separate opacities- Shadow rendering with spread support- Rotation- Scaling

**Since**: 0.9.1  

* [ShapeRenderer](#module_ShapeRenderer)
    * [~ShapeRenderer](#module_ShapeRenderer..ShapeRenderer)
        * [new ShapeRenderer(ctx, [config])](#new_module_ShapeRenderer..ShapeRenderer_new)
        * [.setShadowRenderer(shadowRenderer)](#module_ShapeRenderer..ShapeRenderer+setShadowRenderer)
        * [.setPolygonStarRenderer(polygonStarRenderer)](#module_ShapeRenderer..ShapeRenderer+setPolygonStarRenderer)
        * [.setContext(ctx)](#module_ShapeRenderer..ShapeRenderer+setContext)
        * [.clearShadow()](#module_ShapeRenderer..ShapeRenderer+clearShadow)
        * [.applyShadow(layer, scale)](#module_ShapeRenderer..ShapeRenderer+applyShadow)
        * [.hasShadowEnabled(layer)](#module_ShapeRenderer..ShapeRenderer+hasShadowEnabled) ⇒ <code>boolean</code>
        * [.getShadowSpread(layer, scale)](#module_ShapeRenderer..ShapeRenderer+getShadowSpread) ⇒ <code>number</code>
        * [.drawSpreadShadow(layer, scale, spread, drawPathFn, opacity)](#module_ShapeRenderer..ShapeRenderer+drawSpreadShadow)
        * [.drawSpreadShadowStroke(layer, scale, strokeWidth, drawPathFn, opacity)](#module_ShapeRenderer..ShapeRenderer+drawSpreadShadowStroke)
        * [.drawRoundedPolygonPath(vertices, cornerRadius)](#module_ShapeRenderer..ShapeRenderer+drawRoundedPolygonPath)
        * [.drawRoundedStarPath(vertices, pointRadius, valleyRadius)](#module_ShapeRenderer..ShapeRenderer+drawRoundedStarPath)
        * [.drawRectangle(layer, [options])](#module_ShapeRenderer..ShapeRenderer+drawRectangle)
        * [.drawRoundedRectPath(x, y, width, height, radius, [context])](#module_ShapeRenderer..ShapeRenderer+drawRoundedRectPath)
        * [.drawCircle(layer, [options])](#module_ShapeRenderer..ShapeRenderer+drawCircle)
        * [.drawEllipse(layer, [options])](#module_ShapeRenderer..ShapeRenderer+drawEllipse)
        * [.drawPolygon(layer, [options])](#module_ShapeRenderer..ShapeRenderer+drawPolygon)
        * [.drawStar(layer, [options])](#module_ShapeRenderer..ShapeRenderer+drawStar)
        * [.drawLine(layer, [options])](#module_ShapeRenderer..ShapeRenderer+drawLine)
        * [.drawPath(layer, [options])](#module_ShapeRenderer..ShapeRenderer+drawPath)
        * [.destroy()](#module_ShapeRenderer..ShapeRenderer+destroy)

<a name="module_ShapeRenderer..ShapeRenderer"></a>

### ShapeRenderer~ShapeRenderer
ShapeRenderer class - Renders basic geometric shapes on canvas

**Kind**: inner class of [<code>ShapeRenderer</code>](#module_ShapeRenderer)  

* [~ShapeRenderer](#module_ShapeRenderer..ShapeRenderer)
    * [new ShapeRenderer(ctx, [config])](#new_module_ShapeRenderer..ShapeRenderer_new)
    * [.setShadowRenderer(shadowRenderer)](#module_ShapeRenderer..ShapeRenderer+setShadowRenderer)
    * [.setPolygonStarRenderer(polygonStarRenderer)](#module_ShapeRenderer..ShapeRenderer+setPolygonStarRenderer)
    * [.setContext(ctx)](#module_ShapeRenderer..ShapeRenderer+setContext)
    * [.clearShadow()](#module_ShapeRenderer..ShapeRenderer+clearShadow)
    * [.applyShadow(layer, scale)](#module_ShapeRenderer..ShapeRenderer+applyShadow)
    * [.hasShadowEnabled(layer)](#module_ShapeRenderer..ShapeRenderer+hasShadowEnabled) ⇒ <code>boolean</code>
    * [.getShadowSpread(layer, scale)](#module_ShapeRenderer..ShapeRenderer+getShadowSpread) ⇒ <code>number</code>
    * [.drawSpreadShadow(layer, scale, spread, drawPathFn, opacity)](#module_ShapeRenderer..ShapeRenderer+drawSpreadShadow)
    * [.drawSpreadShadowStroke(layer, scale, strokeWidth, drawPathFn, opacity)](#module_ShapeRenderer..ShapeRenderer+drawSpreadShadowStroke)
    * [.drawRoundedPolygonPath(vertices, cornerRadius)](#module_ShapeRenderer..ShapeRenderer+drawRoundedPolygonPath)
    * [.drawRoundedStarPath(vertices, pointRadius, valleyRadius)](#module_ShapeRenderer..ShapeRenderer+drawRoundedStarPath)
    * [.drawRectangle(layer, [options])](#module_ShapeRenderer..ShapeRenderer+drawRectangle)
    * [.drawRoundedRectPath(x, y, width, height, radius, [context])](#module_ShapeRenderer..ShapeRenderer+drawRoundedRectPath)
    * [.drawCircle(layer, [options])](#module_ShapeRenderer..ShapeRenderer+drawCircle)
    * [.drawEllipse(layer, [options])](#module_ShapeRenderer..ShapeRenderer+drawEllipse)
    * [.drawPolygon(layer, [options])](#module_ShapeRenderer..ShapeRenderer+drawPolygon)
    * [.drawStar(layer, [options])](#module_ShapeRenderer..ShapeRenderer+drawStar)
    * [.drawLine(layer, [options])](#module_ShapeRenderer..ShapeRenderer+drawLine)
    * [.drawPath(layer, [options])](#module_ShapeRenderer..ShapeRenderer+drawPath)
    * [.destroy()](#module_ShapeRenderer..ShapeRenderer+destroy)

<a name="new_module_ShapeRenderer..ShapeRenderer_new"></a>

#### new ShapeRenderer(ctx, [config])
Creates a new ShapeRenderer instance


| Param | Type | Description |
| --- | --- | --- |
| ctx | <code>CanvasRenderingContext2D</code> | Canvas 2D rendering context |
| [config] | <code>Object</code> | Configuration options |
| [config.shadowRenderer] | <code>Object</code> | ShadowRenderer instance for shadow operations |
| [config.polygonStarRenderer] | <code>Object</code> | PolygonStarRenderer instance for polygon/star shapes |

<a name="module_ShapeRenderer..ShapeRenderer+setShadowRenderer"></a>

#### shapeRenderer.setShadowRenderer(shadowRenderer)
Set the shadow renderer instance

**Kind**: instance method of [<code>ShapeRenderer</code>](#module_ShapeRenderer..ShapeRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| shadowRenderer | <code>Object</code> | ShadowRenderer instance |

<a name="module_ShapeRenderer..ShapeRenderer+setPolygonStarRenderer"></a>

#### shapeRenderer.setPolygonStarRenderer(polygonStarRenderer)
Set the polygon/star renderer instance

**Kind**: instance method of [<code>ShapeRenderer</code>](#module_ShapeRenderer..ShapeRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| polygonStarRenderer | <code>Object</code> | PolygonStarRenderer instance |

<a name="module_ShapeRenderer..ShapeRenderer+setContext"></a>

#### shapeRenderer.setContext(ctx)
Set the context

**Kind**: instance method of [<code>ShapeRenderer</code>](#module_ShapeRenderer..ShapeRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| ctx | <code>CanvasRenderingContext2D</code> | Canvas context |

<a name="module_ShapeRenderer..ShapeRenderer+clearShadow"></a>

#### shapeRenderer.clearShadow()
Clear shadow settings from context

**Kind**: instance method of [<code>ShapeRenderer</code>](#module_ShapeRenderer..ShapeRenderer)  
<a name="module_ShapeRenderer..ShapeRenderer+applyShadow"></a>

#### shapeRenderer.applyShadow(layer, scale)
Apply shadow settings to context

**Kind**: instance method of [<code>ShapeRenderer</code>](#module_ShapeRenderer..ShapeRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer with shadow properties |
| scale | <code>Object</code> | Scale factors |

<a name="module_ShapeRenderer..ShapeRenderer+hasShadowEnabled"></a>

#### shapeRenderer.hasShadowEnabled(layer) ⇒ <code>boolean</code>
Check if shadow is enabled on a layer

**Kind**: instance method of [<code>ShapeRenderer</code>](#module_ShapeRenderer..ShapeRenderer)  
**Returns**: <code>boolean</code> - True if shadow is enabled  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer to check |

<a name="module_ShapeRenderer..ShapeRenderer+getShadowSpread"></a>

#### shapeRenderer.getShadowSpread(layer, scale) ⇒ <code>number</code>
Get shadow spread value from layer

**Kind**: instance method of [<code>ShapeRenderer</code>](#module_ShapeRenderer..ShapeRenderer)  
**Returns**: <code>number</code> - Spread value in pixels  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer with shadow properties |
| scale | <code>Object</code> | Scale factors |

<a name="module_ShapeRenderer..ShapeRenderer+drawSpreadShadow"></a>

#### shapeRenderer.drawSpreadShadow(layer, scale, spread, drawPathFn, opacity)
Draw spread shadow for a filled shape

**Kind**: instance method of [<code>ShapeRenderer</code>](#module_ShapeRenderer..ShapeRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer with shadow properties |
| scale | <code>Object</code> | Scale factors |
| spread | <code>number</code> | Spread amount |
| drawPathFn | <code>function</code> | Function to draw the path |
| opacity | <code>number</code> | Opacity for the shadow |

<a name="module_ShapeRenderer..ShapeRenderer+drawSpreadShadowStroke"></a>

#### shapeRenderer.drawSpreadShadowStroke(layer, scale, strokeWidth, drawPathFn, opacity)
Draw spread shadow for a stroked shape

**Kind**: instance method of [<code>ShapeRenderer</code>](#module_ShapeRenderer..ShapeRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer with shadow properties |
| scale | <code>Object</code> | Scale factors |
| strokeWidth | <code>number</code> | Stroke width |
| drawPathFn | <code>function</code> | Function to draw the path |
| opacity | <code>number</code> | Opacity for the shadow |

<a name="module_ShapeRenderer..ShapeRenderer+drawRoundedPolygonPath"></a>

#### shapeRenderer.drawRoundedPolygonPath(vertices, cornerRadius)
Draw a rounded polygon path on the contextDelegates to PolygonStarRenderer if available

**Kind**: instance method of [<code>ShapeRenderer</code>](#module_ShapeRenderer..ShapeRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| vertices | <code>Array.&lt;{x: number, y: number}&gt;</code> | Array of vertex points |
| cornerRadius | <code>number</code> | Radius for rounded corners |

<a name="module_ShapeRenderer..ShapeRenderer+drawRoundedStarPath"></a>

#### shapeRenderer.drawRoundedStarPath(vertices, pointRadius, valleyRadius)
Draw a rounded star path on the context with different radii for points and valleysDelegates to PolygonStarRenderer if available

**Kind**: instance method of [<code>ShapeRenderer</code>](#module_ShapeRenderer..ShapeRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| vertices | <code>Array.&lt;{x: number, y: number}&gt;</code> | Array of vertex points (alternating outer/inner) |
| pointRadius | <code>number</code> | Radius for outer point corners |
| valleyRadius | <code>number</code> | Radius for inner valley corners |

<a name="module_ShapeRenderer..ShapeRenderer+drawRectangle"></a>

#### shapeRenderer.drawRectangle(layer, [options])
Draw a rectangle shape

**Kind**: instance method of [<code>ShapeRenderer</code>](#module_ShapeRenderer..ShapeRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer with rectangle properties |
| [options] | <code>Object</code> | Rendering options |
| [options.scale] | <code>Object</code> | Scale factors {sx, sy, avg} |
| [options.shadowScale] | <code>Object</code> | Shadow scale factors |
| [options.scaled] | <code>boolean</code> | Whether coords are pre-scaled |

<a name="module_ShapeRenderer..ShapeRenderer+drawRoundedRectPath"></a>

#### shapeRenderer.drawRoundedRectPath(x, y, width, height, radius, [context])
Draw a rounded rectangle path (fallback for browsers without roundRect)

**Kind**: instance method of [<code>ShapeRenderer</code>](#module_ShapeRenderer..ShapeRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| x | <code>number</code> | X position |
| y | <code>number</code> | Y position |
| width | <code>number</code> | Width |
| height | <code>number</code> | Height |
| radius | <code>number</code> | Corner radius |
| [context] | <code>CanvasRenderingContext2D</code> | Optional context (defaults to this.ctx) |

<a name="module_ShapeRenderer..ShapeRenderer+drawCircle"></a>

#### shapeRenderer.drawCircle(layer, [options])
Draw a circle shape

**Kind**: instance method of [<code>ShapeRenderer</code>](#module_ShapeRenderer..ShapeRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer with circle properties (x, y center, radius) |
| [options] | <code>Object</code> | Rendering options |

<a name="module_ShapeRenderer..ShapeRenderer+drawEllipse"></a>

#### shapeRenderer.drawEllipse(layer, [options])
Draw an ellipse shape

**Kind**: instance method of [<code>ShapeRenderer</code>](#module_ShapeRenderer..ShapeRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer with ellipse properties |
| [options] | <code>Object</code> | Rendering options |

<a name="module_ShapeRenderer..ShapeRenderer+drawPolygon"></a>

#### shapeRenderer.drawPolygon(layer, [options])
Draw a regular polygon shapeDelegates to PolygonStarRenderer if available

**Kind**: instance method of [<code>ShapeRenderer</code>](#module_ShapeRenderer..ShapeRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer with polygon properties (sides, x, y, radius, cornerRadius) |
| [options] | <code>Object</code> | Rendering options |

<a name="module_ShapeRenderer..ShapeRenderer+drawStar"></a>

#### shapeRenderer.drawStar(layer, [options])
Draw a star shapeDelegates to PolygonStarRenderer if available

**Kind**: instance method of [<code>ShapeRenderer</code>](#module_ShapeRenderer..ShapeRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer with star properties (points, x, y, outerRadius, innerRadius, pointRadius, valleyRadius) |
| [options] | <code>Object</code> | Rendering options |

<a name="module_ShapeRenderer..ShapeRenderer+drawLine"></a>

#### shapeRenderer.drawLine(layer, [options])
Draw a line shape

**Kind**: instance method of [<code>ShapeRenderer</code>](#module_ShapeRenderer..ShapeRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer with line properties (x1, y1, x2, y2) |
| [options] | <code>Object</code> | Rendering options |

<a name="module_ShapeRenderer..ShapeRenderer+drawPath"></a>

#### shapeRenderer.drawPath(layer, [options])
Draw a freehand path

**Kind**: instance method of [<code>ShapeRenderer</code>](#module_ShapeRenderer..ShapeRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer with points array |
| [options] | <code>Object</code> | Rendering options |

<a name="module_ShapeRenderer..ShapeRenderer+destroy"></a>

#### shapeRenderer.destroy()
Clean up resources

**Kind**: instance method of [<code>ShapeRenderer</code>](#module_ShapeRenderer..ShapeRenderer)  
<a name="module_TextBoxRenderer"></a>

## TextBoxRenderer
TextBoxRenderer - Specialized text box renderingExtracted from ShapeRenderer.js to reduce file size and improve maintainability.This module handles rendering of text box shapes:- Rectangle container with rounded corners- Multi-line text with word wrapping- Text alignment (horizontal and vertical)- Text stroke and shadow effects

**Since**: 1.1.1  

* [TextBoxRenderer](#module_TextBoxRenderer)
    * [~TextBoxRenderer](#module_TextBoxRenderer..TextBoxRenderer)
        * [new TextBoxRenderer(ctx, [config])](#new_module_TextBoxRenderer..TextBoxRenderer_new)
        * [.setShadowRenderer(shadowRenderer)](#module_TextBoxRenderer..TextBoxRenderer+setShadowRenderer)
        * [.setContext(ctx)](#module_TextBoxRenderer..TextBoxRenderer+setContext)
        * [.clearShadow()](#module_TextBoxRenderer..TextBoxRenderer+clearShadow)
        * [.hasShadowEnabled(layer)](#module_TextBoxRenderer..TextBoxRenderer+hasShadowEnabled) ⇒ <code>boolean</code>
        * [.getShadowSpread(layer, scale)](#module_TextBoxRenderer..TextBoxRenderer+getShadowSpread) ⇒ <code>number</code>
        * [.drawSpreadShadow(layer, scale, spread, drawPathFn, opacity)](#module_TextBoxRenderer..TextBoxRenderer+drawSpreadShadow)
        * [.drawSpreadShadowStroke(layer, scale, strokeWidth, drawPathFn, opacity)](#module_TextBoxRenderer..TextBoxRenderer+drawSpreadShadowStroke)
        * [.drawRoundedRectPath(x, y, width, height, radius, [context])](#module_TextBoxRenderer..TextBoxRenderer+drawRoundedRectPath)
        * [.draw(layer, [options])](#module_TextBoxRenderer..TextBoxRenderer+draw)
        * [.wrapText(text, maxWidth, fontSize, fontFamily, [fontWeight], [fontStyle])](#module_TextBoxRenderer..TextBoxRenderer+wrapText) ⇒ <code>Array.&lt;string&gt;</code>
        * [.destroy()](#module_TextBoxRenderer..TextBoxRenderer+destroy)

<a name="module_TextBoxRenderer..TextBoxRenderer"></a>

### TextBoxRenderer~TextBoxRenderer
TextBoxRenderer class - Renders text box shapes on canvas

**Kind**: inner class of [<code>TextBoxRenderer</code>](#module_TextBoxRenderer)  

* [~TextBoxRenderer](#module_TextBoxRenderer..TextBoxRenderer)
    * [new TextBoxRenderer(ctx, [config])](#new_module_TextBoxRenderer..TextBoxRenderer_new)
    * [.setShadowRenderer(shadowRenderer)](#module_TextBoxRenderer..TextBoxRenderer+setShadowRenderer)
    * [.setContext(ctx)](#module_TextBoxRenderer..TextBoxRenderer+setContext)
    * [.clearShadow()](#module_TextBoxRenderer..TextBoxRenderer+clearShadow)
    * [.hasShadowEnabled(layer)](#module_TextBoxRenderer..TextBoxRenderer+hasShadowEnabled) ⇒ <code>boolean</code>
    * [.getShadowSpread(layer, scale)](#module_TextBoxRenderer..TextBoxRenderer+getShadowSpread) ⇒ <code>number</code>
    * [.drawSpreadShadow(layer, scale, spread, drawPathFn, opacity)](#module_TextBoxRenderer..TextBoxRenderer+drawSpreadShadow)
    * [.drawSpreadShadowStroke(layer, scale, strokeWidth, drawPathFn, opacity)](#module_TextBoxRenderer..TextBoxRenderer+drawSpreadShadowStroke)
    * [.drawRoundedRectPath(x, y, width, height, radius, [context])](#module_TextBoxRenderer..TextBoxRenderer+drawRoundedRectPath)
    * [.draw(layer, [options])](#module_TextBoxRenderer..TextBoxRenderer+draw)
    * [.wrapText(text, maxWidth, fontSize, fontFamily, [fontWeight], [fontStyle])](#module_TextBoxRenderer..TextBoxRenderer+wrapText) ⇒ <code>Array.&lt;string&gt;</code>
    * [.destroy()](#module_TextBoxRenderer..TextBoxRenderer+destroy)

<a name="new_module_TextBoxRenderer..TextBoxRenderer_new"></a>

#### new TextBoxRenderer(ctx, [config])
Creates a new TextBoxRenderer instance


| Param | Type | Description |
| --- | --- | --- |
| ctx | <code>CanvasRenderingContext2D</code> | Canvas 2D rendering context |
| [config] | <code>Object</code> | Configuration options |
| [config.shadowRenderer] | <code>Object</code> | ShadowRenderer instance for shadow operations |

<a name="module_TextBoxRenderer..TextBoxRenderer+setShadowRenderer"></a>

#### textBoxRenderer.setShadowRenderer(shadowRenderer)
Set the shadow renderer instance

**Kind**: instance method of [<code>TextBoxRenderer</code>](#module_TextBoxRenderer..TextBoxRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| shadowRenderer | <code>Object</code> | ShadowRenderer instance |

<a name="module_TextBoxRenderer..TextBoxRenderer+setContext"></a>

#### textBoxRenderer.setContext(ctx)
Set the context

**Kind**: instance method of [<code>TextBoxRenderer</code>](#module_TextBoxRenderer..TextBoxRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| ctx | <code>CanvasRenderingContext2D</code> | Canvas context |

<a name="module_TextBoxRenderer..TextBoxRenderer+clearShadow"></a>

#### textBoxRenderer.clearShadow()
Clear shadow settings from context

**Kind**: instance method of [<code>TextBoxRenderer</code>](#module_TextBoxRenderer..TextBoxRenderer)  
<a name="module_TextBoxRenderer..TextBoxRenderer+hasShadowEnabled"></a>

#### textBoxRenderer.hasShadowEnabled(layer) ⇒ <code>boolean</code>
Check if shadow is enabled on a layer

**Kind**: instance method of [<code>TextBoxRenderer</code>](#module_TextBoxRenderer..TextBoxRenderer)  
**Returns**: <code>boolean</code> - True if shadow is enabled  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer to check |

<a name="module_TextBoxRenderer..TextBoxRenderer+getShadowSpread"></a>

#### textBoxRenderer.getShadowSpread(layer, scale) ⇒ <code>number</code>
Get shadow spread value from layer

**Kind**: instance method of [<code>TextBoxRenderer</code>](#module_TextBoxRenderer..TextBoxRenderer)  
**Returns**: <code>number</code> - Spread value in pixels  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer with shadow properties |
| scale | <code>Object</code> | Scale factors |

<a name="module_TextBoxRenderer..TextBoxRenderer+drawSpreadShadow"></a>

#### textBoxRenderer.drawSpreadShadow(layer, scale, spread, drawPathFn, opacity)
Draw spread shadow for a filled shape

**Kind**: instance method of [<code>TextBoxRenderer</code>](#module_TextBoxRenderer..TextBoxRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer with shadow properties |
| scale | <code>Object</code> | Scale factors |
| spread | <code>number</code> | Spread amount |
| drawPathFn | <code>function</code> | Function to draw the path |
| opacity | <code>number</code> | Opacity for the shadow |

<a name="module_TextBoxRenderer..TextBoxRenderer+drawSpreadShadowStroke"></a>

#### textBoxRenderer.drawSpreadShadowStroke(layer, scale, strokeWidth, drawPathFn, opacity)
Draw spread shadow for a stroked shape

**Kind**: instance method of [<code>TextBoxRenderer</code>](#module_TextBoxRenderer..TextBoxRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer with shadow properties |
| scale | <code>Object</code> | Scale factors |
| strokeWidth | <code>number</code> | Stroke width |
| drawPathFn | <code>function</code> | Function to draw the path |
| opacity | <code>number</code> | Opacity for the shadow |

<a name="module_TextBoxRenderer..TextBoxRenderer+drawRoundedRectPath"></a>

#### textBoxRenderer.drawRoundedRectPath(x, y, width, height, radius, [context])
Draw a rounded rectangle path (fallback for browsers without roundRect)

**Kind**: instance method of [<code>TextBoxRenderer</code>](#module_TextBoxRenderer..TextBoxRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| x | <code>number</code> | X position |
| y | <code>number</code> | Y position |
| width | <code>number</code> | Width |
| height | <code>number</code> | Height |
| radius | <code>number</code> | Corner radius |
| [context] | <code>CanvasRenderingContext2D</code> | Optional context (defaults to this.ctx) |

<a name="module_TextBoxRenderer..TextBoxRenderer+draw"></a>

#### textBoxRenderer.draw(layer, [options])
Draw a text box shape (rectangle with multi-line text)Text is clipped to the box boundaries

**Kind**: instance method of [<code>TextBoxRenderer</code>](#module_TextBoxRenderer..TextBoxRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer with textbox properties |
| [options] | <code>Object</code> | Rendering options |
| [options.scale] | <code>Object</code> | Scale factors {sx, sy, avg} |
| [options.shadowScale] | <code>Object</code> | Shadow scale factors |
| [options.scaled] | <code>boolean</code> | Whether coords are pre-scaled |

<a name="module_TextBoxRenderer..TextBoxRenderer+wrapText"></a>

#### textBoxRenderer.wrapText(text, maxWidth, fontSize, fontFamily, [fontWeight], [fontStyle]) ⇒ <code>Array.&lt;string&gt;</code>
Wrap text to fit within a given width

**Kind**: instance method of [<code>TextBoxRenderer</code>](#module_TextBoxRenderer..TextBoxRenderer)  
**Returns**: <code>Array.&lt;string&gt;</code> - Array of wrapped lines  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| text | <code>string</code> |  | Text to wrap |
| maxWidth | <code>number</code> |  | Maximum width for each line |
| fontSize | <code>number</code> |  | Font size in pixels |
| fontFamily | <code>string</code> |  | Font family |
| [fontWeight] | <code>string</code> | <code>&quot;&#x27;normal&#x27;&quot;</code> | Font weight (normal or bold) |
| [fontStyle] | <code>string</code> | <code>&quot;&#x27;normal&#x27;&quot;</code> | Font style (normal or italic) |

<a name="module_TextBoxRenderer..TextBoxRenderer+destroy"></a>

#### textBoxRenderer.destroy()
Clean up resources

**Kind**: instance method of [<code>TextBoxRenderer</code>](#module_TextBoxRenderer..TextBoxRenderer)  
<a name="module_TextRenderer"></a>

## TextRenderer
TextRenderer - Specialized text shape renderingExtracted from LayerRenderer.js to reduce file size and improve maintainability.This module handles all text-related rendering including:- Font sizing and family- Text alignment- Text stroke (outline)- Shadow rendering with spread support- Rotation around text center

**Since**: 0.9.1  

* [TextRenderer](#module_TextRenderer)
    * [~TextRenderer](#module_TextRenderer..TextRenderer)
        * [new TextRenderer(ctx, [config])](#new_module_TextRenderer..TextRenderer_new)
        * [.setShadowRenderer(shadowRenderer)](#module_TextRenderer..TextRenderer+setShadowRenderer)
        * [.setContext(ctx)](#module_TextRenderer..TextRenderer+setContext)
        * [.clearShadow()](#module_TextRenderer..TextRenderer+clearShadow)
        * [.applyShadow(layer, scale)](#module_TextRenderer..TextRenderer+applyShadow)
        * [.hasShadowEnabled(layer)](#module_TextRenderer..TextRenderer+hasShadowEnabled) ⇒ <code>boolean</code>
        * [.getShadowSpread(layer, scale)](#module_TextRenderer..TextRenderer+getShadowSpread) ⇒ <code>number</code>
        * [.getShadowParams(layer, scale)](#module_TextRenderer..TextRenderer+getShadowParams) ⇒ <code>Object</code>
        * [.draw(layer, [options])](#module_TextRenderer..TextRenderer+draw)
        * [.measureText(text, fontSize, fontFamily)](#module_TextRenderer..TextRenderer+measureText) ⇒ <code>Object</code>
        * [.destroy()](#module_TextRenderer..TextRenderer+destroy)

<a name="module_TextRenderer..TextRenderer"></a>

### TextRenderer~TextRenderer
TextRenderer class - Renders text shapes on canvas

**Kind**: inner class of [<code>TextRenderer</code>](#module_TextRenderer)  

* [~TextRenderer](#module_TextRenderer..TextRenderer)
    * [new TextRenderer(ctx, [config])](#new_module_TextRenderer..TextRenderer_new)
    * [.setShadowRenderer(shadowRenderer)](#module_TextRenderer..TextRenderer+setShadowRenderer)
    * [.setContext(ctx)](#module_TextRenderer..TextRenderer+setContext)
    * [.clearShadow()](#module_TextRenderer..TextRenderer+clearShadow)
    * [.applyShadow(layer, scale)](#module_TextRenderer..TextRenderer+applyShadow)
    * [.hasShadowEnabled(layer)](#module_TextRenderer..TextRenderer+hasShadowEnabled) ⇒ <code>boolean</code>
    * [.getShadowSpread(layer, scale)](#module_TextRenderer..TextRenderer+getShadowSpread) ⇒ <code>number</code>
    * [.getShadowParams(layer, scale)](#module_TextRenderer..TextRenderer+getShadowParams) ⇒ <code>Object</code>
    * [.draw(layer, [options])](#module_TextRenderer..TextRenderer+draw)
    * [.measureText(text, fontSize, fontFamily)](#module_TextRenderer..TextRenderer+measureText) ⇒ <code>Object</code>
    * [.destroy()](#module_TextRenderer..TextRenderer+destroy)

<a name="new_module_TextRenderer..TextRenderer_new"></a>

#### new TextRenderer(ctx, [config])
Creates a new TextRenderer instance


| Param | Type | Description |
| --- | --- | --- |
| ctx | <code>CanvasRenderingContext2D</code> | Canvas 2D rendering context |
| [config] | <code>Object</code> | Configuration options |
| [config.shadowRenderer] | <code>Object</code> | ShadowRenderer instance for shadow operations |

<a name="module_TextRenderer..TextRenderer+setShadowRenderer"></a>

#### textRenderer.setShadowRenderer(shadowRenderer)
Set the shadow renderer instance

**Kind**: instance method of [<code>TextRenderer</code>](#module_TextRenderer..TextRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| shadowRenderer | <code>Object</code> | ShadowRenderer instance |

<a name="module_TextRenderer..TextRenderer+setContext"></a>

#### textRenderer.setContext(ctx)
Set the context

**Kind**: instance method of [<code>TextRenderer</code>](#module_TextRenderer..TextRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| ctx | <code>CanvasRenderingContext2D</code> | Canvas context |

<a name="module_TextRenderer..TextRenderer+clearShadow"></a>

#### textRenderer.clearShadow()
Clear shadow settings from context

**Kind**: instance method of [<code>TextRenderer</code>](#module_TextRenderer..TextRenderer)  
<a name="module_TextRenderer..TextRenderer+applyShadow"></a>

#### textRenderer.applyShadow(layer, scale)
Apply shadow settings to context

**Kind**: instance method of [<code>TextRenderer</code>](#module_TextRenderer..TextRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer with shadow properties |
| scale | <code>Object</code> | Scale factors |

<a name="module_TextRenderer..TextRenderer+hasShadowEnabled"></a>

#### textRenderer.hasShadowEnabled(layer) ⇒ <code>boolean</code>
Check if shadow is enabled on a layer

**Kind**: instance method of [<code>TextRenderer</code>](#module_TextRenderer..TextRenderer)  
**Returns**: <code>boolean</code> - True if shadow is enabled  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer to check |

<a name="module_TextRenderer..TextRenderer+getShadowSpread"></a>

#### textRenderer.getShadowSpread(layer, scale) ⇒ <code>number</code>
Get shadow spread value from layer

**Kind**: instance method of [<code>TextRenderer</code>](#module_TextRenderer..TextRenderer)  
**Returns**: <code>number</code> - Spread value in pixels  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer with shadow properties |
| scale | <code>Object</code> | Scale factors |

<a name="module_TextRenderer..TextRenderer+getShadowParams"></a>

#### textRenderer.getShadowParams(layer, scale) ⇒ <code>Object</code>
Get shadow parameters for rendering

**Kind**: instance method of [<code>TextRenderer</code>](#module_TextRenderer..TextRenderer)  
**Returns**: <code>Object</code> - Shadow parameters {color, blur, offsetX, offsetY}  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer with shadow properties |
| scale | <code>Object</code> | Scale factors |

<a name="module_TextRenderer..TextRenderer+draw"></a>

#### textRenderer.draw(layer, [options])
Draw a text layer

**Kind**: instance method of [<code>TextRenderer</code>](#module_TextRenderer..TextRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer with text properties |
| [options] | <code>Object</code> | Rendering options |
| [options.scale] | <code>Object</code> | Scale factors {sx, sy, avg} |
| [options.shadowScale] | <code>Object</code> | Shadow scale factors |
| [options.scaled] | <code>boolean</code> | Whether coords are pre-scaled |

<a name="module_TextRenderer..TextRenderer+measureText"></a>

#### textRenderer.measureText(text, fontSize, fontFamily) ⇒ <code>Object</code>
Measure text dimensions

**Kind**: instance method of [<code>TextRenderer</code>](#module_TextRenderer..TextRenderer)  
**Returns**: <code>Object</code> - Dimensions {width, height}  

| Param | Type | Description |
| --- | --- | --- |
| text | <code>string</code> | Text to measure |
| fontSize | <code>number</code> | Font size in pixels |
| fontFamily | <code>string</code> | Font family |

<a name="module_TextRenderer..TextRenderer+destroy"></a>

#### textRenderer.destroy()
Clean up resources

**Kind**: instance method of [<code>TextRenderer</code>](#module_TextRenderer..TextRenderer)  
<a name="AccessibilityAnnouncer"></a>

## AccessibilityAnnouncer
**Kind**: global class  

* [AccessibilityAnnouncer](#AccessibilityAnnouncer)
    * [new AccessibilityAnnouncer()](#new_AccessibilityAnnouncer_new)
    * [.init()](#AccessibilityAnnouncer+init)
    * [.announce(message, [politeness])](#AccessibilityAnnouncer+announce)
    * [.announceError(message)](#AccessibilityAnnouncer+announceError)
    * [.announceSuccess(message)](#AccessibilityAnnouncer+announceSuccess)
    * [.announceTool(toolName)](#AccessibilityAnnouncer+announceTool)
    * [.announceLayerSelection(layerName)](#AccessibilityAnnouncer+announceLayerSelection)
    * [.announceLayerAction(action, [layerName])](#AccessibilityAnnouncer+announceLayerAction)
    * [.clear()](#AccessibilityAnnouncer+clear)
    * [.destroy()](#AccessibilityAnnouncer+destroy)

<a name="new_AccessibilityAnnouncer_new"></a>

### new AccessibilityAnnouncer()
AccessibilityAnnouncer - ARIA live region announcements for screen readersThis module provides a centralized way to announce status changes to screen readers.It creates hidden ARIA live regions that automatically announce changes.Usage:  window.layersAnnouncer.announce( 'Layers saved successfully' );  window.layersAnnouncer.announce( 'Tool changed to Rectangle', 'polite' );  window.layersAnnouncer.announceError( 'Failed to save layers' );

<a name="AccessibilityAnnouncer+init"></a>

### accessibilityAnnouncer.init()
Initialize the ARIA live regionsCalled automatically on first announcement

**Kind**: instance method of [<code>AccessibilityAnnouncer</code>](#AccessibilityAnnouncer)  
<a name="AccessibilityAnnouncer+announce"></a>

### accessibilityAnnouncer.announce(message, [politeness])
Announce a message to screen readers

**Kind**: instance method of [<code>AccessibilityAnnouncer</code>](#AccessibilityAnnouncer)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| message | <code>string</code> |  | The message to announce |
| [politeness] | <code>string</code> | <code>&quot;&#x27;polite&#x27;&quot;</code> | 'polite' for non-urgent, 'assertive' for urgent |

<a name="AccessibilityAnnouncer+announceError"></a>

### accessibilityAnnouncer.announceError(message)
Announce an error message (uses assertive politeness)

**Kind**: instance method of [<code>AccessibilityAnnouncer</code>](#AccessibilityAnnouncer)  

| Param | Type | Description |
| --- | --- | --- |
| message | <code>string</code> | The error message |

<a name="AccessibilityAnnouncer+announceSuccess"></a>

### accessibilityAnnouncer.announceSuccess(message)
Announce a success message

**Kind**: instance method of [<code>AccessibilityAnnouncer</code>](#AccessibilityAnnouncer)  

| Param | Type | Description |
| --- | --- | --- |
| message | <code>string</code> | The success message |

<a name="AccessibilityAnnouncer+announceTool"></a>

### accessibilityAnnouncer.announceTool(toolName)
Announce tool change

**Kind**: instance method of [<code>AccessibilityAnnouncer</code>](#AccessibilityAnnouncer)  

| Param | Type | Description |
| --- | --- | --- |
| toolName | <code>string</code> | The name of the selected tool |

<a name="AccessibilityAnnouncer+announceLayerSelection"></a>

### accessibilityAnnouncer.announceLayerSelection(layerName)
Announce layer selection

**Kind**: instance method of [<code>AccessibilityAnnouncer</code>](#AccessibilityAnnouncer)  

| Param | Type | Description |
| --- | --- | --- |
| layerName | <code>string</code> | The name of the selected layer |

<a name="AccessibilityAnnouncer+announceLayerAction"></a>

### accessibilityAnnouncer.announceLayerAction(action, [layerName])
Announce layer action (delete, duplicate, etc.)

**Kind**: instance method of [<code>AccessibilityAnnouncer</code>](#AccessibilityAnnouncer)  

| Param | Type | Description |
| --- | --- | --- |
| action | <code>string</code> | The action performed |
| [layerName] | <code>string</code> | Optional layer name |

<a name="AccessibilityAnnouncer+clear"></a>

### accessibilityAnnouncer.clear()
Clear announcements

**Kind**: instance method of [<code>AccessibilityAnnouncer</code>](#AccessibilityAnnouncer)  
<a name="AccessibilityAnnouncer+destroy"></a>

### accessibilityAnnouncer.destroy()
Clean up and remove live regions

**Kind**: instance method of [<code>AccessibilityAnnouncer</code>](#AccessibilityAnnouncer)  
<a name="AccessibilityAnnouncer"></a>

## AccessibilityAnnouncer
AccessibilityAnnouncer class

**Kind**: global class  

* [AccessibilityAnnouncer](#AccessibilityAnnouncer)
    * [new AccessibilityAnnouncer()](#new_AccessibilityAnnouncer_new)
    * [.init()](#AccessibilityAnnouncer+init)
    * [.announce(message, [politeness])](#AccessibilityAnnouncer+announce)
    * [.announceError(message)](#AccessibilityAnnouncer+announceError)
    * [.announceSuccess(message)](#AccessibilityAnnouncer+announceSuccess)
    * [.announceTool(toolName)](#AccessibilityAnnouncer+announceTool)
    * [.announceLayerSelection(layerName)](#AccessibilityAnnouncer+announceLayerSelection)
    * [.announceLayerAction(action, [layerName])](#AccessibilityAnnouncer+announceLayerAction)
    * [.clear()](#AccessibilityAnnouncer+clear)
    * [.destroy()](#AccessibilityAnnouncer+destroy)

<a name="new_AccessibilityAnnouncer_new"></a>

### new AccessibilityAnnouncer()
AccessibilityAnnouncer - ARIA live region announcements for screen readersThis module provides a centralized way to announce status changes to screen readers.It creates hidden ARIA live regions that automatically announce changes.Usage:  window.layersAnnouncer.announce( 'Layers saved successfully' );  window.layersAnnouncer.announce( 'Tool changed to Rectangle', 'polite' );  window.layersAnnouncer.announceError( 'Failed to save layers' );

<a name="AccessibilityAnnouncer+init"></a>

### accessibilityAnnouncer.init()
Initialize the ARIA live regionsCalled automatically on first announcement

**Kind**: instance method of [<code>AccessibilityAnnouncer</code>](#AccessibilityAnnouncer)  
<a name="AccessibilityAnnouncer+announce"></a>

### accessibilityAnnouncer.announce(message, [politeness])
Announce a message to screen readers

**Kind**: instance method of [<code>AccessibilityAnnouncer</code>](#AccessibilityAnnouncer)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| message | <code>string</code> |  | The message to announce |
| [politeness] | <code>string</code> | <code>&quot;&#x27;polite&#x27;&quot;</code> | 'polite' for non-urgent, 'assertive' for urgent |

<a name="AccessibilityAnnouncer+announceError"></a>

### accessibilityAnnouncer.announceError(message)
Announce an error message (uses assertive politeness)

**Kind**: instance method of [<code>AccessibilityAnnouncer</code>](#AccessibilityAnnouncer)  

| Param | Type | Description |
| --- | --- | --- |
| message | <code>string</code> | The error message |

<a name="AccessibilityAnnouncer+announceSuccess"></a>

### accessibilityAnnouncer.announceSuccess(message)
Announce a success message

**Kind**: instance method of [<code>AccessibilityAnnouncer</code>](#AccessibilityAnnouncer)  

| Param | Type | Description |
| --- | --- | --- |
| message | <code>string</code> | The success message |

<a name="AccessibilityAnnouncer+announceTool"></a>

### accessibilityAnnouncer.announceTool(toolName)
Announce tool change

**Kind**: instance method of [<code>AccessibilityAnnouncer</code>](#AccessibilityAnnouncer)  

| Param | Type | Description |
| --- | --- | --- |
| toolName | <code>string</code> | The name of the selected tool |

<a name="AccessibilityAnnouncer+announceLayerSelection"></a>

### accessibilityAnnouncer.announceLayerSelection(layerName)
Announce layer selection

**Kind**: instance method of [<code>AccessibilityAnnouncer</code>](#AccessibilityAnnouncer)  

| Param | Type | Description |
| --- | --- | --- |
| layerName | <code>string</code> | The name of the selected layer |

<a name="AccessibilityAnnouncer+announceLayerAction"></a>

### accessibilityAnnouncer.announceLayerAction(action, [layerName])
Announce layer action (delete, duplicate, etc.)

**Kind**: instance method of [<code>AccessibilityAnnouncer</code>](#AccessibilityAnnouncer)  

| Param | Type | Description |
| --- | --- | --- |
| action | <code>string</code> | The action performed |
| [layerName] | <code>string</code> | Optional layer name |

<a name="AccessibilityAnnouncer+clear"></a>

### accessibilityAnnouncer.clear()
Clear announcements

**Kind**: instance method of [<code>AccessibilityAnnouncer</code>](#AccessibilityAnnouncer)  
<a name="AccessibilityAnnouncer+destroy"></a>

### accessibilityAnnouncer.destroy()
Clean up and remove live regions

**Kind**: instance method of [<code>AccessibilityAnnouncer</code>](#AccessibilityAnnouncer)  
<a name="APIErrorHandler"></a>

## APIErrorHandler
**Kind**: global class  

* [APIErrorHandler](#APIErrorHandler)
    * [new APIErrorHandler(options)](#new_APIErrorHandler_new)
    * [.setEditor(editor)](#APIErrorHandler+setEditor)
    * [.setEnableSaveButtonCallback(callback)](#APIErrorHandler+setEnableSaveButtonCallback)
    * [.handleError(error, operation, context)](#APIErrorHandler+handleError) ⇒ <code>Object</code>
    * [.normalizeError(error)](#APIErrorHandler+normalizeError) ⇒ <code>Object</code>
    * [.getUserMessage(normalizedError, operation)](#APIErrorHandler+getUserMessage) ⇒ <code>string</code>
    * [.logError(normalizedError, operation, context)](#APIErrorHandler+logError)
    * [.sanitizeLogMessage(message)](#APIErrorHandler+sanitizeLogMessage) ⇒ <code>string</code>
    * [.sanitizeContext(context)](#APIErrorHandler+sanitizeContext) ⇒ <code>Object</code>
    * [.showUserNotification(message, type)](#APIErrorHandler+showUserNotification)
    * [.reportToErrorHandler(normalizedError, operation, context)](#APIErrorHandler+reportToErrorHandler)
    * [.updateUIForError(operation)](#APIErrorHandler+updateUIForError)
    * [.destroy()](#APIErrorHandler+destroy)

<a name="new_APIErrorHandler_new"></a>

### new APIErrorHandler(options)

| Param | Type | Description |
| --- | --- | --- |
| options | <code>Object</code> | Configuration options |
| options.editor | <code>Object</code> | Reference to the editor instance |
| options.errorConfig | <code>Object</code> | Error code to message key mappings |

<a name="APIErrorHandler+setEditor"></a>

### apiErrorHandler.setEditor(editor)
Set editor reference (for late binding)

**Kind**: instance method of [<code>APIErrorHandler</code>](#APIErrorHandler)  

| Param | Type | Description |
| --- | --- | --- |
| editor | <code>Object</code> | Editor instance |

<a name="APIErrorHandler+setEnableSaveButtonCallback"></a>

### apiErrorHandler.setEnableSaveButtonCallback(callback)
Set callback for enabling save button

**Kind**: instance method of [<code>APIErrorHandler</code>](#APIErrorHandler)  

| Param | Type | Description |
| --- | --- | --- |
| callback | <code>function</code> | Callback function |

<a name="APIErrorHandler+handleError"></a>

### apiErrorHandler.handleError(error, operation, context) ⇒ <code>Object</code>
Centralized error handling with consistent logging and user feedback

**Kind**: instance method of [<code>APIErrorHandler</code>](#APIErrorHandler)  
**Returns**: <code>Object</code> - Standardized error object  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| error | <code>\*</code> |  | Error object from API call |
| operation | <code>string</code> | <code>&quot;generic&quot;</code> | Operation that failed (load, save, etc.) |
| context | <code>Object</code> |  | Additional context for error handling |

<a name="APIErrorHandler+normalizeError"></a>

### apiErrorHandler.normalizeError(error) ⇒ <code>Object</code>
Normalize error object to consistent structure

**Kind**: instance method of [<code>APIErrorHandler</code>](#APIErrorHandler)  
**Returns**: <code>Object</code> - Normalized error object  

| Param | Type | Description |
| --- | --- | --- |
| error | <code>\*</code> | Raw error from API or other source |

<a name="APIErrorHandler+getUserMessage"></a>

### apiErrorHandler.getUserMessage(normalizedError, operation) ⇒ <code>string</code>
Get user-friendly message for errorDelegates to centralized MessageHelper for consistent i18n handling.

**Kind**: instance method of [<code>APIErrorHandler</code>](#APIErrorHandler)  
**Returns**: <code>string</code> - User-friendly error message  

| Param | Type | Description |
| --- | --- | --- |
| normalizedError | <code>Object</code> | Normalized error object |
| operation | <code>string</code> | Operation that failed |

<a name="APIErrorHandler+logError"></a>

### apiErrorHandler.logError(normalizedError, operation, context)
Log error securely without exposing sensitive information

**Kind**: instance method of [<code>APIErrorHandler</code>](#APIErrorHandler)  

| Param | Type | Description |
| --- | --- | --- |
| normalizedError | <code>Object</code> | Normalized error object |
| operation | <code>string</code> | Operation that failed |
| context | <code>Object</code> | Additional context |

<a name="APIErrorHandler+sanitizeLogMessage"></a>

### apiErrorHandler.sanitizeLogMessage(message) ⇒ <code>string</code>
Sanitize log message to prevent information disclosure

**Kind**: instance method of [<code>APIErrorHandler</code>](#APIErrorHandler)  
**Returns**: <code>string</code> - Sanitized message  

| Param | Type | Description |
| --- | --- | --- |
| message | <code>string</code> | Raw error message |

<a name="APIErrorHandler+sanitizeContext"></a>

### apiErrorHandler.sanitizeContext(context) ⇒ <code>Object</code>
Sanitize context object for logging

**Kind**: instance method of [<code>APIErrorHandler</code>](#APIErrorHandler)  
**Returns**: <code>Object</code> - Sanitized context  

| Param | Type | Description |
| --- | --- | --- |
| context | <code>Object</code> | Context object |

<a name="APIErrorHandler+showUserNotification"></a>

### apiErrorHandler.showUserNotification(message, type)
Show user notification

**Kind**: instance method of [<code>APIErrorHandler</code>](#APIErrorHandler)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| message | <code>string</code> |  | Message to show |
| type | <code>string</code> | <code>&quot;error&quot;</code> | Notification type (error, warning, success) |

<a name="APIErrorHandler+reportToErrorHandler"></a>

### apiErrorHandler.reportToErrorHandler(normalizedError, operation, context)
Report to centralized error handler

**Kind**: instance method of [<code>APIErrorHandler</code>](#APIErrorHandler)  

| Param | Type | Description |
| --- | --- | --- |
| normalizedError | <code>Object</code> | Normalized error object |
| operation | <code>string</code> | Operation that failed |
| context | <code>Object</code> | Additional context |

<a name="APIErrorHandler+updateUIForError"></a>

### apiErrorHandler.updateUIForError(operation)
Update UI state for error conditions

**Kind**: instance method of [<code>APIErrorHandler</code>](#APIErrorHandler)  

| Param | Type | Description |
| --- | --- | --- |
| operation | <code>string</code> | Operation that failed |

<a name="APIErrorHandler+destroy"></a>

### apiErrorHandler.destroy()
Clean up resources

**Kind**: instance method of [<code>APIErrorHandler</code>](#APIErrorHandler)  
<a name="CanvasEvents"></a>

## CanvasEvents
**Kind**: global class  

* [CanvasEvents](#CanvasEvents)
    * [new CanvasEvents()](#new_CanvasEvents_new)
    * [new CanvasEvents(canvasManager)](#new_CanvasEvents_new)

<a name="new_CanvasEvents_new"></a>

### new CanvasEvents()
CanvasEventsHandles DOM events for the CanvasManager

<a name="new_CanvasEvents_new"></a>

### new CanvasEvents(canvasManager)
Create a new CanvasEvents instance


| Param | Type |
| --- | --- |
| canvasManager | [<code>CanvasManager</code>](#CanvasManager) | 

<a name="CanvasEvents"></a>

## CanvasEvents
**Kind**: global class  

* [CanvasEvents](#CanvasEvents)
    * [new CanvasEvents()](#new_CanvasEvents_new)
    * [new CanvasEvents(canvasManager)](#new_CanvasEvents_new)

<a name="new_CanvasEvents_new"></a>

### new CanvasEvents()
CanvasEventsHandles DOM events for the CanvasManager

<a name="new_CanvasEvents_new"></a>

### new CanvasEvents(canvasManager)
Create a new CanvasEvents instance


| Param | Type |
| --- | --- |
| canvasManager | [<code>CanvasManager</code>](#CanvasManager) | 

<a name="CanvasManager"></a>

## CanvasManager
CanvasManager class

**Kind**: global class  

* [CanvasManager](#CanvasManager)
    * [new CanvasManager(config)](#new_CanvasManager_new)
    * [.setupEventHandlers()](#CanvasManager+setupEventHandlers)
    * [.getSelectedLayerIds()](#CanvasManager+getSelectedLayerIds) ⇒ <code>Array</code>
    * [.getSelectedLayerId()](#CanvasManager+getSelectedLayerId) ⇒ <code>string</code> \| <code>null</code>
    * [.setSelectedLayerIds(ids)](#CanvasManager+setSelectedLayerIds)
    * [.subscribeToState()](#CanvasManager+subscribeToState)
    * [.notifyToolbarOfSelection(selectedIds)](#CanvasManager+notifyToolbarOfSelection)
    * [.loadBackgroundImage()](#CanvasManager+loadBackgroundImage)
    * [.handleImageLoaded(image, info)](#CanvasManager+handleImageLoaded)
    * [.handleImageLoadError()](#CanvasManager+handleImageLoadError)
    * [.tryLoadImageFallback(urls, index)](#CanvasManager+tryLoadImageFallback)
    * [.updateStyleOptions(options)](#CanvasManager+updateStyleOptions)
    * [.calculateResize(originalLayer, handleType, deltaX, deltaY, modifiers)](#CanvasManager+calculateResize) ⇒ <code>Object</code> \| <code>null</code>
    * [.emitTransforming(layer)](#CanvasManager+emitTransforming)
    * [.updateLayerPosition(layer, originalState, deltaX, deltaY)](#CanvasManager+updateLayerPosition)
    * [.updateCanvasTransform()](#CanvasManager+updateCanvasTransform)
    * [.smoothZoomTo(targetZoom, duration)](#CanvasManager+smoothZoomTo)
    * [.animateZoom()](#CanvasManager+animateZoom)
    * [.setZoomDirect(newZoom)](#CanvasManager+setZoomDirect)
    * [.zoomToFitLayers()](#CanvasManager+zoomToFitLayers)
    * [.getLayerBounds(layer)](#CanvasManager+getLayerBounds) ⇒ <code>Object</code> \| <code>null</code>
    * [.getTempCanvas(width, height)](#CanvasManager+getTempCanvas) ⇒ <code>Object</code>
    * [.returnTempCanvas(tempCanvasObj)](#CanvasManager+returnTempCanvas)
    * [.handleZoomClick(point, event)](#CanvasManager+handleZoomClick)
    * [.handleZoomDrag(point)](#CanvasManager+handleZoomDrag)
    * [.zoomBy(delta, point)](#CanvasManager+zoomBy)
    * [.saveState(action)](#CanvasManager+saveState)
    * [.drawMultiSelectionIndicators()](#CanvasManager+drawMultiSelectionIndicators)
    * [.setBaseDimensions(width, height)](#CanvasManager+setBaseDimensions)
    * [.resizeCanvas()](#CanvasManager+resizeCanvas)
    * [.getMousePointFromClient(clientX, clientY)](#CanvasManager+getMousePointFromClient) ⇒ <code>Object</code>

<a name="new_CanvasManager_new"></a>

### new CanvasManager(config)
Creates a new CanvasManager instance


| Param | Type | Description |
| --- | --- | --- |
| config | <code>Object</code> | Configuration options |

<a name="CanvasManager+setupEventHandlers"></a>

### canvasManager.setupEventHandlers()
Initialize the event handling layer for CanvasManager.This will construct CanvasEvents controller if available, otherwiseinstall basic fallback handlers for test environments.

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  
<a name="CanvasManager+getSelectedLayerIds"></a>

### canvasManager.getSelectedLayerIds() ⇒ <code>Array</code>
Get the selected layer IDs from StateManager (single source of truth)

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  
**Returns**: <code>Array</code> - Array of selected layer IDs  
<a name="CanvasManager+getSelectedLayerId"></a>

### canvasManager.getSelectedLayerId() ⇒ <code>string</code> \| <code>null</code>
Get the primary selected layer ID (last in selection array)

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  
**Returns**: <code>string</code> \| <code>null</code> - The selected layer ID or null  
<a name="CanvasManager+setSelectedLayerIds"></a>

### canvasManager.setSelectedLayerIds(ids)
Set the selected layer IDs via StateManager

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  

| Param | Type | Description |
| --- | --- | --- |
| ids | <code>Array</code> | Array of layer IDs to select |

<a name="CanvasManager+subscribeToState"></a>

### canvasManager.subscribeToState()
Subscribe to StateManager for reactive updates

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  
<a name="CanvasManager+notifyToolbarOfSelection"></a>

### canvasManager.notifyToolbarOfSelection(selectedIds)
Notify toolbar style controls of selection change for preset dropdown

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  

| Param | Type | Description |
| --- | --- | --- |
| selectedIds | <code>Array</code> | Selected layer IDs |

<a name="CanvasManager+loadBackgroundImage"></a>

### canvasManager.loadBackgroundImage()
Load background image using ImageLoader moduleDelegates to ImageLoader for URL detection and loading with fallbacks

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  
**Note**: ImageLoader is guaranteed to load first via extension.json in production,      but fallback is kept for test environments and backward compatibility.  
<a name="CanvasManager+handleImageLoaded"></a>

### canvasManager.handleImageLoaded(image, info)
Handle successful image load from ImageLoader

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  

| Param | Type | Description |
| --- | --- | --- |
| image | <code>HTMLImageElement</code> | The loaded image |
| info | <code>Object</code> | Load info (width, height, source, etc.) |

<a name="CanvasManager+handleImageLoadError"></a>

### canvasManager.handleImageLoadError()
Handle image load error from ImageLoader

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  
<a name="CanvasManager+tryLoadImageFallback"></a>

### canvasManager.tryLoadImageFallback(urls, index)
Try to load images from a list of URLs sequentially.

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  

| Param | Type |
| --- | --- |
| urls | <code>Array.&lt;string&gt;</code> | 
| index | <code>number</code> | 

<a name="CanvasManager+updateStyleOptions"></a>

### canvasManager.updateStyleOptions(options)
Update current style options and apply to selected layers.Delegates to StyleController when available.

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  

| Param | Type | Description |
| --- | --- | --- |
| options | <code>Object</code> | Style options to update |

<a name="CanvasManager+calculateResize"></a>

### canvasManager.calculateResize(originalLayer, handleType, deltaX, deltaY, modifiers) ⇒ <code>Object</code> \| <code>null</code>
Calculate resize updates based on layer typeDelegates to TransformController for actual calculations

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  
**Returns**: <code>Object</code> \| <code>null</code> - Updates object with new dimensions  

| Param | Type | Description |
| --- | --- | --- |
| originalLayer | <code>Object</code> | Original layer properties |
| handleType | <code>string</code> | Handle being dragged |
| deltaX | <code>number</code> | Delta X movement |
| deltaY | <code>number</code> | Delta Y movement |
| modifiers | <code>Object</code> | Modifier keys state |

<a name="CanvasManager+emitTransforming"></a>

### canvasManager.emitTransforming(layer)
Emit a throttled custom event with current transform valuesto allow the properties panel to live-sync during manipulation.

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | The layer object to serialize and emit |

<a name="CanvasManager+updateLayerPosition"></a>

### canvasManager.updateLayerPosition(layer, originalState, deltaX, deltaY)
Update layer position during drag operation

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer to update |
| originalState | <code>Object</code> | Original state before drag |
| deltaX | <code>number</code> | X offset |
| deltaY | <code>number</code> | Y offset |

<a name="CanvasManager+updateCanvasTransform"></a>

### canvasManager.updateCanvasTransform()
Update the canvas CSS transform from current pan/zoom state.

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  
<a name="CanvasManager+smoothZoomTo"></a>

### canvasManager.smoothZoomTo(targetZoom, duration)
Smoothly animate zoom to a target level

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  

| Param | Type | Description |
| --- | --- | --- |
| targetZoom | <code>number</code> | Target zoom level |
| duration | <code>number</code> | Animation duration in milliseconds (optional) |

<a name="CanvasManager+animateZoom"></a>

### canvasManager.animateZoom()
Animation frame function for smooth zooming

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  
<a name="CanvasManager+setZoomDirect"></a>

### canvasManager.setZoomDirect(newZoom)
Set zoom directly without triggering user zoom flag (for animations)

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  

| Param | Type | Description |
| --- | --- | --- |
| newZoom | <code>number</code> | New zoom level |

<a name="CanvasManager+zoomToFitLayers"></a>

### canvasManager.zoomToFitLayers()
Zoom to fit all layers in the viewport

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  
<a name="CanvasManager+getLayerBounds"></a>

### canvasManager.getLayerBounds(layer) ⇒ <code>Object</code> \| <code>null</code>
Get bounding box of a layer

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  
**Returns**: <code>Object</code> \| <code>null</code> - Bounding box including raw and axis-aligned data  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer object |

<a name="CanvasManager+getTempCanvas"></a>

### canvasManager.getTempCanvas(width, height) ⇒ <code>Object</code>
Get a temporary canvas from the pool or create a new oneThis prevents memory leaks from constantly creating new canvas elements

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  
**Returns**: <code>Object</code> - Object with canvas and context properties  

| Param | Type | Description |
| --- | --- | --- |
| width | <code>number</code> | Canvas width |
| height | <code>number</code> | Canvas height |

<a name="CanvasManager+returnTempCanvas"></a>

### canvasManager.returnTempCanvas(tempCanvasObj)
Return a temporary canvas to the pool for reuse

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  

| Param | Type | Description |
| --- | --- | --- |
| tempCanvasObj | <code>Object</code> | Object with canvas and context properties |

<a name="CanvasManager+handleZoomClick"></a>

### canvasManager.handleZoomClick(point, event)
Handle zoom tool click - zoom in at point, or zoom out with shift

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  

| Param | Type | Description |
| --- | --- | --- |
| point | <code>Object</code> | Mouse point in canvas coordinates |
| event | <code>MouseEvent</code> | Mouse event with modifier keys |

<a name="CanvasManager+handleZoomDrag"></a>

### canvasManager.handleZoomDrag(point)
Handle zoom tool drag - drag up/down to zoom in/out dynamically

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  

| Param | Type | Description |
| --- | --- | --- |
| point | <code>Object</code> | Current mouse point |

<a name="CanvasManager+zoomBy"></a>

### canvasManager.zoomBy(delta, point)
Public zoom helper used by external handlers (wheel/pinch)

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  

| Param | Type | Description |
| --- | --- | --- |
| delta | <code>number</code> | Positive to zoom in, negative to zoom out (in zoom units) |
| point | <code>Object</code> | Canvas coordinate under the cursor to anchor zoom around |

<a name="CanvasManager+saveState"></a>

### canvasManager.saveState(action)
Save current state to history for undo/redoDelegates to HistoryManager for single source of truth

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  

| Param | Type | Description |
| --- | --- | --- |
| action | <code>string</code> | Description of the action |

<a name="CanvasManager+drawMultiSelectionIndicators"></a>

### canvasManager.drawMultiSelectionIndicators()
Draw selection indicators for multiple selected layersThe key object (last selected) is visually distinguished with an orange border

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  
<a name="CanvasManager+setBaseDimensions"></a>

### canvasManager.setBaseDimensions(width, height)
Set the base dimensions that layers were created against.Used for scaling layers when the canvas size differs from the original.

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  

| Param | Type | Description |
| --- | --- | --- |
| width | <code>number</code> | Original image width |
| height | <code>number</code> | Original image height |

<a name="CanvasManager+resizeCanvas"></a>

### canvasManager.resizeCanvas()
Resize canvas to match container size while maintaining aspect ratio.Updates viewport bounds for layer culling.

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  
<a name="CanvasManager+getMousePointFromClient"></a>

### canvasManager.getMousePointFromClient(clientX, clientY) ⇒ <code>Object</code>
Convert a DOM client coordinate to canvas coordinate, robust against CSS transforms.Uses element's bounding rect to derive the pixel ratio instead of manual pan/zoom math.

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  

| Param | Type |
| --- | --- |
| clientX | <code>number</code> | 
| clientY | <code>number</code> | 

<a name="CanvasRenderer"></a>

## CanvasRenderer
**Kind**: global class  

* [CanvasRenderer](#CanvasRenderer)
    * [new CanvasRenderer()](#new_CanvasRenderer_new)
    * [new CanvasRenderer(canvas, config)](#new_CanvasRenderer_new)
    * [._initSelectionRenderer()](#CanvasRenderer+_initSelectionRenderer)
    * [._getLayerById(layerId)](#CanvasRenderer+_getLayerById) ⇒ <code>Object</code> \| <code>null</code>
    * [.getBackgroundVisible()](#CanvasRenderer+getBackgroundVisible) ⇒ <code>boolean</code>
    * [.getBackgroundOpacity()](#CanvasRenderer+getBackgroundOpacity) ⇒ <code>number</code>
    * [.drawSmartGuides()](#CanvasRenderer+drawSmartGuides)
    * [.drawCheckerPattern()](#CanvasRenderer+drawCheckerPattern)
    * [.drawCheckerPatternToContext()](#CanvasRenderer+drawCheckerPatternToContext)
    * [.renderLayersToContext(targetCtx, layers, scale)](#CanvasRenderer+renderLayersToContext)
    * [.drawBlurEffectToContext(targetCtx, layer, scale)](#CanvasRenderer+drawBlurEffectToContext)
    * [.drawBlurEffect(layer)](#CanvasRenderer+drawBlurEffect)
    * [.drawLayer(layer)](#CanvasRenderer+drawLayer)
    * [.drawMultiSelectionIndicators([keyObjectId])](#CanvasRenderer+drawMultiSelectionIndicators)
    * [.drawSelectionIndicators(layerId, [isKeyObject])](#CanvasRenderer+drawSelectionIndicators)
    * [.drawSelectionHandles(bounds, layer, isRotated, worldBounds)](#CanvasRenderer+drawSelectionHandles)
    * [.drawLineSelectionIndicators(layer)](#CanvasRenderer+drawLineSelectionIndicators)
    * [.drawRotationHandle(bounds, layer, isRotated, worldBounds)](#CanvasRenderer+drawRotationHandle)
    * [.drawMarqueeBox()](#CanvasRenderer+drawMarqueeBox)
    * [.destroy()](#CanvasRenderer+destroy)

<a name="new_CanvasRenderer_new"></a>

### new CanvasRenderer()
CanvasRenderer - Manages all canvas rendering operations

<a name="new_CanvasRenderer_new"></a>

### new CanvasRenderer(canvas, config)
Create a new CanvasRenderer instance


| Param | Type | Description |
| --- | --- | --- |
| canvas | <code>HTMLCanvasElement</code> | Canvas element to render on |
| config | <code>Object</code> | Configuration options |

<a name="CanvasRenderer+_initSelectionRenderer"></a>

### canvasRenderer.\_initSelectionRenderer()
Initialize SelectionRenderer module

**Kind**: instance method of [<code>CanvasRenderer</code>](#CanvasRenderer)  
<a name="CanvasRenderer+_getLayerById"></a>

### canvasRenderer.\_getLayerById(layerId) ⇒ <code>Object</code> \| <code>null</code>
Get layer by ID (helper for SelectionRenderer)

**Kind**: instance method of [<code>CanvasRenderer</code>](#CanvasRenderer)  
**Returns**: <code>Object</code> \| <code>null</code> - Layer object or null  

| Param | Type | Description |
| --- | --- | --- |
| layerId | <code>string</code> | Layer ID |

<a name="CanvasRenderer+getBackgroundVisible"></a>

### canvasRenderer.getBackgroundVisible() ⇒ <code>boolean</code>
Get background visibility state from editor

**Kind**: instance method of [<code>CanvasRenderer</code>](#CanvasRenderer)  
**Returns**: <code>boolean</code> - True if background should be visible  
<a name="CanvasRenderer+getBackgroundOpacity"></a>

### canvasRenderer.getBackgroundOpacity() ⇒ <code>number</code>
Get background opacity state from editor

**Kind**: instance method of [<code>CanvasRenderer</code>](#CanvasRenderer)  
**Returns**: <code>number</code> - Opacity value 0-1  
<a name="CanvasRenderer+drawSmartGuides"></a>

### canvasRenderer.drawSmartGuides()
Draw smart guides overlay (called after other overlays)

**Kind**: instance method of [<code>CanvasRenderer</code>](#CanvasRenderer)  
<a name="CanvasRenderer+drawCheckerPattern"></a>

### canvasRenderer.drawCheckerPattern()
Draw checker pattern for transparency visualization

**Kind**: instance method of [<code>CanvasRenderer</code>](#CanvasRenderer)  
<a name="CanvasRenderer+drawCheckerPatternToContext"></a>

### canvasRenderer.drawCheckerPatternToContext()
Draw checker pattern directly to context (without save/restore)

**Kind**: instance method of [<code>CanvasRenderer</code>](#CanvasRenderer)  
<a name="CanvasRenderer+renderLayersToContext"></a>

### canvasRenderer.renderLayersToContext(targetCtx, layers, scale)
Render layers to an external context (used for export).Does NOT include background image or checker pattern.

**Kind**: instance method of [<code>CanvasRenderer</code>](#CanvasRenderer)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| targetCtx | <code>CanvasRenderingContext2D</code> |  | Target context to draw on |
| layers | <code>Array</code> |  | Array of layer objects to render |
| scale | <code>number</code> | <code>1</code> | Scale factor for rendering (default: 1) |

<a name="CanvasRenderer+drawBlurEffectToContext"></a>

### canvasRenderer.drawBlurEffectToContext(targetCtx, layer, scale)
Draw a blur effect to an external context for export

**Kind**: instance method of [<code>CanvasRenderer</code>](#CanvasRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| targetCtx | <code>CanvasRenderingContext2D</code> | Target context |
| layer | <code>Object</code> | Blur layer |
| scale | <code>number</code> | Scale factor |

<a name="CanvasRenderer+drawBlurEffect"></a>

### canvasRenderer.drawBlurEffect(layer)
Draw a blur effect that blurs everything below it (background + layers)

**Kind**: instance method of [<code>CanvasRenderer</code>](#CanvasRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Blur layer with x, y, width, height, blurRadius |

<a name="CanvasRenderer+drawLayer"></a>

### canvasRenderer.drawLayer(layer)
Draw a layer using the shared LayerRendererLayerRenderer is a required dependency (ext.layers.shared)

**Kind**: instance method of [<code>CanvasRenderer</code>](#CanvasRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer to draw |

<a name="CanvasRenderer+drawMultiSelectionIndicators"></a>

### canvasRenderer.drawMultiSelectionIndicators([keyObjectId])
Draw selection indicators for all selected layersDelegates to SelectionRenderer (required module)

**Kind**: instance method of [<code>CanvasRenderer</code>](#CanvasRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| [keyObjectId] | <code>string</code> | ID of the key object (last selected) for visual distinction |

<a name="CanvasRenderer+drawSelectionIndicators"></a>

### canvasRenderer.drawSelectionIndicators(layerId, [isKeyObject])
Draw selection indicators for a single layerDelegates to SelectionRenderer (required module)

**Kind**: instance method of [<code>CanvasRenderer</code>](#CanvasRenderer)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| layerId | <code>string</code> |  | Layer ID |
| [isKeyObject] | <code>boolean</code> | <code>false</code> | Whether this is the key object |

<a name="CanvasRenderer+drawSelectionHandles"></a>

### canvasRenderer.drawSelectionHandles(bounds, layer, isRotated, worldBounds)
Draw selection handlesDelegates to SelectionRenderer (required module)

**Kind**: instance method of [<code>CanvasRenderer</code>](#CanvasRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| bounds | <code>Object</code> | Drawing bounds |
| layer | <code>Object</code> | The layer object |
| isRotated | <code>boolean</code> | Whether the layer is rotated |
| worldBounds | <code>Object</code> | World-space bounds |

<a name="CanvasRenderer+drawLineSelectionIndicators"></a>

### canvasRenderer.drawLineSelectionIndicators(layer)
Draw line selection indicatorsDelegates to SelectionRenderer (required module)

**Kind**: instance method of [<code>CanvasRenderer</code>](#CanvasRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | The line or arrow layer |

<a name="CanvasRenderer+drawRotationHandle"></a>

### canvasRenderer.drawRotationHandle(bounds, layer, isRotated, worldBounds)
Draw rotation handleDelegates to SelectionRenderer (required module)

**Kind**: instance method of [<code>CanvasRenderer</code>](#CanvasRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| bounds | <code>Object</code> | Drawing bounds |
| layer | <code>Object</code> | The layer object |
| isRotated | <code>boolean</code> | Whether the layer is rotated |
| worldBounds | <code>Object</code> | World-space bounds |

<a name="CanvasRenderer+drawMarqueeBox"></a>

### canvasRenderer.drawMarqueeBox()
Draw marquee selection boxDelegates to SelectionRenderer (required module)

**Kind**: instance method of [<code>CanvasRenderer</code>](#CanvasRenderer)  
<a name="CanvasRenderer+destroy"></a>

### canvasRenderer.destroy()
Clean up resources

**Kind**: instance method of [<code>CanvasRenderer</code>](#CanvasRenderer)  
<a name="CanvasRenderer"></a>

## CanvasRenderer
**Kind**: global class  

* [CanvasRenderer](#CanvasRenderer)
    * [new CanvasRenderer()](#new_CanvasRenderer_new)
    * [new CanvasRenderer(canvas, config)](#new_CanvasRenderer_new)
    * [._initSelectionRenderer()](#CanvasRenderer+_initSelectionRenderer)
    * [._getLayerById(layerId)](#CanvasRenderer+_getLayerById) ⇒ <code>Object</code> \| <code>null</code>
    * [.getBackgroundVisible()](#CanvasRenderer+getBackgroundVisible) ⇒ <code>boolean</code>
    * [.getBackgroundOpacity()](#CanvasRenderer+getBackgroundOpacity) ⇒ <code>number</code>
    * [.drawSmartGuides()](#CanvasRenderer+drawSmartGuides)
    * [.drawCheckerPattern()](#CanvasRenderer+drawCheckerPattern)
    * [.drawCheckerPatternToContext()](#CanvasRenderer+drawCheckerPatternToContext)
    * [.renderLayersToContext(targetCtx, layers, scale)](#CanvasRenderer+renderLayersToContext)
    * [.drawBlurEffectToContext(targetCtx, layer, scale)](#CanvasRenderer+drawBlurEffectToContext)
    * [.drawBlurEffect(layer)](#CanvasRenderer+drawBlurEffect)
    * [.drawLayer(layer)](#CanvasRenderer+drawLayer)
    * [.drawMultiSelectionIndicators([keyObjectId])](#CanvasRenderer+drawMultiSelectionIndicators)
    * [.drawSelectionIndicators(layerId, [isKeyObject])](#CanvasRenderer+drawSelectionIndicators)
    * [.drawSelectionHandles(bounds, layer, isRotated, worldBounds)](#CanvasRenderer+drawSelectionHandles)
    * [.drawLineSelectionIndicators(layer)](#CanvasRenderer+drawLineSelectionIndicators)
    * [.drawRotationHandle(bounds, layer, isRotated, worldBounds)](#CanvasRenderer+drawRotationHandle)
    * [.drawMarqueeBox()](#CanvasRenderer+drawMarqueeBox)
    * [.destroy()](#CanvasRenderer+destroy)

<a name="new_CanvasRenderer_new"></a>

### new CanvasRenderer()
CanvasRenderer - Manages all canvas rendering operations

<a name="new_CanvasRenderer_new"></a>

### new CanvasRenderer(canvas, config)
Create a new CanvasRenderer instance


| Param | Type | Description |
| --- | --- | --- |
| canvas | <code>HTMLCanvasElement</code> | Canvas element to render on |
| config | <code>Object</code> | Configuration options |

<a name="CanvasRenderer+_initSelectionRenderer"></a>

### canvasRenderer.\_initSelectionRenderer()
Initialize SelectionRenderer module

**Kind**: instance method of [<code>CanvasRenderer</code>](#CanvasRenderer)  
<a name="CanvasRenderer+_getLayerById"></a>

### canvasRenderer.\_getLayerById(layerId) ⇒ <code>Object</code> \| <code>null</code>
Get layer by ID (helper for SelectionRenderer)

**Kind**: instance method of [<code>CanvasRenderer</code>](#CanvasRenderer)  
**Returns**: <code>Object</code> \| <code>null</code> - Layer object or null  

| Param | Type | Description |
| --- | --- | --- |
| layerId | <code>string</code> | Layer ID |

<a name="CanvasRenderer+getBackgroundVisible"></a>

### canvasRenderer.getBackgroundVisible() ⇒ <code>boolean</code>
Get background visibility state from editor

**Kind**: instance method of [<code>CanvasRenderer</code>](#CanvasRenderer)  
**Returns**: <code>boolean</code> - True if background should be visible  
<a name="CanvasRenderer+getBackgroundOpacity"></a>

### canvasRenderer.getBackgroundOpacity() ⇒ <code>number</code>
Get background opacity state from editor

**Kind**: instance method of [<code>CanvasRenderer</code>](#CanvasRenderer)  
**Returns**: <code>number</code> - Opacity value 0-1  
<a name="CanvasRenderer+drawSmartGuides"></a>

### canvasRenderer.drawSmartGuides()
Draw smart guides overlay (called after other overlays)

**Kind**: instance method of [<code>CanvasRenderer</code>](#CanvasRenderer)  
<a name="CanvasRenderer+drawCheckerPattern"></a>

### canvasRenderer.drawCheckerPattern()
Draw checker pattern for transparency visualization

**Kind**: instance method of [<code>CanvasRenderer</code>](#CanvasRenderer)  
<a name="CanvasRenderer+drawCheckerPatternToContext"></a>

### canvasRenderer.drawCheckerPatternToContext()
Draw checker pattern directly to context (without save/restore)

**Kind**: instance method of [<code>CanvasRenderer</code>](#CanvasRenderer)  
<a name="CanvasRenderer+renderLayersToContext"></a>

### canvasRenderer.renderLayersToContext(targetCtx, layers, scale)
Render layers to an external context (used for export).Does NOT include background image or checker pattern.

**Kind**: instance method of [<code>CanvasRenderer</code>](#CanvasRenderer)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| targetCtx | <code>CanvasRenderingContext2D</code> |  | Target context to draw on |
| layers | <code>Array</code> |  | Array of layer objects to render |
| scale | <code>number</code> | <code>1</code> | Scale factor for rendering (default: 1) |

<a name="CanvasRenderer+drawBlurEffectToContext"></a>

### canvasRenderer.drawBlurEffectToContext(targetCtx, layer, scale)
Draw a blur effect to an external context for export

**Kind**: instance method of [<code>CanvasRenderer</code>](#CanvasRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| targetCtx | <code>CanvasRenderingContext2D</code> | Target context |
| layer | <code>Object</code> | Blur layer |
| scale | <code>number</code> | Scale factor |

<a name="CanvasRenderer+drawBlurEffect"></a>

### canvasRenderer.drawBlurEffect(layer)
Draw a blur effect that blurs everything below it (background + layers)

**Kind**: instance method of [<code>CanvasRenderer</code>](#CanvasRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Blur layer with x, y, width, height, blurRadius |

<a name="CanvasRenderer+drawLayer"></a>

### canvasRenderer.drawLayer(layer)
Draw a layer using the shared LayerRendererLayerRenderer is a required dependency (ext.layers.shared)

**Kind**: instance method of [<code>CanvasRenderer</code>](#CanvasRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer to draw |

<a name="CanvasRenderer+drawMultiSelectionIndicators"></a>

### canvasRenderer.drawMultiSelectionIndicators([keyObjectId])
Draw selection indicators for all selected layersDelegates to SelectionRenderer (required module)

**Kind**: instance method of [<code>CanvasRenderer</code>](#CanvasRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| [keyObjectId] | <code>string</code> | ID of the key object (last selected) for visual distinction |

<a name="CanvasRenderer+drawSelectionIndicators"></a>

### canvasRenderer.drawSelectionIndicators(layerId, [isKeyObject])
Draw selection indicators for a single layerDelegates to SelectionRenderer (required module)

**Kind**: instance method of [<code>CanvasRenderer</code>](#CanvasRenderer)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| layerId | <code>string</code> |  | Layer ID |
| [isKeyObject] | <code>boolean</code> | <code>false</code> | Whether this is the key object |

<a name="CanvasRenderer+drawSelectionHandles"></a>

### canvasRenderer.drawSelectionHandles(bounds, layer, isRotated, worldBounds)
Draw selection handlesDelegates to SelectionRenderer (required module)

**Kind**: instance method of [<code>CanvasRenderer</code>](#CanvasRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| bounds | <code>Object</code> | Drawing bounds |
| layer | <code>Object</code> | The layer object |
| isRotated | <code>boolean</code> | Whether the layer is rotated |
| worldBounds | <code>Object</code> | World-space bounds |

<a name="CanvasRenderer+drawLineSelectionIndicators"></a>

### canvasRenderer.drawLineSelectionIndicators(layer)
Draw line selection indicatorsDelegates to SelectionRenderer (required module)

**Kind**: instance method of [<code>CanvasRenderer</code>](#CanvasRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | The line or arrow layer |

<a name="CanvasRenderer+drawRotationHandle"></a>

### canvasRenderer.drawRotationHandle(bounds, layer, isRotated, worldBounds)
Draw rotation handleDelegates to SelectionRenderer (required module)

**Kind**: instance method of [<code>CanvasRenderer</code>](#CanvasRenderer)  

| Param | Type | Description |
| --- | --- | --- |
| bounds | <code>Object</code> | Drawing bounds |
| layer | <code>Object</code> | The layer object |
| isRotated | <code>boolean</code> | Whether the layer is rotated |
| worldBounds | <code>Object</code> | World-space bounds |

<a name="CanvasRenderer+drawMarqueeBox"></a>

### canvasRenderer.drawMarqueeBox()
Draw marquee selection boxDelegates to SelectionRenderer (required module)

**Kind**: instance method of [<code>CanvasRenderer</code>](#CanvasRenderer)  
<a name="CanvasRenderer+destroy"></a>

### canvasRenderer.destroy()
Clean up resources

**Kind**: instance method of [<code>CanvasRenderer</code>](#CanvasRenderer)  
<a name="CanvasUtilities"></a>

## CanvasUtilities
**Kind**: global class  

* [CanvasUtilities](#CanvasUtilities)
    * [new CanvasUtilities()](#new_CanvasUtilities_new)
    * [.sanitizeNumber(value, defaultVal, [min], [max])](#CanvasUtilities.sanitizeNumber) ⇒ <code>number</code>
    * [.sanitizeColor(color, defaultColor)](#CanvasUtilities.sanitizeColor) ⇒ <code>string</code>
    * [.sanitizeFontFamily(fontFamily)](#CanvasUtilities.sanitizeFontFamily) ⇒ <code>string</code>
    * [.rectanglesIntersect(rect1, rect2)](#CanvasUtilities.rectanglesIntersect) ⇒ <code>boolean</code>
    * [.clamp(value, min, max)](#CanvasUtilities.clamp) ⇒ <code>number</code>
    * [.getCursorForHandle(handle)](#CanvasUtilities.getCursorForHandle) ⇒ <code>string</code>
    * [.getToolCursor(tool)](#CanvasUtilities.getToolCursor) ⇒ <code>string</code>
    * [.isValidBlendMode(blendMode)](#CanvasUtilities.isValidBlendMode) ⇒ <code>boolean</code>
    * [.calculateAspectFit(sourceWidth, sourceHeight, targetWidth, targetHeight)](#CanvasUtilities.calculateAspectFit) ⇒ <code>Object</code>
    * [.deepClone(obj)](#CanvasUtilities.deepClone) ⇒ <code>\*</code>

<a name="new_CanvasUtilities_new"></a>

### new CanvasUtilities()
Canvas Utilities ModulePure utility functions extracted from CanvasManager for reusabilityThese are stateless helpers that can be used independently

<a name="CanvasUtilities.sanitizeNumber"></a>

### CanvasUtilities.sanitizeNumber(value, defaultVal, [min], [max]) ⇒ <code>number</code>
Sanitize a numeric value with range constraints

**Kind**: static method of [<code>CanvasUtilities</code>](#CanvasUtilities)  
**Returns**: <code>number</code> - Sanitized number  

| Param | Type | Description |
| --- | --- | --- |
| value | <code>\*</code> | Value to sanitize |
| defaultVal | <code>number</code> | Default value if invalid |
| [min] | <code>number</code> | Minimum allowed value |
| [max] | <code>number</code> | Maximum allowed value |

<a name="CanvasUtilities.sanitizeColor"></a>

### CanvasUtilities.sanitizeColor(color, defaultColor) ⇒ <code>string</code>
Sanitize color value

**Kind**: static method of [<code>CanvasUtilities</code>](#CanvasUtilities)  
**Returns**: <code>string</code> - Sanitized color  

| Param | Type | Description |
| --- | --- | --- |
| color | <code>string</code> | Color to sanitize |
| defaultColor | <code>string</code> | Default color if invalid |

<a name="CanvasUtilities.sanitizeFontFamily"></a>

### CanvasUtilities.sanitizeFontFamily(fontFamily) ⇒ <code>string</code>
Sanitize font family

**Kind**: static method of [<code>CanvasUtilities</code>](#CanvasUtilities)  
**Returns**: <code>string</code> - Sanitized font family  

| Param | Type | Description |
| --- | --- | --- |
| fontFamily | <code>string</code> | Font family to sanitize |

<a name="CanvasUtilities.rectanglesIntersect"></a>

### CanvasUtilities.rectanglesIntersect(rect1, rect2) ⇒ <code>boolean</code>
Check if rectangles intersect

**Kind**: static method of [<code>CanvasUtilities</code>](#CanvasUtilities)  
**Returns**: <code>boolean</code> - True if rectangles intersect  

| Param | Type | Description |
| --- | --- | --- |
| rect1 | <code>Object</code> | First rectangle {x, y, width, height} |
| rect2 | <code>Object</code> | Second rectangle {x, y, width, height} |

<a name="CanvasUtilities.clamp"></a>

### CanvasUtilities.clamp(value, min, max) ⇒ <code>number</code>
Clamp a value between min and max

**Kind**: static method of [<code>CanvasUtilities</code>](#CanvasUtilities)  
**Returns**: <code>number</code> - Clamped value  

| Param | Type | Description |
| --- | --- | --- |
| value | <code>number</code> | Value to clamp |
| min | <code>number</code> | Minimum value |
| max | <code>number</code> | Maximum value |

<a name="CanvasUtilities.getCursorForHandle"></a>

### CanvasUtilities.getCursorForHandle(handle) ⇒ <code>string</code>
Get cursor for a resize handle

**Kind**: static method of [<code>CanvasUtilities</code>](#CanvasUtilities)  
**Returns**: <code>string</code> - CSS cursor value  

| Param | Type | Description |
| --- | --- | --- |
| handle | <code>Object</code> | Handle object with type property |

<a name="CanvasUtilities.getToolCursor"></a>

### CanvasUtilities.getToolCursor(tool) ⇒ <code>string</code>
Get cursor for a tool

**Kind**: static method of [<code>CanvasUtilities</code>](#CanvasUtilities)  
**Returns**: <code>string</code> - CSS cursor value  

| Param | Type | Description |
| --- | --- | --- |
| tool | <code>string</code> | Tool name |

<a name="CanvasUtilities.isValidBlendMode"></a>

### CanvasUtilities.isValidBlendMode(blendMode) ⇒ <code>boolean</code>
Check if a blend mode is valid

**Kind**: static method of [<code>CanvasUtilities</code>](#CanvasUtilities)  
**Returns**: <code>boolean</code> - True if valid blend mode  

| Param | Type | Description |
| --- | --- | --- |
| blendMode | <code>string</code> | Blend mode to check |

<a name="CanvasUtilities.calculateAspectFit"></a>

### CanvasUtilities.calculateAspectFit(sourceWidth, sourceHeight, targetWidth, targetHeight) ⇒ <code>Object</code>
Calculate scaled dimensions maintaining aspect ratio

**Kind**: static method of [<code>CanvasUtilities</code>](#CanvasUtilities)  
**Returns**: <code>Object</code> - Scaled dimensions {width, height, x, y}  

| Param | Type | Description |
| --- | --- | --- |
| sourceWidth | <code>number</code> | Source width |
| sourceHeight | <code>number</code> | Source height |
| targetWidth | <code>number</code> | Target width |
| targetHeight | <code>number</code> | Target height |

<a name="CanvasUtilities.deepClone"></a>

### CanvasUtilities.deepClone(obj) ⇒ <code>\*</code>
Deep clone an object (simple implementation for layer data)

**Kind**: static method of [<code>CanvasUtilities</code>](#CanvasUtilities)  
**Returns**: <code>\*</code> - Cloned object  

| Param | Type | Description |
| --- | --- | --- |
| obj | <code>\*</code> | Object to clone |

<a name="CanvasUtilities"></a>

## CanvasUtilities
CanvasUtilities - Collection of pure static utility functions

**Kind**: global class  

* [CanvasUtilities](#CanvasUtilities)
    * [new CanvasUtilities()](#new_CanvasUtilities_new)
    * [.sanitizeNumber(value, defaultVal, [min], [max])](#CanvasUtilities.sanitizeNumber) ⇒ <code>number</code>
    * [.sanitizeColor(color, defaultColor)](#CanvasUtilities.sanitizeColor) ⇒ <code>string</code>
    * [.sanitizeFontFamily(fontFamily)](#CanvasUtilities.sanitizeFontFamily) ⇒ <code>string</code>
    * [.rectanglesIntersect(rect1, rect2)](#CanvasUtilities.rectanglesIntersect) ⇒ <code>boolean</code>
    * [.clamp(value, min, max)](#CanvasUtilities.clamp) ⇒ <code>number</code>
    * [.getCursorForHandle(handle)](#CanvasUtilities.getCursorForHandle) ⇒ <code>string</code>
    * [.getToolCursor(tool)](#CanvasUtilities.getToolCursor) ⇒ <code>string</code>
    * [.isValidBlendMode(blendMode)](#CanvasUtilities.isValidBlendMode) ⇒ <code>boolean</code>
    * [.calculateAspectFit(sourceWidth, sourceHeight, targetWidth, targetHeight)](#CanvasUtilities.calculateAspectFit) ⇒ <code>Object</code>
    * [.deepClone(obj)](#CanvasUtilities.deepClone) ⇒ <code>\*</code>

<a name="new_CanvasUtilities_new"></a>

### new CanvasUtilities()
Canvas Utilities ModulePure utility functions extracted from CanvasManager for reusabilityThese are stateless helpers that can be used independently

<a name="CanvasUtilities.sanitizeNumber"></a>

### CanvasUtilities.sanitizeNumber(value, defaultVal, [min], [max]) ⇒ <code>number</code>
Sanitize a numeric value with range constraints

**Kind**: static method of [<code>CanvasUtilities</code>](#CanvasUtilities)  
**Returns**: <code>number</code> - Sanitized number  

| Param | Type | Description |
| --- | --- | --- |
| value | <code>\*</code> | Value to sanitize |
| defaultVal | <code>number</code> | Default value if invalid |
| [min] | <code>number</code> | Minimum allowed value |
| [max] | <code>number</code> | Maximum allowed value |

<a name="CanvasUtilities.sanitizeColor"></a>

### CanvasUtilities.sanitizeColor(color, defaultColor) ⇒ <code>string</code>
Sanitize color value

**Kind**: static method of [<code>CanvasUtilities</code>](#CanvasUtilities)  
**Returns**: <code>string</code> - Sanitized color  

| Param | Type | Description |
| --- | --- | --- |
| color | <code>string</code> | Color to sanitize |
| defaultColor | <code>string</code> | Default color if invalid |

<a name="CanvasUtilities.sanitizeFontFamily"></a>

### CanvasUtilities.sanitizeFontFamily(fontFamily) ⇒ <code>string</code>
Sanitize font family

**Kind**: static method of [<code>CanvasUtilities</code>](#CanvasUtilities)  
**Returns**: <code>string</code> - Sanitized font family  

| Param | Type | Description |
| --- | --- | --- |
| fontFamily | <code>string</code> | Font family to sanitize |

<a name="CanvasUtilities.rectanglesIntersect"></a>

### CanvasUtilities.rectanglesIntersect(rect1, rect2) ⇒ <code>boolean</code>
Check if rectangles intersect

**Kind**: static method of [<code>CanvasUtilities</code>](#CanvasUtilities)  
**Returns**: <code>boolean</code> - True if rectangles intersect  

| Param | Type | Description |
| --- | --- | --- |
| rect1 | <code>Object</code> | First rectangle {x, y, width, height} |
| rect2 | <code>Object</code> | Second rectangle {x, y, width, height} |

<a name="CanvasUtilities.clamp"></a>

### CanvasUtilities.clamp(value, min, max) ⇒ <code>number</code>
Clamp a value between min and max

**Kind**: static method of [<code>CanvasUtilities</code>](#CanvasUtilities)  
**Returns**: <code>number</code> - Clamped value  

| Param | Type | Description |
| --- | --- | --- |
| value | <code>number</code> | Value to clamp |
| min | <code>number</code> | Minimum value |
| max | <code>number</code> | Maximum value |

<a name="CanvasUtilities.getCursorForHandle"></a>

### CanvasUtilities.getCursorForHandle(handle) ⇒ <code>string</code>
Get cursor for a resize handle

**Kind**: static method of [<code>CanvasUtilities</code>](#CanvasUtilities)  
**Returns**: <code>string</code> - CSS cursor value  

| Param | Type | Description |
| --- | --- | --- |
| handle | <code>Object</code> | Handle object with type property |

<a name="CanvasUtilities.getToolCursor"></a>

### CanvasUtilities.getToolCursor(tool) ⇒ <code>string</code>
Get cursor for a tool

**Kind**: static method of [<code>CanvasUtilities</code>](#CanvasUtilities)  
**Returns**: <code>string</code> - CSS cursor value  

| Param | Type | Description |
| --- | --- | --- |
| tool | <code>string</code> | Tool name |

<a name="CanvasUtilities.isValidBlendMode"></a>

### CanvasUtilities.isValidBlendMode(blendMode) ⇒ <code>boolean</code>
Check if a blend mode is valid

**Kind**: static method of [<code>CanvasUtilities</code>](#CanvasUtilities)  
**Returns**: <code>boolean</code> - True if valid blend mode  

| Param | Type | Description |
| --- | --- | --- |
| blendMode | <code>string</code> | Blend mode to check |

<a name="CanvasUtilities.calculateAspectFit"></a>

### CanvasUtilities.calculateAspectFit(sourceWidth, sourceHeight, targetWidth, targetHeight) ⇒ <code>Object</code>
Calculate scaled dimensions maintaining aspect ratio

**Kind**: static method of [<code>CanvasUtilities</code>](#CanvasUtilities)  
**Returns**: <code>Object</code> - Scaled dimensions {width, height, x, y}  

| Param | Type | Description |
| --- | --- | --- |
| sourceWidth | <code>number</code> | Source width |
| sourceHeight | <code>number</code> | Source height |
| targetWidth | <code>number</code> | Target width |
| targetHeight | <code>number</code> | Target height |

<a name="CanvasUtilities.deepClone"></a>

### CanvasUtilities.deepClone(obj) ⇒ <code>\*</code>
Deep clone an object (simple implementation for layer data)

**Kind**: static method of [<code>CanvasUtilities</code>](#CanvasUtilities)  
**Returns**: <code>\*</code> - Cloned object  

| Param | Type | Description |
| --- | --- | --- |
| obj | <code>\*</code> | Object to clone |

<a name="ErrorHandler"></a>

## ErrorHandler
ErrorHandler class for centralized error management

**Kind**: global class  

* [ErrorHandler](#ErrorHandler)
    * [new ErrorHandler()](#new_ErrorHandler_new)
    * [.initErrorContainer()](#ErrorHandler+initErrorContainer)
    * [.registerWindowListener()](#ErrorHandler+registerWindowListener)
    * [.handleError(error, context, type, metadata)](#ErrorHandler+handleError)
    * [.processError(error, context, type, metadata)](#ErrorHandler+processError) ⇒ <code>Object</code>
    * [.generateErrorId()](#ErrorHandler+generateErrorId) ⇒ <code>string</code>
    * [.determineSeverity(type, message)](#ErrorHandler+determineSeverity) ⇒ <code>string</code>
    * [.addToErrorQueue(errorInfo)](#ErrorHandler+addToErrorQueue)
    * [.logError(errorInfo)](#ErrorHandler+logError)
    * [.getLogLevel(severity)](#ErrorHandler+getLogLevel) ⇒ <code>string</code>
    * [.showUserNotification(errorInfo)](#ErrorHandler+showUserNotification)
    * [.createUserNotification(errorInfo)](#ErrorHandler+createUserNotification)
    * [.getUserFriendlyMessage(errorInfo)](#ErrorHandler+getUserFriendlyMessage) ⇒ <code>string</code>
    * [.escapeHtml(str)](#ErrorHandler+escapeHtml) ⇒ <code>string</code>
    * [.attemptRecovery(errorInfo)](#ErrorHandler+attemptRecovery)
    * [.reportError(errorInfo)](#ErrorHandler+reportError)
    * [.getRecoveryStrategy(errorInfo)](#ErrorHandler+getRecoveryStrategy) ⇒ <code>Object</code> \| <code>null</code>
    * [.executeRecoveryStrategy(strategy, errorInfo)](#ErrorHandler+executeRecoveryStrategy)
    * [.showRecoveryNotification(message)](#ErrorHandler+showRecoveryNotification)
    * [.retryOperation(errorInfo)](#ErrorHandler+retryOperation)
    * [.getRecentErrors(limit)](#ErrorHandler+getRecentErrors) ⇒ <code>Array</code>
    * [.clearErrors()](#ErrorHandler+clearErrors)
    * [.setDebugMode(enabled)](#ErrorHandler+setDebugMode)
    * [.destroy()](#ErrorHandler+destroy)

<a name="new_ErrorHandler_new"></a>

### new ErrorHandler()
Create an ErrorHandler instance

<a name="ErrorHandler+initErrorContainer"></a>

### errorHandler.initErrorContainer()
Initialize error notification container

**Kind**: instance method of [<code>ErrorHandler</code>](#ErrorHandler)  
<a name="ErrorHandler+registerWindowListener"></a>

### errorHandler.registerWindowListener()
Set up global error handler for unhandled errors

**Kind**: instance method of [<code>ErrorHandler</code>](#ErrorHandler)  
<a name="ErrorHandler+handleError"></a>

### errorHandler.handleError(error, context, type, metadata)
Handle errors with classification and user feedback

**Kind**: instance method of [<code>ErrorHandler</code>](#ErrorHandler)  

| Param | Type | Description |
| --- | --- | --- |
| error | <code>Error</code> \| <code>string</code> | The error object or message |
| context | <code>string</code> | Context where the error occurred |
| type | <code>string</code> | Type of error (api, canvas, validation, etc.) |
| metadata | <code>Object</code> | Additional error metadata |

<a name="ErrorHandler+processError"></a>

### errorHandler.processError(error, context, type, metadata) ⇒ <code>Object</code>
Process error into standardized format

**Kind**: instance method of [<code>ErrorHandler</code>](#ErrorHandler)  
**Returns**: <code>Object</code> - Processed error information  

| Param | Type | Description |
| --- | --- | --- |
| error | <code>Error</code> \| <code>string</code> | The error |
| context | <code>string</code> | Error context |
| type | <code>string</code> | Error type |
| metadata | <code>Object</code> | Additional metadata |

<a name="ErrorHandler+generateErrorId"></a>

### errorHandler.generateErrorId() ⇒ <code>string</code>
Generate unique error ID

**Kind**: instance method of [<code>ErrorHandler</code>](#ErrorHandler)  
**Returns**: <code>string</code> - Unique error identifier  
<a name="ErrorHandler+determineSeverity"></a>

### errorHandler.determineSeverity(type, message) ⇒ <code>string</code>
Determine error severity based on type and message

**Kind**: instance method of [<code>ErrorHandler</code>](#ErrorHandler)  
**Returns**: <code>string</code> - Severity level (low, medium, high, critical)  

| Param | Type | Description |
| --- | --- | --- |
| type | <code>string</code> | Error type |
| message | <code>string</code> | Error message |

<a name="ErrorHandler+addToErrorQueue"></a>

### errorHandler.addToErrorQueue(errorInfo)
Add error to internal queue with size management

**Kind**: instance method of [<code>ErrorHandler</code>](#ErrorHandler)  

| Param | Type | Description |
| --- | --- | --- |
| errorInfo | <code>Object</code> | Processed error information |

<a name="ErrorHandler+logError"></a>

### errorHandler.logError(errorInfo)
Log error for developers

**Kind**: instance method of [<code>ErrorHandler</code>](#ErrorHandler)  

| Param | Type | Description |
| --- | --- | --- |
| errorInfo | <code>Object</code> | Error information |

<a name="ErrorHandler+getLogLevel"></a>

### errorHandler.getLogLevel(severity) ⇒ <code>string</code>
Get appropriate console log level for severity

**Kind**: instance method of [<code>ErrorHandler</code>](#ErrorHandler)  
**Returns**: <code>string</code> - Console method name  

| Param | Type | Description |
| --- | --- | --- |
| severity | <code>string</code> | Error severity |

<a name="ErrorHandler+showUserNotification"></a>

### errorHandler.showUserNotification(errorInfo)
Show user notification based on error severity

**Kind**: instance method of [<code>ErrorHandler</code>](#ErrorHandler)  

| Param | Type | Description |
| --- | --- | --- |
| errorInfo | <code>Object</code> | Error information |

<a name="ErrorHandler+createUserNotification"></a>

### errorHandler.createUserNotification(errorInfo)
Create user-visible error notification

**Kind**: instance method of [<code>ErrorHandler</code>](#ErrorHandler)  

| Param | Type | Description |
| --- | --- | --- |
| errorInfo | <code>Object</code> | Error information |

<a name="ErrorHandler+getUserFriendlyMessage"></a>

### errorHandler.getUserFriendlyMessage(errorInfo) ⇒ <code>string</code>
Convert technical error to user-friendly message

**Kind**: instance method of [<code>ErrorHandler</code>](#ErrorHandler)  
**Returns**: <code>string</code> - User-friendly message  

| Param | Type | Description |
| --- | --- | --- |
| errorInfo | <code>Object</code> | Error information |

<a name="ErrorHandler+escapeHtml"></a>

### errorHandler.escapeHtml(str) ⇒ <code>string</code>
Escape HTML to prevent XSS in error messages

**Kind**: instance method of [<code>ErrorHandler</code>](#ErrorHandler)  
**Returns**: <code>string</code> - HTML-escaped string  

| Param | Type | Description |
| --- | --- | --- |
| str | <code>string</code> | String to escape |

<a name="ErrorHandler+attemptRecovery"></a>

### errorHandler.attemptRecovery(errorInfo)
Attempt recovery for recoverable errors

**Kind**: instance method of [<code>ErrorHandler</code>](#ErrorHandler)  

| Param | Type | Description |
| --- | --- | --- |
| errorInfo | <code>Object</code> | Processed error information |

<a name="ErrorHandler+reportError"></a>

### errorHandler.reportError(errorInfo)
Report error to external services

**Kind**: instance method of [<code>ErrorHandler</code>](#ErrorHandler)  

| Param | Type | Description |
| --- | --- | --- |
| errorInfo | <code>Object</code> | Error information |

<a name="ErrorHandler+getRecoveryStrategy"></a>

### errorHandler.getRecoveryStrategy(errorInfo) ⇒ <code>Object</code> \| <code>null</code>
Get recovery strategy for error type

**Kind**: instance method of [<code>ErrorHandler</code>](#ErrorHandler)  
**Returns**: <code>Object</code> \| <code>null</code> - Recovery strategy or null  

| Param | Type | Description |
| --- | --- | --- |
| errorInfo | <code>Object</code> | Error information |

<a name="ErrorHandler+executeRecoveryStrategy"></a>

### errorHandler.executeRecoveryStrategy(strategy, errorInfo)
Execute recovery strategy

**Kind**: instance method of [<code>ErrorHandler</code>](#ErrorHandler)  

| Param | Type | Description |
| --- | --- | --- |
| strategy | <code>Object</code> | Recovery strategy |
| errorInfo | <code>Object</code> | Error information |

<a name="ErrorHandler+showRecoveryNotification"></a>

### errorHandler.showRecoveryNotification(message)
Show recovery notification to user

**Kind**: instance method of [<code>ErrorHandler</code>](#ErrorHandler)  

| Param | Type | Description |
| --- | --- | --- |
| message | <code>string</code> | Recovery message |

<a name="ErrorHandler+retryOperation"></a>

### errorHandler.retryOperation(errorInfo)
Retry failed operation

**Kind**: instance method of [<code>ErrorHandler</code>](#ErrorHandler)  

| Param | Type | Description |
| --- | --- | --- |
| errorInfo | <code>Object</code> | Error information |

<a name="ErrorHandler+getRecentErrors"></a>

### errorHandler.getRecentErrors(limit) ⇒ <code>Array</code>
Get recent errors for debugging

**Kind**: instance method of [<code>ErrorHandler</code>](#ErrorHandler)  
**Returns**: <code>Array</code> - Recent error information  

| Param | Type | Description |
| --- | --- | --- |
| limit | <code>number</code> | Maximum number of errors to return |

<a name="ErrorHandler+clearErrors"></a>

### errorHandler.clearErrors()
Clear error queue

**Kind**: instance method of [<code>ErrorHandler</code>](#ErrorHandler)  
<a name="ErrorHandler+setDebugMode"></a>

### errorHandler.setDebugMode(enabled)
Set debug mode

**Kind**: instance method of [<code>ErrorHandler</code>](#ErrorHandler)  

| Param | Type | Description |
| --- | --- | --- |
| enabled | <code>boolean</code> | Whether to enable debug mode |

<a name="ErrorHandler+destroy"></a>

### errorHandler.destroy()
Destroy error handler and clean up

**Kind**: instance method of [<code>ErrorHandler</code>](#ErrorHandler)  
<a name="EventManager"></a>

## EventManager
Event Manager for Layers EditorCentralized event handling and management

**Kind**: global class  
<a name="HistoryManager"></a>

## HistoryManager
HistoryManager class

**Kind**: global class  

* [HistoryManager](#HistoryManager)
    * [new HistoryManager(config, canvasManager)](#new_HistoryManager_new)
    * [.saveState(description)](#HistoryManager+saveState)
    * [.getLayersSnapshot()](#HistoryManager+getLayersSnapshot) ⇒ <code>Array</code>
    * [.undo()](#HistoryManager+undo) ⇒ <code>boolean</code>
    * [.redo()](#HistoryManager+redo) ⇒ <code>boolean</code>
    * [.canUndo()](#HistoryManager+canUndo) ⇒ <code>boolean</code>
    * [.canRedo()](#HistoryManager+canRedo) ⇒ <code>boolean</code>
    * [.restoreState(state)](#HistoryManager+restoreState)
    * [.updateUndoRedoButtons()](#HistoryManager+updateUndoRedoButtons)
    * [.startBatch(description)](#HistoryManager+startBatch)
    * [.endBatch()](#HistoryManager+endBatch)
    * [.cancelBatch()](#HistoryManager+cancelBatch)
    * [.clearHistory()](#HistoryManager+clearHistory)
    * [.getHistoryInfo()](#HistoryManager+getHistoryInfo) ⇒ <code>Object</code>
    * [.getHistoryEntries(limit)](#HistoryManager+getHistoryEntries) ⇒ <code>Array</code>
    * [.revertTo(targetIndex)](#HistoryManager+revertTo) ⇒ <code>boolean</code>
    * [.compressHistory()](#HistoryManager+compressHistory)
    * [.setMaxHistorySteps(maxSteps)](#HistoryManager+setMaxHistorySteps)
    * [.hasUnsavedChanges()](#HistoryManager+hasUnsavedChanges) ⇒ <code>boolean</code>
    * [.saveInitialState()](#HistoryManager+saveInitialState)
    * [.exportHistory()](#HistoryManager+exportHistory) ⇒ <code>Object</code>
    * [.getMemoryUsage()](#HistoryManager+getMemoryUsage) ⇒ <code>Object</code>
    * [.destroy()](#HistoryManager+destroy)

<a name="new_HistoryManager_new"></a>

### new HistoryManager(config, canvasManager)

| Param | Type | Description |
| --- | --- | --- |
| config | <code>Object</code> | Configuration object or editor/canvasManager reference |
| canvasManager | [<code>CanvasManager</code>](#CanvasManager) | Reference to the canvas manager (optional) |

<a name="HistoryManager+saveState"></a>

### historyManager.saveState(description)
Save current state to history

**Kind**: instance method of [<code>HistoryManager</code>](#HistoryManager)  

| Param | Type | Description |
| --- | --- | --- |
| description | <code>string</code> | Optional description of the change |

<a name="HistoryManager+getLayersSnapshot"></a>

### historyManager.getLayersSnapshot() ⇒ <code>Array</code>
Get snapshot of current layers

**Kind**: instance method of [<code>HistoryManager</code>](#HistoryManager)  
**Returns**: <code>Array</code> - Deep copy of layers array  
<a name="HistoryManager+undo"></a>

### historyManager.undo() ⇒ <code>boolean</code>
Undo last action

**Kind**: instance method of [<code>HistoryManager</code>](#HistoryManager)  
**Returns**: <code>boolean</code> - True if undo was performed  
<a name="HistoryManager+redo"></a>

### historyManager.redo() ⇒ <code>boolean</code>
Redo next action

**Kind**: instance method of [<code>HistoryManager</code>](#HistoryManager)  
**Returns**: <code>boolean</code> - True if redo was performed  
<a name="HistoryManager+canUndo"></a>

### historyManager.canUndo() ⇒ <code>boolean</code>
Check if undo is available

**Kind**: instance method of [<code>HistoryManager</code>](#HistoryManager)  
**Returns**: <code>boolean</code> - True if can undo  
<a name="HistoryManager+canRedo"></a>

### historyManager.canRedo() ⇒ <code>boolean</code>
Check if redo is available

**Kind**: instance method of [<code>HistoryManager</code>](#HistoryManager)  
**Returns**: <code>boolean</code> - True if can redo  
<a name="HistoryManager+restoreState"></a>

### historyManager.restoreState(state)
Restore state from history

**Kind**: instance method of [<code>HistoryManager</code>](#HistoryManager)  

| Param | Type | Description |
| --- | --- | --- |
| state | <code>Object</code> | State object to restore |

<a name="HistoryManager+updateUndoRedoButtons"></a>

### historyManager.updateUndoRedoButtons()
Update undo/redo button states

**Kind**: instance method of [<code>HistoryManager</code>](#HistoryManager)  
<a name="HistoryManager+startBatch"></a>

### historyManager.startBatch(description)
Start batch mode for grouped operations

**Kind**: instance method of [<code>HistoryManager</code>](#HistoryManager)  

| Param | Type | Description |
| --- | --- | --- |
| description | <code>string</code> | Description for the batch operation |

<a name="HistoryManager+endBatch"></a>

### historyManager.endBatch()
End batch mode and save as single history entry

**Kind**: instance method of [<code>HistoryManager</code>](#HistoryManager)  
<a name="HistoryManager+cancelBatch"></a>

### historyManager.cancelBatch()
Cancel batch mode without saving

**Kind**: instance method of [<code>HistoryManager</code>](#HistoryManager)  
<a name="HistoryManager+clearHistory"></a>

### historyManager.clearHistory()
Clear all history

**Kind**: instance method of [<code>HistoryManager</code>](#HistoryManager)  
<a name="HistoryManager+getHistoryInfo"></a>

### historyManager.getHistoryInfo() ⇒ <code>Object</code>
Get history information

**Kind**: instance method of [<code>HistoryManager</code>](#HistoryManager)  
**Returns**: <code>Object</code> - History information  
<a name="HistoryManager+getHistoryEntries"></a>

### historyManager.getHistoryEntries(limit) ⇒ <code>Array</code>
Get history entries for UI display

**Kind**: instance method of [<code>HistoryManager</code>](#HistoryManager)  
**Returns**: <code>Array</code> - Array of history entries  

| Param | Type | Description |
| --- | --- | --- |
| limit | <code>number</code> | Maximum number of entries to return |

<a name="HistoryManager+revertTo"></a>

### historyManager.revertTo(targetIndex) ⇒ <code>boolean</code>
Revert to specific history entry

**Kind**: instance method of [<code>HistoryManager</code>](#HistoryManager)  
**Returns**: <code>boolean</code> - True if revert was successful  

| Param | Type | Description |
| --- | --- | --- |
| targetIndex | <code>number</code> | Index to revert to |

<a name="HistoryManager+compressHistory"></a>

### historyManager.compressHistory()
Compress history to save memory

**Kind**: instance method of [<code>HistoryManager</code>](#HistoryManager)  
<a name="HistoryManager+setMaxHistorySteps"></a>

### historyManager.setMaxHistorySteps(maxSteps)
Set maximum history steps

**Kind**: instance method of [<code>HistoryManager</code>](#HistoryManager)  

| Param | Type | Description |
| --- | --- | --- |
| maxSteps | <code>number</code> | Maximum number of history steps |

<a name="HistoryManager+hasUnsavedChanges"></a>

### historyManager.hasUnsavedChanges() ⇒ <code>boolean</code>
Check if current state differs from last saved state

**Kind**: instance method of [<code>HistoryManager</code>](#HistoryManager)  
**Returns**: <code>boolean</code> - True if state has changed  
<a name="HistoryManager+saveInitialState"></a>

### historyManager.saveInitialState()
Save initial state - clears history and saves current layers as baseline.Called after layers are loaded from API to establish undo baseline.

**Kind**: instance method of [<code>HistoryManager</code>](#HistoryManager)  
<a name="HistoryManager+exportHistory"></a>

### historyManager.exportHistory() ⇒ <code>Object</code>
Export history for debugging

**Kind**: instance method of [<code>HistoryManager</code>](#HistoryManager)  
**Returns**: <code>Object</code> - History export  
<a name="HistoryManager+getMemoryUsage"></a>

### historyManager.getMemoryUsage() ⇒ <code>Object</code>
Get memory usage estimate

**Kind**: instance method of [<code>HistoryManager</code>](#HistoryManager)  
**Returns**: <code>Object</code> - Memory usage information  
<a name="HistoryManager+destroy"></a>

### historyManager.destroy()
Clean up resources and clear state

**Kind**: instance method of [<code>HistoryManager</code>](#HistoryManager)  
<a name="ImageLoader"></a>

## ImageLoader
**Kind**: global class  

* [ImageLoader](#ImageLoader)
    * [new ImageLoader()](#new_ImageLoader_new)
    * [new ImageLoader(options)](#new_ImageLoader_new)
    * [.load()](#ImageLoader+load)
    * [.buildUrlList()](#ImageLoader+buildUrlList) ⇒ <code>Array.&lt;string&gt;</code>
    * [.isSameOrigin(url)](#ImageLoader+isSameOrigin) ⇒ <code>boolean</code>
    * [.tryLoadImage(urls, index, [withCors])](#ImageLoader+tryLoadImage)
    * [.loadTestImage()](#ImageLoader+loadTestImage)
    * [.createTestImageSvg(filename)](#ImageLoader+createTestImageSvg) ⇒ <code>string</code>
    * [.getImage()](#ImageLoader+getImage) ⇒ <code>HTMLImageElement</code> \| <code>null</code>
    * [.isLoadingImage()](#ImageLoader+isLoadingImage) ⇒ <code>boolean</code>
    * [.abort()](#ImageLoader+abort)
    * [.destroy()](#ImageLoader+destroy)

<a name="new_ImageLoader_new"></a>

### new ImageLoader()
ImageLoader - Handles background image loading for the Layers editorThis module is responsible for:- Loading background images from multiple sources (config, page, MediaWiki API)- Fallback to test images when actual image unavailable- Cross-origin handling

<a name="new_ImageLoader_new"></a>

### new ImageLoader(options)
Creates a new ImageLoader instance


| Param | Type | Description |
| --- | --- | --- |
| options | <code>Object</code> | Configuration options |
| [options.filename] | <code>string</code> | The filename to load |
| [options.backgroundImageUrl] | <code>string</code> | Direct URL to background image |
| [options.onLoad] | <code>function</code> | Callback when image loads successfully |
| [options.onError] | <code>function</code> | Callback when all load attempts fail |

<a name="ImageLoader+load"></a>

### imageLoader.load()
Start loading the background imageTries multiple sources in priority order

**Kind**: instance method of [<code>ImageLoader</code>](#ImageLoader)  
<a name="ImageLoader+buildUrlList"></a>

### imageLoader.buildUrlList() ⇒ <code>Array.&lt;string&gt;</code>
Build a prioritized list of URLs to try loading

**Kind**: instance method of [<code>ImageLoader</code>](#ImageLoader)  
**Returns**: <code>Array.&lt;string&gt;</code> - Array of URLs to try  
<a name="ImageLoader+isSameOrigin"></a>

### imageLoader.isSameOrigin(url) ⇒ <code>boolean</code>
Check if a URL is same-origin

**Kind**: instance method of [<code>ImageLoader</code>](#ImageLoader)  
**Returns**: <code>boolean</code> - True if same-origin  

| Param | Type | Description |
| --- | --- | --- |
| url | <code>string</code> | URL to check |

<a name="ImageLoader+tryLoadImage"></a>

### imageLoader.tryLoadImage(urls, index, [withCors])
Try to load an image from a list of URLs

**Kind**: instance method of [<code>ImageLoader</code>](#ImageLoader)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| urls | <code>Array.&lt;string&gt;</code> |  | Array of URLs to try |
| index | <code>number</code> |  | Current index in the array |
| [withCors] | <code>boolean</code> | <code>false</code> | Whether to retry with crossOrigin after failure |

<a name="ImageLoader+loadTestImage"></a>

### imageLoader.loadTestImage()
Load a test/placeholder image when actual image unavailable

**Kind**: instance method of [<code>ImageLoader</code>](#ImageLoader)  
<a name="ImageLoader+createTestImageSvg"></a>

### imageLoader.createTestImageSvg(filename) ⇒ <code>string</code>
Create an SVG test image

**Kind**: instance method of [<code>ImageLoader</code>](#ImageLoader)  
**Returns**: <code>string</code> - SVG markup  

| Param | Type | Description |
| --- | --- | --- |
| filename | <code>string</code> | The filename to display |

<a name="ImageLoader+getImage"></a>

### imageLoader.getImage() ⇒ <code>HTMLImageElement</code> \| <code>null</code>
Get the loaded image

**Kind**: instance method of [<code>ImageLoader</code>](#ImageLoader)  
**Returns**: <code>HTMLImageElement</code> \| <code>null</code> - The loaded image or null  
<a name="ImageLoader+isLoadingImage"></a>

### imageLoader.isLoadingImage() ⇒ <code>boolean</code>
Check if loading is in progress

**Kind**: instance method of [<code>ImageLoader</code>](#ImageLoader)  
**Returns**: <code>boolean</code> - True if loading  
<a name="ImageLoader+abort"></a>

### imageLoader.abort()
Abort any pending load operation

**Kind**: instance method of [<code>ImageLoader</code>](#ImageLoader)  
<a name="ImageLoader+destroy"></a>

### imageLoader.destroy()
Clean up resources

**Kind**: instance method of [<code>ImageLoader</code>](#ImageLoader)  
<a name="ImageLoader"></a>

## ImageLoader
ImageLoader class - handles background image loading with fallbacks

**Kind**: global class  

* [ImageLoader](#ImageLoader)
    * [new ImageLoader()](#new_ImageLoader_new)
    * [new ImageLoader(options)](#new_ImageLoader_new)
    * [.load()](#ImageLoader+load)
    * [.buildUrlList()](#ImageLoader+buildUrlList) ⇒ <code>Array.&lt;string&gt;</code>
    * [.isSameOrigin(url)](#ImageLoader+isSameOrigin) ⇒ <code>boolean</code>
    * [.tryLoadImage(urls, index, [withCors])](#ImageLoader+tryLoadImage)
    * [.loadTestImage()](#ImageLoader+loadTestImage)
    * [.createTestImageSvg(filename)](#ImageLoader+createTestImageSvg) ⇒ <code>string</code>
    * [.getImage()](#ImageLoader+getImage) ⇒ <code>HTMLImageElement</code> \| <code>null</code>
    * [.isLoadingImage()](#ImageLoader+isLoadingImage) ⇒ <code>boolean</code>
    * [.abort()](#ImageLoader+abort)
    * [.destroy()](#ImageLoader+destroy)

<a name="new_ImageLoader_new"></a>

### new ImageLoader()
ImageLoader - Handles background image loading for the Layers editorThis module is responsible for:- Loading background images from multiple sources (config, page, MediaWiki API)- Fallback to test images when actual image unavailable- Cross-origin handling

<a name="new_ImageLoader_new"></a>

### new ImageLoader(options)
Creates a new ImageLoader instance


| Param | Type | Description |
| --- | --- | --- |
| options | <code>Object</code> | Configuration options |
| [options.filename] | <code>string</code> | The filename to load |
| [options.backgroundImageUrl] | <code>string</code> | Direct URL to background image |
| [options.onLoad] | <code>function</code> | Callback when image loads successfully |
| [options.onError] | <code>function</code> | Callback when all load attempts fail |

<a name="ImageLoader+load"></a>

### imageLoader.load()
Start loading the background imageTries multiple sources in priority order

**Kind**: instance method of [<code>ImageLoader</code>](#ImageLoader)  
<a name="ImageLoader+buildUrlList"></a>

### imageLoader.buildUrlList() ⇒ <code>Array.&lt;string&gt;</code>
Build a prioritized list of URLs to try loading

**Kind**: instance method of [<code>ImageLoader</code>](#ImageLoader)  
**Returns**: <code>Array.&lt;string&gt;</code> - Array of URLs to try  
<a name="ImageLoader+isSameOrigin"></a>

### imageLoader.isSameOrigin(url) ⇒ <code>boolean</code>
Check if a URL is same-origin

**Kind**: instance method of [<code>ImageLoader</code>](#ImageLoader)  
**Returns**: <code>boolean</code> - True if same-origin  

| Param | Type | Description |
| --- | --- | --- |
| url | <code>string</code> | URL to check |

<a name="ImageLoader+tryLoadImage"></a>

### imageLoader.tryLoadImage(urls, index, [withCors])
Try to load an image from a list of URLs

**Kind**: instance method of [<code>ImageLoader</code>](#ImageLoader)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| urls | <code>Array.&lt;string&gt;</code> |  | Array of URLs to try |
| index | <code>number</code> |  | Current index in the array |
| [withCors] | <code>boolean</code> | <code>false</code> | Whether to retry with crossOrigin after failure |

<a name="ImageLoader+loadTestImage"></a>

### imageLoader.loadTestImage()
Load a test/placeholder image when actual image unavailable

**Kind**: instance method of [<code>ImageLoader</code>](#ImageLoader)  
<a name="ImageLoader+createTestImageSvg"></a>

### imageLoader.createTestImageSvg(filename) ⇒ <code>string</code>
Create an SVG test image

**Kind**: instance method of [<code>ImageLoader</code>](#ImageLoader)  
**Returns**: <code>string</code> - SVG markup  

| Param | Type | Description |
| --- | --- | --- |
| filename | <code>string</code> | The filename to display |

<a name="ImageLoader+getImage"></a>

### imageLoader.getImage() ⇒ <code>HTMLImageElement</code> \| <code>null</code>
Get the loaded image

**Kind**: instance method of [<code>ImageLoader</code>](#ImageLoader)  
**Returns**: <code>HTMLImageElement</code> \| <code>null</code> - The loaded image or null  
<a name="ImageLoader+isLoadingImage"></a>

### imageLoader.isLoadingImage() ⇒ <code>boolean</code>
Check if loading is in progress

**Kind**: instance method of [<code>ImageLoader</code>](#ImageLoader)  
**Returns**: <code>boolean</code> - True if loading  
<a name="ImageLoader+abort"></a>

### imageLoader.abort()
Abort any pending load operation

**Kind**: instance method of [<code>ImageLoader</code>](#ImageLoader)  
<a name="ImageLoader+destroy"></a>

### imageLoader.destroy()
Clean up resources

**Kind**: instance method of [<code>ImageLoader</code>](#ImageLoader)  
<a name="ImportExportManager"></a>

## ImportExportManager
**Kind**: global class  
**Since**: 0.9.0  

* [ImportExportManager](#ImportExportManager)
    * [new ImportExportManager()](#new_ImportExportManager_new)
    * [new ImportExportManager(config)](#new_ImportExportManager_new)
    * [.importFromFile(file, [options])](#ImportExportManager+importFromFile) ⇒ <code>Promise.&lt;Array&gt;</code>
    * [.parseLayersJSON(text)](#ImportExportManager+parseLayersJSON) ⇒ <code>Array</code>
    * [.exportToFile([options])](#ImportExportManager+exportToFile) ⇒ <code>boolean</code>
    * [.getLayersForExport()](#ImportExportManager+getLayersForExport) ⇒ <code>Array</code>
    * [.createImportButton([options])](#ImportExportManager+createImportButton) ⇒ <code>Object</code>
    * [.createExportButton([options])](#ImportExportManager+createExportButton) ⇒ <code>HTMLButtonElement</code>

<a name="new_ImportExportManager_new"></a>

### new ImportExportManager()
ImportExportManager - Handles layer import/export functionalityThis module provides JSON import and export capabilities for layer data,supporting both modern and legacy browsers.

<a name="new_ImportExportManager_new"></a>

### new ImportExportManager(config)
Create an ImportExportManager


| Param | Type | Description |
| --- | --- | --- |
| config | <code>Object</code> | Configuration object |
| config.editor | <code>Object</code> | Reference to the LayersEditor instance |

<a name="ImportExportManager+importFromFile"></a>

### importExportManager.importFromFile(file, [options]) ⇒ <code>Promise.&lt;Array&gt;</code>
Import layers from a JSON file

**Kind**: instance method of [<code>ImportExportManager</code>](#ImportExportManager)  
**Returns**: <code>Promise.&lt;Array&gt;</code> - Resolves with imported layers or rejects on error  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| file | <code>File</code> |  | The JSON file to import |
| [options] | <code>Object</code> |  | Import options |
| [options.confirmOverwrite] | <code>boolean</code> | <code>true</code> | Prompt for confirmation if unsaved changes |

<a name="ImportExportManager+parseLayersJSON"></a>

### importExportManager.parseLayersJSON(text) ⇒ <code>Array</code>
Parse layers from JSON text

**Kind**: instance method of [<code>ImportExportManager</code>](#ImportExportManager)  
**Returns**: <code>Array</code> - Array of layer objects  
**Throws**:

- <code>Error</code> If JSON is invalid or format is unrecognized


| Param | Type | Description |
| --- | --- | --- |
| text | <code>string</code> | JSON text to parse |

<a name="ImportExportManager+exportToFile"></a>

### importExportManager.exportToFile([options]) ⇒ <code>boolean</code>
Export layers to a JSON file

**Kind**: instance method of [<code>ImportExportManager</code>](#ImportExportManager)  
**Returns**: <code>boolean</code> - True if export was initiated successfully  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [options] | <code>Object</code> |  | Export options |
| [options.filename] | <code>string</code> |  | Base filename (without extension) |
| [options.pretty] | <code>boolean</code> | <code>true</code> | Pretty-print the JSON |

<a name="ImportExportManager+getLayersForExport"></a>

### importExportManager.getLayersForExport() ⇒ <code>Array</code>
Get layers data for export

**Kind**: instance method of [<code>ImportExportManager</code>](#ImportExportManager)  
**Returns**: <code>Array</code> - Array of layer objects  
<a name="ImportExportManager+createImportButton"></a>

### importExportManager.createImportButton([options]) ⇒ <code>Object</code>
Create an import button with file input

**Kind**: instance method of [<code>ImportExportManager</code>](#ImportExportManager)  
**Returns**: <code>Object</code> - Object with { button, input } elements  

| Param | Type | Description |
| --- | --- | --- |
| [options] | <code>Object</code> | Button options |
| [options.buttonText] | <code>string</code> | Text for the import button |
| [options.onSuccess] | <code>function</code> | Callback on successful import |
| [options.onError] | <code>function</code> | Callback on import error |

<a name="ImportExportManager+createExportButton"></a>

### importExportManager.createExportButton([options]) ⇒ <code>HTMLButtonElement</code>
Create an export button

**Kind**: instance method of [<code>ImportExportManager</code>](#ImportExportManager)  
**Returns**: <code>HTMLButtonElement</code> - The export button element  

| Param | Type | Description |
| --- | --- | --- |
| [options] | <code>Object</code> | Button options |
| [options.buttonText] | <code>string</code> | Text for the export button |
| [options.onSuccess] | <code>function</code> | Callback on successful export |
| [options.onError] | <code>function</code> | Callback on export error |

<a name="ImportExportManager"></a>

## ImportExportManager
ImportExportManager classHandles import/export of layer data as JSON files.

**Kind**: global class  

* [ImportExportManager](#ImportExportManager)
    * [new ImportExportManager()](#new_ImportExportManager_new)
    * [new ImportExportManager(config)](#new_ImportExportManager_new)
    * [.importFromFile(file, [options])](#ImportExportManager+importFromFile) ⇒ <code>Promise.&lt;Array&gt;</code>
    * [.parseLayersJSON(text)](#ImportExportManager+parseLayersJSON) ⇒ <code>Array</code>
    * [.exportToFile([options])](#ImportExportManager+exportToFile) ⇒ <code>boolean</code>
    * [.getLayersForExport()](#ImportExportManager+getLayersForExport) ⇒ <code>Array</code>
    * [.createImportButton([options])](#ImportExportManager+createImportButton) ⇒ <code>Object</code>
    * [.createExportButton([options])](#ImportExportManager+createExportButton) ⇒ <code>HTMLButtonElement</code>

<a name="new_ImportExportManager_new"></a>

### new ImportExportManager()
ImportExportManager - Handles layer import/export functionalityThis module provides JSON import and export capabilities for layer data,supporting both modern and legacy browsers.

<a name="new_ImportExportManager_new"></a>

### new ImportExportManager(config)
Create an ImportExportManager


| Param | Type | Description |
| --- | --- | --- |
| config | <code>Object</code> | Configuration object |
| config.editor | <code>Object</code> | Reference to the LayersEditor instance |

<a name="ImportExportManager+importFromFile"></a>

### importExportManager.importFromFile(file, [options]) ⇒ <code>Promise.&lt;Array&gt;</code>
Import layers from a JSON file

**Kind**: instance method of [<code>ImportExportManager</code>](#ImportExportManager)  
**Returns**: <code>Promise.&lt;Array&gt;</code> - Resolves with imported layers or rejects on error  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| file | <code>File</code> |  | The JSON file to import |
| [options] | <code>Object</code> |  | Import options |
| [options.confirmOverwrite] | <code>boolean</code> | <code>true</code> | Prompt for confirmation if unsaved changes |

<a name="ImportExportManager+parseLayersJSON"></a>

### importExportManager.parseLayersJSON(text) ⇒ <code>Array</code>
Parse layers from JSON text

**Kind**: instance method of [<code>ImportExportManager</code>](#ImportExportManager)  
**Returns**: <code>Array</code> - Array of layer objects  
**Throws**:

- <code>Error</code> If JSON is invalid or format is unrecognized


| Param | Type | Description |
| --- | --- | --- |
| text | <code>string</code> | JSON text to parse |

<a name="ImportExportManager+exportToFile"></a>

### importExportManager.exportToFile([options]) ⇒ <code>boolean</code>
Export layers to a JSON file

**Kind**: instance method of [<code>ImportExportManager</code>](#ImportExportManager)  
**Returns**: <code>boolean</code> - True if export was initiated successfully  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [options] | <code>Object</code> |  | Export options |
| [options.filename] | <code>string</code> |  | Base filename (without extension) |
| [options.pretty] | <code>boolean</code> | <code>true</code> | Pretty-print the JSON |

<a name="ImportExportManager+getLayersForExport"></a>

### importExportManager.getLayersForExport() ⇒ <code>Array</code>
Get layers data for export

**Kind**: instance method of [<code>ImportExportManager</code>](#ImportExportManager)  
**Returns**: <code>Array</code> - Array of layer objects  
<a name="ImportExportManager+createImportButton"></a>

### importExportManager.createImportButton([options]) ⇒ <code>Object</code>
Create an import button with file input

**Kind**: instance method of [<code>ImportExportManager</code>](#ImportExportManager)  
**Returns**: <code>Object</code> - Object with { button, input } elements  

| Param | Type | Description |
| --- | --- | --- |
| [options] | <code>Object</code> | Button options |
| [options.buttonText] | <code>string</code> | Text for the import button |
| [options.onSuccess] | <code>function</code> | Callback on successful import |
| [options.onError] | <code>function</code> | Callback on import error |

<a name="ImportExportManager+createExportButton"></a>

### importExportManager.createExportButton([options]) ⇒ <code>HTMLButtonElement</code>
Create an export button

**Kind**: instance method of [<code>ImportExportManager</code>](#ImportExportManager)  
**Returns**: <code>HTMLButtonElement</code> - The export button element  

| Param | Type | Description |
| --- | --- | --- |
| [options] | <code>Object</code> | Button options |
| [options.buttonText] | <code>string</code> | Text for the export button |
| [options.onSuccess] | <code>function</code> | Callback on successful export |
| [options.onError] | <code>function</code> | Callback on export error |

<a name="LayerPanel"></a>

## LayerPanel
LayerPanel classManages the layer list, visibility, ordering, and layer properties

**Kind**: global class  

* [LayerPanel](#LayerPanel)
    * [new LayerPanel(config)](#new_LayerPanel_new)
    * [.initLayerItemFactory()](#LayerPanel+initLayerItemFactory)
    * [.getLayers()](#LayerPanel+getLayers) ⇒ <code>Array</code>
    * [.getSelectedLayerId()](#LayerPanel+getSelectedLayerId) ⇒ <code>string</code> \| <code>null</code>
    * [.getSelectedLayerIds()](#LayerPanel+getSelectedLayerIds) ⇒ <code>Array</code>
    * [.subscribeToState()](#LayerPanel+subscribeToState)
    * [.isDebugEnabled()](#LayerPanel+isDebugEnabled) ⇒ <code>boolean</code>
    * [.logDebug(...args)](#LayerPanel+logDebug)
    * [.logWarn(...args)](#LayerPanel+logWarn)
    * [.logError(...args)](#LayerPanel+logError)
    * [.addDocumentListener(event, handler, [options])](#LayerPanel+addDocumentListener)
    * [.addTargetListener(target, event, handler, [options])](#LayerPanel+addTargetListener)
    * [.removeDocumentListeners()](#LayerPanel+removeDocumentListeners)
    * [.removeTargetListeners()](#LayerPanel+removeTargetListeners)
    * [.removeAllListeners()](#LayerPanel+removeAllListeners)
    * [.registerDialogCleanup(cleanupFn)](#LayerPanel+registerDialogCleanup)
    * [.runDialogCleanups()](#LayerPanel+runDialogCleanups)
    * [.destroy()](#LayerPanel+destroy)
    * [.msg(key, fallback)](#LayerPanel+msg) ⇒ <code>string</code>
    * [.setAttributes(element, attributes)](#LayerPanel+setAttributes)
    * [.createSVGElement(tag, attributes)](#LayerPanel+createSVGElement) ⇒ <code>Element</code> \| <code>null</code>
    * [.createEyeIcon(visible)](#LayerPanel+createEyeIcon) ⇒ <code>Element</code>
    * [.createLockIcon(locked)](#LayerPanel+createLockIcon) ⇒ <code>Element</code>
    * [.createDeleteIcon()](#LayerPanel+createDeleteIcon) ⇒ <code>Element</code>
    * [.updateCodePanel()](#LayerPanel+updateCodePanel)
    * [.createInterface()](#LayerPanel+createInterface)
    * [.setupEventHandlers()](#LayerPanel+setupEventHandlers)
    * [.updateLayers(layers)](#LayerPanel+updateLayers)
    * [.renderLayerList()](#LayerPanel+renderLayerList)
    * [.renderBackgroundLayerItem()](#LayerPanel+renderBackgroundLayerItem)
    * [.createBackgroundLayerItem()](#LayerPanel+createBackgroundLayerItem) ⇒ <code>HTMLElement</code>
    * [.updateBackgroundLayerItem([item])](#LayerPanel+updateBackgroundLayerItem)
    * [.getBackgroundVisible()](#LayerPanel+getBackgroundVisible) ⇒ <code>boolean</code>
    * [.getBackgroundOpacity()](#LayerPanel+getBackgroundOpacity) ⇒ <code>number</code>
    * [.toggleBackgroundVisibility()](#LayerPanel+toggleBackgroundVisibility)
    * [.setBackgroundOpacity(opacity)](#LayerPanel+setBackgroundOpacity)
    * [.moveLayer(layerId, direction)](#LayerPanel+moveLayer)
    * [.createLayerItem(layer, index)](#LayerPanel+createLayerItem) ⇒ <code>HTMLElement</code>
    * [.updateLayerItem(item, layer, index)](#LayerPanel+updateLayerItem)
    * [.getDefaultLayerName(layer)](#LayerPanel+getDefaultLayerName) ⇒ <code>string</code>
    * [.handleLayerListClick(e)](#LayerPanel+handleLayerListClick)
    * [.handleLayerListKeydown(e)](#LayerPanel+handleLayerListKeydown)
    * [.focusLayerAtIndex(index)](#LayerPanel+focusLayerAtIndex)
    * [.selectLayer(layerId, [fromCanvas], [addToSelection])](#LayerPanel+selectLayer)
    * [.selectLayerRange(layerId)](#LayerPanel+selectLayerRange)
    * [.toggleLayerVisibility(layerId)](#LayerPanel+toggleLayerVisibility)
    * [.toggleLayerLock(layerId)](#LayerPanel+toggleLayerLock)
    * [.deleteLayer(layerId)](#LayerPanel+deleteLayer)
    * [.editLayerName(layerId, nameElement)](#LayerPanel+editLayerName)
    * [.updatePropertiesPanel(layerId)](#LayerPanel+updatePropertiesPanel)
    * [.createPropertiesForm(layer)](#LayerPanel+createPropertiesForm) ⇒ <code>HTMLElement</code>
    * [.syncPropertiesFromLayer(layer)](#LayerPanel+syncPropertiesFromLayer)
    * [.setupDragAndDrop()](#LayerPanel+setupDragAndDrop)
    * [.reorderLayers(draggedId, targetId)](#LayerPanel+reorderLayers)
    * [.createConfirmDialog(message, onConfirm)](#LayerPanel+createConfirmDialog)
    * [.simpleConfirm(message)](#LayerPanel+simpleConfirm) ⇒ <code>boolean</code>
    * [.renderCodeSnippet([layers])](#LayerPanel+renderCodeSnippet) ⇒ <code>string</code>

<a name="new_LayerPanel_new"></a>

### new LayerPanel(config)
Create a LayerPanel instance


| Param | Type | Description |
| --- | --- | --- |
| config | <code>Object</code> | Configuration object |
| config.container | <code>HTMLElement</code> | The container element for the panel |
| config.editor | <code>window.LayersEditor</code> | A reference to the main editor instance |
| [config.inspectorContainer] | <code>HTMLElement</code> | Optional inspector container |

<a name="LayerPanel+initLayerItemFactory"></a>

### layerPanel.initLayerItemFactory()
Initialize the LayerItemFactory with appropriate callbacks

**Kind**: instance method of [<code>LayerPanel</code>](#LayerPanel)  
<a name="LayerPanel+getLayers"></a>

### layerPanel.getLayers() ⇒ <code>Array</code>
Get layers from StateManager (single source of truth)

**Kind**: instance method of [<code>LayerPanel</code>](#LayerPanel)  
**Returns**: <code>Array</code> - Current layers array  
<a name="LayerPanel+getSelectedLayerId"></a>

### layerPanel.getSelectedLayerId() ⇒ <code>string</code> \| <code>null</code>
Get selected layer ID from StateManager

**Kind**: instance method of [<code>LayerPanel</code>](#LayerPanel)  
**Returns**: <code>string</code> \| <code>null</code> - Currently selected layer ID  
<a name="LayerPanel+getSelectedLayerIds"></a>

### layerPanel.getSelectedLayerIds() ⇒ <code>Array</code>
Get all selected layer IDs from StateManager

**Kind**: instance method of [<code>LayerPanel</code>](#LayerPanel)  
**Returns**: <code>Array</code> - Array of selected layer IDs  
<a name="LayerPanel+subscribeToState"></a>

### layerPanel.subscribeToState()
Subscribe to StateManager changes for reactive updates

**Kind**: instance method of [<code>LayerPanel</code>](#LayerPanel)  
<a name="LayerPanel+isDebugEnabled"></a>

### layerPanel.isDebugEnabled() ⇒ <code>boolean</code>
Check if debug mode is enabled

**Kind**: instance method of [<code>LayerPanel</code>](#LayerPanel)  
**Returns**: <code>boolean</code> - True if debug mode is enabled  
<a name="LayerPanel+logDebug"></a>

### layerPanel.logDebug(...args)
Log debug message

**Kind**: instance method of [<code>LayerPanel</code>](#LayerPanel)  

| Param | Type | Description |
| --- | --- | --- |
| ...args | <code>\*</code> | Arguments to log |

<a name="LayerPanel+logWarn"></a>

### layerPanel.logWarn(...args)
Log warning message

**Kind**: instance method of [<code>LayerPanel</code>](#LayerPanel)  

| Param | Type | Description |
| --- | --- | --- |
| ...args | <code>\*</code> | Arguments to log |

<a name="LayerPanel+logError"></a>

### layerPanel.logError(...args)
Log error message

**Kind**: instance method of [<code>LayerPanel</code>](#LayerPanel)  

| Param | Type | Description |
| --- | --- | --- |
| ...args | <code>\*</code> | Arguments to log |

<a name="LayerPanel+addDocumentListener"></a>

### layerPanel.addDocumentListener(event, handler, [options])
Add document event listener with automatic tracking

**Kind**: instance method of [<code>LayerPanel</code>](#LayerPanel)  

| Param | Type | Description |
| --- | --- | --- |
| event | <code>string</code> | Event type |
| handler | <code>function</code> | Event handler |
| [options] | <code>Object</code> | Event listener options |

<a name="LayerPanel+addTargetListener"></a>

### layerPanel.addTargetListener(target, event, handler, [options])
Add event listener to a specific element with automatic tracking

**Kind**: instance method of [<code>LayerPanel</code>](#LayerPanel)  

| Param | Type | Description |
| --- | --- | --- |
| target | <code>Element</code> | Target element |
| event | <code>string</code> | Event type |
| handler | <code>function</code> | Event handler |
| [options] | <code>Object</code> | Event listener options |

<a name="LayerPanel+removeDocumentListeners"></a>

### layerPanel.removeDocumentListeners()
Remove all document event listeners tracked by EventTracker

**Kind**: instance method of [<code>LayerPanel</code>](#LayerPanel)  
<a name="LayerPanel+removeTargetListeners"></a>

### layerPanel.removeTargetListeners()
Remove all element event listeners tracked by EventTracker (except document)

**Kind**: instance method of [<code>LayerPanel</code>](#LayerPanel)  
<a name="LayerPanel+removeAllListeners"></a>

### layerPanel.removeAllListeners()
Remove all event listeners

**Kind**: instance method of [<code>LayerPanel</code>](#LayerPanel)  
<a name="LayerPanel+registerDialogCleanup"></a>

### layerPanel.registerDialogCleanup(cleanupFn)
Register a cleanup function for dialog cleanup

**Kind**: instance method of [<code>LayerPanel</code>](#LayerPanel)  

| Param | Type | Description |
| --- | --- | --- |
| cleanupFn | <code>function</code> | Cleanup function to register |

<a name="LayerPanel+runDialogCleanups"></a>

### layerPanel.runDialogCleanups()
Run all dialog cleanup functions

**Kind**: instance method of [<code>LayerPanel</code>](#LayerPanel)  
<a name="LayerPanel+destroy"></a>

### layerPanel.destroy()
Clean up resources and destroy the panel

**Kind**: instance method of [<code>LayerPanel</code>](#LayerPanel)  
<a name="LayerPanel+msg"></a>

### layerPanel.msg(key, fallback) ⇒ <code>string</code>
Get localized message with fallbackDelegates to centralized MessageHelper for consistent i18n handling.

**Kind**: instance method of [<code>LayerPanel</code>](#LayerPanel)  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>string</code> | Message key |
| fallback | <code>string</code> | Fallback text |

<a name="LayerPanel+setAttributes"></a>

### layerPanel.setAttributes(element, attributes)
Helper function to set multiple attributes on an element

**Kind**: instance method of [<code>LayerPanel</code>](#LayerPanel)  

| Param | Type | Description |
| --- | --- | --- |
| element | <code>Element</code> | Target element |
| attributes | <code>Object</code> | Attributes to set |

<a name="LayerPanel+createSVGElement"></a>

### layerPanel.createSVGElement(tag, attributes) ⇒ <code>Element</code> \| <code>null</code>
Create SVG element - delegate to IconFactory

**Kind**: instance method of [<code>LayerPanel</code>](#LayerPanel)  
**Returns**: <code>Element</code> \| <code>null</code> - SVG element or null  

| Param | Type | Description |
| --- | --- | --- |
| tag | <code>string</code> | SVG tag name |
| attributes | <code>Object</code> | Attributes to set |

<a name="LayerPanel+createEyeIcon"></a>

### layerPanel.createEyeIcon(visible) ⇒ <code>Element</code>
Create eye icon for visibility toggle

**Kind**: instance method of [<code>LayerPanel</code>](#LayerPanel)  
**Returns**: <code>Element</code> - Eye icon element  

| Param | Type | Description |
| --- | --- | --- |
| visible | <code>boolean</code> | Whether the layer is visible |

<a name="LayerPanel+createLockIcon"></a>

### layerPanel.createLockIcon(locked) ⇒ <code>Element</code>
Create lock icon for lock toggle

**Kind**: instance method of [<code>LayerPanel</code>](#LayerPanel)  
**Returns**: <code>Element</code> - Lock icon element  

| Param | Type | Description |
| --- | --- | --- |
| locked | <code>boolean</code> | Whether the layer is locked |

<a name="LayerPanel+createDeleteIcon"></a>

### layerPanel.createDeleteIcon() ⇒ <code>Element</code>
Create delete icon

**Kind**: instance method of [<code>LayerPanel</code>](#LayerPanel)  
**Returns**: <code>Element</code> - Delete icon element  
<a name="LayerPanel+updateCodePanel"></a>

### layerPanel.updateCodePanel()
No-op kept for backward compatibility

**Kind**: instance method of [<code>LayerPanel</code>](#LayerPanel)  
<a name="LayerPanel+createInterface"></a>

### layerPanel.createInterface()
Create the panel interface

**Kind**: instance method of [<code>LayerPanel</code>](#LayerPanel)  
<a name="LayerPanel+setupEventHandlers"></a>

### layerPanel.setupEventHandlers()
Set up event handlers for the panel

**Kind**: instance method of [<code>LayerPanel</code>](#LayerPanel)  
<a name="LayerPanel+updateLayers"></a>

### layerPanel.updateLayers(layers)
Update layers (triggers re-render via StateManager)

**Kind**: instance method of [<code>LayerPanel</code>](#LayerPanel)  

| Param | Type | Description |
| --- | --- | --- |
| layers | <code>Array</code> | New layers array |

<a name="LayerPanel+renderLayerList"></a>

### layerPanel.renderLayerList()
Render the layer list

**Kind**: instance method of [<code>LayerPanel</code>](#LayerPanel)  
<a name="LayerPanel+renderBackgroundLayerItem"></a>

### layerPanel.renderBackgroundLayerItem()
Render or update the background layer item at the bottom of the layer list.The background layer cannot be moved, deleted, or unlocked - it justprovides controls for background visibility and opacity.

**Kind**: instance method of [<code>LayerPanel</code>](#LayerPanel)  
<a name="LayerPanel+createBackgroundLayerItem"></a>

### layerPanel.createBackgroundLayerItem() ⇒ <code>HTMLElement</code>
Create the background layer item DOM element

**Kind**: instance method of [<code>LayerPanel</code>](#LayerPanel)  
**Returns**: <code>HTMLElement</code> - Background layer item element  
<a name="LayerPanel+updateBackgroundLayerItem"></a>

### layerPanel.updateBackgroundLayerItem([item])
Update the background layer item to reflect current state

**Kind**: instance method of [<code>LayerPanel</code>](#LayerPanel)  

| Param | Type | Description |
| --- | --- | --- |
| [item] | <code>HTMLElement</code> | The background layer item element (optional - will be found if not provided) |

<a name="LayerPanel+getBackgroundVisible"></a>

### layerPanel.getBackgroundVisible() ⇒ <code>boolean</code>
Get whether the background is visible

**Kind**: instance method of [<code>LayerPanel</code>](#LayerPanel)  
**Returns**: <code>boolean</code> - True if background is visible  
<a name="LayerPanel+getBackgroundOpacity"></a>

### layerPanel.getBackgroundOpacity() ⇒ <code>number</code>
Get the background opacity value

**Kind**: instance method of [<code>LayerPanel</code>](#LayerPanel)  
**Returns**: <code>number</code> - Opacity value between 0 and 1  
<a name="LayerPanel+toggleBackgroundVisibility"></a>

### layerPanel.toggleBackgroundVisibility()
Toggle background visibility

**Kind**: instance method of [<code>LayerPanel</code>](#LayerPanel)  
<a name="LayerPanel+setBackgroundOpacity"></a>

### layerPanel.setBackgroundOpacity(opacity)
Set background opacity

**Kind**: instance method of [<code>LayerPanel</code>](#LayerPanel)  

| Param | Type | Description |
| --- | --- | --- |
| opacity | <code>number</code> | Opacity value between 0 and 1 |

<a name="LayerPanel+moveLayer"></a>

### layerPanel.moveLayer(layerId, direction)
Move a layer up or down in the list

**Kind**: instance method of [<code>LayerPanel</code>](#LayerPanel)  

| Param | Type | Description |
| --- | --- | --- |
| layerId | <code>string</code> | Layer ID to move |
| direction | <code>number</code> | Direction to move (-1 for up, 1 for down) |

<a name="LayerPanel+createLayerItem"></a>

### layerPanel.createLayerItem(layer, index) ⇒ <code>HTMLElement</code>
Create a layer item DOM element

**Kind**: instance method of [<code>LayerPanel</code>](#LayerPanel)  
**Returns**: <code>HTMLElement</code> - Layer item element  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer object |
| index | <code>number</code> | Layer index |

<a name="LayerPanel+updateLayerItem"></a>

### layerPanel.updateLayerItem(item, layer, index)
Update an existing layer item DOM element

**Kind**: instance method of [<code>LayerPanel</code>](#LayerPanel)  

| Param | Type | Description |
| --- | --- | --- |
| item | <code>HTMLElement</code> | Layer item element |
| layer | <code>Object</code> | Layer object |
| index | <code>number</code> | Layer index |

<a name="LayerPanel+getDefaultLayerName"></a>

### layerPanel.getDefaultLayerName(layer) ⇒ <code>string</code>
Get the default name for a layer based on its type

**Kind**: instance method of [<code>LayerPanel</code>](#LayerPanel)  
**Returns**: <code>string</code> - Default layer name  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer object |

<a name="LayerPanel+handleLayerListClick"></a>

### layerPanel.handleLayerListClick(e)
Handle click events in the layer list

**Kind**: instance method of [<code>LayerPanel</code>](#LayerPanel)  

| Param | Type | Description |
| --- | --- | --- |
| e | <code>Event</code> | Click event |

<a name="LayerPanel+handleLayerListKeydown"></a>

### layerPanel.handleLayerListKeydown(e)
Handle keyboard navigation in the layer list

**Kind**: instance method of [<code>LayerPanel</code>](#LayerPanel)  

| Param | Type | Description |
| --- | --- | --- |
| e | <code>KeyboardEvent</code> | Keyboard event |

<a name="LayerPanel+focusLayerAtIndex"></a>

### layerPanel.focusLayerAtIndex(index)
Focus a layer item by index

**Kind**: instance method of [<code>LayerPanel</code>](#LayerPanel)  

| Param | Type | Description |
| --- | --- | --- |
| index | <code>number</code> | Layer index to focus |

<a name="LayerPanel+selectLayer"></a>

### layerPanel.selectLayer(layerId, [fromCanvas], [addToSelection])
Select a layer by ID

**Kind**: instance method of [<code>LayerPanel</code>](#LayerPanel)  

| Param | Type | Description |
| --- | --- | --- |
| layerId | <code>string</code> | Layer ID to select |
| [fromCanvas] | <code>boolean</code> | Whether the selection originated from canvas |
| [addToSelection] | <code>boolean</code> | Whether to add to existing selection (Ctrl+click) |

<a name="LayerPanel+selectLayerRange"></a>

### layerPanel.selectLayerRange(layerId)
Select a range of layers (Shift+click behavior)Selects all layers between the last selected layer and the clicked layer

**Kind**: instance method of [<code>LayerPanel</code>](#LayerPanel)  

| Param | Type | Description |
| --- | --- | --- |
| layerId | <code>string</code> | Layer ID that was shift-clicked |

<a name="LayerPanel+toggleLayerVisibility"></a>

### layerPanel.toggleLayerVisibility(layerId)
Toggle layer visibility

**Kind**: instance method of [<code>LayerPanel</code>](#LayerPanel)  

| Param | Type | Description |
| --- | --- | --- |
| layerId | <code>string</code> | Layer ID to toggle |

<a name="LayerPanel+toggleLayerLock"></a>

### layerPanel.toggleLayerLock(layerId)
Toggle layer lock

**Kind**: instance method of [<code>LayerPanel</code>](#LayerPanel)  

| Param | Type | Description |
| --- | --- | --- |
| layerId | <code>string</code> | Layer ID to toggle |

<a name="LayerPanel+deleteLayer"></a>

### layerPanel.deleteLayer(layerId)
Delete a layer

**Kind**: instance method of [<code>LayerPanel</code>](#LayerPanel)  

| Param | Type | Description |
| --- | --- | --- |
| layerId | <code>string</code> | Layer ID to delete |

<a name="LayerPanel+editLayerName"></a>

### layerPanel.editLayerName(layerId, nameElement)
Edit a layer's name

**Kind**: instance method of [<code>LayerPanel</code>](#LayerPanel)  

| Param | Type | Description |
| --- | --- | --- |
| layerId | <code>string</code> | Layer ID to edit |
| nameElement | <code>HTMLElement</code> | Name element to edit |

<a name="LayerPanel+updatePropertiesPanel"></a>

### layerPanel.updatePropertiesPanel(layerId)
Update the properties panel for a selected layer

**Kind**: instance method of [<code>LayerPanel</code>](#LayerPanel)  

| Param | Type | Description |
| --- | --- | --- |
| layerId | <code>string</code> \| <code>null</code> | Layer ID to show properties for |

<a name="LayerPanel+createPropertiesForm"></a>

### layerPanel.createPropertiesForm(layer) ⇒ <code>HTMLElement</code>
Create a properties form for a layer

**Kind**: instance method of [<code>LayerPanel</code>](#LayerPanel)  
**Returns**: <code>HTMLElement</code> - Properties form element  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer object |

<a name="LayerPanel+syncPropertiesFromLayer"></a>

### layerPanel.syncPropertiesFromLayer(layer)
Live sync selected layer's transform props into current form inputs

**Kind**: instance method of [<code>LayerPanel</code>](#LayerPanel)  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer object with transform properties |

<a name="LayerPanel+setupDragAndDrop"></a>

### layerPanel.setupDragAndDrop()
Set up drag and drop for layer reordering

**Kind**: instance method of [<code>LayerPanel</code>](#LayerPanel)  
<a name="LayerPanel+reorderLayers"></a>

### layerPanel.reorderLayers(draggedId, targetId)
Reorder layers by moving dragged layer to target position

**Kind**: instance method of [<code>LayerPanel</code>](#LayerPanel)  

| Param | Type | Description |
| --- | --- | --- |
| draggedId | <code>string</code> | Dragged layer ID |
| targetId | <code>string</code> | Target layer ID |

<a name="LayerPanel+createConfirmDialog"></a>

### layerPanel.createConfirmDialog(message, onConfirm)
Create and display a confirmation dialog

**Kind**: instance method of [<code>LayerPanel</code>](#LayerPanel)  

| Param | Type | Description |
| --- | --- | --- |
| message | <code>string</code> | Confirmation message |
| onConfirm | <code>function</code> | Callback when confirmed |

<a name="LayerPanel+simpleConfirm"></a>

### layerPanel.simpleConfirm(message) ⇒ <code>boolean</code>
Simple confirmation dialog fallback

**Kind**: instance method of [<code>LayerPanel</code>](#LayerPanel)  
**Returns**: <code>boolean</code> - User's choice  

| Param | Type | Description |
| --- | --- | --- |
| message | <code>string</code> | The confirmation message |

<a name="LayerPanel+renderCodeSnippet"></a>

### layerPanel.renderCodeSnippet([layers]) ⇒ <code>string</code>
Pure renderer for Wikitext code so LayersEditor can embed it in the footer

**Kind**: instance method of [<code>LayerPanel</code>](#LayerPanel)  
**Returns**: <code>string</code> - HTML string for the code snippet  

| Param | Type | Description |
| --- | --- | --- |
| [layers] | <code>Array</code> | Layer array (defaults to current layers) |

<a name="LayersEditor"></a>

## LayersEditor
LayersEditor class - Main editor for MediaWiki Layers extension

**Kind**: global class  

* [LayersEditor](#LayersEditor)
    * [new LayersEditor(config)](#new_LayersEditor_new)
    * [.debugLog(...args)](#LayersEditor+debugLog)
    * [.errorLog(...args)](#LayersEditor+errorLog)
    * [.sanitizeLogMessage(message)](#LayersEditor+sanitizeLogMessage) ⇒ <code>\*</code>
    * [.renderLayers(layers)](#LayersEditor+renderLayers)
    * [.isDirty()](#LayersEditor+isDirty) ⇒ <code>boolean</code>
    * [.markDirty()](#LayersEditor+markDirty)
    * [.markClean()](#LayersEditor+markClean)
    * [.undo()](#LayersEditor+undo) ⇒ <code>boolean</code>
    * [.redo()](#LayersEditor+redo) ⇒ <code>boolean</code>
    * [.init()](#LayersEditor+init)
    * [.addLayer(layerData)](#LayersEditor+addLayer)
    * [.updateLayer(layerId, changes)](#LayersEditor+updateLayer)
    * [.removeLayer(layerId)](#LayersEditor+removeLayer)
    * [.getLayerById(layerId)](#LayersEditor+getLayerById) ⇒ <code>Object</code> \| <code>undefined</code>
    * [.parseMWTimestamp(mwTimestamp)](#LayersEditor+parseMWTimestamp) ⇒ <code>Date</code>
    * [.buildRevisionSelector()](#LayersEditor+buildRevisionSelector)
    * [.updateRevisionLoadButton()](#LayersEditor+updateRevisionLoadButton)
    * [.buildSetSelector()](#LayersEditor+buildSetSelector)
    * [.updateNewSetButtonState()](#LayersEditor+updateNewSetButtonState)
    * [.loadLayerSetByName(setName)](#LayersEditor+loadLayerSetByName) ⇒ <code>Promise.&lt;void&gt;</code>
    * [.createNewLayerSet(setName)](#LayersEditor+createNewLayerSet) ⇒ <code>Promise.&lt;boolean&gt;</code>
    * [.loadRevisionById(revisionId)](#LayersEditor+loadRevisionById)
    * [.showKeyboardShortcutsDialog()](#LayersEditor+showKeyboardShortcutsDialog)
    * [.hasUnsavedChanges()](#LayersEditor+hasUnsavedChanges) ⇒ <code>boolean</code>
    * [.updateSaveButtonState()](#LayersEditor+updateSaveButtonState)
    * [.getMessage(key, fallback)](#LayersEditor+getMessage) ⇒ <code>string</code>
    * [.setCurrentTool(tool, options)](#LayersEditor+setCurrentTool)
    * [.saveState(action)](#LayersEditor+saveState)
    * [.selectLayer(layerId)](#LayersEditor+selectLayer)
    * [.deleteSelected()](#LayersEditor+deleteSelected)
    * [.duplicateSelected()](#LayersEditor+duplicateSelected)
    * [.updateUIState()](#LayersEditor+updateUIState)
    * [.applyToSelection(mutator)](#LayersEditor+applyToSelection)
    * [.getSelectedLayerIds()](#LayersEditor+getSelectedLayerIds) ⇒ <code>Array.&lt;string&gt;</code>
    * [.navigateBackToFile()](#LayersEditor+navigateBackToFile)
    * [.save()](#LayersEditor+save)
    * [.reloadRevisions()](#LayersEditor+reloadRevisions)
    * [.normalizeLayers(layers)](#LayersEditor+normalizeLayers) ⇒ <code>Array</code>
    * [.cancel(navigateBack)](#LayersEditor+cancel)
    * [.destroy()](#LayersEditor+destroy)
    * [.trackEventListener(element, event, handler, options)](#LayersEditor+trackEventListener)
    * [.trackWindowListener(event, handler, options)](#LayersEditor+trackWindowListener)
    * [.trackDocumentListener(event, handler, options)](#LayersEditor+trackDocumentListener)

<a name="new_LayersEditor_new"></a>

### new LayersEditor(config)
Creates a new LayersEditor instance


| Param | Type | Description |
| --- | --- | --- |
| config | <code>Object</code> | Configuration object |
| config.filename | <code>string</code> | Name of the file being edited |
| config.imageUrl | <code>string</code> | URL of the base image |
| config.container | <code>HTMLElement</code> | Container element for the editor |

<a name="LayersEditor+debugLog"></a>

### layersEditor.debugLog(...args)
Debug logging utility

**Kind**: instance method of [<code>LayersEditor</code>](#LayersEditor)  

| Param | Type | Description |
| --- | --- | --- |
| ...args | <code>\*</code> | Arguments to log |

<a name="LayersEditor+errorLog"></a>

### layersEditor.errorLog(...args)
Error logging utility

**Kind**: instance method of [<code>LayersEditor</code>](#LayersEditor)  

| Param | Type | Description |
| --- | --- | --- |
| ...args | <code>\*</code> | Arguments to log |

<a name="LayersEditor+sanitizeLogMessage"></a>

### layersEditor.sanitizeLogMessage(message) ⇒ <code>\*</code>
Sanitize log messages to prevent sensitive information disclosure

**Kind**: instance method of [<code>LayersEditor</code>](#LayersEditor)  
**Returns**: <code>\*</code> - Sanitized message  

| Param | Type | Description |
| --- | --- | --- |
| message | <code>\*</code> | The message to sanitize |

<a name="LayersEditor+renderLayers"></a>

### layersEditor.renderLayers(layers)
Render layers on canvas (bridge method)

**Kind**: instance method of [<code>LayersEditor</code>](#LayersEditor)  

| Param | Type | Description |
| --- | --- | --- |
| layers | <code>Array</code> | Optional array of layers to render |

<a name="LayersEditor+isDirty"></a>

### layersEditor.isDirty() ⇒ <code>boolean</code>
Check if editor has unsaved changes

**Kind**: instance method of [<code>LayersEditor</code>](#LayersEditor)  
**Returns**: <code>boolean</code> - True if there are unsaved changes  
<a name="LayersEditor+markDirty"></a>

### layersEditor.markDirty()
Mark editor as having unsaved changes

**Kind**: instance method of [<code>LayersEditor</code>](#LayersEditor)  
<a name="LayersEditor+markClean"></a>

### layersEditor.markClean()
Mark editor as clean (no unsaved changes)

**Kind**: instance method of [<code>LayersEditor</code>](#LayersEditor)  
<a name="LayersEditor+undo"></a>

### layersEditor.undo() ⇒ <code>boolean</code>
Undo last action

**Kind**: instance method of [<code>LayersEditor</code>](#LayersEditor)  
**Returns**: <code>boolean</code> - True if undo was successful  
<a name="LayersEditor+redo"></a>

### layersEditor.redo() ⇒ <code>boolean</code>
Redo last undone action

**Kind**: instance method of [<code>LayersEditor</code>](#LayersEditor)  
**Returns**: <code>boolean</code> - True if redo was successful  
<a name="LayersEditor+init"></a>

### layersEditor.init()
Initialize the editor

**Kind**: instance method of [<code>LayersEditor</code>](#LayersEditor)  
<a name="LayersEditor+addLayer"></a>

### layersEditor.addLayer(layerData)
Add a new layer to the editor

**Kind**: instance method of [<code>LayersEditor</code>](#LayersEditor)  

| Param | Type | Description |
| --- | --- | --- |
| layerData | <code>Object</code> | Layer data object |

<a name="LayersEditor+updateLayer"></a>

### layersEditor.updateLayer(layerId, changes)
Update an existing layer with new data

**Kind**: instance method of [<code>LayersEditor</code>](#LayersEditor)  

| Param | Type | Description |
| --- | --- | --- |
| layerId | <code>string</code> | ID of the layer to update |
| changes | <code>Object</code> | Changes to apply to the layer |

<a name="LayersEditor+removeLayer"></a>

### layersEditor.removeLayer(layerId)
Remove a layer from the editor

**Kind**: instance method of [<code>LayersEditor</code>](#LayersEditor)  

| Param | Type | Description |
| --- | --- | --- |
| layerId | <code>string</code> | ID of the layer to remove |

<a name="LayersEditor+getLayerById"></a>

### layersEditor.getLayerById(layerId) ⇒ <code>Object</code> \| <code>undefined</code>
Get a layer by its ID

**Kind**: instance method of [<code>LayersEditor</code>](#LayersEditor)  
**Returns**: <code>Object</code> \| <code>undefined</code> - The layer object or undefined  

| Param | Type | Description |
| --- | --- | --- |
| layerId | <code>string</code> | ID of the layer |

<a name="LayersEditor+parseMWTimestamp"></a>

### layersEditor.parseMWTimestamp(mwTimestamp) ⇒ <code>Date</code>
Parse MediaWiki binary(14) timestamp format

**Kind**: instance method of [<code>LayersEditor</code>](#LayersEditor)  
**Returns**: <code>Date</code> - Parsed date object  

| Param | Type | Description |
| --- | --- | --- |
| mwTimestamp | <code>string</code> | MediaWiki timestamp string |

<a name="LayersEditor+buildRevisionSelector"></a>

### layersEditor.buildRevisionSelector()
Build the revision selector dropdown

**Kind**: instance method of [<code>LayersEditor</code>](#LayersEditor)  
<a name="LayersEditor+updateRevisionLoadButton"></a>

### layersEditor.updateRevisionLoadButton()
Update the revision load button state

**Kind**: instance method of [<code>LayersEditor</code>](#LayersEditor)  
<a name="LayersEditor+buildSetSelector"></a>

### layersEditor.buildSetSelector()
Build and populate the named layer sets selector

**Kind**: instance method of [<code>LayersEditor</code>](#LayersEditor)  
<a name="LayersEditor+updateNewSetButtonState"></a>

### layersEditor.updateNewSetButtonState()
Update the new set button state

**Kind**: instance method of [<code>LayersEditor</code>](#LayersEditor)  
<a name="LayersEditor+loadLayerSetByName"></a>

### layersEditor.loadLayerSetByName(setName) ⇒ <code>Promise.&lt;void&gt;</code>
Load a layer set by name

**Kind**: instance method of [<code>LayersEditor</code>](#LayersEditor)  

| Param | Type | Description |
| --- | --- | --- |
| setName | <code>string</code> | The name of the set to load |

<a name="LayersEditor+createNewLayerSet"></a>

### layersEditor.createNewLayerSet(setName) ⇒ <code>Promise.&lt;boolean&gt;</code>
Create a new named layer set

**Kind**: instance method of [<code>LayersEditor</code>](#LayersEditor)  

| Param | Type | Description |
| --- | --- | --- |
| setName | <code>string</code> | The name for the new set |

<a name="LayersEditor+loadRevisionById"></a>

### layersEditor.loadRevisionById(revisionId)
Load a specific revision by ID

**Kind**: instance method of [<code>LayersEditor</code>](#LayersEditor)  

| Param | Type | Description |
| --- | --- | --- |
| revisionId | <code>number</code> | The revision ID to load |

<a name="LayersEditor+showKeyboardShortcutsDialog"></a>

### layersEditor.showKeyboardShortcutsDialog()
Show the keyboard shortcuts help dialog

**Kind**: instance method of [<code>LayersEditor</code>](#LayersEditor)  
<a name="LayersEditor+hasUnsavedChanges"></a>

### layersEditor.hasUnsavedChanges() ⇒ <code>boolean</code>
Check if there are unsaved changes

**Kind**: instance method of [<code>LayersEditor</code>](#LayersEditor)  
<a name="LayersEditor+updateSaveButtonState"></a>

### layersEditor.updateSaveButtonState()
Update the save button state

**Kind**: instance method of [<code>LayersEditor</code>](#LayersEditor)  
<a name="LayersEditor+getMessage"></a>

### layersEditor.getMessage(key, fallback) ⇒ <code>string</code>
Get a localized message

**Kind**: instance method of [<code>LayersEditor</code>](#LayersEditor)  
**Returns**: <code>string</code> - Localized message  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>string</code> | Message key |
| fallback | <code>string</code> | Fallback text |

<a name="LayersEditor+setCurrentTool"></a>

### layersEditor.setCurrentTool(tool, options)
Set the current tool

**Kind**: instance method of [<code>LayersEditor</code>](#LayersEditor)  

| Param | Type | Description |
| --- | --- | --- |
| tool | <code>string</code> | Tool name |
| options | <code>Object</code> | Options |

<a name="LayersEditor+saveState"></a>

### layersEditor.saveState(action)
Save state for undo/redo

**Kind**: instance method of [<code>LayersEditor</code>](#LayersEditor)  

| Param | Type | Description |
| --- | --- | --- |
| action | <code>string</code> | Action description |

<a name="LayersEditor+selectLayer"></a>

### layersEditor.selectLayer(layerId)
Select a layer by ID

**Kind**: instance method of [<code>LayersEditor</code>](#LayersEditor)  

| Param | Type | Description |
| --- | --- | --- |
| layerId | <code>string</code> | Layer ID to select |

<a name="LayersEditor+deleteSelected"></a>

### layersEditor.deleteSelected()
Delete the selected layer

**Kind**: instance method of [<code>LayersEditor</code>](#LayersEditor)  
<a name="LayersEditor+duplicateSelected"></a>

### layersEditor.duplicateSelected()
Duplicate the selected layer

**Kind**: instance method of [<code>LayersEditor</code>](#LayersEditor)  
<a name="LayersEditor+updateUIState"></a>

### layersEditor.updateUIState()
Update UI state (toolbar buttons, etc.)

**Kind**: instance method of [<code>LayersEditor</code>](#LayersEditor)  
<a name="LayersEditor+applyToSelection"></a>

### layersEditor.applyToSelection(mutator)
Apply a mutator function to all selected layers

**Kind**: instance method of [<code>LayersEditor</code>](#LayersEditor)  

| Param | Type | Description |
| --- | --- | --- |
| mutator | <code>function</code> | Function to apply to each layer |

<a name="LayersEditor+getSelectedLayerIds"></a>

### layersEditor.getSelectedLayerIds() ⇒ <code>Array.&lt;string&gt;</code>
Get selected layer IDs

**Kind**: instance method of [<code>LayersEditor</code>](#LayersEditor)  
**Returns**: <code>Array.&lt;string&gt;</code> - Array of selected layer IDs  
<a name="LayersEditor+navigateBackToFile"></a>

### layersEditor.navigateBackToFile()
Navigate back to file page

**Kind**: instance method of [<code>LayersEditor</code>](#LayersEditor)  
<a name="LayersEditor+save"></a>

### layersEditor.save()
Save the current layers to the server

**Kind**: instance method of [<code>LayersEditor</code>](#LayersEditor)  
<a name="LayersEditor+reloadRevisions"></a>

### layersEditor.reloadRevisions()
Reload the revision selector after saving

**Kind**: instance method of [<code>LayersEditor</code>](#LayersEditor)  
<a name="LayersEditor+normalizeLayers"></a>

### layersEditor.normalizeLayers(layers) ⇒ <code>Array</code>
Normalize layer visibility on load

**Kind**: instance method of [<code>LayersEditor</code>](#LayersEditor)  
**Returns**: <code>Array</code> - Normalized layers  

| Param | Type | Description |
| --- | --- | --- |
| layers | <code>Array</code> | Array of layer objects |

<a name="LayersEditor+cancel"></a>

### layersEditor.cancel(navigateBack)
Cancel editing and return to the file page

**Kind**: instance method of [<code>LayersEditor</code>](#LayersEditor)  

| Param | Type | Description |
| --- | --- | --- |
| navigateBack | <code>boolean</code> | Whether to navigate back |

<a name="LayersEditor+destroy"></a>

### layersEditor.destroy()
Destroy the editor and clean up resources

**Kind**: instance method of [<code>LayersEditor</code>](#LayersEditor)  
<a name="LayersEditor+trackEventListener"></a>

### layersEditor.trackEventListener(element, event, handler, options)
Track event listeners for cleanup

**Kind**: instance method of [<code>LayersEditor</code>](#LayersEditor)  

| Param | Type | Description |
| --- | --- | --- |
| element | <code>Element</code> | DOM element |
| event | <code>string</code> | Event name |
| handler | <code>function</code> | Event handler |
| options | <code>Object</code> | Event listener options |

<a name="LayersEditor+trackWindowListener"></a>

### layersEditor.trackWindowListener(event, handler, options)
Track window event listeners

**Kind**: instance method of [<code>LayersEditor</code>](#LayersEditor)  

| Param | Type | Description |
| --- | --- | --- |
| event | <code>string</code> | Event name |
| handler | <code>function</code> | Event handler |
| options | <code>Object</code> | Event listener options |

<a name="LayersEditor+trackDocumentListener"></a>

### layersEditor.trackDocumentListener(event, handler, options)
Track document event listeners

**Kind**: instance method of [<code>LayersEditor</code>](#LayersEditor)  

| Param | Type | Description |
| --- | --- | --- |
| event | <code>string</code> | Event name |
| handler | <code>function</code> | Event handler |
| options | <code>Object</code> | Event listener options |

<a name="LayerSetManager"></a>

## LayerSetManager
**Kind**: global class  

* [LayerSetManager](#LayerSetManager)
    * [new LayerSetManager()](#new_LayerSetManager_new)
    * [new LayerSetManager(config)](#new_LayerSetManager_new)
    * [.debugLog(...args)](#LayerSetManager+debugLog)
    * [.errorLog(...args)](#LayerSetManager+errorLog)
    * [.getMessage(key, [fallback])](#LayerSetManager+getMessage) ⇒ <code>string</code>
    * [.getMessageWithParams(key, params, [fallback])](#LayerSetManager+getMessageWithParams) ⇒ <code>string</code>
    * [.parseMWTimestamp(mwTimestamp)](#LayerSetManager+parseMWTimestamp) ⇒ <code>Date</code>
    * [.buildRevisionSelector()](#LayerSetManager+buildRevisionSelector)
    * [.updateRevisionLoadButton()](#LayerSetManager+updateRevisionLoadButton)
    * [.buildSetSelector()](#LayerSetManager+buildSetSelector)
    * [.updateNewSetButtonState()](#LayerSetManager+updateNewSetButtonState)
    * [.loadLayerSetByName(setName)](#LayerSetManager+loadLayerSetByName) ⇒ <code>Promise.&lt;void&gt;</code>
    * [.createNewLayerSet(setName)](#LayerSetManager+createNewLayerSet) ⇒ <code>Promise.&lt;boolean&gt;</code>
    * [.hasUnsavedChanges()](#LayerSetManager+hasUnsavedChanges) ⇒ <code>boolean</code>
    * [.loadRevisionById(revisionId)](#LayerSetManager+loadRevisionById)
    * [.reloadRevisions()](#LayerSetManager+reloadRevisions) ⇒ <code>Promise.&lt;void&gt;</code>
    * [.getCurrentSetName()](#LayerSetManager+getCurrentSetName) ⇒ <code>string</code>
    * [.getNamedSets()](#LayerSetManager+getNamedSets) ⇒ <code>Array</code>
    * [.destroy()](#LayerSetManager+destroy)

<a name="new_LayerSetManager_new"></a>

### new LayerSetManager()
LayerSetManager - Manages named layer sets and revisions for the Layers editorHandles:- Named layer set creation, loading, and switching- Revision selector UI building- Layer set dropdown UI building- Timestamp parsing for MediaWiki format

<a name="new_LayerSetManager_new"></a>

### new LayerSetManager(config)
LayerSetManager constructor


| Param | Type | Description |
| --- | --- | --- |
| config | <code>Object</code> | Configuration options |
| config.editor | <code>Object</code> | Reference to the LayersEditor instance |
| config.stateManager | <code>Object</code> | Reference to StateManager |
| config.apiManager | <code>Object</code> | Reference to APIManager |
| config.uiManager | <code>Object</code> | Reference to UIManager (for UI elements) |

<a name="LayerSetManager+debugLog"></a>

### layerSetManager.debugLog(...args)
Log debug message if debug mode enabled

**Kind**: instance method of [<code>LayerSetManager</code>](#LayerSetManager)  

| Param | Type | Description |
| --- | --- | --- |
| ...args | <code>\*</code> | Arguments to log |

<a name="LayerSetManager+errorLog"></a>

### layerSetManager.errorLog(...args)
Log error message

**Kind**: instance method of [<code>LayerSetManager</code>](#LayerSetManager)  

| Param | Type | Description |
| --- | --- | --- |
| ...args | <code>\*</code> | Arguments to log |

<a name="LayerSetManager+getMessage"></a>

### layerSetManager.getMessage(key, [fallback]) ⇒ <code>string</code>
Get localized messageDelegates to centralized MessageHelper for consistent i18n handling.

**Kind**: instance method of [<code>LayerSetManager</code>](#LayerSetManager)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| key | <code>string</code> |  | Message key |
| [fallback] | <code>string</code> | <code>&quot;&#x27;&#x27;&quot;</code> | Fallback text |

<a name="LayerSetManager+getMessageWithParams"></a>

### layerSetManager.getMessageWithParams(key, params, [fallback]) ⇒ <code>string</code>
Get localized message with parameter substitutionDelegates to centralized MessageHelper for consistent i18n handling.

**Kind**: instance method of [<code>LayerSetManager</code>](#LayerSetManager)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| key | <code>string</code> |  | Message key |
| params | <code>Array</code> |  | Parameters to substitute |
| [fallback] | <code>string</code> | <code>&quot;&#x27;&#x27;&quot;</code> | Fallback text (can use $1, $2 placeholders) |

<a name="LayerSetManager+parseMWTimestamp"></a>

### layerSetManager.parseMWTimestamp(mwTimestamp) ⇒ <code>Date</code>
Parse MediaWiki binary(14) timestamp format (YYYYMMDDHHmmss)

**Kind**: instance method of [<code>LayerSetManager</code>](#LayerSetManager)  
**Returns**: <code>Date</code> - Parsed date object  

| Param | Type | Description |
| --- | --- | --- |
| mwTimestamp | <code>string</code> | The timestamp string |

<a name="LayerSetManager+buildRevisionSelector"></a>

### layerSetManager.buildRevisionSelector()
Build the revision selector dropdownPopulates the revision dropdown with available layer set revisions

**Kind**: instance method of [<code>LayerSetManager</code>](#LayerSetManager)  
<a name="LayerSetManager+updateRevisionLoadButton"></a>

### layerSetManager.updateRevisionLoadButton()
Update the revision load button stateDisables button if no revision selected or if current revision is selected

**Kind**: instance method of [<code>LayerSetManager</code>](#LayerSetManager)  
<a name="LayerSetManager+buildSetSelector"></a>

### layerSetManager.buildSetSelector()
Build and populate the named layer sets selector dropdown

**Kind**: instance method of [<code>LayerSetManager</code>](#LayerSetManager)  
<a name="LayerSetManager+updateNewSetButtonState"></a>

### layerSetManager.updateNewSetButtonState()
Update the new set button's enabled/disabled state based on limits

**Kind**: instance method of [<code>LayerSetManager</code>](#LayerSetManager)  
<a name="LayerSetManager+loadLayerSetByName"></a>

### layerSetManager.loadLayerSetByName(setName) ⇒ <code>Promise.&lt;void&gt;</code>
Load a layer set by its name

**Kind**: instance method of [<code>LayerSetManager</code>](#LayerSetManager)  

| Param | Type | Description |
| --- | --- | --- |
| setName | <code>string</code> | The name of the set to load |

<a name="LayerSetManager+createNewLayerSet"></a>

### layerSetManager.createNewLayerSet(setName) ⇒ <code>Promise.&lt;boolean&gt;</code>
Create a new named layer set

**Kind**: instance method of [<code>LayerSetManager</code>](#LayerSetManager)  
**Returns**: <code>Promise.&lt;boolean&gt;</code> - True if creation succeeded  

| Param | Type | Description |
| --- | --- | --- |
| setName | <code>string</code> | The name for the new set |

<a name="LayerSetManager+hasUnsavedChanges"></a>

### layerSetManager.hasUnsavedChanges() ⇒ <code>boolean</code>
Check if there are unsaved changes

**Kind**: instance method of [<code>LayerSetManager</code>](#LayerSetManager)  
<a name="LayerSetManager+loadRevisionById"></a>

### layerSetManager.loadRevisionById(revisionId)
Load a specific revision by ID

**Kind**: instance method of [<code>LayerSetManager</code>](#LayerSetManager)  

| Param | Type | Description |
| --- | --- | --- |
| revisionId | <code>number</code> | The revision ID to load |

<a name="LayerSetManager+reloadRevisions"></a>

### layerSetManager.reloadRevisions() ⇒ <code>Promise.&lt;void&gt;</code>
Reload revisions list from API

**Kind**: instance method of [<code>LayerSetManager</code>](#LayerSetManager)  
<a name="LayerSetManager+getCurrentSetName"></a>

### layerSetManager.getCurrentSetName() ⇒ <code>string</code>
Get current set name

**Kind**: instance method of [<code>LayerSetManager</code>](#LayerSetManager)  
<a name="LayerSetManager+getNamedSets"></a>

### layerSetManager.getNamedSets() ⇒ <code>Array</code>
Get named sets list

**Kind**: instance method of [<code>LayerSetManager</code>](#LayerSetManager)  
<a name="LayerSetManager+destroy"></a>

### layerSetManager.destroy()
Destroy and clean up

**Kind**: instance method of [<code>LayerSetManager</code>](#LayerSetManager)  
<a name="LayerSetManager"></a>

## LayerSetManager
LayerSetManager class

**Kind**: global class  

* [LayerSetManager](#LayerSetManager)
    * [new LayerSetManager()](#new_LayerSetManager_new)
    * [new LayerSetManager(config)](#new_LayerSetManager_new)
    * [.debugLog(...args)](#LayerSetManager+debugLog)
    * [.errorLog(...args)](#LayerSetManager+errorLog)
    * [.getMessage(key, [fallback])](#LayerSetManager+getMessage) ⇒ <code>string</code>
    * [.getMessageWithParams(key, params, [fallback])](#LayerSetManager+getMessageWithParams) ⇒ <code>string</code>
    * [.parseMWTimestamp(mwTimestamp)](#LayerSetManager+parseMWTimestamp) ⇒ <code>Date</code>
    * [.buildRevisionSelector()](#LayerSetManager+buildRevisionSelector)
    * [.updateRevisionLoadButton()](#LayerSetManager+updateRevisionLoadButton)
    * [.buildSetSelector()](#LayerSetManager+buildSetSelector)
    * [.updateNewSetButtonState()](#LayerSetManager+updateNewSetButtonState)
    * [.loadLayerSetByName(setName)](#LayerSetManager+loadLayerSetByName) ⇒ <code>Promise.&lt;void&gt;</code>
    * [.createNewLayerSet(setName)](#LayerSetManager+createNewLayerSet) ⇒ <code>Promise.&lt;boolean&gt;</code>
    * [.hasUnsavedChanges()](#LayerSetManager+hasUnsavedChanges) ⇒ <code>boolean</code>
    * [.loadRevisionById(revisionId)](#LayerSetManager+loadRevisionById)
    * [.reloadRevisions()](#LayerSetManager+reloadRevisions) ⇒ <code>Promise.&lt;void&gt;</code>
    * [.getCurrentSetName()](#LayerSetManager+getCurrentSetName) ⇒ <code>string</code>
    * [.getNamedSets()](#LayerSetManager+getNamedSets) ⇒ <code>Array</code>
    * [.destroy()](#LayerSetManager+destroy)

<a name="new_LayerSetManager_new"></a>

### new LayerSetManager()
LayerSetManager - Manages named layer sets and revisions for the Layers editorHandles:- Named layer set creation, loading, and switching- Revision selector UI building- Layer set dropdown UI building- Timestamp parsing for MediaWiki format

<a name="new_LayerSetManager_new"></a>

### new LayerSetManager(config)
LayerSetManager constructor


| Param | Type | Description |
| --- | --- | --- |
| config | <code>Object</code> | Configuration options |
| config.editor | <code>Object</code> | Reference to the LayersEditor instance |
| config.stateManager | <code>Object</code> | Reference to StateManager |
| config.apiManager | <code>Object</code> | Reference to APIManager |
| config.uiManager | <code>Object</code> | Reference to UIManager (for UI elements) |

<a name="LayerSetManager+debugLog"></a>

### layerSetManager.debugLog(...args)
Log debug message if debug mode enabled

**Kind**: instance method of [<code>LayerSetManager</code>](#LayerSetManager)  

| Param | Type | Description |
| --- | --- | --- |
| ...args | <code>\*</code> | Arguments to log |

<a name="LayerSetManager+errorLog"></a>

### layerSetManager.errorLog(...args)
Log error message

**Kind**: instance method of [<code>LayerSetManager</code>](#LayerSetManager)  

| Param | Type | Description |
| --- | --- | --- |
| ...args | <code>\*</code> | Arguments to log |

<a name="LayerSetManager+getMessage"></a>

### layerSetManager.getMessage(key, [fallback]) ⇒ <code>string</code>
Get localized messageDelegates to centralized MessageHelper for consistent i18n handling.

**Kind**: instance method of [<code>LayerSetManager</code>](#LayerSetManager)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| key | <code>string</code> |  | Message key |
| [fallback] | <code>string</code> | <code>&quot;&#x27;&#x27;&quot;</code> | Fallback text |

<a name="LayerSetManager+getMessageWithParams"></a>

### layerSetManager.getMessageWithParams(key, params, [fallback]) ⇒ <code>string</code>
Get localized message with parameter substitutionDelegates to centralized MessageHelper for consistent i18n handling.

**Kind**: instance method of [<code>LayerSetManager</code>](#LayerSetManager)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| key | <code>string</code> |  | Message key |
| params | <code>Array</code> |  | Parameters to substitute |
| [fallback] | <code>string</code> | <code>&quot;&#x27;&#x27;&quot;</code> | Fallback text (can use $1, $2 placeholders) |

<a name="LayerSetManager+parseMWTimestamp"></a>

### layerSetManager.parseMWTimestamp(mwTimestamp) ⇒ <code>Date</code>
Parse MediaWiki binary(14) timestamp format (YYYYMMDDHHmmss)

**Kind**: instance method of [<code>LayerSetManager</code>](#LayerSetManager)  
**Returns**: <code>Date</code> - Parsed date object  

| Param | Type | Description |
| --- | --- | --- |
| mwTimestamp | <code>string</code> | The timestamp string |

<a name="LayerSetManager+buildRevisionSelector"></a>

### layerSetManager.buildRevisionSelector()
Build the revision selector dropdownPopulates the revision dropdown with available layer set revisions

**Kind**: instance method of [<code>LayerSetManager</code>](#LayerSetManager)  
<a name="LayerSetManager+updateRevisionLoadButton"></a>

### layerSetManager.updateRevisionLoadButton()
Update the revision load button stateDisables button if no revision selected or if current revision is selected

**Kind**: instance method of [<code>LayerSetManager</code>](#LayerSetManager)  
<a name="LayerSetManager+buildSetSelector"></a>

### layerSetManager.buildSetSelector()
Build and populate the named layer sets selector dropdown

**Kind**: instance method of [<code>LayerSetManager</code>](#LayerSetManager)  
<a name="LayerSetManager+updateNewSetButtonState"></a>

### layerSetManager.updateNewSetButtonState()
Update the new set button's enabled/disabled state based on limits

**Kind**: instance method of [<code>LayerSetManager</code>](#LayerSetManager)  
<a name="LayerSetManager+loadLayerSetByName"></a>

### layerSetManager.loadLayerSetByName(setName) ⇒ <code>Promise.&lt;void&gt;</code>
Load a layer set by its name

**Kind**: instance method of [<code>LayerSetManager</code>](#LayerSetManager)  

| Param | Type | Description |
| --- | --- | --- |
| setName | <code>string</code> | The name of the set to load |

<a name="LayerSetManager+createNewLayerSet"></a>

### layerSetManager.createNewLayerSet(setName) ⇒ <code>Promise.&lt;boolean&gt;</code>
Create a new named layer set

**Kind**: instance method of [<code>LayerSetManager</code>](#LayerSetManager)  
**Returns**: <code>Promise.&lt;boolean&gt;</code> - True if creation succeeded  

| Param | Type | Description |
| --- | --- | --- |
| setName | <code>string</code> | The name for the new set |

<a name="LayerSetManager+hasUnsavedChanges"></a>

### layerSetManager.hasUnsavedChanges() ⇒ <code>boolean</code>
Check if there are unsaved changes

**Kind**: instance method of [<code>LayerSetManager</code>](#LayerSetManager)  
<a name="LayerSetManager+loadRevisionById"></a>

### layerSetManager.loadRevisionById(revisionId)
Load a specific revision by ID

**Kind**: instance method of [<code>LayerSetManager</code>](#LayerSetManager)  

| Param | Type | Description |
| --- | --- | --- |
| revisionId | <code>number</code> | The revision ID to load |

<a name="LayerSetManager+reloadRevisions"></a>

### layerSetManager.reloadRevisions() ⇒ <code>Promise.&lt;void&gt;</code>
Reload revisions list from API

**Kind**: instance method of [<code>LayerSetManager</code>](#LayerSetManager)  
<a name="LayerSetManager+getCurrentSetName"></a>

### layerSetManager.getCurrentSetName() ⇒ <code>string</code>
Get current set name

**Kind**: instance method of [<code>LayerSetManager</code>](#LayerSetManager)  
<a name="LayerSetManager+getNamedSets"></a>

### layerSetManager.getNamedSets() ⇒ <code>Array</code>
Get named sets list

**Kind**: instance method of [<code>LayerSetManager</code>](#LayerSetManager)  
<a name="LayerSetManager+destroy"></a>

### layerSetManager.destroy()
Destroy and clean up

**Kind**: instance method of [<code>LayerSetManager</code>](#LayerSetManager)  
<a name="LayersValidator"></a>

## LayersValidator
**Kind**: global class  

* [LayersValidator](#LayersValidator)
    * [new LayersValidator()](#new_LayersValidator_new)
    * [new LayersValidator()](#new_LayersValidator_new)
    * [.validateLayer(layer)](#LayersValidator+validateLayer) ⇒ <code>Object</code>
    * [.validateRequired(layer, result)](#LayersValidator+validateRequired)
    * [.validateLayerType(layer, result)](#LayersValidator+validateLayerType)
    * [.validateLayerId(layer, result)](#LayersValidator+validateLayerId)
    * [.validateCoordinates(layer, result)](#LayersValidator+validateCoordinates)
    * [.validateNumericProperties(layer, result)](#LayersValidator+validateNumericProperties)
    * [.validateTextContent(layer, result)](#LayersValidator+validateTextContent)
    * [.validateColors(layer, result)](#LayersValidator+validateColors)
    * [.validatePoints(layer, result)](#LayersValidator+validatePoints)
    * [.validateTypeSpecificProperties(layer, result)](#LayersValidator+validateTypeSpecificProperties)
    * [.validateLayers(layers, maxLayers)](#LayersValidator+validateLayers) ⇒ <code>Object</code>
    * [.isValidNumber(value)](#LayersValidator+isValidNumber) ⇒ <code>boolean</code>
    * [.isValidColor(color)](#LayersValidator+isValidColor) ⇒ <code>boolean</code>
    * [.containsScriptInjection(text)](#LayersValidator+containsScriptInjection) ⇒ <code>boolean</code>
    * [.getMessage(key, ...args)](#LayersValidator+getMessage) ⇒ <code>string</code>
    * [.showValidationErrors(errors, [context])](#LayersValidator+showValidationErrors)
    * [.createInputValidator(input, validationType, options)](#LayersValidator+createInputValidator) ⇒ <code>Object</code>

<a name="new_LayersValidator_new"></a>

### new LayersValidator()
Client-side validation for the Layers editorProvides immediate feedback to users about invalid input

<a name="new_LayersValidator_new"></a>

### new LayersValidator()
Create a new LayersValidator instance

<a name="LayersValidator+validateLayer"></a>

### layersValidator.validateLayer(layer) ⇒ <code>Object</code>
Validate a complete layer object

**Kind**: instance method of [<code>LayersValidator</code>](#LayersValidator)  
**Returns**: <code>Object</code> - Validation result with isValid flag and errors array  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | The layer to validate |

<a name="LayersValidator+validateRequired"></a>

### layersValidator.validateRequired(layer, result)
Validate required fields

**Kind**: instance method of [<code>LayersValidator</code>](#LayersValidator)  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer data object |
| result | <code>Object</code> | Validation result object |

<a name="LayersValidator+validateLayerType"></a>

### layersValidator.validateLayerType(layer, result)
Validate layer type

**Kind**: instance method of [<code>LayersValidator</code>](#LayersValidator)  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer data object |
| result | <code>Object</code> | Validation result object |

<a name="LayersValidator+validateLayerId"></a>

### layersValidator.validateLayerId(layer, result)
Validate layer ID

**Kind**: instance method of [<code>LayersValidator</code>](#LayersValidator)  

| Param | Type |
| --- | --- |
| layer | <code>Object</code> | 
| result | <code>Object</code> | 

<a name="LayersValidator+validateCoordinates"></a>

### layersValidator.validateCoordinates(layer, result)
Validate coordinate fields

**Kind**: instance method of [<code>LayersValidator</code>](#LayersValidator)  

| Param | Type |
| --- | --- |
| layer | <code>Object</code> | 
| result | <code>Object</code> | 

<a name="LayersValidator+validateNumericProperties"></a>

### layersValidator.validateNumericProperties(layer, result)
Validate numeric properties with specific ranges

**Kind**: instance method of [<code>LayersValidator</code>](#LayersValidator)  

| Param | Type |
| --- | --- |
| layer | <code>Object</code> | 
| result | <code>Object</code> | 

<a name="LayersValidator+validateTextContent"></a>

### layersValidator.validateTextContent(layer, result)
Validate text content

**Kind**: instance method of [<code>LayersValidator</code>](#LayersValidator)  

| Param | Type |
| --- | --- |
| layer | <code>Object</code> | 
| result | <code>Object</code> | 

<a name="LayersValidator+validateColors"></a>

### layersValidator.validateColors(layer, result)
Validate color values

**Kind**: instance method of [<code>LayersValidator</code>](#LayersValidator)  

| Param | Type |
| --- | --- |
| layer | <code>Object</code> | 
| result | <code>Object</code> | 

<a name="LayersValidator+validatePoints"></a>

### layersValidator.validatePoints(layer, result)
Validate points array for path layers

**Kind**: instance method of [<code>LayersValidator</code>](#LayersValidator)  

| Param | Type |
| --- | --- |
| layer | <code>Object</code> | 
| result | <code>Object</code> | 

<a name="LayersValidator+validateTypeSpecificProperties"></a>

### layersValidator.validateTypeSpecificProperties(layer, result)
Validate type-specific properties

**Kind**: instance method of [<code>LayersValidator</code>](#LayersValidator)  

| Param | Type |
| --- | --- |
| layer | <code>Object</code> | 
| result | <code>Object</code> | 

<a name="LayersValidator+validateLayers"></a>

### layersValidator.validateLayers(layers, maxLayers) ⇒ <code>Object</code>
Validate a complete layers array (multiple layers)

**Kind**: instance method of [<code>LayersValidator</code>](#LayersValidator)  
**Returns**: <code>Object</code> - Validation result with isValid and errors properties  

| Param | Type |
| --- | --- |
| layers | <code>Array</code> | 
| maxLayers | <code>number</code> | 

<a name="LayersValidator+isValidNumber"></a>

### layersValidator.isValidNumber(value) ⇒ <code>boolean</code>
Helper function to check if a value is a valid number

**Kind**: instance method of [<code>LayersValidator</code>](#LayersValidator)  
**Returns**: <code>boolean</code> - True if value is a valid number  

| Param | Type |
| --- | --- |
| value | <code>\*</code> | 

<a name="LayersValidator+isValidColor"></a>

### layersValidator.isValidColor(color) ⇒ <code>boolean</code>
Helper function to validate color values

**Kind**: instance method of [<code>LayersValidator</code>](#LayersValidator)  
**Returns**: <code>boolean</code> - True if color is valid  

| Param | Type |
| --- | --- |
| color | <code>string</code> | 

<a name="LayersValidator+containsScriptInjection"></a>

### layersValidator.containsScriptInjection(text) ⇒ <code>boolean</code>
Check for potential script injection in text content

**Kind**: instance method of [<code>LayersValidator</code>](#LayersValidator)  
**Returns**: <code>boolean</code> - True if text contains potential script injection  

| Param | Type |
| --- | --- |
| text | <code>string</code> | 

<a name="LayersValidator+getMessage"></a>

### layersValidator.getMessage(key, ...args) ⇒ <code>string</code>
Get internationalized message with parameter supportDelegates to MessageHelper for consistent i18n handling.Falls back to built-in English messages if MediaWiki i18n unavailable.

**Kind**: instance method of [<code>LayersValidator</code>](#LayersValidator)  
**Returns**: <code>string</code> - Localized message  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>string</code> | Message key (e.g., 'layers-validation-layer-invalid') |
| ...args | <code>\*</code> | Message parameters for substitution ($1, $2, etc.) |

<a name="LayersValidator+showValidationErrors"></a>

### layersValidator.showValidationErrors(errors, [context])
Show validation errors to the user

**Kind**: instance method of [<code>LayersValidator</code>](#LayersValidator)  

| Param | Type | Description |
| --- | --- | --- |
| errors | <code>Array.&lt;string&gt;</code> | Array of error messages |
| [context] | <code>Object</code> | Context information (unused) |

<a name="LayersValidator+createInputValidator"></a>

### layersValidator.createInputValidator(input, validationType, options) ⇒ <code>Object</code>
Create input validation helper for real-time validation

**Kind**: instance method of [<code>LayersValidator</code>](#LayersValidator)  
**Returns**: <code>Object</code> - Input validator with enable and disable methods  

| Param | Type |
| --- | --- |
| input | <code>\*</code> | 
| validationType | <code>string</code> | 
| options | <code>Object</code> | 

<a name="LayersValidator"></a>

## LayersValidator
LayersValidator classProvides validation methods and user feedback for layer data

**Kind**: global class  

* [LayersValidator](#LayersValidator)
    * [new LayersValidator()](#new_LayersValidator_new)
    * [new LayersValidator()](#new_LayersValidator_new)
    * [.validateLayer(layer)](#LayersValidator+validateLayer) ⇒ <code>Object</code>
    * [.validateRequired(layer, result)](#LayersValidator+validateRequired)
    * [.validateLayerType(layer, result)](#LayersValidator+validateLayerType)
    * [.validateLayerId(layer, result)](#LayersValidator+validateLayerId)
    * [.validateCoordinates(layer, result)](#LayersValidator+validateCoordinates)
    * [.validateNumericProperties(layer, result)](#LayersValidator+validateNumericProperties)
    * [.validateTextContent(layer, result)](#LayersValidator+validateTextContent)
    * [.validateColors(layer, result)](#LayersValidator+validateColors)
    * [.validatePoints(layer, result)](#LayersValidator+validatePoints)
    * [.validateTypeSpecificProperties(layer, result)](#LayersValidator+validateTypeSpecificProperties)
    * [.validateLayers(layers, maxLayers)](#LayersValidator+validateLayers) ⇒ <code>Object</code>
    * [.isValidNumber(value)](#LayersValidator+isValidNumber) ⇒ <code>boolean</code>
    * [.isValidColor(color)](#LayersValidator+isValidColor) ⇒ <code>boolean</code>
    * [.containsScriptInjection(text)](#LayersValidator+containsScriptInjection) ⇒ <code>boolean</code>
    * [.getMessage(key, ...args)](#LayersValidator+getMessage) ⇒ <code>string</code>
    * [.showValidationErrors(errors, [context])](#LayersValidator+showValidationErrors)
    * [.createInputValidator(input, validationType, options)](#LayersValidator+createInputValidator) ⇒ <code>Object</code>

<a name="new_LayersValidator_new"></a>

### new LayersValidator()
Client-side validation for the Layers editorProvides immediate feedback to users about invalid input

<a name="new_LayersValidator_new"></a>

### new LayersValidator()
Create a new LayersValidator instance

<a name="LayersValidator+validateLayer"></a>

### layersValidator.validateLayer(layer) ⇒ <code>Object</code>
Validate a complete layer object

**Kind**: instance method of [<code>LayersValidator</code>](#LayersValidator)  
**Returns**: <code>Object</code> - Validation result with isValid flag and errors array  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | The layer to validate |

<a name="LayersValidator+validateRequired"></a>

### layersValidator.validateRequired(layer, result)
Validate required fields

**Kind**: instance method of [<code>LayersValidator</code>](#LayersValidator)  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer data object |
| result | <code>Object</code> | Validation result object |

<a name="LayersValidator+validateLayerType"></a>

### layersValidator.validateLayerType(layer, result)
Validate layer type

**Kind**: instance method of [<code>LayersValidator</code>](#LayersValidator)  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer data object |
| result | <code>Object</code> | Validation result object |

<a name="LayersValidator+validateLayerId"></a>

### layersValidator.validateLayerId(layer, result)
Validate layer ID

**Kind**: instance method of [<code>LayersValidator</code>](#LayersValidator)  

| Param | Type |
| --- | --- |
| layer | <code>Object</code> | 
| result | <code>Object</code> | 

<a name="LayersValidator+validateCoordinates"></a>

### layersValidator.validateCoordinates(layer, result)
Validate coordinate fields

**Kind**: instance method of [<code>LayersValidator</code>](#LayersValidator)  

| Param | Type |
| --- | --- |
| layer | <code>Object</code> | 
| result | <code>Object</code> | 

<a name="LayersValidator+validateNumericProperties"></a>

### layersValidator.validateNumericProperties(layer, result)
Validate numeric properties with specific ranges

**Kind**: instance method of [<code>LayersValidator</code>](#LayersValidator)  

| Param | Type |
| --- | --- |
| layer | <code>Object</code> | 
| result | <code>Object</code> | 

<a name="LayersValidator+validateTextContent"></a>

### layersValidator.validateTextContent(layer, result)
Validate text content

**Kind**: instance method of [<code>LayersValidator</code>](#LayersValidator)  

| Param | Type |
| --- | --- |
| layer | <code>Object</code> | 
| result | <code>Object</code> | 

<a name="LayersValidator+validateColors"></a>

### layersValidator.validateColors(layer, result)
Validate color values

**Kind**: instance method of [<code>LayersValidator</code>](#LayersValidator)  

| Param | Type |
| --- | --- |
| layer | <code>Object</code> | 
| result | <code>Object</code> | 

<a name="LayersValidator+validatePoints"></a>

### layersValidator.validatePoints(layer, result)
Validate points array for path layers

**Kind**: instance method of [<code>LayersValidator</code>](#LayersValidator)  

| Param | Type |
| --- | --- |
| layer | <code>Object</code> | 
| result | <code>Object</code> | 

<a name="LayersValidator+validateTypeSpecificProperties"></a>

### layersValidator.validateTypeSpecificProperties(layer, result)
Validate type-specific properties

**Kind**: instance method of [<code>LayersValidator</code>](#LayersValidator)  

| Param | Type |
| --- | --- |
| layer | <code>Object</code> | 
| result | <code>Object</code> | 

<a name="LayersValidator+validateLayers"></a>

### layersValidator.validateLayers(layers, maxLayers) ⇒ <code>Object</code>
Validate a complete layers array (multiple layers)

**Kind**: instance method of [<code>LayersValidator</code>](#LayersValidator)  
**Returns**: <code>Object</code> - Validation result with isValid and errors properties  

| Param | Type |
| --- | --- |
| layers | <code>Array</code> | 
| maxLayers | <code>number</code> | 

<a name="LayersValidator+isValidNumber"></a>

### layersValidator.isValidNumber(value) ⇒ <code>boolean</code>
Helper function to check if a value is a valid number

**Kind**: instance method of [<code>LayersValidator</code>](#LayersValidator)  
**Returns**: <code>boolean</code> - True if value is a valid number  

| Param | Type |
| --- | --- |
| value | <code>\*</code> | 

<a name="LayersValidator+isValidColor"></a>

### layersValidator.isValidColor(color) ⇒ <code>boolean</code>
Helper function to validate color values

**Kind**: instance method of [<code>LayersValidator</code>](#LayersValidator)  
**Returns**: <code>boolean</code> - True if color is valid  

| Param | Type |
| --- | --- |
| color | <code>string</code> | 

<a name="LayersValidator+containsScriptInjection"></a>

### layersValidator.containsScriptInjection(text) ⇒ <code>boolean</code>
Check for potential script injection in text content

**Kind**: instance method of [<code>LayersValidator</code>](#LayersValidator)  
**Returns**: <code>boolean</code> - True if text contains potential script injection  

| Param | Type |
| --- | --- |
| text | <code>string</code> | 

<a name="LayersValidator+getMessage"></a>

### layersValidator.getMessage(key, ...args) ⇒ <code>string</code>
Get internationalized message with parameter supportDelegates to MessageHelper for consistent i18n handling.Falls back to built-in English messages if MediaWiki i18n unavailable.

**Kind**: instance method of [<code>LayersValidator</code>](#LayersValidator)  
**Returns**: <code>string</code> - Localized message  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>string</code> | Message key (e.g., 'layers-validation-layer-invalid') |
| ...args | <code>\*</code> | Message parameters for substitution ($1, $2, etc.) |

<a name="LayersValidator+showValidationErrors"></a>

### layersValidator.showValidationErrors(errors, [context])
Show validation errors to the user

**Kind**: instance method of [<code>LayersValidator</code>](#LayersValidator)  

| Param | Type | Description |
| --- | --- | --- |
| errors | <code>Array.&lt;string&gt;</code> | Array of error messages |
| [context] | <code>Object</code> | Context information (unused) |

<a name="LayersValidator+createInputValidator"></a>

### layersValidator.createInputValidator(input, validationType, options) ⇒ <code>Object</code>
Create input validation helper for real-time validation

**Kind**: instance method of [<code>LayersValidator</code>](#LayersValidator)  
**Returns**: <code>Object</code> - Input validator with enable and disable methods  

| Param | Type |
| --- | --- |
| input | <code>\*</code> | 
| validationType | <code>string</code> | 
| options | <code>Object</code> | 

<a name="SelectionManager"></a>

## SelectionManager
SelectionManager classManages layer selection, manipulation, and transformation operations

**Kind**: global class  

* [SelectionManager](#SelectionManager)
    * [new SelectionManager(config, canvasManager)](#new_SelectionManager_new)
    * [._initializeModules()](#SelectionManager+_initializeModules)
    * [._getLayersArray()](#SelectionManager+_getLayersArray) ⇒ <code>Array</code>
    * [._handleSelectionChange(ids)](#SelectionManager+_handleSelectionChange)
    * [.selectLayer(layerId, addToSelection)](#SelectionManager+selectLayer)
    * [.getDefaultLayerName(layer)](#SelectionManager+getDefaultLayerName) ⇒ <code>string</code>
    * [.deselectLayer(layerId)](#SelectionManager+deselectLayer)
    * [.clearSelection()](#SelectionManager+clearSelection)
    * [.selectAll()](#SelectionManager+selectAll)
    * [.isSelected(layerId)](#SelectionManager+isSelected) ⇒ <code>boolean</code>
    * [.getSelectionCount()](#SelectionManager+getSelectionCount) ⇒ <code>number</code>
    * [.getSelectedLayers()](#SelectionManager+getSelectedLayers) ⇒ <code>Array</code>
    * [.startMarqueeSelection(xOrPoint, [y])](#SelectionManager+startMarqueeSelection)
    * [.updateMarqueeSelection(xOrPoint, [y])](#SelectionManager+updateMarqueeSelection)
    * [.finishMarqueeSelection()](#SelectionManager+finishMarqueeSelection)
    * [.getMarqueeRect()](#SelectionManager+getMarqueeRect) ⇒ <code>Object</code>
    * [.rectIntersects(rect1, rect2)](#SelectionManager+rectIntersects) ⇒ <code>boolean</code>
    * [.updateSelectionHandles()](#SelectionManager+updateSelectionHandles)
    * [._createHandlesFromBounds(bounds, isSingle)](#SelectionManager+_createHandlesFromBounds) ⇒ <code>Array</code>
    * [.createSingleSelectionHandles(layer)](#SelectionManager+createSingleSelectionHandles)
    * [.createMultiSelectionHandles()](#SelectionManager+createMultiSelectionHandles)
    * [.getMultiSelectionBounds()](#SelectionManager+getMultiSelectionBounds) ⇒ <code>Object</code> \| <code>null</code>
    * [.hitTestSelectionHandles(point)](#SelectionManager+hitTestSelectionHandles) ⇒ <code>Object</code> \| <code>null</code>
    * [.getLayerAtPoint(xOrPoint, [y])](#SelectionManager+getLayerAtPoint) ⇒ <code>Object</code> \| <code>null</code>
    * [.pointInRect(point, rect)](#SelectionManager+pointInRect) ⇒ <code>boolean</code>
    * [.startResize(handle, point)](#SelectionManager+startResize)
    * [.updateResize(point, modifiers)](#SelectionManager+updateResize)
    * [.finishResize()](#SelectionManager+finishResize)
    * [.startRotation(point)](#SelectionManager+startRotation)
    * [.updateRotation(point)](#SelectionManager+updateRotation)
    * [.finishRotation()](#SelectionManager+finishRotation)
    * [.startDrag(xOrPoint, [y])](#SelectionManager+startDrag)
    * [.updateDrag(xOrPoint, [y])](#SelectionManager+updateDrag)
    * [.finishDrag()](#SelectionManager+finishDrag)
    * [.applyResize(layer, originalLayer, deltaX, deltaY, modifiers)](#SelectionManager+applyResize)
    * [.applyDrag(layer, originalLayer, deltaX, deltaY)](#SelectionManager+applyDrag)
    * [.saveSelectedLayersState()](#SelectionManager+saveSelectedLayersState) ⇒ <code>Object</code>
    * [.getLayerById(layerId)](#SelectionManager+getLayerById) ⇒ <code>Object</code> \| <code>null</code>
    * [.notifySelectionChange()](#SelectionManager+notifySelectionChange)
    * [.notifyToolbarOfSelection()](#SelectionManager+notifyToolbarOfSelection)
    * [.deleteSelected()](#SelectionManager+deleteSelected)
    * [.duplicateSelected()](#SelectionManager+duplicateSelected)
    * [.generateLayerId()](#SelectionManager+generateLayerId) ⇒ <code>string</code>
    * [.getSelectionBounds()](#SelectionManager+getSelectionBounds) ⇒ <code>Object</code> \| <code>null</code>
    * [.getLayerBoundsCompat(layer)](#SelectionManager+getLayerBoundsCompat) ⇒ <code>Object</code> \| <code>null</code>
    * [.destroy()](#SelectionManager+destroy)

<a name="new_SelectionManager_new"></a>

### new SelectionManager(config, canvasManager)
Create a SelectionManager instance


| Param | Type | Description |
| --- | --- | --- |
| config | <code>Object</code> | Configuration object |
| canvasManager | [<code>CanvasManager</code>](#CanvasManager) | Reference to the canvas manager |

<a name="SelectionManager+_initializeModules"></a>

### selectionManager.\_initializeModules()
Initialize extracted modules

**Kind**: instance method of [<code>SelectionManager</code>](#SelectionManager)  
<a name="SelectionManager+_getLayersArray"></a>

### selectionManager.\_getLayersArray() ⇒ <code>Array</code>
Get layers array from canvas manager

**Kind**: instance method of [<code>SelectionManager</code>](#SelectionManager)  
**Returns**: <code>Array</code> - Layers array  
<a name="SelectionManager+_handleSelectionChange"></a>

### selectionManager.\_handleSelectionChange(ids)
Handle selection change from SelectionState module

**Kind**: instance method of [<code>SelectionManager</code>](#SelectionManager)  

| Param | Type | Description |
| --- | --- | --- |
| ids | <code>Array</code> | Selected layer IDs |

<a name="SelectionManager+selectLayer"></a>

### selectionManager.selectLayer(layerId, addToSelection)
Select a layer by ID

**Kind**: instance method of [<code>SelectionManager</code>](#SelectionManager)  

| Param | Type | Description |
| --- | --- | --- |
| layerId | <code>string</code> \| <code>null</code> | Layer ID to select, or null to clear |
| addToSelection | <code>boolean</code> | Whether to add to existing selection |

<a name="SelectionManager+getDefaultLayerName"></a>

### selectionManager.getDefaultLayerName(layer) ⇒ <code>string</code>
Get default name for a layer (for accessibility announcements)

**Kind**: instance method of [<code>SelectionManager</code>](#SelectionManager)  
**Returns**: <code>string</code> - Default layer name  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer object |

<a name="SelectionManager+deselectLayer"></a>

### selectionManager.deselectLayer(layerId)
Deselect a layer by ID

**Kind**: instance method of [<code>SelectionManager</code>](#SelectionManager)  

| Param | Type | Description |
| --- | --- | --- |
| layerId | <code>string</code> | Layer ID to deselect |

<a name="SelectionManager+clearSelection"></a>

### selectionManager.clearSelection()
Clear all selections

**Kind**: instance method of [<code>SelectionManager</code>](#SelectionManager)  
<a name="SelectionManager+selectAll"></a>

### selectionManager.selectAll()
Select all layers

**Kind**: instance method of [<code>SelectionManager</code>](#SelectionManager)  
<a name="SelectionManager+isSelected"></a>

### selectionManager.isSelected(layerId) ⇒ <code>boolean</code>
Check if a layer is selected

**Kind**: instance method of [<code>SelectionManager</code>](#SelectionManager)  
**Returns**: <code>boolean</code> - True if selected  

| Param | Type | Description |
| --- | --- | --- |
| layerId | <code>string</code> | Layer ID to check |

<a name="SelectionManager+getSelectionCount"></a>

### selectionManager.getSelectionCount() ⇒ <code>number</code>
Get the number of selected layers

**Kind**: instance method of [<code>SelectionManager</code>](#SelectionManager)  
**Returns**: <code>number</code> - Number of selected layers  
<a name="SelectionManager+getSelectedLayers"></a>

### selectionManager.getSelectedLayers() ⇒ <code>Array</code>
Get all selected layers

**Kind**: instance method of [<code>SelectionManager</code>](#SelectionManager)  
**Returns**: <code>Array</code> - Array of selected layer objects  
<a name="SelectionManager+startMarqueeSelection"></a>

### selectionManager.startMarqueeSelection(xOrPoint, [y])
Start marquee selection

**Kind**: instance method of [<code>SelectionManager</code>](#SelectionManager)  

| Param | Type | Description |
| --- | --- | --- |
| xOrPoint | <code>Object</code> \| <code>number</code> | Starting point or x coordinate |
| [y] | <code>number</code> | y coordinate when using numeric args |

<a name="SelectionManager+updateMarqueeSelection"></a>

### selectionManager.updateMarqueeSelection(xOrPoint, [y])
Update marquee selection

**Kind**: instance method of [<code>SelectionManager</code>](#SelectionManager)  

| Param | Type | Description |
| --- | --- | --- |
| xOrPoint | <code>Object</code> \| <code>number</code> | Current point or x coordinate |
| [y] | <code>number</code> | y coordinate when using numeric args |

<a name="SelectionManager+finishMarqueeSelection"></a>

### selectionManager.finishMarqueeSelection()
Finish marquee selection

**Kind**: instance method of [<code>SelectionManager</code>](#SelectionManager)  
<a name="SelectionManager+getMarqueeRect"></a>

### selectionManager.getMarqueeRect() ⇒ <code>Object</code>
Get marquee selection rectangle

**Kind**: instance method of [<code>SelectionManager</code>](#SelectionManager)  
**Returns**: <code>Object</code> - Rectangle object  
<a name="SelectionManager+rectIntersects"></a>

### selectionManager.rectIntersects(rect1, rect2) ⇒ <code>boolean</code>
Check if two rectangles intersect

**Kind**: instance method of [<code>SelectionManager</code>](#SelectionManager)  
**Returns**: <code>boolean</code> - True if intersecting  

| Param | Type | Description |
| --- | --- | --- |
| rect1 | <code>Object</code> | First rectangle |
| rect2 | <code>Object</code> | Second rectangle |

<a name="SelectionManager+updateSelectionHandles"></a>

### selectionManager.updateSelectionHandles()
Update selection handles

**Kind**: instance method of [<code>SelectionManager</code>](#SelectionManager)  
<a name="SelectionManager+_createHandlesFromBounds"></a>

### selectionManager.\_createHandlesFromBounds(bounds, isSingle) ⇒ <code>Array</code>
Create handles from bounds (minimal fallback for tests)

**Kind**: instance method of [<code>SelectionManager</code>](#SelectionManager)  
**Returns**: <code>Array</code> - Handle objects  

| Param | Type | Description |
| --- | --- | --- |
| bounds | <code>Object</code> | Bounds object |
| isSingle | <code>boolean</code> | Whether this is single selection |

<a name="SelectionManager+createSingleSelectionHandles"></a>

### selectionManager.createSingleSelectionHandles(layer)
Create selection handles for single layer (legacy method, delegates to _createHandlesFromBounds)

**Kind**: instance method of [<code>SelectionManager</code>](#SelectionManager)  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer object |

<a name="SelectionManager+createMultiSelectionHandles"></a>

### selectionManager.createMultiSelectionHandles()
Create selection handles for multiple layers (legacy method, delegates to _createHandlesFromBounds)

**Kind**: instance method of [<code>SelectionManager</code>](#SelectionManager)  
<a name="SelectionManager+getMultiSelectionBounds"></a>

### selectionManager.getMultiSelectionBounds() ⇒ <code>Object</code> \| <code>null</code>
Get bounds for multi-selection

**Kind**: instance method of [<code>SelectionManager</code>](#SelectionManager)  
**Returns**: <code>Object</code> \| <code>null</code> - Bounds object or null  
<a name="SelectionManager+hitTestSelectionHandles"></a>

### selectionManager.hitTestSelectionHandles(point) ⇒ <code>Object</code> \| <code>null</code>
Hit test selection handles

**Kind**: instance method of [<code>SelectionManager</code>](#SelectionManager)  
**Returns**: <code>Object</code> \| <code>null</code> - Handle object or null  

| Param | Type | Description |
| --- | --- | --- |
| point | <code>Object</code> | Point to test |

<a name="SelectionManager+getLayerAtPoint"></a>

### selectionManager.getLayerAtPoint(xOrPoint, [y]) ⇒ <code>Object</code> \| <code>null</code>
Convenience: get layer at point, preferring CanvasManager implementation.Accepts (x, y) or {x, y}.

**Kind**: instance method of [<code>SelectionManager</code>](#SelectionManager)  
**Returns**: <code>Object</code> \| <code>null</code> - Layer object if hit, otherwise null  

| Param | Type | Description |
| --- | --- | --- |
| xOrPoint | <code>Object</code> \| <code>number</code> | Point object or x coordinate |
| [y] | <code>number</code> | y coordinate when using numeric args |

<a name="SelectionManager+pointInRect"></a>

### selectionManager.pointInRect(point, rect) ⇒ <code>boolean</code>
Check if point is in rectangle

**Kind**: instance method of [<code>SelectionManager</code>](#SelectionManager)  
**Returns**: <code>boolean</code> - True if point is in rectangle  

| Param | Type | Description |
| --- | --- | --- |
| point | <code>Object</code> | Point to test |
| rect | <code>Object</code> | Rectangle to test against |

<a name="SelectionManager+startResize"></a>

### selectionManager.startResize(handle, point)
Start resize operation

**Kind**: instance method of [<code>SelectionManager</code>](#SelectionManager)  

| Param | Type | Description |
| --- | --- | --- |
| handle | <code>Object</code> | Resize handle |
| point | <code>Object</code> | Starting point |

<a name="SelectionManager+updateResize"></a>

### selectionManager.updateResize(point, modifiers)
Update resize operation

**Kind**: instance method of [<code>SelectionManager</code>](#SelectionManager)  

| Param | Type | Description |
| --- | --- | --- |
| point | <code>Object</code> | Current point |
| modifiers | <code>Object</code> | Modifier keys |

<a name="SelectionManager+finishResize"></a>

### selectionManager.finishResize()
Finish resize operation

**Kind**: instance method of [<code>SelectionManager</code>](#SelectionManager)  
<a name="SelectionManager+startRotation"></a>

### selectionManager.startRotation(point)
Start rotation operation

**Kind**: instance method of [<code>SelectionManager</code>](#SelectionManager)  

| Param | Type | Description |
| --- | --- | --- |
| point | <code>Object</code> | Starting point |

<a name="SelectionManager+updateRotation"></a>

### selectionManager.updateRotation(point)
Update rotation operation

**Kind**: instance method of [<code>SelectionManager</code>](#SelectionManager)  

| Param | Type | Description |
| --- | --- | --- |
| point | <code>Object</code> | Current point |

<a name="SelectionManager+finishRotation"></a>

### selectionManager.finishRotation()
Finish rotation operation

**Kind**: instance method of [<code>SelectionManager</code>](#SelectionManager)  
<a name="SelectionManager+startDrag"></a>

### selectionManager.startDrag(xOrPoint, [y])
Start drag operation

**Kind**: instance method of [<code>SelectionManager</code>](#SelectionManager)  

| Param | Type | Description |
| --- | --- | --- |
| xOrPoint | <code>Object</code> \| <code>number</code> | Starting point or x coordinate |
| [y] | <code>number</code> | y coordinate when using numeric args |

<a name="SelectionManager+updateDrag"></a>

### selectionManager.updateDrag(xOrPoint, [y])
Update drag operation

**Kind**: instance method of [<code>SelectionManager</code>](#SelectionManager)  

| Param | Type | Description |
| --- | --- | --- |
| xOrPoint | <code>Object</code> \| <code>number</code> | Current point or x coordinate |
| [y] | <code>number</code> | y coordinate when using numeric args |

<a name="SelectionManager+finishDrag"></a>

### selectionManager.finishDrag()
Finish drag operation

**Kind**: instance method of [<code>SelectionManager</code>](#SelectionManager)  
<a name="SelectionManager+applyResize"></a>

### selectionManager.applyResize(layer, originalLayer, deltaX, deltaY, modifiers)
Apply resize to a layer

**Kind**: instance method of [<code>SelectionManager</code>](#SelectionManager)  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer to resize |
| originalLayer | <code>Object</code> | Original layer state |
| deltaX | <code>number</code> | X delta |
| deltaY | <code>number</code> | Y delta |
| modifiers | <code>Object</code> | Modifier keys |

<a name="SelectionManager+applyDrag"></a>

### selectionManager.applyDrag(layer, originalLayer, deltaX, deltaY)
Apply drag to a layer

**Kind**: instance method of [<code>SelectionManager</code>](#SelectionManager)  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer to drag |
| originalLayer | <code>Object</code> | Original layer state |
| deltaX | <code>number</code> | X delta |
| deltaY | <code>number</code> | Y delta |

<a name="SelectionManager+saveSelectedLayersState"></a>

### selectionManager.saveSelectedLayersState() ⇒ <code>Object</code>
Save state of selected layers

**Kind**: instance method of [<code>SelectionManager</code>](#SelectionManager)  
**Returns**: <code>Object</code> - Saved state  
<a name="SelectionManager+getLayerById"></a>

### selectionManager.getLayerById(layerId) ⇒ <code>Object</code> \| <code>null</code>
Get layer by ID

**Kind**: instance method of [<code>SelectionManager</code>](#SelectionManager)  
**Returns**: <code>Object</code> \| <code>null</code> - Layer object or null  

| Param | Type | Description |
| --- | --- | --- |
| layerId | <code>string</code> | Layer ID |

<a name="SelectionManager+notifySelectionChange"></a>

### selectionManager.notifySelectionChange()
Notify selection change

**Kind**: instance method of [<code>SelectionManager</code>](#SelectionManager)  
<a name="SelectionManager+notifyToolbarOfSelection"></a>

### selectionManager.notifyToolbarOfSelection()
Notify toolbar of selection change for preset dropdown

**Kind**: instance method of [<code>SelectionManager</code>](#SelectionManager)  
<a name="SelectionManager+deleteSelected"></a>

### selectionManager.deleteSelected()
Delete selected layers

**Kind**: instance method of [<code>SelectionManager</code>](#SelectionManager)  
<a name="SelectionManager+duplicateSelected"></a>

### selectionManager.duplicateSelected()
Duplicate selected layers

**Kind**: instance method of [<code>SelectionManager</code>](#SelectionManager)  
<a name="SelectionManager+generateLayerId"></a>

### selectionManager.generateLayerId() ⇒ <code>string</code>
Generate unique layer ID

**Kind**: instance method of [<code>SelectionManager</code>](#SelectionManager)  
**Returns**: <code>string</code> - Unique layer ID  
<a name="SelectionManager+getSelectionBounds"></a>

### selectionManager.getSelectionBounds() ⇒ <code>Object</code> \| <code>null</code>
Bounds for current selection; null if none.

**Kind**: instance method of [<code>SelectionManager</code>](#SelectionManager)  
**Returns**: <code>Object</code> \| <code>null</code> - Bounds of selection or null  
<a name="SelectionManager+getLayerBoundsCompat"></a>

### selectionManager.getLayerBoundsCompat(layer) ⇒ <code>Object</code> \| <code>null</code>
Compute layer bounds with graceful fallback when CanvasManager.getLayerBoundsis unavailable in tests.

**Kind**: instance method of [<code>SelectionManager</code>](#SelectionManager)  
**Returns**: <code>Object</code> \| <code>null</code> - Bounds {x,y,width,height} or null  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer object |

<a name="SelectionManager+destroy"></a>

### selectionManager.destroy()
Clean up resources and clear state

**Kind**: instance method of [<code>SelectionManager</code>](#SelectionManager)  
<a name="StateManager"></a>

## StateManager
State Manager for Layers EditorCentralized state management with race condition prevention

**Kind**: global class  

* [StateManager](#StateManager)
    * [.getState()](#StateManager+getState)
    * [.get()](#StateManager+get)
    * [.set()](#StateManager+set)
    * [.update()](#StateManager+update)
    * [.atomic()](#StateManager+atomic)
    * [.lockState()](#StateManager+lockState)
    * [.unlockState()](#StateManager+unlockState)
    * [.subscribe()](#StateManager+subscribe)
    * [.notifyListeners()](#StateManager+notifyListeners)
    * [.addLayer()](#StateManager+addLayer)
    * [.reorderLayer()](#StateManager+reorderLayer)
    * [.selectLayer()](#StateManager+selectLayer)
    * [.saveToHistory()](#StateManager+saveToHistory)
    * [.setDirty()](#StateManager+setDirty)
    * [.loadState()](#StateManager+loadState)
    * [.exportState()](#StateManager+exportState)
    * [.reset()](#StateManager+reset)
    * [.destroy()](#StateManager+destroy)

<a name="StateManager+getState"></a>

### stateManager.getState()
Get current state

**Kind**: instance method of [<code>StateManager</code>](#StateManager)  
<a name="StateManager+get"></a>

### stateManager.get()
Get specific state property

**Kind**: instance method of [<code>StateManager</code>](#StateManager)  
<a name="StateManager+set"></a>

### stateManager.set()
Set state property and notify listeners (with race condition protection)

**Kind**: instance method of [<code>StateManager</code>](#StateManager)  
<a name="StateManager+update"></a>

### stateManager.update()
Update multiple state properties at once (with race condition protection)

**Kind**: instance method of [<code>StateManager</code>](#StateManager)  
<a name="StateManager+atomic"></a>

### stateManager.atomic()
Atomically update state with a function to prevent race conditions

**Kind**: instance method of [<code>StateManager</code>](#StateManager)  
<a name="StateManager+lockState"></a>

### stateManager.lockState()
Lock the state to prevent concurrent modifications

**Kind**: instance method of [<code>StateManager</code>](#StateManager)  
<a name="StateManager+unlockState"></a>

### stateManager.unlockState()
Unlock the state and process any pending operations

**Kind**: instance method of [<code>StateManager</code>](#StateManager)  
<a name="StateManager+subscribe"></a>

### stateManager.subscribe()
Subscribe to state changes

**Kind**: instance method of [<code>StateManager</code>](#StateManager)  
<a name="StateManager+notifyListeners"></a>

### stateManager.notifyListeners()
Notify listeners of state changes

**Kind**: instance method of [<code>StateManager</code>](#StateManager)  
<a name="StateManager+addLayer"></a>

### stateManager.addLayer()
Layer management methods with atomic operations

**Kind**: instance method of [<code>StateManager</code>](#StateManager)  
<a name="StateManager+reorderLayer"></a>

### stateManager.reorderLayer()
Layer ordering methods

**Kind**: instance method of [<code>StateManager</code>](#StateManager)  
<a name="StateManager+selectLayer"></a>

### stateManager.selectLayer()
Selection management with atomic operations

**Kind**: instance method of [<code>StateManager</code>](#StateManager)  
<a name="StateManager+saveToHistory"></a>

### stateManager.saveToHistory()
History management

**Kind**: instance method of [<code>StateManager</code>](#StateManager)  
<a name="StateManager+setDirty"></a>

### stateManager.setDirty()
Utility methods

**Kind**: instance method of [<code>StateManager</code>](#StateManager)  
<a name="StateManager+loadState"></a>

### stateManager.loadState()
Load state from external source

**Kind**: instance method of [<code>StateManager</code>](#StateManager)  
<a name="StateManager+exportState"></a>

### stateManager.exportState()
Export current state

**Kind**: instance method of [<code>StateManager</code>](#StateManager)  
<a name="StateManager+reset"></a>

### stateManager.reset()
Reset state to initial values

**Kind**: instance method of [<code>StateManager</code>](#StateManager)  
<a name="StateManager+destroy"></a>

### stateManager.destroy()
Clean up state manager resources
	/**Destroy state manager and clean up resources

**Kind**: instance method of [<code>StateManager</code>](#StateManager)  
<a name="StyleController"></a>

## StyleController
**Kind**: global class  

* [StyleController](#StyleController)
    * [new StyleController()](#new_StyleController_new)
    * [new StyleController(editor)](#new_StyleController_new)
    * _instance_
        * [.setCurrentStyle(style)](#StyleController+setCurrentStyle)
        * [.getCurrentStyle()](#StyleController+getCurrentStyle) ⇒ <code>Object</code>
        * [.updateStyleOptions(options)](#StyleController+updateStyleOptions) ⇒ <code>Object</code>
        * [.applyToLayer(layer, next)](#StyleController+applyToLayer)
    * _static_
        * [.getDefaultStyle()](#StyleController.getDefaultStyle) ⇒ <code>Object</code>

<a name="new_StyleController_new"></a>

### new StyleController()
StyleController - Manages style state for the Layers editorTracks current style settings (colors, fonts, effects) and applies them to layers.

<a name="new_StyleController_new"></a>

### new StyleController(editor)
Creates a new StyleController instance


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| editor | <code>Object</code> \| <code>null</code> | <code></code> | Reference to the editor instance |

<a name="StyleController+setCurrentStyle"></a>

### styleController.setCurrentStyle(style)
Set the current style by merging with existing

**Kind**: instance method of [<code>StyleController</code>](#StyleController)  

| Param | Type | Description |
| --- | --- | --- |
| style | <code>Object</code> | Style properties to merge |

<a name="StyleController+getCurrentStyle"></a>

### styleController.getCurrentStyle() ⇒ <code>Object</code>
Get the current style object

**Kind**: instance method of [<code>StyleController</code>](#StyleController)  
**Returns**: <code>Object</code> - Current style settings  
<a name="StyleController+updateStyleOptions"></a>

### styleController.updateStyleOptions(options) ⇒ <code>Object</code>
Update style options, preserving existing values for unspecified properties

**Kind**: instance method of [<code>StyleController</code>](#StyleController)  
**Returns**: <code>Object</code> - Updated style object  

| Param | Type | Description |
| --- | --- | --- |
| options | <code>Object</code> | Style options to update |

<a name="StyleController+applyToLayer"></a>

### styleController.applyToLayer(layer, next)
Apply style settings to a layer based on its type

**Kind**: instance method of [<code>StyleController</code>](#StyleController)  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer to apply styles to |
| next | <code>Object</code> | Style settings to apply |

<a name="StyleController.getDefaultStyle"></a>

### StyleController.getDefaultStyle() ⇒ <code>Object</code>
Get the default style settings

**Kind**: static method of [<code>StyleController</code>](#StyleController)  
**Returns**: <code>Object</code> - Default style settings  
<a name="StyleController"></a>

## StyleController
StyleController class - manages editor style state

**Kind**: global class  

* [StyleController](#StyleController)
    * [new StyleController()](#new_StyleController_new)
    * [new StyleController(editor)](#new_StyleController_new)
    * _instance_
        * [.setCurrentStyle(style)](#StyleController+setCurrentStyle)
        * [.getCurrentStyle()](#StyleController+getCurrentStyle) ⇒ <code>Object</code>
        * [.updateStyleOptions(options)](#StyleController+updateStyleOptions) ⇒ <code>Object</code>
        * [.applyToLayer(layer, next)](#StyleController+applyToLayer)
    * _static_
        * [.getDefaultStyle()](#StyleController.getDefaultStyle) ⇒ <code>Object</code>

<a name="new_StyleController_new"></a>

### new StyleController()
StyleController - Manages style state for the Layers editorTracks current style settings (colors, fonts, effects) and applies them to layers.

<a name="new_StyleController_new"></a>

### new StyleController(editor)
Creates a new StyleController instance


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| editor | <code>Object</code> \| <code>null</code> | <code></code> | Reference to the editor instance |

<a name="StyleController+setCurrentStyle"></a>

### styleController.setCurrentStyle(style)
Set the current style by merging with existing

**Kind**: instance method of [<code>StyleController</code>](#StyleController)  

| Param | Type | Description |
| --- | --- | --- |
| style | <code>Object</code> | Style properties to merge |

<a name="StyleController+getCurrentStyle"></a>

### styleController.getCurrentStyle() ⇒ <code>Object</code>
Get the current style object

**Kind**: instance method of [<code>StyleController</code>](#StyleController)  
**Returns**: <code>Object</code> - Current style settings  
<a name="StyleController+updateStyleOptions"></a>

### styleController.updateStyleOptions(options) ⇒ <code>Object</code>
Update style options, preserving existing values for unspecified properties

**Kind**: instance method of [<code>StyleController</code>](#StyleController)  
**Returns**: <code>Object</code> - Updated style object  

| Param | Type | Description |
| --- | --- | --- |
| options | <code>Object</code> | Style options to update |

<a name="StyleController+applyToLayer"></a>

### styleController.applyToLayer(layer, next)
Apply style settings to a layer based on its type

**Kind**: instance method of [<code>StyleController</code>](#StyleController)  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer to apply styles to |
| next | <code>Object</code> | Style settings to apply |

<a name="StyleController.getDefaultStyle"></a>

### StyleController.getDefaultStyle() ⇒ <code>Object</code>
Get the default style settings

**Kind**: static method of [<code>StyleController</code>](#StyleController)  
**Returns**: <code>Object</code> - Default style settings  
<a name="Toolbar"></a>

## Toolbar
**Kind**: global class  

* [Toolbar](#Toolbar)
    * [new Toolbar()](#new_Toolbar_new)
    * [new Toolbar(config)](#new_Toolbar_new)
    * [.addListener(element, event, handler, [options])](#Toolbar+addListener)
    * [.handleImageImport(file)](#Toolbar+handleImageImport) ⇒ <code>Promise.&lt;void&gt;</code>
    * [.readFileAsDataURL(file)](#Toolbar+readFileAsDataURL) ⇒ <code>Promise.&lt;string&gt;</code>
    * [.loadImage(src)](#Toolbar+loadImage) ⇒ <code>Promise.&lt;HTMLImageElement&gt;</code>
    * [.msg(key, fallback)](#Toolbar+msg) ⇒ <code>string</code>
    * [.getToolIcons()](#Toolbar+getToolIcons) ⇒ <code>Object</code>
    * [.getActionIcons()](#Toolbar+getActionIcons) ⇒ <code>Object</code>
    * [.onStyleChange(styleOptions)](#Toolbar+onStyleChange)
    * [.getAlignmentIcons()](#Toolbar+getAlignmentIcons) ⇒ <code>Object</code>
    * [.createAlignmentGroup()](#Toolbar+createAlignmentGroup)
    * [.getArrangeIcon()](#Toolbar+getArrangeIcon) ⇒ <code>string</code>
    * [.createDropdownSeparator()](#Toolbar+createDropdownSeparator) ⇒ <code>HTMLElement</code>
    * [.createDropdownToggleItem(id, label, description, shortcut, checked)](#Toolbar+createDropdownToggleItem) ⇒ <code>HTMLElement</code>
    * [.createDropdownActionItem(config, type)](#Toolbar+createDropdownActionItem) ⇒ <code>HTMLElement</code>
    * [.setupArrangeDropdownEvents(trigger, menu)](#Toolbar+setupArrangeDropdownEvents)
    * [.toggleArrangeDropdown()](#Toolbar+toggleArrangeDropdown)
    * [.openArrangeDropdown()](#Toolbar+openArrangeDropdown)
    * [.closeArrangeDropdown()](#Toolbar+closeArrangeDropdown)
    * [.setSmartGuidesEnabled(enabled)](#Toolbar+setSmartGuidesEnabled)
    * [.updateSmartGuidesButton(enabled)](#Toolbar+updateSmartGuidesButton)
    * [.updateAlignmentButtons(selectedCount)](#Toolbar+updateAlignmentButtons)
    * [.setActiveTool(toolId)](#Toolbar+setActiveTool)
    * [.executeAlignmentAction(actionId)](#Toolbar+executeAlignmentAction)
    * ~~[.handleKeyboardShortcuts(e)](#Toolbar+handleKeyboardShortcuts)~~

<a name="new_Toolbar_new"></a>

### new Toolbar()
Toolbar class

<a name="new_Toolbar_new"></a>

### new Toolbar(config)
Create a new Toolbar instance


| Param | Type | Description |
| --- | --- | --- |
| config | <code>Object</code> | Configuration object |
| config.container | <code>HTMLElement</code> | The container element for the toolbar |
| config.editor | <code>window.LayersEditor</code> | A reference to the main editor instance |

<a name="Toolbar+addListener"></a>

### toolbar.addListener(element, event, handler, [options])
Add event listener to a specific element with automatic tracking

**Kind**: instance method of [<code>Toolbar</code>](#Toolbar)  

| Param | Type | Description |
| --- | --- | --- |
| element | <code>Element</code> | Target element |
| event | <code>string</code> | Event type |
| handler | <code>function</code> | Event handler |
| [options] | <code>Object</code> | Event listener options |

<a name="Toolbar+handleImageImport"></a>

### toolbar.handleImageImport(file) ⇒ <code>Promise.&lt;void&gt;</code>
Handle importing an image file as a layer

**Kind**: instance method of [<code>Toolbar</code>](#Toolbar)  

| Param | Type | Description |
| --- | --- | --- |
| file | <code>File</code> | The image file to import |

<a name="Toolbar+readFileAsDataURL"></a>

### toolbar.readFileAsDataURL(file) ⇒ <code>Promise.&lt;string&gt;</code>
Read a file as a data URL

**Kind**: instance method of [<code>Toolbar</code>](#Toolbar)  
**Returns**: <code>Promise.&lt;string&gt;</code> - - Data URL string  

| Param | Type | Description |
| --- | --- | --- |
| file | <code>File</code> | File to read |

<a name="Toolbar+loadImage"></a>

### toolbar.loadImage(src) ⇒ <code>Promise.&lt;HTMLImageElement&gt;</code>
Load an image from a source URL

**Kind**: instance method of [<code>Toolbar</code>](#Toolbar)  
**Returns**: <code>Promise.&lt;HTMLImageElement&gt;</code> - - Loaded image element  

| Param | Type | Description |
| --- | --- | --- |
| src | <code>string</code> | Image source (data URL or regular URL) |

<a name="Toolbar+msg"></a>

### toolbar.msg(key, fallback) ⇒ <code>string</code>
Resolve i18n text safely, delegating to MessageHelper

**Kind**: instance method of [<code>Toolbar</code>](#Toolbar)  
**Returns**: <code>string</code> - Localized message or fallback  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>string</code> | Message key |
| fallback | <code>string</code> | Fallback text if message not found |

<a name="Toolbar+getToolIcons"></a>

### toolbar.getToolIcons() ⇒ <code>Object</code>
Get SVG icons for toolbar toolsIcons follow industry standards (Figma, Adobe, etc.)

**Kind**: instance method of [<code>Toolbar</code>](#Toolbar)  
**Returns**: <code>Object</code> - Object containing SVG icon strings for each tool  
<a name="Toolbar+getActionIcons"></a>

### toolbar.getActionIcons() ⇒ <code>Object</code>
Get SVG icons for zoom and action buttons

**Kind**: instance method of [<code>Toolbar</code>](#Toolbar)  
**Returns**: <code>Object</code> - Object containing SVG icon strings  
<a name="Toolbar+onStyleChange"></a>

### toolbar.onStyleChange(styleOptions)
Handle style change notifications from ToolbarStyleControls

**Kind**: instance method of [<code>Toolbar</code>](#Toolbar)  

| Param | Type | Description |
| --- | --- | --- |
| styleOptions | <code>Object</code> | The new style options |

<a name="Toolbar+getAlignmentIcons"></a>

### toolbar.getAlignmentIcons() ⇒ <code>Object</code>
Get SVG icons for alignment buttons

**Kind**: instance method of [<code>Toolbar</code>](#Toolbar)  
**Returns**: <code>Object</code> - Object containing alignment SVG icon strings  
<a name="Toolbar+createAlignmentGroup"></a>

### toolbar.createAlignmentGroup()
Create the alignment toolbar group as a dropdown menuConsolidates 8 buttons into a single dropdown to save toolbar space

**Kind**: instance method of [<code>Toolbar</code>](#Toolbar)  
<a name="Toolbar+getArrangeIcon"></a>

### toolbar.getArrangeIcon() ⇒ <code>string</code>
Get the arrange menu icon

**Kind**: instance method of [<code>Toolbar</code>](#Toolbar)  
**Returns**: <code>string</code> - SVG icon markup  
<a name="Toolbar+createDropdownSeparator"></a>

### toolbar.createDropdownSeparator() ⇒ <code>HTMLElement</code>
Create a dropdown separator

**Kind**: instance method of [<code>Toolbar</code>](#Toolbar)  
**Returns**: <code>HTMLElement</code> - Separator element  
<a name="Toolbar+createDropdownToggleItem"></a>

### toolbar.createDropdownToggleItem(id, label, description, shortcut, checked) ⇒ <code>HTMLElement</code>
Create a toggle item for the dropdown

**Kind**: instance method of [<code>Toolbar</code>](#Toolbar)  
**Returns**: <code>HTMLElement</code> - Toggle item element  

| Param | Type | Description |
| --- | --- | --- |
| id | <code>string</code> | Item identifier |
| label | <code>string</code> | Display label |
| description | <code>string</code> | Description text |
| shortcut | <code>string</code> | Keyboard shortcut |
| checked | <code>boolean</code> | Initial checked state |

<a name="Toolbar+createDropdownActionItem"></a>

### toolbar.createDropdownActionItem(config, type) ⇒ <code>HTMLElement</code>
Create an action item for the dropdown

**Kind**: instance method of [<code>Toolbar</code>](#Toolbar)  
**Returns**: <code>HTMLElement</code> - Action item element  

| Param | Type | Description |
| --- | --- | --- |
| config | <code>Object</code> | Item configuration |
| config.id | <code>string</code> | Action identifier |
| config.icon | <code>string</code> | SVG icon |
| config.label | <code>string</code> | Display label |
| type | <code>string</code> | 'align' or 'distribute' |

<a name="Toolbar+setupArrangeDropdownEvents"></a>

### toolbar.setupArrangeDropdownEvents(trigger, menu)
Set up event handlers for the arrange dropdown

**Kind**: instance method of [<code>Toolbar</code>](#Toolbar)  

| Param | Type | Description |
| --- | --- | --- |
| trigger | <code>HTMLElement</code> | Trigger button |
| menu | <code>HTMLElement</code> | Dropdown menu |

<a name="Toolbar+toggleArrangeDropdown"></a>

### toolbar.toggleArrangeDropdown()
Toggle the arrange dropdown open/closed

**Kind**: instance method of [<code>Toolbar</code>](#Toolbar)  
<a name="Toolbar+openArrangeDropdown"></a>

### toolbar.openArrangeDropdown()
Open the arrange dropdown

**Kind**: instance method of [<code>Toolbar</code>](#Toolbar)  
<a name="Toolbar+closeArrangeDropdown"></a>

### toolbar.closeArrangeDropdown()
Close the arrange dropdown

**Kind**: instance method of [<code>Toolbar</code>](#Toolbar)  
<a name="Toolbar+setSmartGuidesEnabled"></a>

### toolbar.setSmartGuidesEnabled(enabled)
Enable or disable smart guides

**Kind**: instance method of [<code>Toolbar</code>](#Toolbar)  

| Param | Type | Description |
| --- | --- | --- |
| enabled | <code>boolean</code> | Whether smart guides should be enabled |

<a name="Toolbar+updateSmartGuidesButton"></a>

### toolbar.updateSmartGuidesButton(enabled)
Update smart guides button/toggle state (called from keyboard handler)

**Kind**: instance method of [<code>Toolbar</code>](#Toolbar)  

| Param | Type | Description |
| --- | --- | --- |
| enabled | <code>boolean</code> | Current enabled state |

<a name="Toolbar+updateAlignmentButtons"></a>

### toolbar.updateAlignmentButtons(selectedCount)
Update alignment button states based on selection

**Kind**: instance method of [<code>Toolbar</code>](#Toolbar)  

| Param | Type | Description |
| --- | --- | --- |
| selectedCount | <code>number</code> | Number of selected layers |

<a name="Toolbar+setActiveTool"></a>

### toolbar.setActiveTool(toolId)
Set the active tool programmatically (called by LayersEditor)

**Kind**: instance method of [<code>Toolbar</code>](#Toolbar)  

| Param | Type | Description |
| --- | --- | --- |
| toolId | <code>string</code> | The tool identifier to activate |

<a name="Toolbar+executeAlignmentAction"></a>

### toolbar.executeAlignmentAction(actionId)
Execute an alignment action on selected layers

**Kind**: instance method of [<code>Toolbar</code>](#Toolbar)  

| Param | Type | Description |
| --- | --- | --- |
| actionId | <code>string</code> | The alignment action identifier |

<a name="Toolbar+handleKeyboardShortcuts"></a>

### ~~toolbar.handleKeyboardShortcuts(e)~~
***Use ToolbarKeyboard.handleKeyboardShortcuts instead.Kept for backward compatibility - delegates to ToolbarKeyboard module.***

**Kind**: instance method of [<code>Toolbar</code>](#Toolbar)  

| Param | Type | Description |
| --- | --- | --- |
| e | <code>Event</code> | The keyboard event |

<a name="Toolbar"></a>

## Toolbar
**Kind**: global class  

* [Toolbar](#Toolbar)
    * [new Toolbar()](#new_Toolbar_new)
    * [new Toolbar(config)](#new_Toolbar_new)
    * [.addListener(element, event, handler, [options])](#Toolbar+addListener)
    * [.handleImageImport(file)](#Toolbar+handleImageImport) ⇒ <code>Promise.&lt;void&gt;</code>
    * [.readFileAsDataURL(file)](#Toolbar+readFileAsDataURL) ⇒ <code>Promise.&lt;string&gt;</code>
    * [.loadImage(src)](#Toolbar+loadImage) ⇒ <code>Promise.&lt;HTMLImageElement&gt;</code>
    * [.msg(key, fallback)](#Toolbar+msg) ⇒ <code>string</code>
    * [.getToolIcons()](#Toolbar+getToolIcons) ⇒ <code>Object</code>
    * [.getActionIcons()](#Toolbar+getActionIcons) ⇒ <code>Object</code>
    * [.onStyleChange(styleOptions)](#Toolbar+onStyleChange)
    * [.getAlignmentIcons()](#Toolbar+getAlignmentIcons) ⇒ <code>Object</code>
    * [.createAlignmentGroup()](#Toolbar+createAlignmentGroup)
    * [.getArrangeIcon()](#Toolbar+getArrangeIcon) ⇒ <code>string</code>
    * [.createDropdownSeparator()](#Toolbar+createDropdownSeparator) ⇒ <code>HTMLElement</code>
    * [.createDropdownToggleItem(id, label, description, shortcut, checked)](#Toolbar+createDropdownToggleItem) ⇒ <code>HTMLElement</code>
    * [.createDropdownActionItem(config, type)](#Toolbar+createDropdownActionItem) ⇒ <code>HTMLElement</code>
    * [.setupArrangeDropdownEvents(trigger, menu)](#Toolbar+setupArrangeDropdownEvents)
    * [.toggleArrangeDropdown()](#Toolbar+toggleArrangeDropdown)
    * [.openArrangeDropdown()](#Toolbar+openArrangeDropdown)
    * [.closeArrangeDropdown()](#Toolbar+closeArrangeDropdown)
    * [.setSmartGuidesEnabled(enabled)](#Toolbar+setSmartGuidesEnabled)
    * [.updateSmartGuidesButton(enabled)](#Toolbar+updateSmartGuidesButton)
    * [.updateAlignmentButtons(selectedCount)](#Toolbar+updateAlignmentButtons)
    * [.setActiveTool(toolId)](#Toolbar+setActiveTool)
    * [.executeAlignmentAction(actionId)](#Toolbar+executeAlignmentAction)
    * ~~[.handleKeyboardShortcuts(e)](#Toolbar+handleKeyboardShortcuts)~~

<a name="new_Toolbar_new"></a>

### new Toolbar()
Toolbar class

<a name="new_Toolbar_new"></a>

### new Toolbar(config)
Create a new Toolbar instance


| Param | Type | Description |
| --- | --- | --- |
| config | <code>Object</code> | Configuration object |
| config.container | <code>HTMLElement</code> | The container element for the toolbar |
| config.editor | <code>window.LayersEditor</code> | A reference to the main editor instance |

<a name="Toolbar+addListener"></a>

### toolbar.addListener(element, event, handler, [options])
Add event listener to a specific element with automatic tracking

**Kind**: instance method of [<code>Toolbar</code>](#Toolbar)  

| Param | Type | Description |
| --- | --- | --- |
| element | <code>Element</code> | Target element |
| event | <code>string</code> | Event type |
| handler | <code>function</code> | Event handler |
| [options] | <code>Object</code> | Event listener options |

<a name="Toolbar+handleImageImport"></a>

### toolbar.handleImageImport(file) ⇒ <code>Promise.&lt;void&gt;</code>
Handle importing an image file as a layer

**Kind**: instance method of [<code>Toolbar</code>](#Toolbar)  

| Param | Type | Description |
| --- | --- | --- |
| file | <code>File</code> | The image file to import |

<a name="Toolbar+readFileAsDataURL"></a>

### toolbar.readFileAsDataURL(file) ⇒ <code>Promise.&lt;string&gt;</code>
Read a file as a data URL

**Kind**: instance method of [<code>Toolbar</code>](#Toolbar)  
**Returns**: <code>Promise.&lt;string&gt;</code> - - Data URL string  

| Param | Type | Description |
| --- | --- | --- |
| file | <code>File</code> | File to read |

<a name="Toolbar+loadImage"></a>

### toolbar.loadImage(src) ⇒ <code>Promise.&lt;HTMLImageElement&gt;</code>
Load an image from a source URL

**Kind**: instance method of [<code>Toolbar</code>](#Toolbar)  
**Returns**: <code>Promise.&lt;HTMLImageElement&gt;</code> - - Loaded image element  

| Param | Type | Description |
| --- | --- | --- |
| src | <code>string</code> | Image source (data URL or regular URL) |

<a name="Toolbar+msg"></a>

### toolbar.msg(key, fallback) ⇒ <code>string</code>
Resolve i18n text safely, delegating to MessageHelper

**Kind**: instance method of [<code>Toolbar</code>](#Toolbar)  
**Returns**: <code>string</code> - Localized message or fallback  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>string</code> | Message key |
| fallback | <code>string</code> | Fallback text if message not found |

<a name="Toolbar+getToolIcons"></a>

### toolbar.getToolIcons() ⇒ <code>Object</code>
Get SVG icons for toolbar toolsIcons follow industry standards (Figma, Adobe, etc.)

**Kind**: instance method of [<code>Toolbar</code>](#Toolbar)  
**Returns**: <code>Object</code> - Object containing SVG icon strings for each tool  
<a name="Toolbar+getActionIcons"></a>

### toolbar.getActionIcons() ⇒ <code>Object</code>
Get SVG icons for zoom and action buttons

**Kind**: instance method of [<code>Toolbar</code>](#Toolbar)  
**Returns**: <code>Object</code> - Object containing SVG icon strings  
<a name="Toolbar+onStyleChange"></a>

### toolbar.onStyleChange(styleOptions)
Handle style change notifications from ToolbarStyleControls

**Kind**: instance method of [<code>Toolbar</code>](#Toolbar)  

| Param | Type | Description |
| --- | --- | --- |
| styleOptions | <code>Object</code> | The new style options |

<a name="Toolbar+getAlignmentIcons"></a>

### toolbar.getAlignmentIcons() ⇒ <code>Object</code>
Get SVG icons for alignment buttons

**Kind**: instance method of [<code>Toolbar</code>](#Toolbar)  
**Returns**: <code>Object</code> - Object containing alignment SVG icon strings  
<a name="Toolbar+createAlignmentGroup"></a>

### toolbar.createAlignmentGroup()
Create the alignment toolbar group as a dropdown menuConsolidates 8 buttons into a single dropdown to save toolbar space

**Kind**: instance method of [<code>Toolbar</code>](#Toolbar)  
<a name="Toolbar+getArrangeIcon"></a>

### toolbar.getArrangeIcon() ⇒ <code>string</code>
Get the arrange menu icon

**Kind**: instance method of [<code>Toolbar</code>](#Toolbar)  
**Returns**: <code>string</code> - SVG icon markup  
<a name="Toolbar+createDropdownSeparator"></a>

### toolbar.createDropdownSeparator() ⇒ <code>HTMLElement</code>
Create a dropdown separator

**Kind**: instance method of [<code>Toolbar</code>](#Toolbar)  
**Returns**: <code>HTMLElement</code> - Separator element  
<a name="Toolbar+createDropdownToggleItem"></a>

### toolbar.createDropdownToggleItem(id, label, description, shortcut, checked) ⇒ <code>HTMLElement</code>
Create a toggle item for the dropdown

**Kind**: instance method of [<code>Toolbar</code>](#Toolbar)  
**Returns**: <code>HTMLElement</code> - Toggle item element  

| Param | Type | Description |
| --- | --- | --- |
| id | <code>string</code> | Item identifier |
| label | <code>string</code> | Display label |
| description | <code>string</code> | Description text |
| shortcut | <code>string</code> | Keyboard shortcut |
| checked | <code>boolean</code> | Initial checked state |

<a name="Toolbar+createDropdownActionItem"></a>

### toolbar.createDropdownActionItem(config, type) ⇒ <code>HTMLElement</code>
Create an action item for the dropdown

**Kind**: instance method of [<code>Toolbar</code>](#Toolbar)  
**Returns**: <code>HTMLElement</code> - Action item element  

| Param | Type | Description |
| --- | --- | --- |
| config | <code>Object</code> | Item configuration |
| config.id | <code>string</code> | Action identifier |
| config.icon | <code>string</code> | SVG icon |
| config.label | <code>string</code> | Display label |
| type | <code>string</code> | 'align' or 'distribute' |

<a name="Toolbar+setupArrangeDropdownEvents"></a>

### toolbar.setupArrangeDropdownEvents(trigger, menu)
Set up event handlers for the arrange dropdown

**Kind**: instance method of [<code>Toolbar</code>](#Toolbar)  

| Param | Type | Description |
| --- | --- | --- |
| trigger | <code>HTMLElement</code> | Trigger button |
| menu | <code>HTMLElement</code> | Dropdown menu |

<a name="Toolbar+toggleArrangeDropdown"></a>

### toolbar.toggleArrangeDropdown()
Toggle the arrange dropdown open/closed

**Kind**: instance method of [<code>Toolbar</code>](#Toolbar)  
<a name="Toolbar+openArrangeDropdown"></a>

### toolbar.openArrangeDropdown()
Open the arrange dropdown

**Kind**: instance method of [<code>Toolbar</code>](#Toolbar)  
<a name="Toolbar+closeArrangeDropdown"></a>

### toolbar.closeArrangeDropdown()
Close the arrange dropdown

**Kind**: instance method of [<code>Toolbar</code>](#Toolbar)  
<a name="Toolbar+setSmartGuidesEnabled"></a>

### toolbar.setSmartGuidesEnabled(enabled)
Enable or disable smart guides

**Kind**: instance method of [<code>Toolbar</code>](#Toolbar)  

| Param | Type | Description |
| --- | --- | --- |
| enabled | <code>boolean</code> | Whether smart guides should be enabled |

<a name="Toolbar+updateSmartGuidesButton"></a>

### toolbar.updateSmartGuidesButton(enabled)
Update smart guides button/toggle state (called from keyboard handler)

**Kind**: instance method of [<code>Toolbar</code>](#Toolbar)  

| Param | Type | Description |
| --- | --- | --- |
| enabled | <code>boolean</code> | Current enabled state |

<a name="Toolbar+updateAlignmentButtons"></a>

### toolbar.updateAlignmentButtons(selectedCount)
Update alignment button states based on selection

**Kind**: instance method of [<code>Toolbar</code>](#Toolbar)  

| Param | Type | Description |
| --- | --- | --- |
| selectedCount | <code>number</code> | Number of selected layers |

<a name="Toolbar+setActiveTool"></a>

### toolbar.setActiveTool(toolId)
Set the active tool programmatically (called by LayersEditor)

**Kind**: instance method of [<code>Toolbar</code>](#Toolbar)  

| Param | Type | Description |
| --- | --- | --- |
| toolId | <code>string</code> | The tool identifier to activate |

<a name="Toolbar+executeAlignmentAction"></a>

### toolbar.executeAlignmentAction(actionId)
Execute an alignment action on selected layers

**Kind**: instance method of [<code>Toolbar</code>](#Toolbar)  

| Param | Type | Description |
| --- | --- | --- |
| actionId | <code>string</code> | The alignment action identifier |

<a name="Toolbar+handleKeyboardShortcuts"></a>

### ~~toolbar.handleKeyboardShortcuts(e)~~
***Use ToolbarKeyboard.handleKeyboardShortcuts instead.Kept for backward compatibility - delegates to ToolbarKeyboard module.***

**Kind**: instance method of [<code>Toolbar</code>](#Toolbar)  

| Param | Type | Description |
| --- | --- | --- |
| e | <code>Event</code> | The keyboard event |

<a name="ToolbarKeyboard"></a>

## ToolbarKeyboard
ToolbarKeyboard - Manages keyboard shortcuts for the toolbar

**Kind**: global class  

* [ToolbarKeyboard](#ToolbarKeyboard)
    * [new ToolbarKeyboard(toolbar)](#new_ToolbarKeyboard_new)
    * [.handleKeyboardShortcuts(e)](#ToolbarKeyboard+handleKeyboardShortcuts)
    * [.handleCtrlShortcuts(e, key)](#ToolbarKeyboard+handleCtrlShortcuts)
    * [.handleToolShortcuts(e, key)](#ToolbarKeyboard+handleToolShortcuts)
    * [.toggleSmartGuides()](#ToolbarKeyboard+toggleSmartGuides)
    * [.toggleBackgroundVisibility()](#ToolbarKeyboard+toggleBackgroundVisibility)
    * [.handleZoom(action)](#ToolbarKeyboard+handleZoom)
    * [.getShortcutsConfig()](#ToolbarKeyboard+getShortcutsConfig) ⇒ <code>Array.&lt;Object&gt;</code>
    * [.showKeyboardShortcutsHelp()](#ToolbarKeyboard+showKeyboardShortcutsHelp)

<a name="new_ToolbarKeyboard_new"></a>

### new ToolbarKeyboard(toolbar)
Create a new ToolbarKeyboard instance


| Param | Type | Description |
| --- | --- | --- |
| toolbar | <code>Object</code> | Reference to the parent Toolbar instance |

<a name="ToolbarKeyboard+handleKeyboardShortcuts"></a>

### toolbarKeyboard.handleKeyboardShortcuts(e)
Handle keyboard shortcuts

**Kind**: instance method of [<code>ToolbarKeyboard</code>](#ToolbarKeyboard)  

| Param | Type | Description |
| --- | --- | --- |
| e | <code>KeyboardEvent</code> | The keyboard event |

<a name="ToolbarKeyboard+handleCtrlShortcuts"></a>

### toolbarKeyboard.handleCtrlShortcuts(e, key)
Handle Ctrl/Cmd shortcuts

**Kind**: instance method of [<code>ToolbarKeyboard</code>](#ToolbarKeyboard)  

| Param | Type | Description |
| --- | --- | --- |
| e | <code>KeyboardEvent</code> | The keyboard event |
| key | <code>string</code> | The lowercase key |

<a name="ToolbarKeyboard+handleToolShortcuts"></a>

### toolbarKeyboard.handleToolShortcuts(e, key)
Handle tool selection shortcuts (no modifier)

**Kind**: instance method of [<code>ToolbarKeyboard</code>](#ToolbarKeyboard)  

| Param | Type | Description |
| --- | --- | --- |
| e | <code>KeyboardEvent</code> | The keyboard event |
| key | <code>string</code> | The lowercase key |

<a name="ToolbarKeyboard+toggleSmartGuides"></a>

### toolbarKeyboard.toggleSmartGuides()
Toggle smart guides on/offUses CanvasManager's SmartGuidesController

**Kind**: instance method of [<code>ToolbarKeyboard</code>](#ToolbarKeyboard)  
<a name="ToolbarKeyboard+toggleBackgroundVisibility"></a>

### toolbarKeyboard.toggleBackgroundVisibility()
Toggle background visibilityUses LayerPanel if available, otherwise directly updates StateManager

**Kind**: instance method of [<code>ToolbarKeyboard</code>](#ToolbarKeyboard)  
<a name="ToolbarKeyboard+handleZoom"></a>

### toolbarKeyboard.handleZoom(action)
Handle zoom keyboard shortcuts

**Kind**: instance method of [<code>ToolbarKeyboard</code>](#ToolbarKeyboard)  

| Param | Type | Description |
| --- | --- | --- |
| action | <code>string</code> | 'in', 'out', or 'fit' |

<a name="ToolbarKeyboard+getShortcutsConfig"></a>

### toolbarKeyboard.getShortcutsConfig() ⇒ <code>Array.&lt;Object&gt;</code>
Get keyboard shortcuts configuration for documentation/help

**Kind**: instance method of [<code>ToolbarKeyboard</code>](#ToolbarKeyboard)  
**Returns**: <code>Array.&lt;Object&gt;</code> - Array of shortcut definitions  
<a name="ToolbarKeyboard+showKeyboardShortcutsHelp"></a>

### toolbarKeyboard.showKeyboardShortcutsHelp()
Show the keyboard shortcuts help dialogDelegates to DialogManager if available, falls back to editor method

**Kind**: instance method of [<code>ToolbarKeyboard</code>](#ToolbarKeyboard)  
<a name="ToolManager"></a>

## ToolManager
ToolManager class

**Kind**: global class  

* [ToolManager](#ToolManager)
    * [new ToolManager(config, canvasManager)](#new_ToolManager_new)
    * [._initializeModules()](#ToolManager+_initializeModules)
    * [.setTool(toolName)](#ToolManager+setTool)
    * [.getToolDisplayName(toolName)](#ToolManager+getToolDisplayName) ⇒ <code>string</code>
    * [.getCurrentTool()](#ToolManager+getCurrentTool) ⇒ <code>string</code>
    * [.initializeTool(toolName)](#ToolManager+initializeTool)
    * [.updateCursor()](#ToolManager+updateCursor)
    * [.getToolCursor(toolName)](#ToolManager+getToolCursor) ⇒ <code>string</code>
    * [.startTool(point)](#ToolManager+startTool)
    * [.updateTool(point)](#ToolManager+updateTool)
    * [.finishTool(point)](#ToolManager+finishTool)
    * [.startPenDrawing(point)](#ToolManager+startPenDrawing)
    * [.updatePenDrawing(point)](#ToolManager+updatePenDrawing)
    * [.finishPenDrawing(point)](#ToolManager+finishPenDrawing)
    * [.startRectangleTool(point)](#ToolManager+startRectangleTool)
    * [.startTextBoxTool(point)](#ToolManager+startTextBoxTool)
    * [.updateRectangleTool(point)](#ToolManager+updateRectangleTool)
    * [.startCircleTool(point)](#ToolManager+startCircleTool)
    * [.updateCircleTool(point)](#ToolManager+updateCircleTool)
    * [.startEllipseTool(point)](#ToolManager+startEllipseTool)
    * [.updateEllipseTool(point)](#ToolManager+updateEllipseTool)
    * [.startLineTool(point)](#ToolManager+startLineTool)
    * [.startArrowTool(point)](#ToolManager+startArrowTool)
    * [.updateLineTool(point)](#ToolManager+updateLineTool)
    * [.startTextTool(point)](#ToolManager+startTextTool)
    * [.handlePathPoint(point)](#ToolManager+handlePathPoint)
    * [.completePath()](#ToolManager+completePath)
    * [.startPolygonTool(point)](#ToolManager+startPolygonTool)
    * [.updatePolygonTool(point)](#ToolManager+updatePolygonTool)
    * [.startStarTool(point)](#ToolManager+startStarTool)
    * [.updateStarTool(point)](#ToolManager+updateStarTool)
    * [.startBlurTool(point)](#ToolManager+startBlurTool)
    * [.updateBlurTool(point)](#ToolManager+updateBlurTool)
    * [.finishShapeDrawing(point)](#ToolManager+finishShapeDrawing)
    * [.hasValidSize(layer)](#ToolManager+hasValidSize) ⇒ <code>boolean</code>
    * [.renderTempLayer()](#ToolManager+renderTempLayer)
    * [.renderPathPreview()](#ToolManager+renderPathPreview)
    * [.addLayerToCanvas(layer)](#ToolManager+addLayerToCanvas)
    * [.showTextEditor(point)](#ToolManager+showTextEditor)
    * [.hideTextEditor()](#ToolManager+hideTextEditor)
    * [.finishTextEditing(input, point)](#ToolManager+finishTextEditing)
    * [.getModifiers(event)](#ToolManager+getModifiers) ⇒ <code>Object</code>
    * [.finishCurrentDrawing()](#ToolManager+finishCurrentDrawing)
    * [.updateStyle(style)](#ToolManager+updateStyle)
    * [.getStyle()](#ToolManager+getStyle) ⇒ <code>Object</code>
    * [.generateLayerId()](#ToolManager+generateLayerId) ⇒ <code>string</code>
    * [.destroy()](#ToolManager+destroy)

<a name="new_ToolManager_new"></a>

### new ToolManager(config, canvasManager)

| Param | Type | Description |
| --- | --- | --- |
| config | <code>Object</code> | Configuration object |
| canvasManager | [<code>CanvasManager</code>](#CanvasManager) | Reference to the canvas manager |

<a name="ToolManager+_initializeModules"></a>

### toolManager.\_initializeModules()
Initialize extracted modules if available

**Kind**: instance method of [<code>ToolManager</code>](#ToolManager)  
<a name="ToolManager+setTool"></a>

### toolManager.setTool(toolName)
Set current tool

**Kind**: instance method of [<code>ToolManager</code>](#ToolManager)  

| Param | Type | Description |
| --- | --- | --- |
| toolName | <code>string</code> | Tool name |

<a name="ToolManager+getToolDisplayName"></a>

### toolManager.getToolDisplayName(toolName) ⇒ <code>string</code>
Get display name for a tool(for accessibility announcements)

**Kind**: instance method of [<code>ToolManager</code>](#ToolManager)  
**Returns**: <code>string</code> - Human-readable tool name  

| Param | Type | Description |
| --- | --- | --- |
| toolName | <code>string</code> | Tool name |

<a name="ToolManager+getCurrentTool"></a>

### toolManager.getCurrentTool() ⇒ <code>string</code>
Get current tool

**Kind**: instance method of [<code>ToolManager</code>](#ToolManager)  
**Returns**: <code>string</code> - Current tool name  
<a name="ToolManager+initializeTool"></a>

### toolManager.initializeTool(toolName)
Initialize tool-specific state

**Kind**: instance method of [<code>ToolManager</code>](#ToolManager)  

| Param | Type | Description |
| --- | --- | --- |
| toolName | <code>string</code> | Tool name |

<a name="ToolManager+updateCursor"></a>

### toolManager.updateCursor()
Update cursor based on current tool

**Kind**: instance method of [<code>ToolManager</code>](#ToolManager)  
<a name="ToolManager+getToolCursor"></a>

### toolManager.getToolCursor(toolName) ⇒ <code>string</code>
Get cursor for tool

**Kind**: instance method of [<code>ToolManager</code>](#ToolManager)  
**Returns**: <code>string</code> - CSS cursor value  

| Param | Type | Description |
| --- | --- | --- |
| toolName | <code>string</code> | Tool name |

<a name="ToolManager+startTool"></a>

### toolManager.startTool(point)
Handle tool start(mouse down)

**Kind**: instance method of [<code>ToolManager</code>](#ToolManager)  

| Param | Type | Description |
| --- | --- | --- |
| point | <code>Object</code> | Starting point |

<a name="ToolManager+updateTool"></a>

### toolManager.updateTool(point)
Handle tool update(mouse move)

**Kind**: instance method of [<code>ToolManager</code>](#ToolManager)  

| Param | Type | Description |
| --- | --- | --- |
| point | <code>Object</code> | Current point |

<a name="ToolManager+finishTool"></a>

### toolManager.finishTool(point)
Handle tool finish(mouse up)

**Kind**: instance method of [<code>ToolManager</code>](#ToolManager)  

| Param | Type | Description |
| --- | --- | --- |
| point | <code>Object</code> | End point |

<a name="ToolManager+startPenDrawing"></a>

### toolManager.startPenDrawing(point)
Start pen drawing

**Kind**: instance method of [<code>ToolManager</code>](#ToolManager)  

| Param | Type | Description |
| --- | --- | --- |
| point | <code>Object</code> | Starting point |

<a name="ToolManager+updatePenDrawing"></a>

### toolManager.updatePenDrawing(point)
Update pen drawing

**Kind**: instance method of [<code>ToolManager</code>](#ToolManager)  

| Param | Type | Description |
| --- | --- | --- |
| point | <code>Object</code> | Current point |

<a name="ToolManager+finishPenDrawing"></a>

### toolManager.finishPenDrawing(point)
Finish pen drawing

**Kind**: instance method of [<code>ToolManager</code>](#ToolManager)  

| Param | Type | Description |
| --- | --- | --- |
| point | <code>Object</code> | End point(unused) |

<a name="ToolManager+startRectangleTool"></a>

### toolManager.startRectangleTool(point)
Start rectangle tool

**Kind**: instance method of [<code>ToolManager</code>](#ToolManager)  

| Param | Type | Description |
| --- | --- | --- |
| point | <code>Object</code> | Starting point |

<a name="ToolManager+startTextBoxTool"></a>

### toolManager.startTextBoxTool(point)
Start text box tool

**Kind**: instance method of [<code>ToolManager</code>](#ToolManager)  

| Param | Type | Description |
| --- | --- | --- |
| point | <code>Object</code> | Starting point |

<a name="ToolManager+updateRectangleTool"></a>

### toolManager.updateRectangleTool(point)
Update rectangle tool

**Kind**: instance method of [<code>ToolManager</code>](#ToolManager)  

| Param | Type | Description |
| --- | --- | --- |
| point | <code>Object</code> | Current point |

<a name="ToolManager+startCircleTool"></a>

### toolManager.startCircleTool(point)
Start circle tool

**Kind**: instance method of [<code>ToolManager</code>](#ToolManager)  

| Param | Type | Description |
| --- | --- | --- |
| point | <code>Object</code> | Starting point |

<a name="ToolManager+updateCircleTool"></a>

### toolManager.updateCircleTool(point)
Update circle tool

**Kind**: instance method of [<code>ToolManager</code>](#ToolManager)  

| Param | Type | Description |
| --- | --- | --- |
| point | <code>Object</code> | Current point |

<a name="ToolManager+startEllipseTool"></a>

### toolManager.startEllipseTool(point)
Start ellipse tool

**Kind**: instance method of [<code>ToolManager</code>](#ToolManager)  

| Param | Type | Description |
| --- | --- | --- |
| point | <code>Object</code> | Starting point |

<a name="ToolManager+updateEllipseTool"></a>

### toolManager.updateEllipseTool(point)
Update ellipse tool

**Kind**: instance method of [<code>ToolManager</code>](#ToolManager)  

| Param | Type | Description |
| --- | --- | --- |
| point | <code>Object</code> | Current point |

<a name="ToolManager+startLineTool"></a>

### toolManager.startLineTool(point)
Start line tool

**Kind**: instance method of [<code>ToolManager</code>](#ToolManager)  

| Param | Type | Description |
| --- | --- | --- |
| point | <code>Object</code> | Starting point |

<a name="ToolManager+startArrowTool"></a>

### toolManager.startArrowTool(point)
Start arrow tool

**Kind**: instance method of [<code>ToolManager</code>](#ToolManager)  

| Param | Type | Description |
| --- | --- | --- |
| point | <code>Object</code> | Starting point |

<a name="ToolManager+updateLineTool"></a>

### toolManager.updateLineTool(point)
Update line/arrow tool

**Kind**: instance method of [<code>ToolManager</code>](#ToolManager)  

| Param | Type | Description |
| --- | --- | --- |
| point | <code>Object</code> | Current point |

<a name="ToolManager+startTextTool"></a>

### toolManager.startTextTool(point)
Start text tool

**Kind**: instance method of [<code>ToolManager</code>](#ToolManager)  

| Param | Type | Description |
| --- | --- | --- |
| point | <code>Object</code> | Click point |

<a name="ToolManager+handlePathPoint"></a>

### toolManager.handlePathPoint(point)
Handle path point

**Kind**: instance method of [<code>ToolManager</code>](#ToolManager)  

| Param | Type | Description |
| --- | --- | --- |
| point | <code>Object</code> | Current point |

<a name="ToolManager+completePath"></a>

### toolManager.completePath()
Complete path drawing

**Kind**: instance method of [<code>ToolManager</code>](#ToolManager)  
<a name="ToolManager+startPolygonTool"></a>

### toolManager.startPolygonTool(point)
Start polygon tool

**Kind**: instance method of [<code>ToolManager</code>](#ToolManager)  

| Param | Type | Description |
| --- | --- | --- |
| point | <code>Object</code> | Starting point |

<a name="ToolManager+updatePolygonTool"></a>

### toolManager.updatePolygonTool(point)
Update polygon tool

**Kind**: instance method of [<code>ToolManager</code>](#ToolManager)  

| Param | Type | Description |
| --- | --- | --- |
| point | <code>Object</code> | Current point |

<a name="ToolManager+startStarTool"></a>

### toolManager.startStarTool(point)
Start star tool

**Kind**: instance method of [<code>ToolManager</code>](#ToolManager)  

| Param | Type | Description |
| --- | --- | --- |
| point | <code>Object</code> | Starting point |

<a name="ToolManager+updateStarTool"></a>

### toolManager.updateStarTool(point)
Update star tool

**Kind**: instance method of [<code>ToolManager</code>](#ToolManager)  

| Param | Type | Description |
| --- | --- | --- |
| point | <code>Object</code> | Current point |

<a name="ToolManager+startBlurTool"></a>

### toolManager.startBlurTool(point)
Start blur tool

**Kind**: instance method of [<code>ToolManager</code>](#ToolManager)  

| Param | Type | Description |
| --- | --- | --- |
| point | <code>Object</code> | Starting point |

<a name="ToolManager+updateBlurTool"></a>

### toolManager.updateBlurTool(point)
Update blur tool

**Kind**: instance method of [<code>ToolManager</code>](#ToolManager)  

| Param | Type | Description |
| --- | --- | --- |
| point | <code>Object</code> | Current point |

<a name="ToolManager+finishShapeDrawing"></a>

### toolManager.finishShapeDrawing(point)
Finish shape drawing

**Kind**: instance method of [<code>ToolManager</code>](#ToolManager)  

| Param | Type | Description |
| --- | --- | --- |
| point | <code>Object</code> | End point(unused) |

<a name="ToolManager+hasValidSize"></a>

### toolManager.hasValidSize(layer) ⇒ <code>boolean</code>
Check if layer has valid size

**Kind**: instance method of [<code>ToolManager</code>](#ToolManager)  
**Returns**: <code>boolean</code> - True if layer has valid size  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer to check |

<a name="ToolManager+renderTempLayer"></a>

### toolManager.renderTempLayer()
Render temporary layer

**Kind**: instance method of [<code>ToolManager</code>](#ToolManager)  
<a name="ToolManager+renderPathPreview"></a>

### toolManager.renderPathPreview()
Render path preview

**Kind**: instance method of [<code>ToolManager</code>](#ToolManager)  
<a name="ToolManager+addLayerToCanvas"></a>

### toolManager.addLayerToCanvas(layer)
Add layer to canvas

**Kind**: instance method of [<code>ToolManager</code>](#ToolManager)  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer to add |

<a name="ToolManager+showTextEditor"></a>

### toolManager.showTextEditor(point)
Show text editor

**Kind**: instance method of [<code>ToolManager</code>](#ToolManager)  

| Param | Type | Description |
| --- | --- | --- |
| point | <code>Object</code> | Position to show editor |

<a name="ToolManager+hideTextEditor"></a>

### toolManager.hideTextEditor()
Hide text editor

**Kind**: instance method of [<code>ToolManager</code>](#ToolManager)  
<a name="ToolManager+finishTextEditing"></a>

### toolManager.finishTextEditing(input, point)
Finish text editing

**Kind**: instance method of [<code>ToolManager</code>](#ToolManager)  

| Param | Type | Description |
| --- | --- | --- |
| input | <code>HTMLElement</code> | Input element |
| point | <code>Object</code> | Position point |

<a name="ToolManager+getModifiers"></a>

### toolManager.getModifiers(event) ⇒ <code>Object</code>
Get modifier keys from event

**Kind**: instance method of [<code>ToolManager</code>](#ToolManager)  
**Returns**: <code>Object</code> - Modifier keys state  

| Param | Type | Description |
| --- | --- | --- |
| event | <code>Event</code> | Event object |

<a name="ToolManager+finishCurrentDrawing"></a>

### toolManager.finishCurrentDrawing()
Finish current drawing operation

**Kind**: instance method of [<code>ToolManager</code>](#ToolManager)  
<a name="ToolManager+updateStyle"></a>

### toolManager.updateStyle(style)
Update tool style

**Kind**: instance method of [<code>ToolManager</code>](#ToolManager)  

| Param | Type | Description |
| --- | --- | --- |
| style | <code>Object</code> | Style object |

<a name="ToolManager+getStyle"></a>

### toolManager.getStyle() ⇒ <code>Object</code>
Get current style

**Kind**: instance method of [<code>ToolManager</code>](#ToolManager)  
**Returns**: <code>Object</code> - Current style object  
<a name="ToolManager+generateLayerId"></a>

### toolManager.generateLayerId() ⇒ <code>string</code>
Generate unique layer ID

**Kind**: instance method of [<code>ToolManager</code>](#ToolManager)  
**Returns**: <code>string</code> - Unique layer ID  
<a name="ToolManager+destroy"></a>

### toolManager.destroy()
Clean up resources and clear state

**Kind**: instance method of [<code>ToolManager</code>](#ToolManager)  
<a name="TransformationEngine"></a>

## TransformationEngine
TransformationEngine - Manages canvas transformations and viewport

**Kind**: global class  

* [TransformationEngine](#TransformationEngine)
    * [new TransformationEngine(canvas, config)](#new_TransformationEngine_new)
    * [.init()](#TransformationEngine+init)
    * [.setZoom(newZoom)](#TransformationEngine+setZoom)
    * [.setZoomDirect(newZoom)](#TransformationEngine+setZoomDirect)
    * [.getZoom()](#TransformationEngine+getZoom) ⇒ <code>number</code>
    * [.zoomIn()](#TransformationEngine+zoomIn)
    * [.zoomOut()](#TransformationEngine+zoomOut)
    * [.resetZoom()](#TransformationEngine+resetZoom)
    * [.zoomBy(delta, anchor)](#TransformationEngine+zoomBy)
    * [.panByPixels(deltaX, deltaY)](#TransformationEngine+panByPixels)
    * [.getPan()](#TransformationEngine+getPan) ⇒ <code>Object</code>
    * [.setPan(newPanX, newPanY)](#TransformationEngine+setPan)
    * [.startPan(startX, startY)](#TransformationEngine+startPan)
    * [.updatePan(currentX, currentY)](#TransformationEngine+updatePan)
    * [.stopPan()](#TransformationEngine+stopPan)
    * [.isPanningActive()](#TransformationEngine+isPanningActive) ⇒ <code>boolean</code>
    * [.smoothZoomTo(targetZoom, duration)](#TransformationEngine+smoothZoomTo)
    * [.animateZoom()](#TransformationEngine+animateZoom)
    * [.updateCanvasTransform()](#TransformationEngine+updateCanvasTransform)
    * [.updateViewportBounds()](#TransformationEngine+updateViewportBounds)
    * [.getViewportBounds()](#TransformationEngine+getViewportBounds) ⇒ <code>Object</code>
    * [.fitToWindow(backgroundImage)](#TransformationEngine+fitToWindow)
    * [.zoomToFitBounds(bounds, padding)](#TransformationEngine+zoomToFitBounds)
    * [.clientToCanvas(clientX, clientY)](#TransformationEngine+clientToCanvas) ⇒ <code>Object</code>
    * [.canvasToClient(canvasX, canvasY)](#TransformationEngine+canvasToClient) ⇒ <code>Object</code>
    * [.getRawCoordinates(event)](#TransformationEngine+getRawCoordinates) ⇒ <code>Object</code>
    * [.setSnapToGrid(enabled)](#TransformationEngine+setSnapToGrid)
    * [.setGridSize(size)](#TransformationEngine+setGridSize)
    * [.isAnimating()](#TransformationEngine+isAnimating) ⇒ <code>boolean</code>
    * [.setZoomLimits(min, max)](#TransformationEngine+setZoomLimits)
    * [.getZoomLimits()](#TransformationEngine+getZoomLimits) ⇒ <code>Object</code>
    * [.updateConfig(newConfig)](#TransformationEngine+updateConfig)
    * [.destroy()](#TransformationEngine+destroy)

<a name="new_TransformationEngine_new"></a>

### new TransformationEngine(canvas, config)

| Param | Type | Description |
| --- | --- | --- |
| canvas | <code>HTMLCanvasElement</code> | Canvas element to transform |
| config | <code>Object</code> | Configuration options |

<a name="TransformationEngine+init"></a>

### transformationEngine.init()
Initialize the transformation engine

**Kind**: instance method of [<code>TransformationEngine</code>](#TransformationEngine)  
<a name="TransformationEngine+setZoom"></a>

### transformationEngine.setZoom(newZoom)
Set zoom level with clamping and status update

**Kind**: instance method of [<code>TransformationEngine</code>](#TransformationEngine)  

| Param | Type | Description |
| --- | --- | --- |
| newZoom | <code>number</code> | New zoom level |

<a name="TransformationEngine+setZoomDirect"></a>

### transformationEngine.setZoomDirect(newZoom)
Set zoom directly without triggering user zoom flag (for animations)

**Kind**: instance method of [<code>TransformationEngine</code>](#TransformationEngine)  

| Param | Type | Description |
| --- | --- | --- |
| newZoom | <code>number</code> | New zoom level |

<a name="TransformationEngine+getZoom"></a>

### transformationEngine.getZoom() ⇒ <code>number</code>
Get current zoom level

**Kind**: instance method of [<code>TransformationEngine</code>](#TransformationEngine)  
**Returns**: <code>number</code> - Current zoom level  
<a name="TransformationEngine+zoomIn"></a>

### transformationEngine.zoomIn()
Zoom in by increment

**Kind**: instance method of [<code>TransformationEngine</code>](#TransformationEngine)  
<a name="TransformationEngine+zoomOut"></a>

### transformationEngine.zoomOut()
Zoom out by increment

**Kind**: instance method of [<code>TransformationEngine</code>](#TransformationEngine)  
<a name="TransformationEngine+resetZoom"></a>

### transformationEngine.resetZoom()
Reset zoom and pan to defaults

**Kind**: instance method of [<code>TransformationEngine</code>](#TransformationEngine)  
<a name="TransformationEngine+zoomBy"></a>

### transformationEngine.zoomBy(delta, anchor)
Zoom by delta amount at anchor point

**Kind**: instance method of [<code>TransformationEngine</code>](#TransformationEngine)  

| Param | Type | Description |
| --- | --- | --- |
| delta | <code>number</code> | Zoom delta amount |
| anchor | <code>Object</code> | Anchor point {x, y} |

<a name="TransformationEngine+panByPixels"></a>

### transformationEngine.panByPixels(deltaX, deltaY)
Pan by pixel amounts (for keyboard navigation)

**Kind**: instance method of [<code>TransformationEngine</code>](#TransformationEngine)  

| Param | Type | Description |
| --- | --- | --- |
| deltaX | <code>number</code> | X pan amount in pixels |
| deltaY | <code>number</code> | Y pan amount in pixels |

<a name="TransformationEngine+getPan"></a>

### transformationEngine.getPan() ⇒ <code>Object</code>
Get current pan position

**Kind**: instance method of [<code>TransformationEngine</code>](#TransformationEngine)  
**Returns**: <code>Object</code> - Pan position {x, y}  
<a name="TransformationEngine+setPan"></a>

### transformationEngine.setPan(newPanX, newPanY)
Set pan position directly

**Kind**: instance method of [<code>TransformationEngine</code>](#TransformationEngine)  

| Param | Type | Description |
| --- | --- | --- |
| newPanX | <code>number</code> | New X pan position |
| newPanY | <code>number</code> | New Y pan position |

<a name="TransformationEngine+startPan"></a>

### transformationEngine.startPan(startX, startY)
Start panning operation

**Kind**: instance method of [<code>TransformationEngine</code>](#TransformationEngine)  

| Param | Type | Description |
| --- | --- | --- |
| startX | <code>number</code> | Starting X coordinate |
| startY | <code>number</code> | Starting Y coordinate |

<a name="TransformationEngine+updatePan"></a>

### transformationEngine.updatePan(currentX, currentY)
Update pan position during drag

**Kind**: instance method of [<code>TransformationEngine</code>](#TransformationEngine)  

| Param | Type | Description |
| --- | --- | --- |
| currentX | <code>number</code> | Current X coordinate |
| currentY | <code>number</code> | Current Y coordinate |

<a name="TransformationEngine+stopPan"></a>

### transformationEngine.stopPan()
Stop panning operation

**Kind**: instance method of [<code>TransformationEngine</code>](#TransformationEngine)  
<a name="TransformationEngine+isPanningActive"></a>

### transformationEngine.isPanningActive() ⇒ <code>boolean</code>
Check if currently panning

**Kind**: instance method of [<code>TransformationEngine</code>](#TransformationEngine)  
**Returns**: <code>boolean</code> - True if panning  
<a name="TransformationEngine+smoothZoomTo"></a>

### transformationEngine.smoothZoomTo(targetZoom, duration)
Smoothly animate zoom to target level

**Kind**: instance method of [<code>TransformationEngine</code>](#TransformationEngine)  

| Param | Type | Description |
| --- | --- | --- |
| targetZoom | <code>number</code> | Target zoom level |
| duration | <code>number</code> | Animation duration in milliseconds (optional) |

<a name="TransformationEngine+animateZoom"></a>

### transformationEngine.animateZoom()
Animation frame function for smooth zooming

**Kind**: instance method of [<code>TransformationEngine</code>](#TransformationEngine)  
<a name="TransformationEngine+updateCanvasTransform"></a>

### transformationEngine.updateCanvasTransform()
Update the canvas CSS transform from current pan/zoom stateDEPRECATED: Using canvas context transforms only to avoid coordinate confusion

**Kind**: instance method of [<code>TransformationEngine</code>](#TransformationEngine)  
<a name="TransformationEngine+updateViewportBounds"></a>

### transformationEngine.updateViewportBounds()
Update viewport bounds for culling calculations

**Kind**: instance method of [<code>TransformationEngine</code>](#TransformationEngine)  
<a name="TransformationEngine+getViewportBounds"></a>

### transformationEngine.getViewportBounds() ⇒ <code>Object</code>
Get current viewport bounds

**Kind**: instance method of [<code>TransformationEngine</code>](#TransformationEngine)  
**Returns**: <code>Object</code> - Viewport bounds {x, y, width, height}  
<a name="TransformationEngine+fitToWindow"></a>

### transformationEngine.fitToWindow(backgroundImage)
Fit canvas to window dimensions

**Kind**: instance method of [<code>TransformationEngine</code>](#TransformationEngine)  

| Param | Type | Description |
| --- | --- | --- |
| backgroundImage | <code>Object</code> | Background image for size reference |

<a name="TransformationEngine+zoomToFitBounds"></a>

### transformationEngine.zoomToFitBounds(bounds, padding)
Zoom to fit specified bounds

**Kind**: instance method of [<code>TransformationEngine</code>](#TransformationEngine)  

| Param | Type | Description |
| --- | --- | --- |
| bounds | <code>Object</code> | Bounds to fit {left, top, right, bottom} |
| padding | <code>number</code> | Padding around content (optional) |

<a name="TransformationEngine+clientToCanvas"></a>

### transformationEngine.clientToCanvas(clientX, clientY) ⇒ <code>Object</code>
Convert client coordinates to canvas coordinates

**Kind**: instance method of [<code>TransformationEngine</code>](#TransformationEngine)  
**Returns**: <code>Object</code> - Canvas coordinates {x, y}  

| Param | Type | Description |
| --- | --- | --- |
| clientX | <code>number</code> | Client X coordinate |
| clientY | <code>number</code> | Client Y coordinate |

<a name="TransformationEngine+canvasToClient"></a>

### transformationEngine.canvasToClient(canvasX, canvasY) ⇒ <code>Object</code>
Convert canvas coordinates to client coordinates

**Kind**: instance method of [<code>TransformationEngine</code>](#TransformationEngine)  
**Returns**: <code>Object</code> - Client coordinates {x, y}  

| Param | Type | Description |
| --- | --- | --- |
| canvasX | <code>number</code> | Canvas X coordinate |
| canvasY | <code>number</code> | Canvas Y coordinate |

<a name="TransformationEngine+getRawCoordinates"></a>

### transformationEngine.getRawCoordinates(event) ⇒ <code>Object</code>
Get raw coordinates without snapping (for precise operations)

**Kind**: instance method of [<code>TransformationEngine</code>](#TransformationEngine)  
**Returns**: <code>Object</code> - Raw canvas coordinates {canvasX, canvasY}  

| Param | Type | Description |
| --- | --- | --- |
| event | <code>MouseEvent</code> | Mouse event |

<a name="TransformationEngine+setSnapToGrid"></a>

### transformationEngine.setSnapToGrid(enabled)
Enable or disable grid snapping

**Kind**: instance method of [<code>TransformationEngine</code>](#TransformationEngine)  

| Param | Type | Description |
| --- | --- | --- |
| enabled | <code>boolean</code> | Whether to enable grid snapping |

<a name="TransformationEngine+setGridSize"></a>

### transformationEngine.setGridSize(size)
Set grid size for snapping

**Kind**: instance method of [<code>TransformationEngine</code>](#TransformationEngine)  

| Param | Type | Description |
| --- | --- | --- |
| size | <code>number</code> | Grid size in pixels |

<a name="TransformationEngine+isAnimating"></a>

### transformationEngine.isAnimating() ⇒ <code>boolean</code>
Check if animation is currently running

**Kind**: instance method of [<code>TransformationEngine</code>](#TransformationEngine)  
**Returns**: <code>boolean</code> - True if animating  
<a name="TransformationEngine+setZoomLimits"></a>

### transformationEngine.setZoomLimits(min, max)
Set zoom limits

**Kind**: instance method of [<code>TransformationEngine</code>](#TransformationEngine)  

| Param | Type | Description |
| --- | --- | --- |
| min | <code>number</code> | Minimum zoom level |
| max | <code>number</code> | Maximum zoom level |

<a name="TransformationEngine+getZoomLimits"></a>

### transformationEngine.getZoomLimits() ⇒ <code>Object</code>
Get current zoom limits

**Kind**: instance method of [<code>TransformationEngine</code>](#TransformationEngine)  
**Returns**: <code>Object</code> - Zoom limits {min, max}  
<a name="TransformationEngine+updateConfig"></a>

### transformationEngine.updateConfig(newConfig)
Update configuration options

**Kind**: instance method of [<code>TransformationEngine</code>](#TransformationEngine)  

| Param | Type | Description |
| --- | --- | --- |
| newConfig | <code>Object</code> | New configuration options |

<a name="TransformationEngine+destroy"></a>

### transformationEngine.destroy()
Clean up resources

**Kind**: instance method of [<code>TransformationEngine</code>](#TransformationEngine)  
<a name="ValidationManager"></a>

## ValidationManager
Validation Manager for Layers EditorHandles data validation and sanitization

**Kind**: global class  

* [ValidationManager](#ValidationManager)
    * [.sanitizeLayerData()](#ValidationManager+sanitizeLayerData)
    * [.sanitizeString()](#ValidationManager+sanitizeString)
    * [.sanitizeInput()](#ValidationManager+sanitizeInput)
    * [.validateLayer()](#ValidationManager+validateLayer)
    * [.validateLayers()](#ValidationManager+validateLayers)
    * [.checkBrowserCompatibility()](#ValidationManager+checkBrowserCompatibility)
    * [.sanitizeLogMessage()](#ValidationManager+sanitizeLogMessage)
    * [.destroy()](#ValidationManager+destroy)

<a name="ValidationManager+sanitizeLayerData"></a>

### validationManager.sanitizeLayerData()
Sanitize layer data before processing

**Kind**: instance method of [<code>ValidationManager</code>](#ValidationManager)  
<a name="ValidationManager+sanitizeString"></a>

### validationManager.sanitizeString()
Sanitize string input

**Kind**: instance method of [<code>ValidationManager</code>](#ValidationManager)  
<a name="ValidationManager+sanitizeInput"></a>

### validationManager.sanitizeInput()
Sanitize input for general use

**Kind**: instance method of [<code>ValidationManager</code>](#ValidationManager)  
<a name="ValidationManager+validateLayer"></a>

### validationManager.validateLayer()
Validate layer data structure

**Kind**: instance method of [<code>ValidationManager</code>](#ValidationManager)  
<a name="ValidationManager+validateLayers"></a>

### validationManager.validateLayers()
Validate all layers

**Kind**: instance method of [<code>ValidationManager</code>](#ValidationManager)  
<a name="ValidationManager+checkBrowserCompatibility"></a>

### validationManager.checkBrowserCompatibility()
Check browser compatibility

**Kind**: instance method of [<code>ValidationManager</code>](#ValidationManager)  
<a name="ValidationManager+sanitizeLogMessage"></a>

### validationManager.sanitizeLogMessage()
Sanitize log messages for security

**Kind**: instance method of [<code>ValidationManager</code>](#ValidationManager)  
<a name="ValidationManager+destroy"></a>

### validationManager.destroy()
Clean up resources

**Kind**: instance method of [<code>ValidationManager</code>](#ValidationManager)  
<a name="PolygonGeometry"></a>

## PolygonGeometry
Static utility class for polygon and star geometry calculations

**Kind**: global class  

* [PolygonGeometry](#PolygonGeometry)
    * [.getPolygonVertices(x, y, radius, sides)](#PolygonGeometry.getPolygonVertices) ⇒ <code>Array.&lt;{x: number, y: number}&gt;</code>
    * [.getStarVertices(x, y, outerRadius, innerRadius, numPoints)](#PolygonGeometry.getStarVertices) ⇒ <code>Array.&lt;{x: number, y: number}&gt;</code>
    * [.drawPath(ctx, vertices, [close])](#PolygonGeometry.drawPath)
    * [.drawPolygonPath(ctx, x, y, radius, sides, [cornerRadius])](#PolygonGeometry.drawPolygonPath)
    * [.drawRoundedPath(ctx, vertices, cornerRadius)](#PolygonGeometry.drawRoundedPath)
    * [.drawStarPath(ctx, x, y, outerRadius, innerRadius, numPoints, [pointRadius], [valleyRadius])](#PolygonGeometry.drawStarPath)
    * [.drawRoundedStarPath(ctx, vertices, pointRadius, valleyRadius)](#PolygonGeometry.drawRoundedStarPath)
    * [.getPolygonBounds(x, y, radius, sides)](#PolygonGeometry.getPolygonBounds) ⇒ <code>Object</code>
    * [.getStarBounds(x, y, outerRadius, innerRadius, numPoints)](#PolygonGeometry.getStarBounds) ⇒ <code>Object</code>
    * [.getBoundsFromVertices(vertices)](#PolygonGeometry.getBoundsFromVertices) ⇒ <code>Object</code>
    * [.isPointInPolygon(px, py, vertices)](#PolygonGeometry.isPointInPolygon) ⇒ <code>boolean</code>

<a name="PolygonGeometry.getPolygonVertices"></a>

### PolygonGeometry.getPolygonVertices(x, y, radius, sides) ⇒ <code>Array.&lt;{x: number, y: number}&gt;</code>
Generate vertices for a regular polygon

**Kind**: static method of [<code>PolygonGeometry</code>](#PolygonGeometry)  
**Returns**: <code>Array.&lt;{x: number, y: number}&gt;</code> - Array of vertex points  

| Param | Type | Description |
| --- | --- | --- |
| x | <code>number</code> | Center X coordinate |
| y | <code>number</code> | Center Y coordinate |
| radius | <code>number</code> | Radius of the polygon |
| sides | <code>number</code> | Number of sides (minimum 3) |

<a name="PolygonGeometry.getStarVertices"></a>

### PolygonGeometry.getStarVertices(x, y, outerRadius, innerRadius, numPoints) ⇒ <code>Array.&lt;{x: number, y: number}&gt;</code>
Generate vertices for a star shape

**Kind**: static method of [<code>PolygonGeometry</code>](#PolygonGeometry)  
**Returns**: <code>Array.&lt;{x: number, y: number}&gt;</code> - Array of vertex points (2 * numPoints)  

| Param | Type | Description |
| --- | --- | --- |
| x | <code>number</code> | Center X coordinate |
| y | <code>number</code> | Center Y coordinate |
| outerRadius | <code>number</code> | Outer radius of the star points |
| innerRadius | <code>number</code> | Inner radius (valley between points) |
| numPoints | <code>number</code> | Number of star points (minimum 3) |

<a name="PolygonGeometry.drawPath"></a>

### PolygonGeometry.drawPath(ctx, vertices, [close])
Draw a polygon path on a canvas context from vertices

**Kind**: static method of [<code>PolygonGeometry</code>](#PolygonGeometry)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| ctx | <code>CanvasRenderingContext2D</code> |  | Canvas 2D context |
| vertices | <code>Array.&lt;{x: number, y: number}&gt;</code> |  | Array of vertex points |
| [close] | <code>boolean</code> | <code>true</code> | Whether to close the path |

<a name="PolygonGeometry.drawPolygonPath"></a>

### PolygonGeometry.drawPolygonPath(ctx, x, y, radius, sides, [cornerRadius])
Draw a polygon path directly from parameters

**Kind**: static method of [<code>PolygonGeometry</code>](#PolygonGeometry)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| ctx | <code>CanvasRenderingContext2D</code> |  | Canvas 2D context |
| x | <code>number</code> |  | Center X coordinate |
| y | <code>number</code> |  | Center Y coordinate |
| radius | <code>number</code> |  | Radius of the polygon |
| sides | <code>number</code> |  | Number of sides |
| [cornerRadius] | <code>number</code> | <code>0</code> | Corner radius for rounded corners |

<a name="PolygonGeometry.drawRoundedPath"></a>

### PolygonGeometry.drawRoundedPath(ctx, vertices, cornerRadius)
Draw a path with rounded corners using arcTo

**Kind**: static method of [<code>PolygonGeometry</code>](#PolygonGeometry)  

| Param | Type | Description |
| --- | --- | --- |
| ctx | <code>CanvasRenderingContext2D</code> | Canvas 2D context |
| vertices | <code>Array.&lt;{x: number, y: number}&gt;</code> | Array of vertex points |
| cornerRadius | <code>number</code> | Radius for rounded corners |

<a name="PolygonGeometry.drawStarPath"></a>

### PolygonGeometry.drawStarPath(ctx, x, y, outerRadius, innerRadius, numPoints, [pointRadius], [valleyRadius])
Draw a star path directly from parameters

**Kind**: static method of [<code>PolygonGeometry</code>](#PolygonGeometry)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| ctx | <code>CanvasRenderingContext2D</code> |  | Canvas 2D context |
| x | <code>number</code> |  | Center X coordinate |
| y | <code>number</code> |  | Center Y coordinate |
| outerRadius | <code>number</code> |  | Outer radius |
| innerRadius | <code>number</code> |  | Inner radius |
| numPoints | <code>number</code> |  | Number of points |
| [pointRadius] | <code>number</code> | <code>0</code> | Corner radius at star points (outer tips) |
| [valleyRadius] | <code>number</code> | <code>0</code> | Corner radius at star valleys (inner corners) |

<a name="PolygonGeometry.drawRoundedStarPath"></a>

### PolygonGeometry.drawRoundedStarPath(ctx, vertices, pointRadius, valleyRadius)
Draw a path with rounded corners for stars, with different radii for points and valleys

**Kind**: static method of [<code>PolygonGeometry</code>](#PolygonGeometry)  

| Param | Type | Description |
| --- | --- | --- |
| ctx | <code>CanvasRenderingContext2D</code> | Canvas 2D context |
| vertices | <code>Array.&lt;{x: number, y: number}&gt;</code> | Array of vertex points (alternating outer/inner) |
| pointRadius | <code>number</code> | Radius for outer point corners |
| valleyRadius | <code>number</code> | Radius for inner valley corners |

<a name="PolygonGeometry.getPolygonBounds"></a>

### PolygonGeometry.getPolygonBounds(x, y, radius, sides) ⇒ <code>Object</code>
Calculate the bounding box of a polygon

**Kind**: static method of [<code>PolygonGeometry</code>](#PolygonGeometry)  
**Returns**: <code>Object</code> - Bounding box  

| Param | Type | Description |
| --- | --- | --- |
| x | <code>number</code> | Center X coordinate |
| y | <code>number</code> | Center Y coordinate |
| radius | <code>number</code> | Radius of the polygon |
| sides | <code>number</code> | Number of sides |

<a name="PolygonGeometry.getStarBounds"></a>

### PolygonGeometry.getStarBounds(x, y, outerRadius, innerRadius, numPoints) ⇒ <code>Object</code>
Calculate the bounding box of a star

**Kind**: static method of [<code>PolygonGeometry</code>](#PolygonGeometry)  
**Returns**: <code>Object</code> - Bounding box  

| Param | Type | Description |
| --- | --- | --- |
| x | <code>number</code> | Center X coordinate |
| y | <code>number</code> | Center Y coordinate |
| outerRadius | <code>number</code> | Outer radius |
| innerRadius | <code>number</code> | Inner radius |
| numPoints | <code>number</code> | Number of points |

<a name="PolygonGeometry.getBoundsFromVertices"></a>

### PolygonGeometry.getBoundsFromVertices(vertices) ⇒ <code>Object</code>
Calculate bounding box from an array of vertices

**Kind**: static method of [<code>PolygonGeometry</code>](#PolygonGeometry)  
**Returns**: <code>Object</code> - Bounding box  

| Param | Type | Description |
| --- | --- | --- |
| vertices | <code>Array.&lt;{x: number, y: number}&gt;</code> | Array of vertex points |

<a name="PolygonGeometry.isPointInPolygon"></a>

### PolygonGeometry.isPointInPolygon(px, py, vertices) ⇒ <code>boolean</code>
Check if a point is inside a polygon using ray casting algorithm

**Kind**: static method of [<code>PolygonGeometry</code>](#PolygonGeometry)  
**Returns**: <code>boolean</code> - True if point is inside the polygon  

| Param | Type | Description |
| --- | --- | --- |
| px | <code>number</code> | Point X coordinate |
| py | <code>number</code> | Point Y coordinate |
| vertices | <code>Array.&lt;{x: number, y: number}&gt;</code> | Polygon vertices |

<a name="CanvasManager"></a>

## CanvasManager : <code>Object</code>
Minimal typedef for CanvasManager used for JSDoc references in this file.

**Kind**: global typedef  
**Properties**

| Name | Type |
| --- | --- |
| canvas | <code>HTMLCanvasElement</code> | 
| ctx | <code>CanvasRenderingContext2D</code> | 


* [CanvasManager](#CanvasManager) : <code>Object</code>
    * [new CanvasManager(config)](#new_CanvasManager_new)
    * [.setupEventHandlers()](#CanvasManager+setupEventHandlers)
    * [.getSelectedLayerIds()](#CanvasManager+getSelectedLayerIds) ⇒ <code>Array</code>
    * [.getSelectedLayerId()](#CanvasManager+getSelectedLayerId) ⇒ <code>string</code> \| <code>null</code>
    * [.setSelectedLayerIds(ids)](#CanvasManager+setSelectedLayerIds)
    * [.subscribeToState()](#CanvasManager+subscribeToState)
    * [.notifyToolbarOfSelection(selectedIds)](#CanvasManager+notifyToolbarOfSelection)
    * [.loadBackgroundImage()](#CanvasManager+loadBackgroundImage)
    * [.handleImageLoaded(image, info)](#CanvasManager+handleImageLoaded)
    * [.handleImageLoadError()](#CanvasManager+handleImageLoadError)
    * [.tryLoadImageFallback(urls, index)](#CanvasManager+tryLoadImageFallback)
    * [.updateStyleOptions(options)](#CanvasManager+updateStyleOptions)
    * [.calculateResize(originalLayer, handleType, deltaX, deltaY, modifiers)](#CanvasManager+calculateResize) ⇒ <code>Object</code> \| <code>null</code>
    * [.emitTransforming(layer)](#CanvasManager+emitTransforming)
    * [.updateLayerPosition(layer, originalState, deltaX, deltaY)](#CanvasManager+updateLayerPosition)
    * [.updateCanvasTransform()](#CanvasManager+updateCanvasTransform)
    * [.smoothZoomTo(targetZoom, duration)](#CanvasManager+smoothZoomTo)
    * [.animateZoom()](#CanvasManager+animateZoom)
    * [.setZoomDirect(newZoom)](#CanvasManager+setZoomDirect)
    * [.zoomToFitLayers()](#CanvasManager+zoomToFitLayers)
    * [.getLayerBounds(layer)](#CanvasManager+getLayerBounds) ⇒ <code>Object</code> \| <code>null</code>
    * [.getTempCanvas(width, height)](#CanvasManager+getTempCanvas) ⇒ <code>Object</code>
    * [.returnTempCanvas(tempCanvasObj)](#CanvasManager+returnTempCanvas)
    * [.handleZoomClick(point, event)](#CanvasManager+handleZoomClick)
    * [.handleZoomDrag(point)](#CanvasManager+handleZoomDrag)
    * [.zoomBy(delta, point)](#CanvasManager+zoomBy)
    * [.saveState(action)](#CanvasManager+saveState)
    * [.drawMultiSelectionIndicators()](#CanvasManager+drawMultiSelectionIndicators)
    * [.setBaseDimensions(width, height)](#CanvasManager+setBaseDimensions)
    * [.resizeCanvas()](#CanvasManager+resizeCanvas)
    * [.getMousePointFromClient(clientX, clientY)](#CanvasManager+getMousePointFromClient) ⇒ <code>Object</code>

<a name="new_CanvasManager_new"></a>

### new CanvasManager(config)
Creates a new CanvasManager instance


| Param | Type | Description |
| --- | --- | --- |
| config | <code>Object</code> | Configuration options |

<a name="CanvasManager+setupEventHandlers"></a>

### canvasManager.setupEventHandlers()
Initialize the event handling layer for CanvasManager.This will construct CanvasEvents controller if available, otherwiseinstall basic fallback handlers for test environments.

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  
<a name="CanvasManager+getSelectedLayerIds"></a>

### canvasManager.getSelectedLayerIds() ⇒ <code>Array</code>
Get the selected layer IDs from StateManager (single source of truth)

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  
**Returns**: <code>Array</code> - Array of selected layer IDs  
<a name="CanvasManager+getSelectedLayerId"></a>

### canvasManager.getSelectedLayerId() ⇒ <code>string</code> \| <code>null</code>
Get the primary selected layer ID (last in selection array)

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  
**Returns**: <code>string</code> \| <code>null</code> - The selected layer ID or null  
<a name="CanvasManager+setSelectedLayerIds"></a>

### canvasManager.setSelectedLayerIds(ids)
Set the selected layer IDs via StateManager

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  

| Param | Type | Description |
| --- | --- | --- |
| ids | <code>Array</code> | Array of layer IDs to select |

<a name="CanvasManager+subscribeToState"></a>

### canvasManager.subscribeToState()
Subscribe to StateManager for reactive updates

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  
<a name="CanvasManager+notifyToolbarOfSelection"></a>

### canvasManager.notifyToolbarOfSelection(selectedIds)
Notify toolbar style controls of selection change for preset dropdown

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  

| Param | Type | Description |
| --- | --- | --- |
| selectedIds | <code>Array</code> | Selected layer IDs |

<a name="CanvasManager+loadBackgroundImage"></a>

### canvasManager.loadBackgroundImage()
Load background image using ImageLoader moduleDelegates to ImageLoader for URL detection and loading with fallbacks

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  
**Note**: ImageLoader is guaranteed to load first via extension.json in production,      but fallback is kept for test environments and backward compatibility.  
<a name="CanvasManager+handleImageLoaded"></a>

### canvasManager.handleImageLoaded(image, info)
Handle successful image load from ImageLoader

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  

| Param | Type | Description |
| --- | --- | --- |
| image | <code>HTMLImageElement</code> | The loaded image |
| info | <code>Object</code> | Load info (width, height, source, etc.) |

<a name="CanvasManager+handleImageLoadError"></a>

### canvasManager.handleImageLoadError()
Handle image load error from ImageLoader

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  
<a name="CanvasManager+tryLoadImageFallback"></a>

### canvasManager.tryLoadImageFallback(urls, index)
Try to load images from a list of URLs sequentially.

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  

| Param | Type |
| --- | --- |
| urls | <code>Array.&lt;string&gt;</code> | 
| index | <code>number</code> | 

<a name="CanvasManager+updateStyleOptions"></a>

### canvasManager.updateStyleOptions(options)
Update current style options and apply to selected layers.Delegates to StyleController when available.

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  

| Param | Type | Description |
| --- | --- | --- |
| options | <code>Object</code> | Style options to update |

<a name="CanvasManager+calculateResize"></a>

### canvasManager.calculateResize(originalLayer, handleType, deltaX, deltaY, modifiers) ⇒ <code>Object</code> \| <code>null</code>
Calculate resize updates based on layer typeDelegates to TransformController for actual calculations

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  
**Returns**: <code>Object</code> \| <code>null</code> - Updates object with new dimensions  

| Param | Type | Description |
| --- | --- | --- |
| originalLayer | <code>Object</code> | Original layer properties |
| handleType | <code>string</code> | Handle being dragged |
| deltaX | <code>number</code> | Delta X movement |
| deltaY | <code>number</code> | Delta Y movement |
| modifiers | <code>Object</code> | Modifier keys state |

<a name="CanvasManager+emitTransforming"></a>

### canvasManager.emitTransforming(layer)
Emit a throttled custom event with current transform valuesto allow the properties panel to live-sync during manipulation.

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | The layer object to serialize and emit |

<a name="CanvasManager+updateLayerPosition"></a>

### canvasManager.updateLayerPosition(layer, originalState, deltaX, deltaY)
Update layer position during drag operation

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer to update |
| originalState | <code>Object</code> | Original state before drag |
| deltaX | <code>number</code> | X offset |
| deltaY | <code>number</code> | Y offset |

<a name="CanvasManager+updateCanvasTransform"></a>

### canvasManager.updateCanvasTransform()
Update the canvas CSS transform from current pan/zoom state.

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  
<a name="CanvasManager+smoothZoomTo"></a>

### canvasManager.smoothZoomTo(targetZoom, duration)
Smoothly animate zoom to a target level

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  

| Param | Type | Description |
| --- | --- | --- |
| targetZoom | <code>number</code> | Target zoom level |
| duration | <code>number</code> | Animation duration in milliseconds (optional) |

<a name="CanvasManager+animateZoom"></a>

### canvasManager.animateZoom()
Animation frame function for smooth zooming

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  
<a name="CanvasManager+setZoomDirect"></a>

### canvasManager.setZoomDirect(newZoom)
Set zoom directly without triggering user zoom flag (for animations)

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  

| Param | Type | Description |
| --- | --- | --- |
| newZoom | <code>number</code> | New zoom level |

<a name="CanvasManager+zoomToFitLayers"></a>

### canvasManager.zoomToFitLayers()
Zoom to fit all layers in the viewport

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  
<a name="CanvasManager+getLayerBounds"></a>

### canvasManager.getLayerBounds(layer) ⇒ <code>Object</code> \| <code>null</code>
Get bounding box of a layer

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  
**Returns**: <code>Object</code> \| <code>null</code> - Bounding box including raw and axis-aligned data  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer object |

<a name="CanvasManager+getTempCanvas"></a>

### canvasManager.getTempCanvas(width, height) ⇒ <code>Object</code>
Get a temporary canvas from the pool or create a new oneThis prevents memory leaks from constantly creating new canvas elements

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  
**Returns**: <code>Object</code> - Object with canvas and context properties  

| Param | Type | Description |
| --- | --- | --- |
| width | <code>number</code> | Canvas width |
| height | <code>number</code> | Canvas height |

<a name="CanvasManager+returnTempCanvas"></a>

### canvasManager.returnTempCanvas(tempCanvasObj)
Return a temporary canvas to the pool for reuse

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  

| Param | Type | Description |
| --- | --- | --- |
| tempCanvasObj | <code>Object</code> | Object with canvas and context properties |

<a name="CanvasManager+handleZoomClick"></a>

### canvasManager.handleZoomClick(point, event)
Handle zoom tool click - zoom in at point, or zoom out with shift

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  

| Param | Type | Description |
| --- | --- | --- |
| point | <code>Object</code> | Mouse point in canvas coordinates |
| event | <code>MouseEvent</code> | Mouse event with modifier keys |

<a name="CanvasManager+handleZoomDrag"></a>

### canvasManager.handleZoomDrag(point)
Handle zoom tool drag - drag up/down to zoom in/out dynamically

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  

| Param | Type | Description |
| --- | --- | --- |
| point | <code>Object</code> | Current mouse point |

<a name="CanvasManager+zoomBy"></a>

### canvasManager.zoomBy(delta, point)
Public zoom helper used by external handlers (wheel/pinch)

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  

| Param | Type | Description |
| --- | --- | --- |
| delta | <code>number</code> | Positive to zoom in, negative to zoom out (in zoom units) |
| point | <code>Object</code> | Canvas coordinate under the cursor to anchor zoom around |

<a name="CanvasManager+saveState"></a>

### canvasManager.saveState(action)
Save current state to history for undo/redoDelegates to HistoryManager for single source of truth

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  

| Param | Type | Description |
| --- | --- | --- |
| action | <code>string</code> | Description of the action |

<a name="CanvasManager+drawMultiSelectionIndicators"></a>

### canvasManager.drawMultiSelectionIndicators()
Draw selection indicators for multiple selected layersThe key object (last selected) is visually distinguished with an orange border

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  
<a name="CanvasManager+setBaseDimensions"></a>

### canvasManager.setBaseDimensions(width, height)
Set the base dimensions that layers were created against.Used for scaling layers when the canvas size differs from the original.

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  

| Param | Type | Description |
| --- | --- | --- |
| width | <code>number</code> | Original image width |
| height | <code>number</code> | Original image height |

<a name="CanvasManager+resizeCanvas"></a>

### canvasManager.resizeCanvas()
Resize canvas to match container size while maintaining aspect ratio.Updates viewport bounds for layer culling.

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  
<a name="CanvasManager+getMousePointFromClient"></a>

### canvasManager.getMousePointFromClient(clientX, clientY) ⇒ <code>Object</code>
Convert a DOM client coordinate to canvas coordinate, robust against CSS transforms.Uses element's bounding rect to derive the pixel ratio instead of manual pan/zoom math.

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  

| Param | Type |
| --- | --- |
| clientX | <code>number</code> | 
| clientY | <code>number</code> | 

<a name="CanvasManager"></a>

## CanvasManager : <code>Object</code>
Minimal typedef for CanvasManager used for JSDoc references in this file.

**Kind**: global typedef  
**Properties**

| Name | Type |
| --- | --- |
| canvas | <code>HTMLCanvasElement</code> | 
| ctx | <code>CanvasRenderingContext2D</code> | 


* [CanvasManager](#CanvasManager) : <code>Object</code>
    * [new CanvasManager(config)](#new_CanvasManager_new)
    * [.setupEventHandlers()](#CanvasManager+setupEventHandlers)
    * [.getSelectedLayerIds()](#CanvasManager+getSelectedLayerIds) ⇒ <code>Array</code>
    * [.getSelectedLayerId()](#CanvasManager+getSelectedLayerId) ⇒ <code>string</code> \| <code>null</code>
    * [.setSelectedLayerIds(ids)](#CanvasManager+setSelectedLayerIds)
    * [.subscribeToState()](#CanvasManager+subscribeToState)
    * [.notifyToolbarOfSelection(selectedIds)](#CanvasManager+notifyToolbarOfSelection)
    * [.loadBackgroundImage()](#CanvasManager+loadBackgroundImage)
    * [.handleImageLoaded(image, info)](#CanvasManager+handleImageLoaded)
    * [.handleImageLoadError()](#CanvasManager+handleImageLoadError)
    * [.tryLoadImageFallback(urls, index)](#CanvasManager+tryLoadImageFallback)
    * [.updateStyleOptions(options)](#CanvasManager+updateStyleOptions)
    * [.calculateResize(originalLayer, handleType, deltaX, deltaY, modifiers)](#CanvasManager+calculateResize) ⇒ <code>Object</code> \| <code>null</code>
    * [.emitTransforming(layer)](#CanvasManager+emitTransforming)
    * [.updateLayerPosition(layer, originalState, deltaX, deltaY)](#CanvasManager+updateLayerPosition)
    * [.updateCanvasTransform()](#CanvasManager+updateCanvasTransform)
    * [.smoothZoomTo(targetZoom, duration)](#CanvasManager+smoothZoomTo)
    * [.animateZoom()](#CanvasManager+animateZoom)
    * [.setZoomDirect(newZoom)](#CanvasManager+setZoomDirect)
    * [.zoomToFitLayers()](#CanvasManager+zoomToFitLayers)
    * [.getLayerBounds(layer)](#CanvasManager+getLayerBounds) ⇒ <code>Object</code> \| <code>null</code>
    * [.getTempCanvas(width, height)](#CanvasManager+getTempCanvas) ⇒ <code>Object</code>
    * [.returnTempCanvas(tempCanvasObj)](#CanvasManager+returnTempCanvas)
    * [.handleZoomClick(point, event)](#CanvasManager+handleZoomClick)
    * [.handleZoomDrag(point)](#CanvasManager+handleZoomDrag)
    * [.zoomBy(delta, point)](#CanvasManager+zoomBy)
    * [.saveState(action)](#CanvasManager+saveState)
    * [.drawMultiSelectionIndicators()](#CanvasManager+drawMultiSelectionIndicators)
    * [.setBaseDimensions(width, height)](#CanvasManager+setBaseDimensions)
    * [.resizeCanvas()](#CanvasManager+resizeCanvas)
    * [.getMousePointFromClient(clientX, clientY)](#CanvasManager+getMousePointFromClient) ⇒ <code>Object</code>

<a name="new_CanvasManager_new"></a>

### new CanvasManager(config)
Creates a new CanvasManager instance


| Param | Type | Description |
| --- | --- | --- |
| config | <code>Object</code> | Configuration options |

<a name="CanvasManager+setupEventHandlers"></a>

### canvasManager.setupEventHandlers()
Initialize the event handling layer for CanvasManager.This will construct CanvasEvents controller if available, otherwiseinstall basic fallback handlers for test environments.

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  
<a name="CanvasManager+getSelectedLayerIds"></a>

### canvasManager.getSelectedLayerIds() ⇒ <code>Array</code>
Get the selected layer IDs from StateManager (single source of truth)

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  
**Returns**: <code>Array</code> - Array of selected layer IDs  
<a name="CanvasManager+getSelectedLayerId"></a>

### canvasManager.getSelectedLayerId() ⇒ <code>string</code> \| <code>null</code>
Get the primary selected layer ID (last in selection array)

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  
**Returns**: <code>string</code> \| <code>null</code> - The selected layer ID or null  
<a name="CanvasManager+setSelectedLayerIds"></a>

### canvasManager.setSelectedLayerIds(ids)
Set the selected layer IDs via StateManager

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  

| Param | Type | Description |
| --- | --- | --- |
| ids | <code>Array</code> | Array of layer IDs to select |

<a name="CanvasManager+subscribeToState"></a>

### canvasManager.subscribeToState()
Subscribe to StateManager for reactive updates

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  
<a name="CanvasManager+notifyToolbarOfSelection"></a>

### canvasManager.notifyToolbarOfSelection(selectedIds)
Notify toolbar style controls of selection change for preset dropdown

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  

| Param | Type | Description |
| --- | --- | --- |
| selectedIds | <code>Array</code> | Selected layer IDs |

<a name="CanvasManager+loadBackgroundImage"></a>

### canvasManager.loadBackgroundImage()
Load background image using ImageLoader moduleDelegates to ImageLoader for URL detection and loading with fallbacks

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  
**Note**: ImageLoader is guaranteed to load first via extension.json in production,      but fallback is kept for test environments and backward compatibility.  
<a name="CanvasManager+handleImageLoaded"></a>

### canvasManager.handleImageLoaded(image, info)
Handle successful image load from ImageLoader

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  

| Param | Type | Description |
| --- | --- | --- |
| image | <code>HTMLImageElement</code> | The loaded image |
| info | <code>Object</code> | Load info (width, height, source, etc.) |

<a name="CanvasManager+handleImageLoadError"></a>

### canvasManager.handleImageLoadError()
Handle image load error from ImageLoader

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  
<a name="CanvasManager+tryLoadImageFallback"></a>

### canvasManager.tryLoadImageFallback(urls, index)
Try to load images from a list of URLs sequentially.

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  

| Param | Type |
| --- | --- |
| urls | <code>Array.&lt;string&gt;</code> | 
| index | <code>number</code> | 

<a name="CanvasManager+updateStyleOptions"></a>

### canvasManager.updateStyleOptions(options)
Update current style options and apply to selected layers.Delegates to StyleController when available.

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  

| Param | Type | Description |
| --- | --- | --- |
| options | <code>Object</code> | Style options to update |

<a name="CanvasManager+calculateResize"></a>

### canvasManager.calculateResize(originalLayer, handleType, deltaX, deltaY, modifiers) ⇒ <code>Object</code> \| <code>null</code>
Calculate resize updates based on layer typeDelegates to TransformController for actual calculations

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  
**Returns**: <code>Object</code> \| <code>null</code> - Updates object with new dimensions  

| Param | Type | Description |
| --- | --- | --- |
| originalLayer | <code>Object</code> | Original layer properties |
| handleType | <code>string</code> | Handle being dragged |
| deltaX | <code>number</code> | Delta X movement |
| deltaY | <code>number</code> | Delta Y movement |
| modifiers | <code>Object</code> | Modifier keys state |

<a name="CanvasManager+emitTransforming"></a>

### canvasManager.emitTransforming(layer)
Emit a throttled custom event with current transform valuesto allow the properties panel to live-sync during manipulation.

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | The layer object to serialize and emit |

<a name="CanvasManager+updateLayerPosition"></a>

### canvasManager.updateLayerPosition(layer, originalState, deltaX, deltaY)
Update layer position during drag operation

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer to update |
| originalState | <code>Object</code> | Original state before drag |
| deltaX | <code>number</code> | X offset |
| deltaY | <code>number</code> | Y offset |

<a name="CanvasManager+updateCanvasTransform"></a>

### canvasManager.updateCanvasTransform()
Update the canvas CSS transform from current pan/zoom state.

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  
<a name="CanvasManager+smoothZoomTo"></a>

### canvasManager.smoothZoomTo(targetZoom, duration)
Smoothly animate zoom to a target level

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  

| Param | Type | Description |
| --- | --- | --- |
| targetZoom | <code>number</code> | Target zoom level |
| duration | <code>number</code> | Animation duration in milliseconds (optional) |

<a name="CanvasManager+animateZoom"></a>

### canvasManager.animateZoom()
Animation frame function for smooth zooming

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  
<a name="CanvasManager+setZoomDirect"></a>

### canvasManager.setZoomDirect(newZoom)
Set zoom directly without triggering user zoom flag (for animations)

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  

| Param | Type | Description |
| --- | --- | --- |
| newZoom | <code>number</code> | New zoom level |

<a name="CanvasManager+zoomToFitLayers"></a>

### canvasManager.zoomToFitLayers()
Zoom to fit all layers in the viewport

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  
<a name="CanvasManager+getLayerBounds"></a>

### canvasManager.getLayerBounds(layer) ⇒ <code>Object</code> \| <code>null</code>
Get bounding box of a layer

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  
**Returns**: <code>Object</code> \| <code>null</code> - Bounding box including raw and axis-aligned data  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer object |

<a name="CanvasManager+getTempCanvas"></a>

### canvasManager.getTempCanvas(width, height) ⇒ <code>Object</code>
Get a temporary canvas from the pool or create a new oneThis prevents memory leaks from constantly creating new canvas elements

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  
**Returns**: <code>Object</code> - Object with canvas and context properties  

| Param | Type | Description |
| --- | --- | --- |
| width | <code>number</code> | Canvas width |
| height | <code>number</code> | Canvas height |

<a name="CanvasManager+returnTempCanvas"></a>

### canvasManager.returnTempCanvas(tempCanvasObj)
Return a temporary canvas to the pool for reuse

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  

| Param | Type | Description |
| --- | --- | --- |
| tempCanvasObj | <code>Object</code> | Object with canvas and context properties |

<a name="CanvasManager+handleZoomClick"></a>

### canvasManager.handleZoomClick(point, event)
Handle zoom tool click - zoom in at point, or zoom out with shift

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  

| Param | Type | Description |
| --- | --- | --- |
| point | <code>Object</code> | Mouse point in canvas coordinates |
| event | <code>MouseEvent</code> | Mouse event with modifier keys |

<a name="CanvasManager+handleZoomDrag"></a>

### canvasManager.handleZoomDrag(point)
Handle zoom tool drag - drag up/down to zoom in/out dynamically

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  

| Param | Type | Description |
| --- | --- | --- |
| point | <code>Object</code> | Current mouse point |

<a name="CanvasManager+zoomBy"></a>

### canvasManager.zoomBy(delta, point)
Public zoom helper used by external handlers (wheel/pinch)

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  

| Param | Type | Description |
| --- | --- | --- |
| delta | <code>number</code> | Positive to zoom in, negative to zoom out (in zoom units) |
| point | <code>Object</code> | Canvas coordinate under the cursor to anchor zoom around |

<a name="CanvasManager+saveState"></a>

### canvasManager.saveState(action)
Save current state to history for undo/redoDelegates to HistoryManager for single source of truth

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  

| Param | Type | Description |
| --- | --- | --- |
| action | <code>string</code> | Description of the action |

<a name="CanvasManager+drawMultiSelectionIndicators"></a>

### canvasManager.drawMultiSelectionIndicators()
Draw selection indicators for multiple selected layersThe key object (last selected) is visually distinguished with an orange border

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  
<a name="CanvasManager+setBaseDimensions"></a>

### canvasManager.setBaseDimensions(width, height)
Set the base dimensions that layers were created against.Used for scaling layers when the canvas size differs from the original.

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  

| Param | Type | Description |
| --- | --- | --- |
| width | <code>number</code> | Original image width |
| height | <code>number</code> | Original image height |

<a name="CanvasManager+resizeCanvas"></a>

### canvasManager.resizeCanvas()
Resize canvas to match container size while maintaining aspect ratio.Updates viewport bounds for layer culling.

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  
<a name="CanvasManager+getMousePointFromClient"></a>

### canvasManager.getMousePointFromClient(clientX, clientY) ⇒ <code>Object</code>
Convert a DOM client coordinate to canvas coordinate, robust against CSS transforms.Uses element's bounding rect to derive the pixel ratio instead of manual pan/zoom math.

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  

| Param | Type |
| --- | --- |
| clientX | <code>number</code> | 
| clientY | <code>number</code> | 

<a name="CanvasManager"></a>

## CanvasManager : <code>Object</code>
Minimal typedef for CanvasManager used for JSDoc references in this file.

**Kind**: global typedef  
**Properties**

| Name | Type |
| --- | --- |
| canvas | <code>HTMLCanvasElement</code> | 
| ctx | <code>CanvasRenderingContext2D</code> | 


* [CanvasManager](#CanvasManager) : <code>Object</code>
    * [new CanvasManager(config)](#new_CanvasManager_new)
    * [.setupEventHandlers()](#CanvasManager+setupEventHandlers)
    * [.getSelectedLayerIds()](#CanvasManager+getSelectedLayerIds) ⇒ <code>Array</code>
    * [.getSelectedLayerId()](#CanvasManager+getSelectedLayerId) ⇒ <code>string</code> \| <code>null</code>
    * [.setSelectedLayerIds(ids)](#CanvasManager+setSelectedLayerIds)
    * [.subscribeToState()](#CanvasManager+subscribeToState)
    * [.notifyToolbarOfSelection(selectedIds)](#CanvasManager+notifyToolbarOfSelection)
    * [.loadBackgroundImage()](#CanvasManager+loadBackgroundImage)
    * [.handleImageLoaded(image, info)](#CanvasManager+handleImageLoaded)
    * [.handleImageLoadError()](#CanvasManager+handleImageLoadError)
    * [.tryLoadImageFallback(urls, index)](#CanvasManager+tryLoadImageFallback)
    * [.updateStyleOptions(options)](#CanvasManager+updateStyleOptions)
    * [.calculateResize(originalLayer, handleType, deltaX, deltaY, modifiers)](#CanvasManager+calculateResize) ⇒ <code>Object</code> \| <code>null</code>
    * [.emitTransforming(layer)](#CanvasManager+emitTransforming)
    * [.updateLayerPosition(layer, originalState, deltaX, deltaY)](#CanvasManager+updateLayerPosition)
    * [.updateCanvasTransform()](#CanvasManager+updateCanvasTransform)
    * [.smoothZoomTo(targetZoom, duration)](#CanvasManager+smoothZoomTo)
    * [.animateZoom()](#CanvasManager+animateZoom)
    * [.setZoomDirect(newZoom)](#CanvasManager+setZoomDirect)
    * [.zoomToFitLayers()](#CanvasManager+zoomToFitLayers)
    * [.getLayerBounds(layer)](#CanvasManager+getLayerBounds) ⇒ <code>Object</code> \| <code>null</code>
    * [.getTempCanvas(width, height)](#CanvasManager+getTempCanvas) ⇒ <code>Object</code>
    * [.returnTempCanvas(tempCanvasObj)](#CanvasManager+returnTempCanvas)
    * [.handleZoomClick(point, event)](#CanvasManager+handleZoomClick)
    * [.handleZoomDrag(point)](#CanvasManager+handleZoomDrag)
    * [.zoomBy(delta, point)](#CanvasManager+zoomBy)
    * [.saveState(action)](#CanvasManager+saveState)
    * [.drawMultiSelectionIndicators()](#CanvasManager+drawMultiSelectionIndicators)
    * [.setBaseDimensions(width, height)](#CanvasManager+setBaseDimensions)
    * [.resizeCanvas()](#CanvasManager+resizeCanvas)
    * [.getMousePointFromClient(clientX, clientY)](#CanvasManager+getMousePointFromClient) ⇒ <code>Object</code>

<a name="new_CanvasManager_new"></a>

### new CanvasManager(config)
Creates a new CanvasManager instance


| Param | Type | Description |
| --- | --- | --- |
| config | <code>Object</code> | Configuration options |

<a name="CanvasManager+setupEventHandlers"></a>

### canvasManager.setupEventHandlers()
Initialize the event handling layer for CanvasManager.This will construct CanvasEvents controller if available, otherwiseinstall basic fallback handlers for test environments.

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  
<a name="CanvasManager+getSelectedLayerIds"></a>

### canvasManager.getSelectedLayerIds() ⇒ <code>Array</code>
Get the selected layer IDs from StateManager (single source of truth)

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  
**Returns**: <code>Array</code> - Array of selected layer IDs  
<a name="CanvasManager+getSelectedLayerId"></a>

### canvasManager.getSelectedLayerId() ⇒ <code>string</code> \| <code>null</code>
Get the primary selected layer ID (last in selection array)

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  
**Returns**: <code>string</code> \| <code>null</code> - The selected layer ID or null  
<a name="CanvasManager+setSelectedLayerIds"></a>

### canvasManager.setSelectedLayerIds(ids)
Set the selected layer IDs via StateManager

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  

| Param | Type | Description |
| --- | --- | --- |
| ids | <code>Array</code> | Array of layer IDs to select |

<a name="CanvasManager+subscribeToState"></a>

### canvasManager.subscribeToState()
Subscribe to StateManager for reactive updates

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  
<a name="CanvasManager+notifyToolbarOfSelection"></a>

### canvasManager.notifyToolbarOfSelection(selectedIds)
Notify toolbar style controls of selection change for preset dropdown

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  

| Param | Type | Description |
| --- | --- | --- |
| selectedIds | <code>Array</code> | Selected layer IDs |

<a name="CanvasManager+loadBackgroundImage"></a>

### canvasManager.loadBackgroundImage()
Load background image using ImageLoader moduleDelegates to ImageLoader for URL detection and loading with fallbacks

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  
**Note**: ImageLoader is guaranteed to load first via extension.json in production,      but fallback is kept for test environments and backward compatibility.  
<a name="CanvasManager+handleImageLoaded"></a>

### canvasManager.handleImageLoaded(image, info)
Handle successful image load from ImageLoader

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  

| Param | Type | Description |
| --- | --- | --- |
| image | <code>HTMLImageElement</code> | The loaded image |
| info | <code>Object</code> | Load info (width, height, source, etc.) |

<a name="CanvasManager+handleImageLoadError"></a>

### canvasManager.handleImageLoadError()
Handle image load error from ImageLoader

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  
<a name="CanvasManager+tryLoadImageFallback"></a>

### canvasManager.tryLoadImageFallback(urls, index)
Try to load images from a list of URLs sequentially.

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  

| Param | Type |
| --- | --- |
| urls | <code>Array.&lt;string&gt;</code> | 
| index | <code>number</code> | 

<a name="CanvasManager+updateStyleOptions"></a>

### canvasManager.updateStyleOptions(options)
Update current style options and apply to selected layers.Delegates to StyleController when available.

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  

| Param | Type | Description |
| --- | --- | --- |
| options | <code>Object</code> | Style options to update |

<a name="CanvasManager+calculateResize"></a>

### canvasManager.calculateResize(originalLayer, handleType, deltaX, deltaY, modifiers) ⇒ <code>Object</code> \| <code>null</code>
Calculate resize updates based on layer typeDelegates to TransformController for actual calculations

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  
**Returns**: <code>Object</code> \| <code>null</code> - Updates object with new dimensions  

| Param | Type | Description |
| --- | --- | --- |
| originalLayer | <code>Object</code> | Original layer properties |
| handleType | <code>string</code> | Handle being dragged |
| deltaX | <code>number</code> | Delta X movement |
| deltaY | <code>number</code> | Delta Y movement |
| modifiers | <code>Object</code> | Modifier keys state |

<a name="CanvasManager+emitTransforming"></a>

### canvasManager.emitTransforming(layer)
Emit a throttled custom event with current transform valuesto allow the properties panel to live-sync during manipulation.

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | The layer object to serialize and emit |

<a name="CanvasManager+updateLayerPosition"></a>

### canvasManager.updateLayerPosition(layer, originalState, deltaX, deltaY)
Update layer position during drag operation

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer to update |
| originalState | <code>Object</code> | Original state before drag |
| deltaX | <code>number</code> | X offset |
| deltaY | <code>number</code> | Y offset |

<a name="CanvasManager+updateCanvasTransform"></a>

### canvasManager.updateCanvasTransform()
Update the canvas CSS transform from current pan/zoom state.

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  
<a name="CanvasManager+smoothZoomTo"></a>

### canvasManager.smoothZoomTo(targetZoom, duration)
Smoothly animate zoom to a target level

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  

| Param | Type | Description |
| --- | --- | --- |
| targetZoom | <code>number</code> | Target zoom level |
| duration | <code>number</code> | Animation duration in milliseconds (optional) |

<a name="CanvasManager+animateZoom"></a>

### canvasManager.animateZoom()
Animation frame function for smooth zooming

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  
<a name="CanvasManager+setZoomDirect"></a>

### canvasManager.setZoomDirect(newZoom)
Set zoom directly without triggering user zoom flag (for animations)

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  

| Param | Type | Description |
| --- | --- | --- |
| newZoom | <code>number</code> | New zoom level |

<a name="CanvasManager+zoomToFitLayers"></a>

### canvasManager.zoomToFitLayers()
Zoom to fit all layers in the viewport

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  
<a name="CanvasManager+getLayerBounds"></a>

### canvasManager.getLayerBounds(layer) ⇒ <code>Object</code> \| <code>null</code>
Get bounding box of a layer

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  
**Returns**: <code>Object</code> \| <code>null</code> - Bounding box including raw and axis-aligned data  

| Param | Type | Description |
| --- | --- | --- |
| layer | <code>Object</code> | Layer object |

<a name="CanvasManager+getTempCanvas"></a>

### canvasManager.getTempCanvas(width, height) ⇒ <code>Object</code>
Get a temporary canvas from the pool or create a new oneThis prevents memory leaks from constantly creating new canvas elements

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  
**Returns**: <code>Object</code> - Object with canvas and context properties  

| Param | Type | Description |
| --- | --- | --- |
| width | <code>number</code> | Canvas width |
| height | <code>number</code> | Canvas height |

<a name="CanvasManager+returnTempCanvas"></a>

### canvasManager.returnTempCanvas(tempCanvasObj)
Return a temporary canvas to the pool for reuse

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  

| Param | Type | Description |
| --- | --- | --- |
| tempCanvasObj | <code>Object</code> | Object with canvas and context properties |

<a name="CanvasManager+handleZoomClick"></a>

### canvasManager.handleZoomClick(point, event)
Handle zoom tool click - zoom in at point, or zoom out with shift

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  

| Param | Type | Description |
| --- | --- | --- |
| point | <code>Object</code> | Mouse point in canvas coordinates |
| event | <code>MouseEvent</code> | Mouse event with modifier keys |

<a name="CanvasManager+handleZoomDrag"></a>

### canvasManager.handleZoomDrag(point)
Handle zoom tool drag - drag up/down to zoom in/out dynamically

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  

| Param | Type | Description |
| --- | --- | --- |
| point | <code>Object</code> | Current mouse point |

<a name="CanvasManager+zoomBy"></a>

### canvasManager.zoomBy(delta, point)
Public zoom helper used by external handlers (wheel/pinch)

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  

| Param | Type | Description |
| --- | --- | --- |
| delta | <code>number</code> | Positive to zoom in, negative to zoom out (in zoom units) |
| point | <code>Object</code> | Canvas coordinate under the cursor to anchor zoom around |

<a name="CanvasManager+saveState"></a>

### canvasManager.saveState(action)
Save current state to history for undo/redoDelegates to HistoryManager for single source of truth

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  

| Param | Type | Description |
| --- | --- | --- |
| action | <code>string</code> | Description of the action |

<a name="CanvasManager+drawMultiSelectionIndicators"></a>

### canvasManager.drawMultiSelectionIndicators()
Draw selection indicators for multiple selected layersThe key object (last selected) is visually distinguished with an orange border

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  
<a name="CanvasManager+setBaseDimensions"></a>

### canvasManager.setBaseDimensions(width, height)
Set the base dimensions that layers were created against.Used for scaling layers when the canvas size differs from the original.

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  

| Param | Type | Description |
| --- | --- | --- |
| width | <code>number</code> | Original image width |
| height | <code>number</code> | Original image height |

<a name="CanvasManager+resizeCanvas"></a>

### canvasManager.resizeCanvas()
Resize canvas to match container size while maintaining aspect ratio.Updates viewport bounds for layer culling.

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  
<a name="CanvasManager+getMousePointFromClient"></a>

### canvasManager.getMousePointFromClient(clientX, clientY) ⇒ <code>Object</code>
Convert a DOM client coordinate to canvas coordinate, robust against CSS transforms.Uses element's bounding rect to derive the pixel ratio instead of manual pan/zoom math.

**Kind**: instance method of [<code>CanvasManager</code>](#CanvasManager)  

| Param | Type |
| --- | --- |
| clientX | <code>number</code> | 
| clientY | <code>number</code> | 

