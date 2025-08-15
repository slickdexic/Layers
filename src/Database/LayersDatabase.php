<?php
/**
 * Database operations for the Layers extension
 *
 * @file
 * @ingroup Extensions
 */

namespace MediaWiki\Extension\Layers\Database;

use Psr\Log\LoggerInterface;

class LayersDatabase {
	// NOTE: This class does not implement a migration/versioning system for schema changes.
	//       All schema changes must be applied manually via SQL patches.
	//       Foreign key constraints are defined in the schema for referential integrity.

	/** @var mixed */
	private $loadBalancer;

	/** @var mixed */
	private $dbw;

	/** @var mixed */
	private $dbr;

	/** @var LoggerInterface */
	private $logger;

	/** @var \Config */
	private $config;

	/** @var array Cache for layer sets to avoid repeated queries */
	private $layerSetCache = [];

	/** @var int Maximum cache size */
	private const MAX_CACHE_SIZE = 100;

	/** @var array Cached table->columns map for schema checks */
	private $tableColumnsCache = [];

	/**
	 * Constructor for LayersDatabase
	 * Initializes database connections and logger when available
	 */
	public function __construct() {
		$this->loadBalancer = null;
		$this->dbw = null;
		$this->dbr = null;

		// Initialize logger when available; tolerate non-MW static analysis contexts
		if ( class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
			$this->logger = \call_user_func( [ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ], 'Layers' );
		}

		// Initialize config when available
		if ( class_exists( '\\MediaWiki\\MediaWikiServices' ) ) {
			$this->config = \MediaWiki\MediaWikiServices::getInstance()->getMainConfig();
		}
	}

	/**
	 * Lazy-load MediaWiki DB load balancer
	 *
	 * @return mixed Database load balancer instance or null if not available
	 */
	private function getLoadBalancer() {
		if ( $this->loadBalancer ) {
			return $this->loadBalancer;
		}
		$services = \is_callable( [ '\\MediaWiki\\MediaWikiServices', 'getInstance' ] )
			? \call_user_func( [ '\\MediaWiki\\MediaWikiServices', 'getInstance' ] )
			: null;
		$this->loadBalancer = $services ? $services->getDBLoadBalancer() : null;
		return $this->loadBalancer;
	}

	/**
	 * Get write database connection with fallback for different MediaWiki versions
	 *
	 * @return mixed Database write connection or null if not available
	 */
	private function getWriteDb() {
		if ( $this->dbw ) {
			return $this->dbw;
		}
		$lb = $this->getLoadBalancer();
		if ( !$lb ) {
			return null;
		}
		if ( defined( 'DB_PRIMARY' ) ) {
			$this->dbw = $lb->getConnection( DB_PRIMARY );
		} elseif ( defined( 'DB_MASTER' ) ) {
			// Fallback for older MediaWiki versions
			$this->dbw = $lb->getConnection( DB_PRIMARY );
		} else {
			$this->dbw = $lb->getConnection( 0 );
		}
		return $this->dbw;
	}

	/**
	 * Get read database connection with fallback for different MediaWiki versions
	 *
	 * @return mixed Database read connection or null if not available
	 */
	private function getReadDb() {
		if ( $this->dbr ) {
			return $this->dbr;
		}
		$lb = $this->getLoadBalancer();
		if ( !$lb ) {
			return null;
		}
		if ( defined( 'DB_REPLICA' ) ) {
			$this->dbr = $lb->getConnection( DB_REPLICA );
		} elseif ( defined( 'DB_SLAVE' ) ) {
			// Fallback for older MediaWiki versions
			$this->dbr = $lb->getConnection( DB_REPLICA );
		} else {
			$this->dbr = $lb->getConnection( 1 );
		}
		return $this->dbr;
	}

