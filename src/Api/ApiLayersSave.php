<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Api;

use ApiBase;
use ApiUsageException;
use MediaWiki\Extension\Layers\Api\Traits\ForeignFileHelperTrait;
use MediaWiki\Extension\Layers\Api\Traits\LayerSaveGuardsTrait;
use MediaWiki\Extension\Layers\Security\RateLimiter;
use MediaWiki\Extension\Layers\Validation\ServerSideLayerValidator;
use MediaWiki\Extension\Layers\Validation\SetNameSanitizer;
use MediaWiki\MediaWikiServices;
use Psr\Log\LoggerInterface;
use Title;

/**
 * API module for saving layer data to a MediaWiki file.
 *
 * This module provides a secure endpoint for persisting non-destructive image annotations.
 * It implements a defense-in-depth security model with multiple validation layers:
 *
 * SECURITY ARCHITECTURE:
 * 1. Authentication & Authorization: Requires 'editlayers' right and CSRF token
 * 2. Input Validation: Multi-stage validation of filename, data size, JSON structure
 * 3. Rate Limiting: Prevents abuse via MediaWiki's rate limiter system
 * 4. Data Sanitization: ServerSideLayerValidator enforces strict property whitelists
 * 5. Database Safety: Transaction retry logic with exponential backoff
 * 6. Error Handling: Generic error messages to prevent information disclosure
 *
 * WORKFLOW:
 * 1. Check user permissions ('editlayers' right)
 * 2. Verify database schema is ready
 * 3. Sanitize and validate setname (prevents path traversal, XSS)
 * 4. Validate filename exists in MediaWiki file namespace
 * 5. Check payload size against configured limit
 * 6. Parse and validate JSON structure
 * 7. Run comprehensive layer data validation (40+ field types)
 * 8. Check rate limits to prevent abuse
 * 9. Verify target file exists and extract metadata
 * 10. Save to database with automatic revision incrementing
 * 11. Return success response with new layer set ID
 *
 * DATA MODEL:
 * Client sends: JSON array of layer objects (see data model in copilot-instructions.md)
 * Server stores: Wrapped structure { revision, schema: 1, created, layers: [] }
 *
 * CONFIGURATION:
 * - $wgLayersMaxBytes: Maximum JSON payload size (default 2MB)
 * - $wgLayersMaxLayerCount: Maximum layers per set (default 100)
 * - $wgRateLimits['editlayers-save']: Rate limit configuration
 *
 * ERROR HANDLING:
 * All errors return i18n message keys for consistent client-side display.
 * Internal error details are logged but never exposed to clients (security).
 *
 * @see https://www.mediawiki.org/wiki/Extension:Layers
 * @see ServerSideLayerValidator for validation rules
 * @see LayersDatabase::saveLayerSet() for persistence logic
 */
class ApiLayersSave extends ApiBase {
	use ForeignFileHelperTrait;
	use LayerSaveGuardsTrait;

	/**
	 * Maximum recursion depth for JSON decoding to prevent stack overflow
	 */
	private const JSON_DECODE_MAX_DEPTH = 512;

	/** @var LoggerInterface|null */
	private ?LoggerInterface $logger = null;

