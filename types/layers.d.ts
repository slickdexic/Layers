/**
 * Layers Extension - TypeScript Type Definitions
 *
 * This file provides type definitions for the Layers MediaWiki extension.
 * It enables IntelliSense/autocomplete in editors like VS Code without
 * requiring a full TypeScript migration.
 *
 * Usage:
 *   1. Reference in JavaScript files: /// <reference path="./types/layers.d.ts" />
 *   2. Or add to jsconfig.json: { "include": ["resources/**/*", "types/**/*"] }
 *
 * @module LayersTypes
 * @version 1.1.3
 */

// =============================================================================
// Core Layer Types
// =============================================================================

/**
 * All supported layer types in the Layers extension
 */
type LayerType =
	| 'text'
	| 'textbox'
	| 'arrow'
	| 'rectangle'
	| 'circle'
	| 'ellipse'
	| 'polygon'
	| 'star'
	| 'line'
	| 'path'
	| 'blur'
	| 'image';

/**
 * Arrow style (head placement)
 * - single: head at end only
 * - double: heads at both ends
 * - none: line only (no heads)
 */
type ArrowStyle = 'single' | 'double' | 'none';

/**
 * Arrow head type (rendering style)
 * - pointed: sharp pointed arrow
 * - chevron: V-shaped chevron
 * - standard: classic arrow head
 */
type ArrowHeadType = 'pointed' | 'chevron' | 'standard';

/**
 * Text alignment options
 */
type TextAlign = 'left' | 'center' | 'right';

/**
 * Vertical alignment options for text boxes
 */
type VerticalAlign = 'top' | 'middle' | 'bottom';

/**
 * Font weight options
 */
type FontWeight = 'normal' | 'bold';

/**
 * Font style options
 */
type FontStyle = 'normal' | 'italic';

/**
 * Blend mode options
 */
type BlendMode =
	| 'normal'
	| 'multiply'
	| 'screen'
	| 'overlay'
	| 'darken'
	| 'lighten'
	| 'color-dodge'
	| 'color-burn'
	| 'hard-light'
	| 'soft-light'
	| 'difference'
	| 'exclusion';

/**
 * A point in 2D space
 */
interface Point {
	x: number;
	y: number;
}

/**
 * Base layer properties common to all layer types
 */
interface LayerBase {
	/** Unique identifier for the layer */
	id: string;

	/** Type of the layer */
	type: LayerType;

	/** X position of the layer */
	x?: number;

	/** Y position of the layer */
	y?: number;

	/** Width of the layer */
	width?: number;

	/** Height of the layer */
	height?: number;

	/** Rotation angle in degrees */
	rotation?: number;

	/** Whether the layer is visible */
	visible?: boolean;

	/** Whether the layer is locked */
	locked?: boolean;

	/** Display name for the layer */
	name?: string;

	/** Overall opacity (0-1) */
	opacity?: number;

	/** Blend mode for compositing */
	blendMode?: BlendMode;
}

/**
 * Style properties for stroke and fill
 */
interface LayerStyle {
	/** Stroke color (CSS color string) */
	stroke?: string;

	/** Fill color (CSS color string) */
	fill?: string;

	/** Stroke opacity (0-1) */
	strokeOpacity?: number;

	/** Fill opacity (0-1) */
	fillOpacity?: number;

	/** Stroke width in pixels */
	strokeWidth?: number;
}

/**
 * Shadow effect properties
 */
interface ShadowProperties {
	/** Whether shadow is enabled */
	shadow?: boolean;

	/** Shadow color (CSS color string) */
	shadowColor?: string;

	/** Shadow blur radius in pixels */
	shadowBlur?: number;

	/** Shadow X offset in pixels */
	shadowOffsetX?: number;

	/** Shadow Y offset in pixels */
	shadowOffsetY?: number;

	/** Shadow spread (extension-specific) */
	shadowSpread?: number;
}

/**
 * Text-specific properties
 */
interface TextProperties {
	/** Text content */
	text?: string;