	/**
	 * Save a layer set to the database
	 *
	 * @param string $imgName Image filename
	 * @param string $majorMime Major MIME type
	 * @param string $minorMime Minor MIME type
	 * @param string $sha1 Image SHA1 hash
	 * @param array $layersData Layer data to save
	 * @param int $userId User ID performing the save
	 * @param string|null $setName Optional name for the layer set
	 * @return int|false Layer set ID on success, false on failure
	 */
	public function saveLayerSet(
		string $imgName,
		string $majorMime,
		string $minorMime,
		string $sha1,
		array $layersData,
		int $userId,
		?string $setName = null
	) {
		try {
			$dbw = $this->getWriteDb();
			if ( !$dbw ) {
				return false;
			}

			// Input validation
			if ( empty( $imgName ) || empty( $sha1 ) || $userId <= 0 ) {
				$this->logError( 'Invalid parameters for saveLayerSet', [
					'imgName' => $imgName,
					'sha1' => $sha1,
					'userId' => $userId
				] );
				return false;
			}

			// Audit log for layer set save
			if ( $this->logger ) {
				$this->logger->info( 'Layer set saved', [
					'imgName' => $imgName,
					'userId' => $userId,
					'revision' => isset( $revision ) ? $revision : null,
					'timestamp' => isset( $timestamp ) ? $timestamp : null,
					'setName' => $setName
				] );
			}

			// Start transaction for data consistency
			$dbw->startAtomic( __METHOD__ );

			// Get next revision number for this image with retry logic for race conditions
			$maxRetries = 3;
			$retryCount = 0;
			$revision = null;
			$layerSetId = null;

			while ( $retryCount < $maxRetries ) {
				try {
					$revision = $this->getNextRevision( $imgName, $sha1, $dbw );
					$timestamp = $dbw->timestamp();

					// Prepare JSON data with strict validation and memory protection
					$jsonBlob = $this->validateAndPrepareJsonBlob( $layersData, $revision, $timestamp );
					if ( $jsonBlob === false ) {
						$dbw->endAtomic( __METHOD__ );
						$this->logError( 'JSON validation failed for layer set' );
						return false;
					}

					// Additional memory protection: Check encoded size before proceeding
					$dataSize = strlen( $jsonBlob );
					$maxAllowedSize = 2097152; // Default 2MB limit
					if ( $this->config ) {
						$maxAllowedSize = $this->config->get( 'LayersMaxBytes' ) ?: $maxAllowedSize;
					}
					if ( $dataSize > $maxAllowedSize ) {
						$dbw->endAtomic( __METHOD__ );
						$this->logError( "JSON blob size ({$dataSize} bytes) exceeds maximum allowed size ({$maxAllowedSize} bytes)" );
						return false;
					}

					// Debug: Log what we're about to save (only in debug mode to prevent log spam)
					if ( function_exists( 'error_log' ) && defined( 'MW_LAYERS_DEBUG' ) && MW_LAYERS_DEBUG ) {
						error_log( 'Layers: Saving JSON blob: ' . substr( $jsonBlob, 0, 500 ) . '...' );
					}

					// Calculate size and layer count for performance tracking
					$layerCount = count( $layersData );

					// Build insert row with backward-compat for older schemas (without ls_size / ls_layer_count)
					$row = [
						'ls_img_name' => $imgName,
						'ls_img_major_mime' => $majorMime,
						'ls_img_minor_mime' => $minorMime,
						'ls_img_sha1' => $sha1,
						'ls_json_blob' => $jsonBlob,
						'ls_user_id' => $userId,
						'ls_timestamp' => $timestamp,
						'ls_revision' => $revision,
						'ls_name' => $setName
					];

					$hasSize = $this->tableHasColumn( 'layer_sets', 'ls_size' );
					$hasCount = $this->tableHasColumn( 'layer_sets', 'ls_layer_count' );
					if ( $hasSize ) {
						$row['ls_size'] = $dataSize;
					} elseif ( $this->logger ) {
						$this->logger->warning( 'layer_sets.ls_size missing – schema update needed; inserting without it' );
					}
					if ( $hasCount ) {
						$row['ls_layer_count'] = $layerCount;
					} elseif ( $this->logger ) {
						$this->logger->warning(
							'layer_sets.ls_layer_count missing – schema update needed; inserting without it'
						);
					}

					// Insert layer set
					try {
						$dbw->insert( 'layer_sets', $row, __METHOD__ );
					} catch ( \Throwable $ex ) {
						// Be maximally defensive: drop optional perf columns and retry once regardless of message
						$hadSize = isset( $row['ls_size'] );
						$hadCount = isset( $row['ls_layer_count'] );
						unset( $row['ls_size'], $row['ls_layer_count'] );
						if ( $this->logger ) {
							$this->logger->warning( 'Insert failed, retrying without optional columns', [ 'dropped_ls_size' => $hadSize, 'dropped_ls_layer_count' => $hadCount, 'error' => $ex->getMessage() ] );
						}
						try {
							$dbw->insert( 'layer_sets', $row, __METHOD__ );
						} catch ( \Throwable $ex2 ) {
							throw $ex2; // Bubble up if even the minimal insert fails
						}
					}

					$layerSetId = $dbw->insertId();
					break; // Success, exit retry loop

				} catch ( \Exception $e ) {
					// Check if this is a duplicate key error (race condition)
					if ( strpos( strtolower( $e->getMessage() ), 'duplicate' ) !== false ||
						 strpos( strtolower( $e->getMessage() ), 'unique' ) !== false ) {
						$retryCount++;
						if ( $retryCount >= $maxRetries ) {
							$dbw->endAtomic( __METHOD__ );
							$this->logError( 'Race condition detected, max retries exceeded: ' . $e->getMessage() );
							return false;
						}
						// Log and retry with new revision number
						$this->logError( 'Race condition detected, retrying (attempt ' . ( $retryCount + 1 ) . '): ' . $e->getMessage() );
						continue;
					} else {
						// Non-duplicate error, don't retry
						throw $e;
					}
				}
			}

			$dbw->endAtomic( __METHOD__ );

			// Clear relevant cache entries
			$this->clearCache( $imgName );

			return $layerSetId;

		} catch ( \Throwable $e ) {
			if ( isset( $dbw ) ) {
				$dbw->endAtomic( __METHOD__ );
			}
			$this->logError( 'Failed to save layer set: ' . $e->getMessage() );
			return false;
		}
	}