	/**
	 * Main execution function for the layerssave API endpoint.
	 *
	 * Implements a comprehensive validation pipeline with defense-in-depth security:
	 * - Permission checks (editlayers right + CSRF token via needsToken())
	 * - Input sanitization (setname, filename, data)
	 * - Size limits (payload bytes, layer count)
	 * - Rate limiting (prevent abuse)
	 * - Schema validation (strict property whitelists)
	 * - Database integrity (retry logic for conflicts)
	 *
	 * SECURITY NOTES:
	 * - All validation errors use i18n keys (never expose internal details)
	 * - Exceptions are caught and logged server-side with full context
	 * - Clients receive generic 'layers-save-failed' on unexpected errors
	 * - This prevents information disclosure attacks
	 *
	 * @throws \ApiUsageException When user lacks permission or data is invalid
	 */
	public function execute() {
		// Get authenticated user and request parameters
		// MediaWiki guarantees $user is valid (anonymous or logged in)
		$user = $this->getUser();
		$params = $this->extractRequestParams();
		$requestedFilename = $params['filename'] ?? null;
		$slidename = $params['slidename'] ?? null;

		// SECURITY: Verify user has editlayers permission
		// This throws ApiUsageException if user lacks the right
		// CSRF token is automatically checked by needsToken() return value
		$this->checkUserRightsAny( 'editlayers' );

		// Handle slide saves (slidename parameter)
		if ( $slidename !== null && $slidename !== '' ) {
			$this->executeSlideSave( $user, $params, $slidename );
			return;
		}

		// Also handle slides when filename starts with 'Slide:' (editor compatibility)
		if ( $requestedFilename !== null && strpos( $requestedFilename, 'Slide:' ) === 0 ) {
			// Remove 'Slide:' prefix
			$slidename = substr( $requestedFilename, 6 );
			$this->executeSlideSave( $user, $params, $slidename );
			return;
		}

		// Require filename for non-slide requests
		if ( $requestedFilename === null || $requestedFilename === '' ) {
			$this->dieWithError(
				[ 'apierror-missingparam', 'filename' ],
				'missingparam'
			);
		}

		try {
			// Get LayersDatabase service via dependency injection
			// Service is wired in services.php with LoadBalancer, Config, Logger, SchemaManager
			$db = MediaWikiServices::getInstance()->get( 'LayersDatabase' );

			// CRITICAL: Verify database schema exists before any operations
			// Prevents cryptic SQL errors if admin hasn't run update.php
			// Schema is created/updated via LayersSchemaManager on LoadExtensionSchemaUpdates hook
			if ( !$db->isSchemaReady() ) {
				$this->dieWithError(
					[ 'layers-db-error', 'Layer tables missing. Please run maintenance/update.php' ],
					'dbschema-missing'
				);
			}

			// Extract parameters from the API request
			$fileName = $requestedFilename;
			$data = $params['data'];
			$rawSetName = $params['setname'] ?? 'default';
			$setName = SetNameSanitizer::sanitize( $rawSetName );

			// Log set name processing via MediaWiki's debug log
			$this->getLogger()->debug(
				'ApiLayersSave: raw setname={rawSetName}, sanitized={setName}, filename={fileName}',
				[
					'rawSetName' => $rawSetName,
					'setName' => $setName,
					'fileName' => $fileName
				]
			);

			// VALIDATION: Ensure filename resolves to a valid File namespace title
			// Title::newFromText normalizes and validates the format, but does not require
			// the file page to exist locally. This allows saving layers on files served
			// from shared repositories (e.g., Wikimedia Commons remotes).
			$title = Title::newFromText( $fileName, NS_FILE );
			if ( !$title || $title->getNamespace() !== NS_FILE ) {
				$this->dieWithError( 'layers-invalid-filename', 'invalidfilename' );
			}

			// Use DB key form for database operations
			// This ensures consistency (spaces -> underscores) across save/load paths
			$fileDbKey = $title->getDBkey();
			if ( $fileDbKey === '' ) {
				$this->dieWithError( 'layers-invalid-filename', 'invalidfilename' );
			}

			// SIZE LIMIT: Check payload size before expensive JSON parsing
			// This prevents DoS attacks via large payloads that could:
			// - Exhaust PHP memory during json_decode()
			// - Fill database with excessive data
			// - Slow down validation of malicious large structures
			// Default: 2MB (configurable via $wgLayersMaxBytes)
			$maxBytes = (int)$this->getConfig()->get( 'LayersMaxBytes' );
			if ( strlen( $data ) > $maxBytes ) {
				$this->dieWithError( 'layers-data-too-large', 'datatoolarge' );
			}

			// PARSE: Decode JSON structure from client
			// Client sends array of layer objects: [{id, type, x, y, ...}, ...]
			// json_decode with associative=true converts to PHP array
			// Using JSON_THROW_ON_ERROR for explicit error handling
			try {
				$rawData = json_decode( $data, true, self::JSON_DECODE_MAX_DEPTH, JSON_THROW_ON_ERROR );
			} catch ( \JsonException $e ) {
				// JSON parsing failed - invalid syntax, encoding issues, or malformed data
				$this->dieWithError( 'layers-json-parse-error', 'invalidjson' );
			}

			// HANDLE BOTH OLD AND NEW DATA FORMATS
			// Old format: array of layers [{id, type, ...}, ...]
			// New format: {layers: [...], backgroundVisible: bool, backgroundOpacity: float}
			$layersData = [];
			$backgroundSettings = [];

			if ( isset( $rawData['layers'] ) && is_array( $rawData['layers'] ) ) {
				// New format with settings
				$layersData = $rawData['layers'];
				// Extract and validate background settings
				$backgroundSettings = [
					'backgroundVisible' => isset( $rawData['backgroundVisible'] )
						? (bool)$rawData['backgroundVisible'] : true,
					'backgroundOpacity' => isset( $rawData['backgroundOpacity'] )
						? max( 0.0, min( 1.0, (float)$rawData['backgroundOpacity'] ) ) : 1.0
				];
			} elseif ( is_array( $rawData ) && !isset( $rawData['layers'] ) ) {
				// Old format: raw layers array (for backwards compatibility)
				$layersData = $rawData;
			}

			// VALIDATION PIPELINE: Comprehensive security-focused validation
			// ServerSideLayerValidator enforces:
			// - Layer count limits ($wgLayersMaxLayerCount, default 100)
			// - Strict property whitelist (40+ allowed fields, see ALLOWED_PROPERTIES)
			// - Type validation (numeric ranges, enum values, boolean conversions)
			// - Sanitization (text XSS prevention, color validation, coordinate bounds)
			// - Duplicate ID detection
			// Unknown properties are SILENTLY DROPPED (not errors)
			$validator = new ServerSideLayerValidator();
			$validationResult = $validator->validateLayers( $layersData );

			// Check for validation errors (structural problems, invalid values)
			if ( !$validationResult->isValid() ) {
				// Combine all error messages with i18n keys for client display
				$errors = implode( '; ', $validationResult->getErrors() );
				$this->dieWithError( [ 'layers-validation-failed', $errors ], 'validationfailed' );
			}

			// Extract sanitized data (validator has cleaned/normalized all fields)
			// This is the data we'll persist to database
			$sanitizedData = $validationResult->getData();
			$layerCount = count( $sanitizedData );

			// Log warnings (non-fatal issues like dropped unknown properties)
			// These are logged server-side but don't block the save operation
			if ( $validationResult->hasWarnings() ) {
				$warnings = implode( '; ', $validationResult->getWarnings() );
				$this->getLogger()->warning(
					'Layers validation warnings: {warnings}',
					[ 'warnings' => $warnings ]
				);
			}

			// RATE LIMITING & SAFEGUARDS: Prevent abuse by limiting save operations per user
			// and enforce configured image/complexity caps before performing expensive work.
			$rateLimiter = $this->createRateLimiter();
			$this->enforceLayerLimits( $rateLimiter, $sanitizedData, $layerCount );
			// Uses MediaWiki's core rate limiter via User::pingLimiter()
			// Configuration in LocalSettings.php:
			//   $wgRateLimits['editlayers-save']['user'] = [ 30, 3600 ]; // 30 saves per hour
			//   $wgRateLimits['editlayers-save']['newbie'] = [ 5, 3600 ]; // stricter for new users
			// Rate limit is checked AFTER validation to avoid wasting limit on invalid data
			if ( !$rateLimiter->checkRateLimit( $user, 'save' ) ) {
				$this->dieWithError( 'layers-rate-limited', 'ratelimited' );
			}

			// FILE VERIFICATION: Ensure target file exists and is accessible
			// RepoGroup handles both local and foreign (wikimedia commons) files
			// This is a secondary check after Title validation
			$repoGroup = MediaWikiServices::getInstance()->getRepoGroup();
			$file = $repoGroup->findFile( $title );
			if ( !$file || !$file->exists() ) {
				$this->dieWithError( 'layers-file-not-found', 'filenotfound' );
			}

			$imgWidth = method_exists( $file, 'getWidth' ) ? (int)$file->getWidth() : 0;
			$imgHeight = method_exists( $file, 'getHeight' ) ? (int)$file->getHeight() : 0;
			$this->enforceImageSizeLimit( $rateLimiter, $imgWidth, $imgHeight );

			// Extract file metadata for database association
			// SHA1: Ensures layers are associated with specific file version
			// MIME: Allows future filtering (e.g., only allow layers on images)
			// If file is replaced, SHA1 changes, creating logical separation
			$sha1 = $file->getSha1();
			$mimeType = $file->getMimeType();

			// Log file metadata for debugging (especially for foreign files)
			$isForeign = $this->isForeignFile( $file );
			$this->getLogger()->info( 'Layers: File metadata', [
				'filename' => $fileDbKey,
				'sha1' => $sha1 ?: '(empty)',
				'sha1Length' => strlen( $sha1 ?? '' ),
				'mime' => $mimeType,
				'isForeign' => $isForeign ? 'yes' : 'no',
				'fileClass' => get_class( $file )
			] );

			// For foreign files, if SHA1 is not available, generate a stable identifier
			// based on the filename. This allows layers to work with foreign files
			// that don't expose SHA1 via the API.
			if ( empty( $sha1 ) && $isForeign ) {
				// Use a hash of the filename as a fallback (prefixed for clarity)
				$sha1 = 'foreign_' . sha1( $fileDbKey );
				$this->getLogger()->warning( 'Layers: Using fallback SHA1 for foreign file', [
					'filename' => $fileDbKey,
					'fallbackSha1' => $sha1
				] );
			}

			$imgMetadata = [
				'mime' => $mimeType,
				'sha1' => $sha1,
			];

			// DATABASE SAVE: Persist layer set with automatic versioning
			// LayersDatabase::saveLayerSet() performs:
			// - Automatic revision number incrementing (per-image counter)
			// - Transaction with retry logic (3 attempts with exponential backoff)
			// - Wraps data in structure: {revision, schema: 1, created, layers: [...],
			//   backgroundVisible, backgroundOpacity}
			// - Calculates and stores size for monitoring/limits
			// Returns: new layer set ID (ls_id) or null on failure
			$layerSetId = $db->saveLayerSet(
				$fileDbKey,
				$imgMetadata,
				$sanitizedData,
				$user->getId(),
				$setName,
				$backgroundSettings
			);

			// Build success response
			if ( $layerSetId ) {
				// CACHE INVALIDATION: Purge caches for the file page and pages embedding this file
				// This ensures pages using [[File:X.jpg|layers=on]] will re-render with new layer data
				// instead of showing stale cached content.
				$this->invalidateCachesForFile( $title );

				// Response format matches MediaWiki API conventions
				// Client can use layersetid to fetch this specific revision later
				$resultData = [
					'success' => 1,
					'layersetid' => $layerSetId,
					'result' => 'Success'
				];
				// Add to result under module name ('layerssave')
				// Client access: response.layerssave.layersetid
				$this->getResult()->addValue( null, $this->getModuleName(), $resultData );
			} else {
				// Database operation failed (unlikely after all validation)
				// Possible causes: disk full, connection loss, constraint violation
				$this->dieWithError( 'layers-save-failed', 'savefailed' );
			}
		} catch ( ApiUsageException $e ) {
			throw $e;
		} catch ( \OverflowException $e ) {
			// Named set limit reached - return specific error for user feedback
			// The exception message contains the i18n key
			$this->dieWithError( $e->getMessage(), 'maxsetsreached' );
		} catch ( \Throwable $e ) {
			// GLOBAL EXCEPTION HANDLER: Catch any unexpected errors
			// This catch block is the last line of defense for:
			// - Database exceptions (connection failures, constraint violations)
			// - PHP errors (out of memory, type errors)
			// - Service initialization failures
			// - Any other unexpected conditions

			// SECURITY CRITICAL: Log full details server-side for debugging
			// Uses MediaWiki's PSR-3 logger which:
			// - Routes to configured log handlers (file, syslog, etc.)
			// - Prevents disk exhaustion (respects log rotation policies)
			// - Includes structured context for monitoring/alerting
			// - Never exposed to clients (prevents information disclosure)
			$this->getLogger()->error(
				'Layer save failed: {message}',
				[
					'message' => $e->getMessage(),
					// Full stack trace for debugging
					'exception' => $e,
					'user_id' => $user->getId(),
					'filename' => $fileName
				]
			);

			// SECURITY CRITICAL: Return generic error message to client
			// NEVER expose:
			// - Database schema details (table names, column names)
			// - File paths (reveals server structure)
			// - Stack traces (reveals code structure, library versions)
			// - Configuration values
			// Generic message prevents attackers from learning about system internals
			$this->dieWithError( 'layers-save-failed', 'savefailed' );
		}
	}

