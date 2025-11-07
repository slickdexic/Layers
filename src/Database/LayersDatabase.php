<?php

/**
 * Database operations for the Layers extension
 *
 * @file
 * @ingroup Extensions
 */

namespace MediaWiki\Extension\Layers\Database;

use Config;
use MediaWiki\MediaWikiServices;
use Wikimedia\Rdbms\LoadBalancer;
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

	/** @var Config */
	private $config;

	/** @var array Cache for layer sets to avoid repeated queries */
	private $layerSetCache = [];

	/** @var int Maximum cache size */
	private const MAX_CACHE_SIZE = 100;

	/** @var LayersSchemaManager Schema manager instance */
	private $schemaManager;

	/**
	 * Constructor for LayersDatabase
	 * @param LoadBalancer $loadBalancer Database load balancer
	 * @param Config $config Main config
	 * @param LoggerInterface $logger Logger instance
	 * @param LayersSchemaManager $schemaManager Schema manager
	 */
	public function __construct(
		$loadBalancer,
		Config $config,
		LoggerInterface $logger,
		LayersSchemaManager $schemaManager
	) {
		$this->loadBalancer = $loadBalancer;
		$this->config = $config;
		$this->logger = $logger;
		$this->schemaManager = $schemaManager;
	}

	/**
	 * Lazy-load MediaWiki DB load balancer
	 *
	 * @return mixed Database load balancer instance
	 */
	private function getLoadBalancer() {
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

			// Retry logic for handling race conditions
			$maxRetries = 3;
			$retryCount = 0;
			$layerSetId = null;

			while ( $retryCount < $maxRetries ) {
				// Start transaction for data consistency
				$dbw->startAtomic( __METHOD__ );

				try {
					$revision = $this->getNextRevision( $imgName, $sha1, $dbw );
					$timestamp = $dbw->timestamp();

					// Check size limits before JSON encoding to prevent memory exhaustion
					$maxAllowedSize = 2097152; // Default 2MB limit
					if ( $this->config ) {
						$maxAllowedSize = $this->config->get( 'LayersMaxBytes' ) ?: $maxAllowedSize;
					}

					// Rough estimate of JSON size before encoding (more efficient)
					$estimatedSize = strlen( serialize( $layersData ) ) * 1.5; // Conservative estimate
					if ( $estimatedSize > $maxAllowedSize ) {
						$dbw->endAtomic( __METHOD__ );
						$this->logError(
							"Estimated JSON size ({$estimatedSize} bytes) exceeds maximum allowed size ({$maxAllowedSize} bytes)"
						);
						return false;
					}

					// Prepare JSON data with strict validation and memory protection
					$jsonBlob = $this->validateAndPrepareJsonBlob( $layersData, $revision, $timestamp );
					if ( $jsonBlob === false ) {
						$dbw->endAtomic( __METHOD__ );
						$this->logError( 'JSON validation failed for layer set' );
						return false;
					}

					// Final check of actual JSON size
					$dataSize = strlen( $jsonBlob );
					if ( $dataSize > $maxAllowedSize ) {
						$dbw->endAtomic( __METHOD__ );
						$this->logError(
							"JSON blob size ({$dataSize} bytes) exceeds maximum allowed size ({$maxAllowedSize} bytes)"
						);
						return false;
					}

					// Debug: Log what we're about to save (only in debug mode to prevent log spam)
					if ( function_exists( 'error_log' ) && $this->config && $this->config->get( 'LayersDebug' ) ) {
						error_log( 'Layers: Saving JSON blob: ' . substr( $jsonBlob, 0, 500 ) . '...' );
					}

					// Calculate size and layer count for performance tracking
					$layerCount = count( $layersData );

					// Build insert row - current schema includes all columns
					$row = [
						'ls_img_name' => $imgName,
						'ls_img_major_mime' => $majorMime,
						'ls_img_minor_mime' => $minorMime,
						'ls_img_sha1' => $sha1,
						'ls_json_blob' => $jsonBlob,
						'ls_user_id' => $userId,
						'ls_timestamp' => $timestamp,
						'ls_revision' => $revision,
						'ls_name' => $setName,
						'ls_size' => $dataSize,
						'ls_layer_count' => $layerCount
					];

					// Insert layer set
					$dbw->insert( 'layer_sets', $row, __METHOD__ );
					$layerSetId = $dbw->insertId();
					$dbw->endAtomic( __METHOD__ );
					// Success, exit retry loop
					break;

				} catch ( \Exception $e ) {
					$dbw->endAtomic( __METHOD__ );

					// Check if this is a duplicate key error (race condition)
					if (
						strpos( strtolower( $e->getMessage() ), 'duplicate' ) !== false ||
						 strpos( strtolower( $e->getMessage() ), 'unique' ) !== false
					) {
						$retryCount++;
						if ( $retryCount >= $maxRetries ) {
							$this->logError( 'Race condition detected, max retries exceeded: ' . $e->getMessage() );
							return false;
						}
						// Log and retry with new revision number
						$this->logError(
							'Race condition detected, retrying (attempt ' . ( $retryCount + 1 ) . '): '
							. $e->getMessage()
						);
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

			// Check the size column to avoid loading oversized data (modern schema includes this column)
			$sizeRow = $dbr->selectRow(
				'layer_sets',
				'ls_size',
				[ 'ls_id' => $layerSetId ],
				__METHOD__
			);
			if ( $sizeRow && $sizeRow->ls_size ) {
				$dataSize = (int)$sizeRow->ls_size;
				$maxJsonSize = 2097152; // Default 2MB limit
				if ( $this->config ) {
					$maxJsonSize = $this->config->get( 'LayersMaxBytes' ) ?: $maxJsonSize;
				}
				if ( $dataSize > $maxJsonSize ) {
					$this->logError( "JSON blob too large for layer set ID: {$layerSetId}, size: {$dataSize} bytes" );
					return false;
				}
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
			// Default 2MB limit
			$maxJsonSize = 2097152;
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

		$jsonData = $this->safeJsonDecode( $row->ls_json_blob );
		if ( $jsonData === false ) {
			$this->logError( 'Invalid or unsafe JSON in layer set ID: ' . $layerSetId );
			return false;
		}

		// Validate the decoded data structure for security
		if ( !$this->validateJsonDataStructure( $jsonData ) ) {
			$this->logError( 'JSON data structure validation failed for layer set ID: ' . $layerSetId );
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
		// Default 2MB limit
		$maxJsonSize = 2097152;
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

		$jsonData = $this->safeJsonDecode( $row->ls_json_blob );
		if ( $jsonData === false ) {
			$this->logError( 'Invalid or unsafe JSON in latest layer set' );
			return false;
		}

		// Validate the decoded data structure for security
		if ( !$this->validateJsonDataStructure( $jsonData ) ) {
			$this->logError( 'JSON data structure validation failed for latest layer set' );
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
	 * @param mixed $dbw Write database connection (must be in transaction)
	 * @return int Next revision number
	 */
	private function getNextRevision( string $imgName, string $sha1, $dbw ): int {
		// Lock all matching rows to prevent race conditions during revision calculation
		// This ensures no concurrent inserts can happen while we calculate the next revision
		$result = $dbw->select(
			'layer_sets',
			'ls_revision',
			[
				'ls_img_name' => $imgName,
				'ls_img_sha1' => $sha1
			],
			__METHOD__,
			[
				'ORDER BY' => 'ls_revision DESC',
				'LIMIT' => 1,
				'FOR UPDATE'
			]
		);

		$maxRevision = 0;
		foreach ( $result as $row ) {
			$maxRevision = (int)$row->ls_revision;
			break;
		}

		return $maxRevision + 1;
	}

	/**
	 * Get all layer sets for an image with safe custom sorting
	 *
	 * @param string $imgName Image filename
	 * @param string $sha1 Image SHA1 hash
	 * @param array $options Optional sorting and limit parameters
	 * @return array Array of layer set data
	 */
	public function getLayerSetsForImageWithOptions( string $imgName, string $sha1, array $options = [] ): array {
		$dbr = $this->getReadDb();
		if ( !$dbr ) {
			return [];
		}

		// Build safe ORDER BY clause using validated parameters
		$orderByOptions = $this->buildSafeOrderBy( $options );

		// Add optional LIMIT for pagination (with safety checks)
		$queryOptions = $orderByOptions;
		if ( isset( $options['limit'] ) && is_numeric( $options['limit'] ) ) {
			$limit = (int)$options['limit'];
			// Enforce reasonable limits to prevent resource exhaustion
			if ( $limit > 0 && $limit <= 1000 ) {
				$queryOptions['LIMIT'] = $limit;
			}
		}

		// Add optional OFFSET for pagination (with safety checks)
		if ( isset( $options['offset'] ) && is_numeric( $options['offset'] ) ) {
			$offset = (int)$options['offset'];
			if ( $offset >= 0 ) {
				$queryOptions['OFFSET'] = $offset;
			}
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
			$queryOptions
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
	 * Get all layer sets for an image
	 *
	 * @param string $imgName Image filename
	 * @param string $sha1 Image SHA1 hash
	 * @return array Array of layer set data
	 */
	public function getLayerSetsForImage( string $imgName, string $sha1 ): array {
		// Use the new safe method with default sorting
		return $this->getLayerSetsForImageWithOptions( $imgName, $sha1, [
			'sort' => 'ls_revision',
			'direction' => 'DESC'
		] );
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
			// Default 2MB limit
			$maxJsonSize = 2097152;
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

			$jsonData = $this->safeJsonDecode( $res->ls_json_blob );
			if ( $jsonData === false ) {
				$this->logError( "Invalid or unsafe JSON data for layer set by name" );
				return null;
			}

			// Validate the decoded data structure for security
			if ( !$this->validateJsonDataStructure( $jsonData ) ) {
				$this->logError( 'JSON data structure validation failed for layer set by name' );
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
	// 2MB limit
	if ( strlen( $jsonBlob ) > 2097152 ) {
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
	 * Check if the database schema is properly installed
	 *
	 * @return bool True if schema is ready
	 */
	public function isSchemaReady(): bool {
		return $this->schemaManager->isSchemaReady();
	}

	/**
	 * Get schema information for debugging
	 *
	 * @return array Schema status information
	 */
	public function getSchemaInfo(): array {
		return $this->schemaManager->getSchemaInfo();
	}

	/**
	 * Safely decode JSON with schema validation to prevent object injection attacks
	 *
	 * @param string $jsonString JSON string to decode
	 * @return array|false Decoded data on success, false on failure
	 */
	private function safeJsonDecode( string $jsonString ) {
		// Validate input first
		if ( empty( $jsonString ) ) {
			return false;
		}

		// Decode with error handling
		try {
			$data = json_decode( $jsonString, true, 512, JSON_THROW_ON_ERROR );
		} catch ( \JsonException $e ) {
			$this->logError( 'JSON decode error: ' . $e->getMessage() );
			return false;
		}

		// Ensure we got an array (object decoded as associative array)
		if ( !is_array( $data ) ) {
			$this->logError( 'JSON decode did not return array structure' );
			return false;
		}

		return $data;
	}

	/**
	 * Validate JSON data structure to prevent malicious payloads
	 *
	 * @param array $data Decoded JSON data
	 * @return bool True if structure is valid, false otherwise
	 */
	private function validateJsonDataStructure( array $data ): bool {
		// Check for required top-level structure
		$requiredFields = [ 'revision', 'schema', 'created', 'layers' ];
		foreach ( $requiredFields as $field ) {
			if ( !array_key_exists( $field, $data ) ) {
				$this->logError( "Missing required field: $field" );
				return false;
			}
		}

		// Validate field types
		if ( !is_int( $data['revision'] ) || $data['revision'] < 1 ) {
			$this->logError( 'Invalid revision number' );
			return false;
		}

		if ( !is_int( $data['schema'] ) || $data['schema'] < 1 ) {
			$this->logError( 'Invalid schema version' );
			return false;
		}

		if ( !is_string( $data['created'] ) || empty( $data['created'] ) ) {
			$this->logError( 'Invalid created timestamp' );
			return false;
		}

		if ( !is_array( $data['layers'] ) ) {
			$this->logError( 'Layers field must be an array' );
			return false;
		}

		// Validate layers structure
		return $this->validateLayersStructure( $data['layers'] );
	}

	/**
	 * Validate layers array structure for security
	 *
	 * @param array $layers Layers array
	 * @return bool True if valid, false otherwise
	 */
	private function validateLayersStructure( array $layers ): bool {
		// Check layer count limit
		if ( count( $layers ) > 1000 ) {
			$this->logError( 'Too many layers in structure' );
			return false;
		}

		foreach ( $layers as $index => $layer ) {
			if ( !is_array( $layer ) ) {
				$this->logError( "Layer at index $index is not an array" );
				return false;
			}

			// Check for excessive properties
			if ( count( $layer ) > 50 ) {
				$this->logError( "Layer at index $index has too many properties" );
				return false;
			}

			// Validate layer properties
			if ( !$this->validateLayerProperties( $layer, $index ) ) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Validate individual layer properties for security
	 *
	 * @param array $layer Layer data
	 * @param int $index Layer index for error reporting
	 * @return bool True if valid, false otherwise
	 */
	private function validateLayerProperties( array $layer, int $index ): bool {
		// Define allowed layer properties to prevent unknown fields
		$allowedProperties = [
			'id', 'type', 'x', 'y', 'width', 'height', 'radius', 'radiusX', 'radiusY',
			'x1', 'y1', 'x2', 'y2', 'rotation', 'stroke', 'fill', 'color', 'opacity',
			'fillOpacity', 'strokeOpacity', 'strokeWidth', 'blendMode', 'blend',
			'fontFamily', 'fontSize', 'arrowhead', 'arrowStyle', 'arrowSize',
			'text', 'textStrokeColor', 'textStrokeWidth', 'textShadow', 'textShadowColor',
			'shadow', 'shadowColor', 'shadowBlur', 'shadowOffsetX', 'shadowOffsetY',
			'shadowSpread', 'glow', 'points', 'visible', 'locked', 'name'
		];

		// Check for unknown properties
		foreach ( array_keys( $layer ) as $property ) {
			if ( !in_array( $property, $allowedProperties, true ) ) {
				$this->logError( "Unknown property '$property' in layer $index" );
				return false;
			}
		}

		// Validate text field specifically for XSS prevention
		if ( isset( $layer['text'] ) ) {
			if ( !is_string( $layer['text'] ) ) {
				$this->logError( "Text property must be string in layer $index" );
				return false;
			}

			if ( strlen( $layer['text'] ) > 5000 ) {
				$this->logError( "Text too long in layer $index" );
				return false;
			}

			// Check for potential script injection patterns
			if ( $this->containsScriptInjection( $layer['text'] ) ) {
				$this->logError( "Potential script injection in layer $index text" );
				return false;
			}
		}

		// Validate numeric fields
		$numericFields = [ 'x', 'y', 'width', 'height', 'radius', 'rotation', 'opacity' ];
		foreach ( $numericFields as $field ) {
			if ( isset( $layer[$field] ) && !is_numeric( $layer[$field] ) ) {
				$this->logError( "Non-numeric value for $field in layer $index" );
				return false;
			}
		}

		return true;
	}

	/**
	 * Check for script injection patterns in text
	 *
	 * @param string $text Text to check
	 * @return bool True if script injection detected, false otherwise
	 */
	private function containsScriptInjection( string $text ): bool {
		$patterns = [
			'/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/mi',
			'/javascript:/i',
			'/on\w+\s*=/i',
			'/data:text\/html/i',
			'/vbscript:/i'
		];

		foreach ( $patterns as $pattern ) {
			if ( preg_match( $pattern, $text ) ) {
				return true;
			}
		}

		return false;
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

	/**
	 * Whitelist validation for ORDER BY clause to prevent SQL injection
	 * CRITICAL: This method MUST be used for any user-provided sort parameters
	 * to prevent SQL injection attacks through dynamic ORDER BY clauses
	 *
	 * @param string $sortColumn Column name to sort by
	 * @return string Safe column name or default
	 */
	private function validateSortColumn( string $sortColumn ): string {
		// Define comprehensive whitelist of allowed sort columns for layer_sets table
		// Any new columns added to the table should be carefully reviewed before adding here
		$validSortColumns = [
			'ls_id',              // Primary key
			'ls_img_name',        // Image filename
			'ls_img_sha1',        // Image SHA1 hash
			'ls_img_major_mime',  // Image major MIME type
			'ls_img_minor_mime',  // Image minor MIME type
			'ls_revision',        // Layer set revision number
			'ls_json_blob',       // Layer data (not recommended for sorting due to size)
			'ls_timestamp',       // Creation timestamp
			'ls_user_id',         // User ID who created the layer set
			'ls_name',            // Layer set name
			'ls_size',            // JSON blob size (if column exists)
			'ls_layer_count'      // Number of layers (if column exists)
		];

		// Validate against whitelist - use strict comparison to prevent type juggling
		if ( in_array( $sortColumn, $validSortColumns, true ) ) {
			return $sortColumn;
		}

		// Log potential SQL injection attempt for security monitoring
		$this->logError( 'Invalid sort column rejected: ' . $sortColumn );

		// Default to ls_timestamp if invalid column provided (safer than ls_id for most use cases)
		return 'ls_timestamp';
	}

	/**
	 * Validate sort direction to prevent SQL injection
	 * CRITICAL: This method MUST be used for any user-provided sort direction
	 *
	 * @param string $sortDirection Direction to sort
	 * @return string Safe direction (ASC or DESC only)
	 */
	private function validateSortDirection( string $sortDirection ): string {
		// Normalize input to uppercase and trim whitespace
		$direction = strtoupper( trim( $sortDirection ) );

		// Only allow exactly 'DESC' - anything else defaults to ASC for security
		if ( $direction === 'DESC' ) {
			return 'DESC';
		}

		// Log potential SQL injection attempt if input contains suspicious patterns
		if ( preg_match( '/[^A-Z]/', $sortDirection ) || strlen( $sortDirection ) > 10 ) {
			$this->logError( 'Invalid sort direction rejected: ' . $sortDirection );
		}

		// Default to ASC for any invalid input
		return 'ASC';
	}

	/**
	 * Safely build ORDER BY clause with validated parameters
	 * CRITICAL: This method MUST be used instead of directly building ORDER BY clauses
	 * when accepting user input to prevent SQL injection attacks
	 *
	 * @param array $params Parameters containing 'sort' and 'direction'
	 * @return array ORDER BY clause for MediaWiki database methods
	 */
	private function buildSafeOrderBy( array $params = [] ): array {
		$sortColumn = $this->validateSortColumn( $params['sort'] ?? 'ls_timestamp' );
		$sortDirection = $this->validateSortDirection( $params['direction'] ?? 'DESC' );

		return [ 'ORDER BY' => "$sortColumn $sortDirection" ];
	}
}