	/**
	 * Get layer set by ID with caching
	 *
	 * @param int $layerSetId Layer set ID
	 * @return array|false Layer set data or false if not found
	 */
	public function getLayerSet( int $layerSetId ) {
		// Validate input to prevent cache poisoning
		if ( $layerSetId <= 0 || $layerSetId > PHP_INT_MAX ) {
			$this->logError( 'Invalid layer set ID provided: ' . $layerSetId );
			return false;
		}

		// Check cache first with sanitized key
		$cacheKey = $this->sanitizeCacheKey( 'layerset_' . $layerSetId );
		if ( isset( $this->layerSetCache[$cacheKey] ) ) {
			return $this->layerSetCache[$cacheKey];
		}

		try {
			$dbr = $this->getReadDb();
			if ( !$dbr ) {
				return false;
			}

			$row = $dbr->selectRow(
				'layer_sets',
				[
					'ls_id',
					'ls_img_name',
					'ls_json_blob',
					'ls_user_id',
					'ls_timestamp',
					'ls_revision',
					'ls_name'
				],
				[ 'ls_id' => $layerSetId ],
				__METHOD__
			);

		if ( !$row ) {
			// Cache negative results to avoid repeated queries
			$this->addToCache( $cacheKey, false );
			return false;
		}

		// Check JSON blob size before attempting to decode to prevent memory exhaustion attacks
		$jsonBlobSize = strlen( $row->ls_json_blob );
		$maxJsonSize = 2097152; // Default 2MB limit
		if ( $this->config ) {
			$maxJsonSize = $this->config->get( 'LayersMaxBytes' ) ?: $maxJsonSize;
		}

		if ( $jsonBlobSize > $maxJsonSize ) {
			$this->logError( "JSON blob too large for layer set ID: {$layerSetId}, size: {$jsonBlobSize} bytes" );
			return false;
		}

		// Validate JSON structure before decoding to catch malformed data early
		if ( !$this->isValidJsonStructure( $row->ls_json_blob ) ) {
			$this->logError( "Invalid JSON structure for layer set ID: {$layerSetId}" );
			return false;
		}

		$jsonData = json_decode( $row->ls_json_blob, true );
		if ( $jsonData === null ) {
			$this->logError( 'Invalid JSON in layer set ID: ' . $layerSetId );
			return false;
		}			$result = [
				'id' => (int)$row->ls_id,
				'imgName' => $row->ls_img_name,
				'userId' => (int)$row->ls_user_id,
				'timestamp' => $row->ls_timestamp,
				'revision' => (int)$row->ls_revision,
				'name' => $row->ls_name,
				'data' => $jsonData
			];

			// Cache the result
			$this->addToCache( $cacheKey, $result );
			return $result;

		} catch ( \Throwable $e ) {
			$this->logError( 'Failed to get layer set: ' . $e->getMessage() );
			return false;
		}
	}