	/**
	 * Handle slide-specific save requests.
	 *
	 * Slides are stored with imgName='Slide:{name}' and sha1='slide'.
	 *
	 * @param \User $user The current user
	 * @param array $params API request parameters
	 * @param string $slidename The slide name (without 'Slide:' prefix)
	 */
	private function executeSlideSave( $user, array $params, string $slidename ): void {
		try {
			$db = MediaWikiServices::getInstance()->get( 'LayersDatabase' );

			if ( !$db->isSchemaReady() ) {
				$this->dieWithError(
					[ 'layers-db-error', 'Layer tables missing. Please run maintenance/update.php' ],
					'dbschema-missing'
				);
			}

			$data = $params['data'];
			$rawSetName = $params['setname'] ?? 'default';
			$setName = SetNameSanitizer::sanitize( $rawSetName );

			// Size limit check
			$maxBytes = (int)$this->getConfig()->get( 'LayersMaxBytes' );
			if ( strlen( $data ) > $maxBytes ) {
				$this->dieWithError( 'layers-data-too-large', 'datatoolarge' );
			}

			// Parse JSON
			try {
				$rawData = json_decode( $data, true, self::JSON_DECODE_MAX_DEPTH, JSON_THROW_ON_ERROR );
			} catch ( \JsonException $e ) {
				$this->dieWithError( 'layers-json-parse-error', 'invalidjson' );
			}

			// Handle both old and new data formats
			$layersData = [];
			$backgroundSettings = [];
			$slideSettings = [];

			if ( isset( $rawData['layers'] ) && is_array( $rawData['layers'] ) ) {
				$layersData = $rawData['layers'];
				$backgroundSettings = [
					'backgroundVisible' => isset( $rawData['backgroundVisible'] )
						? (bool)$rawData['backgroundVisible'] : true,
					'backgroundOpacity' => isset( $rawData['backgroundOpacity'] )
						? max( 0.0, min( 1.0, (float)$rawData['backgroundOpacity'] ) ) : 1.0
				];
				// Extract slide-specific settings
				$slideSettings = [
					'isSlide' => true,
					'canvasWidth' => isset( $rawData['canvasWidth'] )
						? (int)$rawData['canvasWidth'] : 800,
					'canvasHeight' => isset( $rawData['canvasHeight'] )
						? (int)$rawData['canvasHeight'] : 600,
					'backgroundColor' => $rawData['backgroundColor'] ?? '#ffffff'
				];
			} elseif ( is_array( $rawData ) && !isset( $rawData['layers'] ) ) {
				$layersData = $rawData;
			}

			// Validate layers
			$validator = new ServerSideLayerValidator();
			$validationResult = $validator->validateLayers( $layersData );

			if ( !$validationResult->isValid() ) {
				$errors = implode( '; ', $validationResult->getErrors() );
				$this->dieWithError( [ 'layers-validation-failed', $errors ], 'validationfailed' );
			}

			$sanitizedData = $validationResult->getData();
			$layerCount = count( $sanitizedData );

			// Rate limiting
			$rateLimiter = $this->createRateLimiter();
			$this->enforceLayerLimits( $rateLimiter, $sanitizedData, $layerCount );
			if ( !$rateLimiter->checkRateLimit( $user, 'save' ) ) {
				$this->dieWithError( 'layers-rate-limited', 'ratelimited' );
			}

			// Slides use 'Slide:' prefix for imgName and fixed 'slide' sha1
			$normalizedName = 'Slide:' . $slidename;
			$imgMetadata = [
				'mime' => 'application/x-layers-slide',
				'sha1' => 'slide',
			];

			// Merge slide settings into background settings for storage
			$backgroundSettings = array_merge( $backgroundSettings, $slideSettings );

			// Save to database
			$layerSetId = $db->saveLayerSet(
				$normalizedName,
				$imgMetadata,
				$sanitizedData,
				$user->getId(),
				$setName,
				$backgroundSettings
			);

			if ( $layerSetId ) {
				$resultData = [
					'success' => 1,
					'layersetid' => $layerSetId,
					'result' => 'Success'
				];
				$this->getResult()->addValue( null, $this->getModuleName(), $resultData );
			} else {
				$this->dieWithError( 'layers-save-failed', 'savefailed' );
			}
		} catch ( ApiUsageException $e ) {
			throw $e;
		} catch ( \OverflowException $e ) {
			$this->dieWithError( $e->getMessage(), 'maxsetsreached' );
		} catch ( \Throwable $e ) {
			$this->getLogger()->error( 'Slide save failed: {message}', [
				'message' => $e->getMessage(),
				'exception' => $e,
				'user_id' => $user->getId(),
				'slidename' => $slidename
			] );
			$this->dieWithError( 'layers-save-failed', 'savefailed' );
		}
	}