	/** Font family */
	fontFamily?: string;

	/** Font size in pixels */
	fontSize?: number;

	/** Font weight */
	fontWeight?: FontWeight;

	/** Font style */
	fontStyle?: FontStyle;

	/** Text color */
	color?: string;
}

/**
 * Text shadow properties (separate from box shadow)
 */
interface TextShadowProperties {
	/** Whether text shadow is enabled */
	textShadow?: boolean;

	/** Text shadow color */
	textShadowColor?: string;

	/** Text shadow blur radius */
	textShadowBlur?: number;

	/** Text shadow X offset */
	textShadowOffsetX?: number;

	/** Text shadow Y offset */
	textShadowOffsetY?: number;
}

/**
 * Text stroke properties
 */
interface TextStrokeProperties {
	/** Text stroke color */
	textStrokeColor?: string;

	/** Text stroke width */
	textStrokeWidth?: number;
}

/**
 * Text box specific properties
 */
interface TextBoxProperties {
	/** Horizontal text alignment */
	textAlign?: TextAlign;

	/** Vertical text alignment */
	verticalAlign?: VerticalAlign;

	/** Padding inside the text box */
	padding?: number;

	/** Line height multiplier */
	lineHeight?: number;

	/** Corner radius for rounded boxes */
	cornerRadius?: number;
}

/**
 * Arrow/line specific properties
 */
interface ArrowProperties {
	/** Starting X position */
	x1?: number;

	/** Starting Y position */
	y1?: number;

	/** Ending X position */
	x2?: number;

	/** Ending Y position */
	y2?: number;

	/** Arrow style (head placement: single, double, none) */
	arrowStyle?: ArrowStyle;

	/** Arrow head type (pointed, chevron, standard) */
	headType?: ArrowHeadType;

	/** Arrow head size */
	arrowSize?: number;

	/** Arrow head scale multiplier */
	headScale?: number;

	/** Arrow tail width */
	tailWidth?: number;
}

/**
 * Circle/ellipse specific properties
 */
interface CircleProperties {
	/** Radius for circles */
	radius?: number;

	/** Horizontal radius for ellipses */
	radiusX?: number;

	/** Vertical radius for ellipses */
	radiusY?: number;
}

/**
 * Path/polygon specific properties
 */
interface PathProperties {
	/** Array of points defining the path */
	points?: Point[];
}

/**
 * Image layer specific properties
 */
interface ImageProperties {
	/** Base64 data URL of the image */
	src?: string;

	/** Original width of the source image */
	originalWidth?: number;

	/** Original height of the source image */
	originalHeight?: number;

	/** Whether to preserve aspect ratio when resizing */
	preserveAspectRatio?: boolean;
}

/**
 * Complete Layer type combining all property interfaces
 */
interface Layer extends
	LayerBase,
	LayerStyle,
	ShadowProperties,
	TextProperties,
	TextShadowProperties,
	TextStrokeProperties,
	TextBoxProperties,
	ArrowProperties,
	CircleProperties,
	PathProperties,
	ImageProperties {
	/** Enable glow effect */
	glow?: boolean;
}

// =============================================================================
// Layer Set and Revision Types
// =============================================================================

/**
 * Data structure saved to the server
 */
interface LayerSetData {
	/** Revision number */
	revision: number;

	/** Schema version */
	schema: number;

	/** ISO timestamp when created */
	created: string;

	/** Array of layers */
	layers: Layer[];
}

/**
 * Layer set record from the database
 */
interface LayerSet {
	/** Database ID */
	id: number;

	/** Image filename */
	imgName: string;

	/** User ID who created/modified */
	userId: number;

	/** Timestamp of last modification */
	timestamp: string;

	/** Revision number */
	revision: number;

	/** Name of the layer set */
	name: string;

	/** Parsed layer set data */
	data: LayerSetData;

	/** Base image width */
	baseWidth: number;

	/** Base image height */
	baseHeight: number;
}

/**
 * Revision summary for the revision selector
 */