	/**
	 * Get latest layer set for an image
	 *
	 * @param string $imgName Image filename
	 * @param string $sha1 Image SHA1 hash
	 * @return array|false Layer set data or false if not found
	 */
	public function getLatestLayerSet( string $imgName, string $sha1 ) {
		$dbr = $this->getReadDb();
		if ( !$dbr ) {
			return false;
		}
		$row = $dbr->selectRow(
			'layer_sets',
			[
				'ls_id',
				'ls_json_blob',
				'ls_user_id',
				'ls_timestamp',
				'ls_revision',
				'ls_name'
			],
			[
				'ls_img_name' => $imgName,
				'ls_img_sha1' => $sha1
			],
			__METHOD__,
			[ 'ORDER BY' => 'ls_revision DESC' ]
		);

		if ( !$row ) {
			return false;
		}

		// Check JSON blob size before attempting to decode to prevent memory exhaustion attacks
		$jsonBlobSize = strlen( $row->ls_json_blob );
		$maxJsonSize = 2097152; // Default 2MB limit
		if ( $this->config ) {
			$maxJsonSize = $this->config->get( 'LayersMaxBytes' ) ?: $maxJsonSize;
		}

		if ( $jsonBlobSize > $maxJsonSize ) {
			$this->logError( "JSON blob too large for latest layer set, size: {$jsonBlobSize} bytes" );
			return false;
		}

		// Validate JSON structure before decoding
		if ( !$this->isValidJsonStructure( $row->ls_json_blob ) ) {
			$this->logError( "Invalid JSON structure for latest layer set" );
			return false;
		}

		$jsonData = json_decode( $row->ls_json_blob, true );
		if ( $jsonData === null ) {
			return false;
		}

		return [
			'id' => (int)$row->ls_id,
			'imgName' => $imgName,
			'userId' => (int)$row->ls_user_id,
			'timestamp' => $row->ls_timestamp,
			'revision' => (int)$row->ls_revision,
			'name' => $row->ls_name,
			'data' => $jsonData
		];
	}

	/**
	 * Get next revision number for an image using atomic operations to prevent race conditions
	 *
	 * @param string $imgName Image filename
	 * @param string $sha1 Image SHA1 hash
	 * @param \Wikimedia\Rdbms\IDatabase $dbw Write database connection (must be in transaction)
	 * @return int Next revision number
	 */
	private function getNextRevision( string $imgName, string $sha1, $dbw ): int {
		// Use write connection for consistent reads within transaction
		// This prevents race conditions by ensuring we see all committed data
		$maxRevision = $dbw->selectField(
			'layer_sets',
			'MAX(ls_revision)',
			[
				'ls_img_name' => $imgName,
				'ls_img_sha1' => $sha1
			],
			__METHOD__,
			[ 'FOR UPDATE' ] // Lock the rows to prevent concurrent modifications
		);

		return $maxRevision ? (int)$maxRevision + 1 : 1;
	}

	/**
	 * Get all layer sets for an image
	 *
	 * @param string $imgName Image filename
	 * @param string $sha1 Image SHA1 hash
	 * @return array Array of layer set data
	 */
	public function getLayerSetsForImage( string $imgName, string $sha1 ): array {
		$dbr = $this->getReadDb();
		if ( !$dbr ) {
			return [];
		}
		$result = $dbr->select(
			'layer_sets',
			[
				'ls_id',
				'ls_json_blob',
				'ls_revision',
				'ls_name',
				'ls_user_id',
				'ls_timestamp'
			],
			[
				'ls_img_name' => $imgName,
				'ls_img_sha1' => $sha1
			],
			__METHOD__,
			[ 'ORDER BY' => 'ls_revision DESC' ]
		);

		$layerSets = [];
		foreach ( $result as $row ) {
			$layerSets[] = [
				'ls_id' => (int)$row->ls_id,
				'ls_json_blob' => $row->ls_json_blob,
				'ls_revision' => (int)$row->ls_revision,
				'ls_name' => $row->ls_name,
				'ls_user_id' => (int)$row->ls_user_id,
				'ls_timestamp' => $row->ls_timestamp
			];
		}

		return $layerSets;
	}