	/**
	 * Factory for RateLimiter to allow overrides in tests.
	 */
	protected function createRateLimiter(): RateLimiter {
		return new RateLimiter();
	}

	/**
	 * Define allowed API parameters with validation rules.
	 *
	 * MediaWiki automatically validates types and required status before execute() runs.
	 *
	 * API CONTRACT:
	 * - filename: Name of file in File: namespace (e.g., "Example.jpg", not "File:Example.jpg")
	 *             MediaWiki normalizes namespace prefixes automatically
	 * - data:     JSON string containing array of layer objects
	 *             Format: '[{"id":"01","type":"text","x":100,"y":50,...}, ...]'
	 *             Server wraps this in structure with revision, schema, created timestamp
	 * - setname:  Optional human-readable label for this layer set revision
	 *             Defaults to "default" if not provided
	 *             Sanitized to prevent XSS and path traversal
	 * - token:    CSRF token (automatically validated by needsToken())
	 *             Client obtains via mw.Api().postWithToken('csrf', ...)
	 *
	 * SECURITY NOTES:
	 * - All parameters are strings (prevents type juggling attacks)
	 * - Additional validation in execute() for each parameter
	 * - Token validation prevents CSRF attacks
	 *
	 * @return array Parameter definitions for MediaWiki API framework
	 */
	public function getAllowedParams() {
		return [
			'filename' => [
				ApiBase::PARAM_TYPE => 'string',
				ApiBase::PARAM_REQUIRED => false,
			],
			'slidename' => [
				ApiBase::PARAM_TYPE => 'string',
				ApiBase::PARAM_REQUIRED => false,
			],
			'data' => [
				ApiBase::PARAM_TYPE => 'string',
				ApiBase::PARAM_REQUIRED => true,
			],
			'setname' => [
				ApiBase::PARAM_TYPE => 'string',
				ApiBase::PARAM_REQUIRED => false,
			],
			'token' => [
				ApiBase::PARAM_TYPE => 'string',
				ApiBase::PARAM_REQUIRED => true,
			],
		];
	}

