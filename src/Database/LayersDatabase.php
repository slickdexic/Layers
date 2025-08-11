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

	/** @var mixed */
	private $loadBalancer;

	/** @var mixed */
	private $dbw;

	/** @var mixed */
	private $dbr;

	/** @var LoggerInterface */
	private $logger;

	/** @var array Cache for layer sets to avoid repeated queries */
	private $layerSetCache = [];

	/** @var int Maximum cache size */
	private const MAX_CACHE_SIZE = 100;

	/** @var array Cached table->columns map for schema checks */
	private $tableColumnsCache = [];

	public function __construct() {
		$this->loadBalancer = null;
		$this->dbw = null;
		$this->dbr = null;

		// Initialize logger when available; tolerate non-MW static analysis contexts
		if ( class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
			$this->logger = \call_user_func( [ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ], 'Layers' );
		}
	}

	/**
	 * Lazy-load MediaWiki DB load balancer
	 * @return mixed
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
	 * @return mixed
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
			$this->dbw = $lb->getConnection( DB_PRIMARY );
		} else {
			$this->dbw = $lb->getConnection( 0 );
		}
		return $this->dbw;
	}

	/**
	 * @return mixed
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

			// Start transaction for data consistency
			$dbw->startAtomic( __METHOD__ );

			// Get next revision number for this image with retry logic for race conditions
			$maxRetries = 3;
			$retryCount = 0;
			$revision = null;
			$layerSetId = null;

			while ( $retryCount < $maxRetries ) {
				try {
					$revision = $this->getNextRevision( $imgName, $sha1 );
					$timestamp = $dbw->timestamp();

					// Prepare JSON data with validation
					$jsonBlob = json_encode( [
						'revision' => $revision,
						'schema' => 1,
						'created' => $timestamp,
						'layers' => $layersData
					], JSON_UNESCAPED_UNICODE );

					if ( $jsonBlob === false ) {
						$dbw->endAtomic( __METHOD__ );
						$this->logError( 'JSON encoding failed for layer set' );
						return false;
					}

					// Calculate size and layer count for performance tracking
					$dataSize = strlen( $jsonBlob );
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
					$dbw->insert( 'layer_sets', $row, __METHOD__ );

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
						$this->logError( 'Race condition detected, retrying (attempt ' . ($retryCount + 1) . '): ' . $e->getMessage() );
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
		// Check cache first
		$cacheKey = 'layerset_' . $layerSetId;
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

			$jsonData = json_decode( $row->ls_json_blob, true );
			if ( $jsonData === null ) {
				$this->logError( 'Invalid JSON in layer set ID: ' . $layerSetId );
				return false;
			}

			$result = [
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
	 * Get next revision number for an image
	 *
	 * @param string $imgName Image filename
	 * @param string $sha1 Image SHA1 hash
	 * @return int Next revision number
	 */
	private function getNextRevision( string $imgName, string $sha1 ): int {
		$dbr = $this->getReadDb();
		if ( !$dbr ) {
			return 1;
		}
		$maxRevision = $dbr->selectField(
			'layer_sets',
			'MAX(ls_revision)',
			[
				'ls_img_name' => $imgName,
				'ls_img_sha1' => $sha1
			],
			__METHOD__
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
			return true;
		} catch ( \Throwable $e ) {
			if ( $this->logger ) {
				$this->logger->warning( 'Failed to delete layer sets: {message}', [ 'message' => $e->getMessage() ] );
			}
			return false;
		}
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

			return [
				'id' => (int)$res->ls_id,
				'imgName' => $res->ls_img_name,
				'imgSha1' => $res->ls_img_sha1,
				'majorMime' => $res->ls_img_major_mime,
				'minorMime' => $res->ls_img_minor_mime,
				'revision' => (int)$res->ls_revision,
				'data' => json_decode( $res->ls_json_blob, true ),
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
		// Manage cache size to prevent memory issues
		if ( count( $this->layerSetCache ) >= self::MAX_CACHE_SIZE ) {
			// Remove oldest entry (simple FIFO)
			$oldestKey = array_key_first( $this->layerSetCache );
			unset( $this->layerSetCache[$oldestKey] );
		}

		$this->layerSetCache[$key] = $value;
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

		// Clear cache entries matching pattern
		foreach ( array_keys( $this->layerSetCache ) as $key ) {
			if ( strpos( $key, $pattern ) !== false ) {
				unset( $this->layerSetCache[$key] );
			}
		}
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
			// Use read connection for schema introspection
			$dbr = $this->getReadDb();
			if ( !$dbr ) {
				return false;
			}
			$cacheKey = $table;
			if ( isset( $this->tableColumnsCache[$cacheKey] ) ) {
				return in_array( $column, $this->tableColumnsCache[$cacheKey], true );
			}

			$cols = [];
			// Prefer listFields to obtain all columns at once, then cache them
			if ( \is_callable( [ $dbr, 'listFields' ] ) ) {
				$fields = $dbr->listFields( $table );
				if ( is_array( $fields ) ) {
					$cols = array_map( 'strval', $fields );
				}
			} else {
				// Fallback: single column probe without poisoning the cache for other columns
				$fieldInfo = $dbr->fieldInfo( $table, $column );
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
}
