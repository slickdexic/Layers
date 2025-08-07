<?php
/**
 * Database operations for the Layers extension
 *
 * @file
 * @ingroup Extensions
 */

namespace MediaWiki\Extension\Layers\Database;

use MediaWiki\MediaWikiServices;
use Psr\Log\LoggerInterface;
use Wikimedia\Rdbms\DBError;
use Wikimedia\Rdbms\IDatabase;
use Wikimedia\Rdbms\ILoadBalancer;

class LayersDatabase {

	/** @var ILoadBalancer */
	private $loadBalancer;

	/** @var IDatabase */
	private $dbw;

	/** @var IDatabase */
	private $dbr;

	/** @var LoggerInterface */
	private $logger;

	public function __construct() {
		$this->loadBalancer = MediaWikiServices::getInstance()->getDBLoadBalancer();
		// Use ILoadBalancer constants for MediaWiki 1.44+
		$this->dbw = $this->loadBalancer->getConnection( ILoadBalancer::DB_PRIMARY );
		$this->dbr = $this->loadBalancer->getConnection( ILoadBalancer::DB_REPLICA );
		// TODO: Fix logger initialization for MediaWiki 1.44
		$this->logger = null;
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
			// Get next revision number for this image
			$revision = $this->getNextRevision( $imgName, $sha1 );
			$timestamp = $this->dbw->timestamp();

			// Prepare JSON data
			$jsonBlob = json_encode( [
				'revision' => $revision,
				'schema' => 1,
				'created' => $timestamp,
				'layers' => $layersData
			] );

			if ( $jsonBlob === false ) {
				return false;
			}

			// Insert layer set
			$this->dbw->insert(
				'layer_sets',
				[
					'ls_img_name' => $imgName,
					'ls_img_major_mime' => $majorMime,
					'ls_img_minor_mime' => $minorMime,
					'ls_img_sha1' => $sha1,
					'ls_json_blob' => $jsonBlob,
					'ls_user_id' => $userId,
					'ls_timestamp' => $timestamp,
					'ls_revision' => $revision,
					'ls_name' => $setName
				],
				__METHOD__
			);

			return $this->dbw->insertId();

		} catch ( DBError $e ) {
			if ( $this->logger ) {
				$this->logger->warning( 'Failed to save layer set: {message}', [ 'message' => $e->getMessage() ] );
			}
			return false;
		}
	}

	/**
	 * Get layer set by ID
	 *
	 * @param int $layerSetId Layer set ID
	 * @return array|false Layer set data or false if not found
	 */
	public function getLayerSet( int $layerSetId ) {
		$row = $this->dbr->selectRow(
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
			return false;
		}

		$jsonData = json_decode( $row->ls_json_blob, true );
		if ( $jsonData === null ) {
			return false;
		}

		return [
			'id' => (int)$row->ls_id,
			'imgName' => $row->ls_img_name,
			'userId' => (int)$row->ls_user_id,
			'timestamp' => $row->ls_timestamp,
			'revision' => (int)$row->ls_revision,
			'name' => $row->ls_name,
			'data' => $jsonData
		];
	}

	/**
	 * Get latest layer set for an image
	 *
	 * @param string $imgName Image filename
	 * @param string $sha1 Image SHA1 hash
	 * @return array|false Layer set data or false if not found
	 */
	public function getLatestLayerSet( string $imgName, string $sha1 ) {
		$row = $this->dbr->selectRow(
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
		$maxRevision = $this->dbr->selectField(
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
		$result = $this->dbr->select(
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
			$this->dbw->delete(
				'layer_sets',
				[
					'ls_img_name' => $imgName,
					'ls_img_sha1' => $sha1
				],
				__METHOD__
			);
			return true;
		} catch ( DBError $e ) {
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
			$res = $this->dbr->selectRow(
				'layer_sets',
				[
					'ls_id',
					'ls_img_name',
					'ls_img_sha1',
					'ls_img_major_mime',
					'ls_img_minor_mime',
					'ls_revision',
					'ls_data',
					'ls_timestamp',
					'ls_user_id',
					'ls_set_name'
				],
				[
					'ls_img_name' => $imgName,
					'ls_img_sha1' => $sha1,
					'ls_set_name' => $setName
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
				'data' => json_decode( $res->ls_data, true ),
				'timestamp' => $res->ls_timestamp,
				'userId' => (int)$res->ls_user_id,
				'setName' => $res->ls_set_name
			];
		} catch ( DBError $e ) {
			if ( $this->logger ) {
				$this->logger->warning( 'Failed to get layer set by name: {message}', [ 'message' => $e->getMessage() ] );
			}
			return null;
		}
	}
}