	/**
	 * Specify token requirement for CSRF protection.
	 *
	 * Returning 'csrf' tells MediaWiki to:
	 * 1. Require a valid CSRF token in the 'token' parameter
	 * 2. Automatically validate the token before calling execute()
	 * 3. Reject requests with missing, invalid, or expired tokens
	 *
	 * SECURITY: This prevents Cross-Site Request Forgery attacks where
	 * malicious sites try to make requests on behalf of logged-in users.
	 *
	 * CLIENT USAGE:
	 *   var api = new mw.Api();
	 *   api.postWithToken('csrf', {
	 *     action: 'layerssave',
	 *     filename: 'Example.jpg',
	 *     data: JSON.stringify(layersArray)
	 *   });
	 *
	 * The token is automatically fetched and included by mw.Api().
	 *
	 * @return string Type of token required ('csrf' for write operations)
	 */
	public function needsToken() {
		return 'csrf';
	}

	/**
	 * Indicate this module performs write operations.
	 *
	 * Returning true tells MediaWiki that this module:
	 * 1. Modifies server-side data (database writes)
	 * 2. Must be called via POST (not GET) for HTTP semantics
	 * 3. Requires authentication (anonymous users see permission error)
	 * 4. Should not be cached by proxies or browsers
	 * 5. Counts against rate limits
	 *
	 * MediaWiki enforces these restrictions automatically.
	 *
	 * READ-ONLY vs WRITE MODE:
	 * - ApiLayersInfo: isWriteMode() = false (just reads data)
	 * - ApiLayersSave:  isWriteMode() = true (writes to database)
	 *
	 * @return bool True since this module modifies data
	 */
	public function isWriteMode() {
		return true;
	}