interface RevisionSummary {
	/** Revision database ID */
	ls_id: number;

	/** Revision number */
	ls_revision: number;

	/** Layer set name */
	ls_name: string;

	/** User ID who created the revision */
	ls_user_id: number;

	/** Timestamp */
	ls_timestamp: string;

	/** Username for display */
	ls_user_name: string;
}

/**
 * Named set summary
 */
interface NamedSetSummary {
	/** Set name */
	name: string;

	/** Number of revisions in this set */
	revision_count: number;

	/** Latest revision number */
	latest_revision: number;

	/** Timestamp of latest revision */
	latest_timestamp: string;

	/** User ID of latest revision creator */
	latest_user_id: number;

	/** Username of latest revision creator */
	latest_user_name: string;
}

// =============================================================================
// API Response Types
// =============================================================================

/**
 * Response from action=layersinfo
 */
interface LayersInfoResponse {
	layersinfo: {
		/** Current layer set (null if none) */
		layerset: LayerSet | null;

		/** All revisions for the image */
		all_layersets: RevisionSummary[];

		/** Named sets summary */
		named_sets: NamedSetSummary[];
	};
}

/**
 * Response from action=layerssave
 */
interface LayersSaveResponse {
	layerssave: {
		/** Success flag */
		success: 1;

		/** Created/updated layer set ID */
		layersetid: number;

		/** Result message */
		result: 'Success';
	};
}

/**
 * Response from action=layersdelete
 */
interface LayersDeleteResponse {
	layersdelete: {
		/** Success flag */
		success: 1;

		/** Number of revisions deleted */
		revisionsDeleted: number;
	};
}

/**
 * Response from action=layersrename
 */
interface LayersRenameResponse {
	layersrename: {
		/** Success flag */
		success: 1;

		/** Old set name */
		oldname: string;

		/** New set name */
		newname: string;
	};
}

// =============================================================================
// Editor Types
// =============================================================================

/**
 * Configuration for LayersEditor
 */
interface LayersEditorConfig {
	/** Name of the file being edited */
	filename: string;

	/** URL of the base image */
	imageUrl: string;

	/** Container element for the editor */
	container: HTMLElement;

	/** Enable debug logging */
	debug?: boolean;
}

/**
 * Tool names supported by the editor
 */
type ToolName =
	| 'pointer'
	| 'select'
	| 'text'
	| 'textbox'
	| 'rectangle'
	| 'circle'
	| 'ellipse'
	| 'arrow'
	| 'line'
	| 'polygon'
	| 'star'
	| 'path'
	| 'blur';

/**
 * History action for undo/redo
 */
interface HistoryAction {
	/** Type of action */
	type: string;

	/** Layers before the action */
	before: Layer[];

	/** Layers after the action */
	after: Layer[];

	/** Optional description */
	description?: string;
}

// =============================================================================
// Canvas Types
// =============================================================================

/**
 * Bounding box for a layer
 */
interface BoundingBox {
	x: number;
	y: number;
	width: number;
	height: number;
}

/**
 * Transform matrix components
 */
interface TransformMatrix {
	a: number;
	b: number;
	c: number;
	d: number;
	e: number;
	f: number;
}

/**
 * Selection handle identifiers
 */
type HandleType =
	| 'nw' | 'n' | 'ne'
	| 'w' | 'e'
	| 'sw' | 's' | 'se'
	| 'rotation';

/**
 * Hit test result
 */
interface HitTestResult {
	/** Layer that was hit (null if none) */
	layer: Layer | null;

	/** Handle that was hit (null if layer body) */
	handle: HandleType | null;

	/** Whether a hit occurred */
	hit: boolean;
}

// =============================================================================
// Event Types
// =============================================================================

/**
 * Custom event detail for layer changes
 */
interface LayerChangeEvent {
	/** Type of change */
	action: 'add' | 'update' | 'delete' | 'reorder';

	/** Affected layer IDs */
	layerIds: string[];

	/** Previous state (for undo) */
	previousState?: Layer[];
}