	/**
	 * Delete layer sets for an image (called when image is deleted)
	 *
	 * @param string $imgName Image filename
	 * @param string $sha1 Image SHA1 hash
	 * @return bool Success
	 */
	public function deleteLayerSetsForImage( string $imgName, string $sha1 ): bool {
		try {
			$dbw = $this->getWriteDb();
			if ( !$dbw ) {
				return false;
			}
			$dbw->delete(
				'layer_sets',
				[
					'ls_img_name' => $imgName,
					'ls_img_sha1' => $sha1
				],
				__METHOD__
			);
			// Audit log for layer set delete
			if ( $this->logger ) {
				$this->logger->info( 'Layer sets deleted for image', [
					'imgName' => $imgName,
					'sha1' => $sha1
				] );
			}
			return true;
		} catch ( \Throwable $e ) {
			if ( $this->logger ) {
				$this->logger->warning( 'Failed to delete layer sets: {message}', [ 'message' => $e->getMessage() ] );
			}
			return false;
		}
	}

	/**
	 * Cleanup orphaned layer sets (for files that no longer exist)
	 * This should be run periodically by a maintenance script.
	 * @return int Number of deleted orphaned layer sets
	 */
	public function cleanupOrphanedLayerSets(): int {
		$dbw = $this->getWriteDb();
		if ( !$dbw ) {
			return 0;
		}
		// NOTE: This is a placeholder. Actual implementation should check against the MediaWiki file table.
		// For now, this is a stub for future development.
		return 0;
	}

	/**
	 * Get a layer set by name
	 *
	 * @param string $imgName Image filename
	 * @param string $sha1 Image SHA1 hash
	 * @param string $setName Layer set name
	 * @return array|null Layer set data or null if not found
	 */
	public function getLayerSetByName( string $imgName, string $sha1, string $setName ): ?array {
		try {
			$dbr = $this->getReadDb();
			if ( !$dbr ) {
				return null;
			}
			$res = $dbr->selectRow(
				'layer_sets',
				[
					'ls_id',
					'ls_img_name',
					'ls_img_sha1',
					'ls_img_major_mime',
					'ls_img_minor_mime',
					'ls_revision',
					'ls_json_blob',
					'ls_timestamp',
					'ls_user_id',
					'ls_name'
				],
				[
					'ls_img_name' => $imgName,
					'ls_img_sha1' => $sha1,
					'ls_name' => $setName
				],
				__METHOD__,
				[ 'ORDER BY' => 'ls_revision DESC' ]
			);

			if ( !$res ) {
				return null;
			}

			// Check JSON blob size before attempting to decode to prevent memory exhaustion attacks
			$jsonBlobSize = strlen( $res->ls_json_blob );
			$maxJsonSize = 2097152; // Default 2MB limit
			if ( $this->config ) {
				$maxJsonSize = $this->config->get( 'LayersMaxBytes' ) ?: $maxJsonSize;
			}

			if ( $jsonBlobSize > $maxJsonSize ) {
				$this->logError( "JSON blob too large for layer set by name, size: {$jsonBlobSize} bytes" );
				return null;
			}

			// Validate JSON structure before decoding
			if ( !$this->isValidJsonStructure( $res->ls_json_blob ) ) {
				$this->logError( "Invalid JSON structure for layer set by name" );
				return null;
			}

			$jsonData = json_decode( $res->ls_json_blob, true );
			if ( $jsonData === null ) {
				$this->logError( "Invalid JSON data for layer set by name" );
				return null;
			}

			return [
				'id' => (int)$res->ls_id,
				'imgName' => $res->ls_img_name,
				'imgSha1' => $res->ls_img_sha1,
				'majorMime' => $res->ls_img_major_mime,
				'minorMime' => $res->ls_img_minor_mime,
				'revision' => (int)$res->ls_revision,
				'data' => $jsonData,
				'timestamp' => $res->ls_timestamp,
				'userId' => (int)$res->ls_user_id,
				'setName' => $res->ls_name
			];
		} catch ( \Throwable $e ) {
					if ( $this->logger ) {
						$this->logger->warning(
							'Failed to get layer set by name: {message}',
							[ 'message' => $e->getMessage() ]
						);
					}
			return null;
		}
	}

	/**
	 * Add item to cache with size management
	 *
	 * @param string $key Cache key
	 * @param mixed $value Value to cache
	 */
	private function addToCache( string $key, $value ): void {
		// Sanitize cache key to prevent attacks
		$sanitizedKey = $this->sanitizeCacheKey( $key );

		// Manage cache size to prevent memory issues
		if ( count( $this->layerSetCache ) >= self::MAX_CACHE_SIZE ) {
			// Remove oldest entry (simple FIFO)
			$oldestKey = array_key_first( $this->layerSetCache );
			unset( $this->layerSetCache[$oldestKey] );
		}

		$this->layerSetCache[$sanitizedKey] = $value;
	}