	/**
	 * This module must be called via HTTP POST.
	 *
	 * Defense-in-depth: While needsToken() already requires CSRF validation,
	 * explicitly requiring POST prevents potential edge cases where GET requests
	 * might bypass token validation.
	 *
	 * @return bool True to require POST method
	 */
	public function mustBePosted() {
		return true;
	}

	/**
	 * Provide example API calls for documentation and testing.
	 *
	 * These examples appear on Special:ApiHelp/layerssave and in API docs.
	 * Each example shows:
	 * - Complete API call syntax
	 * - Required parameters
	 * - Data format
	 *
	 * The example shows a minimal layer set with one text layer.
	 * Real-world usage would include more layer properties:
	 * - fontSize, fontFamily, color for text
	 * - stroke, fill, strokeWidth for shapes
	 * - opacity, blendMode for effects
	 * See ServerSideLayerValidator::ALLOWED_PROPERTIES for full field list.
	 *
	 * MESSAGE KEY:
	 * The value 'apihelp-layerssave-example-1' maps to i18n/en.json
	 * for localized example descriptions.
	 *
	 * @return array Array of example API calls with descriptions
	 */
	public function getExamplesMessages() {
		return [
			'action=layerssave&filename=Example.jpg&data=' .
				'[{"id":"1","type":"text","text":"Hello","x":100,"y":50}]&token=123ABC' =>
				'apihelp-layerssave-example-1',
		];
	}

