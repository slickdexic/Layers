<?php

declare( strict_types=1 );

/**
 * Database operations for the Layers extension
 *
 * @file
 * @ingroup Extensions
 */

namespace MediaWiki\Extension\Layers\Database;

use Config;
use Psr\Log\LoggerInterface;
use Wikimedia\Rdbms\LoadBalancer;

class LayersDatabase {
	private const MAX_CACHE_SIZE = 100;

	/**
	 * Maximum recursion depth for json_decode operations.
	 * Prevents stack overflow on deeply nested JSON structures.
	 */
	private const JSON_DECODE_MAX_DEPTH = 512;

	/** @var LoadBalancer */
	private $loadBalancer;
	/** @var \Wikimedia\Rdbms\IDatabase */
	private $dbw;
	/** @var \Wikimedia\Rdbms\IDatabase */
	private $dbr;
	/** @var LoggerInterface */
	private $logger;
	/** @var Config */
	private $config;
	/** @var array */
	private $layerSetCache = [];
	/** @var LayersSchemaManager */
	private $schemaManager;

	public function __construct(
		LoadBalancer $loadBalancer,
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
	 * Get write database connection (lazy initialization)
	 *
	 * @return \Wikimedia\Rdbms\IDatabase|null Database connection
	 */
	private function getWriteDb() {
		if ( !$this->dbw ) {
			$this->dbw = $this->loadBalancer->getConnection( DB_PRIMARY );
		}
		return $this->dbw;
	}

	/**
	 * Get read database connection (lazy initialization)
	 *
	 * @return \Wikimedia\Rdbms\IDatabase|null Database connection
	 */
	private function getReadDb() {
		if ( !$this->dbr ) {
			$this->dbr = $this->loadBalancer->getConnection( DB_REPLICA );
		}
		return $this->dbr;
	}

	public function saveLayerSet(
		string $imgName,
		array $imgMetadata,
		array $layersData,
		int $userId,
		?string $setName = null,
		array $backgroundSettings = []
	): ?int {
		$dbw = $this->getWriteDb();
		if ( !$dbw ) {
			return null;
		}

		$mime = $imgMetadata['mime'] ?? '';
		$sha1 = $imgMetadata['sha1'] ?? '';
		$normalizedImgName = $this->normalizeImageName( $imgName );

		// Default to configured default set name
		if ( $setName === null || $setName === '' ) {
			$setName = $this->config->get( 'LayersDefaultSetName' );
		}

		// Log via injected logger (respects MediaWiki logging configuration)
		$this->logger->debug( 'saveLayerSet: imgName={imgName}, setName={setName}', [
			'imgName' => $imgName,
			'setName' => $setName
		] );

		if ( empty( $normalizedImgName ) || empty( $sha1 ) || $userId <= 0 ) {
			$this->logError( 'Invalid parameters for saveLayerSet', [
				'imgName' => $imgName, 'sha1' => $sha1, 'userId' => $userId
			] );
			return null;
		}

		// Check named set limit for new sets
		$setExists = $this->namedSetExists( $normalizedImgName, $sha1, $setName );
		if ( $setExists === null ) {
			// Database connection failed - don't proceed with save
			$this->logError( 'Cannot verify set existence, database unavailable' );
			return null;
		}
		if ( $setExists === false ) {
			$maxSets = (int)$this->config->get( 'LayersMaxNamedSets' );
			$setCount = $this->countNamedSets( $normalizedImgName, $sha1 );
			if ( $setCount < 0 ) {
				// Database error - don't proceed with save
				$this->logError( 'Cannot count named sets, database unavailable' );
				return null;
			}
			if ( $setCount >= $maxSets ) {
				$this->logError( 'Named set limit reached', [
					'imgName' => $imgName, 'count' => $setCount, 'max' => $maxSets
				] );
				throw new \OverflowException( 'layers-max-sets-reached' );
			}
		}

		$maxRetries = 3;
		// 5 second total timeout
		$maxTotalTimeMs = 5000;
		// Convert nanoseconds to milliseconds
		$startTime = hrtime( true ) / 1e6;

		for ( $retryCount = 0; $retryCount < $maxRetries; $retryCount++ ) {
			// Check total elapsed time to prevent indefinite blocking
			$elapsedMs = ( hrtime( true ) / 1e6 ) - $startTime;
			if ( $elapsedMs >= $maxTotalTimeMs ) {
				$this->logError( 'saveLayerSet timed out after ' . round( $elapsedMs ) . 'ms' );
				return null;
			}

			// Exponential backoff to prevent DB hammering (100ms, 200ms)
			if ( $retryCount > 0 ) {
				usleep( $retryCount * 100000 );
			}
			$dbw->startAtomic( __METHOD__ );
			try {
				$revision = $this->getNextRevisionForSet( $normalizedImgName, $sha1, $setName, $dbw );
				$timestamp = $dbw->timestamp();

				$dataStructure = [
					'revision' => $revision,
					'schema' => 1,
					'created' => $timestamp,
					'layers' => $layersData,
					'backgroundVisible' => $backgroundSettings['backgroundVisible'] ?? true,
					'backgroundOpacity' => $backgroundSettings['backgroundOpacity'] ?? 1.0
				];

				// Add slide-specific settings if present (isSlide, canvasWidth, canvasHeight, backgroundColor)
				if ( !empty( $backgroundSettings['isSlide'] ) ) {
					$dataStructure['isSlide'] = true;
					$dataStructure['canvasWidth'] = $backgroundSettings['canvasWidth'] ?? 800;
					$dataStructure['canvasHeight'] = $backgroundSettings['canvasHeight'] ?? 600;
					$dataStructure['backgroundColor'] = $backgroundSettings['backgroundColor'] ?? '#ffffff';
				}

				$jsonBlob = json_encode( $dataStructure, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR );

				$maxAllowedSize = (int)$this->config->get( 'LayersMaxBytes' );
				if ( strlen( $jsonBlob ) > $maxAllowedSize ) {
					$this->logError( "JSON blob size exceeds maximum allowed size" );
					$dbw->endAtomic( __METHOD__ );
					return null;
				}

				[ $majorMime, $minorMime ] = explode( '/', $mime, 2 ) + [ '', '' ];

				$row = [
					'ls_img_name' => $normalizedImgName,
					'ls_img_major_mime' => $majorMime,
					'ls_img_minor_mime' => $minorMime,
					'ls_img_sha1' => $sha1,
					'ls_json_blob' => $jsonBlob,
					'ls_user_id' => $userId,
					'ls_timestamp' => $timestamp,
					'ls_revision' => $revision,
					'ls_name' => $setName,
					'ls_size' => strlen( $jsonBlob ),
					'ls_layer_count' => count( $layersData )
				];

				$dbw->insert( 'layer_sets', $row, __METHOD__ );
				$layerSetId = $dbw->insertId();
				$dbw->endAtomic( __METHOD__ );

				$this->clearCache( $normalizedImgName );

				// Prune old revisions for this named set
				$maxRevisions = (int)$this->config->get( 'LayersMaxRevisionsPerSet' );
				$this->pruneOldRevisions( $normalizedImgName, $sha1, $setName, $maxRevisions );

				return $layerSetId;
			} catch ( \Throwable $e ) {
				$dbw->endAtomic( __METHOD__ );
				if ( $dbw->isDuplicateKeyError( $e ) ) {
					$this->logError( "Race condition in saveLayerSet, retrying." );
					continue;
				}
				$this->logError( 'Failed to save layer set: ' . $e->getMessage() );
				return null;
			}
		}

		$this->logError( 'Failed to save layer set after multiple retries.' );
		return null;
	}

	/**
	 * Get a layer set by its ID
	 *
	 * @param int $layerSetId Layer set ID
	 * @return array|false Layer set data or false if not found
	 */
	public function getLayerSet( int $layerSetId ) {
		if ( $layerSetId <= 0 ) {
			return false;
		}

		$cacheKey = 'layerset_' . $layerSetId;
		if ( isset( $this->layerSetCache[$cacheKey] ) ) {
			return $this->layerSetCache[$cacheKey];
		}

		$dbr = $this->getReadDb();
		if ( !$dbr ) {
			return false;
		}

		$row = $dbr->selectRow(
			'layer_sets',
			[ 'ls_id', 'ls_img_name', 'ls_json_blob', 'ls_user_id', 'ls_timestamp', 'ls_revision', 'ls_name' ],
			[ 'ls_id' => $layerSetId ],
			__METHOD__
		);

		if ( !$row ) {
			$this->addToCache( $cacheKey, false );
			return false;
		}

		$maxJsonSize = (int)$this->config->get( 'LayersMaxBytes' );
		if ( strlen( $row->ls_json_blob ) > $maxJsonSize ) {
			$this->logError( "JSON blob too large for layer set ID: {$layerSetId}" );
			return false;
		}

		try {
			$jsonData = json_decode( $row->ls_json_blob, true, self::JSON_DECODE_MAX_DEPTH, JSON_THROW_ON_ERROR );
		} catch ( \JsonException $e ) {
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

		$this->addToCache( $cacheKey, $result );
		return $result;
	}

	/**
	 * Get the latest layer set for an image, optionally filtered by set name
	 * @param string $imgName Image name
	 * @param string $sha1 Image SHA1 hash
	 * @param string|null $setName Optional set name to filter by (e.g., 'Paul', 'default')
	 * @return array|false Layer set data or false if not found
	 */
	public function getLatestLayerSet( string $imgName, string $sha1, ?string $setName = null ) {
		$this->logDebug( "getLatestLayerSet called: imgName=$imgName, setName=" . ( $setName ?? 'null' ) );

		$dbr = $this->getReadDb();
		if ( !$dbr ) {
			return false;
		}

		$conditions = [
			'ls_img_name' => $this->buildImageNameLookup( $imgName ),
			'ls_img_sha1' => $sha1
		];

		// If a specific set name is requested, filter by it
		if ( $setName !== null && $setName !== '' ) {
			$conditions['ls_name'] = $setName;
		}

		$row = $dbr->selectRow(
			'layer_sets',
			[ 'ls_id', 'ls_json_blob', 'ls_user_id', 'ls_timestamp', 'ls_revision', 'ls_name' ],
			$conditions,
			__METHOD__,
			[ 'ORDER BY' => 'ls_revision DESC' ]
		);

		if ( !$row ) {
			$setNameLog = $setName ?? 'null';
			$this->logDebug( "getLatestLayerSet: no row found for imgName=$imgName, setName=$setNameLog" );
			return false;
		}

		$blobSize = strlen( $row->ls_json_blob );
		$this->logDebug( "getLatestLayerSet: found ls_id=" . $row->ls_id . ", blob size=$blobSize bytes" );

		$maxJsonSize = (int)$this->config->get( 'LayersMaxBytes' );
		if ( $blobSize > $maxJsonSize ) {
			$this->logError( "JSON blob too large for latest layer set: $blobSize > $maxJsonSize" );
			return false;
		}

		try {
			$jsonData = json_decode( $row->ls_json_blob, true, self::JSON_DECODE_MAX_DEPTH, JSON_THROW_ON_ERROR );
		} catch ( \JsonException $e ) {
			$this->logError( 'Invalid JSON in latest layer set' );
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
	 * Get the next revision number for a specific named set
	 *
	 * @param string $imgName Image name
	 * @param string $sha1 Image SHA1 hash
	 * @param string $setName Named set name
	 * @param \Wikimedia\Rdbms\IDatabase $dbw Database connection
	 * @return int Next revision number
	 */
	private function getNextRevisionForSet( string $imgName, string $sha1, string $setName, $dbw ): int {
		$maxRevision = $dbw->selectField(
			'layer_sets',
			'MAX(ls_revision)',
			[
				'ls_img_name' => $this->buildImageNameLookup( $imgName ),
				'ls_img_sha1' => $sha1,
				'ls_name' => $setName
			],
			__METHOD__,
			[ 'FOR UPDATE' ]
		);
		return (int)$maxRevision + 1;
	}

	/**
	 * Check if a named set exists for an image
	 *
	 * @param string $imgName Image name
	 * @param string $sha1 Image SHA1 hash
	 * @param string $setName Named set name
	 * @return bool|null True if exists, false if not found, null on DB error
	 */
	public function namedSetExists( string $imgName, string $sha1, string $setName ): ?bool {
		$dbr = $this->getReadDb();
		if ( !$dbr ) {
			$this->logError( 'namedSetExists: Database connection unavailable' );
			return null;
		}

		$count = $dbr->selectField(
			'layer_sets',
			'COUNT(*)',
			[
				'ls_img_name' => $this->buildImageNameLookup( $imgName ),
				'ls_img_sha1' => $sha1,
				'ls_name' => $setName
			],
			__METHOD__
		);

		return (int)$count > 0;
	}

	/**
	 * Count the number of distinct named sets for an image
	 *
	 * @param string $imgName Image name
	 * @param string $sha1 Image SHA1 hash
	 * @return int Number of distinct named sets, or -1 on database error
	 */
	public function countNamedSets( string $imgName, string $sha1 ): int {
		$dbr = $this->getReadDb();
		if ( !$dbr ) {
			return -1;
		}

		$count = $dbr->selectField(
			'layer_sets',
			'COUNT(DISTINCT ls_name)',
			[
				'ls_img_name' => $this->buildImageNameLookup( $imgName ),
				'ls_img_sha1' => $sha1
			],
			__METHOD__
		);

		return (int)$count;
	}

	/**
	 * Count revisions for a specific named set
	 *
	 * @param string $imgName Image name
	 * @param string $sha1 Image SHA1 hash
	 * @param string $setName Named set name
	 * @return int Number of revisions, or -1 on database error
	 */
	public function countSetRevisions( string $imgName, string $sha1, string $setName ): int {
		$dbr = $this->getReadDb();
		if ( !$dbr ) {
			return -1;
		}

		$count = $dbr->selectField(
			'layer_sets',
			'COUNT(*)',
			[
				'ls_img_name' => $this->buildImageNameLookup( $imgName ),
				'ls_img_sha1' => $sha1,
				'ls_name' => $setName
			],
			__METHOD__
		);

		return (int)$count;
	}

	/**
	 * Get all named sets for an image with summary information
	 *
	 * Uses a two-query approach for clarity and maintainability:
	 * 1. Get aggregates per named set (count, max revision, max timestamp)
	 * 2. Fetch the latest revision row to get the user_id
	 *
	 * This approach is clearer than a self-join with correlated subquery,
	 * and performs well since each image typically has ≤15 named sets.
	 *
	 * @param string $imgName Image name
	 * @param string $sha1 Image SHA1 hash
	 * @return array Array of named set summaries
	 */
	public function getNamedSetsForImage( string $imgName, string $sha1 ): array {
		$dbr = $this->getReadDb();
		if ( !$dbr ) {
			return [];
		}

		$imgNameLookup = $this->buildImageNameLookup( $imgName );

		// Query 1: Get aggregates per named set
		$aggregates = $dbr->select(
			'layer_sets',
			[
				'ls_name',
				'revision_count' => 'COUNT(*)',
				'latest_revision' => 'MAX(ls_revision)',
				'latest_timestamp' => 'MAX(ls_timestamp)',
			],
			[
				'ls_img_name' => $imgNameLookup,
				'ls_img_sha1' => $sha1
			],
			__METHOD__,
			[
				'GROUP BY' => 'ls_name',
				'ORDER BY' => 'MAX(ls_timestamp) DESC'
			]
		);

		$namedSets = [];
		foreach ( $aggregates as $row ) {
			$setName = $row->ls_name ?? 'default';
			$latestRevision = (int)$row->latest_revision;

			// Query 2: Get user_id from the latest revision row
			// This is a simple primary key lookup, very fast
			$latestRow = $dbr->selectRow(
				'layer_sets',
				[ 'ls_user_id' ],
				[
					'ls_img_name' => $imgNameLookup,
					'ls_img_sha1' => $sha1,
					'ls_name' => $setName,
					'ls_revision' => $latestRevision
				],
				__METHOD__
			);

			$namedSets[] = [
				'name' => $setName,
				'revision_count' => (int)$row->revision_count,
				'latest_revision' => $latestRevision,
				'latest_timestamp' => $row->latest_timestamp,
				'latest_user_id' => $latestRow ? (int)$latestRow->ls_user_id : 0
			];
		}

		return $namedSets;
	}

	/**
	 * Get revision history for a specific named set
	 *
	 * @param string $imgName Image name
	 * @param string $sha1 Image SHA1 hash
	 * @param string $setName Named set name
	 * @param int $limit Maximum number of revisions to return
	 * @return array Array of revision summaries
	 */
	public function getSetRevisions( string $imgName, string $sha1, string $setName, int $limit = 50 ): array {
		$dbr = $this->getReadDb();
		if ( !$dbr ) {
			return [];
		}

		$limit = max( 1, min( $limit, 200 ) );

		$result = $dbr->select(
			'layer_sets',
			[ 'ls_id', 'ls_revision', 'ls_timestamp', 'ls_user_id', 'ls_layer_count' ],
			[
				'ls_img_name' => $this->buildImageNameLookup( $imgName ),
				'ls_img_sha1' => $sha1,
				'ls_name' => $setName
			],
			__METHOD__,
			[
				'ORDER BY' => 'ls_revision DESC',
				'LIMIT' => $limit
			]
		);

		$revisions = [];
		foreach ( $result as $row ) {
			$revisions[] = [
				'ls_id' => (int)$row->ls_id,
				'ls_revision' => (int)$row->ls_revision,
				'ls_timestamp' => $row->ls_timestamp,
				'ls_user_id' => (int)$row->ls_user_id,
				'ls_layer_count' => (int)$row->ls_layer_count
			];
		}

		return $revisions;
	}

	/**
	 * Prune old revisions for a named set, keeping only the most recent ones
	 *
	 * @param string $imgName Image name
	 * @param string $sha1 Image SHA1 hash
	 * @param string $setName Named set name
	 * @param int $keepCount Number of revisions to keep
	 * @return int Number of revisions deleted
	 */
	public function pruneOldRevisions( string $imgName, string $sha1, string $setName, int $keepCount ): int {
		$dbw = $this->getWriteDb();
		if ( !$dbw ) {
			return 0;
		}

		$keepCount = max( 1, $keepCount );

		// Get IDs of revisions to keep (most recent N)
		$keepIds = $dbw->selectFieldValues(
			'layer_sets',
			'ls_id',
			[
				'ls_img_name' => $this->buildImageNameLookup( $imgName ),
				'ls_img_sha1' => $sha1,
				'ls_name' => $setName
			],
			__METHOD__,
			[
				'ORDER BY' => 'ls_revision DESC',
				'LIMIT' => $keepCount
			]
		);

		if ( empty( $keepIds ) ) {
			return 0;
		}

		// Validate keepIds contains only integers (defensive, since they come from our own query)
		$safeKeepIds = array_map( 'intval', $keepIds );
		if ( empty( $safeKeepIds ) ) {
			return 0;
		}

		// Delete all revisions for this set that are NOT in the keep list
		// Using raw condition with makeList is safe here because:
		// 1. $safeKeepIds are integers validated above
		// 2. makeList() properly escapes values for SQL
		$dbw->delete(
			'layer_sets',
			[
				'ls_img_name' => $this->buildImageNameLookup( $imgName ),
				'ls_img_sha1' => $sha1,
				'ls_name' => $setName,
				'ls_id NOT IN (' . $dbw->makeList( $safeKeepIds ) . ')'
			],
			__METHOD__
		);

		$deleted = $dbw->affectedRows();
		if ( $deleted > 0 ) {
			$this->logger->info( 'Pruned old revisions', [
				'imgName' => $imgName,
				'setName' => $setName,
				'deleted' => $deleted,
				'kept' => count( $keepIds )
			] );
		}

		return $deleted;
	}

	public function getLayerSetsForImageWithOptions( string $imgName, string $sha1, array $options = [] ): array {
		$dbr = $this->getReadDb();
		if ( !$dbr ) {
			return [];
		}

		$queryOptions = $this->buildSafeQueryOptions( $options );
		$includeData = !empty( $options['includeData'] );

		$fields = [ 'ls_id', 'ls_revision', 'ls_name', 'ls_user_id', 'ls_timestamp' ];
		if ( $includeData ) {
			$fields[] = 'ls_json_blob';
		}

		$result = $dbr->select(
			'layer_sets',
			$fields,
			[
				'ls_img_name' => $this->buildImageNameLookup( $imgName ),
				'ls_img_sha1' => $sha1
			],
			__METHOD__,
			$queryOptions
		);

		$layerSets = [];
		foreach ( $result as $row ) {
			$layerSet = [
				'ls_id' => (int)$row->ls_id,
				'ls_revision' => (int)$row->ls_revision,
				'ls_name' => $row->ls_name,
				'ls_user_id' => (int)$row->ls_user_id,
				'ls_timestamp' => $row->ls_timestamp
			];
			if ( $includeData ) {
				$layerSet['ls_json_blob'] = $row->ls_json_blob;
			}
			$layerSets[] = $layerSet;
		}
		return $layerSets;
	}

	public function getLayerSetsForImage( string $imgName, string $sha1 ): array {
		return $this->getLayerSetsForImageWithOptions( $imgName, $sha1, [
			'sort' => 'ls_revision',
			'direction' => 'DESC',
			'includeData' => true
		] );
	}

	public function deleteLayerSetsForImage( string $imgName, string $sha1 ): bool {
		try {
			$dbw = $this->getWriteDb();
			if ( !$dbw ) {
				return false;
			}
			$dbw->delete(
				'layer_sets',
				[
					'ls_img_name' => $this->buildImageNameLookup( $imgName ),
					'ls_img_sha1' => $sha1
				],
				__METHOD__
			);
			$this->logger->info( 'Layer sets deleted for image', [
				'imgName' => $imgName, 'sha1' => $sha1
			] );
			return true;
		} catch ( \Throwable $e ) {
			$this->logger->warning( 'Failed to delete layer sets: {message}', [ 'message' => $e->getMessage() ] );
			return false;
		}
	}

	/**
	 * Delete a named layer set (all revisions) for an image.
	 *
	 * @param string $imgName The image name
	 * @param string $sha1 The SHA1 hash of the image
	 * @param string $setName The name of the layer set to delete
	 * @return int|null Number of rows deleted, or null on error
	 */
	public function deleteNamedSet( string $imgName, string $sha1, string $setName ): ?int {
		try {
			$dbw = $this->getWriteDb();
			if ( !$dbw ) {
				return null;
			}

			$normalizedImgName = $this->normalizeImageName( $imgName );
			if ( empty( $normalizedImgName ) || empty( $sha1 ) || empty( $setName ) ) {
				$this->logError( 'Invalid parameters for deleteNamedSet', [
					'imgName' => $imgName, 'sha1' => $sha1, 'setName' => $setName
				] );
				return null;
			}

			$dbw->delete(
				'layer_sets',
				[
					'ls_img_name' => $this->buildImageNameLookup( $imgName ),
					'ls_img_sha1' => $sha1,
					'ls_name' => $setName
				],
				__METHOD__
			);

			$rowsDeleted = $dbw->affectedRows();

			$this->logger->info( 'Named layer set deleted', [
				'imgName' => $imgName,
				'sha1' => $sha1,
				'setName' => $setName,
				'rowsDeleted' => $rowsDeleted
			] );

			// Invalidate cache
			$this->layerSetCache = [];

			return $rowsDeleted;
		} catch ( \Throwable $e ) {
			$this->logger->warning( 'Failed to delete named layer set: {message}', [
				'message' => $e->getMessage(),
				'setName' => $setName
			] );
			return null;
		}
	}

	/**
	 * Get the owner (creator) user ID of a named layer set.
	 * Returns the user ID of the first revision in the set.
	 *
	 * @param string $imgName The image name
	 * @param string $sha1 The SHA1 hash of the image
	 * @param string $setName The name of the layer set
	 * @return int|null User ID of the owner, or null if not found
	 */
	public function getNamedSetOwner( string $imgName, string $sha1, string $setName ): ?int {
		$dbr = $this->getReadDb();
		if ( !$dbr ) {
			return null;
		}

		// Get the first revision (oldest) to find the original creator
		$row = $dbr->selectRow(
			'layer_sets',
			[ 'ls_user_id' ],
			[
				'ls_img_name' => $this->buildImageNameLookup( $imgName ),
				'ls_img_sha1' => $sha1,
				'ls_name' => $setName
			],
			__METHOD__,
			[ 'ORDER BY' => 'ls_revision ASC', 'LIMIT' => 1 ]
		);

		return $row ? (int)$row->ls_user_id : null;
	}

	/**
	 * Rename a named layer set (all revisions) for an image.
	 *
	 * @param string $imgName The image name
	 * @param string $sha1 The SHA1 hash of the image
	 * @param string $oldName The current name of the layer set
	 * @param string $newName The new name for the layer set
	 * @return bool True on success, false on failure
	 */
	public function renameNamedSet( string $imgName, string $sha1, string $oldName, string $newName ): bool {
		try {
			$dbw = $this->getWriteDb();
			if ( !$dbw ) {
				return false;
			}

			$normalizedImgName = $this->normalizeImageName( $imgName );
			if ( empty( $normalizedImgName ) || empty( $sha1 ) || empty( $oldName ) || empty( $newName ) ) {
				$this->logError( 'Invalid parameters for renameNamedSet', [
					'imgName' => $imgName, 'sha1' => $sha1, 'oldName' => $oldName, 'newName' => $newName
				] );
				return false;
			}

			// Check if target name already exists
			if ( $this->namedSetExists( $imgName, $sha1, $newName ) ) {
				$this->logError( 'Cannot rename: target name already exists', [
					'newName' => $newName
				] );
				return false;
			}

			$dbw->update(
				'layer_sets',
				[ 'ls_name' => $newName ],
				[
					'ls_img_name' => $this->buildImageNameLookup( $imgName ),
					'ls_img_sha1' => $sha1,
					'ls_name' => $oldName
				],
				__METHOD__
			);

			$rowsUpdated = $dbw->affectedRows();

			if ( $rowsUpdated === 0 ) {
				$this->logError( 'No rows updated during rename', [
					'oldName' => $oldName, 'newName' => $newName
				] );
				return false;
			}

			$this->logger->info( 'Named layer set renamed', [
				'imgName' => $imgName,
				'sha1' => $sha1,
				'oldName' => $oldName,
				'newName' => $newName,
				'rowsUpdated' => $rowsUpdated
			] );

			// Invalidate cache
			$this->layerSetCache = [];

			return true;
		} catch ( \Throwable $e ) {
			$this->logger->warning( 'Failed to rename named layer set: {message}', [
				'message' => $e->getMessage(),
				'oldName' => $oldName,
				'newName' => $newName
			] );
			return false;
		}
	}

	public function getLayerSetByName( string $imgName, string $sha1, string $setName ): ?array {
		$this->logDebug( "getLayerSetByName called: imgName=$imgName, sha1=$sha1, setName=$setName" );

		$dbr = $this->getReadDb();
		if ( !$dbr ) {
			$this->logError( "getLayerSetByName: no database connection" );
			return null;
		}
		$row = $dbr->selectRow(
			'layer_sets',
			[ 'ls_id', 'ls_img_name', 'ls_img_sha1', 'ls_img_major_mime', 'ls_img_minor_mime',
				'ls_revision', 'ls_json_blob', 'ls_timestamp', 'ls_user_id', 'ls_name' ],
			[
				'ls_img_name' => $this->buildImageNameLookup( $imgName ),
				'ls_img_sha1' => $sha1,
				'ls_name' => $setName
			],
			__METHOD__,
			[ 'ORDER BY' => 'ls_revision DESC' ]
		);

		if ( !$row ) {
					$this->logDebug( "getLayerSetByName: no row found for setName=$setName" );
			return null;
		}

		$blobSize = strlen( $row->ls_json_blob );
		$this->logDebug( "getLayerSetByName: found row with ls_id={$row->ls_id}, blob size=$blobSize" );

		$maxJsonSize = (int)$this->config->get( 'LayersMaxBytes' );
		if ( $blobSize > $maxJsonSize ) {
			$this->logError( "JSON blob too large for layer set by name: $blobSize > $maxJsonSize" );
			return null;
		}

		try {
			$jsonData = json_decode( $row->ls_json_blob, true, self::JSON_DECODE_MAX_DEPTH, JSON_THROW_ON_ERROR );
		} catch ( \JsonException $e ) {
			$this->logError( "Invalid JSON data for layer set by name" );
			return null;
		}

		return [
			'id' => (int)$row->ls_id,
			'imgName' => $row->ls_img_name,
			'imgSha1' => $row->ls_img_sha1,
			'majorMime' => $row->ls_img_major_mime,
			'minorMime' => $row->ls_img_minor_mime,
			'revision' => (int)$row->ls_revision,
			'data' => $jsonData,
			'timestamp' => $row->ls_timestamp,
			'userId' => (int)$row->ls_user_id,
			'setName' => $row->ls_name
		];
	}

	/**
	 * Add a value to the internal cache
	 *
	 * @param string $key Cache key
	 * @param mixed $value Value to cache
	 */
	private function addToCache( string $key, $value ): void {
		if ( count( $this->layerSetCache ) >= self::MAX_CACHE_SIZE ) {
			array_shift( $this->layerSetCache );
		}
		$this->layerSetCache[$key] = $value;
	}

	/**
	 * Log an error message
	 *
	 * @param string $message Error message
	 * @param array $context Additional context
	 */
	private function logError( string $message, array $context = [] ): void {
		$this->logger->error( $message, $context );
	}

	/**
	 * Log a debug message
	 *
	 * @param string $message Debug message
	 * @param array $context Additional context
	 */
	private function logDebug( string $message, array $context = [] ): void {
		$this->logger->debug( $message, $context );
	}

	/**
	 * Clear the internal cache
	 *
	 * @param string|null $pattern Optional pattern to match cache keys
	 */
	private function clearCache( ?string $pattern = null ): void {
		if ( $pattern === null ) {
			$this->layerSetCache = [];
			return;
		}
		foreach ( array_keys( $this->layerSetCache ) as $key ) {
			if ( strpos( $key, $pattern ) !== false ) {
				unset( $this->layerSetCache[$key] );
			}
		}
	}

	public function isSchemaReady(): bool {
		return $this->schemaManager->isSchemaReady();
	}

	private function buildSafeQueryOptions( array $options = [] ): array {
		$queryOptions = [];
		$sortColumn = $this->validateSortColumn( $options['sort'] ?? 'ls_timestamp' );
		$sortDirection = $this->validateSortDirection( $options['direction'] ?? 'DESC' );
		$queryOptions['ORDER BY'] = "$sortColumn $sortDirection";

		if ( isset( $options['limit'] ) && is_numeric( $options['limit'] ) ) {
			$limit = (int)$options['limit'];
			if ( $limit > 0 && $limit <= 1000 ) {
				$queryOptions['LIMIT'] = $limit;
			}
		}

		if ( isset( $options['offset'] ) && is_numeric( $options['offset'] ) ) {
			$offset = (int)$options['offset'];
			if ( $offset >= 0 ) {
				$queryOptions['OFFSET'] = $offset;
			}
		}
		return $queryOptions;
	}

	private function validateSortColumn( string $sortColumn ): string {
		$validSortColumns = [
			'ls_id', 'ls_img_name', 'ls_img_sha1', 'ls_img_major_mime', 'ls_img_minor_mime',
			'ls_revision', 'ls_timestamp', 'ls_user_id', 'ls_name', 'ls_size', 'ls_layer_count'
		];
		if ( in_array( $sortColumn, $validSortColumns, true ) ) {
			return $sortColumn;
		}
		$this->logError( 'Invalid sort column rejected: ' . $sortColumn );
		return 'ls_timestamp';
	}

	private function validateSortDirection( string $sortDirection ): string {
		if ( strtoupper( trim( $sortDirection ) ) === 'DESC' ) {
			return 'DESC';
		}
		return 'ASC';
	}

	private function normalizeImageName( string $imgName ): string {
		$trimmed = trim( $imgName );
		if ( $trimmed === '' ) {
			return '';
		}
		return str_replace( ' ', '_', $trimmed );
	}

	private function buildImageNameLookup( string $imgName ): array {
		$normalized = $this->normalizeImageName( $imgName );
		$variants = [ $normalized, str_replace( '_', ' ', $normalized ), $imgName, str_replace( '_', ' ', $imgName ) ];
		$filtered = array_values( array_unique( array_filter( $variants, static function ( $value ) {
			return $value !== null && $value !== '';
		} ) ) );
		return $filtered ?: [ $normalized ];
	}

	/**
	 * Find the SHA1 hash used for a layer set by image name and set name.
	 * This is useful for SHA1 mismatch issues with foreign files.
	 *
	 * @param string $imgName Image name
	 * @param string $setName Named set name
	 * @return string|null The SHA1 hash used in the database, or null if not found
	 */
	public function findSetSha1( string $imgName, string $setName ): ?string {
		$dbr = $this->getReadDb();
		if ( !$dbr ) {
			return null;
		}

		$row = $dbr->selectRow(
			'layer_sets',
			[ 'ls_img_sha1' ],
			[
				'ls_img_name' => $this->buildImageNameLookup( $imgName ),
				'ls_name' => $setName
			],
			__METHOD__,
			[ 'LIMIT' => 1 ]
		);

		return $row ? $row->ls_img_sha1 : null;
	}

	/**
	 * Count the number of unique slides (layer sets with ls_img_sha1 = 'slide').
	 *
	 * Slides are identified by a special SHA1 value of 'slide' to distinguish
	 * them from regular image layer sets.
	 *
	 * @param string $prefix Optional prefix filter for slide names
	 * @return int Number of unique slides
	 */
	public function countSlides( string $prefix = '' ): int {
		$dbr = $this->getReadDb();
		if ( !$dbr ) {
			return 0;
		}

		$conditions = [
			'ls_img_sha1' => 'slide'
		];

		// Add prefix filter if provided
		if ( $prefix !== '' ) {
			$escapedPrefix = $dbr->addQuotes( 'Slide:' . $prefix . '%' );
			$conditions[] = 'ls_img_name LIKE ' . $escapedPrefix;
		}

		$count = $dbr->selectField(
			'layer_sets',
			'COUNT(DISTINCT ls_img_name)',
			$conditions,
			__METHOD__
		);

		return (int)$count;
	}

	/**
	 * List slides with metadata for the Special:Slides page.
	 *
	 * Returns an array of slide data including canvas dimensions, layer count,
	 * revision history, and creator/modifier information.
	 *
	 * @param string $prefix Optional prefix filter for slide names
	 * @param int $limit Maximum number of slides to return (default 50)
	 * @param int $offset Pagination offset (default 0)
	 * @param string $sort Sort order: 'name', 'created', or 'modified' (default 'name')
	 * @return array Array of slide data
	 */
	public function listSlides(
		string $prefix = '',
		int $limit = 50,
		int $offset = 0,
		string $sort = 'name'
	): array {
		$dbr = $this->getReadDb();
		if ( !$dbr ) {
			return [];
		}

		// Build conditions
		$conditions = [
			'ls_img_sha1' => 'slide'
		];

		if ( $prefix !== '' ) {
			$escapedPrefix = $dbr->addQuotes( 'Slide:' . $prefix . '%' );
			$conditions[] = 'ls_img_name LIKE ' . $escapedPrefix;
		}

		// Determine sort order
		$orderBy = 'slide_name ASC';
		if ( $sort === 'created' ) {
			$orderBy = 'first_timestamp DESC';
		} elseif ( $sort === 'modified' ) {
			$orderBy = 'latest_timestamp DESC';
		}

		// Build subquery to get latest revision for each slide
		$latestRevisionSubquery = $dbr->buildSelectSubquery(
			'layer_sets',
			[ 'ls_img_name', 'max_rev' => 'MAX(ls_revision)' ],
			$conditions,
			__METHOD__,
			[ 'GROUP BY' => 'ls_img_name' ]
		);

		// Main query with join to get slide data
		$result = $dbr->select(
			[
				'ls' => 'layer_sets',
				'latest' => $latestRevisionSubquery
			],
			[
				'slide_name' => 'ls.ls_img_name',
				'revision_count' => '(SELECT COUNT(*) FROM ' .
					$dbr->tableName( 'layer_sets' ) .
					' WHERE ls_img_name = ls.ls_img_name AND ls_img_sha1 = ' .
					$dbr->addQuotes( 'slide' ) . ')',
				'first_timestamp' => '(SELECT MIN(ls_timestamp) FROM ' .
					$dbr->tableName( 'layer_sets' ) .
					' WHERE ls_img_name = ls.ls_img_name AND ls_img_sha1 = ' .
					$dbr->addQuotes( 'slide' ) . ')',
				'latest_timestamp' => 'ls.ls_timestamp',
				'ls_json_blob' => 'ls.ls_json_blob',
				'ls_user_id' => 'ls.ls_user_id',
				'ls_layer_count' => 'ls.ls_layer_count',
				'ls_revision' => 'ls.ls_revision'
			],
			[
				'ls.ls_img_sha1' => 'slide',
				'ls.ls_revision = latest.max_rev'
			],
			__METHOD__,
			[
				'ORDER BY' => $orderBy,
				'LIMIT' => $limit,
				'OFFSET' => $offset
			],
			[
				'latest' => [ 'JOIN', 'ls.ls_img_name = latest.ls_img_name' ]
			]
		);

		$slides = [];
		foreach ( $result as $row ) {
			// Parse JSON data to extract canvas settings
			$jsonData = json_decode( $row->ls_json_blob, true, self::JSON_DECODE_MAX_DEPTH );

			// Get first revision creator
			$firstRevisionRow = $dbr->selectRow(
				'layer_sets',
				[ 'ls_user_id' ],
				[
					'ls_img_name' => $row->slide_name,
					'ls_img_sha1' => 'slide',
					'ls_revision' => 1
				],
				__METHOD__
			);
			$createdById = $firstRevisionRow ? (int)$firstRevisionRow->ls_user_id : (int)$row->ls_user_id;

			// Extract slide name from full name (remove 'Slide:' prefix)
			$slideName = $row->slide_name;
			if ( str_starts_with( $slideName, 'Slide:' ) ) {
				$slideName = substr( $slideName, 6 );
			}

			$slides[] = [
				'name' => $slideName,
				'canvasWidth' => $jsonData['canvasWidth'] ?? 800,
				'canvasHeight' => $jsonData['canvasHeight'] ?? 600,
				'backgroundColor' => $jsonData['backgroundColor'] ?? '#ffffff',
				'layerCount' => (int)$row->ls_layer_count,
				'revisionCount' => (int)$row->revision_count,
				'created' => wfTimestamp( TS_ISO_8601, $row->first_timestamp ),
				'modified' => wfTimestamp( TS_ISO_8601, $row->latest_timestamp ),
				'createdById' => $createdById,
				'modifiedById' => (int)$row->ls_user_id
			];
		}

		return $slides;
	}
}
