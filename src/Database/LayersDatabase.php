<?php

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

	private function getWriteDb() {
		if ( !$this->dbw ) {
			$this->dbw = $this->loadBalancer->getConnection( DB_PRIMARY );
		}
		return $this->dbw;
	}

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
		?string $setName = null
	): ?int {
		$dbw = $this->getWriteDb();
		if ( !$dbw ) {
			return null;
		}

		$mime = $imgMetadata['mime'] ?? '';
		$sha1 = $imgMetadata['sha1'] ?? '';
		$normalizedImgName = $this->normalizeImageName( $imgName );

		// DEBUG: Log incoming set name (use error_log to guarantee output)
		error_log( "LAYERS DEBUG saveLayerSet: setName_param=" . var_export( $setName, true ) );
		wfDebugLog( 'Layers', "saveLayerSet: imgName='$imgName', setName_param=" . var_export( $setName, true ) );

		// Default to configured default set name
		if ( $setName === null || $setName === '' ) {
			$setName = $this->config->get( 'LayersDefaultSetName' );
			error_log( "LAYERS DEBUG saveLayerSet: using default, setName='$setName'" );
			wfDebugLog( 'Layers', "saveLayerSet: using default, now setName='$setName'" );
		}

		error_log( "LAYERS DEBUG saveLayerSet: final setName='$setName'" );
		wfDebugLog( 'Layers', "saveLayerSet: final setName='$setName'" );

		if ( empty( $normalizedImgName ) || empty( $sha1 ) || $userId <= 0 ) {
			$this->logError( 'Invalid parameters for saveLayerSet', [
				'imgName' => $imgName, 'sha1' => $sha1, 'userId' => $userId
			] );
			return null;
		}

		// Check named set limit for new sets
		if ( !$this->namedSetExists( $normalizedImgName, $sha1, $setName ) ) {
			$maxSets = $this->config->get( 'LayersMaxNamedSets' );
			$setCount = $this->countNamedSets( $normalizedImgName, $sha1 );
			if ( $setCount >= $maxSets ) {
				$this->logError( 'Named set limit reached', [
					'imgName' => $imgName, 'count' => $setCount, 'max' => $maxSets
				] );
				throw new \OverflowException( 'layers-max-sets-reached' );
			}
		}

		$maxRetries = 3;
		for ( $retryCount = 0; $retryCount < $maxRetries; $retryCount++ ) {
			// PERFORMANCE FIX: Add exponential backoff to prevent DB hammering
			if ( $retryCount > 0 ) {
				usleep( $retryCount * 100000 ); // 100ms, 200ms on retries
			}
			$dbw->startAtomic( __METHOD__ );
			try {
				$revision = $this->getNextRevisionForSet( $normalizedImgName, $sha1, $setName, $dbw );
				$timestamp = $dbw->timestamp();

				$dataStructure = [
					'revision' => $revision,
					'schema' => 1,
					'created' => $timestamp,
					'layers' => $layersData
				];
				$jsonBlob = json_encode( $dataStructure, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR );

				$maxAllowedSize = $this->config->get( 'LayersMaxBytes' );
				if ( strlen( $jsonBlob ) > $maxAllowedSize ) {
					$this->logError( "JSON blob size exceeds maximum allowed size" );
					$dbw->endAtomic( __METHOD__ );
					return null;
				}

				list( $majorMime, $minorMime ) = explode( '/', $mime, 2 ) + [ '', '' ];

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
				$maxRevisions = $this->config->get( 'LayersMaxRevisionsPerSet' );
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

		$maxJsonSize = $this->config->get( 'LayersMaxBytes' );
		if ( strlen( $row->ls_json_blob ) > $maxJsonSize ) {
			$this->logError( "JSON blob too large for layer set ID: {$layerSetId}" );
			return false;
		}

		try {
			$jsonData = json_decode( $row->ls_json_blob, true, 512, JSON_THROW_ON_ERROR );
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
			return false;
		}

		$maxJsonSize = $this->config->get( 'LayersMaxBytes' );
		if ( strlen( $row->ls_json_blob ) > $maxJsonSize ) {
			$this->logError( "JSON blob too large for latest layer set" );
			return false;
		}

		try {
			$jsonData = json_decode( $row->ls_json_blob, true, 512, JSON_THROW_ON_ERROR );
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

	private function getNextRevision( string $imgName, string $sha1, $dbw ): int {
		$maxRevision = $dbw->selectField(
			'layer_sets',
			'MAX(ls_revision)',
			[
				'ls_img_name' => $this->buildImageNameLookup( $imgName ),
				'ls_img_sha1' => $sha1
			],
			__METHOD__,
			[ 'FOR UPDATE' ]
		);
		return (int)$maxRevision + 1;
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
	 * @return bool True if the named set exists
	 */
	public function namedSetExists( string $imgName, string $sha1, string $setName ): bool {
		$dbr = $this->getReadDb();
		if ( !$dbr ) {
			return false;
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
	 * @return int Number of distinct named sets
	 */
	public function countNamedSets( string $imgName, string $sha1 ): int {
		$dbr = $this->getReadDb();
		if ( !$dbr ) {
			return 0;
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
	 * @return int Number of revisions
	 */
	public function countSetRevisions( string $imgName, string $sha1, string $setName ): int {
		$dbr = $this->getReadDb();
		if ( !$dbr ) {
			return 0;
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
	 * @param string $imgName Image name
	 * @param string $sha1 Image SHA1 hash
	 * @return array Array of named set summaries
	 */
	public function getNamedSetsForImage( string $imgName, string $sha1 ): array {
		$dbr = $this->getReadDb();
		if ( !$dbr ) {
			return [];
		}

		// Get distinct set names with their latest revision info
		$result = $dbr->select(
			'layer_sets',
			[
				'ls_name',
				'revision_count' => 'COUNT(*)',
				'latest_revision' => 'MAX(ls_revision)',
				'latest_timestamp' => 'MAX(ls_timestamp)',
			],
			[
				'ls_img_name' => $this->buildImageNameLookup( $imgName ),
				'ls_img_sha1' => $sha1
			],
			__METHOD__,
			[
				'GROUP BY' => 'ls_name',
				'ORDER BY' => 'MAX(ls_timestamp) DESC'
			]
		);

		$namedSets = [];
		foreach ( $result as $row ) {
			// Get the user who made the latest revision
			$latestRow = $dbr->selectRow(
				'layer_sets',
				[ 'ls_user_id' ],
				[
					'ls_img_name' => $this->buildImageNameLookup( $imgName ),
					'ls_img_sha1' => $sha1,
					'ls_name' => $row->ls_name,
					'ls_revision' => (int)$row->latest_revision
				],
				__METHOD__
			);

			$namedSets[] = [
				'name' => $row->ls_name ?? 'default',
				'revision_count' => (int)$row->revision_count,
				'latest_revision' => (int)$row->latest_revision,
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

		// Delete all revisions for this set that are NOT in the keep list
		$dbw->delete(
			'layer_sets',
			[
				'ls_img_name' => $this->buildImageNameLookup( $imgName ),
				'ls_img_sha1' => $sha1,
				'ls_name' => $setName,
				'ls_id NOT IN (' . $dbw->makeList( $keepIds ) . ')'
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

	public function getLayerSetByName( string $imgName, string $sha1, string $setName ): ?array {
		$dbr = $this->getReadDb();
		if ( !$dbr ) {
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
			return null;
		}

		$maxJsonSize = $this->config->get( 'LayersMaxBytes' );
		if ( strlen( $row->ls_json_blob ) > $maxJsonSize ) {
			$this->logError( "JSON blob too large for layer set by name" );
			return null;
		}

		try {
			$jsonData = json_decode( $row->ls_json_blob, true, 512, JSON_THROW_ON_ERROR );
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

	private function addToCache( string $key, $value ): void {
		if ( count( $this->layerSetCache ) >= self::MAX_CACHE_SIZE ) {
			array_shift( $this->layerSetCache );
		}
		$this->layerSetCache[$key] = $value;
	}

	private function logError( string $message, array $context = [] ): void {
		$this->logger->error( $message, $context );
	}

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
}