	/**
	 * Lazily resolve the Layers-specific logger.
	 */
	protected function getLogger(): LoggerInterface {
		if ( $this->logger === null ) {
			$this->logger = MediaWikiServices::getInstance()->get( 'LayersLogger' );
		}
		return $this->logger;
	}

	/**
	 * Invalidate parser caches for the file page and pages embedding this file.
	 *
	 * When layers are saved, we need to ensure that:
	 * 1. The File: page itself is purged so it shows updated layer data
	 * 2. All pages embedding this file via [[File:X.jpg|layers=on]] are purged
	 *    so they re-render with the new layer data instead of stale cached content
	 *
	 * Uses a hybrid approach for reliability:
	 * - File page is purged synchronously (fast, needed immediately)
	 * - Backlink pages are purged via job queue (prevents race conditions, handles many pages)
	 *
	 * @param Title $fileTitle The title of the file whose layers were saved
	 */
	protected function invalidateCachesForFile( Title $fileTitle ): void {
		try {
			$services = MediaWikiServices::getInstance();

			// 1. Purge the File: page itself synchronously (fast, always needed)
			$wikiPage = $services->getWikiPageFactory()->newFromTitle( $fileTitle );
			if ( $wikiPage->exists() ) {
				$wikiPage->doPurge();
			}

			// 2. Queue job to purge all pages embedding this file
			// Using HTMLCacheUpdateJob ensures:
			// - No race condition with client navigation
			// - Handles images embedded in many pages (no artificial limit)
			// - MediaWiki handles batching and retries automatically
			try {
				$job = \HTMLCacheUpdateJob::newForBacklinks(
					$fileTitle,
					'imagelinks',
					[ 'causeAction' => 'layers-save', 'causeAgent' => $this->getUser()->getName() ]
				);
				$services->getJobQueueGroup()->lazyPush( $job );

				$this->getLogger()->debug(
					'Queued cache invalidation job for file: {filename}',
					[ 'filename' => $fileTitle->getText() ]
				);
			} catch ( \Throwable $e ) {
				// Fallback to synchronous purge of limited backlinks if job queue fails
				$this->getLogger()->debug(
					'Job queue unavailable, falling back to synchronous purge: {error}',
					[ 'error' => $e->getMessage() ]
				);
				$this->purgeBacklinksSynchronously( $fileTitle, $services );
			}
		} catch ( \Throwable $e ) {
			// Log but don't fail the save operation
			$this->getLogger()->warning(
				'Failed to invalidate caches for file: {filename}, error: {error}',
				[
					'filename' => $fileTitle->getText(),
					'error' => $e->getMessage()
				]
			);
		}
	}