/**
 * Custom event detail for selection changes
 */
interface SelectionChangeEvent {
	/** Currently selected layer IDs */
	selectedIds: string[];

	/** Previously selected layer IDs */
	previousIds: string[];
}

/**
 * Custom event detail for tool changes
 */
interface ToolChangeEvent {
	/** New tool */
	tool: ToolName;

	/** Previous tool */
	previousTool: ToolName;
}

// =============================================================================
// Global Namespace Declaration
// =============================================================================

/**
 * Global Layers namespace
 */
declare namespace Layers {
	namespace Utils {
		class EventTracker {
			constructor();
			add(element: EventTarget, type: string, handler: EventListener, options?: boolean | AddEventListenerOptions): void;
			remove(element: EventTarget, type: string, handler: EventListener): void;
			getCount(): number;
			destroy(): void;
		}

		function getClass(namespacePath: string, globalName: string): any;
	}

	namespace Shared {
		class LayerDataNormalizer {
			static normalizeLayer(layer: Partial<Layer>): Layer;
			static normalizeBooleans(layer: Partial<Layer>): void;
			static normalizeNumbers(layer: Partial<Layer>): void;
			static normalizeLayers(layers: Partial<Layer>[]): Layer[];
		}

		class LayersValidator {
			constructor();
			validateLayer(layer: Partial<Layer>): { valid: boolean; errors: string[] };
			validateAll(layers: Partial<Layer>[]): { valid: boolean; errors: string[] };
		}
	}

	namespace Core {
		class StateManager {
			constructor(editor: any);
			get(key: string): any;
			set(key: string, value: any): void;
			getLayers(): Layer[];
			subscribe(callback: (state: any) => void): () => void;
			destroy(): void;
		}

		class HistoryManager {
			constructor(editor: any);
			saveState(action: string): void;
			undo(): boolean;
			redo(): boolean;
			canUndo(): boolean;
			canRedo(): boolean;
			destroy(): void;
		}

		class APIManager {
			constructor(editor: any);
			loadLayers(filename: string, options?: { setname?: string }): Promise<LayersInfoResponse>;
			saveLayers(filename: string, layers: Layer[], setname?: string): Promise<LayersSaveResponse>;
			deleteLayerSet(filename: string, setname: string): Promise<LayersDeleteResponse>;
			renameLayerSet(filename: string, oldname: string, newname: string): Promise<LayersRenameResponse>;
			destroy(): void;
		}
	}

	namespace UI {
		class Toolbar {
			constructor(config: { container: HTMLElement; editor: any });
			setActiveTool(tool: ToolName): void;
			updateUndoRedoState(canUndo: boolean, canRedo: boolean): void;
			updateDeleteState(hasSelection: boolean): void;
			destroy(): void;
		}

		class LayerPanel {
			constructor(config: { container: HTMLElement; editor: any });
			updateLayerList(): void;
			selectLayer(layerId: string): void;
			destroy(): void;
		}
	}

	namespace Canvas {
		class CanvasManager {
			constructor(config: { container: HTMLElement; editor: any; backgroundImageUrl: string });
			renderLayers(layers: Layer[]): void;
			getSelectedLayerIds(): string[];
			selectLayer(layerId: string): void;
			deselectAll(): void;
			setBaseDimensions(width: number, height: number): void;
			destroy(): void;
		}
	}
}

// Declare global window augmentation
declare global {
	interface Window {
		Layers: typeof Layers;
		layersRegistry: any;
		layersModuleRegistry: any;
		layersGetClass: (namespacePath: string, globalName: string) => any;
	}
}

export {
	Layer,
	LayerType,
	LayerBase,
	LayerStyle,
	LayerSet,
	LayerSetData,
	LayersEditorConfig,
	ToolName,
	Point,
	BoundingBox,
	HitTestResult,
	HandleType,
	RevisionSummary,
	NamedSetSummary,
	LayersInfoResponse,
	LayersSaveResponse,
	LayersDeleteResponse,
	LayersRenameResponse
};