	/**
	 * Log error with proper fallback
	 *
	 * @param string $message Error message
	 * @param array $context Additional context
	 */
	private function logError( string $message, array $context = [] ): void {
		if ( $this->logger ) {
			$this->logger->error( $message, $context );
		} else {
			// Fallback to error_log if logger not available
			error_log( "Layers Database Error: $message" );
		}
	}

	/**
	 * Clear cache when data changes
	 *
	 * @param string|null $pattern Optional pattern to match keys
	 */
	private function clearCache( ?string $pattern = null ): void {
		if ( $pattern === null ) {
			$this->layerSetCache = [];
			return;
		}

		// Sanitize pattern to prevent cache manipulation
		$sanitizedPattern = $this->sanitizeCacheKey( $pattern );

		// Clear cache entries matching pattern
		foreach ( array_keys( $this->layerSetCache ) as $key ) {
			if ( strpos( $key, $sanitizedPattern ) !== false ) {
				unset( $this->layerSetCache[$key] );
			}
		}
	}

	/**
	 * Sanitize cache keys to prevent cache poisoning attacks
	 * Enhanced security validation to prevent bypass attempts
	 *
	 * @param string $key Raw cache key
	 * @return string Sanitized cache key
	 */
	private function sanitizeCacheKey( string $key ): string {
		// First, validate input type and basic structure
		if ( !is_string( $key ) || empty( $key ) ) {
			return 'invalid_key_' . hash( 'sha256', 'empty_or_invalid' );
		}

		// Prevent extremely long keys that could cause DoS
		if ( strlen( $key ) > 250 ) {
			// Use hash of long keys to maintain uniqueness while preventing abuse
			return 'long_key_' . hash( 'sha256', $key );
		}

		// Remove all non-alphanumeric characters except underscore and hyphen
		// This is more restrictive than the previous implementation
		$sanitized = preg_replace( '/[^a-zA-Z0-9_\-]/', '', $key );

		// Ensure we still have a meaningful key after sanitization
		if ( empty( $sanitized ) || strlen( $sanitized ) < 3 ) {
			// Generate a deterministic but safe key from the original
			return 'sanitized_' . hash( 'sha256', $key );
		}

		// Additional validation: prevent keys that could be confused with internal keys
		$reservedPrefixes = [ 'system_', 'internal_', 'admin_', 'config_', 'temp_' ];
		foreach ( $reservedPrefixes as $prefix ) {
			if ( strpos( $sanitized, $prefix ) === 0 ) {
				$sanitized = 'user_' . $sanitized;
				break;
			}
		}

		// Final length check after all transformations
		if ( strlen( $sanitized ) > 100 ) {
			$sanitized = substr( $sanitized, 0, 100 );
		}

		return $sanitized;
	}

	/**
	 * Validate and prepare JSON blob with comprehensive security checks
	 *
	 * @param array $layersData Layer data array
	 * @param int $revision Revision number
	 * @param string $timestamp Timestamp
	 * @return string|false JSON string on success, false on validation failure
	 */
	private function validateAndPrepareJsonBlob( array $layersData, int $revision, string $timestamp ) {
		// Validate array depth to prevent deeply nested structures
		if ( $this->getArrayDepth( $layersData ) > 5 ) {
			$this->logError( 'JSON data exceeds maximum depth limit of 5 levels' );
			return false;
		}

		// Validate maximum layer count
		if ( count( $layersData ) > 1000 ) {
			$this->logError( 'JSON data exceeds maximum layer count of 1000' );
			return false;
		}

		// Validate individual layers for security
		foreach ( $layersData as $index => $layer ) {
			if ( !is_array( $layer ) ) {
				$this->logError( "Layer at index $index is not an array" );
				return false;
			}

			// Check for excessive properties in a single layer
			if ( count( $layer ) > 50 ) {
				$this->logError( "Layer at index $index has too many properties" );
				return false;
			}

			// Validate text fields for potential XSS
			if ( isset( $layer['text'] ) && is_string( $layer['text'] ) ) {
				if ( strlen( $layer['text'] ) > 5000 ) {
					$this->logError( "Text field in layer $index exceeds 5000 character limit" );
					return false;
				}

				// Check for potential script injection
				if ( preg_match( '/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/mi', $layer['text'] ) ) {
					$this->logError( "Potential script injection detected in layer $index text" );
					return false;
				}
			}
		}

		// Prepare final data structure
		$dataStructure = [
			'revision' => $revision,
			'schema' => 1,
			'created' => $timestamp,
			'layers' => $layersData
		];

		// Encode with security flags
		$jsonBlob = json_encode( $dataStructure, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR );

		// Additional size validation after encoding
		if ( strlen( $jsonBlob ) > 2097152 ) { // 2MB limit
			$this->logError( 'JSON blob exceeds 2MB size limit' );
			return false;
		}

		return $jsonBlob;
	}