	/**
	 * Maximum number of backlinks to purge synchronously
	 * This is a fallback limit when job queue is unavailable
	 */
	private const SYNC_BACKLINK_PURGE_LIMIT = 100;

	/**
	 * Fallback: Purge backlinks synchronously when job queue is unavailable
	 *
	 * @param Title $fileTitle The file title
	 * @param MediaWikiServices $services Service container
	 */
	private function purgeBacklinksSynchronously( Title $fileTitle, MediaWikiServices $services ): void {
		$backlinkCache = $services->getBacklinkCacheFactory()->getBacklinkCache( $fileTitle );
		$backlinkTitles = $backlinkCache->getLinkPages(
			'imagelinks',
			null,
			self::SYNC_BACKLINK_PURGE_LIMIT
		);

		$purgedCount = 0;
		foreach ( $backlinkTitles as $backlinkTitle ) {
			$backlinkPage = $services->getWikiPageFactory()->newFromTitle( $backlinkTitle );
			if ( $backlinkPage->exists() ) {
				$backlinkPage->doPurge();
				$purgedCount++;
			}
		}

		$this->getLogger()->debug(
			'Synchronously purged {count} backlinks for file: {filename}',
			[ 'count' => $purgedCount, 'filename' => $fileTitle->getText() ]
		);
	}
}
