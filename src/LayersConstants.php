<?php

declare( strict_types=1 );

/**
 * Central constants for the Layers extension.
 *
 * This file consolidates magic strings that were previously scattered across
 * multiple files, reducing the risk of typos and making changes easier.
 *
 * @file
 * @ingroup Extensions
 */

namespace MediaWiki\Extension\Layers;

/**
 * Central repository for Layers extension constants.
 *
 * USAGE:
 * - Import: `use MediaWiki\Extension\Layers\LayersConstants;`
 * - Reference: `LayersConstants::DEFAULT_SET_NAME`
 *
 * @package MediaWiki\Extension\Layers
 */
class LayersConstants {

	/**
	 * Default layer set name used when no set name is specified.
	 */
	public const DEFAULT_SET_NAME = 'default';

	/**
	 * Slide type identifier used in the database (ls_img_sha1 column).
	 */
	public const TYPE_SLIDE = 'slide';

	/**
	 * Prefix for slide image names in the database (ls_img_name column).
	 * Full slide name format: "Slide:SlideName"
	 */
	public const SLIDE_PREFIX = 'Slide:';

	/**
	 * Parser function name for rendering slides in wikitext.
	 */
	public const PARSER_FUNCTION_SLIDE = 'Slide';

	// ========================================================================
	// Error message keys (for i18n)
	// ========================================================================

	/**
	 * Error: File not found
	 */
	public const ERROR_FILE_NOT_FOUND = 'layers-file-not-found';

	/**
	 * Error: Layer set not found
	 */
	public const ERROR_LAYERSET_NOT_FOUND = 'layers-layerset-not-found';

	/**
	 * Error: Invalid data format
	 */
	public const ERROR_INVALID_DATA = 'layers-invalid-data';

	/**
	 * Error: Data too large
	 */
	public const ERROR_DATA_TOO_LARGE = 'layers-data-too-large';

	/**
	 * Error: JSON parse error
	 */
	public const ERROR_JSON_PARSE = 'layers-json-parse-error';

	/**
	 * Error: Save failed
	 */
	public const ERROR_SAVE_FAILED = 'layers-save-failed';

	/**
	 * Error: Delete failed
	 */
	public const ERROR_DELETE_FAILED = 'layers-delete-failed';

	/**
	 * Error: Rate limited
	 */
	public const ERROR_RATE_LIMITED = 'layers-rate-limited';

	/**
	 * Error: Max named sets reached
	 */
	public const ERROR_MAX_SETS_REACHED = 'layers-max-sets-reached';

	/**
	 * Error: Invalid set name
	 */
	public const ERROR_INVALID_SETNAME = 'layers-invalid-setname';

	/**
	 * Error: Invalid filename
	 */
	public const ERROR_INVALID_FILENAME = 'layers-invalid-filename';

	/**
	 * Error: Validation failed
	 */
	public const ERROR_VALIDATION_FAILED = 'layers-validation-failed';

	/**
	 * Error: Database error
	 */
	public const ERROR_DB = 'layers-db-error';

	/**
	 * Error: Slides feature disabled
	 */
	public const ERROR_SLIDES_DISABLED = 'layers-slides-disabled';

	/**
	 * Error: Slide save failed
	 */
	public const ERROR_SLIDE_SAVE = 'layers-slide-save-error';

	/**
	 * Error: Too many layers
	 */
	public const ERROR_TOO_MANY_LAYERS = 'layers-too-many-layers';

	/**
	 * Error: Layer too complex
	 */
	public const ERROR_TOO_COMPLEX = 'layers-too-complex';

	/**
	 * Error: Image too large
	 */
	public const ERROR_IMAGE_TOO_LARGE = 'layers-image-too-large';

	/**
	 * Error: Cannot rename to 'default'
	 */
	public const ERROR_CANNOT_RENAME_DEFAULT = 'layers-cannot-rename-to-default';

	/**
	 * Error: Set name already exists
	 */
	public const ERROR_SETNAME_EXISTS = 'layers-setname-exists';

	/**
	 * Error: Rename permission denied
	 */
	public const ERROR_RENAME_PERMISSION_DENIED = 'layers-rename-permission-denied';

	/**
	 * Error: Rename failed
	 */
	public const ERROR_RENAME_FAILED = 'layers-rename-failed';

	/**
	 * Error: Delete permission denied
	 */
	public const ERROR_DELETE_PERMISSION_DENIED = 'layers-delete-permission-denied';

	/**
	 * Error: Database schema missing
	 */
	public const ERROR_SCHEMA_MISSING = 'dbschema-missing';

	// ========================================================================
	// Rate limit keys
	// ========================================================================

	/**
	 * Rate limit key for save operations
	 */
	public const RATE_LIMIT_SAVE = 'editlayers-save';

	/**
	 * Rate limit key for render operations
	 */
	public const RATE_LIMIT_RENDER = 'editlayers-render';

	/**
	 * Rate limit key for create operations
	 */
	public const RATE_LIMIT_CREATE = 'editlayers-create';

	// ========================================================================
	// Database table names (without prefix)
	// ========================================================================

	/**
	 * Main layer sets table
	 */
	public const TABLE_LAYER_SETS = 'layer_sets';

	/**
	 * Layer set usage tracking table
	 */
	public const TABLE_LAYER_SET_USAGE = 'layer_set_usage';

	/**
	 * Layer assets table
	 */
	public const TABLE_LAYER_ASSETS = 'layer_assets';

	// ========================================================================
	// Config keys (matches extension.json)
	// ========================================================================

	/**
	 * Config: Maximum bytes per layer set JSON
	 */
	public const CONFIG_MAX_BYTES = 'LayersMaxBytes';

	/**
	 * Config: Maximum layers per set
	 */
	public const CONFIG_MAX_LAYER_COUNT = 'LayersMaxLayerCount';

	/**
	 * Config: Maximum named sets per image
	 */
	public const CONFIG_MAX_NAMED_SETS = 'LayersMaxNamedSets';

	/**
	 * Config: Maximum revisions per set
	 */
	public const CONFIG_MAX_REVISIONS_PER_SET = 'LayersMaxRevisionsPerSet';

	/**
	 * Config: Maximum image bytes for imported images
	 */
	public const CONFIG_MAX_IMAGE_BYTES = 'LayersMaxImageBytes';

	/**
	 * Prevent instantiation - this is a constants-only class.
	 */
	private function __construct() {
	}
}