	/**
	 * Calculate the maximum depth of a nested array
	 *
	 * @param array $array Array to check
	 * @return int Maximum depth
	 */
	private function getArrayDepth( array $array ): int {
		$maxDepth = 1;

		foreach ( $array as $value ) {
			if ( is_array( $value ) ) {
				$depth = 1 + $this->getArrayDepth( $value );
				$maxDepth = max( $maxDepth, $depth );
			}
		}

		return $maxDepth;
	}

	/**
	 * Check if a given table has a specific column. Caches full column lists per table.
	 *
	 * @param string $table
	 * @param string $column
	 * @return bool
	 */
	private function tableHasColumn( string $table, string $column ): bool {
		try {
			// IMPORTANT: Use WRITE connection for schema introspection to match the target of INSERTs.
			// In some deployments, replicas may have a different schema than primary during migrations.
			$db = $this->getWriteDb();
			if ( !$db ) {
				return false;
			}
			$cacheKey = $table;
			if ( isset( $this->tableColumnsCache[$cacheKey] ) ) {
				return in_array( $column, $this->tableColumnsCache[$cacheKey], true );
			}

			$cols = [];
			// Prefer listFields to obtain all columns at once, then cache them
			if ( \is_callable( [ $db, 'listFields' ] ) ) {
				$fields = $db->listFields( $table );
				if ( is_array( $fields ) ) {
					$cols = array_map( 'strval', $fields );
				}
			} else {
				// Fallback: single column probe without poisoning the cache for other columns
				$fieldInfo = $db->fieldInfo( $table, $column );
				if ( $fieldInfo ) {
					$cols = [ $column ];
				}
			}

			$this->tableColumnsCache[$cacheKey] = $cols;
			return in_array( $column, $cols, true );
		} catch ( \Throwable $e ) {
			return false;
		}
	}

	/**
	 * Validate JSON structure without full decoding to prevent malformed data attacks
	 *
	 * @param string $jsonString The JSON string to validate
	 * @return bool True if JSON structure is valid, false otherwise
	 */
	private function isValidJsonStructure( string $jsonString ): bool {
		// Basic structure validation without full parsing
		if ( empty( $jsonString ) || strlen( $jsonString ) < 2 ) {
			return false;
		}

		// Check if it starts and ends with appropriate characters for arrays/objects
		$first = $jsonString[0];
		$last = $jsonString[strlen( $jsonString ) - 1];

		if ( !( ( $first === '[' && $last === ']' ) || ( $first === '{' && $last === '}' ) ) ) {
			return false;
		}

		// Count braces/brackets to detect severely malformed JSON
		$openBraces = substr_count( $jsonString, '{' );
		$closeBraces = substr_count( $jsonString, '}' );
		$openBrackets = substr_count( $jsonString, '[' );
		$closeBrackets = substr_count( $jsonString, ']' );

		if ( $openBraces !== $closeBraces || $openBrackets !== $closeBrackets ) {
			return false;
		}

		// Quick depth check to prevent deeply nested JSON attacks
		$maxDepth = 20;
		$depth = 0;
		$maxFoundDepth = 0;

		for ( $i = 0; $i < strlen( $jsonString ); $i++ ) {
			$char = $jsonString[$i];
			if ( $char === '{' || $char === '[' ) {
				$depth++;
				$maxFoundDepth = max( $maxFoundDepth, $depth );
				if ( $maxFoundDepth > $maxDepth ) {
					return false;
				}
			} elseif ( $char === '}' || $char === ']' ) {
				$depth--;
			}
		}

		return true;
	}
}
